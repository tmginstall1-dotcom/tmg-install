---
name: Final/balance amount is computed in many duplicated spots
description: The customer-facing outstanding balance is recomputed inline in several routes + the email template, not centralized — change them all together.
---

Settlement math (deposit split, deposit baseline, outstanding final balance) is
now CENTRALIZED in `shared/pricing.ts` as siblings of `reconcileQuoteTotal`:
`splitDepositFinal`, `depositPaidFallback`, `finalBalanceOutstanding`, and
`isFullPaymentQuote`. `server/routes.ts` and `server/email.ts` import these — do
NOT re-add local copies. The canonical final-balance rule is
`baseBalance = storedFinal>0 ? storedFinal : max(0, total-deposit)` then
`max(0, baseBalance - ledgerPaid)`, with under-threshold jobs forced to 0.

Surfaces that consume these helpers (keep using the shared fns, not inline math):
- `/pay/:ref?type=final` short-link Stripe redirect
- `/api/quotes/:id/checkout?type=final` on-demand Stripe checkout
- `request-final-payment` route (Stripe link + WhatsApp + email)
- `send-whatsapp-payment` final branch
- `buildPaymentMessageForQuote` (copy/send-manually snippet)
- `collect-final-payment` (records the remaining amount)
- `finalPaymentEmail` in `server/email.ts` (takes `opts.balanceDue` / `paymentsReceived`)

**Deliberately NOT routed through the shared final-balance helper (different
concept — leave as-is):**
- `buildInvoicePayload` `amountPaid`/`balanceDue` — a WHOLE-INVOICE running tally
  from the `payments[]` array + actual deposit, not the final-only outstanding.
- `collect-final-payment` WA receipt "Balance paid" line — a receipt row that must
  sum `deposit + balance = total` (`total − depositPaidFallback`), not an
  outstanding balance.

**Why:** previously every surface recomputed inline, so a balance rule change
silently missed surfaces (e.g. ledger payments reduced the admin card but not the
PDF/Stripe link). Email templates are sync and can't read storage, so routes still
pass the computed balance in via an options arg.

**How to apply:** change the rule once in `shared/pricing.ts`. Subtract
`storage.getLedgerPaidTotal(quoteId)` from the base balance, never the deposit
baseline (that lives in `recomputeQuotePaymentState` which uses
`depositBaseline + ledgerSum` — subtracting deposit in both places double-counts).
