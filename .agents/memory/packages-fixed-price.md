---
name: Fixed-price package bookings
description: How fixed-price service packages (e.g. Essential Move S$288 NET) are modeled so the price survives the quote lifecycle.
---

# Fixed-price service packages

A fixed-price package booking is created as an ordinary quote with a **single
manual line item** priced at the package price. Do NOT invent a separate
"locked price" column or schema flag.

**Why:** `editQuote` recomputes `total = sum(item subtotals) − discounts + fees`.
A single line at the package price makes the recompute reproduce the same total,
so admin edits never drift the base price. Overtime / extra drilling are added
later by admin as *additional* line items, which correctly stack on top.

**How to apply:**
- Package definitions live in `shared/packages.ts` (single source of truth,
  imported by client display AND the server endpoint). The server reads the
  price from there — never trust a price from the client.
- The public booking endpoint must store the customer's chosen slot as
  `preferredDate` (yyyy-MM-dd) + `preferredTimeWindow`, NOT `scheduledAt`.
  The deposit-payment path (`updateQuotePayment` in storage) auto-confirms the
  booking only when both `preferredDate` and `preferredTimeWindow` are set;
  `scheduledAt` is set at that point. This mirrors the estimate wizard.
- Public unauthenticated POST endpoints that create quotes should carry a
  per-IP rate limit (same in-memory Map pattern as `/api/whatsapp/handoff`).
