---
name: IKEA catalog coverage conventions
description: Cross-file rules for adding IKEA furniture so it shows in the estimator IKEA tab and is detected by AI/photo matching.
---

# Adding IKEA items so they're fully wired

IKEA furniture lives in dedicated `IKEA <Room>` categories (IKEA Living Room,
IKEA Beds, IKEA Bedroom, IKEA Wardrobes, IKEA Shelving, IKEA Storage, IKEA Study,
plus IKEA Dining / IKEA Sofas / IKEA Office). To add a new IKEA item correctly,
three places must agree:

1. **Seed it** as a new `Round N` block in `server/seed.ts` (see
   catalog-seed-rounds.md) with the full service ladder; relocate =
   `round((install + dismantle) × 0.6)`.
2. **Estimator IKEA tab** (`client/src/pages/customer/Estimate.tsx`,
   `CATEGORY_TABS`): the IKEA tab matches `["ikea"]`, i.e. ANY category whose
   name contains "ikea". So a new `IKEA …` category auto-surfaces under the IKEA
   tab — but the category name MUST contain "ikea". Non-IKEA categories must not
   contain that substring.
3. **AI / paste detection** (same file, the `ikeaModel` regex): add the model
   word (e.g. `friheten`, `besta`, `ekedalen`) so photo/text detection scores the
   catalog row. The item's `name` must contain that model word for the detection
   boost to fire.

**Why:** the catalog is DB-driven, but the IKEA tab grouping and the model-word
detection are hardcoded client-side; seeding alone makes an item searchable but
not necessarily tab-visible or AI-detectable.

**How to apply:** when expanding IKEA coverage, seed + (if a new category) ensure
the name carries "ikea" + add any new model words to the regex. The BESTÅ system
spans floor TV unit, wall-mounted media combo, and storage combo — these are
distinct SKUs with very different install effort; don't collapse them into one.
