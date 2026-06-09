/**
 * Fixed-price service packages.
 *
 * Single source of truth shared by the public homepage card, the dedicated
 * package-booking page, and the server booking endpoint. The price lives here
 * (and is read server-side) so a customer can never tamper with the NET price.
 */

export interface ServicePackage {
  /** Stable id, also used as the URL slug (/book/:id). */
  id: string;
  /** Marketing display name. */
  name: string;
  /** Short tag shown as a badge (e.g. "Most Popular"). */
  badge?: string;
  /** One-line description under the name. */
  blurb: string;
  /** NET, all-in price in SGD. No GST. */
  price: number;
  /** Included on-site hours before overtime applies. */
  durationHours: number;
  /** Included drilling holes before extra-drilling charges apply. */
  drillingHoles: number;
  /** Crew size included. */
  movers: number;
  /** Van trips included. */
  vanTrips: number;
  /** Internal service tags (stored on the quote for admin visibility). */
  services: string[];
  /** Customer-facing "what's included" checklist. */
  includes: string[];
  /** Customer-facing rules / fine print, one line each. */
  fineprint: string[];
  /** Whether to feature this as the headline package. */
  mostPopular?: boolean;
}

export const PACKAGES: ServicePackage[] = [
  {
    id: "essential-move",
    name: "Essential Move + Setup",
    badge: "Most Popular",
    blurb:
      "Dismantle, move, and reassemble your essentials — handled by 2 movers and a van in a single trip.",
    price: 288,
    durationHours: 2,
    drillingHoles: 8,
    movers: 2,
    vanTrips: 1,
    services: ["dismantle", "relocate", "install"],
    includes: [
      "2 movers + van",
      "Up to 2 hours on-site",
      "1 van trip included",
      "Dismantle up to 2 furniture items",
      "Relocate Point A to Point B (Singapore main island)",
      "Reassemble up to 2 furniture items",
      "Up to 8 drilling holes included",
      "Basic positioning & adjustment",
    ],
    fineprint: [
      "Price is all-in — no GST.",
      "Covers Point A to Point B within the Singapore main island.",
      "Beyond 2 hours, overtime applies at our usual rate.",
      "Extra drilling beyond 8 holes is charged at our usual drilling rate.",
      "Additional items, extra van trips or off-island trips are quoted on-site.",
      "Promo codes don't apply to the NET package price.",
    ],
    mostPopular: true,
  },
];

export function getPackage(id: string): ServicePackage | undefined {
  return PACKAGES.find((p) => p.id === id);
}
