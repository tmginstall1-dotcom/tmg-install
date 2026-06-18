// =============================================================================
// Route-level (HTTP) end-to-end tests — accept-terms deposit gate + admin refund
//
// Run: npx tsx --test tests/checkoutRefundRoutes.test.ts
//
// Unlike termsGateRefundFlow.test.ts (which drives the storage layer + the shared
// gate predicate), THIS file boots the REAL Express routes in-process via
// `registerRoutes` and makes actual HTTP requests, so it covers route wiring,
// session auth, request validation, and the exact HTTP status / JSON contract
// the customer + admin React pages depend on:
//
//   • GET /api/quotes/:id/checkout?type=deposit returns HTTP 409
//     { code: "TERMS_NOT_ACCEPTED" } for a quote whose current version has not
//     been accepted. (This branch returns BEFORE any Stripe call.) After the
//     customer accepts the current version, the SAME endpoint returns HTTP 200
//     with a Stripe checkout URL. The Stripe SDK is stubbed (see below) so this
//     happy path needs no live key and makes no external API calls.
//   • POST /api/admin/quotes/:id/refund rejects unauthenticated callers (401)
//     and, for an authenticated admin, persists the refund fields and appends a
//     'refund_approved' dispute-log event (the data the QuoteDetail panel renders
//     live after its mutation invalidates the query).
//
// The CSRF Origin/Referer guard in server/index.ts is NOT mounted here; requests
// carry no Origin/Referer header, which the production guard explicitly allows
// (server/index.ts ~line 174). Session uses the in-memory store, not Postgres.
//
// DB-dependent assertions SKIP (not fail) when the database is unreachable / not
// migrated, or when no admin account exists, mirroring the other integration
// tests in this repo.
// =============================================================================

import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import session from "express-session";
import Stripe from "stripe";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";

// ---------------------------------------------------------------------------
// Stub Stripe so the deposit-checkout happy path returns a URL with no live key.
//
// server/routes.ts builds its Stripe client once, at import time, from
// STRIPE_SECRET_KEY (`const stripe = key ? new Stripe(key) : null`). So we must
// (a) guarantee a key is present BEFORE registerRoutes is imported — otherwise
// `stripe` is null and checkout would 500 with "Stripe not configured" — and
// (b) override checkout.sessions.create so NO real Stripe API call is ever made.
// All Stripe resource instances share one prototype, so overriding it here also
// affects the client routes.ts constructs later. The Node test runner isolates
// each test FILE in its own process, so this patch never leaks into other test
// files or production.
// ---------------------------------------------------------------------------
const STUB_STRIPE_URL = "https://checkout.stripe.test/c/pay/cs_test_stub";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy_for_tests";
// Capture the exact params handed to Stripe so the balance test can assert the
// amount charged. createStripePaymentLink (server/routes.ts ~1599) builds a
// single line item with `unit_amount: Math.round(amountSGD * 100)` in cents, so
// the captured value is the source of truth for what the customer would pay.
let lastStripeCreateParams: any = null;
Object.getPrototypeOf(new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions).create =
  async (params: any) => {
    lastStripeCreateParams = params;
    return { url: STUB_STRIPE_URL };
  };

// Stub checkout.sessions.retrieve too, so the return-from-Stripe verification
// path (POST /api/quotes/:id/verify-payment) can be driven with no live key and
// no external API call. Each test sets `nextStripeSession` to the exact Checkout
// Session object the route should "see" when it retrieves the session id, which
// lets us exercise the route's guards: payment_status must be "paid" and
// metadata.quoteId must match the URL quote id. Override is on the shared
// prototype (same reasoning as the create stub above).
let nextStripeSession: any = null;
Object.getPrototypeOf(new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions).retrieve =
  async (_sessionId: string) => {
    if (!nextStripeSession) throw new Error("nextStripeSession not configured for this test");
    return nextStripeSession;
  };

// Pull the SGD amount (dollars) out of the last captured Stripe params.
function lastStripeAmountSGD(): number {
  const cents = lastStripeCreateParams?.line_items?.[0]?.price_data?.unit_amount;
  if (typeof cents !== "number") throw new Error("no Stripe unit_amount captured");
  return cents / 100;
}

// registerRoutes starts long-lived background setInterval schedulers
// (server/routes.ts ~11600-11856) that keep the event loop alive forever. The
// Node test runner isolates each test FILE in its own child process, so once
// this file's tests have finished and reported, we exit this child cleanly so
// the run does not hang waiting on those timers.
after(() => {
  setTimeout(() => process.exit(0), 250).unref();
});

const ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || "Admin@TMG2026";

async function startApp(): Promise<{ server: Server; base: string }> {
  const { registerRoutes } = await import("../server/routes.ts");
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    }),
  );
  const server = createServer(app);
  await registerRoutes(server, app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { server, base: `http://127.0.0.1:${port}` };
}

function isInfraError(err: any): string | null {
  const cause = err?.cause?.message || err?.message || String(err);
  const code = err?.cause?.code;
  if (
    code === "42703" || // undefined_column
    code === "42P01" || // undefined_table
    code === "ECONNREFUSED" ||
    /does not exist|ECONNREFUSED|connect|DATABASE_URL/i.test(cause)
  ) {
    return cause;
  }
  return null;
}

test("HTTP: deposit checkout returns 409 TERMS_NOT_ACCEPTED before the terms are accepted", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const { depositPaidFallback } = await import("../shared/pricing.ts");
  const refNo = `TEST-HTTP-GATE-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    const created = await storage.createQuote(
      { name: "HTTP Gate Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000003" },
      {
        referenceNo: refNo,
        serviceAddress: "1 Route Rd, Singapore",
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
    quoteId = created.id;

    app = await startApp();
    const res = await fetch(`${app.base}/api/quotes/${quoteId}/checkout?type=deposit`);
    assert.equal(res.status, 409, "unaccepted deposit checkout must be blocked with 409");
    const body = await res.json();
    assert.equal(body.code, "TERMS_NOT_ACCEPTED", "409 must carry the TERMS_NOT_ACCEPTED code");

    // After the customer accepts the current version, the gate predicate flips so
    // the route proceeds to Stripe. First confirm the predicate (the exact value
    // the route reads) flipped...
    await storage.recordTermsAcceptance(quoteId!, { version: 1, amount: 300 });
    const reread = await storage.getQuote(quoteId!);
    const { termsAcceptedForCurrentVersion } = await import("../shared/businessRules.ts");
    assert.equal(
      termsAcceptedForCurrentVersion(reread as any),
      true,
      "after acceptance the deposit gate must open (no longer 409)",
    );

    // ...then drive the REAL endpoint again: it must now return HTTP 200 with a
    // Stripe checkout URL. Stripe is stubbed (top of file) so this hits no live
    // API. This catches a broken happy path — wrong status, swallowed URL, or a
    // gate condition that keeps blocking an accepted quote — that the predicate
    // check alone cannot see.
    const ok = await fetch(`${app.base}/api/quotes/${quoteId}/checkout?type=deposit`);
    assert.equal(ok.status, 200, "accepted deposit checkout must return 200");
    const okBody = await ok.json();
    assert.equal(okBody.url, STUB_STRIPE_URL, "successful checkout must return the Stripe URL");

    // The amount handed to Stripe must equal the expected deposit — not the full
    // total. This $300 quote is at/above the full-payment threshold, so the route
    // charges the stored $150 deposit. We assert against an independently-computed
    // value from the shared helper so this test fails if either the route's
    // depositPaidFallback call OR the helper itself drifts (e.g. wrong percentage,
    // or charging the full total instead of the deposit).
    const expectedDeposit = depositPaidFallback(300, "150");
    assert.equal(expectedDeposit, 150, "expected deposit for this fixture is $150");
    assert.equal(
      lastStripeAmountSGD(),
      expectedDeposit,
      "Stripe must be charged the deposit amount, not the full total",
    );
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP gate test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

test("HTTP: deposit checkout for an under-threshold job charges the FULL total (paid up front)", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const { depositPaidFallback } = await import("../shared/pricing.ts");
  const refNo = `TEST-HTTP-DEPOSIT-FULL-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  // Under-threshold jobs (total < the full-payment threshold) are ALWAYS paid in
  // full up front, so the "deposit" checkout must charge the entire total — never
  // a fractional deposit, and never a stale stored split. $120 is below the
  // threshold; depositPaidFallback ignores the stored $60 deposit and returns the
  // full $120. We assert against the helper so route + helper stay in lockstep.
  const TOTAL = 120;
  const STALE_DEPOSIT = "60"; // deliberately wrong: must be ignored under threshold
  const expectedCharge = depositPaidFallback(TOTAL, STALE_DEPOSIT);

  try {
    assert.equal(expectedCharge, TOTAL, "under-threshold deposit checkout must charge the full total");

    const created = await storage.createQuote(
      { name: "HTTP Deposit Full Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000009" },
      {
        referenceNo: refNo,
        serviceAddress: "7 Route Rd, Singapore",
        status: "deposit_requested",
        subtotal: String(TOTAL),
        total: String(TOTAL),
        depositAmount: STALE_DEPOSIT,
        finalAmount: "60",
        version: 1,
        paymentStatus: "unpaid",
      } as any,
      [],
    );
    quoteId = created.id;

    // The deposit branch is gated on terms acceptance, so accept the current
    // version first (mirrors the gate test above) before driving checkout.
    await storage.recordTermsAcceptance(quoteId!, { version: 1, amount: TOTAL });

    app = await startApp();
    const ok = await fetch(`${app.base}/api/quotes/${quoteId}/checkout?type=deposit`);
    assert.equal(ok.status, 200, "under-threshold deposit checkout must return 200");
    const okBody = await ok.json();
    assert.equal(okBody.url, STUB_STRIPE_URL, "successful checkout must return the Stripe URL");

    assert.equal(
      lastStripeAmountSGD(),
      expectedCharge,
      "Stripe must be charged the full total for an under-threshold job, not the stored deposit",
    );
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP deposit-full test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

test("HTTP: admin refund route enforces auth, then records the refund + dispute event", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const refNo = `TEST-HTTP-REFUND-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    const created = await storage.createQuote(
      { name: "HTTP Refund Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000004" },
      {
        referenceNo: refNo,
        serviceAddress: "2 Route Rd, Singapore",
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
    quoteId = created.id;

    app = await startApp();

    // 1) Unauthenticated refund attempt must be rejected (no session).
    const unauth = await fetch(`${app.base}/api/admin/quotes/${quoteId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refundApprovedAmount: "150.00", refundMethod: "PayNow" }),
    });
    assert.equal(unauth.status, 401, "refund without a session must be 401");

    // 2) Log in as admin to obtain a session cookie.
    const login = await fetch(`${app.base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    if (login.status !== 200) {
      t.skip(`admin login unavailable (status ${login.status}); skipping authed refund assertions`);
      return;
    }
    const cookie = login.headers.get("set-cookie");
    assert.ok(cookie, "login should set a session cookie");

    // 3) Authenticated admin refund must succeed and persist the fields.
    const refund = await fetch(`${app.base}/api/admin/quotes/${quoteId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie! },
      body: JSON.stringify({
        refundApprovedAmount: "150.00",
        refundMethod: "PayNow",
        refundReason: "Customer cancelled within policy",
        refundInternalNote: "Approved by ops",
      }),
    });
    assert.equal(refund.status, 200, "authed admin refund must succeed");
    const refunded = await refund.json();
    assert.equal(refunded.refundApprovedAmount, "150.00");
    assert.equal(refunded.refundMethod, "PayNow");
    // The legacy paid timestamp must remain intact through a refund record.
    assert.ok(refunded.depositPaidAt, "deposit_paid_at must survive a refund record");

    // 4) A dispute-log event must have been appended (what the panel renders).
    const events = await storage.listDisputeEvents(quoteId!);
    assert.ok(
      events.some((e) => e.eventType === "refund_approved"),
      "a refund_approved dispute event must be logged",
    );
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP refund test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

test("HTTP: admin dispute-log note requires auth, persists, and shows up on the next fetch", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const refNo = `TEST-HTTP-NOTE-${Date.now()}`;
  const noteText = `Customer called to confirm date ${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    const created = await storage.createQuote(
      { name: "HTTP Note Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000005" },
      {
        referenceNo: refNo,
        serviceAddress: "3 Route Rd, Singapore",
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
    quoteId = created.id;

    app = await startApp();

    // 1) Unauthenticated note attempt must be rejected.
    const unauth = await fetch(`${app.base}/api/admin/quotes/${quoteId}/dispute-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detail: noteText }),
    });
    assert.equal(unauth.status, 401, "adding a dispute note without a session must be 401");

    // 2) Log in as admin.
    const login = await fetch(`${app.base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
    });
    if (login.status !== 200) {
      t.skip(`admin login unavailable (status ${login.status}); skipping authed note assertions`);
      return;
    }
    const cookie = login.headers.get("set-cookie")!;

    // 3) Posting a note must succeed and return an admin_note event.
    const post = await fetch(`${app.base}/api/admin/quotes/${quoteId}/dispute-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ detail: noteText }),
    });
    assert.equal(post.status, 200, "authed admin note must succeed");
    const event = await post.json();
    assert.equal(event.eventType, "admin_note");
    assert.equal(event.detail, noteText);

    // 4) The note must come back on the GET the panel re-fetches after its
    //    mutation invalidates the dispute-events query (live panel refresh).
    const list = await fetch(`${app.base}/api/admin/quotes/${quoteId}/dispute-events`, {
      headers: { Cookie: cookie },
    });
    assert.equal(list.status, 200);
    const events = (await list.json()) as any[];
    assert.ok(
      events.some((e) => e.eventType === "admin_note" && e.detail === noteText),
      "the new admin note must be returned by the dispute-events fetch",
    );

    // 5) An empty note must be rejected by validation.
    const empty = await fetch(`${app.base}/api/admin/quotes/${quoteId}/dispute-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ detail: "" }),
    });
    assert.equal(empty.status, 400, "an empty dispute note must fail validation");
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP dispute-note test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

// =============================================================================
// Balance (final) branch of GET /api/quotes/:id/checkout?type=final
//
// This branch is the financial mirror of the deposit happy path: it computes the
// outstanding amount with finalBalanceOutstanding(total, finalAmount, deposit,
// ledgerPaid) (server/routes.ts ~4717) and hard-stops with HTTP 400 when nothing
// is owed (~4723). A bug here could overcharge a customer, undercharge, or open a
// charge for an already-settled job. The deposit test already proves the route
// returns the stubbed Stripe URL, so here we additionally assert the AMOUNT that
// would be charged equals the expected balance, by capturing the unit_amount the
// route hands to Stripe (see lastStripeAmountSGD at the top of the file).
//
// Unlike the deposit branch, the final branch has NO terms-acceptance gate, so we
// do not need to call recordTermsAcceptance here.
// =============================================================================
test("HTTP: balance checkout charges total − deposit − ledger payments", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const { finalBalanceOutstanding } = await import("../shared/pricing.ts");
  const refNo = `TEST-HTTP-BALANCE-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  // Known money shape: $300 total, $150 deposit, $150 stored final balance, and a
  // $50 partial payment already recorded in the ledger. Expected outstanding is
  // therefore 150 − 50 = $100. We assert against an independently-computed value
  // from the shared helper so this test fails if either the route OR the helper
  // drifts.
  const TOTAL = 300;
  const DEPOSIT = "150";
  const FINAL = "150";
  const LEDGER_PARTIAL = 50;
  const expectedBalance = finalBalanceOutstanding(TOTAL, FINAL, DEPOSIT, LEDGER_PARTIAL);

  try {
    const created = await storage.createQuote(
      { name: "HTTP Balance Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000006" },
      {
        referenceNo: refNo,
        serviceAddress: "4 Route Rd, Singapore",
        status: "deposit_paid",
        subtotal: String(TOTAL),
        total: String(TOTAL),
        depositAmount: DEPOSIT,
        finalAmount: FINAL,
        version: 1,
        paymentStatus: "deposit_paid",
        depositPaidAt: new Date(),
      } as any,
      [],
    );
    quoteId = created.id;

    // Record a $50 partial payment in the ledger — this is exactly what
    // getLedgerPaidTotal sums and the route subtracts from the balance.
    await storage.recordQuotePayment({
      quoteId: quoteId!,
      amount: String(LEDGER_PARTIAL),
      method: "cash",
    } as any);

    // Sanity: the helper math the route relies on must agree with the ledger.
    assert.equal(expectedBalance, 100, "expected balance for this fixture is $100");
    const ledgerCheck = await storage.getLedgerPaidTotal(quoteId!);
    assert.equal(ledgerCheck, LEDGER_PARTIAL, "ledger should hold exactly the $50 partial payment");

    app = await startApp();
    const res = await fetch(`${app.base}/api/quotes/${quoteId}/checkout?type=final`);
    assert.equal(res.status, 200, "balance checkout with money owed must return 200");
    const body = await res.json();
    assert.equal(body.url, STUB_STRIPE_URL, "successful balance checkout must return the Stripe URL");

    // The crux: the amount handed to Stripe must equal the outstanding balance,
    // not the total, the deposit, or the gross final before partial payments.
    assert.equal(
      lastStripeAmountSGD(),
      expectedBalance,
      "Stripe must be charged the outstanding balance (total − deposit − ledger)",
    );
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP balance test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

test("HTTP: balance checkout returns 400 when nothing is owed (under-threshold + fully-settled)", async (t) => {
  const { storage } = await import("../server/storage.ts");
  let underThresholdId: number | undefined;
  let settledId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    // (a) Under-threshold job: total < $150 ⇒ paid in full up front ⇒ NEVER has a
    // final balance, even with a stale stored finalAmount. The route must 400.
    const underRef = `TEST-HTTP-NOBAL-FULL-${Date.now()}`;
    const underCreated = await storage.createQuote(
      { name: "HTTP NoBalance Full", email: `${underRef.toLowerCase()}@example.test`, phone: "+6580000007" },
      {
        referenceNo: underRef,
        serviceAddress: "5 Route Rd, Singapore",
        status: "deposit_paid",
        subtotal: "120",
        total: "120",
        depositAmount: "120",
        finalAmount: "60", // deliberately stale: must be ignored for under-threshold
        version: 1,
        paymentStatus: "paid",
      } as any,
      [],
    );
    underThresholdId = underCreated.id;

    // (b) Fully-settled job at/above threshold: the ledger already covers the full
    // final balance, so the outstanding amount is $0 and the route must 400 (never
    // create a charge for an already-paid job).
    const settledRef = `TEST-HTTP-NOBAL-SETTLED-${Date.now()}`;
    const settledCreated = await storage.createQuote(
      { name: "HTTP NoBalance Settled", email: `${settledRef.toLowerCase()}@example.test`, phone: "+6580000008" },
      {
        referenceNo: settledRef,
        serviceAddress: "6 Route Rd, Singapore",
        status: "completed",
        subtotal: "300",
        total: "300",
        depositAmount: "150",
        finalAmount: "150",
        version: 1,
        paymentStatus: "paid",
      } as any,
      [],
    );
    settledId = settledCreated.id;
    // Record the full $150 balance as a ledger payment so nothing remains owed.
    await storage.recordQuotePayment({
      quoteId: settledId!,
      amount: "150",
      method: "cash",
    } as any);

    app = await startApp();

    const underRes = await fetch(`${app.base}/api/quotes/${underThresholdId}/checkout?type=final`);
    assert.equal(underRes.status, 400, "under-threshold full-payment job must have no balance (400)");
    const underBody = await underRes.json();
    assert.match(underBody.message, /no outstanding balance/i, "400 must explain there is no balance");

    const settledRes = await fetch(`${app.base}/api/quotes/${settledId}/checkout?type=final`);
    assert.equal(settledRes.status, 400, "fully-settled job must have no balance (400)");
    const settledBody = await settledRes.json();
    assert.match(settledBody.message, /no outstanding balance/i, "400 must explain there is no balance");
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP no-balance test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    const { storage } = await import("../server/storage.ts");
    for (const id of [underThresholdId, settledId]) {
      if (id !== undefined) {
        try {
          await storage.deleteQuote(id);
        } catch {
          /* best-effort cleanup */
        }
      }
    }
  }
});

// =============================================================================
// Return-from-Stripe verification — POST /api/quotes/:id/verify-payment
//
// After Stripe redirects the customer back, the success page calls this route to
// confirm the payment and flip the quote to paid (webhook-free fallback). The
// route has three guards that are otherwise untested:
//   1. Ownership — admin session OR a referenceNo in the body that matches the
//      quote. A public caller with a wrong/absent referenceNo gets 403.
//   2. Stripe truth — the retrieved session.payment_status must be "paid".
//   3. Session binding — session.metadata.quoteId must equal the URL quote id,
//      so one quote's paid Checkout Session can't settle a different quote.
// A regression in any of these could spoof a payment or apply it to the wrong
// job. Stripe's retrieve is stubbed (top of file) via `nextStripeSession`, so no
// live key/API call is needed.
// =============================================================================
test("HTTP: verify-payment rejects a public caller whose referenceNo does not match (403)", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const refNo = `TEST-HTTP-VP-AUTH-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    const created = await storage.createQuote(
      { name: "HTTP VerifyAuth Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000009" },
      {
        referenceNo: refNo,
        serviceAddress: "7 Route Rd, Singapore",
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
    quoteId = created.id;

    app = await startApp();

    // No admin session + a referenceNo that does not match the quote ⇒ 403. This
    // guard returns BEFORE Stripe is ever retrieved, so the session stub is moot.
    nextStripeSession = null;
    const res = await fetch(`${app.base}/api/quotes/${quoteId}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "cs_test_stub", referenceNo: "WRONG-REF" }),
    });
    assert.equal(res.status, 403, "a non-admin caller with a mismatched referenceNo must be forbidden");

    // The quote must remain untouched — no payment should have been recorded.
    const after = await storage.getQuote(quoteId!);
    assert.equal(after?.paymentStatus, "unpaid", "a rejected verify must not change payment status");
    assert.equal(after?.depositPaidAt ?? null, null, "a rejected verify must not stamp deposit_paid_at");
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP verify-auth test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

test("HTTP: verify-payment rejects a paid session whose metadata.quoteId points at another quote (403)", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const refNo = `TEST-HTTP-VP-BIND-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    const created = await storage.createQuote(
      { name: "HTTP VerifyBind Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000010" },
      {
        referenceNo: refNo,
        serviceAddress: "8 Route Rd, Singapore",
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
    quoteId = created.id;

    app = await startApp();

    // Ownership passes (correct referenceNo) and Stripe says "paid", but the
    // session is bound to a DIFFERENT quote id — the route must refuse to settle
    // this quote with another quote's payment session.
    nextStripeSession = {
      payment_status: "paid",
      amount_total: 15000,
      metadata: { quoteId: String(quoteId! + 100000), type: "deposit" },
    };
    const res = await fetch(`${app.base}/api/quotes/${quoteId}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "cs_test_stub", referenceNo: refNo }),
    });
    assert.equal(res.status, 403, "a paid session bound to another quote must not settle this quote");
    const body = await res.json();
    assert.match(body.message, /does not match/i, "403 must explain the session does not match the quote");

    const after = await storage.getQuote(quoteId!);
    assert.equal(after?.paymentStatus, "unpaid", "a mismatched session must not change payment status");
    assert.equal(after?.depositPaidAt ?? null, null, "a mismatched session must not stamp deposit_paid_at");
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP verify-bind test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

test("HTTP: verify-payment rejects a session that was never paid and leaves the quote unpaid (400)", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const refNo = `TEST-HTTP-VP-UNPAID-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    // Fixture mirrors a real deposit-requested quote that has NOT been paid.
    const created = await storage.createQuote(
      { name: "HTTP VerifyUnpaid Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000013" },
      {
        referenceNo: refNo,
        serviceAddress: "11 Route Rd, Singapore",
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
    quoteId = created.id;

    app = await startApp();

    // Ownership passes (correct referenceNo) and the session is bound to THIS
    // quote, but Stripe reports payment_status = "unpaid" (the customer
    // abandoned or failed checkout). The route's Stripe-truth guard must refuse
    // to settle: 400 "Payment not completed", and the quote must stay unpaid.
    nextStripeSession = {
      payment_status: "unpaid",
      amount_total: 15000,
      metadata: { quoteId: String(quoteId), type: "deposit" },
    };
    const res = await fetch(`${app.base}/api/quotes/${quoteId}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "cs_test_stub", referenceNo: refNo }),
    });
    assert.equal(res.status, 400, "an unpaid Stripe session must not settle the quote");
    const body = await res.json();
    assert.match(body.message, /not completed/i, "400 must explain the payment was not completed");

    // The crux: an unpaid session must leave the quote untouched — no payment
    // recorded, no deposit timestamp stamped.
    const after = await storage.getQuote(quoteId!);
    assert.equal(after?.paymentStatus, "unpaid", "an unpaid session must not change payment status");
    assert.equal(after?.depositPaidAt ?? null, null, "an unpaid session must not stamp deposit_paid_at");

    // A "no_payment_required" session must be rejected the same way — only a
    // genuinely "paid" session may settle a quote.
    nextStripeSession = {
      payment_status: "no_payment_required",
      amount_total: 0,
      metadata: { quoteId: String(quoteId), type: "deposit" },
    };
    const res2 = await fetch(`${app.base}/api/quotes/${quoteId}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "cs_test_stub", referenceNo: refNo }),
    });
    assert.equal(res2.status, 400, "a no_payment_required session must not settle the quote");

    const after2 = await storage.getQuote(quoteId!);
    assert.equal(after2?.paymentStatus, "unpaid", "a no_payment_required session must not change payment status");
    assert.equal(after2?.depositPaidAt ?? null, null, "a no_payment_required session must not stamp deposit_paid_at");
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP verify-unpaid test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

test("HTTP: verify-payment flips the quote to deposit_paid for a valid, matching, paid session (200)", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const refNo = `TEST-HTTP-VP-OK-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    // total > deposit and no preferred slot ⇒ the deposit payment settles to
    // 'deposit_paid' (not paid_in_full, not auto-booked).
    const created = await storage.createQuote(
      { name: "HTTP VerifyOk Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000011" },
      {
        referenceNo: refNo,
        serviceAddress: "9 Route Rd, Singapore",
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
    quoteId = created.id;

    app = await startApp();

    // Correct referenceNo, Stripe "paid", and metadata.quoteId bound to THIS
    // quote ⇒ the route records the deposit and returns 200.
    nextStripeSession = {
      payment_status: "paid",
      amount_total: 15000, // $150.00 deposit
      metadata: { quoteId: String(quoteId), type: "deposit" },
    };
    const res = await fetch(`${app.base}/api/quotes/${quoteId}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "cs_test_stub", referenceNo: refNo }),
    });
    assert.equal(res.status, 200, "a valid, matching, paid session must verify successfully");
    const body = await res.json();
    assert.equal(body.status, "ok");

    // The crux: the quote must now be flagged as deposit paid, both in the
    // returned payload and when re-read from storage.
    assert.equal(body.quote?.paymentStatus, "deposit_paid", "the returned quote must be deposit_paid");
    const after = await storage.getQuote(quoteId!);
    assert.equal(after?.paymentStatus, "deposit_paid", "the persisted quote must be deposit_paid");
    assert.ok(after?.depositPaidAt, "deposit_paid_at must be stamped after a verified deposit");
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP verify-ok test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

// =============================================================================
// Short payment link  GET /pay/:ref  (deposit) — terms-acceptance bypass guard
//
// The short link is what every deposit email/WhatsApp message points to. Before
// this guard it minted a fresh Stripe deposit session and 302'd straight to it,
// letting a customer pay the first (deposit/full) payment WITHOUT accepting the
// current quote terms — bypassing the dispute-protection gate that the on-page
// Pay button and GET /api/quotes/:id/checkout already enforce.
//
// Now the deposit branch of /pay/:ref runs the SAME predicate
// (termsAcceptedForCurrentVersion): if the current version isn't accepted it
// redirects to the quote page (where acceptance is collected) instead of to
// Stripe. Once accepted, it redirects to the (stubbed) Stripe URL as before.
//
// We use redirect: "manual" so we can read the Location header without actually
// following it to the fake Stripe host.
// =============================================================================
test("HTTP: /pay/:ref deposit link redirects to the quote page until terms are accepted", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const refNo = `TEST-PAYREF-GATE-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    const created = await storage.createQuote(
      { name: "PayRef Gate Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000010" },
      {
        referenceNo: refNo,
        serviceAddress: "10 Route Rd, Singapore",
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
    quoteId = created.id;

    app = await startApp();

    // Unaccepted → must NOT go to Stripe; must land on the quote page (where the
    // customer accepts the current version before the gated checkout runs).
    const blocked = await fetch(`${app.base}/pay/${refNo}`, { redirect: "manual" });
    assert.ok(blocked.status >= 300 && blocked.status < 400, "/pay/:ref must redirect");
    const blockedLoc = blocked.headers.get("location") || "";
    assert.match(
      blockedLoc,
      new RegExp(`/quotes/${quoteId}\\b`),
      "unaccepted deposit short link must redirect to the quote page, not Stripe",
    );
    assert.ok(
      !blockedLoc.includes("checkout.stripe"),
      "unaccepted deposit short link must NOT redirect to a Stripe checkout URL",
    );

    // Customer accepts the current version → the short link may now mint + 302 to
    // the (stubbed) Stripe session, same as the on-page Pay button.
    await storage.recordTermsAcceptance(quoteId!, { version: 1, amount: 300 });
    const allowed = await fetch(`${app.base}/pay/${refNo}`, { redirect: "manual" });
    assert.ok(allowed.status >= 300 && allowed.status < 400, "/pay/:ref must redirect after acceptance");
    assert.equal(
      allowed.headers.get("location"),
      STUB_STRIPE_URL,
      "after acceptance the deposit short link must redirect to the Stripe checkout URL",
    );
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for /pay/:ref gate test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

// =============================================================================
// Short payment link  GET /pay/:ref?type=final  — intentionally UNGATED
//
// The terms-acceptance gate only governs the FIRST (deposit/full) payment. By the
// time a balance is owed the customer has already accepted + paid the deposit, so
// the final/balance branch of /pay/:ref must NOT require (re)acceptance. This test
// locks that intentional behavior in: a quote with an outstanding balance and NO
// terms acceptance recorded must still redirect straight to the (stubbed) Stripe
// balance checkout.
// =============================================================================
test("HTTP: /pay/:ref?type=final is ungated and redirects to Stripe even without terms acceptance", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const { termsAcceptedForCurrentVersion } = await import("../shared/businessRules.ts");
  const refNo = `TEST-PAYREF-FINAL-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    const created = await storage.createQuote(
      { name: "PayRef Final Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000012" },
      {
        referenceNo: refNo,
        serviceAddress: "12 Route Rd, Singapore",
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
    quoteId = created.id;

    // Sanity: no terms acceptance on this quote — proving the final branch does
    // not depend on the gate the deposit branch enforces.
    const q = await storage.getQuote(quoteId!);
    assert.equal(termsAcceptedForCurrentVersion(q as any), false, "fixture must have unaccepted terms");

    app = await startApp();
    const res = await fetch(`${app.base}/pay/${refNo}?type=final`, { redirect: "manual" });
    assert.ok(res.status >= 300 && res.status < 400, "/pay/:ref?type=final must redirect");
    assert.equal(
      res.headers.get("location"),
      STUB_STRIPE_URL,
      "final/balance short link must redirect to Stripe regardless of terms acceptance",
    );
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for /pay/:ref final test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});

// =============================================================================
// Return-from-Stripe verification — the FINAL (balance) branch
//
// The deposit OK test above proves the verify route settles a *first* payment.
// This is its financial mirror: a job that has already paid its deposit comes
// back from Stripe after paying the remaining BALANCE. The route retrieves a
// "paid" session whose metadata.type = "final" and must flip the quote to fully
// settled — updateQuotePayment (server/storage.ts ~916) stamps finalPaidAt,
// sets paymentStatus = 'paid_in_full', and auto-closes the case to 'closed'
// (server/storage.ts ~976-998), then the route fires sendCaseClosedNotifications
// (server/routes.ts ~4821). A regression here would leave a fully-paid job still
// showing money owed, so we assert the persisted settlement, not just the 200.
// =============================================================================
test("HTTP: verify-payment settles the balance and closes the case for a paid final session (200)", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const refNo = `TEST-HTTP-VP-FINAL-${Date.now()}`;
  let quoteId: number | undefined;
  let app: { server: Server; base: string } | undefined;

  try {
    // Fixture: a deposit_paid quote at/above threshold with an outstanding
    // balance — $300 total, $150 deposit already paid, $150 final still owed.
    // depositPaidAt is stamped so this is unambiguously the *balance* return
    // path (not a first payment).
    const created = await storage.createQuote(
      { name: "HTTP VerifyFinal Customer", email: `${refNo.toLowerCase()}@example.test`, phone: "+6580000012" },
      {
        referenceNo: refNo,
        serviceAddress: "10 Route Rd, Singapore",
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
    quoteId = created.id;

    app = await startApp();

    // Correct referenceNo, Stripe "paid", metadata bound to THIS quote, and
    // type = "final" ⇒ the route records the balance payment and returns 200.
    nextStripeSession = {
      payment_status: "paid",
      amount_total: 15000, // $150.00 balance
      metadata: { quoteId: String(quoteId), type: "final" },
    };
    const res = await fetch(`${app.base}/api/quotes/${quoteId}/verify-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: "cs_test_stub", referenceNo: refNo }),
    });
    assert.equal(res.status, 200, "a valid, matching, paid final session must verify successfully");
    const body = await res.json();
    assert.equal(body.status, "ok");

    // The crux: the job must now be fully settled — paid_in_full, the case
    // auto-closed, and the final-paid timestamp stamped — both in the returned
    // payload and when re-read from storage. This is the regression the task
    // guards against: a fully-paid job that still shows money owed.
    assert.equal(body.quote?.paymentStatus, "paid_in_full", "the returned quote must be paid_in_full");
    assert.equal(body.quote?.status, "closed", "the returned quote must be auto-closed after final payment");
    assert.ok(body.quote?.finalPaidAt, "final_paid_at must be stamped on the returned quote");

    const after = await storage.getQuote(quoteId!);
    assert.equal(after?.paymentStatus, "paid_in_full", "the persisted quote must be paid_in_full");
    assert.equal(after?.status, "closed", "the persisted quote must be auto-closed");
    assert.ok(after?.finalPaidAt, "final_paid_at must be stamped after a verified balance payment");
    // The earlier deposit settlement must survive the final payment.
    assert.ok(after?.depositPaidAt, "deposit_paid_at must remain stamped through the final payment");
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for HTTP verify-final test: ${infra}`);
      return;
    }
    throw err;
  } finally {
    if (app) await new Promise<void>((r) => app!.server.close(() => r()));
    if (quoteId !== undefined) {
      try {
        const { storage } = await import("../server/storage.ts");
        await storage.deleteQuote(quoteId);
      } catch {
        /* best-effort cleanup */
      }
    }
  }
});
