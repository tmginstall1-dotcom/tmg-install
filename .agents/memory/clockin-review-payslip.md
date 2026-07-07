---
name: Monthly clock-in review (payslip prep)
description: How the pre-payslip clock-in review computes per-day lateness/deductions and why it mirrors bulkDeductAttendance.
---

# Monthly clock-in review

Admin reviews each installer's clock-in TIME + LOCATION once a month before generating a payslip, then applies per-day working-time deductions (which print on the payslip via the existing Working-Time Deduction line).

## Rules are person/day-specific → human-in-the-loop
Location correctness depends on unknowable daily context (e.g. installer only clocks in at job site on non-loading days; driver may clock in/out at van only if he drove out that day). So LOCATION is shown (readable address via GpsLocationPill) for the admin to judge — never auto-flagged. Only TIME is auto-flagged: late vs `users.clockInTime` (SGT "HH:MM"), 10-min grace, suggested deduction = late minutes capped at gross.

## Must mirror bulkDeductAttendance day semantics
The review endpoint (`GET /api/admin/attendance/review`) and apply (`POST /api/admin/attendance/apply-review`) MUST match `storage.bulkDeductAttendance` or the review preview diverges from what actually gets saved:
- Group by SGT day (UTC+8). Deduction anchor = latest CLOSED log; day worked minutes/cap = SUM across ALL closed logs (split shifts), NOT the primary log alone.
- Lateness/arrival uses the EARLIEST clock-in of the day (even if that first session is open); clock-out/location uses the latest closed log.
- apply-review routes through `bulkDeductAttendance(mode:'set')`; minutes=0 clears the day (allowed at storage level; the standalone bulk-deduct ROUTE blocks 0, so a separate endpoint is required).

**Why:** an earlier version picked primary as latest-by-(clockOut||clockIn) from a single log → showed closed:false / 0 gross on days that actually had closed work, and under-represented the deduction cap on split shifts.
**How to apply:** if you touch either endpoint or bulkDeductAttendance, keep grouping + closed-log summing in lockstep across all three.
