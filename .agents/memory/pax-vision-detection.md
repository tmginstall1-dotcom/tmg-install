---
name: PAX wardrobe vision detection
description: How the AI photo-detection prompt must classify IKEA PAX vs sliding-door wardrobes
---

The shared `FURNITURE_VISION_GUIDE` (server/routes.ts) drives both the customer
estimator photo detection (`/api/catalog/detect-items`) and the WhatsApp vision
paths. Two rules matter for wardrobes:

- The "Sliding Door Wardrobe (… / Mirror)" mapping — including the "any mirror →
  heavy mirror tier" rule — must apply ONLY to GENUINE sliding doors (continuous
  track, overlapping panels, no protruding handles). A mirror door alone does NOT
  imply sliding.
- IKEA PAX is almost always HINGED and is priced PER FRAME. Map it to the
  per-frame catalog items by DOOR MECHANISM (open / hinged / sliding), with
  quantity = number of frames/bays. Hinged-with-mirror stays hinged. For an
  L-shape/corner PAX, count the corner section as one extra frame.

**Why:** a PAX corner L-shape with hinged mirror doors was being mis-detected as
"Sliding Door Wardrobe (4-door / Mirror)" because the old prompt forced any mirror
to the sliding heavy tier and never mentioned the per-frame PAX items.

**How to apply:** the per-frame PAX SKUs already exist (seed.ts Round 36:
PAX-PF-OPEN/HINGE/SLIDE) — route detection to them, never invent a new corner SKU
or price. If you change wardrobe classification, edit the single shared guide so
estimator + WhatsApp stay in lockstep.
