---
name: Admin route authorization
description: Admin API routes must verify the caller's role, not just that a session exists.
---

In `server/routes.ts`, checking only `req.session.userId` authenticates ANY logged-in
user — staff sessions included — so it is NOT sufficient for `/api/admin/*` routes.

**Rule:** every admin-only route must load the user and check the role:
```ts
if (!req.session?.userId) return res.status(401)...;
const caller = await storage.getUserById(req.session.userId);
if (!caller || caller.role !== "admin") return res.status(403).json({ message: "Forbidden" });
```

**Why:** a code review caught new payment routes that gated on `req.session.userId`
alone, leaving them reachable by ordinary staff. The established codebase pattern
(e.g. staff-list, invoice-message routes) always does the explicit `caller.role` check.

**How to apply:** when adding any `/api/admin/*` endpoint, mirror the role check above.
Also bind nested resources to their parent in both the route and storage layer
(e.g. delete-payment verifies the payment's `quoteId` matches the `:id` in the URL)
to prevent cross-resource IDOR via guessed child IDs.
