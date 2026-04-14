/**
 * connector-sync.ts — Standalone core sync functions for scheduler use.
 *
 * CHANGE-CONTROL RULES:
 * - Writes only to ai_* tables.
 * - No reads or writes to quotes / payments / jobs / customers.
 * - Helpers are self-contained (no import from ai-routes.ts) to avoid circular deps.
 */

import { db } from "./db";
import { eq, and, gte, desc, inArray } from "drizzle-orm";
import {
  aiFeatureFlags,
  aiConnectorConfigs,
  aiAdsSnapshots,
  aiSearchConsoleData,
  aiPagespeedData,
  aiAuditLog,
} from "@shared/schema";

// ── Shared helpers ─────────────────────────────────────────────────────────────

export async function getFlag(key: string): Promise<boolean> {
  try {
    const rows = await db.select().from(aiFeatureFlags).where(eq(aiFeatureFlags.key, key)).limit(1);
    return rows[0]?.value ?? false;
  } catch { return false; }
}

export async function logAiActionSync(
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

export async function setConnectorSync(
  name: string,
  status: "running" | "success" | "error",
  error?: string,
) {
  try {
    await db.update(aiConnectorConfigs)
      .set({
        lastSyncAt: status !== "running" ? new Date() : undefined,
        lastSyncStatus: status,
        syncError: error ?? null,
        updatedAt: new Date(),
      })
      .where(eq(aiConnectorConfigs.name, name));
  } catch { /* non-fatal */ }
}

export async function isSyncRunning(name: string): Promise<boolean> {
  try {
    const [cfg] = await db
      .select({ status: aiConnectorConfigs.lastSyncStatus })
      .from(aiConnectorConfigs)
      .where(eq(aiConnectorConfigs.name, name))
      .limit(1);
    return cfg?.status === "running";
  } catch { return false; }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
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

export async function googleAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<string> {
  const r = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  }, 15_000);
  const j: any = await r.json();
  if (!j.access_token) throw new Error(`OAuth error: ${j.error ?? "unknown"}`);
  return j.access_token as string;
}

export function gadsCredsCheck(): string[] {
  const needed: Record<string, string | undefined> = {
    GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_CUSTOMER_ID: process.env.GOOGLE_ADS_CUSTOMER_ID,
    GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_REFRESH_TOKEN: process.env.GOOGLE_ADS_REFRESH_TOKEN,
  };
  return Object.entries(needed).filter(([, v]) => !v).map(([k]) => k);
}

export function metaCredsCheck(): string[] {
  return ([
    !process.env.META_ACCESS_TOKEN ? "META_ACCESS_TOKEN" : null,
    !process.env.META_AD_ACCOUNT_ID ? "META_AD_ACCOUNT_ID" : null,
  ] as (string | null)[]).filter(Boolean) as string[];
}

export function gscCredsCheck(): string[] {
  return ([
    !process.env.GSC_CLIENT_ID ? "GSC_CLIENT_ID" : null,
    !process.env.GSC_CLIENT_SECRET ? "GSC_CLIENT_SECRET" : null,
    !process.env.GSC_REFRESH_TOKEN ? "GSC_REFRESH_TOKEN" : null,
  ] as (string | null)[]).filter(Boolean) as string[];
}

// ── Stale running-state recovery ─────────────────────────────────────────────
// Called once at startup (before the 90s due-check). If the previous process
// crashed mid-sync, the DB status can be left as "running" indefinitely,
// blocking all future scheduled syncs via the isSyncRunning() guard.
// Any connector stuck in "running" for more than STALE_RUNNING_MS is reset
// to "error" with a descriptive message so the next scheduled run proceeds.

const STALE_RUNNING_MS = 10 * 60 * 1000; // 10 minutes

export async function recoverStaleRunningStates(): Promise<void> {
  try {
    const configs = await db.select().from(aiConnectorConfigs);
    const threshold = new Date(Date.now() - STALE_RUNNING_MS);
    for (const cfg of configs) {
      if (cfg.lastSyncStatus === "running") {
        const updatedAt = cfg.updatedAt ? new Date(cfg.updatedAt) : null;
        const isStuck = !updatedAt || updatedAt < threshold;
        if (isStuck) {
          console.warn(`[scheduler] Recovering stale running state for connector: ${cfg.name}`);
          await db.update(aiConnectorConfigs)
            .set({
              lastSyncStatus: "error",
              syncError: "Sync interrupted — process restarted or crashed mid-run.",
              updatedAt: new Date(),
            })
            .where(eq(aiConnectorConfigs.name, cfg.name));
        }
      }
    }
  } catch (err: any) {
    // Non-fatal — scheduler will still run, and isSyncRunning checks are the last defence
    console.warn("[scheduler] recoverStaleRunningStates failed (non-fatal):", err.message);
  }
}

// ── Core sync functions ────────────────────────────────────────────────────────
// These are called by the scheduler. Route handlers have their own copies.

export async function coreGoogleAdsSync(
  triggeredBy = "scheduler",
): Promise<{ inserted: number }> {
  await setConnectorSync("google_ads", "running");
  try {
    const {
      GOOGLE_ADS_CLIENT_ID: cid,
      GOOGLE_ADS_CLIENT_SECRET: cs,
      GOOGLE_ADS_REFRESH_TOKEN: rt,
      GOOGLE_ADS_DEVELOPER_TOKEN: dt,
      GOOGLE_ADS_CUSTOMER_ID: customerId,
    } = process.env;
    const accessToken = await googleAccessToken(cid!, cs!, rt!);
    const cleanId = customerId!.replace(/-/g, "");
    const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    const gaqlRes = await fetchWithTimeout(
      `https://googleads.googleapis.com/v18/customers/${cleanId}/googleAds:search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": dt!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc, segments.date FROM campaign WHERE segments.date BETWEEN '${thirtyAgo}' AND '${today}' AND campaign.status = 'ENABLED' ORDER BY segments.date DESC LIMIT 1000`,
        }),
      },
    );
    const gaqlData: any = await gaqlRes.json();
    if (gaqlData.error) throw new Error(gaqlData.error.message ?? "Google Ads API error");

    let inserted = 0;
    const rows = gaqlData.results ?? [];
    await db.transaction(async (tx) => {
      await tx.delete(aiAdsSnapshots).where(
        and(eq(aiAdsSnapshots.source, "google_ads_api"), gte(aiAdsSnapshots.snapshotDate, thirtyAgo)),
      );
      for (const row of rows) {
        const spend = parseInt(row.metrics?.costMicros ?? "0") / 1_000_000;
        const clicks = parseInt(String(row.metrics?.clicks ?? "0"));
        const impressions = parseInt(String(row.metrics?.impressions ?? "0"));
        const conversions = parseFloat(String(row.metrics?.conversions ?? "0"));
        const cpc = clicks > 0 ? spend / clicks : 0;
        await tx.insert(aiAdsSnapshots).values({
          platform: "google",
          source: "google_ads_api",
          snapshotDate: row.segments?.date ?? today,
          campaignId: String(row.campaign?.id ?? ""),
          campaignName: row.campaign?.name,
          adSetId: String(row.adGroup?.id ?? ""),
          adSetName: row.adGroup?.name,
          spend: spend.toFixed(2) as any,
          impressions,
          clicks,
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
    await logAiActionSync("connector_sync", triggeredBy, "ads",
      `Google Ads sync — ${inserted} rows imported`, { inserted, triggeredBy });
    return { inserted };
  } catch (err: any) {
    await setConnectorSync("google_ads", "error", err.message);
    throw err;
  }
}

export async function coreMetaAdsSync(
  triggeredBy = "scheduler",
): Promise<{ inserted: number }> {
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
    const metaRes = await fetchWithTimeout(
      `https://graph.facebook.com/v20.0/act_${accountId}/insights?${params}`,
    );
    const metaData: any = await metaRes.json();
    if (metaData.error) throw new Error(metaData.error.message ?? "Meta API error");

    const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    let inserted = 0;
    const rows = metaData.data ?? [];
    await db.transaction(async (tx) => {
      await tx.delete(aiAdsSnapshots).where(
        and(eq(aiAdsSnapshots.source, "meta_ads_api"), gte(aiAdsSnapshots.snapshotDate, thirtyAgo)),
      );
      for (const row of rows) {
        const spend = parseFloat(row.spend ?? "0");
        const clicks = parseInt(String(row.clicks ?? "0"));
        const impressions = parseInt(String(row.impressions ?? "0"));
        const leadsAction = row.actions?.find((a: any) =>
          ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"].includes(a.action_type),
        );
        const conversions = parseFloat(leadsAction?.value ?? "0");
        const convValue = row.action_values?.find((a: any) =>
          a.action_type === leadsAction?.action_type,
        )?.value ?? "0";
        await tx.insert(aiAdsSnapshots).values({
          platform: "meta",
          source: "meta_ads_api",
          snapshotDate: row.date_start,
          campaignId: row.campaign_id,
          campaignName: row.campaign_name,
          adSetId: row.adset_id,
          adSetName: row.adset_name,
          spend: spend.toFixed(2) as any,
          impressions,
          clicks,
          conversions: conversions.toFixed(2) as any,
          conversionValue: parseFloat(convValue).toFixed(2) as any,
          ctr: impressions > 0 ? (clicks / impressions * 100).toFixed(4) as any : "0",
          cpc: clicks > 0 ? (spend / clicks).toFixed(4) as any : "0",
          cpl: conversions > 0 ? (spend / conversions).toFixed(4) as any : "0",
          rawData: row as any,
        });
        inserted++;
      }
    });
    await setConnectorSync("meta_ads", "success");
    await logAiActionSync("connector_sync", triggeredBy, "ads",
      `Meta Ads sync — ${inserted} rows imported`, { inserted, triggeredBy });
    return { inserted };
  } catch (err: any) {
    await setConnectorSync("meta_ads", "error", err.message);
    throw err;
  }
}

export async function coreSearchConsoleSync(
  triggeredBy = "scheduler",
): Promise<{ inserted: number }> {
  await setConnectorSync("search_console", "running");
  try {
    const { GSC_CLIENT_ID: cid, GSC_CLIENT_SECRET: cs, GSC_REFRESH_TOKEN: rt } = process.env;
    const siteUrl = process.env.GSC_SITE_URL ?? "https://www.tmginstall.com/";
    const accessToken = await googleAccessToken(cid!, cs!, rt!);
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const syncId = `${startDate}__${endDate}`;

    const gscRes = await fetchWithTimeout(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate, endDate,
          dimensions: ["query", "page", "country", "device"],
          rowLimit: 1000,
        }),
      },
    );
    const gscData: any = await gscRes.json();
    if (gscData.error) throw new Error(gscData.error.message ?? "Search Console API error");

    let inserted = 0;
    const rows = gscData.rows ?? [];
    await db.transaction(async (tx) => {
      await tx.delete(aiSearchConsoleData).where(eq(aiSearchConsoleData.syncId, syncId));
      for (const row of rows) {
        await tx.insert(aiSearchConsoleData).values({
          syncId,
          date: endDate,
          query: row.keys?.[0],
          page: row.keys?.[1],
          country: row.keys?.[2],
          device: row.keys?.[3],
          clicks: row.clicks ?? 0,
          impressions: row.impressions ?? 0,
          ctr: (row.ctr != null ? (row.ctr * 100).toFixed(4) : "0") as any,
          position: row.position != null ? parseFloat(row.position.toFixed(2)) as any : null,
        });
        inserted++;
      }
    });
    await setConnectorSync("search_console", "success");
    await logAiActionSync("connector_sync", triggeredBy, "attribution",
      `Search Console sync — ${inserted} queries imported`, { inserted, syncId, triggeredBy });
    return { inserted };
  } catch (err: any) {
    await setConnectorSync("search_console", "error", err.message);
    throw err;
  }
}

export async function corePageSpeedSync(
  triggeredBy = "scheduler",
): Promise<{ results: any[] }> {
  await setConnectorSync("pagespeed", "running");
  try {
    const apiKey = process.env.GOOGLE_API_KEY ?? "";
    const targetUrl = process.env.PAGESPEED_TARGET_URL ?? "https://www.tmginstall.com";
    const results: any[] = [];

    for (const strategy of ["mobile", "desktop"] as const) {
      const qs = new URLSearchParams({ url: targetUrl, strategy });
      if (apiKey) qs.set("key", apiKey);
      const psRes = await fetchWithTimeout(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`,
        {},
        45_000,
      );
      const psData: any = await psRes.json();
      if (psData.error) { results.push({ strategy, error: psData.error.message }); continue; }

      const cats = psData.lighthouseResult?.categories ?? {};
      const audits = psData.lighthouseResult?.audits ?? {};
      const score = (key: string) =>
        cats[key]?.score != null ? Math.round(cats[key].score * 100) : null;
      const auditMs = (key: string) =>
        audits[key]?.numericValue ? Math.round(audits[key].numericValue) : null;

      await db.insert(aiPagespeedData).values({
        url: targetUrl,
        strategy,
        performanceScore: score("performance"),
        accessibilityScore: score("accessibility"),
        seoScore: score("seo"),
        bestPracticesScore: score("best-practices"),
        fcpMs: auditMs("first-contentful-paint"),
        lcpMs: auditMs("largest-contentful-paint"),
        clsScore: audits["cumulative-layout-shift"]?.numericValue != null
          ? parseFloat(audits["cumulative-layout-shift"].numericValue.toFixed(4)) as any
          : null,
        ttfbMs: auditMs("server-response-time"),
        rawAudits: {
          tbt: audits["total-blocking-time"]?.numericValue,
          tti: audits["interactive"]?.numericValue,
          si: audits["speed-index"]?.numericValue,
        } as any,
      });
      results.push({ strategy, performanceScore: score("performance"), seoScore: score("seo") });
    }

    for (const strat of ["mobile", "desktop"] as const) {
      const allForStrat = await db
        .select({ id: aiPagespeedData.id })
        .from(aiPagespeedData)
        .where(eq(aiPagespeedData.strategy, strat))
        .orderBy(desc(aiPagespeedData.createdAt));
      const toDelete = allForStrat.slice(10).map((r) => r.id);
      if (toDelete.length > 0) {
        await db.delete(aiPagespeedData).where(inArray(aiPagespeedData.id, toDelete));
      }
    }

    await setConnectorSync("pagespeed", "success");
    await logAiActionSync("connector_sync", triggeredBy, "site",
      `PageSpeed sync — mobile+desktop scored`, { results, triggeredBy });
    return { results };
  } catch (err: any) {
    await setConnectorSync("pagespeed", "error", err.message);
    throw err;
  }
}
