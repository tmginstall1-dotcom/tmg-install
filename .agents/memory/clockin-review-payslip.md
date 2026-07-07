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

## Two per-staff overrides (both boolean cols on users)
`mustClockInAtFirstJob` → first-job geofence ONLY (IKEA/van flagged). `canClockInAtVanPickup` → DRIVER: van pickup point OR IKEA OR first job all pass; anything else flagged. firstJobOnly takes precedence (`isDriver = canClockInAtVanPickup && !firstJobOnly`). Van pickup point is a fixed hardcoded coord in the review endpoint ("near Woodlands St 31" ~1.43047,103.77494) with a wider 500m radius (vs 300m for IKEA/job). Both set via Edit Profile toggles (PATCH /api/admin/staff/:id zod must whitelist each). Review endpoint returns top-level `firstJobOnly`+`isDriver`+`vanLabel`; modal summary, expected-location text, AT VAN badge, and backend suggestedReason all branch three-way (firstJobOnly / isDriver / default) — keep them in lockstep or driver reasons say the wrong allowed set. Same indeterminate rule applies (no first job / geocode fail → needsManualReview, not off-site).

**Why:** installers who ride out with a driver must be paid from the first job, not the van depot; the driver himself legitimately starts at the van pickup. Both are per-person because most installers use IKEA.

## Off-site enrichment: WHERE + DURATION (auto-suggested deduction)
For flagged (offSite) days only, the endpoint reverse-geocodes the clock-in GPS (`reverseGeocodeSg`) → `clockInPlace`, and derives `suggestedMinutes` = non-payable travel time = minutes from clock-in until the first real GPS dwell (computeGpsStops radius120/min8) that is >250m from the clock-in spot (same technique as firstJobFlagForAmendment), capped at the day's grossMinutes. Both go into `suggestedReason` ("Clocked in at <place> … — ~N min van/travel time not payable") and the modal PRE-FILLS the deduction minutes with suggestedMinutes so the day is ready to save. This intentionally makes `changedFromServer` true (minutes≠existing 0) → save enabled without a manual edit.

**Why:** user wanted the flag to show where they actually clocked in and how much travel time to dock, and to auto-estimate it from GPS (admin still adjustable). Reverse-geocode + GPS fetch are gated to offSite days only to bound cost.

## Must mirror bulkDeductAttendance day semantics
The review endpoint (`GET /api/admin/attendance/review`) and apply (`POST /api/admin/attendance/apply-review`) MUST match `storage.bulkDeductAttendance` or the review preview diverges from what actually gets saved:
- Group by SGT day (UTC+8). Deduction anchor = latest CLOSED log; day worked minutes/cap = SUM across ALL closed logs (split shifts), NOT the primary log alone.
- Lateness/arrival uses the EARLIEST clock-in of the day (even if that first session is open); clock-out/location uses the latest closed log.
- apply-review routes through `bulkDeductAttendance(mode:'set')`; minutes=0 clears the day (allowed at storage level; the standalone bulk-deduct ROUTE blocks 0, so a separate endpoint is required).

**Why:** an earlier version picked primary as latest-by-(clockOut||clockIn) from a single log → showed closed:false / 0 gross on days that actually had closed work, and under-represented the deduction cap on split shifts.
**How to apply:** if you touch either endpoint or bulkDeductAttendance, keep grouping + closed-log summing in lockstep across all three.
