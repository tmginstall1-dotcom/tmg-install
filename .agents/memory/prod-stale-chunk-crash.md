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
