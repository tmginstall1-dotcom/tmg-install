/**
 * ai-alerts.ts — Real-time fan-out for high-impact AI events.
 *
 * Single entry point: sendAiAlert({ severity, title, body, url? }).
 * Fans out to:
 *   - Browser push notifications (always, if subscribers exist)
 *   - WhatsApp message to ai_alert_recipient_phone (if flag enabled)
 *   - Audit log row (always)
 *
 * Throttling: identical (severity + title) alerts within 10 minutes are
 * suppressed to prevent storms when something flaps. The per-channel send
 * is wrapped in try/catch so a failing channel never blocks the others.
 *
 * Gates:
 *   ai_master_kill_switch       — emergency stop
 *   ai_realtime_alerts_enabled  — feature flag (controls WhatsApp; push always fires)
 */

import { db } from "./db";
import { eq, and, gte, sql } from "drizzle-orm";
import { aiAuditLog, appSettings } from "@shared/schema";
import { getFlag } from "./connector-sync";
import { sendPushToAdmins } from "./push";
import { sendWhatsAppMessage } from "./whatsapp";

type Severity = "info" | "warn" | "critical";

interface AlertInput {
  severity: Severity;
  title: string;
  body: string;
  url?: string;
  channel?: "ads" | "site" | "self_healing" | "anomaly" | "approval";
  /** Optional override for throttling — defaults to severity+title. Use when title is too coarse (e.g. include campaign id). */
  dedupeKey?: string;
}

const THROTTLE_WINDOW_MS = 10 * 60 * 1000;

async function getAppSetting(key: string): Promise<string | null> {
  try {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
    return row?.value ?? null;
  } catch { return null; }
}

async function isThrottled(dedupeKey: string): Promise<boolean> {
  const since = new Date(Date.now() - THROTTLE_WINDOW_MS);
  const [recent] = await db.select({ id: aiAuditLog.id })
    .from(aiAuditLog)
    .where(and(
      eq(aiAuditLog.actionType, "alert_fired"),
      eq(aiAuditLog.module, "alerts"),
      sql`${aiAuditLog.detail}->>'dedupeKey' = ${dedupeKey}`,
      gte(aiAuditLog.createdAt, since),
    ))
    .limit(1);
  return !!recent;
}

export async function sendAiAlert(input: AlertInput): Promise<{ pushSent: boolean; whatsappSent: boolean; throttled: boolean }> {
  const result = { pushSent: false, whatsappSent: false, throttled: false };

  if ((await getFlag("ai_master_kill_switch")) === true) return result;

  const dedupeKey = input.dedupeKey ?? `${input.severity}|${input.title}`;
  const summary = `[${input.severity.toUpperCase()}] ${input.title}`;
  if (await isThrottled(dedupeKey)) {
    result.throttled = true;
    return result;
  }

  // ── Channel 1: browser push (always on if subscribers exist) ────────────────
  try {
    const stats = await sendPushToAdmins({
      title: input.title,
      body: input.body,
      url: input.url ?? "/admin/ai",
      tag: `ai-alert-${input.channel ?? "general"}`,
    });
    result.pushSent = stats.delivered > 0;
  } catch (e: any) { console.warn("[ai-alerts] push failed:", e?.message); }

  // ── Channel 2: WhatsApp to admin (gated) ────────────────────────────────────
  if ((await getFlag("ai_realtime_alerts_enabled")) === true) {
    const phone = ((await getAppSetting("ai_alert_recipient_phone")) ?? "").replace(/[^\d+]/g, "");
    if (phone) {
      try {
        const emoji = input.severity === "critical" ? "🚨" : input.severity === "warn" ? "⚠️" : "ℹ️";
        const text = `${emoji} TMG AI · ${input.title}\n\n${input.body}\n\nView: https://tmginstall.com${input.url ?? "/admin/ai"}`;
        const ok = await sendWhatsAppMessage(phone.replace(/^\+/, ""), text, { logAsSentBy: "ai_alerts" });
        result.whatsappSent = !!ok;
      } catch (e: any) { console.warn("[ai-alerts] whatsapp failed:", e?.message); }
    }
  }

  // ── Audit log (always) ──────────────────────────────────────────────────────
  await db.insert(aiAuditLog).values({
    actionType: "alert_fired",
    actor: "ai_alerts",
    module: "alerts",
    summary,
    detail: { ...input, dedupeKey, ...result } as any,
    outcome: result.pushSent || result.whatsappSent ? "success" : "skipped",
  }).catch(() => {});

  return result;
}
