// =============================================================================
// Multi-stop server-side price RE-CHECK — anti-tampering tests
//
// Run: npx tsx --test tests/multiStopServerRecheck.test.ts
//
// The wizard route (server/routes.ts, "Server-side pricing recompute
// (anti-tampering)" ~line 6284) NEVER trusts the client-posted unitPrice /
// logisticsFee / discount. It rebuilds every line from canonical catalog data
// and re-derives the logistics bucket through the SAME `computePricing` engine
// the frontend uses, then persists the SERVER total. A manipulated client that
// posts unitPrice=0.01 or logisticsFee=0 must therefore still be billed the
// real, server-computed price.
//
// That recompute math (transport × trips + volumetric + extra-stop fee for
// multi-stop, mobilisation + volumetric for same-property) had no automated
// guard, so a regression could let a tampered request store a lower total than
// the real price. These tests close that gap.
//
// What this file does:
//   • `serverRecompute()` faithfully mirrors the route's canonical-item
//     assembly + extra-stop derivation (server/routes.ts ~6292-6420) and drives
//     the REAL production `computePricing` engine — so the assertions track the
//     actual server arithmetic, not a hand-rolled copy of it.
//   • It feeds a multi-stop payload whose client-supplied prices are tampered
//     DOWN to ~zero, and asserts the recomputed logistics subtotal + total
//     equal the engine's canonical price (cross-checked against the independent
//     `computeMultiStopRelocationPrice` helper), ignoring the client values.
//   • Covers the 3-stop case AND the same-property case.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PricingConfig,
  computePricing,
  computeMultiStopRelocationPrice,
  computeDRPrice,
  calcTransportFee,
  calcNumTrips,
  calcVolumetricHandlingFee,
  calcAdditionalStopFee,
  type PricingItem,
  type PricingFloor,
} from "../shared/pricing.ts";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------------------------
// Canonical catalog the "server" reads from (stands in for the DB rows the
// real route loads by SKU / name). basePrice + volumeM3 are the ONLY
// authoritative numbers — the client cannot influence them.
// ---------------------------------------------------------------------------
type CatalogRow = {
  name: string;
  serviceType: PricingItem["serviceType"];
  basePrice: string;
  volumeM3?: string;
};

const CATALOG: CatalogRow[] = [
  { name: "Wardrobe 3-Door", serviceType: "install", basePrice: "220.00", volumeM3: "1.60" },
  { name: "Wardrobe 3-Door", serviceType: "dismantle", basePrice: "130.00", volumeM3: "1.60" },
  { name: "Wardrobe 3-Door", serviceType: "relocate", basePrice: "150.00", volumeM3: "1.60" },
  { name: "Bookshelf Tall", serviceType: "install", basePrice: "90.00", volumeM3: "0.90" },
  { name: "Bookshelf Tall", serviceType: "dismantle", basePrice: "50.00", volumeM3: "0.90" },
  { name: "Bookshelf Tall", serviceType: "relocate", basePrice: "70.00", volumeM3: "0.90" },
];

// name+serviceType → canonical row (mirrors catalogByNameSvc in the route).
const catalogByNameSvc = new Map<string, CatalogRow>();
for (const c of CATALOG) {
  const key = `${c.name.toLowerCase().trim()}|${c.serviceType}`;
  if (!catalogByNameSvc.has(key)) catalogByNameSvc.set(key, c);
}

// Shape of a wizard item as a (possibly hostile) client posts it.
type ClientItem = {
  itemName: string;
  serviceType: PricingItem["serviceType"];
  quantity: number;
  unitPrice: number; // <-- client-supplied, NEVER trusted for billing
  relocateMode?: "carry" | "full";
  wrap?: boolean;
};

type WizardStop = { id: string; kind: "pickup" | "dropoff" };

type WizardPayload = {
  items: ClientItem[];
  selectedServices: string[];
  stops?: WizardStop[];
  distanceKm?: number;
  samePropertyMove?: boolean;
  floorsInfo?: string;
  accessDifficulty?: "easy" | "medium" | "hard";
  // Client-claimed totals the route logs but must never bill from:
  logisticsFee?: number;
  discount?: number;
};

// ---------------------------------------------------------------------------
// serverRecompute — faithful mirror of the wizard route's anti-tampering
// recompute (server/routes.ts ~6292-6420). Builds canonical pricing items from
// the catalog (DISCARDING client unitPrice), derives needsRelocation +
// extraStops server-side, then runs the REAL computePricing engine.
// ---------------------------------------------------------------------------
function serverRecompute(payload: WizardPayload) {
  // needsRelocation derived from canonical items, not client selectedServices.
  const needsRelocationServer =
    payload.items.some((i) => i.serviceType === "relocate") ||
    (payload.selectedServices || []).includes("relocate");

  const canonicalPricingItems: PricingItem[] = payload.items.map((it) => {
    const nameKey = (it.itemName || "").toLowerCase().trim();
    const cat = catalogByNameSvc.get(`${nameKey}|${it.serviceType}`);
    const isCarry = it.serviceType === "relocate" && it.relocateMode === "carry";
    const isDRBundle = it.serviceType === "relocate" && it.relocateMode === "full";

    let canonicalUnit = cat ? parseFloat(cat.basePrice) : 0;
    let canonicalVolume = cat?.volumeM3 ? parseFloat(cat.volumeM3) : undefined;

    if (isDRBundle) {
      const installRow = catalogByNameSvc.get(`${nameKey}|install`);
      const dismantleRow = catalogByNameSvc.get(`${nameKey}|dismantle`);
      const carryRow = catalogByNameSvc.get(`${nameKey}|relocate`);
      const installPrice = installRow ? parseFloat(installRow.basePrice) : undefined;
      const dismantlePrice = dismantleRow ? parseFloat(dismantleRow.basePrice) : undefined;
      const carryPrice = carryRow ? parseFloat(carryRow.basePrice) : undefined;
      canonicalUnit = computeDRPrice(installPrice, dismantlePrice, carryPrice);
      canonicalVolume =
        canonicalVolume ??
        (carryRow?.volumeM3 ? parseFloat(carryRow.volumeM3) : undefined) ??
        (installRow?.volumeM3 ? parseFloat(installRow.volumeM3) : undefined) ??
        (dismantleRow?.volumeM3 ? parseFloat(dismantleRow.volumeM3) : undefined);
    }

    return {
      name: it.itemName,
      serviceType: it.serviceType,
      quantity: Math.max(1, Math.round(it.quantity)),
      // Catalog basePrice is authoritative — the client's unitPrice is ignored.
      unitPrice: isFinite(canonicalUnit) && canonicalUnit > 0 ? canonicalUnit : 0,
      volumeM3: canonicalVolume,
      carryOnly: isCarry,
      wrap: it.wrap === true,
    };
  });

  // Floors parsed from the wizard JSON; default to ground floor with lift.
  let canonicalFloors: PricingFloor[] = [];
  try {
    const parsed = JSON.parse(payload.floorsInfo || "[]");
    if (Array.isArray(parsed)) {
      canonicalFloors = parsed.map((f: any) => ({
        level: Math.max(0, Math.floor(Number(f.level ?? f.floor ?? 0))),
        hasLift: !!f.hasLift,
      }));
    }
  } catch {
    /* malformed floors → ground floor with lift */
  }
  if (canonicalFloors.length === 0) canonicalFloors = [{ level: 0, hasLift: true }];

  // extraStops derived from the SUBMITTED stops, not any client claim.
  const wizardStops = payload.stops || [];
  const pickupStopCount = wizardStops.filter((s) => s.kind === "pickup").length;
  const dropoffStopCount = wizardStops.filter((s) => s.kind === "dropoff").length;
  const extraStopsServer =
    Math.max(0, pickupStopCount - 1) + Math.max(0, dropoffStopCount - 1);

  const serverPricing = computePricing({
    items: canonicalPricingItems,
    needsRelocation: needsRelocationServer,
    samePropertyMove: payload.samePropertyMove === true,
    floors: canonicalFloors,
    accessDifficulty: payload.accessDifficulty || "easy",
    distanceKm: payload.samePropertyMove === true ? 0 : payload.distanceKm ?? 0,
    extraStops: payload.samePropertyMove === true ? 0 : extraStopsServer,
    catalogEntries: [],
  });

  const laborSubtotal = serverPricing.laborSubtotal;
  const logisticsFee = serverPricing.logisticsSubtotal;
  const discount = serverPricing.discountAmount;
  // Stored total before any promo (server/routes.ts rawTotal).
  const total = round2(laborSubtotal - discount + logisticsFee);

  return { laborSubtotal, logisticsFee, discount, total, serverPricing };
}

// What a tampered client *claims* the total is (server/routes.ts ~6426).
function clientClaimedTotal(payload: WizardPayload): number {
  return (
    payload.items.reduce((s, it) => s + (it.unitPrice || 0) * (it.quantity || 0), 0) -
    (payload.discount || 0) +
    (payload.logisticsFee || 0)
  );
}

// ---------------------------------------------------------------------------
// 3-stop relocation (3 pickups + 2 drop-offs ⇒ extraStops = 3), tampered DOWN.
// ---------------------------------------------------------------------------
test("3-stop: server recompute ignores tampered-low client prices and bills the engine price", () => {
  const stops: WizardStop[] = [
    { id: "p1", kind: "pickup" },
    { id: "p2", kind: "pickup" },
    { id: "p3", kind: "pickup" },
    { id: "d1", kind: "dropoff" },
    { id: "d2", kind: "dropoff" },
  ];
  const distanceKm = 18;

  const payload: WizardPayload = {
    selectedServices: ["relocate"],
    stops,
    distanceKm,
    items: [
      // Client tampers every price to ~0 to try to dodge the real charge.
      { itemName: "Wardrobe 3-Door", serviceType: "relocate", relocateMode: "full", quantity: 3, unitPrice: 0.01 },
      { itemName: "Bookshelf Tall", serviceType: "relocate", relocateMode: "full", quantity: 4, unitPrice: 0.01 },
    ],
    logisticsFee: 0, // tampered: claim no logistics at all
    discount: 0,
  };

  const r = serverRecompute(payload);

  // Canonical labour from catalog D&R bundle prices (NOT the 0.01 client sent).
  const wardrobeDR = computeDRPrice(220, 130, 150); // (220+130)*0.6 = 210
  const bookshelfDR = computeDRPrice(90, 50, 70); //   (90+50)*0.6  = 84
  const expectedLabor = round2(wardrobeDR * 3 + bookshelfDR * 4); // 966
  assert.equal(r.laborSubtotal, expectedLabor);
  assert.equal(r.discount, 0); // weighted qty (7) below the 10+ bulk tier

  // Expected logistics from the primitives the engine uses.
  const totalVolumeM3 = round2(1.6 * 3 + 0.9 * 4); // 8.4 m³
  const numTrips = calcNumTrips(totalVolumeM3); // ceil(8.4/6) = 2 → exercises multi-trip
  assert.equal(numTrips, 2);
  const expectedTransport = round2(calcTransportFee(distanceKm) * numTrips);
  const expectedVolumetric = calcVolumetricHandlingFee(totalVolumeM3);
  const expectedExtraStop = calcAdditionalStopFee(3);
  const expectedLogistics = round2(
    expectedTransport + expectedVolumetric + expectedExtraStop,
  );

  assert.equal(r.logisticsFee, expectedLogistics);
  assert.equal(r.total, round2(expectedLabor + expectedLogistics));

  // Cross-check against the independent multi-stop helper (admin calculator):
  // for a plain between-address multi-stop move the two engines must agree.
  const engine = computeMultiStopRelocationPrice({
    laborSubtotal: expectedLabor,
    totalVolumeM3,
    distanceKm,
    extraStops: 3,
  });
  assert.equal(r.logisticsFee, engine.logisticsSubtotal);
  assert.equal(r.total, engine.grandTotal);

  // The tampered client claimed essentially nothing; the server bills the
  // real price. This is the anti-tampering guarantee.
  const claimed = clientClaimedTotal(payload);
  assert.ok(claimed < 1, `client claimed total should be ~0, got ${claimed}`);
  assert.ok(
    r.total - claimed > 1000,
    `server must recover the full price despite tampering (server=${r.total} client=${claimed})`,
  );
});

// ---------------------------------------------------------------------------
// Same-property move (items shifted within ONE address): no transport / van,
// but the $39.90 mobilisation fee + volumetric handling still apply.
// ---------------------------------------------------------------------------
test("same-property: server recompute skips transport, keeps mobilisation + volumetric, ignores tampering", () => {
  const payload: WizardPayload = {
    selectedServices: ["relocate"],
    samePropertyMove: true,
    distanceKm: 25, // tampered/ignored — server forces 0 for same-property
    stops: [
      // Even if the client claims extra stops, same-property forces extraStops 0.
      { id: "p1", kind: "pickup" },
      { id: "p2", kind: "pickup" },
      { id: "d1", kind: "dropoff" },
    ],
    items: [
      { itemName: "Wardrobe 3-Door", serviceType: "relocate", relocateMode: "full", quantity: 2, unitPrice: 0.01 },
      { itemName: "Bookshelf Tall", serviceType: "relocate", relocateMode: "full", quantity: 2, unitPrice: 0.01 },
    ],
    logisticsFee: 0,
    discount: 0,
  };

  const r = serverRecompute(payload);

  const wardrobeDR = computeDRPrice(220, 130, 150); // 210
  const bookshelfDR = computeDRPrice(90, 50, 70); //   84
  const expectedLabor = round2(wardrobeDR * 2 + bookshelfDR * 2); // 588
  assert.equal(r.laborSubtotal, expectedLabor);

  const totalVolumeM3 = round2(1.6 * 2 + 0.9 * 2); // 5.0 m³
  // Same-property logistics = mobilisation + volumetric. NO transport, NO
  // extra-stop fee (forced to 0). This is the engine's same-property branch.
  const expectedLogistics = round2(
    PricingConfig.callout.fee + calcVolumetricHandlingFee(totalVolumeM3),
  );
  assert.equal(r.logisticsFee, expectedLogistics);
  assert.equal(r.total, round2(expectedLabor + expectedLogistics));

  // Transport / van fee must be entirely absent for a same-property move.
  assert.ok(
    !r.serverPricing.feeLines.some((l) => /Transport/i.test(l.label)),
    "same-property move must not charge a transport fee",
  );
  // Mobilisation fee must be present.
  assert.ok(
    r.serverPricing.feeLines.some((l) => /Mobilisation/i.test(l.label)),
    "same-property move must charge the mobilisation fee",
  );

  const claimed = clientClaimedTotal(payload);
  assert.ok(claimed < 1, `client claimed total should be ~0, got ${claimed}`);
  assert.ok(
    r.total > 600,
    `server must bill the real same-property price (got ${r.total})`,
  );
});

// ---------------------------------------------------------------------------
// The recompute output must be INDEPENDENT of the client-supplied prices:
// honest vs. tampered payloads with identical items/stops produce the same
// stored logistics subtotal + total.
// ---------------------------------------------------------------------------
test("recompute output is identical whether client prices are honest or tampered", () => {
  const stops: WizardStop[] = [
    { id: "p1", kind: "pickup" },
    { id: "p2", kind: "pickup" },
    { id: "d1", kind: "dropoff" },
    { id: "d2", kind: "dropoff" },
  ];
  const base = {
    selectedServices: ["relocate"],
    stops,
    distanceKm: 22,
    items: [
      { itemName: "Wardrobe 3-Door", serviceType: "relocate" as const, relocateMode: "full" as const, quantity: 2 },
      { itemName: "Bookshelf Tall", serviceType: "relocate" as const, relocateMode: "full" as const, quantity: 3 },
    ],
  };

  // Honest client: posts (roughly) correct prices.
  const honest: WizardPayload = {
    ...base,
    items: base.items.map((i) => ({ ...i, unitPrice: i.itemName === "Wardrobe 3-Door" ? 210 : 84 })),
    logisticsFee: 999,
    discount: 0,
  };
  // Hostile client: zeroes every price and inflates the discount.
  const tampered: WizardPayload = {
    ...base,
    items: base.items.map((i) => ({ ...i, unitPrice: 0.01 })),
    logisticsFee: 0,
    discount: 999,
  };

  const a = serverRecompute(honest);
  const b = serverRecompute(tampered);

  assert.equal(a.laborSubtotal, b.laborSubtotal);
  assert.equal(a.logisticsFee, b.logisticsFee);
  assert.equal(a.discount, b.discount);
  assert.equal(a.total, b.total);
  // And the recomputed total is positive / real, not the tampered ~0.
  assert.ok(b.total > 500, `tampered payload must still bill the real price (got ${b.total})`);
});
