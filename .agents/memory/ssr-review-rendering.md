---
name: SSR review/rating rendering
description: How admin-managed reviews + aggregate rating reach the SSR landing pages safely and stay consistent with the homepage.
---

# SSR reviews + aggregate rating

Admin-managed reviews and the star rating shown on SSR landing pages flow through an
in-memory cache in `server/seo-pages.ts` (set via `setReviewData`, read by the synchronous
page builders). `server/routes.ts` loads it at startup and refreshes it on every admin
review/rating mutation so the synchronous builders never go async.

## Escaping is mandatory (stored-XSS class)
The SSR pages interpolate strings straight into HTML and into a
`<script type="application/ld+json">` block. Any DB/admin-supplied string rendered there
MUST be:
- HTML-escaped before HTML interpolation (use the `esc()` helper — &,<,>,",').
- Protected against script-breakout in JSON-LD by escaping `<` → `\u003c` on the
  `JSON.stringify(...)` output, so review text containing `</script>` can't terminate the tag.

**Why:** review text is user/admin content; before escaping, a crafted review could inject
HTML/JS on every public landing page.
**How to apply:** whenever you add a new field rendered from the review cache (or any other
admin/DB string) into seo-pages output, wrap it in `esc()` and confirm the JSON-LD serializer
still does the `\u003c` replacement.

## Homepage consistency
The homepage (`client/index.html`) has a STATIC JSON-LD `aggregateRating`. It is kept in
lockstep with the admin-set rating by `injectHomepageRating(html)` (in seo-pages.ts), called
at serve time in BOTH `server/static.ts` (prod) and `server/vite.ts` (dev). It only rewrites
the aggregate `ratingValue` + `reviewCount` (the homepage review LIST is React-rendered, not
synced). The regex targets the value inside `"aggregateRating"` and the unique `"reviewCount"`
so per-review `"ratingValue":"5"` entries are left untouched.
**Why:** without this, changing the rating in admin would make the homepage rich-result
diverge from the SSR service pages.
