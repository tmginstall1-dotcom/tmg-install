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
  /**
   * If true AND severity is info|warn AND digest mode is enabled, skip the
   * immediate push/WhatsApp and queue this alert for the periodic digest
   * (see flushAlertDigest). Critical alerts always bypass the digest.
   */
  digestible?: boolean;
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

  // Kill-switch suppresses all NON-critical alerts. Critical ones must still
  // fire — otherwise the very alert that announces the kill switch tripping
  // (e.g. spend-cap-hit) would be silently swallowed (architect feedback).
  if (input.severity !== "critical" && (await getFlag("ai_master_kill_switch")) === true) {
    return result;
  }

  const dedupeKey = input.dedupeKey ?? `${input.severity}|${input.title}`;
  const summary = `[${input.severity.toUpperCase()}] ${input.title}`;
  if (await isThrottled(dedupeKey)) {
    result.throttled = true;
    return result;
  }

  // ── Digest mode: queue low-severity alerts instead of pushing now ──────────
  // We only audit-log the alert with `pendingDigest:true`. The flushAlertDigest
  // job (every 15 min) picks them up and sends one summary push. Critical
  // severity always bypasses this, since by definition you want it now.
  if (
    input.digestible === true &&
    input.severity !== "critical" &&
    (await getFlag("ai_alert_digest_enabled")) === true
  ) {
    await db.insert(aiAuditLog).values({
      actionType: "alert_fired",
      actor: "ai_alerts",
      module: "alerts",
      summary,
      detail: { ...input, dedupeKey, pendingDigest: true } as any,
      outcome: "queued",
    }).catch(() => {});
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

/**
 * flushAlertDigest — periodic job. Looks at audit-log alerts queued in the
 * last `windowMin` minutes (default 15) with `pendingDigest:true`, groups
 * them by severity+channel, sends ONE consolidated push, and marks them as
 * digested by inserting a follow-up audit row.
 *
 * We do not mutate the original audit rows (auditing principle: append-only).
 * Instead we record digestedIds in a `digest_sent` audit row and key the
 * "is this row already digested" check off the existence of a digest_sent
 * row that lists this row's id.
 */
export async function flushAlertDigest(windowMin = 15): Promise<{ digested: number; pushed: boolean }> {
  if ((await getFlag("ai_alert_digest_enabled")) !== true) return { digested: 0, pushed: false };
  if ((await getFlag("ai_master_kill_switch")) === true) return { digested: 0, pushed: false };

  // RETENTION WINDOW (4× the cycle) — we look back 4× the cycle window so
  // rows whose initial digest push failed get retried for several cycles
  // before aging out. Without this, a transient push outage would silently
  // drop queued alerts (architect feedback). The "already-digested" check
  // uses the same window so we never double-send.
  const retentionMin = Math.max(windowMin * 4, 60);
  const since = new Date(Date.now() - retentionMin * 60 * 1000);
  // Pull queued alerts from the retention window
  const queued = await db.select()
    .from(aiAuditLog)
    .where(and(
      eq(aiAuditLog.actionType, "alert_fired"),
      eq(aiAuditLog.module, "alerts"),
      gte(aiAuditLog.createdAt, since),
      sql`${aiAuditLog.detail}->>'pendingDigest' = 'true'`,
    ));

  if (queued.length === 0) return { digested: 0, pushed: false };

  // Filter out already-digested rows (look back same retention window)
  const ids = queued.map(q => q.id);
  const alreadyDigestedRows = await db.select({ detail: aiAuditLog.detail })
    .from(aiAuditLog)
    .where(and(
      eq(aiAuditLog.actionType, "digest_sent"),
      eq(aiAuditLog.module, "alerts"),
      gte(aiAuditLog.createdAt, since),
    ));
  const digested = new Set<number>();
  for (const r of alreadyDigestedRows) {
    const arr = (r.detail as any)?.digestedIds as number[] | undefined;
    if (Array.isArray(arr)) arr.forEach(i => digested.add(i));
  }
  const fresh = queued.filter(q => !digested.has(q.id));
  if (fresh.length === 0) return { digested: 0, pushed: false };

  // Group by severity
  const byKey = new Map<string, typeof fresh>();
  for (const r of fresh) {
    const sev = (r.detail as any)?.severity ?? "info";
    const ch  = (r.detail as any)?.channel ?? "general";
    const k = `${sev}|${ch}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(r);
  }

  const lines: string[] = [];
  for (const [k, items] of byKey.entries()) {
    const [sev, ch] = k.split("|");
    const top = items.slice(0, 5).map(it => `  • ${(it.detail as any)?.title ?? "(untitled)"}`);
    lines.push(`${sev.toUpperCase()} / ${ch} — ${items.length} alert(s):\n${top.join("\n")}`);
  }
  const body = `In the last ${windowMin} min, ${fresh.length} digestible alert(s):\n\n${lines.join("\n\n")}`;

  let pushed = false;
  try {
    const stats = await sendPushToAdmins({
      title: `AI digest · ${fresh.length} alerts (${windowMin}m)`,
      body: body.slice(0, 240),
      url: "/admin/ai",
      tag: `ai-alert-digest`,
    });
    pushed = stats.delivered > 0;
  } catch (e: any) {
    console.warn("[ai-alerts] digest push failed:", e?.message);
  }

  // Only mark these alerts digested when the push actually went out.
  // If push failed (no subscribers, transient error, etc.), leave them
  // pending so the next 15-min cycle retries — otherwise they'd be
  // silently dropped (architect feedback).
  if (pushed) {
    await db.insert(aiAuditLog).values({
      actionType: "digest_sent",
      actor: "ai_alerts",
      module: "alerts",
      summary: `Digest of ${fresh.length} alerts (${windowMin} min)`,
      detail: { digestedIds: fresh.map(r => r.id), windowMin, body } as any,
      outcome: "success",
    }).catch(() => {});
  } else {
    // Audit the failed attempt (without marking digestedIds) so we can see
    // it in the log without losing the queued items.
    await db.insert(aiAuditLog).values({
      actionType: "digest_attempt_failed",
      actor: "ai_alerts",
      module: "alerts",
      summary: `Digest push failed for ${fresh.length} alerts — will retry`,
      detail: { count: fresh.length, windowMin } as any,
      outcome: "failure",
    }).catch(() => {});
  }

  return { digested: pushed ? fresh.length : 0, pushed };
}
