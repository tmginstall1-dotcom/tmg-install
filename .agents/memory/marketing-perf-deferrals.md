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

## Async (non-blocking) main CSS — hide #root till styled, don't delay the mount
The main Vite CSS link is rewritten to non-blocking (`media=print` onload swap,
`data-async-css` + `window.__cssReady`) in `server/static.ts` (prod only) so the
inline-styled splash in `client/index.html` paints instantly (fast FCP).
**Rule:** With async CSS you MUST stop the unstyled→styled reflow from being
recorded as CLS — even *behind* the opaque fixed splash the Layout Instability
API still counts it. The correct shape (in `main.tsx`):
(1) MOUNT React immediately so its JS parse/execute overlaps the CSS download;
(2) keep `#root` `visibility:hidden` until styles apply, then reveal — hidden
elements don't paint so the reflow is never a shift; (3) gate the reveal on a
**rAF poll of `window.__cssReady`** (race-proof — fires the instant CSS applies
even if the link `load` event was missed) plus load/error listeners + a long
last-resort timeout; (4) homepage crawler block `#seo-home`
(`server/seo-pages.ts`) is inline **sr-only** (absolute/1px/clip).
**Why:** Async CSS without (4) took CLS 0 → 0.385. Then DELAYING the mount until
CSS-ready fixed CLS but serialized CSS→JS→paint and blew LCP to 5.3s. Mounting
immediately + hiding `#root` parallelizes the work: CLS stays ~0 AND LCP drops
back. NEVER reveal unstyled content on the fallback path or CLS returns.

## manualChunks: isolate tiny shared utils or they drag a big chunk eager
`clsx`/`class-variance-authority`/`tailwind-merge` (used by every eager shadcn
component via `cn`/`cva`) must be their OWN `vendor-utils` manualChunk in
`vite.config.ts`.
**Why:** Rollup co-located those utils INSIDE `vendor-charts` (recharts, ~419KB,
admin-only). The eager entry then statically imported `vendor-charts` for `cn`,
forcing 419KB of chart code onto the homepage critical path + its modulepreload.
**How to verify:** after build, the entry chunk (`grep __vite__mapDeps
dist/public/assets/index-*.js`) must have NO `import{…}from"./vendor-charts-*.js"`
static import; recharts should load only via the lazy admin pages.

## Future work (not yet done)
Lazy-mount below-the-fold sections of LandingCinematic (intersection/idle) to
cut initial JS execution + long main-thread tasks. Left undone — larger refactor
on a ~2.5k-line file.
