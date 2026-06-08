---
name: Overtime / scheduled-time policy surfaces
description: Every place the relocation overtime + scheduled-crew-time policy is worded or computed; change them in lockstep.
---

# Overtime / scheduled-time policy is duplicated across many surfaces

The relocation "scheduled crew time + overtime" rule is expressed (wording AND/OR
math) in many independent places. A policy change (rate, cap, allowance basis) must
be applied to ALL of them together, or customer-facing copy will contradict the
actual charge.

Wording surfaces: `shared/terms.ts`, `server/email.ts` (pre-payment notice +
auto-applied-charge notice), customer `Estimate.tsx` (carry-only notice, review-step
notice, and the Scope-of-Work terms list), `Landing.tsx` (relocation pricing card +
footer line), `shared/schema.ts` relocationMode comment.

Math surfaces: `getJobSchedule()` / `calcOvertimeCharge()` in `shared/pricing.ts`,
`QuoteScheduleNote.tsx`, admin `QuoteDetail.tsx` overtime calculator, and server
`applyRelocationOvertime()`.

**Why:** allowance is derived from JOB SCOPE (estimateCrewHours → scheduledMinutes),
NOT from dividing the total price, and overtime = crewSize × overtime rate in 30-min
blocks with NO cap (the old $200 maxCharge / flat 120-min allowance is retired).

**Rate config:** overtime and second-day each have their OWN per-mover-hour field
(`PricingConfig.overtime.perPersonHourlyRate` and
`PricingConfig.secondDay.perPersonHourlyRate`) — keep them as SEPARATE tunable fields
even when the values match. As of the latest decision BOTH are $50 (overtime $50, Day-2
continuation $50); the cost-floor `loadedMoverHourlyCost` ($30) is a different COST
basis, do not conflate. `calcOvertimeCharge` and `getJobSchedule` read the overtime
field; `terms.ts` overtime body must use `ot`, the second-day body uses `sd`. Hardcoded
"$N/mover/hr" copy in Estimate.tsx + Landing.tsx must be updated by hand when the rate
changes (not interpolated); terms.ts / email.ts / QuoteDetail read the rates from config.

**How to apply:**
- Customer-shown scheduled hours must use the SAME `getJobSchedule` inputs the server
  charges against: per-item `volumeM3` + `carryOnly` and top-level `distanceKm`. The
  invoice payload (`buildInvoicePayload` in `server/routes.ts`) must carry those item
  fields + distanceKm, or the invoice's scheduled-hours note diverges from the charge.
- Shared `terms.ts` clauses are NOT job-specific: never hardcode crew size (e.g.
  `defaultCrewSize`-person crew) or other per-job numbers there — it will contradict the
  job-specific `QuoteScheduleNote`. Keep the actual movers×hours=man-hours figure in
  QuoteScheduleNote (web) + invoicePdf (PDF) only, in lockstep. Relocation-only phrases
  in otherwise-shared clauses (e.g. "included on-site time" in the Payment clause) must be
  gated on `isRelocation`, or non-relocation quotes reference a block that isn't shown.
- Overtime applies to Carry-Only relocation only; D&R is per-item and skips overtime.
  Gate on the authoritative `relocationMode` ('full'=skip, 'carry'=charge); the legacy
  per-item fallback must key off `carryOnly===false` (or carryOnly null AND unitPrice>0)
  — never plain `unitPrice>0`, because carry-only special-handling items can have a
  positive unit price. Keep this gating in lockstep with `isCarryOnlyRelocation` in
  `server/email.ts`.
- The admin PRINTED quotation/job-order (`handlePrintQuote` in admin `QuoteDetail.tsx`)
  now renders `getQuoteTerms()` + a `getJobSchedule`-driven "Included on-site time" box
  (gated `!isInvoiceDoc && hasRelocation`) instead of a hardcoded T&C list — so it can no
  longer drift from the web. BUT the TAX-INVOICE branch in the same function still has its
  OWN hardcoded invoice-specific terms (Net 30, late-payment, defect-claim, drilling) — it
  is intentionally separate and was NOT migrated.
- The standalone `/terms` page (`client/src/pages/customer/Terms.tsx`) is a THIRD
  policy surface alongside the per-quote block (`shared/terms.ts`) and the schedule note.
  It reads engine numbers from `PricingConfig` + `QuoteTermsPolicy` (don't re-hardcode
  rates/threshold/deposit/floor/validity), but the carry-only overtime caveat and the
  cancellation-boundary wording are plain prose that must stay worded the SAME as
  `shared/terms.ts` (e.g. "included time/overtime apply to carry moves; D&R per item",
  and ">48h = refund less $30 / 48h-or-less = forfeit"). `QuoteTermsPolicy.cancelForfeitHours`
  and `freeRescheduleHours` are TEXT-ONLY (no logic reads them); both are 48.
