---
name: Promo no-stacking with relocation D&R bundle
description: Policy + where to enforce that promo codes cannot combine with the relocation dismantle-&-reinstall bundle discount.
---

# Promo codes never stack with the relocation D&R bundle

A relocation job priced on the **full dismantle-&-reinstall (D&R) bundle** rate is
already a 40% discount, so a promo code (e.g. TMG50) must NOT be applied on top.
Only one discount per job.

- **Carry-only relocations are exempt** — they get no bundle discount, so a promo
  IS allowed on them.
- Detection is centralized in the shared helper `relocationBundleBlocksPromo(items)`
  (true when any `serviceType==='relocate'` item has `relocateMode !== 'carry'`).
  Use this **same** helper on client and server so the UI never shows a promo as
  applied that the server will then strip.

**Why:** customers were able to get both the 40% D&R bundle and a promo code at the
same time (seen on a real quote), double-discounting the job.

**How to apply:** enforce on every quote-creation path that actually applies D&R
bundle pricing.
- Customer wizard submit (`/api/quotes/wizard`) is the authoritative money path —
  it voids the promo when the helper is true.
- WhatsApp quote creation gates promo on its own `isFullDR` flag (its equivalent of
  "bundle pricing applied"); carry/non-full WA branches don't bundle-discount so
  promo is fine there.
- `/api/promo/validate` is UX-only (client-asserted `hasRelocationBundle`); never
  rely on it for enforcement.
- Admin manual create / CreateJobModal use manually-priced `manual` line items with
  NO automatic D&R bundle, so there is nothing to stack with — intentionally not
  gated.

Keep relocate items' `relocateMode` explicit (`'full'`/`'carry'`) at creation in the
client; an unset mode is treated as bundle by the helper but as carry by some
display-only notices, which drifts the UI.
