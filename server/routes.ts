import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { randomBytes } from "crypto";
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
  caseClosedEmail,
  newEstimateAdminAlert,
  ADMIN_EMAIL
} from "./email";
import { sendWhatsAppMessage, sendBotMessage, sendWhatsAppPaymentLink, updateAccessToken, getAccessToken, downloadWhatsAppMedia, markAsRead, WHATSAPP_VERIFY_TOKEN } from "./whatsapp";
import { calcTransportFee, PricingConfig } from "@shared/pricing";
import { db } from "./db";
import { appSettings, attendanceLogs, promoCodes } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

const APP_URL = process.env.APP_URL || "http://localhost:5000";

// ── Smart catalog pricing lookup (used by WhatsApp bot) ──────────────────────
// Given a natural-language furniture query, ALWAYS finds the closest catalog
// match and returns a formatted WhatsApp price message.
// Returns null only on network/DB errors (not on mismatch — we always match).
async function smartPricingLookup(query: string): Promise<string | null> {
  try {
    const catalog = await storage.getCatalogItems();
    const uniqueNames = [...new Set(catalog.map(c => c.name))].join(", ");

    // Ask GPT to find the BEST matching catalog item(s) — always return something
    const matchRes = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 200,
      response_format: { type: "json_object" },
      messages: [{
        role: "system",
        content: `You are a pricing assistant for TMG Install, a Singapore furniture installation company.
The customer is asking about pricing for: "${query}"

Available catalog items (exact names — use these EXACTLY):
${uniqueNames}

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
- For anything else: pick the most visually/functionally similar item from the list

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
      install:          "🔧 *Installation*",
      dismantle:        "🔨 *Dismantling*",
      relocate:         "🚚 *Relocation* _(incl. dismantle + reinstall)_",
      dispose:          "🗑️ *Disposal*",
      dismantle_dispose:"🔨🗑️ *Dismantle + Dispose*",
    };

    const lines = Object.entries(byType)
      .filter(([type]) => typeLabel[type])
      .map(([type, prices]) => {
        const min = Math.min(...prices), max = Math.max(...prices);
        return `${typeLabel[type]}: *$${min}${min !== max ? ` – $${max}` : ""}*`;
      });

    if (lines.length === 0) return null;

    const intro = isApproximate
      ? `Here's our closest pricing reference for *${itemLabel}* in Singapore:\n\n`
      : `Here's our pricing for *${itemLabel}* in Singapore:\n\n`;

    const footnote = isApproximate
      ? `\n\n_Estimated based on similar items. Final price confirmed after our team reviews your job. Min. job $180._`
      : `\n\n_Per item. Excludes floor surcharge & transport. Min. job $180._`;

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

// ─── Coordinator persona shared across all GPT reply functions ───────────────
const COORDINATOR_PERSONA = `You are the TMGinstall WhatsApp customer coordinator.

You are chatting with customers on WhatsApp.
You must sound like a real helpful human coordinator, not a bot.

Tone:
- warm
- practical
- concise
- calm
- human
- not salesy
- not overly formal

Hard rules:
- never say you are an AI
- never sound robotic or scripted
- never ask a huge list of questions at once
- never ask for information the customer already gave
- never ignore a customer question — answer it first, then continue
- never say booking is confirmed unless the real system confirms it
- never invent pricing, policy, or availability
- if the case is complex, say the team/admin will review and follow up

TMG Install facts:
- Singapore furniture installation, dismantling, relocation (all-in-one move), and disposal company
- Covers all Singapore: HDB, condo, landed, commercial & office
- Pricing from SGD 80/item, min job SGD 180; transport fee applies for relocation
- Payment: 50% deposit to confirm, 50% on completion — PayNow / bank transfer / card
- Available weekdays & weekends (subject to availability); all tools supplied
- No GST (nett pricing); relocation includes dismantling at origin and reinstallation at destination

Natural acknowledgement examples:
- "Got it, bed frame and wardrobe — noted."
- "No problem, I've updated that."
- "Thanks, that helps."
- "Understood — making a note of that."`;

/**
 * Shared furniture identification guide injected into all vision prompts.
 * Prevents common misidentification errors (e.g. chest of drawers → "desk").
 */
const FURNITURE_VISION_GUIDE = `
CRITICAL IDENTIFICATION RULES — read before answering:

1. CHEST OF DRAWERS / DRESSER: An upright storage unit with MULTIPLE FULL-WIDTH DRAWERS stacked in rows (typically 3–8 drawers). NO doors. Usually 50–110cm wide, 60–130cm tall. The drawers are the PRIMARY visual feature. Do NOT call this a desk, table, or cabinet. Names: "chest of drawers", "dresser", "6-drawer dresser", etc.

2. WARDROBE / CLOSET: Tall cabinet (typically 180–240cm) with HINGED or SLIDING DOORS. Contains hanging space for clothes. May or may not have drawers at the bottom. Names: "wardrobe", "IKEA PAX wardrobe", "2-door wardrobe", etc.

3. DESK / WORK TABLE: Has a FLAT HORIZONTAL WORK SURFACE at roughly sitting height (~75cm), designed for working at while seated. Legs are clearly visible. The surface area is the dominant feature. A small side drawer is possible but NOT the primary feature. Do NOT call a chest of drawers a desk.

4. DINING TABLE / COFFEE TABLE: Flat surface designed for eating (dining) or as a low surface (coffee table, ~40cm tall).

5. BED FRAME: Has a headboard and/or footboard. Holds a mattress. Named by mattress size: single, super single, queen, king.

6. BOOKSHELF / SHELVING: Upright unit with OPEN SHELVES (no drawers, no doors). For storing books/items.

7. SOFA / COUCH: Upholstered seating for multiple people. Named by shape: 2-seater, 3-seater, L-shaped, etc.

8. TV CONSOLE: Low-profile unit (typically 40–60cm tall) designed to hold a television. Usually wider than tall.

9. STANDING DESK (HEIGHT-ADJUSTABLE): Has clearly visible motorized or hand-crank adjustable legs. Look for an electric control panel on the leg, up/down buttons, a digital height display, or a hand crank. These are structural features you will see clearly. If you cannot see any height-adjustment mechanism → it is a REGULAR DESK, not a standing desk.

Common mistakes to AVOID:
- A unit with MANY DRAWERS and NO doors = chest of drawers (NOT a desk)
- A tall unit with DOORS = wardrobe (NOT a cabinet or cupboard unless clearly office storage)
- A unit with a FLAT TOP and LEGS at sitting height = desk/table (NOT storage)
- A desk with a FABRIC PANEL, MODESTY SCREEN, or PRIVACY SCREEN attached to the front = REGULAR DESK (e.g. "L-Shaped Executive Desk"). A fabric panel is decorative/privacy trim, NOT a standing mechanism. Do NOT classify as "standing desk" just because a panel is present.
- Only call something a "standing desk" if you can clearly see electric controls, a height display, a hand crank, or visibly adjustable leg height.
`;

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
      model: "gpt-4o-mini",
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
  } catch (err) {
    console.error("Stripe payment link error:", err);
    return null;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
          await sendEmail({
            to: quote.customer.email,
            subject: `[${quote.referenceNo}] Deposit Received — Slot Confirmed!`,
            html: depositReceivedEmail(quote),
          });
          console.log(`Stripe webhook: deposit paid for ${quote.referenceNo} (SGD ${amountPaid})`);
        }

        if (type === "final") {
          await sendEmail({
            to: quote.customer.email,
            subject: `[${quote.referenceNo}] Payment Received — Case Closed`,
            html: caseClosedEmail(quote),
          });
          console.log(`Stripe webhook: final payment for ${quote.referenceNo} (SGD ${amountPaid})`);
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
    const staff = await storage.getStaffMembers();
    res.json(staff);
  });

  // Create staff member (admin only)
  app.post("/api/admin/staff", async (req, res) => {
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
  app.get("/api/teams", async (_req, res) => {
    const data = await storage.getTeams();
    res.json(data);
  });

  app.post("/api/teams", async (req, res) => {
    try {
      const data = z.object({ name: z.string().min(1), color: z.string().optional() }).parse(req.body);
      const team = await storage.createTeam({ name: data.name, color: data.color || "#6366f1" });
      res.json(team);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.patch("/api/teams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = z.object({ name: z.string().min(1).optional(), color: z.string().optional() }).parse(req.body);
      const updated = await storage.updateTeam(id, data);
      res.json(updated);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/teams/:id", async (req, res) => {
    try {
      await storage.deleteTeam(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/teams/:id/assign", async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const { userId } = z.object({ userId: z.number() }).parse(req.body);
      await storage.assignUserToTeam(userId, teamId);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.post("/api/staff/:id/unassign-team", async (req, res) => {
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
      const { clockInAt, clockOutAt, notes } = z.object({
        clockInAt: z.string().optional(),
        clockOutAt: z.string().nullable().optional(),
        notes: z.string().optional(),
      }).parse(req.body);
      const updated = await storage.updateAttendanceLog(id, {
        clockInAt: clockInAt ? new Date(clockInAt) : undefined,
        clockOutAt: clockOutAt === null ? null : clockOutAt ? new Date(clockOutAt) : undefined,
        notes,
      });
      if (!updated) return res.status(404).json({ message: "Record not found" });
      res.json(updated);
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
    const amendments = await storage.getPendingAmendments();
    res.json(amendments);
  });

  app.patch("/api/admin/attendance/amendments/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
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
    const status = req.query.status as string | undefined;
    const leaves = await storage.getAllLeaveRequests(status);
    res.json(leaves);
  });

  app.patch("/api/admin/leave/:id", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
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
          const hrs = (new Date(log.clockOutAt).getTime() - new Date(log.clockInAt).getTime()) / 3600000;
          const dailyOt = Math.max(0, hrs - 8);
          regularHours  += Math.min(hrs, 8);
          overtimeHours += dailyOt;
          // Meal allowance: S$8 per day when OT > 3h (applied once per day)
          if (dailyOt > 3) mealAllowanceDays++;
        }
      }
      const mealAllowance = mealAllowanceDays * 8;

      let basicPay = 0, regularPay = 0, overtimePay = 0, grossPay = 0;
      if (isMonthly) {
        // Basic salary (fixed) + regular hrs × hourly rate + OT hrs × OT rate + meal allowance
        basicPay    = monthlyRate;
        regularPay  = regularHours * hourlyRate;
        overtimePay = overtimeHours * overtimeRate;
        grossPay    = basicPay + regularPay + overtimePay + mealAllowance;
      } else {
        // Purely hourly: regular hrs × hourly rate + OT hrs × OT rate + meal allowance
        basicPay    = 0;
        regularPay  = regularHours * hourlyRate;
        overtimePay = overtimeHours * overtimeRate;
        grossPay    = regularPay + overtimePay + mealAllowance;
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
        leaveDeduction: leaveDeduction.toFixed(2),
        grossPay: Math.max(0, grossPay).toFixed(2),
        notes,
        generatedBy: req.session.userId,
      });
      res.json(payslip);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  app.delete("/api/admin/payslips/:id", async (req, res) => {
    try {
      await storage.deletePayslip(parseInt(req.params.id));
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
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
    const receipt = await storage.getReceiptById(parseInt(req.params.id));
    if (!receipt) return res.status(404).json({ message: "Not found" });
    res.json({ fileData: receipt.fileData, fileType: receipt.fileType, fileName: receipt.fileName });
  });

  // Admin: approve or reject a receipt
  app.patch("/api/admin/receipts/:id/status", async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not logged in" });
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
    const status = req.query.status as string | undefined;
    const quotes = await storage.getQuotes(status);
    res.json(quotes);
  });

  // Look up a quote by reference number — used for /status/:refNo redirects
  app.get("/api/quotes/by-ref/:refNo", async (req, res) => {
    try {
      const quotes = await storage.getQuotes();
      const quote = quotes.find(q => q.referenceNo === req.params.refNo);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json({ id: quote.id });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/quotes/schedule", async (req, res) => {
    try {
      const pending = await storage.getQuotesByStatuses(['booking_requested']);
      const confirmed = await storage.getQuotesByStatuses(['booked', 'assigned', 'in_progress']);
      res.json({ pending, confirmed });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get(api.quotes.get.path, async (req, res) => {
    const id = parseInt(req.params.id);
    const quote = await storage.getQuote(id);
    if (!quote) return res.status(404).json({ message: "Quote not found" });
    res.json(quote);
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
            item.detectedName.toLowerCase().includes(c.name.toLowerCase())
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

      const referenceNo = `TMG-${randomBytes(4).toString('hex').toUpperCase()}`;

      // ── Minimum charge: SGD 180 ──────────────────────────────────────────────
      const MIN_CHARGE_LEGACY = 180;
      const minAdj = totalEstimate < MIN_CHARGE_LEGACY ? MIN_CHARGE_LEGACY - totalEstimate : 0;
      const grandTotalLegacy = totalEstimate + minAdj;
      if (minAdj > 0) {
        aiParsedItems.push({
          originalDescription: "Minimum Charge Adjustment",
          detectedName: "Minimum Charge Adjustment",
          serviceType: "adjustment",
          quantity: 1,
          unitPrice: minAdj.toFixed(2),
          subtotal: minAdj.toFixed(2),
        });
      }
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

      // Send deposit request email when admin approves
      if (input.status === "deposit_requested" && quote.customer) {
        const depositAmt = parseFloat(quote.depositAmount || "0") || parseFloat(quote.total) * 0.3;
        const quotePageUrl = `${APP_URL}/quotes/${quote.id}`;
        const stripeUrl = await createStripePaymentLink(
          `Deposit for ${quote.referenceNo} — TMG Install`,
          depositAmt,
          { quoteId: String(quote.id), type: "deposit", referenceNo: quote.referenceNo },
          quotePageUrl
        );
        const paymentLink = stripeUrl || quotePageUrl;
        const emailHtml = depositRequestEmail(quote, paymentLink);
        await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Deposit Payment Required — TMG Install`,
          html: emailHtml,
        });
      }
      
      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Customer pays deposit (mock)
  app.patch(api.quotes.updatePayment.path, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = api.quotes.updatePayment.input.parse(req.body);
      const quote = await storage.updateQuotePayment(id, input.paymentType, input.amount);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      
      // After deposit paid, send slot confirmation email
      if (input.paymentType === 'deposit' && quote.customer) {
        const emailHtml = depositReceivedEmail(quote);
        await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Deposit Received — Slot Confirmed!`,
          html: emailHtml,
        });
      }

      // After final payment, send case closed email
      if (input.paymentType === 'final' && quote.customer) {
        const emailHtml = caseClosedEmail(quote);
        await sendEmail({
          to: quote.customer.email,
          subject: `[${quote.referenceNo}] Payment Received — Case Closed`,
          html: emailHtml,
        });
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

      const quotePageUrl = `${APP_URL}/quotes/${quote.id}`;
      let amount: number;
      let description: string;

      if (type === "deposit") {
        amount = parseFloat(quote.depositAmount || "0") || parseFloat(quote.total) * 0.3;
        description = `Deposit for ${quote.referenceNo} — TMG Install`;
      } else {
        amount = parseFloat(quote.finalAmount || "0") || parseFloat(quote.total) * 0.7;
        description = `Final Payment for ${quote.referenceNo} — TMG Install`;
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
      const { session_id } = z.object({ session_id: z.string() }).parse(req.body);

      if (!stripe) return res.status(500).json({ message: "Stripe not configured" });

      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not completed" });
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

      if (!alreadyProcessedByWebhook) {
        if (type === "deposit") {
          await sendEmail({
            to: quote.customer.email,
            subject: `[${quote.referenceNo}] Deposit Received — Slot Confirmed!`,
            html: depositReceivedEmail(quote),
          });
          console.log(`Payment verified (no-webhook): deposit paid for ${quote.referenceNo}`);
        }

        if (type === "final") {
          await sendEmail({
            to: quote.customer.email,
            subject: `[${quote.referenceNo}] Payment Received — Case Closed`,
            html: caseClosedEmail(quote),
          });
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
      const { scheduledAt, timeWindow } = z.object({
        scheduledAt: z.string(),
        timeWindow: z.string()
      }).parse(req.body);

      const existingQuote = await storage.getQuote(id);
      if (!existingQuote) return res.status(404).json({ message: "Quote not found" });

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
      const { scheduledAt, timeWindow } = z.object({
        scheduledAt: z.string(),
        timeWindow: z.string()
      }).parse(req.body);

      const existingQuote = await storage.getQuote(id);
      if (!existingQuote) return res.status(404).json({ message: "Quote not found" });

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
      res.json(quote);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin: Edit quote before deposit
  app.patch("/api/quotes/:id/edit", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getQuote(id);
      if (!existing) return res.status(404).json({ message: "Quote not found" });

      // Only allow editing before deposit is paid
      const editableStatuses = ['submitted', 'under_review', 'approved', 'deposit_requested'];
      if (!editableStatuses.includes(existing.status)) {
        return res.status(400).json({ message: "Quote can only be edited before deposit is paid" });
      }

      const { customerUpdates, quoteUpdates, items } = z.object({
        customerUpdates: z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          phone: z.string().optional(),
          companyName: z.string().optional(),
        }).optional(),
        quoteUpdates: z.object({
          serviceAddress: z.string().optional(),
          pickupAddress: z.string().optional(),
          dropoffAddress: z.string().optional(),
          transportFee: z.string().optional(),
          selectedServices: z.string().optional(),
          notes: z.string().optional(),
        }).optional(),
        items: z.array(z.object({
          catalogItemId: z.number().optional(),
          originalDescription: z.string(),
          detectedName: z.string().optional(),
          serviceType: z.string(),
          quantity: z.number().min(1),
          unitPrice: z.string(),
          subtotal: z.string(),
        })).optional(),
      }).parse(req.body);

      const updated = await storage.editQuote(id, { customerUpdates, quoteUpdates, items });
      if (!updated) return res.status(404).json({ message: "Quote not found" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Admin: Request final payment
  app.post("/api/quotes/:id/request-final-payment", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quote = await storage.getQuote(id);
      
      if (!quote || !quote.customer) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const finalAmount = parseFloat(quote.finalAmount || "0") || parseFloat(quote.total);
      const quotePageUrl = `${APP_URL}/quotes/${quote.id}`;
      const stripeUrl = await createStripePaymentLink(
        `Final Payment for ${quote.referenceNo} — TMG Install`,
        finalAmount,
        { quoteId: String(quote.id), type: "final", referenceNo: quote.referenceNo },
        quotePageUrl
      );
      const paymentLink = stripeUrl || quotePageUrl;
      
      const emailHtml = finalPaymentEmail(quote, paymentLink);
      const emailSent = await sendEmail({
        to: quote.customer.email,
        subject: `[${quote.referenceNo}] Final Payment Due — TMG Install`,
        html: emailHtml,
      });

      const updated = await storage.updateQuoteStatus(id, "final_payment_requested", {
        actorType: "admin",
        note: "Final payment request sent to customer"
      });

      res.json({ success: emailSent, quote: updated });
    } catch (err) {
      console.error("Error requesting final payment:", err);
      res.status(500).json({ message: "Failed to request final payment" });
    }
  });

  // Admin: Manual close
  app.post("/api/quotes/:id/close", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
      const quote = await storage.updateQuoteStatus(id, 'closed', {
        actorType: 'admin',
        note: reason || 'Case manually closed by admin'
      });
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      res.json(quote);
    } catch (err) {
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
              .map((item: any) => ({
                name: item.name.trim(),
                quantity: Math.max(1, Math.min(50, Number(item.quantity) || 1)),
              }));
          }
        } catch (parseErr) {
          console.error("[detect-items] JSON parse failed:", parseErr, "raw:", content);
          detected = [];
        }
      }

      console.log("[detect-items] detected items:", detected);
      res.json({ detected });
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
      const promoDiscountAmt = input.promoDiscount || 0;

      // Minimum charge is based on labor+transport WITHOUT promo discount
      const rawTotal = laborSubtotal - discount + logisticsFee;

      // ── Minimum charge: SGD 180 ──────────────────────────────────────────────
      const MIN_CHARGE = 180;
      const minAdjustment = rawTotal < MIN_CHARGE ? MIN_CHARGE - rawTotal : 0;
      // Promo code can override the $180 minimum — applied AFTER minimum is enforced
      const grandTotal = Math.max(0, rawTotal + minAdjustment - promoDiscountAmt);
      // ────────────────────────────────────────────────────────────────────────

      const depositAmount = (grandTotal * 0.50).toFixed(2);
      const finalAmount = (grandTotal * 0.50).toFixed(2);
      const referenceNo = `TMG-${Date.now().toString(36).toUpperCase()}`;

      // Hold expiry: 48 hours from submission
      const slotHeldUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const allItems = [
        ...input.items.map(item => ({
          catalogItemId: item.catalogItemId,
          originalDescription: item.itemName,
          detectedName: item.itemName,
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
        // Minimum charge adjustment — only added when job total is below SGD 180
        ...(minAdjustment > 0 ? [{
          catalogItemId: undefined as number | undefined,
          originalDescription: "Minimum Charge Adjustment",
          detectedName: "Minimum Charge Adjustment",
          serviceType: "adjustment",
          quantity: 1,
          unitPrice: minAdjustment.toFixed(2),
          subtotal: minAdjustment.toFixed(2),
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
          subtotal: laborSubtotal.toFixed(2),
          discount: discount.toFixed(2),
          transportFee: logisticsFee.toFixed(2),
          total: grandTotal.toFixed(2),
          depositAmount,
          finalAmount,
          status: "submitted",
          requiresManualReview: false,
          aiConfidenceScore: 100,
          distanceKm: input.distanceKm != null ? input.distanceKm.toFixed(1) : null,
          detectionPhotoUrl: input.detectedPhotoUrl || null,
          // Slot chosen in wizard
          preferredDate: input.preferredDate || null,
          preferredTimeWindow: input.preferredTimeWindow || null,
          slotHeldUntil: (input.preferredDate && input.preferredTimeWindow) ? slotHeldUntil : null,
          bookingRequestedAt: (input.preferredDate && input.preferredTimeWindow) ? new Date() : null,
          // Promo code applied
          promoCode: input.promoCode || null,
          promoDiscount: promoDiscountAmt > 0 ? promoDiscountAmt.toFixed(2) : "0",
        },
        allItems
      );

      // Decrement promo code usage count if one was applied
      if (input.promoCode?.trim()) {
        try {
          const promoRows = await db.select().from(promoCodes)
            .where(eq(promoCodes.code, input.promoCode.trim().toUpperCase())).limit(1);
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

  // ── WhatsApp Incoming Message Handler (POST) ──────────────────────────────
  app.post("/api/webhooks/whatsapp", async (req, res) => {
    res.status(200).json({ status: "ok" }); // Always ack quickly

    try {
      const body = req.body;
      if (body.object !== "whatsapp_business_account") return;

      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      if (!value?.messages?.length) return;

      const msg = value.messages[0];
      const from: string = msg.from; // sender phone e.g. "6591234567"

      // ── Mark as read immediately — shows double blue ticks to customer ────────
      markAsRead(msg.id).catch(() => {});

      // ── Log inbound message for admin conversations view ─────────────────────
      const inboundText = (msg.text?.body || msg.image?.caption || "").trim();
      storage.logWhatsAppMessage({
        phone: from,
        direction: 'inbound',
        body: inboundText || (msg.type === 'image' ? '[Photo]' : '[Message]'),
        mediaType: msg.type === 'image' ? 'image' : undefined,
        mediaUrl: msg.type === 'image' && msg.image?.id ? msg.image.id : undefined,
        wamid: msg.id,
      }).catch(() => {});

      const msgType: string = msg.type || "text";
      // Include image/video captions in text so pricing questions sent with a photo
      // are processed the same as plain text messages (caption = msg.image.caption)
      const text: string = (msg.text?.body || msg.image?.caption || "").trim();
      const textLower = text.toLowerCase();

      const session = await storage.getWhatsAppSession(from);
      const state = session?.state ?? "start";

      // ── Admin takeover guard: if bot is paused for this number, do not respond ─
      if (session?.botPaused) {
        console.log(`[WhatsApp] Bot paused for ${from} — admin is handling this conversation`);
        return;
      }

      // ── Escalation detection: anger / frustration / explicit human request ────
      // Runs before any state processing so the customer is never left stranded.
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
            `👋 Welcome back, *${session.collectedName || "there"}*! Great to hear from you again 😊\n\nYou have a quote in progress. What would you like to do?\n\n• Type *continue* — pick up where you left off\n• Type *restart* — start a fresh new quote`
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
          });
          // Scan the photo and offer pricing, or ask the customer to name the item
          let scannedItem0: string | null = null;
          try {
            if (msg.image?.id) {
              const scanMedia0 = await downloadWhatsAppMedia(msg.image.id);
              if (scanMedia0) {
                const scanRes0 = await openai.chat.completions.create({
                  model: "gpt-4o", max_tokens: 60,
                  messages: [
                    { role: "system", content: `Identify the main furniture item in this photo. Return ONLY the item name (e.g. "wardrobe", "queen bed frame", "chest of drawers"). If no furniture, return "NONE".\n${FURNITURE_VISION_GUIDE}` },
                    { role: "user", content: [{ type: "image_url", image_url: { url: `data:${scanMedia0.mimeType};base64,${scanMedia0.base64}`, detail: "high" } }] as any },
                  ],
                });
                const d0 = (scanRes0.choices[0]?.message?.content || "").trim();
                if (d0 && d0 !== "NONE") scannedItem0 = d0;
              }
            }
          } catch { /* token expired or network error */ }

          if (scannedItem0) {
            const priceMsg0 = await smartPricingLookup(scannedItem0);
            if (priceMsg0) {
              const r0 = `${priceMsg0}\n\nWould you like a full personalised quote? What's your *full name*? 😊`;
              await sendBotMessage(from, r0);
              saveHistory(from, [], `[photo: ${scannedItem0}]`, r0);
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

        if (text.length > 15 && !isGreeting) {
          try {
            const extractRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 300,
              response_format: { type: "json_object" },
              messages: [{
                role: "system",
                content: `A customer just sent their first WhatsApp message to TMG Install, a furniture installation company in Singapore.
Extract any details they provided. Return JSON:
{
  "name": string or null,
  "address": string or null,
  "items": string or null
}
- name: their personal name (not company name). Null if not clearly stated.
- address: full Singapore address/location. Null if not stated. Accept postal codes (S123456).
- items: formatted bullet list of furniture items mentioned (one • per line with service type in brackets if stated). Null if no furniture mentioned.

Message: "${text}"`
              }]
            });
            const extracted = JSON.parse(extractRes.choices[0]?.message?.content || "{}");
            extractedName = extracted.name || null;
            extractedAddress = extracted.address || null;
            extractedItems = extracted.items || null;
          } catch {}
        }

        // Determine where to start based on what we extracted.
        // If customer gives name + address (power user), skip the pricing check — they're ready to book.
        // Otherwise show pricing first so they can confirm before we collect their details.
        const startState = extractedAddress && extractedName && extractedItems
          ? "awaiting_items_verify"
          : extractedAddress && extractedName
            ? "awaiting_items"
            : extractedAddress
              ? "awaiting_name"  // unusual but possible
              : "pricing_shown"; // simple greeting or name-only → show pricing first

        await storage.upsertWhatsAppSession(from, {
          state: startState,
          collectedName: extractedName,
          collectedAddress: extractedAddress,
          collectedItems: extractedItems,
          previousItems: null,
          preferredDate: null,
          preferredDateIso: null,
          preferredTimeWindow: null,
          isRelocation: false,
          collectedToAddress: null,
          distanceKm: null,
        });

        // ── Pricing overview message — shown to every new contact ──────────────
        const PRICING_OVERVIEW =
          `💰 *Our Pricing (Singapore):*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🔧 *Installation* (flat-pack / assembly): from *$80/item*\n` +
          `🔨 *Dismantling*: from *$60/item*\n` +
          `🗑️ *Disposal* (haul away): from *$80/item*\n` +
          `🔨🗑️ *Dismantle + Dispose* bundle: best value!\n` +
          `🚚 *Relocation* (dismantle + move + reinstall, all-in): from *$180*\n\n` +
          `_All prices per item. Min. job $180. Floor surcharge & transport may apply. No GST._\n\n` +
          `📸 *Want the exact price for your item?* Type the name or send a photo and I'll look it up!\n\n` +
          `Happy with our pricing? Reply *Yes* and I'll prepare a personalised quote in 2 minutes 😊`;

        if (extractedName && extractedAddress && extractedItems) {
          await sendBotMessage(from,
            `👋 Hi *${extractedName}*! Got it — let me confirm what you've told me:\n\n` +
            `📍 *Address:* ${extractedAddress}\n` +
            `🛋️ *Items:*\n${extractedItems}\n\n` +
            `Does this look right?\n• Reply *YES* to proceed\n• Tell me what to correct\n• Send a photo to add more items`
          );
        } else if (extractedAddress && extractedName) {
          await sendBotMessage(from,
            `👋 Hi *${extractedName}*! I've noted your address: *${extractedAddress}*.\n\n` +
            `What furniture do you need help with?\n\n📸 *Send a photo* and I'll identify everything, or *type the list* below.\n\n` +
            `_e.g. 1 queen bed frame (install), 3-door wardrobe (dismantle)_`
          );
        } else if (extractedName) {
          // Got name but no address — show pricing first addressed to them
          await sendBotMessage(from,
            `👋 Hi *${extractedName}*! Thanks for reaching out to *TMG Install* — we're *The Moving Guy Pte Ltd* 🏠\n\n` +
            `We handle furniture installation, dismantling, relocation & disposal all across Singapore.\n\n` +
            PRICING_OVERVIEW
          );
        } else {
          // Simple greeting — show pricing overview
          await sendBotMessage(from,
            `👋 Hi there! Thanks for reaching out to *TMG Install* — we're *The Moving Guy Pte Ltd* 🏠\n\n` +
            `We handle:\n• 🔧 Furniture *installation* & assembly\n• 🔨 *Dismantling* & removal\n• 🚚 *Relocation* (home or office)\n• 🗑️ *Disposal*\n\n` +
            `All across Singapore — no calls needed, upfront pricing.\n\n` +
            PRICING_OVERVIEW
          );
        }
        return;
      }

      if (textLower === "continue" && session) {
        const stateLabel: Record<string, string> = {
          pricing_shown: "review our pricing — reply Yes when ready",
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
- pricing: asking about price/cost for a specific or general furniture item or service
- faq: general question about TMG Install (timing, payment, areas, GST, tools, etc.) NOT about item pricing
- progress: customer asks what info has been collected so far ("what have you got?", "what do you have?", "summary so far", "what did I give you?", "what have we done?")
- escalate: customer explicitly asks for a human/agent/staff/manager ("talk to human", "real person", "agent please", "need staff")
- farewell: customer says goodbye, thank you, will update later, ok thanks, coming back later, talk later, or any variation of a polite exit — even mid-flow
- none: a direct answer to the current question — DO NOT override a direct reply

CRITICAL — Do NOT classify as command if customer is directly answering the current question:
- state=awaiting_floor → floor numbers, lift/no-lift answers → none
- state=awaiting_access → 1/2/3, easy/moderate/hard → none
- state=awaiting_date → dates, times, "anytime", "flexible" → none
- state=awaiting_items → furniture names or descriptions → none
- state=awaiting_to_address → addresses → none
- state=awaiting_remarks → any text (notes, email, "none", "skip") → none

FAQ ANSWER STYLE — answer briefly and directly, then stop. Examples:
- "Yes, we do dismantling and reassembly. Which item do you need help with?"
- "We cover all of Singapore — HDB, condo, landed, and commercial."
- "No GST — all our prices are nett."
- "50% deposit to confirm, balance on the day of job."
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
              await sendBotMessage(from, `Sure! What's the correct name? 😊`);
              return;
            } else if (gc.command === "change_address" && !["awaiting_address", "awaiting_to_address"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_address" });
              await sendBotMessage(from, `No problem! What's the correct job address? 📍`);
              return;
            } else if (gc.command === "change_items" && !["awaiting_items", "awaiting_items_verify", "awaiting_confirmation"].includes(state)) {
              // Note: awaiting_confirmation excluded — its own handler handles targeted add/remove/edit with GPT delta logic
              await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedItems: null, previousItems: session.collectedItems });
              await sendBotMessage(from, `Sure! What items do you need help with?\n\n📸 *Send a photo* or *type the list* below.\n\n_e.g._\n• 1 king bed frame (install)\n• 3-door wardrobe (dismantle)`);
              return;
            } else if (gc.command === "change_date" && !["awaiting_date"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_date" });
              const { message: dateMenu } = await buildDateMenuMessage();
              await sendBotMessage(from, `No problem! Let's update that. 😊\n\n${dateMenu}`);
              return;
            } else if (gc.command === "change_floor" && !["awaiting_floor"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_floor" });
              await sendBotMessage(from, `Sure! Which floor is the unit on?\n\n_e.g. reply *1* for ground floor, *3* for third floor_\n\nAnd is there a *lift*? (yes / no)`);
              return;
            } else if (gc.command === "change_access" && !["awaiting_access"].includes(state)) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_access" });
              await sendBotMessage(from, `Got it! How easy is access to the unit?\n\n1️⃣ *Easy* — clear hallways, no obstacles\n2️⃣ *Moderate* — some tight corners or minor obstacles\n3️⃣ *Difficult* — very narrow, many obstacles or stairs without lift\n\nReply *1*, *2*, or *3*`);
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
                pricing_shown: `Happy with our pricing? Reply *Yes* to start your personalised quote 😊`,
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

              // If customer sent a photo with "how much this cost?", scan it to identify the item
              let resolvedPricingItem = pricingItem;
              if (!resolvedPricingItem && msgType === "image" && msg.image?.id) {
                try {
                  const pricingMedia = await downloadWhatsAppMedia(msg.image.id);
                  if (pricingMedia) {
                    const visionRes = await openai.chat.completions.create({
                      model: "gpt-4o",
                      max_tokens: 200,
                      response_format: { type: "json_object" },
                      messages: [{
                        role: "system",
                        content: `You are an expert at identifying furniture for a Singapore installation company.
Look at the photo and identify ALL items that require professional installation, dismantling, relocation, or disposal.
Include residential furniture AND commercial/office items.
Return JSON: { "mainItem": "short name of primary item", "allItems": "comma-separated list", "noItems": true/false }
${FURNITURE_VISION_GUIDE}`,
                      }, {
                        role: "user",
                        content: [
                          { type: "image_url", image_url: { url: `data:${pricingMedia.mimeType};base64,${pricingMedia.base64}`, detail: "high" } },
                        ] as any,
                      }],
                    });
                    const scannedGlobal = JSON.parse(visionRes.choices[0]?.message?.content || "{}");
                    if (!scannedGlobal.noItems && scannedGlobal.mainItem) resolvedPricingItem = scannedGlobal.mainItem;
                  }
                } catch { /* ignore scan errors */ }
              }

              if (resolvedPricingItem) {
                // We know the item (from text or photo). If we also know the service from caption,
                // acknowledge both and show price (or custom-job note) then continue the flow.
                if (serviceLabel) {
                  const priceMsg = await smartPricingLookup(resolvedPricingItem);
                  const priceBlock = priceMsg
                    ? `${priceMsg}\n`
                    : `Our team will confirm the exact price for this job.\n`;
                  await sendBotMessage(from,
                    `Got it — *${serviceLabel}* for a *${resolvedPricingItem}*. 📸\n\n${priceBlock}\n${continuePrompt}`
                  );
                } else {
                  // No specific service — show all service type prices
                  const priceMsg = await smartPricingLookup(resolvedPricingItem);
                  await sendBotMessage(from, priceMsg
                    ? `${priceMsg}\n\n${continuePrompt}`
                    : `Our team will confirm the exact price for the *${resolvedPricingItem}*.\n\n${continuePrompt}`
                  );
                }
                return;
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
                  `Sure, I can check that for you! 😊\n\nWhat item would you like a price for? And what service do you need?\n\n` +
                  `_e.g. "IKEA PAX wardrobe — dismantling" or "queen bed frame — relocation"_`
                );
              }
              return;
            } else if (gc.command === "faq" && gc.faqAnswer) {
              // Answer the question and prompt to continue the flow
              const statePrompt: Record<string, string> = {
                pricing_shown: `Happy with our pricing? Reply *Yes* to start your personalised quote 😊`,
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
              const resumeStepHint: Record<string, string> = {
                pricing_shown: "Just reply *Yes* whenever you're happy with our pricing and we'll get started!",
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
                awaiting_confirmation: "Your quote is almost ready — just tap *YES* to confirm when you're back!",
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

      // ── pricing_shown: customer reviewing pricing before starting booking flow ──
      if (state === "pricing_shown") {
        const nameAlready = session?.collectedName;

        // If they sent a photo — scan it and show specific pricing
        if (msgType === "image" && msg.image?.id) {
          // Detect service type from caption so we don't ask for it again if scan fails
          const captionLower = text.toLowerCase();
          let captionService: string | null = null;
          if (/dismantle.*reloc|reloc.*dismantle|move.*dismantle|shift.*dismantle/.test(captionLower)) captionService = "relocation + dismantling";
          else if (/relocat|move|shift|transfer/.test(captionLower)) captionService = "relocation";
          else if (/dismantle|dismant|take apart|remove/.test(captionLower)) captionService = "dismantling";
          else if (/dispos|haul|throw|throw away/.test(captionLower)) captionService = "disposal";
          else if (/install|assembly|assemble|set up|put up/.test(captionLower)) captionService = "installation";

          let photoScanItem: string | null = null;
          try {
            const pMedia = await downloadWhatsAppMedia(msg.image.id);
            if (pMedia) {
              const vRes = await openai.chat.completions.create({
                model: "gpt-4o", max_tokens: 80,
                messages: [
                  { role: "system", content: `Identify the main furniture item in this photo. Return ONLY the item name (e.g. "IKEA PAX wardrobe", "queen bed frame", "chest of drawers"). If no furniture, return "NONE".\n${FURNITURE_VISION_GUIDE}` },
                  { role: "user", content: [{ type: "image_url", image_url: { url: `data:${pMedia.mimeType};base64,${pMedia.base64}`, detail: "high" } }] as any },
                ],
              });
              const detectedItem = (vRes.choices[0]?.message?.content || "").trim();
              if (detectedItem && detectedItem !== "NONE") photoScanItem = detectedItem;
            }
          } catch { /* fall through */ }

          if (photoScanItem && captionService) {
            // We know BOTH the item (from photo) AND the service (from caption).
            // Skip the price overview — confirm item+service and start the quote immediately.
            const serviceActionMap: Record<string, string> = {
              "relocation + dismantling": "dismantle and relocate",
              "relocation": "relocate",
              "dismantling": "dismantle",
              "disposal": "dispose of",
              "installation": "install",
            };
            const serviceAction = serviceActionMap[captionService] || captionService;

            // Store detected item with a "photo_detected" flag in previousItems so the
            // awaiting_address handler routes to awaiting_items_verify (not awaiting_confirmation)
            const prefilledItems = `• 1 ${photoScanItem} (${captionService})`;

            if (nameAlready) {
              // Name known — skip to address
              await storage.upsertWhatsAppSession(from, {
                state: "awaiting_address",
                collectedItems: prefilledItems,
                previousItems: "photo_detected",
                isRelocation: captionService.includes("reloc"),
              });
              await sendBotMessage(from,
                `📸 I can see a *${photoScanItem}* in your photo — noted for *${captionService}*.\n\n` +
                `To give you an accurate quote, I just need a few more details.\n\n` +
                `📍 What's the *full job address*?\n\n` +
                `_e.g. Blk 261 Serangoon Central #05-01, S550261_`
              );
            } else {
              // No name yet — save detected item + service and go to name
              await storage.upsertWhatsAppSession(from, {
                state: "awaiting_name",
                collectedItems: prefilledItems,
                previousItems: "photo_detected",
                isRelocation: captionService.includes("reloc"),
              });
              await sendBotMessage(from,
                `📸 I can see a *${photoScanItem}* in your photo — we can *${serviceAction}* that for you.\n\n` +
                `To prepare an accurate quote, may I start with your *full name*? 😊`
              );
            }
            return;
          }

          if (photoScanItem) {
            // Item detected but no service type in caption — show full price table
            const priceMsg = await smartPricingLookup(photoScanItem);
            const followUp = nameAlready
              ? `Ready to book, *${nameAlready}*? Reply *Yes* to start your personalised quote 😊`
              : `Happy with our pricing? Reply *Yes* to start your personalised quote 😊`;
            await sendBotMessage(from, priceMsg
              ? `${priceMsg}\n\n${followUp}`
              : `Our team will confirm the exact price for the *${photoScanItem}*.\n\n${followUp}`
            );
            return;
          }

          // Photo scan failed or no item detected — use caption context if available
          if (captionService) {
            await sendBotMessage(from,
              `Got it — *${captionService}*. 👍\n\nCouldn't identify the item from the photo — could you describe it?\n\n` +
              `_e.g. IKEA PAX wardrobe, queen bed frame, 3-seater sofa_`
            );
          } else {
            await sendBotMessage(from,
              `📸 Got your photo! I'll scan it for items once we start your quote.\n\n` +
              `Happy with our pricing? Reply *Yes* to get started 😊`
            );
          }
          return;
        }

        // Use GPT to classify the reply
        try {
          const pricingClassRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 200,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `A customer is chatting with TMG Install (furniture installation Singapore).
Classify their reply. Return JSON:
{
  "intent": "yes" | "item_price" | "decline" | "provide_name" | "other",
  "name": "extracted name if intent=provide_name, else null",
  "itemQuery": "item to look up pricing for if intent=item_price, else null"
}

INTENT RULES:
- yes: agrees, happy, ok, sure, let's go, proceed, book, quote, ready, sounds good, great, let me book, affordable — any positive confirmation. IMPORTANT: A bare personal name like "Kayden" or "John" is NOT a yes — it is a provide_name.
- item_price: asks about price/cost of a SPECIFIC item OR replies with a furniture item name when the bot just asked "which item is this for?" (e.g. "wardrobe", "bed frame", "PAX wardrobe", "sofa"). Also use item_price if the customer mentioned a service type (dismantle, relocate, install) with an item.
- decline: says too expensive, not interested, nevermind, maybe later — explicit negative  
- provide_name: customer provides a personal name. This includes BARE single-word names like "Kayden", "John", "Ahmad", "Wei" — no "I'm" or "My name is" phrasing required. The bot just asked "What's your full name?" so a 1–4 word reply that looks like a human name IS provide_name. Furniture items, service types, and greetings (hi/ok/yes/no) are NOT names.
- other: general question not covered above

IMPORTANT: If conversation history shows the bot recently asked "which item is this for?" or "what item would you like a price for?", and the customer replies with a furniture item name → classify as item_price.
CRITICAL: If the bot's last message asked "What's your full name?" and the customer replies with a short word or two that looks like a personal name (not a furniture item or service type), ALWAYS classify as provide_name — never as yes.`
              },
              ...historyMessages(conversationHistory, 4),
              { role: "user", content: text },
            ],
          });
          const pc = JSON.parse(pricingClassRes.choices[0]?.message?.content || "{}");

          if (pc.intent === "yes") {
            // Customer happy with pricing — proceed to booking flow
            if (nameAlready) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_address" });
              await sendBotMessage(from,
                `Great, *${nameAlready}*! 😊\n\n` +
                `📍 Where is the job? Drop the *full address* below — block/unit number helps too.\n\n` +
                `_e.g. Blk 261 Serangoon Central #05-01, S550261_`
              );
            } else {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_name" });
              await sendBotMessage(from, `What's your *full name*? 😊`);
            }
            return;
          }

          if (pc.intent === "item_price" && pc.itemQuery) {
            const priceMsg = await smartPricingLookup(pc.itemQuery);
            const followUp = nameAlready
              ? `Ready to book, *${nameAlready}*? Reply *Yes* to start your personalised quote 😊`
              : `Happy with our pricing? Reply *Yes* to start your personalised quote 😊`;
            await sendBotMessage(from, priceMsg
              ? `${priceMsg}\n\n${followUp}`
              : `I don't have an exact price for that item yet — our team will confirm it when they review your quote.\n\n${followUp}`
            );
            return;
          }

          if (pc.intent === "decline") {
            await sendBotMessage(from,
              `No worries at all! 😊 Prices are negotiable for larger jobs or repeat customers.\n\n` +
              `Feel free to message us anytime — we're happy to help when you're ready. 👍`
            );
            return;
          }

          if (pc.intent === "provide_name" && pc.name) {
            await storage.upsertWhatsAppSession(from, { state: "awaiting_address", collectedName: pc.name });
            await sendBotMessage(from,
              `Nice to meet you, *${pc.name}*! 😊\n\n` +
              `📍 What's the *full job address*? (That's where we'll be doing the work.)\n\n` +
              `_e.g. Blk 261 Serangoon Central #05-01, S550261_`
            );
            return;
          }
        } catch { /* fall through to generic prompt */ }

        // "other" intent or classification failed — answer any general question with company facts, then nudge CTA
        try {
          const faqRes = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 200,
            messages: [
              {
                role: "system",
                content:
                  `You are a WhatsApp assistant for TMG Install (The Moving Guy Pte Ltd), Singapore's furniture installation company.\n\n` +
                  `Answer the customer's question briefly and warmly (1–3 sentences) using these facts:\n` +
                  `- Services: installation, dismantling, relocation, disposal — all of Singapore (HDB, condo, landed, office)\n` +
                  `- Pricing: from $80/item, minimum job $180; relocation adds transport fee; no GST\n` +
                  `- Available weekdays & weekends (subject to availability)\n` +
                  `- All tools & equipment supplied — customer brings nothing\n` +
                  `- Payment: 50% deposit to confirm, 50% on completion — PayNow / bank transfer / card\n` +
                  `- Quotes reviewed by admin; booking confirmed after deposit paid\n\n` +
                  `If you can answer the question, do so then end with:\n` +
                  `"Happy with our pricing? Reply *Yes* and I'll prepare a personalised quote in minutes! 😊"\n\n` +
                  `If the message is just casual (greetings, "ok", "I see", etc.), respond warmly and say:\n` +
                  `"Happy with our pricing? Reply *Yes* to get your personalised quote! 😊"`,
              },
              ...historyMessages(conversationHistory, 3),
              { role: "user", content: text },
            ],
          });
          const faqAnswer = faqRes.choices[0]?.message?.content?.trim();
          if (faqAnswer) {
            await sendBotMessage(from, faqAnswer);
            return;
          }
        } catch { /* ignore */ }

        // Hard fallback
        await sendBotMessage(from,
          `Happy with our pricing? Reply *Yes* to start your personalised quote, or ask me about a specific item! 😊`
        );
        return;
      }

      if (state === "awaiting_name") {
        // If they send a photo with no (or very short) caption, proactively scan it for pricing
        if (msgType === "image" && text.length < 5) {
          let scannedItem: string | null = null;
          let scannedItemLabel: string | null = null;
          try {
            if (msg.image?.id) {
              const scanMedia = await downloadWhatsAppMedia(msg.image.id);
              if (scanMedia) {
                const scanRes = await openai.chat.completions.create({
                  model: "gpt-4o",
                  max_tokens: 200,
                  response_format: { type: "json_object" },
                  messages: [{
                    role: "system",
                    content: `You are an expert at identifying furniture for a Singapore installation company.
Look at the photo and identify ALL items that would require professional installation, dismantling, relocation, or disposal.
Include both residential furniture AND commercial/office items.
Return JSON: { "mainItem": "short name of primary item", "allItems": "comma-separated list", "noItems": true/false }
If no installable items found, set noItems: true.
${FURNITURE_VISION_GUIDE}`,
                  }, {
                    role: "user",
                    content: [{ type: "image_url", image_url: { url: `data:${scanMedia.mimeType};base64,${scanMedia.base64}`, detail: "high" } }] as any,
                  }],
                });
                const sc = JSON.parse(scanRes.choices[0]?.message?.content || "{}");
                if (!sc.noItems && sc.mainItem) {
                  scannedItem = sc.mainItem;
                  scannedItemLabel = sc.allItems || sc.mainItem;
                }
              }
            }
          } catch { /* ignore */ }

          if (scannedItem) {
            const priceMsg = await smartPricingLookup(scannedItem);
            if (priceMsg) {
              const reply = `${priceMsg}\n\nWould you like a full personalised quote? What's your *full name*? 😊`;
              await sendBotMessage(from, reply);
              saveHistory(from, conversationHistory, `[photo: ${scannedItem}]`, reply);
              return;
            }
            // Item detected but not in standard catalog — start custom quote flow
            const customReply0 =
              `📸 I can see *${scannedItemLabel}* in your photo!\n\n` +
              `This looks like a custom or commercial job. Our team will prepare a tailored quote for you. 😊\n\n` +
              `To get started, what's your *full name*?`;
            await sendBotMessage(from, customReply0);
            saveHistory(from, conversationHistory, "[photo]", customReply0);
            return;
          }
          // No installable furniture detected — ask them to name it (context-aware)
          const knownSvc = extractServiceFromHistory(conversationHistory);
          let askItem: string;
          if (isBotLooping(conversationHistory, "which item") || isBotLooping(conversationHistory, "what item is it")) {
            askItem = knownSvc
              ? `Please just type the *item name* — e.g. *wardrobe*, *bed frame*, *sofa* — and I'll get you the ${knownSvc} price right away! 😊`
              : `Please type the *item name and service* — e.g. *wardrobe installation* or *bed frame dismantling*. I'll get the price for you!`;
          } else if (knownSvc) {
            askItem = `I can see your photo! To look up the *${knownSvc}* price, I just need to know which item it is.\n\n_e.g. wardrobe, queen bed frame, sofa, dining table_`;
          } else {
            askItem = `Spotted a photo! 📸 What item is it, and what service do you need?\n\n_e.g. "3-door wardrobe — installation" or "queen bed frame — dismantling"_`;
          }
          await sendBotMessage(from, askItem);
          saveHistory(from, conversationHistory, "[photo]", askItem);
          return;
        }

        if (text.length < 2) {
          await sendBotMessage(from, `What's your *full name*? I just need something to address you by. 😊`);
          return;
        }

        // ── Fast-path heuristic: catch obvious names without GPT ────────────────
        // If the message is 1–4 words, all letters (+ common name chars), and NOT a
        // furniture item / service type / greeting → treat it as a name immediately.
        const NAME_BLOCKLIST = new Set([
          'yes','no','ok','okay','sure','hi','hello','hey','thanks','please','nope',
          'install','installation','dismantle','dismantling','relocate','relocation',
          'dispose','disposal','wardrobe','sofa','bed','table','chair','cabinet',
          'drawer','shelf','bookshelf','mattress','desk','couch','closet','cupboard',
          'fridge','refrigerator','washing','machine','tv','television',
        ]);
        const fastPathWords = text.trim().split(/\s+/);
        const looksLikeName =
          fastPathWords.length >= 1 &&
          fastPathWords.length <= 4 &&
          !text.includes('?') &&
          !text.includes('@') &&
          !/\d/.test(text) &&
          /^[a-zA-Z\s'\-\.]+$/.test(text) &&
          !NAME_BLOCKLIST.has(fastPathWords[0].toLowerCase()) &&
          !NAME_BLOCKLIST.has(text.toLowerCase());

        // Use GPT to extract name AND detect if the message is really a pricing question
        let extractedName: string | null = null;
        let nameExtractedAddress: string | null = null;
        let nameIsPricing = false;
        let nameMentionedItem: string | null = null;
        let nameMentionedService: string | null = null;

        if (looksLikeName) {
          // Capitalise each word and use directly — no GPT needed
          extractedName = fastPathWords
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
        } else {
          try {
            const nameRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 100,
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: `You are a WhatsApp assistant for TMG Install (Singapore furniture installation). The customer was asked for their full name. Analyse their message.
Return JSON:
{
  "name": string or null,
  "address": string or null,
  "isPricingQuestion": boolean,
  "mentionedItem": string or null,
  "mentionedService": "installation"|"dismantling"|"relocation"|"disposal"|null
}
Rules:
- name: Extract ANY personal name. ACCEPT single first names ("Kayden", "John", "Ahmad", "Wei Ling") — no "I'm" or "My name is" phrasing needed. REJECT only: yes/no/ok/sure, pricing questions, known furniture items (wardrobe/sofa/bed/table/cabinet/drawer/shelf/desk/couch), service types (installation/dismantling/relocation/disposal).
- address: Singapore address ONLY if it appears in the customer's CURRENT message. NEVER extract an address from previous conversation turns. If the current message is just a name with no address, return null.
- isPricingQuestion: true if they asked about cost/price/"how much" OR if the conversation history shows we asked for an item/service and they replied with a furniture item or service type
- mentionedItem: specific furniture item name if pricing-related — even without explicit "how much" (e.g. "wardrobe", "PAX wardrobe", "3-door wardrobe", "queen bed frame", "dining table", "sofa"). Set when message is a furniture item name.
- mentionedService: the service type if they specified one (installation/dismantling/relocation/disposal). Common patterns: "installation"→installation, "dismantle"→dismantling, "relocate"→relocation, "dispose"→disposal.

Key examples:
- Customer says "Kayden" → name="Kayden" (single first name is valid!)
- Customer says "John Tan" → name="John Tan"
- History: bot asked "what item would you like a price for?" → customer says "wardrobe" → mentionedItem="wardrobe", isPricingQuestion=true
- History: bot asked "Spotted a photo! What item is it and what service?" → customer says "Installation" → mentionedService="installation", isPricingQuestion=true, mentionedItem=null
- Customer says "wardrobe installation" → mentionedItem="wardrobe", mentionedService="installation", isPricingQuestion=true`,
                },
                ...historyMessages(conversationHistory, 4),
                { role: "user", content: text },
              ],
            });
            const parsed = JSON.parse(nameRes.choices[0]?.message?.content || "{}");
            extractedName = parsed.name || null;
            nameExtractedAddress = parsed.address || null;
            nameIsPricing = !!parsed.isPricingQuestion;
            nameMentionedItem = parsed.mentionedItem || null;
            nameMentionedService = parsed.mentionedService || null;
          } catch {}
        }

        // ── Not a name: handle pricing question or re-ask ──────────────────
        if (!extractedName) {
          // Service-only reply (e.g. "Installation" or photo + "how much for this installation")
          // Try to get the item(s) from the photo first, THEN ask if still missing
          if (nameIsPricing && nameMentionedService && !nameMentionedItem) {
            let itemFromPhoto: string | null = null;
            let detectedItemLabel: string | null = null;
            if (msgType === "image" && msg.image?.id) {
              try {
                const svcMedia = await downloadWhatsAppMedia(msg.image.id);
                if (svcMedia) {
                  const svcScan = await openai.chat.completions.create({
                    model: "gpt-4o", max_tokens: 200,
                    response_format: { type: "json_object" },
                    messages: [
                      {
                        role: "system",
                        content: `You are an expert at identifying furniture for a Singapore installation company.
Look at the photo and identify ALL items that would require professional installation, dismantling, relocation, or disposal.
Include both residential furniture AND commercial/office items.
Return JSON:
{
  "mainItem": "short name of the primary/most prominent item (e.g. 'chest of drawers', 'wardrobe', 'office workstation')",
  "allItems": "comma-separated list of all detected items",
  "isCommercial": true/false,
  "noItems": true/false
}
If no installable items found, set noItems: true.
${FURNITURE_VISION_GUIDE}`,
                      },
                      { role: "user", content: [{ type: "image_url", image_url: { url: `data:${svcMedia.mimeType};base64,${svcMedia.base64}`, detail: "high" } }] as any },
                    ],
                  });
                  const scanned = JSON.parse(svcScan.choices[0]?.message?.content || "{}");
                  if (!scanned.noItems && scanned.mainItem) {
                    itemFromPhoto = scanned.mainItem;
                    detectedItemLabel = scanned.allItems || scanned.mainItem;
                  }
                }
              } catch { /* token expired or network error */ }
            }
            if (itemFromPhoto) {
              // We have both item (from photo) and service — look up price
              const priceMsg = await smartPricingLookup(`${itemFromPhoto} ${nameMentionedService}`);
              if (priceMsg) {
                const reply = `${priceMsg}\n\nWould you like a full personalised quote? What's your *full name*? 😊`;
                await sendBotMessage(from, reply);
                saveHistory(from, conversationHistory, text, reply);
                return;
              }
              // Item detected but not in standard catalog — start custom quote flow
              await storage.upsertWhatsAppSession(from, { state: "awaiting_name" });
              const customReply =
                `📸 I can see *${detectedItemLabel}* in your photo — ${nameMentionedService} noted!\n\n` +
                `This looks like a custom or commercial job. Our team will prepare a tailored quote for you. 😊\n\n` +
                `To get started, what's your *full name*?`;
              await sendBotMessage(from, customReply);
              saveHistory(from, conversationHistory, text, customReply);
              return;
            }
            // No item detected in photo — ask for it, with loop detection
            const svcLabel: Record<string, string> = {
              installation: "installed", dismantling: "dismantled",
              relocation: "relocated", disposal: "disposed of",
            };
            const verb = svcLabel[nameMentionedService!] || nameMentionedService;
            let askForItem: string;
            if (isBotLooping(conversationHistory, "which item") || isBotLooping(conversationHistory, "what item")) {
              askForItem = `Just type the *item name* and I'll get the ${nameMentionedService} price instantly!\n\ne.g. *wardrobe*, *bed frame*, *sofa*, *dining table*`;
            } else {
              askForItem =
                `Got it — *${nameMentionedService}*! 🛠️\n\n` +
                `Which *item* would you like ${verb}?\n\n` +
                `_e.g. wardrobe, queen bed frame, dining table, sofa_`;
            }
            await sendBotMessage(from, askForItem);
            saveHistory(from, conversationHistory, text, askForItem);
            return;
          }

          if (nameIsPricing) {
            // If caption had no item name but a photo was sent, scan the photo
            let itemForLookup = nameMentionedItem;
            let detectedItemLabel2: string | null = null;
            if (!itemForLookup && msgType === "image" && msg.image?.id) {
              try {
                const pricingMedia2 = await downloadWhatsAppMedia(msg.image.id);
                if (pricingMedia2) {
                  const visionRes2 = await openai.chat.completions.create({
                    model: "gpt-4o",
                    max_tokens: 200,
                    response_format: { type: "json_object" },
                    messages: [{
                      role: "system",
                      content: `You are an expert at identifying furniture for a Singapore installation company.
Look at the photo and identify ALL items that would require professional installation, dismantling, relocation, or disposal.
Include both residential furniture AND commercial/office items.
Return JSON:
{
  "mainItem": "short name of the primary/most prominent item (e.g. 'chest of drawers', 'wardrobe', 'queen bed frame')",
  "allItems": "comma-separated list of all detected items",
  "noItems": true/false
}
If no installable items found, set noItems: true.
${FURNITURE_VISION_GUIDE}`,
                    }, {
                      role: "user",
                      content: [
                        { type: "image_url", image_url: { url: `data:${pricingMedia2.mimeType};base64,${pricingMedia2.base64}`, detail: "high" } },
                      ] as any,
                    }],
                  });
                  const scanned2 = JSON.parse(visionRes2.choices[0]?.message?.content || "{}");
                  if (!scanned2.noItems && scanned2.mainItem) {
                    itemForLookup = scanned2.mainItem;
                    detectedItemLabel2 = scanned2.allItems || scanned2.mainItem;
                  }
                }
              } catch { /* ignore */ }
            }
            if (itemForLookup) {
              const priceMsg = await smartPricingLookup(itemForLookup);
              if (priceMsg) {
                const replyPrice =
                  `${priceMsg}\n\n` +
                  `Would you like a full personalised quote? To get started, what's your *full name*? 😊`;
                await sendBotMessage(from, replyPrice);
                saveHistory(from, conversationHistory, text, replyPrice);
                return;
              }
              // Item detected but not in standard catalog — start custom quote flow
              const customLabel = detectedItemLabel2 || nameMentionedItem || itemForLookup;
              const knownSvc2 = extractServiceFromHistory(conversationHistory);
              const svcNote2 = knownSvc2 ? ` — *${knownSvc2}* noted` : "";
              await storage.upsertWhatsAppSession(from, { state: "awaiting_name" });
              const customReply2 =
                `📸 I can see *${customLabel}* in your photo${svcNote2}!\n\n` +
                `This looks like a custom or commercial job. Our team will prepare a tailored quote for you. 😊\n\n` +
                `To get started, what's your *full name*?`;
              await sendBotMessage(from, customReply2);
              saveHistory(from, conversationHistory, text, customReply2);
              return;
            }
            // No item found — ask them to specify (context-aware to avoid repetition)
            const knownSvcPricing = extractServiceFromHistory(conversationHistory);
            let askItemMsg: string;
            if (isBotLooping(conversationHistory, "what item") || isBotLooping(conversationHistory, "which item") || isBotLooping(conversationHistory, "price for")) {
              askItemMsg = knownSvcPricing
                ? `Just type the *item name* — e.g. *wardrobe*, *bed frame*, *sofa* — and I'll get you that ${knownSvcPricing} price! 😊`
                : `Just type the *item name and service* — e.g. *wardrobe installation* or *bed frame dismantling* — and I'll get the price for you!`;
            } else if (knownSvcPricing) {
              askItemMsg = `Sure! Which *item* would you like a ${knownSvcPricing} price for?\n\n_e.g. wardrobe, queen bed frame, sofa, dining table_`;
            } else {
              askItemMsg =
                `Sure, I can check that for you! 😊\n\nWhat item would you like a price for? And what service do you need?\n\n` +
                `_e.g. "IKEA PAX wardrobe — installation" or "queen bed frame — dismantling"_`;
            }
            await sendBotMessage(from, askItemMsg);
            saveHistory(from, conversationHistory, text, askItemMsg);
            return;
          }
          // Could not extract a name — give a warm, specific re-prompt
          await sendBotMessage(from,
            `Just your name to get started! 😊\n\n_e.g. "John", "Mary Tan", "Ahmad"_`
          );
          return;
        }

        // ── Valid name — proceed through the quote flow ────────────────────
        if (nameExtractedAddress) {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedName: extractedName, collectedAddress: nameExtractedAddress });
          const replyNameAddr =
            `✅ Thanks, *${extractedName}*! Address noted: *${nameExtractedAddress}*\n\n` +
            `What furniture do you need help with?\n\n` +
            `📸 *Send a photo* and I'll detect the items — or *type the list* below.\n\n` +
            `_e.g. 1 queen bed frame (install), 3-door wardrobe (dismantle)_`;
          await sendBotMessage(from, replyNameAddr);
          saveHistory(from, conversationHistory, text, replyNameAddr);
          return;
        }

        const alreadyHasAddress = !!session?.collectedAddress;
        const alreadyHasItemsToo = !!(session?.collectedItems && session.collectedItems !== "__scanning__");
        await storage.upsertWhatsAppSession(from, { collectedName: extractedName });

        let replyName: string;
        if (alreadyHasItemsToo) {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_confirmation" });
          replyName =
            `✅ Got it, *${extractedName}*! Here's your updated summary:\n\n` +
            `👤 *Name:* ${extractedName}\n` +
            `📍 *Address:* ${session!.collectedAddress}\n` +
            `🛋️ *Items:*\n${session!.collectedItems}\n\n` +
            `Reply *YES* to confirm and send to our team. 😊`;
        } else if (alreadyHasAddress) {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_items" });
          replyName =
            `Thanks, *${extractedName}*! 😊\n\n` +
            `What furniture do you need help with?\n\n` +
            `📸 *Send a photo* and I'll detect the items — or *type the list* below.\n\n` +
            `_e.g. 1 queen bed frame (install), 3-door wardrobe (dismantle)_`;
        } else {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_address" });
          replyName =
            `Thanks, *${extractedName}*! 😊\n\n` +
            `📍 Where is the job? Drop the *full address* below — block/unit number helps too.\n\n` +
            `_e.g. Blk 261 Serangoon Central #05-01, S550261_`;
        }
        await sendBotMessage(from, replyName);
        saveHistory(from, conversationHistory, text, replyName);
        return;
      }

      if (state === "awaiting_address") {
        // ── Guard: photo sent instead of address ───────────────────────────────
        // Customer sometimes re-sends a furniture photo (e.g. "Installation") when
        // they're still being asked for their address. Catch this early so we don't
        // try to parse "Installation" / "Dismantle" etc. as a Singapore address.
        const SERVICE_TYPE_PATTERN = /^(install(ation)?|dismantle?|dismantling|relocat(e|ion)|dispos(e|al)|dismantle\s*\+?\s*dispos(e|al))$/i;
        if (msgType === "image" && msg.image?.id && (text.length === 0 || SERVICE_TYPE_PATTERN.test(text.trim()))) {
          await sendBotMessage(from,
            `📸 Got your photo — I'll scan it for the furniture list once I have the address!\n\n` +
            `📍 Could you drop the *job address* first?\n\n` +
            `_e.g. Blk 261 Serangoon Central #05-01, S550261_`
          );
          return;
        }
        if (text.length < 4) {
          await sendBotMessage(from, `Could you give me the *full address*? Include the block/unit number if applicable. 📍`);
          return;
        }
        // Use GPT to extract and clean the Singapore address
        let extractedAddress = text;
        try {
          const addrRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 100,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `You are a WhatsApp assistant for TMG Install (Singapore). The customer was asked for their job address. Extract and clean it.
Return JSON: { "address": string or null, "valid": boolean }

Rules:
- address: cleaned, properly capitalised Singapore address
- valid: true for ANY recognisable Singapore location — this includes:
  • Block/street addresses: "Blk 261 Serangoon Central #05-01"
  • Postal codes: "S550261"
  • Named buildings: "The Seletar Mall", "NEX Serangoon", "Vivocity", "Ion Orchard", "Tampines Mall", "Bedok Mall", "Jurong Point", "Causeway Point", "Northpoint City", "Waterway Point", "Paya Lebar Quarter", "Marina Square", any HDB estate name, condo name, building name
  • Area names with context: "Tampines Ave 1", "Bishan St 22", "Yishun Ring Road"
  • Hotels, hospitals, schools, offices, industrial buildings
- valid: false ONLY for genuinely unidentifiable input — e.g. just "Singapore", "here", "my house", or random non-location text
- When in doubt, set valid: true and preserve the address as given — it's better to accept than to reject`,
              },
              ...historyMessages(conversationHistory, 4),
              { role: "user", content: text },
            ],
          });
          const parsed = JSON.parse(addrRes.choices[0]?.message?.content || "{}");
          if (parsed.address) extractedAddress = parsed.address;
          if (parsed.valid === false) {
            await sendBotMessage(from,
              `I need a bit more detail — could you include the *block number, street*, or *postal code*? 📍\n\n_e.g. Blk 261 Serangoon Central #05-01, S550261_`
            );
            return;
          }
        } catch {}

        const alreadyHasItems = session?.collectedItems && session.collectedItems !== "__scanning__";
        const isPhotoDetectedItems = session?.previousItems === "photo_detected";
        let replyAddr: string;
        if (alreadyHasItems && !isPhotoDetectedItems) {
          // Items were provided by the customer upfront — skip straight to confirmation
          await storage.upsertWhatsAppSession(from, { state: "awaiting_confirmation", collectedAddress: extractedAddress });
          replyAddr =
            `✅ Address updated to *${extractedAddress}*!\n\n` +
            `👤 *Name:* ${session.collectedName}\n` +
            `📍 *Address:* ${extractedAddress}\n` +
            `🛋️ *Items:*\n${session.collectedItems}\n\n` +
            `Ready to go? Reply *YES* to send to our team. 😊`;
        } else if (alreadyHasItems && isPhotoDetectedItems) {
          // Items were detected from a photo — confirm them before moving to floor/access
          await storage.upsertWhatsAppSession(from, {
            state: "awaiting_items_verify",
            collectedAddress: extractedAddress,
            previousItems: null, // clear the flag
          });
          replyAddr =
            `📍 *${extractedAddress}* — noted!\n\n` +
            `Here's what I've got so far:\n\n` +
            `🛋️ *Items:*\n${session.collectedItems}\n\n` +
            `Does this look right? Reply *YES* to confirm, or tell me what to change.`;
        } else {
          await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedAddress: extractedAddress });
          const nextPromptItems =
            `📍 *${extractedAddress}* — noted!\n\n` +
            `What furniture do you need help with?\n\n` +
            `📸 *Send a photo* and I'll detect the items automatically — or *type the list* below.\n\n` +
            `Mention the service too if you know it (install, dismantle, relocate, dispose).\n\n` +
            `_e.g._\n• 1 king bed frame (install)\n• 3-door PAX wardrobe (dismantle+dispose)\n• L-shaped sofa (disposal only)`;
          replyAddr = nextPromptItems;
        }
        await sendBotMessage(from, replyAddr);
        saveHistory(from, conversationHistory, text, replyAddr);
        return;
      }

      if (state === "awaiting_items") {
        const name = session.collectedName!;
        const address = session.collectedAddress!;

        // ── Image sent: analyze with OpenAI Vision ────────────────────────
        if (msgType === "image" && msg.image?.id) {
          // ── Step 1: Atomic claim — only the FIRST webhook handler wins ────────
          // All 4 photos in an album arrive simultaneously. claimPhotoScan does a
          // single-row UPDATE WHERE state='awaiting_items'. PostgreSQL guarantees
          // only one concurrent caller can succeed. Losers call appendPhotoToScanQueue
          // (raw SQL concat — no read-then-write) and return silently.
          const isPrimaryScanner = await storage.claimPhotoScan(from, msg.image.id);
          if (!isPrimaryScanner) {
            // Not first — atomically append our ID to the queue and exit
            await storage.appendPhotoToScanQueue(from, msg.image.id);
            return;
          }

          // Send ONE acknowledgment — no matter how many photos follow
          await sendBotMessage(from, `Got it! Give me a moment to scan your photo(s)... 🔍`);

          // ── Step 2: Wait 5 s so all concurrently-sent photos can append ───────
          await new Promise(resolve => setTimeout(resolve, 5000));

          // ── Step 3: Re-read session to collect ALL photo IDs ─────────────────
          const latestSession = await storage.getWhatsAppSession(from);
          const queueStr = latestSession?.collectedItems ?? `__scanning__:${msg.image.id}`;
          const allIds = queueStr.startsWith("__scanning__:")
            ? [...new Set(queueStr.slice("__scanning__:".length).split(",").filter(Boolean))]
            : [msg.image.id];

          // ── Helper: scan one media ID ─────────────────────────────────────────
          async function scanPhoto(mediaId: string): Promise<string | null> {
            const media = await downloadWhatsAppMedia(mediaId);
            if (!media) return null;
            const visionRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 800,
              messages: [
                {
                  role: "system",
                  content: `You are an expert furniture identification assistant for TMG Install, a professional furniture installation company in Singapore.

Your task: Carefully examine the photo and list ALL furniture items that require professional installation, assembly, dismantling, or relocation.

Rules:
- COUNT each piece individually (e.g. if you see 4 chairs, write "4 dining chairs")
- Identify BRAND/MODEL if visible (IKEA PAX, IKEA MALM, IKEA HEMNES, etc.)
- Include ALL visible furniture — don't skip anything
- DO NOT include TVs, electronics, decorative items, or small accessories
- Format: one bullet per line starting with quantity then item name, e.g. "• 1 queen bed frame"

If no installable furniture is visible, respond only with: NO_FURNITURE

${FURNITURE_VISION_GUIDE}`,
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Identify all furniture items in this photo that need professional installation, assembly, dismantling, or relocation." },
                    { type: "image_url", image_url: { url: `data:${media.mimeType};base64,${media.base64}`, detail: "high" } },
                  ] as any,
                },
              ],
            });
            const raw = (visionRes.choices[0]?.message?.content || "").trim();
            return (!raw || raw.includes("NO_FURNITURE")) ? null : raw;
          }

          // ── Step 4: Scan ALL queued photos in parallel ────────────────────────
          try {
            const results = await Promise.all(allIds.map(id => scanPhoto(id).catch(() => null)));
            const validResults = results.filter((r): r is string => !!r);

            if (validResults.length === 0) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedItems: null });
              await sendBotMessage(from,
                `Hmm, I couldn't spot any furniture in ${allIds.length > 1 ? "those photos" : "that photo"}. No worries — just *type out the items* you need help with, like:\n• 1 king bed frame\n• 3-door wardrobe\n• Dining table + 4 chairs`
              );
              return;
            }

            // Merge all results using GPT to intelligently combine without losing items
            // Simple string dedup loses items when the same item is worded differently across photos
            let allDetected: string;
            if (validResults.length === 1) {
              // Only one photo — just format the result directly
              allDetected = validResults[0].split("\n")
                .map(l => l.trim()).filter(Boolean)
                .map(l => l.startsWith("•") ? l : `• ${l}`)
                .join("\n");
            } else {
              // Multiple photos — use GPT to intelligently merge
              const mergeRes = await openai.chat.completions.create({
                model: "gpt-4o",
                max_tokens: 600,
                messages: [{
                  role: "system",
                  content: `You received furniture lists from ${validResults.length} different photos of a home or office.
Your job: merge them into ONE complete, accurate list without losing any items.

Rules:
- KEEP every unique item — do NOT drop items that are real but described differently
- DEDUPLICATE only when the SAME item clearly appears in MULTIPLE photos of the SAME room
  (e.g. "4 dining chairs" in photo 1 AND "4 wooden dining chairs" in photo 2 of same dining room = 1 entry)
- NEVER merge items that are clearly in DIFFERENT rooms or different photos of different areas
- If uncertain whether two mentions are the same item, KEEP BOTH
- Count quantities correctly — if photo 1 has "2 wardrobes" and photo 2 has "1 different wardrobe" in another room = 3 wardrobes total
- Format: one bullet per line starting with "•", e.g. "• 4 dining chairs"

Return ONLY the merged bullet list, nothing else.

Raw lists from each photo:
${validResults.map((r, i) => `[Photo ${i + 1}]\n${r}`).join("\n\n")}`
                }]
              });
              const merged = (mergeRes.choices[0]?.message?.content || "").trim();
              allDetected = merged.split("\n")
                .map(l => l.trim()).filter(Boolean)
                .map(l => l.startsWith("•") ? l : `• ${l}`)
                .join("\n");
            }

            // ── Step 5: Save and send ONE combined summary ────────────────────
            await storage.upsertWhatsAppSession(from, { state: "awaiting_items_verify", collectedItems: allDetected });
            await sendBotMessage(from,
              `Here's what I found in your photo${allIds.length > 1 ? "s" : ""}:\n\n${allDetected}\n\n` +
              `Does this look right?\n` +
              `• Reply *YES* to proceed\n` +
              `• *Type a correction or addition* if anything's off\n` +
              `• Send *another photo* to add more items\n` +
              `• Reply *NO* to redo the list`
            );
            return;
          } catch (err) {
            console.error("[WhatsApp] Image analysis error:", err);
            await storage.upsertWhatsAppSession(from, { state: "awaiting_items", collectedItems: null });
            await sendBotMessage(from,
              `Sorry, had a bit of trouble with that photo. Could you *type out the furniture items* instead? 🙏`
            );
            return;
          }
        }

        // ── Text input: use GPT to parse and format the item list ─────────
        if (text.length < 3) {
          await sendBotMessage(from,
            `What furniture do you need help with? 😊\n\n📸 *Send a photo* and I'll detect the items — or just *type the list* below.\n\n_e.g. 1 queen bed frame (install), 3-door wardrobe (dismantle)_`
          );
          return;
        }

        // ── Pre-check: customer is referring to a previously-sent photo ──────
        const photoRefPattern = /\b(share[d]?|sent?|show[n]?|upload[ed]?|gave|given|forward[ed]?|already)\b.{0,30}\b(photo|picture|pic|image)\b|\b(photo|picture|pic|image)\b.{0,30}\b(already|earlier|before|just now|sent?|share[d]?)\b/i;
        if (photoRefPattern.test(text)) {
          await sendBotMessage(from,
            `I see you mentioned sharing a photo earlier! 📸\n\n` +
            `Please *re-send the photo* and I'll automatically detect the furniture for you — ` +
            `or just *type the item names* below and I'll proceed from there.\n\n` +
            `_e.g. 1 queen bed frame (install), 3-door wardrobe (dismantle)_`
          );
          return;
        }

        let formattedItems = text;
        try {
          const itemsRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 300,
            response_format: { type: "json_object" },
            messages: [{
              role: "system",
              content: `You are a quoting assistant for TMG Install, a furniture installation company in Singapore.
The customer is being asked what furniture items they need help with.

FIRST check: is this a general acknowledgment/done signal with NO actual furniture mentioned?
Examples of done signals: "ok that's all", "nothing else", "done", "that's it", "all good", "ok", "sure", "yeah", "yes", "no more", "nothing more"
If yes → return { "done": true, "items": null, "needsServiceType": false, "serviceOnly": false, "detectedService": null }

SECOND check: Did the customer describe ONLY a service type without naming any specific furniture items?
Examples: "I want to install", "I need dismantling", "dismantle and relocation of the items", "relocation service", "for moving", "want to relocate my stuff", "i want dismantle", "for installation", "disposal service"
If yes → return { "done": false, "items": null, "needsServiceType": false, "serviceOnly": true, "detectedService": "install"|"dismantle"|"relocate"|"dispose"|"dismantle_dispose"|null }
Note: "dismantle and relocate/relocation" → detectedService: "relocate"

OTHERWISE, parse the furniture description and return JSON:
{ "done": false, "items": string, "needsServiceType": boolean, "serviceOnly": false, "detectedService": null }
- items: formatted bullet list (one • per line). Each line: "• [quantity] [item name] ([service type])"
  - Service type brackets MUST use ONLY one of these exact values: install, dismantle, relocate, dispose, dismantle_dispose
  - NEVER use any other description in brackets (e.g. "requires leg assembly", "needs disassembly", "flat pack" MUST be normalised — see mapping below)
  - Service type mapping:
    • "assembly", "assemble", "requires assembly", "requires leg assembly", "flat pack", "flat-pack", "put together", "set up" → install
    • "dismantle only", "take apart", "disassemble", "unassemble", "pack" (no moving) → dismantle
    • "relocate", "move", "shift", "transfer", "transport", "dismantle and relocate", "dismantle and move" → relocate (relocation includes dismantling at origin AND reinstall at destination)
    • "dispose", "haul away", "throw away", "get rid of" → dispose
    • "dismantle and dispose", "dismantle then haul" → dismantle_dispose
  - If service type is mentioned in this message OR in the recent conversation context below, include it in brackets
  - Service type context (from prior messages): ${
    (() => {
      const histText = conversationHistory.map((h: HistoryEntry) => h.content).join(" ").toLowerCase();
      if (/reloc|moving|move/.test(histText)) return '"relocate" was mentioned earlier';
      if (/dismantle|disassemble|take apart/.test(histText)) return '"dismantle" was mentioned earlier';
      if (/install|assembly|assemble/.test(histText)) return '"install" was mentioned earlier';
      if (/dispos|haul|throw/.test(histText)) return '"dispose" was mentioned earlier';
      return 'none detected yet';
    })()
  }
  - If no service type can be determined from this message or context, leave out the brackets (needsServiceType: true)
  - Quantity if mentioned, otherwise just the item name
  - IMPORTANT: "dismantle AND relocate/relocation" for the SAME item → use (relocate) only, NOT two separate lines
- needsServiceType: true if NO service type was mentioned at all (neither in this message nor in context)

Customer message: "${text}"`
            }]
          });
          const parsed = JSON.parse(itemsRes.choices[0]?.message?.content || "{}");

          if (parsed.done) {
            await sendBotMessage(from,
              `What furniture items do you need help with? 😊\n\n` +
              `📸 *Send a photo* and I'll detect the items — or type the list below.\n\n` +
              `_e.g. 1 queen bed frame (install), 3-door wardrobe (dismantle)_`
            );
            return;
          }

          if (parsed.serviceOnly) {
            const svcVerbMap: Record<string, string> = {
              install: "installed",
              dismantle: "dismantled",
              relocate: "relocated",
              dispose: "disposed of",
              dismantle_dispose: "dismantled and disposed of",
            };
            const verb = parsed.detectedService ? svcVerbMap[parsed.detectedService] || "helped with" : "helped with";
            await sendBotMessage(from,
              `Got it — ${parsed.detectedService ? `*${parsed.detectedService}* ` : ""}service noted! 👍\n\n` +
              `Which specific *furniture items* would you like ${verb}?\n\n` +
              `_e.g. wardrobe, queen bed frame, dining table, sofa, L-shaped sofa_\n\n` +
              `📸 Or *send a photo* and I'll detect everything automatically!`
            );
            return;
          }

          if (parsed.items) formattedItems = parsed.items;

          await storage.upsertWhatsAppSession(from, { state: "awaiting_items_verify", collectedItems: formattedItems });
          await sendBotMessage(from,
            `Got it! Here's what I have:\n\n${formattedItems}\n\n` +
            (parsed.needsServiceType
              ? `Is this for *installation, dismantling, relocation, or disposal*? (disposal only = higher price; dismantle+dispose bundle = cheaper) — or just reply *YES* if you're not sure and our team will confirm.\n\n`
              : ``) +
            `Does this look right?\n• Reply *YES* to proceed\n• *Type any corrections* if needed\n• Send a *photo* to add more items`
          );
        } catch {
          // Fallback
          await storage.upsertWhatsAppSession(from, { state: "awaiting_items_verify", collectedItems: formattedItems });
          await sendBotMessage(from,
            `Got it! Here's what I have:\n\n${formattedItems}\n\nDoes this look right?\n• Reply *YES* to proceed\n• *Type any corrections* if needed`
          );
        }
        return;
      }

      // ── Customer rechecks AI-detected items (from photo) ────────────────────
      if (state === "awaiting_items_verify") {
        const name = session.collectedName!;
        const address = session.collectedAddress!;
        const existingItems = session.collectedItems || "";

        // ── Additional photo sent: merge detections ───────────────────────
        if (msgType === "image" && msg.image?.id) {
          // ── Still scanning first batch: silently append to queue ─────────────
          // The primary scanner (3-second wait loop) will pick this up automatically
          if (existingItems.startsWith("__scanning__")) {
            // Use atomic SQL append — avoids the read-then-write race condition
            // that drops IDs when multiple photos arrive in the same millisecond
            await storage.appendPhotoToScanQueue(from, msg.image.id);
            // No message — the primary scanner will send ONE combined result
            return;
          }

          // ── Scanning complete: user sent an additional photo to add more ─────
          try {
            const media = await downloadWhatsAppMedia(msg.image.id);
            if (!media) throw new Error("Could not download image");

            await sendBotMessage(from, `Got your extra photo — scanning it now... 🔍`);

            const visionRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 800,
              messages: [
                {
                  role: "system",
                  content: `You are an expert furniture identification assistant for TMG Install, a professional furniture installation company in Singapore.
Identify ALL furniture items visible that need professional installation, assembly, dismantling, or relocation.
Rules:
- COUNT each piece individually
- Identify BRAND/MODEL if visible (IKEA PAX, IKEA HEMNES, etc.)
- DO NOT include TVs, electronics, decorative items
- Format: one bullet per line, e.g. "• 1 queen bed frame"
If no installable furniture visible, respond only with: NO_FURNITURE

${FURNITURE_VISION_GUIDE}`,
                },
                {
                  role: "user",
                  content: [
                    { type: "text", text: "Identify all furniture items in this photo." },
                    { type: "image_url", image_url: { url: `data:${media.mimeType};base64,${media.base64}`, detail: "high" } },
                  ] as any,
                },
              ],
            });

            const newDetected = (visionRes.choices[0]?.message?.content || "").trim();

            if (!newDetected || newDetected.includes("NO_FURNITURE")) {
              await sendBotMessage(from,
                `Hmm, couldn't spot any furniture in that one. Here's what I have so far:\n\n${existingItems}\n\n• Reply *YES* to confirm\n• *Type corrections or additions* if needed\n• Send *another photo* to add more\n• Reply *NO* to redo the list`
              );
              return;
            }

            // Merge new results into existing list, deduplicate
            const seenLines = new Set<string>();
            const mergedLines: string[] = [];
            for (const line of [...existingItems.split("\n"), ...newDetected.split("\n")]) {
              const cleaned = line.trim();
              if (!cleaned) continue;
              const key = cleaned.toLowerCase().replace(/[•\-\*]\s*/, "").trim();
              if (!seenLines.has(key)) {
                seenLines.add(key);
                mergedLines.push(cleaned.startsWith("•") ? cleaned : `• ${cleaned}`);
              }
            }
            const mergedItems = mergedLines.join("\n");

            await storage.upsertWhatsAppSession(from, { collectedItems: mergedItems });
            await sendBotMessage(from,
              `Here's the updated list from all your photos:\n\n${mergedItems}\n\n` +
              `• Reply *YES* if this is complete\n` +
              `• *Type any corrections or additions*\n` +
              `• Send *another photo* to add more\n` +
              `• Reply *NO* to redo the list`
            );
            return;
          } catch (err) {
            console.error("[WhatsApp] Image merge error:", err);
            await sendBotMessage(from,
              `Oops, had trouble with that photo. Here's what I have so far:\n\n${existingItems}\n\nReply *YES* to confirm, or type any corrections.`
            );
            return;
          }
        }

        const detectedItems = existingItems && existingItems !== "__scanning__" ? existingItems : "";
        const previousItems = session.previousItems || "";

        // ── Quick exact-match shortcuts ───────────────────────────────────────
        if (textLower === "yes" || textLower === "ok" || textLower === "correct" || textLower === "looks good" || textLower === "confirm") {
          // Check if items have any service type labels — if not, we MUST ask before proceeding
          const hasServiceType = /\((install|dismantle|relocate|dispose|dismantle.?dispose|relocation|moving)\)/i.test(detectedItems);
          if (!hasServiceType && detectedItems) {
            await storage.upsertWhatsAppSession(from, { state: "awaiting_service_type", collectedItems: detectedItems });
            await sendBotMessage(from,
              `Got it, the list is confirmed! ✅\n\nOne more thing — what *service type* do you need?\n\n` +
              `• *Installation* — assemble new furniture\n` +
              `• *Dismantling* — take apart & remove existing furniture\n` +
              `• *Relocation* — dismantle + move + reinstall at new location _(all-in-one)_\n` +
              `• *Disposal* — haul away and dispose\n` +
              `• *Dismantle + Dispose* — dismantle first, then dispose (cheaper bundle)\n\n` +
              `Reply with the service type (e.g. *installation*, *relocation*, *disposal*)`
            );
            return;
          }
          await storage.upsertWhatsAppSession(from, { state: "awaiting_floor", collectedItems: detectedItems, floorLevel: null, hasLift: null });
          const nextPromptFloor =
            `Almost there — just a couple of quick logistics questions to finalise your quote!\n\n` +
            `*Which floor is the unit on?*\n\n` +
            `Reply with the floor number (e.g. *1* for ground floor, *5* for fifth floor)\n` +
            `And is there a *lift* available? (yes / no)`;
          const replyVerifyYes = await craftReply(text, nextPromptFloor, { name: session.collectedName, history: conversationHistory });
          await sendBotMessage(from, replyVerifyYes);
          saveHistory(from, conversationHistory, text, replyVerifyYes);
          return;
        }

        if (text.length < 2) {
          await sendBotMessage(from,
            `Reply *YES* to confirm, or tell me what to fix. 😊`
          );
          return;
        }

        // ── AI-powered intent understanding ───────────────────────────────────
        // Use GPT to understand ANY natural language response from the user
        try {
          const intentRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 600,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `You are a WhatsApp assistant for TMG Install, a furniture installation company in Singapore.

The bot has just shown the customer a detected furniture list and asked them to confirm it.

Current detected list:
${detectedItems || "(empty)"}

${previousItems ? `Previous list (before customer said No/redo):\n${previousItems}` : ""}

The customer replied: "${text}"

Your job: understand what the customer wants and return a JSON response.

Return ONLY valid JSON with these fields:
{
  "action": "confirm" | "add" | "update" | "redo" | "unclear",
  "updatedList": "the complete updated bullet list as a string (• item per line), or empty string if action is redo/unclear",
  "reply": "your natural human reply in English (1-2 sentences max, friendly tone)",
  "isRelocation": true | false,
  "serviceType": "install" | "dismantle" | "relocate" | "dispose" | "dismantle_dispose" | null
}

Rules:
- "confirm": customer is happy, wants to proceed (yes, ok, correct, looks right, good, etc.) — even if they ALSO mention service type
- "add": customer wants to ADD items to the current list. Merge current + new items into updatedList
- "update": customer wants to CORRECT, REPLACE, or REMOVE specific items. Provide the corrected updatedList
- "redo": customer wants to completely start fresh without specifying what (just "no", "redo", "wrong", etc.)
- "unclear": you genuinely cannot understand what they want
- isRelocation: true if customer mentions this is a relocation, moving, shifting, or transport job
- serviceType: set if customer mentions a service type for ALL items:
  - "install" → assembly, installation, put together, set up, assemble
  - "dismantle" → dismantle only, take apart only, disassemble (no moving)
  - "relocate" → relocate, move, shift, transfer, transport, dismantle and relocate, dismantle and move, pick up and deliver — "dismantle and relocation" maps here
  - "dispose" → dispose, throw away, haul away, get rid of, junk
  - "dismantle_dispose" → dismantle and dispose, take apart and throw away, dismantle then haul
  - null if no service type mentioned or items already have mixed service types
- If serviceType is not null AND items list has no service type labels, update the updatedList to append "(serviceType)" to each item

Smart parsing:
- "this one", "that one", "yes this", "this is correct", "this is it", "yeah this" → action: confirm (customer is confirming the currently shown list)
- "remove X" / "delete X" / "take off X" / "no X" / "without X" → remove X from current list (action: update)
- "just remove the X, the rest is fine" → remove only X from current list, keep everything else (action: update)
- "short of X" or "missing X" or "also need X" → add X to current list (action: add)
- "the first list is correct" or "the original was right" → use previousItems as base + any new items mentioned
- "wrong" / "not X" / "should be Y instead" → correct that item (action: update)
- "just X" or "only X" → replace the whole list with just X (action: update)
- If they reference "the first list" and previousItems exists, use previousItems as the starting point
- IMPORTANT: "remove" means DELETE the item from the list — do NOT add it with "(remove)" tag, just omit it entirely
- IMPORTANT: Never set updatedList to a vague pronoun like "this one", "that one", "it" — these always mean the customer is confirming the current list

For updatedList: always format as bullet points starting with "•", one item per line.
For reply: be natural and friendly, confirm what you did.`,
              },
            ],
          });

          const intent = JSON.parse(intentRes.choices[0]?.message?.content || "{}");
          const action = intent.action as string;
          const updatedList = (intent.updatedList as string || "").trim();
          const aiReply = (intent.reply as string || "").trim();
          const intentIsRelocation = !!intent.isRelocation || (intent.serviceType === "relocate");
          const intentServiceType = intent.serviceType as string | null;

          if (action === "confirm") {
            // Use updatedList if GPT added service type labels, otherwise keep detectedItems
            let finalItems = updatedList || detectedItems;

            // Also check the raw customer message for "dismantle and reloc" pattern
            const rawIsReloc = /dismantle.{0,20}reloc|reloc.{0,20}dismantle/i.test(text);
            const resolvedIsRelocation = intentIsRelocation || rawIsReloc || session.isRelocation || false;
            const resolvedServiceType = intentServiceType || (rawIsReloc ? "relocate" : null) || (resolvedIsRelocation ? "relocate" : null);

            // If a service type is known but items lack labels, stamp all items now
            const hasServiceTypeFinal = /\((install|dismantle|relocate|dispose|dismantle.?dispose|relocation|moving)\)/i.test(finalItems);
            if (!hasServiceTypeFinal && resolvedServiceType) {
              finalItems = finalItems.split("\n").map(line => {
                if (!line.trim()) return line;
                // Strip any existing non-standard bracket, then add correct service type
                return `${line.replace(/\s*\(.*?\)\s*$/, "").trim()} (${resolvedServiceType})`;
              }).join("\n");
            }

            // If service type is STILL missing after all checks, ask for it
            const hasServiceTypeFinalCheck = /\((install|dismantle|relocate|dispose|dismantle.?dispose|relocation|moving)\)/i.test(finalItems);
            if (!hasServiceTypeFinalCheck && !resolvedServiceType && !resolvedIsRelocation) {
              await storage.upsertWhatsAppSession(from, { state: "awaiting_service_type", collectedItems: finalItems });
              await sendBotMessage(from,
                `${aiReply ? aiReply + "\n\n" : ""}One more thing — what *service type* do you need?\n\n` +
                `• *Installation* — assemble new furniture\n` +
                `• *Dismantling* — take apart & remove existing furniture\n` +
                `• *Relocation* — dismantle + move + reinstall at new location _(all-in-one)_\n` +
                `• *Disposal* — haul away and dispose\n` +
                `• *Dismantle + Dispose* — dismantle first, then dispose (cheaper bundle)\n\n` +
                `Reply with the service type (e.g. *installation*, *relocation*, *disposal*)`
              );
              return;
            }

            // Proceed to floor/access questions regardless of relocation (relocation address collected after access)
            // Clear floorLevel/hasLift so stale data can't trigger the partial-state shortcut
            await storage.upsertWhatsAppSession(from, {
              state: "awaiting_floor",
              collectedItems: finalItems,
              isRelocation: resolvedIsRelocation,
              floorLevel: null,
              hasLift: null,
            });
            await sendBotMessage(from,
              `${aiReply ? aiReply + "\n\n" : ""}Just a couple more quick questions to complete your quote. 😊\n\n` +
              `*Which floor is the unit on?*\n\n` +
              `Reply with the floor number (e.g. *1* for ground/first floor, *5* for fifth floor)\n` +
              `And is there a *lift* available? (yes / no)`
            );
            return;
          }

          if ((action === "add" || action === "update") && updatedList) {
            await storage.upsertWhatsAppSession(from, { collectedItems: updatedList });
            await sendBotMessage(from,
              `${aiReply} Here's the updated list:\n\n${updatedList}\n\n` +
              `• Reply *YES* to confirm\n` +
              `• Tell me if anything else needs changing\n` +
              `• Send a *photo* to add more items\n` +
              `• Reply *NO* to start fresh`
            );
            return;
          }

          if (action === "redo") {
            // Save current items as previousItems before clearing
            await storage.upsertWhatsAppSession(from, {
              state: "awaiting_items",
              collectedItems: null,
              previousItems: detectedItems || previousItems || null,
            });
            await sendBotMessage(from,
              `${aiReply || "No problem!"} Let's redo the list. *Type it out* or *send a new photo* 📸\n\n_e.g._\n• 1 king bed frame (install)\n• 3-door wardrobe (dismantle)`
            );
            return;
          }

          // unclear or parse error — give helpful nudge
          await sendBotMessage(from,
            `${aiReply || "Hmm, I'm not quite sure what you'd like to change!"} 😊\n\n` +
            `Here's the current list:\n\n${detectedItems}\n\n` +
            `• Reply *YES* to confirm this\n` +
            `• Tell me what to add or fix\n` +
            `• Reply *NO* to start fresh`
          );
          return;

        } catch (err) {
          console.error("[WhatsApp] Intent parse error:", err);
          // Fallback: treat as addition
          const fallback = detectedItems ? `${detectedItems}\n• ${text.replace(/^[•\-\*]\s*/, "")}` : text;
          await storage.upsertWhatsAppSession(from, { collectedItems: fallback });
          await sendBotMessage(from,
            `Got it! Here's the updated list:\n\n${fallback}\n\n• Reply *YES* to confirm\n• Tell me what else to change\n• Reply *NO* to start fresh`
          );
          return;
        }
      }

      // ─────────────────────────────────────────────────────────────────────────
      // State: awaiting_service_type — dedicated state to capture service type
      // Global command handler is bypassed for this state to prevent FAQ interception
      // ─────────────────────────────────────────────────────────────────────────
      if (state === "awaiting_service_type") {
        const items = session.collectedItems || "";

        // Use GPT to extract service type from the customer's natural language reply
        let detectedServiceType: string | null = null;
        let isRelocationSvc = false;

        // ── Pre-check: "dismantle AND relocation" variants → always "relocate" ──
        // Customers don't know relocation already includes dismantling, so they say both.
        if (/dismantle.{0,20}reloc|reloc.{0,20}dismantle/i.test(text)) {
          detectedServiceType = "relocate";
          isRelocationSvc = true;
        } else {
          try {
            const svcRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 100,
              response_format: { type: "json_object" },
              messages: [{
                role: "system",
                content: `The customer is answering the question: "What service type do you need?"
Customer said: "${text}"

Map their reply to one of these service types:
- "install" → assembly, installation, put together, set up, assemble, install
- "dismantle" → dismantle only, take apart only, disassemble (no moving or reinstall)
- "relocate" → relocate, relocation, move, shift, transfer, moving, transport, dismantle and move, dismantle and relocate, move and reinstall
- "dispose" → dispose, disposal, throw away, haul away, get rid of, junk (no reinstall)
- "dismantle_dispose" → dismantle and dispose, take apart and throw away, dismantle then haul

CRITICAL: If the customer mentions BOTH "dismantle" AND "relocate/relocation/move" → always return "relocate" (relocation already includes dismantling at origin + reinstall at destination).

Return JSON: { "serviceType": "install"|"dismantle"|"relocate"|"dispose"|"dismantle_dispose"|null, "confidence": "high"|"low" }`
              }],
            });
            const svcJson = JSON.parse(svcRes.choices[0]?.message?.content || "{}");
            detectedServiceType = svcJson.serviceType || null;
          } catch { /* ignore — keyword fallback below */ }

          // ── Keyword fallback: runs when GPT throws OR returns null ──────────
          if (!detectedServiceType) {
            if (/reloc|moving|move|shift/i.test(text)) { detectedServiceType = "relocate"; }
            else if (/dismantle.*dispos|bundle/i.test(text)) { detectedServiceType = "dismantle_dispose"; }
            else if (/dispos|haul|throw/i.test(text)) { detectedServiceType = "dispose"; }
            else if (/dismantle|take apart|pack/i.test(text)) { detectedServiceType = "dismantle"; }
            else if (/install|assem|set up/i.test(text)) { detectedServiceType = "install"; }
          }
        }

        if (detectedServiceType === "relocate") isRelocationSvc = true;

        if (!detectedServiceType) {
          // Still can't understand — re-ask
          await sendBotMessage(from,
            `Sorry, I didn't catch that. Please choose one of:\n\n` +
            `• *Installation* — assemble new furniture\n` +
            `• *Dismantling* — take apart & remove existing furniture\n` +
            `• *Relocation* — dismantle + move + reinstall at new location _(all-in-one)_\n` +
            `• *Disposal* — haul away and dispose\n` +
            `• *Dismantle + Dispose* — cheaper bundle\n\n` +
            `Reply with a service type (e.g. *installation* or *relocation*)`
          );
          return;
        }

        // Label every item in the list with the service type
        const labelledItems = items.split("\n").map(line => {
          if (!line.trim()) return line;
          // Skip if already has a label
          if (/\((install|dismantle|relocate|dispose|dismantle.?dispose|relocation|moving)\)/i.test(line)) return line;
          return `${line.replace(/\s*\(.*?\)\s*$/, "").trim()} (${detectedServiceType})`;
        }).join("\n");

        const svcLabel: Record<string, string> = {
          install: "Installation",
          dismantle: "Dismantling",
          relocate: "Relocation",
          dispose: "Disposal",
          dismantle_dispose: "Dismantle + Dispose",
        };

        await storage.upsertWhatsAppSession(from, {
          state: "awaiting_floor",
          collectedItems: labelledItems,
          isRelocation: isRelocationSvc || session.isRelocation || false,
          floorLevel: null,
          hasLift: null,
        });

        const nextPromptFloorSvc =
          `*${svcLabel[detectedServiceType] || detectedServiceType}* — perfect! ✅\n\n` +
          `Just a couple more quick questions to finalise your quote:\n\n` +
          `*Which floor is the unit on?*\n\n` +
          `Reply with the floor number (e.g. *1* for ground floor, *5* for fifth floor)\n` +
          `And is there a *lift* available? (yes / no)`;
        const replySvcType = await craftReply(text, nextPromptFloorSvc, { name: session.collectedName, history: conversationHistory });
        await sendBotMessage(from, replySvcType);
        saveHistory(from, conversationHistory, text, replySvcType);
        return;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // State: awaiting_floor — collect floor level and lift availability
      // ─────────────────────────────────────────────────────────────────────────
      if (state === "awaiting_floor") {
        // ── If floor was already captured last turn, just waiting for lift answer ──
        if (session.floorLevel != null && session.floorLevel > 0) {
          const tl = textLower.trim();
          let liftKnown: boolean | null = null;
          if (["yes", "yeah", "yep", "yup", "got lift", "have lift", "with lift", "there is", "there's a lift"].some(k => tl.includes(k))) {
            liftKnown = true;
          } else if (["no", "nope", "no lift", "don't have", "dont have", "none", "without lift", "no elevator"].some(k => tl.includes(k))) {
            liftKnown = false;
          } else {
            // GPT fallback for ambiguous lift answer
            try {
              const liftRes = await openai.chat.completions.create({
                model: "gpt-4o", max_tokens: 80, response_format: { type: "json_object" },
                messages: [{ role: "system", content: `Is the customer saying YES or NO to having a lift/elevator? Return JSON: {"hasLift": boolean | null}. null if unclear. Customer said: "${text}"` }]
              });
              const lp = JSON.parse(liftRes.choices[0]?.message?.content || "{}");
              liftKnown = lp.hasLift != null ? !!lp.hasLift : null;
            } catch { liftKnown = null; }
          }
          if (liftKnown === null) {
            await sendBotMessage(from, `Just to confirm — is there a *lift* available at ${session.collectedAddress || "the unit"}? Reply *yes* or *no* 😊`);
            return;
          }
          await storage.upsertWhatsAppSession(from, { hasLift: liftKnown, state: "awaiting_access" });
          const floorLabel = session.floorLevel === 1 ? "Ground / 1st floor" : `Floor ${session.floorLevel}`;
          const nextPromptAccessPartial =
            `${floorLabel}, ${liftKnown ? "lift available ✅" : "no lift"} — got it!\n\n` +
            `One last thing — how easy is access to the unit?\n\n` +
            `1️⃣ *Easy* — clear hallways, no obstacles\n` +
            `2️⃣ *Moderate* — some tight corners or minor obstacles\n` +
            `3️⃣ *Difficult* — very narrow, many obstacles\n\n` +
            `Reply *1*, *2*, or *3*`;
          const replyLiftPartial = await craftReply(text, nextPromptAccessPartial, { name: session.collectedName, history: conversationHistory });
          await sendBotMessage(from, replyLiftPartial);
          saveHistory(from, conversationHistory, text, replyLiftPartial);
          return;
        }

        // ── Parse floor number and lift from natural language using GPT ──
        try {
          const floorRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 150,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `You are a quoting assistant for TMG Install (Singapore furniture installation). The customer was asked which floor their unit is on and whether there is a lift.

Return JSON:
{
  "floorLevel": number | null,
  "hasLift": boolean | null,
  "understood": boolean,
  "reply": "brief friendly 1-sentence confirmation"
}

Rules:
- "ground floor" / "1st" / "ground" → floorLevel: 1
- "2nd" / "second" / "level 2" / "storey 2" → floorLevel: 2 (and so on)
- "yes" alone with no floor → floorLevel: null, understood: false
- "yes lift" / "with lift" / "got lift" → hasLift: true
- "no lift" / "no" in lift context → hasLift: false
- Only floor given, no lift mentioned → hasLift: null
- Cannot determine floor at all → understood: false`,
              },
              ...historyMessages(conversationHistory, 4),
              { role: "user", content: text },
            ],
          });
          const fp = JSON.parse(floorRes.choices[0]?.message?.content || "{}");

          if (!fp.understood || fp.floorLevel == null) {
            await sendBotMessage(from,
              `Which floor is the unit on? 😊\n\nReply with a number (e.g. *1* for ground floor, *3* for third floor)\nAnd is there a *lift*? (yes / no)`
            );
            return;
          }

          const floorLevel = Math.max(1, Math.round(Number(fp.floorLevel) || 1));

          if (fp.hasLift == null) {
            // Floor captured but lift not mentioned — save floor and ask about lift
            await storage.upsertWhatsAppSession(from, { floorLevel });
            await sendBotMessage(from,
              `Got it — *Floor ${floorLevel}*! 😊 Is there a *lift* available?\n\nReply *yes* or *no*`
            );
            return;
          }

          const hasLift = !!fp.hasLift;
          // Both floor and lift captured — move to access difficulty
          await storage.upsertWhatsAppSession(from, { floorLevel, hasLift, state: "awaiting_access" });
          const nextPromptAccess =
            `Floor ${floorLevel}, ${hasLift ? "lift available ✅" : "no lift"} — noted!\n\n` +
            `One last thing — how easy is access to the unit?\n\n` +
            `1️⃣ *Easy* — clear corridors, no obstacles\n` +
            `2️⃣ *Moderate* — some tight corners or obstacles\n` +
            `3️⃣ *Difficult* — very narrow, many steps, or no lift access\n\n` +
            `Reply *1*, *2*, or *3*`;
          const replyFloor = await craftReply(text, nextPromptAccess, { name: session.collectedName, history: conversationHistory });
          await sendBotMessage(from, replyFloor);
          saveHistory(from, conversationHistory, text, replyFloor);
        } catch (err) {
          console.error("[WhatsApp] Floor parse error:", err);
          await sendBotMessage(from,
            `Which floor is the unit on? (e.g. *1* for ground floor, *3* for third floor)\nAnd is there a lift? (yes / no)`
          );
        }
        return;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // State: awaiting_access — collect access difficulty
      // ─────────────────────────────────────────────────────────────────────────
      if (state === "awaiting_access") {
        const floorLevel = session.floorLevel ?? 1;
        const hasLift = session.hasLift ?? true;

        // Handle "yes/no" for lift if floor was captured but lift was pending
        const liftAnswerLower = textLower.trim();
        if (liftAnswerLower === "yes" || liftAnswerLower === "no" || liftAnswerLower === "yeah" || liftAnswerLower === "nope") {
          const liftAvail = liftAnswerLower === "yes" || liftAnswerLower === "yeah";
          await storage.upsertWhatsAppSession(from, { hasLift: liftAvail });
          await sendBotMessage(from,
            `Got it — ${liftAvail ? "lift available" : "no lift"}. 👍\n\n` +
            `How easy is access to the unit?\n\n` +
            `1️⃣ *Easy* — clear hallways, no obstacles\n` +
            `2️⃣ *Moderate* — some tight corners or minor obstacles\n` +
            `3️⃣ *Difficult* — very narrow, many obstacles\n\n` +
            `Reply *1*, *2*, or *3*`
          );
          return;
        }

        let accessDifficulty: "easy" | "medium" | "hard" = "easy";
        if (textLower === "1" || textLower.includes("easy") || textLower.includes("clear")) {
          accessDifficulty = "easy";
        } else if (textLower === "2" || textLower.includes("moderate") || textLower.includes("medium") || textLower.includes("tight")) {
          accessDifficulty = "medium";
        } else if (textLower === "3" || textLower.includes("difficult") || textLower.includes("hard") || textLower.includes("narrow")) {
          accessDifficulty = "hard";
        } else {
          // Try GPT to parse
          try {
            const accessRes = await openai.chat.completions.create({
              model: "gpt-4o",
              max_tokens: 100,
              response_format: { type: "json_object" },
              messages: [{
                role: "system",
                content: `Parse the customer's response to "how easy is access?" and return JSON:
{ "difficulty": "easy" | "medium" | "hard" | null }
- easy: clear access, no issues
- medium: some obstacles, tight corners
- hard: very narrow, many obstacles, difficult stairs
Customer said: "${text}"
If unclear → null`
              }]
            });
            const ap = JSON.parse(accessRes.choices[0]?.message?.content || "{}");
            if (!ap.difficulty) {
              await sendBotMessage(from,
                `How easy is access to the unit?\n\n1️⃣ *Easy* — clear hallways\n2️⃣ *Moderate* — some obstacles\n3️⃣ *Difficult* — very narrow or many obstacles\n\nReply *1*, *2*, or *3*`
              );
              return;
            }
            accessDifficulty = ap.difficulty as "easy" | "medium" | "hard";
          } catch {
            accessDifficulty = "easy"; // default to easy on parse error
          }
        }

        const accessLabel = { easy: "Easy access ✅", medium: "Moderate access ⚠️", hard: "Difficult access ⛔" }[accessDifficulty];

        // Decide next state: if relocation and no to-address yet → awaiting_to_address, else → awaiting_date
        if (session.isRelocation && !session.collectedToAddress) {
          await storage.upsertWhatsAppSession(from, { accessDifficulty, state: "awaiting_to_address" });
          const nextPromptToAddr =
            `${accessLabel}\n\n` +
            `Since this is a *relocation*, we need the destination address too 📍\n\n` +
            `What's the address you'd like the furniture moved *to*?\n_e.g. 123 Tampines Ave 3, #05-12_`;
          const replyAccess = await craftReply(text, nextPromptToAddr, { name: session.collectedName, history: conversationHistory });
          await sendBotMessage(from, replyAccess);
          saveHistory(from, conversationHistory, text, replyAccess);
        } else {
          await storage.upsertWhatsAppSession(from, { accessDifficulty, state: "awaiting_date" });
          const { message: dateMenu } = await buildDateMenuMessage();
          const nextPromptDate = `${accessLabel}\n\nAlmost there! When would you like this done?\n\n${dateMenu}`;
          const replyAccess = await craftReply(text, nextPromptDate, { name: session.collectedName, history: conversationHistory });
          await sendBotMessage(from, replyAccess);
          saveHistory(from, conversationHistory, text, replyAccess);
        }
        return;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // State: awaiting_to_address — collect destination address for relocation
      // ─────────────────────────────────────────────────────────────────────────
      if (state === "awaiting_to_address") {
        if (text.length < 2) {
          await sendBotMessage(from, `Please provide the *destination address* where the furniture should be moved to. 📍`);
          return;
        }

        // Use GPT to extract and normalise Singapore address/landmark
        let toAddress = text.trim();
        try {
          const addrRes = await openai.chat.completions.create({
            model: "gpt-4o", max_tokens: 150, response_format: { type: "json_object" },
            messages: [{ role: "system", content: `You are helping extract a Singapore destination address from a WhatsApp message.

Extract the address/location from: "${text}"

Singapore address formats include:
- HDB blocks: "Blk 261 Serangoon Central #05-01"
- Landmarks/malls: "Ion Orchard", "313 Somerset", "Vivocity", "Jewel Changi", etc.
- Street addresses: "10 Orchard Road"
- Area names: "Tampines", "Jurong East", "Buona Vista"
- Postal codes: "S550261"

Return JSON: { "address": "normalised address string or null if not an address", "isAddress": boolean }
- isAddress: false only if the message is clearly NOT any kind of address (e.g. "I don't know", "not sure")
- For landmarks/malls/area names, accept them as valid addresses — normalise capitalisation
- "Ion orchard" → "Ion Orchard"` }]
          });
          const ap = JSON.parse(addrRes.choices[0]?.message?.content || "{}");
          if (!ap.isAddress) {
            await sendBotMessage(from, `What's the *destination address* for the move? 📍\n\n_e.g. Blk 123 Tampines Ave 3, or Ion Orchard, or 10 Orchard Road_`);
            return;
          }
          if (ap.address) toAddress = ap.address;
        } catch {
          // Keep raw text if GPT fails
        }

        // Compute route distance using OneMap geocode + OSRM
        let distanceKm: string | null = null;
        let distanceDisplay = "";
        try {
          const fromAddr = session.collectedAddress!;
          async function geocodeAddr(addr: string): Promise<{ lat: number; lng: number } | null> {
            const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(addr)}&returnGeom=Y&getAddrDetails=N&pageNum=1`;
            const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
            const data = await r.json();
            const first = data?.results?.[0];
            if (!first) return null;
            return { lat: parseFloat(first.LATITUDE), lng: parseFloat(first.LONGITUDE) };
          }
          const [fromCoord, toCoord] = await Promise.all([geocodeAddr(fromAddr), geocodeAddr(toAddress)]);
          if (fromCoord && toCoord) {
            const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromCoord.lng},${fromCoord.lat};${toCoord.lng},${toCoord.lat}?overview=false`;
            const osrmRes = await fetch(osrmUrl, { signal: AbortSignal.timeout(8000) });
            const osrmData = await osrmRes.json();
            const metres = osrmData?.routes?.[0]?.distance;
            if (metres) {
              const km = Math.round(metres / 100) / 10; // round to 1 decimal
              distanceKm = km.toFixed(1);
              distanceDisplay = `\n📏 *Route distance:* ~${distanceKm} km`;
            }
          }
        } catch (e) {
          console.warn("[WhatsApp] Distance calculation failed:", e);
        }

        await storage.upsertWhatsAppSession(from, {
          state: "awaiting_date",
          collectedToAddress: toAddress,
          distanceKm: distanceKm,
        });

        const { message: dateMenu } = await buildDateMenuMessage();
        const nextPromptDate2 =
          `Moving *from:* ${session.collectedAddress}\n*To:* ${toAddress}${distanceDisplay}\n\n` +
          `Now let's sort the date. 📅\n\n${dateMenu}`;
        const replyToAddr = await craftReply(text, nextPromptDate2, { name: session.collectedName, history: conversationHistory });
        await sendBotMessage(from, replyToAddr);
        saveHistory(from, conversationHistory, text, replyToAddr);
        return;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // State: awaiting_date — collect preferred service date after items verified
      // ─────────────────────────────────────────────────────────────────────────
      if (state === "awaiting_date") {
        const name = session.collectedName!;
        const address = session.collectedAddress!;
        const items = session.collectedItems!;

        // Fetch the same slot list that was shown to the customer.
        // We re-compute it fresh — slots are deterministic based on current bookings.
        const { slots: availableSlots } = await buildDateMenuMessage();
        const slotListForGpt = availableSlots.length > 0
          ? availableSlots.map((s, i) => `${i + 1}. ${s.display} (${s.date} ${s.timeWindow})`).join("\n")
          : "No specific slots listed — customer may type any date.";

        let preferredDateDisplay = text.trim();
        let preferredDateIso: string | null = null;
        let preferredTimeWindow: string | null = null;
        let isFlexible = false;

        try {
          const today = new Date();
          const dateRes = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 200,
            response_format: { type: "json_object" },
            messages: [{
              role: "system",
              content: `Today is ${today.toISOString().slice(0, 10)} (${today.toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}).

The customer was shown this numbered list of available slots and asked to choose:
${slotListForGpt}

They replied: "${text}"

Interpret their reply and return JSON:
{
  "slotIndex": null or 1-based number matching a slot in the list,
  "isoDate": "yyyy-MM-dd or null",
  "timeWindow": "09:00-12:00 or 13:00-17:00 or null",
  "display": "friendly human-readable summary e.g. Saturday, 22 March 2026 — Morning (9am–12pm)",
  "flexible": boolean
}
Rules:
- If they say "1", "option 1", "first one", "the morning one on Saturday" etc → set slotIndex to the matching number; copy isoDate and timeWindow from that slot.
- If they say "morning" without a day → find the first morning slot in the list.
- If they type a specific date not in the list → set isoDate to that date in yyyy-MM-dd; timeWindow based on AM/PM if mentioned, else null.
- Relative dates ("this Saturday", "next Monday") → resolve to actual yyyy-MM-dd.
- "anytime", "flexible", "whenever", "no preference", "not sure" → flexible=true, isoDate=null, timeWindow=null.
- display: always write a friendly readable summary of what was chosen.`
            }]
          });
          const dp = JSON.parse(dateRes.choices[0]?.message?.content || "{}");

          // If they picked a numbered slot, use that slot's exact data
          if (dp.slotIndex && availableSlots[dp.slotIndex - 1]) {
            const chosen = availableSlots[dp.slotIndex - 1];
            preferredDateIso = chosen.date;
            preferredTimeWindow = chosen.timeWindow;
            preferredDateDisplay = dp.display || chosen.display;
          } else {
            if (dp.isoDate && /^\d{4}-\d{2}-\d{2}$/.test(dp.isoDate)) preferredDateIso = dp.isoDate;
            if (dp.timeWindow && ["09:00-12:00", "13:00-17:00"].includes(dp.timeWindow)) preferredTimeWindow = dp.timeWindow;
            if (dp.display) preferredDateDisplay = dp.display;
          }
          isFlexible = !!dp.flexible;
        } catch {}

        // Validate the chosen slot is actually available (if a specific slot was picked)
        if (preferredDateIso && preferredTimeWindow) {
          const stillAvailable = await storage.isSlotAvailable(preferredDateIso, preferredTimeWindow);
          if (!stillAvailable) {
            // That slot just got taken — show updated menu
            const { message: freshMenu } = await buildDateMenuMessage();
            await sendBotMessage(from,
              `Sorry, that slot was just taken! Here are our current available slots:\n\n${freshMenu}`
            );
            return;
          }
        }

        // Store display text in session (for WhatsApp messages) + ISO date + time window separately
        // Move to awaiting_remarks to collect any special notes before showing final summary
        await storage.upsertWhatsAppSession(from, {
          state: "awaiting_remarks",
          preferredDate: preferredDateDisplay,
          preferredDateIso: preferredDateIso,
          preferredTimeWindow: preferredTimeWindow,
        });

        const twLabelDate = preferredTimeWindow === "09:00-12:00"
          ? " (Morning, 9am–12pm)"
          : preferredTimeWindow === "13:00-17:00"
            ? " (Afternoon, 1pm–5pm)"
            : "";

        const dateAck = isFlexible ? "Flexible timing — perfect! 😊" : `*${preferredDateDisplay}${twLabelDate}* — noted! ✅`;
        const remarksPrompt =
          `${dateAck}\n\n` +
          `Last thing before I show you the full summary — any *special notes* for the team? 📝\n\n` +
          `_(e.g. condo move-in rules, parking restrictions, fragile items, narrow lift)_\n\n` +
          `Got an *email* for the quote receipt? Drop it here too if you'd like.\n\n` +
          `Reply *none* to skip and go straight to your summary.`;
        await sendBotMessage(from, remarksPrompt);
        saveHistory(from, conversationHistory, text, remarksPrompt);
        return;
      }

      // ─────────────────────────────────────────────────────────────────────────
      // State: awaiting_remarks — optional special notes + email before summary
      // ─────────────────────────────────────────────────────────────────────────
      if (state === "awaiting_remarks") {
        const isSkipRemark = /^(none|no|nope|nothing|skip|n\/a|na|nah|all good|ok|okay|no notes|no remarks|not? (needed|required)|nothing (to add|special))$/i.test(textLower.trim());

        // Extract email if present
        const emailInRemark = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
        const extractedEmailRemark = emailInRemark ? emailInRemark[0].toLowerCase() : null;

        // Extract remarks (strip the email from the text, keep the rest as notes)
        let remarksText: string | null = null;
        if (!isSkipRemark) {
          const withoutEmail = text.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "").trim().replace(/\s+/g, " ");
          // Only save as remarks if there's meaningful text left after stripping email
          if (withoutEmail.length > 3 && !/^(none|no|nope|nothing|skip|n\/a|na|nah|all good|ok|okay)$/i.test(withoutEmail)) {
            remarksText = withoutEmail;
          }
        }

        await storage.upsertWhatsAppSession(from, {
          state: "awaiting_confirmation",
          ...(extractedEmailRemark ? { collectedEmail: extractedEmailRemark } : {}),
          ...(remarksText ? { specialRemarks: remarksText } : {}),
        });

        // Reload session with fresh data for building the summary
        const updatedSession = await storage.getWhatsAppSession(from);
        const summName = updatedSession?.collectedName || session.collectedName || "";
        const summAddress = updatedSession?.collectedAddress || session.collectedAddress || "";
        const summItems = updatedSession?.collectedItems || session.collectedItems || "";
        const summEmail = updatedSession?.collectedEmail || null;
        const summRemarks = updatedSession?.specialRemarks || null;
        const summFloorLvl = updatedSession?.floorLevel ?? session.floorLevel ?? 1;
        const summHasLift = updatedSession?.hasLift ?? session.hasLift ?? true;
        const summAccessLvl = updatedSession?.accessDifficulty ?? session.accessDifficulty ?? "easy";
        const summDate = updatedSession?.preferredDate || session.preferredDate || "Flexible";
        const summTimeWindow = updatedSession?.preferredTimeWindow || session.preferredTimeWindow || null;
        const summIsRelocation = !!(updatedSession?.isRelocation || session.isRelocation);
        const summToAddr = updatedSession?.collectedToAddress || session.collectedToAddress || null;
        const summDistKm = updatedSession?.distanceKm || session.distanceKm || null;

        const summTwLabel = summTimeWindow === "09:00-12:00"
          ? " (Morning, 9am–12pm)"
          : summTimeWindow === "13:00-17:00"
            ? " (Afternoon, 1pm–5pm)"
            : "";
        const summAddressBlock = summIsRelocation && summToAddr
          ? `📦 *Type:* Relocation\n📍 *From:* ${summAddress}\n📍 *To:* ${summToAddr}${summDistKm ? `\n📏 *Distance:* ~${summDistKm} km` : ""}`
          : `📍 *Address:* ${summAddress}`;
        const summFloorLine = `🏢 *Floor:* ${summFloorLvl === 1 ? "Ground / 1st floor" : `Floor ${summFloorLvl}`} (${summHasLift ? "lift available" : "no lift"})`;
        const summAccessLine = `🚪 *Access:* ${{ easy: "Easy", medium: "Moderate", hard: "Difficult" }[summAccessLvl] || "Easy"}`;

        let summaryMsg =
          `${remarksText || extractedEmailRemark ? "Got it! ✅\n\n" : "No worries! ✅\n\n"}` +
          `Here's your full quote summary:\n\n` +
          `👤 *Name:* ${summName}\n` +
          (summEmail ? `📧 *Email:* ${summEmail}\n` : ``) +
          `${summAddressBlock}\n` +
          `🛋️ *Items:*\n${summItems}\n` +
          `${summFloorLine}\n` +
          `${summAccessLine}\n` +
          `📅 *Preferred date:* ${summDate}${summTwLabel}\n` +
          (summRemarks ? `📝 *Notes:* ${summRemarks}\n` : ``);

        summaryMsg +=
          `\nShall I send this to our team? Reply *YES* to submit.\n\n` +
          `_Need to fix anything? Type *change name*, *change address*, *change items*, *change date*, *change floor*, *change access*, or *change remarks*._`;

        await sendBotMessage(from, summaryMsg);
        saveHistory(from, conversationHistory, text, summaryMsg);
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
            `• Type *change name* — update your name\n` +
            `• Type *change address* — fix the job address\n` +
            `• Type *change items* — update the furniture list\n` +
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
  "action": "submit" | "edit_items" | "change_name" | "change_address" | "change_date" | "redo_items" | "set_relocation" | "question" | "cancel" | "unclear",
  "reply": "friendly 1-sentence acknowledgment of what you changed/understood",
  "updatedItems": "the FULL updated bullet list (all items, one per line) — REQUIRED for edit_items, empty string otherwise"
}

ACTION RULES (follow strictly):
- submit: customer confirms (yes, ok, looks good, send it, go ahead, confirm, correct, all good, etc.)
- edit_items: customer mentions a SPECIFIC item to add, remove, or change. Examples: "remove the wardrobe", "take off 4 desk surfaces", "add 1 sofa", "change the bed to king size", "I don't need the cabinets", "sorry remove X". Use the CURRENT LIST above to compute the FULL updated bullet list with the change applied. DO NOT wipe the whole list — only add/remove/change the specific item mentioned.
- change_name: they say their name is wrong or want to change it
- change_address: they want to change the job address
- change_date: they want to change the date or time slot
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

              await sendBotMessage(from,
                `${ci.reply || "Done! ✅"} Here's your updated summary:\n\n` +
                `👤 *Name:* ${session.collectedName}\n` +
                (session.collectedEmail ? `📧 *Email:* ${session.collectedEmail}\n` : ``) +
                `${addressBlockE}\n` +
                `🛋️ *Items:*\n${updatedItems}\n` +
                `${floorLineE}\n` +
                `${accessLineE}\n` +
                `📅 *Preferred date:* ${session.preferredDate || "Flexible"}${twLabelE}\n` +
                (session.specialRemarks ? `📝 *Notes:* ${session.specialRemarks}\n` : ``) +
                `\nShall I send this to our team? Reply *YES* to submit.\n\n` +
                `_Need to fix anything? Type *change name*, *change address*, *change items*, *change date*, *change floor*, *change access*, or *change remarks*._`
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

        const name = session.collectedName!;
        const address = session.collectedAddress!;
        const itemsText = session.collectedItems!;

        // ── Step 1: Load catalog so we can match and use real prices ──────
        const catalog = await storage.getCatalogItems();

        // ── Step 2: Parse items with OpenAI (same logic as web flow) ──────
        let aiParsedItems: { detectedName: string; serviceType: string; quantity: number; estimatedUnitPrice: number; confidence: number }[] = [];
        try {
          const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `You are an AI assistant for TMG Install, a furniture installation company in Singapore.
Extract furniture items and required services from the customer's description.
Valid service types are: 'install', 'dismantle', 'relocate'.

Our catalog includes these items (name — serviceType — price SGD):
${catalog.map(c => `- ${c.name} (${c.serviceType}) $${c.basePrice}`).join("\n")}

Try to match detected items to the catalog above. Use the catalog item name as detectedName when matched.
For items not in the catalog, estimate a reasonable SGD unit price.

Return a JSON object with an 'items' array. Each item should have:
- 'detectedName': string (match catalog name exactly when possible, e.g. 'IKEA Pax Wardrobe')
- 'serviceType': string ('install', 'dismantle', or 'relocate')
- 'quantity': number
- 'estimatedUnitPrice': number
- 'confidence': number (0-100)
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
          aiParsedItems = [{ detectedName: itemsText.substring(0, 200), serviceType: "install", quantity: 1, estimatedUnitPrice: 0, confidence: 50 }];
        }

        // ── Step 3: Match each item against the catalog (same as web flow) ─
        let totalEstimate = 0;
        const quoteItems = aiParsedItems.map((item) => {
          const matchedCatalogItem = catalog.find(c =>
            c.serviceType === item.serviceType &&
            item.detectedName.toLowerCase().includes(c.name.toLowerCase())
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

        const refNo = `TMG-${randomBytes(2).toString("hex").toUpperCase()}`;

        // ── Bulk discount (same tiers as web / Estimate page) ─────────────────
        const totalQty = aiParsedItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const discountTier = PricingConfig.bulkDiscount.find(t => totalQty >= t.minQty);
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

        // ── Minimum charge: SGD 180 (same rule as web flow) ──────────────────
        const MIN_CHARGE = 180;
        const minAdjustment = totalEstimate < MIN_CHARGE ? MIN_CHARGE - totalEstimate : 0;
        const laborTotal = totalEstimate + minAdjustment;

        if (minAdjustment > 0) {
          quoteItems.push({
            originalDescription: "Minimum Charge Adjustment",
            detectedName: "Minimum Charge Adjustment",
            serviceType: "adjustment",
            quantity: 1,
            unitPrice: minAdjustment.toFixed(2),
            subtotal: minAdjustment.toFixed(2),
            catalogItemId: undefined,
          });
        }

        // ── Floor surcharge (same formula as web flow) ─────────────────────────
        // $5/floor with lift, $15/floor without lift (only floors above ground)
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

        // ── Access difficulty surcharge (same formula as web flow) ─────────────
        // +10% for medium, +20% for hard (applied to labor total)
        const sessionAccess = session.accessDifficulty ?? "easy";
        const accessPct = sessionAccess === "medium" ? PricingConfig.access.mediumPct : sessionAccess === "hard" ? PricingConfig.access.hardPct : 0;
        const accessSurcharge = Math.round(laborTotal * accessPct * 100) / 100;
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

        const laborTotalWithSurcharges = laborTotal + floorSurcharge + accessSurcharge;

        // ── Transport fee (relocation only — same formula as web flow) ─────────
        // Base $80 + tiered rate per km over the first 5 km included
        const sessionDistKm = session.distanceKm ? parseFloat(session.distanceKm) : 0;
        const transportFee = session.isRelocation ? calcTransportFee(sessionDistKm) : 0;
        const grandTotal = laborTotalWithSurcharges + transportFee;
        // ─────────────────────────────────────────────────────────────────────

        const depositAmount = (grandTotal * 0.50).toFixed(2);
        const finalAmount = (grandTotal * 0.50).toFixed(2);

        // Build the notes field: include date display + special remarks from customer
        const noteParts: string[] = [];
        if (session.preferredDate && !session.preferredDateIso) noteParts.push(`Preferred date (flexible): ${session.preferredDate}`);
        else if (session.preferredDate && session.preferredDateIso) noteParts.push(`Preferred date: ${session.preferredDate}`);
        if (session.specialRemarks) noteParts.push(`Customer notes: ${session.specialRemarks}`);
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
          } as any,
          quoteItems as any
        );

        await storage.deleteWhatsAppSession(from);

        await sendBotMessage(from,
          `✅ All done, *${name}*! Your request has been submitted.\n\n` +
          `🔖 *Reference:* ${quote.referenceNo}\n` +
          `📍 *Address:* ${address}\n` +
          (session.preferredDate ? `📅 *Preferred date:* ${session.preferredDate}\n` : "") +
          `\nOur team will review and send you a quote shortly — typically within 1 business day.\n\n` +
          `Track your request: ${APP_URL}/quotes/${quote.id}\n\n` +
          `Thanks for choosing TMG Install! 🙏 Reply *hi* anytime for a new quote.`
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
- Pricing: from SGD 80/item, minimum order SGD 180; relocation adds transport fee
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
  app.post("/api/admin/quotes/:id/send-whatsapp-payment", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      // Admin can pass an explicit phone override (for web-submitted quotes with no WA phone)
      const { phone: phoneOverride } = (req.body as { phone?: string }) || {};
      const rawPhone = phoneOverride?.trim() || (quote as any).customerWhatsappPhone;
      if (!rawPhone) return res.status(400).json({ message: "No WhatsApp number — please provide one." });

      // Normalise: strip leading '+', spaces, dashes
      const phone = rawPhone.replace(/^\+/, "").replace(/[\s\-]/g, "");

      const depositAmount = String(quote.depositAmount || "0");

      // Generate Stripe payment link if available, else fall back to quote status page
      let paymentLink = `${APP_URL}/quotes/${id}`;
      if (stripe && parseFloat(depositAmount) > 0) {
        const link = await createStripePaymentLink(
          `Deposit for ${quote.referenceNo}`,
          parseFloat(depositAmount),
          { quoteId: String(id), type: "deposit" },
          `${APP_URL}/quotes/${id}`
        );
        if (link) paymentLink = link;
      }

      await sendWhatsAppPaymentLink(phone, quote.referenceNo, depositAmount, paymentLink, {
        customerName: (quote as any).customer?.name || undefined,
        preferredDate: (quote as any).preferredDate || undefined,
        preferredTimeWindow: (quote as any).preferredTimeWindow || undefined,
      });

      res.json({ message: "Payment reminder sent via WhatsApp", phone });
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

  // ── Admin: Resend deposit request email ────────────────────────────────────
  app.post("/api/admin/quotes/:id/resend-deposit-email", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Unauthorized" });
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
    try {
      const quote = await storage.getQuote(id);
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      if (!quote.customer?.email || quote.customer.email.endsWith("@tmginstall.com")) {
        return res.status(400).json({ message: "No real customer email on file for this quote." });
      }
      const depositAmt = parseFloat(quote.depositAmount || "0") || parseFloat(quote.total) * 0.3;
      const quotePageUrl = `${APP_URL}/quotes/${quote.id}`;
      const stripeUrl = await createStripePaymentLink(
        `Deposit for ${quote.referenceNo} — TMG Install`,
        depositAmt,
        { quoteId: String(quote.id), type: "deposit", referenceNo: quote.referenceNo },
        quotePageUrl
      );
      const paymentLink = stripeUrl || quotePageUrl;
      const emailHtml = depositRequestEmail(quote, paymentLink);
      await sendEmail({
        to: quote.customer.email,
        subject: `[${quote.referenceNo}] Deposit Payment Required — TMG Install`,
        html: emailHtml,
      });
      res.json({ message: "Deposit email resent", email: quote.customer.email });
    } catch (err: any) {
      console.error("[Email] Resend deposit email error:", err);
      res.status(500).json({ message: err?.message || "Failed to send email" });
    }
  });

  // ── Admin: WhatsApp Token Settings ────────────────────────────────────────
  app.post("/api/admin/settings/whatsapp-token", async (req, res) => {
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
  app.get("/api/admin/whatsapp/token-status", async (_req, res) => {
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
        return res.json({ status: "expired", message: `Token expired ${Math.abs(daysLeft)} day(s) ago — update now!` });
      }
      return res.json({ status: "ok", message: `Token valid — ${daysLeft} days remaining` });
    } catch (err) {
      return res.json({ status: "error", message: "Could not check token" });
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
    const { code } = req.body as { code?: string };
    if (!code?.trim()) return res.status(400).json({ valid: false, message: "No code provided" });
    try {
      const rows = await db.select().from(promoCodes)
        .where(eq(promoCodes.code, code.trim().toUpperCase())).limit(1);
      if (!rows.length) return res.json({ valid: false, message: "Invalid promo code" });
      const p = rows[0];
      if (!p.active) return res.json({ valid: false, message: "This promo code is no longer active" });
      if (p.usesCount >= p.maxUses) return res.json({ valid: false, message: "All promo slots have been claimed — thank you!" });
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
    const { code, discountAmount, maxUses, active } = req.body as { code: string; discountAmount: number; maxUses: number; active: boolean };
    if (!code?.trim()) return res.status(400).json({ message: "Code is required" });
    const cleanCode = code.trim().toUpperCase();
    await db.insert(promoCodes).values({ code: cleanCode, discountAmount: String(discountAmount), maxUses, active })
      .onConflictDoUpdate({ target: promoCodes.code, set: { discountAmount: String(discountAmount), maxUses, active } });
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
    const FALLBACK_TOKEN = "71b6a589b4d46338fa149e8371ddaa9878f71a07ad831cada2864bd3231178b1";
    const expectedToken = process.env.BUILD_WEBHOOK_TOKEN || FALLBACK_TOKEN;
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
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[Admin] Chat send failed:", err?.message);
      res.status(500).json({ message: err?.message || "Failed to send WhatsApp message" });
    }
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
          model: "gpt-4o-mini",
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
        item.detectedName.toLowerCase().includes(c.name.toLowerCase())
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

    // ── Bulk discount (same tiers as web / Estimate page) ─────────────────────
    const totalQtyB = aiParsedItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
    const discountTierB = PricingConfig.bulkDiscount.find((t: { minQty: number; pct: number }) => totalQtyB >= t.minQty);
    const discountPctB = discountTierB?.pct ?? 0;
    const discountAmountB = Math.round(totalEstimate * discountPctB * 100) / 100;
    if (discountAmountB > 0) {
      totalEstimate -= discountAmountB;
      quoteItems.push({ originalDescription: `Bulk Discount (${Math.round(discountPctB * 100)}% off, ${totalQtyB} items)`, detectedName: `Bulk Discount (${Math.round(discountPctB * 100)}% off)`, serviceType: "discount", quantity: 1, unitPrice: (-discountAmountB).toFixed(2), subtotal: (-discountAmountB).toFixed(2), catalogItemId: undefined });
    }

    const MIN_CHARGE = 180;
    const minAdjustment = totalEstimate < MIN_CHARGE ? MIN_CHARGE - totalEstimate : 0;
    const laborTotal = totalEstimate + minAdjustment;
    if (minAdjustment > 0) {
      quoteItems.push({ originalDescription: "Minimum Charge Adjustment", detectedName: "Minimum Charge Adjustment", serviceType: "adjustment", quantity: 1, unitPrice: minAdjustment.toFixed(2), subtotal: minAdjustment.toFixed(2), catalogItemId: undefined });
    }

    const sessionFloorLevel = session.floorLevel ?? 1;
    const sessionHasLift = session.hasLift ?? true;
    const floorsAboveGround = Math.max(0, sessionFloorLevel - 1);
    const floorSurcharge = floorsAboveGround * (sessionHasLift ? PricingConfig.floor.perFloorWithLift : PricingConfig.floor.perFloorNoLift);
    if (floorSurcharge > 0) {
      quoteItems.push({ originalDescription: `Floor Surcharge (Floor ${sessionFloorLevel}, ${sessionHasLift ? "lift" : "no lift"})`, detectedName: "Stairs / Floor Access", serviceType: "surcharge", quantity: 1, unitPrice: floorSurcharge.toFixed(2), subtotal: floorSurcharge.toFixed(2), catalogItemId: undefined });
    }

    const sessionAccess = session.accessDifficulty ?? "easy";
    const accessPct = sessionAccess === "medium" ? PricingConfig.access.mediumPct : sessionAccess === "hard" ? PricingConfig.access.hardPct : 0;
    const accessSurcharge = Math.round(laborTotal * accessPct * 100) / 100;
    if (accessSurcharge > 0) {
      quoteItems.push({ originalDescription: `Access Difficulty (${sessionAccess === "medium" ? "Moderate" : "Difficult"})`, detectedName: `Access Difficulty`, serviceType: "surcharge", quantity: 1, unitPrice: accessSurcharge.toFixed(2), subtotal: accessSurcharge.toFixed(2), catalogItemId: undefined });
    }

    const laborTotalWithSurcharges = laborTotal + floorSurcharge + accessSurcharge;
    const sessionDistKm = session.distanceKm ? parseFloat(session.distanceKm) : 0;
    const transportFee = session.isRelocation ? calcTransportFee(sessionDistKm) : 0;
    const grandTotal = laborTotalWithSurcharges + transportFee;

    const refNo = `TMG-${randomBytes(2).toString("hex").toUpperCase()}`;
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

    // Mark session as submitted but keep botPaused so admin stays in control
    await storage.upsertWhatsAppSession(phone, { state: "submitted" });

    res.json({ ok: true, quoteId: quote.id, referenceNo: quote.referenceNo });
  });

  return httpServer;
}
