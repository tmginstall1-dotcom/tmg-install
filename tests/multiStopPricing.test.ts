// =============================================================================
// Multi-stop relocation pricing — unit tests
//
// Run: npx tsx --test tests/multiStopPricing.test.ts
//
// Guards the single source of truth for multi-stop quote pricing
// (shared/pricing.ts). The multi-stop feature feeds `logisticsSubtotal` into the
// stored `transportFee` column and is re-rendered across ~9 display surfaces, so
// any drift between the helper's arithmetic and the documented buckets silently
// over/under-quotes customers. These tests pin the exact buckets:
//   transportFee = perTrip × numTrips   (skipped for same-property moves)
//   volumetricFee = tiered per-m³ handling
//   additionalStopFee = extraStops × PricingConfig.multiStop.additionalStopFee
//   logisticsSubtotal = transport + volumetric + additionalStop
//   grandTotal = laborSubtotal + logisticsSubtotal
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PricingConfig,
  calcTransportFee,
  calcNumTrips,
  calcVolumetricHandlingFee,
  calcAdditionalStopFee,
  computeMultiStopRelocationPrice,
} from "../shared/pricing.ts";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

test("calcAdditionalStopFee: linear in extra stops, clamped, floored", () => {
  const rate = PricingConfig.multiStop.additionalStopFee;
  assert.equal(calcAdditionalStopFee(0), 0);
  assert.equal(calcAdditionalStopFee(1), rate);
  assert.equal(calcAdditionalStopFee(3), 3 * rate);
  // Negative / fractional inputs are clamped at 0 and floored.
  assert.equal(calcAdditionalStopFee(-2), 0);
  assert.equal(calcAdditionalStopFee(2.9), 2 * rate);
});

test("computeMultiStopRelocationPrice: 3-pickup / split drop-off, multi-trip volume", () => {
  // 3 pickups + 2 drop-offs => extraStops = (3-1) + (2-1) = 3
  const laborSubtotal = 500;
  const totalVolumeM3 = 13; // ceil(13/6) = 3 trips
  const distanceKm = 20;
  const extraStops = 3;

  const r = computeMultiStopRelocationPrice({
    laborSubtotal,
    totalVolumeM3,
    distanceKm,
    extraStops,
  });

  const feePerTrip = calcTransportFee(distanceKm);
  const expectedTrips = calcNumTrips(totalVolumeM3);
  const expectedTransport = round2(feePerTrip * expectedTrips);
  const expectedVolumetric = calcVolumetricHandlingFee(totalVolumeM3);
  const expectedExtraStop = calcAdditionalStopFee(extraStops);
  const expectedLogistics = round2(
    expectedTransport + expectedVolumetric + expectedExtraStop,
  );

  assert.equal(r.numTrips, 3);
  assert.equal(r.numTrips, expectedTrips);
  assert.equal(r.transportFee, expectedTransport);
  assert.equal(r.volumetricFee, expectedVolumetric);
  assert.equal(r.additionalStopFee, expectedExtraStop);
  assert.equal(r.additionalStopFee, 3 * PricingConfig.multiStop.additionalStopFee);
  assert.equal(r.logisticsSubtotal, expectedLogistics);
  // Core reconciliation invariant: grandTotal = labour + logistics bucket.
  assert.equal(r.grandTotal, round2(laborSubtotal + expectedLogistics));
  // The transportFee column stores the FULL logistics bucket (see memory note).
  assert.equal(
    r.logisticsSubtotal,
    round2(r.transportFee + r.volumetricFee + r.additionalStopFee),
  );

  // The breakdown lines must sum to the logistics subtotal so the admin UI and
  // the stored transportFee never disagree.
  const breakdownSum = round2(r.breakdown.reduce((s, l) => s + l.amount, 0));
  assert.equal(breakdownSum, r.logisticsSubtotal);
});

test("computeMultiStopRelocationPrice: same-property move skips transport entirely", () => {
  const r = computeMultiStopRelocationPrice({
    laborSubtotal: 200,
    totalVolumeM3: 3,
    distanceKm: 25, // ignored when samePropertyMove
    extraStops: 1,
    samePropertyMove: true,
  });

  assert.equal(r.transportFee, 0);
  // Volumetric + extra-stop fees still apply within the same property.
  assert.equal(r.volumetricFee, calcVolumetricHandlingFee(3));
  assert.equal(r.additionalStopFee, PricingConfig.multiStop.additionalStopFee);
  assert.equal(
    r.logisticsSubtotal,
    round2(r.volumetricFee + r.additionalStopFee),
  );
  assert.equal(r.grandTotal, round2(200 + r.logisticsSubtotal));
  // No transport line should appear in the breakdown.
  assert.ok(!r.breakdown.some((l) => /Transport/i.test(l.label)));
});

test("computeMultiStopRelocationPrice: simple 1-pickup/1-dropoff has no extra-stop fee", () => {
  const r = computeMultiStopRelocationPrice({
    laborSubtotal: 150,
    totalVolumeM3: 1, // single trip
    distanceKm: 5,
    extraStops: 0,
  });

  assert.equal(r.numTrips, 1);
  assert.equal(r.additionalStopFee, 0);
  assert.equal(r.transportFee, calcTransportFee(5));
  assert.equal(r.volumetricFee, calcVolumetricHandlingFee(1));
  assert.equal(
    r.logisticsSubtotal,
    round2(r.transportFee + r.volumetricFee),
  );
  assert.equal(r.grandTotal, round2(150 + r.logisticsSubtotal));
  assert.ok(!r.breakdown.some((l) => /Additional Stops/i.test(l.label)));
});

test("computeMultiStopRelocationPrice: defensive clamping of bad inputs", () => {
  const r = computeMultiStopRelocationPrice({
    laborSubtotal: -50,
    totalVolumeM3: -3,
    distanceKm: -10,
    extraStops: -1,
  });
  assert.equal(r.laborSubtotal, 0);
  assert.equal(r.volumetricFee, 0);
  assert.equal(r.additionalStopFee, 0);
  // Distance clamps to 0 but a single trip still incurs the minimum transport fee.
  assert.equal(r.numTrips, 1);
  assert.equal(r.transportFee, calcTransportFee(0));
  assert.equal(r.transportFee, PricingConfig.transport.minFee);
  assert.equal(r.grandTotal, r.logisticsSubtotal);
});
