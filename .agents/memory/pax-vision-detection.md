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
- A single PAX run frequently MIXES mechanisms (open hanging/drawer bays +
  hinged bays + a corner). The guide must NOT force "ONE line item" — that
  collapses the open bays + corner into a flat hinged count (the reported
  "L-shape detected as ×4 hinged" bug). Return ONE line item PER mechanism
  present; the corner takes its own door's mechanism; frame counts across all
  the PAX lines must sum to the total incl. the corner. Only collapse to one
  line when the whole run is genuinely a single mechanism.
- The customer estimator endpoint (`/api/catalog/detect-items`) ALSO carries a
  separate "Walk-in / Built-in Wardrobe (per hole)" rule that competes with the
  per-frame PAX rule. It once listed "Pax mounted to a wall" as a per-hole
  example, so a freestanding PAX got mis-detected as per-hole ×60. Per-hole is
  ONLY for EXPOSED wall-drilled rail/shelf systems (Elfa/Algot/Boaxel) with NO
  enclosed carcass and NO full-height doors. A PAX (enclosed box carcass on its
  own base, full-height doors, even corner/mixed/wall-fixed) is per-FRAME, never
  per-hole. But "not per-hole" ≠ PAX: a genuine non-PAX enclosed sliding/hinged
  wardrobe stays a "Sliding Door Wardrobe (N-door)" via section 2/2a — keep all
  three buckets (per-hole / PAX per-frame / generic wardrobe) mutually exclusive.

**Why:** a PAX corner L-shape with hinged mirror doors was being mis-detected as
"Sliding Door Wardrobe (4-door / Mirror)" because the old prompt forced any mirror
to the sliding heavy tier and never mentioned the per-frame PAX items.

**How to apply:** the per-frame PAX SKUs already exist (seed.ts Round 36:
PAX-PF-OPEN/HINGE/SLIDE) — route detection to them, never invent a new corner SKU
or price. If you change wardrobe classification, edit the single shared guide so
estimator + WhatsApp stay in lockstep.
