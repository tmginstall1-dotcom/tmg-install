/**
 * ai-anomaly.ts — Lightweight anomaly detection for ad spend & CTR.
 *
 * Runs every 4 hours via the scheduler. For each campaign with sufficient
 * snapshot history, computes the trailing 14-day median + MAD (median
 * absolute deviation) for spend and CTR, then compares today's most recent
 * snapshot. Flags anomalies that deviate beyond the configured sigma
 * threshold (default 3) and fires a sendAiAlert.
 *
 * Why MAD instead of stddev: ad metrics have heavy tails and weekend dips.
 * MAD is robust to outliers and won't keep crying wolf about Sundays.
 *
 * Gates:
 *   ai_master_kill_switch
 *   ai_anomaly_detection_enabled
 *   ai_anomaly_sigma_threshold (numeric, default 3)
 */

import { db } from "./db";
import { eq, and, gte, sql } from "drizzle-orm";
import { aiAdsSnapshots, appSettings } from "@shared/schema";
import { getFlag } from "./connector-sync";
import { sendAiAlert } from "./ai-alerts";

const LOOKBACK_DAYS = 14;
const MIN_HISTORY_DAYS = 7;        // need at least a week of data to call something "normal"
const DEFAULT_SIGMA = 3;
const MAD_TO_SIGMA = 1.4826;       // standard scaling so MAD-based bounds match stddev intuition
const COOLDOWN_HOURS = 24;          // don't re-alert the same campaign within 24h

interface AnomalyResult {
  scanned: number;
  alerted: number;
  insufficientHistory: number;
  errors: number;
  details: Array<{ campaign: string; metric: string; today: number; baseline: number; deviation: number }>;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function madDeviation(values: number[], today: number): { baseline: number; sigmaLike: number; deviation: number } {
  if (values.length === 0) return { baseline: 0, sigmaLike: 0, deviation: 0 };
  const baseline = median(values);
  const mad = median(values.map(v => Math.abs(v - baseline)));
  const sigmaLike = mad * MAD_TO_SIGMA;
  if (sigmaLike === 0) return { baseline, sigmaLike: 0, deviation: 0 };
  return { baseline, sigmaLike, deviation: (today - baseline) / sigmaLike };
}

async function getAppSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return row?.value ?? null;
  } catch { return null; }
}

// Track last alert per campaign+metric to avoid duplicate firing
const lastAlertedAt = new Map<string, number>();

export async function runAnomalySweep(triggeredBy: string = "scheduler"): Promise<AnomalyResult> {
  const result: AnomalyResult = { scanned: 0, alerted: 0, insufficientHistory: 0, errors: 0, details: [] };

  if ((await getFlag("ai_master_kill_switch")) === true) return result;
  if ((await getFlag("ai_anomaly_detection_enabled")) !== true) return result;

  const sigmaStr = (await getAppSetting("ai_anomaly_sigma_threshold")) ?? "";
  const sigmaThreshold = parseFloat(sigmaStr) > 0 ? parseFloat(sigmaStr) : DEFAULT_SIGMA;

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const sinceStr = since.toISOString().slice(0, 10);

  // Pull all snapshots from the lookback window. This stays small (a few thousand rows max).
  const rows = await db.select().from(aiAdsSnapshots).where(gte(aiAdsSnapshots.snapshotDate, sinceStr));

  // Group by campaign
  const byCampaign = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!r.campaignId) continue;
    const k = `${r.platform}:${r.campaignId}`;
    if (!byCampaign.has(k)) byCampaign.set(k, []);
    byCampaign.get(k)!.push(r);
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const cooldownMs = COOLDOWN_HOURS * 60 * 60 * 1000;

  for (const [key, campaignRows] of Array.from(byCampaign.entries())) {
    result.scanned++;
    try {
      // Aggregate by date — one row per day per metric
      const byDate = new Map<string, { spend: number; clicks: number; impressions: number }>();
      for (const r of campaignRows) {
        const d = r.snapshotDate;
        const entry = byDate.get(d) ?? { spend: 0, clicks: 0, impressions: 0 };
        entry.spend += parseFloat(String(r.spend ?? 0));
        entry.clicks += Number(r.clicks ?? 0);
        entry.impressions += Number(r.impressions ?? 0);
        byDate.set(d, entry);
      }

      const dates = Array.from(byDate.keys()).sort();
      if (dates.length < MIN_HISTORY_DAYS) { result.insufficientHistory++; continue; }

      const todayEntry = byDate.get(todayStr);
      if (!todayEntry) continue; // no data today, can't compare

      // Build historical baseline arrays excluding today
      const histDates = dates.filter(d => d !== todayStr);
      const histSpend = histDates.map(d => byDate.get(d)!.spend);
      const histCtr = histDates.map(d => {
        const e = byDate.get(d)!;
        return e.impressions > 0 ? (e.clicks / e.impressions) * 100 : 0;
      });

      const todaySpend = todayEntry.spend;
      const todayCtr = todayEntry.impressions > 0 ? (todayEntry.clicks / todayEntry.impressions) * 100 : 0;

      const checks = [
        { metric: "spend", today: todaySpend, ...madDeviation(histSpend, todaySpend) },
        { metric: "ctr",   today: todayCtr,   ...madDeviation(histCtr,   todayCtr)   },
      ];

      const campaignName = campaignRows[campaignRows.length - 1].campaignName ?? key;
      const platform = campaignRows[0].platform;

      for (const c of checks) {
        const absDev = Math.abs(c.deviation);
        if (absDev < sigmaThreshold || c.sigmaLike === 0) continue;

        // Cooldown: don't alert the same campaign+metric within 24h
        const cooldownKey = `${key}:${c.metric}`;
        const lastAt = lastAlertedAt.get(cooldownKey) ?? 0;
        if (Date.now() - lastAt < cooldownMs) continue;

        const direction = c.deviation > 0 ? "↑" : "↓";
        const pctChange = c.baseline > 0 ? ((c.today - c.baseline) / c.baseline) * 100 : 0;
        const severity = absDev >= sigmaThreshold * 2 ? "critical" : "warn";

        const formattedToday = c.metric === "spend" ? `$${c.today.toFixed(2)}` : `${c.today.toFixed(2)}%`;
        const formattedBase  = c.metric === "spend" ? `$${c.baseline.toFixed(2)}` : `${c.baseline.toFixed(2)}%`;

        const alertResult = await sendAiAlert({
          severity,
          channel: "anomaly",
          title: `${platform.toUpperCase()} anomaly: ${c.metric} ${direction} — ${campaignName}`,
          body: `${campaignName}\n${c.metric.toUpperCase()}: ${formattedBase} → ${formattedToday} (${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(0)}%, ${absDev.toFixed(1)}σ)`,
          url: "/admin/ai/connectors",
          // Include campaign in dedupe key so anomalies on different campaigns
          // don't suppress each other within the throttle window.
          dedupeKey: `anomaly|${platform}|${key}|${c.metric}|${direction}`,
        });

        lastAlertedAt.set(cooldownKey, Date.now());
        // Only count if a channel actually delivered or it was a fresh insert
        // (throttled alerts shouldn't inflate the "alerted" count we report).
        if (!alertResult.throttled && (alertResult.pushSent || alertResult.whatsappSent)) {
          result.alerted++;
        }
        result.details.push({
          campaign: campaignName, metric: c.metric, today: c.today, baseline: c.baseline,
          deviation: c.deviation, delivered: alertResult.pushSent || alertResult.whatsappSent, throttled: alertResult.throttled,
        });
      }
    } catch (err: any) {
      result.errors++;
      console.error("[anomaly] error scanning", key, err?.message);
    }
  }

  return result;
}
