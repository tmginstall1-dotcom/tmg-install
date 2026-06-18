---
name: Quote/invoice financial display surfaces
description: Every place a quote/invoice money breakdown (Transport, fees, line items) is independently re-rendered — change them all together when adding a charge line.
---

The quote/invoice financial summary is rendered by ~9 INDEPENDENT surfaces, each with
its own near-duplicate markup. Adding a new charge line (or splitting an existing one)
must touch every one of them or the breakdown silently drifts per surface.

Surfaces (group them when editing):
- Customer quote status — light AND dark blocks (two copies in one file)
- Admin quote detail — three copies: on-screen view, edit-mode preview, and the
  printable HTML/PDF template string
- ExportPDF — two copies: screen `FinLine` and print `PFinRow`
- Email — the shared `totals()` helper PLUS a second inline `totRow` block; `totals()`
  has 4 call sites that all pass the same positional arg list
- Invoice page (web) AND the jsPDF invoice builder — **easy to miss**, separate from
  the admin "quote detail" PDF and from ExportPDF

**Why:** the volumetric-handling line was first added to the obvious quote surfaces but
the two Invoice surfaces (web + jsPDF) were missed and only caught in code review.

**How to apply:** when a saved money breakdown must show a new line "everywhere",
treat Invoice.tsx + invoicePdf.ts as their own separate surface and check the email
`totals()` call-site arg count. Keep totals total-preserving: store the full value in
the existing column and only SPLIT the display (subtract the new portion from the parent
line) so grand totals never change and legacy rows render unchanged.

## Invoice installment breakdown (deposit + interim ledger + closing balance)
The invoice "final balance" line must be NET of any interim partial payments in the
quote_payments ledger, or installments double-count against a gross balance and the
lines stop summing to the grand total. Pass ledgerPaidTotal as the 4th arg to
`finalBalanceOutstanding(total, finalAmount, depositAmount, ledgerPaidTotal)` in
buildInvoicePayload. Render ledger payments BETWEEN the deposit and final-balance lines
on both Invoice.tsx and invoicePdf.ts.
**Why:** a fully-paid 3-installment job showed only a lumped deposit + gross final
balance; customer wanted each installment visible and adding up.
**How to apply:** `getQuotePayments` returns rows DESC by paidAt, so sort the payload
`payments` ascending before display or the breakdown reads newest-first. getQuote already
eager-loads `quote.payments`, but buildInvoicePayload also fetches defensively.
