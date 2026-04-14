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
  quotes,
  customers,
} from "@shared/schema";
import { z } from "zod";
import { storage } from "./storage";

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

export function registerAiRoutes(app: Express) {

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
        { id, decision, note },
      );

      res.json({ success: true, decision });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "DB error" });
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

      const result: Record<string, any> = {};
      for (const cfg of configs) {
        result[cfg.name] = {
          ...cfg,
          configured: missingMap[cfg.name]?.length === 0,
          missing: missingMap[cfg.name] ?? [],
          rowCount: rowCounts[cfg.name] ?? 0,
        };
      }

      res.json(result);
    } catch { res.status(500).json({ message: "DB error" }); }
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
}
