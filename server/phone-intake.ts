// ─────────────────────────────────────────────────────────────────────────────
// Phone-call intake → AI fact extraction → draft quote in the same admin
// review queue used by web-form and WhatsApp submissions.
//
// Used in two ways:
//   1. Admin-initiated  — admin types/pastes call notes during/after a call.
//   2. Telephony-initiated (future) — when a Twilio/Vonage webhook delivers a
//      call recording transcript, post the transcript to /api/phone/intake
//      with `actor: "voice_ai"` and the same draft-quote flow runs.
//
// Mirrors the WhatsApp agent quote-creation shape so quotes look identical
// in the admin dashboard regardless of source channel.
// ─────────────────────────────────────────────────────────────────────────────

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { callLLM } from "./ai-llm-client";
import { logAiAction } from "./ai-routes";
import { createRateLimiter } from "./lib/rate-limit";
import { randomBytes } from "node:crypto";

// Per-admin LLM-call limiter — same envelope as the AI routes (20/min/user)
const phoneIntakeLimiter = createRateLimiter({ name: "phone-intake", windowMs: 60_000, max: 20 });

// ── Auth guard (admin only) ──────────────────────────────────────────────────
async function requireAdmin(req: Request, res: Response, next: () => void) {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const user = await storage.getUserById(userId);
  if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  next();
}

// ── Extraction schema (mirrors WhatsApp factExtractionSchema) ────────────────
const phoneFactsSchema = z.object({
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
  specialNotes: z.string().optional(),
  toAddress: z.string().optional(),
  confidenceLevel: z.number().min(0).max(1).optional(),
}).strict().partial();

type PhoneFacts = z.infer<typeof phoneFactsSchema>;

// ── Request body ─────────────────────────────────────────────────────────────
const intakeBodySchema = z.object({
  callerPhone: z.string().trim().min(6).max(40)
    .refine(
      (v) => {
        const digits = v.replace(/[^0-9]/g, "");
        return digits.length >= 7 && digits.length <= 20;
      },
      { message: "Caller phone must contain 7–20 digits" },
    )
    .refine(
      // E.164-ish: optional leading "+", then digits only with a few separators allowed
      (v) => /^\+?[0-9 \-().]{6,40}$/.test(v),
      { message: "Caller phone has invalid characters" },
    ),
  callerName:    z.string().trim().max(120).optional().nullable(),
  transcript:    z.string().trim().min(20, "Call transcript / notes (min 20 chars) required").max(20_000),
  durationSec:   z.number().int().min(0).max(60 * 60 * 4).optional().nullable(),
  recordingUrl:  z.string().url().max(500).optional().nullable(),
});

// Mask a phone for log/audit storage: keep country prefix + last 3 digits.
// e.g. "+65 9876 5432" → "+65••••432"
function maskPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 4) return "•".repeat(digits.length);
  const tail = digits.slice(-3);
  const head = digits.startsWith("65") ? "+65" : `+${digits.slice(0, Math.min(2, digits.length - 3))}`;
  return `${head}••••${tail}`;
}

// ── Extract facts from a single call transcript ──────────────────────────────
async function extractFactsFromTranscript(transcript: string): Promise<{ facts: PhoneFacts; confidence: number }> {
  const { value: extracted } = await callLLM({
    agent: "phone_intake_extract",
    max_tokens: 700,
    schema: phoneFactsSchema,
    messages: [
      {
        role: "system",
        content: `You are a fact extractor for TMG Install, a Singapore furniture installation company.
A staff member or AI receptionist took a phone call from a customer and produced the transcript / notes below.
Extract every job fact you can — be aggressive, the admin will edit afterwards.

SERVICES (always pick one if the customer described any kind of work):
- "installation"  = assemble / install furniture. Use this for "assemble", "install", "set up", "put together", new items from IKEA / Taobao / Castlery / Lazada / Shopee.
- "dismantling"   = take apart furniture (no relocation).
- "relocation"    = move furniture from one address to another (usually includes dismantle + reassemble). Triggered by "move", "relocate", "shift", "transport".
- "office_fitout" = office relocation / fit-out.
- "repair"        = fix a wobbly, broken, worn or damaged item.
- "disposal"      = haul away unwanted items for discard ("throw away", "remove", "dispose").

EXTRACTION RULES:
- ALWAYS set "serviceType" if the call mentions any furniture work — only use "unknown" when the call truly has no job info.
- ALWAYS set "itemTypes" with each distinct item the customer mentioned (e.g. ["4-door wardrobe", "queen bed frame"]). Keep the customer's wording.
- "quantity" = total number of items (sum across itemTypes if not stated).
- ADDRESS: for installation/dismantling/repair/disposal → put into "jobAddress". For relocation → PICKUP into "jobAddress", DROPOFF into "toAddress".
- "floorLevel" = floor number (ground floor = 1). "hasLift" = true if customer mentioned a lift / elevator.
- "preferredDate" = ISO date (YYYY-MM-DD) computed RELATIVE TO TODAY (provided below). If the customer said "tomorrow", "next Tuesday", "this Saturday", etc., resolve it against today. Omit only if no date hint was given.
- "customerName" = caller's name if they said it.
- "specialNotes" = anything important the admin should see (gate code, parking, fragile items, callbacks requested).

Return ONLY JSON matching the provided schema. Set "confidenceLevel" between 0.0 and 1.0
reflecting overall extraction quality.`,
      },
      {
        role: "user",
        content: `TODAY: ${new Date().toISOString().slice(0, 10)} (${new Date().toLocaleDateString("en-SG", { weekday: "long", timeZone: "Asia/Singapore" })}, Singapore time).

PHONE CALL TRANSCRIPT / NOTES:

${transcript}

Extract every applicable field aggressively. Resolve all dates relative to TODAY above.`,
      },
    ],
  });

  const facts = (extracted ?? {}) as PhoneFacts;
  const confidence = Math.max(0, Math.min(1, facts.confidenceLevel ?? 0.5));
  return { facts, confidence };
}

// ── Map AI service → catalog service_type vocabulary ─────────────────────────
const SERVICE_MAP: Record<string, "install" | "dismantle" | "relocate"> = {
  installation:  "install",
  dismantling:   "dismantle",
  relocation:    "relocate",
  office_fitout: "install",
  repair:        "install",
  disposal:      "dismantle",
};

function buildNotesField(opts: {
  callerName?: string | null;
  callerPhone: string;
  durationSec?: number | null;
  recordingUrl?: string | null;
  transcript: string;
  missingFacts: string[];
  confidence: number;
}): string {
  const lines: string[] = [];
  lines.push(`Auto-created from phone-call intake.`);
  if (opts.callerName) lines.push(`Caller: ${opts.callerName}`);
  lines.push(`Number: ${opts.callerPhone}`);
  if (opts.durationSec) lines.push(`Call duration: ${Math.round(opts.durationSec / 60 * 10) / 10} min`);
  if (opts.recordingUrl) lines.push(`Recording: ${opts.recordingUrl}`);
  lines.push(`AI confidence: ${Math.round(opts.confidence * 100)}%`);
  lines.push(`Missing facts at creation: ${opts.missingFacts.length === 0 ? "none" : opts.missingFacts.join(", ")}.`);
  lines.push(``);
  lines.push(`─── Call transcript / notes ───`);
  lines.push(opts.transcript.trim());
  return lines.join("\n");
}

function computeMissingFacts(facts: PhoneFacts): string[] {
  const missing: string[] = [];
  if (!facts.serviceType || facts.serviceType === "unknown") missing.push("service type");
  if (!facts.jobAddress) missing.push("address");
  if (!facts.itemTypes || facts.itemTypes.length === 0) missing.push("items");
  if (facts.serviceType === "relocation" && !facts.toAddress) missing.push("dropoff address");
  return missing;
}

// ── Router registration ──────────────────────────────────────────────────────
export function registerPhoneIntakeRoutes(app: Express) {
  app.post(
    "/api/phone/intake",
    requireAdmin,
    phoneIntakeLimiter,
    async (req: Request, res: Response) => {
      const parsed = intakeBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid intake payload",
          errors: parsed.error.flatten(),
        });
      }
      const body = parsed.data;
      const userId = (req.session as any)?.userId;

      try {
        // 1. Extract facts via LLM
        const { facts, confidence } = await extractFactsFromTranscript(body.transcript);
        const missingFacts = computeMissingFacts(facts);

        // 2. Resolve service type → catalog vocab
        const itemSvc = SERVICE_MAP[facts.serviceType ?? "installation"] ?? "install";

        // 3. Floors info shape (mirrors wizard / WhatsApp agent)
        const floorsInfo: any[] = [];
        if (facts.floorLevel !== undefined) {
          floorsInfo.push({
            role:  facts.serviceType === "relocation" ? "pickup" : "service",
            floor: facts.floorLevel,
            hasLift: facts.hasLift ?? (facts.floorLevel === 1),
          });
        }

        // 4. Synthesize email if not collected (customers.email is NOT NULL)
        const safeEmail = `${body.callerPhone.replace(/[^0-9]/g, "")}@phone.tmginstall.local`;

        // 5. Generate ref no
        const refNo = `TMG-${randomBytes(4).toString("hex").toUpperCase()}`;

        // 6. Create the quote — same pattern as WhatsApp agent
        const created = await storage.createQuote(
          {
            name:  facts.customerName?.trim() || body.callerName?.trim() || "Phone-call Lead",
            phone: body.callerPhone,
            email: safeEmail,
          } as any,
          {
            referenceNo:           refNo,
            serviceAddress:        facts.jobAddress ?? "(pending — collected via phone call)",
            status:                "submitted",
            sourceChannel:         "phone",
            requiresManualReview:  true,
            aiConfidenceScore:     Math.round(confidence * 100),
            pickupAddress:         facts.serviceType === "relocation" ? (facts.jobAddress ?? null) : null,
            dropoffAddress:        facts.serviceType === "relocation" ? (facts.toAddress ?? null) : null,
            floorsInfo:            floorsInfo.length ? JSON.stringify(floorsInfo) : null,
            selectedServices:      JSON.stringify([itemSvc]),
            preferredDate:         facts.preferredDate ?? null,
            notes: buildNotesField({
              callerName:   facts.customerName?.trim() || body.callerName,
              callerPhone:  body.callerPhone,
              durationSec:  body.durationSec ?? null,
              recordingUrl: body.recordingUrl ?? null,
              transcript:   body.transcript,
              missingFacts,
              confidence,
            }),
          } as any,
          (facts.itemTypes ?? []).map(it => ({
            originalDescription: it,
            detectedName:        null,
            serviceType:         itemSvc,
            quantity:            facts.quantity && facts.quantity > 0 ? facts.quantity : 1,
            unitPrice:           "0",
            subtotal:            "0",
          })) as any
        );

        const quoteId = (created as any)?.id ?? (created as any)?.quote?.id;
        const quoteRef = (created as any)?.referenceNo ?? (created as any)?.quote?.referenceNo ?? refNo;

        // 7. Audit log — mask phone PII; full phone lives on the quote (gated by admin auth)
        logAiAction(
          "phone_intake_quote_created",
          `admin:${userId ?? "?"}`,
          "phone_intake",
          `Created draft quote ${quoteRef} from phone call`,
          {
            quoteId,
            quoteRef,
            callerPhoneMasked: maskPhone(body.callerPhone),
            confidence,
            missingFacts,
            serviceType: facts.serviceType,
            transcriptChars: body.transcript.length,
          },
          "success",
        );

        res.status(201).json({
          quoteId,
          referenceNo: quoteRef,
          confidence,
          missingFacts,
          extractedFacts: facts,
        });
      } catch (err: any) {
        console.error("[phone-intake] failed:", err?.name, err?.message);
        logAiAction(
          "phone_intake_quote_created",
          `admin:${userId ?? "?"}`,
          "phone_intake",
          `Failed: ${err?.message ?? "unknown"}`,
          { error: String(err?.message ?? err) },
          "failure",
        );
        res.status(500).json({
          message: err?.message ?? "Phone intake failed. Please try again.",
        });
      }
    },
  );
}
