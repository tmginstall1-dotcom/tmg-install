import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { logAttributionEvent, registerAiRoutes } from "./ai-routes";
import { registerPhoneIntakeRoutes } from "./phone-intake";
import { servicesHubPage, ikeaAssemblyPage, wardrobeInstallationPage, bedAssemblyPage, furnitureDismantlingPage, officeFurniturePage, furnitureRelocationPage, tvMountingPage, sofaAssemblyPage, mattressInstallationPage, taobaoFurnitureInstallationPage, castleryFurnitureAssemblyPage, hdbMovingServicesPage, condoMovingServicesPage, lazadaFurnitureInstallationPage, shopeeFurnitureInstallationPage, gymEquipmentInstallationPage, furnitureRepairAdjustmentPage, sitemapXml } from "./seo-pages";
import { api } from "@shared/routes";
import { initVapid, getVapidPublicKey, addSubscription, removeSubscription, sendPushToAdmins } from "./push";
import { z } from "zod";
import { randomBytes, createHmac, timingSafeEqual } from "crypto";
import { execSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import Stripe from "stripe";
import admin from "firebase-admin";
import { openai } from "./replit_integrations/audio/client";
import { 
  sendEmail, 
  estimateSubmittedEmail,
  depositRequestEmail, 
  depositReceivedEmail,
  bookingRequestAdminEmail,
  bookingConfirmationEmail,
  rescheduleConfirmationEmail,
  finalPaymentEmail,
  commercialBookingConfirmEmail,
  commercialInvoiceEmail,
  caseClosedEmail,
  newEstimateAdminAlert,
  ADMIN_EMAIL
} from "./email";
import { sendWhatsAppMessage, sendBotMessage, sendWhatsAppPaymentLink, updateAccessToken, getAccessToken, downloadWhatsAppMedia, markAsRead, WHATSAPP_VERIFY_TOKEN, sendWhatsAppImageMessage, sendWhatsAppDocumentMessage } from "./whatsapp";
import { processWithAIAgent, getAiConversations, getAiConversationDetail, handoffToHuman, resumeAiOwnership, runFollowUpScheduler } from "./whatsapp-agent";
import multer from "multer";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number }> = _require("pdf-parse");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });
import { calcTransportFee, calcOvertimeCharge, PricingConfig, bulkWeightedQty } from "@shared/pricing";
import { db } from "./db";
import { appSettings, attendanceLogs, promoCodes, quotes as quotesTable, quoteItems as quoteItemsTable, catalogItems as catalogItemsTable, users as usersTable, jobUpdates as jobUpdatesTable, whatsappSessions as whatsappSessionsTable, whatsappMessages as whatsappMessagesTable, customers, jobChecklists as jobChecklistsTable, customerTokens as customerTokensTable, ggvJobs as ggvJobsTable } from "@shared/schema";
import { aiWhatsappFollowups as aiWaFollowupsTable, aiWhatsappHandoffs as aiWaHandoffsTable, aiAuditLog as aiAuditLogTable, aiFeatureFlags, customerRatings } from "@shared/schema";
import { eq, and, or, isNull, desc, gte, lte, sql as drizzleSql, inArray } from "drizzle-orm";

const APP_URL = process.env.APP_URL || "http://localhost:5000";

// Normalize Singapore phone numbers to full international format (no '+')
// e.g. "93826826" → "6593826826", "6593826826" → "6593826826"
function normalizeSGPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (/^[689]\d{7}$/.test(digits)) return `65${digits}`; // 8-digit SG number
  return digits;
}

// Format the "📅 Slot:" line for customer payment messages, preferring the
// admin-confirmed scheduledAt/timeWindow over the customer's original
// preferredDate/preferredTimeWindow so reschedules are reflected. Returns ""
// when no date is set so callers can include it unconditionally.
function formatSlotLineForQuote(quote: { scheduledAt?: Date | string | null; timeWindow?: string | null; preferredDate?: string | null; preferredTimeWindow?: string | null }): string {
  if (quote.scheduledAt) {
    const d = new Date(quote.scheduledAt as any);
    // SG-local YYYY-MM-DD (UTC+08:00) so the date matches what the admin sees.
    const sgMs = d.getTime() + 8 * 60 * 60 * 1000;
    const sgDate = new Date(sgMs);
    const yyyy = sgDate.getUTCFullYear();
    const mm = String(sgDate.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(sgDate.getUTCDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const tw = quote.timeWindow || "";
    return `📅 *Slot: ${dateStr}${tw ? ` (${tw})` : ""}*\n`;
  }
  if (quote.preferredDate) {
    return `📅 *Slot: ${quote.preferredDate}${quote.preferredTimeWindow ? ` (${quote.preferredTimeWindow})` : ""}*\n`;
  }
  return "";
}

// ── WhatsApp payment blocks ────────────────────────────────────────────────────
// Shared "how to pay" block used in both deposit and final payment messages.
// payUrl should always be the clean short URL (e.g. https://tmginstall.com/pay/TMG-XXXX)
// For final payments pass payUrl with ?type=final so the redirect charges the right amount.
function waPayBlock(amt: number, payUrl: string): string {
  return (
    `💳 *Pay by Card* (instant confirmation):\n` +
    `👉 ${payUrl}\n\n` +
    `🏦 *PayNow Transfer:*\n` +
    `UEN: *202424156H* (TMG Install)\n` +
    `Amount: *S$${amt.toFixed(2)}*\n` +
    `→ Screenshot your PayNow receipt and send it here. We'll confirm within the hour. ✅`
  );
}

// ── Smart catalog pricing lookup (used by WhatsApp bot) ──────────────────────
// Given a natural-language furniture query, ALWAYS finds the closest catalog
// match and returns a formatted WhatsApp price message.
// Returns null only on network/DB errors (not on mismatch — we always match).
async function smartPricingLookup(query: string): Promise<string | null> {
  try {
    const [catalog, corrections] = await Promise.all([
      storage.getCatalogItems(),
      storage.getPricingCorrections(true), // active corrections = self-learning layer
    ]);
    const uniqueNames = [...new Set(catalog.map(c => c.name))].join(", ");

    // Build corrections block — these are PRIORITY overrides taught by admin
    const correctionBlock = corrections.length > 0
      ? `\n\nADMIN-VERIFIED CORRECTIONS — use these FIRST, they override all other matching:\n${
          corrections.map(c => `- If query contains or is similar to "${c.detectedDescription}" → use catalog item: "${c.catalogItemName || c.correctedName}"${c.notes ? ` (note: ${c.notes})` : ""}`).join("\n")
        }`
      : "";

    // Ask GPT to find the BEST matching catalog item(s) — always return something
    const matchRes = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [{
        role: "system",
        content: `You are a pricing assistant for TMG Install, a Singapore furniture installation company.
The customer is asking about pricing for: "${query}"

Available catalog items (exact names — use these EXACTLY):
${uniqueNames}
${correctionBlock}

Your job: find the BEST matching catalog item(s). ALWAYS return at least one match — never return an empty list.

Matching rules (use these to guide fuzzy matching):
- "dresser", "chest of drawers", "drawer unit", "drawers" → "Dressing Table" or "IKEA Malm Chest of Drawers (6-drawer)" or "IKEA Alex Drawer Unit"
- "shelf", "shelves", "shelving", "wooden shelf", "rack shelf", "wall shelf", "open shelf" → "Bookshelf" or "IKEA Kallax Shelf Unit (2×2)" or "IKEA Billy Bookcase"
- "cabinet", "storage cabinet", "locker", "under-desk cabinet", "pedestal" → "Filing Cabinet" or "Display Cabinet"
- "workstation", "cubicle", "office cubicle", "office partition", "partition panel" → "Office Desk" or "Filing Cabinet"
- "office desk", "desk", "study desk", "work desk" → "Office Desk" or "IKEA Micke Desk"
- "sofa", "couch", "settee", "loveseat" → appropriate sofa size
- "wardrobe", "closet", "built-in" → appropriate wardrobe type
- "bed", "bed frame" → appropriate bed frame size
- "solo phone booth", "privacy pod", "acoustic pod", "phone booth pod", "office pod", "focus pod", "work pod", "soundproof booth", "Framery", "Zenbooth", "Hushoffice", "office cabin", "isolation pod" → "Solo Phone Booth (1-Person)" or "Freestanding Acoustic Booth"
- "duo pod", "duo phone booth", "2-person pod", "2-person booth", "double booth" → "Duo Phone Booth (2-Person)"
- "meeting pod", "huddle pod", "4-person pod", "collaboration pod", "team pod" → "Meeting Pod (4-Person)"
- "meeting room pod", "large pod", "6-person pod", "8-person pod", "conference pod" → "Meeting Room Pod (6-Person)" or "Large Meeting Pod (8-Person)"
- "standing kiosk", "kiosk", "mini pod", "display kiosk", "standing pod" → "Standing Kiosk / Mini Pod"
- "acoustic booth", "freestanding booth", "semi-open pod" → "Freestanding Acoustic Booth"
- For anything else: pick the most visually/functionally similar item from the list — NEVER pick an item by service type name (e.g. "installation" is not a furniture item, pick the actual furniture)

Return JSON:
{
  "matchedNames": ["exact catalog name 1", "exact catalog name 2"],   // 1-3 items, MUST be non-empty
  "itemLabel": "friendly customer-facing name",
  "isApproximate": false   // true if this is a close/similar match rather than exact
}`,
      }],
    });

    const parsed = JSON.parse(matchRes.choices[0]?.message?.content || "{}");
    const matchedNames: string[] = (parsed.matchedNames || []).filter(Boolean);
    const itemLabel: string = parsed.itemLabel || query;
    const isApproximate: boolean = !!parsed.isApproximate;

    if (matchedNames.length === 0) return null;

    const matched = catalog.filter(c => matchedNames.includes(c.name));
    if (matched.length === 0) return null;

    // ── Auto-learn: save this match as a correction if one doesn't exist yet ──
    // Only auto-learn when the query looks like a real item name (not a generic phrase
    // that's already covered by built-in rules), and GPT returned a confident match.
    const genericPhrases = ["furniture", "items", "stuff", "things", "my furniture", "these items"];
    const queryNorm = query.trim().toLowerCase();
    const alreadyHasCorrection = corrections.some(c =>
      c.detectedDescription.toLowerCase() === queryNorm
    );
    if (!alreadyHasCorrection && queryNorm.length > 2 && !genericPhrases.includes(queryNorm)) {
      storage.createPricingCorrection({
        detectedDescription: query.trim(),
        correctedName: itemLabel || matchedNames[0],
        catalogItemName: matchedNames[0],
        notes: `Auto-learned from live lookup (${isApproximate ? "approximate" : "confident"} match)`,
        active: true,
        autoLearned: true,
      }).catch(() => {}); // fire-and-forget — never block the response
    }

    // Group prices by service type
    const byType: Record<string, number[]> = {};
    matched.forEach(item => {
      const price = parseFloat(item.basePrice as string);
      if (!isNaN(price)) {
        if (!byType[item.serviceType]) byType[item.serviceType] = [];
        byType[item.serviceType].push(price);
      }
    });

    const typeLabel: Record<string, string> = {
      install:          "Assembly / Installation",
      dismantle:        "Dismantling",
      relocate:         "Relocation (incl. dismantle + reinstall)",
      dispose:          "Disposal",
      dismantle_dispose:"Dismantling + Disposal",
    };

    const lines = Object.entries(byType)
      .filter(([type]) => typeLabel[type])
      .map(([type, prices]) => {
        const min = Math.min(...prices), max = Math.max(...prices);
        return `• ${typeLabel[type]} — SGD $${min}${min !== max ? `–$${max}` : ""}`;
      });

    if (lines.length === 0) return null;

    const intro = isApproximate
      ? `Confirmed pricing reference for *${itemLabel}* in Singapore:\n\n`
      : `Confirmed pricing for *${itemLabel}* in Singapore:\n\n`;

    const footnote = isApproximate
      ? `\n\n_Based on similar items. Our team will confirm the exact price for your job. +$39.90 mobilisation & coordination fee applies._`
      : `\n\n_Per item. +$39.90 mobilisation & coordination fee applies. No GST._`;

    return intro + lines.join("\n") + footnote;
  } catch {
    return null;
  }
}

// ── Conversation history helpers ──────────────────────────────────────────────
type HistoryEntry = { role: "user" | "assistant"; content: string };

/** Parse stored JSON history or return empty array */
function loadHistory(session: { conversationHistory?: string | null } | undefined): HistoryEntry[] {
  try { return JSON.parse(session?.conversationHistory || "[]") as HistoryEntry[]; }
  catch { return []; }
}

/** Return last N entries formatted for the GPT messages array */
function historyMessages(history: HistoryEntry[], n = 8): { role: "user" | "assistant"; content: string }[] {
  return history.slice(-n);
}

/** Append one customer+bot exchange and save (fire-and-forget is fine — non-critical) */
async function saveHistory(phone: string, history: HistoryEntry[], customerMsg: string, botReply: string): Promise<void> {
  history.push({ role: "user", content: customerMsg });
  history.push({ role: "assistant", content: botReply });
  const trimmed = history.slice(-16); // keep last 8 pairs
  storage.upsertWhatsAppSession(phone, { conversationHistory: JSON.stringify(trimmed) }).catch(() => {});
}

// ─── Build an itemised estimate message from a session ───────────────────────
// Used when customer asks "how much is it?" mid-flow and items are already known.
async function buildJobEstimateMessage(session: NonNullable<Awaited<ReturnType<typeof storage.getWhatsAppSession>>>): Promise<string | null> {
  const itemsText = session.collectedItems;
  if (!itemsText || itemsText === "__scanning__") return null;

  try {
    const catalog = await storage.getCatalogItems();

    // Parse items with GPT — same prompt as the submission flow
    let aiParsed: { detectedName: string; serviceType: string; quantity: number; estimatedUnitPrice: number }[] = [];
    try {
      const parseRes = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: [{
          role: "system",
          content: `Parse furniture items from this text into structured JSON. Return {"items":[{"detectedName":"...","serviceType":"install|dismantle|relocate|dispose","quantity":1,"estimatedUnitPrice":80}]}. Default serviceType is "install".`,
        }, { role: "user", content: itemsText }],
      });
      const raw = parseRes.choices[0].message.content || '{"items":[]}';
      aiParsed = JSON.parse(raw).items || [];
    } catch { /* fall through */ }

    if (!aiParsed.length) return null;

    // Match catalog + compute per-item subtotals
    let totalEstimate = 0;
    let dismantleSubtotal = 0;
    let installSubtotal = 0;
    const itemLines: string[] = [];
    const adjustmentLines: string[] = [];
    const surchargeLines: string[] = [];
    const svcLabel: Record<string, string> = { install: "Assembly / Installation", dismantle: "Dismantling", relocate: "Relocation", dispose: "Disposal", dismantle_dispose: "Dismantling + Disposal" };
    let hasTBCItems = false;

    // Load corrections once for auto-learn de-dupe check
    let existingCorrections: { detectedDescription: string }[] = [];
    try { existingCorrections = await storage.getPricingCorrections(); } catch { /* ignore */ }

    /** Fuzzy-match helper: find a catalog entry by item name + serviceType */
    const findCatalogEntry = (name: string, svcType: string) => catalog.find(c =>
      c.serviceType === svcType &&
      (name.toLowerCase().includes(c.name.toLowerCase()) ||
       c.name.toLowerCase().includes(name.toLowerCase()) ||
       name.toLowerCase().split(/\s+/).some((w: string) => w.length > 3 && c.name.toLowerCase().includes(w)))
    );

    const drPct = PricingConfig.fallback.relocateDRDiscount; // 0.40

    // Determine carry-only vs full D&R mode from structured state
    const estStructuredState = (session as any).structuredState ? (() => { try { return JSON.parse((session as any).structuredState); } catch { return null; } })() : null;
    const estRelocateMode: string | null = estStructuredState?.relocation_mode || null;
    const estIsCarryOnly = !!(session as any).isRelocation && estRelocateMode === "carry";

    for (const item of aiParsed) {
      const matched = findCatalogEntry(item.detectedName, item.serviceType);

      // Auto-learn: if we found a confident catalog match and no correction exists yet, save it
      if (matched) {
        const detectedNorm = item.detectedName.trim().toLowerCase();
        const alreadyKnown = existingCorrections.some(c =>
          c.detectedDescription.toLowerCase() === detectedNorm
        );
        if (!alreadyKnown && detectedNorm.length > 3) {
          storage.createPricingCorrection({
            detectedDescription: item.detectedName.trim(),
            correctedName: matched.name,
            catalogItemName: matched.name,
            notes: `Auto-learned from quote estimate (service: ${item.serviceType})`,
            active: true,
            autoLearned: true,
          }).catch(() => {});
        }
      }

      let unitPrice: number;
      if (item.serviceType === 'relocate' && estIsCarryOnly) {
        // Carry-only: no per-item labor — only transport fee applies
        unitPrice = 0;
      } else if (item.serviceType === 'relocate') {
        // Full D&R relocation: (install + dismantle) × (1 − drPct)
        const installEntry   = findCatalogEntry(item.detectedName, 'install');
        const dismantleEntry = findCatalogEntry(item.detectedName, 'dismantle');
        if (installEntry && dismantleEntry) {
          unitPrice = (Number(installEntry.basePrice) + Number(dismantleEntry.basePrice)) * (1 - drPct);
        } else if (matched) {
          // Fall back to relocate catalog price if install+dismantle not both found
          unitPrice = Number(matched.basePrice);
        } else {
          unitPrice = item.estimatedUnitPrice || 0;
        }
      } else {
        unitPrice = matched ? Number(matched.basePrice) : (item.estimatedUnitPrice || 0);
      }

      const qty = item.quantity || 1;
      const subtotal = unitPrice * qty;
      totalEstimate += subtotal;
      if (item.serviceType === 'dismantle') dismantleSubtotal += subtotal;
      if (item.serviceType === 'install')   installSubtotal   += subtotal;
      const svc = svcLabel[item.serviceType] || item.serviceType;
      if (unitPrice > 0) {
        const calcStr = qty > 1
          ? ` (${qty} × SGD $${unitPrice.toFixed(0)}) — SGD $${subtotal.toFixed(0)}`
          : ` — SGD $${unitPrice.toFixed(0)}`;
        itemLines.push(`• ${item.detectedName} [${svc}]${calcStr}`);
      } else {
        hasTBCItems = true;
        itemLines.push(`• ${item.detectedName} [${svc}] — price to be confirmed by team`);
      }
    }

    // D&R bundle discount: only applies to mixed dismantle+install quotes (not pure relocation)
    const drDiscountAmt = (dismantleSubtotal > 0 && installSubtotal > 0)
      ? Math.round(dismantleSubtotal * drPct * 100) / 100
      : 0;
    if (drDiscountAmt > 0) {
      totalEstimate -= drDiscountAmt;
      adjustmentLines.push(`D&R bundle saving (${Math.round(drPct * 100)}% off dismantling) — -SGD $${drDiscountAmt.toFixed(0)}`);
    }

    // Bulk discount — per-hole units count at PricingConfig.perHoleBulkWeight
    // so a single 120-hole wardrobe is billed as one wardrobe, not 120 items.
    const totalQty = aiParsed.reduce((s, i) => s + (i.quantity || 1), 0);
    const weightedQty = bulkWeightedQty(aiParsed.map((i: any) => ({ name: i.name || i.detectedName || "", quantity: i.quantity || 1 })));
    const discountTier = PricingConfig.bulkDiscount.find((t: { minQty: number; pct: number }) => weightedQty >= t.minQty);
    const discountPct = discountTier?.pct ?? 0;
    const discountAmt = Math.round(totalEstimate * discountPct * 100) / 100;
    if (discountAmt > 0) {
      totalEstimate -= discountAmt;
      adjustmentLines.push(`Bulk discount (${Math.round(discountPct * 100)}% off for ${totalQty} items) — -SGD $${discountAmt.toFixed(0)}`);
    }
    const laborTotal = totalEstimate;

    // Floor surcharge
    const floorLevel = session.floorLevel ?? 1;
    const hasLift = session.hasLift ?? true;
    const floorsAbove = Math.max(0, floorLevel - 1);
    const floorSurcharge = floorsAbove * (hasLift ? PricingConfig.floor.perFloorWithLift : PricingConfig.floor.perFloorNoLift);
    if (floorSurcharge > 0) {
      const liftLabel = hasLift ? `with lift` : `no lift`;
      surchargeLines.push(`• Floor surcharge (Floor ${floorLevel}, ${liftLabel}) — SGD $${floorSurcharge.toFixed(0)}`);
    }

    // Access surcharge
    const access = session.accessDifficulty ?? "easy";
    const accessPct = access === "medium" ? PricingConfig.access.mediumPct : access === "hard" ? PricingConfig.access.hardPct : 0;
    const accessSurcharge = Math.round(laborTotal * accessPct * 100) / 100;
    if (accessSurcharge > 0) surchargeLines.push(`• Access surcharge (${access === "medium" ? "Moderate" : "Difficult"}) — SGD $${accessSurcharge.toFixed(0)}`);

    // Transport fee (relocation only) OR callout fee (non-relocation)
    const distKm = session.distanceKm ? parseFloat(session.distanceKm) : 0;
    const transportFee = session.isRelocation ? calcTransportFee(distKm) : 0;
    if (transportFee > 0) surchargeLines.push(`• Transport fee — SGD $${transportFee.toFixed(0)}`);

    const calloutFee = session.isRelocation ? 0 : PricingConfig.callout.fee;
    if (calloutFee > 0) surchargeLines.push(`• Mobilisation & coordination — SGD $${calloutFee.toFixed(0)}`);

    const grandTotal = laborTotal + floorSurcharge + accessSurcharge + transportFee + calloutFee;
    const deposit = grandTotal * 0.5;

    if (grandTotal === 0) return null;

    // Build the clean bullet-format confirmed quote
    const jobDesc = itemLines.length === 1 ? itemLines[0].split("\n")[0].replace(/^•\s*/, "").split("—")[0].trim() : `${itemLines.length} items`;
    let msg = `Here is your confirmed quote for ${jobDesc}:\n\n`;
    msg += itemLines.join("\n");
    if (adjustmentLines.length > 0) {
      msg += "\n" + adjustmentLines.map((l: string) => `• ${l.replace(/^[•\s]+/, "")}`).join("\n");
    }
    if (surchargeLines.length > 0) {
      msg += "\n" + surchargeLines.join("\n");
    }
    msg += `\n\n─────────────────────────────\n`;
    msg += `Total: SGD $${grandTotal.toFixed(0)} (No GST)\n`;
    msg += `Deposit to confirm: SGD $${deposit.toFixed(0)}\n`;
    msg += `─────────────────────────────\n\n`;
    msg += `This is a fixed price — no surprises on the day. ✅\n\n`;
    // Floor surcharge outcome statement
    if (floorSurcharge > 0) {
      if (!hasLift) {
        msg += `Floor surcharge of SGD $${floorSurcharge.toFixed(0)} applied — no lift access at this building.\n\n`;
      } else {
        msg += `Floor surcharge of SGD $${floorSurcharge.toFixed(0)} applied — lift access, $5/floor for ${floorsAbove} floor(s).\n\n`;
      }
    } else {
      msg += `Ground floor unit — no floor surcharge applied.\n\n`;
    }
    if (session.isRelocation) {
      if (estIsCarryOnly) {
        msg += `_Carry-only relocation: furniture is moved as-is (no dismantle/reinstall). Transport fee covers crew and vehicle._\n\n`;
      } else {
        msg += `_Full-service relocation: dismantle at origin + transport + reinstall at destination._\n\n`;
      }
    }
    if (hasTBCItems) {
      msg += `_Note: Some items require manual pricing — our team will confirm the final amount._\n\n`;
    }
    msg += `Our team is experienced, punctual, and fully insured — 200+ jobs completed across Singapore.`;
    return msg;
  } catch {
    return null;
  }
}

// ─── Coordinator persona shared across all GPT reply functions ───────────────
const COORDINATOR_PERSONA = `You are the customer service assistant for TMG Install — Singapore's trusted furniture installation and disposal specialists. You are professional, warm, and knowledgeable. You speak like a helpful human representative, not an automated bot.

PERSONALITY:
- Confident and reassuring, not salesy
- Use clear, simple English — no jargon
- Be concise. Customers are busy.
- Use a maximum of 1–2 emojis per message, only where natural
- Never sound desperate or pushy
- When in doubt, be brief and helpful

HARD RULES:
- Never say you are an AI
- Never use the word "estimate" — always say "confirmed price", "fixed price", or "confirmed quote"
- Never say "prices may vary" or "TBC" or "rough price"
- Never ask more than one question at a time
- Never ask for information the customer already gave
- Never ignore a customer question — answer it first, then continue
- Never say booking is confirmed unless the real system confirms it
- Never invent pricing, policy, or availability
- If the case is complex, say the team will review and follow up

BEFORE GIVING ANY PRICE — always collect in this order:
1. Service type (if not already stated): Dismantling only / Disposal only / Dismantling + Disposal / Assembly / Relocation
2. Floor and lift access (required to confirm the final price — never skip this)
3. Furniture items (if not already stated)
Only after collecting all three should you generate a confirmed quote.

FLOOR SURCHARGE RULES (apply automatically — per floor above ground):
- Ground floor (floor 1): No surcharge regardless of lift.
- With lift: SGD $5 per floor above ground. Example: floor 5 with lift = 4 × $5 = $20.
- No lift: SGD $15 per floor above ground. Example: floor 3 no lift = 2 × $15 = $30.
Always calculate and state the exact surcharge. Never leave it as TBC.

HANDLING OBJECTIONS:
- If price is too high: Reply with exactly this:
  "I understand — and it's smart to compare prices.

  The difference with TMG Install is that this is a fixed, confirmed price. No hidden charges added on the day, no surprises when our team arrives.

  Some cheaper options quote low upfront but add charges for floor access, disposal, or extra manpower on the day — ending up more expensive.

  Our team is also fully insured, so if anything is accidentally damaged during the job, you're covered.

  Would you like me to walk you through exactly what's included in your quote? 😊"
- If customer needs to think: "Of course, take your time! Is there anything I can clarify to help you decide? I can also share some photos of recent similar jobs if that would help."
- If comparing with others: "Absolutely — you should compare! When you do, I'd suggest asking whether their price is fixed or an estimate, and whether they carry insurance. Those are the questions that separate a good deal from a risky one. We're happy to be compared on those terms. 😊"

TMG Install — company knowledge:
Company: The Moving Guy Pte Ltd, trading as TMG Install
Location: Singapore (all areas — HDB, condo, landed, commercial, office)
WhatsApp: +65 8088 0757

Services:
1. ASSEMBLY / INSTALLATION — flat-pack furniture (IKEA, Taobao, self-purchased), gym equipment, TV brackets, shelving. From $80/item.
2. DISMANTLING — safe disassembly for moving, renovation, or disposal. From $60/item.
3. DISPOSAL — haul-away of unwanted furniture. From $80/item. Dismantle + dispose bundle saves money.
4. RELOCATION — two service levels:
   • *Carry Only* — move furniture as-is, no dismantle/reinstall needed (e.g. sofas, dining tables, mattresses). Just transport fee applies — starts from $38.
   • *Full Service (D&R)* — dismantle at origin + transport + reinstall at destination (e.g. wardrobes, bed frames, shelving). From $120 + transport (varies by distance & volume).

Typical item pricing (per item, SGD):
- Single bed frame: $60 install, $45 dismantle
- Super single bed frame: $65 install, $50 dismantle
- Double bed frame: $75 install, $55 dismantle
- Queen bed frame: $80 install, $60 dismantle
- King bed frame: $100 install, $80 dismantle
- IKEA PAX Wardrobe (2-door): $130 install, $90 dismantle, $120 dismantle & dispose, $148 relocate
- IKEA PAX Wardrobe (3-door): $160 install, $110 dismantle, $140 dismantle & dispose, $162 relocate
- IKEA PAX Wardrobe (Sliding Doors): $180 install, $120 dismantle, $165 dismantle & dispose, $195 relocate
- Sliding door wardrobe (2-door, non-PAX): $120 install, $85 dismantle
- Sliding door wardrobe (3-door, non-PAX): $160 install, $110 dismantle
- Hinged door wardrobe (4-door): $150 install, $110 dismantle
- 4-door or custom wardrobe: $180–300
- Dining table: $80 install
- Dining chair (per piece): $20 install
- Sofa (2-seater): $60 install; (3-seater): $80 install
- TV console / entertainment unit: $60 install
- Coffee table: $40 install
- Bookcase / shelving unit: $60–80 install
- Office desk: $50 install; L-shaped/executive desk: $100 install
- Chest of drawers / dresser: $65–80 install
- Mattress disposal: $80–100
- All prices per item; $39.90 mobilisation & coordination fee applies to all non-relocation jobs; no GST
- Mobilisation & coordination fee explained: flat $39.90 on installation/dismantling jobs (not on relocation). Covers crew transport to site, dispatch logistics, and job coordination. It is a crew mobilisation charge — there is NO pre-visit or site inspection. The crew comes once on the job day only.

Process / how it works:
1. Customer tells us what they need → we prepare a confirmed quote
2. Admin reviews and confirms pricing → sends a deposit payment link
3. Customer pays 50% deposit → slot is locked in
4. Team arrives on the agreed date; full payment (remaining 50%) on job completion
5. Payment methods: PayNow, bank transfer, credit/debit card

Scheduling:
- Available weekdays and weekends (subject to availability)
- Minimum notice: 48 hours recommended; urgent same-day may be possible
- Time windows: morning (9am–12pm) or afternoon (1pm–5pm)

Other policies:
- All tools and equipment supplied by TMG — customer brings nothing
- No GST; all prices are nett
- Rescheduling: minimum 48 hours notice
- TMG serves all of Singapore: Jurong, Tampines, Woodlands, Punggol, Sengkang, Bishan, Serangoon, Toa Payoh, Bedok, Clementi, Buona Vista, Orchard, CBD, etc.

Natural acknowledgement examples:
- "Got it, noted."
- "No problem, I've updated that."
- "Understood — making a note of that."
- "Thanks, that helps."`;

// ─── Shared company FAQ knowledge for free-form answers (static fallback) ────
const FAQ_KNOWLEDGE = `TMG Install (The Moving Guy Pte Ltd) — Singapore furniture services.

Services: installation/assembly, dismantling, relocation (all-in-one), disposal/haul-away.
Coverage: all of Singapore — HDB, condo, landed, commercial & office.
Pricing: from $80/item install, $60/item dismantle, $80/item disposal, from $200 relocation. $39.90 mobilisation & coordination fee on all non-relocation jobs. No GST.
Common prices: bed frame install $80–150, wardrobe install $120–300, sofa dismantle $80–100, dining set $80–120.
Payment: 50% deposit (PayNow / bank transfer / card) to confirm booking; 50% on completion.
Availability: weekdays & weekends (subject to slots). Min. 48h notice. Morning (9am–12pm) or afternoon (1pm–5pm).
All tools supplied. Customer doesn't need to be home for some pickup/disposal jobs.
Rescheduling: min. 48h notice. Large/complex jobs may need on-site assessment.
Booking process: share details → admin prepares quote → deposit locks in slot → job done → pay balance.`;

// ─── Dynamic bot knowledge — loads FAQ entries + settings from DB ─────────────
async function buildBotKnowledge(): Promise<{ faqBlock: string; hoursBlock: string; policyBlock: string }> {
  try {
    const [faqRows, settingsRows] = await Promise.all([
      storage.getFaqEntries(true), // active only
      db.select().from(appSettings),
    ]);

    const settings = Object.fromEntries(settingsRows.map(s => [s.key, s.value]));

    // ── Build FAQ block from DB entries ──────────────────────────────────────
    let faqBlock = FAQ_KNOWLEDGE; // fallback
    if (faqRows.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const entry of faqRows) {
        if (!grouped[entry.category]) grouped[entry.category] = [];
        grouped[entry.category].push(`Q: ${entry.question}\nA: ${entry.answer}`);
      }
      const sections = Object.entries(grouped)
        .map(([cat, entries]) => `[${cat.toUpperCase()}]\n${entries.join("\n\n")}`)
        .join("\n\n");
      faqBlock = `TMG Install — Company FAQ (Singapore furniture services).\n\n${sections}\n\n${FAQ_KNOWLEDGE}`;
    }

    // ── Build business hours block from DB settings ───────────────────────────
    let hoursBlock = "Available weekdays & weekends. Morning (9am–12pm) or afternoon (1pm–5pm) slots.";
    if (settings.business_hours) {
      try {
        const hrs = JSON.parse(settings.business_hours) as Record<string, { open: boolean; start: string; end: string }>;
        const DAY_NAMES: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
        const lines = Object.entries(hrs).map(([k, v]) =>
          v.open ? `${DAY_NAMES[k] || k}: ${v.start} – ${v.end}` : `${DAY_NAMES[k] || k}: Closed`
        );
        hoursBlock = `Operating hours:\n${lines.join("\n")}`;
      } catch {}
    }

    // ── Build policy block ────────────────────────────────────────────────────
    const depositPct = settings.business_deposit_pct || "50";
    const sla = settings.business_response_sla || "within 2 hours during business hours";
    const urgent = settings.business_urgent_policy || "Same-day urgent service may be possible — ask admin.";
    const areas = settings.business_service_areas || "All of Singapore — HDB, condo, landed, commercial.";
    const policyBlock = `Payment: ${depositPct}% deposit to confirm booking; balance on completion. PayNow / bank transfer / card.\nResponse time: ${sla}.\nUrgent jobs: ${urgent}\nService areas: ${areas}`;

    return { faqBlock, hoursBlock, policyBlock };
  } catch {
    return { faqBlock: FAQ_KNOWLEDGE, hoursBlock: "Weekdays & weekends, 9am–6pm.", policyBlock: "50% deposit required. PayNow / bank transfer / card." };
  }
}


/**
 * Send case-closed notifications to the customer via the best available channel.
 * Sends: (1) a case-closed receipt email/WhatsApp and (2) a Google review request via WhatsApp.
 * Called from: Stripe final-payment webhook, manual admin close, and updateQuotePayment final path.
 */
async function sendCaseClosedNotifications(quote: any): Promise<void> {
  if (!quote?.customer) return;
  const name = quote.customer.name || "there";
  const ref  = quote.referenceNo;

  // ── 0. Fetch review URL once ──────────────────────────────────────────────
  let reviewUrl: string | undefined;
  try {
    const [rs] = await db.select().from(appSettings).where(eq(appSettings.key, "google_review_url"));
    reviewUrl = rs?.value || undefined;
  } catch {}

  // ── 1. Case-closed receipt (email → WhatsApp fallback) ───────────────────
  const hasRealEmail = quote.customer.email &&
    !quote.customer.email.endsWith("@tmginstall.com") &&
    quote.customer.email.includes("@");

  let closedViaMail = false;
  if (hasRealEmail) {
    closedViaMail = await sendEmail({
      to: quote.customer.email,
      subject: `[${ref}] Payment Received — Case Closed`,
      html: caseClosedEmail(quote, reviewUrl),
    });
    if (closedViaMail) console.log(`[Closed] Receipt email → ${quote.customer.email} for ${ref}`);
    else               console.error(`[Closed] Receipt email FAILED for ${ref}`);
  }

  const rawWaClosedPhone = quote.customerWhatsappPhone || quote.customer?.phone;
  const waPhone = rawWaClosedPhone ? normalizeSGPhone(rawWaClosedPhone) : "";
  if (!closedViaMail && waPhone) {
    const total    = Number(quote.total || 0).toFixed(2);
    const closeMsg =
      `✅ *Case ${ref} — Fully Closed!*\n\n` +
      `Hi ${name}! Your final payment has been received. Thank you for choosing *TMG Install*.\n\n` +
      `*Total paid: $${total}*\n\n` +
      `We hope you're happy with the result. Feel free to reach out anytime for future jobs. 😊`;
    const waSent = await sendWhatsAppMessage(waPhone, closeMsg).catch(() => false);
    console.log(waSent
      ? `[Closed] WhatsApp receipt → +${waPhone} for ${ref}`
      : `[Closed] WhatsApp receipt FAILED for ${ref}`);
  }

  // ── 2. Google review request via WhatsApp (if URL configured) ────────────
  // Default behaviour: send the review ask immediately at case close so it
  // actually goes out for customers who paid without ever replying to the
  // rating prompt (e.g. customers who only call us — their WA window may
  // already be open from earlier in the job, or the message will at least
  // be queued for as soon as they reply). Admins who specifically want the
  // older "only ask after a 4+★ rating" behaviour can flip the
  // `ai_review_after_rating_only` flag ON in Settings.
  let reviewAfterRatingOnly = false;
  try {
    const [rrFlag] = await db.select().from(aiFeatureFlags)
      .where(eq(aiFeatureFlags.key, "ai_review_after_rating_only")).limit(1);
    if ((rrFlag as any)?.value === true) reviewAfterRatingOnly = true;
  } catch {}

  if (waPhone && reviewUrl && !reviewAfterRatingOnly) {
    try {
      const alreadySent = (quote.updates ?? []).some((u: any) => u.statusChange === "review_requested");
      if (!alreadySent) {
        const reviewMsg =
          `⭐ *Quick favour, ${name}!*\n\n` +
          `We'd love to hear how your installation went. A quick Google review goes a long way for a small local business:\n\n` +
          `${reviewUrl}\n\n` +
          `_Thank you so much — it really means a lot to the team!_ 🙏`;
        const sent = await sendWhatsAppMessage(waPhone, reviewMsg).catch(() => false);
        if (sent) {
          await storage.addJobUpdate({
            quoteId: quote.id,
            statusChange: "review_requested",
            actorType: "system",
            note: "Google review request sent via WhatsApp (on case close)",
          });
          console.log(`[Closed] Review request → +${waPhone} for ${ref}`);
        } else {
          console.error(`[Closed] Review request WhatsApp FAILED for ${ref}`);
        }
      }
    } catch (e) {
      console.error(`[Closed] Review request error for ${ref}:`, e);
    }
  }

  // ── 3. Internal 1-5 rating prompt (gated by ai_customer_feedback_loop_enabled) ─
  // We send a quick numeric prompt and store a `pending` row in
  // customer_ratings. The WhatsApp agent's rating-capture path will
  // record the reply and join it back to the lead score for tuning.
  if (waPhone) {
    try {
      const [flagRow] = await db.select().from(aiFeatureFlags)
        .where(eq(aiFeatureFlags.key, "ai_customer_feedback_loop_enabled")).limit(1);
      const flagOn = (flagRow as any)?.value === true;
      if (flagOn) {
        // Avoid duplicate prompt for the same quote
        const existing = await db.select({ id: customerRatings.id }).from(customerRatings)
          .where(and(eq(customerRatings.phone, waPhone), eq(customerRatings.quoteId, quote.id)))
          .limit(1);
        if (existing.length === 0) {
          const ratingMsg =
            `One last quick favour, ${name} 🙏\n\n` +
            `How would you rate the install on a scale of *1 to 5*?\n` +
            `Just reply with a single number — it really helps us improve.`;
          const sent = await sendWhatsAppMessage(waPhone, ratingMsg).catch(() => false);
          if (sent) {
            await db.insert(customerRatings).values({
              quoteId: quote.id,
              phone: waPhone,
              source: "whatsapp",
              status: "pending",
            } as any);
            console.log(`[Closed] Rating prompt → +${waPhone} for ${ref}`);
          }
        }
      }
    } catch (e) {
      console.error(`[Closed] Rating prompt error for ${ref}:`, e);
    }
  }
}


/**
 * Shared furniture identification guide injected into all vision prompts.
 * Prevents common misidentification errors (e.g. chest of drawers → "desk").
 */
const FURNITURE_VISION_GUIDE = `
CRITICAL IDENTIFICATION RULES — read before answering:

RESIDENTIAL FURNITURE:

1. CHEST OF DRAWERS / DRESSER: An upright storage unit with MULTIPLE FULL-WIDTH DRAWERS stacked in rows (typically 3–8 drawers). NO doors. Usually 50–110cm wide, 60–130cm tall. The drawers are the PRIMARY visual feature. Do NOT call this a desk, table, or cabinet. Names: "chest of drawers", "dresser", "6-drawer dresser", etc.

2. WARDROBE / CLOSET: Tall cabinet (typically 180–240cm) with HINGED or SLIDING DOORS. Contains hanging space for clothes. May or may not have drawers at the bottom. Names: "wardrobe", "IKEA PAX wardrobe", "2-door wardrobe", etc.

3. DESK / WORK TABLE: Has a FLAT HORIZONTAL WORK SURFACE at roughly sitting height (~75cm), designed for working at while seated. Legs are clearly visible. The surface area is the dominant feature. A small side drawer is possible but NOT the primary feature. Do NOT call a chest of drawers a desk.

4. DINING TABLE / COFFEE TABLE: Flat surface designed for eating (dining) or as a low surface (coffee table, ~40cm tall).

5. BED FRAME: Has a headboard and/or footboard. Holds a mattress. Named by mattress size: single, super single, queen, king.

6. BOOKSHELF / SHELVING: Upright unit with OPEN SHELVES (no drawers, no doors). For storing books/items.

6a. STORAGE CABINET VARIANTS (very important — these four look similar but have different prices, so pick the right one based on doors vs drawers vs height):

   • SWING DOOR CABINET ("Swing Door Cabinet"): Standard cabinet (waist-to-chest height, typically 80–150cm tall) with 1–4 HINGED DOORS on the front and NO visible drawers. Behind the doors are shelves or hanging space. Common as sideboards, buffet cabinets, low storage units. Width 60–180cm.

   • DRAWER CHEST 5+ DRAWERS ("Drawer Chest (5+ drawers)"): Tall narrow upright unit where the ENTIRE front face is stacked drawers — at least 5 drawers visible, often 6–8. NO doors at all. Drawers run full-width. Typical IKEA HEMNES 8-drawer or MALM 6-drawer dresser. If fewer than 5 drawers visible, use the regular "Chest of Drawers" / dresser name instead.

   • TALL SHOE CABINET 5+ TIERS ("Tall Shoe Cabinet (5+ tiers)"): Tall narrow unit (typically 150–220cm tall, only 25–40cm DEEP — shallow because it's just shoe depth) with multiple FLIP-DOWN or TILT-OUT shoe compartments stacked vertically — 5 or more tiers. Each tier has a flap-style door that tilts forward to reveal slanted shoe shelving inside. Telltale signs: very shallow depth, slim profile, often placed in entryway/foyer, the flap-doors when closed look like horizontal slabs stacked one on top of another. IKEA TRONES or STÄLL style. Do NOT confuse with a regular open shoe rack (open shelves, no flaps = "Shoe Rack").

   • COMBO CABINET DRAWERS + SWING DOORS ("Combo Cabinet (Drawers + Swing Doors)"): A SINGLE unit that visibly mixes BOTH HINGED DOORS and DRAWERS on the same piece — for example a sideboard with 2 doors on the bottom and a row of drawers above, or a tall storage cabinet where the top half is doors and the bottom half is drawers, or a TV-style console with doors on the sides and drawers in the middle. The defining feature is that you can clearly see at least one swing door AND at least one drawer on the same unit. This is the most complex storage item to install/dismantle, so pick it whenever you see this mix — do not split it into a separate "swing door cabinet" + "drawer chest".

7. SOFA / COUCH: Upholstered seating for multiple people. Named by shape: 2-seater, 3-seater, L-shaped, etc.

8. TV CONSOLE: Low-profile unit (typically 40–60cm tall) designed to hold a television. Usually wider than tall.

9. STANDING DESK (HEIGHT-ADJUSTABLE): Has clearly visible motorized or hand-crank adjustable legs. Look for an electric control panel on the leg, up/down buttons, a digital height display, or a hand crank. These are structural features you will see clearly. If you cannot see any height-adjustment mechanism → it is a REGULAR DESK, not a standing desk.

OFFICE / COMMERCIAL FURNITURE — these are equally valid and very common:

10. OFFICE WORKSTATION / CUBICLE SYSTEM: An office desk (or cluster of desks) integrated with or surrounded by vertical PANEL PARTITIONS that form enclosed personal work areas. The panels are typically fabric-covered or solid, 100–180 cm tall. Common in open-plan offices and business premises. Count each individual seated work area as 1 unit. Name: "office workstation", "cubicle workstation", or "panel workstation". Do NOT return NONE for these — they require professional dismantling, relocation, or installation.

11. OFFICE PARTITION PANEL: Freestanding or linked vertical dividers between workstations. Typically fabric or solid panels 100–180 cm tall. IMPORTANT: If partition panels are attached to or form part of a cubicle workstation system, they are INCLUDED in the workstation count — do NOT list them as a separate item. Only list "office partition panel" as a separate item if the panels are completely standalone with NO desks or workstations present at all.

12. RECEPTION COUNTER / FRONT DESK: A large counter unit typically found at the entrance of an office or building. Often L-shaped or straight with a raised front panel and internal storage or drawers. Name: "reception counter" or "reception desk".

13. OFFICE CHAIR: A chair with wheels (castors) and height-adjustable seat, designed for office desk use. Name: "office chair" or "ergonomic chair". Count each one individually.

14. FILING CABINET: A metal or wood storage unit with 2–5 deep drawers specifically sized for files and documents. Often steel/grey. Name: "filing cabinet". Count individually.

15. LOCKER UNIT: Multiple individual locked compartments stacked in a grid, used for personal storage in offices, gyms, or schools. Name: "locker unit" or "office locker".

16. CONFERENCE TABLE: A large table designed for group meetings. Usually rectangular or boat-shaped, 200–600 cm long, seats multiple people. Name: "conference table".

17. CREDENZA / SIDEBOARD (OFFICE): A long low storage unit (typically 40–60 cm tall, 120–240 cm wide) placed behind a desk or along an office wall. Has doors and/or drawers. Name: "office credenza" or "sideboard".

SPECIALTY / ARCHITECTURAL OFFICE ITEMS — VERY IMPORTANT, do not miss these:

18. PRIVACY POD / ACOUSTIC PHONE BOOTH (1-person): A small self-contained enclosed or semi-enclosed cabin designed for ONE person to make private calls or do focused work. Usually has: a door or open front, glass panels, acoustic interior lining, a small built-in desk, and ventilation. Looks like a tiny room or capsule placed inside an office. Typically 100–140cm wide × 100–140cm deep × 220–240cm tall. Brands: Framery O, Framery One, Zenbooth Solo, Meavo, Hushoffice, Kolo, SnapCab. THIS IS NOT a wardrobe, not a booth stall, not a locker. Name: "solo phone booth". CRITICAL: if you see a glass/aluminum pod or cabin with one seat inside in an office, call it "solo phone booth" — NOT "installation", NOT "wardrobe", NOT "cabinet".

19. DUO PHONE BOOTH / 2-PERSON ACOUSTIC BOOTH: Like item 18 but larger, fits 2 people side by side. Usually 170–210cm wide. Name: "duo phone booth".

20. MEETING POD / HUDDLE POD (4-person): A larger enclosed or semi-enclosed collaborative workspace pod with seating for 4 people around a small table. Clearly bigger than a solo phone booth — often 200–280cm wide. Name: "meeting pod".

21. MEETING ROOM POD (6–8 person): A large enclosed modular meeting room or conference pod, typically glass-walled, housing 6–8 people. Often resembles a small glass-box meeting room freestanding on the office floor. Name: "meeting room pod" or "large meeting pod".

22. STANDING KIOSK / MINI POD: A narrow tall freestanding display stand or single-person standing workstation pod. No seating. Name: "standing kiosk" or "mini pod".

23. FREESTANDING ACOUSTIC BOOTH: A semi-open acoustic booth (may not have a door) designed for privacy without full enclosure. Often fabric or felt-panelled. Fits 1–2 people. Name: "freestanding acoustic booth".

Common mistakes to AVOID:
- A unit with MANY DRAWERS and NO doors = chest of drawers (NOT a desk)
- A tall unit with DOORS = wardrobe (NOT a cabinet or cupboard unless clearly office storage)
- A unit with a FLAT TOP and LEGS at sitting height = desk/table (NOT storage)
- A desk with a FABRIC PANEL, MODESTY SCREEN, or PRIVACY SCREEN attached to the front = REGULAR DESK (e.g. "L-Shaped Executive Desk"). A fabric panel is decorative/privacy trim, NOT a standing mechanism. Do NOT classify as "standing desk" just because a panel is present.
- Only call something a "standing desk" if you can clearly see electric controls, a height display, a hand crank, or visibly adjustable leg height.
- OFFICE PHOTOS: An open-plan office with cubicle desks and partition panels = office workstations + partition panels. DO NOT return NONE just because it is a commercial/office environment. These items are regularly installed, dismantled, and relocated by furniture companies.
- A GLASS/ALUMINUM POD OR CABIN with one or two seats inside = "solo phone booth" or "duo phone booth" — NOT "installation", NOT "cabinet", NOT "wardrobe". These are specialty items that need professional installation.
`;

interface ScannedFurnitureItem { name: string; count: number; }

/**
 * Comprehensive photo scan: returns ALL furniture types with per-type counts.
 * Used by every WhatsApp photo handling path to ensure quantity accuracy.
 */
async function scanFurnitureInPhoto(mimeType: string, base64: string): Promise<ScannedFurnitureItem[] | null> {
  try {
    const scanRes = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [{
        role: "system",
        content: `You are an expert furniture identifier for TMG Install, a Singapore professional furniture installation company. Examine the photo carefully.

COUNTING RULES — critical for accurate pricing:
- Count EACH individual unit separately. Example: 6 separate workstation cubicles = count 6 (NOT 1)
- Group the same type together: all office workstations = one entry, count = 6
- OFFICE WORKSTATIONS: The partition panels are PART OF the workstation unit — do NOT list partition panels as a separate item when workstations are present. Count only the number of individual seated work areas (desks/workstations). Example: an office with 6 cubicles = {"name": "office workstation", "count": 6} — no separate partition panel entry.
- Only list "office partition panel" as a separate item if you see STANDALONE divider panels with NO desks attached to them at all.
- Office chairs: count each chair individually
- Beds, wardrobes, sofas, filing cabinets: count each unit
- If you can see a cluster and cannot count exactly, give your best reasonable estimate

${FURNITURE_VISION_GUIDE}

Return JSON — one entry per distinct item TYPE, with the count of that type:
{
  "items": [
    {"name": "office workstation", "count": 6},
    {"name": "office chair", "count": 6}
  ],
  "noItems": false
}

Use descriptive names like: "queen bed frame", "2-door wardrobe", "3-seater sofa", "office workstation", "reception counter", "L-shaped executive desk", "filing cabinet", "conference table", "6-drawer chest of drawers".
Set noItems: true ONLY if absolutely nothing installable is visible (empty room, food, people, vehicles only).`,
      }, {
        role: "user",
        content: [{ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } }] as any,
      }],
    });
    const parsed = JSON.parse(scanRes.choices[0]?.message?.content || "{}");
    if (parsed.noItems || !Array.isArray(parsed.items) || !parsed.items.length) return null;
    return parsed.items.filter((i: any) => i.name && typeof i.count === "number" && i.count > 0);
  } catch {
    return null;
  }
}

/** Build a short display label from a scanned items list. e.g. "6× office workstations + 12 more items" */
function buildScanDisplayLabel(items: ScannedFurnitureItem[]): string {
  if (!items.length) return "furniture items";
  const primary = items[0];
  const primaryLabel = primary.count > 1 ? `${primary.count}× ${primary.name}` : primary.name;
  if (items.length === 1) return primaryLabel;
  const extraCount = items.slice(1).reduce((s, i) => s + i.count, 0);
  return `${primaryLabel} + ${extraCount} more item${extraCount !== 1 ? "s" : ""}`;
}

/** Build a prefilledItems bullet string from scanned items + service label. */
function buildPrefilledItems(items: ScannedFurnitureItem[], serviceLabel: string): string {
  return items.map(i => `• ${i.count} ${i.name} (${serviceLabel})`).join("\n");
}

/** Build a collectedItems text suitable for buildJobEstimateMessage from scanned items + service. */
function buildEstimateText(items: ScannedFurnitureItem[], serviceLabel: string): string {
  return items.map(i => `${i.count} ${i.name} ${serviceLabel}`).join(", ");
}

/**
 * Multi-photo batch collector.
 *
 * WhatsApp fires one separate webhook event per photo when a user sends
 * multiple photos at once. Photos in the same "group send" may arrive with
 * the caption attached to only one event (and empty on the rest), making
 * caption-based dedup unreliable. We solve this properly by buffering ALL
 * images from the same phone for PHOTO_BATCH_DELAY_MS, then scanning all
 * of them in one pass and sending a single combined estimate.
 *
 * Only applies to initial-state conversations (no session / awaiting_name /
 * pricing_shown). Deep booking-flow states (awaiting_floor, awaiting_date,
 * etc.) pass through immediately as usual.
 */
interface PhotoBatch {
  imageIds: string[];  // WhatsApp media IDs collected so far
  caption: string;     // Best caption seen — first non-empty caption wins
  timer: ReturnType<typeof setTimeout> | null;
}

const pendingPhotoBatches = new Map<string, PhotoBatch>();
const PHOTO_BATCH_DELAY_MS = 2500; // collect for 2.5 s then flush

function addToPendingPhotoBatch(phone: string, imageId: string, caption: string): void {
  const existing = pendingPhotoBatches.get(phone);
  if (existing) {
    if (existing.timer) clearTimeout(existing.timer);
    existing.imageIds.push(imageId);
    if (!existing.caption && caption) existing.caption = caption; // first non-empty caption wins
    existing.timer = setTimeout(() => flushPhotoBatch(phone), PHOTO_BATCH_DELAY_MS);
  } else {
    const batch: PhotoBatch = { imageIds: [imageId], caption, timer: null };
    batch.timer = setTimeout(() => flushPhotoBatch(phone), PHOTO_BATCH_DELAY_MS);
    pendingPhotoBatches.set(phone, batch);
  }
}

async function flushPhotoBatch(phone: string): Promise<void> {
  const batch = pendingPhotoBatches.get(phone);
  if (!batch) return;
  pendingPhotoBatches.delete(phone);

  console.log(`[WhatsApp] Flushing photo batch for ${phone}: ${batch.imageIds.length} photo(s), caption="${batch.caption.slice(0, 60)}"`);

  // Load fresh session at flush time
  const session = await storage.getWhatsAppSession(phone);
  if (session?.botPaused) return; // admin is handling this conversation

  // Detect service from the best caption we collected
  // Use internal catalog types (relocate/dismantle/dispose/install) — NOT display labels
  const captionLower = batch.caption.toLowerCase();
  let service = "install"; // default (internal type)
  if (/dismantle.{0,20}reloc|reloc.{0,20}dismantle|move.*dismantle|shift.*dismantle/.test(captionLower)) service = "relocate";
  else if (/relocat|move|shift|transfer/.test(captionLower)) service = "relocate";
  else if (/dismantle|dismant|take apart|remove/.test(captionLower)) service = "dismantle";
  else if (/dispos|haul|throw|throw away/.test(captionLower)) service = "dispose";
  else if (/install|assembly|assemble|set up|put up/.test(captionLower)) service = "install";

  // Scan ALL photos and collect items
  const allItems: ScannedFurnitureItem[] = [];
  for (const imageId of batch.imageIds) {
    try {
      const media = await downloadWhatsAppMedia(imageId);
      if (media) {
        const items = await scanFurnitureInPhoto(media.mimeType, media.base64);
        if (items) allItems.push(...items);
      }
    } catch { /* WhatsApp token expired or network issue — skip this photo */ }
  }

  // Merge duplicate item names (sum their counts)
  const merged: ScannedFurnitureItem[] = [];
  for (const item of allItems) {
    const existing = merged.find(m => m.name.toLowerCase() === item.name.toLowerCase());
    if (existing) {
      existing.count += item.count;
    } else {
      merged.push({ ...item });
    }
  }

  const photoWord = batch.imageIds.length > 1 ? `your ${batch.imageIds.length} photos` : "your photo";

  if (merged.length === 0) {
    // No items detected — ask for description
    const askMsg =
      `Spotted your photo${batch.imageIds.length > 1 ? "s" : ""}! 📸 I couldn't quite make out the furniture from the image${batch.imageIds.length > 1 ? "s" : ""}. ` +
      `Could you describe what items you need help with?\n\n` +
      `_e.g. "2-door wardrobe — installation" or "queen bed frame — dismantling"_`;
    await sendBotMessage(phone, askMsg);
    if (!session) {
      await storage.upsertWhatsAppSession(phone, {
        state: "awaiting_name",
        collectedName: null, collectedAddress: null, collectedItems: null,
        previousItems: null, preferredDate: null, preferredDateIso: null,
        preferredTimeWindow: null, isRelocation: false, collectedToAddress: null, distanceKm: null,
        conversationHistory: null,
      });
    }
    return;
  }

  // Build combined display label, estimate text, and price message
  const displayLabel = buildScanDisplayLabel(merged);
  const estimateText  = buildEstimateText(merged, service);
  const isReloc = service.includes("reloc");
  const fakeSession = {
    collectedItems: estimateText,
    floorLevel: null as number | null,
    hasLift: null as boolean | null,
    accessDifficulty: null as string | null,
    isRelocation: isReloc,
    distanceKm: null as string | null,
  };
  const priceMsg = await buildJobEstimateMessage(fakeSession as any)
    || await smartPricingLookup(merged[0].name);

  let responseMsg: string;
  if (priceMsg) {
    responseMsg =
      `📸 I can see *${displayLabel}* across ${photoWord}!\n\n` +
      `${priceMsg}\n\n` +
      `\n\n` +
      `Would you like a full personalised quote? What's your *full name*? 😊`;
  } else {
    responseMsg =
      `📸 I can see *${displayLabel}* across ${photoWord}! ` +
      `Let me put together a personalised quote for you 😊\n\nWhat's your *full name*?`;
  }

  await sendBotMessage(phone, responseMsg);

  // Save session with pre-filled items (go straight to awaiting_name)
  const prefilledItems = buildPrefilledItems(merged, service);
  await storage.upsertWhatsAppSession(phone, {
    state: "awaiting_name",
    collectedName: null,
    collectedAddress: null,
    collectedItems: prefilledItems,
    previousItems: "photo_detected",
    preferredDate: null, preferredDateIso: null, preferredTimeWindow: null,
    isRelocation: isReloc,
    collectedToAddress: null, distanceKm: null, conversationHistory: null,
  });

  saveHistory(phone, [], `[${batch.imageIds.length} photo(s): ${displayLabel}]`, responseMsg);
}

/**
 * Generate a natural, conversational reply using GPT-4o-mini.
 * Acknowledges what the customer just said, then leads into the next structured step.
 * Falls back to the plain nextStepPrompt if GPT is unavailable.
 */
async function craftReply(
  customerMsg: string,
  nextStepPrompt: string,
  ctx: { name?: string | null; history?: HistoryEntry[] }
): Promise<string> {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 60,
      messages: [
        {
          role: "system",
          content:
            `${COORDINATOR_PERSONA}\n\n` +
            `Write ONE short, warm acknowledgment sentence (8–15 words) that references what the customer just said.\n\n` +
            `STRICT RULES — violating any rule makes the output unusable:\n` +
            `- Output EXACTLY ONE sentence. No follow-up questions. No second sentence. Nothing after the period.\n` +
            `- Do NOT start with "Great!", "Perfect!", or "Awesome!"\n` +
            `- Do NOT ask about furniture, names, addresses, services, or anything else\n` +
            `- Do NOT add emojis — the calling code will handle formatting\n` +
            `- Customer name: ${ctx.name ? `"${ctx.name}" — use it if it sounds natural` : 'not yet known — do NOT ask for it'}\n` +
            `- Examples of CORRECT output: "Thanks, got that!" / "Noted, let me sort that out for you." / "Appreciate you confirming that."`,
        },
        ...(ctx.history ? historyMessages(ctx.history, 2) : []),
        { role: "user", content: customerMsg },
      ],
    });
    const ack = res.choices[0]?.message?.content?.trim();
    if (ack && ack.length > 3) {
      return `${ack}\n\n${nextStepPrompt}`;
    }
    return nextStepPrompt;
  } catch {
    return nextStepPrompt;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// UNIFIED CONVERSATION ORCHESTRATION
// Replaces the rigid per-state machine with a single GPT-driven engine that
// reads/writes rich structured state across every turn.
// ──────────────────────────────────────────────────────────────────────────────

const DEFAULT_STRUCTURED_STATE = {
  items: null as string | null,
  from_address: null as string | null,
  to_address: null as string | null,
  floor_from: null as number | null,
  lift_from: null as boolean | null,
  floor_to: null as number | null,
  lift_to: null as boolean | null,
  access_difficulty: null as string | null,
  preferred_date: null as string | null,
  preferred_date_iso: null as string | null,
  preferred_time_window: null as string | null,
  customer_name: null as string | null,
  customer_email: null as string | null,
  special_remarks: null as string | null,
  service_scope: null as string | null,
  is_relocation: false,
  distance_km: null as number | null,
  relocation_mode: null as string | null, // "carry" = carry-only (no dismantle/reinstall), "full" = full D&R service
  promo_code: null as string | null,       // applied promo code (e.g. "TMG50"); null = not asked or skipped
  promo_discount: null as number | null,   // validated discount amount in SGD
  promo_asked: false,                      // true once the promo step has been presented
};

function parseStructuredState(session: any): typeof DEFAULT_STRUCTURED_STATE {
  if (!session) return { ...DEFAULT_STRUCTURED_STATE };
  if (session.structuredState) {
    try {
      return { ...DEFAULT_STRUCTURED_STATE, ...JSON.parse(session.structuredState) };
    } catch {}
  }
  return {
    ...DEFAULT_STRUCTURED_STATE,
    items: (session.collectedItems && session.collectedItems !== "__scanning__") ? session.collectedItems : null,
    from_address: session.collectedAddress || null,
    to_address: session.collectedToAddress || null,
    floor_from: (session.floorLevel && session.floorLevel > 0) ? session.floorLevel : null,
    lift_from: session.hasLift != null ? session.hasLift : null,
    access_difficulty: session.accessDifficulty || null,
    preferred_date: session.preferredDate || null,
    preferred_date_iso: session.preferredDateIso || null,
    preferred_time_window: session.preferredTimeWindow || null,
    customer_name: session.collectedName || null,
    customer_email: session.collectedEmail || null,
    special_remarks: session.specialRemarks || null,
    is_relocation: !!session.isRelocation,
    distance_km: session.distanceKm ? parseFloat(String(session.distanceKm)) : null,
    service_scope: session.isRelocation ? "relocate" : null,
  };
}

function syncStateToFlatFields(st: typeof DEFAULT_STRUCTURED_STATE): Record<string, unknown> {
  const f: Record<string, unknown> = {};
  if (st.items) f.collectedItems = st.items;
  if (st.from_address) f.collectedAddress = st.from_address;
  if (st.to_address) f.collectedToAddress = st.to_address;
  if (st.floor_from != null) f.floorLevel = st.floor_from;
  if (st.lift_from != null) f.hasLift = st.lift_from;
  if (st.access_difficulty) f.accessDifficulty = st.access_difficulty;
  if (st.preferred_date) f.preferredDate = st.preferred_date;
  if (st.preferred_date_iso) f.preferredDateIso = st.preferred_date_iso;
  if (st.preferred_time_window) f.preferredTimeWindow = st.preferred_time_window;
  if (st.customer_name) f.collectedName = st.customer_name;
  if (st.customer_email) f.collectedEmail = st.customer_email;
  if (st.special_remarks) f.specialRemarks = st.special_remarks;
  f.isRelocation = st.is_relocation;
  if (st.distance_km != null) f.distanceKm = String(st.distance_km);
  // promo fields are kept only in structuredState JSON, not flat session columns
  return f;
}

async function orchestrateConversation(params: {
  from: string;
  session: any;
  text: string;
  msgType: string;
  msg: Record<string, any>;
  conversationHistory: HistoryEntry[];
  preloadedPhotoItems?: string | null;
}): Promise<void> {
  const { from, session, text, msgType, msg, conversationHistory } = params;
  let photoItemsText = params.preloadedPhotoItems ?? null;
  let richState = parseStructuredState(session);

  // ── PHOTO HANDLING ───────────────────────────────────────────────────────────
  if (msgType === "image" && msg.image?.id && !photoItemsText) {
    const currentItems = (await storage.getWhatsAppSession(from))?.collectedItems ?? "";
    if (currentItems.startsWith("__scanning__")) {
      await storage.appendPhotoToScanQueue(from, msg.image.id);
      return;
    }
    const isPrimaryScanner = await storage.claimPhotoScan(from, msg.image.id);
    if (!isPrimaryScanner) {
      await storage.appendPhotoToScanQueue(from, msg.image.id);
      return;
    }

    await sendBotMessage(from, `Got it! Give me a moment to scan your photo(s)... 🔍`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    const latestSess = await storage.getWhatsAppSession(from);
    const queueStr = latestSess?.collectedItems ?? `__scanning__:${msg.image.id}`;
    const allIds = queueStr.startsWith("__scanning__:")
      ? [...new Set(queueStr.slice("__scanning__:".length).split(",").filter(Boolean))]
      : [msg.image.id];

    const scanResults = await Promise.all(allIds.map(async (id: string) => {
      const media = await downloadWhatsAppMedia(id);
      if (!media) return null;
      try {
        const vRes = await openai.chat.completions.create({
          model: "gpt-4o", max_tokens: 800,
          messages: [
            { role: "system", content: `You are an expert furniture identification assistant for TMG Install (Singapore). Identify ALL furniture items visible that need professional installation, assembly, dismantling, or relocation. COUNT each piece. Identify brand/model if visible (IKEA PAX, IKEA MALM, etc.). DO NOT include TVs, electronics, or small accessories. Format: one bullet per line "• 1 queen bed frame". If no installable furniture visible: respond only with NO_FURNITURE.\n\n${FURNITURE_VISION_GUIDE}` },
            { role: "user", content: [{ type: "text", text: "Identify all furniture items needing professional service." }, { type: "image_url", image_url: { url: `data:${media.mimeType};base64,${media.base64}`, detail: "high" } }] as any },
          ],
        });
        const raw = (vRes.choices[0]?.message?.content || "").trim();
        return (!raw || raw.includes("NO_FURNITURE")) ? null : raw;
      } catch { return null; }
    }));

    const validResults = scanResults.filter((r): r is string => !!r);
    if (validResults.length === 0) {
      await storage.upsertWhatsAppSession(from, { collectedItems: richState.items || null, structuredState: JSON.stringify(richState) });
      await sendBotMessage(from, `Hmm, I couldn't spot any furniture in ${allIds.length > 1 ? "those photos" : "that photo"}. No worries — just *type out the items* you need help with, like:\n• 1 king bed frame\n• 3-door wardrobe\n• Dining table + 4 chairs`);
      return;
    }

    let allDetected: string;
    if (validResults.length === 1) {
      allDetected = validResults[0].split("\n").map((l: string) => l.trim()).filter(Boolean).map((l: string) => l.startsWith("•") ? l : `• ${l}`).join("\n");
    } else {
      const mergeRes = await openai.chat.completions.create({
        model: "gpt-4o", max_tokens: 600,
        messages: [{ role: "system", content: `Merge ${validResults.length} furniture lists from different photos into ONE complete list without losing items. Deduplicate only when the SAME item clearly appears in MULTIPLE photos of the SAME room. Format: one bullet per line "•".\n\n${validResults.map((r, i) => `[Photo ${i + 1}]\n${r}`).join("\n\n")}` }],
      });
      allDetected = (mergeRes.choices[0]?.message?.content || "").trim().split("\n").map((l: string) => l.trim()).filter(Boolean).map((l: string) => l.startsWith("•") ? l : `• ${l}`).join("\n");
    }
    photoItemsText = allDetected;

    if (richState.items) {
      const existingLines = richState.items.split("\n").filter(Boolean);
      const newLines = allDetected.split("\n").filter(Boolean);
      const mergedLines = [...existingLines];
      for (const line of newLines) {
        const key = line.toLowerCase().replace(/[•\-*]\s*/, "").trim();
        if (!existingLines.some(el => { const ek = el.toLowerCase().replace(/[•\-*]\s*/, "").trim(); return ek === key || ek.includes(key) || key.includes(ek); })) {
          mergedLines.push(line);
        }
      }
      richState = { ...richState, items: mergedLines.join("\n") };
    } else {
      richState = { ...richState, items: allDetected };
    }

    const freshSess = await storage.getWhatsAppSession(from);
    if (freshSess) {
      richState = {
        ...richState,
        from_address: richState.from_address || freshSess.collectedAddress || null,
        to_address: richState.to_address || freshSess.collectedToAddress || null,
        customer_name: richState.customer_name || freshSess.collectedName || null,
      };
    }
  }

  // ── GPT ORCHESTRATION ────────────────────────────────────────────────────────
  const historyContext = conversationHistory.slice(-6).map((h: HistoryEntry) =>
    `${h.role === "user" ? "Customer" : "Bot"}: ${h.content}`).join("\n");
  const today = new Date();
  const todayStr = today.toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  let orchResult: { updatedState: any; reply: string; transition_to_confirmation: boolean };
  try {
    const orchRes = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1400,
      response_format: { type: "json_object" },
      messages: [{
        role: "system",
        content: `You are the WhatsApp coordinator for TMG Install — a professional furniture installation company in Singapore. Collect all details needed for a furniture job quote.

TODAY: ${todayStr}

CURRENT JOB STATE (trust this completely — NEVER re-ask for anything already filled):
${JSON.stringify(richState, null, 2)}

${photoItemsText ? `\nPHOTO SCAN: Customer sent a photo. Detected items merged into state.items above. Acknowledge the scan and move to the next missing field.\n` : ""}

SERVICES:
- install: furniture assembly/installation
- dismantle: take apart only, no move
- relocate: move furniture from one address to another (is_relocation=true). Two modes:
    • relocation_mode="carry"  — just carry and move as-is; no dismantle/reinstall (e.g. sofa, table, bed that doesn't need assembly)
    • relocation_mode="full"   — full service: dismantle at origin + transport + reassemble at destination (e.g. wardrobe, bed frame with bolts, shelving)
- dispose: haul away and dispose
- dismantle_dispose: dismantle + dispose bundle
- mixed: multiple service types in one job

STRICT COLLECTION ORDER — follow this exactly, skip any step whose field is already non-null in state:
STEP 1 → service_scope: If NOT already set, ask or extract from what they said. If customer mentions relocation/moving, set service_scope="relocate" and is_relocation=true. If their message makes the service clear, capture it silently.
STEP 2 → customer_name: Ask their full name for the quote.
STEP 3 → from_address: Job address (origin for relocations). "What's the address? Include block/unit."
STEP 4 → to_address: ONLY if is_relocation=true — ask destination address. Otherwise skip.
STEP 5 → items: Full furniture list with service per item. e.g. "• 1 wall mirror (relocate)\n• 1 shoe cabinet (install)"
STEP 5.5 → relocation_mode: ONLY if is_relocation=true AND relocation_mode is null. Ask clearly:
    "Does any of the furniture need to be *dismantled and reassembled* at the new location, or will everything be *carried as-is*?
    • *Full service* — dismantle, move, and reinstall (wardrobes, bed frames, shelving)
    • *Carry only* — move as-is, no assembly needed (sofas, dining tables, mattresses)"
    Set relocation_mode="full" if customer says full/dismantle/reassemble/reinstall/yes dismantle.
    Set relocation_mode="carry" if customer says carry/no assembly/as-is/just move/just carry.
    If the items make it obvious (sofa, table → usually carry; wardrobe, bed frame → usually full), you may suggest the likely option and confirm: "For a sofa, carry only is usually sufficient — does that sound right? 😊"
STEP 6 → floor_from + lift_from + access_difficulty: Ask "Which floor is the unit, and is there a lift?" — capture floor number and yes/no lift. Then ask access: "How easy is access? Easy / Moderate / Difficult?"
STEP 7 → preferred_date + preferred_time_window: "When would you prefer? We have morning (9am–12pm) or afternoon (1pm–5pm) slots." If "flexible"/"anytime" on the DATE → preferred_date="Flexible", preferred_date_iso=null. But STILL ask and capture their preferred time window (morning or afternoon) — even flexible customers should pick a slot. If they truly don't mind either slot, then preferred_time_window=null. If they say "afternoon"/"1-5pm"/"pm" → preferred_time_window="13:00-17:00". If they say "morning"/"9am"/"am" → preferred_time_window="09:00-12:00".
STEP 8 → special_remarks: Always ask: "Any special notes for our team? E.g. wall mounting needed, drilling, fragile items, parking notes. Reply 'none' to skip." If customer says 'none', 'no', 'skip', or 'nothing' → set special_remarks=null. Otherwise store verbatim. NEVER skip asking this step.
STEP 9 → customer_email: "Your email address for the quote confirmation? (Reply 'skip' if you prefer not to.)" If "skip" → null.
STEP 10 → promo_code (ONLY if promo_asked=false): Ask exactly: "Do you have a promo code? Reply with your code or type *none* to skip." Set promo_asked=true. If customer replies 'none'/'no'/'skip' → set promo_code=null. Otherwise store their code uppercased exactly as typed. NOTE: promo_discount will be set by the server after validation — leave it null in state. If promo_asked is already true, skip this step regardless of whether promo_code is set.

CONTEXT HANDLING:
- If the conversation history shows a greeting/FAQ/pricing exchange just happened and the customer is now saying what they need (e.g. "I need relocation", "Yes I want a quote"), extract any details from their message and move to the NEXT missing step — do NOT re-greet.
- If this is effectively the very start (no history or just a greeting), warmly acknowledge then ask the first missing field.
- The customer's message may contain answers to multiple steps — capture ALL of them and jump to the first gap.

STRICT RULES:
- Ask ONLY ONE question per reply — the next unfilled step
- NEVER re-ask for anything already in state — trust the state completely
- NEVER overwrite a field with null unless customer explicitly removes it
- If a customer answers multiple steps in one message, capture ALL of them and skip to the next gap
- Relocation: from_address and to_address are DIFFERENT addresses — never confuse them
- If customer mentions moving / relocating / shifting, IMMEDIATELY set is_relocation=true and service_scope="relocate"
- If customer says "shift to X", "moving to X", "relocating to X", "new office at X" — the new location is the TO address, not the FROM address
- When correcting: update only the changed field, preserve all others
- Keep tone warm, concise, conversational — 1–3 sentences per reply

COMMERCIAL / B2B PROJECTS:
- If the customer identifies as a company (Pte Ltd, company name, "our office", "our company", "we are relocating our office") — acknowledge the commercial context warmly.
- For large office moves (workstations, office furniture, multiple items implied), ALWAYS ask for the quantity of items before completing the items step. e.g. "How many workstations/items are involved?"
- If items text has generic terms without quantity (e.g. "workstations", "office furniture") — ask for clarification: "Approximately how many workstations/desks will be involved? This helps us give you an accurate quote."
- For commercial relocation projects, the items field should include specific quantities. e.g. "• 20 office workstations (relocate)"
- NEVER assume quantity=1 for commercial/office projects — always confirm the count.

ADDRESS VALIDATION (STEP 3):
- REJECT vague addresses like "here", "there", "this", "same", "home", "office", "my place", "above", "same as before" — do NOT store them. Instead reply: "Could you share the full address? Include the block/unit number so our team can plan the job. 😊"
- A valid address must include a block number, street name, or unit number. A bare word like "Here" is never valid.
- If customer says "same as first quote" or "same address" or references a previous address — ask them to confirm it in full.

FLOOR VALIDATION (STEP 6):
- floor_from must be a NUMBER. If customer says "this", "here", "same", "first", "above" or any non-numeric word for the floor — do NOT store it. Reply: "Which floor number exactly? E.g. 'Floor 5'. 😊"
- If customer describes access instead of floor (e.g. "no steps", "ground level", "easy") when asked for floor — set floor_from=1 if they imply ground floor, otherwise ask for the floor number.

ITEM DESCRIPTION RULES:
- When writing items in the state, use ONLY what the customer described — do NOT add features they didn't mention (e.g., do NOT say "with built-in mirror" if the customer just said "wardrobe").
- Use the customer's exact words: "• 1 wardrobe (dismantle)" not "• 1 wardrobe with built-in mirror (dismantle)".
- Keep item descriptions short and factual.

CONFIRMATION TRIGGER:
When service_scope + customer_name + from_address + items + floor_from + lift_from are ALL non-null (PLUS to_address + relocation_mode if is_relocation=true) AND special_remarks has been asked (may be null if customer replied 'none') AND promo_asked=true, set transition_to_confirmation=true.
preferred_date defaults to "Flexible" if never answered. customer_email may be null. promo_code may be null if customer skipped.

CONVERSATION HISTORY:
${historyContext || "(first exchange)"}

NEW MESSAGE: "${photoItemsText ? `[Photo — ${photoItemsText.split("\n").length} item(s) detected]` : text}"

Return ONLY valid JSON:
{
  "updatedState": {
    "service_scope": "install"/"dismantle"/"relocate"/"dispose"/"dismantle_dispose"/"mixed" or null,
    "customer_name": "string or null",
    "from_address": "string or null",
    "to_address": "string or null",
    "items": "• item (service)\\n• item (service)\\n...",
    "floor_from": number or null,
    "lift_from": true/false or null,
    "floor_to": number or null,
    "lift_to": true/false or null,
    "access_difficulty": "easy"/"medium"/"hard" or null,
    "preferred_date": "e.g. 'Friday 4 Apr' or 'Flexible' or null",
    "preferred_date_iso": "YYYY-MM-DD or null",
    "preferred_time_window": "09:00-12:00"/"13:00-17:00" or null,
    "special_remarks": "verbatim customer text or null",
    "customer_email": "email string or null",
    "is_relocation": true/false,
    "distance_km": number or null,
    "relocation_mode": "carry"/"full" or null,
    "promo_code": "UPPERCASE-CODE or null",
    "promo_discount": null,
    "promo_asked": true/false
  },
  "reply": "your message to the customer",
  "transition_to_confirmation": false
}

WHEN transition_to_confirmation=true, "reply" MUST be this FULL SUMMARY (substitute real values):
"Here's a summary of your request:\n\n🔧 *Service:* [e.g. Relocation — Carry Only / Relocation — Full Service / Installation / Dismantling]\n👤 *Name:* [customer_name]\n📍 *From:* [from_address]\n📍 *To:* [to_address — include ONLY if is_relocation]\n🛋️ *Items:*\n[items bullet list]\n🏢 *Floor:* [floor_from] ([lift_from ? 'with lift' : 'no lift'])\n🚪 *Access:* [Easy / Moderate / Difficult]\n📅 *Requested slot:* [preferred_date or 'Flexible'][' — Morning (9am–12pm)' or ' — Afternoon (1pm–5pm)' if time_window set]\n📝 *Notes:* [special_remarks or 'None']\n📧 *Email:* [customer_email or 'Not provided']\n🏷️ *Promo code:* [promo_code or 'None']\n\nShall I send this to our team? Reply *YES* to submit.\n\n_Need to fix anything? Type *change name*, *change address*, *change items*, *change date*, *change floor*, *change access*, *change remarks*, *change email*, or *change promo*._"`,
      }],
    });
    orchResult = JSON.parse(orchRes.choices[0]?.message?.content || "{}");
  } catch (err) {
    console.error("[WhatsApp] Orchestration GPT error:", err);
    const fallback = photoItemsText
      ? `Here's what I detected from your photo:\n\n${photoItemsText}\n\nDoes this look right? Reply *YES* to confirm or tell me what to add or change.`
      : `Got it! What furniture items do you need help with? 😊\n\n📸 Send a photo and I'll detect them — or type the list:\n• 1 king bed frame (install)\n• 3-door wardrobe (dismantle)`;
    await sendBotMessage(from, fallback);
    return;
  }

  if (!orchResult?.updatedState || !orchResult?.reply) {
    await sendBotMessage(from, `Got it! What furniture do you need help with? 😊`);
    return;
  }

  const newState = { ...richState, ...orchResult.updatedState };
  const flatFields = syncStateToFlatFields(newState);
  const nextWaState = orchResult.transition_to_confirmation ? "awaiting_confirmation" : "collecting";

  await storage.upsertWhatsAppSession(from, {
    ...flatFields,
    state: nextWaState,
    structuredState: JSON.stringify(newState),
    collectedItems: newState.items && !newState.items.startsWith("__scanning__") ? newState.items : (richState.items || null),
  });

  const reply = orchResult.reply;
  await sendBotMessage(from, reply);
  saveHistory(from, conversationHistory,
    photoItemsText ? `[Photo: ${photoItemsText.split("\n").length} items detected]` : text,
    reply);
}

/** Extract any service type already mentioned in conversation history */
function extractServiceFromHistory(history: HistoryEntry[]): string | null {
  const histText = history.map(h => h.content).join(" ").toLowerCase();
  if (/install/.test(histText)) return "installation";
  if (/dismant/.test(histText)) return "dismantling";
  if (/reloc/.test(histText)) return "relocation";
  if (/dispos/.test(histText)) return "disposal";
  return null;
}

/** Detect if the bot is stuck in a loop — same question sent 2+ times recently */
function isBotLooping(history: HistoryEntry[], keyword: string): boolean {
  const recent = history.slice(-8).filter(h => h.role === "assistant");
  return recent.filter(h => h.content.toLowerCase().includes(keyword.toLowerCase())).length >= 2;
}

// ── WhatsApp date-menu helper ─────────────────────────────────────────────────
// Fetches the next available slots and returns both the formatted message text
// and the slot array (so the caller can store/reference them).
async function buildDateMenuMessage(): Promise<{ message: string; slots: { date: string; timeWindow: string; display: string }[] }> {
  const slots = await storage.getNextAvailableSlots(6);
  if (slots.length === 0) {
    return {
      slots,
      message:
        `📅 *When would you like this done?*\n\n` +
        `_Please tell us your preferred date and we'll do our best to accommodate you._\n\n` +
        `Reply *anytime* if you're flexible — our team will contact you to schedule. 😊`,
    };
  }
  const lines = slots.map((s, i) => `${i + 1}. ${s.display}`).join("\n");
  return {
    slots,
    message:
      `📅 *When would you like this done?*\n\nHere are our next available slots:\n\n${lines}\n\n` +
      `Reply with a *number* to choose, or type any other date if you prefer.\n` +
      `Reply *anytime* if you're flexible — we'll schedule you in. 😊`,
  };
}

// ── Firebase Cloud Messaging push notification helper ─────────────────────────
// Uses Firebase Admin SDK (FCM V1 API) — no legacy server key needed.
// Requires FIREBASE_SERVICE_ACCOUNT env var: the full JSON content of your
// Firebase service account key file (from Project Settings → Service accounts →
// Generate new private key).
let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return false;
  try {
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseInitialized = true;
    console.log("[FCM] Firebase Admin initialized ✓");
    return true;
  } catch (e) {
    console.error("[FCM] Failed to initialize Firebase Admin:", e);
    return false;
  }
}

async function sendPushNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  if (tokens.length === 0) return;
  if (!initFirebase()) {
    // Not configured — skip silently
    return;
  }

  const results = await Promise.allSettled(
    tokens.map((token) =>
      admin.messaging().send({
        token,
        notification: { title, body },
        data: data || {},
        android: { priority: "high", notification: { sound: "default" } },
      })
    )
  );

  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[FCM] Push failed for token ${i}:`, r.reason);
    }
  });
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

async function createStripePaymentLink(
  description: string,
  amountSGD: number,
  metadata: Record<string, string>,
  successUrl: string
): Promise<string | null> {
  if (!stripe) return null;
  try {
    // Embed session ID in success URL so the page can verify payment on return
    const successWithSession = successUrl.includes("?")
      ? `${successUrl}&payment_success=1&session_id={CHECKOUT_SESSION_ID}`
      : `${successUrl}?payment_success=1&session_id={CHECKOUT_SESSION_ID}`;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "sgd",
            product_data: { name: description },
            unit_amount: Math.round(amountSGD * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successWithSession,
      cancel_url: successUrl,
      metadata,
    });
    return session.url;
  } catch (err: any) {
    console.error("[Stripe] Payment link creation FAILED:", err?.message || err);
    return null;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── SEO Service Landing Pages (SSR — served before React SPA) ───────────────
  app.get("/services", (_req, res) => res.status(200).set("Content-Type", "text/html").end(servicesHubPage()));
  app.get("/services/ikea-assembly-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(ikeaAssemblyPage()));
  app.get("/services/wardrobe-installation-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(wardrobeInstallationPage()));
  app.get("/services/bed-assembly-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(bedAssemblyPage()));
  app.get("/services/furniture-dismantling-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(furnitureDismantlingPage()));
  app.get("/services/office-furniture-installation-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(officeFurniturePage()));
  app.get("/services/furniture-relocation-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(furnitureRelocationPage()));
  app.get("/services/tv-mounting-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(tvMountingPage()));
  app.get("/services/sofa-assembly-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(sofaAssemblyPage()));
  app.get("/services/mattress-installation-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(mattressInstallationPage()));
  app.get("/services/taobao-furniture-installation-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(taobaoFurnitureInstallationPage()));
  app.get("/services/castlery-furniture-assembly-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(castleryFurnitureAssemblyPage()));
  app.get("/services/hdb-moving-services-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(hdbMovingServicesPage()));
  app.get("/services/condo-moving-services-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(condoMovingServicesPage()));
  app.get("/services/lazada-furniture-installation-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(lazadaFurnitureInstallationPage()));
  app.get("/services/shopee-furniture-installation-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(shopeeFurnitureInstallationPage()));
  app.get("/services/gym-equipment-installation-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(gymEquipmentInstallationPage()));
  app.get("/services/furniture-repair-adjustment-singapore", (_req, res) => res.status(200).set("Content-Type", "text/html").end(furnitureRepairAdjustmentPage()));

  // Dynamic sitemap.xml — auto-generated from SERVICE_PAGES registry
  app.get("/sitemap.xml", (_req, res) => {
    res.status(200)
      .set("Content-Type", "application/xml; charset=utf-8")
      .set("Cache-Control", "public, max-age=3600")
      .end(sitemapXml());
  });

  // -- Stripe Webhook (must be before any body-parsing middleware for this route) --
  app.post("/api/webhooks/stripe", async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe) {
      return res.status(500).json({ message: "Stripe not configured" });
    }

    let event: Stripe.Event;

    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(req.rawBody as Buffer, sig, webhookSecret);
      } catch (err: any) {
        console.error("Stripe webhook signature verification failed:", err.message);
        return res.status(400).json({ message: `Webhook error: ${err.message}` });
      }
    } else {
      // No secret configured — accept without verification (dev only)
      event = req.body as Stripe.Event;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const { quoteId, type } = session.metadata || {};

      if (!quoteId || !type) {
        return res.status(200).json({ received: true });
      }

      const id = parseInt(quoteId);
      const amountPaid = ((session.amount_total ?? 0) / 100).toFixed(2);

      try {
        const quote = await storage.updateQuotePayment(id, type as "deposit" | "final", amountPaid);

        if (!quote || !quote.customer) {
          return res.status(200).json({ received: true });
        }

        if (type === "deposit") {
          const hasRealEmailWh = quote.customer.email &&
            !quote.customer.email.endsWith("@tmginstall.com") &&
            quote.customer.email.includes("@");
          if (hasRealEmailWh) {
            await sendEmail({
              to: quote.customer.email,
              subject: `[${quote.referenceNo}] Deposit Received — Slot Confirmed!`,
              html: depositReceivedEmail(quote),
            });
          }
          console.log(`Stripe webhook: deposit paid for ${quote.referenceNo} (SGD ${amountPaid})`);
          // Send tracker link via WhatsApp (fallback to customer.phone for web-booked)
          const rawTrackPhoneWh = quote.customerWhatsappPhone || quote.customer?.phone;
          const trackPhone = rawTrackPhoneWh ? normalizeSGPhone(rawTrackPhoneWh) : null;
          if (trackPhone) {
            const trackMsg = `✅ *Deposit received — your job is confirmed!*\n\nTrack your installation progress here:\n${APP_URL}/track/${quote.referenceNo}\n\n_We'll be in touch shortly to confirm your schedule._ 👷`;
            await sendWhatsAppMessage(trackPhone, trackMsg).catch(() => {});
          }
        }

        if (type === "final") {
          console.log(`Stripe webhook: final payment for ${quote.referenceNo} (SGD ${amountPaid})`);
          await sendCaseClosedNotifications(quote);
        }
      } catch (err) {
        console.error("Stripe webhook: error processing payment:", err);
      }
    }

    res.status(200).json({ received: true });
  });

  // -- Auth Routes --
  app.post(api.auth.login.path, async (req, res) => {
    let parsed: { username: string; password: string };
    try {
      parsed = api.auth.login.input.parse(req.body);
    } catch {
      return res.status(400).json({ message: "Username and password are required" });
    }
    try {
      const { username, password } = parsed;
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      const bcrypt = await import("bcryptjs");
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      req.session.userId = user.id;
      await new Promise<void>((resolve) => req.session.save(e => {
        if (e) console.error("[session] save error:", e);
        resolve();
      }));
      const { password: _pw, ...safeUser } = user;
      res.json(safeUser);
    } catch (e) {
      console.error("[login] unexpected error:", e);
      res.status(500).json({ message: "Login failed, please try again" });
    }
  });

  app.get(api.auth.me.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ message: "Not logged in" });
    const { password: _pw, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {});
    res.json({ message: "Logged out" });
  });

  // -- Staff Routes --
  app.get(api.staff.list.path, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const staff = await storage.getStaffMembers();
    res.json(staff);
  });

  // Create staff member (admin only)
  app.post("/api/admin/staff", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { username, password, name } = z.object({
        username: z.string().min(2),
        password: z.string().min(6),
        name: z.string().min(2),
      }).parse(req.body);
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ message: "Username already taken" });
      const bcrypt = await import("bcryptjs");
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashed, name, role: 'staff' });
      res.json(user);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Update staff member
  app.patch("/api/admin/staff/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const data = z.object({
        name: z.string().min(2).optional(),
        username: z.string().min(2).optional(),
        password: z.string().min(6).optional(),
        teamId: z.number().nullable().optional(),
        // HR fields
        phone: z.string().optional().nullable(),
        email: z.string().email().optional().nullable(),
        nricFin: z.string().optional().nullable(),
        startDate: z.string().optional().nullable(),
        emergencyName: z.string().optional().nullable(),
        emergencyPhone: z.string().optional().nullable(),
      }).parse(req.body);
      // Check username uniqueness (excluding current user)
      if (data.username) {
        const existing = await storage.getUserByUsername(data.username);
        if (existing && existing.id !== id) return res.status(409).json({ message: "Username already taken" });
      }
      // Hash password if provided
      const bcrypt = await import("bcryptjs");
      const updateData: any = { ...data };
      delete updateData.password;
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      }
      const updated = await storage.updateUser(id, updateData);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Delete staff member
  app.delete("/api/admin/staff/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      if (id === req.session.userId) return res.status(400).json({ message: "Cannot delete your own account" });
      await storage.deleteUser(id);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // -- Team Routes --
  app.get("/api/teams", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const data = await storage.getTeams();
    res.json(data);
  });

  app.post("/api/teams", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const data = z.object({ name: z.string().min(1), color: z.string().optional() }).parse(req.body);
      const team = await storage.createTeam({ name: data.name, color: data.color || "#6366f1" });
      res.json(team);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/teams/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const data = z.object({ name: z.string().min(1).optional(), color: z.string().optional() }).parse(req.body);
      const updated = await storage.updateTeam(id, data);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/teams/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      await storage.deleteTeam(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/teams/:id/assign", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const teamId = parseInt(req.params.id);
      const { userId } = z.object({ userId: z.number() }).parse(req.body);
      await storage.assignUserToTeam(userId, teamId);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/staff/:id/unassign-team", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      await storage.assignUserToTeam(parseInt(req.params.id), null);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // -- Attendance Routes --
  app.get("/api/attendance/today", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const log = await storage.getTodayAttendance(req.session.userId);
    res.json(log || null);
  });

  app.post("/api/attendance/clock-in", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { lat, lng } = z.object({
        lat: z.string({ required_error: "GPS location is required to clock in." }),
        lng: z.string({ required_error: "GPS location is required to clock in." }),
      }).parse(req.body);
      if (!lat || !lng) return res.status(400).json({ message: "GPS location is required to clock in." });

      // Check if already clocked in today
      const existing = await storage.getTodayAttendance(req.session.userId);
      if (existing && !existing.clockOutAt) return res.status(409).json({ message: "Already clocked in" });
      const log = await storage.clockIn(req.session.userId, lat, lng);
      res.json(log);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/attendance/clock-out", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { lat, lng } = z.object({
        lat: z.string({ required_error: "GPS location is required to clock out." }),
        lng: z.string({ required_error: "GPS location is required to clock out." }),
      }).parse(req.body);
      if (!lat || !lng) return res.status(400).json({ message: "GPS location is required to clock out." });
      const log = await storage.clockOut(req.session.userId, lat, lng);
      if (!log) return res.status(404).json({ message: "No active clock-in found" });
      res.json(log);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/admin/attendance", async (req, res) => {
    try {
      const { from, to, userId } = req.query;
      const parseDate = (s: unknown) => {
        if (!s) return undefined;
        const d = new Date(s as string);
        return isNaN(d.getTime()) ? undefined : d;
      };
      const logs = await storage.getAttendanceLogs(
        parseDate(from),
        parseDate(to),
        userId ? parseInt(userId as string) : undefined,
      );
      res.json(logs);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/admin/attendance", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { userId, clockInAt, clockOutAt, notes } = z.object({
        userId: z.number(),
        clockInAt: z.string(),
        clockOutAt: z.string().nullable().optional(),
        notes: z.string().optional(),
      }).parse(req.body);
      const log = await storage.createAttendanceLog({
        userId,
        clockInAt: new Date(clockInAt),
        clockOutAt: clockOutAt ? new Date(clockOutAt) : null,
        notes,
      });
      res.json(log);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/admin/attendance/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const { clockInAt, clockOutAt, notes, deductionMinutes, deductionReason } = z.object({
        clockInAt: z.string().optional(),
        clockOutAt: z.string().nullable().optional(),
        notes: z.string().optional(),
        deductionMinutes: z.number().int().min(0).max(1440).optional(),
        deductionReason: z.string().nullable().optional(),
      }).parse(req.body);
      const updated = await storage.updateAttendanceLog(id, {
        clockInAt: clockInAt ? new Date(clockInAt) : undefined,
        clockOutAt: clockOutAt === null ? null : clockOutAt ? new Date(clockOutAt) : undefined,
        notes,
        deductionMinutes,
        deductionReason,
      });
      if (!updated) return res.status(404).json({ message: "Record not found" });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Bulk-deduct working minutes across a date range for a single staff
  app.post("/api/admin/attendance/bulk-deduct", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { userId, fromDate, toDate, minutesPerDay, reason, mode } = z.object({
        userId: z.number().int(),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fromDate must be YYYY-MM-DD"),
        toDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "toDate must be YYYY-MM-DD"),
        minutesPerDay: z.number().int().min(1).max(1440),
        reason: z.string().min(1).max(500),
        mode: z.enum(['set', 'add']).default('set'),
      }).refine(d => d.fromDate <= d.toDate, { message: "fromDate must be on or before toDate" })
        .parse(req.body);
      // Convert SGT date strings to UTC range covering the SGT day
      const from = new Date(`${fromDate}T00:00:00+08:00`);
      const to = new Date(`${toDate}T23:59:59+08:00`);
      const result = await storage.bulkDeductAttendance({ userId, from, to, minutesPerDay, reason, mode });
      res.json(result);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/admin/attendance/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAttendanceLog(id);
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // -- Site Analytics Tracking (public — no auth required) --
  function detectDevice(ua?: string): string {
    if (!ua) return 'desktop';
    const u = ua.toLowerCase();
    if (/tablet|ipad/.test(u)) return 'tablet';
    if (/mobile|iphone|android|blackberry|opera mini|opera mobi|windows phone/.test(u)) return 'mobile';
    return 'desktop';
  }

  async function lookupGeoAndUpdate(eventId: number, ip: string): Promise<void> {
    try {
      const clean = ip.replace(/^::ffff:/, '');
      if (!clean || clean === '127.0.0.1' || clean.startsWith('::1') || clean.startsWith('10.') || clean.startsWith('192.168.')) return;
      const r = await fetch(`http://ip-api.com/json/${clean}?fields=status,country,countryCode,city,lat,lon`);
      if (!r.ok) return;
      const d = await r.json() as any;
      if (d.status !== 'success') return;
      await storage.updateSiteEventGeo(eventId, {
        country: d.country,
        countryCode: d.countryCode,
        city: d.city,
        latitude: String(d.lat),
        longitude: String(d.lon),
      });
    } catch {}
  }

  app.post("/api/track", async (req, res) => {
    try {
      const body = z.object({
        event: z.string(),
        page: z.string().optional(),
        label: z.string().optional(),
        referrer: z.string().optional(),
        utmSource: z.string().optional(),
        utmMedium: z.string().optional(),
        utmCampaign: z.string().optional(),
        sessionId: z.string().optional(),
      }).parse(req.body);
      const deviceType = detectDevice(req.headers['user-agent']);
      const evt = await storage.addSiteEvent({ ...body, deviceType });
      res.json({ ok: true });
      // Async geo lookup after response is sent — doesn't block the user
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
      lookupGeoAndUpdate(evt.id, ip);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/admin/analytics", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 7));
      const data = await storage.getSiteAnalytics(days);
      res.json(data);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Business Analytics (quotes, revenue, WhatsApp, staff) ──────────────────
  app.get("/api/admin/analytics/business", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const days = Math.min(365, Math.max(7, parseInt(req.query.days as string) || 30));
      const now = new Date();
      const since = new Date(now);
      since.setDate(since.getDate() - days);

      // ── All quotes (no filter) for pipeline ──
      const allQuotes = await db.select({
        id: quotesTable.id, status: quotesTable.status,
        total: quotesTable.total, sourceChannel: quotesTable.sourceChannel,
        paymentStatus: quotesTable.paymentStatus,
        createdAt: quotesTable.createdAt, scheduledAt: quotesTable.scheduledAt,
        assignedStaffId: quotesTable.assignedStaffId,
        selectedServices: quotesTable.selectedServices,
      }).from(quotesTable).orderBy(desc(quotesTable.createdAt));

      const quotesInPeriod = allQuotes.filter(q => q.createdAt && q.createdAt >= since);

      // ── KPIs ──
      const ACTIVE_STATUSES = ["submitted","under_review","approved","deposit_requested","deposit_paid","booked","assigned","in_progress"];
      const DONE_STATUSES   = ["completed","final_payment_requested","final_paid","closed"];
      const pipelineValue = allQuotes
        .filter(q => [...ACTIVE_STATUSES, ...DONE_STATUSES].includes(q.status))
        .reduce((s, q) => s + parseFloat(q.total || "0"), 0);
      const completedJobs = allQuotes.filter(q => DONE_STATUSES.includes(q.status)).length;
      const quotesThisPeriod = quotesInPeriod.length;
      const quotesWithValue = allQuotes.filter(q => parseFloat(q.total || "0") > 0);
      const avgQuoteValue = quotesWithValue.length > 0
        ? quotesWithValue.reduce((s, q) => s + parseFloat(q.total || "0"), 0) / quotesWithValue.length : 0;
      const nonCancelledTotal = allQuotes.filter(q => q.status !== "cancelled" && q.status !== "rejected").length;
      const conversionRate = nonCancelledTotal > 0 ? Math.round((completedJobs / nonCancelledTotal) * 100) : 0;

      // ── Quote by status ──
      const statusMap: Record<string, { count: number; value: number }> = {};
      for (const q of allQuotes) {
        if (!statusMap[q.status]) statusMap[q.status] = { count: 0, value: 0 };
        statusMap[q.status].count++;
        statusMap[q.status].value += parseFloat(q.total || "0");
      }
      const quotesByStatus = Object.entries(statusMap).map(([status, d]) => ({ status, ...d }))
        .sort((a, b) => b.count - a.count);

      // ── Quote trend by month (last 6 months) ──
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);
      const monthlyMap: Record<string, { count: number; value: number }> = {};
      for (const q of allQuotes) {
        if (!q.createdAt || q.createdAt < sixMonthsAgo) continue;
        const key = `${q.createdAt.getFullYear()}-${String(q.createdAt.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyMap[key]) monthlyMap[key] = { count: 0, value: 0 };
        monthlyMap[key].count++;
        monthlyMap[key].value += parseFloat(q.total || "0");
      }
      const quoteTrend = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, d]) => ({ month, ...d, label: new Date(month + "-01").toLocaleDateString("en-SG", { month: "short", year: "2-digit" }) }));

      // ── Revenue by payment status ──
      const payMap: Record<string, { count: number; value: number }> = {};
      for (const q of allQuotes) {
        if (q.status === "cancelled" || q.status === "rejected") continue;
        const ps = q.paymentStatus || "unpaid";
        if (!payMap[ps]) payMap[ps] = { count: 0, value: 0 };
        payMap[ps].count++;
        payMap[ps].value += parseFloat(q.total || "0");
      }
      const paymentBreakdown = Object.entries(payMap).map(([status, d]) => ({ status, ...d }));

      // ── Source channel ──
      const srcMap: Record<string, number> = {};
      for (const q of allQuotes) {
        const ch = q.sourceChannel || "web";
        srcMap[ch] = (srcMap[ch] || 0) + 1;
      }
      const sourceChannels = Object.entries(srcMap).map(([channel, count]) => ({ channel, count }));

      // ── Service type breakdown from quoteItems ──
      const items = await db.select({
        serviceType: quoteItemsTable.serviceType,
        subtotal: quoteItemsTable.subtotal,
        quantity: quoteItemsTable.quantity,
        detectedName: quoteItemsTable.detectedName,
        originalDescription: quoteItemsTable.originalDescription,
      }).from(quoteItemsTable);

      const svcMap: Record<string, { count: number; value: number }> = {};
      for (const item of items) {
        const st = item.serviceType || "other";
        if (!svcMap[st]) svcMap[st] = { count: 0, value: 0 };
        svcMap[st].count += item.quantity || 1;
        svcMap[st].value += parseFloat(item.subtotal || "0");
      }
      const serviceBreakdown = Object.entries(svcMap)
        .map(([serviceType, d]) => ({ serviceType, ...d }))
        .sort((a, b) => b.count - a.count);

      // ── Top requested items (by detected name) ──
      const itemNameMap: Record<string, number> = {};
      for (const item of items) {
        const name = item.detectedName || item.originalDescription || "Unknown";
        itemNameMap[name] = (itemNameMap[name] || 0) + (item.quantity || 1);
      }
      const topItems = Object.entries(itemNameMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // ── WhatsApp metrics ──
      const waSessions = await db.select({
        id: whatsappSessionsTable.id, state: whatsappSessionsTable.state,
        botPaused: whatsappSessionsTable.botPaused, createdAt: whatsappSessionsTable.createdAt,
      }).from(whatsappSessionsTable).orderBy(desc(whatsappSessionsTable.createdAt));

      const waInPeriod = waSessions.filter(s => s.createdAt && s.createdAt >= since);
      const waLeads = waInPeriod.length;
      const waSubmitted = waSessions.filter(s => s.state === "submitted").length;
      const waEscalated = waSessions.filter(s => s.botPaused).length;
      const waConversionRate = waSessions.length > 0 ? Math.round((waSubmitted / waSessions.length) * 100) : 0;

      // ── WhatsApp daily trend ──
      const waTrendMap: Record<string, number> = {};
      for (const s of waInPeriod) {
        if (!s.createdAt) continue;
        const key = s.createdAt.toISOString().split("T")[0];
        waTrendMap[key] = (waTrendMap[key] || 0) + 1;
      }
      const whatsappTrend = Object.entries(waTrendMap).sort(([a],[b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

      // ── Staff attendance (last 30 days) ──
      const thirtyAgo = new Date(now);
      thirtyAgo.setDate(thirtyAgo.getDate() - 30);
      const logs = await db.select({
        userId: attendanceLogs.userId, clockInAt: attendanceLogs.clockInAt, clockOutAt: attendanceLogs.clockOutAt,
      }).from(attendanceLogs).where(gte(attendanceLogs.clockInAt, thirtyAgo));

      const staffList = await storage.getStaffMembers();
      const staffHoursMap: Record<number, number> = {};
      for (const log of logs) {
        if (!log.clockOutAt || !log.clockInAt) continue;
        const rawMs = log.clockOutAt.getTime() - log.clockInAt.getTime();
        const dedMs = Math.max(0, ((log as any).deductionMinutes || 0)) * 60000;
        const hrs = Math.max(0, rawMs - dedMs) / 3600000;
        staffHoursMap[log.userId] = (staffHoursMap[log.userId] || 0) + hrs;
      }
      const staffJobsMap: Record<number, number> = {};
      for (const q of allQuotes) {
        if (q.assignedStaffId && DONE_STATUSES.includes(q.status)) {
          staffJobsMap[q.assignedStaffId] = (staffJobsMap[q.assignedStaffId] || 0) + 1;
        }
      }
      const staffAttendance = staffList.map((s: any) => ({
        id: s.id, name: s.fullName || s.username,
        hours: Math.round((staffHoursMap[s.id] || 0) * 10) / 10,
        jobs: staffJobsMap[s.id] || 0,
      })).sort((a: any, b: any) => b.hours - a.hours);

      // ── Selected services breakdown from quotes.selectedServices ──
      const svcTagMap: Record<string, number> = {};
      for (const q of allQuotes) {
        try {
          const tags: string[] = JSON.parse(q.selectedServices || "[]");
          for (const t of tags) svcTagMap[t] = (svcTagMap[t] || 0) + 1;
        } catch {}
      }
      const selectedServicesBreakdown = Object.entries(svcTagMap)
        .map(([service, count]) => ({ service, count }))
        .sort((a, b) => b.count - a.count);

      res.json({
        period: { days, from: since.toISOString(), to: now.toISOString() },
        kpis: {
          pipelineValue: Math.round(pipelineValue),
          quotesThisPeriod, avgQuoteValue: Math.round(avgQuoteValue),
          completedJobs, conversionRate,
          whatsappLeads: waLeads, waConversionRate, waEscalated,
          totalQuotes: allQuotes.length, totalWaSessions: waSessions.length,
        },
        quotesByStatus, quoteTrend, paymentBreakdown, sourceChannels,
        serviceBreakdown, selectedServicesBreakdown, topItems,
        staffAttendance, whatsappTrend,
        waSubmitted, waEscalated,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── P&L Analytics (supports ?from=YYYY-MM-DD&to=YYYY-MM-DD for date range) ──
  app.get("/api/admin/analytics/pnl", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const DONE_STATUSES = ["completed", "final_payment_requested", "final_paid", "closed"];
      const now = new Date();

      // ── Date range: optional ?from=&to= params ───────────────────────────────
      const fromParam = req.query.from as string | undefined;
      const toParam   = req.query.to   as string | undefined;
      const rangeFrom: Date | null = fromParam ? new Date(fromParam + "T00:00:00") : null;
      const rangeTo:   Date | null = toParam   ? new Date(toParam   + "T23:59:59") : null;
      // For monthly trend display window: default to last 6 months if no range given
      const trendFrom = rangeFrom ?? (() => { const d = new Date(now); d.setMonth(d.getMonth() - 5); d.setDate(1); return d; })();
      const trendTo   = rangeTo ?? now;
      const trendFromKey = `${trendFrom.getFullYear()}-${String(trendFrom.getMonth() + 1).padStart(2, "0")}`;
      const trendToKey   = `${trendTo.getFullYear()}-${String(trendTo.getMonth() + 1).padStart(2, "0")}`;

      const inRange = (d: Date | null | undefined): boolean => {
        if (!d) return !rangeFrom; // no date: include only if no filter
        if (rangeFrom && d < rangeFrom) return false;
        if (rangeTo   && d > rangeTo)   return false;
        return true;
      };

      // ── TMG Revenue: completed/paid/closed quotes ────────────────────────────
      const allQuotes = await db.select({
        id: quotesTable.id, status: quotesTable.status,
        total: quotesTable.total, scheduledAt: quotesTable.scheduledAt,
        createdAt: quotesTable.createdAt,
      }).from(quotesTable);

      const doneQuotes = allQuotes.filter(q =>
        DONE_STATUSES.includes(q.status) && inRange(q.scheduledAt || q.createdAt)
      );
      const tmgRevenue = doneQuotes.reduce((s, q) => s + parseFloat(q.total || "0"), 0);

      const monthlyTmgRevMap: Record<string, number> = {};
      for (const q of doneQuotes) {
        const d = q.scheduledAt || q.createdAt;
        if (!d) continue;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyTmgRevMap[key] = (monthlyTmgRevMap[key] || 0) + parseFloat(q.total || "0");
      }

      // ── GGV Revenue ──────────────────────────────────────────────────────────
      const GGV_DELIVERY_FEE = 23.80;
      const allGGVJobs = await db.select({
        id: ggvJobsTable.id, date: ggvJobsTable.date,
        actualPrice: ggvJobsTable.actualPrice,
        listedPrice: ggvJobsTable.listedPrice,
        deduction: ggvJobsTable.deduction,
        jobNo: ggvJobsTable.jobNo,
      }).from(ggvJobsTable);

      const ggvEffective = (j: { actualPrice: string | null; jobNo: string | null }): number => {
        const base = parseFloat(j.actualPrice || "0");
        const fee  = j.jobNo?.trim()?.toUpperCase()?.startsWith("S") ? GGV_DELIVERY_FEE : 0;
        return (isNaN(base) ? 0 : base) + fee;
      };

      const filteredGGV = allGGVJobs.filter(j => inRange(j.date ? new Date(j.date) : null));
      const ggvRevenue        = filteredGGV.reduce((s, j) => s + ggvEffective(j), 0);
      const ggvListedTotal    = filteredGGV.reduce((s, j) => s + parseFloat(j.listedPrice || "0"), 0);
      const ggvDeductionTotal = filteredGGV.reduce((s, j) => s + parseFloat(j.deduction  || "0"), 0);
      const ggvJobCount = filteredGGV.length;

      const monthlyGGVRevMap: Record<string, number> = {};
      for (const j of filteredGGV) {
        if (!j.date) continue;
        const d = new Date(j.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyGGVRevMap[key] = (monthlyGGVRevMap[key] || 0) + ggvEffective(j);
      }

      const totalRevenue = tmgRevenue + ggvRevenue;

      // ── Staff Salary Cost ────────────────────────────────────────────────────
      const staffList = await storage.getStaffMembers() as any[];
      const allAttLogs = await db.select({
        userId: attendanceLogs.userId,
        clockInAt: attendanceLogs.clockInAt,
        clockOutAt: attendanceLogs.clockOutAt,
      }).from(attendanceLogs);

      const monthlySalaryMap: Record<string, number> = {};
      let totalSalaryCost = 0;

      const monthlyStaff = staffList.filter((s: any) => parseFloat(s.monthlyRate || "0") > 0);
      const hourlyStaff  = staffList.filter((s: any) =>
        parseFloat(s.monthlyRate || "0") === 0 && parseFloat(s.hourlyRate || "0") > 0);

      for (const s of hourlyStaff) {
        const myLogs = allAttLogs.filter(l =>
          l.userId === s.id && l.clockInAt && l.clockOutAt && inRange(l.clockInAt)
        );
        for (const log of myLogs) {
          const rawMs = log.clockOutAt!.getTime() - log.clockInAt!.getTime();
          const dedMs = Math.max(0, ((log as any).deductionMinutes || 0)) * 60000;
          const hrs = Math.max(0, rawMs - dedMs) / 3600000;
          const cost = Math.min(hrs, 8) * parseFloat(s.hourlyRate || "0")
                     + Math.max(0, hrs - 8) * parseFloat(s.overtimeRate || s.hourlyRate || "0");
          totalSalaryCost += cost;
          const key = `${log.clockInAt!.getFullYear()}-${String(log.clockInAt!.getMonth() + 1).padStart(2, "0")}`;
          monthlySalaryMap[key] = (monthlySalaryMap[key] || 0) + cost;
        }
      }

      for (const s of monthlyStaff) {
        const rate = parseFloat(s.monthlyRate || "0");
        if (rate === 0) continue;
        const startDate = s.startDate
          ? new Date(s.startDate)
          : new Date(now.getFullYear(), now.getMonth(), 1);
        // iterate month by month within the filter range
        const iterFrom = rangeFrom && startDate < rangeFrom ? new Date(rangeFrom.getFullYear(), rangeFrom.getMonth(), 1) : new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const iterTo   = rangeTo ?? now;
        const cur = new Date(iterFrom);
        while (cur <= iterTo) {
          const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`;
          const isLastMonth = cur.getFullYear() === iterTo.getFullYear() && cur.getMonth() === iterTo.getMonth();
          const isCurrentCalMonth = cur.getFullYear() === now.getFullYear() && cur.getMonth() === now.getMonth();
          const monthCost = (isLastMonth && isCurrentCalMonth)
            ? rate * (now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())
            : rate;
          monthlySalaryMap[key] = (monthlySalaryMap[key] || 0) + monthCost;
          totalSalaryCost += monthCost;
          cur.setMonth(cur.getMonth() + 1);
        }
      }

      // ── Expenses: approved receipts ──────────────────────────────────────────
      const allReceipts = await storage.getAllReceipts();
      const approvedReceipts = (allReceipts as any[]).filter((r: any) =>
        r.status === "approved" && inRange(r.receiptDate ? new Date(r.receiptDate) : null)
      );
      const totalReceiptExpenses = approvedReceipts.reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);

      const monthlyReceiptExpMap: Record<string, number> = {};
      for (const r of approvedReceipts) {
        if (!r.receiptDate) continue;
        const d = new Date(r.receiptDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyReceiptExpMap[key] = (monthlyReceiptExpMap[key] || 0) + parseFloat(r.amount || "0");
      }

      const totalExpenses = totalReceiptExpenses + totalSalaryCost;
      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100 * 10) / 10 : 0;

      // ── Monthly trend: all months within trend window ─────────────────────────
      const allMonths = Array.from(new Set([
        ...Object.keys(monthlyTmgRevMap),
        ...Object.keys(monthlyGGVRevMap),
        ...Object.keys(monthlyReceiptExpMap),
        ...Object.keys(monthlySalaryMap),
      ])).filter(k => k >= trendFromKey && k <= trendToKey).sort();

      const monthlyTrend = allMonths.map(key => {
        const tmgRev  = Math.round(monthlyTmgRevMap[key]     || 0);
        const ggvRev  = Math.round(monthlyGGVRevMap[key]     || 0);
        const receipts = Math.round(monthlyReceiptExpMap[key] || 0);
        const salary  = Math.round(monthlySalaryMap[key]     || 0);
        const revenue  = tmgRev + ggvRev;
        const expenses = receipts + salary;
        return {
          month: key,
          label: new Date(key + "-01").toLocaleDateString("en-SG", { month: "short", year: "2-digit" }),
          revenue, tmgRevenue: tmgRev, ggvRevenue: ggvRev,
          expenses, receiptsExpense: receipts, salaryExpense: salary,
          profit: revenue - expenses,
        };
      });

      // ── Expense breakdown by category ─────────────────────────────────────────
      const catMap: Record<string, number> = {};
      for (const r of approvedReceipts) {
        const cat = r.category || "other";
        catMap[cat] = (catMap[cat] || 0) + parseFloat(r.amount || "0");
      }
      if (totalSalaryCost > 0) catMap["staff_salary"] = (catMap["staff_salary"] || 0) + totalSalaryCost;
      const expensesByCategory = Object.entries(catMap)
        .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => b.amount - a.amount);

      const jobCount = doneQuotes.length;
      const avgJobRevenue = jobCount > 0 ? Math.round(tmgRevenue / jobCount) : 0;
      const pendingExpenses = (allReceipts as any[])
        .filter((r: any) => r.status === "pending")
        .reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);

      res.json({
        totalRevenue:    Math.round(totalRevenue    * 100) / 100,
        tmgRevenue:      Math.round(tmgRevenue      * 100) / 100,
        ggvRevenue:      Math.round(ggvRevenue      * 100) / 100,
        ggvListedTotal:  Math.round(ggvListedTotal  * 100) / 100,
        ggvDeductionTotal: Math.round(ggvDeductionTotal * 100) / 100,
        ggvJobCount, jobCount, avgJobRevenue,
        totalExpenses:        Math.round(totalExpenses        * 100) / 100,
        totalReceiptExpenses: Math.round(totalReceiptExpenses * 100) / 100,
        totalSalaryCost:      Math.round(totalSalaryCost      * 100) / 100,
        pendingExpenses:      Math.round(pendingExpenses       * 100) / 100,
        netProfit:     Math.round(netProfit     * 100) / 100,
        profitMargin,
        monthlyTrend,
        expensesByCategory,
        // Echo back the active filter so the UI can display it
        filter: { from: fromParam || null, to: toParam || null },
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // -- Android crash reporter (unauthenticated — fires from native crash handler) --
  app.post("/api/crash-report", (req, res) => {
    const report = req.body?.crash ?? JSON.stringify(req.body);
    console.error("[ANDROID CRASH REPORT]", report);
    res.json({ ok: true });
  });

  // -- GPS Track Routes --
  app.post("/api/staff/gps-track", async (req, res) => {
    // Primary auth: session cookie (web / foregrounded app).
    // Fallback auth: staffId in body — used by the Android foreground service
    // when the staff member has logged out of the WebView but the native
    // GPS service is still running (intentional design: GPS tracks while clocked in
    // regardless of app login state).
    // Accept number, string, or null — device sends null for heading/speed when stationary
    const numOrStr = z.union([z.number(), z.string(), z.null()]).transform(v => v != null ? String(v) : undefined);
    let resolvedUserId: number | null = req.session.userId ?? null;
    if (!resolvedUserId) {
      const bodyId = req.body?.staffId;
      if (!bodyId) return res.status(401).json({ message: "Not logged in" });
      resolvedUserId = Number(bodyId);
      if (isNaN(resolvedUserId) || resolvedUserId <= 0) {
        return res.status(401).json({ message: "Invalid staffId" });
      }
      // Verify this staff member actually exists
      const staffUser = await storage.getUserById(resolvedUserId);
      if (!staffUser || staffUser.role !== "staff") {
        return res.status(401).json({ message: "Invalid staffId" });
      }
    }
    try {
      // Only record GPS points when the staff member has an active clock-in session
      const activeSession = await db
        .select({ id: attendanceLogs.id })
        .from(attendanceLogs)
        .where(and(eq(attendanceLogs.userId, resolvedUserId), isNull(attendanceLogs.clockOutAt)))
        .limit(1);
      if (activeSession.length === 0) {
        return res.status(200).json({ ok: false, reason: "not_clocked_in" });
      }
      // Accept number or string for GPS fields (native app sends numbers)
      const { lat, lng, accuracy, speed, heading, recordedAt } = z.object({
        lat: numOrStr,
        lng: numOrStr,
        accuracy: numOrStr.optional(),
        speed: numOrStr.optional(),
        heading: numOrStr.optional(),
        recordedAt: z.string().optional(),
        staffId: z.any().optional(),
      }).parse(req.body);
      const pt = await storage.addGpsTrackPoint({
        userId: resolvedUserId,
        lat, lng, accuracy, speed, heading,
        recordedAt: recordedAt ? new Date(recordedAt) : undefined,
      });
      res.json(pt);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Register / update FCM push notification token for the logged-in staff member
  app.post("/api/staff/fcm-token", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
      await storage.updateFcmToken(req.session.userId, token);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/admin/staff/:userId/gps-track", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const userId = parseInt(req.params.userId);
      const date = req.query.date as string || new Date().toISOString().split("T")[0];
      const dateFrom = new Date(date + "T00:00:00");
      const dateTo   = new Date(date + "T23:59:59");
      const points = await storage.getGpsTrackPoints(userId, dateFrom, dateTo);
      res.json(points);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Live locations: last GPS point today for every currently-clocked-in staff member
  app.get("/api/admin/live-locations", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const dateFrom = new Date(todayStr + "T00:00:00");
      const dateTo   = new Date(todayStr + "T23:59:59");
      // Get all attendance logs for today where staff are still clocked in
      const logs = await storage.getAttendanceLogs(dateFrom, dateTo);
      const activeUserIds = logs.filter((l: any) => !l.clockOutAt).map((l: any) => l.userId);
      // Fetch last GPS point for each active user
      const result: Record<number, any> = {};
      await Promise.all(activeUserIds.map(async (uid: number) => {
        const pts = await storage.getGpsTrackPoints(uid, dateFrom, dateTo);
        if (pts.length > 0) {
          const last = pts[pts.length - 1];
          result[uid] = { lat: last.lat, lng: last.lng, recordedAt: last.recordedAt };
        }
      }));
      res.json(result);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // -- Amendment Routes --
  app.post("/api/attendance/amendment", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { attendanceLogId, requestedClockIn, requestedClockOut, reason } = z.object({
        attendanceLogId: z.number(),
        requestedClockIn: z.string().optional(),
        requestedClockOut: z.string().optional(),
        reason: z.string().min(5),
      }).parse(req.body);

      const log = await storage.getAttendanceLog(attendanceLogId);
      if (!log) return res.status(404).json({ message: "Record not found" });

      const amendment = await storage.createAmendment({
        attendanceLogId,
        userId: req.session.userId,
        originalClockIn: log.clockInAt,
        originalClockOut: log.clockOutAt,
        requestedClockIn: requestedClockIn ? new Date(requestedClockIn) : undefined,
        requestedClockOut: requestedClockOut ? new Date(requestedClockOut) : undefined,
        reason,
        status: 'pending',
      });
      res.json(amendment);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/attendance/amendments", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const amendments = await storage.getAmendmentsByUser(req.session.userId);
    res.json(amendments);
  });

  app.get("/api/admin/attendance/amendments", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const amendments = await storage.getPendingAmendments();
    res.json(amendments);
  });

  app.patch("/api/admin/attendance/amendments/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const { status, adminNote } = z.object({
        status: z.enum(["approved", "rejected"]),
        adminNote: z.string().default(""),
      }).parse(req.body);
      const updated = await storage.reviewAmendment(id, status, adminNote, req.session.userId);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // -- Leave Routes --
  app.post("/api/leave", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const data = z.object({
        leaveType: z.enum(["annual", "medical", "unpaid", "other"]),
        startDate: z.string(),
        endDate: z.string(),
        totalDays: z.number().min(0.5),
        reason: z.string().optional(),
      }).parse(req.body);
      const leave = await storage.createLeaveRequest({ ...data, userId: req.session.userId, totalDays: String(data.totalDays) });
      res.json(leave);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.get("/api/leave", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const leaves = await storage.getLeaveRequestsByUser(req.session.userId);
    res.json(leaves);
  });

  app.get("/api/leave/balance", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
    const balance = await storage.getLeaveBalance(req.session.userId, year);
    res.json(balance);
  });

  app.get("/api/admin/leave", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const status = req.query.status as string | undefined;
    const leaves = await storage.getAllLeaveRequests(status);
    res.json(leaves);
  });

  app.patch("/api/admin/leave/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const { status, adminNote } = z.object({
        status: z.enum(["approved", "rejected"]),
        adminNote: z.string().default(""),
      }).parse(req.body);
      const updated = await storage.reviewLeaveRequest(id, status, adminNote, req.session.userId);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // -- Pay Settings --
  app.patch("/api/admin/pay-settings/:userId", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const userId = parseInt(req.params.userId);
      const data = z.object({
        payType: z.enum(["hourly", "monthly"]).optional(),
        monthlyRate: z.string().optional(),
        hourlyRate: z.string().optional(),
        overtimeRate: z.string().optional(),
        annualLeaveEntitlement: z.number().int().min(0).max(30).optional(),
      }).parse(req.body);
      const updated = await storage.updatePaySettings(userId, data);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // -- Payslip Routes --
  app.get("/api/admin/payslips", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const slips = await storage.getAllPayslips(userId);
    res.json(slips);
  });

  app.get("/api/staff/payslips", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const slips = await storage.getPayslipsByUser(req.session.userId);
    const me = await storage.getUserById(req.session.userId);
    const monthlyRate = parseFloat(me?.monthlyRate as string || "0");
    res.json(slips.map(s => ({ ...s, isMonthlyBased: monthlyRate > 0 })));
  });

  app.post("/api/admin/payslips/generate", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const callerGen = await storage.getUserById(req.session.userId);
    if (!callerGen || callerGen.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { userId, periodStart, periodEnd, notes } = z.object({
        userId: z.number(),
        periodStart: z.string(),
        periodEnd: z.string(),
        notes: z.string().optional(),
      }).parse(req.body);

      // Fetch attendance logs for period
      const logs = await storage.getAttendanceLogs(
        new Date(periodStart + "T00:00:00"),
        new Date(periodEnd + "T23:59:59"),
        userId,
      );

      // Fetch user pay settings
      const staffMember = await storage.getUserById(userId);
      if (!staffMember) return res.status(404).json({ message: "Staff not found" });

      const monthlyRate = parseFloat(staffMember.monthlyRate as string || "0");
      const hourlyRate  = parseFloat(staffMember.hourlyRate  as string || "0");
      const overtimeRate = parseFloat((staffMember as any).overtimeRate as string || "0") ||
                           (hourlyRate * 1.5);

      // Auto-detect: if monthly salary is set, treat as monthly-based regardless of payType flag
      const isMonthly = monthlyRate > 0;

      // Calculate hours per day (cap regular at 8h/day, remainder is OT)
      let regularHours = 0, overtimeHours = 0, mealAllowanceDays = 0;
      for (const log of logs) {
        if (log.clockOutAt) {
          const rawMs = new Date(log.clockOutAt).getTime() - new Date(log.clockInAt).getTime();
          const dedMs = Math.max(0, ((log as any).deductionMinutes || 0)) * 60000;
          const hrs = Math.max(0, rawMs - dedMs) / 3600000;
          const dailyOt = Math.max(0, hrs - 8);
          regularHours  += Math.min(hrs, 8);
          overtimeHours += dailyOt;
          // Meal allowance: S$8 per day when OT > 3h (applied once per day)
          if (dailyOt > 3) mealAllowanceDays++;
        }
      }
      const mealAllowance = mealAllowanceDays * 8;

      // Per-job staff transport allowance: $8 for every job in the period where
      // admin enabled the toggle AND this staff was on the job — either as the
      // single assigned staff (assignedStaffId) or as a member of the assigned
      // team (assignedTeamId matches the staff's teamId). Each crew member on a
      // team-assigned job receives $8.
      const periodStartDate = new Date(periodStart + "T00:00:00");
      const periodEndDate   = new Date(periodEnd   + "T23:59:59");
      const staffTeamId = (staffMember as any).teamId as number | null | undefined;
      const onJobCondition = staffTeamId
        ? or(
            eq(quotesTable.assignedStaffId, userId),
            eq(quotesTable.assignedTeamId, staffTeamId),
          )
        : eq(quotesTable.assignedStaffId, userId);
      const transportJobs = await db
        .select({ id: quotesTable.id })
        .from(quotesTable)
        .where(and(
          onJobCondition,
          eq(quotesTable.staffTransportAllowance, true),
          gte(quotesTable.scheduledAt, periodStartDate),
          lte(quotesTable.scheduledAt, periodEndDate),
        ));
      const transportAllowance = transportJobs.length * 8;

      let basicPay = 0, regularPay = 0, overtimePay = 0, grossPay = 0;
      if (isMonthly) {
        // Basic salary (fixed) + regular hrs × hourly rate + OT hrs × OT rate + meal + transport
        basicPay    = monthlyRate;
        regularPay  = regularHours * hourlyRate;
        overtimePay = overtimeHours * overtimeRate;
        grossPay    = basicPay + regularPay + overtimePay + mealAllowance + transportAllowance;
      } else {
        // Purely hourly: regular hrs × hourly rate + OT hrs × OT rate + meal + transport
        basicPay    = 0;
        regularPay  = regularHours * hourlyRate;
        overtimePay = overtimeHours * overtimeRate;
        grossPay    = regularPay + overtimePay + mealAllowance + transportAllowance;
      }

      // Fetch unpaid leave deductions in period
      const allLeaves = await storage.getAllLeaveRequests('approved');
      const unpaidLeaves = allLeaves.filter(l =>
        l.userId === userId &&
        l.leaveType === 'unpaid' &&
        l.startDate >= periodStart &&
        l.startDate <= periodEnd
      );
      const unpaidDays = unpaidLeaves.reduce((s, l) => s + parseFloat(l.totalDays as string), 0);
      // Daily rate: monthly salary ÷ 26 working days, or hourly × 8
      const dailyRate = isMonthly ? monthlyRate / 26 : hourlyRate * 8;
      const leaveDeduction = unpaidDays * dailyRate;
      grossPay -= leaveDeduction;

      // Fetch active loans and apply monthly repayments
      const activeLoans = (await storage.getStaffLoans(userId)).filter(l => l.isActive && parseFloat(l.remainingBalance as string) > 0);
      let loanDeduction = 0;
      const loanRepayments: { id: number; amount: number; newBalance: number }[] = [];
      for (const loan of activeLoans) {
        const remaining = parseFloat(loan.remainingBalance as string);
        const repay = Math.min(parseFloat(loan.monthlyRepayment as string), remaining);
        loanDeduction += repay;
        loanRepayments.push({ id: loan.id, amount: repay, newBalance: Math.max(0, remaining - repay) });
      }
      grossPay -= loanDeduction;

      const payslip = await storage.generatePayslip({
        userId,
        periodStart,
        periodEnd,
        regularHours: regularHours.toFixed(2),
        overtimeHours: overtimeHours.toFixed(2),
        basicPay: basicPay.toFixed(2),
        regularPay: regularPay.toFixed(2),
        overtimePay: overtimePay.toFixed(2),
        mealAllowance: mealAllowance.toFixed(2),
        transportAllowance: transportAllowance.toFixed(2),
        leaveDeduction: leaveDeduction.toFixed(2),
        loanDeduction: loanDeduction.toFixed(2),
        grossPay: Math.max(0, grossPay).toFixed(2),
        notes,
        generatedBy: req.session.userId,
      });

      // Update loan balances after payslip is saved
      for (const { id, newBalance } of loanRepayments) {
        await storage.updateStaffLoan(id, {
          remainingBalance: newBalance.toFixed(2),
          ...(newBalance <= 0 && { isActive: false }),
        });
      }

      res.json(payslip);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/admin/payslips/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      await storage.deletePayslip(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Staff Loans ────────────────────────────────────────────────────────────
  app.get("/api/admin/staff-loans", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
    const loans = await storage.getStaffLoans(userId);
    res.json(loans);
  });

  app.post("/api/admin/staff-loans", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { userId, description, totalAmount, monthlyRepayment, startDate } = z.object({
        userId: z.number(),
        description: z.string().min(1),
        totalAmount: z.number().positive(),
        monthlyRepayment: z.number().min(0),
        startDate: z.string(),
      }).parse(req.body);
      const loan = await storage.createStaffLoan({
        userId,
        description,
        totalAmount: String(totalAmount),
        monthlyRepayment: String(monthlyRepayment),
        remainingBalance: String(totalAmount),
        startDate,
        isActive: true,
      });
      res.json(loan);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/admin/staff-loans/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { description, monthlyRepayment, remainingBalance, isActive } = z.object({
        description: z.string().min(1).optional(),
        monthlyRepayment: z.number().min(0).optional(),
        remainingBalance: z.number().min(0).optional(),
        isActive: z.boolean().optional(),
      }).parse(req.body);
      const updated = await storage.updateStaffLoan(parseInt(req.params.id), {
        ...(description !== undefined && { description }),
        ...(monthlyRepayment !== undefined && { monthlyRepayment: String(monthlyRepayment) }),
        ...(remainingBalance !== undefined && { remainingBalance: String(remainingBalance) }),
        ...(isActive !== undefined && { isActive }),
      });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/admin/staff-loans/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      await storage.deleteStaffLoan(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff can view their own loans
  app.get("/api/staff/loans", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const loans = await storage.getStaffLoans(req.session.userId);
    res.json(loans);
  });

  // ── Staff Receipts ────────────────────────────────────────────────────────

  // Staff: upload a new receipt
  app.post("/api/staff/receipts", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const body = z.object({
        receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amount: z.string(),
        category: z.enum(["fuel", "tools", "transport", "meals", "parking", "other"]),
        description: z.string().optional(),
        fileData: z.string().min(10),  // base64
        fileType: z.string(),
        fileName: z.string(),
      }).parse(req.body);
      const receipt = await storage.createReceipt(req.session.userId, body);
      res.json(receipt);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Staff: view my own receipts
  app.get("/api/staff/receipts", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const rows = await storage.getReceiptsByUser(req.session.userId);
    // Strip file data from list view to keep responses small
    res.json(rows.map(r => ({ ...r, fileData: undefined })));
  });

  // Staff: delete a pending receipt (own)
  app.delete("/api/staff/receipts/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const receipt = await storage.getReceiptById(parseInt(req.params.id));
    if (!receipt) return res.status(404).json({ message: "Not found" });
    if (receipt.userId !== req.session.userId) return res.status(403).json({ message: "Forbidden" });
    if (receipt.status !== "pending") return res.status(400).json({ message: "Only pending receipts can be deleted" });
    await storage.deleteReceipt(receipt.id);
    res.json({ ok: true });
  });

  // Admin: list all receipts with optional date filters
  app.get("/api/admin/receipts", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const filters: { year?: number; month?: number; day?: number } = {};
    if (req.query.year) filters.year = parseInt(req.query.year as string);
    if (req.query.month) filters.month = parseInt(req.query.month as string);
    if (req.query.day) filters.day = parseInt(req.query.day as string);
    const rows = await storage.getAllReceipts(Object.keys(filters).length ? filters : undefined);
    // Strip file data from list view
    res.json(rows.map(r => ({ ...r, fileData: undefined })));
  });

  // Admin: get full file data for a single receipt (for PDF download)
  app.get("/api/admin/receipts/:id/file", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const receipt = await storage.getReceiptById(parseInt(req.params.id));
    if (!receipt) return res.status(404).json({ message: "Not found" });
    res.json({ fileData: receipt.fileData, fileType: receipt.fileType, fileName: receipt.fileName });
  });

  // Admin: AI-scan a receipt image and return extracted fields
  app.post("/api/admin/receipts/analyze", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { fileData, fileType } = z.object({
        fileData: z.string().min(10),
        fileType: z.string(),
      }).parse(req.body);

      if (!fileType.startsWith("image/")) {
        return res.json({ amount: null, receiptDate: null, category: null, description: null, merchant: null });
      }

      const today = new Date().toISOString().slice(0, 10);
      const aiRes = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 400,
        messages: [
          {
            role: "system",
            content: `You are a receipt parser for a Singapore furniture installation company. Extract structured data from the receipt image. Today's date is ${today}.

Reply with ONLY a valid JSON object (no markdown, no code blocks) with these exact keys:
{
  "amount": "decimal string like 45.50 — total amount paid in SGD, null if unreadable",
  "receiptDate": "YYYY-MM-DD format — the transaction date, null if unreadable",
  "merchant": "string — merchant/vendor name, null if missing",
  "category": "one of: fuel | tools | transport | meals | parking | other",
  "description": "short plain-English summary of what was purchased, max 80 chars, null if unclear"
}

Category rules:
- fuel → petrol stations, fuel, diesel
- tools → hardware, tools, equipment, batteries, materials
- transport → taxi, grab, bus, MRT, EZ-Link top-up, parking coupons for transport
- meals → food, drinks, restaurants, hawker, delivery, coffee
- parking → carpark, parking fees, season parking
- other → everything else`,
          },
          {
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${fileType};base64,${fileData}`, detail: "high" } },
            ] as any,
          },
        ],
      });

      const raw = aiRes.choices[0]?.message?.content?.trim() || "{}";
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { parsed = {}; }

      res.json({
        amount:      typeof parsed.amount      === "string" && /^\d+(\.\d{1,2})?$/.test(parsed.amount) ? parsed.amount : null,
        receiptDate: typeof parsed.receiptDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.receiptDate) ? parsed.receiptDate : null,
        merchant:    typeof parsed.merchant    === "string" ? parsed.merchant.slice(0, 80)    : null,
        category:    ["fuel","tools","transport","meals","parking","other"].includes(parsed.category) ? parsed.category : null,
        description: typeof parsed.description === "string" ? parsed.description.slice(0, 200) : null,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Admin: manually create a receipt for any staff member (auto-approved)
  app.post("/api/admin/receipts", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const body = z.object({
        userId:      z.number().int().positive(),
        receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        amount:      z.string().regex(/^\d+(\.\d{1,2})?$/),
        category:    z.enum(["fuel","tools","transport","meals","parking","other"]),
        description: z.string().max(500).optional(),
        fileData:    z.string().min(10),
        fileType:    z.string(),
        fileName:    z.string(),
      }).parse(req.body);

      const receipt = await storage.createReceipt(body.userId, {
        receiptDate: body.receiptDate,
        amount:      body.amount,
        category:    body.category,
        description: body.description,
        fileData:    body.fileData,
        fileType:    body.fileType,
        fileName:    body.fileName,
      });
      // Auto-approve — admin is manually adding a verified receipt
      const approved = await storage.updateReceiptStatus(receipt.id, "approved", "Added by admin", req.session.userId);
      res.json(approved ?? receipt);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Admin: approve or reject a receipt
  app.patch("/api/admin/receipts/:id/status", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { status, adminNote } = z.object({
        status: z.enum(["approved", "rejected"]),
        adminNote: z.string().optional(),
      }).parse(req.body);
      const updated = await storage.updateReceiptStatus(parseInt(req.params.id), status, adminNote ?? null, req.session.userId);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Staff own attendance logs
  app.get("/api/staff/attendance", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const logs = await storage.getAttendanceLogs(undefined, undefined, req.session.userId);
    res.json(logs);
  });

  // Today's team roster — accessible to any logged-in staff member
  app.get("/api/staff/team/today", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      // Use Singapore time (UTC+8) for day boundaries
      const SGT = 8 * 3600000;
      const sgtNow = new Date(Date.now() + SGT);
      const y = sgtNow.getUTCFullYear(), mo = sgtNow.getUTCMonth(), d = sgtNow.getUTCDate();
      const from = new Date(Date.UTC(y, mo, d, 0, 0, 0) - SGT);
      const to   = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999) - SGT);
      const [allStaff, logs] = await Promise.all([
        storage.getStaffMembers(),
        storage.getAttendanceLogs(from, to),
      ]);
      const staffOnly = allStaff.filter((s: any) => s.role === "staff");
      const roster = staffOnly.map((s: any) => {
        const log = logs.find((l: any) => l.userId === s.id) || null;
        return {
          id: s.id,
          name: s.name,
          username: s.username,
          clockInAt: log?.clockInAt ?? null,
          clockOutAt: log?.clockOutAt ?? null,
          clockInLat: log?.clockInLat ?? null,
          clockInLng: log?.clockInLng ?? null,
        };
      });
      res.json(roster);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Staff-specific quotes (team-aware)
  app.get("/api/staff/quotes", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    const quotes = await storage.getQuotesForStaff(req.session.userId);
    res.json(quotes);
  });

  // -- Catalog Routes --
  app.get(api.catalog.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    const items = await storage.getCatalogItems(search);
    // Short cache — prices can be updated by admin at any time
    if (!search) {
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=10");
    }
    res.json(items);
  });

  // -- Slot Availability (blocked + held by active quotes + per-slot capacity usage) --
  app.get("/api/slots/availability", async (req, res) => {
    try {
      const [blocked, held, capacities] = await Promise.all([
        storage.getBlockedSlots(),
        storage.getHeldSlots(),
        storage.getSlotCapacities(),
      ]);
      res.json({ blocked, held, capacities });
    } catch {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // -- Blocked Slots Routes --
  // Public: customer fetches blocked slots to enforce in booking UI
  app.get("/api/blocked-slots", async (req, res) => {
    try {
      const slots = await storage.getBlockedSlots();
      res.json(slots);
    } catch {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin: create a blocked slot
  app.post("/api/admin/blocked-slots", async (req, res) => {
    try {
      const { date, timeSlot, reason } = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be yyyy-MM-dd"),
        timeSlot: z.string().nullable().optional(),
        reason: z.string().optional(),
      }).parse(req.body);
      const slot = await storage.createBlockedSlot({ date, timeSlot: timeSlot || null, reason: reason || null });
      res.json(slot);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Invalid input" });
    }
  });

  // Admin: permanently delete a quote/job case
  app.delete("/api/admin/quotes/:id", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      await storage.deleteQuote(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Admin: remove a blocked slot
  app.delete("/api/admin/blocked-slots/:id", async (req, res) => {
    try {
      await storage.deleteBlockedSlot(Number(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // -- Temporary: Admin clear all data (for test resets) --
  app.delete("/api/admin/clear-all-data", async (req, res) => {
    try {
      await storage.clearAllData();
      res.json({ success: true, message: "All data cleared" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // -- Quotes Routes --
  app.get(api.quotes.list.path, async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const status = req.query.status as string | undefined;
    const quotes = await storage.getQuotes(status);
    res.json(quotes);
  });

  // Look up a quote by reference number — used for /status/:refNo redirects
  app.get("/api/quotes/by-ref/:refNo", async (req, res) => {
    try {
      // Public: refNo is a 48-bit random token — knowing it proves ownership.
      // Return only the numeric id so the frontend can redirect to the quote page.
      // Admin callers receive this same minimal response; full detail comes via GET /api/quotes/:id.
      // Also matches legacyReferenceNos so old customer-facing links keep working.
      const refParam = req.params.refNo;
      const quotes = await storage.getQuotes();
      const quote = quotes.find(q =>
        q.referenceNo === refParam ||
        (q.legacyReferenceNos ?? []).includes(refParam)
      );
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json({ id: quote.id });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // ── Short payment link redirect (/pay/TMG-XXXX → fresh Stripe session) ──────
  // ?type=final  → charges the final/balance amount
  // default      → charges the deposit amount
  app.get("/pay/:ref", async (req, res) => {
    try {
      const refNo = req.params.ref.toUpperCase();
      const isFinal = req.query.type === "final";
      const [quote] = await db.select().from(quotesTable).where(
        or(
          eq(quotesTable.referenceNo, refNo),
          drizzleSql`${quotesTable.legacyReferenceNos} @> ARRAY[${refNo}]::text[]`
        )
      ).limit(1);
      if (!quote) return res.redirect(`${APP_URL}/quotes`);

      const quotePageUrl = `${APP_URL}/quotes/${quote.id}?ref=${quote.referenceNo}`;
      let amount: number;
      let description: string;
      let stripeType: string;

      if (isFinal) {
        // Balance = total minus deposit already paid (fixed-price installation, no overtime)
        const totalAmt = parseFloat(quote.total || "0");
        const depositPaid = parseFloat(quote.depositAmount || "0") || totalAmt * 0.5;
        amount = parseFloat(quote.finalAmount || "0") > 0
          ? parseFloat(quote.finalAmount!)
          : Math.max(0, totalAmt - depositPaid);
        description = `Balance Payment for ${quote.referenceNo} — TMG Install`;
        stripeType = "final";
      } else {
        amount = parseFloat(quote.depositAmount || "0") || parseFloat(quote.total || "0") * 0.5;
        description = `50% Deposit for ${quote.referenceNo} — TMG Install`;
        stripeType = "deposit";
      }

      const stripeUrl = await createStripePaymentLink(
        description,
        amount,
        { quoteId: String(quote.id), type: stripeType, referenceNo: quote.referenceNo },
        quotePageUrl
      );
      if (!stripeUrl) return res.redirect(quotePageUrl);
      res.redirect(stripeUrl);
    } catch (err) {
      console.error("[PayRedirect] Error:", err);
      res.redirect(APP_URL);
    }
  });

  // ── Public job tracker (no auth) ────────────────────────────────────────────
  app.get("/api/public/track/:referenceNo", async (req, res) => {
    try {
      const refNo = req.params.referenceNo.toUpperCase();
      const [quote] = await db.select().from(quotesTable).where(
        or(
          eq(quotesTable.referenceNo, refNo),
          drizzleSql`${quotesTable.legacyReferenceNos} @> ARRAY[${refNo}]::text[]`
        )
      ).limit(1);
      if (!quote) return res.status(404).json({ message: "Job not found" });

      let installerName: string | null = null;
      if (quote.assignedStaffId) {
        const [staff] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, quote.assignedStaffId));
        if (staff?.name) installerName = staff.name.split(" ")[0];
      }

      const updates = await db.select().from(jobUpdatesTable)
        .where(eq(jobUpdatesTable.quoteId, quote.id))
        .orderBy(desc(jobUpdatesTable.createdAt));

      // Customer-facing timeline shows key milestones only — filter out
      // internal admin bookkeeping like "Quote edited by admin" and review
      // request rows so the timeline reads as a clean status journey.
      const HIDDEN_FROM_PUBLIC = new Set(["review_requested", "edited"]);
      const publicUpdates = updates
        .filter(u => !HIDDEN_FROM_PUBLIC.has(u.statusChange))
        .map(u => ({
          statusChange: u.statusChange,
          note: u.actorType === "admin" || u.actorType === "staff" ? u.note : null,
          photoUrls: u.photoUrl
            ? (() => { try { return JSON.parse(u.photoUrl!); } catch { return [u.photoUrl]; } })()
            : [],
          createdAt: u.createdAt,
        }));

      res.json({
        referenceNo: quote.referenceNo,
        status: quote.status,
        scheduledAt: quote.scheduledAt,
        timeWindow: quote.timeWindow,
        preferredDate: quote.preferredDate,
        preferredTimeWindow: quote.preferredTimeWindow,
        serviceAddress: quote.serviceAddress,
        selectedServices: quote.selectedServices
          ? (() => { try { return JSON.parse(quote.selectedServices); } catch { return []; } })()
          : [],
        installerName,
        updates: publicUpdates,
      });
    } catch (err) {
      console.error("[public/track] error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // ── Admin: AI-scan floor plan / delivery order / photo for item detection ──
  app.post("/api/admin/jobs/scan-attachment", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const { fileData, fileType, fileName } = z.object({
        fileData: z.string().min(10),
        fileType: z.string(),
        fileName: z.string().optional().default("upload"),
      }).parse(req.body);

      const isImage = fileType.startsWith("image/");
      const isPdf   = fileType === "application/pdf";
      if (!isImage && !isPdf) {
        return res.status(400).json({ message: "Unsupported file type. Upload an image (PNG, JPG, WEBP) or PDF." });
      }

      const allItems = await storage.getCatalogItems();
      const byCategory: Record<string, string[]> = {};
      allItems.forEach(item => {
        const cat = item.category || "General";
        if (!byCategory[cat]) byCategory[cat] = [];
        const n = item.name;
        if (!byCategory[cat].includes(n)) byCategory[cat].push(n);
      });
      const catalogList = Object.entries(byCategory)
        .map(([cat, names]) => `${cat}: ${names.join(" | ")}`).join("\n");

      const systemPrompt = `You are a senior interior design consultant and furniture installation estimator for TMG Install, Singapore. You have 15 years of experience reading architectural drawings, office floor plans, furniture schedules, delivery orders, and installation quotations.

You are analyzing a document. Identify its type FIRST, then apply the matching rules:

TYPE A — OFFICE / COMMERCIAL FLOOR PLAN (architectural drawing with furniture layout)
TYPE B — FURNITURE SCHEDULE / FF&E SCHEDULE (table mapping item codes to descriptions + quantities)
TYPE C — DELIVERY ORDER / PACKING LIST (table with Item Code, Description, Colour, Qty columns)
TYPE D — RESIDENTIAL FLOOR PLAN (home layout with furniture symbols)
TYPE E — PHOTO of furniture, receipt, or handwritten list
TYPE F — QUOTATION / INVOICE / PROPOSAL (numbered line items with descriptions and amounts/prices already set)

═══════════════════════════════════════════
TYPE F — QUOTATION / INVOICE RULES (HIGHEST PRIORITY):
═══════════════════════════════════════════
If the document is a TYPE F (contains numbered line items with amounts, a subtotal/grand total, and scope/exclusion sections), apply these rules EXACTLY:
- Extract EVERY individual line item — do NOT skip any, do NOT stop early.
- SKIP any row that is a summary or total row. Specifically EXCLUDE any row whose description contains words like "subtotal", "sub-total", "total", "grand total", "final amount", "balance", "gst", "tax", or "deposit". These are summary rows, not billable items.
- Count only the individual work items (not summaries). For Edy-style documents: -1F has 7 items, 1F has 7 items, 2F has 5 items, 3F has 4 items = 23 items total. Output exactly 23 items.
- Use the line item description exactly as written (e.g. "Guest room installation labour", "Laundry room installation labour").
- Use the Amount column value as the unitPrice EXACTLY as a plain number string with no commas (e.g. "1800.00", "900.00").
- Set quantity = 1 for every line item.
- Set serviceType = "install" for installation work, "dismantle" for dismantling, "relocate" for relocation.
- DO NOT substitute catalog prices — use the prices from the document as-is.
- If a "Why this pricing" / "Remarks" / reason column exists, capture it in the "remark" field (concise, max 200 chars). Otherwise omit or set to null.
- Extract address from the document (project address field or header).
- Extract the client name and any scope/remarks as notes.
- Confidence = "high" if all line items and amounts are clearly readable.

═══════════════════════════════════════════
FLOOR PLAN READING RULES (TYPE A & B):
═══════════════════════════════════════════

Step 1 — FIND THE FURNITURE SCHEDULE / LEGEND
Most professional floor plans include a schedule table (often on a separate page or in a corner panel) that maps item codes (e.g. TB01, WS-A, CH.01) to full descriptions. This is your primary reference. Find it FIRST across all pages.

Step 2 — DECODE ITEM CODES
Match every code on the schedule to its description. Office furniture codes typically mean:
- WS / WK / DS = Workstation / Desk (may have sizes like 1200x600, 1400x700, L-shaped)
- TB / T = Table (conference, meeting, training, discussion)
- CH / C = Chair (task chair, visitor chair, training chair)
- SC / S = Soft seating (sofa, lounge chair, ottoman)
- ST = Storage / pedestal / cabinet
- SS / SH = Shelving / bookcase
- RD / RC = Reception desk / counter
- PT = Partition / screen panel
- WB = Whiteboard
- CB = Credenza / cabinet
- LC = Lounge chair

Step 3 — COUNT INSTANCES
Count how many times each item code appears on the floor plan layout pages. The quantity in your output must reflect the ACTUAL COUNT shown on the plan, not just what the schedule says.

Step 4 — IDENTIFY WHAT NEEDS INSTALLATION
Focus on items TMG Install would be hired to assemble/install:
- Workstations, desks, tables → assembly service
- Chairs → typically no installation (skip unless specifically bulky)
- Storage, pedestals, shelving → assembly
- Soft seating (sofas, lounge chairs) → delivery placement
- Partitions / screens → installation
- Whiteboards → wall mounting
- Reception desk / counters → installation

═══════════════════════════════════════════
DELIVERY ORDER / PACKING LIST RULES (TYPE C):
═══════════════════════════════════════════
- Each table row = one line item. Read EVERY row including the last rows.
- Colour column = finish/colour of the furniture (White, Oak, Grey, Walnut, Black). Include in item name: "PAX Wardrobe (White)".
- Qty column = the exact quantity to use. Never default to 1 if a Qty column exists.
- IKEA article numbers (e.g. 293.361.22) help identify the item — include them if helpful.

═══════════════════════════════════════════
SINGAPORE OFFICE FURNITURE PRICING (SGD) — for TYPE A/B/C/D/E only:
═══════════════════════════════════════════
- Single workstation / desk (straight): $60–$80
- L-shaped / corner workstation: $80–$120
- Back-to-back workstation cluster (per person): $60
- Meeting / conference table (small 4-6 pax): $100–$150
- Meeting table (large 8–12 pax): $150–$250
- Training / discussion table: $60–$80
- Bullet / modular table: $60–$80
- Reception desk / counter: $150–$300
- Sofa (2-seater): $80; (3-seater): $100
- Lounge / soft chair: $50
- Partition / screen panel (per piece): $40–$80
- Whiteboard (wall mount): $80
- Storage cabinet / pedestal: $50–$80
- Bookcase / open shelving: $50–$70
- Wardrobe (per unit): $100–$180
- Bed frame (residential): $60–$100

Available catalog items (for TYPE A/B/C/D/E only — NOT for TYPE F):
${catalogList}

Reply with ONLY valid JSON — no markdown, no code blocks:
{
  "items": [{"name":"full item name (colour/finish if applicable)","quantity":1,"unitPrice":"80.00","serviceType":"install","remark":"optional reason / why this pricing / scope note — null if none"}],
  "address": "full Singapore address or null",
  "notes": "client name, scope summary, floor level, lift access, or any special notes — null if none",
  "confidence": "high|medium|low"
}`;

      const userContent: any[] = [];

      let scanRes: any;
      if (isImage) {
        userContent.push(
          { type: "text", text: `Analyze this image. It may be a floor plan, delivery order, furniture photo, or furniture schedule.

If it is a FLOOR PLAN: identify item codes, read any legend/schedule panel, decode item codes to descriptions, and count how many of each item appears. Output full item names (not just codes like "TB01" — decode to "Bullet Discussion Table").

If it is a DELIVERY ORDER / TABLE: read every row. The Qty column = exact quantity. The Colour column = furniture finish (include in item name). Do not skip rows.

If it is a PHOTO: identify each visible furniture piece and estimate what assembly/installation work is needed.

List only items needing assembly, installation, or professional placement.` },
          { type: "image_url", image_url: { url: `data:${fileType};base64,${fileData}`, detail: "high" } }
        );
        scanRes = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 1500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        });
      } else {
        // PDF: smart two-stage approach
        // Stage 1 — try text extraction (works for text-layer PDFs like IKEA receipts, typed DOs)
        const pdfBuffer = Buffer.from(fileData, "base64");
        let pdfText = "";
        try {
          const pdfData = await pdfParse(pdfBuffer);
          pdfText = pdfData.text?.trim() || "";
        } catch (pdfErr: any) {
          console.warn("[scan-attachment] pdf-parse:", pdfErr.message);
        }

        if (pdfText.length > 100) {
          // Text-layer PDF — send as text prompt
          const pdfPrompt = `Analyze this PDF document "${fileName}".\n\nExtracted text content:\n---\n${pdfText.slice(0, 8000)}\n---\n\nFirst identify the document TYPE (A–F as defined in the system instructions). Then apply the matching rules for that type.\n\nFor TYPE F (quotation/invoice): extract EVERY numbered line item with its exact description and the Amount/price shown. Do NOT invent prices — use the amounts from the document. If a "Why this pricing" or reason/remark column is present, capture it in the remark field (concise summary, max 200 chars).\n\nFor other types: extract all relevant items (furniture, equipment) with item codes, names, quantities, colours, and any address or access notes visible.`;
          scanRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 2500,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: pdfPrompt },
            ],
          });
        } else {
          // Image-only / scanned PDF — convert pages to JPEG via pdftoppm, then use vision API
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tmg-pdf-"));
          const inputPath = path.join(tmpDir, "input.pdf");
          const imgPrefix = path.join(tmpDir, "page");
          const visionContent: any[] = [];

          try {
            fs.writeFileSync(inputPath, pdfBuffer);
            // Find pdftoppm — may be in PATH or a Nix store path
            let pdftoppmBin = "pdftoppm";
            try { pdftoppmBin = execSync("which pdftoppm", { timeout: 5000 }).toString().trim() || "pdftoppm"; } catch {}
            // Convert up to 5 pages at 250 dpi — sharper text for small floor plan annotations
            execSync(`"${pdftoppmBin}" -jpeg -r 250 -f 1 -l 5 "${inputPath}" "${imgPrefix}"`, { timeout: 45000 });

            const pageFiles = fs.readdirSync(tmpDir)
              .filter(f => f.startsWith("page") && f.endsWith(".jpg"))
              .sort()
              .slice(0, 5);

            if (pageFiles.length === 0) throw new Error("pdftoppm produced no output");

            // ── PASS 1: "reading" call — describe every page in detail (plain text) ──
            const readingContent: any[] = [];
            readingContent.push({ type: "text", text: `You are an experienced interior designer and space planner reading ${pageFiles.length} pages of a construction/fit-out document: "${fileName}".

For EACH page, describe in detail:

1. PAGE TYPE — Is it: (A) office/commercial floor plan, (B) furniture schedule table, (C) delivery order/packing list, (D) residential floor plan, (E) other?

2. LEGEND / KEY BOXES — Look for small colored boxes, colored lines, or colored rectangles anywhere on the page with item codes and counts (e.g. "TB01 × 7", "TB06A × 8"). Read EVERY legend entry — code AND quantity. These may be handwritten-style annotations. Look carefully in ALL corners and margins.

3. FURNITURE SCHEDULE TABLES — If there is a table mapping item codes to descriptions (e.g. "TB01 | Bullet Discussion Table | 1200mm"), read EVERY row.

4. OPEN PLAN WORKSTATIONS — Count individual desk/workstation symbols (small rectangles arranged in rows or clusters in large open areas). Give a specific count estimate (e.g. "approximately 80 individual workstation desks in open area"). Be as precise as possible.

5. MEETING ROOMS — List each meeting room with the table type and number of chairs/seats.

6. OTHER NOTABLE FURNITURE — Reception desks, storage units, soft seating, whiteboards, etc.

7. ADDRESS / LOCATION — Any project address, building name, floor level shown.

Output plain text — no JSON. Be thorough and precise. Aggregate nothing — just describe what you see on each page.` });

            for (const pf of pageFiles) {
              const imgBuf = fs.readFileSync(path.join(tmpDir, pf));
              const b64 = imgBuf.toString("base64");
              readingContent.push({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${b64}`, detail: "high" },
              });
            }

            const readingRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 3000,
              messages: [
                { role: "user", content: readingContent },
              ],
            });

            const pageDescription = readingRes.choices[0]?.message?.content?.trim() || "";

            // ── PASS 2: "structuring" call — aggregate and produce JSON ──
            visionContent.push({ type: "text", text: `A document analysis expert has read the ${pageFiles.length}-page document "${fileName}" and produced this detailed description of its contents:

---
${pageDescription}
---

Your job is to aggregate this information and produce a furniture installation quote.

AGGREGATION RULES:
- If the SAME item code (e.g. TB01) appears across multiple pages, ADD the quantities together (e.g. TB01×7 on page 1 + TB01×3 on page 2 = TB01 total 10).
- TB06 and TB06A are DIFFERENT items — list them separately.
- For open-plan workstations/desks counted from the floor plan, include them as one line item with the total count.
- If an item code has a description (from a schedule), use the full description. If not, use the code as the name (e.g. "TB01 Meeting Table").
- Exclude chairs/task chairs (no installation needed). Include tables, desks, workstations, storage, reception desks, soft seating, whiteboards, partitions.
- Skip items with 0 quantity.

Pricing reference (SGD):
- Open-plan workstation / hot desk (per desk): $60
- Meeting/discussion table (small <6 pax): $80–$100
- Meeting/boardroom table (large 8+ pax): $150–$200
- Bullet/modular discussion table: $60–$80
- Reception/counter desk: $150–$300
- Storage cabinet / pedestal: $50–$70
- Soft seating (sofa/lounge): $80–$100
- Whiteboard (wall-mount): $80
- Partition/screen panel: $50

${systemPrompt}` });

            scanRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 2000,
              messages: [
                { role: "user", content: visionContent },
              ],
            });
          } finally {
            // Clean up temp files
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
          }
        }
      }

      const raw = scanRes.choices[0]?.message?.content?.trim() || "{}";
      console.log(`[scan-attachment] raw GPT response (${raw.length} chars):`, raw.slice(0, 500));
      let parsed: any = {};
      try {
        let cleaned = raw.replace(/```(?:json)?\n?/g, "").replace(/\n?```/g, "").trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) cleaned = match[0];
        parsed = JSON.parse(cleaned);
      } catch (parseErr: any) {
        console.warn("[scan-attachment] JSON parse failed:", parseErr.message, "| raw snippet:", raw.slice(0, 300));
        parsed = {};
      }

      const parseUnitPrice = (v: any): string => {
        // Accept number or string, strip commas/spaces, keep up to 2 decimal places
        const raw = typeof v === "number" ? v.toString() : (typeof v === "string" ? v : "");
        const cleaned = raw.replace(/[,$\s]/g, "");           // remove commas, $, spaces
        const num = parseFloat(cleaned);
        if (isNaN(num) || num < 0) return "0.00";
        return num.toFixed(2);
      };

      const SUMMARY_KEYWORDS = /\b(subtotal|sub-total|sub total|grand total|grand-total|total labour|total labor|final amount|final payable|amount payable|gst|vat|tax|deposit due)\b/i;

      const items = Array.isArray(parsed.items) ? parsed.items
        .filter((item: any) => {
          const name = typeof item.name === "string" ? item.name : "";
          return !SUMMARY_KEYWORDS.test(name);  // drop subtotal/total rows
        })
        .slice(0, 60)
        .map((item: any) => ({
          name:        typeof item.name === "string"     ? item.name.slice(0, 200) : "Unknown Item",
          quantity:    typeof item.quantity === "number"  ? Math.max(1, Math.min(item.quantity, 50)) : 1,
          unitPrice:   parseUnitPrice(item.unitPrice),
          serviceType: typeof item.serviceType === "string" ? item.serviceType : "install",
          remark:      typeof item.remark === "string" && item.remark !== "null" ? item.remark.slice(0, 300) : null,
        })) : [];

      res.json({
        items,
        address:    typeof parsed.address === "string" && parsed.address !== "null" ? parsed.address.slice(0, 300) : null,
        notes:      typeof parsed.notes   === "string" && parsed.notes   !== "null" ? parsed.notes.slice(0, 500)   : null,
        confidence: ["high","medium","low"].includes(parsed.confidence)  ? parsed.confidence : "medium",
      });
    } catch (e: any) {
      console.error("[scan-attachment]", e.message);
      res.status(500).json({ message: e.message || "Scan failed" });
    }
  });

  // ── Admin: Create job manually (phone-in, IKEA direct, referral, etc.) ──────
  app.post("/api/admin/jobs/create", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
      const caller = await storage.getUserById(req.session.userId);
      if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });

      const body = z.object({
        customerName:     z.string().min(1),
        customerPhone:    z.string().min(6),
        customerEmail:    z.string().email().optional().nullable(),
        serviceAddress:   z.string().min(1),
        dropoffAddress:   z.string().optional().nullable(),
        isRelocation:     z.boolean().optional().default(false),
        scheduledDate:    z.string().optional().nullable(),
        timeWindow:       z.string().optional().nullable(),
        selectedServices: z.array(z.string()).optional().default([]),
        notes:            z.string().optional().nullable(),
        assignedStaffId:  z.number().int().positive().optional().nullable(),
        total:            z.string().optional().default("0"),
        depositAmount:    z.string().optional().default("0"),
        paymentStatus:    z.enum(["unpaid", "deposit_paid", "paid_in_full"]).optional().default("unpaid"),
        sourceChannel:    z.string().optional().default("whatsapp"),
        promoCode:        z.string().optional().nullable(),
        promoDiscount:    z.string().optional().default("0"),
        items:            z.array(z.object({
          description: z.string().min(1),
          quantity:    z.number().int().positive().default(1),
          unitPrice:   z.string().default("0"),
          remark:      z.string().nullable().optional(),
        })).optional().default([]),
      }).parse(req.body);

      const refNo = `TMG-${randomBytes(6).toString("hex").toUpperCase()}`;
      const phone = body.customerPhone.replace(/\D/g, "");

      let scheduledAt: Date | undefined;
      if (body.scheduledDate) {
        const startTime = body.timeWindow ? body.timeWindow.split("-")[0] : "09:00";
        scheduledAt = new Date(`${body.scheduledDate}T${startTime}:00+08:00`);
      }

      const subtotal = body.items.reduce((sum, item) => {
        return sum + (item.quantity * parseFloat(item.unitPrice || "0"));
      }, 0);

      // Validate + apply promo code server-side
      let promoDiscountAmt = parseFloat(body.promoDiscount || "0") || 0;
      let appliedPromoCode: string | null = body.promoCode?.trim().toUpperCase() || null;
      if (appliedPromoCode) {
        const promoRows = await db.select().from(promoCodes)
          .where(eq(promoCodes.code, appliedPromoCode)).limit(1);
        if (!promoRows.length || !promoRows[0].active || promoRows[0].usesCount >= promoRows[0].maxUses) {
          // Invalid or exhausted — silently clear
          appliedPromoCode = null;
          promoDiscountAmt = 0;
        } else {
          // Trust the discount amount sent from client (already validated there)
          promoDiscountAmt = parseFloat(promoRows[0].discountAmount) || promoDiscountAmt;
        }
      }

      const grandTotal = parseFloat(body.total || "0") || Math.max(0, subtotal - promoDiscountAmt);

      // Use real email if provided, otherwise use placeholder for WA-only customers
      const customerEmail = body.customerEmail?.trim() || `${phone}@tmginstall.com`;

      // Build items — include promo line if applicable
      const allItems = [
        ...body.items.map(item => ({
          originalDescription: item.description,
          serviceType:         "manual" as const,
          quantity:            item.quantity,
          unitPrice:           item.unitPrice,
          subtotal:            (item.quantity * parseFloat(item.unitPrice || "0")).toFixed(2),
          remark:              item.remark || null,
        })),
        ...(promoDiscountAmt > 0 && appliedPromoCode ? [{
          originalDescription: `Promo Discount (${appliedPromoCode})`,
          serviceType:         "discount" as const,
          quantity:            1,
          unitPrice:           (-promoDiscountAmt).toFixed(2),
          subtotal:            (-promoDiscountAmt).toFixed(2),
          remark:              null,
        }] : []),
      ];

      const quote = await storage.createQuote(
        {
          name: body.customerName,
          email: customerEmail,
          phone: body.customerPhone,
          companyName: undefined,
        },
        {
          referenceNo:         refNo,
          serviceAddress:      body.serviceAddress,
          dropoffAddress:      body.dropoffAddress || undefined,
          pickupAddress:       body.isRelocation ? body.serviceAddress : undefined,
          status:              "booked",
          sourceChannel:       body.sourceChannel || "whatsapp",
          customerWhatsappPhone: phone,
          selectedServices:    body.selectedServices?.length ? JSON.stringify(body.selectedServices) : undefined,
          scheduledAt:         scheduledAt,
          timeWindow:          body.timeWindow || undefined,
          assignedStaffId:     body.assignedStaffId || undefined,
          notes:               body.notes || undefined,
          subtotal:            subtotal.toFixed(2),
          total:               grandTotal.toFixed(2),
          // Always store 50/50 split — use admin override if provided, else auto-compute
          depositAmount:       parseFloat(body.depositAmount || "0") > 0
                                 ? body.depositAmount
                                 : (grandTotal * 0.50).toFixed(2),
          finalAmount:         parseFloat(body.depositAmount || "0") > 0
                                 ? (grandTotal - parseFloat(body.depositAmount)).toFixed(2)
                                 : (grandTotal * 0.50).toFixed(2),
          paymentStatus:       body.paymentStatus === "paid_in_full" ? "paid_in_full" : body.paymentStatus === "deposit_paid" ? "deposit_paid" : "unpaid",
          requiresManualReview: false,
          promoCode:           appliedPromoCode || undefined,
          promoDiscount:       promoDiscountAmt > 0 ? promoDiscountAmt.toFixed(2) : "0",
        },
        allItems
      );

      // T005: Fire-and-forget lead_submitted attribution event
      if (quote?.referenceNo) {
        logAttributionEvent(quote.id, quote.referenceNo, "lead_submitted", parseFloat(quote.total ?? "0"), quote.sourceChannel ?? undefined).catch(() => {});
      }

      // Decrement promo code usage count
      if (appliedPromoCode) {
        try {
          const promoRows = await db.select().from(promoCodes)
            .where(eq(promoCodes.code, appliedPromoCode)).limit(1);
          if (promoRows.length) {
            await db.update(promoCodes)
              .set({ usesCount: promoRows[0].usesCount + 1 })
              .where(eq(promoCodes.id, promoRows[0].id));
          }
        } catch (promoErr) {
          console.error("Promo decrement error (manual job):", promoErr);
        }
      }

      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Create manual job error:", err);
      res.status(500).json({ message: "Failed to create job" });
    }
  });

  app.get("/api/quotes/schedule", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const callerSched = await storage.getUserById(req.session.userId);
    if (!callerSched || callerSched.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const pending = await storage.getQuotesByStatuses(['booking_requested']);
      const confirmed = await storage.getQuotesByStatuses(['booked', 'assigned', 'in_progress', 'deposit_paid']);
      res.json({ pending, confirmed });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get(api.quotes.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const quote = await storage.getQuote(id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });

    if (req.session?.userId) {
      // Authenticated path: admin or assigned staff
      const caller = await storage.getUserById(req.session.userId);
      if (!caller) return res.status(401).json({ message: "Not logged in" });
      if (caller.role !== "admin") {
        const teammateIds = await storage.getTeammateIds(caller.id);
        const isAssignedToStaff = quote.assignedStaffId != null && teammateIds.includes(quote.assignedStaffId);
        const isAssignedToTeam = quote.assignedTeamId != null && caller.teamId != null && quote.assignedTeamId === caller.teamId;
        if (!isAssignedToStaff && !isAssignedToTeam) return res.status(403).json({ message: "Forbidden" });
      }
      return res.json(quote);
    }

    // Unauthenticated customer path: require referenceNo as ownership proof.
    // Accept either the current referenceNo or any legacyReferenceNos the
    // customer was previously sent — both are 48-bit-or-stronger tokens.
    const refParam = req.query.ref as string | undefined;
    const legacyOk = !!refParam && (quote.legacyReferenceNos ?? []).includes(refParam);
    if (!refParam || (refParam !== quote.referenceNo && !legacyOk)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Return quote with staff PII stripped using explicit typed projection
    type PublicUser = { id: number; name: string; role: string; teamId: number | null };
    function toPublicUser(u: typeof usersTable.$inferSelect): PublicUser {
      return { id: u.id, name: u.name, role: u.role, teamId: u.teamId ?? null };
    }
    const publicQuote = {
      ...quote,
      assignedStaff: quote.assignedStaff ? toPublicUser(quote.assignedStaff) : undefined,
      assignedTeam: quote.assignedTeam ? {
        ...quote.assignedTeam,
        members: quote.assignedTeam.members?.map(toPublicUser),
      } : undefined,
    };
    return res.json(publicQuote);
  });

  // AI quote from text description
  app.post(api.quotes.createFromCustomer.path, async (req, res) => {
    try {
      const input = api.quotes.createFromCustomer.input.parse(req.body);
      let aiParsedItems: any[] = [];
      let totalEstimate = 0;
      let aiConfidence = 100;
      let requiresReview = false;

      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an AI assistant for a furniture installation company in Singapore. 
              Extract furniture items and required services from the user's description.
              Valid service types are: 'install', 'dismantle', 'relocate', 'dispose', 'dismantle_dispose'.
              Use 'dispose' when customer wants to haul away assembled furniture (disposal only).
              Use 'dismantle_dispose' when customer wants furniture dismantled AND then disposed (bundle — cheaper).
              Estimate a reasonable unit price (in SGD, numerical value only) based on typical Singapore market rates.
              Return a JSON object with an 'items' array. Each item should have:
              - 'detectedName': string (e.g. 'IKEA Pax Wardrobe')
              - 'serviceType': string ('install', 'dismantle', 'relocate', 'dispose', or 'dismantle_dispose')
              - 'quantity': number
              - 'estimatedUnitPrice': number
              - 'confidence': number (0-100)
              Return ONLY valid JSON.`
            },
            { role: "user", content: input.itemsDescription }
          ],
          response_format: { type: "json_object" }
        });

        const parsedContent = JSON.parse(response.choices[0].message.content || '{"items":[]}');
        aiParsedItems = parsedContent.items || [];
        let lowestConfidence = 100;
        const catalogItems = await storage.getCatalogItems();

        aiParsedItems = aiParsedItems.map((item: any) => {
          totalEstimate += (item.estimatedUnitPrice * item.quantity);
          if (item.confidence < lowestConfidence) lowestConfidence = item.confidence;
          const matchedCatalogItem = catalogItems.find(c =>
            c.serviceType === item.serviceType &&
            (item.detectedName.toLowerCase().includes(c.name.toLowerCase()) ||
             c.name.toLowerCase().includes(item.detectedName.toLowerCase()) ||
             item.detectedName.toLowerCase().split(/\s+/).some((w: string) => w.length > 3 && c.name.toLowerCase().includes(w)))
          );
          return {
            originalDescription: input.itemsDescription,
            detectedName: item.detectedName,
            serviceType: item.serviceType as string,
            quantity: item.quantity,
            unitPrice: (matchedCatalogItem?.basePrice || item.estimatedUnitPrice).toString(),
            subtotal: ((matchedCatalogItem ? Number(matchedCatalogItem.basePrice) : item.estimatedUnitPrice) * item.quantity).toString(),
            catalogItemId: matchedCatalogItem?.id
          };
        });

        aiConfidence = lowestConfidence;
        requiresReview = aiConfidence < 80 || aiParsedItems.length === 0;
      } catch (err) {
        console.error("AI parsing failed", err);
        requiresReview = true;
        aiConfidence = 0;
        aiParsedItems = [{
          originalDescription: input.itemsDescription,
          detectedName: "Custom Item (Needs Review)",
          serviceType: "install",
          quantity: 1,
          unitPrice: "0",
          subtotal: "0"
        }];
      }

      const referenceNo = `TMG-${randomBytes(6).toString('hex').toUpperCase()}`;

      // ── Callout fee (non-relocation jobs) ────────────────────────────────────
      const hasRelocation = aiParsedItems.some(i => i.serviceType === "relocate");
      const calloutFeeAdj = hasRelocation ? 0 : PricingConfig.callout.fee;
      if (calloutFeeAdj > 0) {
        aiParsedItems.push({
          originalDescription: "Mobilisation & Coordination",
          detectedName: "Mobilisation & Coordination",
          serviceType: "surcharge",
          quantity: 1,
          unitPrice: calloutFeeAdj.toFixed(2),
          subtotal: calloutFeeAdj.toFixed(2),
        });
      }
      const grandTotalLegacy = totalEstimate + calloutFeeAdj;
      // ────────────────────────────────────────────────────────────────────────

      const depositAmount = (grandTotalLegacy * 0.50).toFixed(2);
      const finalAmount = (grandTotalLegacy * 0.50).toFixed(2);

      const quote = await storage.createQuote(
        input.customer,
        {
          referenceNo,
          serviceAddress: input.serviceAddress,
          status: 'submitted',
          subtotal: totalEstimate.toFixed(2),
          total: grandTotalLegacy.toFixed(2),
          depositAmount,
          finalAmount,
          aiConfidenceScore: aiConfidence,
          requiresManualReview: requiresReview,
          paymentStatus: 'unpaid'
        },
        aiParsedItems
      );

      // T005: Fire-and-forget lead_submitted attribution event
      if (quote?.referenceNo) {
        logAttributionEvent(quote.id, quote.referenceNo, "lead_submitted", parseFloat(quote.total ?? "0"), quote.sourceChannel ?? undefined).catch(() => {});
      }

      // Alert admin on new estimate submission (awaited so it completes before response)
      try {
        const alertHtml = newEstimateAdminAlert(quote);
        const alertOk = await sendEmail({
          to: ADMIN_EMAIL,
          subject: `🔔 New Estimate Request — ${quote.referenceNo} from ${quote.customer?.name}`,
          html: alertHtml,
        });
        if (alertOk) console.log(`[email] admin alert sent to ${ADMIN_EMAIL} for ${quote.referenceNo}`);
        else console.error(`[email] admin alert FAILED for ${quote.referenceNo}`);
      } catch (alertErr) {
        console.error("[email] admin alert error:", alertErr);
      }

      // ── Apply loyalty discount for returning customers ─────────────────────
      try {
        if (input.customer?.email) {
          await applyLoyaltyDiscount(quote.id, input.customer.email);
        }
      } catch (loyaltyErr) {
        console.error("[loyalty] error applying discount:", loyaltyErr);
      }

      res.status(201).json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update status (generic)
  app.patch(api.quotes.updateStatus.path, async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const callerStatus = await storage.getUserById(req.session.userId);
    if (!callerStatus || callerStatus.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const input = api.quotes.updateStatus.input.parse(req.body);
      
      const quote = await storage.updateQuoteStatus(
        id,
        input.status,
        {
          actorType: 'admin',
          note: input.note,
          photoUrl: input.photoUrl,
          gpsLat: input.gpsLat ? input.gpsLat.toString() : undefined,
          gpsLng: input.gpsLng ? input.gpsLng.toString() : undefined
        },
        input.assignedStaffId,
        input.assignedTeamId
      );
      
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // T005: Fire-and-forget attribution hook (non-blocking)
      if (input.status === "booked" && quote.referenceNo) {
        logAttributionEvent(quote.id, quote.referenceNo, "booking_confirmed", parseFloat(quote.total ?? "0"), undefined, { trigger: "admin" }).catch(() => {});
      }

      // Send push notification when a job is assigned to staff
      if (input.assignedStaffId) {
        const tokens = await storage.getFcmTokensByUserIds([input.assignedStaffId]);
        if (tokens.length > 0) {
          const addr = quote.serviceAddress?.split(",")[0] || "New job";
          await sendPushNotification(
            tokens,
            "Job Assigned — TMG Install",
            `You've been assigned to ${addr}`,
            { jobId: String(quote.id), path: `/staff/jobs/${quote.id}` }
          );
        }
      }

      // Send push notification when job status changes to in_progress (staff arrival confirmed)
      if (input.status === "booked" || input.status === "assigned") {
        const staffIds: number[] = [];
        if (quote.assignedStaffId) staffIds.push(quote.assignedStaffId);
        if (staffIds.length > 0) {
          const tokens = await storage.getFcmTokensByUserIds(staffIds);
          if (tokens.length > 0) {
            const date = quote.scheduledAt
              ? new Date(quote.scheduledAt).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })
              : "your scheduled date";
            await sendPushNotification(
              tokens,
              "Job Confirmed — TMG Install",
              `Job ${quote.referenceNo} confirmed for ${date}`,
              { jobId: String(quote.id), path: `/staff/jobs/${quote.id}` }
            );
          }
        }
      }

      // Send deposit request when admin sets status to deposit_requested
      if (input.status === "deposit_requested" && quote.customer) {
        const depositAmt = parseFloat(quote.depositAmount || "0") || parseFloat(quote.total) * 0.5;
        const quotePageUrl = `${APP_URL}/quotes/${quote.id}?ref=${quote.referenceNo}`;
        const stripeUrl = await createStripePaymentLink(
          `Deposit for ${quote.referenceNo} — TMG Install`,
          depositAmt,
          { quoteId: String(quote.id), type: "deposit", referenceNo: quote.referenceNo },
          quotePageUrl
        );
        const paymentLink = stripeUrl || quotePageUrl;

        // Determine if the customer has a real email (WhatsApp customers get placeholder
        // emails like "65XXXXXXXX@tmginstall.com" — these can never receive emails)
        const hasRealEmail = quote.customer.email &&
          !quote.customer.email.endsWith("@tmginstall.com") &&
          quote.customer.email.includes("@");

        if (hasRealEmail) {
          const emailHtml = depositRequestEmail(quote, paymentLink);
          const sent = await sendEmail({
            to: quote.customer.email,
            subject: `[${quote.referenceNo}] Deposit Payment Required — TMG Install`,
            html: emailHtml,
          });
          if (sent) {
            console.log(`[Deposit] Email sent to ${quote.customer.email} for ${quote.referenceNo}`);
          } else {
            console.error(`[Deposit] Email FAILED to ${quote.customer.email} for ${quote.referenceNo} — falling back to WhatsApp`);
            // Fall through to WhatsApp below
          }
        }

        // Always send WhatsApp when a phone number is available — email and WhatsApp
        // fire independently so customers get payment links on both channels.
        const rawWaPhone2 = quote.customerWhatsappPhone || quote.customer?.phone;
        const waPhone2 = rawWaPhone2 ? normalizeSGPhone(rawWaPhone2) : null;
        if (waPhone2) {
          const shortPayUrl = `${APP_URL}/pay/${quote.referenceNo}`;
          const slotLine = formatSlotLineForQuote(quote);
          const waMsg =
            `Hi *${quote.customer.name || "there"}* 👋\n\n` +
            `Your quote *${quote.referenceNo}* has been approved by TMG Install!\n\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `💰 *50% Deposit Required: S$${depositAmt.toFixed(2)}*\n` +
            `${slotLine}` +
            `Your slot is reserved once we receive your deposit.\n` +
            `━━━━━━━━━━━━━━━━━━━━\n\n` +
            waPayBlock(depositAmt, shortPayUrl) +
            `\n\n_Slot held for 48 hours. Reply here if you need help._`;
          const waSent = await sendWhatsAppMessage(waPhone2, waMsg).catch(() => false);
          if (waSent) {
            console.log(`[Deposit] WhatsApp payment link sent to ${waPhone2} for ${quote.referenceNo}`);
          } else {
            console.error(`[Deposit] WhatsApp send FAILED to ${waPhone2} for ${quote.referenceNo}`);
          }
        }
      }

      // Auto-send review request via WhatsApp when job is marked completed.
      // Default behaviour: send immediately on completion. Admins who want
      // the older "only after a 4+★ rating reply" gating can flip
      // `ai_review_after_rating_only` ON in Settings — same semantics as
      // the case-closed path in sendCaseClosedNotifications.
      if (input.status === "completed" && quote.customerWhatsappPhone) {
        let reviewAfterRatingOnly = false;
        try {
          const [rrFlag] = await db.select().from(aiFeatureFlags)
            .where(eq(aiFeatureFlags.key, "ai_review_after_rating_only")).limit(1);
          if ((rrFlag as any)?.value === true) reviewAfterRatingOnly = true;
        } catch {}

        if (!reviewAfterRatingOnly) {
          const [reviewSetting] = await db.select().from(appSettings).where(eq(appSettings.key, "google_review_url"));
          const reviewUrl = reviewSetting?.value;
          if (reviewUrl) {
            const alreadySent = (quote.updates ?? []).some(u => u.statusChange === "review_requested");
            if (!alreadySent) {
              const phone = normalizeSGPhone(quote.customerWhatsappPhone);
              // CLAIM-THEN-SEND: write the marker first so any racing path
              // sees it and skips. We accept a possible missed message over
              // a possible duplicate one.
              await storage.addJobUpdate({
                quoteId: id,
                statusChange: "review_requested",
                actorType: "system",
                note: "Review request sent via WhatsApp (status=completed path)",
              });
              const msg = `Hi! 👋 Thank you for choosing *TMG Install* — we hope the installation went smoothly!\n\nIf you're happy with the service, we'd truly appreciate a quick Google review — it helps us a lot:\n\n${reviewUrl}\n\n_Thank you for your support!_ 🙏`;
              await sendWhatsAppMessage(phone, msg).catch(() => {});
            }
          }
        }
      }

      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Customer pays deposit (mock)
  app.patch(api.quotes.updatePayment.path, async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const callerPayment = await storage.getUserById(req.session.userId);
    if (!callerPayment || callerPayment.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const input = api.quotes.updatePayment.input.parse(req.body);
      const quote = await storage.updateQuotePayment(id, input.paymentType, input.amount);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      
      // After deposit paid, send slot confirmation email + WhatsApp tracking link
      if (input.paymentType === 'deposit' && quote.customer) {
        const hasRealEmailDep = quote.customer.email &&
          !quote.customer.email.endsWith("@tmginstall.com") &&
          quote.customer.email.includes("@");
        if (hasRealEmailDep) {
          const emailHtml = depositReceivedEmail(quote);
          await sendEmail({
            to: quote.customer.email,
            subject: `[${quote.referenceNo}] Deposit Received — Slot Confirmed!`,
            html: emailHtml,
          });
        }
        const rawTrackPhone = quote.customerWhatsappPhone || quote.customer?.phone;
        const trackPhone = rawTrackPhone ? normalizeSGPhone(rawTrackPhone) : null;
        if (trackPhone) {
          const trackMsg = `✅ *Deposit received — your job is confirmed!*\n\nTrack your installation progress here:\n${APP_URL}/track/${quote.referenceNo}\n\n_We'll be in touch shortly to confirm your schedule._ 👷`;
          await sendWhatsAppMessage(trackPhone, trackMsg).catch(() => {});
        }
      }

      // After final payment, send case-closed notification (dual-channel) + Google review
      if (input.paymentType === 'final' && quote.customer) {
        await sendCaseClosedNotifications(quote);
      }

      res.json(quote);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Create on-demand Stripe checkout session (for quote page button)
  app.get("/api/quotes/:id/checkout", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const type = (req.query.type as string) || "deposit";
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      const quotePageUrl = `${APP_URL}/quotes/${quote.id}?ref=${quote.referenceNo}`;
      let amount: number;
      let description: string;

      if (type === "deposit") {
        amount = parseFloat(quote.depositAmount || "0") || parseFloat(quote.total) * 0.5;
        description = `Deposit for ${quote.referenceNo} — TMG Install`;
      } else {
        const totalFinal = parseFloat(quote.total || "0");
        const depositFinal = parseFloat(quote.depositAmount || "0") || totalFinal * 0.5;
        amount = parseFloat(quote.finalAmount || "0") > 0
          ? parseFloat(quote.finalAmount!)
          : Math.max(0, totalFinal - depositFinal);
        description = `Balance Payment for ${quote.referenceNo} — TMG Install`;
      }

      const stripeUrl = await createStripePaymentLink(
        description,
        amount,
        { quoteId: String(quote.id), type, referenceNo: quote.referenceNo },
        quotePageUrl
      );

      if (!stripeUrl) return res.status(500).json({ message: "Stripe not configured" });
      res.json({ url: stripeUrl });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Verify Stripe session and update quote status (webhook-free fallback)
  app.post("/api/quotes/:id/verify-payment", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { session_id, referenceNo: vpRefNo } = z.object({
        session_id: z.string(),
        referenceNo: z.string().optional(),
      }).parse(req.body);

      // Ownership proof: admin session OR matching referenceNo
      const vpQuote = await storage.getQuote(id);
      if (!vpQuote) return res.status(404).json({ message: "Quote not found" });
      if (req.session?.userId) {
        const callerVp = await storage.getUserById(req.session.userId);
        if (!callerVp || callerVp.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      } else {
        if (!vpRefNo || vpRefNo !== vpQuote.referenceNo) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      if (!stripe) return res.status(500).json({ message: "Stripe not configured" });

      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not completed" });
      }

      // Stripe session binding: ensure this Stripe session belongs to the requested quote
      const metaQuoteId = session.metadata?.quoteId;
      if (!metaQuoteId || parseInt(metaQuoteId) !== id) {
        return res.status(403).json({ message: "Payment session does not match this quote" });
      }

      const { type } = session.metadata || {};
      if (!type) return res.status(400).json({ message: "Missing payment type" });

      const amountPaid = ((session.amount_total ?? 0) / 100).toFixed(2);

      // Check if webhook already processed this payment (to avoid double email)
      const existingQuote = await storage.getQuote(id);
      const alreadyProcessedByWebhook =
        type === "deposit" ? !!existingQuote?.depositPaidAt : !!existingQuote?.finalPaidAt;

      const quote = await storage.updateQuotePayment(id, type as "deposit" | "final", amountPaid);

      if (!quote || !quote.customer) return res.status(200).json({ status: "ok" });

      // T005: Fire-and-forget attribution hook (Stripe payment)
      if (!alreadyProcessedByWebhook && quote.referenceNo) {
        const evtType = type === "deposit" ? "deposit_paid" : "final_paid";
        logAttributionEvent(quote.id, quote.referenceNo, evtType, parseFloat(quote.total ?? "0"), undefined, { channel: "stripe" }).catch(() => {});
      }

      if (!alreadyProcessedByWebhook) {
        const hasRealEmailVp = quote.customer.email &&
          !quote.customer.email.endsWith("@tmginstall.com") &&
          quote.customer.email.includes("@");

        if (type === "deposit") {
          if (hasRealEmailVp) {
            await sendEmail({
              to: quote.customer.email,
              subject: `[${quote.referenceNo}] Deposit Received — Slot Confirmed!`,
              html: depositReceivedEmail(quote),
            });
          }
          // Send tracker link via WhatsApp (fallback to customer.phone for web-booked)
          const rawVpPhone = quote.customerWhatsappPhone || quote.customer?.phone;
          const vpTrackPhone = rawVpPhone ? normalizeSGPhone(rawVpPhone) : null;
          if (vpTrackPhone) {
            const trackMsg = `✅ *Deposit received — your job is confirmed!*\n\nTrack your installation progress here:\n${APP_URL}/track/${quote.referenceNo}\n\n_We'll be in touch shortly to confirm your schedule._ 👷`;
            await sendWhatsAppMessage(vpTrackPhone, trackMsg).catch(() => {});
          }
          console.log(`Payment verified (no-webhook): deposit paid for ${quote.referenceNo}`);
        }

        if (type === "final") {
          await sendCaseClosedNotifications(quote);
          console.log(`Payment verified (no-webhook): final paid for ${quote.referenceNo}`);
        }
      } else {
        console.log(`Payment verify: webhook already processed ${type} for ${quote.referenceNo} — skipping email`);
      }

      res.json({ status: "ok", quote });
    } catch (err: any) {
      console.error("Payment verification error:", err);
      res.status(400).json({ message: err.message || "Verification failed" });
    }
  });

  // Customer requests booking slot
  app.post("/api/quotes/:id/booking-request", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { scheduledAt, timeWindow, referenceNo } = z.object({
        scheduledAt: z.string(),
        timeWindow: z.string(),
        referenceNo: z.string().optional(),
      }).parse(req.body);

      const existingQuote = await storage.getQuote(id);
      if (!existingQuote) return res.status(404).json({ message: "Quote not found" });

      // Authenticated path: only admins may act on behalf of a customer
      if (req.session?.userId) {
        const callerBr = await storage.getUserById(req.session.userId);
        if (!callerBr || callerBr.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      } else {
        // Unauthenticated customer: require referenceNo as ownership proof
        if (!referenceNo || referenceNo !== existingQuote.referenceNo) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      // Only allow if deposit is paid and no pending/confirmed booking
      if (!['deposit_paid', 'booking_requested'].includes(existingQuote.status)) {
        return res.status(400).json({ message: "Booking can only be requested after deposit is paid" });
      }

      // Block second request if already pending
      if (existingQuote.status === 'booking_requested') {
        return res.status(400).json({ message: "A booking request is already pending admin confirmation" });
      }

      const quote = await storage.requestBooking(id, new Date(scheduledAt), timeWindow);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // Notify admin
      const adminEmailHtml = bookingRequestAdminEmail(quote);
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[${quote.referenceNo}] New Booking Request — ${quote.customer?.name}`,
        html: adminEmailHtml,
      });

      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin confirms booking
  app.post("/api/quotes/:id/booking-confirm", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const callerBooking = await storage.getUserById(req.session.userId);
    if (!callerBooking || callerBooking.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const quote = await storage.confirmBooking(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // Send booking confirmation email to customer
      if (quote.customer) {
        const emailHtml = bookingConfirmationEmail(quote);
        await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Booking Confirmed ✅ — TMG Install`,
          html: emailHtml,
        });
      }

      res.json(quote);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Customer reschedules booking
  app.post("/api/quotes/:id/booking-reschedule", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { scheduledAt, timeWindow, referenceNo: rescheduleRef } = z.object({
        scheduledAt: z.string(),
        timeWindow: z.string(),
        referenceNo: z.string().optional(),
      }).parse(req.body);

      const existingQuote = await storage.getQuote(id);
      if (!existingQuote) return res.status(404).json({ message: "Quote not found" });

      // Authenticated path: only admins may reschedule on behalf of a customer
      if (req.session?.userId) {
        const callerRs = await storage.getUserById(req.session.userId);
        if (!callerRs || callerRs.role !== "admin") return res.status(403).json({ message: "Forbidden" });
      } else {
        // Unauthenticated customer: require referenceNo as ownership proof
        if (!rescheduleRef || rescheduleRef !== existingQuote.referenceNo) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }

      // Must be booked (confirmed) to reschedule
      if (!['booked'].includes(existingQuote.status)) {
        return res.status(400).json({ message: "Can only reschedule a confirmed booking" });
      }

      // Check reschedule count
      if ((existingQuote.rescheduledCount || 0) >= 1) {
        return res.status(400).json({ message: "Free reschedule already used. Please contact us on WhatsApp." });
      }

      // Check 48hr cutoff (per Terms of Service)
      if (existingQuote.scheduledAt) {
        const hoursDiff = (new Date(existingQuote.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursDiff < 48) {
          return res.status(400).json({ message: "Reschedule requests must be made at least 48 hours before your appointment. A S$30 fee applies for late rescheduling — please contact us on WhatsApp." });
        }
      }

      const quote = await storage.rescheduleBooking(id, new Date(scheduledAt), timeWindow);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // Send reschedule confirmation to customer
      if (quote.customer) {
        const emailHtml = rescheduleConfirmationEmail(quote);
        await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Reschedule Request Received`,
          html: emailHtml,
        });
      }

      // Notify admin
      const adminEmailHtml = bookingRequestAdminEmail(quote);
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[${quote.referenceNo}] Reschedule Request — ${quote.customer?.name}`,
        html: adminEmailHtml,
      });

      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Legacy booking update (kept for backward compatibility)
  app.patch(api.quotes.updateBooking.path, async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const callerUpdateBooking = await storage.getUserById(req.session.userId);
    if (!callerUpdateBooking || callerUpdateBooking.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const input = api.quotes.updateBooking.input.parse(req.body);
      const quote = await storage.requestBooking(id, new Date(input.scheduledAt), input.timeWindow);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json(quote);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Staff: Arrived check-in (GPS + photos)
  app.post("/api/quotes/:id/arrived", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const id = parseInt(req.params.id);
      const { gpsLat, gpsLng, photoUrls, note } = z.object({
        gpsLat: z.number(),
        gpsLng: z.number(),
        photoUrls: z.array(z.string()).min(1, "At least one photo is required"),
        note: z.string().optional()
      }).parse(req.body);

      const quote = await storage.updateQuoteStatus(id, 'in_progress', {
        actorType: 'staff',
        note: note || 'Staff arrived at location',
        photoUrl: JSON.stringify(photoUrls),
        gpsLat: gpsLat.toString(),
        gpsLng: gpsLng.toString()
      });

      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Staff: Completed check-out (GPS + photos)
  app.post("/api/quotes/:id/completed-checkout", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    try {
      const id = parseInt(req.params.id);
      const { gpsLat, gpsLng, photoUrls, note } = z.object({
        gpsLat: z.number(),
        gpsLng: z.number(),
        photoUrls: z.array(z.string()).min(1, "At least one completion photo is required"),
        note: z.string().optional()
      }).parse(req.body);

      const quote = await storage.updateQuoteStatus(id, 'completed', {
        actorType: 'staff',
        note: note || 'Job completed',
        photoUrl: JSON.stringify(photoUrls),
        gpsLat: gpsLat.toString(),
        gpsLng: gpsLng.toString()
      });

      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // ── Auto overtime calculation for relocation jobs ─────────────────────────
      // If this is a relocation job, look up the arrival time and calculate overtime
      try {
        const raw = quote as any;
        const svc: string[] = Array.isArray(raw.selectedServices)
          ? raw.selectedServices
          : (raw.selectedServices ? (() => { try { return JSON.parse(raw.selectedServices); } catch { return []; } })() : []);
        const isRelocation = svc.includes('relocate') || (!!raw.pickupAddress && !!raw.dropoffAddress);

        // D&R items have unitPrice > 0 for relocate service — no overtime applies
        const quoteItemsList: any[] = Array.isArray(raw.items) ? raw.items : [];
        const hasDRItems = quoteItemsList.some(
          (item: any) => item.serviceType === 'relocate' && parseFloat(item.unitPrice ?? '0') > 0
        );

        if (isRelocation && hasDRItems) {
          console.log(`[Overtime] Quote #${id}: D&R job — no overtime charge applied`);
        }

        if (isRelocation && !hasDRItems) {
          // Find the most recent in_progress update (arrival time)
          const [arrivalUpdate] = await db
            .select()
            .from(jobUpdatesTable)
            .where(and(
              eq(jobUpdatesTable.quoteId, id),
              eq(jobUpdatesTable.statusChange, 'in_progress')
            ))
            .orderBy(desc(jobUpdatesTable.createdAt))
            .limit(1);

          if (arrivalUpdate?.createdAt) {
            const durationMinutes = Math.floor(
              (Date.now() - new Date(arrivalUpdate.createdAt).getTime()) / 60000
            );
            const { blocks, charge } = calcOvertimeCharge(durationMinutes);

            if (charge > 0) {
              const overtimeNote = `Overtime: ${blocks} block${blocks !== 1 ? 's' : ''} × $${PricingConfig.overtime.blockRate} — job ran ${durationMinutes} min (${durationMinutes - PricingConfig.overtime.capMinutes} min over ${PricingConfig.overtime.capMinutes}-min allowance)`;
              await storage.updateAdditionalCharge(id, charge.toFixed(2), overtimeNote);
              console.log(`[Overtime] Quote #${id}: ${durationMinutes} min → $${charge.toFixed(2)} auto-applied`);
            } else {
              console.log(`[Overtime] Quote #${id}: ${durationMinutes} min — within ${PricingConfig.overtime.capMinutes}-min allowance, no charge`);
            }
          }
        }
      } catch (overtimeErr) {
        // Non-fatal: log but don't fail the checkout
        console.error(`[Overtime] Auto-calc error for quote #${id}:`, overtimeErr);
      }
      // ─────────────────────────────────────────────────────────────────────────

      // Re-fetch quote to include any overtime charge just applied
      const finalQuote = await storage.getQuote(id);
      res.json(finalQuote || quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin: Edit quote before deposit
  app.patch("/api/quotes/:id/edit", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const callerEdit = await storage.getUserById(req.session.userId);
    if (!callerEdit || callerEdit.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getQuote(id);
      if (!existing) return res.status(404).json({ message: "Quote not found" });

      // Allow editing before and after deposit is paid, plus admin-created booked/assigned jobs.
      // booking_pending and in_progress are also editable so admins can reschedule a job
      // that's already been started or is sitting in the date-TBD state.
      const editableStatuses = ['submitted', 'under_review', 'approved', 'deposit_requested', 'deposit_paid', 'booking_pending', 'booked', 'assigned', 'in_progress'];
      if (!editableStatuses.includes(existing.status)) {
        return res.status(400).json({ message: "Quote cannot be edited in its current status" });
      }

      const { customerUpdates, quoteUpdates, items } = z.object({
        customerUpdates: z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          companyName: z.string().nullable().optional(),
          companyUen: z.string().nullable().optional(),
          billingAddress: z.string().nullable().optional(),
        }).optional(),
        quoteUpdates: z.object({
          serviceAddress: z.string().optional(),
          pickupAddress: z.string().optional(),
          dropoffAddress: z.string().optional(),
          transportFee: z.string().optional(),
          selectedServices: z.string().optional(),
          notes: z.string().optional(),
          staffTransportAllowance: z.boolean().optional(),
          scheduledAt: z.string().datetime().optional().nullable().transform(v => v ? new Date(v) : v),
          timeWindow: z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, "Invalid time window").optional().nullable(),
          // Allow admin to flip the status when "marking as pending date confirmation"
          // (in_progress/booked/assigned → booking_pending) or after picking a new
          // date for a job currently sitting in booking_pending (booking_pending → booked).
          status: z.enum(['booking_pending', 'booked']).optional(),
          // Invoice / billing presentation
          invoiceType: z.enum(['residential', 'commercial']).optional(),
          billingAddress: z.string().nullable().optional(),
          billingCompanyName: z.string().nullable().optional(),
          billingCompanyUen: z.string().nullable().optional(),
          poNumber: z.string().nullable().optional(),
        }).optional(),
        items: z.array(z.object({
          catalogItemId: z.number().nullable().optional(),
          originalDescription: z.string(),
          detectedName: z.string().nullable().optional(),
          serviceType: z.string(),
          quantity: z.number().min(1),
          unitPrice: z.string(),
          subtotal: z.string(),
        })).optional(),
      }).parse(req.body);

      const updated = await storage.editQuote(id, { customerUpdates, quoteUpdates, items });
      if (!updated) return res.status(404).json({ message: "Quote not found" });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("[quotes/:id/edit] failed:", err?.message, err?.stack);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin: Save additional post-job charges (overtime, access issues, extra items)
  app.patch("/api/quotes/:id/additional-charges", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const callerCharges = await storage.getUserById(req.session.userId);
    if (!callerCharges || callerCharges.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const { additionalCharge, additionalChargeNote } = z.object({
        additionalCharge: z.string(),
        additionalChargeNote: z.string().optional().default(""),
      }).parse(req.body);
      const quote = await storage.updateAdditionalCharge(id, additionalCharge, additionalChargeNote);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin: Request final payment (email for real emails, WhatsApp for chatbot customers)
  app.post("/api/quotes/:id/request-final-payment", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const callerFinalPay = await storage.getUserById(req.session.userId);
    if (!callerFinalPay || callerFinalPay.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const quote = await storage.getQuote(id);
      
      if (!quote || !quote.customer) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Balance = total minus deposit already paid (never charge the full total again)
      // Fixed-price installation — balance is simply total minus deposit paid, no overtime
      const totalAmt = parseFloat(quote.total || "0");
      const depositPaid = parseFloat(quote.depositAmount || "0") || totalAmt * 0.5;
      const finalAmount = parseFloat(quote.finalAmount || "0") > 0
        ? parseFloat(quote.finalAmount!)
        : Math.max(0, totalAmt - depositPaid);
      const quotePageUrl = `${APP_URL}/quotes/${quote.id}?ref=${quote.referenceNo}`;
      const stripeUrl = await createStripePaymentLink(
        `Balance Payment for ${quote.referenceNo} — TMG Install`,
        finalAmount,
        { quoteId: String(quote.id), type: "final", referenceNo: quote.referenceNo },
        quotePageUrl
      );
      const paymentLink = stripeUrl || quotePageUrl;

      // Send via BOTH channels independently — email AND WhatsApp when both are available.
      // Previously WhatsApp was only a fallback; now both fire so the customer gets notified
      // regardless of which channel they check first.
      const hasRealEmail = quote.customer.email &&
        !quote.customer.email.endsWith("@tmginstall.com") &&
        quote.customer.email.includes("@");

      const channels: string[] = [];
      let emailOk = false;
      let waOk = false;

      // ── Channel 1: Email ──────────────────────────────────────────────────
      if (hasRealEmail) {
        const emailHtml = finalPaymentEmail(quote, paymentLink);
        emailOk = await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Final Payment Due — TMG Install`,
          html: emailHtml,
        });
        if (emailOk) {
          channels.push(`email:${quote.customer.email}`);
          console.log(`[FinalPayment] Email sent to ${quote.customer.email} for ${quote.referenceNo}`);
        } else {
          console.error(`[FinalPayment] Email FAILED for ${quote.referenceNo}`);
        }
      }

      // ── Channel 2: WhatsApp — always attempt when a phone is available ────
      const rawWaPhone = quote.customerWhatsappPhone || quote.customer?.phone;
      const waPhone = rawWaPhone ? normalizeSGPhone(rawWaPhone) : null;
      if (waPhone) {
        const shortPayUrl = `${APP_URL}/pay/${quote.referenceNo}?type=final`;
        const waMsg =
          `Hi *${quote.customer.name || "there"}* 👋\n\n` +
          `Your installation for *${quote.referenceNo}* is now complete. Thank you for choosing TMG Install! 🙏\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💳 *Balance Due: S$${finalAmount.toFixed(2)}*\n` +
          `_(50% balance payment — deposit already received)_\n` +
          `Please clear the balance to close your job.\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          waPayBlock(finalAmount, shortPayUrl) +
          `\n\n_We hope to serve you again. Reply here if you need help._`;
        const waSent = await sendWhatsAppMessage(waPhone, waMsg).catch(() => false);
        waOk = !!waSent;
        if (waOk) {
          channels.push(`whatsapp:+${waPhone}`);
          console.log(`[FinalPayment] WhatsApp sent to +${waPhone} for ${quote.referenceNo}`);
        } else {
          console.error(`[FinalPayment] WhatsApp FAILED to +${waPhone} for ${quote.referenceNo}`);
        }
      }

      const sendOk = emailOk || waOk;
      const channel = waOk ? "whatsapp" : "email";
      const channelTarget = waOk ? `+${waPhone}` : (quote.customer.email || "");

      if (!sendOk) {
        return res.status(500).json({ message: "Could not send final payment notification — no valid email or WhatsApp number." });
      }

      const updated = await storage.updateQuoteStatus(id, "final_payment_requested", {
        actorType: "admin",
        note: emailOk && waOk
          ? `Final payment request sent via WhatsApp (+${waPhone}) and email (${quote.customer.email})`
          : `Final payment request sent via ${channel} to ${channelTarget}`
      });

      const bothSent = emailOk && waOk;
      const messageText = bothSent
        ? `Final payment link sent via WhatsApp + email`
        : waOk
          ? `Final payment link sent via WhatsApp to +${waPhone}`
          : `Final payment invoice sent via email to ${channelTarget}`;

      res.json({
        success: true,
        channel,
        channelTarget,
        emailSent: emailOk,
        whatsappSent: waOk,
        message: messageText,
        quote: updated,
      });
    } catch (err) {
      console.error("Error requesting final payment:", err);
      res.status(500).json({ message: "Failed to request final payment" });
    }
  });

  // Admin: list outstanding Net-30 commercial invoices for the dashboard
  // widget. Returns the in-flight invoice set (sent, unpaid) with computed
  // days-outstanding, due date, and bucket (current / due-soon / overdue).
  app.get("/api/admin/commercial/outstanding-invoices", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const all = await storage.getQuotesByStatuses(["final_payment_requested"]);
      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;
      const items = all
        .filter((q: any) => q.invoiceType === "commercial" && q.commercialInvoiceSentAt && !q.finalPaidAt)
        .map((q: any) => {
          const sentAt = new Date(q.commercialInvoiceSentAt).getTime();
          const daysOutstanding = Math.max(0, Math.floor((now - sentAt) / DAY_MS));
          const dueAt = sentAt + 30 * DAY_MS;
          const dueDate = new Date(dueAt).toISOString().slice(0, 10);
          const daysUntilDue = Math.ceil((dueAt - now) / DAY_MS);
          const bucket = daysOutstanding >= 31 ? "overdue" : daysOutstanding >= 28 ? "due_soon" : "current";
          return {
            id: q.id,
            referenceNo: q.referenceNo,
            customerName: q.customer?.name || null,
            companyName: q.billingCompanyName || q.customer?.companyName || null,
            poNumber: q.poNumber || null,
            total: Number(q.total || 0),
            invoiceSentAt: q.commercialInvoiceSentAt,
            daysOutstanding,
            daysUntilDue,
            dueDate,
            bucket,
          };
        })
        .sort((a, b) => b.daysOutstanding - a.daysOutstanding);

      const totalDue = items.reduce((s, x) => s + x.total, 0);
      const overdueCount = items.filter(x => x.bucket === "overdue").length;
      res.json({ items, totalDue, overdueCount, count: items.length });
    } catch (err: any) {
      console.error("[OutstandingInvoices] error:", err);
      res.status(500).json({ message: err?.message || "Failed to fetch outstanding invoices" });
    }
  });

  // ── Commercial flow ──────────────────────────────────────────────────────
  // Commercial customers skip the 50% deposit step entirely. The admin
  // confirms the booking with one click; no payment is requested upfront.
  // A Net 30 tax invoice is sent only after the work is completed.
  app.post("/api/admin/quotes/:id/approve-commercial", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const quote = await storage.getQuote(id);
      if (!quote || !quote.customer) return res.status(404).json({ message: "Quote not found" });

      // Enforce that this path is only used for commercial jobs.
      if ((quote as any).invoiceType !== "commercial") {
        return res.status(400).json({ message: "This endpoint is only for commercial jobs. Use the standard deposit flow for residential." });
      }

      // Only valid from the pre-approval states — refuse to clobber a
      // booking/assignment/completion that has already moved past approval.
      if (!["submitted", "under_review"].includes(quote.status)) {
        return res.status(409).json({ message: `Cannot approve & book — quote is already ${quote.status}.` });
      }

      const hasRealEmail = quote.customer.email &&
        !quote.customer.email.endsWith("@tmginstall.com") &&
        quote.customer.email.includes("@");

      let emailOk = false;
      if (hasRealEmail) {
        emailOk = await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Booking Confirmed — TMG Install`,
          html: commercialBookingConfirmEmail(quote),
        }).catch(() => false);
      }

      const updated = await storage.updateQuoteStatus(id, "booked", {
        actorType: "admin",
        note: emailOk
          ? `Commercial booking confirmed by admin — confirmation email sent to ${quote.customer.email}`
          : `Commercial booking confirmed by admin (no email sent — no valid customer email on file)`,
      });

      res.json({ success: true, emailSent: emailOk, quote: updated });
    } catch (err: any) {
      console.error("[ApproveCommercial] error:", err);
      res.status(500).json({ message: err?.message || "Failed to approve commercial booking" });
    }
  });

  // Admin: Send the Net 30 tax invoice for a completed commercial job.
  // Moves the job into final_payment_requested so it shows up in the
  // outstanding-invoices view, then emails the customer with PayNow / bank
  // details and a link to view the full invoice PDF.
  app.post("/api/admin/quotes/:id/send-invoice", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const quote = await storage.getQuote(id);
      if (!quote || !quote.customer) return res.status(404).json({ message: "Quote not found" });

      if ((quote as any).invoiceType !== "commercial") {
        return res.status(400).json({ message: "Send-invoice is only for commercial jobs. Use Request Final Payment for residential." });
      }

      // Invoice may only be issued for a job that has actually been completed
      // and not already invoiced or paid. This blocks accidental re-sends.
      if (quote.status !== "completed") {
        return res.status(409).json({ message: `Cannot send invoice — job is ${quote.status}, not completed.` });
      }
      if (quote.finalPaidAt) {
        return res.status(409).json({ message: "Cannot send invoice — final payment has already been recorded." });
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      const dueDateStr = dueDate.toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" });
      const viewUrl = `${APP_URL}/quotes/${quote.id}?ref=${quote.referenceNo}`;

      const hasRealEmail = quote.customer.email &&
        !quote.customer.email.endsWith("@tmginstall.com") &&
        quote.customer.email.includes("@");

      let emailOk = false;
      if (hasRealEmail) {
        emailOk = await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Tax Invoice — Payment Due by ${dueDateStr}`,
          html: commercialInvoiceEmail(quote, viewUrl, dueDateStr),
        }).catch(() => false);
      }

      if (!emailOk) {
        return res.status(500).json({ message: "Could not send invoice email — please verify the customer has a valid email on file." });
      }

      // Stamp the first-send timestamp BEFORE the status change so the
      // dashboard "Outstanding Invoices" widget can compute days-outstanding.
      await db.update(quotes)
        .set({ commercialInvoiceSentAt: new Date() })
        .where(eq(quotes.id, id));

      const updated = await storage.updateQuoteStatus(id, "final_payment_requested", {
        actorType: "admin",
        note: `Net 30 tax invoice sent via email to ${quote.customer.email} — due ${dueDateStr}`,
      });

      res.json({ success: true, emailSent: true, dueDate: dueDateStr, quote: updated });
    } catch (err: any) {
      console.error("[SendInvoice] error:", err);
      res.status(500).json({ message: err?.message || "Failed to send invoice" });
    }
  });

  // Admin: Reopen a closed/paid job so it can be reassigned and actioned
  app.post("/api/admin/quotes/:id/reopen", async (req, res) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

      const existing = await storage.getQuote(id);
      if (!existing) return res.status(404).json({ message: "Quote not found" });

      const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);

      // Decide which status to restore: assigned if staff/team still set, else booked
      const hasAssignment = !!(existing.assignedStaffId || (existing as any).assignedTeamId);
      const newStatus = hasAssignment ? "assigned" : "booked";

      const quote = await storage.updateQuoteStatus(id, newStatus, {
        actorType: "admin",
        note: reason?.trim() || "Job reopened by admin — work still required",
      });

      if (!quote) return res.status(404).json({ message: "Quote not found" });
      console.log(`[Reopen] Quote ${existing.referenceNo} reopened → ${newStatus}`);
      res.json(quote);
    } catch (err: any) {
      console.error("[Reopen] error:", err);
      res.status(500).json({ message: err?.message || "Failed to reopen job" });
    }
  });

  // Admin: Manual close
  // "Mark as Closed" semantically means: job done + fully paid + case settled.
  // The on-screen card explicitly says "Fully paid — job marked complete", so we
  // also stamp finalPaidAt / depositPaidAt (if missing) and paymentStatus, otherwise
  // the invoice / receipt endpoint can't serve the case afterwards.
  app.post("/api/quotes/:id/close", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not logged in" });
    const callerClose = await storage.getUserById(req.session.userId);
    if (!callerClose || callerClose.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const id = parseInt(req.params.id);
      const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);

      const existing = await storage.getQuote(id);
      if (!existing) return res.status(404).json({ message: "Quote not found" });

      const now = new Date();
      const paymentPatch: Partial<typeof quotesTable.$inferInsert> = {
        paymentStatus: "paid_in_full",
      };
      if (!existing.depositPaidAt) paymentPatch.depositPaidAt = now;
      if (!existing.finalPaidAt)   paymentPatch.finalPaidAt   = now;

      await db.update(quotesTable).set(paymentPatch).where(eq(quotesTable.id, id));

      const quote = await storage.updateQuoteStatus(id, 'closed', {
        actorType: 'admin',
        note: reason || 'Case manually closed by admin (marked fully paid)'
      });
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      // Notify customer + send Google review request (fire-and-forget)
      sendCaseClosedNotifications(quote).catch(e => console.error("[ManualClose] notification error:", e));
      res.json(quote);
    } catch (err) {
      console.error("[ManualClose] error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // AI photo item detection — furniture-only, confidence-filtered
  app.post("/api/catalog/detect-items", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      if (!imageBase64) return res.status(400).json({ message: "Image required" });

      // Fetch unique catalog names organised by category for better GPT matching
      const allItems = await storage.getCatalogItems();
      const byCategory: Record<string, string[]> = {};
      allItems.forEach(item => {
        const cat = item.category || "General";
        if (!byCategory[cat]) byCategory[cat] = [];
        const n = item.name;
        if (!byCategory[cat].includes(n)) byCategory[cat].push(n);
      });
      const catalogList = Object.entries(byCategory)
        .map(([cat, names]) => `${cat}: ${names.join(" | ")}`)
        .join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a professional furniture identification assistant for TMG Install, a Singapore furniture installation and relocation company.

Your ONLY task is to identify pieces of FURNITURE and large FIXTURES visible in photos — specifically items that typically require professional installation, dismantling, assembly, or relocation.

ALWAYS INCLUDE these furniture categories:
- Beds and bed frames (single, super single, double, queen, king, bunk bed, loft bed, hydraulic storage bed, murphy/wall bed, tatami platform bed)
- Wardrobes and clothes storage (sliding door, hinged door, walk-in, built-in, IKEA PAX, IKEA Hemnes, IKEA Kleppstad, etc.)
- Sofas and seating furniture (2-seater, 3-seater, L-shaped/corner sofa, recliner, chaise lounge, sofa bed, armchair, accent chair)
- Tables (dining table, coffee table, side table, console/hallway table, office desk, L-shaped desk, conference table, sit-stand desk, extendable dining table)
- Chairs (dining chairs, office chairs, ergonomic chairs, bar stools — count each one individually)
- Storage furniture (bookshelf, display cabinet, shoe cabinet, shoe rack, tall shoe cabinet, drawer chest, filing cabinet, sideboard, buffet cabinet, china cabinet)
- Gym equipment (treadmill, elliptical machine, rowing machine, exercise bike, spin bike, power rack, weight bench, dumbbell rack, multi-station gym)
- Large kitchen appliances ONLY when they require moving (refrigerator, washing machine, dryer, dishwasher)
- Kids furniture (bunk bed, loft bed with desk, kids wardrobe, baby crib, toy storage unit, kids study desk with hutch)
- IKEA furniture — identify model if visible (PAX, KALLAX, BILLY, MALM, HEMNES, BESTA, MICKE, LACK, ALEX, POÄNG, KIVIK, IVAR, TROFAST, STUVA, VITTSJO, VADHOLMA kitchen island, STENSTORP kitchen island, RÅSKOG trolley, FÖRHÖJA trolley/cart, NORDEN, TORNVIKEN kitchen island)
- Bathroom fixtures (mirror cabinet, mirror medicine cabinet, washroom mirror cabinet, bathroom vanity unit, over-toilet storage cabinet, bathroom shelving, towel rack — IKEA LILLÅNGEN, GODMORGON, HEMNES mirror cabinets)
- Wall-mounted items (floating shelf, wall cabinet, curtain track/rod, full-length mirror, TV wall mounting bracket)
- Office furniture: identify desk SHAPE carefully — if a desk has two surfaces forming an L or corner, it is an "L-Shaped Executive Desk" (NOT "Office Desk"); a straight single-surface desk is "Office Desk". Panel partitions surrounding workstations are "Office Panel / Partition". Locker unit, reception counter, credenza, monitor arm, conference table, sit-stand height-adjustable desk.
- Outdoor furniture (garden/patio furniture set, outdoor bench)
- Meeting pods and phone booths
- Specialty items (dressing table, bedside table, bar cabinet, entertainment feature wall unit)

STRICTLY DO NOT LIST any of the following — return nothing for these:
- Televisions, monitors, screens, projectors, or any consumer electronics
- Computers, laptops, tablets, phones, printers, routers, or IT equipment
- Decorative items: picture frames, artwork, vases, figurines, candles, ornaments
- Plants, flowers, trees, or any living or artificial plants
- Small household items: cushions, pillows, blankets, lamps, clocks, books, magazines, boxes, bags, luggage
- Kitchen small appliances: microwave, kettle, toaster, blender, rice cooker, coffee machine, pots, pans, utensils
- Curtains, drapes, rugs, carpets, or textiles (curtain RODS/TRACKS are OK to include)
- People, animals, pets, or any living creatures
- Walls, floors, ceilings, doors, windows, stairs, railings, or architectural surfaces
- Food, beverages, bottles, or consumables
- Mattresses, bedding, pillows, or linen (only the BED FRAME itself, not the mattress on top)
- Lighting fixtures (ceiling lights, floor lamps, table lamps — unless it's a structural lamp that requires installation)

COUNTING RULES:
- Count individual chairs separately: 4 dining chairs around a table → quantity: 4
- For a matching set of identical items, estimate total quantity visible
- Large multi-piece items (L-shaped sofa, king bed) = quantity: 1 even if they have multiple sections
- OFFICE WORKSTATIONS: each workstation = 1 desk. Count them by the number of individual work areas/seats, not by panel count. If the desk surface is L-shaped or corner-shaped, use "L-Shaped Executive Desk". Count surrounding partition panels SEPARATELY as "Office Panel / Partition" — a typical workstation has 3–6 panels around it.
- WALL-HUNG / WALK-IN / BUILT-IN WARDROBE (very important — these are priced PER HOLE, not per piece):
  • ONLY use the per-hole "Walk-in / Built-in Wardrobe (per hole)" classification when the system is CLEARLY drilled into a wall — i.e. you can see vertical metal standards / wood uprights ANCHORED into a brick or drywall surface, with hanging rails, open shelves, or basket racks suspended off the wall. Examples: Elfa, IKEA Algot, IKEA Boaxel, Pax mounted to a wall, custom carpentry walk-in wardrobe inside a room.
  • DO NOT use per-hole pricing for any FREESTANDING unit that just happens to have vertical posts or sliding doors. In particular, the following are NOT per-hole — they are normal flat-pack furniture with their own catalog names:
      – Stainless-steel kitchen storage racks / pantry shelves / appliance shelves (Taobao / Shopee style, multi-tier, often with sliding doors and a microwave shelf) → "Stainless Steel Kitchen Storage Rack / Cabinet"
      – Freestanding metal shelving units (boltless rivet shelving, garage racks) → "Bookshelf"
      – IKEA Kallax, Billy, Ivar, Vittsjo (these are NOT wall-hung even when placed against a wall) → use their IKEA names
      – Bar carts, kitchen trolleys, microwave carts → use their specific names
    Telltale sign: if the unit has its OWN feet / base frame and could be moved without unscrewing anything from the wall, it is NOT per-hole.
  • For real wall-hung / walk-in wardrobe systems, ESTIMATE THE TOTAL NUMBER OF DRILLED HOLES visible. Count holes this way:
      – Each vertical wall standard / upright = 4–6 holes (top, middle, bottom anchors)
      – Each shelf bracket = 2 holes
      – Each hanging rod end-support = 2 holes
      – Each basket / drawer rack = 2 holes per side bracket
      – Each top overhead cabinet = 4–6 holes
  • Add up the visible elements and return ONE line item with quantity = total hole count. Typical walk-in wardrobe like the photos we see lands at 60–120 holes. Round to a whole number.
  • Do NOT also add a separate "Wardrobe" line for the same system — it's one line, priced per hole.
- DUPLICATE PRODUCT PHOTOS: if the input image is a product listing collage / catalog page that shows the SAME piece of furniture from multiple angles (different views, different door configurations, different lighting), count it as ONE item — not one per photo. Telltale signs of duplicate photos: identical background, identical product, watermark/listing UI repeated, photo numbers (1/3, 2/3, etc.).
- If quantity is unclear, default to 1

CONFIDENCE RULES — include the confidence field:
- "high": item is clearly visible, easily identifiable as furniture
- "medium": item is partially visible or slightly ambiguous but likely furniture
- Do NOT include any item with low confidence or that you are guessing at
- Only list items you are genuinely confident are furniture requiring professional service

CATALOG MATCHING:
Map every detected item to the closest name from this catalog. Use the most specific match available.

CATALOG (organised by category):
${catalogList}

If an item is not in the catalog, use a concise descriptive name (e.g., "Piano", "Pool Table", "Foosball Table").

${FURNITURE_VISION_GUIDE}

You MUST respond with ONLY valid JSON — no prose, no markdown, no explanation:
[{"name": "exact catalog name or description", "quantity": 1, "confidence": "high"}]`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Examine this image carefully.

List ONLY the furniture pieces, gym equipment, bathroom fixtures, or large fixtures that are clearly visible and would require professional installation, dismantling, assembly, or relocation service.

INCLUDE bathroom fixtures when visible: mirror cabinets, washroom mirror cabinets (IKEA LILLÅNGEN, GODMORGON, HEMNES), bathroom vanity units, over-toilet storage cabinets, bathroom shelving, and towel racks.

DO NOT list: TVs, monitors, electronics, plants, decorations, small items, people, walls, floors, mattresses, or bedding.

For each furniture item, map to the closest catalog name. Count chairs and identical repeated pieces individually.

IMPORTANT for OFFICE PHOTOS: Look at each desk carefully — if the desk surface wraps around into an L or corner shape, call it "L-Shaped Executive Desk". Count partition panels separately from the desks. Count each individual workstation seat as one desk unit.

Only include items with "high" or "medium" confidence. List up to 15 distinct furniture items.

Respond with ONLY a JSON array (no prose, no markdown):
[{"name": "catalog name or description", "quantity": 1, "confidence": "high"}]`
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" }
              }
            ]
          }
        ],
        max_tokens: 800,
      });

      const content = response.choices[0]?.message?.content || "";
      console.log("[detect-items] raw GPT response:", content);

      let detected: { name: string; quantity: number }[] = [];
      if (content) {
        try {
          let cleaned = content.replace(/```(?:json)?\n?/g, "").replace(/\n?```/g, "").trim();
          const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
          if (arrayMatch) cleaned = arrayMatch[0];
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed)) {
            detected = parsed
              .filter((item: any) =>
                typeof item === "object" &&
                item !== null &&
                typeof item.name === "string" &&
                item.name.trim().length > 0 &&
                // Only keep high or medium confidence items — filter out low/unknown
                (item.confidence === "high" || item.confidence === "medium" || !item.confidence)
              )
              .map((item: any) => {
                const nm = item.name.trim();
                // Walk-in / built-in wardrobe is priced per hole and can run
                // 60–200+ holes; everything else stays capped at 50 units.
                const isPerHole = /per hole/i.test(nm);
                const cap = isPerHole ? 300 : 50;
                return {
                  name: nm,
                  quantity: Math.max(1, Math.min(cap, Number(item.quantity) || 1)),
                };
              });
          }
        } catch (parseErr) {
          console.error("[detect-items] JSON parse failed:", parseErr, "raw:", content);
          detected = [];
        }
      }

      console.log("[detect-items] detected items:", detected);

      // ── Server-side catalog matching ─────────────────────────────────────
      // Build catalog groups from freshly-fetched allItems (same DB read as above)
      type SrvEntry = { id: number; sku: string; serviceType: string; basePrice: string; volumeM3?: number };
      type SrvGroup = { name: string; category: string; entries: SrvEntry[] };
      const groupMap: Record<string, SrvGroup> = {};
      allItems.forEach(item => {
        const key = item.name.toLowerCase().trim();
        if (!groupMap[key]) groupMap[key] = { name: item.name, category: item.category || "", entries: [] };
        if (!groupMap[key].entries.some(e => e.serviceType === item.serviceType)) {
          groupMap[key].entries.push({
            id: item.id,
            sku: item.sku || "",
            serviceType: item.serviceType,
            basePrice: item.basePrice,
            volumeM3: item.volumeM3 ? parseFloat(item.volumeM3 as string) : undefined,
          });
        }
      });
      const catalogGroupsList = Object.values(groupMap);

      // Same scoring logic as frontend matchScore
      const srvStripParens = (s: string) => s.replace(/\s*\(.*?\)/g, "").trim();
      const srvStem = (w: string) => w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w;
      const CAT_FAMILIES = [
        ["wardrobe", "pax", "closet"],
        ["island", "kitchen island"],
        ["sofa", "couch", "sectional", "chaise"],
        ["treadmill", "elliptical", "rowing machine"],
        ["piano"],
        ["pool table", "billiard", "foosball"],
        ["pod", "phone booth"],
      ];
      // Synonym normalisation — keep in sync with client matchScore.
      // Maps theatre/cinema/lecture-hall seating phrasing onto the canonical
      // "auditorium chair" tokens so the Round 24 catalog row gets matched.
      const srvNormaliseSynonyms = (s: string): string => {
        let out = s;
        out = out.replace(/\b(theatre|theater|cinema)\s+(seat|seats|seating|chair|chairs)\b/gi, "auditorium chair");
        out = out.replace(/\blecture\s*(hall|theatre|theater|room)?\s*(seat|seats|seating|chair|chairs)\b/gi, "auditorium chair");
        out = out.replace(/\bauditorium\s+(seat|seats|seating)\b/gi, "auditorium chair");
        return out;
      };
      function srvMatchScore(det: string, cat: string): number {
        const d = srvNormaliseSynonyms(det.toLowerCase()), c = cat.toLowerCase();
        const dC = srvStripParens(d), cC = srvStripParens(c);
        if (d === c) return 100;
        if (dC === cC) return 90;
        if (c.includes(d) || d.includes(c)) return 80;
        if (cC.includes(dC) || dC.includes(cC)) return 75;
        for (const family of CAT_FAMILIES) {
          const detHas = family.some(kw => d.includes(kw));
          const catHas = family.some(kw => c.includes(kw));
          if (detHas !== catHas) return 0;
        }
        const ikeaModel = d.match(/\b(pax|kallax|billy|malm|hemnes|besta|micke|lack|alex|po[äa]ng|kivik|ivar|trofast|stuva|vittsjo|lill[aå]ng[eé]n|godmorgon|kleppstad|vadholma|stenstorp|raskog|r[aå]skog)\b/i);
        if (ikeaModel && c.includes(ikeaModel[1].toLowerCase().replace("ä","a").replace("å","a").replace("é","e"))) return 70;
        const dWords = dC.split(/\s+/).filter(w => w.length > 3).map(srvStem);
        const cWords = cC.split(/\s+/).filter(w => w.length > 3).map(srvStem);
        const overlap = dWords.filter(w => cWords.some(cw => cw.includes(w) || w.includes(cw)));
        if (overlap.length >= 2) return 60;
        if (overlap.length >= 1) return 40;
        return 0;
      }

      // Enrich each detected item with its matched catalog group
      const enriched = detected.map(({ name, quantity }) => {
        let best: { group: SrvGroup; score: number } | null = null;
        for (const g of catalogGroupsList) {
          const score = srvMatchScore(name, g.name);
          if (score > 0 && (!best || score > best.score)) best = { group: g, score };
        }
        const catalogGroup = best && best.score >= 40 ? best.group : null;
        return { name, quantity, catalogGroup };
      });

      console.log("[detect-items] enriched with catalog:", enriched.map(e => `${e.name} → ${e.catalogGroup?.name ?? "UNMATCHED"} (${e.catalogGroup?.entries.length ?? 0} entries)`));
      res.json({ detected: enriched });
    } catch (err) {
      console.error("Photo detection error:", err);
      res.status(500).json({ message: "Failed to detect items from photo", detected: [] });
    }
  });

  // ── Route distance calculation (OneMap geocode → OSRM route) ──────────────
  app.post(api.distance.calculate.path, async (req, res) => {
    try {
      const { pickupAddress, dropoffAddress, pickupLat, pickupLng, dropoffLat, dropoffLng } =
        api.distance.calculate.input.parse(req.body);

      // Geocode address to lat/lng using OneMap (if not already provided)
      async function geocode(address: string, hint?: { lat?: number; lng?: number }) {
        if (hint?.lat && hint?.lng) return { lat: hint.lat, lng: hint.lng };
        const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(address)}&returnGeom=Y&getAddrDetails=N&pageNum=1`;
        const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await r.json();
        const first = data?.results?.[0];
        if (!first) return null;
        return { lat: parseFloat(first.LATITUDE), lng: parseFloat(first.LONGITUDE) };
      }

      const [from, to] = await Promise.all([
        geocode(pickupAddress, { lat: pickupLat, lng: pickupLng }),
        geocode(dropoffAddress, { lat: dropoffLat, lng: dropoffLng }),
      ]);

      if (!from || !to) {
        return res.json({ distanceKm: 0, routeFound: false, error: "Could not geocode one or both addresses" });
      }

      // Route distance via OSRM (free, no API key, covers Singapore)
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
      const routeRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) });
      const routeData = await routeRes.json();

      if (routeData.code !== "Ok" || !routeData.routes?.[0]) {
        return res.json({ distanceKm: 0, routeFound: false, error: "Route calculation failed" });
      }

      const distanceKm = Math.round((routeData.routes[0].distance / 1000) * 10) / 10;
      return res.json({ distanceKm, routeFound: true });
    } catch (err: any) {
      console.error("Distance calculation error:", err);
      return res.json({ distanceKm: 0, routeFound: false, error: "Distance service unavailable" });
    }
  });

  // ── Wizard-based quote creation ────────────────────────────────────────────
  app.post(api.quotes.wizard.path, async (req, res) => {
    try {
      const input = api.quotes.wizard.input.parse(req.body);

      // Validate slot if provided
      if (input.preferredDate && input.preferredTimeWindow) {
        const available = await storage.isSlotAvailable(input.preferredDate, input.preferredTimeWindow);
        if (!available) {
          return res.status(409).json({
            message: "That time slot was just taken by another customer. Please choose a different slot.",
            field: "preferredTimeWindow",
          });
        }
      }

      // Labor subtotal from item prices
      const laborSubtotal = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const discount = input.discount || 0;
      const logisticsFee = input.logisticsFee || 0;

      // rawTotal includes logisticsFee which already contains the $60 callout fee (via computePricing)
      const rawTotal = laborSubtotal - discount + logisticsFee;

      // Re-validate the promo code server-side against the live DB row.
      // NEVER trust the client's promoDiscount value — that lets anyone slap
      // a fake $50 off on any submission. We look up the code, check active /
      // maxUses / minOrderAmount against the server-computed rawTotal, and
      // ignore the client-supplied discount entirely.
      //
      // `appliedPromoCode` is only set when the code is actually eligible.
      // We use it for BOTH persistence and the usage-count decrement below,
      // so a low-value or otherwise ineligible submission cannot:
      //   • silently store a promo code on the quote that wasn't applied, or
      //   • burn a usage slot on a code the customer doesn't qualify for.
      let promoDiscountAmt = 0;
      let appliedPromoCode: string | null = null;
      const requestedPromo = input.promoCode?.trim().toUpperCase() || null;
      if (requestedPromo) {
        try {
          const promoRows = await db.select().from(promoCodes)
            .where(eq(promoCodes.code, requestedPromo)).limit(1);
          const pr = promoRows[0];
          if (pr && pr.active && pr.usesCount < pr.maxUses) {
            const minOrder = parseFloat(pr.minOrderAmount ?? "0") || 0;
            if (minOrder === 0 || rawTotal >= minOrder) {
              const candidateDiscount = parseFloat(pr.discountAmount) || 0;
              if (candidateDiscount > 0) {
                promoDiscountAmt = candidateDiscount;
                appliedPromoCode = requestedPromo;
              }
            }
          }
        } catch { /* promo lookup failed — fall through with no discount */ }
      }

      // Promo code applied to total (callout fee already included in logisticsFee)
      const grandTotal = Math.max(0, rawTotal - promoDiscountAmt);

      const depositAmount = (grandTotal * 0.50).toFixed(2);
      const finalAmount = (grandTotal * 0.50).toFixed(2);
      const referenceNo = `TMG-${randomBytes(6).toString("hex").toUpperCase()}`;

      // Hold expiry: 48 hours from submission
      const slotHeldUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const relocateItems = input.items.filter(i => i.serviceType === 'relocate');
      const wizardRelocationMode: "carry" | "full" | null = relocateItems.length === 0
        ? null
        : (relocateItems.some(i => i.relocateMode === 'full') ? 'full'
          : (relocateItems.every(i => i.relocateMode === 'carry') ? 'carry' : 'full'));

      // Tag wrapped items in the persisted name so admin/crew can see which
      // items the customer paid bubble-wrap protection for. Also sum the
      // wrapped-unit count for a separate roll-up surcharge line below.
      // Quantity is normalized to a positive integer to match the client-side
      // wrap-count calculation and prevent a tampered fractional / negative
      // quantity from desyncing the displayed roll-up vs. the charged fee.
      const wrappedUnitCount = input.items.reduce(
        (s, it) => s + (it.wrap ? Math.max(1, Math.round(it.quantity)) : 0),
        0,
      );
      const wrappingFeeTotal = wrappedUnitCount * PricingConfig.wrapping.perItem;
      const allItems = [
        ...input.items.map(item => ({
          catalogItemId: item.catalogItemId,
          originalDescription: item.itemName + (item.wrap ? " (wrapped)" : ""),
          detectedName: item.itemName + (item.wrap ? " (wrapped)" : ""),
          serviceType: item.serviceType,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          subtotal: (item.unitPrice * item.quantity).toFixed(2),
        })),
        ...(input.customItems || []).map(item => ({
          catalogItemId: undefined as number | undefined,
          originalDescription: item.description,
          detectedName: item.description,
          serviceType: item.serviceType,
          quantity: item.quantity,
          unitPrice: "0",
          subtotal: "0",
        })),
        // Wrapping surcharge — visible roll-up line on the quote so admin
        // sees the total wrap charge alongside other surcharges. $10 per unit.
        ...(wrappedUnitCount > 0 ? [{
          catalogItemId: undefined as number | undefined,
          originalDescription: `Wrapping Protection (${wrappedUnitCount} ${wrappedUnitCount === 1 ? "unit" : "units"})`,
          detectedName: `Wrapping Protection (${wrappedUnitCount} ${wrappedUnitCount === 1 ? "unit" : "units"})`,
          serviceType: "install" as const, // schema enum doesn't allow 'surcharge' on wizard inputs; persist as a labeled line
          quantity: wrappedUnitCount,
          unitPrice: PricingConfig.wrapping.perItem.toFixed(2),
          // Subtotal derived from the SERVER-computed wrapping fee, never from
          // client-supplied per-item totals. Guarantees the visible wrap line
          // always matches the (server-known) wrap cost even if the rest of
          // the totals come from the client-supplied logisticsFee.
          subtotal: wrappingFeeTotal.toFixed(2),
        }] : []),
      ];

      const quote = await storage.createQuote(
        input.customer,
        {
          referenceNo,
          serviceAddress: input.serviceAddress,
          pickupAddress: input.pickupAddress,
          dropoffAddress: input.dropoffAddress,
          accessDifficulty: input.accessDifficulty,
          floorsInfo: input.floorsInfo,
          selectedServices: JSON.stringify(input.selectedServices),
          // Same-Property Move: collapse dropoff onto pickup regardless of
          // what the client posted, so DB rows never end up with mismatched
          // addresses for a same-property job.
          ...(input.samePropertyMove === true && input.pickupAddress
            ? { dropoffAddress: input.pickupAddress }
            : {}),
          subtotal: laborSubtotal.toFixed(2),
          discount: discount.toFixed(2),
          transportFee: logisticsFee.toFixed(2),
          total: grandTotal.toFixed(2),
          depositAmount,
          finalAmount,
          status: "submitted",
          requiresManualReview: false,
          aiConfidenceScore: 100,
          relocationMode: wizardRelocationMode,
          samePropertyMove: input.samePropertyMove === true,
          // Same-Property Move invariants: pickup == dropoff and zero distance.
          // We force these server-side so a tampered client can't claim
          // samePropertyMove=true while sending two different addresses or a
          // distance > 0 (which would influence reporting / KPIs).
          distanceKm: (input.samePropertyMove === true)
            ? "0.0"
            : (input.distanceKm != null ? input.distanceKm.toFixed(1) : null),
          detectionPhotoUrl: input.detectedPhotoUrl || null,
          // Slot chosen in wizard
          preferredDate: input.preferredDate || null,
          preferredTimeWindow: input.preferredTimeWindow || null,
          slotHeldUntil: (input.preferredDate && input.preferredTimeWindow) ? slotHeldUntil : null,
          bookingRequestedAt: (input.preferredDate && input.preferredTimeWindow) ? new Date() : null,
          // Promo code applied — only persist when the code actually qualified
          promoCode: appliedPromoCode,
          promoDiscount: promoDiscountAmt > 0 ? promoDiscountAmt.toFixed(2) : "0",
        },
        allItems
      );

      // T005: Fire-and-forget lead_submitted attribution event
      if (quote?.referenceNo) {
        logAttributionEvent(quote.id, quote.referenceNo, "lead_submitted", parseFloat(quote.total ?? "0"), quote.sourceChannel ?? undefined).catch(() => {});
      }

      // Decrement promo code usage count ONLY if the code actually qualified
      // and was applied to the quote. Gating on `appliedPromoCode` prevents
      // a slot-exhaustion vector where attackers submit low-value quotes with
      // a valid code to burn `usesCount` without receiving any discount.
      if (appliedPromoCode && promoDiscountAmt > 0) {
        try {
          const promoRows = await db.select().from(promoCodes)
            .where(eq(promoCodes.code, appliedPromoCode)).limit(1);
          if (promoRows.length && promoRows[0].active && promoRows[0].usesCount < promoRows[0].maxUses) {
            await db.update(promoCodes)
              .set({ usesCount: promoRows[0].usesCount + 1 })
              .where(eq(promoCodes.id, promoRows[0].id));
          }
        } catch (promoErr) {
          console.error("Promo decrement error:", promoErr);
        }
      }

      // Alert admin on new estimate submission
      try {
        const alertHtml = newEstimateAdminAlert(quote);
        await sendEmail({
          to: ADMIN_EMAIL,
          subject: `🔔 New Estimate Request — ${quote.referenceNo} from ${quote.customer?.name}`,
          html: alertHtml,
        });
      } catch (alertErr) {
        console.error("Admin alert email error:", alertErr);
      }

      // Send customer confirmation email
      try {
        if (quote.customer?.email) {
          await sendEmail({
            to: quote.customer.email,
            subject: `Estimate Received — ${quote.referenceNo} | TMG Install`,
            html: estimateSubmittedEmail(quote),
          });
        }
      } catch (custEmailErr) {
        console.error("Customer estimate confirmation email error:", custEmailErr);
      }

      res.status(201).json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      console.error("Wizard quote error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── WhatsApp Webhook Verification (GET) ───────────────────────────────────
  app.get("/api/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("[WhatsApp] Webhook verified ✓");
      return res.status(200).send(challenge);
    }
    console.warn("[WhatsApp] Webhook verification failed — token mismatch");
    return res.status(403).json({ message: "Forbidden" });
  });

  // ── WAMID dedup set — prevents double-processing when Meta retries the webhook ─
  const processedWamids = new Set<string>();

  // ── 10-minute quote follow-up timer (in-memory per phone) ─────────────────
  const quoteFollowUpTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function scheduleQuoteFollowUp(from: string) {
    // Clear any existing timer for this phone
    const existing = quoteFollowUpTimers.get(from);
    if (existing) clearTimeout(existing);

    const FOLLOW_UP_MS = 10 * 60 * 1000; // 10 minutes
    const timer = setTimeout(async () => {
      quoteFollowUpTimers.delete(from);
      try {
        const sess = await storage.getWhatsAppSession(from);
        // Only send if still at pricing_shown and bot is not paused
        if (sess && sess.state === "pricing_shown" && !sess.botPaused) {
          const followUpMsg =
            `Hi! Just checking in — did you get a chance to review the quote? 😊

` +
            `Happy to answer any questions or adjust anything before you decide. ` +
            `Our team is ready to lock in your slot whenever you are.`;
          await sendBotMessage(from, followUpMsg);
        }
      } catch { /* silent — never block */ }
    }, FOLLOW_UP_MS);

    quoteFollowUpTimers.set(from, timer);
  }

  function clearQuoteFollowUpTimer(from: string) {
    const existing = quoteFollowUpTimers.get(from);
    if (existing) {
      clearTimeout(existing);
      quoteFollowUpTimers.delete(from);
    }
  }

  // ── WhatsApp Incoming Message Handler (POST) ──────────────────────────────
  app.post("/api/webhooks/whatsapp", async (req, res) => {
    // ── Verify Meta's X-Hub-Signature-256 HMAC before processing anything ─────
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      console.error("[WhatsApp] META_APP_SECRET not configured — rejecting all webhook POSTs");
      return res.status(500).json({ message: "Webhook secret not configured" });
    }
    const sigHeader = Array.isArray(req.headers["x-hub-signature-256"])
      ? req.headers["x-hub-signature-256"][0]
      : req.headers["x-hub-signature-256"];
    const rawBody = req.rawBody as Buffer | undefined;
    if (!sigHeader || !rawBody) {
      console.warn("[WhatsApp] Webhook rejected — missing signature or raw body");
      return res.status(403).json({ message: "Forbidden" });
    }
    const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(sigHeader);
    const expBuf = Buffer.from(expected);
    const signaturesMatch = sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
    if (!signaturesMatch) {
      console.warn("[WhatsApp] Webhook rejected — HMAC signature mismatch");
      return res.status(403).json({ message: "Forbidden" });
    }

    res.status(200).json({ status: "ok" }); // Always ack quickly

    try {
      const body = req.body;
      if (body.object !== "whatsapp_business_account") return;

      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      // ── Handle delivery status callbacks (sent / delivered / read / failed) ────
      // Meta sends these in value.statuses[], NOT value.messages[].
      // Previously this whole block was silently discarded — now we log failures.
      if (value?.statuses?.length) {
        for (const st of value.statuses) {
          const recipientId: string = st.recipient_id || "";
          const status: string = st.status || "";
          const wamidSt: string = st.id || "";
          if (status === "failed") {
            const errCode = st.errors?.[0]?.code;
            const errTitle = st.errors?.[0]?.title || "Unknown error";
            const is24h = errCode === 131047 || errCode === 131026;
            console.error(
              `[WhatsApp] ❌ Message delivery FAILED — to: ****${recipientId.slice(-4)}, ` +
              `msgId: ${wamidSt.slice(0, 16)}…, code: ${errCode}, reason: ${errTitle}`
            );
            // Log a system message in the conversation so admin can see the failure.
            // De-dupe: when several outbound messages fail in quick succession with
            // the same 24-hr error (common when admin sends final-payment + case-
            // closed + invoice in the same minute), only show ONE warning rather
            // than stacking identical notes that drown out the actual chat.
            const failureNote = is24h
              ? `⚠️ WhatsApp delivery failed (code ${errCode}): 24-hour messaging window is closed. Customer must message us first to re-open the window. Consider calling or emailing them.`
              : `⚠️ WhatsApp delivery failed (code ${errCode}): ${errTitle}`;
            try {
              const recent = await db.select()
                .from(whatsappMessagesTable)
                .where(and(
                  eq(whatsappMessagesTable.phone, recipientId),
                  eq(whatsappMessagesTable.direction, 'outbound'),
                  eq(whatsappMessagesTable.sentBy, 'system'),
                ))
                .orderBy(desc(whatsappMessagesTable.createdAt))
                .limit(1);
              const last = recent[0];
              const sameErr = is24h
                ? !!last?.body?.includes("131047") || !!last?.body?.includes("messaging window is closed")
                : !!last?.body?.includes(`code ${errCode}`);
              const recentEnough = last
                ? (Date.now() - new Date(last.createdAt).getTime()) < 30 * 60 * 1000
                : false;
              if (!(sameErr && recentEnough)) {
                await storage.logWhatsAppMessage({
                  phone: recipientId,
                  direction: 'outbound',
                  body: failureNote,
                  sentBy: 'system',
                  wamid: undefined,
                });
              }
            } catch {
              // Fallback: if dedup query fails, still log the note so admin sees it.
              storage.logWhatsAppMessage({
                phone: recipientId,
                direction: 'outbound',
                body: failureNote,
                sentBy: 'system',
                wamid: undefined,
              }).catch(() => {});
            }
            if (is24h) {
              console.warn(
                `[WhatsApp] 24-hour window closed for ****${recipientId.slice(-4)} — ` +
                `free-form messages cannot be delivered. Customer must message first to re-open window.`
              );
              // Mark the session window as closed so admin UI can warn before next send
              await db.update(whatsappSessionsTable)
                .set({ windowOpen: false })
                .where(eq(whatsappSessionsTable.phone, recipientId))
                .catch(() => {});
            }
          } else if (status === "sent" || status === "delivered" || status === "read") {
            console.log(`[WhatsApp] Status update — to: ****${recipientId.slice(-4)}, status: ${status}`);
          }
        }
        // If there are no inbound messages in this event, we're done
        if (!value?.messages?.length) return;
      }

      if (!value?.messages?.length) return;

      const msg = value.messages[0];
      const from: string = msg.from; // sender phone e.g. "6591234567"
      clearQuoteFollowUpTimer(from); // Customer replied — cancel any pending follow-up

      // ── Deduplicate: Meta sometimes retries the same webhook event ────────────
      const wamid: string = msg.id || "";
      if (wamid && processedWamids.has(wamid)) {
        console.log(`[WhatsApp] [corr:${wamid.slice(0,12)}] duplicate webhook ignored (in-memory dedup)`);
        return;
      }
      if (wamid) {
        processedWamids.add(wamid);
        if (processedWamids.size > 2000) {
          const first = processedWamids.values().next().value;
          if (first) processedWamids.delete(first);
        }
      }
      console.log(`[WhatsApp] [corr:${wamid.slice(0,12)}] inbound received (from=****${from.slice(-4)}, type=${msg.type || "text"})`);

      // ── Mark as read immediately — shows double blue ticks to customer ────────
      markAsRead(msg.id).catch(() => {});

      // ── Extract readable text from any WhatsApp message type ─────────────────
      // WhatsApp sends text in different fields depending on message type:
      // text→msg.text.body | image/video/doc→caption | interactive→button/list reply title | button→msg.button.text
      const extractText = (m: any): string => (
        m.text?.body ||
        m.image?.caption ||
        m.video?.caption ||
        m.document?.caption ||
        m.interactive?.button_reply?.title ||
        m.interactive?.list_reply?.title ||
        m.button?.text ||
        // Reactions: store the emoji so the admin can see what the customer reacted
        (m.type === 'reaction' && m.reaction?.emoji ? `[Reaction: ${m.reaction.emoji}]` : "") ||
        // Order messages
        (m.type === 'order' ? `[Order: ${m.order?.product_items?.length || 0} item(s)]` : "") ||
        ""
      ).trim();

      const inboundText = extractText(msg);

      // Friendly fallback labels for media-only messages
      const fallbackLabel =
        msg.type === 'image'    ? '[Photo]'    :
        msg.type === 'video'    ? '[Video]'    :
        msg.type === 'audio'    ? '[Voice note]' :
        msg.type === 'sticker'  ? '[Sticker]'  :
        msg.type === 'document' ? '[Document]' :
        msg.type === 'location' ? '[Location sent]' :
        msg.type === 'contacts' ? '[Contact shared]'  :
        msg.type === 'reaction' ? `[Reaction: ${msg.reaction?.emoji || '👍'}]` :
        msg.type === 'unsupported' ? '[Unsupported message type — open WhatsApp to view]' :
        '[Message]';

      // ── Log inbound message for admin conversations view ─────────────────────
      const inboundMediaId =
        msg.type === 'image'    ? msg.image?.id    :
        msg.type === 'document' ? msg.document?.id :
        msg.type === 'video'    ? msg.video?.id    :
        msg.type === 'audio'    ? msg.audio?.id    :
        undefined;
      const inboundMediaType =
        msg.type === 'image'    ? (msg.image?.mime_type || 'image/jpeg') :
        msg.type === 'document' ? (msg.document?.mime_type || 'application/octet-stream') :
        msg.type === 'video'    ? (msg.video?.mime_type || 'video/mp4') :
        msg.type === 'audio'    ? (msg.audio?.mime_type || 'audio/ogg') :
        undefined;
      // Use filename as body for documents when no caption is provided
      const inboundBody =
        inboundText ||
        (msg.type === 'document' && msg.document?.filename ? `[Document: ${msg.document.filename}]` : fallbackLabel);
      storage.logWhatsAppMessage({
        phone: from,
        direction: 'inbound',
        body: inboundBody,
        mediaType: inboundMediaType,
        mediaUrl: inboundMediaId,
        wamid: msg.id,
      }).catch(() => {});

      // ── Push notification → admin PWA (web push) ──────────────────────────
      sendPushToAdmins({
        title: `WhatsApp: +${from}`,
        body: inboundBody.length > 100 ? inboundBody.slice(0, 97) + "…" : inboundBody,
        url: "/admin/conversations",
        tag: `wa-${from}`,
      }).catch(() => {});

      const msgType: string = msg.type || "text";
      // Include captions and interactive reply text so all message types are processed
      const text: string = extractText(msg);
      const textLower = text.toLowerCase();

      // ── Skip bot processing for non-conversational message types ─────────────
      // Reactions, stickers are passive signals — do not reply, just log.
      if (msgType === 'reaction' || msgType === 'sticker') {
        console.log(`[WhatsApp] Skipping bot reply for ${msgType} from +${from}`);
        return;
      }

      let session = await storage.getWhatsAppSession(from);
      let state = session?.state ?? "start";

      // ── Submitted-state: smart follow-up vs. new-quote detection ──────────────
      // Instead of blindly resetting, first check if the customer is asking about
      // their submitted quote (correction, pricing question, clarification) vs.
      // explicitly starting a new request. Only reset for clear new-quote triggers.
      if (state === "submitted") {
        // Always respect admin takeover — do not reply if bot is paused
        if (session?.botPaused) {
          console.log(`[WhatsApp] Bot paused for ${from} (submitted state) — admin is handling`);
          return;
        }
        const NEW_QUOTE_TRIGGER = /\b(new (quote|request|job|booking)|start (over|again|fresh)|hi|hello|another (quote|job)|book again|different (item|job|address))\b/i;
        const isNewQuote = NEW_QUOTE_TRIGGER.test(text);
        if (isNewQuote) {
          // Clear session and fall through to start state
          const freshFields = {
            state: "start",
            collectedName: null, collectedAddress: null, collectedItems: null,
            collectedDate: null, floorLevel: null, hasLift: null, liftAccess: null,
            isRelocation: null, previousItems: null, conversationHistory: null,
            botPaused: false,
          };
          await storage.upsertWhatsAppSession(from, freshFields);
          session = session ? { ...session, ...freshFields } : null;
          state = "start";
        } else {
          // Customer is following up on their submitted quote — answer helpfully, then exit
          try {
            const followUpRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 300,
              messages: [{
                role: "system",
                content: `You are the WhatsApp assistant for TMG Install, a furniture installation company in Singapore. The customer has just submitted a quote and is sending a follow-up message — they are NOT starting a new quote yet.

SUBMITTED QUOTE CONTEXT:
- Customer name: ${session?.collectedName || "not captured"}
- Address: ${session?.collectedAddress || "not captured"}
- Items: ${session?.collectedItems || "not captured"}
- Date/time: ${session?.collectedDate || "flexible"}

RULES:
1. Answer their follow-up question directly and helpfully.
2. If they want to ADD a service (e.g., "can include assembly?", "can add installation?", "add dismantle?"):
   - Tell them yes, absolutely — our team can include that.
   - Ask them to confirm by replying "YES add [service]" so we can update the quote, OR let them know our team will reach out to adjust.
   - Do NOT restart the quote flow.
3. If they're asking whether a different item spec changes the price — explain pricing is by item type/service and our team will confirm the exact quote.
4. If they want to CHANGE address/date/items — tell them our team will be in touch to adjust.
5. Do NOT start collecting new quote info. Do NOT re-ask their name/address.
6. End warmly: "Our team will be in touch shortly to confirm everything! 😊"
7. Keep under 100 words. Warm, professional tone.`,
              }, {
                role: "user",
                content: text,
              }],
            });
            const followUpReply = followUpRes.choices[0]?.message?.content?.trim();
            if (followUpReply) {
              await sendBotMessage(from, followUpReply);
              return;
            }
          } catch { /* fall through to hardcoded */ }
          await sendBotMessage(from,
            `Thanks for the note, ${session?.collectedName || "there"}! 😊 Your quote has been submitted and our team will review the details and be in touch shortly.\n\nIf you'd like to change anything, just let us know here and we'll pass it on.\n\nReply *hi* anytime to start a new quote!`
          );
          return;
        }
      }

      // ── AI Sales Agent intercept (Phase 9) ────────────────────────────────────
      // processWithAIAgent returns true if it handled the message.
      // If it returns false (disabled, error, or non-qualifying), the legacy bot continues.
      try {
        const agentHandled = await processWithAIAgent({ from, text, msgType, msg, session, correlationId: wamid });
        if (agentHandled) {
          console.log(`[WhatsApp] [corr:${wamid.slice(0,12)}] AI agent handled — legacy bot skipped`);
          return;
        }
        console.log(`[WhatsApp] [corr:${wamid.slice(0,12)}] AI agent returned false — falling through to legacy bot`);
      } catch (agentErr) {
        console.error(`[WhatsApp] [corr:${wamid.slice(0,12)}] AI agent error (falling through to legacy bot):`, agentErr);
      }

      // ── Load dynamic bot knowledge from DB (FAQ + business settings) ──────────
      const botKnowledge = await buildBotKnowledge();
      const DYNAMIC_FAQ = botKnowledge.faqBlock;
      const DYNAMIC_HOURS = botKnowledge.hoursBlock;
      const DYNAMIC_POLICY = botKnowledge.policyBlock;

      // ── Admin takeover guard: if bot is paused for this number, do not respond ─
      if (session?.botPaused) {
        console.log(`[WhatsApp] Bot paused for ${from} — admin is handling this conversation`);
        return;
      }

      // ── Multi-photo batch collector ───────────────────────────────────────────
      // Buffer ALL images from initial-state conversations (new session,
      // awaiting_name, pricing_shown) for PHOTO_BATCH_DELAY_MS, then scan
      // every photo in one pass and send a SINGLE combined estimate.
      // This eliminates double greetings, per-photo separate quotes, and the
      // race condition caused by concurrent webhook events.
      if (msgType === "image" && msg.image?.id) {
        const batchableStates = ["start", "awaiting_name", "pricing_shown"];
        const currentState = session?.state ?? "start";
        if (batchableStates.includes(currentState)) {
          addToPendingPhotoBatch(from, msg.image.id, text);
          console.log(`[WhatsApp] Photo batched for ${from} (n=${pendingPhotoBatches.get(from)?.imageIds.length}, state=${currentState}, caption="${text.slice(0, 50)}")`);
          return; // 200 already sent to Meta; flushPhotoBatch will reply after delay
        }
      }

      // ── Spam / solicitation guard — detects non-customer business pitches ───────
      // Catches loan brokers, recruiters, ad agencies, etc. who DM business accounts.
      // Respond once briefly, never reply again (bot paused so no repeated messages).
      const SPAM_SOLICIT_REGEX = /\b(company (loan|loans|grant|grants|financing|funding)|bank loan|interest rate.*flat|interest rate.*per annum|refinanc|cash out|we (provide|offer|can help).{0,40}(loan|grant|insurance|credit|fund)|may assist.{0,30}(loan|grant|fund)|introduce.{0,30}(loan|grant|client)|earn.*commission|passive income|business.*opportunity|investment.*opportunity|mlm|multi.level|direct.*sales|we can (get|help|assist) you.*\$|approved loan|apply for.*loan)\b/i;
      if (SPAM_SOLICIT_REGEX.test(text) && !session?.botPaused) {
        await storage.upsertWhatsAppSession(from, { botPaused: true, botPausedAt: new Date() });
        await sendBotMessage(from,
          `Thanks for reaching out! We're a furniture installation company and aren't looking for financial or business services at this time. Wishing you all the best! 😊`
        );
        console.log(`[WhatsApp] SPAM/SOLICITATION blocked for ${from}: "${text.slice(0, 80)}"`);
        return;
      }

      // ── Escalation detection — runs before state processing so no customer is left stranded ───────
      // 1. Existing customer / booking update requests
      // ──────────────────────────────────────────────────────────────────────────────────────────────
      const UPDATE_REQUEST_REGEX = /\b(already paid|paid (the |my )?deposit|paid deposit|transfer(red)? already|sent (the )?payment|made (the )?payment|confirm(ed)? my (booking|job|appointment|slot)|when (is|will) (my|the) (job|booking|appointment|installation|installer|team)|what time (is|will) (my|the) (job|booking|appointment)|update (my|the) (booking|order|job|appointment|address|items|date)|change (my|the) (booking|order|job|appointment|address|items|date|time)|reschedule|cancel (my|the) (booking|job|appointment|order)|status (of|on) (my|the) (booking|order|job)|tracking|track my|where (is|are) (my|the) (installer|team|movers|workers)|existing (customer|booking|client)|i (already )?(have a|have an) (booking|appointment|job|order)|follow.?up|follow up)\b/i;
      if (UPDATE_REQUEST_REGEX.test(text) && !session?.botPaused) {
        await storage.upsertWhatsAppSession(from, { botPaused: true, botPausedAt: new Date() });
        const updateMsg = session?.collectedName
          ? `Hi ${session.collectedName}! 😊 Thanks for reaching out.\n\nI've passed your message to our team and they'll get back to you shortly on WhatsApp to assist with your booking.\n\nWe appreciate your patience! 🙏`
          : `Hi! 😊 It looks like you have an existing booking or enquiry.\n\nI've flagged this for our team — they'll follow up with you shortly on WhatsApp.\n\nThank you for your patience! 🙏`;
        await sendBotMessage(from, updateMsg);
        console.log(`[WhatsApp] UPDATE_REQUEST escalation for ${from}: "${text.slice(0, 80)}"`);
        try {
          await sendEmail({
            to: ADMIN_EMAIL,
            subject: `📋 WhatsApp Follow-up — ${from}${session?.collectedName ? ` (${session.collectedName})` : ""} — existing customer/booking update`,
            html: `<p><strong>Customer ${from}${session?.collectedName ? ` (${session.collectedName})` : ""} is asking about an existing booking or requesting an update.</strong></p><p>Message: "${text.slice(0, 300)}"</p><p>Bot state: <code>${state}</code></p><p>Details on file: Name=${session?.collectedName || 'N/A'}, Address=${session?.collectedAddress || 'N/A'}, Items=${session?.collectedItems || 'N/A'}, Date=${session?.collectedDate || 'N/A'}</p><p>⚠️ Bot paused. Please reply manually on WhatsApp.</p>`,
          });
        } catch { /* non-critical */ }
        return;
      }

      const ESCALATION_REGEX = /\b(so angry|very angry|super angry|pissed off|ridiculous|useless bot|terrible service|horrible service|worst service|rubbish bot|stupid bot|waste of (my )?time|want to complain|complain about|refund me|i was cheated|scam(med)?|fraud|talk to (a |an )?human|speak to (a |an )?human|i need a human|want a human|need (an )?agent|speak to (an )?agent|real person|human please|get me (an )?agent|connect me|transfer me|supervisor|manager|call me (now|please)|i give up)\b/i;
      if (ESCALATION_REGEX.test(text) && !session?.botPaused && state !== "submitted") {
        await storage.upsertWhatsAppSession(from, { botPaused: true, botPausedAt: new Date() });
        await sendBotMessage(from,
          `I hear you, and I'm sorry for any frustration. 🙏\n\n` +
          `I've flagged this for our team — a real person will follow up with you shortly on WhatsApp.\n\n` +
          `${session?.collectedName ? `Your details are saved, ${session.collectedName}. ` : ""}Talk soon! 😊`
        );
        console.log(`[WhatsApp] ESCALATION triggered for ${from}: "${text.slice(0, 80)}"`);
        try {
          await sendEmail({
            to: ADMIN_EMAIL,
            subject: `🚨 WhatsApp Escalation — ${from}${session?.collectedName ? ` (${session.collectedName})` : ""} needs human support`,
            html: `<p><strong>Customer ${from}${session?.collectedName ? ` (${session.collectedName})` : ""} requested human assistance on WhatsApp.</strong></p><p>Trigger message: "${text.slice(0, 300)}"</p><p>State at time of escalation: <code>${state}</code></p><p>Collected so far: Name=${session?.collectedName || 'N/A'}, Address=${session?.collectedAddress || 'N/A'}, Items=${session?.collectedItems || 'N/A'}</p><p>⚠️ The bot has been paused for this number. Reply manually on WhatsApp.</p>`,
          });
        } catch { /* non-critical */ }
        return;
      }

      // ── Global: service-explanation intercept ────────────────────────────────
      // If a customer asks "what's the difference between the services?" at ANY
      // point in the flow, answer immediately then let them pick up where they left off.
      const SERVICE_DIFF_REGEX = /\b(what(?:'s| is| are)? (?:the )?difference|differ(?:ent|ence)|which service|what service|what(?:'s| is) (?:an? )?(install(?:ation)?|dismantle|dismantling|relocat(?:ion|e)|disposal)|explain.{0,20}service|service.{0,20}option|what.{0,20}(service|offer)|install(?:ation)? (vs|or|versus) (?:dismantle|reloc|disposal)|service type)/i;
      if (SERVICE_DIFF_REGEX.test(text) && !session?.botPaused) {
        // Map current state → contextual follow-up prompt so they can keep going
        const stateResumePrompt: Record<string, string> = {
          awaiting_name:      `\n\nNow, may I have your *full name* to get started? 😊`,
          awaiting_address:   `\n\nWhen you're ready, just send me the *full job address*. 📍`,
          awaiting_items:     `\n\nSo, what items do you need help with? 😊`,
          awaiting_service:   `\n\nWhich of the above services do you need? Just let me know! 😊`,
          awaiting_date:      `\n\nBack to your quote — what *date* works best for you? 📅`,
          pricing_shown:      `\n\nWould you like to proceed with a full personalised quote?`,
          confirm_booking:    `\n\nReady to confirm? Just reply *Yes* to lock in your booking 😊`,
        };
        const resumeHint = stateResumePrompt[session?.state ?? ""] ?? `\n\nLet me know how I can help you! 😊`;
        await sendBotMessage(from,
          `Great question! Here's a quick rundown of our services:\n\n` +
          `🔧 *Installation* — We assemble and set up your new or flat-pack furniture at your place.\n\n` +
          `🔨 *Dismantling* — We carefully take apart your existing furniture (item stays at your place, no disposal).\n\n` +
          `🚚 *Relocation* — Full service: we dismantle at the current address, transport everything, and reassemble at the new address.\n\n` +
          `🗑️ *Disposal* — We collect and haul away furniture you no longer need.\n\n` +
          `_Need a mix? e.g. dismantle the old wardrobe + install the new one — just tell us and we'll price it all together!_` +
          resumeHint
        );
        return;
      }

      // ── Load conversation history for context-aware GPT calls ────────────────
      const conversationHistory = loadHistory(session);

      const isGreeting = ["restart", "start over", "new quote", "start"].includes(textLower) || textLower.startsWith("hi") || textLower.startsWith("hello") || textLower.startsWith("hey");

      // ── Smart resume: if user has an existing session, offer to continue ────
      if (isGreeting && session && (session.collectedName || session.collectedAddress)) {
        const isExplicitRestart = ["restart", "start over", "new quote"].includes(textLower);
        if (!isExplicitRestart && text.length < 15) {
          // Brief greeting with existing session — offer resume
          const progress = session.state.replace(/_/g, " ");
          await sendBotMessage(from,
            `Welcome back${session.collectedName ? ", " + session.collectedName : ""}! You have a quote in progress.\n\n• Type *continue* — pick up where you left off\n• Type *restart* — start a fresh new quote`
          );
          return;
        }
      }

      // ── Suppress duplicate welcome: session already started (awaiting_name, no data yet) ──
      // When a greeting + photo arrive simultaneously, the greeting re-triggers the welcome.
      // If a session already exists in awaiting_name with nothing collected, just re-ask for name.
      const isSimpleGreeting = isGreeting && !["restart", "start over", "new quote"].includes(textLower);
      if (isSimpleGreeting && session && session.state === "awaiting_name" && !session.collectedName) {
        await sendBotMessage(from, `What's your *full name*? I just need something to address you by. 😊`);
        return;
      }

      if (!session || isGreeting || textLower === "continue" && !session) {
        // ── If this is an image with no caption, handle inline so we don't send
        //    a duplicate welcome message when photo + text arrive simultaneously.
        if (msgType === "image" && text.length < 5 && !session) {
          await storage.upsertWhatsAppSession(from, {
            state: "awaiting_name",
            collectedName: null, collectedAddress: null, collectedItems: null,
            previousItems: null, preferredDate: null, preferredDateIso: null,
            preferredTimeWindow: null, isRelocation: false, collectedToAddress: null, distanceKm: null,
            conversationHistory: null,
          });
          // Scan the photo and offer pricing with quantity accuracy
          let scannedItems0: ScannedFurnitureItem[] = [];
          try {
            if (msg.image?.id) {
              const scanMedia0 = await downloadWhatsAppMedia(msg.image.id);
              if (scanMedia0) {
                const result0 = await scanFurnitureInPhoto(scanMedia0.mimeType, scanMedia0.base64);
                if (result0) scannedItems0 = result0;
              }
            }
          } catch { /* token expired or network error */ }

          if (scannedItems0.length > 0) {
            const displayLabel0 = buildScanDisplayLabel(scannedItems0);
            const estimateText0 = buildEstimateText(scannedItems0, "installation");
            const fakeSession0 = {
              collectedItems: estimateText0,
              floorLevel: null as number | null,
              hasLift: null as boolean | null,
              accessDifficulty: null as string | null,
              isRelocation: false,
              distanceKm: null as string | null,
            };
            const priceMsg0 = await buildJobEstimateMessage(fakeSession0 as any)
              || await smartPricingLookup(scannedItems0[0].name);
            if (priceMsg0) {
              const r0 = `📸 I can see *${displayLabel0}* in your photo!\n\n${priceMsg0}\n\nWould you like a full personalised quote? What's your *full name*?`;
              await sendBotMessage(from, r0);
              saveHistory(from, [], `[photo: ${displayLabel0}]`, r0);
              return;
            }
          }
          const askItem0 = `Spotted a photo! 📸 What item is it, and what service do you need?\n\n_e.g. "3-door wardrobe — installation" or "queen bed frame — dismantling"_`;
          await sendBotMessage(from, askItem0);
          saveHistory(from, [], "[photo]", askItem0);
          return;
        }

        // ── One-shot intake: try to extract name + address from the greeting ──
        let extractedName: string | null = null;
        let extractedAddress: string | null = null;
        let extractedItems: string | null = null;

        // Run extraction if: long enough AND (not a greeting OR long enough to have real content after "hi")
        // e.g. "Hi I'd like to install a wardrobe how much?" → 44 chars → extract items even though starts with "hi"
        let extractedToAddress: string | null = null;
        let extractedIsRelocation = false;

        if (text.length > 15 && (!isGreeting || text.length > 35)) {
          try {
            const extractRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 700,
              response_format: { type: "json_object" },
              messages: [{
                role: "system",
                content: `A customer just sent their first WhatsApp message to TMG Install, a furniture installation company in Singapore.
Extract any details they provided. Return JSON:
{
  "name": string or null,
  "address": string or null,
  "toAddress": string or null,
  "isRelocation": boolean,
  "items": string or null
}
- name: their personal name (not company name). Null if not clearly stated.
- address: full Singapore pickup/from/job address (pickup/from/collection address for relocations). Null if not stated. Accept postal codes (S123456).
- toAddress: delivery/destination/drop-off address for relocations only. Null if not stated.
- isRelocation: true if customer mentions moving, relocation, shifting, pick up and deliver, or from+to address.
- items: Extract ONLY specific named furniture items (e.g. bed frame, wardrobe, sofa, dining table, TV console, mattress, bookshelf). Format as a bullet list — one • per line, include quantity (default 1) and service type in brackets.
  Service type mapping: move/relocate/shift = relocate; dismantle/take apart/remove = dismantle; dispose/throw/haul away/get rid of = dispose; install/assemble/set up/put up = install.
  Examples:
    "I need to move king size bed and wardrobe" → "• 1 king size bed (relocate)\n• 1 wardrobe (relocate)"
    "dispose old bed frame and mattress" → "• 1 bed frame (dispose)\n• 1 mattress (dispose)"
    "install 2 PAX wardrobes and dismantle the old one" → "• 2 PAX wardrobe (install)\n• 1 wardrobe (dismantle)"
  Return null if NO specific furniture items are named. Generic words like "furniture", "stuff", "items", "things" are NOT items — return null.
  "I need relocation" → items: null (no specific items named)
  "I need help moving my furniture" → items: null (generic, no specific item)

Message: "${text.slice(0, 800)}"`
              }]
            });
            const extracted = JSON.parse(extractRes.choices[0]?.message?.content || "{}");
            extractedName = extracted.name || null;
            extractedAddress = extracted.address || null;
            extractedToAddress = extracted.toAddress || null;
            extractedIsRelocation = !!extracted.isRelocation;
            extractedItems = extracted.items || null;
          } catch {}
        }

        // Always go to collecting state — no pricing gate.
        // GPT orchestration handles all states from here.
        const startState = "collecting";

        await storage.upsertWhatsAppSession(from, {
          state: startState,
          collectedName: extractedName,
          collectedAddress: extractedAddress,
          collectedItems: extractedItems,
          previousItems: null,
          preferredDate: null,
          preferredDateIso: null,
          preferredTimeWindow: null,
          isRelocation: extractedIsRelocation,
          collectedToAddress: extractedToAddress,
          distanceKm: null,
          conversationHistory: null,
        });

        // ── Pricing overview message — shown to every new contact ──────────────
        const PRICING_OVERVIEW =
          `Our confirmed pricing (Singapore):\n\n` +
          `• Assembly / Installation — from SGD $80 per item\n` +
          `• Dismantling — from SGD $60 per item\n` +
          `• Disposal (haul away) — from SGD $80 per item\n` +
          `• Dismantling + Disposal bundle — best value\n` +
          `• Relocation (dismantle + move + reinstall) — from SGD $180\n\n` +
          `All prices are fixed — no hidden charges on the day. No GST.\n\n` +
          `Want the exact price for your item? Type the name or send a photo and I'll look it up right away.`;

        if (extractedName && extractedAddress && extractedItems) {
          const r = `Hi ${extractedName}! Here's what I've noted from your message:\n\n` +
            `Address: ${extractedAddress}\n` +
            `Items:\n${extractedItems}\n\n` +
            `Does this look right?\n• Reply *YES* to proceed\n• Tell me what to correct\n• Send a photo to add more items`;
          await sendBotMessage(from, r);
          saveHistory(from, [], text, r);
        } else if (extractedAddress && extractedName) {
          const r = `Hi ${extractedName}! I've noted your address — ${extractedAddress}.\n\nWhat furniture do you need help with?\n\nSend a photo and I'll identify everything, or type the list below.\n\n_e.g. 1 queen bed frame (install), 3-door wardrobe (dismantle)_`;
          await sendBotMessage(from, r);
          saveHistory(from, [], text, r);
        } else if (extractedAddress && extractedItems) {
          const addrLine = extractedToAddress
            ? `📍 *From:* ${extractedAddress}\n📍 *To:* ${extractedToAddress}\n`
            : `📍 *Address:* ${extractedAddress}\n`;
          const r = `Got it — here's what I've noted:\n\n` +
            addrLine +
            `Items:\n${extractedItems}\n\nCould I get your full name to continue?\n\n_e.g. "John", "Mary Tan", "Ahmad"_`;
          await sendBotMessage(from, r);
          saveHistory(from, [], text, r);
        } else if (extractedName) {
          // Got name but no address — ask for job address directly (no pricing dump)
          const r = `Hi ${extractedName}! What service do you need and where is the job located?\n\n_e.g. "Installation at Blk 261 Serangoon Central #05-01" or "Relocation from Tampines to Bedok"_`;
          await sendBotMessage(from, r);
          saveHistory(from, [], text, r);
        } else if (extractedItems) {
          // Items were detected in the first message but no name/address yet.
          // If the customer also asked about price, show them an actual estimate
          // from the extracted items rather than generic per-item ranges.
          const isPriceAsk = /how much|cost|price|rate|charge|quote|estimate|expensive/i.test(text);
          if (isPriceAsk) {
            const fakeSession = {
              collectedItems: extractedItems,
              floorLevel: null as number | null,
              hasLift: null as boolean | null,
              accessDifficulty: null as string | null,
              isRelocation: false,
              distanceKm: null as string | null,
            };
            const estimateMsg = await buildJobEstimateMessage(fakeSession as any);
            if (estimateMsg) {
              const intro = `Hello! Welcome to TMG Install — Singapore's trusted installation specialists with 200+ completed jobs across the island.\n\n`;
              const outro = `\n\nWould you like a personalised quote? Just say *Yes* and I'll get the details from you.`;
              await sendBotMessage(from, `${intro}${estimateMsg}${outro}`);
              scheduleQuoteFollowUp(from);
              saveHistory(from, [], text, estimateMsg);
              return;
            }
          }

          // Items detected — start collecting directly, no "Reply YES" gate
          const detectedServiceScope = extractedIsRelocation ? "relocate" : null;
          const initState = { ...DEFAULT_STRUCTURED_STATE, items: extractedItems, service_scope: detectedServiceScope, is_relocation: extractedIsRelocation };
          await storage.upsertWhatsAppSession(from, {
            state: "collecting",
            structuredState: JSON.stringify(initState),
            collectedItems: extractedItems,
            isRelocation: extractedIsRelocation,
          });
          const intro2 = `Hello! Welcome to TMG Install — Singapore's trusted installation specialists with 200+ completed jobs across the island.\n\n`;
          const itemsAck = `Got it — here's what I've noted:\n${extractedItems}\n\n`;
          const nextQ = `What's the job address? Include block and unit number if possible.\n\n_e.g. Blk 261 Serangoon Central #05-01, S550261_`;
          await sendBotMessage(from, `${intro2}${itemsAck}${nextQ}`);
          saveHistory(from, [], text, `${intro2}${itemsAck}${nextQ}`);

        } else {
          // ── Classify the first message to pick the right opening response ────
          // All paths set state="collecting" with service_scope pre-filled when detected.
          // History is saved in every path so the next turn has full context.
          let firstMsgReply: string | null = null;
          let firstMsgShowPricing = false;
          let firstMsgItem: string | null = null;
          let firstMsgIsReadyToBook = false;
          let firstMsgServiceScope: string | null = null;

          try {
            const firstClassRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 80,
              response_format: { type: "json_object" },
              messages: [{
                role: "system",
                content: `Classify this first WhatsApp message to TMG Install (Singapore furniture installation & relocation).
Return JSON:
{
  "intent": "greeting" | "question" | "pricing_general" | "pricing_specific" | "ready_to_book",
  "itemQuery": "furniture item name if pricing_specific, else null",
  "serviceScope": "install" | "dismantle" | "relocate" | "dispose" | "dismantle_dispose" | null
}
INTENT DEFINITIONS (apply strictly in this order):
- pricing_specific: asking the price of a NAMED furniture item (e.g. "how much to install a wardrobe?", "cost for king bed relocation")
- ready_to_book: customer says they NEED a service, want to arrange a job, or want a quote. INCLUDE: "I need relocation/installation/etc", "I need help with...", "help me move furniture", "looking for movers/installer", "want to relocate my wardrobe", "need someone to assemble my bed". When ANY service need is expressed, choose ready_to_book even if no items are named.
- pricing_general: asking general pricing with NO specific item and NO service need expressed
- question: asking about availability, process, coverage area, warranty — NOT expressing a need to arrange anything
- greeting: ONLY simple hi/hello/hey with NO service need, NO question, NO pricing ask
When in doubt between ready_to_book and any other intent, choose ready_to_book.`
              }, { role: "user", content: text }],
            });
            const fc = JSON.parse(firstClassRes.choices[0]?.message?.content || "{}");
            firstMsgServiceScope = fc.serviceScope || null;

            if (fc.intent === "pricing_specific" && fc.itemQuery) {
              firstMsgItem = fc.itemQuery;
            } else if (fc.intent === "pricing_general") {
              firstMsgShowPricing = true;
            } else if (fc.intent === "ready_to_book") {
              firstMsgIsReadyToBook = true;
              const readyReply = await openai.chat.completions.create({
                model: "gpt-4o",
                max_tokens: 150,
                messages: [{
                  role: "system",
                  content:
                    `You are the WhatsApp coordinator for TMG Install (Singapore furniture services).\n` +
                    `A customer just sent their FIRST message expressing a need for a service.\n` +
                    `Acknowledge SPECIFICALLY what they said (service type, items, urgency — whatever they mentioned).\n` +
                    `Then ask for their full name to get started.\n` +
                    `2 sentences max. Use *bold* for key words. Do NOT repeat pricing. Do NOT use a generic welcome.\n` +
                    `Example: "Got it — *furniture relocation*! Let me get that sorted. Could I start with your *full name*? 😊"`,
                }, { role: "user", content: text }],
              });
              firstMsgReply = readyReply.choices[0]?.message?.content?.trim() || null;
            } else if (fc.intent === "question") {
              const answerRes = await openai.chat.completions.create({
                model: "gpt-4o",
                max_tokens: 250,
                messages: [{
                  role: "system",
                  content:
                    `You are the WhatsApp coordinator for TMG Install (Singapore furniture services).\n\n` +
                    DYNAMIC_FAQ +
                    `\n\n${DYNAMIC_HOURS}\n\n${DYNAMIC_POLICY}\n\n` +
                    `Answer the customer's question warmly and concisely (2–3 sentences). ` +
                    `End with "Is there anything I can help you arrange today? 😊"`,
                }, { role: "user", content: text }],
              });
              firstMsgReply = answerRes.choices[0]?.message?.content?.trim() || null;
            }
          } catch { /* fall through to default welcome */ }

          // Update session with detected service scope so next orchestration turn has context
          if (firstMsgServiceScope) {
            const scopedState = { ...DEFAULT_STRUCTURED_STATE, service_scope: firstMsgServiceScope, is_relocation: firstMsgServiceScope === "relocate" };
            await storage.upsertWhatsAppSession(from, {
              structuredState: JSON.stringify(scopedState),
              isRelocation: firstMsgServiceScope === "relocate",
            });
          }

          // Send the appropriate first reply — history saved in ALL paths so next turn has context
          if (firstMsgItem) {
            const intro = `Hello! Welcome to TMG Install — Singapore's trusted installation specialists with 200+ completed jobs across the island.\n\n`;
            const fakeItemSession = {
              collectedItems: firstMsgItem,
              floorLevel: null as number | null,
              hasLift: null as boolean | null,
              accessDifficulty: null as string | null,
              isRelocation: /reloc|move|moving|shift/i.test(firstMsgItem),
              distanceKm: null as string | null,
            };
            const estimateMsg = await buildJobEstimateMessage(fakeItemSession as any);
            const outro = `\n\nWould you like a full personalised quote? Just say *Yes* and I'll get the job details from you.`;
            const itemReply = intro + (estimateMsg
              ? `${estimateMsg}${outro}`
              : `We'd be happy to quote for *${firstMsgItem}*.\n\nWould you like a personalised quote? 😊`
            );
            await sendBotMessage(from, itemReply);
            saveHistory(from, [], text, itemReply);
          } else if (firstMsgReply && firstMsgIsReadyToBook) {
            await sendBotMessage(from, firstMsgReply);
            saveHistory(from, [], text, firstMsgReply);
          } else if (firstMsgReply) {
            // Question answered — wrap with a greeting
            const qReply = `Hello! Welcome to TMG Install — Singapore's trusted installation specialists with 200+ completed jobs across the island.\n\n${firstMsgReply}`;
            await sendBotMessage(from, qReply);
            saveHistory(from, [], text, qReply);
          } else if (firstMsgShowPricing) {
            const pReply =
              `Hello! Welcome to TMG Install — Singapore's trusted installation specialists with 200+ completed jobs across the island.\n\n` +
              `We handle installation, dismantling, relocation, and disposal — all across Singapore.\n\n` +
              PRICING_OVERVIEW;
            await sendBotMessage(from, pReply);
            saveHistory(from, [], text, pReply);
          } else {
            // Plain greeting — brief welcome, open invitation
            const gReply =
              `Hello! Welcome to TMG Install — Singapore's trusted installation specialists with 200+ completed jobs across the island.\n\n` +
              `How can I help you today?`;
            await sendBotMessage(from, gReply);
            saveHistory(from, [], text, gReply);
          }
        }
        return;
      }

      if (textLower === "continue" && session) {
        const stateLabel: Record<string, string> = {
          pricing_shown: "review the quote — reply Yes when ready",
          awaiting_name: "we still need your name",
          awaiting_address: "we still need your job address",
          awaiting_items: "we still need the furniture list",
          awaiting_items_verify: "please confirm the furniture list",
          awaiting_service_type: "what service type do you need?",
          awaiting_floor: "which floor is the unit on?",
          awaiting_access: "how easy is access to the unit?",
          awaiting_to_address: "what is the destination address for the relocation?",
          awaiting_date: "when would you like this done?",
          awaiting_confirmation: "please confirm your full request",
        };
        let continueMsg = `Welcome back! 😊 Here's where we are:\n\n`;
        if (session.collectedName) continueMsg += `👤 *Name:* ${session.collectedName}\n`;
        if (session.collectedAddress && session.isRelocation && session.collectedToAddress) {
          continueMsg += `📦 *Type:* Relocation\n📍 *From:* ${session.collectedAddress}\n📍 *To:* ${session.collectedToAddress}\n`;
        } else if (session.collectedAddress) {
          continueMsg += `📍 *Address:* ${session.collectedAddress}\n`;
        }
        if (session.collectedItems && session.collectedItems !== "__scanning__") continueMsg += `🛋️ *Items:*\n${session.collectedItems}\n`;
        if (session.preferredDate) {
          const twContinue = session.preferredTimeWindow === "09:00-12:00"
            ? " — Morning (9am–12pm)"
            : session.preferredTimeWindow === "13:00-17:00"
              ? " — Afternoon (1pm–5pm)"
              : "";
          continueMsg += `📅 *Date:* ${session.preferredDate}${twContinue}\n`;
        }
        continueMsg += `\n_Next step: ${stateLabel[session.state] || "let's continue"}_`;
        await sendBotMessage(from, continueMsg);
        return;
      }

      // ── Price objection intercept — fires for any session state ─────────────────
      const PRICE_OBJECTION_RE = /\b(too (expensive|high|much|costly|pric[ey])|very expensive|so expensive|quite expensive|price (is |too )?(high|expensive|much)|cheaper|lower (the |your )?price|can.*reduce|any.*discount|other.*cheaper|going with.*cheaper|found.*cheaper|quote.*high|your (price|quote|rate).*high|expensive lah|ex lah|abit ex|a bit ex|too ex)\b/i;
      if (PRICE_OBJECTION_RE.test(text) && !session?.botPaused) {
        const objectionReply = `I understand — and it's smart to compare prices.\n\nThe difference with TMG Install is that this is a fixed, confirmed price. No hidden charges added on the day, no surprises when our team arrives.\n\nSome cheaper options quote low upfront but add charges for floor access, disposal, or extra manpower on the day — ending up more expensive.\n\nOur team is also fully insured, so if anything is accidentally damaged during the job, you're covered.\n\nWould you like me to walk you through exactly what's included in your quote? 😊`;
        await sendBotMessage(from, objectionReply);
        saveHistory(from, conversationHistory, text, objectionReply);
        return;
      }

      // ── Global correction & help commands (GPT-powered, work from any state) ──
      // Only intercept if the user has at least provided their name (session in progress)
      // and the message looks like a command rather than a direct answer to the current question
      const mightBeGlobalCmd = session?.collectedName && text.length > 2 && !["awaiting_name", "awaiting_service_type"].includes(state);
      if (mightBeGlobalCmd && !["yes", "no", "ok", "confirm", "anytime", "restart", "start over", "continue"].includes(textLower)) {
        try {
          const globalRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 150,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `${COORDINATOR_PERSONA}

You are helping a customer get a quote via WhatsApp for TMG Install.

CUSTOMER CONTEXT:
- Name: ${session.collectedName || "(not yet given)"}
- Job address: ${session.collectedAddress || "(not yet given)"}
- Items: ${session.collectedItems || "(not yet given)"}
- Current step: ${state.replace(/_/g, " ")}

CLASSIFY the customer's latest message. Is it a GLOBAL COMMAND or a NORMAL REPLY to the current question?

Return JSON:
{
  "isCommand": boolean,
  "command": "change_name"|"change_address"|"change_items"|"change_date"|"change_floor"|"change_access"|"change_remarks"|"help"|"pricing"|"faq"|"progress"|"escalate"|"farewell"|"none",
  "faqAnswer": "direct, warm answer (1-2 sentences max) using the coordinator tone if command=faq, otherwise empty string",
  "pricingItem": "specific furniture item if command=pricing, e.g. 'IKEA PAX wardrobe', 'queen bed frame', 'sofa'. Null if not mentioned.",
  "pricingService": "service type if command=pricing and customer mentioned one: 'install'|'dismantle'|'relocate'|'dispose'|'dismantle_dispose'|null. Look for: install/assembly→install, dismantle/dismantling→dismantle, relocat/move/shift→relocate, dispos/haul→dispose, dismantle and dispos→dismantle_dispose"
}

COMMAND RULES:
- change_*: customer explicitly asks to correct/edit something already collected
- change_remarks: customer wants to add/change special notes (condo rules, parking, fragile items)
- help: asking what they can do or how this works
- pricing: customer EXPLICITLY asks about price/cost with words like "how much", "what's the price", "price for", "cost for", "how much does it cost", "price check", "quote for X" — WITHOUT providing other context. NOT descriptions of what they need to do.
- faq: general question about TMG Install (timing, payment, areas, GST, tools, site survey, site visit, etc.) NOT about item pricing
- progress: customer asks what info has been collected so far ("what have you got?", "what do you have?", "summary so far", "what did I give you?", "what have we done?")
- escalate: customer explicitly asks for a human/agent/staff/manager ("talk to human", "real person", "agent please", "need staff")
- farewell: customer says goodbye, thank you, will update later, ok thanks, coming back later, talk later, or any variation of a polite exit — even mid-flow
- none: a direct answer to the current question, a description of their job/needs, or any statement about what they need done — DO NOT override a direct reply

CRITICAL — Do NOT classify as command if customer is directly answering the current question:
- state=collecting → floor/lift answers, addresses, item lists, dates, "none", "skip", emails, OR descriptions of their job/work scope → ALWAYS none. The collection flow handles all of these.
- state=awaiting_floor → floor numbers, lift/no-lift answers → none
- state=awaiting_access → 1/2/3, easy/moderate/hard → none
- state=awaiting_date → dates, times, "anytime", "flexible" → none
- state=awaiting_items → furniture names, item descriptions, or scope of work → none
- state=awaiting_to_address → addresses → none
- state=awaiting_remarks → any text (notes, email, "none", "skip") → none

PRICING vs NONE — CRITICAL DISTINCTION:
- "how much for a sofa relocation?" → pricing (explicit price question)
- "we need to relocate 20 office workstations" → NONE (describing their job, not asking price)
- "we need dismantle workstation and install in new office" → NONE (describing scope of work)
- "what is the cost for wardrobe dismantling?" → pricing (explicit price question)
- "our office is moving to Woodlands" → NONE (relocation context, not a price question)
- "can you help us shift the furniture?" → NONE (scope description)

FAQ ANSWER STYLE — answer briefly and directly, then stop. Examples:
- "Yes, we do dismantling and reassembly. Which item do you need help with?"
- "We cover all of Singapore — HDB, condo, landed, and commercial."
- "No GST — all our prices are nett."
- "50% deposit to confirm, balance on the day of job."
- "We don't conduct pre-visit site surveys, but if you share the item list and some photos, our team can put together an accurate quote for your office. For larger commercial projects, we can also arrange a call to discuss the scope. 😊"
- "We handle office relocations regularly — workstations, desks, partitions, storage units and more. Could you share roughly how many items and some photos so we can prepare a detailed quote?"
If the case is unusual or complex, say the team will review and follow up.`
              },
              ...historyMessages(conversationHistory),
              { role: "user", content: text },
            ],
          });
          const gc = JSON.parse(globalRes.choices[0]?.message?.content || "{}");
          if (gc.isCommand && gc.command && gc.command !== "none") {
            if (gc.command === "change_name") {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_name" });
              await sendBotMessage(from, `Sure! What's the correct name?`);
              return;
            } else if (gc.command === "change_address" && !["awaiting_address", "awaiting_to_address"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_address" });
              await sendBotMessage(from, `No problem! What's the correct job address? Include block and unit number.`);
              return;
            } else if (gc.command === "change_items" && !["awaiting_items", "awaiting_items_verify", "awaiting_confirmation"].includes(state)) {
              // Note: awaiting_confirmation excluded — its own handler handles targeted add/remove/edit with GPT delta logic
              await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedItems: null, previousItems: session.collectedItems });
              await sendBotMessage(from, `Sure! What items do you need help with?\n\n📸 *Send a photo* or *type the list* below.\n\n_e.g._\n• 1 king bed frame (install)\n• 3-door wardrobe (dismantle)`);
              return;
            } else if (gc.command === "change_date" && !["awaiting_date"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_date" });
              const { message: dateMenu } = await buildDateMenuMessage();
              await sendBotMessage(from, `No problem! Let's update that.\n\n${dateMenu}`);
              return;
            } else if (gc.command === "change_floor" && !["awaiting_floor"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_floor" });
              await sendBotMessage(from, `Sure! Which floor is the unit on?\n\n_e.g. reply *1* for ground floor, *3* for third floor_\n\nAnd is there a *lift*? (yes / no)`);
              return;
            } else if (gc.command === "change_access" && !["awaiting_access"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_access" });
              await sendBotMessage(from, `Got it! How easy is access to the unit?\n\n1️⃣ *Easy* — clear hallways, no obstacles\n2️⃣ *Moderate* — some tight corners or minor obstacles\n3️⃣ *Difficult* — very narrow, many obstacles or stairs without lift\n\nReply *1*, *2*, or *3*`);
              return;
            } else if (gc.command === "change_remarks") {
              const richSessR = parseStructuredState(session);
              richSessR.special_remarks = null;
              await storage.upsertWhatsAppSession(from, { state: "collecting", structuredState: JSON.stringify(richSessR), specialRemarks: null });
              await sendBotMessage(from, `Sure! Any special notes or requirements for our team?\n\n_e.g. wall mounting needed, drilling, fragile items, parking info. Reply *none* to skip._`);
              return;
            } else if (gc.command === "change_email") {
              const richSessEm = parseStructuredState(session);
              richSessEm.customer_email = null;
              await storage.upsertWhatsAppSession(from, { state: "collecting", structuredState: JSON.stringify(richSessEm), collectedEmail: null });
              await sendBotMessage(from, `No problem! What's the correct email address for the quote confirmation? 📧\n\n_Reply *skip* if you'd prefer not to provide one._`);
              return;
            } else if (gc.command === "help") {
              const hasAddress = !!session?.collectedAddress;
              const hasItems = !!(session?.collectedItems && session.collectedItems !== "__scanning__");
              let helpMsg = `Here's what you can do at any time:\n\n`;
              helpMsg += `• Type *change name* — update your name\n`;
              if (hasAddress) helpMsg += `• Type *change address* — fix the job address\n`;
              if (hasItems) helpMsg += `• Type *change items* — update the furniture list\n`;
              helpMsg += `• Type *change date* — update your preferred date\n`;
              helpMsg += `• Type *change remarks* — add/update special notes\n`;
              helpMsg += `• Type *summary* — see what we have so far\n`;
              helpMsg += `• Type *hi* or *start over* — restart from the beginning\n\n`;
              helpMsg += `_Currently: ${state.replace(/_/g, " ")}_`;
              await sendBotMessage(from, helpMsg);
              return;
            } else if (gc.command === "pricing") {
              const pricingItem = gc.pricingItem as string | null;
              const pricingService = gc.pricingService as string | null; // service type extracted from caption/text
              const statePromptPricing: Record<string, string> = {
                pricing_shown: `Ready to proceed? Reply *Yes* and I'll prepare your personalised quote.`,
                awaiting_name: `What's your *full name*?`,
                awaiting_address: `📍 What's the *job address*?`,
                awaiting_items: `🛋️ What furniture do you need help with?`,
                awaiting_items_verify: `Does your furniture list look right? Reply *YES* to confirm.`,
                awaiting_service_type: `What *service type* do you need?`,
                awaiting_floor: `Which *floor* and is there a *lift*?`,
                awaiting_access: `How easy is access? Reply *1*, *2*, or *3*.`,
                awaiting_to_address: `📍 What's the *destination address*?`,
                awaiting_date: `📅 When would you like this done?`,
                awaiting_remarks: `Any *special notes* for the team? (or reply *none*)`,
                awaiting_confirmation: `Ready to submit? Reply *YES* to confirm.`,
              };
              const continuePrompt = statePromptPricing[state] || `Let's continue with your quote. 😊`;

              // Human-friendly service type label for context-aware clarification messages
              const serviceLabelMap: Record<string, string> = {
                install: "installation", dismantle: "dismantling", relocate: "relocation",
                dispose: "disposal", dismantle_dispose: "dismantle & dispose",
              };
              const serviceLabel = pricingService ? serviceLabelMap[pricingService] || pricingService : null;

              // If customer sent a photo with "how much this cost?", scan it to identify item(s) with counts
              let resolvedPricingItem = pricingItem;
              let resolvedPricingItems: ScannedFurnitureItem[] = [];
              if (!resolvedPricingItem && msgType === "image" && msg.image?.id) {
                try {
                  const pricingMedia = await downloadWhatsAppMedia(msg.image.id);
                  if (pricingMedia) {
                    const scanResult = await scanFurnitureInPhoto(pricingMedia.mimeType, pricingMedia.base64);
                    if (scanResult && scanResult.length > 0) {
                      resolvedPricingItems = scanResult;
                      resolvedPricingItem = scanResult[0].name;
                    }
                  }
                } catch { /* ignore scan errors */ }
              }

              if (resolvedPricingItem) {
                // Detect commercial/office items — for these, we need quantity before quoting
                const isCommercialItem = /workstation|cubicle|office desk|office partition|panel partition|office furniture|l-shaped desk|standing desk|sit.stand/i.test(resolvedPricingItem);
                const isLargeProject = resolvedPricingItems.length > 5 || isCommercialItem;
                if (isLargeProject && resolvedPricingItems.length === 0) {
                  // For commercial items with unknown quantity, ask scope before pricing
                  await sendBotMessage(from,
                    `Great question! For *${resolvedPricingItem}* ${serviceLabel ? serviceLabel : "work"}, pricing depends on the quantity and scope involved.\n\n` +
                    `Could you share:\n• How many units/items are involved?\n• Photos of the items if possible — our team can give you a precise quote from there.\n\n` +
                    `For office and commercial projects, we work with detailed scope to ensure accurate pricing. 😊\n\n${continuePrompt}`
                  );
                  return;
                }

                // Build estimate using the new quantity-aware engine
                const displayItem = resolvedPricingItems.length > 0
                  ? buildScanDisplayLabel(resolvedPricingItems)
                  : resolvedPricingItem;
                const svcForEstimate = serviceLabel || pricingService || "installation";
                const estimateInputText = resolvedPricingItems.length > 0
                  ? buildEstimateText(resolvedPricingItems, svcForEstimate)
                  : `1 ${resolvedPricingItem} ${svcForEstimate}`;
                const fakeEstSession = {
                  collectedItems: estimateInputText,
                  floorLevel: null as number | null,
                  hasLift: null as boolean | null,
                  accessDifficulty: null as string | null,
                  isRelocation: pricingService === "relocate",
                  distanceKm: null as string | null,
                };
                const priceMsg = await buildJobEstimateMessage(fakeEstSession as any)
                  || await smartPricingLookup(resolvedPricingItem); // fallback if not in catalog
                const floorNote = ``;
                if (serviceLabel) {
                  const priceBlock = priceMsg
                    ? `${priceMsg}${floorNote}\n`
                    : `Our team will confirm the exact price for this job.\n`;
                  // When at confirmation stage, make it crystal-clear this is a SIDE price check,
                  // not a new booking — the original quote is still waiting for YES.
                  const confirmationReminder = state === "awaiting_confirmation"
                    ? `\n\n---\n_⬆️ That's just a side price check! Your *original quote* (${session?.collectedName ? session.collectedName + "'s " : ""}${session?.isRelocation ? "relocation" : "installation"} job) is still waiting — reply *YES* to submit it when ready, or tell me what to change._`
                    : `\n\n${continuePrompt}`;
                  await sendBotMessage(from,
                    `Got it — *${serviceLabel}* for *${displayItem}*. 📸\n\n${priceBlock}${confirmationReminder}`
                  );
                } else {
                  const confirmationReminder2 = state === "awaiting_confirmation"
                    ? `\n---\n_⬆️ That's just a side price check! Your *original quote* is still waiting — reply *YES* to submit it when ready, or tell me what to change._`
                    : `\n\n${continuePrompt}`;
                  await sendBotMessage(from, priceMsg
                    ? `${priceMsg}${floorNote}${confirmationReminder2}`
                    : `Our team will confirm the exact price for the *${displayItem}*.${confirmationReminder2}`
                  );
                }
                return;
              }

              // No specific item in the query — but customer already has items in session →
              // show the full job estimate using the pricing engine
              const hasCollectedItems = session?.collectedItems && session.collectedItems !== "__scanning__";
              if (hasCollectedItems) {
                const estimateMsg = await buildJobEstimateMessage(session!);
                if (estimateMsg) {
                  await sendBotMessage(from, `${estimateMsg}\n\n${continuePrompt}`);
                  scheduleQuoteFollowUp(from);
                  saveHistory(from, conversationHistory, text, estimateMsg);
                  return;
                }
              }

              // No item found at all — if we're awaiting address, redirect there
              if (state === "awaiting_address") {
                await sendBotMessage(from,
                  `📸 Got your photo! I'll scan it for the furniture list once I have your address.\n\n` +
                  `📍 Could you drop the *job address* below?\n\n` +
                  `_e.g. Blk 261 Serangoon Central #05-01, S550261_`
                );
                return;
              }
              // No item found — ask ONLY for the missing piece
              if (serviceLabel) {
                await sendBotMessage(from,
                  `Got it — *${serviceLabel}*. 👍\n\nWhat item is this for?\n\n` +
                  `_e.g. wardrobe, queen bed frame, sofa, dining table_`
                );
              } else {
                await sendBotMessage(from,
                  `Sure! What item would you like a price for, and what service do you need?\n\n` +
                  `_e.g. "IKEA PAX wardrobe — dismantling" or "queen bed frame — relocation"_`
                );
              }
              return;
            } else if (gc.command === "faq" && gc.faqAnswer) {
              // Answer the question and prompt to continue the flow
              const statePrompt: Record<string, string> = {
                pricing_shown: `Ready to proceed? Reply *Yes* and I'll prepare your personalised quote.`,
                awaiting_name: `What's your *full name*?`,
                awaiting_address: `📍 Now, what's the *job address*?`,
                awaiting_items: `🛋️ What furniture do you need help with? (send a photo or type the list)`,
                awaiting_items_verify: `Does your furniture list look right? Reply *YES* to confirm.`,
                awaiting_service_type: `What *service type* do you need? Reply with: *Installation*, *Dismantling*, *Relocation*, *Disposal*, or *Dismantle + Dispose*.`,
                awaiting_floor: `Which *floor* is the unit on, and is there a *lift*?`,
                awaiting_access: `How easy is access? Reply *1* (Easy), *2* (Moderate), or *3* (Difficult).`,
                awaiting_to_address: `📍 What's the *destination address* for the relocation?`,
                awaiting_date: `📅 When would you like this done?`,
                awaiting_remarks: `Any *special notes* for the team? (condo rules, parking, fragile items — or reply *none*)`,
                awaiting_confirmation: `Ready to submit? Reply *YES* to confirm your request.`,
              };
              const prompt = statePrompt[state] || `Let's continue with your quote. 😊`;
              await sendBotMessage(from, `${gc.faqAnswer}\n\n${prompt}`);
              return;
            } else if (gc.command === "change_remarks") {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_remarks" });
              await sendBotMessage(from,
                `Sure! What special notes should our team know? 📝\n\n` +
                `_(e.g. condo move-in rules, parking restrictions, fragile items, narrow lifts)_\n\n` +
                `Reply *none* if there's nothing to add.`
              );
              return;
            } else if (gc.command === "progress") {
              // Show everything collected so far
              const s = session;
              let progressMsg = `Here's what we have so far:\n\n`;
              if (s?.collectedName) progressMsg += `👤 *Name:* ${s.collectedName}\n`;
              else progressMsg += `👤 *Name:* _(not collected yet)_\n`;
              if (s?.collectedEmail) progressMsg += `📧 *Email:* ${s.collectedEmail}\n`;
              if (s?.collectedAddress) progressMsg += `📍 *Address:* ${s.collectedAddress}\n`;
              else progressMsg += `📍 *Address:* _(not collected yet)_\n`;
              if (s?.isRelocation && s?.collectedToAddress) progressMsg += `📦 *Moving to:* ${s.collectedToAddress}\n`;
              if (s?.collectedItems && s.collectedItems !== "__scanning__") progressMsg += `🛋️ *Items:*\n${s.collectedItems}\n`;
              else progressMsg += `🛋️ *Items:* _(not collected yet)_\n`;
              if (s?.floorLevel) progressMsg += `🏢 *Floor:* ${s.floorLevel} (${s.hasLift ? "lift ✅" : "no lift"})\n`;
              if (s?.accessDifficulty) progressMsg += `🚪 *Access:* ${{ easy: "Easy", medium: "Moderate", hard: "Difficult" }[s.accessDifficulty] || s.accessDifficulty}\n`;
              if (s?.preferredDate) progressMsg += `📅 *Preferred date:* ${s.preferredDate}\n`;
              if (s?.specialRemarks) progressMsg += `📝 *Special notes:* ${s.specialRemarks}\n`;
              const stateHintProg: Record<string, string> = {
                awaiting_address: `📍 Still need: *job address*`,
                awaiting_items: `🛋️ Still need: *furniture list*`,
                awaiting_floor: `🏢 Still need: *floor & lift info*`,
                awaiting_access: `🚪 Still need: *access difficulty*`,
                awaiting_date: `📅 Still need: *preferred date*`,
                awaiting_remarks: `📝 Still need: *any special notes*`,
                awaiting_confirmation: `✅ All done — reply *YES* to submit!`,
              };
              const hint = stateHintProg[state];
              if (hint) progressMsg += `\n${hint}`;
              await sendBotMessage(from, progressMsg);
              return;
            } else if (gc.command === "escalate") {
              // Customer explicitly asked for a human — trigger the same escalation path
              await storage.upsertWhatsAppSession(from, { botPaused: true, botPausedAt: new Date() });
              await sendBotMessage(from,
                `Of course! I'll hand you over to our team right away. 😊\n\n` +
                `A real person will follow up with you shortly on WhatsApp.\n\n` +
                `${session?.collectedName ? `Your details are saved, ${session.collectedName}. ` : ""}Talk soon!`
              );
              try {
                await sendEmail({
                  to: ADMIN_EMAIL,
                  subject: `📱 WhatsApp Handoff Request — ${from}${session?.collectedName ? ` (${session.collectedName})` : ""}`,
                  html: `<p>Customer ${from}${session?.collectedName ? ` (${session.collectedName})` : ""} requested to speak to a human.</p><p>State: <code>${state}</code></p><p>Name=${session?.collectedName || 'N/A'}, Address=${session?.collectedAddress || 'N/A'}, Items=${session?.collectedItems || 'N/A'}</p><p>Bot has been paused. Please follow up manually on WhatsApp.</p>`,
                });
              } catch { /* non-critical */ }
              return;
            } else if (gc.command === "farewell") {
              // Warm, sales-focused goodbye — session state unchanged so they pick up where they left off
              const name = session.collectedName ? `, *${session.collectedName}*` : "";

              // Special case: if at confirmation stage, the customer might mean "go with original quote, not the side item"
              // Redirect them to YES rather than treating as a full exit
              if (state === "awaiting_confirmation") {
                const confirmFarewellReply =
                  `No worries${name}! 😊\n\n` +
                  `Your *original quote* is still here and ready — just reply *YES* to submit it to our team! 🎉\n\n` +
                  `_Or message us again later and we'll pick up right where we left off._`;
                await sendBotMessage(from, confirmFarewellReply);
                saveHistory(from, conversationHistory, text, confirmFarewellReply);
                return;
              }

              const resumeStepHint: Record<string, string> = {
                pricing_shown: "Reply *Yes* whenever you're ready and I'll lock in your slot.",
                awaiting_name: "We just need your *name* to get started.",
                awaiting_address: "We just need your *job address* to lock in your quote.",
                awaiting_items: "We just need to know which *items* you need help with.",
                awaiting_items_verify: "We just need you to confirm your *furniture list*.",
                awaiting_service_type: "We just need to know the *service type* you need.",
                awaiting_floor: "We just need your *floor level and lift* info.",
                awaiting_access: "We just need to know how *easy access* is to your unit.",
                awaiting_to_address: "We just need the *destination address* for the relocation.",
                awaiting_date: "We just need a *preferred date* and we're good to go.",
                awaiting_remarks: "We're almost done — just any special notes (or reply *none*) and I'll show the full summary!",
              };
              const hint = resumeStepHint[state] || "Your quote is saved and ready to complete.";
              const farewellReply =
                `No worries${name}! 😊 Take your time — we'll be right here.\n\n` +
                `${hint}\n\n` +
                `Just message us again when you're ready and we'll pick up right where we left off. 👍`;
              await sendBotMessage(from, farewellReply);
              saveHistory(from, conversationHistory, text, farewellReply);
              return;
            }
          }
        } catch {
          // GPT check failed — fall through to state handler
        }
      }

      // ── Keyword-based fallback commands ──────────────────────────────────────
      if (textLower.startsWith("help") && session?.collectedName) {
        const helpMsg =
          `Here's what you can do at any time:\n\n` +
          `• *change name* — update your name\n` +
          `• *change address* — fix the job address\n` +
          `• *change items* — update the furniture list\n` +
          `• *change date* — update your preferred date\n` +
          `• *hi* or *start over* — restart from the beginning`;
        await sendBotMessage(from, helpMsg);
        return;
      }

      // ── Unified orchestration for all active-quote collection states ──────────
      // Handles: pricing_shown, awaiting_name, awaiting_address, awaiting_items,
      // awaiting_items_verify, awaiting_service_type, awaiting_floor, awaiting_access,
      // awaiting_to_address, awaiting_date, awaiting_remarks, collecting
      // awaiting_confirmation is handled separately below (it creates the actual quote)
      if (state !== "awaiting_confirmation") {
        await orchestrateConversation({ from, session, text, msgType, msg, conversationHistory });
        return;
      }

      if (state === "awaiting_confirmation") {
        if (textLower === "cancel" || textLower === "nevermind" || textLower === "never mind" || textLower === "stop") {
          await storage.deleteWhatsAppSession(from);
          await sendBotMessage(from,
            `No worries at all! 😊 If you'd like to get a quote in the future, just send *hi* and I'll help you right away.`
          );
          return;
        }

        if (textLower === "no") {
          // Don't cancel — show correction options
          await sendBotMessage(from,
            `No problem! What would you like to change? 😊\n\n` +
            `• Type *change name*\n` +
            `• Type *change address*\n` +
            `• Type *change items*\n` +
            `• Type *change date*\n` +
            `• Type *change remarks*\n` +
            `• Type *change email*\n` +
            `• Type *cancel* — to cancel this request`
          );
          return;
        }

        if (textLower !== "yes") {
          // Use GPT to understand what the customer wants at confirmation stage
          try {
            const confirmIntent = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 600,
              response_format: { type: "json_object" },
              messages: [{
                role: "system",
                content: `You are a WhatsApp assistant for TMG Install. The customer is at the FINAL CONFIRMATION step and has seen their full quote summary.

Current quote details:
- Name: ${session.collectedName}
- Address: ${session.collectedAddress}
- Items (CURRENT LIST): ${session.collectedItems}
- Floor: ${session.floorLevel}, Lift: ${session.hasLift}
- Access: ${session.accessDifficulty}
- Date: ${session.preferredDate}

Customer said: "${text}"

Classify their intent and return JSON:
{
  "action": "submit" | "edit_items" | "change_name" | "change_address" | "change_date" | "change_remarks" | "change_email" | "redo_items" | "set_relocation" | "question" | "cancel" | "unclear",
  "reply": "friendly 1-sentence acknowledgment of what you changed/understood",
  "updatedItems": "the FULL updated bullet list (all items, one per line) — REQUIRED for edit_items, empty string otherwise"
}

ACTION RULES (follow strictly):
- submit: customer confirms (yes, ok, looks good, send it, go ahead, confirm, correct, all good, etc.)
- edit_items: customer mentions a SPECIFIC item to add, remove, or change. Examples: "remove the wardrobe", "take off 4 desk surfaces", "add 1 sofa", "change the bed to king size", "I don't need the cabinets", "sorry remove X". Use the CURRENT LIST above to compute the FULL updated bullet list with the change applied. DO NOT wipe the whole list — only add/remove/change the specific item mentioned.
- change_name: they say their name is wrong or want to change it
- change_address: they want to change the job address
- change_date: they want to change the date or time slot
- change_remarks: they want to add, change, or remove special notes/remarks
- change_email: they want to provide or change their email address
- redo_items: ONLY use this if the customer explicitly wants to RESTART the ENTIRE items list from scratch (e.g. "redo my items", "start the list over", "completely different items", "clear everything"). NOT for removing one specific item.
- set_relocation: they reveal this is a relocation/moving job
- question: they ask about pricing, timing, or how the service works
- cancel: they want to cancel everything
- unclear: genuinely cannot determine intent

CRITICAL for edit_items:
- "remove X" / "delete X" / "take off X" / "I don't need X" / "without X" / "sorry remove X" → edit_items, remove ONLY that item, keep everything else
- "add X" / "include X" / "also need X" → edit_items, add to existing list
- When computing updatedItems, start from the CURRENT LIST and apply ONLY the stated change
- Keep the same bullet format (• item name (service type)) as the current list`
              }]
            });
            const ci = JSON.parse(confirmIntent.choices[0]?.message?.content || "{}");

            if (ci.action === "submit") {
              // Fall through to YES processing below
            } else if (ci.action === "edit_items") {
              // Apply the targeted add/remove/change directly — stay in confirmation, re-show full summary
              const updatedItems = ci.updatedItems || session.collectedItems || "";
              await storage.upsertWhatsAppSession(from, { state: "awaiting_confirmation", collectedItems: updatedItems });

              // Rebuild the full confirmation summary with updated items
              const floorLvlE = session.floorLevel ?? 1;
              const liftAvailE = session.hasLift ?? true;
              const accessLvlE = session.accessDifficulty ?? "easy";
              const twLabelE = session.preferredTimeWindow === "09:00-12:00"
                ? " (Morning, 9am–12pm)"
                : session.preferredTimeWindow === "13:00-17:00"
                  ? " (Afternoon, 1pm–5pm)"
                  : "";
              const isRelocationE = !!session.isRelocation;
              const toAddrE = session.collectedToAddress;
              const distKmE = session.distanceKm;
              const addressBlockE = isRelocationE && toAddrE
                ? `📦 *Type:* Relocation\n📍 *From:* ${session.collectedAddress}\n📍 *To:* ${toAddrE}${distKmE ? `\n📏 *Distance:* ~${distKmE} km` : ""}`
                : `📍 *Address:* ${session.collectedAddress}`;
              const floorLineE = `🏢 *Floor:* ${floorLvlE === 1 ? "Ground / 1st floor" : `Floor ${floorLvlE}`} (${liftAvailE ? "lift available" : "no lift"})`;
              const accessLineE = `🚪 *Access:* ${{ easy: "Easy", medium: "Moderate", hard: "Difficult" }[accessLvlE] || "Easy"}`;

              const structuredStateE = session.structuredState ? (() => { try { return JSON.parse(session.structuredState); } catch { return null; } })() : null;
              const serviceScopeE = structuredStateE?.service_scope || (isRelocationE ? "relocate" : null);
              const serviceLabelE: Record<string, string> = { install: "Installation", dismantle: "Dismantling", relocate: "Relocation", dispose: "Disposal", dismantle_dispose: "Dismantle + Dispose", mixed: "Mixed" };
              const serviceLineE = serviceScopeE ? `🔧 *Service:* ${serviceLabelE[serviceScopeE] || serviceScopeE}\n` : "";
              const remarksE = session.specialRemarks || structuredStateE?.special_remarks || null;
              const emailE = session.collectedEmail || structuredStateE?.customer_email || null;
              await sendBotMessage(from,
                `${ci.reply || "Done! ✅"} Here's your updated summary:\n\n` +
                serviceLineE +
                `👤 *Name:* ${session.collectedName}\n` +
                `${addressBlockE}\n` +
                `🛋️ *Items:*\n${updatedItems}\n` +
                `${floorLineE}\n` +
                `${accessLineE}\n` +
                `📅 *Requested slot:* ${session.preferredDate || "Flexible"}${twLabelE}\n` +
                `📝 *Notes:* ${remarksE || "None"}\n` +
                (emailE ? `📧 *Email:* ${emailE}\n` : ``) +
                `\nShall I send this to our team? Reply *YES* to submit.\n\n` +
                `_Need to fix anything? Type *change name*, *change address*, *change items*, *change date*, *change floor*, *change access*, *change remarks*, or *change email*._`
              );
              return;
            } else if (ci.action === "change_name") {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_name" });
              await sendBotMessage(from, `${ci.reply || "Sure!"} What's the correct name?`);
              return;
            } else if (ci.action === "change_address") {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_address" });
              await sendBotMessage(from, `${ci.reply || "No problem!"} What's the correct address? 📍`);
              return;
            } else if (ci.action === "change_date") {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_date" });
              const { message: dateMenu } = await buildDateMenuMessage();
              await sendBotMessage(from, `${ci.reply || "Sure!"} Let me pull up available slots for you.\n\n${dateMenu}`);
              return;
            } else if (ci.action === "change_remarks") {
              const richSessRConf = parseStructuredState(session);
              richSessRConf.special_remarks = null;
              await storage.upsertWhatsAppSession(from, { state: "collecting", structuredState: JSON.stringify(richSessRConf), specialRemarks: null });
              await sendBotMessage(from, `${ci.reply || "Sure!"} What are the special notes or requirements for our team? 📝\n\n_e.g. wall mounting needed, drilling, fragile items. Reply *none* to skip._`);
              return;
            } else if (ci.action === "change_email") {
              const richSessEmConf = parseStructuredState(session);
              richSessEmConf.customer_email = null;
              await storage.upsertWhatsAppSession(from, { state: "collecting", structuredState: JSON.stringify(richSessEmConf), collectedEmail: null });
              await sendBotMessage(from, `${ci.reply || "No problem!"} What email address should we send the quote to? 📧\n\n_Reply *skip* if you prefer not to._`);
              return;
            } else if (ci.action === "change_promo") {
              const richSessPromoConf = parseStructuredState(session);
              richSessPromoConf.promo_code = null;
              richSessPromoConf.promo_discount = null;
              richSessPromoConf.promo_asked = false;
              await storage.upsertWhatsAppSession(from, { state: "collecting", structuredState: JSON.stringify(richSessPromoConf) });
              await sendBotMessage(from, `${ci.reply || "Sure!"} What is your promo code? 🏷️\n\n_Reply *none* to skip._`);
              return;
            } else if (ci.action === "redo_items") {
              // Complete redo — keep existing list in previousItems so user can reference it
              await storage.upsertWhatsAppSession(from, {
                state: "awaiting_items",
                collectedItems: null,
                previousItems: session.collectedItems,
              });
              await sendBotMessage(from,
                `${ci.reply || "Sure!"} What items do you need help with?\n\n` +
                `📸 Send a photo or type the list below.`
              );
              return;
            } else if (ci.action === "set_relocation") {
              // Customer reveals this is a relocation job at confirmation stage
              await storage.upsertWhatsAppSession(from, { isRelocation: true, state: "awaiting_to_address" });
              await sendBotMessage(from,
                `${ci.reply || "Got it — this is a relocation job!"} 📦\n\n` +
                `We'll need the *destination address* too — where should the furniture be moved *to*? (e.g. 123 Tampines Ave 3, #05-12)`
              );
              return;
            } else if (ci.action === "cancel") {
              await storage.deleteWhatsAppSession(from);
              await sendBotMessage(from, `${ci.reply || "No worries!"} If you need a quote in future, just send *hi* anytime. 😊`);
              return;
            } else {
              // question or unclear
              await sendBotMessage(from,
                `${ci.reply || "Our team will be in touch to confirm all the details!"} 😊\n\n` +
                `Ready to go? Reply *YES* to submit, or tell me what you'd like to change.`
              );
              return;
            }
            // If action === "submit", fall through to YES processing below
          } catch {
            await sendBotMessage(from,
              `Almost there! 😊 Just reply *YES* to submit to our team, or tell me what you'd like to change.\n\n` +
              `• *change name / address / items* — to fix details\n• *cancel* — to stop`
            );
            return;
          }
        }

        // ── Guard: required fields — redirect rather than fail silently ──────────
        if (!session.collectedAddress) {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_address" });
          await sendBotMessage(from,
            `Before I can submit, I need the *job address*! 📍\n\n` +
            `Where will the work be done? (Block/unit number helps.)\n\n` +
            `_e.g. Blk 261 Serangoon Central #05-01, S550261_`
          );
          return;
        }
        if (!session.collectedName) {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_name" });
          await sendBotMessage(from, `I just need your *name* before I can submit. What should I call you? 😊`);
          return;
        }
        if (!session.collectedItems) {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_items" });
          await sendBotMessage(from, `What furniture do you need help with? Please list the items and services. 🛋️`);
          return;
        }

        const name = session.collectedName!;
        const address = session.collectedAddress!;
        const itemsText = session.collectedItems!;

        // ── Step 1: Load catalog so we can match and use real prices ──────
        const catalog = await storage.getCatalogItems();

        // ── Step 2: Parse items with OpenAI (same logic as web flow) ──────
        const isRelocationJob = !!session.isRelocation;

        // Get carry-only vs full D&R mode from structured state
        const parsedStructuredStateWA = session.structuredState ? (() => { try { return JSON.parse(session.structuredState); } catch { return null; } })() : null;
        const relocateModeWA: "carry" | "full" | null = parsedStructuredStateWA?.relocation_mode || null;
        const isCarryOnly = isRelocationJob && relocateModeWA === "carry";
        const isFullDR = isRelocationJob && relocateModeWA === "full";

        // Build compact catalog block: include both install+dismantle (for D&R formula) plus relocate for carry-only reference
        const relevantSvcTypes = isRelocationJob
          ? ["relocate", "install", "dismantle"]
          : ["install", "dismantle", "dismantle_dispose", "dispose"];
        const compactCatalog = catalog
          .filter(c => relevantSvcTypes.includes(c.serviceType))
          .map(c => `- ${c.name} | ${c.serviceType} | $${Number(c.basePrice).toFixed(0)}`)
          .join("\n");
        let aiParsedItems: { detectedName: string; serviceType: string; quantity: number; estimatedUnitPrice: number; confidence: number }[] = [];
        try {
          const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are an AI assistant for TMG Install, a furniture installation company in Singapore.
Extract furniture items and their service types from the customer's description.

JOB TYPE: ${isRelocationJob ? `RELOCATION — the customer is moving furniture from one place to another. Mode: ${isCarryOnly ? "CARRY ONLY (no dismantle/reinstall)" : isFullDR ? "FULL SERVICE (dismantle + carry + reinstall)" : "RELOCATION"}` : "INSTALLATION / DISMANTLING / DISPOSAL job."}

${isRelocationJob ? `RELOCATION RULE (CRITICAL):
- Use service_type = "relocate" for EVERY furniture item.
- NEVER output both "dismantle" AND "relocate" for the same item. Use ONLY "relocate".
- NEVER output "install" items for a relocation job.
${isCarryOnly ? `- MODE: CARRY ONLY — use catalog relocate price when matched (heavy 2-man items like king bed, massage chair still incur per-item labour). Fall back to estimate if unmatched.` : isFullDR ? `- MODE: FULL SERVICE D&R — estimate the price as max((install catalog price + dismantle catalog price) × 0.60, carry-only catalog price × 1.30). D&R must always cost at least 30% more than Carry Only — never less.` : ""}` : `SERVICE TYPES:
- install: assembling / installing furniture
- dismantle: taking apart only (no disposal)
- dismantle_dispose: take apart AND haul away
- dispose: haul away only (already dismantled)
- If customer says "remove and throw": use dismantle_dispose`}

CATALOG (match item names exactly when possible):
${compactCatalog}

Return a JSON object with an 'items' array. Each item must have:
- 'detectedName': string — use the EXACT catalog name if matched (e.g. 'IKEA PAX Wardrobe (3-door)'), otherwise a short descriptive name
- 'serviceType': string — must be one of the valid types above
- 'quantity': number (default 1)
- 'estimatedUnitPrice': number — use catalog price when matched, otherwise estimate (applies to both carry-only and full D&R modes; carry-only still incurs per-item labour for heavy 2-man items)
- 'confidence': number (0–100)

MATCHING TIPS:
- "pax 2 door" → "IKEA PAX Wardrobe (2-door)"
- "pax 3 door" or "pax wardrobe" → "IKEA PAX Wardrobe (3-door)"
- "pax sliding" → "IKEA PAX Wardrobe (Sliding Doors)"
- Use the catalog name exactly as shown.
Return ONLY valid JSON.`,
              },
              { role: "user", content: itemsText },
            ],
            response_format: { type: "json_object" },
          });
          const raw = aiResponse.choices[0].message.content || '{"items":[]}';
          console.log("[WhatsApp] OpenAI item parse:", raw);
          const parsed = JSON.parse(raw);
          aiParsedItems = parsed.items || [];
        } catch (aiErr) {
          console.error("[WhatsApp] OpenAI parse error:", aiErr);
        }

        // Fallback: create one raw item if parsing returned nothing
        if (!aiParsedItems.length) {
          aiParsedItems = [{ detectedName: itemsText.substring(0, 200), serviceType: isRelocationJob ? "relocate" : "install", quantity: 1, estimatedUnitPrice: 0, confidence: 50 }];
        }

        // ── Step 3: Match each item against the catalog (best match wins) ─
        const findBestCatalogMatch = (detectedName: string, serviceType: string) => {
          const dn = detectedName.toLowerCase();
          const candidates = catalog.filter(c => c.serviceType === serviceType);
          // Score each candidate: exact name match > name-contains > word overlap
          let best: typeof catalog[0] | undefined;
          let bestScore = -1;
          for (const c of candidates) {
            const cn = c.name.toLowerCase();
            let score = 0;
            if (dn === cn) score = 100;
            else if (dn.includes(cn) || cn.includes(dn)) score = 50 + cn.length;
            else {
              const words = dn.split(/\s+/).filter((w: string) => w.length > 3);
              const hits = words.filter((w: string) => cn.includes(w)).length;
              if (hits > 0) score = hits * 10;
            }
            if (score > bestScore) { bestScore = score; best = c; }
          }
          return bestScore > 0 ? best : undefined;
        };

        // Helper: compute full D&R price using shared computeDRPrice (floors at carry × 1.30)
        const computeFullDRPrice = (detectedName: string, fallbackEstimate: number): number => {
          const installEntry = findBestCatalogMatch(detectedName, "install");
          const dismantleEntry = findBestCatalogMatch(detectedName, "dismantle");
          const relocateEntry = findBestCatalogMatch(detectedName, "relocate");
          const carry = relocateEntry ? Number(relocateEntry.basePrice) : 0;
          if (installEntry || dismantleEntry || carry > 0) {
            return computeDRPrice(
              installEntry ? Number(installEntry.basePrice) : undefined,
              dismantleEntry ? Number(dismantleEntry.basePrice) : undefined,
              carry > 0 ? carry : undefined,
            );
          }
          // No catalog data at all — fall back to AI estimate × bundle discount
          const drDiscount = 1 - PricingConfig.fallback.relocateDRDiscount;
          return Math.round(fallbackEstimate * drDiscount * 100) / 100;
        };

        let totalEstimate = 0;
        const quoteItems = aiParsedItems.map((item) => {
          const matchedCatalogItem = findBestCatalogMatch(item.detectedName, item.serviceType);
          let unitPrice: number;
          if (isCarryOnly && item.serviceType === "relocate") {
            // Carry Only still charges per-item labour for heavy 2-man items (king bed, massage chair, etc.)
            // Use catalog basePrice when matched, otherwise fall back to AI-estimated price.
            unitPrice = matchedCatalogItem ? Number(matchedCatalogItem.basePrice) : (item.estimatedUnitPrice || 0);
          } else if (isFullDR && item.serviceType === "relocate") {
            // Full D&R: (install + dismantle) × 0.60
            unitPrice = computeFullDRPrice(item.detectedName, item.estimatedUnitPrice || 0);
          } else {
            unitPrice = matchedCatalogItem ? Number(matchedCatalogItem.basePrice) : (item.estimatedUnitPrice || 0);
          }
          const qty = item.quantity || 1;
          const subtotal = unitPrice * qty;
          totalEstimate += subtotal;
          return {
            originalDescription: itemsText,
            detectedName: item.detectedName,
            serviceType: item.serviceType || "install",
            quantity: qty,
            unitPrice: unitPrice.toFixed(2),
            subtotal: subtotal.toFixed(2),
            catalogItemId: matchedCatalogItem?.id,
          };
        });

        const refNo = `TMG-${randomBytes(6).toString("hex").toUpperCase()}`;

        // ── D&R bundle discount: 40% off dismantle when same quote has both dismantle AND install ──
        const drPctWA = PricingConfig.fallback.relocateDRDiscount;
        const dismantleSubtotalWA = quoteItems.filter(qi => qi.serviceType === 'dismantle').reduce((s, qi) => s + Number(qi.subtotal), 0);
        const installSubtotalWA   = quoteItems.filter(qi => qi.serviceType === 'install').reduce((s, qi) => s + Number(qi.subtotal), 0);
        const drDiscountAmtWA = (dismantleSubtotalWA > 0 && installSubtotalWA > 0)
          ? Math.round(dismantleSubtotalWA * drPctWA * 100) / 100
          : 0;
        if (drDiscountAmtWA > 0) {
          totalEstimate -= drDiscountAmtWA;
          quoteItems.push({
            originalDescription: `D&R Bundle Saving (${Math.round(drPctWA * 100)}% off dismantling)`,
            detectedName: `D&R Bundle Saving (${Math.round(drPctWA * 100)}% off)`,
            serviceType: "discount",
            quantity: 1,
            unitPrice: (-drDiscountAmtWA).toFixed(2),
            subtotal: (-drDiscountAmtWA).toFixed(2),
            catalogItemId: undefined,
          });
        }

        // ── Bulk discount (same tiers as web / Estimate page) ─────────────────
        // Per-hole units weighted at PricingConfig.perHoleBulkWeight so a
        // 120-hole wardrobe doesn't auto-trigger the 100+ tier on its own.
        const totalQty = aiParsedItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const weightedQty = bulkWeightedQty(aiParsedItems.map((it: any) => ({ name: it.name || it.detectedName || "", quantity: it.quantity || 1 })));
        const discountTier = PricingConfig.bulkDiscount.find(t => weightedQty >= t.minQty);
        const discountPct = discountTier?.pct ?? 0;
        const discountAmount = Math.round(totalEstimate * discountPct * 100) / 100;
        if (discountAmount > 0) {
          totalEstimate -= discountAmount;
          quoteItems.push({
            originalDescription: `Bulk Discount (${Math.round(discountPct * 100)}% off, ${totalQty} items)`,
            detectedName: `Bulk Discount (${Math.round(discountPct * 100)}% off)`,
            serviceType: "discount",
            quantity: 1,
            unitPrice: (-discountAmount).toFixed(2),
            subtotal: (-discountAmount).toFixed(2),
            catalogItemId: undefined,
          });
        }

        const laborSubtotalWA = totalEstimate;

        // ── Floor surcharge (same formula as web flow) ─────────────────────────
        const sessionFloorLevel = session.floorLevel ?? 1;
        const sessionHasLift = session.hasLift ?? true;
        const floorsAboveGround = Math.max(0, sessionFloorLevel - 1);
        const floorSurcharge = floorsAboveGround * (sessionHasLift ? PricingConfig.floor.perFloorWithLift : PricingConfig.floor.perFloorNoLift);
        if (floorSurcharge > 0) {
          quoteItems.push({
            originalDescription: `Floor Surcharge (Floor ${sessionFloorLevel}, ${sessionHasLift ? "lift" : "no lift"})`,
            detectedName: "Stairs / Floor Access",
            serviceType: "surcharge",
            quantity: 1,
            unitPrice: floorSurcharge.toFixed(2),
            subtotal: floorSurcharge.toFixed(2),
            catalogItemId: undefined,
          });
        }

        // ── Access difficulty surcharge (applied to labor before minimum) ───────
        const sessionAccess = session.accessDifficulty ?? "easy";
        const accessPct = sessionAccess === "medium" ? PricingConfig.access.mediumPct : sessionAccess === "hard" ? PricingConfig.access.hardPct : 0;
        const accessSurcharge = Math.round(laborSubtotalWA * accessPct * 100) / 100;
        if (accessSurcharge > 0) {
          quoteItems.push({
            originalDescription: `Access Difficulty (${sessionAccess === "medium" ? "Moderate" : "Difficult"})`,
            detectedName: `Access Difficulty (${sessionAccess === "medium" ? "Moderate" : "Difficult"})`,
            serviceType: "surcharge",
            quantity: 1,
            unitPrice: accessSurcharge.toFixed(2),
            subtotal: accessSurcharge.toFixed(2),
            catalogItemId: undefined,
          });
        }

        // ── Transport fee (relocation only) ───────────────────────────────────
        const sessionDistKm = session.distanceKm ? parseFloat(session.distanceKm) : 0;
        const transportFee = session.isRelocation ? calcTransportFee(sessionDistKm) : 0;

        // ── Callout fee (non-relocation jobs) ─────────────────────────────────
        const calloutFeeWA = session.isRelocation ? 0 : PricingConfig.callout.fee;
        if (calloutFeeWA > 0) {
          quoteItems.push({
            originalDescription: "Mobilisation & Coordination",
            detectedName: "Mobilisation & Coordination",
            serviceType: "surcharge",
            quantity: 1,
            unitPrice: calloutFeeWA.toFixed(2),
            subtotal: calloutFeeWA.toFixed(2),
            catalogItemId: undefined,
          });
        }

        const laborTotalWithSurcharges = laborSubtotalWA + floorSurcharge + accessSurcharge;
        const grandTotalBeforePromo = laborSubtotalWA + floorSurcharge + accessSurcharge + transportFee + calloutFeeWA;
        // ─────────────────────────────────────────────────────────────────────

        // Promo code: validate + apply if customer provided one
        const waStructuredState = parsedStructuredStateWA;
        const waPromoCode: string | null = waStructuredState?.promo_code ? waStructuredState.promo_code.trim().toUpperCase() : null;
        let promoDiscountWA = 0;
        if (waPromoCode) {
          try {
            const promoRows = await db.select().from(promoCodes)
              .where(eq(promoCodes.code, waPromoCode)).limit(1);
            const pr = promoRows[0];
            const minOrder = parseFloat(pr?.minOrderAmount ?? "0") || 0;
            const meetsMinOrder = minOrder === 0 || grandTotalBeforePromo >= minOrder;
            if (promoRows.length && pr.active && pr.usesCount < pr.maxUses && meetsMinOrder) {
              promoDiscountWA = parseFloat(pr.discountAmount) || 0;
              if (promoDiscountWA > 0) {
                // Add discount line item
                quoteItems.push({
                  originalDescription: `Promo Code: ${waPromoCode}`,
                  detectedName: `Promo Code: ${waPromoCode}`,
                  serviceType: "discount",
                  quantity: 1,
                  unitPrice: (-promoDiscountWA).toFixed(2),
                  subtotal: (-promoDiscountWA).toFixed(2),
                  catalogItemId: undefined,
                });
                // Decrement usage count
                await db.update(promoCodes)
                  .set({ usesCount: (promoRows[0].usesCount || 0) + 1 })
                  .where(eq(promoCodes.code, waPromoCode));
              }
            }
          } catch { /* ignore — promo optional */ }
        }

        const grandTotal = Math.max(0, grandTotalBeforePromo - promoDiscountWA);

        const depositAmount = (grandTotal * 0.50).toFixed(2);
        const finalAmount = (grandTotal * 0.50).toFixed(2);

        // Build the notes field: include date display + special remarks from customer
        const noteParts: string[] = [];
        if (session.preferredDate && !session.preferredDateIso) noteParts.push(`Preferred date (flexible): ${session.preferredDate}`);
        else if (session.preferredDate && session.preferredDateIso) noteParts.push(`Preferred date: ${session.preferredDate}`);
        if (session.specialRemarks) noteParts.push(`Customer notes: ${session.specialRemarks}`);
        if (waPromoCode && promoDiscountWA > 0) noteParts.push(`Promo code applied: ${waPromoCode} (-$${promoDiscountWA.toFixed(2)})`);
        const combinedNotes = noteParts.length > 0 ? noteParts.join("\n") : null;

        const customerEmail = session.collectedEmail && session.collectedEmail.includes("@")
          ? session.collectedEmail
          : `wa_${from}@tmginstall.com`;

        const quote = await storage.createQuote(
          { name, email: customerEmail, phone: from },
          {
            referenceNo: refNo,
            serviceAddress: address,
            status: "submitted",
            sourceChannel: "whatsapp",
            customerWhatsappPhone: from,
            subtotal: laborTotalWithSurcharges.toFixed(2),
            transportFee: transportFee.toFixed(2),
            total: grandTotal.toFixed(2),
            depositAmount,
            finalAmount,
            requiresManualReview: true,
            relocationMode: session.isRelocation ? (relocateModeWA || null) : null,
            // Relocation: store pickup (from) and dropoff (to) addresses + distance
            pickupAddress: session.isRelocation ? address : null,
            dropoffAddress: session.collectedToAddress || null,
            distanceKm: session.distanceKm || null,
            // Floor & access data (same fields as web flow — affects pricing surcharges)
            floorsInfo: JSON.stringify([{ level: session.floorLevel ?? 1, hasLift: session.hasLift ?? true }]),
            accessDifficulty: session.accessDifficulty ?? "easy",
            // Use the ISO date for the quotes.preferredDate column (admin panel expects yyyy-MM-dd).
            // If the customer said "anytime" / "flexible", preferredDateIso is null — safe.
            preferredDate: session.preferredDateIso || null,
            preferredTimeWindow: session.preferredTimeWindow || null,
            notes: combinedNotes,
            // Promo code discount (if applied)
            ...(waPromoCode && promoDiscountWA > 0 ? {
              promoCode: waPromoCode,
              promoDiscount: promoDiscountWA.toFixed(2),
              discount: promoDiscountWA.toFixed(2),
            } : {}),
          } as any,
          quoteItems as any
        );

        // T005: Fire-and-forget lead_submitted attribution event
        if (quote?.referenceNo) {
          logAttributionEvent(quote.id, quote.referenceNo, "lead_submitted", parseFloat(quote.total ?? "0"), "whatsapp").catch(() => {});
        }

        await storage.deleteWhatsAppSession(from);

        // ── Build itemised quote breakdown for WhatsApp confirmation ─────────
        const serviceEmoji: Record<string, string> = {
          install: "🔧", dismantle: "🔨", relocate: "🚛", dispose: "🗑️",
          dismantle_dispose: "🗑️", surcharge: "📐", discount: "💚", adjustment: "➕",
        };
        const relocateLabelWA = isCarryOnly ? "Carry Only" : isFullDR ? "Full Service (D&R)" : "Relocation (all-in-one)";
        const serviceLabel: Record<string, string> = {
          install: "Install", dismantle: "Dismantle", relocate: relocateLabelWA,
          dispose: "Dispose", dismantle_dispose: "Dismantle & Dispose",
          surcharge: "", discount: "Discount", adjustment: "",
        };
        const lineItems = (quoteItems as any[]).map(qi => {
          const emoji = serviceEmoji[qi.serviceType] || "•";
          const svcLabel = serviceLabel[qi.serviceType] ?? qi.serviceType;
          const itemName = qi.detectedName || qi.originalDescription;
          const label = svcLabel ? `${itemName} (${svcLabel})` : itemName;
          const qty = qi.quantity && qi.quantity > 1 ? ` ×${qi.quantity}` : "";
          const price = `$${parseFloat(qi.subtotal).toFixed(2)}`;
          return `${emoji} ${label}${qty}: ${price}`;
        });

        const breakdownLines = lineItems.join("\n");
        const subtotalLine = `Subtotal: *$${grandTotalBeforePromo.toFixed(2)}*`;
        const promoLine = promoDiscountWA > 0 ? `🏷️ Promo (${waPromoCode}): *-$${promoDiscountWA.toFixed(2)}*\n` : "";
        const transportLine = transportFee > 0 ? `🚛 Transport: *$${transportFee.toFixed(2)}*\n` : "";
        const totalLine = `💰 *Total: $${grandTotal.toFixed(2)}*`;
        const depositLine = `⬇️ *Deposit (50%): $${depositAmount}*`;

        const relocationNote = session.isRelocation
          ? isCarryOnly
            ? `_ℹ️ Carry-only relocation: furniture is moved as-is (no dismantle/reinstall). Transport fee covers crew and vehicle._\n\n`
            : isFullDR
              ? `_ℹ️ Full service relocation: dismantle at origin + transport + reinstall at destination._\n\n`
              : `_ℹ️ Relocation price includes transport. Crew will confirm assembly scope on arrival._\n\n`
          : "";

        // Bundle upsell — only for install-only, non-relocation quotes
        const hasInstallItems = (quoteItems as any[]).some(qi => qi.serviceType === "install");
        const hasDismantleItems = (quoteItems as any[]).some(qi =>
          qi.serviceType === "dismantle" || qi.serviceType === "dismantle_dispose" || qi.serviceType === "relocate"
        );
        const bundleUpsellNote = hasInstallItems && !hasDismantleItems && !session.isRelocation
          ? `💡 *Save 40%:* Need to clear old furniture too? Add *Dismantling* to your order and save 40% on the dismantle cost vs booking separately. Just reply "add dismantling" to update your quote!\n\n`
          : "";

        await sendBotMessage(from,
          `✅ *Quote Ready, ${name}!*\n\n` +
          `🔖 *Reference:* ${quote.referenceNo}\n` +
          `📍 *Address:* ${address}\n` +
          (session.isRelocation && session.collectedToAddress ? `📍 *To:* ${session.collectedToAddress}\n` : "") +
          (session.preferredDate ? `📅 *Date:* ${session.preferredDate}\n` : "") +
          `\n─────────────────\n` +
          `${breakdownLines}\n` +
          `─────────────────\n` +
          `${subtotalLine}\n` +
          `${promoLine}` +
          `${transportLine}` +
          `${totalLine}\n` +
          `${depositLine}\n\n` +
          relocationNote +
          bundleUpsellNote +
          `📋 *What happens next:*\n` +
          `1️⃣ Send your 50% deposit to lock in your slot\n` +
          `2️⃣ We confirm your booking & send a reminder\n` +
          `3️⃣ Our crew arrives on the day — all done! 🎉\n\n` +
          `💳 *Pay deposit now:* Our team will send the PayNow / card link shortly.\n\n` +
          `Need to add or change anything? Just reply here! 😊\n\n` +
          `Track your quote: ${APP_URL}/quotes/${quote.id}?ref=${quote.referenceNo}`
        );

        // Notify admin
        try {
          await sendEmail({
            to: ADMIN_EMAIL,
            subject: `📱 WhatsApp Quote — ${quote.referenceNo} from ${name}`,
            html: `<p>New quote submitted via <strong>WhatsApp</strong> from ${name} (+${from}).</p><p>Reference: <strong>${quote.referenceNo}</strong></p><p>Address: ${address}</p>${session.preferredDate ? `<p>Preferred date: <strong>${session.preferredDate}</strong></p>` : ""}<p>Items:<br>${itemsText.replace(/\n/g, "<br>")}</p><p><a href="${APP_URL}/admin/quotes/${quote.id}">View in Admin Panel</a></p>`,
          });
        } catch (alertErr) {
          console.error("[WhatsApp] Admin alert email error:", alertErr);
        }
        return;
      }

      // ── Smart GPT catch-all — handles anything that wasn't caught by state handlers ──
      // This runs when: state is "submitted", state is unknown, or any edge case
      try {
        const catchAllRes = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 350,
          messages: [{
            role: "system",
            content: `You are a professional WhatsApp customer service assistant for TMG Install, a furniture installation company in Singapore. You are friendly, helpful, and concise.

COMPANY INFO:
- Services: furniture installation, dismantling, and relocation across all of Singapore
- Pricing: from SGD 80/item; $39.90 mobilisation & coordination fee on all non-relocation jobs; relocation adds transport fee
- Mobilisation & coordination fee: a flat $39.90 added to all installation and dismantling jobs (not relocation). It covers the crew's transport to your location, crew dispatch logistics, and job coordination. It is essentially the crew mobilisation charge — NOT a pre-visit or site inspection fee. There is no separate pre-visit; the crew comes once on the job day.
- Coverage: HDB flats, condos, landed property, commercial/offices — all of Singapore
- Payment: 50% deposit (PayNow/bank transfer/card), 50% balance on job completion
- Typical turnaround: quote within 1 business day, job booked after deposit confirmed
- Weekdays and weekends available
- Team provides all tools and equipment
- GST not included (quoted prices are nett)

CUSTOMER STATUS:
- Name: ${session?.collectedName || "not collected yet"}
- Address: ${session?.collectedAddress || "not collected yet"}
- Items: ${session?.collectedItems || "not collected yet"}
- State: ${state}
${state === "submitted" ? "- Quote has been successfully submitted and the team will be in touch" : ""}

INSTRUCTIONS:
1. Respond naturally and helpfully to whatever the customer said
2. If they asked a question → answer it clearly (max 2-3 sentences)
3. If they said thanks / OK / acknowledged something → acknowledge warmly
4. If they seem confused or frustrated → empathize and offer to help
5. If their quote is already submitted → confirm it's submitted, offer a new quote
6. If their quote is in progress → gently guide them back to the flow
7. Always end with a clear call-to-action appropriate to their current state
8. Do NOT make up specific prices for specific items — say the team will confirm
9. Keep responses under 100 words total
10. Write in the same language the customer wrote (English/Chinese/Malay/etc.)

Respond directly — no JSON, just the message text.`,
          }, {
            role: "user",
            content: text,
          }],
        });
        const smartReply = catchAllRes.choices[0]?.message?.content?.trim();
        if (smartReply) {
          await sendBotMessage(from, smartReply);
          return;
        }
      } catch (fbErr) {
        console.error("[WhatsApp] Smart fallback GPT error:", fbErr);
      }

      // Last-resort hardcoded fallback
      await sendBotMessage(from,
        state === "submitted"
          ? `Your request has been submitted — our team will be in touch soon! 😊\n\nReply *hi* to start a new request.`
          : `I'm sorry, I didn't quite catch that! 😊\n\nReply *hi* to start a quote, or *help* to see what you can do.`
      );
    } catch (err) {
      console.error("[WhatsApp] Webhook handler error:", err);
    }
  });

  // ── Admin: Send Payment Link via WhatsApp ─────────────────────────────────
  // Smart route: sends DEPOSIT message if deposit not yet paid,
  //              sends FINAL PAYMENT message if deposit is already paid.
  app.post("/api/admin/quotes/:id/send-whatsapp-payment", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // Admin can pass an explicit phone override (for web-submitted quotes with no WA phone)
      const { phone: phoneOverride } = (req.body as { phone?: string }) || {};
      const rawPhone = phoneOverride?.trim() || (quote as any).customerWhatsappPhone || (quote as any).customer?.phone;
      if (!rawPhone) return res.status(400).json({ message: "No WhatsApp number — please provide one." });

      // Normalise: strip non-digits, add SG country code if bare 8-digit local number
      const phone = normalizeSGPhone(rawPhone);
      const customerName = (quote as any).customer?.name || "there";
      const totalAmt = parseFloat(quote.total || "0");

      // ── Route A: Deposit already paid → send FINAL PAYMENT message ──────────
      if (quote.depositPaidAt) {
        const depositPaid = parseFloat(quote.depositAmount || "0") || totalAmt * 0.5;
        const finalAmount = parseFloat(quote.finalAmount || "0") > 0
          ? parseFloat(quote.finalAmount!)
          : Math.max(0, totalAmt - depositPaid);

        const shortPayUrl = `${APP_URL}/pay/${quote.referenceNo}?type=final`;
        const waMsg =
          `Hi *${customerName}* 👋\n\n` +
          `Your installation for *${quote.referenceNo}* is now complete. Thank you for choosing TMG Install! 🙏\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💳 *Balance Due: S$${finalAmount.toFixed(2)}*\n` +
          `_(50% balance payment — deposit already received)_\n` +
          `Please clear the balance to close your job.\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          waPayBlock(finalAmount, shortPayUrl) +
          `\n\n_We hope to serve you again. Reply here if you need help._`;

        await sendWhatsAppMessage(phone, waMsg);
        console.log(`[WhatsApp] Final payment message sent to +${phone} for ${quote.referenceNo}`);
        return res.json({
          message: `Final payment reminder sent via WhatsApp to +${phone}`,
          phone,
          type: "final",
        });
      }

      // ── Route B: Deposit not yet paid → send DEPOSIT message ────────────────
      const effectiveDeposit = parseFloat(quote.depositAmount || "0") > 0
        ? parseFloat(quote.depositAmount!)
        : totalAmt * 0.5;
      const depositAmountStr = effectiveDeposit.toFixed(2);

      // Use short URL in WhatsApp — cleaner than raw 200-char Stripe URL
      const shortPayUrl = `${APP_URL}/pay/${quote.referenceNo}`;
      await sendWhatsAppPaymentLink(phone, quote.referenceNo, depositAmountStr, shortPayUrl, {
        customerName: (quote as any).customer?.name || undefined,
        scheduledAt: (quote as any).scheduledAt || undefined,
        timeWindow: (quote as any).timeWindow || undefined,
        preferredDate: (quote as any).preferredDate || undefined,
        preferredTimeWindow: (quote as any).preferredTimeWindow || undefined,
      });

      console.log(`[WhatsApp] Deposit payment message sent to +${phone} for ${quote.referenceNo}`);
      res.json({ message: "Deposit reminder sent via WhatsApp", phone, type: "deposit" });
    } catch (err: any) {
      console.error("[WhatsApp] Send payment link error:", err);
      // Surface the actual Meta API reason (e.g. token expired, 24h window, etc.)
      const reason = err?.message || "Failed to send WhatsApp message";
      res.status(500).json({ message: reason });
    }
  });

  // ── Admin: Send a raw WhatsApp message (for reminders) ────────────────────
  app.post("/api/admin/whatsapp/send", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const { phone, message } = (req.body as { phone?: string; message?: string }) || {};
    if (!phone || !message) return res.status(400).json({ message: "phone and message are required" });
    try {
      const normalised = phone.replace(/^\+/, "").replace(/[\s\-]/g, "");
      await sendWhatsAppMessage(normalised, message);
      res.json({ message: "Sent" });
    } catch (err: any) {
      console.error("[WhatsApp] Admin send error:", err);
      const reason = err?.message || "Failed to send WhatsApp message";
      res.status(500).json({ message: reason });
    }
  });

  // ── Admin: Resend deposit request (email or WhatsApp) ─────────────────────
  app.post("/api/admin/quotes/:id/resend-deposit-email", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      const depositAmt = parseFloat(quote.depositAmount || "0") || parseFloat(quote.total) * 0.5;
      const quotePageUrl = `${APP_URL}/quotes/${quote.id}?ref=${quote.referenceNo}`;
      const stripeUrl = await createStripePaymentLink(
        `Deposit for ${quote.referenceNo} — TMG Install`,
        depositAmt,
        { quoteId: String(quote.id), type: "deposit", referenceNo: quote.referenceNo },
        quotePageUrl
      );
      const paymentLink = stripeUrl || quotePageUrl;

      const hasRealEmail = quote.customer?.email &&
        !quote.customer.email.endsWith("@tmginstall.com") &&
        quote.customer.email.includes("@");

      // Send via BOTH channels independently — same dual-channel logic as final payment.
      let emailResendOk = false;
      let waResendOk = false;
      const resendChannels: string[] = [];

      // ── Channel 1: Email ──────────────────────────────────────────────────
      if (hasRealEmail) {
        const emailHtml = depositRequestEmail(quote, paymentLink);
        emailResendOk = await sendEmail({
          to: quote.customer!.email,
          subject: `[${quote.referenceNo}] Deposit Payment Required — TMG Install`,
          html: emailHtml,
        });
        if (emailResendOk) {
          resendChannels.push(`email:${quote.customer!.email}`);
          console.log(`[Deposit] Resent email to ${quote.customer!.email} for ${quote.referenceNo}`);
        } else {
          console.error(`[Deposit] Resend email FAILED to ${quote.customer!.email} for ${quote.referenceNo}`);
        }
      }

      // ── Channel 2: WhatsApp — always attempt when phone available ─────────
      const rawResendPhone = quote.customerWhatsappPhone || quote.customer?.phone;
      if (rawResendPhone) {
        const waResendPhone = normalizeSGPhone(rawResendPhone);
        const shortPayUrl = `${APP_URL}/pay/${quote.referenceNo}`;
        const resendSlotLine = formatSlotLineForQuote(quote);
        const waResendMsg =
          `Hi *${quote.customer?.name || "there"}* 👋\n\n` +
          `Friendly reminder from *TMG Install* — your quote *${quote.referenceNo}* is approved and awaiting your deposit.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 *50% Deposit Required: S$${depositAmt.toFixed(2)}*\n` +
          `${resendSlotLine}` +
          `Your slot is reserved once we receive your deposit.\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          waPayBlock(depositAmt, shortPayUrl) +
          `\n\n_Slot held for 48 hours. Reply here if you need help._`;
        const waSent = await sendWhatsAppMessage(waResendPhone, waResendMsg).catch(() => false);
        waResendOk = !!waSent;
        if (waResendOk) {
          resendChannels.push(`whatsapp:+${waResendPhone}`);
          console.log(`[Deposit] Resent WhatsApp to +${waResendPhone} for ${quote.referenceNo}`);
        } else {
          console.error(`[Deposit] Resend WhatsApp FAILED to +${waResendPhone} for ${quote.referenceNo}`);
        }
      }

      if (!emailResendOk && !waResendOk) {
        return res.status(500).json({ message: "No valid email or WhatsApp number — could not send deposit notification." });
      }

      const resendBoth = emailResendOk && waResendOk;
      const resendChannel = waResendOk ? "whatsapp" : "email";
      const resendTarget = waResendOk
        ? `+${normalizeSGPhone(quote.customerWhatsappPhone || quote.customer?.phone || "")}`
        : quote.customer!.email;

      res.json({
        message: resendBoth
          ? `Deposit link sent via WhatsApp + email`
          : resendChannel === "whatsapp"
            ? `Deposit payment link sent via WhatsApp to ${resendTarget}`
            : `Deposit invoice sent via email to ${resendTarget}`,
        channel: resendChannel,
        channelTarget: resendTarget,
        emailSent: emailResendOk,
        whatsappSent: waResendOk,
      });
    } catch (err: any) {
      console.error("[Deposit] Resend error:", err);
      res.status(500).json({ message: err?.message || "Failed to send deposit notification" });
    }
  });

  // ── Admin: Generate the payment message text + link (copy-able snippet) ──
  // Used as a fallback when WhatsApp delivery fails (24-h window closed, etc.)
  // so the admin can paste the same text into SMS / their personal WhatsApp /
  // email. Re-uses the SAME message templates as the auto-send flow so the
  // customer experience is identical regardless of channel.
  async function buildPaymentMessageForQuote(quote: any, requestedType?: "deposit" | "final") {
    const totalAmt = parseFloat(quote.total || "0");
    const depositPaid = parseFloat(quote.depositAmount || "0") || totalAmt * 0.5;
    const balance = parseFloat(quote.finalAmount || "0") > 0
      ? parseFloat(quote.finalAmount!)
      : Math.max(0, totalAmt - depositPaid);

    // Auto-detect type from quote status when not specified
    const finalStatuses = ["completed", "final_payment_requested", "final_paid", "closed"];
    const depositPaidAlready = !!quote.depositPaidAt;
    const type: "deposit" | "final" = requestedType
      ? requestedType
      : (depositPaidAlready || finalStatuses.includes(quote.status)) ? "final" : "deposit";

    const amount = type === "final" ? balance : (parseFloat(quote.depositAmount || "0") || totalAmt * 0.5);
    const shortPayUrl = type === "final"
      ? `${APP_URL}/pay/${quote.referenceNo}?type=final`
      : `${APP_URL}/pay/${quote.referenceNo}`;

    // Generate fresh Stripe link so the snippet works even after old links expire.
    const quotePageUrl = `${APP_URL}/quotes/${quote.id}?ref=${quote.referenceNo}`;
    const stripeUrl = await createStripePaymentLink(
      type === "final"
        ? `Balance Payment for ${quote.referenceNo} — TMG Install`
        : `Deposit for ${quote.referenceNo} — TMG Install`,
      amount,
      { quoteId: String(quote.id), type, referenceNo: quote.referenceNo },
      quotePageUrl,
    );
    const paymentLink = stripeUrl || quotePageUrl;

    const customerName = quote.customer?.name || "there";
    const slotLine = formatSlotLineForQuote(quote);

    const text = type === "final"
      ? (
          `Hi *${customerName}* 👋\n\n` +
          `Your installation for *${quote.referenceNo}* is now complete. Thank you for choosing TMG Install! 🙏\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💳 *Balance Due: S$${amount.toFixed(2)}*\n` +
          `_(50% balance payment — deposit already received)_\n` +
          `Please clear the balance to close your job.\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          waPayBlock(amount, shortPayUrl) +
          `\n\n_We hope to serve you again. Reply here if you need help._`
        )
      : (
          `Hi *${customerName}* 👋\n\n` +
          `Your quote *${quote.referenceNo}* has been approved by TMG Install!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `💰 *50% Deposit Required: S$${amount.toFixed(2)}*\n` +
          `${slotLine}` +
          `Your slot is reserved once we receive your deposit.\n` +
          `━━━━━━━━━━━━━━━━━━━━\n\n` +
          waPayBlock(amount, shortPayUrl) +
          `\n\n_Slot held for 48 hours. Reply here if you need help._`
        );

    const rawPhone = quote.customerWhatsappPhone || quote.customer?.phone || "";
    const phone = rawPhone ? normalizeSGPhone(rawPhone) : "";
    const waMeUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : "";

    return {
      text,
      paymentLink,
      shortPayUrl,
      waMeUrl,
      amount: amount.toFixed(2),
      type,
      phone,
      refNo: quote.referenceNo,
      customerName: quote.customer?.name || null,
      customerEmail: quote.customer?.email || null,
    };
  }

  app.get("/api/admin/quotes/:id/payment-message", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      const requestedType = req.query.type === "final" || req.query.type === "deposit"
        ? (req.query.type as "deposit" | "final")
        : undefined;
      const payload = await buildPaymentMessageForQuote(quote, requestedType);
      res.json(payload);
    } catch (err: any) {
      console.error("[PaymentMessage] build error:", err);
      res.status(500).json({ message: err?.message || "Failed to generate payment message" });
    }
  });

  // Phone-based lookup: used by the Conversations 24-h-window banner where the
  // admin is in a chat thread, not on a quote detail page. Picks the most
  // recent quote that still owes money.
  app.get("/api/admin/whatsapp/conversations/:phone/payment-message", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const phoneRaw = String(req.params.phone || "").replace(/[^0-9]/g, "");
    if (!phoneRaw) return res.status(400).json({ message: "Invalid phone" });
    const phone = normalizeSGPhone(phoneRaw) || phoneRaw;
    try {
      // Pull every quote linked to this phone (via customerWhatsappPhone or customer.phone)
      // and pick the best candidate that still owes money.
      const candidates = await storage.getQuotesByStatuses([
        "approved", "deposit_requested",
        "completed", "final_payment_requested",
        "deposit_paid", "booked", "assigned", "in_progress",
      ]);
      const matches = candidates.filter(q => {
        const qPhone = (q.customerWhatsappPhone || q.customer?.phone || "").replace(/[^0-9]/g, "");
        const qNorm = qPhone ? (normalizeSGPhone(qPhone) || qPhone) : "";
        return qNorm === phone;
      });
      if (matches.length === 0) {
        return res.status(404).json({
          message: "No open quote found for this customer. Open the quote in the Quotes page and use 'Generate payment message' there.",
        });
      }
      // Pick the most recent active quote
      matches.sort((a, b) => {
        const aT = new Date(a.createdAt as any).getTime();
        const bT = new Date(b.createdAt as any).getTime();
        return bT - aT;
      });
      const quote = matches[0];
      const payload = await buildPaymentMessageForQuote(quote);
      res.json(payload);
    } catch (err: any) {
      console.error("[PaymentMessage] phone lookup error:", err);
      res.status(500).json({ message: err?.message || "Failed to generate payment message" });
    }
  });

  // ── Public + Admin: Customer-facing INVOICE / RECEIPT ───────────────────
  // Build a normalised invoice payload for a quote. Used by the public
  // invoice page (customer link) and the admin "Send invoice" dialog.
  function buildInvoicePayload(quote: any) {
    const totalAmt = parseFloat(quote.total || "0");
    const depositAmt = parseFloat(quote.depositAmount || "0") || totalAmt * 0.5;
    const finalAmt = parseFloat(quote.finalAmount || "0") > 0
      ? parseFloat(quote.finalAmount!)
      : Math.max(0, totalAmt - depositAmt);
    const paidInFull = !!quote.finalPaidAt
      || quote.paymentStatus === "paid_in_full"
      || quote.status === "final_paid"
      || quote.status === "closed";

    // Invoice number derived from the quote ref so it's stable & non-PII.
    // e.g. TMG-MOJN5PS9 → INV-MOJN5PS9
    const refTail = String(quote.referenceNo || "").replace(/^TMG-?/i, "");
    const invoiceNo = `INV-${refTail || quote.id}`;
    // "Issued" date = whenever the final payment cleared (if available),
    // otherwise today (so the invoice doesn't claim to be paid in the future).
    const invoiceDate = quote.finalPaidAt || new Date().toISOString();

    const items = ((quote as any).items || []).map((it: any) => ({
      id: it.id,
      detectedName: it.detectedName || null,
      originalDescription: it.originalDescription || null,
      serviceType: it.serviceType || null,
      quantity: it.quantity || 1,
      unitPrice: String(it.unitPrice || "0"),
      subtotal: String(it.subtotal || "0"),
    }));

    // Resolve billing presentation. Each quote can override the customer's
    // default billing details. Falls back to customer profile, then to the
    // service address as a last resort so old quotes still render.
    const cust: any = (quote as any).customer || {};
    const invoiceType: "residential" | "commercial" =
      ((quote as any).invoiceType === "commercial") ? "commercial" : "residential";
    const billingAddress =
      (quote as any).billingAddress
      || cust.billingAddress
      || quote.serviceAddress
      || null;
    const billingCompanyName = (quote as any).billingCompanyName || cust.companyName || null;
    const billingCompanyUen  = (quote as any).billingCompanyUen  || cust.companyUen  || null;
    const poNumber = (quote as any).poNumber || null;

    return {
      referenceNo: quote.referenceNo,
      invoiceNo,
      invoiceDate,
      customerName: quote.customer?.name || "—",
      customerEmail: quote.customer?.email || null,
      customerPhone: quote.customerWhatsappPhone || quote.customer?.phone || null,
      // Billing presentation (separate from work-site address)
      invoiceType,
      billingAddress,
      billingCompanyName,
      billingCompanyUen,
      poNumber,
      // Work-site / service location (where the staff actually go)
      serviceAddress: quote.serviceAddress || null,
      samePropertyMove: (quote as any).samePropertyMove === true,
      pickupAddress: quote.pickupAddress || null,
      dropoffAddress: quote.dropoffAddress || null,
      scheduledAt: quote.scheduledAt || null,
      timeWindow: quote.timeWindow || null,
      completedAt: quote.finalPaidAt || null,
      items,
      subtotal: String(quote.subtotal || quote.total || "0"),
      transportFee: String((quote as any).transportFee || "0"),
      discount: String(quote.discount || "0"),
      total: String(quote.total || "0"),
      depositAmount: depositAmt.toFixed(2),
      depositPaidAt: quote.depositPaidAt || null,
      finalAmount: finalAmt.toFixed(2),
      finalPaidAt: quote.finalPaidAt || null,
      paidInFull,
    };
  }

  // Self-heal helper: legacy "Mark as Closed" admin action used to set only
  // status='closed' without ever stamping payment dates. The invoice page then
  // had no "Paid on" date to show. Whenever we read a closed quote that's
  // missing those fields, lazily backfill them so the data is permanently
  // consistent (and future reads are clean).
  async function ensureClosedQuoteIsStamped(quote: any) {
    if (!quote || quote.status !== "closed") return quote;
    const needsHeal = !quote.finalPaidAt
      || !quote.depositPaidAt
      || quote.paymentStatus !== "paid_in_full";
    if (!needsHeal) return quote;
    const now = new Date();
    const patch: Partial<typeof quotesTable.$inferInsert> = {
      paymentStatus: "paid_in_full",
    };
    if (!quote.depositPaidAt) patch.depositPaidAt = now;
    if (!quote.finalPaidAt)   patch.finalPaidAt   = now;
    try {
      await db.update(quotesTable).set(patch).where(eq(quotesTable.id, quote.id));
      console.log(`[Invoice] Self-healed closed quote ${quote.referenceNo} — backfilled payment dates`);
      return await storage.getQuote(quote.id) || quote;
    } catch (e) {
      console.error("[Invoice] Self-heal failed for", quote.referenceNo, e);
      return quote;
    }
  }

  // Public endpoint — used by customers via shareable invoice link.
  // Only serves invoices that are PAID IN FULL so we never expose
  // a partially-paid job as a "receipt".
  app.get("/api/public/invoice/:refNo", async (req, res) => {
    try {
      const refNo = String(req.params.refNo || "").toUpperCase();
      if (!refNo) return res.status(400).json({ message: "Invalid reference" });
      const [row] = await db.select().from(quotesTable).where(
        or(
          eq(quotesTable.referenceNo, refNo),
          drizzleSql`${quotesTable.legacyReferenceNos} @> ARRAY[${refNo}]::text[]`
        )
      ).limit(1);
      if (!row) return res.status(404).json({ message: "Invoice not found" });
      let quote = await storage.getQuote(row.id);
      if (!quote) return res.status(404).json({ message: "Invoice not found" });
      quote = await ensureClosedQuoteIsStamped(quote);
      const paidInFull = !!quote.finalPaidAt
        || quote.paymentStatus === "paid_in_full"
        || quote.status === "final_paid"
        || quote.status === "closed";
      if (!paidInFull) {
        return res.status(403).json({ message: "Invoice is only available once payment is complete." });
      }
      res.json(buildInvoicePayload(quote));
    } catch (err: any) {
      console.error("[Invoice] public fetch error:", err);
      res.status(500).json({ message: err?.message || "Failed to load invoice" });
    }
  });

  // Admin endpoint — returns a sendable invoice message (text + share URL).
  // Available for any quote that has at least cleared the final payment;
  // the admin can copy/paste into WhatsApp, SMS or email.
  app.get("/api/admin/quotes/:id/invoice-message", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      let quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      quote = await ensureClosedQuoteIsStamped(quote);
      const paidInFull = !!quote.finalPaidAt
        || quote.paymentStatus === "paid_in_full"
        || quote.status === "final_paid"
        || quote.status === "closed";
      if (!paidInFull) {
        return res.status(409).json({
          message: "Invoice is only available once the final payment is recorded. Mark the job as fully paid first.",
        });
      }

      const payload = buildInvoicePayload(quote);
      const viewUrl  = `${APP_URL}/invoice/${payload.referenceNo}`;
      const printUrl = `${APP_URL}/invoice/${payload.referenceNo}?print=1`;

      const customerName = payload.customerName !== "—" ? payload.customerName : "there";
      const text =
        `Hi *${customerName}* 🙏\n\n` +
        `Please find your invoice / receipt for *${payload.referenceNo}* attached — payment received in full.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🧾 *Invoice ${payload.invoiceNo}*\n` +
        `*Total Paid: S$${Number(payload.total).toFixed(2)}*\n` +
        `✅ PAID IN FULL\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `A PDF copy is attached to this chat for your records. ` +
        `You can also view it online here:\n${viewUrl}\n\n` +
        `Thank you again for choosing TMG Install! 💪`;

      const rawPhone = payload.customerPhone || "";
      const phone = rawPhone ? normalizeSGPhone(String(rawPhone)) : "";
      const waMeUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : "";

      res.json({
        text,
        viewUrl,
        printUrl,
        waMeUrl,
        phone,
        refNo: payload.referenceNo,
        invoiceNo: payload.invoiceNo,
        customerName: payload.customerName !== "—" ? payload.customerName : null,
        customerEmail: payload.customerEmail,
        total: Number(payload.total).toFixed(2),
      });
    } catch (err: any) {
      console.error("[Invoice] message build error:", err);
      res.status(500).json({ message: err?.message || "Failed to generate invoice message" });
    }
  });

  // ── Admin: Reset deposit so a new payment link can be sent ───────────────
  app.post("/api/admin/quotes/:id/reset-deposit", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      await db.update(quotesTable).set({
        depositPaidAt: null,
        paymentStatus: "unpaid",
        status: "deposit_requested",
      }).where(eq(quotesTable.id, id));

      await db.insert(jobUpdatesTable).values({
        quoteId: id,
        statusChange: "deposit_requested",
        actorType: "admin",
        note: `Deposit status reset by admin — previous test payment cleared. New link to be sent.`,
      });

      console.log(`[Admin] Deposit reset for ${quote.referenceNo} by admin`);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[Admin] Reset deposit error:", err);
      res.status(500).json({ message: err?.message || "Failed to reset deposit" });
    }
  });

  // ── Admin: Mark PayNow / manual deposit as received ───────────────────────
  app.post("/api/admin/quotes/:id/mark-paynow-paid", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      const depositAmt = (parseFloat(quote.depositAmount || "0") || parseFloat(quote.total || "0") * 0.5).toFixed(2);
      const { note } = z.object({ note: z.string().optional() }).parse(req.body);

      // Idempotent recovery: deposit was already recorded (e.g. via Stripe webhook or
      // a partial earlier attempt) but status is still stuck in an early stage.
      // Promote the status forward without re-recording the payment or re-notifying.
      const STALE_PRE_DEPOSIT = ['submitted', 'under_review', 'deposit_requested'];
      if (quote.depositPaidAt && STALE_PRE_DEPOSIT.includes(quote.status as string)) {
        const targetStatus: any = (quote.preferredDate && quote.preferredTimeWindow) ? 'booked' : 'deposit_paid';
        const patch: any = { status: targetStatus, paymentStatus: 'deposit_paid' };
        if (targetStatus === 'booked' && !quote.scheduledAt) {
          patch.scheduledAt = new Date(quote.preferredDate + 'T12:00:00');
          patch.timeWindow = quote.preferredTimeWindow;
          patch.bookingRequestedAt = new Date();
          patch.slotHeldUntil = null;
        }
        await db.update(quotes).set(patch).where(eq(quotes.id, id));
        await storage.updateQuoteStatus(
          id, targetStatus,
          { actorType: "admin", note: `Status synced — deposit already on record${note ? ` (${note})` : ""}` },
        );
        const refreshed = await storage.getQuote(id);
        console.log(`[PayNow] Idempotent sync for ${quote.referenceNo}: ${quote.status} → ${targetStatus}`);
        return res.json({ ok: true, quote: refreshed, synced: true });
      }

      if (quote.depositPaidAt) return res.status(409).json({ message: "Deposit already marked as paid" });

      // Reuse the same updateQuotePayment logic (sets depositPaidAt, status → deposit_paid)
      const updated = await storage.updateQuotePayment(id, "deposit", depositAmt);
      if (!updated || !updated.customer) return res.json({ ok: true });

      // Log the manual payment note
      await storage.updateQuoteStatus(
        id, updated.status,
        { actorType: "admin", note: `PayNow deposit received${note ? ` — ${note}` : ""}` },
      );

      // T005: Fire-and-forget attribution hook
      if (updated.referenceNo) {
        logAttributionEvent(updated.id, updated.referenceNo, "deposit_paid", parseFloat(updated.total ?? "0"), undefined, { channel: "paynow" }).catch(() => {});
      }

      // Same post-payment notifications as Stripe flow
      const hasRealEmailPn = updated.customer.email &&
        !updated.customer.email.endsWith("@tmginstall.com") &&
        updated.customer.email.includes("@");
      if (hasRealEmailPn) {
        try {
          await sendEmail({
            to: updated.customer.email,
            subject: `[${updated.referenceNo}] Deposit Received — Slot Confirmed!`,
            html: depositReceivedEmail(updated),
          });
        } catch (emailErr) {
          console.error("[PayNow] Email failed:", emailErr);
        }
      }

      const rawTrackPhonePn = updated.customerWhatsappPhone || updated.customer?.phone;
      const trackPhone = rawTrackPhonePn ? normalizeSGPhone(rawTrackPhonePn) : null;
      if (trackPhone) {
        const msg = `✅ *Deposit received via PayNow — your job is confirmed!*\n\nTrack your installation progress here:\n${APP_URL}/track/${updated.referenceNo}\n\n_We'll be in touch shortly to confirm your schedule._ 👷`;
        await sendWhatsAppMessage(trackPhone, msg).catch(() => {});
      }

      console.log(`[PayNow] Deposit manually confirmed for ${updated.referenceNo} by admin`);
      res.json({ ok: true, quote: updated });
    } catch (err: any) {
      console.error("[PayNow] mark-paynow-paid error:", err);
      res.status(500).json({ message: err?.message || "Failed to mark PayNow paid" });
    }
  });

  // ── Admin: Mark final payment received via PayNow (closes case + sends WA invoice) ──
  app.post("/api/admin/quotes/:id/collect-final-payment", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      if (quote.finalPaidAt) return res.status(409).json({ message: "Final payment already collected" });

      const { note } = z.object({ note: z.string().optional() }).parse(req.body);
      const quoteTotal = parseFloat(quote.total || "0");
      const depositPaid = parseFloat(quote.depositAmount || "0") || quoteTotal * 0.5;
      const baseBalance = parseFloat(quote.finalAmount || "0") > 0
        ? parseFloat(quote.finalAmount!)
        : Math.max(0, quoteTotal - depositPaid);
      const finalAmt = baseBalance.toFixed(2);

      // Mark final paid → auto-closes quote
      const updated = await storage.updateQuotePayment(id, "final", finalAmt);
      if (!updated || !updated.customer) return res.json({ ok: true });

      // T005: Fire-and-forget attribution hook
      if (updated.referenceNo) {
        logAttributionEvent(updated.id, updated.referenceNo, "final_paid", parseFloat(updated.total ?? "0"), undefined, { channel: "paynow" }).catch(() => {});
      }

      if (note) {
        await db.insert(jobUpdates).values({
          quoteId: id,
          statusChange: "closed" as any,
          actorType: "admin",
          note: `Final payment collected — ${note}`,
        });
      }

      // ── Build detailed WhatsApp invoice ───────────────────────────────────
      const items = (updated as any).items || [];
      const ref   = updated.referenceNo;
      const name  = updated.customer.name || "there";
      const subtotal   = parseFloat(updated.subtotal || updated.total || "0");
      const transport  = parseFloat((updated as any).transportFee || "0");
      const deposit    = parseFloat(updated.depositAmount || "0");
      const totalAmt   = parseFloat(updated.total || "0");

      let itemLines = "";
      if (items.length > 0) {
        itemLines = items.map((it: any) => {
          const desc = it.detectedName || it.originalDescription || "Service";
          const qty  = it.quantity || 1;
          const price = parseFloat(it.subtotal || it.unitPrice || "0").toFixed(2);
          return `  • ${desc} × ${qty} — $${price}`;
        }).join("\n");
      }

      const invoiceLines = [
        `🧾 *INVOICE — ${ref}*`,
        `Hi ${name}! Thank you for your payment.`,
        ``,
        ...(itemLines ? [`*Items:*`, itemLines, ``] : []),
        `Subtotal: S$${subtotal.toFixed(2)}`,
        ...(transport > 0 ? [`Transport: S$${transport.toFixed(2)}`] : []),
        `─────────────────`,
        `*Total: S$${totalAmt.toFixed(2)}*`,
        ...(deposit > 0 ? [
          `Deposit paid: S$${deposit.toFixed(2)}`,
          `Balance paid: S$${(totalAmt - deposit).toFixed(2)}`,
        ] : []),
        ``,
        `✅ *FULLY PAID — CASE CLOSED*`,
        `Thank you for choosing *TMG Install*! 🙏`,
      ].join("\n");

      const rawWaFinal = updated.customerWhatsappPhone || updated.customer?.phone;
      const waPhone = rawWaFinal ? normalizeSGPhone(rawWaFinal) : null;
      if (waPhone) {
        await sendWhatsAppMessage(waPhone, invoiceLines).catch(() => {});
        console.log(`[FinalPayment] WA invoice sent to +${waPhone} for ${ref}`);
      }

      // Also send case-closed email if real email exists
      await sendCaseClosedNotifications(updated);

      console.log(`[FinalPayment] Manual final collected $${finalAmt} for ${ref}`);
      res.json({ ok: true, quote: updated });
    } catch (err: any) {
      console.error("[FinalPayment] collect-final-payment error:", err);
      res.status(500).json({ message: err?.message || "Failed to collect final payment" });
    }
  });

  // ── Admin: App Settings (GET all + bulk save) ─────────────────────────────
  app.get("/api/admin/app-settings", async (_req, res) => {
    try {
      const rows = await db.select().from(appSettings);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: "Failed to load settings" });
    }
  });

  app.post("/api/admin/app-settings/bulk", async (req, res) => {
    try {
      const data = req.body as Record<string, string>;
      if (typeof data !== "object") return res.status(400).json({ message: "Invalid data" });
      for (const [key, value] of Object.entries(data)) {
        await db.insert(appSettings).values({ key, value })
          .onConflictDoUpdate({ target: appSettings.key, set: { value } });
      }
      res.json({ message: "Settings saved" });
    } catch (err) {
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  // ── Admin: FAQ Entries ─────────────────────────────────────────────────────
  app.get("/api/admin/faq", async (_req, res) => {
    try {
      const entries = await storage.getFaqEntries();
      res.json(entries);
    } catch (err) {
      res.status(500).json({ message: "Failed to load FAQ entries" });
    }
  });

  app.post("/api/admin/faq", async (req, res) => {
    try {
      const data = req.body as { question: string; answer: string; category?: string; active?: boolean; sortOrder?: number };
      if (!data.question?.trim() || !data.answer?.trim()) {
        return res.status(400).json({ message: "Question and answer are required" });
      }
      const entry = await storage.createFaqEntry({
        question: data.question.trim(),
        answer: data.answer.trim(),
        category: data.category || "general",
        active: data.active !== false,
        sortOrder: data.sortOrder ?? 0,
      });
      res.json(entry);
    } catch (err) {
      res.status(500).json({ message: "Failed to create FAQ entry" });
    }
  });

  app.patch("/api/admin/faq/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body as Partial<{ question: string; answer: string; category: string; active: boolean; sortOrder: number }>;
      const entry = await storage.updateFaqEntry(id, data);
      if (!entry) return res.status(404).json({ message: "FAQ entry not found" });
      res.json(entry);
    } catch (err) {
      res.status(500).json({ message: "Failed to update FAQ entry" });
    }
  });

  app.delete("/api/admin/faq/:id", async (req, res) => {
    try {
      await storage.deleteFaqEntry(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete FAQ entry" });
    }
  });

  // ── Admin: Canned Replies ──────────────────────────────────────────────────
  app.get("/api/admin/canned-replies", async (_req, res) => {
    try {
      const replies = await storage.getCannedReplies();
      res.json(replies);
    } catch (err) {
      res.status(500).json({ message: "Failed to load canned replies" });
    }
  });

  app.post("/api/admin/canned-replies", async (req, res) => {
    try {
      const data = req.body as { shortcut: string; title: string; body: string; active?: boolean };
      if (!data.shortcut?.trim() || !data.title?.trim() || !data.body?.trim()) {
        return res.status(400).json({ message: "Shortcut, title and body are required" });
      }
      const sc = data.shortcut.trim().startsWith("/") ? data.shortcut.trim() : `/${data.shortcut.trim()}`;
      const reply = await storage.createCannedReply({ shortcut: sc, title: data.title.trim(), body: data.body.trim(), active: data.active !== false });
      res.json(reply);
    } catch (err: any) {
      const msg = err?.message?.includes("unique") ? "That shortcut already exists" : "Failed to create canned reply";
      res.status(500).json({ message: msg });
    }
  });

  app.patch("/api/admin/canned-replies/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body as Partial<{ shortcut: string; title: string; body: string; active: boolean }>;
      if (data.shortcut && !data.shortcut.startsWith("/")) data.shortcut = `/${data.shortcut}`;
      const reply = await storage.updateCannedReply(id, data);
      if (!reply) return res.status(404).json({ message: "Canned reply not found" });
      res.json(reply);
    } catch (err: any) {
      const msg = err?.message?.includes("unique") ? "That shortcut already exists" : "Failed to update canned reply";
      res.status(500).json({ message: msg });
    }
  });

  app.delete("/api/admin/canned-replies/:id", async (req, res) => {
    try {
      await storage.deleteCannedReply(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete canned reply" });
    }
  });

  // ── Admin: Pricing Corrections (self-learning) ─────────────────────────────
  app.get("/api/admin/pricing-corrections", async (_req, res) => {
    try {
      const rows = await storage.getPricingCorrections();
      res.json(rows);
    } catch {
      res.status(500).json({ message: "Failed to load pricing corrections" });
    }
  });

  app.post("/api/admin/pricing-corrections", async (req, res) => {
    try {
      const data = req.body as { detectedDescription: string; correctedName: string; catalogItemName?: string; notes?: string; active?: boolean };
      if (!data.detectedDescription?.trim() || !data.correctedName?.trim()) {
        return res.status(400).json({ message: "Detected description and corrected name are required" });
      }
      const row = await storage.createPricingCorrection({
        detectedDescription: data.detectedDescription.trim(),
        correctedName: data.correctedName.trim(),
        catalogItemName: data.catalogItemName?.trim() || null,
        notes: data.notes?.trim() || null,
        active: data.active !== false,
      });
      res.json(row);
    } catch {
      res.status(500).json({ message: "Failed to create pricing correction" });
    }
  });

  app.patch("/api/admin/pricing-corrections/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body as Partial<{ detectedDescription: string; correctedName: string; catalogItemName: string; notes: string; active: boolean }>;
      const row = await storage.updatePricingCorrection(id, data);
      if (!row) return res.status(404).json({ message: "Not found" });
      res.json(row);
    } catch {
      res.status(500).json({ message: "Failed to update pricing correction" });
    }
  });

  app.delete("/api/admin/pricing-corrections/:id", async (req, res) => {
    try {
      await storage.deletePricingCorrection(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch {
      res.status(500).json({ message: "Failed to delete pricing correction" });
    }
  });

  // ── Admin: WhatsApp Token Settings ────────────────────────────────────────
  app.post("/api/admin/settings/whatsapp-token", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const callerWt = await storage.getUserById(req.session.userId);
    if (!callerWt || callerWt.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { token } = req.body as { token?: string };
    if (!token || typeof token !== "string" || token.trim().length < 20) {
      return res.status(400).json({ message: "Invalid token" });
    }
    try {
      await updateAccessToken(token.trim());
      res.json({ message: "WhatsApp token updated successfully" });
    } catch (err) {
      console.error("[Admin] Failed to update WhatsApp token:", err);
      res.status(500).json({ message: "Failed to update token" });
    }
  });

  // ── WhatsApp token status check ────────────────────────────────────────────
  app.get("/api/admin/whatsapp/token-status", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const callerTs = await storage.getUserById(req.session.userId);
    if (!callerTs || callerTs.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const token = await getAccessToken();
      if (!token) return res.json({ status: "missing", message: "No token configured" });

      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`;
      const r = await fetch(debugUrl);
      const data = await r.json() as any;

      if (!data?.data?.is_valid) {
        const errMsg = data?.data?.error?.message || data?.error?.message || "Token invalid";
        return res.json({ status: "invalid", message: errMsg });
      }

      const expiresAt: number = data.data.expires_at ?? 0;
      const nowSec = Math.floor(Date.now() / 1000);
      if (expiresAt === 0) {
        return res.json({ status: "ok", message: "Permanent System User token — no expiry" });
      }
      const daysLeft = Math.round((expiresAt - nowSec) / 86400);
      if (daysLeft <= 0) {
        return res.json({ status: "expired", message: `Token expired ${Math.abs(daysLeft)} day(s) ago — update now!`, daysLeft });
      }
      if (daysLeft <= 7) {
        return res.json({ status: "expiring_soon", message: `Token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} — renew soon!`, daysLeft });
      }
      return res.json({ status: "ok", message: `Token valid — ${daysLeft} days remaining`, daysLeft });
    } catch (err) {
      return res.json({ status: "error", message: "Could not check token" });
    }
  });

  // ── Public site settings (live overrides written by AI Site agent) ──
  // Returns a flat map of field→value for a given page (or all pages).
  // Frontend uses this to override default meta tags, hero copy, CTA text.
  app.get("/api/public/site-settings", async (req, res) => {
    try {
      const { siteSettings } = await import("@shared/schema");
      const page = (req.query.page as string) || undefined;
      const rows = page
        ? await db.select().from(siteSettings).where(eq(siteSettings.page, page))
        : await db.select().from(siteSettings);
      const out: Record<string, Record<string, string>> = {};
      for (const r of rows) {
        const p = r.page || "/";
        const f = r.field || "unknown";
        if (!out[p]) out[p] = {};
        out[p][f] = r.settingValue;
      }
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
      return res.json(out);
    } catch {
      return res.json({});
    }
  });

  app.get("/api/public/google-review", async (_req, res) => {
    try {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "google_review_url"));
      const writeUrl = row?.value || "https://g.page/r/Cd2v7iBjl_GKEBM/review";
      const viewUrl = writeUrl.replace(/\/review$/, "");
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
      return res.json({ writeUrl, viewUrl });
    } catch {
      return res.json({
        writeUrl: "https://g.page/r/Cd2v7iBjl_GKEBM/review",
        viewUrl:  "https://g.page/r/Cd2v7iBjl_GKEBM",
      });
    }
  });

  // GET /api/public/testimonials — returns admin-editable testimonial cards
  app.get("/api/public/testimonials", async (_req, res) => {
    try {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "testimonials"));
      if (row?.value) {
        res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
        return res.json(JSON.parse(row.value));
      }
      return res.json([]);
    } catch {
      return res.json([]);
    }
  });

  // GET /api/public/recent-jobs — anonymised live job feed for the marquee ticker
  app.get("/api/public/recent-jobs", async (_req, res) => {
    try {
      // Singapore districts for address parsing
      const SG_AREAS = [
        "Admiralty","Aljunied","Ang Mo Kio","Balestier","Bedok","Bishan","Boon Lay",
        "Boustead","Bugis","Bukit Batok","Bukit Merah","Bukit Panjang","Bukit Timah",
        "Cairnhill","Changi","Choa Chu Kang","Clementi","Commonwealth","Dhoby Ghaut",
        "Dempsey","Dover","Eunos","Farrer Park","Geylang","Hillview","Holland",
        "Hougang","Jalan Besar","Jurong East","Jurong West","Kallang","Katong",
        "Kembangan","Kent Ridge","Kovan","Lavender","Lim Chu Kang","Little India",
        "Loyang","MacPherson","Marine Parade","Marsiling","Marymount","Mountbatten",
        "Novena","Orchard","Outram","Pandan","Pasir Ris","Paya Lebar","Pioneer",
        "Potong Pasir","Punggol","Queenstown","Redhill","Rochor","Sembawang",
        "Sengkang","Serangoon","Simei","Tampines","Tanglin","Telok Blangah",
        "Thomson","Tiong Bahru","Toa Payoh","Tuas","Ubi","Woodlands","Yew Tee",
        "Yishun","Jurong","Clementi","Buona Vista","Boon Keng","Bendemeer",
        "Bedok North","Bedok Reservoir","Fernvale","Khatib","Kranji","Lakeside",
        "Lentor","Springleaf","Tengah","Upper Thomson","Lentor","Turf City",
      ];

      function extractArea(addr: string): string {
        if (!addr) return "Singapore";
        const upper = addr.toUpperCase();
        for (const a of SG_AREAS) {
          if (upper.includes(a.toUpperCase())) return a;
        }
        // Fall back to first meaningful word segment
        const parts = addr.split(/[,\n#]+/);
        for (const p of parts) {
          const trimmed = p.trim().replace(/^\d+\s*/, "");
          if (trimmed.length > 3 && !/^\d+$/.test(trimmed)) return trimmed.split(" ").slice(0, 2).join(" ");
        }
        return "Singapore";
      }

      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // last 90 days
      const rows = await db
        .select({
          id:               quotesTable.id,
          serviceAddress:   quotesTable.serviceAddress,
          scheduledAt:      quotesTable.scheduledAt,
          createdAt:        quotesTable.createdAt,
          selectedServices: quotesTable.selectedServices,
          status:           quotesTable.status,
        })
        .from(quotesTable)
        .where(
          and(
            inArray(quotesTable.status, ["booked","assigned","in_progress","completed","paid"]),
            gte(quotesTable.createdAt, cutoff),
          )
        )
        .orderBy(desc(quotesTable.scheduledAt))
        .limit(40);

      // Fetch first item name for each quote
      const quoteIds = rows.map(r => r.id);
      const itemRows = quoteIds.length
        ? await db
            .select({ quoteId: quoteItemsTable.quoteId, originalDescription: quoteItemsTable.originalDescription, serviceType: quoteItemsTable.serviceType })
            .from(quoteItemsTable)
            .where(inArray(quoteItemsTable.quoteId, quoteIds))
        : [];

      const itemsByQuote: Record<number, typeof itemRows> = {};
      for (const r of itemRows) {
        if (!itemsByQuote[r.quoteId]) itemsByQuote[r.quoteId] = [];
        itemsByQuote[r.quoteId].push(r);
      }

      const SERVICE_LABEL: Record<string, string> = {
        install: "Installation", dismantle: "Dismantling", relocate: "Relocation",
        installation: "Installation", dismantling: "Dismantling", relocation: "Relocation",
      };

      const now = Date.now();
      const feed = rows.map(q => {
        const items = itemsByQuote[q.id] || [];
        const firstItem = items[0];
        const svcType = firstItem
          ? SERVICE_LABEL[firstItem.serviceType?.toLowerCase()] || "Installation"
          : "Installation";
        const itemName = firstItem?.originalDescription
          ? firstItem.originalDescription.split(/[-–(]/)[0].trim().replace(/^\d+\s*x?\s*/i, "")
          : "Furniture";

        const area = extractArea(q.serviceAddress);

        // Use scheduledAt only if it's in the past; fall back to createdAt
        const rawDate = q.scheduledAt || q.createdAt;
        const dateMs = rawDate ? new Date(rawDate).getTime() : now;
        const effectiveMs = dateMs > now ? (q.createdAt ? new Date(q.createdAt).getTime() : now) : dateMs;
        const days = Math.floor((now - effectiveMs) / 86400000);
        const timeLabel = days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;

        // Strip trailing service-type words already baked into the description
        const cleanName = itemName
          .replace(/\s+(installation|assembly|dismantling|dismantle|relocation|reinstall|reassembly)$/i, "")
          .trim();

        return { label: `${cleanName} ${svcType} · ${area} · ${timeLabel}` };
      });

      res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=60");
      return res.json(feed);
    } catch (err) {
      console.error("[recent-jobs]", err);
      return res.json([]);
    }
  });

  // ── WhatsApp handoff (Phase 3) ────────────────────────────────────────────
  // Customer clicks "Prefer to chat? WhatsApp us" on the estimate page. The
  // server is the canonical formatter for the message and logs the handoff to
  // the AI audit trail so admins have server-side visibility (audit dashboard)
  // even before the customer actually sends the prefilled wa.me message.
  //
  // Why we do NOT pre-seed the inbox keyed off `customerPhone`: that endpoint
  // is unauthenticated and any caller could spoof a phone number to pollute or
  // mis-attribute messages in another customer's conversation. The audit log
  // entry (with the phone tail only) is sufficient — the customer's real
  // inbound WhatsApp message will land in the inbox within minutes and the
  // existing webhook/agent flow handles enrichment from there.
  //
  // Why we do NOT proactively push a Meta API message: Meta's 24-hour
  // customer-service window blocks cold sends from a business number, so a
  // log-only handoff is the correct shape here.
  const HANDOFF_RL = new Map<string, { count: number; windowStart: number }>();
  const HANDOFF_RL_WINDOW_MS = 60_000;
  const HANDOFF_RL_MAX = 6; // 6 handoff posts per IP per minute is plenty
  app.post("/api/whatsapp/handoff", async (req, res) => {
    try {
      // ── Per-IP rate limit ──────────────────────────────────────────────────
      const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() || req.socket.remoteAddress || "unknown");
      const now = Date.now();
      const bucket = HANDOFF_RL.get(ip);
      if (!bucket || now - bucket.windowStart > HANDOFF_RL_WINDOW_MS) {
        HANDOFF_RL.set(ip, { count: 1, windowStart: now });
      } else {
        bucket.count += 1;
        if (bucket.count > HANDOFF_RL_MAX) {
          return res.status(429).json({ ok: false, error: "Too many requests" });
        }
      }
      // Opportunistic cleanup so the map doesn't grow unbounded
      if (HANDOFF_RL.size > 5000) {
        for (const [k, v] of Array.from(HANDOFF_RL.entries())) {
          if (now - v.windowStart > HANDOFF_RL_WINDOW_MS) HANDOFF_RL.delete(k);
        }
      }

      const { handoffPayloadSchema, buildHandoffMessage, buildHandoffWaUrl } = await import("@shared/whatsapp-handoff");
      const parsed = handoffPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ ok: false, error: "Invalid handoff payload" });
      }
      const payload = parsed.data;
      const message = buildHandoffMessage(payload);
      const waUrl = buildHandoffWaUrl(payload);

      // Audit trail — non-PII metadata only. No name, no address, no email.
      try {
        await db.insert(aiAuditLogTable).values({
          actionType: "whatsapp_handoff_started",
          actor: "customer",
          module: "estimate_flow",
          summary: `Customer started WhatsApp handoff from ${payload.source}`,
          detail: {
            source: payload.source,
            services: payload.services,
            itemCount: payload.items.length,
            estimatedTotal: payload.estimatedTotal ?? null,
            hasAddress: Boolean(payload.serviceAddress || payload.pickupAddress),
            hasSlot: Boolean(payload.slotLabel),
            hasContact: Boolean(payload.customerPhone || payload.customerEmail),
            phoneTail: payload.customerPhone ? payload.customerPhone.replace(/[^0-9]/g, "").slice(-4) : null,
          },
          outcome: "success",
        });
      } catch (e) {
        console.warn("[handoff] audit log failed (non-fatal):", e);
      }

      return res.json({ ok: true, waUrl, messagePreview: message.slice(0, 400) });
    } catch (err) {
      console.error("[handoff] unexpected error:", err);
      return res.status(500).json({ ok: false, error: "Handoff failed" });
    }
  });

  // ── Promo code routes ─────────────────────────────────────────────────────

  // GET /api/promo-bar — public: returns active promo info for the banner
  app.get("/api/promo-bar", async (_req, res) => {
    try {
      const rows = await db.select().from(promoCodes).where(eq(promoCodes.active, true)).limit(1);
      if (!rows.length) return res.json({ active: false });
      const p = rows[0];
      return res.json({
        active: true,
        code: p.code,
        discount: parseFloat(p.discountAmount),
        maxUses: p.maxUses,
        usesCount: p.usesCount,
        remaining: Math.max(0, p.maxUses - p.usesCount),
      });
    } catch {
      return res.json({ active: false });
    }
  });

  // POST /api/promo/validate — public: validates a promo code before submission
  app.post("/api/promo/validate", async (req, res) => {
    const { code, orderTotal } = req.body as { code?: string; orderTotal?: number };
    if (!code?.trim()) return res.status(400).json({ valid: false, message: "No code provided" });
    try {
      const rows = await db.select().from(promoCodes)
        .where(eq(promoCodes.code, code.trim().toUpperCase())).limit(1);
      if (!rows.length) return res.json({ valid: false, message: "Invalid promo code" });
      const p = rows[0];
      if (!p.active) return res.json({ valid: false, message: "This promo code is no longer active" });
      if (p.usesCount >= p.maxUses) return res.json({ valid: false, message: "All promo slots have been claimed — thank you!" });
      const minOrder = parseFloat(p.minOrderAmount ?? "0");
      // If the code has a minimum spend, the client MUST send an orderTotal —
      // otherwise the check is meaningless and can be bypassed by omitting it.
      const safeOrderTotal = typeof orderTotal === "number" && isFinite(orderTotal) ? orderTotal : 0;
      if (minOrder > 0 && safeOrderTotal < minOrder) {
        return res.json({
          valid: false,
          message: `Minimum job total of $${minOrder.toFixed(0)} required to use this code (your total: $${safeOrderTotal.toFixed(2)})`,
        });
      }
      return res.json({ valid: true, discount: parseFloat(p.discountAmount), message: `$${parseFloat(p.discountAmount).toFixed(0)} discount applied!` });
    } catch (e: any) {
      return res.status(500).json({ valid: false, message: e.message });
    }
  });

  // GET /api/admin/promo — admin: get promo code list
  app.get("/api/admin/promo", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const rows = await db.select().from(promoCodes).orderBy(promoCodes.id);
    return res.json(rows);
  });

  // POST /api/admin/promo/upsert — admin: create or update promo
  app.post("/api/admin/promo/upsert", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { code, discountAmount, maxUses, active, minOrderAmount } = req.body as { code: string; discountAmount: number; maxUses: number; active: boolean; minOrderAmount?: number };
    if (!code?.trim()) return res.status(400).json({ message: "Code is required" });
    const cleanCode = code.trim().toUpperCase();
    const minOrderClean = Math.max(0, Number(minOrderAmount) || 0);
    await db.insert(promoCodes).values({ code: cleanCode, discountAmount: String(discountAmount), maxUses, active, minOrderAmount: String(minOrderClean) })
      .onConflictDoUpdate({ target: promoCodes.code, set: { discountAmount: String(discountAmount), maxUses, active, minOrderAmount: String(minOrderClean) } });
    const rows = await db.select().from(promoCodes).where(eq(promoCodes.code, cleanCode)).limit(1);
    return res.json(rows[0]);
  });

  // POST /api/admin/promo/toggle — admin: toggle active status
  app.post("/api/admin/promo/toggle", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { id } = req.body as { id: number };
    const rows = await db.select().from(promoCodes).where(eq(promoCodes.id, id)).limit(1);
    if (!rows.length) return res.status(404).json({ message: "Not found" });
    const current = rows[0];
    await db.update(promoCodes).set({ active: !current.active }).where(eq(promoCodes.id, id));
    return res.json({ ok: true, active: !current.active });
  });

  // POST /api/admin/promo/reset — admin: reset uses count back to 0
  app.post("/api/admin/promo/reset", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { id } = req.body as { id: number };
    await db.update(promoCodes).set({ usesCount: 0 }).where(eq(promoCodes.id, id));
    return res.json({ ok: true });
  });

  // ── Build webhook: auto-update app version after each GitHub Actions build ──
  // Called by the GitHub Actions workflow after APK is published.
  // No admin session needed — protected by BUILD_WEBHOOK_TOKEN.
  app.post("/api/system/build-complete", async (req, res) => {
    const expectedToken = process.env.BUILD_WEBHOOK_TOKEN;
    if (!expectedToken) {
      console.error("[Build] BUILD_WEBHOOK_TOKEN env var is not set — webhook disabled");
      return res.status(503).json({ message: "Webhook not configured" });
    }
    const { token, version, apkUrl } = req.body as { token?: string; version?: string; apkUrl?: string };
    if (!token || token !== expectedToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!version || !apkUrl) return res.status(400).json({ message: "version and apkUrl required" });
    try {
      await db.insert(appSettings).values({ key: "app_latest_version", value: version })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: version } });
      await db.insert(appSettings).values({ key: "app_apk_url", value: apkUrl })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: apkUrl } });
      console.log(`[Build] Version updated to ${version}`);
      res.json({ ok: true, version, apkUrl });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ── App version management (OTA update check) ────────────────────────────
  // Always serve the APK through our own proxy so private GitHub repos work
  const APK_PROXY_URL = "https://tmginstall.com/api/app/latest.apk";

  app.get("/api/app-version", async (_req, res) => {
    try {
      const [vRow] = await Promise.all([
        db.select().from(appSettings).where(eq(appSettings.key, "app_latest_version")).limit(1),
      ]);
      res.json({
        version: vRow[0]?.value ?? "1.1",
        apkUrl: APK_PROXY_URL,
      });
    } catch {
      res.json({ version: "1.1", apkUrl: APK_PROXY_URL });
    }
  });

  // ── APK proxy — streams the latest APK from private GitHub repo using GITHUB_TOKEN ─
  // This avoids exposing the GitHub token to clients while still supporting private repos.
  app.get("/api/app/latest.apk", async (_req, res) => {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = "tmginstall1-dotcom";
    const REPO = "tmg-install";
    const TAG = "latest-build";
    try {
      // 1. Look up the release and find the APK asset
      const releaseRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`,
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "TMGInstall-Server" } }
      );
      if (!releaseRes.ok) {
        console.error("[APK proxy] release fetch failed", releaseRes.status);
        return res.status(502).json({ message: "APK release not available" });
      }
      const release = await releaseRes.json() as { assets: Array<{ id: number; name: string; size: number }> };
      const asset = release.assets?.find((a) => a.name === "tmg-install.apk");
      if (!asset) {
        console.error("[APK proxy] tmg-install.apk not found in release assets");
        return res.status(404).json({ message: "APK not found in release" });
      }
      // 2. Download the asset via GitHub API (authenticated)
      const dlRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/releases/assets/${asset.id}`,
        { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/octet-stream", "User-Agent": "TMGInstall-Server" } }
      );
      if (!dlRes.ok || !dlRes.body) {
        console.error("[APK proxy] asset download failed", dlRes.status);
        return res.status(502).json({ message: "Failed to download APK" });
      }
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", "attachment; filename=tmg-install.apk");
      res.setHeader("Content-Length", String(asset.size));
      res.setHeader("Cache-Control", "public, max-age=300");
      // 3. Stream to client
      const { pipeline } = await import("stream/promises");
      const { Readable } = await import("stream");
      await pipeline(Readable.fromWeb(dlRes.body as any), res);
    } catch (e: any) {
      console.error("[APK proxy] error:", e.message);
      if (!res.headersSent) res.status(500).json({ message: e.message });
    }
  });

  // ── WhatsApp number registration (request OTP + verify) ──────────────────
  app.post("/api/admin/whatsapp/request-code", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { method = "SMS" } = req.body as { method?: string };
    const token = await getAccessToken();
    if (!token) return res.status(500).json({ message: "No WhatsApp access token set" });
    const phoneNumberId = "1063172463540400";
    const r = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/request_code`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code_method: method === "VOICE" ? "VOICE" : "SMS", language: "en_US" }),
    });
    const data = await r.json() as any;
    if (!r.ok) return res.status(r.status).json({ message: data?.error?.message ?? "Failed to request code" });
    res.json({ message: method === "VOICE" ? "Voice call initiated to +65 8088 0757" : "Verification SMS sent to +65 8088 0757" });
  });

  // ── Subscribe WABA to app webhook (required for Cloud API to send messages) ─
  app.post("/api/admin/whatsapp/subscribe-waba", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const callerSw = await storage.getUserById(req.session.userId);
    if (!callerSw || callerSw.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const token = await getAccessToken();
    if (!token) return res.status(500).json({ message: "No WhatsApp access token configured" });
    const WABA_ID = "2118758868886697";
    const r = await fetch(`https://graph.facebook.com/v19.0/${WABA_ID}/subscribed_apps`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await r.json() as any;
    if (!r.ok) {
      console.error("[WhatsApp] WABA subscribe failed:", JSON.stringify(data));
      return res.status(r.status).json({ message: data?.error?.message ?? "Subscription failed" });
    }
    console.log("[WhatsApp] WABA subscribed to app webhook ✓");
    res.json({ message: "✅ WABA subscribed — webhook is now fully active!" });
  });

  app.post("/api/admin/whatsapp/register-direct", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { pin } = req.body as { pin?: string };
    if (!pin || pin.length !== 6) return res.status(400).json({ message: "A 6-digit PIN is required" });
    const token = await getAccessToken();
    if (!token) return res.status(500).json({ message: "No WhatsApp access token set" });
    const phoneNumberId = "1063172463540400";
    const r = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/register`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    });
    const data = await r.json() as any;
    if (!r.ok) return res.status(r.status).json({ message: data?.error?.message ?? "Registration failed" });
    res.json({ message: "✅ Number registered successfully!" });
  });

  app.post("/api/admin/whatsapp/verify-code", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { code } = req.body as { code?: string };
    if (!code) return res.status(400).json({ message: "code required" });
    const token = await getAccessToken();
    if (!token) return res.status(500).json({ message: "No WhatsApp access token set" });
    const phoneNumberId = "1063172463540400";
    const r = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/verify_code`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await r.json() as any;
    if (!r.ok) return res.status(r.status).json({ message: data?.error?.message ?? "Verification failed" });
    res.json({ message: "Phone number verified and registered successfully!" });
  });

  app.post("/api/admin/settings/app-version", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { version, apkUrl } = req.body as { version?: string; apkUrl?: string };
    if (!version || !apkUrl) return res.status(400).json({ message: "version and apkUrl required" });
    await db.insert(appSettings).values({ key: "app_latest_version", value: version }).onConflictDoUpdate({ target: appSettings.key, set: { value: version } });
    await db.insert(appSettings).values({ key: "app_apk_url", value: apkUrl }).onConflictDoUpdate({ target: appSettings.key, set: { value: apkUrl } });
    res.json({ message: "App version updated" });
  });

  // ── Admin: WhatsApp Media Proxy ────────────────────────────────────────────
  // Proxies WhatsApp media images so the admin UI can display customer photos.
  // mediaId = the WhatsApp media ID stored in waMessages.mediaUrl column.
  app.get("/api/admin/whatsapp/media/:mediaId", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const { mediaId } = req.params;
      const { base64, mimeType } = await downloadWhatsAppMedia(mediaId);
      const buf = Buffer.from(base64, "base64");
      res.setHeader("Content-Type", mimeType || "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=86400");
      res.send(buf);
    } catch {
      res.status(404).json({ message: "Media not found or expired" });
    }
  });

  // ── Admin: WhatsApp Conversations ──────────────────────────────────────────
  app.get("/api/admin/whatsapp/conversations", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const convos = await storage.getWhatsAppConversations();
    res.json(convos);
  });

  app.get("/api/admin/whatsapp/conversations/:phone", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const phone = req.params.phone;
    const [messages, session] = await Promise.all([
      storage.getWhatsAppMessages(phone),
      storage.getWhatsAppSession(phone),
    ]);
    await storage.markWhatsAppMessagesRead(phone);
    res.json({ messages, session });
  });

  app.post("/api/admin/whatsapp/conversations/:phone/send", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const phone = req.params.phone;
    const { message } = req.body as { message: string };
    if (!message?.trim()) return res.status(400).json({ message: "Message is required" });
    try {
      // Use sendWhatsAppMessage so it throws on Meta API error — only logs if delivered
      await sendWhatsAppMessage(phone, message.trim(), { logAsSentBy: `admin:${user.name || user.email}` });
      // Auto-pause the bot whenever an admin manually sends — prevents bot from overriding admin replies
      await storage.upsertWhatsAppSession(phone, { botPaused: true, botPausedAt: new Date() });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[Admin] Chat send failed:", err?.message);
      res.status(500).json({ message: err?.message || "Failed to send WhatsApp message" });
    }
  });

  // ── Admin: send image/file/document to customer via WhatsApp ─────────────────
  app.post("/api/admin/whatsapp/conversations/:phone/send-media", upload.single("file"), async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const phone = req.params.phone;
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ message: "No file attached" });
    const imageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    const docTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const isImage = imageTypes.includes(file.mimetype);
    const isDoc = docTypes.includes(file.mimetype);
    if (!isImage && !isDoc) return res.status(400).json({ message: "Unsupported file type. Allowed: JPEG, PNG, WebP, GIF, PDF, Word, Excel." });
    const caption = (req.body as any)?.caption?.trim() || undefined;
    try {
      if (isImage) {
        await sendWhatsAppImageMessage(phone, file.buffer, file.mimetype, caption, { logAsSentBy: `admin:${user.name || user.email}` });
      } else {
        await sendWhatsAppDocumentMessage(phone, file.buffer, file.mimetype, file.originalname || "document", caption, { logAsSentBy: `admin:${user.name || user.email}` });
      }
      await storage.upsertWhatsAppSession(phone, { botPaused: true, botPausedAt: new Date() });
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[Admin] send-media failed:", err?.message);
      res.status(500).json({ message: err?.message || "Failed to send file" });
    }
  });

  // ── Admin: start a new chat with any SG phone number ─────────────────────────
  app.post("/api/admin/whatsapp/conversations/new", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    let { phone, message } = req.body as { phone: string; message: string };
    if (!phone?.trim()) return res.status(400).json({ message: "Phone number is required" });
    if (!message?.trim()) return res.status(400).json({ message: "Message is required" });
    // Normalise: strip spaces/dashes/+, ensure starts with 65 for SG
    phone = phone.replace(/[\s\-\+\(\)]/g, "");
    if (/^[89]\d{7}$/.test(phone)) phone = `65${phone}`; // SG mobile without country code
    if (!/^\d{10,15}$/.test(phone)) return res.status(400).json({ message: "Invalid phone number format" });
    try {
      await sendWhatsAppMessage(phone, message.trim(), { logAsSentBy: `admin:${user.name || user.email}` });
      await storage.upsertWhatsAppSession(phone, { botPaused: true, botPausedAt: new Date() });
      res.json({ ok: true, phone });
    } catch (err: any) {
      console.error("[Admin] new-chat send failed:", err?.message);
      res.status(500).json({ message: err?.message || "Failed to send message" });
    }
  });

  // ── Admin: add internal note (not sent to customer) ───────────────────────────
  app.post("/api/admin/whatsapp/conversations/:phone/note", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const phone = req.params.phone;
    const { note } = req.body as { note: string };
    if (!note?.trim()) return res.status(400).json({ message: "Note text is required" });
    await storage.logWhatsAppMessage({
      phone, direction: "outbound",
      body: note.trim(), mediaType: null, mediaUrl: null,
      sentBy: `note:${user.name || user.email}`,
    });
    res.json({ ok: true });
  });

  // ── Admin: reset (clear) a conversation session ────────────────────────────────
  // ── Admin: delete entire conversation (messages + session) ──────────────────
  app.delete("/api/admin/whatsapp/conversations/:phone", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const phone = req.params.phone;
    try {
      await db.delete(whatsappMessagesTable).where(eq(whatsappMessagesTable.phone, phone));
      await db.delete(whatsappSessionsTable).where(eq(whatsappSessionsTable.phone, phone));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Delete failed" });
    }
  });

  app.delete("/api/admin/whatsapp/conversations/:phone/session", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const phone = req.params.phone;
    await storage.upsertWhatsAppSession(phone, {
      state: "pricing_shown", botPaused: false, botPausedAt: null,
      collectedName: null, collectedAddress: null, collectedToAddress: null,
      collectedItems: null, isRelocation: false, floorLevel: null, hasLift: null,
      accessDifficulty: null, preferredDate: null, preferredDateIso: null, preferredTimeWindow: null,
      remarks: null, previousItems: null,
    });
    res.json({ ok: true });
  });

  // ── Admin: mark all messages in a thread as read ──────────────────────────────
  app.post("/api/admin/whatsapp/conversations/:phone/mark-read", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const phone = req.params.phone;
    await storage.markWhatsAppMessagesRead(phone);
    res.json({ ok: true });
  });

  // ── Admin takeover: pause bot for a conversation ──────────────────────────
  app.post("/api/admin/whatsapp/conversations/:phone/pause-bot", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const phone = req.params.phone;
    await storage.upsertWhatsAppSession(phone, { botPaused: true, botPausedAt: new Date() });
    res.json({ ok: true, botPaused: true });
  });

  // ── Resume bot for a conversation ─────────────────────────────────────────
  app.post("/api/admin/whatsapp/conversations/:phone/resume-bot", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const phone = req.params.phone;
    await storage.upsertWhatsAppSession(phone, { botPaused: false, botPausedAt: null });
    res.json({ ok: true, botPaused: false });
  });

  // ── Generate quote from session data (admin-initiated) ────────────────────
  app.post("/api/admin/whatsapp/conversations/:phone/generate-quote", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const phone = req.params.phone;
    const session = await storage.getWhatsAppSession(phone);
    if (!session) return res.status(404).json({ message: "No session found for this number" });

    const name = session.collectedName || "WhatsApp Customer";
    const address = session.collectedAddress;
    if (!address) return res.status(400).json({ message: "No address collected in session — cannot generate quote" });

    const catalog = await storage.getCatalogItems();
    const itemsText = session.collectedItems || "";

    // Use GPT to parse items from the collected text (same as bot flow)
    let aiParsedItems: Array<{ detectedName: string; serviceType: string; quantity: number; estimatedUnitPrice: number; confidence: number }> = [];
    if (itemsText) {
      try {
        const aiResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          max_tokens: 500,
          messages: [
            {
              role: "system",
              content: `Parse furniture items from this text into structured JSON. Return {"items":[{"detectedName":"...","serviceType":"install|dismantle|relocate|dispose","quantity":1,"estimatedUnitPrice":80,"confidence":80}]}. Default serviceType is "install".`,
            },
            { role: "user", content: itemsText },
          ],
          response_format: { type: "json_object" },
        });
        const raw = aiResponse.choices[0].message.content || '{"items":[]}';
        const parsed = JSON.parse(raw);
        aiParsedItems = parsed.items || [];
      } catch { /* fall through */ }
    }

    if (!aiParsedItems.length) {
      aiParsedItems = [{ detectedName: itemsText.substring(0, 200) || "General furniture", serviceType: "install", quantity: 1, estimatedUnitPrice: 0, confidence: 50 }];
    }

    let totalEstimate = 0;
    const quoteItems = aiParsedItems.map((item) => {
      const matchedCatalogItem = catalog.find(c =>
        c.serviceType === item.serviceType &&
        (item.detectedName.toLowerCase().includes(c.name.toLowerCase()) ||
         c.name.toLowerCase().includes(item.detectedName.toLowerCase()) ||
         item.detectedName.toLowerCase().split(/\s+/).some((w: string) => w.length > 3 && c.name.toLowerCase().includes(w)))
      );
      const unitPrice = matchedCatalogItem ? Number(matchedCatalogItem.basePrice) : (item.estimatedUnitPrice || 0);
      const qty = item.quantity || 1;
      const subtotal = unitPrice * qty;
      totalEstimate += subtotal;
      return {
        originalDescription: itemsText,
        detectedName: item.detectedName,
        serviceType: item.serviceType || "install",
        quantity: qty,
        unitPrice: unitPrice.toFixed(2),
        subtotal: subtotal.toFixed(2),
        catalogItemId: matchedCatalogItem?.id,
      };
    });

    // ── D&R bundle discount: 40% off dismantle when same quote has both dismantle AND install ──
    const drPctAdmin = PricingConfig.fallback.relocateDRDiscount;
    const dismantleSubtotalAdmin = quoteItems.filter(qi => qi.serviceType === 'dismantle').reduce((s, qi) => s + Number(qi.subtotal), 0);
    const installSubtotalAdmin   = quoteItems.filter(qi => qi.serviceType === 'install').reduce((s, qi) => s + Number(qi.subtotal), 0);
    const drDiscountAmtAdmin = (dismantleSubtotalAdmin > 0 && installSubtotalAdmin > 0)
      ? Math.round(dismantleSubtotalAdmin * drPctAdmin * 100) / 100
      : 0;
    if (drDiscountAmtAdmin > 0) {
      totalEstimate -= drDiscountAmtAdmin;
      quoteItems.push({ originalDescription: `D&R Bundle Saving (${Math.round(drPctAdmin * 100)}% off dismantling)`, detectedName: `D&R Bundle Saving (${Math.round(drPctAdmin * 100)}% off)`, serviceType: "discount", quantity: 1, unitPrice: (-drDiscountAmtAdmin).toFixed(2), subtotal: (-drDiscountAmtAdmin).toFixed(2), catalogItemId: undefined });
    }

    // ── Bulk discount (same tiers as web / Estimate page) ─────────────────────
    // Per-hole units weighted at PricingConfig.perHoleBulkWeight so a single
    // wall-hung wardrobe priced per hole doesn't dominate the tier match.
    const totalQtyB = aiParsedItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
    const weightedQtyB = bulkWeightedQty(aiParsedItems.map((it: any) => ({ name: it.name || it.detectedName || "", quantity: it.quantity || 1 })));
    const discountTierB = PricingConfig.bulkDiscount.find((t: { minQty: number; pct: number }) => weightedQtyB >= t.minQty);
    const discountPctB = discountTierB?.pct ?? 0;
    const discountAmountB = Math.round(totalEstimate * discountPctB * 100) / 100;
    if (discountAmountB > 0) {
      totalEstimate -= discountAmountB;
      quoteItems.push({ originalDescription: `Bulk Discount (${Math.round(discountPctB * 100)}% off, ${totalQtyB} items)`, detectedName: `Bulk Discount (${Math.round(discountPctB * 100)}% off)`, serviceType: "discount", quantity: 1, unitPrice: (-discountAmountB).toFixed(2), subtotal: (-discountAmountB).toFixed(2), catalogItemId: undefined });
    }

    const laborSubtotalAdmin = totalEstimate;

    const sessionFloorLevel = session.floorLevel ?? 1;
    const sessionHasLift = session.hasLift ?? true;
    const floorsAboveGround = Math.max(0, sessionFloorLevel - 1);
    const floorSurcharge = floorsAboveGround * (sessionHasLift ? PricingConfig.floor.perFloorWithLift : PricingConfig.floor.perFloorNoLift);
    if (floorSurcharge > 0) {
      quoteItems.push({ originalDescription: `Floor Surcharge (Floor ${sessionFloorLevel}, ${sessionHasLift ? "lift" : "no lift"})`, detectedName: "Stairs / Floor Access", serviceType: "surcharge", quantity: 1, unitPrice: floorSurcharge.toFixed(2), subtotal: floorSurcharge.toFixed(2), catalogItemId: undefined });
    }

    const sessionAccess = session.accessDifficulty ?? "easy";
    const accessPct = sessionAccess === "medium" ? PricingConfig.access.mediumPct : sessionAccess === "hard" ? PricingConfig.access.hardPct : 0;
    const accessSurcharge = Math.round(laborSubtotalAdmin * accessPct * 100) / 100;
    if (accessSurcharge > 0) {
      quoteItems.push({ originalDescription: `Access Difficulty (${sessionAccess === "medium" ? "Moderate" : "Difficult"})`, detectedName: `Access Difficulty`, serviceType: "surcharge", quantity: 1, unitPrice: accessSurcharge.toFixed(2), subtotal: accessSurcharge.toFixed(2), catalogItemId: undefined });
    }

    const sessionDistKm = session.distanceKm ? parseFloat(session.distanceKm) : 0;
    const transportFee = session.isRelocation ? calcTransportFee(sessionDistKm) : 0;

    // ── Callout fee (non-relocation jobs) ────────────────────────────────────
    const calloutFeeAdmin = session.isRelocation ? 0 : PricingConfig.callout.fee;
    if (calloutFeeAdmin > 0) {
      quoteItems.push({ originalDescription: "Mobilisation & Coordination", detectedName: "Mobilisation & Coordination", serviceType: "surcharge", quantity: 1, unitPrice: calloutFeeAdmin.toFixed(2), subtotal: calloutFeeAdmin.toFixed(2), catalogItemId: undefined });
    }

    const laborTotalWithSurcharges = laborSubtotalAdmin + floorSurcharge + accessSurcharge;
    const grandTotal = laborSubtotalAdmin + floorSurcharge + accessSurcharge + transportFee + calloutFeeAdmin;

    const refNo = `TMG-${randomBytes(6).toString("hex").toUpperCase()}`;
    const finalStructuredState = (session as any).structuredState
      ? (() => { try { return JSON.parse((session as any).structuredState); } catch { return null; } })()
      : null;
    const finalRelocationMode: "carry" | "full" | null = session.isRelocation
      ? (finalStructuredState?.relocation_mode === "carry" || finalStructuredState?.relocation_mode === "full"
          ? finalStructuredState.relocation_mode
          : null)
      : null;
    const quote = await storage.createQuote(
      { name, email: `wa_${phone}@tmginstall.com`, phone },
      {
        referenceNo: refNo,
        serviceAddress: address,
        status: "submitted",
        sourceChannel: "whatsapp",
        customerWhatsappPhone: phone,
        subtotal: laborTotalWithSurcharges.toFixed(2),
        transportFee: transportFee.toFixed(2),
        total: grandTotal.toFixed(2),
        depositAmount: (grandTotal * 0.5).toFixed(2),
        finalAmount: (grandTotal * 0.5).toFixed(2),
        requiresManualReview: true,
        relocationMode: finalRelocationMode,
        pickupAddress: session.isRelocation ? address : null,
        dropoffAddress: session.collectedToAddress || null,
        distanceKm: session.distanceKm || null,
        floorsInfo: JSON.stringify([{ level: sessionFloorLevel, hasLift: sessionHasLift }]),
        accessDifficulty: sessionAccess,
        preferredDate: session.preferredDateIso || null,
        preferredTimeWindow: session.preferredTimeWindow || null,
        notes: session.preferredDate ? `Customer's preferred date: ${session.preferredDate}` : null,
      } as any,
      quoteItems as any
    );

    // T005: Fire-and-forget lead_submitted attribution event
    if (quote?.referenceNo) {
      logAttributionEvent(quote.id, quote.referenceNo, "lead_submitted", parseFloat(quote.total ?? "0"), "whatsapp").catch(() => {});
    }

    // Mark session as submitted but keep botPaused so admin stays in control
    await storage.upsertWhatsAppSession(phone, { state: "submitted" });

    // ── Send itemised confirmation to customer on WhatsApp ────────────────────
    try {
      const adminDepositAmt = (grandTotal * 0.5).toFixed(2);
      const adminSvcEmoji: Record<string, string> = {
        install: "🔧", dismantle: "🔨", relocate: "🚛", dispose: "🗑️",
        dismantle_dispose: "🗑️", surcharge: "📐", discount: "💚", adjustment: "➕",
      };
      const adminSvcLabel: Record<string, string> = {
        install: "Install", dismantle: "Dismantle", relocate: "Relocate",
        dispose: "Dispose", dismantle_dispose: "Dismantle & Dispose",
        surcharge: "", discount: "Discount", adjustment: "",
      };
      const adminLineItems = (quoteItems as any[]).map(qi => {
        const emoji = adminSvcEmoji[qi.serviceType] || "•";
        const svcLabel = adminSvcLabel[qi.serviceType] ?? qi.serviceType;
        const itemName = qi.detectedName || qi.originalDescription;
        const label = svcLabel ? `${itemName} (${svcLabel})` : itemName;
        const qty = qi.quantity && qi.quantity > 1 ? ` ×${qi.quantity}` : "";
        return `${emoji} ${label}${qty}: $${parseFloat(qi.subtotal).toFixed(2)}`;
      }).join("\n");

      await sendBotMessage(phone,
        `✅ *Quote Ready, ${name}!*\n\n` +
        `🔖 *Reference:* ${quote.referenceNo}\n` +
        `📍 *Address:* ${address}\n` +
        (session.isRelocation && session.collectedToAddress ? `📍 *To:* ${session.collectedToAddress}\n` : "") +
        (session.preferredDate ? `📅 *Date:* ${session.preferredDate}\n` : "") +
        `\n─────────────────\n` +
        `${adminLineItems}\n` +
        `─────────────────\n` +
        `Subtotal: *$${laborTotalWithSurcharges.toFixed(2)}*\n` +
        (transportFee > 0 ? `🚛 Transport: *$${transportFee.toFixed(2)}*\n` : "") +
        `💰 *Total: $${grandTotal.toFixed(2)}*\n` +
        `⬇️ *Deposit (50%): $${adminDepositAmt}*\n\n` +
        `To confirm your booking, please make the *50% deposit ($${adminDepositAmt})* via PayNow/bank transfer — our team will send payment details shortly.\n\n` +
        `Track your quote: ${APP_URL}/quotes/${quote.id}?ref=${quote.referenceNo}\n\n` +
        `Thanks for choosing TMG Install! 🙏 Reply *hi* anytime for a new quote.`
      );
    } catch (waErr) {
      console.error("[WhatsApp] Admin generate-quote — failed to notify customer:", waErr);
    }

    // ── Notify admin via email ────────────────────────────────────────────────
    try {
      const itemsText = session.collectedItems || "";
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: `📱 WhatsApp Quote — ${quote.referenceNo} from ${name} (admin-generated)`,
        html: `<p>Quote generated by admin for WhatsApp customer <strong>${name}</strong> (+${phone}).</p><p>Reference: <strong>${quote.referenceNo}</strong></p><p>Address: ${address}</p>${session.preferredDate ? `<p>Preferred date: <strong>${session.preferredDate}</strong></p>` : ""}<p>Items:<br>${itemsText.replace(/\n/g, "<br>")}</p><p><a href="${APP_URL}/admin/quotes/${quote.id}">View in Admin Panel</a></p>`,
      });
    } catch (emailErr) {
      console.error("[WhatsApp] Admin generate-quote — admin email error:", emailErr);
    }

    res.json({ ok: true, quoteId: quote.id, referenceNo: quote.referenceNo });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ── WHATSAPP AI AGENT ADMIN ROUTES (Phase 9) ─────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/admin/ai/whatsapp/conversations", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const conversations = await getAiConversations(100);
      res.json({ conversations });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/ai/whatsapp/conversations/:phone", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const detail = await getAiConversationDetail(req.params.phone);
      if (!detail) return res.status(404).json({ message: "Conversation not found" });
      res.json(detail);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/ai/whatsapp/conversations/:phone/handoff", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { reason } = req.body;
    try {
      await handoffToHuman(req.params.phone, reason || "manual_admin", `admin:${user.username}`);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/ai/whatsapp/conversations/:phone/resume-ai", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      await resumeAiOwnership(req.params.phone, `admin:${user.username}`);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── WhatsApp AI Diagnostics (read-only, admin-only) ──────────────────────
  app.get("/api/admin/ai/whatsapp/diagnostics", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const [
        pendingFollowups,
        openHandoffs,
        aiOwnedSessions,
        humanOwnedSessions,
        duplicateSkipped,
        windowBlocked,
        lastProcessed,
        recentEvents,
      ] = await Promise.all([
        db.select({ count: drizzleSql<number>`count(*)::int` })
          .from(aiWaFollowupsTable)
          .where(eq(aiWaFollowupsTable.status, "pending"))
          .then(r => r[0]?.count ?? 0),
        db.select({ count: drizzleSql<number>`count(*)::int` })
          .from(aiWaHandoffsTable)
          .where(isNull(aiWaHandoffsTable.resumedAt))
          .then(r => r[0]?.count ?? 0),
        db.select({ count: drizzleSql<number>`count(*)::int` })
          .from(whatsappSessionsTable)
          .where(drizzleSql`ai_ownership = 'ai'`)
          .then(r => r[0]?.count ?? 0),
        db.select({ count: drizzleSql<number>`count(*)::int` })
          .from(whatsappSessionsTable)
          .where(drizzleSql`ai_ownership = 'human'`)
          .then(r => r[0]?.count ?? 0),
        db.select({ count: drizzleSql<number>`count(*)::int` })
          .from(aiAuditLogTable)
          .where(and(eq(aiAuditLogTable.module, "whatsapp_agent"), eq(aiAuditLogTable.actionType, "ai_duplicate_skipped")))
          .then(r => r[0]?.count ?? 0),
        db.select({ count: drizzleSql<number>`count(*)::int` })
          .from(aiAuditLogTable)
          .where(and(eq(aiAuditLogTable.module, "whatsapp_agent"), eq(aiAuditLogTable.actionType, "ai_window_blocked")))
          .then(r => r[0]?.count ?? 0),
        db.select({ createdAt: aiAuditLogTable.createdAt })
          .from(aiAuditLogTable)
          .where(eq(aiAuditLogTable.module, "whatsapp_agent"))
          .orderBy(desc(aiAuditLogTable.createdAt))
          .limit(1)
          .then(r => r[0]?.createdAt ?? null),
        db.select({
          id: aiAuditLogTable.id,
          actionType: aiAuditLogTable.actionType,
          summary: aiAuditLogTable.summary,
          createdAt: aiAuditLogTable.createdAt,
        })
          .from(aiAuditLogTable)
          .where(eq(aiAuditLogTable.module, "whatsapp_agent"))
          .orderBy(desc(aiAuditLogTable.createdAt))
          .limit(10),
      ]);
      res.json({
        pendingFollowups,
        openHandoffs,
        aiOwnedSessions,
        humanOwnedSessions,
        duplicateSkipped,
        windowBlocked,
        lastProcessedEvent: lastProcessed,
        recentEvents,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ── JOB COMPLETION CHECKLIST ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const DEFAULT_CHECKLIST_ITEMS = [
    "Items fully unpacked & inspected for damage",
    "All pieces assembled correctly",
    "Fixings / screws tight — nothing loose",
    "Level check passed (shelves, wardrobes, beds)",
    "Packaging & rubbish cleared from site",
    "Customer walked through & satisfied",
    "Before & after photos uploaded",
  ];

  // ── Staff checklist routes (simplified API for the staff mobile app) ──────
  // GET /api/staff/jobs/:id/checklist → { checkItems: string[] } (labels of ticked items)
  app.get("/api/staff/jobs/:id/checklist", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const quoteId = parseInt(req.params.id);
    if (isNaN(quoteId)) return res.status(400).json({ error: "Invalid id" });
    try {
      // Verify the quote exists first
      const quote = await storage.getQuote(quoteId);
      if (!quote) return res.status(404).json({ error: "Job not found" });
      let rows = await db.select().from(jobChecklistsTable).where(eq(jobChecklistsTable.quoteId, quoteId));
      if (rows.length === 0) {
        rows = await db.insert(jobChecklistsTable).values(
          DEFAULT_CHECKLIST_ITEMS.map(item => ({ quoteId, item, done: false }))
        ).returning();
      }
      const checkItems = rows.filter(r => r.done).map(r => r.item);
      res.json({ checkItems });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/staff/jobs/:id/checklist → body: { checkItems: string[] } (full list of ticked labels)
  app.patch("/api/staff/jobs/:id/checklist", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const quoteId = parseInt(req.params.id);
    if (isNaN(quoteId)) return res.status(400).json({ error: "Invalid id" });
    const { checkItems } = req.body as { checkItems: string[] };
    if (!Array.isArray(checkItems)) return res.status(400).json({ error: "checkItems must be an array" });
    try {
      const quote = await storage.getQuote(quoteId);
      if (!quote) return res.status(404).json({ error: "Job not found" });
      let rows = await db.select().from(jobChecklistsTable).where(eq(jobChecklistsTable.quoteId, quoteId));
      if (rows.length === 0) {
        rows = await db.insert(jobChecklistsTable).values(
          DEFAULT_CHECKLIST_ITEMS.map(item => ({ quoteId, item, done: false }))
        ).returning();
      }
      // Update done status for each item based on the provided list
      for (const row of rows) {
        const isDone = checkItems.includes(row.item);
        if (row.done !== isDone) {
          await db.update(jobChecklistsTable)
            .set({ done: isDone, doneAt: isDone ? new Date() : null, doneByUserId: isDone ? req.session!.userId : null })
            .where(eq(jobChecklistsTable.id, row.id));
        }
      }
      res.json({ ok: true, checkItems });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/jobs/:id/checklist — auto-creates default items on first access
  app.get("/api/jobs/:id/checklist", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const quoteId = parseInt(req.params.id);
    if (isNaN(quoteId)) return res.status(400).json({ error: "Invalid id" });
    try {
      let items = await db.select().from(jobChecklistsTable).where(eq(jobChecklistsTable.quoteId, quoteId));
      if (items.length === 0) {
        // Seed default items
        const inserted = await db.insert(jobChecklistsTable).values(
          DEFAULT_CHECKLIST_ITEMS.map(item => ({ quoteId, item, done: false }))
        ).returning();
        items = inserted;
      }
      res.json(items);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/jobs/:id/checklist/:itemId — toggle done
  app.patch("/api/jobs/:id/checklist/:itemId", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const quoteId = parseInt(req.params.id);
    const itemId = parseInt(req.params.itemId);
    const { done } = req.body;
    if (isNaN(quoteId) || isNaN(itemId)) return res.status(400).json({ error: "Invalid id" });
    try {
      const [updated] = await db.update(jobChecklistsTable)
        .set({ done: !!done, doneAt: done ? new Date() : null, doneByUserId: req.session.userId })
        .where(and(eq(jobChecklistsTable.id, itemId), eq(jobChecklistsTable.quoteId, quoteId)))
        .returning();
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ── CUSTOMER PORTAL — email-based OTP login ───────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /api/portal/request-otp
  app.post("/api/portal/request-otp", async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") return res.status(400).json({ error: "Email required" });
    const emailLower = email.toLowerCase().trim();
    try {
      const token = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await db.insert(customerTokensTable).values({ email: emailLower, token, expiresAt });
      // Send OTP via email
      try {
        await sendEmail({
          to: emailLower,
          subject: "Your TMG Install portal access code",
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h2 style="margin:0 0 8px;font-size:22px;color:#0f172a">Your access code</h2>
            <p style="margin:0 0 24px;color:#64748b;font-size:14px">Enter this code in the TMG Install customer portal. It expires in 15 minutes.</p>
            <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#0f172a;text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 32px;margin:0 0 24px">${token}</div>
            <p style="margin:0;color:#94a3b8;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
          </div>`,
        });
      } catch (emailErr) {
        console.error("[Portal] OTP email failed:", emailErr);
      }
      res.json({ ok: true, message: "Code sent to your email" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/portal/verify-otp
  app.post("/api/portal/verify-otp", async (req, res) => {
    const { email, token } = req.body;
    if (!email || !token) return res.status(400).json({ error: "Email and token required" });
    const emailLower = email.toLowerCase().trim();
    try {
      const [row] = await db.select().from(customerTokensTable)
        .where(and(eq(customerTokensTable.email, emailLower), eq(customerTokensTable.token, String(token))))
        .orderBy(desc(customerTokensTable.createdAt)).limit(1);
      if (!row) return res.status(401).json({ error: "Invalid code" });
      if (row.usedAt) return res.status(401).json({ error: "Code already used" });
      if (new Date() > row.expiresAt) return res.status(401).json({ error: "Code expired — please request a new one" });
      // Mark token as used
      await db.update(customerTokensTable).set({ usedAt: new Date() }).where(eq(customerTokensTable.id, row.id));
      // Store verified email in session
      (req.session as any).portalEmail = emailLower;
      res.json({ ok: true, email: emailLower });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/portal/my-quotes — returns quotes matching the verified portal session email
  app.get("/api/portal/my-quotes", async (req, res) => {
    const portalEmail = (req.session as any)?.portalEmail;
    if (!portalEmail) return res.status(401).json({ error: "Not authenticated — please log in" });
    try {
      // Find customer by email
      const [customer] = await db.select().from(customers).where(eq(customers.email, portalEmail)).limit(1);
      if (!customer) return res.json([]);
      const qs = await db.select().from(quotesTable)
        .where(eq(quotesTable.customerId, customer.id))
        .orderBy(desc(quotesTable.createdAt))
        .limit(50);
      res.json(qs.map(q => ({ ...q, customer })));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/portal/logout
  app.post("/api/portal/logout", (req, res) => {
    (req.session as any).portalEmail = null;
    res.json({ ok: true });
  });

  // GET /api/portal/me — check current portal session
  app.get("/api/portal/me", (req, res) => {
    const email = (req.session as any)?.portalEmail;
    if (!email) return res.status(401).json({ error: "Not authenticated" });
    res.json({ email });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ── LOYALTY / REPEAT-CUSTOMER DISCOUNT ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // Helper to read an app setting
  async function getSetting(key: string): Promise<string | null> {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return row?.value ?? null;
  }
  async function setSetting(key: string, value: string): Promise<void> {
    await db.insert(appSettings).values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } });
  }

  // Utility: detect repeat customer and apply loyalty discount if applicable
  async function applyLoyaltyDiscount(quoteId: number, customerEmail: string): Promise<void> {
    try {
      const enabled = await getSetting("loyalty_discount_enabled");
      if (enabled !== "true") return;
      const amount = parseFloat((await getSetting("loyalty_discount_amount")) || "20");

      // Find if this customer has any previously completed/paid jobs
      const [customer] = await db.select().from(customers).where(eq(customers.email, customerEmail.toLowerCase())).limit(1);
      if (!customer) return;
      const prevCompleted = await db.select({ id: quotesTable.id }).from(quotesTable)
        .where(and(eq(quotesTable.customerId, customer.id), inArray(quotesTable.status, ["completed","closed","final_paid"])))
        .limit(1);
      if (prevCompleted.length === 0) return; // first-time customer

      await db.update(quotesTable)
        .set({ loyaltyDiscount: String(amount) })
        .where(eq(quotesTable.id, quoteId));
      console.log(`[Loyalty] Applied $${amount} loyalty discount to quote ${quoteId} (returning customer ${customerEmail})`);
    } catch (e) {
      console.error("[Loyalty] Error applying loyalty discount:", e);
    }
  }

  // POST /api/admin/settings/loyalty — toggle loyalty discount
  app.post("/api/admin/settings/loyalty", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const { enabled, amount } = req.body;
    try {
      await setSetting("loyalty_discount_enabled", enabled ? "true" : "false");
      if (amount != null) await setSetting("loyalty_discount_amount", String(parseFloat(amount) || 20));
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/admin/settings/loyalty
  app.get("/api/admin/settings/loyalty", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const [enabled, amount] = await Promise.all([
        getSetting("loyalty_discount_enabled"),
        getSetting("loyalty_discount_amount"),
      ]);
      res.json({ enabled: enabled === "true", amount: parseFloat(amount || "20") });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ── AUTOMATED DAY-BEFORE WHATSAPP REMINDERS ───────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  async function runDayBeforeReminders() {
    try {
      const reminderEnabled = await getSetting("wa_reminders_enabled");
      if (reminderEnabled !== "true") return;

      const now = new Date();
      const tomorrowStart = new Date(now); tomorrowStart.setDate(tomorrowStart.getDate() + 1); tomorrowStart.setHours(0, 0, 0, 0);
      const tomorrowEnd   = new Date(now); tomorrowEnd.setDate(tomorrowEnd.getDate() + 1); tomorrowEnd.setHours(23, 59, 59, 999);

      const tomorrowJobs = await db.select({
        id: quotesTable.id,
        referenceNo: quotesTable.referenceNo,
        serviceAddress: quotesTable.serviceAddress,
        scheduledAt: quotesTable.scheduledAt,
        timeWindow: quotesTable.timeWindow,
        dayBeforeReminderAt: quotesTable.dayBeforeReminderAt,
        customerWhatsappPhone: quotesTable.customerWhatsappPhone,
        customerId: quotesTable.customerId,
        status: quotesTable.status,
      }).from(quotesTable)
        .where(and(
          inArray(quotesTable.status, ["booked", "assigned", "deposit_paid"]),
          isNull(quotesTable.dayBeforeReminderAt),
          gte(quotesTable.scheduledAt, tomorrowStart),
          lte(quotesTable.scheduledAt, tomorrowEnd),
        ));

      for (const job of tomorrowJobs) {
        const phone = job.customerWhatsappPhone;
        if (!phone) continue;

        let customerName = "there";
        if (job.customerId) {
          try {
            const [c] = await db.select({ name: customers.name }).from(customers).where(eq(customers.id, job.customerId)).limit(1);
            if (c) customerName = c.name.split(" ")[0];
          } catch {}
        }
        const dateStr = job.scheduledAt ? new Date(job.scheduledAt).toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long" }) : "tomorrow";
        const timeStr = job.timeWindow ? ` from *${job.timeWindow}*` : "";

        try {
          await sendBotMessage(phone,
            `👋 Hi *${customerName}*! This is a reminder from *TMG Install*.\n\n` +
            `Your furniture installation is scheduled for *${dateStr}*${timeStr}.\n\n` +
            `📍 *Address:* ${job.serviceAddress}\n` +
            `🔖 *Reference:* ${job.referenceNo}\n\n` +
            `Our team will arrive on time. Please ensure the area is accessible.\n\n` +
            `Questions? Just reply here. See you tomorrow! 🙌`
          );
          await db.update(quotesTable).set({ dayBeforeReminderAt: new Date() }).where(eq(quotesTable.id, job.id));
          console.log(`[Reminders] Sent day-before reminder for job ${job.referenceNo} to ${phone}`);
        } catch (e) {
          console.error(`[Reminders] Failed for job ${job.id}:`, e);
        }
      }
    } catch (e) {
      console.error("[Reminders] runDayBeforeReminders error:", e);
    }
  }

  // Run reminder check every hour
  setInterval(runDayBeforeReminders, 60 * 60 * 1000);
  // Also run once at startup (after 30s delay so server is fully ready)
  setTimeout(runDayBeforeReminders, 30_000);

  // WhatsApp AI Agent follow-up scheduler — runs every 5 minutes
  setInterval(runFollowUpScheduler, 5 * 60 * 1000);
  setTimeout(runFollowUpScheduler, 60_000);

  // ── Partial Lead (abandoned wizard) API ───────────────────────────────────

  app.post("/api/partial-leads", async (req, res) => {
    try {
      const { email, name, phone, services, serviceAddress, pickupAddress, dropoffAddress, items, slotDateStr } = req.body;
      if (!email || typeof email !== "string") return res.status(400).json({ error: "Email required" });
      const token = require("crypto").randomUUID();
      const lead = await storage.createPartialLead({ resumeToken: token, email: email.trim().toLowerCase(), name, phone, services, serviceAddress, pickupAddress, dropoffAddress, items, slotDateStr });
      res.json({ token: lead.resumeToken });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.patch("/api/partial-leads/:token", async (req, res) => {
    try {
      const { token } = req.params;
      await storage.updatePartialLead(token, req.body);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/partial-leads/:token/complete", async (req, res) => {
    try {
      const { token } = req.params;
      await storage.markPartialLeadCompleted(token);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/partial-leads/resume/:token", async (req, res) => {
    try {
      const lead = await storage.getPartialLeadByToken(req.params.token);
      if (!lead || lead.status === "completed") return res.status(404).json({ error: "Not found" });
      res.json(lead);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Abandoned Lead Scheduler ──────────────────────────────────────────────
  async function runAbandonedLeadScheduler() {
    try {
      const DELAY_MS = 30 * 60 * 1000; // 30 minutes after starting
      const leads = await storage.getDuePartialLeads(DELAY_MS);
      for (const lead of leads) {
        try {
          const resumeUrl = `${APP_URL}/estimate?resume=${lead.resumeToken}`;
          const itemCount = Array.isArray(lead.items) ? lead.items.length : 0;
          const itemsText = itemCount > 0 ? `You had ${itemCount} item${itemCount !== 1 ? "s" : ""} in your basket.` : "";
          const servicesText = Array.isArray(lead.services) && lead.services.length > 0
            ? `Services: ${(lead.services as string[]).map((s: string) => ({ install: "Installation", dismantle: "Dismantling", relocate: "Relocation", dispose: "Disposal" }[s] || s)).join(", ")}.`
            : "";

          const emailSent = await sendEmail({
            to: lead.email,
            subject: "Your TMG Install quote is waiting ✨",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
                <div style="background: #111; padding: 24px 32px;">
                  <h1 style="color: #fff; font-size: 20px; margin: 0; font-weight: 900; letter-spacing: -0.02em;">TMG Install</h1>
                  <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin: 4px 0 0;">Singapore's Furniture Installation Specialists</p>
                </div>
                <div style="padding: 32px;">
                  <h2 style="font-size: 22px; font-weight: 900; margin: 0 0 8px;">Your quote is still waiting${lead.name ? `, ${lead.name}` : ""}!</h2>
                  <p style="color: #555; margin: 0 0 16px;">You were almost there — you started a quote with us but didn't finish. Your details are saved; just click below to pick up exactly where you left off.</p>
                  ${servicesText || itemsText ? `<p style="color: #555; margin: 0 0 16px;">${servicesText} ${itemsText}</p>` : ""}
                  <a href="${resumeUrl}" style="display: inline-block; background: #111; color: #fff; text-decoration: none; font-weight: 900; font-size: 14px; letter-spacing: 0.04em; padding: 14px 28px; margin-bottom: 24px;">COMPLETE MY QUOTE →</a>
                  <div style="background: #f8f8f8; border-left: 3px solid #111; padding: 16px; margin-bottom: 24px;">
                    <p style="font-size: 13px; margin: 0 0 6px;"><strong>⭐ 4.9 rated on Google</strong> · 127+ reviews</p>
                    <p style="font-size: 13px; margin: 0 0 6px;">✅ Fully insured · Island-wide · Fixed prices, no surprises</p>
                    <p style="font-size: 13px; margin: 0;">⚡ Most quotes responded to within 4 hours</p>
                  </div>
                  <p style="font-size: 12px; color: #999;">Need help? Just WhatsApp us at <a href="https://wa.me/6590248681" style="color: #111;">+65 9024 8681</a></p>
                </div>
              </div>
            `,
          });

          if (emailSent) {
            await storage.markPartialLeadEmailSent(lead.resumeToken);
            console.log(`[AbandonedLead] Re-engagement email sent to ${lead.email}`);
          }

          // ── WhatsApp nudge for the same partial lead ──────────────────────
          // Only fires when (a) the rescue flag is on, (b) lead has a phone,
          // and (c) we haven't already WA-nudged this resume token. This
          // squeezes a second conversion path out of every web abandon.
          try {
            const [rescueFlag] = await db.select().from(aiFeatureFlags)
              .where(eq(aiFeatureFlags.key, "ai_abandoned_quote_rescue_enabled")).limit(1);
            const rescueOn = (rescueFlag as any)?.value === true;
            // Master kill switch must also gate this path (architect feedback).
            const [killFlag] = await db.select().from(aiFeatureFlags)
              .where(eq(aiFeatureFlags.key, "ai_master_kill_switch")).limit(1);
            const killOn = (killFlag as any)?.value === true;
            if (rescueOn && !killOn && lead.phone && !lead.whatsappSentAt) {
              const waPhone = normalizeSGPhone(lead.phone);
              if (waPhone) {
                const waMsg =
                  `Hi${lead.name ? ` ${lead.name}` : ""}! 👋 You started a quote with TMG Install but didn't quite finish.\n\n` +
                  (itemsText || servicesText ? `${servicesText} ${itemsText}\n\n` : "") +
                  `No re-typing needed — pick up exactly where you left off:\n${resumeUrl}\n\n` +
                  `Or just reply here and I'll help you finish in 60 seconds. ⚡`;
                const waSent = await sendWhatsAppMessage(waPhone, waMsg).catch(() => false);
                if (waSent) {
                  await storage.markPartialLeadWhatsappSent(lead.resumeToken);
                  console.log(`[AbandonedLead] WA nudge sent to +${waPhone}`);
                }
              }
            }
          } catch (waErr) {
            console.warn(`[AbandonedLead] WA nudge failed for ${lead.email}:`, (waErr as any)?.message);
          }
        } catch (err) {
          console.error(`[AbandonedLead] Failed for ${lead.email}:`, err);
        }
      }
    } catch (err) {
      console.error("[AbandonedLead] Scheduler error:", err);
    }
  }

  setInterval(runAbandonedLeadScheduler, 5 * 60 * 1000);
  setTimeout(runAbandonedLeadScheduler, 90_000);

  // ── Stale Quote Nudger (Phase 9d sales recovery) ──────────────────────────
  // Quotes with status='submitted' AND a customer WhatsApp phone get up to 3
  // gentle nudges: 24h, 3d, 7d after creation. Each nudge is recorded as a
  // job_update so we never double-send. Gated by `ai_abandoned_quote_rescue_enabled`.
  // Skips quotes where AI ownership is human (live conversation in flight).
  async function runStaleQuoteNudger() {
    try {
      const [rescueFlag] = await db.select().from(aiFeatureFlags)
        .where(eq(aiFeatureFlags.key, "ai_abandoned_quote_rescue_enabled")).limit(1);
      if ((rescueFlag as any)?.value !== true) return;
      const [killFlag] = await db.select().from(aiFeatureFlags)
        .where(eq(aiFeatureFlags.key, "ai_master_kill_switch")).limit(1);
      if ((killFlag as any)?.value === true) return;

      const HOUR = 3600 * 1000;
      const now = Date.now();
      // Pull quotes still in 'submitted' status from the last 14 days that
      // have a WhatsApp phone. 14d is a hard horizon — beyond that it's a
      // dead lead, no nudge.
      const candidates = await db.select().from(quotesTable).where(
        and(
          eq(quotesTable.status, "submitted"),
          gte(quotesTable.createdAt, new Date(now - 14 * 24 * HOUR)),
        ),
      );

      for (const q of candidates) {
        const waPhoneRaw = (q as any).customerWhatsappPhone;
        if (!waPhoneRaw) continue;
        const waPhone = normalizeSGPhone(waPhoneRaw);
        if (!waPhone) continue;

        const ageMs = now - new Date(q.createdAt as any).getTime();
        const ageH  = ageMs / HOUR;
        // Decide which nudge stage is due
        let stage: "quote_nudge_24h" | "quote_nudge_3d" | "quote_nudge_7d" | null = null;
        if      (ageH >= 7 * 24) stage = "quote_nudge_7d";
        else if (ageH >= 3 * 24) stage = "quote_nudge_3d";
        else if (ageH >= 24)     stage = "quote_nudge_24h";
        if (!stage) continue;

        // Idempotency: skip if this stage (or a LATER stage — implies we
        // already moved on) was already sent.
        const updates = await db.select({ statusChange: jobUpdatesTable.statusChange })
          .from(jobUpdatesTable)
          .where(eq(jobUpdatesTable.quoteId, q.id));
        const sentStages = new Set(updates.map(u => u.statusChange));
        if (sentStages.has(stage)) continue;
        // If a later stage already sent, don't backfill earlier stages
        if (stage === "quote_nudge_24h" && (sentStages.has("quote_nudge_3d") || sentStages.has("quote_nudge_7d"))) continue;
        if (stage === "quote_nudge_3d"  &&  sentStages.has("quote_nudge_7d")) continue;

        // Skip if a human is in the conversation
        try {
          const sess = await storage.getWhatsAppSession(waPhone);
          if (sess?.botPaused || (sess as any)?.aiOwnership === "human") continue;
        } catch {}

        // ── ATOMIC CLAIM (lock + recheck + marker insert in one tx) ─────
        // pg_try_advisory_xact_lock holds the lock only for the LIFETIME
        // of the transaction, so lock + recheck + marker INSERT must all
        // run on the same tx handle. Otherwise the lock releases between
        // statements and racing schedulers can both pass the recheck
        // (architect feedback). `sql` is imported as `drizzleSql` here.
        const stageHash = stage === "quote_nudge_24h" ? 1
                       : stage === "quote_nudge_3d"  ? 2 : 3;
        let claimed = false;
        try {
          await db.transaction(async (tx) => {
            const lockRes: any = await tx.execute(
              drizzleSql`SELECT pg_try_advisory_xact_lock(${q.id}::int, ${stageHash}::int) AS got`,
            );
            const got = lockRes?.rows?.[0]?.got ?? lockRes?.[0]?.got;
            if (!got) return; // another scheduler holds the lock — skip
            const recheck = await tx.select({ statusChange: jobUpdatesTable.statusChange })
              .from(jobUpdatesTable)
              .where(eq(jobUpdatesTable.quoteId, q.id));
            if (recheck.some(u => u.statusChange === stage)) return;
            // CLAIM: insert the marker INSIDE the locked tx so any
            // concurrent run that gets the lock next sees it on recheck.
            await tx.insert(jobUpdatesTable).values({
              quoteId: q.id,
              statusChange: stage,
              actorType: "system",
              note: `Auto stale-quote nudge (age ${Math.round(ageH)}h)`,
            } as any);
            claimed = true;
          });
        } catch (txErr) {
          console.warn(`[StaleQuoteNudger] tx claim failed for quote ${q.id}/${stage}:`, (txErr as any)?.message);
          continue;
        }
        if (!claimed) continue;

        const total = Number((q as any).total ?? 0).toFixed(0);
        const ref   = (q as any).referenceNo ?? `#${q.id}`;
        const msgs: Record<typeof stage, string> = {
          quote_nudge_24h:
            `Hi! Just checking in on your TMG Install quote ${ref} ($${total}) — did you get a chance to review it? 👀\n\n` +
            `Happy to tweak anything (date, items, access). Just reply here or say *YES* to lock in your slot. We're 4.9★ rated and fully insured. 😊`,
          quote_nudge_3d:
            `Hi again! Your TMG Install quote ${ref} is still ready when you are. \n\n` +
            `Slots for the coming weeks are filling up — if you'd like to lock yours in we can hold one for 24 hrs once you confirm. Reply here anytime!`,
          quote_nudge_7d:
            `Hi! Last gentle nudge from TMG Install — your quote ${ref} is still valid if you'd like to proceed. \n\n` +
            `Even if the timing changed, no worries — just reply here when you're ready and we'll sort it out. 🙏`,
        } as any;

        // Marker is already committed inside the tx above; now SEND.
        // If WA send fails, we accept losing one nudge over double-sending.
        const ok = await sendWhatsAppMessage(waPhone, msgs[stage]).catch(() => false);
        console.log(`[StaleQuoteNudger] ${stage} → +${waPhone} for ${ref} (sent=${ok})`);
      }
    } catch (err) {
      console.error("[StaleQuoteNudger] Scheduler error:", err);
    }
  }

  setInterval(runStaleQuoteNudger, 30 * 60 * 1000); // every 30 min
  setTimeout(runStaleQuoteNudger, 120_000);          // first run 2 min after boot

  // Admin toggle for reminders
  app.post("/api/admin/settings/wa-reminders", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const { enabled } = req.body;
    try {
      await setSetting("wa_reminders_enabled", enabled ? "true" : "false");
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/admin/settings/wa-reminders", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const val = await getSetting("wa_reminders_enabled");
      res.json({ enabled: val === "true" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Web Push notifications (admin PWA) ──────────────────────────────────────
  // Initialise VAPID keys on startup
  initVapid().catch(e => console.error("[Push] initVapid error:", e));

  app.get("/api/admin/push/vapid-key", async (_req, res) => {
    try {
      const publicKey = await getVapidPublicKey();
      res.json({ publicKey });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/push/subscribe", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    // Push notifications carry customer PII (phone snippet + WhatsApp body
    // preview) — restrict subscription to admins only. Without this any
    // logged-in staff user could call this endpoint and start receiving
    // inbound customer messages.
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const sub = req.body;
      if (!sub?.endpoint) return res.status(400).json({ error: "Invalid subscription" });
      await addSubscription(sub);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/push/unsubscribe", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const caller = await storage.getUserById(req.session.userId);
    if (!caller || caller.role !== "admin") return res.status(403).json({ error: "Forbidden" });
    try {
      const { endpoint } = req.body;
      if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
      await removeSubscription(endpoint);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── GGV Jobs ────────────────────────────────────────────────────────────────
  // POST /api/admin/ggv-jobs/scan — upload spreadsheet image, extract rows via AI
  app.post("/api/admin/ggv-jobs/scan", upload.single("image"), async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });
    const mimeType = req.file.mimetype || "image/jpeg";
    const base64 = req.file.buffer.toString("base64");
    try {
      const scanRes = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a data extraction assistant. The user shows you a spreadsheet screenshot of daily delivery/installation jobs for a Singapore logistics company.

Extract ALL job rows from the spreadsheet. Each row is one job. Columns (read left to right):
- jobNo: Job order number (e.g. "S045260062103")
- bookingRef: Booking reference (e.g. "V045260161488")
- timeStart: Start time in HH:MM format (e.g. "09:00")
- timeEnd: End time in HH:MM format (e.g. "12:00")
- listedPrice: Listed/gross price in dollars (number, e.g. 99.90)
- deduction: Deduction/fee amount (number, e.g. 18.33; use 0 if blank)
- actualPrice: Actual payout — the KEY column (number, e.g. 9.17)
- serviceType: Service code (e.g. "D+A", "R+A+DISS", "ASD+ASA")
- remarks: Any notes text in the row (string or null)
- address: Job address
- postalCode: 6-digit Singapore postal code (string)
- distanceKm: Distance in km (number, e.g. 15.95)
- ratePerKm: Rate per km (small number e.g. 0.06)
- flagged: true if row is highlighted red/pink/orange, false otherwise
Also extract from the header:
- date: Date of jobs if visible as YYYY-MM-DD, else null
- vehicleGroup: Header vehicle group text (e.g. "TMG1 GGV 029")
- vehicleType: Header van type text (e.g. "EV VAN")

Return ONLY valid JSON:
{"date":null,"vehicleGroup":"TMG1 GGV 029","vehicleType":"EV VAN","jobs":[{"jobNo":"S045260062103","bookingRef":"V045260161488","timeStart":"09:00","timeEnd":"12:00","listedPrice":99.90,"deduction":18.33,"actualPrice":9.17,"serviceType":"D+A","remarks":null,"address":"17 Jalan Tenteram #08-120","postalCode":"321017","distanceKm":15.95,"ratePerKm":0.06,"flagged":false}]}`,
          },
          {
            role: "user",
            content: [{ type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" } }] as any,
          },
        ],
      });
      const parsed = JSON.parse(scanRes.choices[0]?.message?.content || "{}");
      return res.json(parsed);
    } catch (e: any) {
      return res.status(500).json({ message: `Scan failed: ${e.message}` });
    }
  });

  // GET /api/admin/ggv-jobs?date=YYYY-MM-DD
  app.get("/api/admin/ggv-jobs", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const rows = await storage.getGGVJobs(date);
    return res.json(rows);
  });

  // POST /api/admin/ggv-jobs
  app.post("/api/admin/ggv-jobs", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    try {
      const job = await storage.createGGVJob(req.body);
      return res.status(201).json(job);
    } catch (e: any) { return res.status(400).json({ message: e.message }); }
  });

  // PATCH /api/admin/ggv-jobs/:id
  app.patch("/api/admin/ggv-jobs/:id", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const id = Number(req.params.id);
    try {
      const job = await storage.updateGGVJob(id, req.body);
      if (!job) return res.status(404).json({ message: "Not found" });
      return res.json(job);
    } catch (e: any) { return res.status(400).json({ message: e.message }); }
  });

  // DELETE /api/admin/ggv-jobs/:id
  app.delete("/api/admin/ggv-jobs/:id", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const id = Number(req.params.id);
    await storage.deleteGGVJob(id);
    return res.json({ ok: true });
  });

  // POST /api/admin/ggv-jobs/bulk-delete — body: { ids: number[] }
  app.post("/api/admin/ggv-jobs/bulk-delete", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const raw = (req.body?.ids ?? []) as unknown[];
    const ids = Array.from(new Set(raw.map(v => Number(v)).filter(n => Number.isFinite(n) && n > 0)));
    if (!ids.length) return res.status(400).json({ message: "ids required" });
    const deleted = await storage.deleteGGVJobs(ids);
    return res.json({ ok: true, deleted });
  });

  // ── Subcontractors ────────────────────────────────────────────────────────
  // GET /api/admin/subcontractors — list all subcontractors
  app.get("/api/admin/subcontractors", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const subs = await storage.getSubcontractors();
    return res.json(subs);
  });

  // POST /api/admin/subcontractors — create subcontractor
  app.post("/api/admin/subcontractors", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const { name, phone, email, company, notes } = req.body as any;
    if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
    const sub = await storage.createSubcontractor({ name: name.trim(), phone: phone || null, email: email || null, company: company || null, notes: notes || null });
    return res.json(sub);
  });

  // PATCH /api/admin/subcontractors/:id — update subcontractor
  app.patch("/api/admin/subcontractors/:id", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const id = Number(req.params.id);
    const { name, phone, email, company, notes } = req.body as any;
    const sub = await storage.updateSubcontractor(id, { name, phone, email, company, notes });
    if (!sub) return res.status(404).json({ message: "Not found" });
    return res.json(sub);
  });

  // DELETE /api/admin/subcontractors/:id — delete subcontractor
  app.delete("/api/admin/subcontractors/:id", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const id = Number(req.params.id);
    await storage.deleteSubcontractor(id);
    return res.json({ ok: true });
  });

  // GET /api/admin/subcontractors/:id/jobs — jobs for a specific sub
  app.get("/api/admin/subcontractors/:id/jobs", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const id = Number(req.params.id);
    const jobs = await storage.getSubcontractorJobs(id);
    return res.json(jobs);
  });

  // GET /api/admin/subcontracts/summary — profit & payables overview
  app.get("/api/admin/subcontracts/summary", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const summary = await storage.getSubcontractSummary();
    return res.json(summary);
  });

  // GET /api/admin/quotes/:id/subcontracts — get subcontracts for a quote
  app.get("/api/admin/quotes/:id/subcontracts", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const quoteId = Number(req.params.id);
    const subs = await storage.getJobSubcontracts(quoteId);
    return res.json(subs);
  });

  // POST /api/admin/quotes/:id/subcontracts — assign subcontractor to a job
  app.post("/api/admin/quotes/:id/subcontracts", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const quoteId = Number(req.params.id);
    const { subcontractorId, agreedCost, notes } = req.body as any;
    if (!subcontractorId || !agreedCost) return res.status(400).json({ message: "subcontractorId and agreedCost are required" });
    const record = await storage.assignSubcontract({ quoteId, subcontractorId: Number(subcontractorId), agreedCost: String(agreedCost), notes: notes || null, paymentStatus: 'unpaid', paidAt: null });
    return res.json(record);
  });

  // PATCH /api/admin/subcontracts/:id — update subcontract (cost, status, notes)
  app.patch("/api/admin/subcontracts/:id", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const id = Number(req.params.id);
    const { agreedCost, paymentStatus, notes } = req.body as any;
    const updates: any = {};
    if (agreedCost !== undefined) updates.agreedCost = String(agreedCost);
    if (paymentStatus !== undefined) {
      updates.paymentStatus = paymentStatus;
      updates.paidAt = paymentStatus === 'paid' ? new Date() : null;
    }
    if (notes !== undefined) updates.notes = notes;
    const record = await storage.updateJobSubcontract(id, updates);
    if (!record) return res.status(404).json({ message: "Not found" });
    return res.json(record);
  });

  // DELETE /api/admin/subcontracts/:id — remove subcontract assignment
  app.delete("/api/admin/subcontracts/:id", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
    const id = Number(req.params.id);
    await storage.deleteJobSubcontract(id);
    return res.json({ ok: true });
  });

  // ── AI Operations Layer ────────────────────────────────────────────────────
  registerAiRoutes(app);
  registerPhoneIntakeRoutes(app);

  return httpServer;
}
