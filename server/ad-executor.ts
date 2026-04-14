/**
 * ad-executor.ts — Phase 7: Platform Execution Engine
 *
 * SAFETY CONTRACT:
 *   - test_mode=true  → full payload generated, logged, but NO live API call is made
 *   - test_mode=false → live API call is made, result stored verbatim
 *   - Budget cap: never increase any budget by more than 10% per execution
 *   - Never mutate account-level settings, billing, targeting, or campaign launch
 *   - Never touch booking/payment/quote/customer tables
 *   - Every call logged to ai_platform_executions and ai_audit_log
 *   - If creds missing → resultStatus = "failed", clear errorMessage, no throw
 *
 * Circular dependency rule: MUST NOT import from ai-routes.ts
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlatformExecutionResult {
  platform: "google_ads" | "meta_ads";
  actionType: string;
  targetObjectIds: Record<string, string | undefined>;
  proposedChange: Record<string, any>;
  executedChange: Record<string, any>;
  resultStatus: "success" | "failed" | "test_mode" | "export_only" | "missing_ids";
  platformResponseSummary: string;
  platformResponseRaw?: Record<string, any>;
  rollbackPath: string;
  rollbackPayload?: Record<string, any>;
  errorMessage?: string;
  testMode: boolean;
}

type ApprovalItem = {
  id: number;
  queueType: string | null;
  title: string;
  description: string | null;
  riskLevel: string;
  proposedAction: unknown;
  refId: number | null;
  refType: string | null;
  rollbackPath: string | null;
};

// ── Config helpers ─────────────────────────────────────────────────────────────

/** Returns missing Google Ads credential names (empty = all present). */
export function gadsExecCredsCheck(): string[] {
  return ([
    !process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? "GOOGLE_ADS_DEVELOPER_TOKEN" : null,
    !process.env.GOOGLE_ADS_CUSTOMER_ID     ? "GOOGLE_ADS_CUSTOMER_ID"     : null,
    !process.env.GOOGLE_ADS_CLIENT_ID       ? "GOOGLE_ADS_CLIENT_ID"       : null,
    !process.env.GOOGLE_ADS_CLIENT_SECRET   ? "GOOGLE_ADS_CLIENT_SECRET"   : null,
    !process.env.GOOGLE_ADS_REFRESH_TOKEN   ? "GOOGLE_ADS_REFRESH_TOKEN"   : null,
  ] as (string | null)[]).filter(Boolean) as string[];
}

/** Returns missing Meta credential names (empty = all present). */
export function metaExecCredsCheck(): string[] {
  return ([
    !process.env.META_ACCESS_TOKEN   ? "META_ACCESS_TOKEN"   : null,
    !process.env.META_AD_ACCOUNT_ID  ? "META_AD_ACCOUNT_ID"  : null,
  ] as (string | null)[]).filter(Boolean) as string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PILOT SAFETY FENCE — Phase 8 controlled live pilot
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PILOT_LIVE_SAFE_ACTION_TYPES: Only these action types are permitted to make
 * real API calls in live mode. Everything else is forced to dry-run or export-only
 * regardless of the testMode flag value.
 *
 * Current pilot scope (v1):
 *   Google Ads: negative keyword adds, pause/enable individual ad or ad group
 *   Meta Ads:   pause/enable individual ad or ad set
 *
 * NOT in pilot scope (forces dry-run):
 *   Budget adjustments (both platforms) — too high blast radius
 *   Campaign-level actions — require additional review
 *   Creative launches — require separate compliance review
 *   Label, targeting, bidding changes — out of scope
 */
const PILOT_LIVE_SAFE_ACTION_TYPES = new Set([
  "negative_keyword_add",  // Google Ads: add negative keywords to a campaign
  "pause_ad",              // Google Ads + Meta Ads: pause a single ad
  "enable_ad",             // Google Ads + Meta Ads: enable/unpause a single ad
  "pause_ad_group",        // Google Ads: pause an ad group
  "enable_ad_group",       // Google Ads: enable an ad group
  "pause_adset",           // Meta Ads: pause an ad set
  "enable_adset",          // Meta Ads: enable an ad set
]);

/** Build a pilot-fence dry-run result for budget actions (safe — generates payload but makes no API call). */
function buildBudgetFencedResult(
  base: PlatformExecutionResult,
): PlatformExecutionResult {
  return {
    ...base,
    resultStatus: "test_mode",
    testMode: true,
    platformResponseSummary:
      `[PILOT FENCE — dry run only] ${base.platformResponseSummary} ` +
      `Budget adjustments are locked to dry-run mode in the current pilot. ` +
      `Review the payload, then apply manually in the platform dashboard.`,
  };
}

// ── Budget cap guard ───────────────────────────────────────────────────────────
const MAX_BUDGET_INCREASE_PCT = 10;

function enforceBudgetCap(currentMicros: number, proposedMicros: number): { allowed: boolean; cappedMicros: number; pct: number } {
  const pct = currentMicros > 0 ? ((proposedMicros - currentMicros) / currentMicros) * 100 : 0;
  if (pct > MAX_BUDGET_INCREASE_PCT) {
    const cappedMicros = Math.floor(currentMicros * (1 + MAX_BUDGET_INCREASE_PCT / 100));
    return { allowed: false, cappedMicros, pct };
  }
  return { allowed: true, cappedMicros: proposedMicros, pct };
}

// ── OAuth token refresh (Google) ───────────────────────────────────────────────
async function fetchGoogleAccessToken(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type:    "refresh_token",
    }).toString(),
  });
  const j: any = await r.json();
  if (!j.access_token) throw new Error(`Google OAuth failed: ${j.error ?? "unknown"}`);
  return j.access_token as string;
}

// ── Google Ads customer ID normalisation ───────────────────────────────────────
function normCustomerId(raw: string): string {
  return raw.replace(/-/g, "");
}

// ── Google Ads API base URL ────────────────────────────────────────────────────
const GADS_API_VERSION = "v17";
function gadsUrl(customerId: string, resource: string): string {
  return `https://googleads.googleapis.com/${GADS_API_VERSION}/customers/${normCustomerId(customerId)}/${resource}`;
}

// ── Google Ads: build shared headers ──────────────────────────────────────────
function gadsHeaders(accessToken: string): Record<string, string> {
  return {
    "Authorization":   `Bearer ${accessToken}`,
    "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    "Content-Type":    "application/json",
  };
}

// ── Meta API base ──────────────────────────────────────────────────────────────
const META_API_VERSION = "v19.0";
function metaUrl(objectId: string): string {
  return `https://graph.facebook.com/${META_API_VERSION}/${objectId}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE ADS EXECUTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add negative keywords to a Google Ads campaign via REST API.
 * Uses the campaignCriteria:mutate endpoint (Google Ads API v17).
 */
async function executeGoogleAdsNegativeKeywords(
  pa: any,
  item: ApprovalItem,
  testMode: boolean,
): Promise<PlatformExecutionResult> {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
  const campaignId = pa.campaignId as string | undefined;
  const keywords: Array<{ term: string; matchType: string }> = pa.negativeKeywords ?? [];

  const targetObjectIds = { customerId, campaignId };
  const proposedChange = { negativeKeywords: keywords, campaignId, campaignName: pa.campaignName };

  if (!campaignId) {
    return {
      platform: "google_ads",
      actionType: "negative_keyword_add",
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "missing_ids",
      platformResponseSummary: "campaignId is required to push negative keywords to Google Ads. Add this to the proposedAction and retry.",
      rollbackPath: "No changes made — execution was not attempted.",
      testMode,
    };
  }

  if (keywords.length === 0) {
    return {
      platform: "google_ads",
      actionType: "negative_keyword_add",
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "export_only",
      platformResponseSummary: "No keywords provided in the proposed action.",
      rollbackPath: "No changes made.",
      testMode,
    };
  }

  const MATCH_TYPE_MAP: Record<string, string> = {
    broad: "BROAD", phrase: "PHRASE", exact: "EXACT",
    BROAD: "BROAD", PHRASE: "PHRASE", EXACT: "EXACT",
  };

  const operations = keywords.map(kw => ({
    create: {
      campaign: `customers/${normCustomerId(customerId)}/campaigns/${campaignId}`,
      negative: true,
      keyword: {
        text:      kw.term,
        matchType: MATCH_TYPE_MAP[kw.matchType] ?? "BROAD",
      },
    },
  }));

  const requestBody = { operations };

  const rollbackPath = `To reverse: Go to Google Ads → Campaign "${pa.campaignName ?? campaignId}" → Keywords → Negative keywords → remove the ${keywords.length} keyword(s) added.`;
  const rollbackPayload = {
    instructions: "Remove each keyword added below from Google Ads Negative Keywords UI",
    keywords: keywords.map(k => k.term),
    campaign: pa.campaignName ?? campaignId,
  };

  if (testMode) {
    return {
      platform: "google_ads",
      actionType: "negative_keyword_add",
      targetObjectIds,
      proposedChange,
      executedChange: { requestBody },
      resultStatus: "test_mode",
      platformResponseSummary: `TEST MODE: Would add ${keywords.length} negative keyword(s) to campaign "${pa.campaignName ?? campaignId}". No API call made.`,
      platformResponseRaw: { testMode: true, requestBody, endpoint: gadsUrl(customerId, "campaignCriteria:mutate") },
      rollbackPath,
      rollbackPayload,
      testMode: true,
    };
  }

  try {
    const accessToken = await fetchGoogleAccessToken();
    const resp = await fetch(gadsUrl(customerId, "campaignCriteria:mutate"), {
      method: "POST",
      headers: gadsHeaders(accessToken),
      body: JSON.stringify(requestBody),
    });
    const json: any = await resp.json();
    const ok = resp.ok && !json.error;

    return {
      platform: "google_ads",
      actionType: "negative_keyword_add",
      targetObjectIds,
      proposedChange,
      executedChange: { requestBody },
      resultStatus: ok ? "success" : "failed",
      platformResponseSummary: ok
        ? `Added ${keywords.length} negative keyword(s) to campaign "${pa.campaignName ?? campaignId}". HTTP ${resp.status}.`
        : `API error ${resp.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 200)}`,
      platformResponseRaw: json,
      rollbackPath,
      rollbackPayload,
      errorMessage: ok ? undefined : (json.error?.message ?? `HTTP ${resp.status}`),
      testMode: false,
    };
  } catch (err: any) {
    return {
      platform: "google_ads",
      actionType: "negative_keyword_add",
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "failed",
      platformResponseSummary: `Execution error: ${err.message}`,
      rollbackPath: "Execution did not reach the API — no changes made.",
      errorMessage: err.message,
      testMode: false,
    };
  }
}

/**
 * Pause or enable a Google Ads ad or ad group.
 */
async function executeGoogleAdsPauseEnable(
  pa: any,
  item: ApprovalItem,
  action: "pause" | "enable",
  testMode: boolean,
): Promise<PlatformExecutionResult> {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
  const adId      = pa.adId as string | undefined;
  const adGroupId = pa.adGroupId as string | undefined;
  const targetType = adId ? "ad" : adGroupId ? "ad_group" : null;
  const targetId   = adId ?? adGroupId;
  const newStatus  = action === "pause" ? "PAUSED" : "ENABLED";
  const actionType = action === "pause"
    ? (targetType === "ad" ? "pause_ad" : "pause_ad_group")
    : (targetType === "ad" ? "enable_ad" : "enable_ad_group");

  const targetObjectIds = { customerId, adId, adGroupId, campaignId: pa.campaignId };
  const proposedChange  = { action, targetType, targetId, newStatus, campaignName: pa.campaignName };

  if (!targetId || !targetType) {
    return {
      platform: "google_ads",
      actionType,
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "missing_ids",
      platformResponseSummary: "adId or adGroupId is required. Add target IDs to the proposedAction.",
      rollbackPath: "No changes made.",
      testMode,
    };
  }

  const resource   = targetType === "ad" ? "ads" : "adGroups";
  const resourceName = targetType === "ad"
    ? `customers/${normCustomerId(customerId)}/ads/${adId}`
    : `customers/${normCustomerId(customerId)}/adGroups/${adGroupId}`;
  const requestBody = {
    operations: [{
      updateMask: "status",
      update: { resourceName, status: newStatus },
    }],
  };

  const rollbackStatus = action === "pause" ? "ENABLED" : "PAUSED";
  const rollbackPath = `To reverse: Go to Google Ads → find the ${targetType} and set status back to ${rollbackStatus}.`;
  const rollbackPayload = {
    endpoint: gadsUrl(customerId, `${resource}:mutate`),
    body: {
      operations: [{
        updateMask: "status",
        update: { resourceName, status: rollbackStatus },
      }],
    },
  };

  if (testMode) {
    return {
      platform: "google_ads",
      actionType,
      targetObjectIds,
      proposedChange,
      executedChange: { requestBody },
      resultStatus: "test_mode",
      platformResponseSummary: `TEST MODE: Would ${action} ${targetType} "${pa.targetName ?? targetId}" (${resourceName}). No API call made.`,
      platformResponseRaw: { testMode: true, requestBody, endpoint: gadsUrl(customerId, `${resource}:mutate`) },
      rollbackPath,
      rollbackPayload,
      testMode: true,
    };
  }

  try {
    const accessToken = await fetchGoogleAccessToken();
    const resp = await fetch(gadsUrl(customerId, `${resource}:mutate`), {
      method: "POST",
      headers: gadsHeaders(accessToken),
      body: JSON.stringify(requestBody),
    });
    const json: any = await resp.json();
    const ok = resp.ok && !json.error;

    return {
      platform: "google_ads",
      actionType,
      targetObjectIds,
      proposedChange,
      executedChange: { requestBody },
      resultStatus: ok ? "success" : "failed",
      platformResponseSummary: ok
        ? `${action === "pause" ? "Paused" : "Enabled"} ${targetType} "${pa.targetName ?? targetId}" (HTTP ${resp.status}).`
        : `API error ${resp.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 200)}`,
      platformResponseRaw: json,
      rollbackPath,
      rollbackPayload,
      errorMessage: ok ? undefined : (json.error?.message ?? `HTTP ${resp.status}`),
      testMode: false,
    };
  } catch (err: any) {
    return {
      platform: "google_ads",
      actionType,
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "failed",
      platformResponseSummary: `Execution error: ${err.message}`,
      rollbackPath: "Execution did not reach the API — no changes made.",
      errorMessage: err.message,
      testMode: false,
    };
  }
}

/**
 * Adjust a Google Ads campaign budget with hard +10% cap.
 */
async function executeGoogleAdsBudgetAdjust(
  pa: any,
  item: ApprovalItem,
  testMode: boolean,
): Promise<PlatformExecutionResult> {
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!;
  const budgetId   = pa.budgetId as string | undefined;
  const currentAmt = parseFloat(pa.currentBudget ?? "0");   // SGD
  const proposedAmt = parseFloat(pa.budgetAmount ?? pa.newBudget ?? "0"); // SGD

  const targetObjectIds = { customerId, budgetId, campaignId: pa.campaignId };
  const proposedChange  = { currentBudget: currentAmt, proposedBudget: proposedAmt, campaignName: pa.campaignName };

  if (!budgetId) {
    return {
      platform: "google_ads",
      actionType: "adjust_budget",
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "missing_ids",
      platformResponseSummary: "budgetId is required to adjust a Google Ads campaign budget.",
      rollbackPath: "No changes made.",
      testMode,
    };
  }

  // Convert SGD to micros (Google Ads uses micro-currency)
  const currentMicros  = Math.round(currentAmt * 1_000_000);
  const proposedMicros = Math.round(proposedAmt * 1_000_000);

  const cap = enforceBudgetCap(currentMicros, proposedMicros);
  const finalMicros   = cap.cappedMicros;
  const finalAmountSGD = (finalMicros / 1_000_000).toFixed(2);
  const capApplied    = !cap.allowed;

  const resourceName = `customers/${normCustomerId(customerId)}/campaignBudgets/${budgetId}`;
  const requestBody  = {
    operations: [{
      updateMask: "amountMicros",
      update: { resourceName, amountMicros: finalMicros.toString() },
    }],
  };

  const rollbackPath = `To reverse: Set campaign budget back to SGD ${currentAmt.toFixed(2)} in Google Ads → Budgets.`;
  const rollbackPayload = {
    endpoint: gadsUrl(customerId, "campaignBudgets:mutate"),
    body: {
      operations: [{
        updateMask: "amountMicros",
        update: { resourceName, amountMicros: currentMicros.toString() },
      }],
    },
  };

  const capNote = capApplied
    ? ` (Capped from SGD ${proposedAmt.toFixed(2)} — +10% max enforcement applied.)`
    : "";

  if (testMode) {
    return {
      platform: "google_ads",
      actionType: "adjust_budget",
      targetObjectIds,
      proposedChange: { ...proposedChange, capApplied, finalAmountSGD, pct: cap.pct.toFixed(1) + "%" },
      executedChange: { requestBody },
      resultStatus: "test_mode",
      platformResponseSummary: `TEST MODE: Would set campaign "${pa.campaignName ?? budgetId}" budget to SGD ${finalAmountSGD} (from SGD ${currentAmt.toFixed(2)})${capNote}. No API call made.`,
      platformResponseRaw: { testMode: true, requestBody, endpoint: gadsUrl(customerId, "campaignBudgets:mutate") },
      rollbackPath,
      rollbackPayload,
      testMode: true,
    };
  }

  try {
    const accessToken = await fetchGoogleAccessToken();
    const resp = await fetch(gadsUrl(customerId, "campaignBudgets:mutate"), {
      method: "POST",
      headers: gadsHeaders(accessToken),
      body: JSON.stringify(requestBody),
    });
    const json: any = await resp.json();
    const ok = resp.ok && !json.error;

    return {
      platform: "google_ads",
      actionType: "adjust_budget",
      targetObjectIds,
      proposedChange: { ...proposedChange, capApplied, finalAmountSGD, pct: cap.pct.toFixed(1) + "%" },
      executedChange: { requestBody, finalMicros, finalAmountSGD, capApplied },
      resultStatus: ok ? "success" : "failed",
      platformResponseSummary: ok
        ? `Budget for "${pa.campaignName ?? budgetId}" set to SGD ${finalAmountSGD}${capNote}. HTTP ${resp.status}.`
        : `API error ${resp.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 200)}`,
      platformResponseRaw: json,
      rollbackPath,
      rollbackPayload,
      errorMessage: ok ? undefined : (json.error?.message ?? `HTTP ${resp.status}`),
      testMode: false,
    };
  } catch (err: any) {
    return {
      platform: "google_ads",
      actionType: "adjust_budget",
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "failed",
      platformResponseSummary: `Execution error: ${err.message}`,
      rollbackPath: "Execution did not reach the API — no changes made.",
      errorMessage: err.message,
      testMode: false,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// META ADS EXECUTION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pause or enable a Meta ad or ad set.
 */
async function executeMetaPauseEnable(
  pa: any,
  item: ApprovalItem,
  action: "pause" | "enable",
  testMode: boolean,
): Promise<PlatformExecutionResult> {
  const adId    = pa.adId as string | undefined;
  const adSetId = pa.adSetId as string | undefined;
  const targetType = adId ? "ad" : adSetId ? "adset" : null;
  const targetId   = adId ?? adSetId;
  const newStatus  = action === "pause" ? "PAUSED" : "ACTIVE";
  const actionType = action === "pause"
    ? (targetType === "ad" ? "pause_ad" : "pause_adset")
    : (targetType === "ad" ? "enable_ad" : "enable_adset");

  const targetObjectIds = { adId, adSetId, campaignId: pa.campaignId };
  const proposedChange  = { action, targetType, targetId, newStatus, campaignName: pa.campaignName };

  if (!targetId || !targetType) {
    return {
      platform: "meta_ads",
      actionType,
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "missing_ids",
      platformResponseSummary: "adId or adSetId is required. Add target IDs to the proposedAction.",
      rollbackPath: "No changes made.",
      testMode,
    };
  }

  const rollbackStatus = action === "pause" ? "ACTIVE" : "PAUSED";
  const rollbackPath = `To reverse: Go to Meta Ads Manager → find the ${targetType} and set status back to ${rollbackStatus}.`;
  const rollbackPayload = {
    endpoint: metaUrl(targetId),
    body: { status: rollbackStatus },
  };

  if (testMode) {
    return {
      platform: "meta_ads",
      actionType,
      targetObjectIds,
      proposedChange,
      executedChange: { status: newStatus, objectId: targetId },
      resultStatus: "test_mode",
      platformResponseSummary: `TEST MODE: Would ${action} ${targetType} "${pa.targetName ?? targetId}" (set status=${newStatus}). No API call made.`,
      platformResponseRaw: { testMode: true, endpoint: metaUrl(targetId), body: { status: newStatus } },
      rollbackPath,
      rollbackPayload,
      testMode: true,
    };
  }

  try {
    const accessToken = process.env.META_ACCESS_TOKEN!;
    const resp = await fetch(metaUrl(targetId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, access_token: accessToken }),
    });
    const json: any = await resp.json();
    const ok = resp.ok && !json.error;

    return {
      platform: "meta_ads",
      actionType,
      targetObjectIds,
      proposedChange,
      executedChange: { status: newStatus, objectId: targetId },
      resultStatus: ok ? "success" : "failed",
      platformResponseSummary: ok
        ? `${action === "pause" ? "Paused" : "Enabled"} ${targetType} "${pa.targetName ?? targetId}" (HTTP ${resp.status}).`
        : `API error ${resp.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 200)}`,
      platformResponseRaw: json,
      rollbackPath,
      rollbackPayload,
      errorMessage: ok ? undefined : (json.error?.message ?? `HTTP ${resp.status}`),
      testMode: false,
    };
  } catch (err: any) {
    return {
      platform: "meta_ads",
      actionType,
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "failed",
      platformResponseSummary: `Execution error: ${err.message}`,
      rollbackPath: "Execution did not reach the API — no changes made.",
      errorMessage: err.message,
      testMode: false,
    };
  }
}

/**
 * Adjust a Meta campaign or ad set budget with hard +10% cap.
 */
async function executeMetaBudgetAdjust(
  pa: any,
  item: ApprovalItem,
  testMode: boolean,
): Promise<PlatformExecutionResult> {
  const campaignId   = pa.campaignId as string | undefined;
  const adSetId      = pa.adSetId as string | undefined;
  const targetId     = campaignId ?? adSetId;
  const targetType   = campaignId ? "campaign" : adSetId ? "adset" : null;
  const budgetField  = pa.budgetType === "lifetime" ? "lifetime_budget" : "daily_budget";

  const currentAmt  = parseFloat(pa.currentBudget ?? "0");
  const proposedAmt = parseFloat(pa.budgetAmount ?? pa.newBudget ?? "0");

  const targetObjectIds = { campaignId, adSetId };
  const proposedChange  = { currentBudget: currentAmt, proposedBudget: proposedAmt, budgetField, campaignName: pa.campaignName };

  if (!targetId || !targetType) {
    return {
      platform: "meta_ads",
      actionType: "adjust_budget",
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "missing_ids",
      platformResponseSummary: "campaignId or adSetId is required for Meta budget adjustment.",
      rollbackPath: "No changes made.",
      testMode,
    };
  }

  // Meta uses cents (USD) or SGD cents depending on account currency; convert SGD → cents
  const currentCents  = Math.round(currentAmt * 100);
  const proposedCents = Math.round(proposedAmt * 100);
  const cap = enforceBudgetCap(currentCents, proposedCents);
  const finalCents    = cap.cappedMicros;
  const finalAmtSGD   = (finalCents / 100).toFixed(2);
  const capApplied    = !cap.allowed;
  const capNote = capApplied ? ` (Capped from SGD ${proposedAmt.toFixed(2)} — +10% max enforcement applied.)` : "";

  const rollbackPath = `To reverse: Set ${targetType} "${pa.campaignName ?? targetId}" budget back to SGD ${currentAmt.toFixed(2)} in Meta Ads Manager.`;
  const rollbackPayload = {
    endpoint: metaUrl(targetId),
    body: { [budgetField]: currentCents.toString() },
  };

  if (testMode) {
    return {
      platform: "meta_ads",
      actionType: "adjust_budget",
      targetObjectIds,
      proposedChange: { ...proposedChange, capApplied, finalAmtSGD, pct: cap.pct.toFixed(1) + "%" },
      executedChange: { [budgetField]: finalCents.toString(), objectId: targetId },
      resultStatus: "test_mode",
      platformResponseSummary: `TEST MODE: Would set ${targetType} "${pa.campaignName ?? targetId}" ${budgetField} to SGD ${finalAmtSGD}${capNote}. No API call made.`,
      platformResponseRaw: { testMode: true, endpoint: metaUrl(targetId), body: { [budgetField]: finalCents.toString() } },
      rollbackPath,
      rollbackPayload,
      testMode: true,
    };
  }

  try {
    const accessToken = process.env.META_ACCESS_TOKEN!;
    const resp = await fetch(metaUrl(targetId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [budgetField]: finalCents.toString(), access_token: accessToken }),
    });
    const json: any = await resp.json();
    const ok = resp.ok && !json.error;

    return {
      platform: "meta_ads",
      actionType: "adjust_budget",
      targetObjectIds,
      proposedChange: { ...proposedChange, capApplied, finalAmtSGD, pct: cap.pct.toFixed(1) + "%" },
      executedChange: { [budgetField]: finalCents.toString(), finalAmtSGD, capApplied },
      resultStatus: ok ? "success" : "failed",
      platformResponseSummary: ok
        ? `Budget for "${pa.campaignName ?? targetId}" set to SGD ${finalAmtSGD}${capNote}. HTTP ${resp.status}.`
        : `API error ${resp.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 200)}`,
      platformResponseRaw: json,
      rollbackPath,
      rollbackPayload,
      errorMessage: ok ? undefined : (json.error?.message ?? `HTTP ${resp.status}`),
      testMode: false,
    };
  } catch (err: any) {
    return {
      platform: "meta_ads",
      actionType: "adjust_budget",
      targetObjectIds,
      proposedChange,
      executedChange: {},
      resultStatus: "failed",
      platformResponseSummary: `Execution error: ${err.message}`,
      rollbackPath: "Execution did not reach the API — no changes made.",
      errorMessage: err.message,
      testMode: false,
    };
  }
}

// ── Export-only result (for creative drafts and unsupported action types) ──────
function buildExportOnlyResult(
  pa: any,
  item: ApprovalItem,
  platform: "google_ads" | "meta_ads",
  testMode: boolean,
): PlatformExecutionResult {
  return {
    platform,
    actionType: "export_only",
    targetObjectIds: { campaignId: pa.campaignId, adId: pa.adId },
    proposedChange: pa,
    executedChange: {},
    resultStatus: "export_only",
    platformResponseSummary: "This action type generates a structured export payload. No direct API mutation is performed — implement the deliverable manually in the platform.",
    rollbackPath: item.rollbackPath ?? "No direct changes made — export only.",
    testMode,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DISPATCH FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * executePlatformAction — determines the correct execution sub-function based on
 * the approval queue item's queueType and proposedAction, then executes.
 *
 * Never throws — all failures are captured in PlatformExecutionResult.
 */
export async function executePlatformAction(
  item: ApprovalItem,
  actor: string,
  testMode: boolean,
): Promise<PlatformExecutionResult> {
  const pa = (item.proposedAction as any) ?? {};
  const platform = (pa.platform as string | undefined)?.toLowerCase() ?? "";
  const isGoogle = platform === "google" || platform === "google_ads";
  const isMeta   = platform === "meta" || platform === "meta_ads";

  // ── Google Ads dispatch ──────────────────────────────────────────────────────
  if (isGoogle || item.queueType === "negative_keyword") {

    // negative_keyword type → always Google Ads negative keyword add
    if (item.queueType === "negative_keyword") {
      const missing = gadsExecCredsCheck();
      if (missing.length > 0 && !testMode) {
        return {
          platform: "google_ads",
          actionType: "negative_keyword_add",
          targetObjectIds: {},
          proposedChange: pa,
          executedChange: {},
          resultStatus: "failed",
          platformResponseSummary: `Missing Google Ads credentials: ${missing.join(", ")}. Set them in Secrets and retry.`,
          rollbackPath: "No changes made — credentials missing.",
          errorMessage: `Missing: ${missing.join(", ")}`,
          testMode,
        };
      }
      return executeGoogleAdsNegativeKeywords(pa, item, testMode);
    }

    const action = (pa.action as string | undefined)?.toLowerCase() ?? "";

    if (action === "pause" && (pa.adId || pa.adGroupId)) {
      const missing = gadsExecCredsCheck();
      if (missing.length > 0 && !testMode) {
        return { platform: "google_ads", actionType: "pause_ad", targetObjectIds: {}, proposedChange: pa, executedChange: {}, resultStatus: "failed", platformResponseSummary: `Missing creds: ${missing.join(", ")}`, rollbackPath: "No changes made.", errorMessage: `Missing: ${missing.join(", ")}`, testMode };
      }
      return executeGoogleAdsPauseEnable(pa, item, "pause", testMode);
    }

    if ((action === "enable" || action === "unpause") && (pa.adId || pa.adGroupId)) {
      const missing = gadsExecCredsCheck();
      if (missing.length > 0 && !testMode) {
        return { platform: "google_ads", actionType: "enable_ad", targetObjectIds: {}, proposedChange: pa, executedChange: {}, resultStatus: "failed", platformResponseSummary: `Missing creds: ${missing.join(", ")}`, rollbackPath: "No changes made.", errorMessage: `Missing: ${missing.join(", ")}`, testMode };
      }
      return executeGoogleAdsPauseEnable(pa, item, "enable", testMode);
    }

    if (action === "adjust_budget" || action === "scale" || action === "cut") {
      // ── PILOT FENCE: budget adjustments are locked to dry-run mode ────────────
      // Even when testMode=false (connector live mode), budget changes generate a
      // full payload but never make a live API call. This prevents uncontrolled
      // ad spend changes during the Phase 8 pilot.
      const fencedBase = await executeGoogleAdsBudgetAdjust(pa, item, true /* always dry-run */);
      if (!testMode) {
        return buildBudgetFencedResult(fencedBase);
      }
      return fencedBase;
    }

    // Everything else → export only (unsupported Google Ads action type)
    return buildExportOnlyResult(pa, item, "google_ads", testMode);
  }

  // ── Meta Ads dispatch ────────────────────────────────────────────────────────
  if (isMeta) {
    const action = (pa.action as string | undefined)?.toLowerCase() ?? "";

    if (action === "pause" && (pa.adId || pa.adSetId)) {
      const missing = metaExecCredsCheck();
      if (missing.length > 0 && !testMode) {
        return { platform: "meta_ads", actionType: "pause_ad", targetObjectIds: {}, proposedChange: pa, executedChange: {}, resultStatus: "failed", platformResponseSummary: `Missing Meta creds: ${missing.join(", ")}`, rollbackPath: "No changes made.", errorMessage: `Missing: ${missing.join(", ")}`, testMode };
      }
      return executeMetaPauseEnable(pa, item, "pause", testMode);
    }

    if ((action === "enable" || action === "unpause") && (pa.adId || pa.adSetId)) {
      const missing = metaExecCredsCheck();
      if (missing.length > 0 && !testMode) {
        return { platform: "meta_ads", actionType: "enable_ad", targetObjectIds: {}, proposedChange: pa, executedChange: {}, resultStatus: "failed", platformResponseSummary: `Missing Meta creds: ${missing.join(", ")}`, rollbackPath: "No changes made.", errorMessage: `Missing: ${missing.join(", ")}`, testMode };
      }
      return executeMetaPauseEnable(pa, item, "enable", testMode);
    }

    if (action === "adjust_budget" || action === "scale" || action === "cut") {
      // ── PILOT FENCE: budget adjustments are locked to dry-run mode ────────────
      const fencedBase = await executeMetaBudgetAdjust(pa, item, true /* always dry-run */);
      if (!testMode) {
        return buildBudgetFencedResult(fencedBase);
      }
      return fencedBase;
    }

    // Everything else → export only (unsupported Meta action type)
    return buildExportOnlyResult(pa, item, "meta_ads", testMode);
  }

  // ── Unknown platform → export only ──────────────────────────────────────────
  return buildExportOnlyResult(pa, item, "google_ads", testMode);
}
