---
name: Reopen a paid job when an add-on raises the total
description: How to make an extra charge billable on a job already marked paid-in-full (add-on collected during installation).
---

# Reopening the balance on an already-paid job

When an admin raises a job's total after it was marked fully paid (e.g. customer
adds an item during installation), the extra must become collectible. The rule:

`editQuote` (server/storage.ts), inside the `pricingTouched` recompute, detects
`current.finalPaidAt && newTotal > oldTotal` and calls
`recomputeQuotePaymentState(id)` — which clears `finalPaidAt` and drops
`paymentStatus` from `paid_in_full` back to `deposit_paid` so every balance
surface (client QuoteDetail, invoice route, email, PayNow/Stripe collect) treats
the job as having an outstanding balance again.

**Why the ledger baseline seed is required first:** "paid so far" is computed as
`depositBaseline + sum(quote_payments ledger)`. The legacy final-payment flow
only stamps `finalPaidAt`; it never writes a ledger row. So for a 50/50 job the
already-collected final ($200 of a $400 job) is invisible to the ledger. If you
just clear `finalPaidAt`, the balance jumps to `newTotal - deposit` and the
customer gets re-billed for the final they already paid. Fix: before calling
recompute, insert one `quote_payments` row for the gap
`oldTotal - (depositBaseline + existingLedger)` (method `'reconciled'`). For a
small full-upfront job the deposit already == old total, so gap = 0 and no row is
added. Result in both cases: balance owing = exactly the newly-added amount.

**Why:** the balance math trusts `finalPaidAt ? total : deposit+ledger`; a set
`finalPaidAt` short-circuits paidSoFar to the (new) total and hides any increase.

**How to apply:** any future "charge more after full payment" path (add-on,
surcharge, second-day) must flow through editQuote's recompute, or replicate the
seed-ledger-then-recompute sequence. Never clear `finalPaidAt` without first
reconciling the previously-collected amount into the ledger.
