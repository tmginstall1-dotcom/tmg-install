/**
 * scheduler.ts — Connector sync scheduler
 *
 * SCHEDULE:
 *   google_ads:     every 6 hours
 *   meta_ads:       every 6 hours
 *   search_console: every 24 hours
 *   pagespeed:      every 24 hours
 *
 * SAFETY:
 *   - Respects ai_scheduler_enabled (master on/off for scheduled syncs)
 *   - Respects ai_master_kill_switch (emergency stop for all AI activity)
 *   - Respects per-connector feature flags
 *   - Skips if sync is already running (concurrent guard via DB)
 *   - Skips if connector is not yet due (based on last_sync_at + interval)
 *   - Skips silently if credentials are missing
 *   - All activity is logged to ai_audit_log
 *   - Never touches quotes / payments / jobs / customers tables
 */

import { db } from "./db";
import { eq } from "drizzle-orm";
import { aiConnectorConfigs } from "@shared/schema";
import {
  getFlag,
  isSyncRunning,
  logAiActionSync,
  gadsCredsCheck,
  metaCredsCheck,
  gscCredsCheck,
  coreGoogleAdsSync,
  coreMetaAdsSync,
  coreSearchConsoleSync,
  corePageSpeedSync,
  recoverStaleRunningStates,
} from "./connector-sync";

// ── Singleton guard ────────────────────────────────────────────────────────────
// Prevents duplicate timers if startScheduler() is called more than once per
// process (e.g. accidental double-import or future code change).
let _schedulerStarted = false;

// ── Schedule intervals ─────────────────────────────────────────────────────────
export const SCHEDULE_INTERVALS: Record<string, number> = {
  google_ads:     6  * 60 * 60 * 1000, // 6 hours
  meta_ads:       6  * 60 * 60 * 1000, // 6 hours
  search_console: 24 * 60 * 60 * 1000, // 24 hours
  pagespeed:      24 * 60 * 60 * 1000, // 24 hours
};

// ── Per-connector feature flags ────────────────────────────────────────────────
const CONNECTOR_FLAGS: Record<string, string> = {
  google_ads:     "ai_google_ads_sync_enabled",
  meta_ads:       "ai_meta_ads_sync_enabled",
  search_console: "ai_search_console_enabled",
  pagespeed:      "ai_pagespeed_enabled",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getLastSyncAt(name: string): Promise<Date | null> {
  try {
    const [cfg] = await db
      .select({ lastSyncAt: aiConnectorConfigs.lastSyncAt })
      .from(aiConnectorConfigs)
      .where(eq(aiConnectorConfigs.name, name))
      .limit(1);
    return cfg?.lastSyncAt ?? null;
  } catch { return null; }
}

async function isDue(name: string): Promise<boolean> {
  const lastAt = await getLastSyncAt(name);
  if (!lastAt) return true; // never synced → run immediately
  const intervalMs = SCHEDULE_INTERVALS[name] ?? Infinity;
  return Date.now() - new Date(lastAt).getTime() >= intervalMs;
}

// ── Core scheduled sync runner ─────────────────────────────────────────────────

async function runScheduledSync(
  name: string,
  fn: (triggeredBy: string) => Promise<any>,
  credsCheck: () => string[],
) {
  try {
    // Guard 1: scheduler master switch
    const schedulerEnabled = await getFlag("ai_scheduler_enabled");
    if (!schedulerEnabled) return;

    // Guard 2: kill switch
    const killSwitch = await getFlag("ai_master_kill_switch");
    if (killSwitch) return;

    // Guard 3: connector-specific flag
    const connectorEnabled = await getFlag(CONNECTOR_FLAGS[name]);
    if (!connectorEnabled) return;

    // Guard 4: not yet due
    if (!await isDue(name)) return;

    // Guard 5: missing credentials — skip silently
    if (credsCheck().length > 0) return;

    // Guard 6: concurrent sync already running
    if (await isSyncRunning(name)) return;

    console.log(`[scheduler] Starting scheduled ${name} sync`);
    const result = await fn("scheduler");
    console.log(`[scheduler] ${name} sync complete:`, JSON.stringify(result));
    await logAiActionSync(
      "scheduled_sync", "scheduler", name,
      `Scheduled ${name} sync complete`,
      { result },
    );
  } catch (err: any) {
    console.error(`[scheduler] ${name} sync failed:`, err.message);
    await logAiActionSync(
      "scheduled_sync", "scheduler", name,
      `Scheduled ${name} sync failed: ${err.message}`,
      {},
      "error",
    ).catch(() => {});
  }
}

// ── Startup check ──────────────────────────────────────────────────────────────
// Runs 90 s after boot so Neon DB has time to wake up. Fires each connector
// only if it is overdue (i.e. has never synced, or its last sync was > interval ago).

function runStartupCheck() {
  setTimeout(async () => {
    // Step 1: Recover any connectors stuck in "running" from a previous crash.
    // Must run before due-check so isSyncRunning() does not falsely block.
    await recoverStaleRunningStates();
    // Step 2: Run each connector if overdue.
    console.log("[scheduler] Running startup due-check for all connectors");
    await runScheduledSync("google_ads",     coreGoogleAdsSync,     gadsCredsCheck);
    await runScheduledSync("meta_ads",       coreMetaAdsSync,       metaCredsCheck);
    await runScheduledSync("search_console", coreSearchConsoleSync, gscCredsCheck);
    await runScheduledSync("pagespeed",      corePageSpeedSync,     () => []);
  }, 90_000);
}

// ── Exported entry point ───────────────────────────────────────────────────────

export function startScheduler() {
  if (_schedulerStarted) {
    console.warn("[scheduler] startScheduler() called more than once — ignoring duplicate call.");
    return;
  }
  _schedulerStarted = true;
  console.log("[scheduler] Connector sync scheduler initialized");

  // Startup check after 90 s
  runStartupCheck();

  // Recurring intervals (independent of startup check)
  setInterval(
    () => runScheduledSync("google_ads",     coreGoogleAdsSync,     gadsCredsCheck),
    SCHEDULE_INTERVALS.google_ads,
  );
  setInterval(
    () => runScheduledSync("meta_ads",       coreMetaAdsSync,       metaCredsCheck),
    SCHEDULE_INTERVALS.meta_ads,
  );
  setInterval(
    () => runScheduledSync("search_console", coreSearchConsoleSync, gscCredsCheck),
    SCHEDULE_INTERVALS.search_console,
  );
  setInterval(
    () => runScheduledSync("pagespeed",      corePageSpeedSync,     () => []),
    SCHEDULE_INTERVALS.pagespeed,
  );
}
