---
name: Marketing homepage perf deferrals
description: Invariants for the client-rendered homepage's mobile performance — deferred trackers, hero LCP, leaflet CSS.
---

# Marketing homepage (LandingCinematic) mobile performance

The homepage `/` is `client/src/pages/customer/LandingCinematic.tsx`, a
client-rendered React SPA route (eagerly bundled into the main entry chunk).

## Mobile hero is text, not an image
**Rule:** Do NOT add a hero `<img>` preload to `client/index.html` for mobile.
The mobile hero is the purely typographic "TMG" wordmark (`font-serif`), so the
LCP element is text/font — preloading a work photo just wastes critical-window
bandwidth and competes with the real LCP.
**Why:** A stale preload (wrong path `/work/...` vs actual `/images/work/...`)
for a non-existent mobile hero image was hurting LCP.

## Deferred third-party trackers must stay reliable
gtag.js (in `index.html`) and Meta Pixel (`initMetaPixel` in `main.tsx`, called
from `main.tsx`) are loaded lazily: requestIdleCallback / first interaction
(pointerdown/keydown/touchstart/scroll) + visibilitychange(hidden)/pagehide +
a setTimeout fallback. The gtag() stub + config still run immediately so
dataLayer queues.
**Rule:** If you defer a tracker, you MUST (1) buffer early events so none are
lost before init, and (2) add visibilitychange/pagehide triggers so quick
no-interaction bounce sessions still fire. `metaPixel.ts` buffers
`trackPixelEvent` calls in a `pending` array and flushes on init (pixel has no
native pre-init queue, unlike gtag's dataLayer).

## Leaflet CSS belongs to the map chunk only
**Rule:** Import `leaflet/dist/leaflet.css` inside `GpsMap.tsx`, never globally
in `main.tsx`. Leaflet is only used by the admin/staff GPS map (lazy
StaffManagement chunk); a global import dumps ~unused CSS into the homepage's
critical CSS. Verify after build: leaflet CSS should be in `StaffManagement-*.css`,
not `index-*.css`.

## Async (non-blocking) main CSS — must gate React mount or CLS explodes
The main Vite CSS link is rewritten to non-blocking (`media=print` onload swap,
`data-async-css` + `window.__cssReady`) in `server/static.ts` (prod only) so the
inline-styled splash in `client/index.html` paints instantly (FCP/LCP ~1.5s).
**Rule:** With async CSS you MUST prevent the unstyled→styled reflow from being
recorded as CLS — even though it happens *behind* the opaque fixed splash, the
Layout Instability API still counts it. Two things make it work in lockstep:
(1) `main.tsx` DELAYS `createRoot().render()` until the deferred stylesheet has
applied (load event / `__cssReady`), with a ~3s fallback + immediate mount in
dev; (2) the homepage crawler block `#seo-home` (`server/seo-pages.ts`) is inline
**sr-only** (absolute/1px/clip) so it never paints visibly and never reflows.
**Why:** Shipping async CSS without these took mobile CLS from 0 → 0.385 (CWV
FAIL) while FCP/LCP improved — the deferred stylesheet applying caused the whole
unstyled `#root` (app + the then-visible SEO block) to reflow.

## Future work (not yet done)
Lazy-mount below-the-fold sections of LandingCinematic (intersection/idle) to
cut initial JS execution + long main-thread tasks. Left undone — larger refactor
on a ~2.5k-line file.
