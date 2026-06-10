---
name: Catalog seeding via Round migrations
description: How to add/reprice catalog items in server/seed.ts so existing (production) DBs actually pick them up
---

# Adding or repricing catalog items

`server/seed.ts` is layered:
- A **base array** (e.g. Round 1, marker `QB-INSTALL`) that is only inserted on a
  fresh DB — it is guarded by a marker-SKU existence check, so editing it does
  **nothing** to an existing/production database.
- A sequence of idempotent **"Round N"** startup migrations at the end of
  `seedDatabase()` that run on **every boot**. Each is guarded by its own unique
  marker SKU (e.g. `HINGED-3DOOR-R33-MARKER`); inside it loops rows and inserts
  each only if that row's SKU is absent.

**Rule:** to add a new catalog item / variant or reprice so it shows up in
production, add a NEW `Round N` block (copy the latest one as a template, e.g. the
hinged 3-door round). Do not rely on editing the base array. Use a fresh unique
marker SKU and unique per-row SKUs.

**Why:** the base array is marker-gated and never re-runs on an existing DB; only
the Round migrations execute on each startup, so they are the only path that
reaches already-seeded production data.

**How to apply:** new variants follow the door-count ladder — interpolate price
across ALL service types (install/dismantle/relocate/dispose/dismantle_dispose)
between the neighbouring sizes, and set `volumeM3` between neighbours too. The DB
holds the live (calibrated) prices, which can differ from the stale base-array
values — query the DB for current neighbour prices before interpolating.

The catalog is fully DB-driven: customer estimator (`/api/catalog`), AI photo
detection, and WhatsApp matching all read names/rows from the DB, so no extra
wiring is needed once the rows are seeded. After editing seed.ts, restart the
"Start application" workflow (tsx, no watch) so the new round runs.

**Gotcha — orphan rows not in seed.ts:** the live DB can contain catalog rows that
were created outside seed.ts (admin UI / ad-hoc) and therefore are NOT reproduced
on a fresh/production DB. When a Round needs to retire a family of items, deactivate
by **exact name** for every known legacy name (not just the seeded one) so dev and
prod converge. To re-run a Round after it already ran in dev, bump its marker SKU
(e.g. `...-R36-` → `...-R36B-`) — the per-row SKU-exists checks keep inserts
idempotent while deactivation re-applies.

**Retiring vs deleting:** prefer `active=false` over delete. `getCatalogItems()`
filters `active=true`, so deactivating hides an item from the estimator/photo/AI
surfaces while preserving history. Also add the same `eq(active,true)` filter to
any direct catalog query (e.g. WhatsApp `findCatalogMatch`) so retired rows don't
leak back into matching.

**PAX wardrobe pricing model (chosen):** IKEA PAX is priced **per frame/bay**
(quantity = number of frames) × **door type** (open < hinged < sliding/mirror),
seeded as 3 named variants `IKEA PAX Wardrobe (per frame, ...)`. Do NOT reintroduce
a single flat PAX price or whole-unit door-count PAX variants — they over/under-charge
because one price fits every design. Relocate base = (install+dismantle)×0.6 to match
`computeDRPrice` D&R bundle.
**Why:** SG benchmarking (IKEA assembly ≈ 20% of retail; movers quote opaquely) showed
frame-count + door-type are the real cost drivers; a flat price is unfair both ways.
