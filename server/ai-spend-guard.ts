/**
 * ai-spend-guard.ts — Hard money cap on AI-driven ad-spend changes.
 *
 * Why this exists:
 *   The autonomous agents can adjust Google/Meta budgets, scale campaigns,
 *   etc. Even with the per-action +10% cap and the pilot dry-run fence, a
 *   buggy run loop could in principle issue many small "approved" budget
 *   bumps in one day. This module enforces a hard daily and monthly SGD
 *   ceiling on AI-attributed spend changes.
 *
 * Model:
 *   - We track the *delta* of every approved budget change (proposed minus
 *     current) in `ai_spend_ledger`. We never count the absolute budget.
 *   - `checkAndReserveSpend(channel, deltaSGD, executionId)`:
 *       1. If deltaSGD <= 0 (cut/pause), allow + record (counts as "0" spend).
 *       2. Sum today + this-month positive deltas across all channels.
 *       3. If today+delta > daily cap → block, alert.
 *       4. If month+delta > monthly cap → block, alert, trip kill switch.
 *       5. Otherwise insert a ledger row and allow.
 *   - `getSpendStatus()` returns today/month totals + caps + utilization for
 *     the AIHub admin card.
 *
 * Defaults are conservative — admin must raise caps explicitly.
 */

import { db } from "./db";
import { sql, eq, and, gte } from "drizzle-orm";
import { appSettings, aiSpendLedger, aiFeatureFlags, aiAuditLog } from "@shared/schema";
import { sendAiAlert } from "./ai-alerts";

const DEFAULT_DAILY_CAP = 200;   // SGD
const DEFAULT_MONTHLY_CAP = 3000; // SGD

async function getCap(key: string, fallback: number): Promise<number> {
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    const n = parseFloat(row?.value ?? "");
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

function startOfTodayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonthUtc(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Sum positive *allowed* deltas since `since`. We MUST exclude blocked rows,
 * otherwise repeated failed attempts inflate the bucket and over-block.
 */
async function sumAllowedPositiveDeltaSince(since: Date, tx: any = db): Promise<number> {
  const rows = await tx
    .select({
      total: sql<string>`COALESCE(SUM(CASE WHEN ${aiSpendLedger.sgdDelta} > 0 THEN ${aiSpendLedger.sgdDelta} ELSE 0 END), 0)`,
    })
    .from(aiSpendLedger)
    .where(and(
      gte(aiSpendLedger.createdAt, since),
      eq(aiSpendLedger.decision, "allowed"),
    ));
  const v = parseFloat(rows?.[0]?.total ?? "0");
  return Number.isFinite(v) ? v : 0;
}

export interface SpendCheckResult {
  allowed: boolean;
  reason?: string;
  todaySgd: number;
  monthSgd: number;
  dailyCapSgd: number;
  monthlyCapSgd: number;
}

/**
 * Atomic check + reserve. Wrapped in a DB transaction with a global advisory
 * lock so two concurrent budget actions cannot both pass the cap check and
 * both insert past the ceiling. The lock is global (single key) — spend
 * guard calls are infrequent (one per approved budget change) so contention
 * is a non-issue, and a single lock makes the logic dead simple.
 *
 * Order: monthly cap is evaluated FIRST so that when both caps would be
 * busted, the kill switch always trips (per architect feedback).
 */
const SPEND_GUARD_LOCK_KEY = 9913421; // arbitrary stable int for pg_advisory_xact_lock
export async function checkAndReserveSpend(
  channel: "google_ads" | "meta_ads" | "other",
  deltaSgd: number,
  meta: { executionId?: number | null; actionType?: string; campaignName?: string } = {},
): Promise<SpendCheckResult> {
  const dailyCap = await getCap("ai_daily_spend_cap_sgd", DEFAULT_DAILY_CAP);
  const monthlyCap = await getCap("ai_monthly_spend_cap_sgd", DEFAULT_MONTHLY_CAP);

  // Variables captured inside the tx so we can use them after for alerts.
  let outcome: SpendCheckResult = {
    allowed: true,
    todaySgd: 0, monthSgd: 0,
    dailyCapSgd: dailyCap, monthlyCapSgd: monthlyCap,
  };
  let alertToSend: { severity: "warn" | "critical"; title: string; body: string; dedupeKey: string } | null = null;
  let warn80: { body: string; dedupeKey: string } | null = null;
  let killSwitchTripped = false;

  await db.transaction(async (tx) => {
    // Serialize all spend-guard checks so reads/writes are linearizable.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SPEND_GUARD_LOCK_KEY})`);

    const todaySgd = await sumAllowedPositiveDeltaSince(startOfTodayUtc(), tx);
    const monthSgd = await sumAllowedPositiveDeltaSince(startOfMonthUtc(), tx);

    // Cuts / pauses: allow always, record for audit traceability.
    if (deltaSgd <= 0) {
      await tx.insert(aiSpendLedger).values({
        channel, sgdDelta: deltaSgd.toFixed(2),
        executionId: meta.executionId ?? null,
        actionType: meta.actionType ?? "unknown",
        campaignName: meta.campaignName ?? null,
        decision: "allowed",
      } as any);
      outcome = { allowed: true, todaySgd, monthSgd, dailyCapSgd: dailyCap, monthlyCapSgd: monthlyCap };
      return;
    }

    // ── Monthly cap evaluated FIRST (architect feedback) ─────────────────
    if (monthSgd + deltaSgd > monthlyCap) {
      await tx.insert(aiSpendLedger).values({
        channel, sgdDelta: deltaSgd.toFixed(2),
        executionId: meta.executionId ?? null,
        actionType: meta.actionType ?? "unknown",
        campaignName: meta.campaignName ?? null,
        decision: "blocked_monthly",
      } as any);
      // Trip kill switch inside the same transaction so it commits atomically.
      try {
        await tx.update(aiFeatureFlags)
          .set({ value: true, updatedBy: "ai_spend_guard", updatedAt: new Date() } as any)
          .where(eq(aiFeatureFlags.key, "ai_master_kill_switch"));
        await tx.insert(aiAuditLog).values({
          actionType: "kill_switch_tripped",
          actor: "ai_spend_guard",
          module: "spend_guard",
          summary: `Monthly cap exceeded — kill switch auto-tripped`,
          detail: { channel, monthSgd, monthlyCap, attemptedDelta: deltaSgd } as any,
          outcome: "success",
        });
        killSwitchTripped = true;
      } catch (e: any) {
        console.error("[spend-guard] failed to trip kill switch in tx:", e?.message);
      }
      alertToSend = {
        severity: "critical",
        title: `🚨 SPEND CAP HIT — kill switch tripped`,
        body: `Channel ${channel} delta +SGD ${deltaSgd.toFixed(2)} would push month to SGD ${(monthSgd + deltaSgd).toFixed(2)} > cap SGD ${monthlyCap.toFixed(2)}. All AI automations are now disabled. Review and manually re-enable when ready.`,
        dedupeKey: `spend_block_monthly|${channel}`,
      };
      outcome = {
        allowed: false,
        reason: `Monthly AI spend cap exceeded (SGD ${monthSgd.toFixed(2)}/${monthlyCap.toFixed(2)}). Master kill switch has been tripped.`,
        todaySgd, monthSgd, dailyCapSgd: dailyCap, monthlyCapSgd: monthlyCap,
      };
      return;
    }

    // ── Daily cap ────────────────────────────────────────────────────────
    if (todaySgd + deltaSgd > dailyCap) {
      await tx.insert(aiSpendLedger).values({
        channel, sgdDelta: deltaSgd.toFixed(2),
        executionId: meta.executionId ?? null,
        actionType: meta.actionType ?? "unknown",
        campaignName: meta.campaignName ?? null,
        decision: "blocked_daily",
      } as any);
      alertToSend = {
        severity: "warn",
        title: `Spend guard: blocked (daily cap)`,
        body: `Channel ${channel} | +SGD ${deltaSgd.toFixed(2)} would push today to SGD ${(todaySgd + deltaSgd).toFixed(2)} > cap SGD ${dailyCap.toFixed(2)}. Action: ${meta.actionType ?? "?"} on ${meta.campaignName ?? "?"}.`,
        dedupeKey: `spend_block_daily|${channel}`,
      };
      outcome = {
        allowed: false,
        reason: `Daily AI spend cap reached (SGD ${todaySgd.toFixed(2)}/${dailyCap.toFixed(2)}). Raise ai_daily_spend_cap_sgd or wait until midnight UTC.`,
        todaySgd, monthSgd, dailyCapSgd: dailyCap, monthlyCapSgd: monthlyCap,
      };
      return;
    }

    // ── Allowed — record reservation, prep 80% warning if applicable ─────
    const newDaily = todaySgd + deltaSgd;
    await tx.insert(aiSpendLedger).values({
      channel, sgdDelta: deltaSgd.toFixed(2),
      executionId: meta.executionId ?? null,
      actionType: meta.actionType ?? "unknown",
      campaignName: meta.campaignName ?? null,
      decision: "allowed",
    } as any);

    if (newDaily / dailyCap >= 0.8 && todaySgd / dailyCap < 0.8) {
      warn80 = {
        body: `Today SGD ${newDaily.toFixed(2)} / cap SGD ${dailyCap.toFixed(2)} after this action (${channel}, ${meta.actionType ?? "?"}).`,
        dedupeKey: `spend_warn_daily_80|${new Date().toISOString().slice(0, 10)}`,
      };
    }

    outcome = {
      allowed: true,
      todaySgd: newDaily,
      monthSgd: monthSgd + deltaSgd,
      dailyCapSgd: dailyCap,
      monthlyCapSgd: monthlyCap,
    };
  });

  // Alerts fire AFTER the tx commits — they're side-effects to the outside world.
  if (alertToSend) {
    try { await sendAiAlert({ ...alertToSend, channel: "ads", url: "/admin/ai" }); } catch {}
  }
  if (warn80) {
    try {
      await sendAiAlert({
        severity: "warn",
        channel: "ads",
        title: `Spend guard: 80% of daily cap`,
        body: warn80.body,
        url: "/admin/ai",
        dedupeKey: warn80.dedupeKey,
      });
    } catch {}
  }
  return outcome;
}

export async function getSpendStatus(): Promise<{
  todaySgd: number;
  monthSgd: number;
  dailyCapSgd: number;
  monthlyCapSgd: number;
  dailyUtilization: number;
  monthlyUtilization: number;
  recentBlocks: number;
}> {
  const dailyCap = await getCap("ai_daily_spend_cap_sgd", DEFAULT_DAILY_CAP);
  const monthlyCap = await getCap("ai_monthly_spend_cap_sgd", DEFAULT_MONTHLY_CAP);
  const todaySgd = await sumAllowedPositiveDeltaSince(startOfTodayUtc());
  const monthSgd = await sumAllowedPositiveDeltaSince(startOfMonthUtc());

  let recentBlocks = 0;
  try {
    const sinceMonth = startOfMonthUtc();
    const blocks = await db.select({ id: aiSpendLedger.id })
      .from(aiSpendLedger)
      .where(and(
        gte(aiSpendLedger.createdAt, sinceMonth),
        sql`${aiSpendLedger.decision} LIKE 'blocked%'`,
      ));
    recentBlocks = blocks.length;
  } catch {}

  return {
    todaySgd: Number(todaySgd.toFixed(2)),
    monthSgd: Number(monthSgd.toFixed(2)),
    dailyCapSgd: dailyCap,
    monthlyCapSgd: monthlyCap,
    dailyUtilization: dailyCap > 0 ? Number((todaySgd / dailyCap).toFixed(3)) : 0,
    monthlyUtilization: monthlyCap > 0 ? Number((monthSgd / monthlyCap).toFixed(3)) : 0,
    recentBlocks,
  };
}
