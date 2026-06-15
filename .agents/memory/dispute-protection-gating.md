---
name: Dispute-protection gating
description: Cross-surface rules for the quote terms/dispute-protection feature — payment gating, re-versioning, and admin surcharge confirmation.
---

# Dispute-protection gating rules

The "Quote terms & dispute protection" feature spans several surfaces that must
move in lockstep. Three rules are easy to half-implement and were each caught in
review:

## 1. The terms gate must block EVERY payment path, not just one
The customer quote page offers more than one way to pay (Stripe checkout button
AND a PayNow QR + bank-transfer instructions). Gating only the Stripe button on
`termsAcceptedForCurrentVersion` leaves PayNow as an unaccepted payment path,
which defeats dispute protection.

**Rule:** when you add ANY new payment affordance to the customer flow, gate it
behind the same acceptance check as the others.
**Why:** dispute protection depends on the customer having accepted the current
quote version before money moves — an ungated alternate path silently bypasses it.

## 2. Re-version on edits to SENT quotes, not only ACCEPTED ones
`editQuote` bumps the quote version (invalidating acceptance, forcing re-accept)
when scope/price/timing changes. Triggering only when a prior acceptance exists
misses sent-but-unaccepted quotes (status `approved` / `deposit_requested`),
letting an in-flight quote be paid against stale terms.

**Rule:** treat "sent to customer" (accepted OR in a customer-facing
accept/pay status) as the trigger, gated by `!finalPaidAt`. Quotes still being
prepared (draft / submitted / under_review) must NOT auto-bump on every edit.
**Why:** the version number is the customer's reference for what they agreed to;
it must advance whenever a customer-visible quote's substance changes.

`bumpQuoteVersion` should only set the `superseded` flag when a prior acceptance
actually existed — an unaccepted bump just advances the version (and logs a
distinct dispute event), so the UI doesn't falsely label it "(superseded)".

## 3. Selecting split timing / after-office requires an explicit admin ack
In the admin quote edit form, choosing split timing or after-office work must
force the admin to confirm (a required checkbox, save blocked + button disabled)
that the resulting surcharge was added to the quote OR waived in writing.
**Why:** these are the surcharge cases that generate billing disputes; the ack
makes the decision deliberate and on the record. Ack state is local-only and
must reset each time edit mode opens.
