// =============================================================================
// Accept-terms → pay gate  +  refund / dispute-log  end-to-end tests
//
// Run: npx tsx --test tests/termsGateRefundFlow.test.ts
//
// These guard the dispute-protection flow the customer + admin pages depend on:
//
//   1. Deposit checkout (server/routes.ts GET /api/quotes/:id/checkout, ~4684)
//      blocks with HTTP 409 { code: "TERMS_NOT_ACCEPTED" } whenever the quote's
//      current version has NOT been accepted. The decision is made by the shared
//      predicate `termsAcceptedForCurrentVersion` (shared/businessRules.ts) — the
//      SAME function the React customer page uses to disable the Pay button and
//      show the amber warning banner. So testing that predicate + the storage
//      acceptance/version writes that feed it covers the gate end to end.
//
//   2. Recording a refund (storage.recordRefund) persists the refund fields AND
//      appends an admin dispute-log event (refund_approved / refund_completed),
//      which is what the QuoteDetail panel renders live after the mutation
//      invalidates its query. Accepting terms also appends a 'terms_accepted'
//      event. listDisputeEvents returns them newest-first.
//
//   3. A legacy quote that was already deposit-paid BEFORE this feature (null
//      terms acceptance, version 1) keeps its paid state intact — the gate
//      governs new deposit checkouts only and never rewrites an existing
//      deposit_paid_at, so a refund on such a quote still works.
//
// The pure-predicate tests always run. The DB-backed tests use the real storage
// layer against DATABASE_URL and SKIP (not fail) when the DB is unreachable or
// not migrated, mirroring the existing storage integration tests in this repo.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { termsAcceptedForCurrentVersion } from "../shared/businessRules.ts";

// ---------------------------------------------------------------------------
// 1) Pure gate predicate — this is the exact 409 / disabled-Pay-button decision.
// ---------------------------------------------------------------------------
test("termsAcceptedForCurrentVersion gates the deposit checkout / Pay button", () => {
  // Fresh unaccepted quote → gate closed (checkout 409, button disabled, banner).
  assert.equal(
    termsAcceptedForCurrentVersion({ version: 1, termsAcceptedAt: null, termsAcceptedVersion: null }),
    false,
    "never-accepted quote must be blocked",
  );

  // Accepted for the current version → gate open (checkout allowed, Pay enabled).
  assert.equal(
    termsAcceptedForCurrentVersion({ version: 1, termsAcceptedAt: new Date(), termsAcceptedVersion: 1 }),
    true,
    "acceptance of the current version must allow payment",
  );

  // Accepted v1 but the quote was edited to v2 → STALE acceptance, gate closed.
  // This is the post-acceptance version-bump race that returns TERMS_NOT_ACCEPTED.
  assert.equal(
    termsAcceptedForCurrentVersion({ version: 2, termsAcceptedAt: new Date(), termsAcceptedVersion: 1 }),
    false,
    "acceptance of an older version must NOT satisfy a newer version",
  );

  // Re-accepted at the new version → gate open again.
  assert.equal(
    termsAcceptedForCurrentVersion({ version: 2, termsAcceptedAt: new Date(), termsAcceptedVersion: 2 }),
    true,
    "re-acceptance of the bumped version must restore payment",
  );

  // Legacy default (version missing → treated as 1) with no acceptance → blocked.
  assert.equal(
    termsAcceptedForCurrentVersion({ termsAcceptedAt: null }),
    false,
    "legacy quote with no acceptance must be blocked at deposit checkout",
  );
});

// ---------------------------------------------------------------------------
// Helper: skip rather than fail when the DB is not reachable / not migrated.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// 2) DB-backed: accept → gate flips → version bump re-blocks → re-accept →
//    refund + dispute-log events. Drives the REAL storage layer.
// ---------------------------------------------------------------------------
test("storage: accept-terms flips the gate, version bump re-blocks, refund logs dispute events", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const refNo = `TEST-GATE-${Date.now()}`;
  let quoteId: number | undefined;

  try {
    const created = await storage.createQuote(
      {
        name: "Gate Test Customer",
        email: `${refNo.toLowerCase()}@example.test`,
        phone: "+6580000001",
      },
      {
        referenceNo: refNo,
        serviceAddress: "1 Gate Rd, Singapore",
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

    // Fresh quote → gate CLOSED (deposit checkout would return 409).
    let q = await storage.getQuote(quoteId!);
    assert.ok(q, "created quote should be readable");
    assert.equal(termsAcceptedForCurrentVersion(q as any), false, "new quote must be gated");

    // Customer accepts the current version → gate OPEN.
    await storage.recordTermsAcceptance(quoteId!, { version: 1, amount: 300 });
    q = await storage.getQuote(quoteId!);
    assert.equal(termsAcceptedForCurrentVersion(q as any), true, "acceptance must open the gate");
    assert.equal((q as any).termsAcceptedVersion, 1);

    // Admin edits the quote → version bumps → prior acceptance is STALE → gate CLOSED.
    await storage.bumpQuoteVersion(quoteId!);
    q = await storage.getQuote(quoteId!);
    assert.equal((q as any).version, 2, "bump should advance the version");
    assert.equal((q as any).superseded, true, "bump should mark the quote superseded");
    assert.equal(
      termsAcceptedForCurrentVersion(q as any),
      false,
      "version bump must re-engage the gate (deposit checkout 409)",
    );

    // Customer re-accepts the new version → gate OPEN again, superseded cleared.
    await storage.recordTermsAcceptance(quoteId!, { version: 2, amount: 300 });
    q = await storage.getQuote(quoteId!);
    assert.equal(termsAcceptedForCurrentVersion(q as any), true, "re-acceptance must reopen the gate");
    assert.equal((q as any).superseded, false, "re-acceptance must clear superseded");
    assert.equal((q as any).termsAcceptedVersion, 2);

    // Admin records a refund (approved) → fields persist + dispute event appended.
    const refunded = await storage.recordRefund(quoteId!, {
      refundApprovedAmount: "150.00",
      refundMethod: "PayNow",
      refundReason: "Customer cancelled within policy",
      refundInternalNote: "Approved by ops",
    });
    assert.ok(refunded, "recordRefund should return the updated quote");
    assert.equal((refunded as any).refundApprovedAmount, "150.00");
    assert.equal((refunded as any).refundMethod, "PayNow");

    // Admin marks the refund completed → a second dispute event.
    await storage.recordRefund(quoteId!, {
      refundApprovedAmount: "150.00",
      refundCompletedAt: new Date(),
    });

    // The dispute log (what the QuoteDetail panel renders) holds the trail.
    const events = await storage.listDisputeEvents(quoteId!);
    const types = events.map((e) => e.eventType);
    assert.ok(types.includes("terms_accepted"), "acceptance must be logged");
    assert.ok(types.includes("refund_approved"), "refund approval must be logged");
    assert.ok(types.includes("refund_completed"), "refund completion must be logged");
    // Two acceptances happened (v1 + v2).
    assert.equal(
      types.filter((x) => x === "terms_accepted").length,
      2,
      "both acceptances (v1 and v2) must be logged",
    );
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for terms-gate integration test: ${infra}`);
      return;
    }
    throw err;
  } finally {
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

// ---------------------------------------------------------------------------
// 3) DB-backed: a legacy already-deposit-paid quote is unaffected by the gate.
//    Its paid timestamp survives, and a refund on it still works.
// ---------------------------------------------------------------------------
test("storage: legacy already-deposit-paid quote is unaffected by the terms gate", async (t) => {
  const { storage } = await import("../server/storage.ts");
  const refNo = `TEST-LEGACY-${Date.now()}`;
  let quoteId: number | undefined;
  const paidAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // a week ago

  try {
    const created = await storage.createQuote(
      {
        name: "Legacy Paid Customer",
        email: `${refNo.toLowerCase()}@example.test`,
        phone: "+6580000002",
      },
      {
        referenceNo: refNo,
        serviceAddress: "9 Legacy Ave, Singapore",
        status: "deposit_paid",
        subtotal: "300",
        total: "300",
        depositAmount: "150",
        finalAmount: "150",
        version: 1,
        paymentStatus: "deposit_paid",
        depositPaidAt: paidAt,
      } as any,
      [],
    );
    quoteId = created.id;

    const q = await storage.getQuote(quoteId!);
    assert.ok(q, "legacy quote should be readable");
    // It was created before the feature → no acceptance recorded.
    assert.equal((q as any).termsAcceptedAt ?? null, null, "legacy quote has no acceptance");
    // It is already paid, so the deposit-checkout gate never runs for it; its
    // paid state is intact and the gate does not rewrite payment fields.
    assert.equal((q as any).paymentStatus, "deposit_paid");
    assert.ok((q as any).depositPaidAt, "legacy deposit_paid_at must be preserved");

    // Admin can still refund a legacy paid quote; doing so must NOT disturb the
    // original deposit_paid_at (the gate/refund flow never re-collects payment).
    const refunded = await storage.recordRefund(quoteId!, {
      refundApprovedAmount: "150.00",
      refundMethod: "Bank Transfer",
      refundReason: "Goodwill",
    });
    assert.ok(refunded, "refund on a legacy paid quote should succeed");
    assert.equal((refunded as any).paymentStatus, "deposit_paid", "payment status untouched by refund record");
    assert.ok((refunded as any).depositPaidAt, "deposit_paid_at must remain set after refund");
  } catch (err: any) {
    const infra = isInfraError(err);
    if (infra) {
      t.skip(`DB not migrated/reachable for legacy-quote integration test: ${infra}`);
      return;
    }
    throw err;
  } finally {
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
