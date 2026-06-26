---
name: Admin dashboard full-list fetch stall
description: Why the admin dashboard could spin on "Loading dashboard" forever, and the resilience rule for full-screen-gated data fetches.
---

The admin dashboard's quote list query (`useQuotes()` with no status filter) pulls
EVERY quote with full nested detail (items, updates, customer, team, catalog) —
hundreds of rows, ~3.3s server time, unbounded growth. The dashboard gates the
whole screen on `isLoading`.

The global queryClient default is `retry: false`, and the list fetch had no
timeout. On a flaky mobile / iOS-PWA connection a large download can stall with
no response, so the fetch promise never settles → the query stays pending → the
"Loading dashboard" spinner runs forever with no recovery.

**Rule:** any data fetch that gates a full-screen loading state must (1) wrap
fetch in an AbortController timeout so a stall becomes a rejected promise, (2)
enable retry for network/5xx (but NOT 4xx — an expired session won't fix itself),
and (3) surface an error state with a Retry button instead of only a spinner.

**Why:** without all three, one stalled request = permanently frozen screen, and
the user has no escape except a hard refresh (which on iOS PWA may reuse the same
stalled connection).

**How to apply:** when adding/auditing a query whose `isLoading` blocks the page,
check for timeout + retry predicate + error UI. Prefer this client resilience fix
over reshaping the shared `/api/quotes` payload (consumed by Dashboard, Schedule,
search) unless a payload-reduction follow-up is explicitly scoped.
