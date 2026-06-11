---
name: Analytics revenue reconciliation
description: How any new sales/revenue admin report must reconcile with the existing P&L tab
---

Any new admin analytics surface that reports "sales"/"revenue" must mirror the
`/api/admin/analytics/pnl` endpoint exactly so its totals reconcile with the P&L tab:

- **Booking (TMG) revenue** = `quote.total` for statuses in
  `["completed","final_payment_requested","final_paid","closed"]`, dated by
  `scheduledAt || createdAt`.
- **GoGoVan revenue** = `actualPrice` + `$23.80` delivery fee when `jobNo` starts
  with "S" (case-insensitive), dated by `ggvJobs.date` (text "YYYY-MM-DD").
- **Date bucketing** = plain local-time `getFullYear()/getMonth()/getDate()`
  (and `new Date(rawString)` for GGV text dates), NOT an SGT/UTC+8 shift.

**Why:** P&L uses local-time bucketing. The first cut of the Daily Sales report used
an SGT(+8) shift for "correctness", but that made month totals diverge from P&L at
day/month boundaries — code review flagged it as failing the reconcile-with-P&L goal.
Consistency with the established P&L numbers the admin already trusts beats a
marginally-more-correct timezone.

**How to apply:** When adding a revenue/sales report, copy the `/pnl` definitions and
bucketing verbatim. If the timezone basis is ever fixed, change `/pnl` and every
revenue surface together, never just one.
