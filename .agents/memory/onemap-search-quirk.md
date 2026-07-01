---
name: OneMap search deprecation-error quirk
description: OneMap's public address search now embeds an auth "error" string even on successful HTTP 200 responses that still contain full results.
---

# OneMap search returns an `error` field but still works

The OneMap common/elastic search endpoint (proxied by `/api/onemap/search`)
now returns a body like `{"error":"Authentication token missing...","found":N,"results":[...]}`
**with HTTP 200** and a fully populated `results` array.

**Why:** OneMap is mid-deprecation toward token-required access but still serves
unauthenticated queries; the `error` string is a warning, not a failure.

**How to apply:**
- Do NOT treat the presence of `error` (or any auth-sounding message) as fatal.
  Branch on HTTP status and `results.length`, never on the `error` field.
- The proxy's `if (!upstream.ok)` guard is correct because the response is 200.
- OneMap's matcher dislikes the "BLK"/"BLOCK" prefix — "BLK 420 CLEMENTI AVENUE 1"
  returns 0 results while "420 CLEMENTI AVENUE 1" resolves exactly. Same for
  "Block 261 Serangoon". This silently broke staff GPS "on-site" matching for
  GGV/AI-imported jobs (whose addresses use the BLK prefix and often lack a
  postal code): geocode returned null → job showed "NOT LOCATED".
- Server-side `geocodeSgAddress` (server/geocode.ts) now tries ordered candidates
  (raw → BLK-stripped → first comma segment → segment BLK-stripped) and no longer
  caches null on transient 429/5xx (those throw TransientGeocodeError), so a blip
  can't permanently mark a real site "not located". Client `/api/onemap/search`
  autocomplete still needs users to type road/postal code + a graceful empty state.
- If OneMap eventually hard-requires a token, the fix is a token step
  (POST email+password to its getToken endpoint, cache ~3 days) — would need
  ONEMAP credentials as secrets, affecting both Estimate and PackageBooking.
