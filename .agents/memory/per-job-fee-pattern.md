---
name: Per-job fee pattern
description: Canonical way to add a new per-job charge so it flows everywhere automatically
---

To add a new admin-controlled per-job charge/discount to a quote (e.g. transport fee, goodwill discount, second-day continuation), fold it into the `editQuote` total recompute in `server/storage.ts`:

1. Add the column(s) to `shared/schema.ts` quotes table.
2. Add the field(s) to the edit zod in `server/routes.ts` and to `pricingTouched`.
3. Include the computed amount in the `total = subtotal - promo - goodwill + transport + <newFee>` line. The existing deposit-protection logic (preserve paid deposit, shift the delta onto `finalAmount`) then handles balance/deposit automatically.

**Why:** `total`/`depositAmount`/`finalAmount` are the single source the Stripe amount sites, PayNow QR, and final-payment email all read. Folding the fee into the recompute means you do NOT touch the 3 Stripe amount call sites or duplicate the math in email — and you avoid double-counting. Keep customer email mentions of such fees as informational notices only (no extra charge line).

**Breakdown reconciliation (display-only):** after folding a fee into `total`, the amount is correct but the itemized breakdowns won't visually sum unless you ALSO add a display row. These surfaces each render their own totals block and need a conditional row (never re-add the fee to the total — display only): `server/email.ts` `totals()` (+ all call sites) and `finalPaymentEmail` breakdown; `buildInvoicePayload` in `server/routes.ts` (emit the fee field for the public invoice); `client/src/pages/Invoice.tsx`; `client/src/lib/invoicePdf.ts`; and in `QuoteDetail.tsx` the printable-invoice HTML + the live edit-preview (`editTotal` must include the fee so the preview matches the saved total).
