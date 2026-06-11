// =============================================================================
// Multi-stop relocation — create / edit reconciliation
//
// Run: npx tsx --test tests/multiStopReconciliation.test.ts
//
// The multi-stop feature stores the FULL logistics bucket
// (transport + volumetric + extra-stop fee = logisticsSubtotal) into the quote's
// `transportFee` column, and relies on editQuote's total recompute to keep the
// stored total reconciled with the pricing helper. The recompute formula lives
// in server/storage.ts (editQuote):
//
//     total = subtotal − promo − goodwill + transportFee + secondDayFee
//
// where, for a multi-stop quote, subtotal = laborSubtotal and the transportFee
// column = logisticsSubtotal. So storing logisticsSubtotal into transportFee must
// make the recomputed total equal computeMultiStopRelocationPrice's grandTotal.
//
// This file has two layers:
//   1. A pure invariant test that mirrors the editQuote formula and always runs.
//      It catches drift between the pricing helper's buckets and the documented
//      reconciliation arithmetic without depending on DB state.
//   2. A DB-backed integration test that drives the real storage.createQuote /
//      editQuote. It skips gracefully when the local database has not been
//      migrated with the multi-stop columns (e.g. `stops`), so it never produces
//      a false failure on a drifted environment.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeMultiStopRelocationPrice,
  calcSecondDayContinuation,
} from "../shared/pricing.ts";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Mirrors the editQuote total recompute in server/storage.ts. Kept in lockstep
// with that formula so this test fails loudly if either the pricing buckets or
// the reconciliation arithmetic drift apart.
function recomputeStoredTotal(args: {
  laborSubtotal: number; // subtotal column = sum of non-discount line items
  transportFeeColumn: number; // transportFee column = logisticsSubtotal
  promoDiscount?: number;
  goodwillDiscount?: number;
  secondDayFee?: number;
}): number {
  const {
    laborSubtotal,
    transportFeeColumn,
    promoDiscount = 0,
    goodwillDiscount = 0,
    secondDayFee = 0,
  } = args;
  return round2(
    Math.max(
      0,
      laborSubtotal - promoDiscount - goodwillDiscount + transportFeeColumn + secondDayFee,
    ),
  );
}

const MULTI_STOP_INPUT = {
  laborSubtotal: 500,
  totalVolumeM3: 13, // 3 trips
  distanceKm: 20,
  extraStops: 3, // 3 pickups + 2 drop-offs
};

test("invariant: storing logisticsSubtotal in transportFee reconciles total to grandTotal", () => {
  const priced = computeMultiStopRelocationPrice(MULTI_STOP_INPUT);

  // transportFee column receives the full logistics bucket; subtotal = labour.
  const storedTotal = recomputeStoredTotal({
    laborSubtotal: priced.laborSubtotal,
    transportFeeColumn: priced.logisticsSubtotal,
  });

  assert.equal(storedTotal, priced.grandTotal);
  assert.equal(
    storedTotal,
    round2(priced.laborSubtotal + priced.logisticsSubtotal),
  );
});

test("invariant: promo + goodwill + second-day fold into the same reconciled total", () => {
  const priced = computeMultiStopRelocationPrice(MULTI_STOP_INPUT);
  const promoDiscount = 40;
  const goodwillDiscount = 25;
  const secondDayFee = calcSecondDayContinuation(true, 2, 3).fee;

  const storedTotal = recomputeStoredTotal({
    laborSubtotal: priced.laborSubtotal,
    transportFeeColumn: priced.logisticsSubtotal,
    promoDiscount,
    goodwillDiscount,
    secondDayFee,
  });

  // grandTotal already = labour + logistics; discounts/second-day adjust on top.
  assert.equal(
    storedTotal,
    round2(priced.grandTotal - promoDiscount - goodwillDiscount + secondDayFee),
  );
});

test("invariant: same-property move stores reduced logistics bucket and still reconciles", () => {
  const priced = computeMultiStopRelocationPrice({
    ...MULTI_STOP_INPUT,
    samePropertyMove: true,
  });
  assert.equal(priced.transportFee, 0);

  const storedTotal = recomputeStoredTotal({
    laborSubtotal: priced.laborSubtotal,
    transportFeeColumn: priced.logisticsSubtotal,
  });
  assert.equal(storedTotal, priced.grandTotal);
});

// ---------------------------------------------------------------------------
// DB-backed integration test (skips on un-migrated local databases).
// ---------------------------------------------------------------------------
test("storage.createQuote + editQuote persist transportFee = logisticsSubtotal and reconcile", async (t) => {
  const { storage } = await import("../server/storage.ts");
  type QuoteStop = import("../shared/schema.ts").QuoteStop;

  const stops: QuoteStop[] = [
    { id: "p1", kind: "pickup", address: "1 Pickup Rd", postalCode: "100001", floor: "2", hasLift: true },
    { id: "p2", kind: "pickup", address: "2 Pickup Rd", postalCode: "100002", floor: "5", hasLift: true },
    { id: "p3", kind: "pickup", address: "3 Pickup Rd", postalCode: "100003", floor: "1", hasLift: false },
    { id: "d1", kind: "dropoff", address: "10 Dropoff Ave", postalCode: "200001", floor: "3", hasLift: true },
    { id: "d2", kind: "dropoff", address: "20 Dropoff Ave", postalCode: "200002", floor: "8", hasLift: true },
  ];

  const priced = computeMultiStopRelocationPrice(MULTI_STOP_INPUT);
  const items = [
    {
      originalDescription: "Multi-stop relocation labour",
      serviceType: "manual" as const,
      quantity: 1,
      unitPrice: MULTI_STOP_INPUT.laborSubtotal.toFixed(2),
      subtotal: MULTI_STOP_INPUT.laborSubtotal.toFixed(2),
      fromStopId: "p1",
      toStopId: "d1",
    },
  ];

  const refNo = `TEST-MS-${Date.now()}`;
  let quoteId: number | undefined;

  try {
    const created = await storage.createQuote(
      {
        name: "Multi-stop Test Customer",
        email: `${refNo.toLowerCase()}@example.test`,
        phone: "+6580000000",
      },
      {
        referenceNo: refNo,
        serviceAddress: stops[0].address,
        pickupAddress: stops[0].address,
        dropoffAddress: stops[3].address,
        stops,
        distanceKm: String(MULTI_STOP_INPUT.distanceKm),
        transportFee: priced.logisticsSubtotal.toFixed(2),
        volumetricFee: priced.volumetricFee.toFixed(2),
        status: "booked",
        subtotal: MULTI_STOP_INPUT.laborSubtotal.toFixed(2),
        total: priced.grandTotal.toFixed(2),
      } as any,
      items,
    );
    quoteId = created.id;

    // 1) transportFee column holds the full logistics subtotal verbatim.
    assert.equal(Number(created.transportFee), priced.logisticsSubtotal);
    assert.equal(Number(created.volumetricFee), priced.volumetricFee);
    assert.equal(Number(created.total), priced.grandTotal);

    // 2) editQuote recompute (passing items marks pricing as touched).
    const edited = await storage.editQuote(quoteId!, { items });
    assert.ok(edited, "editQuote should return the updated quote");
    assert.equal(Number(edited!.subtotal), MULTI_STOP_INPUT.laborSubtotal);
    assert.equal(Number(edited!.transportFee), priced.logisticsSubtotal);
    assert.equal(Number(edited!.total), priced.grandTotal);

    // 3) Re-price the logistics bucket on edit; total must track it.
    const repriced = computeMultiStopRelocationPrice({
      ...MULTI_STOP_INPUT,
      totalVolumeM3: 7, // 2 trips
      distanceKm: 30,
    });
    const editedAgain = await storage.editQuote(quoteId!, {
      quoteUpdates: {
        transportFee: repriced.logisticsSubtotal.toFixed(2),
        volumetricFee: repriced.volumetricFee.toFixed(2),
      } as any,
      items,
    });
    assert.ok(editedAgain);
    assert.equal(Number(editedAgain!.transportFee), repriced.logisticsSubtotal);
    assert.equal(Number(editedAgain!.total), repriced.grandTotal);
  } catch (err: any) {
    const cause = err?.cause?.message || err?.message || String(err);
    const code = err?.cause?.code;
    // Schema drift (missing multi-stop columns) or no DB reachable → skip rather
    // than fail. The pure invariant tests above still guard the arithmetic.
    if (
      code === "42703" || // undefined_column
      code === "42P01" || // undefined_table
      code === "ECONNREFUSED" ||
      /does not exist|ECONNREFUSED|connect|DATABASE_URL/i.test(cause)
    ) {
      t.skip(`DB not migrated/reachable for multi-stop integration test: ${cause}`);
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
