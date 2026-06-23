// Server-side invoice PDF rendering.
//
// Why this exists: customers download their invoice from /invoice/:ref. Earlier
// client-side approaches (jsPDF hand-built, html2canvas raster) either drifted
// from the on-screen layout or produced a rasterised "cream box" artifact over
// the dark header. Native browser print works but depends on the customer's
// device having the latest cached JS, which iOS home-screen web apps do not
// reliably update.
//
// This module renders the ACTUAL invoice page with a real headless Chromium
// (the same engine the website uses), so the PDF is identical to the on-screen
// invoice — crisp vector text, dark header, no raster artifacts. Because the
// work happens on the server, a direct link returns a correct PDF regardless of
// what the customer's browser has cached.
//
// Chromium is installed as a Nix system dependency, so it is present in both the
// dev workspace and production deployments. We launch it through playwright-core
// (already a project dependency) via executablePath.

import { chromium, type Browser } from "playwright-core";
import { execSync } from "child_process";

let cachedExe: string | null = null;

function resolveChromium(): string {
  if (cachedExe) return cachedExe;
  if (process.env.CHROMIUM_PATH) {
    cachedExe = process.env.CHROMIUM_PATH;
    return cachedExe;
  }
  try {
    cachedExe = execSync("command -v chromium || command -v chromium-browser", {
      shell: "/bin/bash",
    })
      .toString()
      .trim();
  } catch {
    cachedExe = "";
  }
  if (!cachedExe) {
    throw new Error("Chromium executable not found on PATH (set CHROMIUM_PATH)");
  }
  return cachedExe;
}

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null);
    if (existing && existing.isConnected()) return existing;
    browserPromise = null;
  }
  browserPromise = chromium.launch({
    executablePath: resolveChromium(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
  const browser = await browserPromise;
  browser.on("disconnected", () => {
    browserPromise = null;
  });
  return browser;
}

// Bound concurrent renders so a burst of requests cannot exhaust memory/CPU.
let inFlight = 0;
const MAX_CONCURRENT = 2;

export class PdfBusyError extends Error {
  statusCode = 429;
  constructor() {
    super("Too many invoice PDF requests in progress");
  }
}

// Parse a raw HTTP Cookie header ("a=1; b=2") into Playwright cookie objects so
// the headless browser can carry the caller's admin session into the rendered
// page. We attach them by `url` and let Playwright derive domain/path.
function parseCookieHeader(header: string | undefined, url: string) {
  if (!header) return [] as { name: string; value: string; url: string }[];
  return header
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf("=");
      if (i < 0) return null;
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (!name) return null;
      return { name, value, url };
    })
    .filter((c): c is { name: string; value: string; url: string } => c !== null);
}

/**
 * Render the invoice page for `refNo` to a PDF buffer. The caller MUST have
 * already verified the invoice is paid in full — otherwise the page renders an
 * "Invoice not available" state and there is no [data-invoice-print] element.
 */
export async function renderInvoicePdf(refNo: string): Promise<Buffer> {
  if (inFlight >= MAX_CONCURRENT) throw new PdfBusyError();
  inFlight++;

  // Everything after the counter increment runs inside a single try/finally so
  // inFlight is ALWAYS decremented — even if launching the browser or creating
  // the context/page throws. Otherwise a missing/crashed Chromium would leak the
  // slot and eventually pin every request at 429 until the process restarts.
  let context: import("playwright-core").BrowserContext | null = null;
  try {
    const port = process.env.PORT || "5000";
    const url = `http://127.0.0.1:${port}/invoice/${encodeURIComponent(refNo)}`;

    const browser = await getBrowser();
    context = await browser.newContext({ viewport: { width: 900, height: 1400 } });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    // Wait for the rendered invoice card (only present once data has loaded).
    await page.waitForSelector("[data-invoice-print]", { timeout: 30000 });
    // page.pdf() uses print-media emulation, applying the invoice page's
    // @media print rules (clean layout, forced dark header background).
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    return pdf as Buffer;
  } finally {
    if (context) await context.close().catch(() => {});
    inFlight--;
  }
}

/**
 * Render the admin "Closed Jobs — Audit Report" to a PDF buffer.
 *
 * This loads the REAL /admin/export page in headless Chromium (single source of
 * truth — no duplicated server markup) and prints it with page.pdf(), which —
 * unlike the browser's window.print() — adds NO URL / page-number footer. The
 * caller's admin session cookie is injected so the SPA authenticates and loads
 * the job data. The page applies the date range / mode from the query string
 * and flips a `data-pdf-ready="1"` flag once everything has rendered.
 *
 * The caller MUST have already verified the requester is an admin.
 */
export async function renderAuditReportPdf(opts: {
  cookieHeader: string | undefined;
  from?: string;
  to?: string;
  mode: "summary" | "full";
}): Promise<Buffer> {
  if (inFlight >= MAX_CONCURRENT) throw new PdfBusyError();
  inFlight++;

  let context: import("playwright-core").BrowserContext | null = null;
  try {
    const port = process.env.PORT || "5000";
    const origin = `http://127.0.0.1:${port}`;
    const params = new URLSearchParams();
    if (opts.from) params.set("from", opts.from);
    if (opts.to) params.set("to", opts.to);
    params.set("mode", opts.mode === "full" ? "full" : "summary");
    params.set("pdf", "1");
    const url = `${origin}/admin/export?${params.toString()}`;

    const browser = await getBrowser();
    context = await browser.newContext({ viewport: { width: 1200, height: 1600 } });
    const cookies = parseCookieHeader(opts.cookieHeader, origin);
    if (cookies.length) await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
    // Wait until the report has loaded its data and applied the filters. The
    // report portal is display:none on screen (print-only), so we wait for the
    // element to be ATTACHED, not visible — otherwise this would always time out.
    await page.waitForSelector('[data-pdf-ready="1"]', { state: "attached", timeout: 30000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" },
    });
    return pdf as Buffer;
  } finally {
    if (context) await context.close().catch(() => {});
    inFlight--;
  }
}
