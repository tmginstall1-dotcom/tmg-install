// =============================================================================
// TMG Install — Business Rules (single source of truth)
// =============================================================================
// Every customer-facing policy value — deposit %, after-office surcharge,
// cancellation window, refund timing, drilling rate, disclaimers — lives here as
// a typed object with sensible defaults. Admins can override any value at runtime
// (stored in the app_settings key-value table under "br.<key>"). Every other
// surface (customer quote page, quotation PDF, invoice, confirmation emails,
// admin quote form, quick-reply templates) reads from this module so the wording
// and numbers can never drift apart.
//
// Defaults are chosen so existing behaviour is unchanged if no overrides exist.
// Numeric values that the pricing engine already owns (deposit %, full-payment
// threshold) default from PricingConfig to stay in lockstep.
// =============================================================================

import { PricingConfig } from "./pricing";

export interface BusinessRules {
  // ── Payment / deposit ──────────────────────────────────────────────
  depositPct: number;                 // 0.50 = 50% deposit
  fullPaymentThreshold: number;       // jobs under this are paid in full upfront
  depositRefundableDefault: boolean;  // are deposits refundable by default? (no)

  // ── Cancellation & refund ──────────────────────────────────────────
  cancellationWindowHours: number;    // notice required to avoid forfeiting deposit
  cancellationAdminFee: number;       // admin fee deducted on an in-window cancellation
  rescheduleFee: number;              // fee for short-notice / extra reschedules
  refundProcessingDays: number;       // business days to process an approved refund

  // ── Working hours / after-office ───────────────────────────────────
  workingHoursStart: string;          // "09:00"
  workingHoursEnd: string;            // "17:30" — standard end of working day
  afterOfficeCutoff: string;          // "17:30" — work past this is after-office
  afterOfficeSurchargePct: number;    // 30 = +30% surcharge for after-office work

  // ── Scope / extra charges ──────────────────────────────────────────
  additionalTripCharge: number;       // flat charge per extra trip / manpower run
  drillingPerHoleRate: number;        // $ per drilled hole

  // ── Disclaimers / policy text ──────────────────────────────────────
  splitJobRuleText: string;           // one-continuous-slot vs split-timing rule
  ownMoverDisclaimer: string;         // when the customer provides their own mover
  siteConditionDisclaimer: string;    // site access / condition disclaimer
  noDebrisDisposalText: string;       // debris / old-furniture disposal not included
}

export const BusinessRulesDefaults: BusinessRules = {
  depositPct: PricingConfig.deposit.pct,
  fullPaymentThreshold: PricingConfig.deposit.fullPaymentThreshold,
  depositRefundableDefault: false,

  cancellationWindowHours: 48,
  cancellationAdminFee: 30,
  rescheduleFee: 30,
  refundProcessingDays: 1,

  workingHoursStart: "09:00",
  workingHoursEnd: "17:30",
  afterOfficeCutoff: "17:30",
  afterOfficeSurchargePct: 30,

  additionalTripCharge: 80,
  drillingPerHoleRate: 5,

  splitJobRuleText:
    "Each booking covers ONE continuous on-site time slot. If you ask us to split the job into separate visits (for example, dismantling in the morning and reinstalling in the evening), that counts as two trips and an additional trip / manpower charge applies. Please confirm any split timing in writing before the job.",
  ownMoverDisclaimer:
    "If you arrange your own mover or transport for any part of the job, we are responsible only for the work we carry out (e.g. dismantling or reinstalling). We are not liable for items handled, carried, or transported by anyone who is not our crew.",
  siteConditionDisclaimer:
    "Pricing assumes safe, clear access to the work area and that items and the site are ready when our crew arrives. If actual conditions differ (no lift, extra floors, long carry, restricted parking, items not ready), additional charges may apply and will be communicated before extra work proceeds.",
  noDebrisDisposalText:
    "Removal or disposal of debris, packaging, or old/dismantled furniture is NOT included unless a disposal service is specifically quoted and paid for.",
};

// Keys stored in app_settings are prefixed so they never collide with other
// settings (google_review_url, testimonials, app_latest_version, etc.).
export const BUSINESS_RULES_PREFIX = "br.";

type FieldType = "number" | "percent" | "money" | "boolean" | "time" | "text" | "textarea";

export interface BusinessRuleField {
  key: keyof BusinessRules;
  label: string;
  type: FieldType;
  group: string;
  help?: string;
}

// Drives the admin edit screen. Order = display order.
export const BusinessRuleFields: BusinessRuleField[] = [
  { key: "depositPct", label: "Deposit %", type: "percent", group: "Payment", help: "Portion of the total taken to confirm a booking (larger jobs)." },
  { key: "fullPaymentThreshold", label: "Full-payment threshold (S$)", type: "money", group: "Payment", help: "Jobs under this amount must be paid in full to confirm." },
  { key: "depositRefundableDefault", label: "Deposits refundable by default", type: "boolean", group: "Payment", help: "Usually OFF — deposits are non-refundable once a slot is reserved." },

  { key: "cancellationWindowHours", label: "Cancellation notice (hours)", type: "number", group: "Cancellation & Refund", help: "Cancel with more than this notice to avoid forfeiting the deposit." },
  { key: "cancellationAdminFee", label: "Cancellation admin fee (S$)", type: "money", group: "Cancellation & Refund" },
  { key: "rescheduleFee", label: "Reschedule fee (S$)", type: "money", group: "Cancellation & Refund", help: "Charged for short-notice or additional reschedules." },
  { key: "refundProcessingDays", label: "Refund processing (business days)", type: "number", group: "Cancellation & Refund", help: "How long an approved refund takes once details are received." },

  { key: "workingHoursStart", label: "Working hours start", type: "time", group: "Working Hours" },
  { key: "workingHoursEnd", label: "Working hours end", type: "time", group: "Working Hours" },
  { key: "afterOfficeCutoff", label: "After-office cutoff", type: "time", group: "Working Hours", help: "Work continuing past this time is treated as after-office." },
  { key: "afterOfficeSurchargePct", label: "After-office surcharge %", type: "number", group: "Working Hours", help: "Extra percentage added for after-office work." },

  { key: "additionalTripCharge", label: "Additional trip / manpower (S$)", type: "money", group: "Extra Charges", help: "Flat charge for an extra visit (e.g. split timing)." },
  { key: "drillingPerHoleRate", label: "Drilling per hole (S$)", type: "money", group: "Extra Charges" },

  { key: "splitJobRuleText", label: "Split-timing rule", type: "textarea", group: "Disclaimers" },
  { key: "ownMoverDisclaimer", label: "Own-mover disclaimer", type: "textarea", group: "Disclaimers" },
  { key: "siteConditionDisclaimer", label: "Site-condition disclaimer", type: "textarea", group: "Disclaimers" },
  { key: "noDebrisDisposalText", label: "No debris disposal rule", type: "textarea", group: "Disclaimers" },
];

const NUMBER_KEYS: Array<keyof BusinessRules> = [
  "depositPct", "fullPaymentThreshold", "cancellationWindowHours", "cancellationAdminFee",
  "rescheduleFee", "refundProcessingDays", "afterOfficeSurchargePct", "additionalTripCharge",
  "drillingPerHoleRate",
];
const BOOLEAN_KEYS: Array<keyof BusinessRules> = ["depositRefundableDefault"];

/**
 * Merge stored overrides (from app_settings, keyed "br.<field>") over the
 * defaults, coercing each value to the right type. Accepts either an array of
 * {key,value} rows or a flat record.
 */
export function parseBusinessRules(
  stored: Array<{ key: string; value: string }> | Record<string, string> | null | undefined
): BusinessRules {
  const map: Record<string, string> = {};
  if (Array.isArray(stored)) {
    for (const row of stored) map[row.key] = row.value;
  } else if (stored && typeof stored === "object") {
    Object.assign(map, stored);
  }

  const out: BusinessRules = { ...BusinessRulesDefaults };
  for (const field of BusinessRuleFields) {
    const k = field.key;
    const raw = map[BUSINESS_RULES_PREFIX + k];
    if (raw === undefined || raw === null || raw === "") continue;
    if (NUMBER_KEYS.includes(k)) {
      const n = Number(raw);
      if (Number.isFinite(n)) (out[k] as number) = n;
    } else if (BOOLEAN_KEYS.includes(k)) {
      (out[k] as boolean) = raw === "true" || raw === "1";
    } else {
      (out[k] as string) = String(raw);
    }
  }
  return out;
}

/** Convert a (partial) BusinessRules object into prefixed key/value strings for app_settings. */
export function serializeBusinessRules(partial: Partial<BusinessRules>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of BusinessRuleFields) {
    const k = field.key;
    if (!(k in partial)) continue;
    const v = partial[k];
    if (v === undefined || v === null) continue;
    out[BUSINESS_RULES_PREFIX + k] = String(v);
  }
  return out;
}

// ── Derived helpers ────────────────────────────────────────────────────────

function money(n: number): string {
  return `$${Number(n).toFixed(Number.isInteger(n) ? 0 : 2)}`;
}

/** After-office surcharge amount for a given base total (rounded to cents). */
export function afterOfficeSurchargeAmount(rules: BusinessRules, baseTotal: number): number {
  const base = Number(baseTotal) || 0;
  return Math.round(base * (rules.afterOfficeSurchargePct / 100) * 100) / 100;
}

export interface PolicyClause {
  title: string;
  body: string;
}

/**
 * The dispute-protection policy clauses, with all numbers/text injected from the
 * (possibly admin-overridden) business rules. Shared by the customer quote page,
 * the quotation PDF, the invoice, and the confirmation emails so every surface
 * shows identical wording.
 */
export function getBusinessPolicyClauses(rules: BusinessRules): PolicyClause[] {
  const depPct = Math.round(rules.depositPct * 100);
  return [
    {
      title: "Scope & timing changes",
      body: `Your price covers the scope and the single continuous on-site time slot shown on this quote. Any change to the scope, items, access, or timing after acceptance may change the price, and any extra work will be confirmed with you before it proceeds.`,
    },
    {
      title: "One continuous slot vs split timing",
      body: rules.splitJobRuleText,
    },
    {
      title: "After-office work",
      body: `Standard working hours are ${rules.workingHoursStart}–${rules.workingHoursEnd}. Work that continues past ${rules.afterOfficeCutoff} is treated as after-office and carries a ${rules.afterOfficeSurchargePct}% surcharge. Where after-office work is expected, the surcharge is shown on your quote; if it is waived this is confirmed in writing.`,
    },
    {
      title: "Deposit & acceptance",
      body: `A ${depPct}% deposit confirms the booking (jobs under ${money(rules.fullPaymentThreshold)} are payable in full), with the balance due on completion. Paying the deposit confirms that you accept this quote, its scope and timing, and these terms. Deposits are ${rules.depositRefundableDefault ? "refundable subject to the cancellation policy below" : "non-refundable once your slot is reserved, except as set out in the cancellation policy below"}.`,
    },
    {
      title: "Cancellation",
      body: `Cancellations made more than ${rules.cancellationWindowHours} hours before the appointment are refunded less a ${money(rules.cancellationAdminFee)} admin fee. Cancellations ${rules.cancellationWindowHours} hours or less before the appointment, no-shows, or failure to provide access forfeit the deposit.`,
    },
    {
      title: "Refund timing",
      body: `Where a refund is approved, it is processed within ${rules.refundProcessingDays} business day${rules.refundProcessingDays === 1 ? "" : "s"} of us receiving your refund details, to the original payment method.`,
    },
    {
      title: "Disposal",
      body: rules.noDebrisDisposalText,
    },
    {
      title: "Site conditions",
      body: rules.siteConditionDisclaimer,
    },
    {
      title: "Own mover / transport",
      body: rules.ownMoverDisclaimer,
    },
  ];
}

/** Plain-text version for emails / WhatsApp / PDF fallbacks. */
export function getBusinessPolicyText(rules: BusinessRules): string {
  return getBusinessPolicyClauses(rules)
    .map((c, i) => `${i + 1}. ${c.title}: ${c.body}`)
    .join("\n");
}

// ── Terms-acceptance gate ───────────────────────────────────────────────────
// A quote's terms count as accepted only when the recorded acceptance matches
// the CURRENT quote version. Bumping the version (admin scope/price change)
// clears acceptance, forcing the customer to re-accept the new terms before
// paying. Shared by the server payment gate and the customer quote page so both
// agree on what "accepted" means.
export function termsAcceptedForCurrentVersion(quote: {
  version?: number | null;
  termsAcceptedAt?: Date | string | null;
  termsAcceptedVersion?: number | null;
}): boolean {
  if (!quote?.termsAcceptedAt) return false;
  const currentVersion = quote.version ?? 1;
  const acceptedVersion = quote.termsAcceptedVersion ?? 0;
  return acceptedVersion >= currentVersion;
}
