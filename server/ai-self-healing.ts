/**
 * ai-self-healing.ts — Two scheduled AI agent maintenance jobs.
 *
 * 1. SELF-HEALING ROLLBACK
 *    Daily job that examines every successfully-executed ad action that is
 *    7+ days old and not yet rolled back. Refetches recent metrics from
 *    ai_ads_snapshots, compares to the baseline captured at execution time,
 *    and triggers automatic rollback if performance degraded beyond the
 *    configured threshold.
 *
 *    Gates:
 *      ai_master_kill_switch  — emergency stop
 *      ai_self_healing_enabled — feature flag
 *      ai_self_healing_min_drop_pct — degradation threshold (default 30)
 *
 * 2. WEEKLY DIGEST EMAIL
 *    Daily job that, on Mondays only, composes and sends an HTML summary of
 *    the prior 7 days' AI activity (executions, rollbacks, time saved) to
 *    the configured admin recipient.
 *
 *    Gates:
 *      ai_master_kill_switch
 *      ai_weekly_digest_enabled
 *      ai_digest_recipient_email — required
 *
 * Both jobs are idempotent and never touch quotes / payments / customers.
 */

import { db } from "./db";
import { eq, and, gte, lt, isNull, isNotNull, sql, desc } from "drizzle-orm";
import {
  aiPlatformExecutions,
  aiAdsSnapshots,
  aiApprovalQueue,
  aiAuditLog,
  appSettings,
} from "@shared/schema";
import { getFlag } from "./connector-sync";

async function getAppSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return row?.value ?? null;
  } catch { return null; }
}
import { executePlatformAction } from "./ad-executor";
import { sendEmail } from "./email";
import { sendAiAlert } from "./ai-alerts";

// ── Constants ─────────────────────────────────────────────────────────────────
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const BASELINE_WINDOW_DAYS = 7;
const POST_WINDOW_DAYS = 7;
const DEFAULT_MIN_DROP_PCT = 30;

// ──────────────────────────────────────────────────────────────────────────────
// BASELINE CAPTURE
// ──────────────────────────────────────────────────────────────────────────────
// Called from the auto-execute pipeline AFTER a successful platform exec.
// Aggregates the prior 7 days of snapshot metrics for the affected campaign
// so the self-healer can later compare post-change performance against it.
// Returns null if no snapshot data is available (we silently skip baseline,
// which causes the self-healer to skip this exec — never auto-rollback
// without a baseline).

export async function captureBaselineForExecution(
  executionId: number,
  platform: string,
  campaignId: string | undefined,
): Promise<{ ctr: number; conversions: number; clicks: number; spend: number; windowDays: number } | null> {
  if (!campaignId) return null;

  const since = new Date(Date.now() - BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().slice(0, 10);
  const platformKey = platform === "google_ads" ? "google" : platform === "meta_ads" ? "meta" : platform;

  const rows = await db.select().from(aiAdsSnapshots).where(and(
    eq(aiAdsSnapshots.platform, platformKey),
    eq(aiAdsSnapshots.campaignId, campaignId),
    gte(aiAdsSnapshots.snapshotDate, sinceStr),
  ));

  if (rows.length === 0) return null;

  const sum = (key: keyof typeof rows[0]) => rows.reduce((acc, r) => acc + parseFloat(String(r[key] ?? 0)), 0);
  const totalClicks = sum("clicks");
  const totalImpressions = sum("impressions");
  const totalConversions = sum("conversions");
  const totalSpend = sum("spend");
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const baseline = {
    ctr: Math.round(ctr * 100) / 100,
    conversions: Math.round(totalConversions * 100) / 100,
    clicks: Math.round(totalClicks),
    spend: Math.round(totalSpend * 100) / 100,
    windowDays: BASELINE_WINDOW_DAYS,
  };

  await db.update(aiPlatformExecutions)
    .set({ baselineMetric: baseline as any })
    .where(eq(aiPlatformExecutions.id, executionId));

  return baseline;
}

// ──────────────────────────────────────────────────────────────────────────────
// REVERSE-ITEM BUILDER (shared by manual rollback endpoint + self-healer)
// ──────────────────────────────────────────────────────────────────────────────
// executePlatformAction expects an ApprovalItem with a .proposedAction whose
// `action` field is "pause" / "enable" / etc. To reverse a previous execution
// we synthesize a new item that swaps the action, preserving the target IDs.

export function buildReverseApprovalItem(exec: any, reverseLogicalAction: "pause" | "enable"): any {
  const originalProposed = (exec.proposedChange as any) ?? {};
  const targetIds = (exec.targetObjectIds as any) ?? {};
  const platformKey = exec.platform; // already "google_ads" or "meta_ads"
  return {
    id: exec.approvalQueueId ?? -1,
    queueType: "optimization",
    title: `Rollback of execution #${exec.id}`,
    refId: exec.recommendationId ?? null,
    proposedAction: {
      ...originalProposed,
      platform: platformKey,
      action: reverseLogicalAction,
      adId:       originalProposed.adId       ?? targetIds.adId       ?? targetIds.ad_id,
      adGroupId:  originalProposed.adGroupId  ?? targetIds.adGroupId  ?? targetIds.ad_group_id,
      adSetId:    originalProposed.adSetId    ?? targetIds.adSetId    ?? targetIds.ad_set_id ?? targetIds.adset_id,
      campaignId: originalProposed.campaignId ?? targetIds.campaignId ?? targetIds.campaign_id,
    },
  };
}

export function reverseActionFor(actionType: string): "pause" | "enable" | null {
  if (actionType === "pause_ad" || actionType === "pause_adset" || actionType === "pause_ad_group") return "enable";
  if (actionType === "enable_ad" || actionType === "enable_adset" || actionType === "enable_ad_group") return "pause";
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// SELF-HEALING ROLLBACK
// ──────────────────────────────────────────────────────────────────────────────

interface SelfHealingResult {
  evaluated: number;
  rolledBack: number;
  skippedNoBaseline: number;
  skippedNoPostData: number;
  errors: number;
}

export async function runSelfHealingSweep(triggeredBy: string = "scheduler"): Promise<SelfHealingResult> {
  const result: SelfHealingResult = { evaluated: 0, rolledBack: 0, skippedNoBaseline: 0, skippedNoPostData: 0, errors: 0 };

  if ((await getFlag("ai_master_kill_switch")) === true) return result;
  if ((await getFlag("ai_self_healing_enabled")) !== true) return result;

  const minDropStr = (await getAppSetting("ai_self_healing_min_drop_pct")) ?? "";
  const minDropPct = parseFloat(minDropStr) > 0 ? parseFloat(minDropStr) : DEFAULT_MIN_DROP_PCT;
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

  // Find candidates: success status, 7+ days old, not rolled back, not yet self-healing-checked
  // (or last checked > 24h ago — we re-evaluate daily until rollback or all data converges).
  const recheckCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const candidates = await db.select().from(aiPlatformExecutions).where(and(
    eq(aiPlatformExecutions.resultStatus, "success"),
    isNull(aiPlatformExecutions.rolledBackAt),
    isNotNull(aiPlatformExecutions.baselineMetric),
    lt(aiPlatformExecutions.createdAt, cutoff),
    eq(aiPlatformExecutions.testMode, false),
  )).limit(100);

  for (const exec of candidates) {
    if (exec.selfHealingCheckedAt && exec.selfHealingCheckedAt > recheckCutoff) continue;
    result.evaluated++;

    try {
      const baseline = exec.baselineMetric as any;
      if (!baseline?.ctr && baseline?.ctr !== 0) { result.skippedNoBaseline++; continue; }

      const targetIds = (exec.targetObjectIds as any) ?? {};
      const campaignId = targetIds.campaignId ?? targetIds.campaign_id;
      if (!campaignId) { result.skippedNoPostData++; continue; }

      // Pull post-change window: from exec date forward, bounded by POST_WINDOW_DAYS
      // (otherwise long-tail data would dilute degradation signals indefinitely)
      const execDate = exec.createdAt!;
      const postStart = execDate.toISOString().slice(0, 10);
      const postEndDate = new Date(execDate);
      postEndDate.setUTCDate(postEndDate.getUTCDate() + POST_WINDOW_DAYS);
      const postEnd = postEndDate.toISOString().slice(0, 10);
      const platformKey = exec.platform === "google_ads" ? "google" : exec.platform === "meta_ads" ? "meta" : exec.platform;

      const postRows = await db.select().from(aiAdsSnapshots).where(and(
        eq(aiAdsSnapshots.platform, platformKey),
        eq(aiAdsSnapshots.campaignId, campaignId),
        gte(aiAdsSnapshots.snapshotDate, postStart),
        sql`${aiAdsSnapshots.snapshotDate} <= ${postEnd}`,
      ));

      if (postRows.length < 3) {
        // Not enough post-change data yet; mark checked and try again tomorrow
        await db.update(aiPlatformExecutions).set({ selfHealingCheckedAt: new Date() }).where(eq(aiPlatformExecutions.id, exec.id));
        result.skippedNoPostData++;
        continue;
      }

      const sum = (key: string) => postRows.reduce((acc: number, r: any) => acc + parseFloat(String(r[key] ?? 0)), 0);
      const postClicks = sum("clicks");
      const postImpressions = sum("impressions");
      const postConversions = sum("conversions");
      const postCtr = postImpressions > 0 ? (postClicks / postImpressions) * 100 : 0;

      // Pick the most relevant degradation metric for this action type:
      //   - For pause actions: did conversions or CTR collapse on the *parent* (sometimes pausing
      //     a winning ad hurts the whole campaign)
      //   - For all others: CTR drop is the universal proxy
      const baselineCtr = parseFloat(String(baseline.ctr ?? 0));
      const baselineConv = parseFloat(String(baseline.conversions ?? 0));

      const ctrDrop = baselineCtr > 0 ? ((baselineCtr - postCtr) / baselineCtr) * 100 : 0;
      // Anti-flap: ignore conversion-drop signal when baseline is too small
      // (1→0 conversions = 100% drop is just noise on low-volume accounts).
      // Same for CTR when impressions are tiny.
      const MIN_BASELINE_CONV = 5;
      const MIN_BASELINE_CLICKS = 50;
      const baselineClicks = parseFloat(String(baseline.clicks ?? 0));
      const convDrop = (baselineConv >= MIN_BASELINE_CONV)
        ? ((baselineConv - postConversions) / baselineConv) * 100
        : 0;
      const ctrDropWeighted = (baselineClicks >= MIN_BASELINE_CLICKS) ? ctrDrop : 0;
      const worstDrop = Math.max(ctrDropWeighted, convDrop);

      const shouldRollback = worstDrop >= minDropPct;

      await db.update(aiPlatformExecutions).set({ selfHealingCheckedAt: new Date() }).where(eq(aiPlatformExecutions.id, exec.id));

      if (!shouldRollback) {
        await db.insert(aiAuditLog).values({
          actionType: "audit_run",
          actor: triggeredBy,
          module: "self_healing",
          summary: `Self-heal check OK (drop ${worstDrop.toFixed(1)}% < ${minDropPct}%): exec #${exec.id}`,
          detail: { executionId: exec.id, baselineCtr, postCtr, baselineConv, postConversions, ctrDrop, convDrop } as any,
          outcome: "success",
        });
        continue;
      }

      // ── Trigger automatic rollback ──
      const at = exec.actionType ?? "";
      const reverseLogical = reverseActionFor(at);

      if (!reverseLogical || !exec.rollbackPayload) {
        await db.update(aiPlatformExecutions).set({
          rolledBackAt: new Date(), rolledBackBy: "ai_self_healing", rollbackStatus: "manual_required",
          rollbackError: `Self-healer detected ${worstDrop.toFixed(1)}% drop but no automated reverse for ${at}.`,
        }).where(eq(aiPlatformExecutions.id, exec.id));
        await db.insert(aiAuditLog).values({
          actionType: "rollback",
          actor: "ai_self_healing",
          module: "self_healing",
          summary: `MANUAL ROLLBACK NEEDED: exec #${exec.id} dropped ${worstDrop.toFixed(1)}% — no auto-reverse available`,
          detail: { executionId: exec.id, worstDrop, baseline, postCtr, postConversions } as any,
          outcome: "failed",
        });
        continue;
      }

      // Soft lock: claim this exec by writing rolledBackBy='ai_self_healing'
      // ONLY if rolledBackAt is still null. If a manual rollback fires at the
      // same moment, exactly one of us wins the conditional update.
      const claim = await db.update(aiPlatformExecutions)
        .set({ rolledBackBy: "ai_self_healing", rollbackStatus: "in_progress" })
        .where(and(
          eq(aiPlatformExecutions.id, exec.id),
          isNull(aiPlatformExecutions.rolledBackAt),
          isNull(aiPlatformExecutions.rollbackStatus),
        ))
        .returning({ id: aiPlatformExecutions.id });
      if (claim.length === 0) continue; // another rollback path already claimed it

      let rollbackOk = false; let rollbackErr: string | null = null;
      try {
        const reverseItem = buildReverseApprovalItem(exec, reverseLogical);
        const reverseResult = await executePlatformAction(reverseItem, "ai_self_healing", false);
        rollbackOk = reverseResult?.resultStatus === "success";
        if (!rollbackOk) rollbackErr = reverseResult?.errorMessage ?? "platform did not confirm";
      } catch (e: any) { rollbackErr = e.message ?? "rollback exception"; }

      await db.update(aiPlatformExecutions).set({
        rolledBackAt: new Date(),
        rolledBackBy: "ai_self_healing",
        rollbackStatus: rollbackOk ? "success" : "failed",
        rollbackError: rollbackErr,
      }).where(eq(aiPlatformExecutions.id, exec.id));

      await db.insert(aiAuditLog).values({
        actionType: "rollback",
        actor: "ai_self_healing",
        module: "self_healing",
        summary: `${rollbackOk ? "AUTO-ROLLED BACK" : "AUTO-ROLLBACK FAILED"}: exec #${exec.id} dropped ${worstDrop.toFixed(1)}% (CTR ${baselineCtr.toFixed(2)}→${postCtr.toFixed(2)}, conv ${baselineConv.toFixed(1)}→${postConversions.toFixed(1)})`,
        detail: { executionId: exec.id, worstDrop, ctrDrop, convDrop, baseline, postCtr, postConversions, rollbackErr } as any,
        outcome: rollbackOk ? "success" : "failed",
      });

      // Real-time alert: this is a high-impact event the user should know about immediately
      await sendAiAlert({
        severity: rollbackOk ? "warn" : "critical",
        channel: "self_healing",
        title: rollbackOk ? `Self-healed ${exec.platform} action` : `Self-heal FAILED — manual review needed`,
        body: `Exec #${exec.id} (${exec.actionType}) dropped ${worstDrop.toFixed(0)}%. ${rollbackOk ? "Auto-reverted." : `Error: ${rollbackErr}`}`,
        url: "/admin/ai/approvals",
      }).catch(() => {});

      if (rollbackOk) result.rolledBack++; else result.errors++;
    } catch (err: any) {
      result.errors++;
      console.error("[self-healing] error evaluating exec", exec.id, err.message);
    }
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// WEEKLY DIGEST EMAIL
// ──────────────────────────────────────────────────────────────────────────────

export async function maybeSendWeeklyDigest(opts: { force?: boolean; dayOfWeekOverride?: number } = {}): Promise<{ sent: boolean; reason?: string; recipient?: string }> {
  if (!opts.force) {
    if ((await getFlag("ai_master_kill_switch")) === true) return { sent: false, reason: "kill_switch" };
    if ((await getFlag("ai_weekly_digest_enabled")) !== true) return { sent: false, reason: "flag_off" };

    // Singapore Monday at any hour during the daily run window
    const sgNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const dow = opts.dayOfWeekOverride ?? sgNow.getUTCDay();
    if (dow !== 1) return { sent: false, reason: "not_monday" };
  }

  const recipient = ((await getAppSetting("ai_digest_recipient_email")) ?? "").trim();
  if (!recipient || !recipient.includes("@")) return { sent: false, reason: "no_recipient" };

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [execs, approvals] = await Promise.all([
    db.select().from(aiPlatformExecutions).where(gte(aiPlatformExecutions.createdAt, since)),
    db.select().from(aiApprovalQueue).where(gte(aiApprovalQueue.createdAt, since)),
  ]);

  const platformPushes = execs.length;
  const platformSuccess = execs.filter(e => e.resultStatus === "success").length;
  const platformDryRun = execs.filter(e => e.resultStatus === "test_mode").length;
  const platformFailed = execs.filter(e => e.resultStatus === "failed").length;
  const rollbacks = execs.filter(e => e.rolledBackAt).length;
  const selfHealRollbacks = execs.filter(e => e.rolledBackBy === "ai_self_healing").length;
  const successRate = platformPushes > 0 ? Math.round((platformSuccess / platformPushes) * 100) : 0;
  const autoApproved = approvals.filter(a => a.reviewedBy === "ai_autoapprove").length;
  const pending = approvals.filter(a => a.status === "pending").length;
  const minutesSaved = Math.round((platformSuccess * 90 + autoApproved * 30) / 60);

  const recentExecs = execs.slice(-8).reverse().map(e => {
    const ts = e.createdAt ? new Date(e.createdAt).toLocaleString("en-SG", { dateStyle: "short", timeStyle: "short" }) : "—";
    const status = e.rolledBackAt ? "ROLLED BACK" : e.resultStatus.toUpperCase();
    const color = e.rolledBackAt ? "#d97706" : e.resultStatus === "success" ? "#059669" : e.resultStatus === "failed" ? "#dc2626" : "#6b7280";
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:#666;">${ts}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">${e.platform}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;">${e.actionType}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;font-weight:bold;color:${color};">${status}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:32px;background:linear-gradient(135deg,#7c3aed,#c026d3);">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">TMG AI Weekly Digest</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${since.toLocaleDateString("en-SG", { dateStyle: "medium" })} → ${new Date().toLocaleDateString("en-SG", { dateStyle: "medium" })}</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <h2 style="margin:0 0 16px;font-size:14px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:1.5px;">7-day summary</h2>
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding:14px;background:#faf5ff;border-radius:6px;width:33%;"><div style="font-size:26px;font-weight:800;color:#1f2937;">${platformPushes}</div><div style="font-size:11px;color:#666;text-transform:uppercase;margin-top:2px;">Platform pushes</div></td>
              <td style="width:8px;"></td>
              <td style="padding:14px;background:#ecfdf5;border-radius:6px;width:33%;"><div style="font-size:26px;font-weight:800;color:#059669;">${successRate}%</div><div style="font-size:11px;color:#666;text-transform:uppercase;margin-top:2px;">Success rate</div></td>
              <td style="width:8px;"></td>
              <td style="padding:14px;background:#fdf4ff;border-radius:6px;width:33%;"><div style="font-size:26px;font-weight:800;color:#a855f7;">${autoApproved}</div><div style="font-size:11px;color:#666;text-transform:uppercase;margin-top:2px;">Auto-approved</div></td>
            </tr>
            <tr><td colspan="5" style="height:8px;"></td></tr>
            <tr>
              <td style="padding:14px;background:${rollbacks > 0 ? "#fef3c7" : "#f3f4f6"};border-radius:6px;"><div style="font-size:26px;font-weight:800;color:${rollbacks > 0 ? "#d97706" : "#9ca3af"};">${rollbacks}</div><div style="font-size:11px;color:#666;text-transform:uppercase;margin-top:2px;">Rollbacks${selfHealRollbacks > 0 ? ` (${selfHealRollbacks} auto)` : ""}</div></td>
              <td style="width:8px;"></td>
              <td style="padding:14px;background:#fef2f2;border-radius:6px;"><div style="font-size:26px;font-weight:800;color:${platformFailed > 0 ? "#dc2626" : "#9ca3af"};">${platformFailed}</div><div style="font-size:11px;color:#666;text-transform:uppercase;margin-top:2px;">Push failures</div></td>
              <td style="width:8px;"></td>
              <td style="padding:14px;background:#fdf2f8;border-radius:6px;"><div style="font-size:26px;font-weight:800;color:#ec4899;">${minutesSaved}m</div><div style="font-size:11px;color:#666;text-transform:uppercase;margin-top:2px;">Admin time saved</div></td>
            </tr>
          </table>

          ${pending > 0 ? `<div style="margin-top:20px;padding:12px 16px;background:#fffbeb;border-left:4px solid #d97706;border-radius:4px;"><strong style="color:#92400e;font-size:13px;">${pending} item(s) awaiting your review</strong><div style="color:#78350f;font-size:12px;margin-top:2px;">Visit the AI Approval Queue to take action.</div></div>` : ""}

          ${platformDryRun > 0 ? `<div style="margin-top:12px;padding:12px 16px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:4px;color:#1e40af;font-size:12px;">${platformDryRun} action(s) ran in dry-run mode this week. Toggle <code>ai_platform_execution_test_mode</code> off when ready to go live.</div>` : ""}

          ${recentExecs ? `<h3 style="margin:24px 0 8px;font-size:13px;font-weight:700;color:#444;text-transform:uppercase;letter-spacing:1.5px;">Recent platform actions</h3>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #eee;border-radius:6px;">${recentExecs}</table>` : ""}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;text-align:center;font-size:11px;color:#999;">
          You're receiving this because <code>ai_weekly_digest_enabled</code> is on.<br>
          <a href="https://tmginstall.com/admin/ai" style="color:#7c3aed;text-decoration:none;">Open AI Hub</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const subject = `TMG AI Digest · ${platformPushes} pushes · ${successRate}% success · ${pending > 0 ? `${pending} awaiting you` : "all caught up"}`;
  const ok = await sendEmail({ to: recipient, subject, html });

  await db.insert(aiAuditLog).values({
    actionType: "publish_event",
    actor: opts.force ? "manual" : "scheduler",
    module: "digest",
    summary: `Weekly digest ${ok ? "sent" : "FAILED"} to ${recipient}`,
    detail: { platformPushes, successRate, autoApproved, rollbacks, pending, minutesSaved } as any,
    outcome: ok ? "success" : "failed",
  });

  return { sent: ok, recipient };
}
