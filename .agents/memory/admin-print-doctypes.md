---
name: Admin print doc-types
description: How the admin "print" document (invoice/quote/job-order/delivery-order) is generated and the rule for adding a new variant.
---

The admin printable document is ONE giant HTML-string template inside `handlePrintQuote` in `client/src/pages/admin/QuoteDetail.tsx`, opened via `window.open` + `document.write`. It auto-picks a `docType` ("QUOTATION" | "JOB ORDER" | "TAX INVOICE" | "DELIVERY ORDER") and branches throughout with `${isInvoiceDoc ? ... : ...}` / `${isDeliveryOrder ? ...}`. There is NO separate PDF/route per document — they are all the same template with conditionals. `handlePrintQuote(forceDocType?)` lets a button force a variant (the "DO" button passes "DELIVERY ORDER").

**Rule:** A Delivery Order must never show money. When adding/maintaining the DO variant, guard EVERY price-bearing block with `isDeliveryOrder`:
- item-table Unit Price / Amount columns
- totals-wrap + amount-due
- Payment Details + PayNow QR
- the relocation **"Included on-site time"** block — easy to miss; it prints `$/mover/hr` rates and its condition was `!isInvoiceDoc && hasRelocation`, which silently includes DO. Must also exclude `!isDeliveryOrder`.

**Why:** "no prices on the DO" is a hard requirement; the on-site-time block leaked rates because its guard only excluded invoices, not DOs.

**How to apply:** after any edit touching the print template, grep the template region for `S$`, `paynow`, `Payment Details`, `overtimePerManPerHour` and confirm each hit is inside a non-DO branch. Doc number switches via `docNo` (INV-/DO-/referenceNo).
