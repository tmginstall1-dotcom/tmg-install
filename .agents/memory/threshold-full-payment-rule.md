---
name: Threshold full-payment rule
description: Under-$150 jobs require full payment upfront; how the single-source rule fans out across the codebase.
---

# Threshold full-payment rule

Jobs with `total < FULL_PAYMENT_THRESHOLD` (150) must be paid IN FULL to confirm
(deposit = total, final = 0, paymentStatus eventually paid_in_full). Jobs >= 150
keep 50% deposit + 50% final.

**Source of truth:** `requiresFullUpfront(total)` in `shared/pricing.ts`. Always
branch on this — never re-derive the threshold inline.

**Why:** the rule has to stay identical across pricing math, payment state, and
every customer-facing surface, or customers get charged/told the wrong thing.
A single helper is the only way to keep ~20 surfaces in lockstep.

**How to apply when touching anything payment-related:**
- Server math: route through the centralized helpers in `server/routes.ts`
  (`splitDepositFinal`, `depositPaidFallback`, `finalBalanceOutstanding`). The
  fallback helpers also correct legacy `depositAmount=0` and stale
  under-150 split rows — do not read raw `depositAmount`/`finalAmount` directly.
- Final-payment request paths must short-circuit (409) when balance is 0 so
  full-upfront jobs never enter final collection.
- Copy lives in MANY independent spots that each need a `requiresFullUpfront`
  (or pre-quote neutral) branch: emails, WhatsApp (incl. agent intake +
  reminders), AI draft-email brief, admin Export PDF (screen + print), invoice
  payload/on-screen/PDF, QuoteStatus, Estimate, Invoice, Landing timeline cards,
  Terms page. After editing, sweep `rg -ni "50% deposit|final 50%|remaining 50%"`
  across client/src + server email/whatsapp and confirm each remaining hit is
  either a CSS gradient coord or inside a full-pay conditional else branch.
- Seeded content (`server/seed.ts` FAQ + canned replies) only re-seeds when the
  table is empty — editing the seed strings does NOT update existing production
  rows; that needs a separate migration.
