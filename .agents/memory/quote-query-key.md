---
name: Quote detail query-key invariant
description: The canonical TanStack key for a single quote and the invalidation footgun in admin mutations.
---

The single-quote detail query is keyed off the literal route pattern
`'/api/quotes/:id'` (NOT `'/api/quotes'`). The list query is keyed `'/api/quotes'`.

**Rule:** to refresh the quote detail after a mutation, invalidate
`['/api/quotes/:id', id]`. Invalidating `['/api/quotes', id]` does NOT match the
detail key and leaves the panel stale.

**Why:** admin quote mutations use literal string keys (no shared `api` import)
and have drifted into mixed forms; only the `'/api/quotes/:id'` form invalidates
the detail. A mutation shipped with the wrong `'/api/quotes'` key and showed
stale data until a manual refresh.

**How to apply:** when adding any admin quote mutation, use
`['/api/quotes/:id', id]` for the detail and `['/api/quotes']` for the list.
