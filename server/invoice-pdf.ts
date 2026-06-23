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
