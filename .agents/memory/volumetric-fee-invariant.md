---
name: volumetricFee is a display subset of transportFee
description: The volumetricFee column is a portion INSIDE the transportFee bucket, not a separate total addend; keep volumetricFee <= transportFee in lockstep on every edit path.
---

# volumetricFee vs transportFee

`transportFee` (column) holds the FULL logistics bucket = transport + volumetric + extra-stop (the `logisticsSubtotal` from the pricing engine). The quote total is `subtotal − promo − goodwill + transportFee + secondDayFee` — **volumetric is NOT a separate addend**.

`volumetricFee` (column) is ONLY a display subset, broken back out everywhere as:
- Transport line = `transportFee − volumetricFee`
- Volumetric Handling line = `volumetricFee`

This split is duplicated across ~10 read surfaces (QuoteDetail print/view/edit-preview, customer Invoice + QuoteStatus, ExportPDF, lib/invoicePdf.ts, server/email.ts). They all guard the Transport line with `> 0`.

**The invariant:** `volumetricFee <= transportFee` must always hold. If it doesn't, the Transport line gets hidden (guarded by `> 0`) while Volumetric still shows, so the visible breakdown stops summing to the total — the classic "figures don't add up" admin report.

**Why it broke:** the canonical CREATE path stored both in lockstep, but the admin EDIT path only updated `transportFee` (the bucket); `volumetricFee` went stale. On recalc the bucket shrank below the stale volumetric → split broke.

**How to apply (any new edit/recalc path must keep them in lockstep):**
- Client recalc: set BOTH `transportFee = result.logisticsSubtotal` and `volumetricFee = result.volumetricFee`.
- Carry `volumetricFee` in the edit form state so save sends it.
- Display: clamp `min(volumetricFee, transportFee)` defensively.
- Server `storage.editQuote`: clamp `volumetricFee = min(stored, transportFee)` and persist it inside the pricing-recompute block; `volumetricFee` must be in `pricingTouched` so a volumetric-only write still triggers the clamp.
- Non-relocation quotes keep volumetricFee = 0 (harmless to re-send).
