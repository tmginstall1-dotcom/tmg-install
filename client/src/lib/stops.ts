import type { QuoteStop } from "@shared/schema";

// Multi-stop relocation helpers (additive). Pickups are numbered (1, 2, 3…)
// and drop-offs are lettered (A, B, C…) so a per-item route reads cleanly as
// "Pickup 1 → Drop-off B". Single-leg quotes carry no stops and are unchanged.

export type StopWithLabel = QuoteStop & { label: string };

function letterFor(index: number): string {
  // 0 → A, 1 → B … 25 → Z, 26 → AA (rare, but safe).
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

export function groupStops(stops: QuoteStop[] | null | undefined): {
  pickups: StopWithLabel[];
  dropoffs: StopWithLabel[];
  all: StopWithLabel[];
} {
  const list = Array.isArray(stops) ? stops : [];
  const pickups: StopWithLabel[] = [];
  const dropoffs: StopWithLabel[] = [];
  for (const s of list) {
    if (s.kind === "pickup") {
      pickups.push({ ...s, label: `Pickup ${pickups.length + 1}` });
    } else {
      dropoffs.push({ ...s, label: `Drop-off ${letterFor(dropoffs.length)}` });
    }
  }
  return { pickups, dropoffs, all: [...pickups, ...dropoffs] };
}

// Look up the friendly label for a stop id within a quote's stop list.
export function labelForStop(
  stops: QuoteStop[] | null | undefined,
  stopId: string | null | undefined,
): string | null {
  if (!stopId) return null;
  const { all } = groupStops(stops);
  return all.find(s => s.id === stopId)?.label ?? null;
}

// "Pickup 1 → Drop-off B" for a line item. Returns null when the item has no
// route tagging (legacy / single-leg) so callers can omit the badge entirely.
export function itemRouteLabel(
  stops: QuoteStop[] | null | undefined,
  fromStopId: string | null | undefined,
  toStopId: string | null | undefined,
): string | null {
  const from = labelForStop(stops, fromStopId);
  const to = labelForStop(stops, toStopId);
  if (!from && !to) return null;
  if (from && to) return `${from} → ${to}`;
  return from || to;
}

// Count of extra stops beyond the first pickup + first drop-off. Drives the
// per-extra-stop fee in the pricing engine.
export function countExtraStops(stops: QuoteStop[] | null | undefined): number {
  const { pickups, dropoffs } = groupStops(stops);
  return Math.max(0, pickups.length - 1) + Math.max(0, dropoffs.length - 1);
}

// Stable client-generated id for a new stop (no collisions across a session).
export function genStopId(): string {
  return `stop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
