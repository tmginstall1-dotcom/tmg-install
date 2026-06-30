---
name: GpsMap z-index isolation
description: Why the GpsMap card must establish its own stacking context, or its overlays bleed over the admin bottom nav/drawer.
---

# GpsMap overlays must be isolated

The non-fullscreen `GpsMap` card (`client/src/components/GpsMap.tsx`) renders
its floating overlays (speed panel, route stats box, map control buttons,
layer switcher) at `zIndex: 900`, and Leaflet's own panes/controls reach
~400–1000.

**Rule:** the non-fullscreen map wrapper must create its own stacking context
(Tailwind `isolate` = `isolation: isolate`). Without it the z-900 overlays are
positioned descendants of an ancestor stacking context and paint ABOVE the
fixed admin bottom nav + "More" drawer (which sit at only `z-50`/`z-40` in
`AdminBottomNav.tsx`), so opening the More menu shows map panels punching
through it.

**Why:** raising the nav/drawer z-index instead is wrong — real modals
(toasts `z-[100]`, dialogs `z-[200]`/`z-[300]`) must still cover the nav.
Containing the map is the correct root-cause fix; the card then paints at
page-flow level (below the fixed nav) while overlays stay layered inside it.

**How to apply:** keep `isolate` on the non-fullscreen branch of the GpsMap
root div. The fullscreen branch stays `fixed inset-0 z-[9999]` (intentional
full-screen takeover). Any future page-content element that uses a large
z-index to float over a map/card should likewise be wrapped in an isolated
container rather than competing with the global nav z-index.
