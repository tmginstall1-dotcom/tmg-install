---
name: Staff pricing strip coverage
description: Where quote pricing must be stripped before reaching non-admin (staff) clients.
---

Staff must never receive quote pricing. Stripping must cover EVERY response path a
non-admin caller can reach that echoes a quote, not just the GET feeds.

**Why:** It's easy to strip the obvious read paths (`GET /api/quotes/:id`,
`GET /api/staff/quotes`) and forget that the staff job-action mutation endpoints
also `res.json(quote)` the updated quote back: arrived, site-clock, stage,
completed-checkout. Those leaked full money fields until caught in review.

**How to apply:**
- The strip helper nulls quote money fields (incl. `discount` and the free-text
  `additionalChargeNote`, which can contain dollar amounts), per-item
  unitPrice/subtotal, catalogItem.basePrice, and empties `payments`.
- Use the role-aware `quoteForCaller(req, quote)` wrapper (admin gets full,
  everyone else stripped) on any handler that returns a quote to a caller who
  might be staff. Adding a new quote-returning endpoint? Route it through that.
