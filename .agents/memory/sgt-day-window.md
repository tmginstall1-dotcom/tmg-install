---
name: SGT calendar-day windows for GPS/job queries
description: Admin date pickers mean a Singapore (UTC+8) calendar day; build UTC ranges with the +08:00 ISO offset, not server-local midnight.
---

The admin date picker (GPS track, day-jobs) selects a Singapore calendar day.
Timestamps are stored UTC and the server runs UTC, so naive
`new Date(date+"T00:00:00")` builds a UTC-midnight window that is shifted 8h off
the intended SGT day — points/jobs near midnight land in the wrong day.

Correct: `new Date(date+"T00:00:00+08:00")` .. `+"T23:59:59.999+08:00"`, OR the
`+8h then slice(0,10)` trick for bucketing a stored timestamp into an SGT date.

**Why:** GPS-track window and job-schedule bucketing must use the SAME day
definition or the job-site match compares a staff member's GPS from one day
against jobs from another.

**How to apply:** any endpoint pairing time-filtered GPS/attendance with a
date-picker must pin both sides to SGT. (Matches the on-site-time-clock memo.)
