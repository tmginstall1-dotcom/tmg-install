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
Object.getPrototypeOf(new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions).create =
  async () => ({ url: STUB_STRIPE_URL });

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
