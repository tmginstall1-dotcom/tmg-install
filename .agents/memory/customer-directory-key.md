---
name: Customer directory dedup key
description: How saved customers are deduped for the admin "Use a saved customer" lookup
---

# Customer directory dedup key

The `customers` table holds ONE row per quote (createQuote always inserts a new
customer row), so a returning customer has many rows. The admin "Use a saved
customer" picker (New Job modal) must show each person once.

**Rule:** dedup/group customers by a *canonical phone key*, not by id, email, or
raw phone. Canonical key = digits only, then drop a leading `65` SG country code
on a 10-digit number → `+65 9123 4567`, `6591234567`, `91234567` all map to
`91234567`. Email is unreliable (WhatsApp-only customers get placeholder
`<phone>@tmginstall.com` addresses).

**Why:** without normalization the same person appears multiple times and their
job_count / last_job_at split across format variants, defeating the lookup.

**How to apply:** any new customer-directory / "returning customer" / loyalty
surface should reuse the same canonical-phone grouping (see
`storage.getCustomersDirectory`, exposed via admin-only `GET /api/admin/customers`).
Keep the frontend phone normalization (strip `+65`) aligned with this. Skip
placeholder `@tmginstall.com` emails when displaying/auto-filling.
