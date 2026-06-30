---
name: Staff break tracking
description: How self-service staff breaks are stored and where break math must stay in lockstep
---

Staff log unpaid breaks via a Start/End Break toggle on the staff clock screen. Breaks are stored as a JSONB array of `{startAt, endAt}` on the open attendance log; only the open shift (clockOutAt null) can take a break, and clock-out auto-closes any still-open break.

**Rule:** completed break minutes are subtracted from worked time everywhere worked time is shown or paid — keep these surfaces in lockstep:
- payroll generation (the per-day hours loop) subtracts break ms alongside the admin deduction
- admin timesheet/roster net-minute calcs subtract breaks (watch for double-subtracting the admin deduction — net = raw − deduction − breaks, computed once)
- staff dashboard "total today" + weekly totals + the live active-session timer all exclude break time

**Why:** breaks are unpaid; if any one surface forgets to subtract them, the staff-facing total stops reconciling with the payslip and over-reports paid hours.

**How to apply:** when adding any new attendance/hours display, fold break minutes into the same net formula. An open (un-ended) break counts only as live elapsed time on the active session, never toward paid totals.
