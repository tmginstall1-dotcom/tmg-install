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
    // Overtime is measured against each job's own SCHEDULED crew-hours (derived
    // from the job scope — see getJobSchedule), not a flat window. capMinutes is
    // only a fallback when no per-job schedule is supplied.
    capMinutes: 120,    // Fallback included minutes when no scheduled time is given
    blockMinutes: 30,   // Charge in 30-minute blocks once the scheduled time is used up
    // Live rate is computed per job as crewSize × overtime.perPersonHourlyRate
    // ($50 per mover, per hour) → e.g. 2 movers = $50 per 30-min block, 3 movers = $75.
    perPersonHourlyRate: 50, // SGD per mover, per hour beyond scheduled crew time
    blockRate: 30,      // Legacy 2-crew default (unused by live calc); rate now scales with crew size
    // NO cap — every extra hour is fully recovered at $50 per mover per hour.
  },
  hiace: {
    capacityM3: 6.0,  // Toyota Hiace usable cargo volume per trip (cubic metres)
  },
  multiStop: {
    // Multi-stop relocation — flat fee charged for every stop BEYOND the first
    // pickup and the first drop-off. Singapore June-2026 market: full-service
    // movers ~$50/extra location, app platforms +$8–$17/stop. TMG is van/budget
    // tier, so $30 sits sensibly between the two. ONE configurable constant —
    // never hard-code the per-stop fee inline.
    additionalStopFee: 30, // SGD per extra stop
  },
  carryHandling: {
    // Tiered per-cubic-metre crew labour fee for Carry Only jobs, on top of
    // the transport fee. Transport covers van + 2 movers for up to 2 hours,
    // which is fine for a few items — but a large carry load (many items,
    // multiple trips) burns real crew time the transport fee alone doesn't
    // recover. Tiered rate keeps small Singapore jobs price-competitive with
    // Lalamove-style services while still recovering crew time on big multi-
    // trip moves. Only counts volume from non-special-handling carry-only
    // items (special-handling SKUs already keep their full catalog rate).
    //
    // Tier breakdown — applied as a marginal rate (like income tax bands):
    //   0.00 – 2.00 m³  →  $10 / m³   (small carries, competitive)
    //   2.00 – 5.00 m³  →  $15 / m³   (mid-size loads)
    //   5.00 m³+        →  $20 / m³   (big multi-trip jobs)
    perM3: 20, // legacy field kept for backwards compatibility; tiered rate below is the source of truth
    tiers: [
      { upTo: 2,        ratePerM3: 10 },
      { upTo: 5,        ratePerM3: 15 },
      { upTo: Infinity, ratePerM3: 20 },
    ] as Array<{ upTo: number; ratePerM3: number }>,
  },
  wrapping: {
    // Optional bubble-wrap & corner-protection charge per item. Customer can
    // tick "Wrap this item" on any line in the estimate wizard; we charge a
    // flat $10 per wrapped UNIT (i.e. $10 × quantity). Covers materials +
    // wrap time on site.
    perItem: 10,
  },
  deposit: {
    pct: 0.50, // 50% deposit, 50% final
    // Site-wide rule: jobs cheaper than this threshold must be paid IN FULL to
    // confirm the booking (no 50/50 split). Jobs at or above it keep the usual
    // 50% deposit now + 50% final after the job is done.
    fullPaymentThreshold: 150,
  },
  secondDay: {
    // Second-Day Continuation — when a single-day job spills into the next day
    // because of on-site access delays (loading-bay parking, lift congestion).
    // The crew has to be re-dispatched (van + movers) and a fresh slot burned.
    returnFee: 120,            // SGD flat re-mobilisation fee charged once when the job continues to Day 2
    perPersonHourlyRate: 50,   // SGD per mover, per hour of actual Day-2 on-site time ($50/person/hr; matches the overtime rate)
    defaultCrewSize: 2,        // standard van crew = 2 movers; admin can raise this per job for bigger teams
    hourlyRate: 100,           // legacy effective 2-man rate (perPersonHourlyRate × defaultCrewSize) — kept for back-compat
  },
  // --------------------------------------------------------------------------
  // Cost-floor / margin guard — the "never lose money" safety net.
  // --------------------------------------------------------------------------
  // We estimate the real cost of running a job (crew time × loaded hourly cost
  // + the van/fuel portion of transport) and work out the lowest price that
  // still leaves the target profit margin. If a quote is priced below that
  // floor, the engine FLAGS it for admin review (warn-only — it never silently
  // changes the customer's price). All numbers are tunable here.
  //
  // The loaded mover cost is based on TMG's own crew cost rate ($30/mover/hour)
  // so the floor is grounded in real business numbers, not guesses. This is a
  // COST basis and is independent of the customer-facing overtime rate (which is
  // higher — see overtime.perPersonHourlyRate).
  costFloor: {
    enabled: true,
    marginPct: 0.30,             // target profit as a % of price (30% = aggressive/competitive)
    loadedMoverHourlyCost: 30,   // SGD — fully-loaded cost per mover per hour (wages + on-costs)
    defaultCrewSize: 2,          // standard van crew
    absoluteMinJobPrice: 0,      // SGD — no hard minimum; TMG takes small jobs too. Margin guard still applies.
    enforce: false,              // false = warn only (admin decides); true = would auto-raise
    // Crew-time estimate model (hours):
    baseHours: 1.0,              // fixed setup + load/unload + paperwork per job
    hoursPerM3: 0.6,             // handling time per cubic metre carried
    hoursPerDRItem: 0.75,        // extra time per dismantle-&-reinstall (relocate) item
    hoursPerCarryItem: 0.15,     // extra time per carry-only relocate item
    hoursPerLaborItem: 0.4,      // extra time per install / dismantle / dispose item
    travelHoursPerKm: 0.04,      // round-trip driving + buffer (~25 km/h effective)
  },
};

// --------------------------------------------------------------------------
// Bulk-discount weighting helper
// --------------------------------------------------------------------------
// Per-hole units (e.g. wall-hung wardrobes priced per drilled hole) shouldn't
// flood the bulk-discount tier table — a single 120-hole wardrobe is one job,
// not 120 items. This helper applies the perHoleBulkWeight to such lines so
// tier selection reflects "true item count" rather than physical hole count.
// --------------------------------------------------------------------------
// Full-payment threshold helper
// --------------------------------------------------------------------------
// Single source of truth for the "small job = pay in full" rule used across the
// pricing engine, server routes, emails and UI. A job whose grand total is below
// this threshold must be paid IN FULL up front to confirm the booking; there is
// no separate final payment. Jobs at or above it keep the 50% deposit + 50%
// final split.
export const FULL_PAYMENT_THRESHOLD = PricingConfig.deposit.fullPaymentThreshold;

/** True when a job total is small enough that it must be paid in full up front. */
export function requiresFullUpfront(total: number): boolean {
  const t = typeof total === "number" ? total : parseFloat(String(total ?? 0));
  return isFinite(t) && t > 0 && t < FULL_PAYMENT_THRESHOLD;
}

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
  wrap?: boolean; // Customer opted in to bubble-wrap protection for this item. Charged $10 × quantity via wrapping fee.
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
  /**
   * Same-Property Move — items are physically shifted within the SAME address
   * (e.g. between rooms, between floors of the same condo, during a renovation).
   *
   * When true, the engine:
   *   • adds the $39.90 mobilisation & coordination fee (crew still needs to be
   *     dispatched even though no transport is involved), AND
   *   • SKIPS the transport / distance fee entirely (no van rental, no km charge),
   *   • but KEEPS the $20/m³ carry-handling fee for carry-only items so heavy
   *     shifts still pay for the crew labour they consume.
   *
   * `needsRelocation` should also be true so the existing per-item carry / D&R
   * pricing branches continue to apply.
   */
  samePropertyMove?: boolean;
  /**
   * Multi-stop relocation — number of stops BEYOND the first pickup and first
   * drop-off, i.e. (pickups − 1) + (dropoffs − 1), clamped at 0. Default 0 so
   * single-leg quotes produce exactly the same numbers as before.
   */
  extraStops?: number;
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

/**
 * Result of the cost-floor / margin check for a job. `belowFloor` is the signal
 * that a quote would not make the target margin — the UI surfaces this as a
 * warning so the admin can raise the price or accept it knowingly.
 */
export interface JobMargin {
  enabled: boolean;
  estimatedHours: number;   // estimated crew-hours for the job
  crewSize: number;         // movers assumed
  estimatedCost: number;    // crew labour + vehicle cost (SGD)
  marginFloor: number;      // cost / (1 - targetMargin)
  absoluteMin: number;      // hard minimum job price
  costFloor: number;        // max(absoluteMin, marginFloor) — the safe minimum price
  grandTotal: number;       // what the job is actually priced at
  belowFloor: boolean;      // true = priced below the safe minimum (loss risk)
  shortfall: number;        // how far below the floor (0 if healthy)
  marginPct: number;        // target margin used
  actualMarginPct: number;  // realised margin at the current price
}

export interface PricingResult {
  itemLines: ItemLine[];
  feeLines: FeeLine[];
  discountLine: { label: string; amount: number } | null;
  laborSubtotal: number;
  logisticsSubtotal: number;
  volumetricFee: number;        // per-m³ handling portion of logisticsSubtotal (0 if none)
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
  margin: JobMargin;            // cost-floor / margin guard result
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function round2(n: number): number {
  if (!isFinite(n) || isNaN(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Second-Day Continuation charge.
 *
 * Used when a job scheduled for a single day cannot finish and the crew must
 * return the next day because of on-site access delays (loading-bay parking,
 * lift congestion, etc.). The charge has two parts:
 *   • a flat return / re-mobilisation fee (van + crew re-dispatch + fresh slot)
 *   • an hourly charge for the actual Day-2 crew time worked
 * Hours are recorded after Day 2 finishes, so the admin never has to guess the
 * duration up front.
 */
export function calcSecondDayContinuation(enabled: boolean, hours: number | string, crewSize?: number | string) {
  const cfg = PricingConfig.secondDay;
  // Crew size is admin-adjustable per job (bigger jobs go out with more movers).
  // Falls back to the standard 2-man van crew so old quotes keep their pricing.
  const crew = Math.max(1, Math.round(Number(crewSize) || cfg.defaultCrewSize));
  // Effective hourly rate = per-mover rate × number of movers on Day 2.
  const hourlyRate = round2(cfg.perPersonHourlyRate * crew);
  if (!enabled) {
    return { enabled: false, returnFee: 0, hours: 0, crewSize: crew, perPersonHourlyRate: cfg.perPersonHourlyRate, hourlyRate, labour: 0, fee: 0 };
  }
  const h = Math.max(0, Number(hours) || 0);
  const labour = round2(h * hourlyRate);
  return {
    enabled: true,
    returnFee: cfg.returnFee,
    hours: h,
    crewSize: crew,
    perPersonHourlyRate: cfg.perPersonHourlyRate,
    hourlyRate,
    labour,
    fee: round2(cfg.returnFee + labour),
  };
}

/* -------------------------------------------------------------------------- */
/* On-Site Time Clock                                                         */
/* -------------------------------------------------------------------------- */

/** One on-site session, recorded when staff tap "Arrived" / "Going off site". */
export interface SiteVisit {
  arrivedAt: string;       // ISO timestamp when staff arrived on site
  leftAt?: string | null;  // ISO timestamp when they went off site (null = still on site)
  byUserId?: number;       // staff user who recorded it
}

export interface SiteTimeVisit {
  arrivedAt: string;
  leftAt: string | null;
  hours: number;           // closed-session duration in hours (0 while still on site)
  open: boolean;           // true = on site now (no leftAt yet)
}

export interface SiteTimeDay {
  date: string;            // YYYY-MM-DD in Singapore time
  label: string;           // e.g. "Mon, 8 Jun"
  dayNumber: number;       // 1 = first day on site, 2 = next day, ...
  visits: SiteTimeVisit[];
  hours: number;           // total closed-session hours that day
}

export interface SiteTimeSummary {
  days: SiteTimeDay[];
  day1Hours: number;       // hours on the first on-site day
  secondDayHours: number;  // total hours on every day AFTER the first
  totalHours: number;      // all on-site hours
  hasOpenVisit: boolean;   // someone is currently checked in on site
  spansMultipleDays: boolean;
}

const SITE_TZ = "Asia/Singapore";

function sgDateKey(iso: string): string {
  // en-CA renders as YYYY-MM-DD, which sorts correctly as a string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));
}

function sgDateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SITE_TZ, weekday: "short", day: "numeric", month: "short",
  }).format(new Date(iso));
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Singapore is a fixed UTC+8 with no daylight saving, so the start of any SGT
// calendar day is an exact instant and every SGT day is exactly 24h long.
function sgDayStartMs(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00.000+08:00`).getTime();
}

/**
 * Group raw on-site sessions into per-day totals (Singapore time).
 *
 * Day 1 is the first calendar date the crew was on site; any later date counts
 * toward Second-Day Continuation. A session that runs past midnight is split at
 * the Singapore day boundary so each day gets only the hours actually worked
 * that day (e.g. 23:00–01:00 → 1h on Day 1, 1h on Day 2). Open sessions (no
 * leftAt yet) contribute 0 hours until the staff member taps "Going off site".
 */
export function computeSiteTime(visits?: SiteVisit[] | null): SiteTimeSummary {
  const list = Array.isArray(visits) ? visits.filter(v => v && v.arrivedAt) : [];
  const sorted = [...list].sort(
    (a, b) => new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime(),
  );

  // Accumulate raw (unrounded) hours per SGT day, plus per-day display segments.
  const byDate = new Map<string, SiteTimeDay>();
  let hasOpenVisit = false;

  const ensureDay = (dateKey: string, anchorIso: string): SiteTimeDay => {
    let day = byDate.get(dateKey);
    if (!day) {
      day = { date: dateKey, label: sgDateLabel(anchorIso), dayNumber: 0, visits: [], hours: 0 };
      byDate.set(dateKey, day);
    }
    return day;
  };

  for (const v of sorted) {
    const open = !v.leftAt;
    if (open) {
      hasOpenVisit = true;
      const key = sgDateKey(v.arrivedAt);
      ensureDay(key, v.arrivedAt).visits.push({ arrivedAt: v.arrivedAt, leftAt: null, hours: 0, open: true });
      continue;
    }

    const startMs = new Date(v.arrivedAt).getTime();
    const endMs = new Date(v.leftAt!).getTime();
    if (!(endMs > startMs)) {
      // Zero / negative duration — record as a 0h segment on the arrival day.
      const key = sgDateKey(v.arrivedAt);
      ensureDay(key, v.arrivedAt).visits.push({ arrivedAt: v.arrivedAt, leftAt: v.leftAt!, hours: 0, open: false });
      continue;
    }

    // Walk the session day-by-day in SGT, clipping to each day's boundary.
    let cursor = startMs;
    while (cursor < endMs) {
      const cursorIso = new Date(cursor).toISOString();
      const key = sgDateKey(cursorIso);
      const nextBoundary = sgDayStartMs(key) + DAY_MS;
      const segEnd = Math.min(endMs, nextBoundary);
      const hrs = (segEnd - cursor) / 3_600_000;
      const day = ensureDay(key, cursorIso);
      day.visits.push({
        arrivedAt: new Date(cursor).toISOString(),
        leftAt: new Date(segEnd).toISOString(),
        hours: round2(hrs),
        open: false,
      });
      day.hours += hrs;
      cursor = segEnd;
    }
  }

  const days = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  days.forEach((d, i) => { d.dayNumber = i + 1; d.hours = round2(d.hours); });

  const day1Hours = days[0]?.hours ?? 0;
  const secondDayHours = round2(days.slice(1).reduce((s, d) => s + d.hours, 0));
  const totalHours = round2(days.reduce((s, d) => s + d.hours, 0));

  return { days, day1Hours, secondDayHours, totalHours, hasOpenVisit, spansMultipleDays: days.length > 1 };
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
 * Single source of truth for the "no promo stacking on relocation" rule.
 *
 * The Dismantle-&-Reinstall (D&R) bundle rate ("Relocation: D&R bundle rate
 * applied — 40% off install + dismantle combined") is itself a promotional
 * discount. Per company policy a general promo code (e.g. TMG50) CANNOT be
 * combined with it. This returns true when the cart contains at least one
 * relocate item priced on the D&R bundle (relocateMode 'full', which is also
 * the default when no mode is set). Carry-only relocations get NO bundle
 * discount, so they are not blocked here and may still use a promo code.
 *
 * Every surface that applies a promo (customer wizard server route, the
 * /api/promo/validate endpoint, and the Estimate UI) must consult this helper
 * so the rule is enforced identically and a promo never stacks on the bundle.
 */
export function relocationBundleBlocksPromo(
  items: { serviceType?: string | null; relocateMode?: string | null }[],
): boolean {
  return items.some(
    (i) => i.serviceType === "relocate" && i.relocateMode !== "carry",
  );
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

/** Number of Toyota Hiace trips needed for a given total volume (min 1). */
export function calcNumTrips(totalVolumeM3: number): number {
  const vol = isFinite(totalVolumeM3) && totalVolumeM3 > 0 ? totalVolumeM3 : 0;
  if (vol <= 0) return 1;
  return Math.max(1, Math.ceil(vol / PricingConfig.hiace.capacityM3));
}

/**
 * Tiered per-m³ volumetric handling fee (marginal bands, like income-tax).
 * Single source of truth so both computePricing and the multi-stop admin
 * helper produce identical numbers.
 */
export function calcVolumetricHandlingFee(volumeM3: number): number {
  const vol = isFinite(volumeM3) && volumeM3 > 0 ? volumeM3 : 0;
  if (vol <= 0) return 0;
  let remaining = vol;
  let prevCap = 0;
  let rawFee = 0;
  for (const tier of PricingConfig.carryHandling.tiers) {
    if (remaining <= 0) break;
    const bandSize = tier.upTo - prevCap;
    const taken = Math.min(remaining, bandSize);
    rawFee += taken * tier.ratePerM3;
    remaining -= taken;
    prevCap = tier.upTo;
  }
  return round2(rawFee);
}

/**
 * Multi-stop additional-stop fee. `extraStops` = stops beyond the first pickup
 * and first drop-off, i.e. (pickups − 1) + (dropoffs − 1), clamped at 0.
 * Single configurable rate lives in PricingConfig.multiStop.additionalStopFee.
 */
export function calcAdditionalStopFee(extraStops: number): number {
  const n = Math.max(0, Math.floor(extraStops || 0));
  return round2(n * PricingConfig.multiStop.additionalStopFee);
}

export interface MultiStopPriceInput {
  laborSubtotal: number;   // sum of the manual line-item handling/D&R labour
  totalVolumeM3: number;   // total load volume across all stops
  distanceKm: number;      // FULL multi-stop route distance (pickups → drop-offs)
  extraStops: number;      // stops beyond first pickup + first drop-off
  samePropertyMove?: boolean; // when true, skip transport/distance entirely
}

export interface MultiStopPriceResult {
  laborSubtotal: number;
  transportFee: number;       // per-trip transport × trips (0 for same-property)
  volumetricFee: number;      // tiered per-m³ handling
  additionalStopFee: number;  // extra-stop fee
  numTrips: number;
  logisticsSubtotal: number;  // transport + volumetric + additionalStop (stored in transportFee column)
  grandTotal: number;         // laborSubtotal + logisticsSubtotal
  breakdown: FeeLine[];       // human-readable lines for the admin UI
}

/**
 * Admin "Calculate price" helper for a multi-stop relocation. Reuses the same
 * transport / volumetric / additional-stop primitives as computePricing so the
 * suggested total is consistent with the rest of the engine. The admin can
 * always override the suggested grand total.
 */
export function computeMultiStopRelocationPrice(input: MultiStopPriceInput): MultiStopPriceResult {
  const laborSubtotal = round2(Math.max(0, input.laborSubtotal || 0));
  const totalVolumeM3 = round2(Math.max(0, input.totalVolumeM3 || 0));
  const distanceKm = Math.max(0, input.distanceKm || 0);
  const numTrips = calcNumTrips(totalVolumeM3);

  const breakdown: FeeLine[] = [];

  let transportFee = 0;
  if (!input.samePropertyMove) {
    const feePerTrip = calcTransportFee(distanceKm);
    transportFee = round2(feePerTrip * numTrips);
    breakdown.push({
      label: numTrips > 1
        ? `Transport / Relocation Logistics (${numTrips} trips × $${feePerTrip.toFixed(0)})`
        : 'Transport / Relocation Logistics',
      amount: transportFee,
    });
  }

  const volumetricFee = calcVolumetricHandlingFee(totalVolumeM3);
  if (volumetricFee > 0) {
    breakdown.push({ label: `Volumetric Handling (${totalVolumeM3.toFixed(2)} m³)`, amount: volumetricFee });
  }

  const additionalStopFee = calcAdditionalStopFee(input.extraStops);
  if (additionalStopFee > 0) {
    const n = Math.max(0, Math.floor(input.extraStops || 0));
    breakdown.push({
      label: `Additional Stops (${n} × $${PricingConfig.multiStop.additionalStopFee})`,
      amount: additionalStopFee,
    });
  }

  const logisticsSubtotal = round2(transportFee + volumetricFee + additionalStopFee);
  const grandTotal = round2(laborSubtotal + logisticsSubtotal);

  return {
    laborSubtotal,
    transportFee,
    volumetricFee,
    additionalStopFee,
    numTrips,
    logisticsSubtotal,
    grandTotal,
    breakdown,
  };
}

export interface OvertimeResult {
  blocks: number;              // number of 30-min blocks charged
  charge: number;              // total overtime charge (SGD), NO cap
  includedMinutes: number;     // scheduled allowance used for this job
  crewSize: number;            // movers on site (drives the per-block rate)
  ratePerBlock: number;        // SGD per 30-min block = crew × $50 × 0.5
  overtimePerManPerHour: number; // SGD per mover, per hour ($50)
  overMinutes: number;         // minutes worked beyond the scheduled allowance
}

/**
 * Calculate the overtime charge for a job that runs beyond its SCHEDULED time.
 *
 * - `includedMinutes` is the job's own scheduled crew time (from getJobSchedule).
 *   When omitted it falls back to the flat overtime.capMinutes (back-compat).
 * - The per-block rate scales with `crewSize`: crew × $50/mover/hr, billed in
 *   30-minute blocks. There is NO cap — overruns are fully recovered.
 */
export function calcOvertimeCharge(
  actualMinutes: number,
  opts?: { includedMinutes?: number; crewSize?: number },
): OvertimeResult {
  const cfg = PricingConfig.overtime;
  const crew = Math.max(1, Math.round(Number(opts?.crewSize) || PricingConfig.secondDay.defaultCrewSize));
  const includedMinutes = opts?.includedMinutes != null && opts.includedMinutes >= 0
    ? opts.includedMinutes
    : cfg.capMinutes;
  const overtimePerManPerHour = cfg.perPersonHourlyRate;
  const ratePerBlock = round2(crew * overtimePerManPerHour * (cfg.blockMinutes / 60));

  if (actualMinutes <= includedMinutes) {
    return { blocks: 0, charge: 0, includedMinutes, crewSize: crew, ratePerBlock, overtimePerManPerHour, overMinutes: 0 };
  }
  const overMinutes = actualMinutes - includedMinutes;
  const blocks = Math.ceil(overMinutes / cfg.blockMinutes);
  const charge = round2(blocks * ratePerBlock); // NO cap — full recovery
  return { blocks, charge, includedMinutes, crewSize: crew, ratePerBlock, overtimePerManPerHour, overMinutes };
}

export interface JobSchedule {
  crewSize: number;            // movers assigned (defaults to standard van crew)
  scheduledHours: number;      // on-site time we plan for, rounded up to nearest 0.5h
  scheduledMinutes: number;    // scheduledHours × 60 — the overtime allowance
  overtimePerManPerHour: number; // SGD per mover, per hour beyond scheduled time
  blockMinutes: number;        // overtime billing block size (30 min)
  ratePerBlock: number;        // SGD per 30-min block = crew × $50 × 0.5
}

/**
 * Work out the customer-facing SCHEDULE for a job: how many movers for how long.
 * Scheduled time comes from the job SCOPE (estimateCrewHours), NOT from dividing
 * the price — dividing the price over-promises free hours. Rounded UP to the
 * nearest half-hour so we never under-promise on-site time.
 */
export function getJobSchedule(args: {
  items: { serviceType: string; quantity: number; volumeM3?: number | null; carryOnly?: boolean }[];
  totalVolumeM3?: number;
  distanceKm?: number;
  isRelocation?: boolean;
  crewSize?: number;
}): JobSchedule {
  const crew = Math.max(1, Math.round(Number(args.crewSize) || PricingConfig.costFloor.defaultCrewSize));
  const rawHours = estimateCrewHours({
    items: args.items,
    totalVolumeM3: args.totalVolumeM3,
    distanceKm: args.distanceKm,
    isRelocation: args.isRelocation,
  });
  const scheduledHours = Math.max(0.5, Math.ceil(rawHours * 2) / 2);
  const scheduledMinutes = Math.round(scheduledHours * 60);
  const overtimePerManPerHour = PricingConfig.overtime.perPersonHourlyRate;
  const blockMinutes = PricingConfig.overtime.blockMinutes;
  const ratePerBlock = round2(crew * overtimePerManPerHour * (blockMinutes / 60));
  return { crewSize: crew, scheduledHours, scheduledMinutes, overtimePerManPerHour, blockMinutes, ratePerBlock };
}

/**
 * Estimate how many crew-hours a job will realistically take. Used by the
 * cost-floor guard to work out the real cost of running the job. Gracefully
 * handles missing volume data by leaning on per-item time estimates.
 */
export function estimateCrewHours(args: {
  items: { serviceType: string; quantity: number; volumeM3?: number | null; carryOnly?: boolean }[];
  totalVolumeM3?: number;
  distanceKm?: number;
  isRelocation?: boolean;
}): number {
  const c = PricingConfig.costFloor;
  const items = args.items || [];
  let hours = c.baseHours;

  // Volume-based handling time (use provided total, else sum item volumes).
  const vol = args.totalVolumeM3 != null && args.totalVolumeM3 > 0
    ? args.totalVolumeM3
    : items.reduce((s, it) => {
        const v = it.volumeM3 != null && isFinite(it.volumeM3) && it.volumeM3 > 0 ? it.volumeM3 : 0;
        return s + v * Math.max(1, Math.round(it.quantity || 1));
      }, 0);
  if (vol > 0) hours += c.hoursPerM3 * vol;

  // Per-item handling time (D&R relocations are the most labour-intensive).
  for (const it of items) {
    const qty = Math.max(1, Math.round(it.quantity || 1));
    let per: number;
    if (it.serviceType === 'relocate') {
      per = it.carryOnly ? c.hoursPerCarryItem : c.hoursPerDRItem;
    } else {
      per = c.hoursPerLaborItem;
    }
    hours += per * qty;
  }

  // Travel time for relocations (round trip + buffer).
  if (args.isRelocation && args.distanceKm && args.distanceKm > 0) {
    hours += c.travelHoursPerKm * args.distanceKm;
  }

  return round2(hours);
}

/**
 * Cost-floor / margin guard. Estimates the real cost of a job and the lowest
 * price that still hits the target margin, then compares it to the quoted
 * grand total. Pure + side-effect free so it can run identically on the server,
 * in the customer estimate wizard, and in the admin quote screen.
 */
export function evaluateJobMargin(args: {
  items: { serviceType: string; quantity: number; volumeM3?: number | null; carryOnly?: boolean }[];
  grandTotal: number;
  totalVolumeM3?: number;
  distanceKm?: number;
  isRelocation?: boolean;
  crewSize?: number;
}): JobMargin {
  const c = PricingConfig.costFloor;
  const crew = Math.max(1, Math.round(Number(args.crewSize) || c.defaultCrewSize));
  const hours = estimateCrewHours({
    items: args.items,
    totalVolumeM3: args.totalVolumeM3,
    distanceKm: args.distanceKm,
    isRelocation: args.isRelocation,
  });

  const crewCost = crew * hours * c.loadedMoverHourlyCost;

  // Vehicle cost = van base + per-km fuel (the helper's labour is already counted
  // in crewCost, so we deliberately exclude the transport helperFee here to avoid
  // double-counting). Only relocations incur a vehicle cost.
  let vehicleCost = 0;
  if (args.isRelocation) {
    const t = PricingConfig.transport;
    const extraKm = Math.max(0, (args.distanceKm || 0) - t.includedKm);
    vehicleCost = t.vanBase + extraKm * t.ratePerKm;
  }

  const estimatedCost = round2(crewCost + vehicleCost);
  const marginFloor = c.marginPct < 1 ? round2(estimatedCost / (1 - c.marginPct)) : estimatedCost;
  const costFloor = round2(Math.max(c.absoluteMinJobPrice, marginFloor));
  const gt = round2(Number(args.grandTotal) || 0);
  const belowFloor = c.enabled && gt > 0 && gt < costFloor;
  const actualMarginPct = gt > 0 ? round2((gt - estimatedCost) / gt) : 0;

  return {
    enabled: c.enabled,
    estimatedHours: hours,
    crewSize: crew,
    estimatedCost,
    marginFloor,
    absoluteMin: c.absoluteMinJobPrice,
    costFloor,
    grandTotal: gt,
    belowFloor,
    shortfall: belowFloor ? round2(costFloor - gt) : 0,
    marginPct: c.marginPct,
    actualMarginPct,
  };
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
  const numTrips = calcNumTrips(totalVolumeM3);

  // ── E) Fee lines ────────────────────────────────────────────────────────

  const feeLines: FeeLine[] = [];

  // Mobilisation & coordination fee
  //   • Non-relocation jobs (install / dismantle / dispose): $39.90 — replaces
  //     the old $180 minimum with a transparent base fee.
  //   • Same-Property Move: ALSO $39.90 — crew still needs to be dispatched
  //     to the site even though no transport is involved.
  //   • Regular relocation (between two addresses): no mobilisation fee; the
  //     transport fee already covers crew dispatch + 2-hour service window.
  if (!input.needsRelocation || input.samePropertyMove) {
    feeLines.push({ label: 'Mobilisation & Coordination', amount: cfg.callout.fee });
  }

  // Transport fee (regular relocation only — NOT same-property move) — multiplied by number of trips
  if (input.needsRelocation && !input.samePropertyMove) {
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

  // Multi-stop additional-stop fee — flat charge per stop beyond the first
  // pickup + first drop-off. Default 0 (single-leg) so existing quotes are
  // unchanged. Skipped for same-property moves (no transport / extra legs).
  if (input.needsRelocation && !input.samePropertyMove) {
    const extraStops = Math.max(0, Math.floor(input.extraStops || 0));
    const additionalStopFee = calcAdditionalStopFee(extraStops);
    if (additionalStopFee > 0) {
      feeLines.push({
        label: `Additional Stops (${extraStops} × $${cfg.multiStop.additionalStopFee})`,
        amount: additionalStopFee,
      });
    }
  }

  // Volumetric handling fee — per-m³ crew labour charge for ALL relocation
  // items (both Carry Only AND full Dismantle-&-Reinstall), regardless of
  // pricing mode. Applies to regular relocations (where it offsets crew time
  // beyond the 2-hour transport window) AND Same-Property Moves (where it IS
  // the primary handling charge since there's no transport fee at all).
  //
  // Why D&R items also pay this fee: the catalog D&R price covers ASSEMBLY
  // labour (unbolt at origin, re-bolt at destination), but the physical
  // carry-out / carry-in work between truck and unit is a separate cost that
  // scales with the load's cubic footprint — exactly what the tiered $/m³
  // table is designed to recover. Without it, big D&R loads were silently
  // absorbing real crew time the flat fees alone didn't cover.
  //
  // Special-handling SKUs (king bed, Pax, piano, phone booths, etc.) are
  // excluded — those items already keep their full catalog rate which has
  // the heavy-handling premium baked in, so charging again would double-bill.
  let volumetricFeeOut = 0;
  if (input.needsRelocation) {
    const volumetricM3 = round2(
      input.items.reduce((s, it) => {
        if (it.serviceType !== 'relocate') return s;
        if (requiresSpecialHandling(it.sku)) return s;
        // Clamp volume — a tampered/negative client payload must not reduce
        // the handling fee. Non-finite values are treated as zero.
        const rawVol = it.volumeM3 ?? 0;
        const vol = isFinite(rawVol) && rawVol > 0 ? rawVol : 0;
        const qty = Math.max(1, Math.round(it.quantity));
        return s + vol * qty;
      }, 0),
    );
    if (volumetricM3 > 0) {
      // Apply marginal tiered rate — like income tax bands.
      // 0–2 m³ at $10, 2–5 m³ at $15, 5+ m³ at $20. (Shared helper so the
      // multi-stop admin calculator produces identical numbers.)
      const volumetricFee = calcVolumetricHandlingFee(volumetricM3);
      volumetricFeeOut = volumetricFee;
      if (volumetricFee > 0) {
        // Blended rate label = total fee ÷ total volume.
        // Reads as "Volumetric Handling (1.50 m³ × $10)" for small loads and
        // "Volumetric Handling (6.00 m³ × $15 blended)" once tiers kick in.
        const blendedRate = volumetricFee / volumetricM3;
        const allOneTier = volumetricM3 <= cfg.carryHandling.tiers[0].upTo;
        const rateLabel = allOneTier
          ? `$${cfg.carryHandling.tiers[0].ratePerM3}`
          : `$${blendedRate.toFixed(2)} blended`;
        feeLines.push({
          label: `Volumetric Handling (${volumetricM3.toFixed(2)} m³ × ${rateLabel}/m³)`,
          amount: volumetricFee,
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

  // Wrapping protection — optional per-item bubble-wrap charge.
  // Customer ticks "Wrap" on any line they want protected; we charge a flat
  // $10 per UNIT (so qty 3 with wrap = $30). Applies to any service type
  // (install, dismantle, relocate, etc.) — not gated by needsRelocation.
  const wrappedCount = input.items.reduce((s, it) => {
    if (!it.wrap) return s;
    const qty = Math.max(1, Math.round(it.quantity));
    return s + qty;
  }, 0);
  if (wrappedCount > 0 && cfg.wrapping.perItem > 0) {
    const wrappingFee = round2(wrappedCount * cfg.wrapping.perItem);
    if (wrappingFee > 0) {
      feeLines.push({
        label: `Wrapping Protection (${wrappedCount} ${wrappedCount === 1 ? 'item' : 'items'} × $${cfg.wrapping.perItem})`,
        amount: wrappingFee,
      });
    }
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
  // Small jobs (below the threshold) must be paid IN FULL up front — the
  // "deposit" becomes the whole total and there is no final payment. Larger
  // jobs keep the usual 50% deposit + 50% final split.
  const fullUpfront = grandTotal > 0 && grandTotal < cfg.deposit.fullPaymentThreshold;
  const depositAmount = fullUpfront ? grandTotal : round2(grandTotal * cfg.deposit.pct);
  const finalAmount = round2(grandTotal - depositAmount);

  // ── G) Margin / cost-floor guard (warn-only) ────────────────────────────
  const margin = evaluateJobMargin({
    items: input.items,
    grandTotal,
    totalVolumeM3,
    distanceKm: input.distanceKm,
    isRelocation: input.needsRelocation,
  });
  if (margin.enabled && margin.belowFloor) {
    requiresAdminReview = true;
    reviewReasons.push(
      `Below cost floor — priced $${grandTotal.toFixed(2)} vs safe minimum $${margin.costFloor.toFixed(2)} ` +
      `(target ${Math.round(margin.marginPct * 100)}% margin on ~${margin.estimatedHours}h crew time). ` +
      `Short by $${margin.shortfall.toFixed(2)}.`,
    );
  }

  return {
    itemLines,
    feeLines,
    discountLine,
    laborSubtotal,
    logisticsSubtotal,
    volumetricFee: volumetricFeeOut,
    discountAmount,
    grandTotal,
    depositAmount,
    finalAmount,
    requiresAdminReview,
    reviewReasons,
    totalVolumeM3,
    numTrips,
    hasVolumeData,
    margin,
  };
}

/** Summarise a PricingResult for storage in the quotes table. */
export function pricingToQuoteFields(result: PricingResult) {
  return {
    subtotal: result.laborSubtotal.toFixed(2),
    discount: result.discountAmount.toFixed(2),
    transportFee: result.logisticsSubtotal.toFixed(2),
    volumetricFee: result.volumetricFee.toFixed(2),
    total: result.grandTotal.toFixed(2),
    depositAmount: result.depositAmount.toFixed(2),
    finalAmount: result.finalAmount.toFixed(2),
  };
}
