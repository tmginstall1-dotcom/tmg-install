---
name: Marketing homepage perf deferrals
description: Invariants for the client-rendered homepage's mobile performance — deferred trackers, hero LCP, leaflet CSS.
---

# Marketing homepage (LandingCinematic) mobile performance

The homepage `/` is `client/src/pages/customer/LandingCinematic.tsx`, a
client-rendered React SPA route (eagerly bundled into the main entry chunk).

## Mobile hero is text, not an image
**Rule:** Do NOT add a hero `<img>` preload to `client/index.html` for mobile.
The mobile hero is the purely typographic "TMG" wordmark, so the LCP element is
text — preloading a work photo just wastes critical-window bandwidth.
**Why:** A stale preload (wrong path `/work/...` vs actual `/images/work/...`)
for a non-existent mobile hero image was hurting LCP.

## Splash wordmark MUST equal the real hero wordmark (same SYSTEM font)
**Rule:** The inline `#splash-tmg` "TMG" in `client/index.html` and the React
hero (`.hero-h1-responsive`, h1 in LandingCinematic) MUST be pixel-identical:
same SYSTEM-only font stack (`-apple-system,system-ui,'Segoe UI',Roboto,Arial,
sans-serif`), size clamp, weight, italic, letter-spacing, line-height. No web
font (no Inter, no Teko/`font-serif`) on the wordmark.
**Why:** Splash used Inter, hero used `font-serif`→Teko (async web font, italic/
900 not even loaded). Different font/size meant the revealed hero was a NEW,
LARGER, LATER contentful paint that superseded the splash → LCP 4.7s. Matching
them in an instant system font locks LCP to the early splash paint (1.5s); the
revealed hero is the same element so it never becomes a new LCP candidate.
**How to apply:** Section titles / ghost "built properly." text keep Teko on
purpose — only the giant hero wordmark must be system font.

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
(1) DEFER the React mount behind a **double requestAnimationFrame** so the inline
splash paints FIRST (fast FCP) before the heavy synchronous render runs;
(2) keep `#root` `visibility:hidden` until styles apply, then reveal — hidden
elements don't paint so the reflow is never a shift; (3) gate the reveal on a
**rAF poll of `window.__cssReady`** (race-proof — fires the instant CSS applies
even if the link `load` event was missed) plus load/error listeners + a long
last-resort timeout; (4) homepage crawler block `#seo-home`
(`server/seo-pages.ts`) is inline **sr-only** (absolute/1px/clip).
**Why:** Async CSS without (4) took CLS 0 → 0.385. Mounting React synchronously
at module eval blocked the splash's first paint → FCP regressed to 2.6s; the
double-rAF defer restored FCP to 1.5s. LCP is held early by the splash==hero
system-font match (see above), so deferring the mount no longer risks LCP.
NEVER reveal unstyled content on the fallback path or CLS returns.

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

## Below-the-fold sections are progressively revealed (TBT)
Only `<Hero/>` renders eagerly; everything below it is wrapped in
`<ProgressiveReveal>` in LandingCinematic. It renders nothing until it "starts"
(requestIdleCallback 1500ms OR first scroll/pointerdown), then mounts ONE child
per animation frame so each section is its own short task instead of one giant
blocking render.
**Rule:** Any in-page hash link in the hero (`#package`/`#services`/
`#assembly-scroll`/`#business`) points INTO deferred content, so it MUST call
`revealAndScrollTo(id)` (dispatches `tmg:reveal-all` → ProgressiveReveal mounts
everything immediately, then rAF-polls for the target and scrolls). A plain
`href="#..."` would fail to scroll before the target mounts.
**Why:** Eager full-homepage render gave TBT 580ms / 7 long tasks once FCP+LCP
were green. framer-motion stays eager (hero uses it); ThreeFurnitureScene is
already React.lazy.
