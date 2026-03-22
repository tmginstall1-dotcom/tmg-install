// =============================================================================
// TMG Install — Central Pricing Engine
// All tunable constants live in PricingConfig. Never scatter magic numbers.
// =============================================================================

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------
export const PricingConfig = {
  fallback: {
    dismantleMultiplier: 0.6,        // dismantle       = install * 0.6 when no catalog entry
    relocateMultiplier: 1.5,         // relocate        = install * 1.5 when no catalog entry
    disposeMultiplier: 0.65,         // dispose-only    = install * 0.65 when no catalog entry
    dismantleDisposeMultiplier: 0.95, // dismantle+dispose bundle = install * 0.95 when no catalog entry
    genericFallback: 150,            // SGD per unit when absolutely no catalog price found
  },
  bulkDiscount: [
    { minQty: 100, pct: 0.15 },
    { minQty: 50,  pct: 0.10 },
    { minQty: 10,  pct: 0.05 },
    { minQty: 1,   pct: 0.00 },
  ] as { minQty: number; pct: number }[],
  floor: {
    perFloorNoLift: 15,   // SGD per floor above ground without lift
    perFloorWithLift: 5,  // SGD per floor above ground with lift
  },
  access: {
    mediumPct: 0.10, // +10% of labor-after-discount
    hardPct: 0.20,   // +20% of labor-after-discount
  },
  transport: {
    minFee: 80,
    baseFee: 80,
    includedKm: 5,
    tiers: [
      { upTo: 10, ratePerKm: 5 },        // 0–10 extra km: $5/km
      { upTo: 20, ratePerKm: 4 },        // 10–20 extra km: $4/km
      { upTo: Infinity, ratePerKm: 3 },  // 20km+ extra: $3/km
    ] as { upTo: number; ratePerKm: number }[],
  },
  hiace: {
    capacityM3: 6.0,  // Toyota Hiace usable cargo volume per trip (cubic metres)
  },
  deposit: {
    pct: 0.50, // 50% deposit, 50% final
  },
};

// --------------------------------------------------------------------------
// Input / output types
// --------------------------------------------------------------------------

export type ServiceType = 'install' | 'dismantle' | 'relocate' | 'dispose' | 'dismantle_dispose';

export interface PricingCatalogEntry {
  name: string;
  serviceType: ServiceType;
  basePrice: number;
}

export interface PricingItem {
  name: string;
  serviceType: ServiceType;
  quantity: number;
  unitPrice: number; // 0 = no catalog price available (will trigger fallback)
  volumeM3?: number; // cubic metres per unit (optional — used for trip calculation)
}

export interface PricingFloor {
  level: number; // floor number (0 = ground)
  hasLift: boolean;
}

export interface PricingInput {
  items: PricingItem[];
  needsRelocation: boolean;
  floors: PricingFloor[];
  accessDifficulty: 'easy' | 'medium' | 'hard';
  distanceKm: number;
  catalogEntries?: PricingCatalogEntry[]; // full catalog for fallback multiplier lookup
}

export interface ItemLine {
  name: string;
  serviceType: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  fallbackUsed: boolean;
  volumeM3?: number;
}

export interface FeeLine {
  label: string;
  amount: number;
}

export interface PricingResult {
  itemLines: ItemLine[];
  feeLines: FeeLine[];
  discountLine: { label: string; amount: number } | null;
  laborSubtotal: number;
  logisticsSubtotal: number;
  discountAmount: number;
  grandTotal: number;
  depositAmount: number;
  finalAmount: number;
  requiresAdminReview: boolean;
  reviewReasons: string[];
  // Volume / trip data
  totalVolumeM3: number;        // sum of all item volumes (0 if no volume data)
  numTrips: number;             // Toyota Hiace trips needed (1 if no volume data)
  hasVolumeData: boolean;       // true if at least one item has volumeM3
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function round2(n: number): number {
  if (!isFinite(n) || isNaN(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function calcTransportFee(distanceKm: number): number {
  const cfg = PricingConfig.transport;
  const billableKm = Math.max(0, distanceKm - cfg.includedKm);

  let tierCost = 0;
  let remaining = billableKm;
  let prevUpTo = 0;

  for (const tier of cfg.tiers) {
    if (remaining <= 0) break;
    const bucketSize = tier.upTo === Infinity ? remaining : Math.min(remaining, tier.upTo - prevUpTo);
    tierCost += bucketSize * tier.ratePerKm;
    remaining -= bucketSize;
    if (tier.upTo !== Infinity) prevUpTo = tier.upTo;
  }

  const rawFee = cfg.baseFee + tierCost;
  return round2(Math.max(cfg.minFee, rawFee));
}

/** Look up a catalog install price for an item name (for fallback multipliers). */
function findInstallPrice(itemName: string, catalogEntries?: PricingCatalogEntry[]): number | null {
  if (!catalogEntries || catalogEntries.length === 0) return null;
  const lc = itemName.toLowerCase().trim();
  const entry = catalogEntries.find(e =>
    e.serviceType === 'install' && (
      e.name.toLowerCase().trim() === lc ||
      e.name.toLowerCase().includes(lc) ||
      lc.includes(e.name.toLowerCase().trim())
    )
  );
  return entry && entry.basePrice > 0 ? entry.basePrice : null;
}

// --------------------------------------------------------------------------
// Main pricing function
// --------------------------------------------------------------------------

export function computePricing(input: PricingInput): PricingResult {
  const cfg = PricingConfig;
  const reviewReasons: string[] = [];
  let requiresAdminReview = false;

  // ── A) Resolve effective unit price per item ────────────────────────────

  const itemLines: ItemLine[] = input.items.map(item => {
    const qty = Math.max(1, Math.round(item.quantity));
    let unitPrice = item.unitPrice;
    let fallbackUsed = false;

    if (!(unitPrice > 0)) {
      fallbackUsed = true;
      // Try catalog: find install_price and apply multiplier
      const installPrice = findInstallPrice(item.name, input.catalogEntries);
      if (installPrice && installPrice > 0) {
        if (item.serviceType === 'dismantle') {
          unitPrice = installPrice * cfg.fallback.dismantleMultiplier;
        } else if (item.serviceType === 'relocate') {
          unitPrice = installPrice * cfg.fallback.relocateMultiplier;
        } else if (item.serviceType === 'dispose') {
          unitPrice = installPrice * cfg.fallback.disposeMultiplier;
        } else if (item.serviceType === 'dismantle_dispose') {
          unitPrice = installPrice * cfg.fallback.dismantleDisposeMultiplier;
        } else {
          unitPrice = installPrice;
        }
      } else {
        // Generic fallback
        const base = cfg.fallback.genericFallback;
        if (item.serviceType === 'dismantle') unitPrice = base * cfg.fallback.dismantleMultiplier;
        else if (item.serviceType === 'relocate') unitPrice = base * cfg.fallback.relocateMultiplier;
        else if (item.serviceType === 'dispose') unitPrice = base * cfg.fallback.disposeMultiplier;
        else if (item.serviceType === 'dismantle_dispose') unitPrice = base * cfg.fallback.dismantleDisposeMultiplier;
        else unitPrice = base;
      }
    }

    unitPrice = round2(unitPrice);
    if (isNaN(unitPrice) || !isFinite(unitPrice)) {
      unitPrice = 0;
      requiresAdminReview = true;
      reviewReasons.push(`Price calculation error for: ${item.name}`);
    }

    return {
      name: item.name,
      serviceType: item.serviceType,
      quantity: qty,
      unitPrice,
      subtotal: round2(unitPrice * qty),
      fallbackUsed,
      volumeM3: item.volumeM3,
    };
  });

  // ── B) Labor subtotal ───────────────────────────────────────────────────

  const laborSubtotal = round2(itemLines.reduce((s, l) => s + l.subtotal, 0));

  // ── C) Bulk discount (applies to labor only) ────────────────────────────

  const totalQty = itemLines.reduce((s, l) => s + l.quantity, 0);
  const discountPct = [...cfg.bulkDiscount].sort((a, b) => b.minQty - a.minQty)
    .find(t => totalQty >= t.minQty)?.pct ?? 0;
  const discountAmount = round2(laborSubtotal * discountPct);
  const discountLine = discountAmount > 0
    ? { label: `Bulk Discount (${Math.round(discountPct * 100)}%)`, amount: -discountAmount }
    : null;

  const laborAfterDiscount = round2(laborSubtotal - discountAmount);

  // ── D) Volume / trip calculation ────────────────────────────────────────

  const hasVolumeData = itemLines.some(l => l.volumeM3 != null && l.volumeM3! > 0);
  const totalVolumeM3 = hasVolumeData
    ? round2(itemLines.reduce((s, l) => s + (l.volumeM3 ?? 0) * l.quantity, 0))
    : 0;
  const numTrips = hasVolumeData
    ? Math.max(1, Math.ceil(totalVolumeM3 / cfg.hiace.capacityM3))
    : 1;

  // ── E) Fee lines ────────────────────────────────────────────────────────

  const feeLines: FeeLine[] = [];

  // Transport fee (relocation only) — multiplied by number of trips
  if (input.needsRelocation) {
    const feePerTrip = calcTransportFee(input.distanceKm);
    const transportFee = round2(feePerTrip * numTrips);
    if (numTrips > 1) {
      feeLines.push({
        label: `Transport / Relocation Logistics (${numTrips} trips × $${feePerTrip.toFixed(0)})`,
        amount: transportFee,
      });
    } else {
      feeLines.push({ label: 'Transport / Relocation Logistics', amount: transportFee });
    }
    if (input.distanceKm === 0) {
      requiresAdminReview = true;
      reviewReasons.push('Distance calculation failed — transport fee is provisional at minimum rate');
    }
  }

  // Floor / stairs surcharge
  const floorSurcharge = input.floors.reduce((s, f) => {
    const lvl = Math.max(0, Math.floor(f.level));
    if (lvl === 0) return s;
    const rate = f.hasLift ? cfg.floor.perFloorWithLift : cfg.floor.perFloorNoLift;
    return s + lvl * rate;
  }, 0);
  if (floorSurcharge > 0) {
    feeLines.push({ label: 'Stairs / Floor Access', amount: round2(floorSurcharge) });
  }

  // Access difficulty surcharge (based on labor after discount)
  let accessSurcharge = 0;
  if (input.accessDifficulty === 'medium') {
    accessSurcharge = round2(laborAfterDiscount * cfg.access.mediumPct);
  } else if (input.accessDifficulty === 'hard') {
    accessSurcharge = round2(laborAfterDiscount * cfg.access.hardPct);
  }
  if (accessSurcharge > 0) {
    feeLines.push({
      label: `Access Difficulty (${input.accessDifficulty === 'medium' ? 'Moderate' : 'Difficult'})`,
      amount: accessSurcharge,
    });
  }

  // ── F) Totals ───────────────────────────────────────────────────────────

  const logisticsSubtotal = round2(feeLines.reduce((s, f) => s + f.amount, 0));
  const grandTotal = round2(laborAfterDiscount + logisticsSubtotal);
  const depositAmount = round2(grandTotal * cfg.deposit.pct);
  const finalAmount = round2(grandTotal - depositAmount);

  return {
    itemLines,
    feeLines,
    discountLine,
    laborSubtotal,
    logisticsSubtotal,
    discountAmount,
    grandTotal,
    depositAmount,
    finalAmount,
    requiresAdminReview,
    reviewReasons,
    totalVolumeM3,
    numTrips,
    hasVolumeData,
  };
}

/** Summarise a PricingResult for storage in the quotes table. */
export function pricingToQuoteFields(result: PricingResult) {
  return {
    subtotal: result.laborSubtotal.toFixed(2),
    discount: result.discountAmount.toFixed(2),
    transportFee: result.logisticsSubtotal.toFixed(2),
    total: result.grandTotal.toFixed(2),
    depositAmount: result.depositAmount.toFixed(2),
    finalAmount: result.finalAmount.toFixed(2),
  };
}
