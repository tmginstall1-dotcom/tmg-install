---
name: Staff completion API backward-compat
description: Why job-completion endpoints must keep new acknowledgment fields optional
---

The staff app ships as a Capacitor native Android build (and a PWA). Both freeze
their web bundle — the native APK cannot hot-update, and the PWA only refreshes
HTML network-first. So any field newly *required* on an endpoint the staff app
calls will break every device still running an older bundle.

**Rule:** On `/api/quotes/:id/completed-checkout` and `/api/quotes/:id/stage`
(stage==='completed'), keep newly-added completion fields (e.g. signatureDataUrl,
customerName) OPTIONAL on the server. Persist them only when present; never
hard-reject a completion just because an old client omitted them. Partial
payloads (one of the pair present) may be rejected; both-absent must succeed.

**Why:** A "customer signature" feature made these fields required, and deployed
staff devices on the old bundle got 400 "Required" on every completion —
"staff always unable to press complete job". Native apps can't be force-updated,
so server tolerance is the only reliable fix.
