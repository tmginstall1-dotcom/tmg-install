---
name: Admin mobile bottom-nav clearance
description: Admin page wrappers must pad past the fixed mobile bottom nav + safe-area inset, or tail content is hidden.
---

# Admin mobile pages get cut off behind the fixed bottom nav

`AdminBottomNav` (client/src/components/layout/AdminBottomNav.tsx) renders a
`fixed bottom-0` bar that is `64px` tall **plus** `env(safe-area-inset-bottom)`
(the iPhone home-indicator strip). It is `sm:hidden` — desktop uses the left
sidebar (`lg:pl-56`) instead, no bottom bar.

**Rule:** every admin page wrapper (the `min-h-screen ... pt-14 lg:pl-56` div)
must reserve bottom space of at least nav-height + safe-area, e.g.
`pb-[calc(64px+env(safe-area-inset-bottom)+2rem)] lg:pb-12`.

**Why:** a flat `pb-24` (96px) is *less* than 64px + ~34px safe area on notched
iPhones, so the last cards sit under the nav and look cut off. Reported on the
Analytics page; same pattern existed on Receipts and Settings.

**How to apply:** when adding/editing an admin page, don't use a plain `pb-24`.
Use the safe-area calc above. If this keeps recurring, centralize the page-shell
padding into one shared admin layout class instead of repeating per page.
