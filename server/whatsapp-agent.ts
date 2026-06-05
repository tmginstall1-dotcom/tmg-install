/**
 * WhatsApp AI Sales Agent — Phase 9
 *
 * This module is a layer ABOVE the existing WhatsApp transport.
 * It does NOT replace the legacy bot flow.
 * When ai_whatsapp_agent_enabled = true, this module intercepts inbound
 * messages first. If it handles the message it returns { handled: true }.
 * If disabled or unhandled, the legacy bot continues as before.
 *
 * SAFETY RULES:
 * - Respects ai_master_kill_switch
 * - Respects ai_whatsapp_agent_enabled
 * - Never modifies booking/payment/quote logic
 * - All sends use existing sendBotMessage transport
 * - All actions logged to ai_audit_log
 * - Fails gracefully — never crashes the webhook handler
 */

import { db } from "./db";
import { eq, and, lte, gte, desc, sql as drizzleSql, ilike, or as drizzleOr } from "drizzle-orm";
import {
  aiFeatureFlags,
  aiAuditLog,
  aiWhatsappFollowups,
  aiWhatsappHandoffs,
  whatsappSessions,
  appSettings,
  customerRatings,
  catalogItems,
  jobUpdates,
  quotes,
} from "@shared/schema";
import { PricingConfig, computePricing, type PricingItem, type PricingCatalogEntry } from "@shared/pricing";
import { sendBotMessage, downloadWhatsAppMedia } from "./whatsapp";
import { storage } from "./storage";
import { openai } from "./replit_integrations/audio/client";
import { scoreLead } from "./ai-lead-scoring";
import { sendAiAlert } from "./ai-alerts";
import { callLLM, summarizeIfLong, KillSwitchError, CircuitOpenError } from "./ai-llm-client";
import { z } from "zod";

// ── Zod schema for fact-extraction LLM output ────────────────────────────────
// World-class agents validate LLM output. If gpt-4o hallucinates a key or
// returns the wrong type, the client will auto-repair with one retry; if it
// still fails, we fall back to deterministic behavior instead of crashing.
const factExtractionSchema = z.object({
  serviceType: z.enum(["installation", "dismantling", "relocation", "office_fitout", "repair", "disposal", "unknown"]).optional(),
  customerName: z.string().optional(),
  jobAddress: z.string().optional(),
  floorLevel: z.number().int().min(-5).max(200).optional(),
  hasLift: z.boolean().optional(),
  homeOrOffice: z.enum(["home", "office", "commercial", "unknown"]).optional(),
  itemTypes: z.array(z.string()).optional(),
  quantity: z.number().int().min(0).max(10000).optional(),
  urgency: z.enum(["asap", "this_week", "this_month", "flexible"]).optional(),
  preferredDate: z.string().optional(),
  photosPresent: z.boolean().optional(),
  specialNotes: z.string().optional(),
  toAddress: z.string().optional(),
  // Same-Property Move: customer is shifting items WITHIN the same address
  // (renovation, room swap, between floors of the same condo). When true,
  // we skip the transport fee and only charge mobilisation + carry handling.
  samePropertyMove: z.boolean().optional(),
  confidenceLevel: z.number().min(0).max(1).optional(),
}).strict().partial();

// ── Types ─────────────────────────────────────────────────────────────────────

export type AiConvState =
  | "new_lead"
  | "qualifying"
  | "waiting_for_customer"
  | "quote_ready"
  | "human_review_required"
  | "quote_sent"
  | "deposit_pending"
  | "booking_pending"
  | "completed"
  | "stale_reactivation_candidate"
  | "blocked_outside_window";

export interface CaseFacts {
  serviceType?: "installation" | "dismantling" | "relocation" | "office_fitout" | "repair" | "disposal" | "unknown";
  customerName?: string;
  phone?: string;
  sourceChannel?: string;
  jobAddress?: string;
  floorLevel?: number;
  hasLift?: boolean;
  homeOrOffice?: "home" | "office" | "commercial" | "unknown";
  itemTypes?: string[];
  quantity?: number;
  urgency?: "asap" | "this_week" | "this_month" | "flexible";
  preferredDate?: string;
  photosPresent?: boolean;
  specialNotes?: string;
  toAddress?: string;
  samePropertyMove?: boolean;
  confidenceLevel?: number;
}

const REQUIRED_FACTS: (keyof CaseFacts)[] = [
  "serviceType",
  "jobAddress",
  "homeOrOffice",
  "itemTypes",
  "floorLevel",
  "hasLift",
  "preferredDate",
];

const HANDOFF_TRIGGERS = /\b(refund|complaint|scam|useless|ridiculous|angry|cheating|threatening|speak to (a )?human|talk to (a )?person|manager|escalate|legal|sue|lawyer|dispute)\b/i;
const CUSTOM_PRICING_TRIGGERS = /\b(special (rate|price|deal|discount)|negotiate|can you do better|cheaper|give me|best price)\b/i;
const UNSUPPORTED_TRIGGERS = /\b(deliver|shipping|courier|lorry|moving company|buy furniture|sell furniture|repair|fix|warranty|insurance)\b/i;

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Mask a phone number to last 4 digits for safe logging */
function maskPhone(phone: string): string {
  if (!phone || phone.length <= 4) return "****";
  return `****${phone.slice(-4)}`;
}

async function getFlag(key: string): Promise<boolean> {
  try {
    const rows = await db.select().from(aiFeatureFlags).where(eq(aiFeatureFlags.key, key)).limit(1);
    return rows[0]?.value ?? false;
  } catch { return false; }
}

async function logAudit(
  actionType: string,
  actor: string,
  summary: string,
  detail?: Record<string, unknown>,
) {
  try {
    await db.insert(aiAuditLog).values({
      actionType,
      actor,
      module: "whatsapp_agent",
      summary,
      detail: detail ?? {},
      outcome: "success",
    });
  } catch { /* non-fatal */ }
}

/**
 * Persistent DB idempotency check.
 * Queries ai_audit_log for a prior handled event with this correlationId (wamid).
 * Survives process restarts — the in-memory dedup set does not.
 */
async function checkDuplicateByCorrelationId(correlationId: string): Promise<boolean> {
  if (!correlationId) return false;
  try {
    const rows = await db
      .select({ id: aiAuditLog.id })
      .from(aiAuditLog)
      .where(
        and(
          eq(aiAuditLog.module, "whatsapp_agent"),
          drizzleSql`${aiAuditLog.detail}->>'correlationId' = ${correlationId}`,
          drizzleSql`${aiAuditLog.actionType} IN ('ai_reply_sent','ai_duplicate_skipped','handoff_triggered')`,
        )
      )
      .limit(1);
    return rows.length > 0;
  } catch { return false; }
}

function parseFacts(raw: string | null | undefined): CaseFacts {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function parseMissing(raw: string | null | undefined): string[] {
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

// ── 24-Hour Window Check ──────────────────────────────────────────────────────
// WhatsApp policy: businesses may only send free-form messages within 24 hours
// of the last customer-initiated message. Outside this window, only approved
// message templates are allowed.
export function check24hrWindow(lastInboundAt: Date | null | undefined): boolean {
  if (!lastInboundAt) return false;
  const elapsed = Date.now() - new Date(lastInboundAt).getTime();
  return elapsed < 24 * 60 * 60 * 1000;
}

// ── Vision: identify furniture in a customer photo ──────────────────────────
// gpt-4o is multimodal — pass the image as a data URL and ask for structured
// items. We route through callLLM so we get telemetry, retries, breaker, and
// schema validation with one auto-repair like every other agent surface.
const visionResultSchema = z.object({
  items: z.array(z.object({
    type: z.string(),                                // e.g. "wardrobe"
    qty: z.number().int().min(1).max(50).optional(), // visible count
    notes: z.string().optional(),                    // colour/material/condition
  })).max(20),
  description: z.string(),                            // 1-2 sentence summary
  isFurniture: z.boolean(),                           // false → not relevant (selfie, screenshot, address note)
}).strict();
export type FurnitureVisionResult = z.infer<typeof visionResultSchema>;

export async function analyzeFurniturePhoto(
  base64: string,
  mimeType: string,
  caption?: string,
): Promise<FurnitureVisionResult | null> {
  try {
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const captionLine = caption?.trim() ? `\nCustomer caption: "${caption.trim()}"` : "";
    const { value } = await callLLM({
      agent: "whatsapp_vision_analyze",
      model: "gpt-4o",
      max_tokens: 400,
      schema: visionResultSchema,
      messages: [
        {
          role: "system",
          content:
            "You analyse photos sent by customers of TMG Install, a Singapore furniture installation company. " +
            "Identify the furniture or items in the image so the sales agent does NOT need to ask the customer what's in the photo. " +
            "Return JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Look at this customer photo and return JSON:` +
                `\n- items: array of distinct furniture pieces visible. type is a short noun (wardrobe, bed frame, sofa, dining table, office desk, bookshelf, fridge, etc). qty is the count visible if obvious. notes can mention colour, condition, dismantled vs assembled.` +
                `\n- description: one short sentence summarising what is in the photo.` +
                `\n- isFurniture: true if the photo shows furniture or a room with furniture. false for selfies, screenshots, payment receipts, address signs, random scenery.` +
                captionLine,
            },
            { type: "image_url", image_url: { url: dataUrl, detail: "low" } },
          ],
        },
      ],
    });
    return value;
  } catch (err: any) {
    if (!(err instanceof KillSwitchError) && !(err instanceof CircuitOpenError)) {
      console.warn("[whatsapp-agent] analyzeFurniturePhoto failed:", err?.name, err?.message);
    }
    return null;
  }
}

// ── Fact Extraction ───────────────────────────────────────────────────────────
async function extractFacts(
  text: string,
  history: Array<{ role: string; content: string }>,
  currentFacts: CaseFacts,
): Promise<{ facts: CaseFacts; confidence: number }> {
  try {
    // Long conversations get summarized into a single paragraph so the
    // prompt stays bounded and we don't lose earlier customer-stated facts.
    const { summary, recent } = await summarizeIfLong("whatsapp_extract_facts", history, 16);
    const historyText = recent.slice(-6).map(h => `${h.role}: ${h.content}`).join("\n");
    const earlierBlock = summary ? `EARLIER CONVERSATION (summary):\n${summary}\n\n` : "";

    const { value: extracted } = await callLLM({
      agent: "whatsapp_extract_facts",
      max_tokens: 600,
      schema: factExtractionSchema,
      messages: [
        {
          role: "system",
          content: `You are a fact extractor for TMG Install, a Singapore furniture installation company.
Extract structured facts from the customer's message and return a JSON object.
Only update fields where the new message provides information — keep existing values for fields not mentioned.

SERVICES: installation, dismantling, relocation, office_fitout, repair, disposal
- "repair" = customer wants something fixed/restored (wobbly chair, broken drawer, loose hinge, reupholstery).
- "disposal" = customer wants old/unwanted items hauled away and discarded (NOT moved to a new place — that's relocation).

SAME-PROPERTY MOVE: set "samePropertyMove": true AND "serviceType": "relocation" when the customer
wants items physically shifted WITHIN the same address (no transport between two buildings). Trigger
phrases include:
  • "move/shift/rearrange furniture within my house / same flat / same condo"
  • "renovation — need to move things to another room / store in living room"
  • "moving stuff between rooms" / "from bedroom to study / from living to balcony"
  • "same unit", "same address", "same property", "same house", "within the unit"
When samePropertyMove is true, "toAddress" is NOT required (pickup = dropoff = the one address).
CURRENT KNOWN FACTS: ${JSON.stringify(currentFacts)}
${earlierBlock}CONVERSATION HISTORY (recent):
${historyText}

Return ONLY a JSON object with these optional fields:
{
  "serviceType": "installation"|"dismantling"|"relocation"|"office_fitout"|"repair"|"disposal"|"unknown",
  "customerName": string,
  "jobAddress": string,
  "floorLevel": number,
  "hasLift": boolean,
  "homeOrOffice": "home"|"office"|"commercial"|"unknown",
  "itemTypes": string[],
  "quantity": number,
  "urgency": "asap"|"this_week"|"this_month"|"flexible",
  "preferredDate": string,
  "photosPresent": boolean,
  "specialNotes": string,
  "toAddress": string,
  "samePropertyMove": boolean (true ONLY when customer is moving items within the SAME address),
  "confidenceLevel": number (0.0-1.0 how confident you are about serviceType)
}
Only include fields where you have new/updated information. Use exactly these field names — no extras.`,
        },
        { role: "user", content: text },
      ],
    });

    const merged: CaseFacts = { ...currentFacts, ...(extracted as Partial<CaseFacts>) };
    const confidence = typeof extracted.confidenceLevel === "number"
      ? extracted.confidenceLevel
      : (currentFacts.confidenceLevel ?? 0.5);
    return { facts: merged, confidence };
  } catch (err: any) {
    // KillSwitch/CircuitOpen: stay safe — return last-known facts. The outer
    // turn handler will still send a deterministic reply or hand off.
    if (!(err instanceof KillSwitchError) && !(err instanceof CircuitOpenError)) {
      console.warn("[whatsapp-agent] extractFacts failed:", err?.name, err?.message);
    }
    return { facts: currentFacts, confidence: currentFacts.confidenceLevel ?? 0.5 };
  }
}

// ── Fact normalization ────────────────────────────────────────────────────────
// Apply deterministic post-processing to extracted facts so we don't ask
// pointless follow-ups. The clearest example: ground floor (level 1) doesn't
// have a lift in any meaningful sense, so we auto-mark hasLift=true and skip
// the question entirely.
function normalizeFacts(facts: CaseFacts): CaseFacts {
  const out = { ...facts };
  if (out.floorLevel === 1 && out.hasLift === undefined) {
    out.hasLift = true;
  }
  return out;
}

// ── Missing Facts Check ───────────────────────────────────────────────────────
/**
 * Treat an address as "complete enough" only if it has a block/house number,
 * a unit (#01-23), a postal code (6 digits), or at least 2 separate digit
 * groups. "Clementi Ave 1" alone (1 digit, street suffix) is too vague —
 * we want to push the AI to re-ask for a real address.
 */
function isAddressComplete(addr?: string): boolean {
  if (!addr) return false;
  const s = addr.trim();
  if (s.length < 12) return false;
  const hasBlock     = /\b(blk|block)\s*\d+/i.test(s);
  const hasUnit      = /#\s*\d+\s*[-\u2013]\s*\d+/.test(s);
  const hasPostal    = /\b(?:s|sg|singapore)?\s*\d{6}\b/i.test(s);
  const digitGroups  = (s.match(/\d+/g) || []).length;
  return hasBlock || hasUnit || hasPostal || digitGroups >= 2;
}

function computeMissingFacts(facts: CaseFacts): string[] {
  const missing: string[] = [];
  if (!facts.serviceType || facts.serviceType === "unknown") missing.push("serviceType");
  if (!isAddressComplete(facts.jobAddress)) missing.push("jobAddress");
  if (!facts.homeOrOffice || facts.homeOrOffice === "unknown") missing.push("homeOrOffice");
  if (!facts.itemTypes || facts.itemTypes.length === 0) missing.push("itemTypes");
  if (facts.floorLevel === undefined) missing.push("floorLevel");
  // Skip lift question for ground floor — it's a non-question.
  if (facts.hasLift === undefined && facts.floorLevel !== 1) missing.push("hasLift");
  if (!facts.preferredDate) missing.push("preferredDate");
  // For Same-Property Moves the destination IS the pickup — don't ask for toAddress.
  if (facts.serviceType === "relocation" && !facts.toAddress && !facts.samePropertyMove) missing.push("toAddress");
  return missing;
}

function isQuoteReady(facts: CaseFacts): boolean {
  const missing = computeMissingFacts(facts);
  // Quote ready if we have core facts — date is optional (can be flexible)
  const blocking = missing.filter(f => f !== "preferredDate");
  return blocking.length === 0;
}

// ── Handoff Detection ─────────────────────────────────────────────────────────
interface HandoffCheck {
  required: boolean;
  reason: string;
}

async function shouldHandoff(
  text: string,
  facts: CaseFacts,
  confidence: number,
): Promise<HandoffCheck> {
  if (HANDOFF_TRIGGERS.test(text)) {
    return { required: true, reason: "frustrated" };
  }
  if (CUSTOM_PRICING_TRIGGERS.test(text)) {
    return { required: true, reason: "custom_pricing" };
  }
  if (UNSUPPORTED_TRIGGERS.test(text)) {
    return { required: true, reason: "unsupported_service" };
  }
  const lowConfFlag = await getFlag("ai_whatsapp_handoff_required_on_low_confidence");
  if (lowConfFlag && confidence < 0.3) {
    return { required: true, reason: "low_confidence" };
  }
  return { required: false, reason: "" };
}

// ── Indicative Price Range ────────────────────────────────────────────────────
// Customers often want a ballpark BEFORE giving floor/lift/date. This helper
// reads catalog_items + PricingConfig and returns a SGD low/high range based
// only on the items + service type the AI agent already knows. The full quote
// is still generated later by the existing pricing engine in routes.ts.
//
// Mapping CaseFacts.serviceType → catalog service_type:
//   installation  → install
//   dismantling   → dismantle
//   relocation    → relocate
//   office_fitout → install (treated as install for ballpark)
//   disposal      → dispose
//   repair        → install (no dedicated repair catalog yet — admin prices manually)
function mapAgentServiceToCatalog(s: CaseFacts["serviceType"]): "install" | "dismantle" | "relocate" | "dispose" | "dismantle_dispose" {
  switch (s) {
    case "dismantling": return "dismantle";
    case "relocation":  return "relocate";
    case "disposal":    return "dispose";
    case "repair":
    case "office_fitout":
    case "installation":
    default: return "install";
  }
}

interface IndicativeRange {
  low: number;          // SGD lower bound (best access: ground floor + lift, easy access)
  high: number;         // SGD upper bound (worst case: 4-floor no-lift walkup, moderate access)
  matchedItems: Array<{ term: string; matchedAs: string; unitPrice: number; qty: number }>;
  unmatchedTerms: string[]; // terms with no catalog match → computePricing fallback used
  serviceType: string;
}

// Synonyms / canonical-term normalisation. Customer language → catalog language.
// Keys are lowercase customer phrases, values are tokens we'll AND-search in catalog names.
const TERM_SYNONYMS: Record<string, string[]> = {
  "couch": ["sofa"],
  "settee": ["sofa"],
  "loveseat": ["sofa"],
  "tv stand": ["tv"],
  "tv console": ["tv"],
  "tv unit": ["tv"],
  "television": ["television"],
  "tv set": ["television"],
  "flat screen": ["television"],
  "smart tv": ["television"],
  "led tv": ["television"],
  "lcd tv": ["television"],
  "oled tv": ["television"],
  "study desk": ["desk"],
  "office chair": ["office", "chair"],
  "gaming chair": ["gaming", "chair"],
  "dressing table": ["dressing"],
  "vanity": ["dressing"],
  "wardrobe cupboard": ["wardrobe"],
  "almirah": ["wardrobe"],
  "shoe rack": ["shoe"],
  "shoe cabinet": ["shoe"],
  "tv mount": ["tv", "mount"],
  "fridge": ["refrigerator"],
  // Wall-hung walk-in wardrobe / modular shelving — priced per hole. Map all
  // the common customer phrasings (Elfa, Pax, walk-in, open wardrobe, etc.)
  // onto the catalog name "Wall-Hung Shelving System (per hole)".
  "wall hung": ["wall-hung"],
  "wall-hung": ["wall-hung"],
  "wall hung shelf": ["wall-hung"],
  "wall hung shelving": ["wall-hung"],
  "wall hung system": ["wall-hung"],
  "wall mounted shelf": ["wall-hung"],
  "wall mounted shelving": ["wall-hung"],
  "wall mounted wardrobe": ["wall-hung"],
  "walk in wardrobe": ["wall-hung"],
  "walk-in wardrobe": ["wall-hung"],
  "open wardrobe": ["wall-hung"],
  "modular wardrobe": ["wall-hung"],
  "modular shelving": ["wall-hung"],
  "elfa": ["wall-hung"],
  "elfa system": ["wall-hung"],
  "pax wardrobe": ["wall-hung"],
  "pax system": ["wall-hung"],
};

// Common compound nouns customers write as one word that the catalog stores as two.
// "bedframe" → ["bed", "frame"], "bookshelf" → ["book", "shelf"], etc.
const COMPOUND_SPLITS: Record<string, string[]> = {
  bedframe:    ["bed", "frame"],
  sofabed:     ["sofa", "bed"],
  bookshelf:   ["bookshelf"], // catalog has "Bookshelf" as one word — keep
  bookcase:    ["bookcase"],
  nightstand:  ["bedside"],   // catalog uses "Bedside Table"
  headboard:   ["headboard"],
  workdesk:    ["desk"],
  studydesk:   ["desk"],
  officedesk:  ["office", "desk"],
  diningtable: ["dining", "table"],
  coffeetable: ["coffee", "table"],
  sidetable:   ["side", "table"],
  tvconsole:   ["tv"],
  tvstand:     ["tv"],
  shoerack:    ["shoe"],
};

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "and", "or", "with", "to", "my", "our", "your",
  // Brand / generic qualifier words customers add that are NOT item types.
  // Leaving them in pollutes the OR-match (e.g. "ikea blinds" would also match
  // every IKEA-named install item and skew the median price). Strip them so
  // only the real item noun ("blind") drives the catalog match.
  "ikea", "hipvan", "castlery", "courts", "taobao",
]);

function normaliseToken(t: string): string {
  return t
    .replace(/\(.*?\)/g, "")           // strip parentheticals
    .replace(/[^\p{L}\p{N}\s-]/gu, "") // strip punctuation
    .trim()
    .toLowerCase();
}

/** Turn a customer term into the AND-tokens we'll search catalog names with. */
function expandTerm(rawTerm: string): string[] {
  const norm = normaliseToken(rawTerm);
  if (!norm) return [];

  // 1) direct synonym phrase
  if (TERM_SYNONYMS[norm]) return TERM_SYNONYMS[norm];

  // 2) split into tokens, drop stopwords + plural-s
  const tokens = norm.split(/[\s-]+/).filter(Boolean)
    .filter(t => !STOPWORDS.has(t))
    .map(t => t.replace(/s$/i, "")); // crude singularise

  // 3) compound-word splits for any token (e.g. "bedframe" → ["bed","frame"])
  const expanded: string[] = [];
  for (const t of tokens) {
    if (COMPOUND_SPLITS[t]) expanded.push(...COMPOUND_SPLITS[t]);
    else expanded.push(t);
  }
  return Array.from(new Set(expanded)).filter(t => t.length >= 2);
}

/**
 * Find the best catalog match for a customer term. Returns the median-priced
 * match (so a customer saying "wardrobe" gets a typical wardrobe price, not
 * the cheapest or most expensive). Returns null if nothing matches.
 *
 * Strategy: AND-match every expanded token against the catalog name; if that
 * returns nothing, fall back to OR-matching on the same tokens.
 */
async function findCatalogMatch(
  rawTerm: string,
  catalogService: "install" | "dismantle" | "relocate" | "dispose" | "dismantle_dispose",
): Promise<{ name: string; basePrice: number } | null> {
  const tokens = expandTerm(rawTerm);
  if (tokens.length === 0) return null;

  const baseWhere = eq(catalogItems.serviceType, catalogService);

  // Pass 1: STRICT — name must contain all tokens (best precision)
  let rows: Array<{ name: string; basePrice: string }> = [];
  try {
    rows = await db
      .select({ name: catalogItems.name, basePrice: catalogItems.basePrice })
      .from(catalogItems)
      .where(and(baseWhere, ...tokens.map(t => ilike(catalogItems.name, `%${t}%`))))
      .limit(40);
  } catch (e: any) {
    console.warn("[indicative-range] strict match failed:", e?.message);
  }

  // Pass 2: LOOSE — any token (only if strict found nothing AND we have multiple tokens)
  if (rows.length === 0 && tokens.length > 1) {
    try {
      rows = await db
        .select({ name: catalogItems.name, basePrice: catalogItems.basePrice })
        .from(catalogItems)
        .where(and(baseWhere, drizzleOr(...tokens.map(t => ilike(catalogItems.name, `%${t}%`))) as any))
        .limit(40);
    } catch (e: any) {
      console.warn("[indicative-range] loose match failed:", e?.message);
    }
  }

  if (rows.length === 0) return null;

  // Use the median of matched prices — robust to outliers (custom $450
  // walk-in wardrobe shouldn't drag a typical "wardrobe" estimate up).
  const sorted = rows
    .map(r => ({ name: r.name, price: parseFloat(r.basePrice) }))
    .filter(r => r.price > 0)
    .sort((a, b) => a.price - b.price);
  if (sorted.length === 0) return null;
  const mid = sorted[Math.floor(sorted.length / 2)];
  return { name: mid.name, basePrice: mid.price };
}

/**
 * Build an indicative SGD price range using the SAME pricing engine
 * (`computePricing` from shared/pricing.ts) the web booking flow uses.
 * We run it twice — best access (ground + lift, easy) and worst access
 * (4-floor walkup no lift, moderate) — and return both grand totals as
 * the low/high bounds. This guarantees the ballpark is consistent with
 * what the customer would see if they completed the full booking flow.
 */
export async function buildIndicativeRange(
  itemTypes: string[] | undefined,
  serviceType: CaseFacts["serviceType"],
  totalQuantityHint?: number,
): Promise<IndicativeRange | null> {
  if (!itemTypes || itemTypes.length === 0) return null;
  const catalogService = mapAgentServiceToCatalog(serviceType);

  // Step 1: resolve each customer term into a PricingItem (matched or fallback).
  const items: PricingItem[] = [];
  const matchedItems: IndicativeRange["matchedItems"] = [];
  const unmatchedTerms: string[] = [];

  for (const rawTerm of itemTypes) {
    const match = await findCatalogMatch(rawTerm, catalogService);
    if (match) {
      items.push({
        name: match.name,
        serviceType: catalogService,
        quantity: 1,
        unitPrice: match.basePrice,
      });
      matchedItems.push({ term: rawTerm, matchedAs: match.name, unitPrice: match.basePrice, qty: 1 });
    } else {
      // unitPrice=0 tells computePricing to use catalog/multiplier fallback
      items.push({ name: rawTerm, serviceType: catalogService, quantity: 1, unitPrice: 0 });
      unmatchedTerms.push(rawTerm);
      matchedItems.push({ term: rawTerm, matchedAs: `(no catalog match — pricing engine fallback)`, unitPrice: 0, qty: 1 });
    }
  }

  if (items.length === 0) return null;

  // Apply customer-stated total quantity by scaling the FIRST item up.
  if (totalQuantityHint && totalQuantityHint > items.length) {
    items[0].quantity = totalQuantityHint - items.length + 1;
    matchedItems[0].qty = items[0].quantity;
  }

  // Step 2: load the full catalog once for fallback-multiplier lookups in computePricing.
  let catalogEntries: PricingCatalogEntry[] = [];
  try {
    const rows = await db.select({
      name: catalogItems.name,
      serviceType: catalogItems.serviceType,
      basePrice: catalogItems.basePrice,
    }).from(catalogItems);
    catalogEntries = rows.map(r => ({
      name: r.name,
      serviceType: r.serviceType as PricingCatalogEntry["serviceType"],
      basePrice: parseFloat(r.basePrice),
    })).filter(e => isFinite(e.basePrice) && e.basePrice > 0);
  } catch (e: any) {
    console.warn("[indicative-range] catalog load failed:", e?.message);
  }

  const needsRelocation = catalogService === "relocate";

  // Step 3: run the SAME engine the web booking uses, twice.
  // For relocation we use a typical SG urban distance (8 km — close to median);
  // the helper minimum fee dominates short trips anyway.
  const baseInput = {
    items,
    needsRelocation,
    catalogEntries,
    distanceKm: needsRelocation ? 8 : 0,
  };

  const lowResult = computePricing({
    ...baseInput,
    floors: [{ level: 0, hasLift: true }],   // ground floor with lift
    accessDifficulty: "easy",
  });
  const highResult = computePricing({
    ...baseInput,
    floors: [{ level: 4, hasLift: false }],  // 4-floor walkup
    accessDifficulty: "medium",
  });

  return {
    low: Math.round(lowResult.grandTotal),
    high: Math.round(highResult.grandTotal),
    matchedItems,
    unmatchedTerms,
    serviceType: catalogService,
  };
}

// Detect when the customer is asking about price/cost up front so we can
// surface an indicative range BEFORE drilling into floor/lift/date details.
const PRICE_INTENT_REGEX =
  /\b(how\s*much|price|prices|pricing|cost|costs|charges?|rate|rates|quote|quotation|estimate|ballpark|range|expensive|affordable|cheaper|budget|fee|fees|\$|sgd|s\$)\b/i;
export function isPriceIntent(text: string): boolean {
  return PRICE_INTENT_REGEX.test(text || "");
}

// ── Sales Reply Generation ────────────────────────────────────────────────────
async function generateSalesReply(params: {
  from: string;
  text: string;
  facts: CaseFacts;
  missingFacts: string[];
  aiState: AiConvState;
  history: Array<{ role: string; content: string }>;
  windowOpen: boolean;
  /** Optional ballpark price range to mention BEFORE asking the next qualifier. */
  priceRange?: IndicativeRange | null;
}): Promise<string> {
  const { text, facts, missingFacts, aiState, history, windowOpen, priceRange } = params;

  if (!windowOpen) {
    return "Hi! Thanks for reaching out. Our team will get back to you shortly. For urgent matters, please call us directly.";
  }

  const nextMissing = missingFacts[0];
  const historyContext = history.slice(-6).map(h => `${h.role}: ${h.content}`).join("\n");

  const questionMap: Record<string, string> = {
    serviceType: "Could you let me know what service you need? (e.g. installation, dismantling, relocation, repair, or disposal)",
    jobAddress: "What's the full job address? Please include block/house number, street, unit and postal code (e.g. Blk 123 Tampines St 11 #08-456 S521123).",
    homeOrOffice: "Is this for a home or an office / commercial space?",
    itemTypes: "What furniture or items need to be handled? (e.g. wardrobe, bed frame, office desks)",
    floorLevel: "Which floor is the property on?",
    hasLift: "Is there a lift available at the property?",
    preferredDate: "Do you have a preferred date, or are you flexible on timing?",
    toAddress: "What's the destination address? (for the relocation drop-off)",
  };

  // Bundle upsell context — only show if install-only and not a relocation
  const isInstallOnly = facts.serviceType === "installation" && !facts.itemTypes?.some(i =>
    /dismantle|dismantling|relocat/i.test(i)
  );
  const bundleUpsellHint = isInstallOnly
    ? `\nBUNDLE OPPORTUNITY: Customer has selected installation only. If it comes up naturally and hasn't been mentioned yet, you may mention: "By the way, if you need to clear old furniture too, our Install + Dismantle bundle saves you 40% on dismantling — a great deal for IKEA moves or room upgrades." Say this ONCE, naturally, only if relevant.`
    : "";

  // Indicative price range — when the customer has asked about cost and we
  // have enough item info, lead with a ballpark range so we don't stonewall
  // them with another qualifier question. The exact quote is still confirmed
  // later by our pricing engine using floor/lift/access details.
  const priceHint = priceRange
    ? `\nPRICE RANGE TO QUOTE FIRST (the customer asked for a price upfront):
- Indicative range based on items shown: SGD ${priceRange.low} – SGD ${priceRange.high}
- This is a BALLPARK only. Phrase it naturally, e.g. "Based on what I can see, you're looking at roughly SGD ${priceRange.low}–${priceRange.high} for the ${priceRange.serviceType}."
- Then immediately note: "The exact quote depends on floor level, lift access, and the date — could you share <next missing fact>?"
- Do NOT just ask the question without giving the range first. The customer wants a number before sharing more details.${priceRange.unmatchedTerms.length ? `\n- Note: some items used a generic estimate (${priceRange.unmatchedTerms.join(", ")}) so the exact quote may differ once our team reviews the photo.` : ""}`
    : "";

  try {
    const { value: replyText } = await callLLM<string>({
      agent: "whatsapp_sales_reply",
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `You are the AI sales assistant for TMG Install, a professional furniture installation company in Singapore.
Your job is to qualify leads and help push them toward a quote and booking — but ACCURACY beats speed. Wrong information costs us trust.

TRUST SIGNALS (mention naturally where relevant):
- 4.9★ rated on Google · 127+ reviews
- Fully insured · Island-wide coverage · Same-day available

ACCURACY RULES (most important — read carefully):
- BEFORE quoting any price or confirming a booking, briefly echo back what you understood and ask the customer to confirm. Example: "Just to confirm — you need IKEA PAX wardrobe installation at Tampines, two units, is that right?"
- If the customer's message is ambiguous (could mean install vs dismantle vs relocate, could be one item or many, item type unclear), DO NOT GUESS — ask one clarifying question first.
- Never invent pricing. Use ONLY the indicative range below if one is provided. If no range is provided, say "let me have our team confirm the exact price" — never make up a number, never round, never quote per-hour rates.
- If items in the customer message could not be matched to our catalog (you'll see them listed under unmatched terms), explicitly say "some of those items will need our team to confirm pricing" instead of pretending the range covers them.
- Never promise specific slots, exact arrival times, or discounts that aren't already approved.
- If you are not >80% sure of what the customer wants, prefer to ask a clarifying question OR say our team will follow up — do not make claims you can't back up.

STYLE RULES:
- Be concise, warm, and sales-oriented
- Ask ONLY the single most important missing piece of information per turn
- NEVER re-ask for anything already present in KNOWN FACTS — if a fact is filled in, treat it as settled and move on to the NEXT MISSING FACT
- If the customer just shared a specific detail (e.g. "each blind needs 4 holes", a floor number, a date), briefly acknowledge it in your reply before asking the next question — don't ignore it or repeat your previous message
- Never ask multiple questions at once
- Keep under 90 words
- Use plain conversational language, no markdown
- End with a clear single question

KNOWN FACTS: ${JSON.stringify(facts)}
CURRENT STATE: ${aiState}
NEXT MISSING FACT: ${nextMissing || "none — all facts collected"}
SUGGESTED QUESTION: ${nextMissing ? questionMap[nextMissing] || `What is your ${nextMissing}?` : "Push toward quote/booking"}
${priceHint}${bundleUpsellHint}

CONVERSATION HISTORY:
${historyContext}`,
        },
        { role: "user", content: text },
      ],
    });

    return replyText.trim() ||
      (nextMissing ? questionMap[nextMissing] : "Thanks! Our team will prepare your quote and be in touch shortly.");
  } catch (err: any) {
    if (!(err instanceof KillSwitchError) && !(err instanceof CircuitOpenError)) {
      console.warn("[whatsapp-agent] generateSalesReply failed:", err?.name, err?.message);
    }
    return nextMissing
      ? questionMap[nextMissing] || "Could you share a bit more about what you need?"
      : "Thanks for the details! Our team will review and be in touch with your quote shortly.";
  }
}

// ── Quote Ready Message ───────────────────────────────────────────────────────
function buildQuoteReadyMessage(facts: CaseFacts): string {
  const name = facts.customerName ? `Hi *${facts.customerName}*!` : "Hi!";
  const items = facts.itemTypes?.join(", ") || "your items";
  const addr = facts.jobAddress || "your address";
  const date = facts.preferredDate || "a date that suits you";

  return (
    `${name} Great news — we have everything we need to prepare your quote! 🎉\n\n` +
    `Here's what we've noted:\n` +
    `• Service: ${facts.serviceType || "installation"}\n` +
    `• Items: ${items}\n` +
    `• Address: ${addr}\n` +
    `• Date: ${date}\n\n` +
    `Our team will review and send your itemised quote shortly.\n\n` +
    `📋 *What happens next:*\n` +
    `1️⃣ We review your details & price each item (< 4 hrs)\n` +
    `2️⃣ You receive a fixed-price quote with a secure payment link\n` +
    `3️⃣ Pay to lock in your slot ✅ (smaller jobs are paid in full; larger jobs need a 50% deposit)\n` +
    `4️⃣ Our team arrives on the day — job done! 🚀\n\n` +
    `Is there anything else you'd like us to know?`
  );
}

// ── Handoff Message ───────────────────────────────────────────────────────────
function buildHandoffMessage(reason: string): string {
  const msgs: Record<string, string> = {
    frustrated: "I'm sorry for any inconvenience. Let me connect you with our team directly — someone will be with you shortly.",
    custom_pricing: "For special pricing requests, our team can discuss that with you directly. We'll be in touch shortly.",
    unsupported_service: "That sounds like something our specialist team should handle. Let me pass this on — someone will be in touch shortly.",
    low_confidence: "Thanks for the details! This sounds like a job our team should review directly. We'll be in touch shortly.",
    unknown: "Our team will take over from here and be in touch shortly.",
  };
  return msgs[reason] || msgs.unknown;
}

// ── Schedule Follow-up ────────────────────────────────────────────────────────
export async function scheduleFollowUp(
  phone: string,
  followupType: string,
  delayMs: number,
  messagePreview?: string,
): Promise<void> {
  try {
    const scheduledAt = new Date(Date.now() + delayMs);
    await db.insert(aiWhatsappFollowups).values({
      phone,
      followupType,
      scheduledAt,
      status: "pending",
      messagePreview: messagePreview?.slice(0, 200),
    });
    await storage.upsertWhatsAppSession(phone, { followupScheduled: true } as any);
  } catch (err) {
    console.error("[WhatsApp Agent] Failed to schedule follow-up:", err);
  }
}

// ── Run Follow-up Scheduler ───────────────────────────────────────────────────
// Called periodically (every 5 min) from a scheduler. Sends due follow-ups.
export async function runFollowUpScheduler(): Promise<void> {
  const kill = await getFlag("ai_master_kill_switch");
  const enabled = await getFlag("ai_whatsapp_followups_enabled");
  if (kill || !enabled) return;

  try {
    const due = await db
      .select()
      .from(aiWhatsappFollowups)
      .where(and(
        eq(aiWhatsappFollowups.status, "pending"),
        lte(aiWhatsappFollowups.scheduledAt, new Date()),
      ))
      .limit(20);

    for (const followup of due) {
      try {
        const session = await storage.getWhatsAppSession(followup.phone);
        if (!session) {
          await db.update(aiWhatsappFollowups)
            .set({ status: "skipped", skipReason: "no_session" })
            .where(eq(aiWhatsappFollowups.id, followup.id));
          continue;
        }

        // Check window
        const windowOpen = check24hrWindow(session.lastInboundAt);

        // Skip if bot is paused (human is handling)
        if (session.botPaused || session.aiOwnership === "human") {
          await db.update(aiWhatsappFollowups)
            .set({ status: "skipped", skipReason: "human_ownership" })
            .where(eq(aiWhatsappFollowups.id, followup.id));
          continue;
        }

        // Skip if the customer has replied SINCE this follow-up was queued.
        // A "missing_info"/"quote_reminder" nudge is only meant for a customer
        // who went quiet. If they kept chatting (lastInboundAt is newer than
        // when we scheduled this), the live turn handler already responded with
        // the right next step — firing the canned nudge now would repeat
        // ourselves and look robotic. Cancel it instead.
        const followupCreatedAt = followup.createdAt ? new Date(followup.createdAt) : null;
        const lastInbound = session.lastInboundAt ? new Date(session.lastInboundAt) : null;
        if (followupCreatedAt && lastInbound && lastInbound > followupCreatedAt) {
          await db.update(aiWhatsappFollowups)
            .set({ status: "cancelled", skipReason: "customer_active" })
            .where(eq(aiWhatsappFollowups.id, followup.id));
          continue;
        }

        // Outside window — only template-mode allowed
        const templateMode = await getFlag("ai_whatsapp_template_mode_enabled");
        if (!windowOpen && !templateMode) {
          console.log(`[WA-Agent] [scheduler] 24hr window blocked — skipping follow-up for ${maskPhone(followup.phone)} (type=${followup.followupType})`);
          await db.update(aiWhatsappFollowups)
            .set({ status: "skipped", skipReason: "outside_window_template_disabled" })
            .where(eq(aiWhatsappFollowups.id, followup.id));
          await logAudit("ai_window_blocked", "ai_scheduler", `24hr window blocked: follow-up skipped for ${maskPhone(followup.phone)}`, {
            phone: maskPhone(followup.phone), followupType: followup.followupType,
          });
          continue;
        }

        const messages: Record<string, string> = {
          missing_info: "Hi! Just following up — we still need a few details to prepare your quote. What furniture items need to be installed, and what's your preferred date? We're 4.9★ rated and fully insured, ready to help! 😊",
          quote_reminder: "Hi! Just checking in on your TMG Install quote 👋\n\nYour itemised quote is ready — did you get a chance to review it? Happy to answer any questions or adjust anything before you decide.\n\nReply *yes* to proceed or let me know if you need changes! 😊",
          deposit_reminder: "Hi! Friendly reminder from TMG Install 🔔\n\nYour slot is still on hold, but we can only hold it a little longer. Please complete your payment to confirm your booking.\n\n📋 *Next step:* Reply here and we'll resend your payment link right away!\n\nLet us know if you need any help — we're here!",
          booking_reminder: "Hi! We're all set to confirm your TMG Install booking 🎉\n\nJust let us know if everything looks good and our team will send a final confirmation with your crew details.\n\nAny questions? Just reply here!",
          stale_reactivation: "Hi! We noticed we haven't heard from you in a while 👋\n\nIf you're still looking for furniture installation or dismantling in Singapore, we'd love to help — we're 4.9★ rated, fully insured, and available island-wide.\n\nJust reply here to get a free quote in 60 seconds! 😊",
        };

        const msg = followup.messagePreview || messages[followup.followupType] || messages.missing_info;
        await sendBotMessage(followup.phone, msg);

        await db.update(aiWhatsappFollowups)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(aiWhatsappFollowups.id, followup.id));

        await logAudit("followup_sent", "ai_scheduler", `Follow-up sent: ${followup.followupType} to +${followup.phone}`);
      } catch (err) {
        console.error(`[WhatsApp Agent] Follow-up send failed for ${followup.phone}:`, err);
        await db.update(aiWhatsappFollowups)
          .set({ status: "skipped", skipReason: "send_error" })
          .where(eq(aiWhatsappFollowups.id, followup.id))
          .catch(() => {});
      }
    }
  } catch (err) {
    console.error("[WhatsApp Agent] Scheduler error:", err);
  }
}

// ── Main Entry Point ──────────────────────────────────────────────────────────
// Called from the webhook handler in routes.ts after dedup + logging.
// Returns true if message was handled by the AI agent (skip legacy bot).
// Returns false if the AI agent is disabled or cannot handle (fall through).
export async function processWithAIAgent(params: {
  from: string;
  text: string;
  msgType: string;
  msg: any;
  session: any;
  correlationId?: string; // wamid from webhook — used for idempotency + structured logs
}): Promise<boolean> {
  const { from, text, session, correlationId = "" } = params;
  const corrTag = correlationId ? `[corr:${correlationId.slice(0, 12)}]` : "[corr:none]";
  const masked = maskPhone(from);

  try {
    // ── 0. Customer rating capture (runs BEFORE all gates) ───────────────────
    // The post-job 1–5 rating reply must be ingested even when the AI agent
    // is disabled or the conversation is human-owned — otherwise closeCase
    // sends a prompt the customer answers and we silently drop it
    // (architect feedback). Returning true short-circuits the rest of the
    // pipeline AND tells the legacy bot we already handled this turn.
    try {
      const trimmedEarly = (text ?? "").trim();
      if (/^[1-5]$/.test(trimmedEarly)) {
        const sinceR = new Date(Date.now() - 24 * 3600_000);
        const [pendingR] = await db.select().from(customerRatings)
          .where(and(
            eq(customerRatings.phone, from),
            eq(customerRatings.status, "pending"),
            gte(customerRatings.promptedAt, sinceR),
          ))
          .orderBy(desc(customerRatings.promptedAt))
          .limit(1);
        if (pendingR) {
          const ratingVal = parseInt(trimmedEarly, 10);
          await db.update(customerRatings)
            .set({ rating: ratingVal, status: "answered", answeredAt: new Date() } as any)
            .where(eq(customerRatings.id, pendingR.id));
          await sendBotMessage(from, ratingVal >= 4
            ? `Thank you for the ${ratingVal}-star rating! 🙏 Means a lot to the team.`
            : `Thanks for the honest ${ratingVal}-star feedback. We'll look at how to do better next time. A team member may follow up.`);
          await logAudit("customer_rating_captured", "ai_feedback_loop",
            `Rating ${ratingVal}/5 from ${masked} (quote ${pendingR.quoteId ?? "?"})`,
            { phone: masked, rating: ratingVal, quoteId: pendingR.quoteId, capturedAt: "pre_gate" });
          console.log(`[WA-Agent] ${corrTag} rating ${ratingVal}/5 captured (phone=${masked})`);

          // ── Auto Google review request (rating-gated) ──────────────────────
          // Only ask happy customers (rating >= threshold) for a Google review.
          // This is the cheapest, highest-ROI growth lever for local services:
          // every Google review compounds local-SEO ranking forever. Idempotent
          // via a `review_requested` job_update entry so retries don't double-send.
          try {
            const minRow = await db.select().from(appSettings)
              .where(eq(appSettings.key, "auto_google_review_min_rating")).limit(1);
            const minRating = parseInt((minRow[0] as any)?.value ?? "4", 10) || 4;
            if (ratingVal >= minRating && pendingR.quoteId) {
              const urlRow = await db.select().from(appSettings)
                .where(eq(appSettings.key, "google_review_url")).limit(1);
              const reviewUrl = (urlRow[0] as any)?.value;
              if (reviewUrl && /^https?:\/\//i.test(reviewUrl)) {
                // Idempotency: did we already log a review_requested for this quote?
                const existingUpdates = await db.select({ statusChange: jobUpdates.statusChange })
                  .from(jobUpdates)
                  .where(eq(jobUpdates.quoteId, pendingR.quoteId));
                const alreadyAsked = existingUpdates.some(
                  (u) => u.statusChange === "review_requested",
                );
                if (!alreadyAsked) {
                  // CLAIM-THEN-SEND: write the marker SYNCHRONOUSLY before
                  // the setTimeout fires so any concurrent rating-capture
                  // path (e.g. webhook retry) sees it and skips. Trade-off:
                  // if WhatsApp send later fails, we'll have logged "asked"
                  // but the customer didn't get the prompt — acceptable
                  // versus the alternative of double-asking.
                  await storage.addJobUpdate({
                    quoteId: pendingR.quoteId!,
                    statusChange: "review_requested",
                    actorType: "system",
                    note: `Google review request after ${ratingVal}★ rating`,
                  } as any);
                  await logAudit("review_request_sent", "ai_feedback_loop",
                    `Review request → ${masked} (quote ${pendingR.quoteId}, rating ${ratingVal})`,
                    { phone: masked, quoteId: pendingR.quoteId, rating: ratingVal });
                  setTimeout(async () => {
                    try {
                      await sendBotMessage(from,
                        `Since you rated us ${ratingVal}★ — would you mind dropping a quick Google review? It seriously helps a small local business like ours: \n\n${reviewUrl}\n\n_Takes 30 seconds. Thank you so much! 🙏_`,
                      );
                    } catch (rsErr: any) {
                      console.warn("[feedback-loop] review request send failed:", rsErr?.message);
                    }
                  }, 2500);
                }
              }
            }
          } catch (revErr: any) {
            console.warn("[feedback-loop] review-request gating failed:", revErr?.message);
          }

          return true;
        }
      }
    } catch (rEarlyErr: any) {
      console.warn("[feedback-loop] early rating capture failed:", rEarlyErr?.message);
      // Fall through — don't break inbound handling on this path.
    }

    // ── 1. Feature flag checks ───────────────────────────────────────────────
    const kill = await getFlag("ai_master_kill_switch");
    const agentEnabled = await getFlag("ai_whatsapp_agent_enabled");
    if (kill || !agentEnabled) {
      console.log(`[WA-Agent] ${corrTag} agent disabled — falling through to legacy bot (phone=${masked})`);
      return false;
    }

    // ── 1b. Persistent idempotency guard (survives restarts) ─────────────────
    // The in-memory wamid set in routes.ts handles same-process dedup.
    // This DB check catches cross-restart replays for the AI agent path.
    if (correlationId) {
      const isDuplicate = await checkDuplicateByCorrelationId(correlationId);
      if (isDuplicate) {
        console.log(`[WA-Agent] ${corrTag} DUPLICATE — already processed, skipping (phone=${masked})`);
        await logAudit("ai_duplicate_skipped", "ai_agent", `Duplicate inbound skipped: ${masked}`, {
          correlationId, phone: masked,
        });
        return true; // Return true so legacy bot also skips this duplicate
      }
    }

    console.log(`[WA-Agent] ${corrTag} intercept start (phone=${masked}, type=${params.msgType})`);

    // ── 2. Respect existing admin takeover (botPaused) ──────────────────────
    if (session?.botPaused) {
      console.log(`[WA-Agent] ${corrTag} bot paused — human handling (phone=${masked})`);
      return false;
    }

    // ── 3. If AI ownership is 'human', skip ─────────────────────────────────
    if (session?.aiOwnership === "human") {
      console.log(`[WA-Agent] ${corrTag} human ownership — skipping AI (phone=${masked})`);
      return false;
    }

    // ── 4. Update last inbound + window status ───────────────────────────────
    const now = new Date();
    const windowOpen = true; // Just received a message — window is open
    await storage.upsertWhatsAppSession(from, {
      lastInboundAt: now,
      windowOpen: true,
      templateModeOnly: false,
      followupScheduled: false,
    } as any);

    // ── 5. Load current facts + state ────────────────────────────────────────
    const currentFacts = parseFacts(session?.caseFacts);
    const currentMissing = parseMissing(session?.missingFacts);
    const currentAiState: AiConvState = (session?.aiState as AiConvState) || "new_lead";

    // ── 6. Load conversation history ─────────────────────────────────────────
    let history: Array<{ role: string; content: string }> = [];
    try {
      history = session?.conversationHistory ? JSON.parse(session.conversationHistory) : [];
    } catch { history = []; }

    // ── 7. Skip if message is empty / non-text (reactions handled by legacy bot) ─
    if (!text && params.msgType !== "image") return false;

    // ── 7a. Vision: if customer sent a photo, identify the furniture in it ──
    // Without this, the agent only sees the literal string "[Photo]" and ends
    // up asking "what type of furniture is that?" — which feels broken to the
    // customer (the screenshot bug). gpt-4o vision reads the image once, the
    // findings get injected into the user-text fed to extractFacts so the
    // existing fact-extractor populates itemTypes/quantity automatically.
    let visionAnalyzedText = text;
    let visionResult: FurnitureVisionResult | null = null;
    if (params.msgType === "image" && params.msg?.image?.id) {
      try {
        const media = await downloadWhatsAppMedia(params.msg.image.id);
        if (media) {
          const caption = (params.msg.image.caption || "").trim();
          visionResult = await analyzeFurniturePhoto(media.base64, media.mimeType, caption);
          if (visionResult && visionResult.isFurniture) {
            const itemSummary = visionResult.items
              .map(i => `${i.qty && i.qty > 1 ? `${i.qty}× ` : ""}${i.type}${i.notes ? ` (${i.notes})` : ""}`)
              .join(", ") || "furniture";
            // Build a synthetic user message that the fact-extractor can mine.
            // We keep the original caption (if any) + describe the photo so
            // itemTypes/quantity get populated without re-prompting the user.
            visionAnalyzedText =
              (caption ? `${caption}\n` : "") +
              `[Customer photo analysed by vision — items visible: ${itemSummary}. ${visionResult.description}]`;
            console.log(`[WA-Agent] ${corrTag} vision identified: ${itemSummary} (phone=${masked})`);
            await logAudit("vision_analyzed", "ai_vision",
              `Photo analysed for ${masked}: ${itemSummary}`,
              { correlationId, phone: masked, items: visionResult.items, description: visionResult.description });
          } else if (visionResult && !visionResult.isFurniture) {
            // Non-furniture photo (selfie/screenshot/etc) — note it but don't pollute facts.
            visionAnalyzedText = (caption ? `${caption}\n` : "") + `[Customer sent a non-furniture photo: ${visionResult.description}]`;
            console.log(`[WA-Agent] ${corrTag} vision: non-furniture photo (phone=${masked})`);
          }
        } else {
          console.warn(`[WA-Agent] ${corrTag} vision: media download failed for ${masked}`);
        }
      } catch (visionErr: any) {
        console.warn(`[WA-Agent] ${corrTag} vision pipeline error:`, visionErr?.message);
      }
    }

    // (rating capture moved to step 0 — runs before all gates so closeCase
    // ratings are captured even when AI agent is disabled or human-owned)

    // ── 8. Extract facts from this message ───────────────────────────────────
    // For image messages, visionAnalyzedText carries the gpt-4o-vision items
    // summary so the fact-extractor can populate itemTypes without re-asking.
    const { facts: rawFacts, confidence } = await extractFacts(visionAnalyzedText, history, currentFacts);
    if (visionResult?.isFurniture) rawFacts.photosPresent = true;
    // Apply deterministic post-processing (e.g. ground floor → hasLift=true)
    // BEFORE we compute missing facts or generate the next reply. This is the
    // single funnel for "obvious" inferences that the LLM doesn't always make.
    const facts = normalizeFacts(rawFacts);
    const missingFacts = computeMissingFacts(facts);
    const quoteReady = isQuoteReady(facts);

    // ── 8b. Score the lead BEFORE handoff/auto-qualify checks ────────────────
    // We always want the score persisted so admins see analytics regardless
    // of which path the conversation takes. The hot-lead alert itself is
    // only sent on the AI-owned path (handoff means human already involved).
    let leadScoreResult: ReturnType<typeof scoreLead> | null = null;
    try {
      const [thrRow] = await db.select().from(appSettings).where(eq(appSettings.key, "ai_hot_lead_threshold")).limit(1);
      const hotThreshold = parseInt(thrRow?.value ?? "75", 10);
      leadScoreResult = scoreLead(facts, { hotThreshold });
    } catch (scoreErr: any) {
      console.warn("[lead-scoring] failed:", scoreErr?.message);
    }
    // Persist score immediately — survives every early-return branch below.
    if (leadScoreResult) {
      try {
        await db.update(whatsappSessions).set({
          leadScore: leadScoreResult.score,
          leadScoreReasons: JSON.stringify(leadScoreResult.reasons),
        }).where(eq(whatsappSessions.phone, from));
      } catch (persistErr: any) {
        console.warn("[lead-scoring] persist failed:", persistErr?.message);
      }
    }

    // ── 9. Check for handoff conditions ──────────────────────────────────────
    const handoffCheck = await shouldHandoff(text, facts, confidence);
    if (handoffCheck.required) {
      const handoffMsg = buildHandoffMessage(handoffCheck.reason);
      await sendBotMessage(from, handoffMsg);

      // Record handoff
      await db.insert(aiWhatsappHandoffs).values({
        phone: from,
        reason: handoffCheck.reason,
        handedBy: "ai",
        notes: `Confidence: ${confidence}, Message: ${text.slice(0, 200)}`,
      });

      // Update session to human ownership
      await storage.upsertWhatsAppSession(from, {
        aiState: "human_review_required",
        aiOwnership: "human",
        handoffReason: handoffCheck.reason,
        botPaused: true,
        botPausedAt: now,
        caseFacts: JSON.stringify(facts),
        missingFacts: JSON.stringify(missingFacts),
        confidenceScore: confidence.toString(),
      } as any);

      console.log(`[WA-Agent] ${corrTag} handoff triggered: reason=${handoffCheck.reason} (phone=${masked})`);
      await logAudit("handoff_triggered", "ai_agent", `Handoff to human: reason=${handoffCheck.reason}`, {
        correlationId, phone: masked, reason: handoffCheck.reason, confidence,
      });

      return true;
    }

    // ── 9b. Hot-lead alert — fire if score is hot, with ATOMIC 6h cooldown ──
    // The cooldown is enforced via a conditional UPDATE: we claim the
    // alert slot by setting hot_lead_alerted_at only if it's null or older
    // than 6h. Concurrent inbounds racing on the same phone will only see
    // one row "won" the claim, so only one alert fires.
    if (leadScoreResult && leadScoreResult.tier === "hot") {
      try {
        const hotAlertsOn = await getFlag("ai_hot_lead_alerts_enabled");
        if (hotAlertsOn) {
          const sixHoursAgo = new Date(Date.now() - 6 * 3600_000);
          const claim = await db.update(whatsappSessions)
            .set({ hotLeadAlertedAt: now })
            .where(and(
              eq(whatsappSessions.phone, from),
              drizzleSql`(${whatsappSessions.hotLeadAlertedAt} IS NULL OR ${whatsappSessions.hotLeadAlertedAt} < ${sixHoursAgo})`,
            ))
            .returning({ phone: whatsappSessions.phone });

          if (claim.length > 0) {
            const topReasons = leadScoreResult.reasons
              .sort((a, b) => b.points - a.points).slice(0, 3)
              .map(r => `• ${r.label} (+${r.points})`).join("\n");
            const customer = facts.customerName ?? "Unknown";
            const service = facts.serviceType ?? "service";
            // Address truncated heavily for both display and PII minimization;
            // full address available to admin in /admin/whatsapp.
            const addrSnip = (facts.jobAddress ?? "").slice(0, 30);

            await sendAiAlert({
              severity: "warn",
              channel: "approval",
              // Body intentionally omits raw phone (lands in audit log).
              // Admin clicks the URL to get full chat + actionable phone.
              title: `🔥 HOT LEAD (${leadScoreResult.score}/100): ${customer}`,
              body: `${service} · ${addrSnip}\nLead: ${masked}\n\nTop signals:\n${topReasons}\n\nOpen chat to call back within minutes.`,
              url: "/admin/whatsapp",
              // Dedupe key uses masked phone — full phone not persisted in audit.
              dedupeKey: `hot_lead|${masked}`,
            });

            await logAudit("hot_lead_alert", "ai_lead_scoring",
              `Hot lead alert (score=${leadScoreResult.score}) — ${masked}`,
              { phone: masked, score: leadScoreResult.score, reasons: leadScoreResult.reasons });
          }
        }
      } catch (alertErr: any) {
        console.warn("[lead-scoring] alert failed:", alertErr?.message);
      }
    }

    // ── 10. Determine new AI state ────────────────────────────────────────────
    let newAiState: AiConvState = currentAiState;
    if (currentAiState === "new_lead" || currentAiState === "waiting_for_customer") {
      newAiState = missingFacts.length > 0 ? "qualifying" : "quote_ready";
    } else if (currentAiState === "qualifying") {
      newAiState = quoteReady ? "quote_ready" : "qualifying";
    }

    // ── 11. Generate reply ────────────────────────────────────────────────────
    let reply: string;
    const autoQualify = await getFlag("ai_whatsapp_auto_qualify_enabled");

    if (!autoQualify) return false; // Fall through to legacy bot

    if (quoteReady && currentAiState !== "quote_ready") {
      reply = buildQuoteReadyMessage(facts);
      newAiState = "quote_ready";

      // ── 11a. Create a draft quote in the admin pipeline ─────────────────
      // This is the moment the bot has every fact it needs. We surface the
      // lead in the admin Dashboard "Action Required" panel by inserting a
      // quotes row with status="submitted" + requiresManualReview=true so
      // the admin can review, price, and send a final quote to the customer.
      // Failure here must NOT break the customer reply — the WhatsApp session
      // itself remains visible in /admin/ai/whatsapp as a fallback.
      try {
        // Race-safe dedupe via Postgres advisory lock keyed on the phone
        // number's hash. Two concurrent inbound handlers for the same lead
        // will serialize through this lock, so we'll only ever insert ONE
        // auto-quote per phone+window. The lock is auto-released at txn end.
        // Dedupe predicate is intentionally narrow: only suppresses when
        // there's already a pending-review WhatsApp draft (so a manual
        // admin-created quote on the same phone won't block a fresh lead).
        const phoneLockKey = parseInt(
          require("node:crypto").createHash("sha1").update(from).digest("hex").slice(0, 15),
          16
        );
        await db.transaction(async (tx) => {
          await tx.execute(drizzleSql`SELECT pg_advisory_xact_lock(${phoneLockKey})`);

          const existingQuote = await tx.select({ id: quotes.id, createdAt: quotes.createdAt })
            .from(quotes)
            .where(and(
              eq(quotes.customerWhatsappPhone, from),
              eq(quotes.sourceChannel, "whatsapp"),
              eq(quotes.requiresManualReview, true),
            ))
            .orderBy(desc(quotes.createdAt))
            .limit(1);
          const recentlyCreated = existingQuote[0]?.createdAt
            && (Date.now() - new Date(existingQuote[0].createdAt).getTime()) < 24 * 60 * 60 * 1000;

          if (recentlyCreated) {
            console.log(`[WA-Agent] ${corrTag} skip auto-quote — pending WhatsApp draft already exists for ${masked} (id=${existingQuote[0].id})`);
            return;
          }

          const { randomBytes } = await import("node:crypto");
          const refNo = `TMG-${randomBytes(4).toString("hex").toUpperCase()}`;

          // Map AI service type to the catalog/quote service_type vocabulary.
          const svcMap: Record<string, "install" | "dismantle" | "relocate"> = {
            installation:  "install",
            dismantling:   "dismantle",
            relocation:    "relocate",
            office_fitout: "install",
          };
          const itemSvc = svcMap[facts.serviceType ?? "installation"] ?? "install";

          // Pre-resolve each AI-extracted item against the catalog so the draft
          // quote lands with real prices (not $0). Use the SAME findCatalogMatch
          // helper buildIndicativeRange() uses, so the admin sees prices that
          // match the indicative range we already showed the customer.
          const qty = facts.quantity && facts.quantity > 0 ? facts.quantity : 1;
          const resolvedItems: Array<{ originalDescription: string; detectedName: string | null; serviceType: typeof itemSvc; quantity: number; unitPrice: string; subtotal: string }> = [];
          const unmatchedTerms: string[] = [];
          for (const term of (facts.itemTypes ?? [])) {
            const match = await findCatalogMatch(term, itemSvc);
            if (match) {
              const unit = match.basePrice;
              resolvedItems.push({
                originalDescription: term,
                detectedName:        match.name,
                serviceType:         itemSvc,
                quantity:            qty,
                unitPrice:           unit.toFixed(2),
                subtotal:            (unit * qty).toFixed(2),
              });
            } else {
              unmatchedTerms.push(term);
              resolvedItems.push({
                originalDescription: term,
                detectedName:        null,
                serviceType:         itemSvc,
                quantity:            qty,
                unitPrice:           "0",
                subtotal:            "0",
              });
            }
          }

          // Floors info mirrors the wizard's shape so the admin UI renders it.
          const floorsInfo: any[] = [];
          if (facts.floorLevel !== undefined) {
            floorsInfo.push({
              role:  facts.serviceType === "relocation" ? "pickup" : "service",
              floor: facts.floorLevel,
              hasLift: facts.hasLift ?? (facts.floorLevel === 1),
            });
          }

          // customers.email is NOT NULL — synthesize a deterministic placeholder
          // when the customer hasn't shared one yet. Admin can edit later.
          const safeEmail = session?.collectedEmail
            ?? `${from.replace(/[^0-9]/g, "")}@whatsapp.tmginstall.local`;

          const created = await storage.createQuote(
            {
              name:  session?.collectedName ?? "Customer",
              phone: from,
              email: safeEmail,
            } as any,
            {
              referenceNo:           refNo,
              serviceAddress:        facts.jobAddress ?? "(pending — collected via WhatsApp)",
              status:                "submitted",
              sourceChannel:         "whatsapp",
              customerWhatsappPhone: from,
              requiresManualReview:  true,
              aiConfidenceScore:     Math.round(confidence * 100),
              pickupAddress:         facts.serviceType === "relocation" ? facts.jobAddress : null,
              // Same-Property Move: collapse dropoff onto pickup so admin & invoice
              // don't show two addresses for a single-address job.
              dropoffAddress:        facts.serviceType === "relocation"
                                       ? (facts.samePropertyMove ? facts.jobAddress : facts.toAddress)
                                       : null,
              samePropertyMove:      facts.serviceType === "relocation" && facts.samePropertyMove === true,
              floorsInfo:            floorsInfo.length ? JSON.stringify(floorsInfo) : null,
              selectedServices:      JSON.stringify([itemSvc]),
              preferredDate:         facts.preferredDate ?? null,
              notes:                 `Auto-created from WhatsApp AI agent.\nMissing facts at creation: ${missingFacts.length === 0 ? "none" : missingFacts.join(", ")}.\nLead score: ${leadScoreResult?.score ?? "n/a"}.${unmatchedTerms.length > 0 ? `\nUnmatched items (review price): ${unmatchedTerms.join(", ")}.` : ""}`,
            } as any,
            resolvedItems as any
          );

          await logAudit("whatsapp_quote_drafted", "ai_quote_creation",
            `Auto-created quote ${refNo} from WhatsApp lead ${masked}`,
            { phone: masked, quoteId: created.id, refNo, items: facts.itemTypes ?? [], confidence });
          console.log(`[WA-Agent] ${corrTag} created draft quote ${refNo} (id=${created.id}) for ${masked}`);
        });
      } catch (qErr: any) {
        console.error(`[WA-Agent] ${corrTag} draft-quote creation failed:`, qErr?.message);
        await logAudit("whatsapp_quote_draft_failed", "ai_quote_creation",
          `Failed to auto-create quote for WhatsApp lead ${masked}: ${qErr?.message}`,
          { phone: masked, error: qErr?.message }).catch(() => {});
      }
    } else {
      // If the customer asked about price upfront and we know enough to
      // ballpark it, compute an indicative range so the reply leads with
      // a number instead of yet another qualifier question.
      let priceRange: IndicativeRange | null = null;
      try {
        const askedPrice = isPriceIntent(text) || isPriceIntent(visionAnalyzedText);
        if (askedPrice && facts.itemTypes && facts.itemTypes.length > 0) {
          priceRange = await buildIndicativeRange(facts.itemTypes, facts.serviceType, facts.quantity);
          if (priceRange) {
            console.log(`[WA-Agent] ${corrTag} indicative range SGD ${priceRange.low}-${priceRange.high} for ${facts.itemTypes.join(",")} (phone=${masked})`);
            await logAudit("indicative_price_quoted", "ai_pricing",
              `Ballpark SGD ${priceRange.low}-${priceRange.high} given to ${masked}`,
              { correlationId, phone: masked, low: priceRange.low, high: priceRange.high,
                items: priceRange.matchedItems, unmatched: priceRange.unmatchedTerms,
                serviceType: priceRange.serviceType });
          }
        }
      } catch (prErr: any) {
        console.warn(`[WA-Agent] ${corrTag} indicative-range error:`, prErr?.message);
      }

      reply = await generateSalesReply({
        from,
        text,
        facts,
        missingFacts,
        aiState: newAiState,
        history,
        windowOpen,
        priceRange,
      });
    }

    // ── 12. Send reply ────────────────────────────────────────────────────────
    await sendBotMessage(from, reply);

    // ── 13. Update history ────────────────────────────────────────────────────
    const updatedHistory = [
      ...history,
      { role: "user", content: text },
      { role: "assistant", content: reply },
    ].slice(-16);

    // ── 14. Persist updated session state ─────────────────────────────────────
    await storage.upsertWhatsAppSession(from, {
      aiState: newAiState,
      aiOwnership: "ai",
      caseFacts: JSON.stringify(facts),
      missingFacts: JSON.stringify(missingFacts),
      confidenceScore: confidence.toString(),
      conversationHistory: JSON.stringify(updatedHistory),
      // Note: leadScore/reasons/hotLeadAlertedAt are persisted earlier
      // (right after scoring + alert claim) so they survive every
      // early-return branch including the auto-qualify-disabled path.
      updatedAt: now,
    } as any);

    // ── 15. Schedule follow-up if qualifying and no followup yet ──────────────
    const followupsEnabled = await getFlag("ai_whatsapp_followups_enabled");
    if (followupsEnabled && !session?.followupScheduled && newAiState === "qualifying") {
      const delay30min = 30 * 60 * 1000;
      await scheduleFollowUp(from, "missing_info", delay30min, undefined);
    }
    if (followupsEnabled && !session?.followupScheduled && newAiState === "quote_ready") {
      const delay10min = 10 * 60 * 1000;
      await scheduleFollowUp(from, "quote_reminder", delay10min, undefined);
    }

    // ── 16. Audit log ─────────────────────────────────────────────────────────
    console.log(`[WA-Agent] ${corrTag} reply sent [state:${newAiState}, conf:${confidence.toFixed(2)}] (phone=${masked})`);
    await logAudit("ai_reply_sent", "ai_agent", `AI reply sent [state:${newAiState}]`, {
      correlationId,
      phone: masked,
      aiState: newAiState,
      missingFacts,
      confidence,
      replyPreview: reply.slice(0, 100),
    });

    return true;
  } catch (err) {
    console.error(`[WA-Agent] ${corrTag} unhandled error — falling through to legacy bot (phone=${masked}):`, err);
    return false; // Fall through to legacy bot on any error
  }
}

// ── Admin API helpers (called from routes) ────────────────────────────────────

export async function getAiConversations(limit = 50) {
  try {
    const rows = await db
      .select()
      .from(whatsappSessions)
      .orderBy(desc(whatsappSessions.updatedAt))
      .limit(limit);
    return rows;
  } catch { return []; }
}

export async function getAiConversationDetail(phone: string) {
  try {
    const [session] = await db
      .select()
      .from(whatsappSessions)
      .where(eq(whatsappSessions.phone, phone))
      .limit(1);

    const handoffs = await db
      .select()
      .from(aiWhatsappHandoffs)
      .where(eq(aiWhatsappHandoffs.phone, phone))
      .orderBy(desc(aiWhatsappHandoffs.handedAt))
      .limit(10);

    const followups = await db
      .select()
      .from(aiWhatsappFollowups)
      .where(eq(aiWhatsappFollowups.phone, phone))
      .orderBy(desc(aiWhatsappFollowups.createdAt))
      .limit(10);

    return { session, handoffs, followups };
  } catch { return null; }
}

export async function handoffToHuman(phone: string, reason: string, actor: string): Promise<void> {
  const now = new Date();
  await db.insert(aiWhatsappHandoffs).values({
    phone,
    reason,
    handedBy: actor,
    notes: "Manual handoff by admin",
  });
  await storage.upsertWhatsAppSession(phone, {
    aiOwnership: "human",
    aiState: "human_review_required",
    handoffReason: reason,
    botPaused: true,
    botPausedAt: now,
  } as any);
  await logAudit("manual_handoff", actor, `Manual handoff to human for +${phone}`, { phone, reason });
}

export async function resumeAiOwnership(phone: string, actor: string): Promise<void> {
  const now = new Date();
  await db
    .update(aiWhatsappHandoffs)
    .set({ resumedAt: now, resumedBy: actor })
    .where(and(eq(aiWhatsappHandoffs.phone, phone)));

  await storage.upsertWhatsAppSession(phone, {
    aiOwnership: "ai",
    aiState: "qualifying",
    handoffReason: null,
    botPaused: false,
  } as any);
  await logAudit("ai_resumed", actor, `AI ownership resumed for +${phone}`, { phone });
}
