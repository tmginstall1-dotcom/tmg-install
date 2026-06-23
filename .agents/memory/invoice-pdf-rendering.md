---
name: Invoice PDF rendering
description: How the customer invoice PDF (/invoice/:ref) is produced and why other approaches were rejected.
---

# Invoice PDF rendering

The customer invoice PDF (download from `/invoice/:ref`, Invoice.tsx) is produced **server-side** by rendering the real invoice page with a headless Chromium and returning `page.pdf()`. This is the definitive solution after three rejected client-side attempts.

**How it works now:**
- `server/invoice-pdf.ts` — `renderInvoicePdf(refNo)` launches Chromium via `playwright-core` (`executablePath` resolved from PATH at runtime, override with `CHROMIUM_PATH`), navigates to the app's OWN `http://127.0.0.1:${PORT}/invoice/:ref`, waits for `[data-invoice-print]`, returns `page.pdf({format:'A4', printBackground:true})`. `page.pdf()` uses print-media emulation, so the existing `@media print` CSS still governs layout. Bounded to 2 concurrent renders (throws `PdfBusyError` → 429).
- Endpoint: `GET /api/public/invoice/:refNo/pdf` (+ pretty alias `GET /invoice/:refNo.pdf` via regex route). Verifies the quote is paid-in-full BEFORE launching the browser (same check as the JSON invoice route). Returns `application/pdf` with `Content-Disposition: attachment`.
- Client "Download PDF" button fetches that endpoint as a blob and triggers a real file download (shows a "Preparing PDF…" spinner). "Print" still uses native `window.print()`. Download falls back to `printInvoice()` if the server request fails.

**Why server-side won (the others were all rejected by the user):**
- **html2canvas raster**: produced a "cream box" artifact over the dark header (white "TMG INSTALL" text lost). Raster capture of custom-styled text/backgrounds is unreliable.
- **Hand-built jsPDF layout**: a second layout that drifts from the live site on every design change.
- **Native `window.print()`**: renders correctly BUT depends on the customer's device having the latest cached JS. iOS home-screen web apps pin a stale service worker / bundle and do not reliably update, so the fix never reached the user's phone (they kept seeing the old html2canvas cream box). See `prod-stale-chunk-crash.md`. **Server-side render is cache-proof**: a direct link returns a correct PDF no matter what the client cached, because all the work happens on the server.

**Chromium availability:** installed as a **Nix system dependency** (package-management `installSystemDependencies(["chromium"])`), NOT a Playwright-downloaded browser. Nix system deps ship into production deployments (a `~/.cache/ms-playwright` download would not), so the endpoint works in prod. `command -v chromium` resolves it on PATH in both dev and prod.

**Critical CSS rule (still required):** the dark header band and PAID badge are colored backgrounds. `-webkit-print-color-adjust: exact` + `print-color-adjust: exact` on `[data-invoice-print]` force them to render. `printBackground:true` in `page.pdf()` is also required. Never remove these or the dark header goes blank.

**Print isolation gotcha (still in the @media print block):** `body * { visibility:hidden }` + reveal `[data-invoice-print]` positioned `absolute; top:0`, and neutralize `.invoice-page-wrapper` min-height/padding → 0, so the gray frame / navbar don't force trailing blank pages.

**Verification trick:** to confirm a render without a paid invoice in dev, temporarily flip a quote's `payment_status` to `'paid_in_full'`, hit the endpoint, then restore. To SEE the output, drive Chromium with `emulateMedia({media:'print'})` + element `.screenshot()` and read the PNG.

**Same pattern reused for the admin "Closed Jobs — Audit Report"** (`renderAuditReportPdf`, endpoint `GET /api/admin/export/audit-pdf`, admin-gated). Two differences worth remembering when server-rendering a page that needs login:
- **Auth:** inject the caller's session cookie into the Playwright context — parse `req.headers.cookie` into `{name,value,url}` and `context.addCookies(...)` for `http://127.0.0.1:${PORT}` — so the SPA's auth check + data fetches succeed in headless mode.
- **Print-only portal:** the audit report lives in a `createPortal`→`body` div that is `display:none` on screen (only shown under `@media print`). `waitForSelector` MUST use `state:'attached'` (NOT the default `'visible'`) or it always times out. The client reads `?pdf=1&from&to&mode` from the URL, applies the filters + sets `body.dataset.printMode`, then flips `data-pdf-ready="1"`. This replaced `window.print()`, whose browser URL/page-number footer iOS Safari cannot disable; `page.pdf()` never adds one.
