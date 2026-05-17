// =============================================================================
// TMG Install — Central Pricing Engine
// All tunable constants live in PricingConfig. Never scatter magic numbers.
// =============================================================================

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------
export const PricingConfig = {
  callout: {
    fee: 39.90,   // SGD — applied to every non-relocation job (replaces the old $180 minimum)
  },
  fallback: {
    dismantleMultiplier: 0.6,        // dismantle       = install * 0.6 when no catalog entry
    relocateMultiplier: 1.5,         // relocate        = install * 1.5 when no catalog entry
    disposeMultiplier: 0.65,         // dispose-only    = install * 0.65 when no catalog entry
    dismantleDisposeMultiplier: 0.95, // dismantle+dispose bundle = install * 0.95 when no catalog entry
    genericFallback: 150,            // SGD per unit when absolutely no catalog price found
    relocateDRDiscount: 0.40,        // D&R labor discount for relocation — 40% off install+dismantle (bundled with transport)
    drCarryFallbackMultiplier: 0.90, // When install/dismantle prices missing: D&R = Carry × this (~bundle-discounted equivalent)
  },
  bulkDiscount: [
    { minQty: 100, pct: 0.15 },
    { minQty: 50,  pct: 0.10 },
    { minQty: 10,  pct: 0.05 },
    { minQty: 1,   pct: 0.00 },
  ] as { minQty: number; pct: number }[],
  // Per-hole line items (e.g. "Walk-in / Built-in Wardrobe (per hole)") are
  // priced per drilled hole, so a single 120-hole job is really one wardrobe,
  // not 120 separate items. To stop a single wardrobe from instantly hitting
  // the 100+ tier, each per-hole unit is weighted at 1/5 of a regular item
  // when picking the bulk-discount tier. Example: 120 holes → 24 weighted
  // → falls in the 10+ tier (5%) instead of the 100+ tier (15%).
  perHoleBulkWeight: 0.2,
  floor: {
    perFloorNoLift: 15,   // SGD per floor above ground without lift
    perFloorWithLift: 5,  // SGD per floor above ground with lift
  },
  access: {
    mediumPct: 0.10, // +10% of labor-after-discount
    hardPct: 0.20,   // +20% of labor-after-discount
  },
  transport: {
    vanBase: 28,        // Base fare (includes first 3 km)
    helperFee: 30,      // Driver + 1 helper surcharge (standard for furniture jobs)
    includedKm: 3,      // First 3 km included in van base fare
    ratePerKm: 0.50,    // Per km after first 3 km
    cbdSurcharge: 5,    // CBD area surcharge (Mon–Sat 6:30am–8:30pm)
    get minFee() { return this.vanBase + this.helperFee; }, // $58 minimum
  },
  overtime: {
    // Relocation-only jobs: base price covers 120 minutes of crew time (matches Lalamove 2-hour window)
    capMinutes: 120,    // Included minutes before overtime kicks in
    blockMinutes: 30,   // Charge in 30-minute blocks after the cap
    blockRate: 30,      // SGD per 30-min block (2 crew × $5/person/10 min = $10/10 min)
    maxCharge: 200,     // Maximum overtime charge per job
  },
  hiace: {
    capacityM3: 6.0,  // Toyota Hiace usable cargo volume per trip (cubic metres)
  },
  carryHandling: {
    // Per-cubic-metre crew labour fee for Carry Only jobs, on top of the
    // transport fee. Transport covers van + 2 movers for up to 2 hours, which
    // is fine for a few items — but a large carry load (many items, multiple
    // trips) burns real crew time the transport fee alone doesn't recover.
    // Scaling labour with carry volume keeps small jobs cheap and large jobs
    // honest. Only counts volume from non-special-handling carry-only items
    // (special-handling SKUs already keep their full catalog rate).
    perM3: 20,
  },
  deposit: {
    pct: 0.50, // 50% deposit, 50% final
  },
};

// --------------------------------------------------------------------------
// Bulk-discount weighting helper
// --------------------------------------------------------------------------
// Per-hole units (e.g. wall-hung wardrobes priced per drilled hole) shouldn't
// flood the bulk-discount tier table — a single 120-hole wardrobe is one job,
// not 120 items. This helper applies the perHoleBulkWeight to such lines so
// tier selection reflects "true item count" rather than physical hole count.
export function bulkWeightedQty(items: { name: string; quantity: number }[]): number {
  const w = PricingConfig.perHoleBulkWeight;
  return items.reduce((sum, it) => {
    const isPerHole = /per hole/i.test(it.name || "");
    return sum + (it.quantity || 0) * (isPerHole ? w : 1);
  }, 0);
}

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
  carryOnly?: boolean; // Carry-only relocate flag (informational; per-item labor still charged from catalog basePrice). Skips fallback so unmatched carry items default to $0 instead of generic estimate.
  sku?: string; // Optional catalog SKU — used to detect SPECIAL_HANDLING items so the carry-cap rule can skip them.
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

/**
 * Compute the Dismantle & Reinstall (D&R) price for a relocation item.
 *
 * Business logic:
 *   • D&R = (install + dismantle) × (1 - relocateDRDiscount)   — 40% off bundle deal.
 *     This is INTENTIONALLY discounted: customer commits to the full service
 *     (dismantle + transport + reinstall) and gets a combo rate.
 *   • Carry Only is priced separately by raw weight/labor — it can be HIGHER
 *     than D&R for heavy 2-man items like king bed frames or massage chairs,
 *     because the customer skips assembly work but pays for pure heavy carry.
 *   • Fallback: if install/dismantle prices are missing, D&R ≈ carry × 0.90
 *     (still bundle-discounted relative to standalone carry).
 *
 * @param installPrice    Catalog install price (omit if not present)
 * @param dismantlePrice  Catalog dismantle price (omit if not present)
 * @param carryPrice      Catalog relocate (Carry Only) price
 */
/**
 * SKUs of items that physically WON'T fit in a standard HDB lift when intact,
 * OR require 3+ movers, OR need special handling (corner protection, hoist, etc.).
 *
 * For these items we cannot quote a "carry-and-go" price honestly — the
 * customer needs an on-site survey. The catalog UI shows a clear warning
 * badge instead of just a price.
 */
export const SPECIAL_HANDLING_SKUS: ReadonlySet<string> = new Set([
  // Won't fit in standard HDB / condo lift when intact
  "KB-RELOCATE",            // King bed frame intact (~2m × 2.1m)
  "PAX-RELOCATE",           // IKEA Pax wardrobe intact
  "LSOFA-RELOCATE",         // L-shaped / corner sofa
  "L-DESK-RELOCATE",        // L-shaped executive desk
  "CT-RELOCATE",            // Conference table
  "CT-01",                  // Conference table (alt SKU)

  // Heavy 2–3 man + corner protection / floor protection
  "MASS-RELOCATE",          // Massage chair (premium models 80–130 kg)
  "FRIDGE4-RELOCATE",       // 4-door French refrigerator
  "STND-RELOCATE",          // Sit-stand desk (motor unit, fragile)

  // Specialty — always needs survey
  "PIANO-UP-RELOCATE",      // Upright piano
  "PIANO-GR-RELOCATE",      // Grand piano
  "POOL-RELOCATE",          // Pool / billiard table
  "SAFE-RELOCATE",          // Safe / gun safe
  "PHONE-BOOTH-RELOCATE",   // Solo phone booth
  "DUO-BOOTH-RELOCATE",     // Duo phone booth
  "POD4-RELOCATE",          // 4-person meeting pod

  // Large kitchen islands
  "IKEA-KI-M-RELOCATE",     // Medium kitchen island
  "IKEA-KI-L-RELOCATE",     // Large kitchen island
]);

/**
 * Returns true if the given SKU needs a site survey / special handling.
 * The UI should show a "Won't fit in lift / needs survey" badge instead of
 * presenting the carry-only price as a casual walk-and-go option.
 */
export function requiresSpecialHandling(sku?: string | null): boolean {
  if (!sku) return false;
  return SPECIAL_HANDLING_SKUS.has(sku);
}

export function computeDRPrice(installPrice?: number, dismantlePrice?: number, carryPrice?: number): number {
  const cfg = PricingConfig.fallback;
  if (installPrice && dismantlePrice) {
    return round2((installPrice + dismantlePrice) * (1 - cfg.relocateDRDiscount));
  }
  // No install/dismantle data — fall back to carry × multiplier (still bundle-discounted)
  const carry = carryPrice && carryPrice > 0 ? carryPrice : 0;
  return round2(carry * cfg.drCarryFallbackMultiplier);
}

/**
 * Effective Carry-Only price.
 *
 * Rule: for normal items, Carry Only labour is $0 — the transport fee
 * already includes a 2-man crew for up to 2 hours (see PricingConfig.
 * overtime.capMinutes), so charging per-item labour on top double-bills
 * the customer. The job IS fundamentally "van + 2 movers loading and
 * unloading"; no extra per-item work happens in carry mode.
 *
 * Heavy / oversized items in SPECIAL_HANDLING_SKUS (king bed, PAX,
 * L-sofa, massage chair, piano, fridge, etc.) keep their catalog rate
 * because they genuinely need a 3rd mover, corner protection, hoisting,
 * or specialty equipment that goes beyond the standard 2-man crew.
 *
 * (installPrice and dismantlePrice are accepted for backward compat with
 * the previous D&R-cap signature but are no longer used.)
 */
export function effectiveCarryPrice(
  _installPrice: number | undefined,
  _dismantlePrice: number | undefined,
  carryPrice: number,
  sku?: string | null,
): number {
  if (!(carryPrice > 0)) return 0;
  if (requiresSpecialHandling(sku)) return round2(carryPrice);
  // Normal item — labour is bundled into the transport fee.
  return 0;
}

/** Transport pricing — 2.4m Van (Toyota Hiace), Singapore
 *  Base $28 (first 3 km) + $0.50/km after + $30 helper = $58 minimum
 */
export function calcTransportFee(distanceKm: number): number {
  const cfg = PricingConfig.transport;
  const extraKm = Math.max(0, distanceKm - cfg.includedKm);
  const rawFee = cfg.vanBase + cfg.helperFee + extraKm * cfg.ratePerKm;
  return round2(Math.max(cfg.minFee, rawFee));
}

/** Calculate overtime charge for relocation jobs that exceed the 120-min cap.
 *  Returns { blocks, charge } where charge = blocks × $30, capped at $200.
 */
export function calcOvertimeCharge(actualMinutes: number): { blocks: number; charge: number } {
  const cfg = PricingConfig.overtime;
  if (actualMinutes <= cfg.capMinutes) return { blocks: 0, charge: 0 };
  const blocks = Math.ceil((actualMinutes - cfg.capMinutes) / cfg.blockMinutes);
  const charge = Math.min(blocks * cfg.blockRate, cfg.maxCharge);
  return { blocks, charge };
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
    // Carry Only mode now charges the catalog basePrice (passed in via item.unitPrice).
    // Heavy items like king beds & massage chairs need 2-man labour even without dismantle —
    // a flat $0 was undercharging these jobs vs. Singapore market rates.
    let unitPrice = item.unitPrice;
    let fallbackUsed = false;

    // Fairness cap: for non-special-handling items, Carry Only can never cost
    // more than the full D&R bundle (otherwise the customer pays more for
    // less work — see screenshots of single/queen bed at $80/$130 carry vs.
    // $63/$84 D&R). Look up install + dismantle prices from the catalog and
    // delegate the cap to effectiveCarryPrice().
    if (item.carryOnly && unitPrice > 0 && !requiresSpecialHandling(item.sku)) {
      const inst = findInstallPrice(item.name, input.catalogEntries);
      const dis  = (input.catalogEntries || []).find(e =>
        e.serviceType === 'dismantle' && e.name.toLowerCase().trim() === item.name.toLowerCase().trim()
      );
      const dismantlePrice = dis && dis.basePrice > 0 ? dis.basePrice : undefined;
      const installPrice   = inst && inst > 0 ? inst : undefined;
      unitPrice = effectiveCarryPrice(installPrice, dismantlePrice, unitPrice, item.sku);
    }

    if (!item.carryOnly && !(unitPrice > 0)) {
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
  const weightedQty = bulkWeightedQty(itemLines.map(l => ({ name: l.name, quantity: l.quantity })));
  const discountPct = [...cfg.bulkDiscount].sort((a, b) => b.minQty - a.minQty)
    .find(t => weightedQty >= t.minQty)?.pct ?? 0;
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

  // Mobilisation & coordination fee (non-relocation jobs only)
  // Replaces the old $180 minimum — transparent $60 base fee instead.
  if (!input.needsRelocation) {
    feeLines.push({ label: 'Mobilisation & Coordination', amount: cfg.callout.fee });
  }

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

    // Carry-handling fee — per-m³ crew labour charge for Carry Only items.
    // Per-item carry labour is $0 by design (transport covers the standard
    // 2-man crew for up to 2 hours), but a big carry load burns real crew
    // time that the flat transport fee alone doesn't recover. Scaling the
    // labour charge with carry volume keeps small jobs cheap and large
    // multi-trip carry jobs honest. Special-handling SKUs are excluded —
    // they already keep their full catalog carry rate.
    const carryVolumeM3 = round2(
      input.items.reduce((s, it) => {
        if (!it.carryOnly) return s;
        if (requiresSpecialHandling(it.sku)) return s;
        // Clamp volume — a tampered/negative client payload must not reduce
        // the carry-handling fee. Non-finite values are treated as zero.
        const rawVol = it.volumeM3 ?? 0;
        const vol = isFinite(rawVol) && rawVol > 0 ? rawVol : 0;
        const qty = Math.max(1, Math.round(it.quantity));
        return s + vol * qty;
      }, 0),
    );
    if (carryVolumeM3 > 0 && cfg.carryHandling.perM3 > 0) {
      const carryHandlingFee = round2(carryVolumeM3 * cfg.carryHandling.perM3);
      if (carryHandlingFee > 0) {
        feeLines.push({
          label: `Carry Handling (${carryVolumeM3.toFixed(2)} m³ × $${cfg.carryHandling.perM3})`,
          amount: carryHandlingFee,
        });
      }
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
