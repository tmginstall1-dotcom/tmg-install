---
name: Blind/window-covering install pricing gap
description: Why blinds over-quoted and the catalog-coverage rule that prevents it
---

# Blind / window-covering install pricing gap

The catalog seeded blinds (roller/venetian/roman/vertical/zebra/motorised) ONLY for
`dispose`, `dismantle_dispose`, and `relocate` serviceTypes — there was no `install`
or `dismantle` per-window price. So an "install blinds" request found no catalog match
and fell through to `PricingConfig.fallback.genericFallback` ($150/unit), badly
over-quoting (4 blinds → ~SGD 640+).

**Rule:** every item the WhatsApp agent / estimator can be asked about needs a catalog
row for EACH serviceType it could be requested in — most importantly `install`. A
missing serviceType silently triggers the generic $150 fallback, not an error.

**Why:** `findCatalogMatch` filters by `serviceType`; no row for that service = no match
= fallback. The over-quote looks like a bug in the bot but is really missing catalog data.

**How to apply:** when adding/auditing catalog items, check coverage per serviceType.
Brand words ("ikea", etc.) are in STOPWORDS so they don't skew the OR-match median —
keep item nouns matchable, not brand-qualified.
