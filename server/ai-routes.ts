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
import { eq, desc, and, gte, sql } from "drizzle-orm";
import {
  aiFeatureFlags,
  aiAttributionEvents,
  aiAdsSnapshots,
  aiAdRecommendations,
  aiSiteAudits,
  aiSiteRecommendations,
  aiApprovalQueue,
  aiAuditLog,
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
}
