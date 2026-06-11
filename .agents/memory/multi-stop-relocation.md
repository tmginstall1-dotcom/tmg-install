---
name: Multi-stop relocation quotes
description: How multi-stop relocation data flows from storage into the many display surfaces, and the labelling/threshold conventions.
---

Multi-stop relocation is additive on top of single-leg quotes. Single-leg quotes carry no `stops` (empty array) and every surface falls back to the legacy `pickupAddress`/`dropoffAddress` fields, so they are visually unchanged.

**Detection rule everywhere:** treat a quote as multi-stop only when `groupStops(stops).all.length > 2`. With 0–2 stops, render the legacy pickup/drop-off block. There is no separate boolean flag.

**Labels** come only from `client/src/lib/stops.ts` (`groupStops`, `labelForStop`, `itemRouteLabel`): pickups numbered `Pickup 1/2/3…`, drop-offs lettered `Drop-off A/B…`. Never hand-roll these labels in a component — labels are positional, computed from order within the `stops` array, so the same util must be used on every surface or numbering drifts.

**Schema field names** (easy to get wrong): stop objects use `floor` and `postalCode` (NOT `unitFloor`), plus `hasLift` (nullable boolean — show "(no lift)" only when strictly `=== false`). Items carry `fromStopId`/`toStopId`.

**Storage/totals reconciliation:** `transportFee` column = full logistics bucket (transport + volumetric + extra-stop fee = `logisticsSubtotal`); `volumetricFee` is broken out separately for the invoice line. `subtotal` = labour only. Total recompute on edit = subtotal − promo − goodwill + transportFee + secondDay, so writing `logisticsSubtotal` into `transportFee` keeps all existing surfaces reconciled. Pricing helper `computeMultiStopRelocationPrice` in `shared/pricing.ts` is the single source; `additionalStopFee` rate lives in `PricingConfig.multiStop.additionalStopFee` (one constant).

**Display surfaces that must stay in lockstep** (grouped stops + per-item route tags): `client/src/pages/Invoice.tsx`, `client/src/lib/invoicePdf.ts`, `client/src/pages/admin/QuoteDetail.tsx` (view + edit), `client/src/pages/customer/QuoteStatus.tsx`. `server/routes.ts` `buildInvoicePayload` already exposes `stops[]` + item `fromStopId`/`toStopId`.

**Entry points that CREATE multi-stop:** admin create, WhatsApp AI, and the self-service estimate wizard (`client/src/pages/customer/Estimate.tsx` + `server/routes.ts` `/api/quotes/wizard`). Wizard sends `stops[]` only when the customer adds ≥1 extra stop; server derives extra-stop count as `(pickups−1)+(dropoffs−1)` and feeds `computePricing({extraStops})`. The wizard floor-surcharge recompute must include every stop's floor (primary pickup/drop-off floors live in the legacy `floors`/`floorsInfo` array; append each extra stop's floor too), and `/api/distance` accepts a `waypoints[]` array that sums the whole chain.

**DB columns may be missing in fresh/isolated environments:** `quotes.stops` (jsonb), `quote_items.from_stop_id`/`to_stop_id` (text) are schema-defined but `db:push` isn't auto-run; a missing `quotes.stops` shows up as a startup `autoBookPendingQuotes warning: Failed query`. Add via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (psql) — see drizzle-push-interactive note.
