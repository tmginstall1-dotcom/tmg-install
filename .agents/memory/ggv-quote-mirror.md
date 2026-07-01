---
name: GGV job → mirrored operational job
description: How GoGoVan jobs become real dashboard/staff/GPS jobs, and the rules that keep money and deletes consistent.
---

# GGV job ↔ mirrored quote

Each GoGoVan (GGV) job in the GGV tab is bridged to a normal `quotes` row so it
reuses ALL existing job machinery — dashboard buckets, admin Assign, staff app
(photos/status), admin review, and GPS day-jobs. Link is `ggv_jobs.quoteId` FK.

## Rules (keep in lockstep)
- The mirrored quote is `status:'booked'`, `sourceChannel:'gogovan'`, and
  **total/subtotal = "0"**. GGV financials (listed/deduction/actual) live ONLY on
  `ggv_jobs`. **Why:** keep the GGV money off P&L/revenue so it's never
  double-counted; revenue reports already count quote totals.
- All GGV jobs reuse ONE synthetic shared customer (fixed email
  `gogovan-jobs@tmginstall.local`, name "GoGoVan Job"). **Why:** avoid one
  throwaway contact per delivery polluting the customer directory; the real
  location rides on the quote's serviceAddress.
- Schedule pins the GGV date + start time to SGT (UTC+8) so it buckets onto the
  right working day for GPS tracking.

## Where it's wired
- POST GGV → create job, then best-effort `createQuoteFromGGV` + set quoteId.
- PATCH GGV → `syncQuoteFromGGV` (address/schedule only; never touches assignment
  or status) and **backfills** a link for pre-feature rows on first edit.
- Delete (single + bulk) → delete the GGV row FIRST (it holds the FK), THEN the
  quote. **Why:** the FK has ON DELETE no action, so deleting the quote while the
  GGV row still points at it throws (FK violation → 500).

## Displaying GGV code + price (revenue-safe)
- Staff/admin see the GGV **code as the job name** and the **GGV price** even
  though `quote.total` stays $0. Done via a DISPLAY-ONLY `ggv` object on
  `QuoteResponse` (jobNo, bookingRef, actualPrice, listedPrice, deduction,
  serviceType), attached in BOTH `fetchQuoteDetails` (single) and
  `fetchQuoteDetailsBatch` (list) by reading the linked `ggv_jobs` row for
  `sourceChannel==='gogovan'`. **Why:** never put the price on the quote total /
  items or revenue double-counts.
- Name surfaces use `quote.ggv?.jobNo || quote.customer?.name` (admin dashboard
  row + QuoteDetail header, staff dashboard card + JobDetail header).
- Price surfaces: a "GoGoVan Job Value" block on admin QuoteDetail + staff
  JobDetail, AND the admin dashboard **amount column** must use
  `quote.ggv ? quote.ggv.actualPrice : quote.total` (easy to miss — it otherwise
  shows $0). "Total Due" on QuoteDetail stays $0 by design (nothing to collect;
  GoGoVan pays).
- `stripQuotePricingForStaff` nulls known money fields but does NOT touch `ggv`,
  so staff intentionally still see the GGV price. Keep `ggv` out of its
  MONEY_FIELDS list.

## Deliberate non-changes
- Mirror-link creation is **best-effort** (errors logged, not fatal). **Why:** a
  GGV financial row must never fail to save over a mirror hiccup; PATCH backfills
  any missing link.
- `deleteQuote` was hardened to clear `job_checklists` + `quote_dispute_events`
  (tables a worked GGV job can accumulate) but deliberately NOT `quote_payments`
  / `job_subcontracts`. **Why:** broadening the shared deleteQuote would silently
  delete financial records on normal-quote deletion; $0 GGV quotes never have
  payments/subcontracts so they never hit those FKs.
