// =============================================================================
// Browser UI end-to-end tests — accept-terms → pay gate + admin refund/dispute
//
// Run: npx tsx --test tests/uiTermsRefundFlow.test.ts
//
// These drive a REAL Chromium browser (via playwright-core, using the Replit
// bundled browser) against a running instance of the app, asserting the exact
// UI behaviours the task requires:
//
//   Customer QuoteStatus (/quotes/:id):
//     • a fresh, unaccepted quote shows the "review & accept" warning and a
//       DISABLED "Pay Deposit Now" button (data-testid="button-pay-deposit");
//     • ticking the acceptance box (data-testid="checkbox-accept-terms") records
//       acceptance, reveals the accepted-confirmation text, and ENABLES the
//       pay button — all without a page reload.
//
//   Admin QuoteDetail (/admin/quotes/:id) dispute-protection panel:
//     • adding a dispute-log note (data-testid="input-dispute-note" +
//       "button-add-dispute-note") makes the note appear live in the log;
//     • recording a refund (data-testid="button-toggle-refund" +
//       "button-save-refund") updates the on-screen refund record live.
//
// The browser hits BASE_URL (default http://localhost:5000), which is in the
// server's CSRF origin allow-list so POSTs (accept-terms / login / refund /
// note) succeed. If no server is reachable or the Chromium binary is not
// available, every test SKIPs (it never fails the suite) — mirroring the
// infra-skip pattern used by the other integration tests in this repo.
// =============================================================================

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Browser, Page } from "playwright-core";

const BASE_URL = (process.env.UI_TEST_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "Admin@TMG2026";

let browser: Browser | null = null;
let skipReason: string | null = null;
let gateQuoteId: number | undefined;
let gateRefNo: string | undefined;
let refundQuoteId: number | undefined;

async function serverReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

before(async () => {
  if (!(await serverReachable())) {
    skipReason = `app not reachable at ${BASE_URL} (set UI_TEST_BASE_URL or start the dev server)`;
    return;
  }
  try {
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({
      executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (err: any) {
    skipReason = `Chromium unavailable: ${err?.message || err}`;
    return;
  }
  try {
    const { storage } = await import("../server/storage.ts");
    const ts = Date.now();
    const gate = await storage.createQuote(
      { name: "UI Gate Customer", email: `ui-gate-${ts}@example.test`, phone: "+6580000021" },
      {
        referenceNo: `UI-GATE-${ts}`,
        serviceAddress: "20 UI Rd, Singapore",
        status: "deposit_requested",
        subtotal: "300",
        total: "300",
        depositAmount: "150",
        finalAmount: "150",
        version: 1,
        paymentStatus: "unpaid",
      } as any,
      [],
    );
    gateQuoteId = gate.id;
    gateRefNo = gate.referenceNo;
    const refund = await storage.createQuote(
      { name: "UI Refund Customer", email: `ui-refund-${ts}@example.test`, phone: "+6580000022" },
      {
        referenceNo: `UI-REFUND-${ts}`,
        serviceAddress: "21 UI Rd, Singapore",
        status: "deposit_paid",
        subtotal: "300",
        total: "300",
        depositAmount: "150",
        finalAmount: "150",
        version: 1,
        paymentStatus: "deposit_paid",
        depositPaidAt: new Date(),
      } as any,
      [],
    );
    refundQuoteId = refund.id;
  } catch (err: any) {
    skipReason = `could not seed test quotes (DB issue): ${err?.message || err}`;
  }
});

after(async () => {
  if (browser) await browser.close().catch(() => {});
  try {
    const { storage } = await import("../server/storage.ts");
    for (const id of [gateQuoteId, refundQuoteId]) {
      if (id !== undefined) await storage.deleteQuote(id).catch(() => {});
    }
  } catch {
    /* best-effort cleanup */
  }
  // playwright keeps handles around; exit this test-runner child cleanly.
  setTimeout(() => process.exit(0), 250).unref();
});

async function newPage(): Promise<Page> {
  const ctx = await browser!.newContext();
  return ctx.newPage();
}

test("UI: customer accept-terms gate enables the deposit Pay button", async (t) => {
  if (skipReason || !browser || gateQuoteId === undefined) {
    t.skip(skipReason || "setup unavailable");
    return;
  }
  const page = await newPage();
  try {
    // The customer quote page requires the ?ref=<referenceNo> param for
    // unauthenticated access (matches the link sent in customer emails).
    await page.goto(`${BASE_URL}/quotes/${gateQuoteId}?ref=${encodeURIComponent(gateRefNo!)}`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const payBtn = page.locator('[data-testid="button-pay-deposit"]');
    const checkbox = page.locator('[data-testid="checkbox-accept-terms"]');
    await checkbox.waitFor({ state: "visible", timeout: 30000 });

    // BEFORE acceptance: the warning + checkbox are shown, the pay button is
    // disabled, and the "already accepted" confirmation is absent.
    assert.equal(await payBtn.isDisabled(), true, "pay button must be disabled before acceptance");
    assert.equal(
      await page.locator('[data-testid="text-terms-accepted"]').count(),
      0,
      "accepted-confirmation must not be present before acceptance",
    );

    // Tick the acceptance box.
    await checkbox.click();

    // AFTER acceptance: confirmation appears and the pay button enables — no reload.
    await page.locator('[data-testid="text-terms-accepted"]').waitFor({ state: "visible", timeout: 30000 });
    await assertEnabled(payBtn, "pay button must enable after acceptance");

    // Intercept the checkout call so we can drive both the 409 recovery path
    // and the success/redirect path deterministically (no real Stripe needed).
    let checkoutMode: "409" | "ok" = "409";
    await page.route(/\/api\/quotes\/\d+\/checkout/, (route) => {
      if (checkoutMode === "409") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "TERMS_NOT_ACCEPTED" }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: `${BASE_URL}/?e2e=stripe-checkout` }),
      });
    });

    // 409 recovery: a stale TERMS_NOT_ACCEPTED checkout must surface the warning
    // toast AND scroll to the acceptance section (acceptanceRef.scrollIntoView).
    await page.evaluate(() => {
      (window as any).__scrollCalls = 0;
      const orig = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (...args: any[]) {
        (window as any).__scrollCalls++;
        return orig.apply(this, args as any);
      };
    });
    await payBtn.click();
    await page
      .getByText("Please accept the terms first", { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: 30000 });
    await page.waitForFunction(() => (window as any).__scrollCalls > 0, null, { timeout: 10000 });

    // Success path: an accepted checkout must redirect the browser to the
    // checkout URL returned by the server.
    checkoutMode = "ok";
    await assertEnabled(payBtn, "pay button must be clickable again after the 409 toast");
    await payBtn.click();
    await page.waitForURL(/e2e=stripe-checkout/, { timeout: 30000 });
    assert.match(page.url(), /e2e=stripe-checkout/, "pay must redirect to the checkout URL");
  } finally {
    await page.context().close().catch(() => {});
  }
});

test("UI: admin can add a dispute note and record a refund with live panel updates", async (t) => {
  if (skipReason || !browser || refundQuoteId === undefined) {
    t.skip(skipReason || "setup unavailable");
    return;
  }
  const page = await newPage();
  const noteText = `Customer confirmed schedule ${Date.now()}`;
  try {
    // Log in as admin.
    await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator('[data-testid="input-username"]').fill(ADMIN_USERNAME);
    await page.locator('[data-testid="input-password"]').fill(ADMIN_PASSWORD);
    await page.locator('[data-testid="button-login"]').first().click();
    // Wait until we've left the login page (session established).
    await page.waitForFunction(() => !location.pathname.endsWith("/login"), null, { timeout: 30000 }).catch(() => {});

    await page.goto(`${BASE_URL}/admin/quotes/${refundQuoteId}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.locator('[data-testid="section-dispute-protection"]').waitFor({ state: "visible", timeout: 30000 });

    // Add a dispute-log note → it must appear live in the log.
    await page.locator('[data-testid="input-dispute-note"]').fill(noteText);
    await page.locator('[data-testid="button-add-dispute-note"]').click();
    await page.getByText(noteText, { exact: false }).first().waitFor({ state: "visible", timeout: 30000 });

    // Record a refund → the on-screen refund record must update live.
    await page.locator('[data-testid="button-toggle-refund"]').click();
    await page.locator('[data-testid="input-refund-amount"]').fill("150.00");
    await page.locator('[data-testid="input-refund-method"]').fill("PayNow");
    await page.locator('[data-testid="input-refund-reason"]').fill("E2E test refund");
    await page.locator('[data-testid="button-save-refund"]').click();

    const record = page.locator('[data-testid="text-refund-record"]');
    await record.waitFor({ state: "visible", timeout: 30000 });
    assert.match(await record.innerText(), /150\.00/, "refund record must show the approved amount");
    assert.match(await record.innerText(), /PayNow/, "refund record must show the refund method");
  } finally {
    await page.context().close().catch(() => {});
  }
});

async function assertEnabled(locator: ReturnType<Page["locator"]>, msg: string) {
  await locator.waitFor({ state: "visible", timeout: 30000 });
  for (let i = 0; i < 30; i++) {
    if (await locator.isEnabled()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.fail(msg);
}
