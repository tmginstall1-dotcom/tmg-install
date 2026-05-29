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

**Easy-to-miss display site:** `server/email.ts` also has separate informational `notice()` blocks (NOT the `totals()` rows) that hardcode the rate wording in prose (e.g. the Second-Day Continuation explanation in `finalPaymentEmail`). When a fee's rate/structure changes (e.g. flat $/hr → crew × per-person), update these prose notices too or they'll show stale legacy wording while the billed amount is correct. Prefer deriving the wording from the same `calc*()` helper return (crewSize, perPersonHourlyRate, hours) instead of reading raw `PricingConfig` constants.

**Crew/quantity multiplier add-on:** to make a per-job fee scale by a count (e.g. crew size), add an admin-editable int column (default to the standard value so old rows are unchanged), make the calc helper take an optional param that falls back to that default, and have the helper expose both the per-unit rate and the effective rate so every display can render "N × rate". Back-compat is automatic because the default reproduces the old single-value math.
