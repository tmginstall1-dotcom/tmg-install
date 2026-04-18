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
} from "@shared/schema";
import { PricingConfig } from "@shared/pricing";
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
  serviceType: z.enum(["installation", "dismantling", "relocation", "office_fitout", "unknown"]).optional(),
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
  serviceType?: "installation" | "dismantling" | "relocation" | "office_fitout" | "unknown";
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

SERVICES: installation, dismantling, relocation, office_fitout
CURRENT KNOWN FACTS: ${JSON.stringify(currentFacts)}
${earlierBlock}CONVERSATION HISTORY (recent):
${historyText}

Return ONLY a JSON object with these optional fields:
{
  "serviceType": "installation"|"dismantling"|"relocation"|"office_fitout"|"unknown",
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

// ── Missing Facts Check ───────────────────────────────────────────────────────
function computeMissingFacts(facts: CaseFacts): string[] {
  const missing: string[] = [];
  if (!facts.serviceType || facts.serviceType === "unknown") missing.push("serviceType");
  if (!facts.jobAddress) missing.push("jobAddress");
  if (!facts.homeOrOffice || facts.homeOrOffice === "unknown") missing.push("homeOrOffice");
  if (!facts.itemTypes || facts.itemTypes.length === 0) missing.push("itemTypes");
  if (facts.floorLevel === undefined) missing.push("floorLevel");
  if (facts.hasLift === undefined) missing.push("hasLift");
  if (!facts.preferredDate) missing.push("preferredDate");
  if (facts.serviceType === "relocation" && !facts.toAddress) missing.push("toAddress");
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
//   installation → install
//   dismantling  → dismantle
//   relocation   → relocate
//   office_fitout → install (treated as install for ballpark)
function mapAgentServiceToCatalog(s: CaseFacts["serviceType"]): "install" | "dismantle" | "relocate" | "dispose" | "dismantle_dispose" {
  switch (s) {
    case "dismantling": return "dismantle";
    case "relocation":  return "relocate";
    case "office_fitout":
    case "installation":
    default: return "install";
  }
}

interface IndicativeRange {
  low: number;          // SGD lower bound (best access, ground floor + lift)
  high: number;         // SGD upper bound (typical higher floor, no lift)
  matchedItems: Array<{ term: string; matchedAs: string; unitPrice: number; qty: number }>;
  unmatchedTerms: string[]; // terms with no catalog match → fallback used
  serviceType: string;
}

export async function buildIndicativeRange(
  itemTypes: string[] | undefined,
  serviceType: CaseFacts["serviceType"],
  totalQuantityHint?: number,
): Promise<IndicativeRange | null> {
  if (!itemTypes || itemTypes.length === 0) return null;
  const catalogService = mapAgentServiceToCatalog(serviceType);

  const matchedItems: IndicativeRange["matchedItems"] = [];
  const unmatchedTerms: string[] = [];
  let labourSubtotal = 0;
  let totalUnits = 0;

  for (const rawTerm of itemTypes) {
    // Normalise: strip parentheticals, lowercase, drop trailing 's' for crude singular
    const term = rawTerm.replace(/\(.*?\)/g, "").trim().toLowerCase();
    if (!term) continue;

    // Try ILIKE on the normalised term (and a singular form if it ends in 's')
    const variants = Array.from(new Set([term, term.replace(/s$/, "")])).filter(Boolean);
    let rows: Array<{ name: string; basePrice: string }> = [];
    try {
      rows = await db
        .select({ name: catalogItems.name, basePrice: catalogItems.basePrice })
        .from(catalogItems)
        .where(and(
          eq(catalogItems.serviceType, catalogService),
          drizzleOr(...variants.map(v => ilike(catalogItems.name, `%${v}%`))) as any,
        ))
        .limit(20);
    } catch (e: any) {
      console.warn("[indicative-range] catalog query failed:", e?.message);
    }

    if (rows.length === 0) {
      // Fallback to PricingConfig generic
      const fb = PricingConfig.fallback.genericFallback; // 150
      const mult = catalogService === "install"
        ? 1
        : catalogService === "dismantle" ? PricingConfig.fallback.dismantleMultiplier
        : catalogService === "relocate"  ? PricingConfig.fallback.relocateMultiplier
        : catalogService === "dispose"   ? PricingConfig.fallback.disposeMultiplier
        :                                  PricingConfig.fallback.dismantleDisposeMultiplier;
      unmatchedTerms.push(rawTerm);
      const unitPrice = fb * mult;
      const qty = 1;
      matchedItems.push({ term: rawTerm, matchedAs: `(no catalog match — generic ${catalogService} fallback)`, unitPrice, qty });
      labourSubtotal += unitPrice * qty;
      totalUnits += qty;
      continue;
    }

    // Use median of matched prices as the per-unit estimate (robust to outliers)
    const prices = rows.map(r => parseFloat(r.basePrice)).filter(n => n > 0).sort((a, b) => a - b);
    const medianPrice = prices[Math.floor(prices.length / 2)] ?? PricingConfig.fallback.genericFallback;
    const qty = 1; // per item type — totalQuantityHint applied below
    matchedItems.push({ term: rawTerm, matchedAs: rows[0].name, unitPrice: medianPrice, qty });
    labourSubtotal += medianPrice * qty;
    totalUnits += qty;
  }

  // If we got a customer-stated total quantity that's bigger than #types, scale up.
  if (totalQuantityHint && totalQuantityHint > totalUnits) {
    const scale = totalQuantityHint / totalUnits;
    labourSubtotal *= scale;
    totalUnits = totalQuantityHint;
  }

  if (matchedItems.length === 0) return null;

  // Bulk discount (only kicks in at 10+ units)
  const bulkPct = PricingConfig.bulkDiscount.find(b => totalUnits >= b.minQty)?.pct ?? 0;
  const labourAfterBulk = labourSubtotal * (1 - bulkPct);

  // Range — best vs worst access:
  //   low  = labour + callout (assume ground floor / no surcharge)
  //   high = labour + callout + 4 floors × no-lift surcharge (typical worst-case for SG walk-up)
  const callout = catalogService === "relocate" ? 0 : PricingConfig.callout.fee;
  const transport = catalogService === "relocate" ? PricingConfig.transport.minFee : 0;
  const low  = Math.round(labourAfterBulk + callout + transport);
  const noLiftWorst = 4 * PricingConfig.floor.perFloorNoLift; // ~$60
  const high = Math.round(labourAfterBulk + callout + transport + noLiftWorst);

  return { low, high, matchedItems, unmatchedTerms, serviceType: catalogService };
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
    serviceType: "Could you let me know what service you need? (e.g. furniture installation, dismantling, or relocation)",
    jobAddress: "What's the address or area of the job? (e.g. Tampines, Bishan, Raffles Place)",
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
Your job is to qualify leads and help push them toward a quote and booking.

TRUST SIGNALS (mention naturally where relevant):
- 4.9★ rated on Google · 127+ reviews
- Fully insured · Island-wide coverage · Same-day available

RULES:
- Be concise, warm, and sales-oriented
- Ask ONLY the single most important missing piece of information
- Never ask multiple questions at once
- Never invent pricing — use ONLY the indicative range below if one is provided. Otherwise do not quote any number.
- Never promise slots that aren't confirmed
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
    `2️⃣ You receive a fixed-price quote with a deposit payment link\n` +
    `3️⃣ Pay the 50% deposit to lock in your slot ✅\n` +
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
          deposit_reminder: "Hi! Friendly reminder from TMG Install 🔔\n\nYour slot is still on hold, but we can only hold it a little longer. Please complete the 50% deposit to confirm your booking.\n\n📋 *Next step:* Reply here and we'll resend your payment link right away!\n\nLet us know if you need any help — we're here!",
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

    // ── 7b. Customer rating capture (post-job feedback loop) ───────────────
    // If we have a pending rating prompt for this phone (last 24h) and the
    // inbound is just "1".."5", record it and thank the customer. Returning
    // true here short-circuits the rest of the AI pipeline for this turn.
    try {
      const trimmed = text.trim();
      // Tightened: entire message must be a single digit 1-5 (with optional
      // surrounding whitespace). Avoids false positives like "5 pm" / "4 items".
      const ratingMatch = /^([1-5])$/.exec(trimmed);
      if (ratingMatch) {
        const since = new Date(Date.now() - 24 * 3600_000);
        const [pending] = await db.select().from(customerRatings)
          .where(and(
            eq(customerRatings.phone, from),
            eq(customerRatings.status, "pending"),
            gte(customerRatings.promptedAt, since),
          ))
          .orderBy(desc(customerRatings.promptedAt))
          .limit(1);
        if (pending) {
          const rating = parseInt(ratingMatch[1], 10);
          await db.update(customerRatings)
            .set({ rating, status: "answered", answeredAt: now } as any)
            .where(eq(customerRatings.id, pending.id));
          await sendBotMessage(from, rating >= 4
            ? `Thank you for the ${rating}-star rating! 🙏 Means a lot to the team.`
            : `Thanks for the honest ${rating}-star feedback. We'll look at how to do better next time. A team member may follow up.`);
          await logAudit("customer_rating_captured", "ai_feedback_loop",
            `Rating ${rating}/5 from ${masked} (quote ${pending.quoteId ?? "?"})`,
            { phone: masked, rating, quoteId: pending.quoteId });
          return true;
        }
      }
    } catch (rErr: any) {
      console.warn("[feedback-loop] rating capture failed:", rErr?.message);
    }

    // ── 8. Extract facts from this message ───────────────────────────────────
    // For image messages, visionAnalyzedText carries the gpt-4o-vision items
    // summary so the fact-extractor can populate itemTypes without re-asking.
    const { facts, confidence } = await extractFacts(visionAnalyzedText, history, currentFacts);
    if (visionResult?.isFurniture) facts.photosPresent = true;
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
