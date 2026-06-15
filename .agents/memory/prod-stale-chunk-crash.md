---
name: Production "Something went wrong" stale-chunk crash
description: Why the published PWA shows the catch-all ErrorBoundary after a deploy, and why the deploy-log migration warning is a false alarm.
---

# Production "Something went wrong" crash (client-side, post-deploy)

When the **published** app (not dev) shows the catch-all ErrorBoundary
("Something went wrong / Please … reopen the app"), the usual cause is a
**stale lazy-chunk load after a redeploy**, NOT a server or schema problem.

**Mechanism:** every route is `React.lazy(() => import(...))` → content-hashed
chunks (`/assets/Foo-<hash>.js`). The service worker (`client/public/sw.js`)
caches `/assets/*` cache-first forever. A new publish changes the hashes; a
returning visitor / installed PWA whose app shell is stale requests an old
chunk filename that 404s → dynamic import rejects → React throws → ErrorBoundary.

**Why:** the old "Try again" button only reset boundary state and re-ran the
same dead import, so it could never recover — users got stuck.

**How to apply / fix pattern:**
- Wrap lazy imports in a `lazyWithReload` helper that, on import failure, does a
  time-guarded ONE-TIME `window.location.reload()` (sessionStorage timestamp,
  >10s apart) — the reload pulls the fresh index.html (network-first) + new
  chunks. The time guard prevents an infinite reload loop on a genuine code bug.
- ErrorBoundary "Try again" must do `window.location.reload()`, not setState.
- Bump the SW cache version (e.g. v6→v7) so the new worker activates, claims
  clients, and drops stale caches.
- Already-broken clients self-heal on one manual hard refresh once the fix is
  published (HTML is network-first).
- The SW registration must add a one-shot `controllerchange` -> reload listener
  (attached ONLY when `navigator.serviceWorker.controller` already exists, so a
  first-time visitor's `clients.claim()` doesn't reload) plus `registration.update()`
  on load. Without it, `skipWaiting()` + `clients.claim()` makes the new worker
  take control but does NOT refresh the already-rendered stale page, so a
  returning user stays stuck until they reload a SECOND time.

**Why a plain reload does NOT rescue a stuck device:** the reload navigation is
served by the OLD service worker that is still in control; only after the new
worker activates does a subsequent navigation get fresh HTML. So the immediate
manual rescue for an already-stuck device is a HARD reload (Ctrl/Cmd+Shift+R,
which bypasses the SW) or clearing the site's data / reinstalling the PWA — a
normal reload is not enough. The controllerchange handler only auto-rescues
pages that already loaded the fixed index.html at least once.

# The HARD case: an installed iOS PWA pinned to an old service worker

An installed iOS PWA (Add to Home Screen) is the worst case: it can stay pinned
to an ancient service worker that serves the whole shell from cache and ignores
in-page reloads entirely, so shipping new app code does nothing — the new bundle
is never even fetched. In-page JS recovery (`hardReload()` etc.) can't help
because that JS lives in a bundle the pinned SW won't serve.

**The only reliable lever is the SW file itself.** The browser ALWAYS
revalidates `sw.js` (bypassing the HTTP cache), and an installed PWA re-checks it
on cold launch. So put the rescue IN the SW's `activate` handler: after purging
old caches and `clients.claim()`, if this activation deleted caches from a prior
version (an UPDATE, detect via `staleCacheKeys.length > 0`, NOT a first install),
call `client.navigate(client.url)` on every window client. That forces each
window onto a fresh navigation under the new (network-first-for-HTML) worker,
pulling a fresh index.html + bundle — driven entirely by the SW, so it reaches
pinned clients no page-level code could.

**Why guard on "did we delete a prior-version cache":** without it, the first-
ever install also fires `activate` and would needlessly navigate/reload a brand
new visitor. Only navigate on a genuine version upgrade.

**Confirm it's caching, not a real 404, before any of this:** `curl` the prod
index.html, extract every `/assets/*.js` chunk the entry bundle references, and
HEAD-check them — if they all return 200 (they did here: 140/140), the server is
fine and the bug is 100% stale client state. Don't touch the server/schema.

**Manual rescue for the user's pinned iOS PWA:** fully close the app (swipe it
out of the app switcher) and relaunch — cold launch re-checks sw.js and the new
activate handler self-heals. If still stuck, delete the home-screen icon and
re-add it (nuclear, always works).

# The DURABLE fix after smarter-caching kept failing: stop caching entirely

After multiple rounds of "smarter" caching service workers (network-first HTML,
activate-time force-navigate, hardReload) STILL could not reliably rescue a
pinned iOS PWA, the right call was to stop fighting the SW cache and remove it:
make `sw.js` a **push-only worker with NO `fetch` handler at all**. With no
fetch interception the browser loads every navigation + script straight from
the network, and since the server already sends `no-cache` for index.html and
`immutable` for content-hashed `/assets/*`, the app is always fresh and the
stale-shell crash becomes **structurally impossible** — there is no cache for
it to be served from.

**Why not just delete the SW?** It also carries the Web Push handlers
(`push` + `notificationclick`) for WhatsApp admin alerts. Push needs a
registered worker but does NOT need a fetch handler — so keep the worker, keep
the push handlers, drop only the caching/fetch logic. The new worker's
`activate` still deletes every old cache + `clients.claim()` + navigates open
windows so already-stuck pages re-fetch fresh on the next update.

**Verified server-side caching headers (all correct, don't touch):** prod
`/sw.js` and `/` (index.html) both come back `Cache-Control: no-cache`,
hashed `/assets/*` come back `private, max-age=31536000, immutable`. So the bug
was never HTTP caching — it was the SW's own Cache Storage. Set in
`server/static.ts` (sw.js + both manifest*.json forced to `no-cache`; html
`no-cache,no-store,must-revalidate`; assets immutable 1y).

**Tradeoff accepted:** browser PWA loses offline browsing. Fine for an ops/admin
tool; the native Capacitor staff app handles its own offline data separately.

**Two PWA manifests exist:** `client/public/manifest.json` (start_url `/`) and
`manifest-admin.json` (start_url `/admin`) — a device may be pinned to either.

**iOS shares ONE service worker between Safari AND the home-screen PWA** for an
origin. Proven the hard way: a clean external browser renders prod perfectly,
but the user's iPhone crashed in BOTH the installed PWA and plain Safari — same
stuck worker. So "just use Safari" is NOT a workaround, and you cannot assume a
deploy reaches the device; Apple releases a pinned worker too unreliably.

**The remote escape hatch: a `/reset` repair link.** Added `GET /reset` in
`server/index.ts`, registered BEFORE the SPA/Vite catch-all so it loads even
when the app bundle is broken. It returns a tiny self-contained HTML page (no
app bundle / SW dependency) whose inline JS `getRegistrations().unregister()` +
`caches.delete()` for all, then `location.replace('/?fresh='+Date.now())`.
Works regardless of the old worker's fetch strategy because `/reset` is a
brand-new path (cache miss → network → server). User instruction: open
`tmginstall.com/reset` once and tap the button.

**Security — the wipe MUST be gated behind a click, and the bare GET must send
NO `Clear-Site-Data` header.** An auto-wiping `/reset` is a drive-by CSRF/DoS
hole: any external site can top-level-navigate a victim there and nuke their
storage / unregister their worker. Gating the clear behind a button tap on our
own origin's page (and dropping the header) neutralizes it. Don't "optimize" it
back to auto-run on load. Safari honors `Clear-Site-Data` inconsistently anyway,
so the click-gated inline JS is the real mechanism — the header added nothing.

# Deploy-log migration warning is a FALSE ALARM here

Deploy logs print "the connected database is MISSING committed schema
migrations (0000_baseline, 0001…, 0002…) — runtime errors like column does not
exist may occur." On this project that is **cosmetic**: a read-only prod query
confirmed all the migrated columns/tables exist; only `drizzle.__drizzle_migrations`
(the tracking table) is absent. Replit's Publish flow applies the dev→prod
schema diff structurally but does not write drizzle's journal table, so the
app's startup `check-migrations` check thinks nothing is applied.

**Do not** chase this by adding a migrate step to the deploy build/run or
running DDL against prod — the database skill forbids it; production schema is
owned by the Publish flow. Verify with a read-only prod query before acting.
