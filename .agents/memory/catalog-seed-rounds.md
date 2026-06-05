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
