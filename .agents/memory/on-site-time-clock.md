---
name: On-site time clock & auto second-day
description: How staff on-site time tracking computes per-day hours and auto-fills Second-Day Continuation.
---

# On-site time clock

Staff tap "Arrived on site" / "Going off site"; each session is stored on
`quotes.siteVisits` (jsonb array of `{arrivedAt, leftAt|null, byUserId}`).
`computeSiteTime(visits)` in `shared/pricing.ts` buckets sessions by Singapore
calendar day and returns day1Hours / secondDayHours / spansMultipleDays.

**Singapore is a fixed UTC+8 with no DST**, so SGT day boundaries are exact:
build them with `new Date(\`${dateKey}T00:00:00.000+08:00\`)` and every day is
exactly 24h. A session crossing midnight MUST be split at the boundary (e.g.
23:00→01:00 = 1h Day 1 + 1h Day 2), or a genuine second day gets hidden and
Second-Day Continuation is mis-charged. Group by `arrivedAt` alone is wrong.

**Why:** the whole point of the feature is detecting when work crosses into a
new day so the Day-2 continuation charge is accurate.

**How to apply:** when changing day-bucketing or hour totals, keep the
midnight-split logic and re-run the unit cases (midnight-cross, same-day,
two-days, open session).

## Auto second-day fold
On "Going off site", if sessions span 2+ days, `recordSiteDeparture` calls
`editQuote({quoteUpdates:{secondDayContinuation:true, secondDayHours}})` so the
total/balance/PayNow recompute (same pattern as other per-job fees — never write
totals directly). The tracked on-site time is the source of truth for these two
fields; a later checkout will re-sync them, overwriting manual admin edits to
Day-2 hours (acceptable: the user chose fully-automatic tracking).
siteVisits writes use a `db.transaction` + `.for('update')` row lock to avoid
lost updates from concurrent crew taps.
