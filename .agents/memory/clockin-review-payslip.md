---
name: Monthly clock-in review (payslip prep)
description: How the pre-payslip clock-in review computes per-day lateness/deductions and why it mirrors bulkDeductAttendance.
---

# Monthly clock-in review

Admin reviews each installer's clock-in TIME + LOCATION once a month before generating a payslip, then applies per-day working-time deductions (which print on the payslip via the existing Working-Time Deduction line).

## The auto-flag is LOCATION, not lateness
The rule to check for installers: they must clock in either at the IKEA Alexandra warehouse OR at the day's FIRST job site. Lateness is explicitly NOT the rule (user corrected this). The review endpoint geocodes the earliest-scheduled job's site address (OneMap via geocodeSgAddress, cached) and haversine-compares the day's earliest clock-in GPS against IKEA Alexandra (fixed coords ~1.2894,103.8047) and the first-job coords with a 300m radius → matched ikea|firstJob, else offSite. Drivers have a different (van) rule the user didn't specify — the check is advisory, admin still sets the deduction amount.

**Why:** location rules depend on daily context, but "IKEA OR first job site" cleanly covers the installer loading-day-vs-not case, so it can be auto-checked as advisory.
**Edge case:** if a scheduled job exists but its address can't be geocoded, DON'T false-flag off-site — mark needsManualReview (CHECK badge) and let the admin judge. Days with no clock-in GPS → locationOk null (NO GPS).

## Per-installer override: first job site ONLY
`users.mustClockInAtFirstJob` (boolean) makes an installer stricter than the default: only the first-job geofence passes — IKEA/van pickup is flagged off-site (reason cites unpaid van→site travel time). Set per staff via the Edit Profile toggle (PATCH /api/admin/staff/:id). Review endpoint returns top-level `firstJobOnly`; the modal summary + per-row expected-location text branch on it. Same indeterminate rule applies (no first job / geocode fail → needsManualReview, not off-site).

**Why:** installers who ride out with a driver must be paid from the first job, not from the van depot; the general "IKEA OR first job" rule would wrongly pass their van clock-in. It's per-person because most installers can legitimately use IKEA.

## Must mirror bulkDeductAttendance day semantics
The review endpoint (`GET /api/admin/attendance/review`) and apply (`POST /api/admin/attendance/apply-review`) MUST match `storage.bulkDeductAttendance` or the review preview diverges from what actually gets saved:
- Group by SGT day (UTC+8). Deduction anchor = latest CLOSED log; day worked minutes/cap = SUM across ALL closed logs (split shifts), NOT the primary log alone.
- Lateness/arrival uses the EARLIEST clock-in of the day (even if that first session is open); clock-out/location uses the latest closed log.
- apply-review routes through `bulkDeductAttendance(mode:'set')`; minutes=0 clears the day (allowed at storage level; the standalone bulk-deduct ROUTE blocks 0, so a separate endpoint is required).

**Why:** an earlier version picked primary as latest-by-(clockOut||clockIn) from a single log → showed closed:false / 0 gross on days that actually had closed work, and under-represented the deduction cap on split shifts.
**How to apply:** if you touch either endpoint or bulkDeductAttendance, keep grouping + closed-log summing in lockstep across all three.
