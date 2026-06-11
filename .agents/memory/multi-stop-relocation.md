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
