---
name: Invoice PDF rendering
description: How the customer invoice PDF (/invoice/:ref) is produced and why other approaches were rejected.
---

# Invoice PDF rendering

The customer invoice PDF (download/print from `/invoice/:ref`, Invoice.tsx) is produced by the **browser's native print engine** (`window.print()`), not by any client-side PDF library. Both the "Download PDF" and "Print" buttons call the same `printInvoice()`, which sets `document.title` to `Invoice_<no>` (so the Save-as-PDF default filename is clean) and prints. Fidelity comes from a dedicated `@media print` block that hides all app chrome and reveals only `[data-invoice-print]`.

**Why native print, not a generated file:**
- **html2canvas capture** (raster the invoice card → jsPDF): rejected — it dropped the white "TMG INSTALL" text on the dark header band, producing a blank/unprofessional header. Raster capture of custom-styled text/backgrounds is unreliable.
- **Hand-built jsPDF layout**: rejected — it is a second layout that never matches the live site and drifts on every design change.
- **Server-side headless Chromium** (the ideal one-click+faithful option): not feasible here — `playwright-core` is a dep but NO browser binary is installed and there is no system Chromium; installing one on Replit/Nix is heavy and frequently fails to launch, which would break downloads in production.

**Critical CSS rule:** the header band and PAID badge are colored backgrounds. Chrome's print "Background graphics" checkbox defaults to OFF, which would strip them (white text on white = invisible header). `-webkit-print-color-adjust: exact` + `print-color-adjust: exact` on `[data-invoice-print]` forces those backgrounds to print on iOS Safari / Chrome / Safari regardless of that checkbox. **Never remove these** or the dark header goes blank again.

**Print isolation gotcha:** use `body * { visibility: hidden }` + reveal `[data-invoice-print]` positioned `absolute; top:0`, and neutralize the page wrapper (`.invoice-page-wrapper` min-height/padding → 0) so the in-flow gray frame and global announcement bar/navbar don't force trailing blank pages.

**UX tradeoff:** "Download PDF" opens the browser's print/share dialog (Save as PDF), not an instant file download — this is inherent to client-side vector PDF and is the accepted behavior.
