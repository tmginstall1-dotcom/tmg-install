---
name: Final/balance amount is computed in many duplicated spots
description: The customer-facing outstanding balance is recomputed inline in several routes + the email template, not centralized — change them all together.
---

The outstanding "balance / final payment" amount is NOT centralized. The same
formula — `baseBalance = quote.finalAmount>0 ? finalAmount : max(0, total-deposit)`
then `Math.max(0, baseBalance - ledgerPaid)` — is duplicated across every
customer-facing final-payment surface in `server/routes.ts`:

- `/pay/:ref?type=final` short-link Stripe redirect
- `/api/quotes/:id/checkout?type=final` on-demand Stripe checkout
- `request-final-payment` route (Stripe link + WhatsApp + email)
- `send-whatsapp-payment` final branch
- `buildPaymentMessageForQuote` (copy/send-manually snippet)
- `collect-final-payment` (records the remaining amount)
- `buildInvoicePayload` (invoice PDF / Invoice.tsx — uses payments[] directly)
- `finalPaymentEmail` in `server/email.ts` (takes `opts.balanceDue` / `paymentsReceived`)

**Why:** there is no single `getOutstandingBalance(quote)` helper, so a balance
rule change silently misses surfaces. A previous bug: recorded ledger payments
(`quote_payments`) reduced the balance on the admin QuoteDetail card but NOT on
the PDF, payment messages, or Stripe link, because each recomputed from the
static `finalAmount`.

**How to apply:** when changing balance/settlement math, update ALL spots above.
Subtract `storage.getLedgerPaidTotal(quoteId)` from the base balance, never the
deposit baseline (that lives in `recomputeQuotePaymentState` which uses
`depositBaseline + ledgerSum` for paid-in-full detection — subtracting deposit in
both places would double-count). Email templates are sync and can't read storage,
so pass the computed balance in via an options arg.
