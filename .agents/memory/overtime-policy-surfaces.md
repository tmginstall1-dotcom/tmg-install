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

**Rate config:** the overtime per-mover-hour rate has its OWN field
`PricingConfig.overtime.perPersonHourlyRate` (currently $50) — it is DECOUPLED from
`PricingConfig.secondDay.perPersonHourlyRate` (currently $30, used only for Day-2
continuation). They were briefly the same value; never re-couple them. `calcOvertimeCharge`
and `getJobSchedule` read the overtime field; `terms.ts` overtime body must use `ot`,
not `sd`. Hardcoded "$N/mover/hr" copy in Estimate.tsx + Landing.tsx must be updated by
hand when the rate changes (they are not interpolated from config).

**How to apply:**
- Customer-shown scheduled hours must use the SAME `getJobSchedule` inputs the server
  charges against: per-item `volumeM3` + `carryOnly` and top-level `distanceKm`. The
  invoice payload (`buildInvoicePayload` in `server/routes.ts`) must carry those item
  fields + distanceKm, or the invoice's scheduled-hours note diverges from the charge.
- Overtime applies to Carry-Only relocation only; D&R is per-item and skips overtime.
  Gate on the authoritative `relocationMode` ('full'=skip, 'carry'=charge); the legacy
  per-item fallback must key off `carryOnly===false` (or carryOnly null AND unitPrice>0)
  — never plain `unitPrice>0`, because carry-only special-handling items can have a
  positive unit price. Keep this gating in lockstep with `isCarryOnlyRelocation` in
  `server/email.ts`.
