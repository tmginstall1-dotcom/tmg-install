---
name: Quote detail query-key
description: The canonical TanStack key for a single quote and the invalidation footgun in admin mutations.
---

The single-quote query (`useQuote`) is keyed `[api.quotes.get.path, id, refNo]`,
where `api.quotes.get.path` === `'/api/quotes/:id'` (the literal route pattern,
NOT `'/api/quotes'`). The list query is `[api.quotes.list.path]` === `'/api/quotes'`.

**Rule:** to refresh the quote detail after a mutation, invalidate
`['/api/quotes/:id', id]` (prefix-matches the 3-element key). Invalidating
`['/api/quotes', id]` does NOT match and leaves the detail panel stale.

**Why:** QuoteDetail.tsx does not import `api`, so its mutations use literal
string keys and have drifted into mixed forms (`['/api/quotes/:id', id]`,
`['/api/quotes/${id}']`, `['/api/quotes', id]`). Only the `'/api/quotes/:id'`
form actually invalidates the detail. A refund mutation shipped with the wrong
`'/api/quotes'` key and showed stale acceptance/refund data until manual refresh.

**How to apply:** when adding any admin quote mutation in QuoteDetail.tsx, use
`['/api/quotes/:id', id]` for the detail and `['/api/quotes']` for the list.
