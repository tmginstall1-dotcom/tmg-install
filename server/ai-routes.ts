/**
 * AI Operations Layer — Isolated routes under /api/ai/*
 *
 * CHANGE-CONTROL RULES:
 * - These routes ONLY read from existing production tables.
 * - All writes go to new ai_* tables.
 * - No modification of existing booking/payment/admin/staff logic.
 * - Master kill switch: ai_master_kill_switch = TRUE disables all automations.
 */

import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, desc, and, gte, sql, count, lt, inArray } from "drizzle-orm";
import {
  aiFeatureFlags,
  aiAttributionEvents,
  aiAdsSnapshots,
  aiAdRecommendations,
  aiSiteAudits,
  aiSiteRecommendations,
  aiApprovalQueue,
  aiAuditLog,
  aiConnectorConfigs,
  aiSearchConsoleData,
  aiPagespeedData,
  aiPlatformExecutions,
  aiWhatsappFollowups,
  aiWhatsappHandoffs,
  appSettings,
  whatsappSessions,
  siteSettings,
  quotes,
  customers,
  catalogItems,
} from "@shared/schema";
import { callLLM } from "./ai-llm-client";
import { requiresFullUpfront } from "@shared/pricing";
import {
  executePlatformAction,
  gadsExecCredsCheck,
  metaExecCredsCheck,
  type PlatformExecutionResult,
} from "./ad-executor";
import { z } from "zod";
import { storage } from "./storage";
import { createRateLimiter } from "./lib/rate-limit";

// Rate limiters — defence-in-depth so a runaway client or compromised admin
// session can't drain OpenAI credits. Tuned for normal admin workloads.
const aiGeneralLimiter = createRateLimiter({ name: "ai-general", windowMs: 60_000, max: 60 });   // 60 req/min/user across /api/ai/*
const aiLlmLimiter     = createRateLimiter({ name: "ai-llm",     windowMs: 60_000, max: 20 });   // 20 LLM-calling endpoints/min/user

// ── Lazy OpenAI client — never crashes server startup if key is missing ───────
let _openai: any = null;
function getOpenAI() {
  if (_openai) return _openai;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { openai } = require("./replit_integrations/audio/client");
    _openai = openai;
    return _openai;
  } catch {
    throw new Error("AI integration client unavailable. Check AI_INTEGRATIONS_OPENAI_API_KEY.");
  }
}

// ── Auth guard (admin only — full role check, mirrors existing admin routes) ──
async function requireAdmin(req: Request, res: Response, next: () => void) {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const user = await storage.getUserById(userId);
  if (!user || user.role !== "admin") return res.status(403).json({ message: "Forbidden" });
  next();
}

// ── Helper: get flag value ────────────────────────────────────────────────────
async function getFlag(key: string): Promise<boolean> {
  try {
    const rows = await db.select().from(aiFeatureFlags).where(eq(aiFeatureFlags.key, key)).limit(1);
    return rows[0]?.value ?? false;
  } catch { return false; }
}

// ── Helper: write audit log (fire-and-forget) ─────────────────────────────────
export async function logAiAction(
  actionType: string,
  actor: string,
  module: string,
  summary: string,
  detail?: Record<string, unknown>,
  outcome = "success",
) {
  try {
    await db.insert(aiAuditLog).values({ actionType, actor, module, summary, detail, outcome });
  } catch { /* non-fatal */ }
}

// ── Helper: log attribution event (called from existing routes, fire-and-forget) ─
export async function logAttributionEvent(
  quoteId: number,
  referenceNo: string,
  eventType: string,
  quoteValue: number,
  source?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await db.insert(aiAttributionEvents).values({
      quoteId,
      referenceNo,
      eventType,
      source: source ?? null,
      quoteValue: quoteValue.toFixed(2) as any,
      metadata,
    });
  } catch { /* non-fatal — never break live flow */ }
}

// ── Phase 2: Connector credential checks & helpers ────────────────────────────

function gadsCredsCheck() {
  const needed: Record<string, string | undefined> = {
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_CUSTOMER_ID: process.env.GOOGLE_ADS_CUSTOMER_ID,
    GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_REFRESH_TOKEN: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  };
  return Object.entries(needed).filter(([, v]) => !v).map(([k]) => k);
}
function metaCredsCheck() {
  return ([
    !process.env.META_ACCESS_TOKEN ? "META_ACCESS_TOKEN" : null,
    !process.env.META_AD_ACCOUNT_ID ? "META_AD_ACCOUNT_ID" : null,
  ] as (string | null)[]).filter(Boolean) as string[];
}
function gscCredsCheck() {
  return ([
    !process.env.GSC_CLIENT_ID ? "GSC_CLIENT_ID" : null,
    !process.env.GSC_CLIENT_SECRET ? "GSC_CLIENT_SECRET" : null,
    !process.env.GSC_REFRESH_TOKEN ? "GSC_REFRESH_TOKEN" : null,
  ] as (string | null)[]).filter(Boolean) as string[];
}

async function googleAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const r = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }).toString(),
  }, 15_000);
  const j: any = await r.json();
  if (!j.access_token) throw new Error(`OAuth error: ${j.error ?? "unknown"}`);
  return j.access_token as string;
}

async function setConnectorSync(name: string, status: "running" | "success" | "error", error?: string) {
  try {
    await db.update(aiConnectorConfigs)
      .set({ lastSyncAt: status !== "running" ? new Date() : undefined, lastSyncStatus: status, syncError: error ?? null, updatedAt: new Date() })
      .where(eq(aiConnectorConfigs.name, name));
  } catch { /* non-fatal */ }
}

/** Returns true if connector is already syncing (concurrent sync guard). */
async function isSyncRunning(name: string): Promise<boolean> {
  try {
    const [cfg] = await db.select({ status: aiConnectorConfigs.lastSyncStatus })
      .from(aiConnectorConfigs).where(eq(aiConnectorConfigs.name, name)).limit(1);
    return cfg?.status === "running";
  } catch { return false; }
}

/**
 * fetch() wrapper with a hard timeout (default 30 s).
 * Throws if the request takes longer than timeoutMs.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Phase 6: Allowed types for auto-execution on approval ────────────────────
// These types generate structured deliverables ONLY — never call live APIs.
const AUTO_EXECUTE_TYPES = new Set(["negative_keyword", "creative", "site_change", "landing_page"]);

// Action types that should be pushed to the live ad platform automatically on approve
const AUTO_PLATFORM_EXECUTE_TYPES = new Set(["negative_keyword", "pause_ad", "enable_ad", "pause_adset", "enable_adset", "pause_ad_group", "enable_ad_group"]);

/**
 * applySiteChangeToLive — writes an approved site_change recommendation directly
 * into the site_settings KV table so the frontend picks it up immediately.
 * Used by the auto-execute flow after admin approval.
 */
async function applySiteChangeToLive(item: typeof aiApprovalQueue.$inferSelect, actor: string): Promise<{ applied: string[]; page: string }> {
  const pa = (item.proposedAction as any) ?? {};
  const sc = pa.suggestedChanges ?? {};
  const page = pa.targetPage || "/";
  const applied: string[] = [];

  const writes: Array<{ field: string; value: string | undefined }> = [
    { field: "meta_title",       value: sc.titleTag },
    { field: "meta_description", value: sc.metaDescription },
    { field: "h1",               value: sc.h1Suggestion },
    { field: "cta_text",         value: sc.ctaText },
  ];

  for (const w of writes) {
    if (!w.value || typeof w.value !== "string") continue;
    const key = `${w.field}:${page}`;
    // Capture the existing value FIRST so rollback can restore it
    const [existing] = await db.select().from(siteSettings).where(eq(siteSettings.settingKey, key)).limit(1);
    const previousValue = existing?.settingValue ?? null;
    await db.insert(siteSettings)
      .values({ settingKey: key, settingValue: w.value, previousValue, page, field: w.field, source: "ai_agent", updatedBy: actor })
      .onConflictDoUpdate({
        target: siteSettings.settingKey,
        set: { settingValue: w.value, previousValue, page, field: w.field, source: "ai_agent", updatedAt: new Date(), updatedBy: actor },
      });
    applied.push(w.field);
  }
  return { applied, page };
}

type ApprovalItem = typeof aiApprovalQueue.$inferSelect;

/**
 * buildAndPersistExecution — shared core for both manual execute route and
 * approval-triggered auto-execution. Generates the structured deliverable,
 * persists it, marks the linked rec as applied, and writes the audit log.
 * NEVER calls Google Ads, Meta, or modifies the live site.
 */
async function buildAndPersistExecution(
  item: ApprovalItem,
  actor: string,
  autoExecuted: boolean,
): Promise<any> {
  const pa = item.proposedAction as any ?? {};
  const now = new Date().toISOString();

  let executionResult: any;

  if (item.queueType === "negative_keyword") {
    const keywords: Array<{ term: string; matchType: string }> = pa.negativeKeywords ?? [];
    const csvRows = ["Keyword,Match Type", ...keywords.map((k: any) => `${k.term},${k.matchType}`)];
    executionResult = {
      type: "negative_keywords_export",
      title: item.title,
      campaignName: pa.campaignName ?? "N/A",
      negativeCount: keywords.length,
      csvContent: csvRows.join("\n"),
      deliverable: csvRows.join("\n"),
      implementationSteps: [
        "1. Log in to Google Ads (ads.google.com)",
        `2. Navigate to: Campaigns → "${pa.campaignName ?? "[campaign name]"}"`,
        "3. In the left menu, click Keywords → Negative keywords",
        "4. Click the blue ＋ button → Add negative keywords",
        "5. Select 'Add to campaign' level",
        "6. Paste the keyword list from the CSV above, one keyword per line",
        "7. Set match type to 'Broad' for general terms, 'Exact' for high-risk terms",
        "8. Click Save",
        "9. Monitor impressions over the next 48–72 hours for traffic impact",
      ],
      estimatedTime: "5–10 minutes",
      platform: "Google Ads",
      rollbackNote: item.rollbackPath ?? "Remove the negative keywords from the same Negative Keywords tab to restore original targeting.",
      generatedAt: now,
      generatedBy: actor,
    };

  } else if (item.queueType === "creative") {
    const headlines: string[] = pa.headlines ?? [];
    const descriptions: string[] = pa.descriptions ?? [];
    const formattedSpec = [
      `=== RESPONSIVE SEARCH AD SPEC ===`,
      `Campaign: ${pa.campaignName ?? "N/A"}`,
      ``,
      `HEADLINES (add all — Google rotates automatically):`,
      ...headlines.map((h: string, i: number) => `  H${i + 1}: ${h}`),
      ``,
      `DESCRIPTIONS (add all — Google rotates automatically):`,
      ...descriptions.map((d: string, i: number) => `  D${i + 1}: ${d}`),
      ``,
      `CHARACTER LIMITS: Headlines ≤ 30 chars · Descriptions ≤ 90 chars`,
      `Verify all headlines are within limit before saving.`,
    ].join("\n");
    executionResult = {
      type: "ad_copy_spec",
      title: item.title,
      campaignName: pa.campaignName ?? "N/A",
      headlines,
      descriptions,
      deliverable: formattedSpec,
      implementationSteps: [
        "1. Log in to Google Ads (ads.google.com)",
        `2. Navigate to: Campaigns → "${pa.campaignName ?? "[campaign]"}" → Ads`,
        "3. Click ＋ New ad → Responsive search ad",
        "4. Copy headlines from the spec above into headline fields 1–3 (and optionally 4–5)",
        "5. Copy descriptions from the spec above into description fields 1–2",
        "6. Set the Final URL to the campaign's existing landing page",
        "7. Preview the ad — verify all combinations look professional",
        "8. Set display path if desired",
        "9. Save as a DRAFT first — do not set to 'Enabled' until reviewed",
        "10. After 7 days, compare CTR of new ad vs existing ads in the Ad Variations report",
      ],
      estimatedTime: "10–15 minutes",
      platform: "Google Ads",
      rollbackNote: item.rollbackPath ?? "Pause or delete the new ad variation before it collects significant impressions.",
      generatedAt: now,
      generatedBy: actor,
    };

  } else if (item.queueType === "site_change") {
    const isLandingPage = pa.action === "update_landing_page" || !!pa.suggestedChanges;

    if (isLandingPage) {
      const sc = pa.suggestedChanges ?? {};
      const brief = [
        `=== LANDING PAGE OPTIMISATION BRIEF ===`,
        `Target Page : ${pa.targetPage ?? "N/A"}`,
        `Target Query: ${pa.targetQuery ?? "N/A"}`,
        `Current Pos : ${pa.currentPosition ?? "N/A"} · CTR: ${pa.currentCTR ?? "N/A"}%`,
        ``,
        `PROPOSED CHANGES:`,
        sc.titleTag        ? `  Title Tag    : ${sc.titleTag}` : null,
        sc.metaDescription ? `  Meta Desc    : ${sc.metaDescription}` : null,
        sc.h1Suggestion    ? `  H1 Heading   : ${sc.h1Suggestion}` : null,
        sc.ctaText         ? `  CTA Button   : ${sc.ctaText}` : null,
        ``,
        `PRIORITY: High — organic traffic opportunity`,
      ].filter(Boolean).join("\n");
      executionResult = {
        type: "landing_page_brief",
        title: item.title,
        targetPage: pa.targetPage ?? "N/A",
        targetQuery: pa.targetQuery ?? "N/A",
        proposedChanges: sc,
        deliverable: brief,
        implementationSteps: [
          "1. Share this brief with your web developer or content editor",
          "2. Open the target page in your CMS or code editor",
          `3. Update the <title> tag to: "${sc.titleTag ?? "[see brief]"}"`,
          `4. Update the meta description to: "${sc.metaDescription ?? "[see brief]"}"`,
          `5. Update or add an H1 tag: "${sc.h1Suggestion ?? "[see brief]"}"`,
          "6. Add or update the primary CTA button text and placement",
          "7. Deploy to staging — check with Google Search Console URL Inspection",
          "8. Publish to production",
          "9. Monitor CTR in Search Console for this query over 14–21 days",
        ],
        estimatedTime: "30–60 minutes (developer + content editor)",
        platform: "Website / CMS",
        rollbackNote: item.rollbackPath ?? "Revert the page in your version control system (git revert) or restore the previous CMS version. No database changes are involved.",
        generatedAt: now,
        generatedBy: actor,
      };
    } else {
      const suggestedChange = pa.suggestedChange ?? item.description ?? "See proposed action details.";
      const copySpec = [
        `=== CRO COPY CHANGE SPEC ===`,
        `Action  : ${item.title}`,
        `Priority: ${pa.priority ?? "medium"}`,
        ``,
        `PROPOSED COPY CHANGE:`,
        suggestedChange,
        ``,
        `IMPLEMENTATION CHECKLIST:`,
        `  [ ] Identify the exact location on the page`,
        `  [ ] Create a staging copy`,
        `  [ ] Implement the change on staging`,
        `  [ ] QA on mobile (320px), tablet (768px), desktop (1280px)`,
        `  [ ] Deploy to production`,
        `  [ ] Note the publish date for A/B analysis`,
      ].join("\n");
      executionResult = {
        type: "cro_copy_brief",
        title: item.title,
        priority: pa.priority ?? "medium",
        deliverable: copySpec,
        suggestedChange,
        implementationSteps: [
          "1. Identify the exact location on the live page where this change applies",
          "2. Create a staging branch or duplicate the page in your CMS",
          "3. Apply the copy change exactly as written in the spec above",
          "4. QA the page at mobile (320px), tablet (768px), and desktop (1280px) breakpoints",
          "5. Check that the new copy does not break any layout constraints",
          "6. Get sign-off from the business owner if required",
          "7. Deploy to production",
          "8. Record the publish date — measure conversion impact after 14–21 days",
        ],
        estimatedTime: "2–4 hours (developer + designer)",
        platform: "Website / CMS",
        rollbackNote: item.rollbackPath ?? "Revert the page to its previous state via version control or CMS version history.",
        generatedAt: now,
        generatedBy: actor,
      };
    }

  } else {
    const action = pa.action ?? item.queueType;
    const target = pa.campaignName ?? pa.targetName ?? "N/A";
    const spec = [
      `=== ADS CHANGE SPEC ===`,
      `Action  : ${action?.toUpperCase()}`,
      `Platform: ${pa.platform ?? "N/A"}`,
      `Target  : ${target}`,
      ``,
      `REASON: ${item.description ?? "See recommendation record."}`,
      ``,
      `EXPECTED IMPACT: ${item.expectedImpact ?? "See recommendation record."}`,
    ].join("\n");
    executionResult = {
      type: "ads_change_spec",
      title: item.title,
      action,
      target,
      platform: pa.platform ?? "N/A",
      deliverable: spec,
      implementationSteps: [
        `1. Log in to your ads platform (${pa.platform === "meta" ? "Meta Ads Manager" : "Google Ads"})`,
        `2. Navigate to the campaign or ad set: "${target}"`,
        `3. Apply the action: ${action?.toUpperCase()}`,
        "4. Confirm the change and note the timestamp",
        "5. Set a reminder to review performance in 7 days",
      ],
      estimatedTime: "5–15 minutes",
      platform: pa.platform === "meta" ? "Meta Ads Manager" : "Google Ads",
      rollbackNote: item.rollbackPath ?? "Reverse the specific change (re-enable paused campaign, revert budget, etc.) in the ads platform.",
      generatedAt: now,
      generatedBy: actor,
    };
  }

  // Tag execution mode for UI display
  executionResult.autoExecuted = autoExecuted;

  // ── Persist ──────────────────────────────────────────────────────────────
  await db.update(aiApprovalQueue)
    .set({
      executionStatus: "executed",
      executedAt: new Date(),
      executedBy: actor,
      executionResult: executionResult as any,
    })
    .where(eq(aiApprovalQueue.id, item.id));

  // Mark linked recommendation as "applied"
  if (item.refType === "ad_recommendation" && item.refId) {
    await db.update(aiAdRecommendations)
      .set({ status: "applied", appliedAt: new Date() })
      .where(eq(aiAdRecommendations.id, item.refId));
  }
  if (item.refType === "site_recommendation" && item.refId) {
    await db.update(aiSiteRecommendations)
      .set({ status: "applied", appliedAt: new Date(), approvedBy: actor })
      .where(eq(aiSiteRecommendations.id, item.refId));
  }

  // ── Audit log ────────────────────────────────────────────────────────────
  await logAiAction(
    "action_executed",
    actor,
    item.queueType?.startsWith("site") || item.queueType === "site_change" ? "site" : "ads",
    `${autoExecuted ? "AUTO-EXECUTED" : "EXECUTED"}: ${item.title}`,
    {
      approvalId: item.id,
      queueType: item.queueType,
      executionType: executionResult.type,
      autoExecuted,
      refType: item.refType,
      refId: item.refId,
      actor,
      deliverableLength: executionResult.deliverable?.length ?? 0,
      implementationSteps: executionResult.implementationSteps?.length ?? 0,
      estimatedTime: executionResult.estimatedTime,
      platform: executionResult.platform,
      rollbackNote: executionResult.rollbackNote,
    },
  );

  return executionResult;
}

export function registerAiRoutes(app: Express) {

  // Apply general rate limiter to ALL /api/ai/* routes (60 req/min/user).
  // LLM-heavy endpoints get an additional, tighter limiter applied per-route.
  app.use("/api/ai", aiGeneralLimiter);

  // ════════════════════════════════════════════════════════════════════════════
  // FEATURE FLAGS
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/flags — list all feature flags */
  app.get("/api/ai/flags", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const flags = await db.select().from(aiFeatureFlags).orderBy(aiFeatureFlags.key);
      res.json(flags);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  /** PATCH /api/ai/flags/:key — toggle a flag value */
  app.patch("/api/ai/flags/:key", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const { value } = z.object({ value: z.boolean() }).parse(req.body);
      const actor = (req as any).user?.username || "admin";
      await db.update(aiFeatureFlags)
        .set({ value, updatedAt: new Date(), updatedBy: actor })
        .where(eq(aiFeatureFlags.key, key));
      await logAiAction("flag_changed", actor, "flags",
        `Flag '${key}' set to ${value}`, { key, value });
      const rows = await db.select().from(aiFeatureFlags).where(eq(aiFeatureFlags.key, key)).limit(1);
      res.json(rows[0]);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "DB error" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ATTRIBUTION — Conversion funnel (read from live quotes + ai_attribution_events)
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/attribution/funnel — conversion funnel stats from live quotes */
  app.get("/api/ai/attribution/funnel", requireAdmin, async (_req: Request, res: Response) => {
    try {
      // Read-only from production quotes table
      const allQuotes = await db.select({
        id: quotes.id,
        status: quotes.status,
        total: quotes.total,
        sourceChannel: quotes.sourceChannel,
        createdAt: quotes.createdAt,
        depositPaidAt: quotes.depositPaidAt,
        finalPaidAt: quotes.finalPaidAt,
        scheduledAt: quotes.scheduledAt,
      }).from(quotes).orderBy(desc(quotes.createdAt));

      const totalLeads = allQuotes.length;
      const quoteSent = allQuotes.filter(q => !["submitted","under_review"].includes(q.status ?? "")).length;
      const depositPaid = allQuotes.filter(q => q.depositPaidAt != null ||
        ["deposit_paid","booked","assigned","in_progress","completed","final_payment_requested","paid"].includes(q.status ?? "")).length;
      const booked = allQuotes.filter(q => ["booked","assigned","in_progress","completed","final_payment_requested","paid"].includes(q.status ?? "")).length;
      const finalPaid = allQuotes.filter(q => q.finalPaidAt != null || q.status === "paid").length;

      const totalRevenue = allQuotes
        .filter(q => q.finalPaidAt != null || q.status === "paid")
        .reduce((s, q) => s + parseFloat(q.total ?? "0"), 0);

      const byChannel: Record<string, number> = {};
      allQuotes.forEach(q => {
        const ch = q.sourceChannel ?? "unknown";
        byChannel[ch] = (byChannel[ch] ?? 0) + 1;
      });

      // Recent attribution events
      const recentEvents = await db.select()
        .from(aiAttributionEvents)
        .orderBy(desc(aiAttributionEvents.createdAt))
        .limit(50);

      res.json({
        funnel: {
          leads: totalLeads,
          quoteSent,
          depositPaid,
          booked,
          finalPaid,
          totalRevenue: totalRevenue.toFixed(2),
        },
        byChannel,
        recentEvents,
        depositCpa: depositPaid > 0 ? "—" : "0",
      });
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  /** GET /api/ai/attribution/events — paginated attribution events log */
  app.get("/api/ai/attribution/events", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) ?? "100"), 200);
      const events = await db.select()
        .from(aiAttributionEvents)
        .orderBy(desc(aiAttributionEvents.createdAt))
        .limit(limit);
      res.json(events);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ADS SNAPSHOTS — Manual data entry (Google/Meta APIs not yet connected)
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/ads/snapshots */
  app.get("/api/ai/ads/snapshots", requireAdmin, async (req: Request, res: Response) => {
    try {
      const platform = req.query.platform as string | undefined;
      const rows = platform
        ? await db.select().from(aiAdsSnapshots).where(eq(aiAdsSnapshots.platform, platform)).orderBy(desc(aiAdsSnapshots.snapshotDate)).limit(200)
        : await db.select().from(aiAdsSnapshots).orderBy(desc(aiAdsSnapshots.snapshotDate)).limit(200);
      res.json(rows);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  /** POST /api/ai/ads/snapshots — add a manual ads data entry */
  app.post("/api/ai/ads/snapshots", requireAdmin, async (req: Request, res: Response) => {
    try {
      const body = z.object({
        platform: z.enum(["google", "meta"]),
        snapshotDate: z.string(),
        campaignName: z.string().optional(),
        adSetName: z.string().optional(),
        spend: z.number().optional(),
        impressions: z.number().int().optional(),
        clicks: z.number().int().optional(),
        conversions: z.number().optional(),
        conversionValue: z.number().optional(),
      }).parse(req.body);

      const spend = body.spend ?? 0;
      const clicks = body.clicks ?? 0;
      const conversions = body.conversions ?? 0;
      const ctr = body.impressions ? ((clicks / body.impressions) * 100) : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpl = conversions > 0 ? spend / conversions : 0;

      const [row] = await db.insert(aiAdsSnapshots).values({
        ...body,
        spend: spend.toFixed(2) as any,
        ctr: ctr.toFixed(4) as any,
        cpc: cpc.toFixed(4) as any,
        cpl: cpl.toFixed(4) as any,
      }).returning();

      await logAiAction("snapshot_added", "admin", "ads",
        `Added ${body.platform} snapshot for ${body.snapshotDate}`);
      res.json(row);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "DB error" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ADS ANALYST AGENT — AI-powered analysis of performance data
  // ════════════════════════════════════════════════════════════════════════════

  /** POST /api/ai/ads/analyze — trigger AI analysis, generate recommendations */
  app.post("/api/ai/ads/analyze", requireAdmin, async (req: Request, res: Response) => {
    try {
      const killSwitch = await getFlag("ai_master_kill_switch");
      const adsEnabled = await getFlag("ai_ads_enabled");
      if (killSwitch) return res.status(503).json({ message: "AI master kill switch is active." });
      if (!adsEnabled) return res.status(503).json({ message: "AI ads analysis is disabled." });

      // Fetch recent snapshots
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const snapshots = await db.select().from(aiAdsSnapshots)
        .where(gte(aiAdsSnapshots.snapshotDate, thirtyDaysAgo))
        .orderBy(desc(aiAdsSnapshots.snapshotDate))
        .limit(100);

      if (snapshots.length === 0) {
        return res.status(400).json({ message: "No ads data found. Add snapshots first." });
      }

      // Fetch funnel context from live quotes (read-only)
      const recentQuotes = await db.select({
        status: quotes.status,
        total: quotes.total,
        sourceChannel: quotes.sourceChannel,
      }).from(quotes)
        .where(gte(quotes.createdAt as any, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
        .limit(200);

      const totalSpend = snapshots.reduce((s, r) => s + parseFloat(r.spend ?? "0"), 0);
      const totalClicks = snapshots.reduce((s, r) => s + (r.clicks ?? 0), 0);
      const totalConversions = snapshots.reduce((s, r) => s + parseFloat(r.conversions ?? "0"), 0);
      const depositPaidCount = recentQuotes.filter(q =>
        ["deposit_paid","booked","assigned","in_progress","completed","final_payment_requested","paid"].includes(q.status ?? "")).length;

      const prompt = `You are an expert Google/Meta Ads analyst for TMGInstall.com, a furniture installation service in Singapore.

BUSINESS CONTEXT:
- Service: Furniture installation, dismantling, relocation
- Primary KPI: Deposit-paid CPA (cost per deposit)
- Secondary KPI: Qualified lead CPA
- Location: Singapore

ADS DATA (last 30 days):
Total Spend: SGD ${totalSpend.toFixed(2)}
Total Clicks: ${totalClicks}
Total Conversions (form/whatsapp): ${totalConversions}
Deposit-Paid Jobs (from CRM): ${depositPaidCount}

CAMPAIGNS/AD SETS:
${snapshots.slice(0, 20).map(s =>
  `- ${s.platform?.toUpperCase()} | ${s.campaignName ?? "Unknown"} | ${s.adSetName ?? ""} | Spend: $${s.spend} | Clicks: ${s.clicks} | Conversions: ${s.conversions} | CPC: $${s.cpc} | CPL: $${s.cpl}`
).join("\n")}

Generate 3-6 specific, actionable recommendations. For each recommendation, return JSON with:
{
  "action": "cut|keep|scale|test|fix-tracking|pause|negate",
  "platform": "google|meta|both",
  "targetType": "campaign|ad_group|keyword|ad",
  "targetName": "name of the target",
  "riskLevel": "low|medium|high",
  "reason": "clear explanation based on data",
  "expectedEffect": "what improvement is expected",
  "confidence": 0-100
}

Return ONLY a JSON array of recommendations. No explanations outside the JSON.`;

      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      let recommendations: any[] = [];
      try {
        const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
        recommendations = parsed.recommendations ?? (Array.isArray(parsed) ? parsed : [parsed]);
      } catch { recommendations = []; }

      // Save recommendations to DB and create approval queue items for non-low-risk
      const savedRecs: any[] = [];
      for (const rec of recommendations) {
        const [saved] = await db.insert(aiAdRecommendations).values({
          platform: rec.platform,
          action: rec.action ?? "test",
          riskLevel: rec.riskLevel ?? "medium",
          targetType: rec.targetType,
          targetName: rec.targetName,
          reason: rec.reason,
          confidence: rec.confidence?.toFixed(2) as any,
          expectedEffect: rec.expectedEffect,
          status: "pending",
        }).returning();
        savedRecs.push(saved);

        // Auto-queue medium/high-risk items for approval
        if (rec.riskLevel !== "low") {
          await db.insert(aiApprovalQueue).values({
            queueType: "ads_change",
            title: `${rec.action?.toUpperCase()}: ${rec.targetName}`,
            description: rec.reason,
            riskLevel: rec.riskLevel,
            confidence: rec.confidence?.toFixed(2) as any,
            expectedImpact: rec.expectedEffect,
            proposedAction: rec as any,
            refType: "ad_recommendation",
            refId: saved.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
        }
      }

      await logAiAction("recommendation_generated", "ai_agent", "ads",
        `Generated ${savedRecs.length} ads recommendations`, { count: savedRecs.length, spend: totalSpend });

      res.json({ recommendations: savedRecs, analysisContext: { totalSpend, totalClicks, totalConversions, depositPaidCount } });
    } catch (err: any) {
      console.error("[AI ads analyze]", err);
      res.status(500).json({ message: err.message || "AI analysis failed" });
    }
  });

  /** GET /api/ai/ads/recommendations */
  app.get("/api/ai/ads/recommendations", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const recs = await db.select().from(aiAdRecommendations).orderBy(desc(aiAdRecommendations.createdAt)).limit(100);
      res.json(recs);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SITE AUDIT AGENT — AI-powered CRO / SEO / Speed analysis
  // ════════════════════════════════════════════════════════════════════════════

  /** POST /api/ai/site/audit — run a new site audit */
  app.post("/api/ai/site/audit", requireAdmin, async (req: Request, res: Response) => {
    try {
      const killSwitch = await getFlag("ai_master_kill_switch");
      const auditEnabled = await getFlag("ai_site_audit_enabled");
      if (killSwitch) return res.status(503).json({ message: "AI master kill switch is active." });
      if (!auditEnabled) return res.status(503).json({ message: "AI site audit is disabled." });

      const { auditType = "full" } = z.object({
        auditType: z.enum(["cro", "seo", "speed", "full"]).default("full"),
      }).parse(req.body);

      const actor = (req as any).user?.username || "admin";

      // Create audit record in running state
      const [audit] = await db.insert(aiSiteAudits).values({
        auditType,
        status: "running",
        triggeredBy: actor,
      }).returning();

      // Respond immediately — analysis runs async
      res.json({ auditId: audit.id, status: "running", message: "Audit started. Check /api/ai/site/audits for results." });

      // Run the AI analysis asynchronously
      (async () => {
        try {
          // Read existing quotes for business context (read-only)
          const recentQuotes = await db.select({
            status: quotes.status,
            sourceChannel: quotes.sourceChannel,
            total: quotes.total,
          }).from(quotes).limit(100);

          const channelBreakdown: Record<string, number> = {};
          recentQuotes.forEach(q => {
            const ch = q.sourceChannel ?? "unknown";
            channelBreakdown[ch] = (channelBreakdown[ch] ?? 0) + 1;
          });
          const totalQuotes = recentQuotes.length;
          const converted = recentQuotes.filter(q =>
            ["deposit_paid","booked","assigned","in_progress","completed","final_payment_requested","paid"].includes(q.status ?? "")).length;

          const prompt = `You are a senior CRO/SEO/UX consultant auditing TMGInstall.com, a Singapore furniture installation and relocation company.

BUSINESS CONTEXT:
- Services: Furniture installation, dismantling, relocation, disposal
- Conversion goal: WhatsApp inquiry or online quote submission → deposit paid
- Current quote count: ${totalQuotes} (${converted} converted to deposit, ${((converted/Math.max(totalQuotes,1))*100).toFixed(0)}% rate)
- Lead channels: ${JSON.stringify(channelBreakdown)}
- Target audience: Singapore homeowners, tenants moving, office managers
- Key competitors: Similar furniture assembly services in Singapore
- Key trust signals needed: Licensed, experienced, efficient, affordable

AUDIT TYPE: ${auditType === "full" ? "CRO + SEO + Trust + Speed + Copy" : auditType.toUpperCase()}

Analyze the following pages and elements of TMGInstall.com and provide specific improvement recommendations:

PAGES TO AUDIT:
1. Homepage (/) — hero section, CTAs, service overview, trust signals, WhatsApp button
2. Estimate Wizard (/estimate) — form friction, steps, conversion flow
3. Quote Status (/quotes/:id) — clarity, next steps, payment UX
4. General — mobile performance, page speed, SEO structure, meta tags, schema markup, internal links

For EACH finding, return a JSON object:
{
  "category": "cro|seo|speed|trust|copy|layout",
  "priority": "critical|high|medium|low",
  "page": "/ or /estimate or /quotes/:id or global",
  "title": "Short title of the issue",
  "description": "What's wrong and why it matters",
  "suggestedChange": "Specific concrete fix — what to change and how",
  "riskLevel": "low|medium|high",
  "estimatedImpact": "% lift or qualitative improvement expected"
}

Return ONLY: {"score": 0-100, "summary": "2-sentence overall assessment", "findings": [...array of finding objects...]}`;

          const completion = await getOpenAI().chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.4,
          });

          let parsed: any = {};
          try { parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}"); } catch {}

          const findings = parsed.findings ?? [];
          const score = parsed.score ?? 70;
          const summary = parsed.summary ?? "Audit complete.";

          // Save recommendations
          for (const finding of findings) {
            const [rec] = await db.insert(aiSiteRecommendations).values({
              auditId: audit.id,
              category: finding.category ?? "cro",
              priority: finding.priority ?? "medium",
              page: finding.page,
              title: finding.title,
              description: finding.description,
              suggestedChange: finding.suggestedChange,
              riskLevel: finding.riskLevel ?? "low",
              status: "open",
            }).returning();

            // Queue high/critical items for approval
            if (["critical","high"].includes(finding.priority ?? "")) {
              await db.insert(aiApprovalQueue).values({
                queueType: "site_change",
                title: finding.title,
                description: finding.description,
                riskLevel: finding.riskLevel ?? "low",
                confidence: "80.00" as any,
                expectedImpact: finding.estimatedImpact,
                proposedAction: finding as any,
                refType: "site_recommendation",
                refId: rec.id,
                expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              });
            }
          }

          // Mark audit complete
          await db.update(aiSiteAudits)
            .set({ status: "complete", score, summary, findings: findings as any, completedAt: new Date() })
            .where(eq(aiSiteAudits.id, audit.id));

          await logAiAction("audit_run", "ai_agent", "site",
            `Site audit (${auditType}) completed — score ${score}/100, ${findings.length} findings`,
            { auditId: audit.id, score, findingsCount: findings.length });

        } catch (err: any) {
          await db.update(aiSiteAudits)
            .set({ status: "failed", summary: err.message ?? "Unknown error" })
            .where(eq(aiSiteAudits.id, audit.id));
          console.error("[AI site audit]", err);
        }
      })();
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: err.message || "Failed to start audit" });
    }
  });

  /** GET /api/ai/site/audits — list audits */
  app.get("/api/ai/site/audits", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const audits = await db.select().from(aiSiteAudits).orderBy(desc(aiSiteAudits.createdAt)).limit(20);
      res.json(audits);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  /** GET /api/ai/site/audits/:id — single audit detail */
  app.get("/api/ai/site/audits/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const [audit] = await db.select().from(aiSiteAudits).where(eq(aiSiteAudits.id, id)).limit(1);
      if (!audit) return res.status(404).json({ message: "Not found" });
      const recs = await db.select().from(aiSiteRecommendations).where(eq(aiSiteRecommendations.auditId, id)).orderBy(aiSiteRecommendations.priority);
      res.json({ ...audit, recommendations: recs });
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  /** GET /api/ai/site/recommendations — all open site recommendations */
  app.get("/api/ai/site/recommendations", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const recs = await db.select().from(aiSiteRecommendations).orderBy(desc(aiSiteRecommendations.createdAt)).limit(200);
      res.json(recs);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // APPROVAL QUEUE
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/approvals */
  app.get("/api/ai/approvals", requireAdmin, async (req: Request, res: Response) => {
    try {
      const status = (req.query.status as string) ?? "pending";
      const items = await db.select()
        .from(aiApprovalQueue)
        .where(eq(aiApprovalQueue.status, status))
        .orderBy(desc(aiApprovalQueue.createdAt))
        .limit(100);
      res.json(items);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  /** POST /api/ai/approvals/:id/review — approve / reject / defer */
  app.post("/api/ai/approvals/:id/review", requireAdmin, async (req: Request, res: Response) => {
    try {
      // Kill switch blocks write actions; reads (GET /approvals) and flag changes are always allowed
      const killSwitch = await getFlag("ai_master_kill_switch");
      if (killSwitch) return res.status(503).json({ message: "AI master kill switch is active. Approval actions are disabled." });

      const id = parseInt(req.params.id);
      const { decision, note } = z.object({
        decision: z.enum(["approved", "rejected", "deferred"]),
        note: z.string().optional(),
      }).parse(req.body);

      const actor = (req as any).user?.username || "admin";
      await db.update(aiApprovalQueue)
        .set({ status: decision, reviewedBy: actor, reviewedAt: new Date(), reviewNote: note ?? null })
        .where(eq(aiApprovalQueue.id, id));

      // If approving an ad recommendation, update its status too
      const [item] = await db.select().from(aiApprovalQueue).where(eq(aiApprovalQueue.id, id)).limit(1);
      if (item?.refType === "ad_recommendation" && item.refId) {
        await db.update(aiAdRecommendations)
          .set({ status: decision })
          .where(eq(aiAdRecommendations.id, item.refId));
      }
      if (item?.refType === "site_recommendation" && item.refId) {
        await db.update(aiSiteRecommendations)
          .set({ status: decision, approvedBy: actor })
          .where(eq(aiSiteRecommendations.id, item.refId));
      }

      await logAiAction(
        decision === "approved" ? "action_approved" : decision === "rejected" ? "action_rejected" : "action_deferred",
        actor, item?.queueType?.startsWith("ads") ? "ads" : "site",
        `${decision.toUpperCase()}: ${item?.title}`,
        // Include refType + refId for full audit trail linkage
        { id, decision, note, refType: item?.refType, refId: item?.refId, queueType: item?.queueType },
      );

      // ── Phase 6: Auto-execute on approval ────────────────────────────────────
      let autoExecResult: any = null;
      let platformExecResult: any = null;
      let siteApplyResult: any = null;

      if (decision === "approved" && item) {
        const r = await runAutoExecuteOnApproval(item, actor);
        autoExecResult = r.autoExecResult;
        platformExecResult = r.platformExecResult;
        siteApplyResult = r.siteApplyResult;
      }

      res.json({
        success: true,
        decision,
        autoExecuted: !!autoExecResult,
        executionResult: autoExecResult,
        platformExecution: platformExecResult,
        siteApply: siteApplyResult,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "DB error" });
    }
  });

  // ── EXTRACTED HELPER: shared by /review, /bulk-review, and analyzer auto-approve
  // This is the SINGLE PLACE where the auto-execute pipeline runs after an
  // approval decision. Three callers depend on it; refactoring this affects all.
  async function runAutoExecuteOnApproval(
    item: typeof aiApprovalQueue.$inferSelect,
    actor: string,
  ): Promise<{ autoExecResult: any; platformExecResult: any; siteApplyResult: any }> {
    const id = item.id;
    let autoExecResult: any = null;
    let platformExecResult: any = null;
    let siteApplyResult: any = null;
    const autoExecEnabled = await getFlag("ai_auto_execute_enabled");

    // 1️⃣ Build the deliverable spec (existing behaviour)
    if (autoExecEnabled && AUTO_EXECUTE_TYPES.has(item.queueType ?? "")) {
      await db.update(aiApprovalQueue).set({ executionStatus: "executing" }).where(eq(aiApprovalQueue.id, id));
      try {
        autoExecResult = await buildAndPersistExecution(item, actor, true);
      } catch (execErr: any) {
        await db.update(aiApprovalQueue)
          .set({ executionStatus: "execution_failed", executionResult: { error: String(execErr) } as any })
          .where(eq(aiApprovalQueue.id, id));
      }
    }

    // 2️⃣ Push the change LIVE based on type
    if (autoExecEnabled) {
          // ── Ad platform actions → Google/Meta API ──
          if (AUTO_PLATFORM_EXECUTE_TYPES.has(item.queueType ?? "")) {
            try {
              const pa = (item.proposedAction as any) ?? {};
              const platformRaw = (pa.platform as string | undefined)?.toLowerCase() ?? "";
              const isGoogle = platformRaw === "google" || platformRaw === "google_ads" || item.queueType === "negative_keyword";
              const isMeta   = platformRaw === "meta" || platformRaw === "meta_ads";

              const platformFlag = isGoogle ? "ai_google_ads_execution_enabled" : isMeta ? "ai_meta_ads_execution_enabled" : null;
              const platformOk = platformFlag ? await getFlag(platformFlag) : false;

              // Idempotency: only push if nothing pushed yet
              const [already] = await db.select({ id: aiPlatformExecutions.id })
                .from(aiPlatformExecutions).where(eq(aiPlatformExecutions.approvalQueueId, id)).limit(1);

              if (platformOk && !already) {
                const testMode = await getFlag("ai_platform_execution_test_mode");
                const execResult: PlatformExecutionResult = await executePlatformAction(item, actor, !!testMode);

                const [persisted] = await db.insert(aiPlatformExecutions).values({
                  approvalQueueId: item.id,
                  recommendationId: item.refId ?? undefined,
                  platform: execResult.platform,
                  actionType: execResult.actionType,
                  targetObjectIds: execResult.targetObjectIds as any,
                  proposedChange: execResult.proposedChange as any,
                  executedChange: execResult.executedChange as any,
                  actor,
                  resultStatus: execResult.resultStatus,
                  platformResponseSummary: execResult.platformResponseSummary,
                  platformResponseRaw: execResult.platformResponseRaw as any ?? null,
                  rollbackPath: execResult.rollbackPath,
                  rollbackPayload: execResult.rollbackPayload as any ?? null,
                  errorMessage: execResult.errorMessage ?? null,
                  testMode: execResult.testMode,
                }).returning({ id: aiPlatformExecutions.id });

                platformExecResult = {
                  id: persisted?.id,
                  platform: execResult.platform,
                  actionType: execResult.actionType,
                  resultStatus: execResult.resultStatus,
                  summary: execResult.platformResponseSummary,
                  testMode: execResult.testMode,
                  errorMessage: execResult.errorMessage,
                };

                // Merge into the approval row's executionResult
                const existing = (autoExecResult ?? item.executionResult ?? {}) as any;
                await db.update(aiApprovalQueue)
                  .set({ executionResult: { ...existing, platformExecution: platformExecResult } as any })
                  .where(eq(aiApprovalQueue.id, id));

                await logAiAction("platform_executed", actor, "ads",
                  `AUTO-PUSHED on approve [${execResult.resultStatus.toUpperCase()}]: ${item.title}`,
                  { id, platform: execResult.platform, actionType: execResult.actionType, testMode: execResult.testMode });

                // Capture baseline metrics for self-healing (only on real success, never dry-run)
                if (persisted?.id && execResult.resultStatus === "success" && !execResult.testMode) {
                  try {
                    const tIds = (execResult.targetObjectIds as any) ?? {};
                    const campaignId = tIds.campaignId ?? tIds.campaign_id;
                    const { captureBaselineForExecution } = await import("./ai-self-healing");
                    await captureBaselineForExecution(persisted.id, execResult.platform, campaignId);
                  } catch (baselineErr: any) {
                    console.error("[baseline-capture] failed for exec", persisted.id, baselineErr?.message);
                  }
                }

                // Real-time alert if the execution didn't succeed.
                // executePlatformAction is designed never to throw — it returns
                // resultStatus='failed'|'missing_ids' for normal failures, so
                // the catch{} below would miss them.
                if (execResult.resultStatus !== "success" && !execResult.testMode) {
                  try {
                    const { sendAiAlert } = await import("./ai-alerts");
                    await sendAiAlert({
                      severity: "critical",
                      channel: "ads",
                      title: `Platform push ${execResult.resultStatus.toUpperCase()}`,
                      body: `${item.title}\n${execResult.platformResponseSummary ?? execResult.errorMessage ?? "(no detail)"}`,
                      url: "/admin/ai/approvals",
                      dedupeKey: `push_${execResult.resultStatus}|${id}`,
                    });
                  } catch {}
                }
              } else if (!platformOk) {
                platformExecResult = { skipped: true, reason: `Platform execution flag (${platformFlag}) is OFF` };
              } else if (already) {
                platformExecResult = { skipped: true, reason: "Already pushed to platform" };
              }
            } catch (platformErr: any) {
              platformExecResult = { error: String(platformErr?.message || platformErr) };
              await logAiAction("platform_execution_failed", actor, "ads",
                `AUTO-PUSH FAILED: ${item.title} — ${platformErr?.message || platformErr}`,
                { id });
              // Real-time alert: a platform push failure means our recommendation
              // didn't actually land — admin should know within seconds, not in the digest.
              try {
                const { sendAiAlert } = await import("./ai-alerts");
                await sendAiAlert({
                  severity: "critical",
                  channel: "ads",
                  title: `Platform push FAILED`,
                  body: `${item.title}\nError: ${platformErr?.message || platformErr}`,
                  url: "/admin/ai/approvals",
                });
              } catch {}
            }
          }

          // ── Site/SEO changes → write directly to live site_settings ──
          if (item.queueType === "site_change") {
            try {
              siteApplyResult = await applySiteChangeToLive(item, actor);

              // Merge into the approval row's executionResult
              const existing = (autoExecResult ?? item.executionResult ?? {}) as any;
              await db.update(aiApprovalQueue)
                .set({ executionResult: { ...existing, siteApply: siteApplyResult } as any })
                .where(eq(aiApprovalQueue.id, id));

              await logAiAction("site_change_applied", actor, "site",
                `AUTO-APPLIED on approve: ${item.title} → ${siteApplyResult.applied.join(", ")} on ${siteApplyResult.page}`,
                { id, ...siteApplyResult });
            } catch (siteErr: any) {
              siteApplyResult = { error: String(siteErr?.message || siteErr) };
            }
          }
    }

    return { autoExecResult, platformExecResult, siteApplyResult };
  }

  /** GET /api/ai/approvals/:id/detail — full detail with linked recommendation + audit trail */
  app.get("/api/ai/approvals/:id/detail", requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const [item] = await db.select().from(aiApprovalQueue).where(eq(aiApprovalQueue.id, id)).limit(1);
      if (!item) return res.status(404).json({ message: "Not found" });

      // Load the linked recommendation record for full evidence/source display
      let linkedRec: any = null;
      if (item.refType === "ad_recommendation" && item.refId) {
        const [rec] = await db.select().from(aiAdRecommendations).where(eq(aiAdRecommendations.id, item.refId)).limit(1);
        linkedRec = rec ?? null;
      } else if (item.refType === "site_recommendation" && item.refId) {
        const [rec] = await db.select().from(aiSiteRecommendations).where(eq(aiSiteRecommendations.id, item.refId)).limit(1);
        linkedRec = rec ?? null;
      }

      // Load the 5 most recent audit log entries referencing this approval item or linked rec
      const recentAuditEntries = await db
        .select()
        .from(aiAuditLog)
        .orderBy(desc(aiAuditLog.createdAt))
        .limit(50);
      // Filter client-side (JSONB containment query varies by driver)
      const auditTrail = recentAuditEntries
        .filter((e: any) => {
          const d = e.detail as any;
          return d?.id === id || d?.refId === item.refId;
        })
        .slice(0, 5);

      res.json({ item, linkedRec, auditTrail });
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // BULK REVIEW — approve/reject/defer many items in one click
  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/ai/approvals/bulk-review  body: { ids: number[], decision, note? }
  // Internally re-uses the same review endpoint logic per id (sequential to keep
  // platform writes ordered and rate-limit-friendly). Returns per-id results.
  app.post("/api/ai/approvals/bulk-review", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { ids, decision, note } = req.body ?? {};
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: "ids[] required" });
      if (!["approved", "rejected", "deferred"].includes(decision)) return res.status(400).json({ message: "invalid decision" });
      if (ids.length > 50) return res.status(400).json({ message: "max 50 items per bulk review" });

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const cookie = req.headers.cookie ?? "";
      const results: any[] = [];
      let successCount = 0;
      let failCount = 0;

      for (const rawId of ids) {
        const id = parseInt(String(rawId));
        if (!Number.isFinite(id)) { results.push({ id: rawId, ok: false, error: "bad id" }); failCount++; continue; }
        try {
          const r = await fetch(`${baseUrl}/api/ai/approvals/${id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json", cookie },
            body: JSON.stringify({ decision, note }),
          });
          const j = await r.json().catch(() => ({}));
          if (r.ok) { results.push({ id, ok: true, ...j }); successCount++; }
          else { results.push({ id, ok: false, status: r.status, error: j?.message }); failCount++; }
        } catch (e: any) {
          results.push({ id, ok: false, error: e.message ?? "exception" });
          failCount++;
        }
      }

      await db.insert(aiAuditLog).values({
        actionType: decision === "approved" ? "action_approved" : decision === "rejected" ? "action_rejected" : "action_applied",
        actor: (req as any).session?.username ?? "admin",
        module: "approval_queue",
        summary: `Bulk ${decision}: ${successCount}/${ids.length} succeeded`,
        detail: { decision, ids, successCount, failCount } as any,
        outcome: failCount === 0 ? "success" : (successCount === 0 ? "failed" : "partial"),
      });

      res.json({ total: ids.length, successCount, failCount, results });
    } catch (e: any) {
      res.status(500).json({ message: e.message ?? "bulk review failed" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ROLLBACK — one-click undo for executed platform actions and site changes
  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/ai/executions/:id/rollback
  //   Reverses a previously-executed Google/Meta Ads action by calling the same
  //   platform API with the stored rollbackPayload. Marks the execution as
  //   rolled-back. Idempotent: a second call returns the prior result.
  app.post("/api/ai/executions/:id/rollback", requireAdmin, async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "bad id" });
    try {
      const [exec] = await db.select().from(aiPlatformExecutions).where(eq(aiPlatformExecutions.id, id)).limit(1);
      if (!exec) return res.status(404).json({ message: "execution not found" });
      if (exec.rolledBackAt) return res.json({ ok: true, alreadyRolledBack: true, rolledBackAt: exec.rolledBackAt, status: exec.rollbackStatus });
      if (exec.resultStatus !== "success") return res.status(400).json({ message: `cannot rollback execution in state '${exec.resultStatus}'` });
      if (!exec.rollbackPayload) return res.status(400).json({ message: "no rollback payload available — manual reversal required" });

      const actor = (req as any).session?.username ?? "admin";
      const { executePlatformAction } = await import("./ad-executor");
      const { buildReverseApprovalItem, reverseActionFor } = await import("./ai-self-healing");

      const at = exec.actionType ?? "";
      // Only enable_/pause_ pairs are reversible via the existing executor.
      // negative_keyword_add requires manual removal in the platform UI for now
      // (the ad-executor doesn't yet implement removeKeywords), so we force
      // manual_required with the helpful rollback path text instead of pretending.
      const reverseLogical = reverseActionFor(at);

      if (!reverseLogical) {
        await db.update(aiPlatformExecutions).set({
          rolledBackAt: new Date(), rolledBackBy: actor, rollbackStatus: "manual_required",
          rollbackError: `No automated reverse for action type '${at}'. Follow manual rollback path.`,
        }).where(eq(aiPlatformExecutions.id, id));
        return res.json({ ok: false, status: "manual_required", rollbackPath: exec.rollbackPath });
      }

      let rollbackOk = false;
      let rollbackErr: string | null = null;
      let rollbackSummary = "";
      try {
        const reverseItem = buildReverseApprovalItem(exec, reverseLogical);
        const reverseResult = await executePlatformAction(reverseItem, `rollback:${actor}`, !!exec.testMode);
        rollbackOk = reverseResult?.resultStatus === "success" || reverseResult?.resultStatus === "test_mode";
        rollbackSummary = reverseResult?.platformResponseSummary ?? "";
        if (!rollbackOk) rollbackErr = reverseResult?.errorMessage ?? "platform did not confirm rollback";
      } catch (e: any) {
        rollbackErr = e.message ?? "rollback exception";
      }

      await db.update(aiPlatformExecutions).set({
        rolledBackAt: new Date(),
        rolledBackBy: actor,
        rollbackStatus: rollbackOk ? "success" : "failed",
        rollbackError: rollbackErr,
      }).where(eq(aiPlatformExecutions.id, id));

      await db.insert(aiAuditLog).values({
        actionType: "rollback",
        actor,
        module: "ads",
        summary: `Rollback ${rollbackOk ? "succeeded" : "FAILED"}: ${exec.platform} ${at} (exec #${id})`,
        detail: { executionId: id, platform: exec.platform, actionType: at, reverseType, rollbackSummary, rollbackErr } as any,
        outcome: rollbackOk ? "success" : "failed",
      });

      res.json({ ok: rollbackOk, status: rollbackOk ? "success" : "failed", summary: rollbackSummary, error: rollbackErr });
    } catch (e: any) {
      res.status(500).json({ message: e.message ?? "rollback failed" });
    }
  });

  // POST /api/ai/site-settings/rollback  body: { keys?: string[], page?: string }
  //   Restores previousValue → settingValue for either specified keys, or all
  //   settings on a given page. Used by the AI Site agent's "Undo last change"
  //   button. Auto-clears previousValue afterwards (no nested rollback).
  app.post("/api/ai/site-settings/rollback", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { keys, page } = req.body ?? {};
      let rows: typeof siteSettings.$inferSelect[] = [];
      if (Array.isArray(keys) && keys.length) {
        rows = await db.select().from(siteSettings).where(inArray(siteSettings.settingKey, keys));
      } else if (typeof page === "string") {
        rows = await db.select().from(siteSettings).where(eq(siteSettings.page, page));
      } else {
        return res.status(400).json({ message: "provide keys[] or page" });
      }

      const actor = (req as any).session?.username ?? "admin";
      const restored: Array<{ key: string; from: string; to: string }> = [];
      const skipped: Array<{ key: string; reason: string }> = [];

      for (const row of rows) {
        if (!row.previousValue) { skipped.push({ key: row.settingKey, reason: "no previous value to restore" }); continue; }
        await db.update(siteSettings).set({
          settingValue: row.previousValue,
          previousValue: null,
          source: "rollback",
          updatedAt: new Date(),
          updatedBy: actor,
        }).where(eq(siteSettings.id, row.id));
        restored.push({ key: row.settingKey, from: row.settingValue, to: row.previousValue });
      }

      await db.insert(aiAuditLog).values({
        actionType: "rollback",
        actor,
        module: "site",
        summary: `Site rollback: restored ${restored.length} setting(s)${page ? ` on ${page}` : ""}`,
        detail: { restored, skipped, page, keys } as any,
        outcome: restored.length > 0 ? "success" : "skipped",
      });

      res.json({ restored, skipped, count: restored.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message ?? "site rollback failed" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SELF-HEALING + WEEKLY DIGEST — manual triggers (for testing & ops)
  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/ai/self-healing/run — runs the sweep immediately, returns counters
  app.post("/api/ai/self-healing/run", requireAdmin, async (req: Request, res: Response) => {
    try {
      const actor = (req as any).session?.username ?? "admin";
      const { runSelfHealingSweep } = await import("./ai-self-healing");
      const result = await runSelfHealingSweep(`manual:${actor}`);
      res.json({ ok: true, ...result });
    } catch (e: any) { res.status(500).json({ message: e.message ?? "self-healing run failed" }); }
  });

  // POST /api/ai/digest/send-now — sends the digest to the configured recipient
  // regardless of day-of-week (still requires recipient flag to be set).
  app.post("/api/ai/digest/send-now", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { maybeSendWeeklyDigest } = await import("./ai-self-healing");
      const result = await maybeSendWeeklyDigest({ force: true });
      if (!result.sent) return res.status(400).json({ ok: false, ...result });
      res.json({ ok: true, ...result });
    } catch (e: any) { res.status(500).json({ message: e.message ?? "digest send failed" }); }
  });

  // POST /api/ai/anomaly/run — runs the anomaly sweep immediately
  app.post("/api/ai/anomaly/run", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { runAnomalySweep } = await import("./ai-anomaly");
      const result = await runAnomalySweep("manual");
      res.json({ ok: true, ...result });
    } catch (e: any) { res.status(500).json({ message: e.message ?? "anomaly run failed" }); }
  });

  // POST /api/ai/alerts/test — fires a test alert through both push + WhatsApp channels
  app.post("/api/ai/alerts/test", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { sendAiAlert } = await import("./ai-alerts");
      const result = await sendAiAlert({
        severity: "info",
        channel: "approval",
        title: "Test alert",
        body: "If you received this on your phone and browser, real-time alerts are wired correctly.",
        url: "/admin/ai",
      });
      res.json({ ok: true, ...result });
    } catch (e: any) { res.status(500).json({ message: e.message ?? "alert test failed" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RECOMMENDATION QUALITY — approve/reject rates per type & per agent
  // ════════════════════════════════════════════════════════════════════════════
  // GET /api/ai/recommendation-quality?days=30
  //   Tells you which AI recommendation categories are working and which aren't.
  //   Use this to tune confidence thresholds, retire weak prompts, or focus
  //   training on weak categories.
  app.get("/api/ai/recommendation-quality", requireAdmin, async (req: Request, res: Response) => {
    try {
      const days = Math.max(1, Math.min(180, parseInt(String(req.query.days ?? "30"))));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const items = await db.select().from(aiApprovalQueue).where(gte(aiApprovalQueue.createdAt, since));

      // Group by queueType then by status
      const byType: Record<string, { approved: number; rejected: number; deferred: number; pending: number; total: number; autoApproved: number }> = {};
      for (const it of items) {
        const t = it.queueType ?? "unknown";
        const b = byType[t] ??= { approved: 0, rejected: 0, deferred: 0, pending: 0, total: 0, autoApproved: 0 };
        b.total++;
        if (it.status === "approved") b.approved++;
        else if (it.status === "rejected") b.rejected++;
        else if (it.status === "deferred") b.deferred++;
        else b.pending++;
        if (it.reviewedBy === "ai_autoapprove") b.autoApproved++;
      }

      const breakdown = Object.entries(byType).map(([type, c]) => {
        const reviewed = c.approved + c.rejected + c.deferred;
        const approveRate = reviewed > 0 ? Math.round((c.approved / reviewed) * 100) : 0;
        const rejectRate  = reviewed > 0 ? Math.round((c.rejected / reviewed) * 100) : 0;
        return { type, ...c, reviewed, approveRate, rejectRate };
      }).sort((a, b) => b.total - a.total);

      // Overall verdict + suggestion
      const totalReviewed = breakdown.reduce((s, b) => s + b.reviewed, 0);
      const totalApproved = breakdown.reduce((s, b) => s + b.approved, 0);
      const overallApproveRate = totalReviewed > 0 ? Math.round((totalApproved / totalReviewed) * 100) : 0;

      const weakCategories = breakdown.filter(b => b.reviewed >= 3 && b.rejectRate >= 50);
      const strongCategories = breakdown.filter(b => b.reviewed >= 3 && b.approveRate >= 80);

      res.json({
        windowDays: days,
        since: since.toISOString(),
        overallApproveRate,
        totalRecommendations: items.length,
        breakdown,
        suggestions: {
          weakCategories: weakCategories.map(c => c.type),
          strongCategories: strongCategories.map(c => c.type),
          message: weakCategories.length > 0
            ? `Consider tightening prompts for: ${weakCategories.map(c => c.type).join(", ")} (rejected ≥50% of the time)`
            : strongCategories.length > 0
              ? `Strong categories — safe to raise auto-approve thresholds for: ${strongCategories.map(c => c.type).join(", ")}`
              : `Not enough reviewed items yet to draw conclusions.`,
        },
      });
    } catch (e: any) { res.status(500).json({ message: e.message ?? "quality stats failed" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // WHATSAPP SALES AGENT PERFORMANCE — handoff rate, follow-ups sent, conversion proxies
  // ════════════════════════════════════════════════════════════════════════════
  // GET /api/ai/whatsapp-agent-performance?days=14
  app.get("/api/ai/whatsapp-agent-performance", requireAdmin, async (req: Request, res: Response) => {
    try {
      const days = Math.max(1, Math.min(90, parseInt(String(req.query.days ?? "14"))));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [followups, handoffs] = await Promise.all([
        db.select().from(aiWhatsappFollowups).where(gte(aiWhatsappFollowups.createdAt, since)),
        db.select().from(aiWhatsappHandoffs).where(gte(aiWhatsappHandoffs.handedAt, since)),
      ]);

      // Distinct phones that received either a followup or were handed off → unique conversations
      const allPhones = new Set<string>([...followups.map(f => f.phone), ...handoffs.map(h => h.phone)]);

      const followupsSent = followups.filter(f => f.status === "sent").length;
      const followupsSkipped = followups.filter(f => f.status === "skipped" || f.status === "cancelled").length;
      const followupsPending = followups.filter(f => f.status === "pending").length;

      const followupTypeBreakdown: Record<string, number> = {};
      for (const f of followups) {
        followupTypeBreakdown[f.followupType] = (followupTypeBreakdown[f.followupType] ?? 0) + 1;
      }

      const handoffsTotal = handoffs.length;
      const handoffReasons: Record<string, number> = {};
      for (const h of handoffs) handoffReasons[h.reason] = (handoffReasons[h.reason] ?? 0) + 1;
      const resumed = handoffs.filter(h => h.resumedAt).length;

      // Handoff rate as % of unique phones the AI engaged with
      const handoffRate = allPhones.size > 0 ? Math.round((handoffsTotal / allPhones.size) * 100) : 0;

      res.json({
        windowDays: days,
        since: since.toISOString(),
        uniqueConversations: allPhones.size,
        followups: {
          total: followups.length,
          sent: followupsSent,
          skipped: followupsSkipped,
          pending: followupsPending,
          byType: followupTypeBreakdown,
        },
        handoffs: {
          total: handoffsTotal,
          rate: handoffRate,
          resumed,
          byReason: handoffReasons,
        },
        verdict: handoffRate >= 50
          ? `High handoff rate (${handoffRate}%) — review prompts; the AI is giving up too easily.`
          : handoffRate <= 15 && allPhones.size >= 5
            ? `Strong autonomy (${handoffRate}% handoff rate). AI is handling most conversations end-to-end.`
            : `Normal range. Continue monitoring.`,
      });
    } catch (e: any) { res.status(500).json({ message: e.message ?? "agent perf failed" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // HOT LEADS — current top-scoring WhatsApp conversations (revenue priority queue)
  // ════════════════════════════════════════════════════════════════════════════
  // GET /api/ai/hot-leads?hours=24&limit=10
  app.get("/api/ai/hot-leads", requireAdmin, async (req: Request, res: Response) => {
    try {
      const hours = Math.max(1, Math.min(168, parseInt(String(req.query.hours ?? "24"))));
      const limit = Math.max(1, Math.min(50, parseInt(String(req.query.limit ?? "10"))));
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const [thrRow] = await db.select().from(appSettings).where(eq(appSettings.key, "ai_hot_lead_threshold")).limit(1);
      const hotThreshold = parseInt(thrRow?.value ?? "75", 10);

      const sessions = await db.execute(sql`
        SELECT phone, lead_score, lead_score_reasons, case_facts, ai_state, ai_ownership,
               last_inbound_at, hot_lead_alerted_at, updated_at
        FROM whatsapp_sessions
        WHERE last_inbound_at >= ${since.toISOString()}
          AND COALESCE(lead_score, 0) > 0
        ORDER BY lead_score DESC, last_inbound_at DESC
        LIMIT ${limit}
      `);

      const rows = (sessions as any).rows ?? sessions;
      const leads = (rows as any[]).map(r => {
        let facts: any = {};
        let reasons: any[] = [];
        try { facts = r.case_facts ? JSON.parse(r.case_facts) : {}; } catch {}
        try { reasons = r.lead_score_reasons ? JSON.parse(r.lead_score_reasons) : []; } catch {}
        const score = r.lead_score ?? 0;
        return {
          phone: r.phone,
          phoneMasked: `****${String(r.phone).slice(-4)}`,
          score,
          tier: score >= hotThreshold ? "hot" : score >= 45 ? "warm" : "cold",
          customerName: facts.customerName ?? null,
          serviceType: facts.serviceType ?? null,
          jobAddress: facts.jobAddress ?? null,
          quantity: facts.quantity ?? facts.itemTypes?.length ?? null,
          urgency: facts.urgency ?? null,
          aiState: r.ai_state,
          aiOwnership: r.ai_ownership,
          lastInboundAt: r.last_inbound_at,
          hotLeadAlertedAt: r.hot_lead_alerted_at,
          topReasons: reasons.sort((a, b) => b.points - a.points).slice(0, 3),
        };
      });

      const hotCount = leads.filter(l => l.tier === "hot").length;
      const warmCount = leads.filter(l => l.tier === "warm").length;

      res.json({
        windowHours: hours,
        hotThreshold,
        totalLeads: leads.length,
        hotCount,
        warmCount,
        leads,
      });
    } catch (e: any) { res.status(500).json({ message: e.message ?? "hot leads failed" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ACTIVITY SUMMARY — "what did the AI do for me this week?"
  // ════════════════════════════════════════════════════════════════════════════
  // GET /api/ai/activity-summary?days=7
  app.get("/api/ai/activity-summary", requireAdmin, async (req: Request, res: Response) => {
    try {
      const days = Math.max(1, Math.min(90, parseInt(String(req.query.days ?? "7"))));
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [execs, recentApprovals, auditEvents] = await Promise.all([
        db.select().from(aiPlatformExecutions).where(gte(aiPlatformExecutions.createdAt, since)),
        db.select().from(aiApprovalQueue).where(gte(aiApprovalQueue.createdAt, since)),
        db.select().from(aiAuditLog).where(gte(aiAuditLog.createdAt, since)),
      ]);

      const platformPushes = execs.length;
      const platformSuccess = execs.filter(e => e.resultStatus === "success").length;
      const platformDryRun = execs.filter(e => e.resultStatus === "test_mode").length;
      const platformFailed = execs.filter(e => e.resultStatus === "failed").length;
      const rollbacks = execs.filter(e => e.rolledBackAt).length;
      const successRate = platformPushes > 0 ? Math.round((platformSuccess / platformPushes) * 100) : 0;

      const approved = recentApprovals.filter(a => a.status === "approved").length;
      const autoApproved = recentApprovals.filter(a => a.reviewedBy === "ai_autoapprove").length;
      const pending = recentApprovals.filter(a => a.status === "pending").length;
      const rejected = recentApprovals.filter(a => a.status === "rejected").length;

      // Estimate of admin time saved: ~90 seconds per auto-executed item
      // (typical click-through-platform-find-object-edit-save cycle) plus ~30s
      // per auto-approved item that the admin no longer had to read.
      const minutesSaved = Math.round((platformSuccess * 90 + autoApproved * 30) / 60);

      // Site changes applied
      const siteChanges = auditEvents.filter(e => e.module === "site" && e.actionType === "action_applied").length;

      res.json({
        windowDays: days,
        since: since.toISOString(),
        platform: {
          totalPushes: platformPushes,
          success: platformSuccess,
          dryRun: platformDryRun,
          failed: platformFailed,
          rollbacks,
          successRate,
        },
        approvals: { approved, autoApproved, pending, rejected, total: recentApprovals.length },
        site: { changesApplied: siteChanges },
        minutesSaved,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message ?? "activity summary failed" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 5 MANUAL EXECUTION — Deliverable generation, no live mutations
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/ai/approvals/:id/execute
   *
   * SAFETY CONTRACT:
   *   - Only runs on items with status = "approved" AND executionStatus IS NULL
   *   - NEVER calls Google Ads API, Meta API, or modifies the live site
   *   - Generates a structured, formatted deliverable (spec/brief/CSV) for the
   *     admin to implement manually in the target platform
   *   - Every execution is logged to aiAuditLog with full detail
   *   - Respects ai_master_kill_switch
   *   - Idempotent guard: re-executing an already-executed item is rejected
   *
   * Deliverable types by queueType:
   *   negative_keyword  → CSV keyword list + Google Ads step-by-step instructions
   *   creative          → RSA spec (headlines/descriptions) + experiment setup steps
   *   site_change       → Page brief or CRO copy spec + developer handoff checklist
   *   ads_change        → Ads change spec + platform instructions
   */
  app.post("/api/ai/approvals/:id/execute", requireAdmin, async (req: Request, res: Response) => {
    try {
      const killSwitch = await getFlag("ai_master_kill_switch");
      if (killSwitch) return res.status(503).json({ message: "AI master kill switch is active. Execution is disabled." });

      const id = parseInt(req.params.id);
      const actor = (req as any).user?.username || "admin";

      // Load the approval item
      const [item] = await db.select().from(aiApprovalQueue).where(eq(aiApprovalQueue.id, id)).limit(1);
      if (!item) return res.status(404).json({ message: "Approval item not found." });
      if (item.status !== "approved") return res.status(400).json({ message: `Cannot execute: item status is "${item.status}". Only approved items can be executed.` });
      if (item.executionStatus === "executed" || item.executionStatus === "executing") {
        return res.status(400).json({ message: "This item has already been executed (or is currently executing). Check the execution result in the detail panel." });
      }

      const executionResult = await buildAndPersistExecution(item, actor, false);
      res.json({ success: true, executionResult });
    } catch (err: any) {
      const id = parseInt(req.params.id);
      try {
        await db.update(aiApprovalQueue)
          .set({ executionStatus: "execution_failed" })
          .where(eq(aiApprovalQueue.id, id));
      } catch { /* ignore */ }
      console.error("[execute]", err);
      res.status(500).json({ message: err.message ?? "Execution failed" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 7: AD PLATFORM EXECUTION — Push approved actions to Google Ads / Meta
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/ai/approvals/:id/platform-execute
   *
   * SAFETY CONTRACT:
   *   - Only runs on items with status = "approved" AND executionStatus = "executed"
   *     (deliverable must exist first — deliverable is a separate prerequisite step)
   *   - Requires ai_master_kill_switch = false
   *   - Requires platform-specific flag: ai_google_ads_execution_enabled / ai_meta_ads_execution_enabled
   *   - test_mode = ai_platform_execution_test_mode flag value (defaults true = dry run)
   *   - Budget changes hard-capped at +10% per execution (enforced in ad-executor.ts)
   *   - Never touches booking/payment/quote/customer tables
   *   - All executions persisted in ai_platform_executions + ai_audit_log
   *   - executionResult in aiApprovalQueue is updated with platformExecution sub-object
   */
  app.post("/api/ai/approvals/:id/platform-execute", requireAdmin, async (req: Request, res: Response) => {
    try {
      // ── Gate 1: Master kill switch ─────────────────────────────────────────
      const killSwitch = await getFlag("ai_master_kill_switch");
      if (killSwitch) return res.status(503).json({ message: "AI master kill switch is active. Platform execution is disabled." });

      const id = parseInt(req.params.id);
      const actor = (req as any).user?.username || "admin";

      // ── Gate 2: Load and validate the approval item ────────────────────────
      const [item] = await db.select().from(aiApprovalQueue).where(eq(aiApprovalQueue.id, id)).limit(1);
      if (!item) return res.status(404).json({ message: "Approval item not found." });
      if (item.status !== "approved") {
        return res.status(400).json({ message: `Cannot platform-execute: item status is "${item.status}". Only approved items can be pushed to the platform.` });
      }

      // ── Gate 3: Idempotency check — block duplicate pushes ─────────────────
      // Each approval item may only be pushed to the platform once.
      const [existingExec] = await db
        .select({ id: aiPlatformExecutions.id, resultStatus: aiPlatformExecutions.resultStatus, platform: aiPlatformExecutions.platform, actionType: aiPlatformExecutions.actionType, createdAt: aiPlatformExecutions.createdAt })
        .from(aiPlatformExecutions)
        .where(eq(aiPlatformExecutions.approvalQueueId, id))
        .limit(1);

      if (existingExec) {
        return res.status(409).json({
          message: `This action has already been pushed to the platform (execution #${existingExec.id}, status: ${existingExec.resultStatus}). Expand the item to view the existing result. Each approved action may only be pushed once.`,
          alreadyPushed: true,
          existingExecution: {
            id: existingExec.id,
            resultStatus: existingExec.resultStatus,
            platform: existingExec.platform,
            actionType: existingExec.actionType,
            createdAt: existingExec.createdAt,
          },
        });
      }

      const pa = (item.proposedAction as any) ?? {};
      const platformRaw = (pa.platform as string | undefined)?.toLowerCase() ?? "";
      const isGoogle = platformRaw === "google" || platformRaw === "google_ads" || item.queueType === "negative_keyword";
      const isMeta   = platformRaw === "meta" || platformRaw === "meta_ads";

      // ── Gate 4: Platform-specific execution flag ───────────────────────────
      if (isGoogle) {
        const gadsExecEnabled = await getFlag("ai_google_ads_execution_enabled");
        if (!gadsExecEnabled) {
          return res.status(403).json({
            message: "Google Ads execution is disabled. Enable 'ai_google_ads_execution_enabled' in AI Hub → Feature Flags to allow platform pushes.",
            flagKey: "ai_google_ads_execution_enabled",
          });
        }
      } else if (isMeta) {
        const metaExecEnabled = await getFlag("ai_meta_ads_execution_enabled");
        if (!metaExecEnabled) {
          return res.status(403).json({
            message: "Meta Ads execution is disabled. Enable 'ai_meta_ads_execution_enabled' in AI Hub → Feature Flags to allow platform pushes.",
            flagKey: "ai_meta_ads_execution_enabled",
          });
        }
      }

      // ── Gate 5: Determine test mode from flag ──────────────────────────────
      const testMode = await getFlag("ai_platform_execution_test_mode");

      // ── Gate 6: Additional live-mode safety flags ──────────────────────────
      // When testMode=false (live execution), two extra AI system flags must also
      // be ON. This adds a double-confirm requirement before any live API call.
      if (!testMode) {
        const adsEnabled = await getFlag("ai_ads_enabled");
        if (!adsEnabled) {
          return res.status(403).json({
            message: "Live execution requires 'ai_ads_enabled' to be ON. Enable it in AI Hub → Feature Flags.",
            flagKey: "ai_ads_enabled",
          });
        }
        const autoExecEnabled = await getFlag("ai_auto_execute_enabled");
        if (!autoExecEnabled) {
          return res.status(403).json({
            message: "Live execution requires 'ai_auto_execute_enabled' to be ON. Enable it in AI Hub → Feature Flags.",
            flagKey: "ai_auto_execute_enabled",
          });
        }
      }

      // Execute platform action
      const execResult: PlatformExecutionResult = await executePlatformAction(item, actor, testMode);

      // Persist execution record
      const [persisted] = await db.insert(aiPlatformExecutions).values({
        approvalQueueId:         item.id,
        recommendationId:        item.refId ?? undefined,
        platform:                execResult.platform,
        actionType:              execResult.actionType,
        targetObjectIds:         execResult.targetObjectIds as any,
        proposedChange:          execResult.proposedChange as any,
        executedChange:          execResult.executedChange as any,
        actor,
        resultStatus:            execResult.resultStatus,
        platformResponseSummary: execResult.platformResponseSummary,
        platformResponseRaw:     execResult.platformResponseRaw as any ?? null,
        rollbackPath:            execResult.rollbackPath,
        rollbackPayload:         execResult.rollbackPayload as any ?? null,
        errorMessage:            execResult.errorMessage ?? null,
        testMode:                execResult.testMode,
      }).returning({ id: aiPlatformExecutions.id });

      // Update the approval queue item executionResult with platform execution reference
      const existing = (item.executionResult as any) ?? {};
      await db.update(aiApprovalQueue)
        .set({
          executionResult: {
            ...existing,
            platformExecution: {
              id:                persisted?.id,
              platform:          execResult.platform,
              actionType:        execResult.actionType,
              resultStatus:      execResult.resultStatus,
              summary:           execResult.platformResponseSummary,
              rollbackPath:      execResult.rollbackPath,
              testMode:          execResult.testMode,
              errorMessage:      execResult.errorMessage,
              executedAt:        new Date().toISOString(),
              actor,
            },
          } as any,
        })
        .where(eq(aiApprovalQueue.id, id));

      // Audit log
      await logAiAction(
        "platform_executed",
        actor,
        isGoogle ? "ads" : "ads",
        `PLATFORM-EXECUTED [${execResult.resultStatus.toUpperCase()}]: ${item.title} → ${execResult.platform} / ${execResult.actionType}`,
        {
          approvalId: id,
          platformExecutionId: persisted?.id,
          platform: execResult.platform,
          actionType: execResult.actionType,
          resultStatus: execResult.resultStatus,
          testMode: execResult.testMode,
          summary: execResult.platformResponseSummary,
          refType: item.refType,
          refId: item.refId,
          actor,
        },
        execResult.resultStatus === "failed" ? "failed" : "success",
      );

      res.json({
        success: true,
        platformExecutionId: persisted?.id,
        resultStatus:        execResult.resultStatus,
        summary:             execResult.platformResponseSummary,
        testMode:            execResult.testMode,
        rollbackPath:        execResult.rollbackPath,
        errorMessage:        execResult.errorMessage,
      });
    } catch (err: any) {
      console.error("[platform-execute]", err);
      res.status(500).json({ message: err.message ?? "Platform execution failed" });
    }
  });

  /** GET /api/ai/platform-executions — list all platform execution records */
  app.get("/api/ai/platform-executions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
      const rows = await db.select()
        .from(aiPlatformExecutions)
        .orderBy(desc(aiPlatformExecutions.createdAt))
        .limit(limit);
      res.json(rows);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 4 ACTION GENERATOR — Rules-based, approval-only, no live mutations
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/ai/actions/generate
   *
   * Generates 4 categories of approval-ready actions from existing imported data:
   *   1. Negative keyword actions   (from low-CTR / zero-conversion ad data)
   *   2. Ad copy test actions       (from low-CTR campaigns)
   *   3. Landing page briefs        (from GSC high-impression / low-CTR queries)
   *   4. CRO copy suggestions       (from PageSpeed + site audit findings)
   *
   * SAFETY CONTRACT:
   *   - Writes ONLY to ai_ad_recommendations, ai_site_recommendations, ai_approval_queue, ai_audit_log
   *   - NEVER executes mutations on Google Ads, Meta, or the live site
   *   - All outputs require explicit admin approval to proceed
   *   - Respects ai_master_kill_switch
   *   - Deduplicates: skips if identical pending item already exists
   */
  app.post("/api/ai/actions/generate", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const killSwitch = await getFlag("ai_master_kill_switch");
      if (killSwitch) return res.status(503).json({ message: "Kill switch active." });

      const actor = (_req as any).user?.username || "admin";
      const results = { negKeywords: 0, copyTests: 0, landingPages: 0, croSuggestions: 0, skipped: 0 };
      const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      // ── Helper: dedup check ───────────────────────────────────────────────────
      async function adRecExists(targetName: string, action: string): Promise<boolean> {
        const rows = await db.select({ id: aiAdRecommendations.id })
          .from(aiAdRecommendations)
          .where(and(eq(aiAdRecommendations.targetName, targetName), eq(aiAdRecommendations.action, action), eq(aiAdRecommendations.status, "pending")))
          .limit(1);
        return rows.length > 0;
      }
      async function siteRecExists(title: string): Promise<boolean> {
        const rows = await db.select({ id: aiSiteRecommendations.id })
          .from(aiSiteRecommendations)
          .where(and(eq(aiSiteRecommendations.title, title), eq(aiSiteRecommendations.status, "open")))
          .limit(1);
        return rows.length > 0;
      }

      // ── Industry negative keywords for furniture installation vertical ────────
      const NEGATIVE_KW_SEEDS = [
        "DIY", "do it yourself", "rent", "hire", "free", "cheap", "tutorial", "how to",
        "used", "second hand", "second-hand", "buy", "wholesale", "discount", "jobs",
        "careers", "employment", "course", "training", "manual", "download", "template",
      ];

      // ── 1. NEGATIVE KEYWORD ACTIONS ──────────────────────────────────────────
      // Source: all Google Ads snapshots (API or manually entered) within 30 days
      const adRows = await db.select().from(aiAdsSnapshots)
        .where(gte(aiAdsSnapshots.snapshotDate, thirtyAgo))
        .orderBy(desc(aiAdsSnapshots.snapshotDate));

      // Aggregate by campaign
      const campaignTotals: Record<string, { spend: number; clicks: number; conversions: number; impressions: number; campaignName: string }> = {};
      for (const row of adRows) {
        const key = row.campaignId ?? row.campaignName ?? "unknown";
        const t = campaignTotals[key] ??= { spend: 0, clicks: 0, conversions: 0, impressions: 0, campaignName: row.campaignName ?? "Unknown Campaign" };
        t.spend += parseFloat(row.spend ?? "0");
        t.clicks += row.clicks ?? 0;
        t.conversions += parseFloat(row.conversions ?? "0");
        t.impressions += row.impressions ?? 0;
      }

      for (const [, c] of Object.entries(campaignTotals)) {
        if (c.spend < 30 || c.conversions > 0) continue; // only zero-conv + meaningful spend
        if (await adRecExists(c.campaignName, "negate")) { results.skipped++; continue; }

        const avgCTR = c.impressions > 0 ? (c.clicks / c.impressions * 100).toFixed(2) : "0";
        const evidence = {
          totalSpend: +c.spend.toFixed(2), totalClicks: c.clicks, totalConversions: 0,
          avgCTR, source: "google_ads_api", analysisSource: "phase4_actions",
        };
        const proposedKeywords = NEGATIVE_KW_SEEDS.slice(0, 8); // 8 seed negatives
        const rollbackPath = "Remove the negative keywords from campaign settings in Google Ads: Campaigns → [Campaign] → Keywords → Negative Keywords. All original traffic is restored immediately.";

        const [saved] = await db.insert(aiAdRecommendations).values({
          platform: "google", action: "negate", riskLevel: "medium",
          targetType: "campaign", targetName: c.campaignName,
          reason: `Campaign spent SGD ${c.spend.toFixed(2)} over 30 days with 0 conversions and ${avgCTR}% CTR. Adding negative keywords filters out irrelevant search traffic to stop budget waste.`,
          sourceData: evidence as any, confidence: "74.00" as any,
          expectedEffect: `Block irrelevant searches. Estimated 10-20% reduction in wasted spend for campaign "${c.campaignName}".`,
          rollbackInfo: rollbackPath, status: "pending",
        }).returning();

        await db.insert(aiApprovalQueue).values({
          queueType: "negative_keyword",
          title: `Add Negative Keywords: ${c.campaignName}`,
          description: `Add ${proposedKeywords.length} negative keywords to filter irrelevant traffic. Based on SGD ${c.spend.toFixed(2)} spend with zero conversions.`,
          riskLevel: "medium", confidence: "74.00" as any,
          expectedImpact: `Reduce wasted spend. Stop serving ads to users searching for "${proposedKeywords.slice(0, 3).join('", "')}" and similar non-commercial terms.`,
          proposedAction: {
            platform: "google", campaignName: c.campaignName, action: "add_negative_keywords",
            negativeKeywords: proposedKeywords.map(kw => ({ term: kw, matchType: "broad" })),
            evidence, instructions: "In Google Ads: Campaigns → [Campaign name] → Keywords → Negative keywords → Add list above as broad match negatives.",
          } as any,
          rollbackPath,
          refType: "ad_recommendation", refId: saved.id,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });
        results.negKeywords++;
      }

      // ── 2. AD COPY TEST ACTIONS ───────────────────────────────────────────────
      // Source: campaigns with avg CTR < 1% over 30 days, spend > $20
      for (const [, c] of Object.entries(campaignTotals)) {
        const avgCTR = c.impressions > 0 ? c.clicks / c.impressions * 100 : 0;
        if (avgCTR >= 1 || c.spend < 20 || c.impressions < 100) continue;
        if (await adRecExists(c.campaignName, "test")) { results.skipped++; continue; }

        const headlines = [
          `Professional ${c.campaignName.includes("Curtain") ? "Curtain" : c.campaignName.includes("Blind") ? "Blind" : "Furniture"} Installation — Booked Same Week`,
          `Trusted Singapore Installers — HDB & Condo Specialists`,
          `Fast, Clean Installation — Satisfaction Guaranteed`,
        ];
        const descriptions = [
          `Expert installation for your home. HDB-approved team, competitive rates. Free site visit. Book online today.`,
          `Singapore's trusted furniture installation team. Serving all areas. Fast turnaround. 100+ 5-star reviews.`,
        ];
        const rollbackPath = "Do not publish the draft ad. Delete the ad variation or set it to paused before any impressions are served. Original ads remain unchanged until explicitly replaced.";
        const evidence = {
          totalSpend: +c.spend.toFixed(2), avgCTR: +avgCTR.toFixed(2),
          impressions: c.impressions, source: "google_ads_api", analysisSource: "phase4_actions",
        };

        const [saved] = await db.insert(aiAdRecommendations).values({
          platform: "google", action: "test", riskLevel: "low",
          targetType: "campaign", targetName: c.campaignName,
          reason: `Avg CTR ${avgCTR.toFixed(2)}% is below 1% target. Current ad copy may not be resonating with search intent. A/B test new creative.`,
          sourceData: evidence as any, confidence: "68.00" as any,
          expectedEffect: `Lift CTR by 0.5–1.5%. Even a 0.5% CTR improvement on ${c.impressions} impressions would mean ~${Math.round(c.impressions * 0.005)} additional clicks.`,
          rollbackInfo: rollbackPath, status: "pending",
        }).returning();

        await db.insert(aiApprovalQueue).values({
          queueType: "creative",
          title: `A/B Test Ad Copy: ${c.campaignName}`,
          description: `Current CTR ${avgCTR.toFixed(2)}% is below 1%. Test 3 new headlines and 2 descriptions.`,
          riskLevel: "low", confidence: "68.00" as any,
          expectedImpact: `Lift CTR by 0.5–1.5%. Potential to add ${Math.round(c.impressions * 0.008)} clicks per month at current impression volume.`,
          proposedAction: {
            platform: "google", campaignName: c.campaignName, action: "create_ad_variation",
            headlines, descriptions, evidence,
            instructions: "In Google Ads: Campaigns → [Campaign] → Ads & Extensions → + New ad (or Responsive Search Ad). Copy proposed headlines and descriptions. Set as a 50/50 experiment.",
          } as any,
          rollbackPath,
          refType: "ad_recommendation", refId: saved.id,
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });
        results.copyTests++;
      }

      // ── 3. LANDING PAGE BRIEFS ────────────────────────────────────────────────
      // Source: GSC queries with position 1–10, impressions > 50, CTR < 2%
      const gscRows = await db.select().from(aiSearchConsoleData)
        .orderBy(desc(aiSearchConsoleData.impressions)).limit(200);

      for (const row of gscRows) {
        const pos = parseFloat(String(row.position ?? "99"));
        const ctr = parseFloat(String(row.ctr ?? "0"));
        const impr = row.impressions ?? 0;
        if (pos < 1 || pos > 10 || impr < 50 || ctr >= 2) continue;

        const title = `Landing Page Brief: "${row.query}"`;
        if (await siteRecExists(title)) { results.skipped++; continue; }

        const targetPage = row.page ?? "https://www.tmginstall.com/";
        const rollbackPath = "Discard the page content draft. No live site edits are applied until an editor manually implements and publishes the change. The current page content is unchanged.";

        const [saved] = await db.insert(aiSiteRecommendations).values({
          category: "cro", priority: "high", title,
          description: `Ranking position ${pos.toFixed(1)} for "${row.query}" (${impr} impressions, ${ctr.toFixed(1)}% CTR). A stronger title tag and meta description can lift CTR.`,
          suggestedChange: `1. Update <title>: "${row.query?.includes("install") ? "Professional " : ""}${row.query} Singapore | TMG Install"\n2. Update meta description: Add a call-to-action and key benefit (e.g., "Fast booking, HDB-approved team, satisfaction guaranteed.")\n3. Add an H1 on the target page that exactly matches the search query intent.\n4. Add a visible CTA button above the fold for "${row.query}" visitors.`,
          riskLevel: "low", status: "open",
        }).returning();

        await db.insert(aiApprovalQueue).values({
          queueType: "site_change",
          title,
          description: `Position ${pos.toFixed(1)}, ${impr} impressions, ${ctr.toFixed(1)}% CTR. Optimising this page could significantly increase organic traffic.`,
          riskLevel: "low", confidence: "71.00" as any,
          expectedImpact: `A 1% CTR improvement would add ~${Math.round(impr * 0.01)} organic clicks per month for this query.`,
          proposedAction: {
            action: "update_landing_page", targetPage, targetQuery: row.query,
            currentPosition: pos, currentCTR: ctr, impressions: impr,
            suggestedChanges: {
              titleTag: `${row.query} Singapore | TMG Install`,
              metaDescription: "Professional installation service. Fast booking. HDB-approved team. Satisfaction guaranteed.",
              h1Suggestion: `Professional ${row.query} in Singapore`,
              ctaText: "Get a Free Quote Today",
            },
            evidence: { source: "google_search_console", analysisSource: "phase4_actions" },
            instructions: "Update the page title tag, meta description, and H1. No backend changes required — frontend CMS update only.",
          } as any,
          rollbackPath,
          refType: "site_recommendation", refId: saved.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        results.landingPages++;
        if (results.landingPages >= 5) break; // cap at 5 per run
      }

      // ── 4. CRO COPY SUGGESTIONS ───────────────────────────────────────────────
      // Source: PageSpeed data + standard CRO best practices for the vertical
      const CRO_COPY_SUGGESTIONS = [
        {
          title: "Add urgency CTA above the fold",
          description: "Visitors need a reason to act now. Most furniture install sites lack urgency triggers.",
          suggestedChange: "Add a banner or sticky CTA: 'Book This Week — Limited Installation Slots'. Use a countdown or capacity indicator. Place above the fold on all service pages.",
          priority: "high" as const,
        },
        {
          title: "Add trust proof section: Customer photos + verified reviews",
          description: "Installation services rely heavily on social proof. A dedicated review section with customer photos increases conversion rate by 15–25% (CRO benchmark).",
          suggestedChange: "Create a 3-column grid of before/after photos with star ratings below each. Add a Google Reviews embed or manually curate 5 top reviews with customer name, HDB block area, and photo.",
          priority: "high" as const,
        },
        {
          title: "Service guarantee badge above booking form",
          description: "Reducing friction at the conversion point. A visible guarantee reduces bounce at the form step.",
          suggestedChange: "Add: '100% Satisfaction Guarantee — We return at no charge if anything is not right.' Display as a badge directly above or next to the booking/quote form.",
          priority: "medium" as const,
        },
        {
          title: "Add WhatsApp CTA for mobile visitors",
          description: "Mobile visitors convert better with direct messaging than forms. A WhatsApp button captures intent before visitors bounce.",
          suggestedChange: "Add a floating WhatsApp button (bottom-right, mobile only) with message: 'Hi, I'd like to enquire about installation services.' Link to wa.me/[number].",
          priority: "medium" as const,
        },
      ];

      // Always generate CRO suggestions — they are based on industry best practices,
      // not on live PageSpeed data (PageSpeed enriches them but is not required)
      const [psCheck] = await db.select({ id: aiPagespeedData.id }).from(aiPagespeedData).limit(1);
      const croSource = psCheck ? "pagespeed_insights" : "cro_best_practices";
      for (const sug of CRO_COPY_SUGGESTIONS) {
          if (await siteRecExists(sug.title)) { results.skipped++; continue; }
          const rollbackPath = "Discard the copy changes. The original page copy is unchanged until manually implemented by a developer or content editor. No automated site changes are applied.";

          const [saved] = await db.insert(aiSiteRecommendations).values({
            category: "copy", priority: sug.priority, title: sug.title,
            description: sug.description, suggestedChange: sug.suggestedChange,
            riskLevel: "low", status: "open",
          }).returning();

          await db.insert(aiApprovalQueue).values({
            queueType: "site_change",
            title: sug.title, description: sug.description,
            riskLevel: "low", confidence: "76.00" as any,
            expectedImpact: "Improves conversion rate on key service pages based on CRO best practices for local service verticals.",
            proposedAction: {
              action: "update_page_copy", category: "copy", priority: sug.priority,
              suggestedChange: sug.suggestedChange,
              evidence: { source: croSource, analysisSource: "phase4_actions" },
              instructions: "Review the suggested copy. If approved, pass to your web developer or content editor to implement. No automated site changes are made.",
            } as any,
            rollbackPath,
            refType: "site_recommendation", refId: saved.id,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
        results.croSuggestions++;
      }

      await logAiAction("recommendation_generated", actor, "actions",
        `Phase 4 action generator: ${results.negKeywords} neg-kw, ${results.copyTests} copy tests, ${results.landingPages} landing pages, ${results.croSuggestions} CRO`,
        results as any,
      );

      res.json({
        success: true, ...results,
        total: results.negKeywords + results.copyTests + results.landingPages + results.croSuggestions,
      });
    } catch (err: any) {
      console.error("[action generate]", err);
      res.status(500).json({ message: err.message ?? "Generation failed" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/audit-log */
  app.get("/api/ai/audit-log", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) ?? "200"), 500);
      const module = req.query.module as string | undefined;
      const rows = module
        ? await db.select().from(aiAuditLog).where(eq(aiAuditLog.module, module)).orderBy(desc(aiAuditLog.createdAt)).limit(limit)
        : await db.select().from(aiAuditLog).orderBy(desc(aiAuditLog.createdAt)).limit(limit);
      res.json(rows);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DASHBOARD SUMMARY
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/summary — combined dashboard summary */
  app.get("/api/ai/summary", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const [flags, pendingApprovals, latestAudit, recentRecs, recentAdRecs] = await Promise.all([
        db.select().from(aiFeatureFlags).orderBy(aiFeatureFlags.key),
        db.select().from(aiApprovalQueue).where(eq(aiApprovalQueue.status, "pending")),
        db.select().from(aiSiteAudits).where(eq(aiSiteAudits.status, "complete")).orderBy(desc(aiSiteAudits.createdAt)).limit(1),
        db.select().from(aiSiteRecommendations).where(eq(aiSiteRecommendations.status, "open")).orderBy(desc(aiSiteRecommendations.createdAt)).limit(10),
        db.select().from(aiAdRecommendations).where(eq(aiAdRecommendations.status, "pending")).orderBy(desc(aiAdRecommendations.createdAt)).limit(10),
      ]);

      const killSwitch = flags.find(f => f.key === "ai_master_kill_switch")?.value ?? false;

      // Quick conversion stats from live quotes (read-only)
      const allQuotes = await db.select({ status: quotes.status, total: quotes.total, createdAt: quotes.createdAt }).from(quotes).limit(500);
      const totalLeads = allQuotes.length;
      const deposited = allQuotes.filter(q => ["deposit_paid","booked","assigned","in_progress","completed","final_payment_requested","paid"].includes(q.status ?? "")).length;
      const finalPaid = allQuotes.filter(q => q.status === "paid").length;
      const totalRevenue = allQuotes.filter(q => q.status === "paid").reduce((s,q) => s + parseFloat(q.total ?? "0"), 0);

      res.json({
        killSwitch,
        flags: flags.reduce((acc: Record<string, boolean>, f) => { acc[f.key] = f.value; return acc; }, {}),
        pendingApprovalsCount: pendingApprovals.length,
        pendingApprovals: pendingApprovals.slice(0, 5),
        latestAudit: latestAudit[0] ?? null,
        openSiteRecs: recentRecs,
        pendingAdRecs: recentAdRecs,
        conversionStats: { totalLeads, deposited, finalPaid, totalRevenue: totalRevenue.toFixed(2) },
      });
    } catch (err: any) {
      console.error("[AI summary]", err);
      res.status(500).json({ message: "DB error" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CONNECTORS — status, sync triggers
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/connectors/status — returns configured state + row counts */
  app.get("/api/ai/connectors/status", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const configs = await db.select().from(aiConnectorConfigs);

      const [gAdsCount] = await db.select({ n: sql<number>`count(*)` }).from(aiAdsSnapshots).where(eq(aiAdsSnapshots.source, "google_ads_api"));
      const [mAdsCount] = await db.select({ n: sql<number>`count(*)` }).from(aiAdsSnapshots).where(eq(aiAdsSnapshots.source, "meta_ads_api"));
      const [gscCount] = await db.select({ n: sql<number>`count(*)` }).from(aiSearchConsoleData);
      const [psCount]  = await db.select({ n: sql<number>`count(*)` }).from(aiPagespeedData);

      const rowCounts: Record<string, number> = {
        google_ads: parseInt(String(gAdsCount?.n ?? 0)),
        meta_ads: parseInt(String(mAdsCount?.n ?? 0)),
        search_console: parseInt(String(gscCount?.n ?? 0)),
        pagespeed: parseInt(String(psCount?.n ?? 0)),
      };

      const missingMap: Record<string, string[]> = {
        google_ads: gadsCredsCheck(),
        meta_ads: metaCredsCheck(),
        search_console: gscCredsCheck(),
        pagespeed: [],
      };

      // ── Staleness thresholds: schedule window + 1h grace ─────────────────────
      const STALE_MS: Record<string, number> = {
        google_ads:     7  * 60 * 60 * 1000, // 6h schedule + 1h
        meta_ads:       7  * 60 * 60 * 1000,
        search_console: 25 * 60 * 60 * 1000, // 24h schedule + 1h
        pagespeed:      25 * 60 * 60 * 1000,
      };
      const SCHEDULE_HRS: Record<string, number> = {
        google_ads: 6, meta_ads: 6, search_console: 24, pagespeed: 24,
      };

      const schedulerEnabled = await getFlag("ai_scheduler_enabled");

      // Execution readiness — which connectors support live platform pushes
      const [gadsExecEnabled, metaExecEnabled, testModeEnabled] = await Promise.all([
        getFlag("ai_google_ads_execution_enabled"),
        getFlag("ai_meta_ads_execution_enabled"),
        getFlag("ai_platform_execution_test_mode"),
      ]);
      const execEnabled: Record<string, boolean> = {
        google_ads: gadsExecEnabled,
        meta_ads:   metaExecEnabled,
        search_console: false,
        pagespeed:  false,
      };
      const execMissingCreds: Record<string, string[]> = {
        google_ads:     gadsExecCredsCheck(),
        meta_ads:       metaExecCredsCheck(),
        search_console: [],
        pagespeed:      [],
      };

      const result: Record<string, any> = {};
      for (const cfg of configs) {
        const rowCount = rowCounts[cfg.name] ?? 0;
        const lastAt = cfg.lastSyncAt;
        const staleMs = STALE_MS[cfg.name] ?? Infinity;
        const schedHrs = SCHEDULE_HRS[cfg.name] ?? 0;

        let isStale = false;
        let staleReason: string | null = null;

        if (cfg.lastSyncStatus === "never" || !lastAt) {
          isStale = true; staleReason = "never_synced";
        } else if (cfg.lastSyncStatus === "error") {
          isStale = true; staleReason = "last_sync_failed";
        } else if (lastAt && Date.now() - new Date(lastAt).getTime() > staleMs) {
          isStale = true; staleReason = "overdue";
        } else if (rowCount === 0 && cfg.lastSyncStatus === "success") {
          isStale = true; staleReason = "zero_rows";
        }

        const nextSyncAt = lastAt && schedHrs > 0
          ? new Date(new Date(lastAt).getTime() + schedHrs * 3_600_000).toISOString()
          : null;

        const execReady = execEnabled[cfg.name] && execMissingCreds[cfg.name]?.length === 0;

        result[cfg.name] = {
          ...cfg,
          configured:           missingMap[cfg.name]?.length === 0,
          missing:              missingMap[cfg.name] ?? [],
          rowCount,
          isStale,
          staleReason,
          scheduleIntervalHours: schedHrs,
          nextSyncAt,
          schedulerEnabled,
          // Phase 7: Execution readiness
          executionEnabled:     execEnabled[cfg.name] ?? false,
          executionTestMode:    testModeEnabled,
          executionReady:       execReady ?? false,
          missingExecCreds:     execMissingCreds[cfg.name] ?? [],
        };
      }

      res.json(result);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  /** PATCH /api/ai/connectors/:name/execution-config — toggle execution_enabled or test_mode */
  app.patch("/api/ai/connectors/:name/execution-config", requireAdmin, async (req: Request, res: Response) => {
    const { name } = req.params;
    const VALID_NAMES = ["google_ads", "meta_ads"] as const;
    type ValidName = typeof VALID_NAMES[number];
    if (!VALID_NAMES.includes(name as ValidName)) {
      return res.status(400).json({ message: `Connector "${name}" does not support execution config.` });
    }

    const { executionEnabled, testMode } = req.body as { executionEnabled?: boolean; testMode?: boolean };
    if (executionEnabled === undefined && testMode === undefined) {
      return res.status(400).json({ message: "Provide at least one of: executionEnabled, testMode." });
    }

    try {
      // Map connector name → flag key
      const enabledFlagKey = name === "google_ads" ? "ai_google_ads_execution_enabled" : "ai_meta_ads_execution_enabled";
      const testModeFlagKey = "ai_platform_execution_test_mode";

      if (executionEnabled !== undefined) {
        await db
          .insert(aiFeatureFlags)
          .values({ key: enabledFlagKey, value: executionEnabled, description: `Execution enabled for ${name}` })
          .onConflictDoUpdate({ target: aiFeatureFlags.key, set: { value: executionEnabled, updatedAt: new Date() } });

        await logAiAction("admin", "execution_config_toggle", { connector: name, executionEnabled });
      }

      if (testMode !== undefined) {
        await db
          .insert(aiFeatureFlags)
          .values({ key: testModeFlagKey, value: testMode, description: "Platform execution test mode (dry run when true)" })
          .onConflictDoUpdate({ target: aiFeatureFlags.key, set: { value: testMode, updatedAt: new Date() } });

        await logAiAction("admin", "execution_config_toggle", { connector: name, testMode });
      }

      res.json({ success: true, connector: name, executionEnabled, testMode });
    } catch (err: any) {
      console.error("[execution-config]", err);
      res.status(500).json({ message: "DB error" });
    }
  });

  /** POST /api/ai/connectors/google-ads/sync */
  app.post("/api/ai/connectors/google-ads/sync", requireAdmin, async (_req: Request, res: Response) => {
    // Kill-switch and flag are checked FIRST — they override everything including missing creds
    const killSwitch = await getFlag("ai_master_kill_switch");
    const enabled = await getFlag("ai_google_ads_sync_enabled");
    if (killSwitch) return res.status(503).json({ message: "Kill switch active." });
    if (!enabled) return res.status(503).json({ message: "Google Ads sync is disabled. Enable ai_google_ads_sync_enabled flag." });

    const missing = gadsCredsCheck();
    if (missing.length) return res.status(400).json({ error: "not_configured", missing });

    // ── Concurrent sync guard ─────────────────────────────────────────────────
    if (await isSyncRunning("google_ads")) {
      return res.status(409).json({ message: "A Google Ads sync is already in progress. Please wait." });
    }

    await setConnectorSync("google_ads", "running");
    try {
      const { GOOGLE_ADS_CLIENT_ID: cid, GOOGLE_ADS_CLIENT_SECRET: cs, GOOGLE_ADS_REFRESH_TOKEN: rt,
              GOOGLE_ADS_DEVELOPER_TOKEN: dt, GOOGLE_ADS_CUSTOMER_ID: customerId } = process.env;
      const accessToken = await googleAccessToken(cid!, cs!, rt!);
      const cleanId = customerId!.replace(/-/g, "");
      const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];

      // ── External API call with 30 s timeout ──────────────────────────────────
      const gaqlRes = await fetchWithTimeout(
        `https://googleads.googleapis.com/v18/customers/${cleanId}/googleAds:search`,
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${accessToken}`, "developer-token": dt!, "Content-Type": "application/json" },
          body: JSON.stringify({ query: `SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc, segments.date FROM campaign WHERE segments.date BETWEEN '${thirtyAgo}' AND '${today}' AND campaign.status = 'ENABLED' ORDER BY segments.date DESC LIMIT 1000` }),
        },
      );
      const gaqlData: any = await gaqlRes.json();
      if (gaqlData.error) throw new Error(gaqlData.error.message ?? "Google Ads API error");

      // ── Atomic delete + insert inside a single transaction ───────────────────
      let inserted = 0;
      const rows = gaqlData.results ?? [];
      await db.transaction(async (tx) => {
        await tx.delete(aiAdsSnapshots).where(and(eq(aiAdsSnapshots.source, "google_ads_api"), gte(aiAdsSnapshots.snapshotDate, thirtyAgo)));
        for (const row of rows) {
          const spend = (parseInt(row.metrics?.costMicros ?? "0") / 1_000_000);
          const clicks = parseInt(String(row.metrics?.clicks ?? "0"));
          const impressions = parseInt(String(row.metrics?.impressions ?? "0"));
          const conversions = parseFloat(String(row.metrics?.conversions ?? "0"));
          const cpc = clicks > 0 ? spend / clicks : 0;
          await tx.insert(aiAdsSnapshots).values({
            platform: "google", source: "google_ads_api",
            snapshotDate: row.segments?.date ?? today,
            campaignId: String(row.campaign?.id ?? ""),
            campaignName: row.campaign?.name,
            adSetId: String(row.adGroup?.id ?? ""),
            adSetName: row.adGroup?.name,
            spend: spend.toFixed(2) as any,
            impressions, clicks,
            conversions: conversions.toFixed(2) as any,
            ctr: (parseFloat(String(row.metrics?.ctr ?? "0")) * 100).toFixed(4) as any,
            cpc: cpc.toFixed(4) as any,
            cpl: conversions > 0 ? (spend / conversions).toFixed(4) as any : "0",
            rawData: row as any,
          });
          inserted++;
        }
      });
      await setConnectorSync("google_ads", "success");
      await logAiAction("connector_sync", "admin", "ads", `Google Ads sync — ${inserted} rows imported`, { inserted });
      res.json({ success: true, inserted });
    } catch (err: any) {
      await setConnectorSync("google_ads", "error", err.message);
      res.status(500).json({ message: err.message ?? "Sync failed" });
    }
  });

  /** POST /api/ai/connectors/meta-ads/sync */
  app.post("/api/ai/connectors/meta-ads/sync", requireAdmin, async (_req: Request, res: Response) => {
    const killSwitch = await getFlag("ai_master_kill_switch");
    const enabled = await getFlag("ai_meta_ads_sync_enabled");
    if (killSwitch) return res.status(503).json({ message: "Kill switch active." });
    if (!enabled) return res.status(503).json({ message: "Meta Ads sync is disabled. Enable ai_meta_ads_sync_enabled flag." });

    const missing = metaCredsCheck();
    if (missing.length) return res.status(400).json({ error: "not_configured", missing });

    // ── Concurrent sync guard ─────────────────────────────────────────────────
    if (await isSyncRunning("meta_ads")) {
      return res.status(409).json({ message: "A Meta Ads sync is already in progress. Please wait." });
    }

    await setConnectorSync("meta_ads", "running");
    try {
      const { META_ACCESS_TOKEN: token, META_AD_ACCOUNT_ID: accountId } = process.env;
      const params = new URLSearchParams({
        access_token: token!,
        fields: "campaign_id,campaign_name,adset_id,adset_name,spend,impressions,clicks,actions,action_values,date_start,date_stop",
        date_preset: "last_30d",
        level: "adset",
        time_increment: "1",
        limit: "500",
      });
      // ── External API call with 30 s timeout ──────────────────────────────────
      const metaRes = await fetchWithTimeout(
        `https://graph.facebook.com/v20.0/act_${accountId}/insights?${params}`,
      );
      const metaData: any = await metaRes.json();
      if (metaData.error) throw new Error(metaData.error.message ?? "Meta API error");

      // ── Atomic delete + insert inside a single transaction ───────────────────
      const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      let inserted = 0;
      const rows = metaData.data ?? [];
      await db.transaction(async (tx) => {
        await tx.delete(aiAdsSnapshots).where(and(eq(aiAdsSnapshots.source, "meta_ads_api"), gte(aiAdsSnapshots.snapshotDate, thirtyAgo)));
        for (const row of rows) {
          const spend = parseFloat(row.spend ?? "0");
          const clicks = parseInt(String(row.clicks ?? "0"));
          const impressions = parseInt(String(row.impressions ?? "0"));
          const leadsAction = row.actions?.find((a: any) => ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"].includes(a.action_type));
          const conversions = parseFloat(leadsAction?.value ?? "0");
          const convValue = row.action_values?.find((a: any) => a.action_type === leadsAction?.action_type)?.value ?? "0";
          const ctr = impressions > 0 ? (clicks / impressions * 100).toFixed(4) : "0";
          const cpc = clicks > 0 ? (spend / clicks).toFixed(4) : "0";
          const cpl = conversions > 0 ? (spend / conversions).toFixed(4) : "0";
          await tx.insert(aiAdsSnapshots).values({
            platform: "meta", source: "meta_ads_api",
            snapshotDate: row.date_start,
            campaignId: row.campaign_id, campaignName: row.campaign_name,
            adSetId: row.adset_id, adSetName: row.adset_name,
            spend: spend.toFixed(2) as any, impressions, clicks,
            conversions: conversions.toFixed(2) as any, conversionValue: parseFloat(convValue).toFixed(2) as any,
            ctr: ctr as any, cpc: cpc as any, cpl: cpl as any,
            rawData: row as any,
          });
          inserted++;
        }
      });
      await setConnectorSync("meta_ads", "success");
      await logAiAction("connector_sync", "admin", "ads", `Meta Ads sync — ${inserted} rows imported`, { inserted });
      res.json({ success: true, inserted });
    } catch (err: any) {
      await setConnectorSync("meta_ads", "error", err.message);
      res.status(500).json({ message: err.message ?? "Sync failed" });
    }
  });

  /** POST /api/ai/connectors/search-console/sync */
  app.post("/api/ai/connectors/search-console/sync", requireAdmin, async (_req: Request, res: Response) => {
    const killSwitch = await getFlag("ai_master_kill_switch");
    const enabled = await getFlag("ai_search_console_enabled");
    if (killSwitch) return res.status(503).json({ message: "Kill switch active." });
    if (!enabled) return res.status(503).json({ message: "Search Console sync is disabled. Enable ai_search_console_enabled flag." });

    const missing = gscCredsCheck();
    if (missing.length) return res.status(400).json({ error: "not_configured", missing });

    // ── Concurrent sync guard ─────────────────────────────────────────────────
    if (await isSyncRunning("search_console")) {
      return res.status(409).json({ message: "A Search Console sync is already in progress. Please wait." });
    }

    await setConnectorSync("search_console", "running");
    try {
      const { GSC_CLIENT_ID: cid, GSC_CLIENT_SECRET: cs, GSC_REFRESH_TOKEN: rt } = process.env;
      const siteUrl = process.env.GSC_SITE_URL ?? "https://www.tmginstall.com/";
      const accessToken = await googleAccessToken(cid!, cs!, rt!);
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const syncId = `${startDate}__${endDate}`;

      // ── External API call with 30 s timeout ──────────────────────────────────
      const gscRes = await fetchWithTimeout(
        `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ startDate, endDate, dimensions: ["query", "page", "country", "device"], rowLimit: 1000 }),
        },
      );
      const gscData: any = await gscRes.json();
      if (gscData.error) throw new Error(gscData.error.message ?? "Search Console API error");

      // ── Atomic delete + insert inside a single transaction ───────────────────
      let inserted = 0;
      const rows = gscData.rows ?? [];
      await db.transaction(async (tx) => {
        await tx.delete(aiSearchConsoleData).where(eq(aiSearchConsoleData.syncId, syncId));
        for (const row of rows) {
          await tx.insert(aiSearchConsoleData).values({
            syncId, date: endDate,
            query: row.keys?.[0], page: row.keys?.[1],
            country: row.keys?.[2], device: row.keys?.[3],
            clicks: row.clicks ?? 0, impressions: row.impressions ?? 0,
            ctr: (row.ctr != null ? (row.ctr * 100).toFixed(4) : "0") as any,
            position: row.position != null ? parseFloat(row.position.toFixed(2)) as any : null,
          });
          inserted++;
        }
      });
      await setConnectorSync("search_console", "success");
      await logAiAction("connector_sync", "admin", "attribution", `Search Console sync — ${inserted} queries imported`, { inserted, syncId });
      res.json({ success: true, inserted, syncId, startDate, endDate });
    } catch (err: any) {
      await setConnectorSync("search_console", "error", err.message);
      res.status(500).json({ message: err.message ?? "Sync failed" });
    }
  });

  /** POST /api/ai/connectors/pagespeed/sync — no credentials required */
  app.post("/api/ai/connectors/pagespeed/sync", requireAdmin, async (_req: Request, res: Response) => {
    const killSwitch = await getFlag("ai_master_kill_switch");
    const enabled = await getFlag("ai_pagespeed_enabled");
    if (killSwitch) return res.status(503).json({ message: "Kill switch active." });
    if (!enabled) return res.status(503).json({ message: "PageSpeed sync disabled. Enable ai_pagespeed_enabled flag." });

    // ── Concurrent sync guard ─────────────────────────────────────────────────
    if (await isSyncRunning("pagespeed")) {
      return res.status(409).json({ message: "A PageSpeed sync is already in progress. Please wait." });
    }

    await setConnectorSync("pagespeed", "running");
    try {
      const apiKey = process.env.GOOGLE_API_KEY ?? "";
      const targetUrl = process.env.PAGESPEED_TARGET_URL ?? "https://www.tmginstall.com";
      const results: any[] = [];

      for (const strategy of ["mobile", "desktop"] as const) {
        const qs = new URLSearchParams({ url: targetUrl, strategy });
        if (apiKey) qs.set("key", apiKey);
        // ── Per-strategy fetch with 45 s timeout (PageSpeed can be slow) ────────
        const psRes = await fetchWithTimeout(
          `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`,
          {},
          45_000,
        );
        const psData: any = await psRes.json();
        if (psData.error) { results.push({ strategy, error: psData.error.message }); continue; }

        const cats = psData.lighthouseResult?.categories ?? {};
        const audits = psData.lighthouseResult?.audits ?? {};
        const score = (key: string) => cats[key]?.score != null ? Math.round(cats[key].score * 100) : null;
        const auditMs = (key: string) => audits[key]?.numericValue ? Math.round(audits[key].numericValue) : null;

        await db.insert(aiPagespeedData).values({
          url: targetUrl, strategy,
          performanceScore: score("performance"),
          accessibilityScore: score("accessibility"),
          seoScore: score("seo"),
          bestPracticesScore: score("best-practices"),
          fcpMs: auditMs("first-contentful-paint"),
          lcpMs: auditMs("largest-contentful-paint"),
          clsScore: audits["cumulative-layout-shift"]?.numericValue != null
            ? parseFloat(audits["cumulative-layout-shift"].numericValue.toFixed(4)) as any : null,
          ttfbMs: auditMs("server-response-time"),
          rawAudits: {
            tbt: audits["total-blocking-time"]?.numericValue,
            tti: audits["interactive"]?.numericValue,
            si: audits["speed-index"]?.numericValue,
          } as any,
        });
        results.push({ strategy, performanceScore: score("performance"), seoScore: score("seo") });
      }

      // ── Prune: keep only the 10 most recent rows per strategy ────────────────
      for (const strat of ["mobile", "desktop"] as const) {
        const allForStrat = await db
          .select({ id: aiPagespeedData.id })
          .from(aiPagespeedData)
          .where(eq(aiPagespeedData.strategy, strat))
          .orderBy(desc(aiPagespeedData.createdAt));
        const toDelete = allForStrat.slice(10).map(r => r.id);
        if (toDelete.length > 0) {
          await db.delete(aiPagespeedData).where(inArray(aiPagespeedData.id, toDelete));
        }
      }

      await setConnectorSync("pagespeed", "success");
      await logAiAction("connector_sync", "admin", "site", `PageSpeed sync — mobile+desktop scored`, { results });
      res.json({ success: true, results });
    } catch (err: any) {
      await setConnectorSync("pagespeed", "error", err.message);
      res.status(500).json({ message: err.message ?? "Sync failed" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CONNECTOR SCHEDULER STATUS
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/connectors/schedule — scheduler status + next run times */
  app.get("/api/ai/connectors/schedule", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const schedulerEnabled = await getFlag("ai_scheduler_enabled");
      const configs = await db.select().from(aiConnectorConfigs);

      const SCHED_HRS: Record<string, number> = {
        google_ads: 6, meta_ads: 6, search_console: 24, pagespeed: 24,
      };
      const SCHED_FLAGS: Record<string, string> = {
        google_ads: "ai_google_ads_sync_enabled",
        meta_ads: "ai_meta_ads_sync_enabled",
        search_console: "ai_search_console_enabled",
        pagespeed: "ai_pagespeed_enabled",
      };

      const jobs = await Promise.all(configs.map(async (cfg) => {
        const intervalHours = SCHED_HRS[cfg.name] ?? 0;
        const intervalMs = intervalHours * 3_600_000;
        const lastAt = cfg.lastSyncAt;
        const nextSyncAt = lastAt && intervalMs > 0
          ? new Date(new Date(lastAt).getTime() + intervalMs).toISOString()
          : null;
        const isOverdue = !lastAt || Date.now() - new Date(lastAt).getTime() >= intervalMs;
        const flagEnabled = await getFlag(SCHED_FLAGS[cfg.name] ?? "");
        return {
          name: cfg.name,
          intervalHours,
          lastSyncAt: lastAt,
          lastSyncStatus: cfg.lastSyncStatus,
          nextSyncAt,
          isOverdue,
          flagEnabled,
        };
      }));

      res.json({ schedulerEnabled, jobs });
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // CONNECTOR ANALYZE — Rules-based signals from API-imported data
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * POST /api/ai/connectors/analyze
   *
   * Generates deterministic (no OpenAI) recommendations from live-imported data:
   *   - Ads waste / fatigue / scale signals  → ai_ad_recommendations (status=pending)
   *   - GSC keyword opportunities            → ai_site_recommendations (status=open)
   *   - PageSpeed / Core Web Vitals signals  → ai_site_recommendations (status=open)
   *
   * Deduplicates: will not insert a duplicate pending/open rec for the same
   * campaign+action or same title that already exists.
   *
   * Safety: respects kill-switch. Writes only to ai_* tables.
   */
  app.post("/api/ai/connectors/analyze", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const killSwitch = await getFlag("ai_master_kill_switch");
      if (killSwitch) return res.status(503).json({ message: "Kill switch active." });

      const results = { adsSignals: 0, gscSignals: 0, speedSignals: 0, skipped: 0 };

      // ── ADS ANALYSIS (API-synced rows only) ──────────────────────────────────
      const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const adsRows = await db.select().from(aiAdsSnapshots)
        .where(and(
          gte(aiAdsSnapshots.snapshotDate, thirtyAgo),
          inArray(aiAdsSnapshots.source, ["google_ads_api", "meta_ads_api"]),
        ))
        .orderBy(desc(aiAdsSnapshots.snapshotDate));

      // Group by platform + campaign name
      const campaignMap: Record<string, typeof adsRows> = {};
      for (const row of adsRows) {
        const key = `${row.platform}||${row.campaignName ?? "unknown"}`;
        (campaignMap[key] ??= []).push(row);
      }

      for (const [key, rows] of Object.entries(campaignMap)) {
        const [platform, campaignName] = key.split("||");
        const totalSpend = rows.reduce((s, r) => s + parseFloat(r.spend ?? "0"), 0);
        const totalClicks = rows.reduce((s, r) => s + (r.clicks ?? 0), 0);
        const totalConversions = rows.reduce((s, r) => s + parseFloat(r.conversions ?? "0"), 0);
        const totalImpr = rows.reduce((s, r) => s + (r.impressions ?? 0), 0);
        const avgCTR = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
        const avgCPC = totalClicks > 0 ? totalSpend / totalClicks : 0;
        const avgCPL = totalConversions > 0 ? totalSpend / totalConversions : 0;
        const evidence = {
          totalSpend: +totalSpend.toFixed(2),
          totalClicks,
          totalConversions: +totalConversions.toFixed(2),
          avgCTR: +avgCTR.toFixed(2),
          avgCPC: +avgCPC.toFixed(2),
          avgCPL: +avgCPL.toFixed(2),
          source: rows[0]?.source,
          days: rows.length,
          analysisSource: "connector_rules",
        };
        if (totalSpend === 0) continue;

        type AdAction = "cut" | "keep" | "scale" | "test" | "pause" | "negate";
        let action: AdAction | null = null;
        let riskLevel = "medium";
        let reason = "";
        let expectedEffect = "";
        let confidence = "72.00";

        // Rule 1: High spend + zero conversions → waste signal
        if (totalSpend > 100 && totalConversions < 1) {
          action = "cut"; riskLevel = "high"; confidence = "85.00";
          reason = `Campaign spent SGD ${totalSpend.toFixed(2)} over ${rows.length} days with 0 conversions. Clear waste signal from API data.`;
          expectedEffect = "Stop budget drain. Reallocate to converting campaigns.";
        }
        // Rule 2: CTR < 0.5% — fatigue / poor targeting
        else if (avgCTR < 0.5 && totalSpend > 50) {
          action = "test"; riskLevel = "medium"; confidence = "72.00";
          reason = `Avg CTR ${avgCTR.toFixed(2)}% is below 0.5%. Ad creative or audience may be fatigued (API data, last ${rows.length} days).`;
          expectedEffect = "Fresh creative or audience test could lift CTR by 1–2%.";
        }
        // Rule 3: Good CTR + good conv rate + CPL < SGD 200 → scale
        else if (avgCTR > 2 && totalConversions >= 2 && avgCPL < 200 && avgCPL > 0) {
          action = "scale"; riskLevel = "low"; confidence = "78.00";
          reason = `Strong: CTR ${avgCTR.toFixed(2)}%, CPL SGD ${avgCPL.toFixed(2)}, ${totalConversions.toFixed(0)} conversions over ${rows.length} days. Scale candidate.`;
          expectedEffect = "10–20% budget increase should proportionally scale lead volume.";
        }
        // Rule 4: CPC > SGD 8 + low conversions
        else if (avgCPC > 8 && totalConversions < 2 && totalSpend > 80) {
          action = "pause"; riskLevel = "high"; confidence = "80.00";
          reason = `High CPC SGD ${avgCPC.toFixed(2)} with only ${totalConversions.toFixed(0)} conversions and SGD ${totalSpend.toFixed(2)} spend. Poor efficiency.`;
          expectedEffect = "Pause to audit keywords and match types before re-enabling.";
        }

        if (!action) continue;

        // Dedup: skip if pending rec with same campaign+action already exists
        const existing = await db.select({ id: aiAdRecommendations.id })
          .from(aiAdRecommendations)
          .where(and(
            eq(aiAdRecommendations.targetName, campaignName),
            eq(aiAdRecommendations.action, action),
            eq(aiAdRecommendations.status, "pending"),
          )).limit(1);

        if (existing.length > 0) { results.skipped++; continue; }

        await db.insert(aiAdRecommendations).values({
          platform, action, riskLevel,
          targetType: "campaign", targetName: campaignName,
          reason, sourceData: evidence as any, confidence: confidence as any,
          expectedEffect, status: "pending",
        });
        results.adsSignals++;

        // Auto-queue medium/high risk items for approval
        if (riskLevel !== "low") {
          // ── High-confidence auto-approve gate (hardened) ─────────────────
          // Per-action-type threshold from app_settings:
          //   ai_autoapprove_threshold_<action>   (e.g. _pause, _adjust_budget)
          //   ai_autoapprove_default_threshold    (fallback, default 0.9)
          // High-impact actions (anything containing 'budget' or 'spend') also
          // require ai_autoapprove_allow_high_impact=true. Everything is logged.
          const autoApproveOn = await getFlag("ai_high_confidence_autoapprove");
          const allowHighImpact = await getFlag("ai_autoapprove_allow_high_impact");
          const actionLc = String(action ?? "").toLowerCase();
          const isHighImpact = /budget|spend|scale/.test(actionLc);

          // Per-type threshold lookup with default fallback
          const perTypeKey = `ai_autoapprove_threshold_${actionLc}`;
          const [perTypeRow] = await db.select().from(appSettings).where(eq(appSettings.key, perTypeKey)).limit(1);
          const [defRow]     = await db.select().from(appSettings).where(eq(appSettings.key, "ai_autoapprove_default_threshold")).limit(1);
          const minConf = parseFloat(perTypeRow?.value ?? defRow?.value ?? "0.9");
          // Confidence is stored as a 0–100 percentage string (e.g. "74.00").
          // Normalize to 0..1 so comparison against the 0..1 threshold is correct.
          const rawConf = parseFloat(String(confidence ?? "0"));
          const numericConf = rawConf > 1 ? rawConf / 100 : rawConf;

          const blockedByHighImpactFlag = isHighImpact && !allowHighImpact;
          const shouldAutoApprove =
            autoApproveOn &&
            numericConf >= minConf &&
            riskLevel === "medium" &&
            !blockedByHighImpactFlag;
          // Hard fence: never auto-approve "high" risk items, even if confidence is 1.0

          // Audit when we *could* have auto-approved but blocked by high-impact gate
          if (autoApproveOn && numericConf >= minConf && riskLevel === "medium" && blockedByHighImpactFlag) {
            await db.insert(aiAuditLog).values({
              actionType: "autoapprove_blocked",
              actor: "ai_autoapprove",
              module: "ads",
              summary: `Auto-approve eligible but blocked by high-impact gate: ${action} ${campaignName}`,
              detail: { confidence: numericConf, threshold: minConf, action, campaignName } as any,
              outcome: "skipped",
            }).catch(() => {});
          }

          const [inserted] = await db.insert(aiApprovalQueue).values({
            queueType: "ads_change",
            title: `${action.toUpperCase()}: ${campaignName}`,
            description: reason,
            riskLevel,
            confidence: confidence as any,
            expectedImpact: expectedEffect,
            proposedAction: evidence as any,
            refType: "ad_recommendation",
            status: shouldAutoApprove ? "approved" : "pending",
            reviewedBy: shouldAutoApprove ? "ai_autoapprove" : null,
            reviewedAt: shouldAutoApprove ? new Date() : null,
            reviewNote: shouldAutoApprove ? `Auto-approved: confidence ${numericConf.toFixed(2)} ≥ threshold ${minConf}` : null,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          }).returning();

          if (shouldAutoApprove && inserted) {
            // Real-time alert: AI made a decision without you — you should know.
            try {
              const { sendAiAlert } = await import("./ai-alerts");
              await sendAiAlert({
                severity: "info",
                channel: "approval",
                title: `AI auto-approved: ${action}`,
                body: `${campaignName}\nConfidence ${(numericConf * 100).toFixed(0)}% ≥ ${(minConf * 100).toFixed(0)}% threshold`,
                url: "/admin/ai/approvals",
              });
            } catch {}
            await db.insert(aiAuditLog).values({
              actionType: "action_approved",
              actor: "ai_autoapprove",
              module: "ads",
              summary: `Auto-approved (conf ${numericConf.toFixed(2)} ≥ ${minConf}): ${action} ${campaignName}`,
              detail: { confidence: numericConf, threshold: minConf, riskLevel, action, campaignName, reason } as any,
              outcome: "success",
            });
            // Immediately run the auto-execute pipeline so the change actually
            // pushes to the platform — without this, auto-approved items would
            // sit in the queue with status='approved' but never execute.
            try {
              await runAutoExecuteOnApproval(inserted, "ai_autoapprove");
            } catch (autoErr: any) {
              await db.insert(aiAuditLog).values({
                actionType: "action_applied",
                actor: "ai_autoapprove",
                module: "ads",
                summary: `Auto-execute after auto-approve FAILED: ${campaignName}`,
                detail: { approvalId: inserted.id, error: autoErr.message ?? String(autoErr) } as any,
                outcome: "failed",
              });
            }
          }
        }
      }

      // ── GSC KEYWORD OPPORTUNITY ANALYSIS ─────────────────────────────────────
      const gscRows = await db.select().from(aiSearchConsoleData)
        .orderBy(desc(aiSearchConsoleData.clicks)).limit(500);

      for (const row of gscRows) {
        const pos = parseFloat(String(row.position ?? "99"));
        const ctr = parseFloat(String(row.ctr ?? "0"));
        const impr = row.impressions ?? 0;
        const query = row.query ?? "(not set)";

        let title = "";
        let description = "";
        let suggestedChange = "";
        let priority = "medium";

        // Rule 1: Position 4-10 + high impressions → near page 1 opportunity
        if (pos >= 4 && pos <= 10 && impr > 100) {
          priority = "high";
          title = `Near-page-1 keyword: "${query}"`;
          description = `Position ${pos.toFixed(1)} with ${impr} impressions in last 28 days. Content optimization could push to top 3.`;
          suggestedChange = `Expand content around "${query}" — add FAQ sections, service detail copy, or a dedicated landing page.`;
        }
        // Rule 2: Position 1-3 + CTR < 2% → meta description opportunity
        else if (pos <= 3 && ctr < 2 && impr > 50) {
          priority = "medium";
          title = `Low CTR in top position: "${query}"`;
          description = `Position ${pos.toFixed(1)} but only ${ctr.toFixed(1)}% CTR with ${impr} impressions. Meta description may not be compelling.`;
          suggestedChange = `Improve title tag and meta description for pages ranking for "${query}" to increase click-through.`;
        }

        if (!title) continue;

        // Dedup by title
        const existingRec = await db.select({ id: aiSiteRecommendations.id })
          .from(aiSiteRecommendations)
          .where(and(
            eq(aiSiteRecommendations.title, title),
            eq(aiSiteRecommendations.status, "open"),
          )).limit(1);
        if (existingRec.length > 0) { results.skipped++; continue; }

        await db.insert(aiSiteRecommendations).values({
          category: "seo", priority, title, description, suggestedChange,
          riskLevel: "low", status: "open",
        });
        results.gscSignals++;
      }

      // ── PAGESPEED / CORE WEB VITALS ANALYSIS ─────────────────────────────────
      for (const strategy of ["mobile", "desktop"] as const) {
        const [ps] = await db.select().from(aiPagespeedData)
          .where(eq(aiPagespeedData.strategy, strategy))
          .orderBy(desc(aiPagespeedData.createdAt)).limit(1);
        if (!ps) continue;

        const checks = [
          {
            cond: ps.performanceScore != null && ps.performanceScore < 50,
            priority: "critical",
            title: `Critical performance score (${strategy}): ${ps.performanceScore}/100`,
            description: `${strategy} Lighthouse performance score is critically low. Impacts both user experience and Google rankings.`,
            suggestedChange: "Audit Core Web Vitals — common causes: render-blocking JS, unoptimized images, large layout shifts.",
          },
          {
            cond: ps.performanceScore != null && ps.performanceScore >= 50 && ps.performanceScore < 70,
            priority: "high",
            title: `Below-average performance (${strategy}): ${ps.performanceScore}/100`,
            description: `${strategy} performance is below Google's "good" threshold (90+). May hurt SEO and conversions.`,
            suggestedChange: "Focus on LCP and FID — compress images, defer non-critical JS, add caching headers.",
          },
          {
            cond: ps.lcpMs != null && ps.lcpMs > 4000,
            priority: "high",
            title: `Slow LCP (${strategy}): ${ps.lcpMs != null ? (ps.lcpMs / 1000).toFixed(1) : "—"}s`,
            description: `Largest Contentful Paint exceeds 4s on ${strategy}. Google considers >4s "poor".`,
            suggestedChange: "Optimize hero image — use WebP, add preload <link>, defer non-critical scripts above the fold.",
          },
          {
            cond: ps.clsScore != null && parseFloat(String(ps.clsScore)) > 0.25,
            priority: "high",
            title: `High layout shift (${strategy}): CLS ${parseFloat(String(ps.clsScore ?? "0")).toFixed(3)}`,
            description: `CLS ${parseFloat(String(ps.clsScore ?? "0")).toFixed(3)} on ${strategy} exceeds the 0.25 "poor" threshold. Elements jump during load.`,
            suggestedChange: "Add explicit width/height to images and ads. Reserve space for dynamic banners/widgets.",
          },
          {
            cond: ps.ttfbMs != null && ps.ttfbMs > 1800,
            priority: "medium",
            title: `Slow server response (${strategy}): TTFB ${ps.ttfbMs}ms`,
            description: `Time to First Byte of ${ps.ttfbMs}ms on ${strategy} is above the 1800ms "poor" threshold.`,
            suggestedChange: "Add caching (CDN or server-side), reduce database query time, or upgrade hosting plan.",
          },
        ];

        for (const check of checks) {
          if (!check.cond) continue;

          const existingRec = await db.select({ id: aiSiteRecommendations.id })
            .from(aiSiteRecommendations)
            .where(and(
              eq(aiSiteRecommendations.title, check.title),
              eq(aiSiteRecommendations.status, "open"),
            )).limit(1);
          if (existingRec.length > 0) { results.skipped++; continue; }

          await db.insert(aiSiteRecommendations).values({
            category: "speed", priority: check.priority,
            title: check.title, description: check.description,
            suggestedChange: check.suggestedChange,
            riskLevel: "low", status: "open",
          });
          results.speedSignals++;
        }
      }

      await logAiAction("connector_analyze", "admin", "connectors",
        `Connector analyze — ${results.adsSignals} ads, ${results.gscSignals} GSC, ${results.speedSignals} speed signals`,
        results as any);

      res.json({
        success: true,
        ...results,
        total: results.adsSignals + results.gscSignals + results.speedSignals,
      });
    } catch (err: any) {
      console.error("[connector analyze]", err);
      res.status(500).json({ message: err.message ?? "Analysis failed" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // SEARCH CONSOLE DATA
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/search-console/data — paginated query rows */
  app.get("/api/ai/search-console/data", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) ?? "100"), 500);
      const rows = await db.select().from(aiSearchConsoleData)
        .orderBy(desc(aiSearchConsoleData.clicks))
        .limit(limit);
      res.json(rows);
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PAGESPEED DATA
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/pagespeed/data — latest scores per strategy */
  app.get("/api/ai/pagespeed/data", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const mobile = await db.select().from(aiPagespeedData)
        .where(eq(aiPagespeedData.strategy, "mobile"))
        .orderBy(desc(aiPagespeedData.createdAt)).limit(1);
      const desktop = await db.select().from(aiPagespeedData)
        .where(eq(aiPagespeedData.strategy, "desktop"))
        .orderBy(desc(aiPagespeedData.createdAt)).limit(1);
      const history = await db.select().from(aiPagespeedData)
        .orderBy(desc(aiPagespeedData.createdAt)).limit(20);
      res.json({ mobile: mobile[0] ?? null, desktop: desktop[0] ?? null, history });
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // ATTRIBUTION JOURNEY (per-quote conversion path)
  // ════════════════════════════════════════════════════════════════════════════

  /** GET /api/ai/attribution/journey/:referenceNo */
  app.get("/api/ai/attribution/journey/:referenceNo", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { referenceNo } = req.params;
      const [quote] = await db.select({
        id: quotes.id, referenceNo: quotes.referenceNo, status: quotes.status,
        total: quotes.total, sourceChannel: quotes.sourceChannel,
        createdAt: quotes.createdAt, depositPaidAt: quotes.depositPaidAt,
        finalPaidAt: quotes.finalPaidAt, scheduledAt: quotes.scheduledAt,
      }).from(quotes).where(eq(quotes.referenceNo, referenceNo)).limit(1);

      if (!quote) return res.status(404).json({ message: "Quote not found" });

      const events = await db.select().from(aiAttributionEvents)
        .where(eq(aiAttributionEvents.referenceNo, referenceNo))
        .orderBy(aiAttributionEvents.createdAt);

      // Build timeline deltas
      const firstEvent = events[0];
      const depositEvent = events.find(e => e.eventType === "deposit_paid");
      const finalEvent = events.find(e => e.eventType === "final_paid");

      const msDiff = (a: Date | null | undefined, b: Date | null | undefined) => {
        if (!a || !b) return null;
        const diff = new Date(b).getTime() - new Date(a).getTime();
        const h = Math.floor(diff / 3600000);
        return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
      };

      res.json({
        referenceNo,
        quote,
        events,
        timeline: {
          source: firstEvent?.source ?? quote.sourceChannel ?? "unknown",
          leadToDeposit: msDiff(quote.createdAt, quote.depositPaidAt),
          depositToBooking: msDiff(quote.depositPaidAt, quote.scheduledAt),
          bookingToFinal: msDiff(quote.scheduledAt, quote.finalPaidAt),
          utmSource: firstEvent?.utmSource,
          utmMedium: firstEvent?.utmMedium,
          utmCampaign: firstEvent?.utmCampaign,
        },
      });
    } catch { res.status(500).json({ message: "DB error" }); }
  });

  // ── GET /api/ai/spend-status ────────────────────────────────────────────
  // Today/month AI-driven ad-spend totals + caps + utilization. Powers the
  // AIHub spend guardrails card.
  app.get("/api/ai/spend-status", requireAdmin, async (_req, res) => {
    try {
      const { getSpendStatus } = await import("./ai-spend-guard");
      const status = await getSpendStatus();
      res.json(status);
    } catch (e: any) {
      console.error("[ai/spend-status] error:", e);
      res.status(500).json({ message: e?.message ?? "DB error" });
    }
  });

  // ── GET /api/ai/llm-health ──────────────────────────────────────────────
  // Per-agent LLM telemetry (last 24h): call count, success rate, p50/p95
  // latency, total tokens, total SGD cost, schema-repair count, current
  // circuit-breaker state. Powers the LLM Health card in the AI Hub.
  app.get("/api/ai/llm-health", requireAdmin, async (_req, res) => {
    try {
      const { getBreakerSnapshot } = await import("./ai-llm-client");
      const rows: Array<any> = await db.execute(sql`
        SELECT
          agent,
          COUNT(*)::int                                          AS calls,
          SUM(CASE WHEN success THEN 1 ELSE 0 END)::int          AS successes,
          SUM(CASE WHEN schema_repaired THEN 1 ELSE 0 END)::int  AS repairs,
          SUM(total_tokens)::int                                 AS tokens,
          ROUND(SUM(cost_sgd)::numeric, 4)                       AS cost_sgd,
          ROUND(AVG(latency_ms)::numeric, 0)                     AS avg_latency_ms,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms)::int AS p50_latency_ms,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::int AS p95_latency_ms,
          MAX(created_at)                                        AS last_call_at
        FROM ai_llm_calls
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY agent
        ORDER BY calls DESC
      `).then((r: any) => r.rows ?? r);

      const totals = rows.reduce((acc: any, r: any) => {
        acc.calls    += Number(r.calls ?? 0);
        acc.tokens   += Number(r.tokens ?? 0);
        acc.cost_sgd += Number(r.cost_sgd ?? 0);
        acc.repairs  += Number(r.repairs ?? 0);
        return acc;
      }, { calls: 0, tokens: 0, cost_sgd: 0, repairs: 0 });
      const totalSuccesses = rows.reduce((s: number, r: any) => s + Number(r.successes ?? 0), 0);
      const successRate = totals.calls > 0 ? totalSuccesses / totals.calls : null;

      const breakers = getBreakerSnapshot();
      const breakerByAgent: Record<string, { open: boolean; openUntil: number; failures: number; successes: number }> = {};
      for (const b of breakers) {
        breakerByAgent[b.agent] = {
          open: b.openUntil > Date.now(),
          openUntil: b.openUntil,
          failures: b.failures,
          successes: b.successes,
        };
      }

      res.json({
        windowHours: 24,
        totals: {
          calls:    totals.calls,
          tokens:   totals.tokens,
          costSgd:  Number(totals.cost_sgd.toFixed(4)),
          repairs:  totals.repairs,
          successRate,
        },
        agents: rows.map((r: any) => ({
          agent: r.agent,
          calls: Number(r.calls),
          successes: Number(r.successes),
          successRate: Number(r.calls) > 0 ? Number(r.successes) / Number(r.calls) : null,
          repairs: Number(r.repairs),
          tokens: Number(r.tokens),
          costSgd: Number(r.cost_sgd ?? 0),
          avgLatencyMs: Number(r.avg_latency_ms ?? 0),
          p50LatencyMs: Number(r.p50_latency_ms ?? 0),
          p95LatencyMs: Number(r.p95_latency_ms ?? 0),
          lastCallAt: r.last_call_at,
          breaker: breakerByAgent[r.agent] ?? { open: false, openUntil: 0, failures: 0, successes: 0 },
        })),
        openBreakers: breakers.filter(b => b.openUntil > Date.now()).map(b => b.agent),
      });
    } catch (e: any) {
      console.error("[ai/llm-health] error:", e);
      res.status(500).json({ message: e?.message ?? "DB error" });
    }
  });

  // ── GET /api/ai/score-vs-rating ─────────────────────────────────────────
  // Bucketed comparison of stored lead_score vs eventual customer rating.
  // Used to validate the lead scorer is actually picking up signal.
  // Returns: { buckets: [{ scoreRange, count, avgRating }] }
  app.get("/api/ai/score-vs-rating", requireAdmin, async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT
          CASE
            WHEN ws.lead_score >= 75 THEN 'hot (75-100)'
            WHEN ws.lead_score >= 50 THEN 'warm (50-74)'
            WHEN ws.lead_score >  0  THEN 'cool (1-49)'
            ELSE 'unscored (0)'
          END AS bucket,
          COUNT(*)::int            AS count,
          AVG(cr.rating)::numeric(4,2) AS avg_rating
        FROM customer_ratings cr
        JOIN whatsapp_sessions ws ON ws.phone = cr.phone
        WHERE cr.rating IS NOT NULL
        GROUP BY bucket
        ORDER BY MIN(ws.lead_score) DESC
      `);
      const buckets = (rows as any).rows ?? rows ?? [];
      res.json({ buckets });
    } catch (e: any) {
      console.error("[ai/score-vs-rating] error:", e);
      res.status(500).json({ message: e?.message ?? "DB error" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // PRICING COACH — AI assistance when admin manually creates a job/quote
  //
  // Goal: when admin types items + prices in CreateJobModal, give them a
  // grounded sanity check showing:
  //   1. How each price compares to the OFFICIAL catalog rate (authoritative)
  //   2. A recommended total with reasoning (manpower, transport, mass, etc.)
  //   3. Singapore market intelligence on competitor ranges
  //   4. Suggested add-ons to mention (walk-up, urgent, mattress disposal)
  //
  // Why we don't live-scrape the web: third-party movers' sites block bots,
  // serve dynamic prices, and add 5–10s of latency. Baking curated SG market
  // benchmarks into the prompt is faster, more reliable, and we can refresh
  // the benchmarks centrally when the market shifts.
  // ════════════════════════════════════════════════════════════════════════════

  // Bounded string lengths everywhere — admin sessions are trusted but a
  // runaway paste / accidental bulk-import would otherwise blow up our
  // OpenAI bill (each char ≈ 0.25 tokens; large notes blocks add up fast).
  const pricingCoachRequestSchema = z.object({
    jobType: z.enum(["standard", "relocation"]),
    items: z.array(z.object({
      description: z.string().min(1).max(200),
      quantity:    z.number().int().positive().max(50),
      unitPrice:   z.number().nonnegative().max(50_000),
    })).min(1).max(30),
    services:     z.array(z.string().max(60)).max(10).optional().default([]),
    pickupFloor:  z.string().max(20).nullable().optional(),
    pickupLift:   z.boolean().nullable().optional(),
    dropoffFloor: z.string().max(20).nullable().optional(),
    dropoffLift:  z.boolean().nullable().optional(),
    notes:        z.string().max(1500).nullable().optional(),
  });

  const pricingCoachResponseSchema = z.object({
    summary: z.string(),
    recommendedTotal: z.number().nonnegative(),
    confidence: z.enum(["high", "medium", "low"]),
    priceCheck: z.array(z.object({
      name:         z.string(),
      entered:      z.number(),
      catalog:      z.number().nullable(),
      catalogMatch: z.string().nullable(),
      delta:        z.number(),                                // percent
      verdict:      z.enum(["fair", "low", "high", "no_match"]),
    })),
    reasoning: z.array(z.string()).max(8),
    competitive: z.array(z.object({
      competitor: z.string(),
      priceRange: z.string(),
      note:       z.string(),
    })).max(5),
    addOns: z.array(z.object({
      label: z.string(),
      price: z.number().nonnegative(),
      when:  z.string(),
    })).max(8),
  });

  // Curated Singapore market benchmarks (refresh quarterly).
  // Source: public rate cards from Lalamove, GoGoX, Helpling, traditional movers.
  const SG_MARKET_INTEL = `
SINGAPORE MARKET BENCHMARKS (2026 — for sanity-checking only):
- Lalamove / GoGoX small-van (1.7m): S$45–60 base + S$1.50/km — DRIVER ONLY, no manpower.
- Lalamove + 1 helper add-on: S$30–50 surcharge per helper.
- Traditional 2-man mover (Shalom, ARK, RPM Movers): S$180–280 minimum for a 2-hour job within a single condo/HDB block.
- Helpling / TaskRabbit-style 2-man furniture move: S$150–220 minimum.
- IKEA in-house assembly: S$90 for first item, S$30 each additional.
- Standalone furniture installation specialists: S$80–150 per item depending on complexity.
- Mattress-only disposal (no replacement): S$60–100 (king), S$50–80 (queen).
- Massage chair relocation (heavy 80–130kg, 2-man required): S$120–200 typical.
- King mattress relocation (no transport, same building): S$60–90 typical.
- Same-condo block-to-block relocation (no lorry, trolley walk): NO transport surcharge, but 2-man minimum still applies.
- Walk-up surcharge (no lift): S$15–30 per flight beyond ground.
- Same-day urgent booking surcharge: S$30–80.
`.trim();

  app.post("/api/ai/pricing-coach", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = pricingCoachRequestSchema.parse(req.body);

      // ── 1. Look up catalog matches for each item via fuzzy ILIKE ──
      // We build a single OR'd query so we don't N+1 the DB.
      const itemKeywords = parsed.items
        .map(i => i.description.toLowerCase().split(/\s+/).filter(w => w.length >= 4))
        .flat();
      const uniqKeywords = Array.from(new Set(itemKeywords)).slice(0, 30);

      // Standard jobs span install / dismantle / dispose / dismantle_dispose,
      // so we query the union and let the LLM rank the best per-item match.
      // Relocation jobs are isolated to the dedicated "relocate" service slice.
      const catalogTargetTypes = parsed.jobType === "relocation"
        ? ["relocate"]
        : ["install", "dismantle", "dispose", "dismantle_dispose"];

      let catalogMatches: { name: string; basePrice: string; serviceType: string; category: string | null }[] = [];
      if (uniqKeywords.length > 0) {
        const orConds = uniqKeywords.map(k => sql`LOWER(name) LIKE ${'%' + k + '%'}`);
        const rows = await db.execute(sql`
          SELECT name, base_price, service_type, category
          FROM catalog_items
          WHERE active = true
            AND service_type IN (${sql.join(catalogTargetTypes.map(t => sql`${t}`), sql`, `)})
            AND (${sql.join(orConds, sql` OR `)})
          ORDER BY name
          LIMIT 60
        `);
        catalogMatches = ((rows as any).rows ?? rows ?? []).map((r: any) => ({
          name:        r.name,
          basePrice:   String(r.base_price),
          serviceType: r.service_type,
          category:    r.category,
        }));
      }

      // ── 2. Build the prompt ──
      const itemsTotal = parsed.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      const accessNotes: string[] = [];
      if (parsed.pickupFloor)  accessNotes.push(`Pick-up: floor ${parsed.pickupFloor}${parsed.pickupLift === false ? " (NO LIFT)" : ""}`);
      if (parsed.dropoffFloor) accessNotes.push(`Drop-off: floor ${parsed.dropoffFloor}${parsed.dropoffLift === false ? " (NO LIFT)" : ""}`);

      const sysPrompt = `You are TMG Install's pricing coach for Singapore furniture installation/relocation jobs.

OUTPUT EXACTLY this JSON shape (use these EXACT field names, no others, no nested objects in scalar fields):

{
  "summary": "string — one sentence headline recommendation, e.g. 'Charge S$160 flat — covers 2-man minimum + catalog rates'",
  "recommendedTotal": 160,
  "confidence": "high" | "medium" | "low",
  "priceCheck": [
    {
      "name": "string — the admin's item description verbatim",
      "entered": 84,
      "catalog": 84,
      "catalogMatch": "string — the matched catalog row name, or null if no match",
      "delta": 0,
      "verdict": "fair" | "low" | "high" | "no_match"
    }
  ],
  "reasoning": ["bullet 1 ≤120 chars", "bullet 2", "bullet 3"],
  "competitive": [
    { "competitor": "Traditional 2-man movers", "priceRange": "S$180–280", "note": "minimum for 2hr job" }
  ],
  "addOns": [
    { "label": "Walk-up surcharge (no lift)", "price": 25, "when": "if no lift at either end" }
  ]
}

RULES:
1. "summary" is a single STRING, never an object.
2. "priceCheck" entries: each has name (string), entered (number), catalog (number or null), catalogMatch (string or null), delta (number percent), verdict (one of the 4 enums).
3. For each admin item: fuzzy-match to catalog ("king mattress" → "Mattress — King"). delta = round(((entered - catalog) / catalog) * 100). Verdict: fair if |delta|≤15, low if delta<-15, high if delta>15, no_match if no catalog row.
4. recommendedTotal accounts for: catalog floor, 2-man minimum (~S$140–160 break-even for any 2-man job in SG), manpower-heavy items (massage chairs/hydraulic beds need 2 strong men), floor/lift surcharges, and whether transport is needed (same-building no-lorry jobs skip transport surcharge).
5. reasoning: 3–6 short operational bullets. Each ≤120 chars. No fluff.
6. competitive: 2–4 RELEVANT benchmarks from the SG market intel (skip Lalamove if no transport needed).
7. addOns: 2–5 realistic add-ons with label, price (SGD number), and when (trigger condition).
8. confidence: high if all items matched, medium if some, low if mostly unmatched.

Output STRICT JSON only. No markdown fences. No prose.`;

      const userPrompt = `JOB TYPE: ${parsed.jobType}
SERVICES: ${parsed.services.join(", ") || "(none specified)"}
ACCESS: ${accessNotes.length ? accessNotes.join(" | ") : "(not specified)"}
NOTES: ${parsed.notes || "(none)"}

ADMIN-ENTERED ITEMS (subtotal = S$${itemsTotal.toFixed(2)}):
${parsed.items.map((i, idx) => `${idx+1}. ${i.description} × ${i.quantity} @ S$${i.unitPrice.toFixed(2)} = S$${(i.quantity * i.unitPrice).toFixed(2)}`).join("\n")}

OFFICIAL TMG CATALOG MATCHES (service_type=${catalogTargetType}):
${catalogMatches.length === 0 ? "(no fuzzy matches found in catalog — admin may be using non-standard descriptions)" : catalogMatches.slice(0, 25).map(c => `- ${c.name} [${c.category}] = S$${c.basePrice}`).join("\n")}

${SG_MARKET_INTEL}

Respond with strict JSON only.`;

      const result = await callLLM<string>({
        agent: "pricing_coach",
        model: "gpt-4o",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user",   content: userPrompt + "\n\nReply with ONE valid JSON object matching the shape above. Top-level keys MUST be: summary, recommendedTotal, confidence, priceCheck, reasoning, competitive, addOns. No wrapper objects." },
        ],
        max_tokens: 1500,
        temperature: 0.2,
      });

      // Parse + validate ourselves so we can log raw on failure and recover
      // gracefully. callLLM only does ONE schema-repair retry which has been
      // unreliable for this complex schema; we'd rather see exactly what the
      // model said when something goes wrong.
      let raw = result.value as string;
      raw = raw.trim();
      // strip markdown fences if any
      raw = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

      let aiPayload: any;
      try {
        aiPayload = JSON.parse(raw);
      } catch (pe: any) {
        console.error("[ai/pricing-coach] JSON parse failed. Raw:", raw.slice(0, 800));
        return res.status(502).json({ message: "AI returned invalid JSON. Please try again." });
      }

      // The model sometimes wraps the response in an extra object. Unwrap if so.
      if (aiPayload && typeof aiPayload === "object" && !Array.isArray(aiPayload)) {
        if (!("summary" in aiPayload) || !("priceCheck" in aiPayload)) {
          const inner = Object.values(aiPayload).find(
            (v: any) => v && typeof v === "object" && "summary" in v && "priceCheck" in v
          );
          if (inner) aiPayload = inner;
        }
      }

      const check = pricingCoachResponseSchema.safeParse(aiPayload);
      if (!check.success) {
        const issues = check.error.issues.slice(0, 6).map(i => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
        console.error("[ai/pricing-coach] schema fail:", issues, "Raw keys:", Object.keys(aiPayload || {}));
        console.error("[ai/pricing-coach] raw output:", JSON.stringify(aiPayload).slice(0, 1500));
        return res.status(502).json({ message: `AI response did not match expected shape: ${issues}` });
      }

      res.json({
        ...check.data,
        meta: {
          model: result.model,
          latencyMs: result.latencyMs,
          costSgd: Number(result.costSgd.toFixed(4)),
          catalogMatchesFound: catalogMatches.length,
        },
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[ai/pricing-coach] error:", err);
      res.status(500).json({ message: err?.message ?? "Pricing coach failed" });
    }
  });

  // ════════════════════════════════════════════════════════════════════════════
  // DRAFT CUSTOMER EMAIL — admin-facing AI helper
  // ════════════════════════════════════════════════════════════════════════════
  // POST /api/ai/draft-email
  // Body: { quoteId: number, intent: "follow_up"|"send_quote"|"reschedule"|"reminder"|"custom", extraInstructions?: string }
  // Returns: { subject, body, model, latencyMs }
  //
  // The drafted email is NEVER sent automatically. The admin reviews/edits it
  // and copies it into their email client (or we surface it in the UI later).
  // This satisfies the spec line "draft customer email" + "approval-gated".
  app.post("/api/ai/draft-email", requireAdmin, aiLlmLimiter, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        quoteId: z.number().int().positive(),
        intent: z.enum(["follow_up", "send_quote", "reschedule", "reminder", "custom"]).default("follow_up"),
        extraInstructions: z.string().max(500).optional(),
      });
      const body = schema.parse(req.body);

      const quote = await storage.getQuote(body.quoteId);
      if (!quote) return res.status(404).json({ message: "Quote not found" });

      const customer = quote.customer;
      const items = (quote.items ?? []).map((it: any) =>
        `- ${it.quantity}× ${it.detectedName ?? it.originalDescription} (${it.serviceType})`
      ).join("\n") || "(no items captured yet)";

      const paymentBrief = quote.total
        ? (requiresFullUpfront(Number(quote.total))
            ? "mention that full payment is required to confirm the booking (no balance afterwards)"
            : "mention a 50% deposit to confirm the booking, with the remaining 50% due on completion")
        : "mention that a deposit (or full payment for smaller jobs) confirms the booking";

      const intentBrief: Record<string, string> = {
        follow_up:   "Polite follow-up — customer received the quote but hasn't responded. Encourage them to confirm or ask questions.",
        send_quote:  `Email accompanies an attached PDF quote. Summarise scope and total, ${paymentBrief}.`,
        reschedule:  "We need to reschedule their booking. Apologise briefly, offer flexibility, ask for preferred new date/window.",
        reminder:    "Friendly day-before reminder of their confirmed booking. Confirm date, time-window, address, contact info.",
        custom:      "Use the extraInstructions verbatim as the brief.",
      };

      const prompt = `You are drafting a customer-facing email for TMG Install (Singapore furniture installation, dismantling, relocation).
Tone: warm, concise, professional. British/Singapore English. No emojis. No markdown.
Sign off as "The TMG Install Team".

INTENT: ${body.intent} — ${intentBrief[body.intent]}
${body.extraInstructions ? `\nADMIN INSTRUCTIONS: ${body.extraInstructions}\n` : ""}
QUOTE CONTEXT:
- Reference: ${quote.referenceNo}
- Status: ${quote.status}
- Customer: ${customer?.name ?? "(unknown)"}
- Service address: ${quote.serviceAddress ?? "(not set)"}
- Total: ${quote.total ? `S$${quote.total}` : "(pending pricing)"}
- Scheduled: ${quote.scheduledAt ? new Date(quote.scheduledAt).toDateString() + " " + (quote.timeWindow ?? "") : "(not scheduled)"}
- Items:
${items}

Return ONLY a JSON object with this shape (no prose, no fences):
{ "subject": "string (max 80 chars)", "body": "string (plain-text email body, multi-paragraph, no signature line — we add it)" }`;

      const emailSchema = z.object({
        subject: z.string().min(3).max(120),
        body: z.string().min(20).max(4000),
      });

      const result = await callLLM({
        agent: "draft_customer_email",
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You output strictly valid JSON matching the requested shape. No code fences." },
          { role: "user", content: prompt },
        ],
        temperature: 0.6,
        max_tokens: 700,
        schema: emailSchema,
      });

      const out = result.value;

      // Audit so admins can see who drafted what + when (no auto-send risk).
      await db.insert(aiAuditLog).values({
        actor: "ai_agent",
        actionType: "email_drafted",
        module: "draft_customer_email",
        summary: `Drafted ${body.intent} email for quote ${quote.referenceNo}`,
        detail: { quoteId: quote.id, intent: body.intent, model: result.model, latencyMs: result.latencyMs },
        outcome: "success",
      } as any).catch(() => {}); // non-fatal

      res.json({
        subject: out.subject,
        body: `${out.body}\n\n— The TMG Install Team`,
        meta: { model: result.model, latencyMs: result.latencyMs, costSgd: Number(result.costSgd.toFixed(4)) },
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[ai/draft-email] error:", err?.message);
      res.status(500).json({ message: err?.message ?? "Email draft failed" });
    }
  });
}
