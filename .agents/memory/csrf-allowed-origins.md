---
name: CSRF allowed-origins must include Replit domains
description: Why all POSTs 403 in the Replit preview/deploy env, and how UI-test failures can be transient
---

# CSRF allow-list must include Replit preview/deploy domains

The server enforces a CSRF Origin/Referer allow-list (`ALLOWED_ORIGINS` in
`server/index.ts`). If it only contains the production custom domain (APP_URL),
then **every** state-changing POST (login, accept-terms, refund, etc.) is
rejected with `403 Forbidden: cross-site request rejected` when the app is
accessed through the Replit preview URL (`*.janeway.replit.dev`) or a Replit
deployment domain — because the browser's Origin is that Replit host, not APP_URL.

**Fix:** add `REPLIT_DOMAINS` (comma-separated) and `REPLIT_DEV_DOMAIN` to the
allow-list as `https://<host>` at startup. These env vars are the app's own
hostnames, so this is not a security regression.

**Why:** GETs (e.g. `/checkout`) are CSRF-exempt and keep working, which masks
the problem — the app looks half-broken (pages load, actions 403). Easy to
misread as an app bug.

**How to apply:** when POSTs 403 only in the Replit env but work via direct
server-side calls, check the CSRF origin allow-list first. Because GETs are
exempt, confirm a suspected app bug by replaying the failing POST directly (with
a proper `Origin` header) before assuming the handler is broken.
