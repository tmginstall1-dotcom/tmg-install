---
name: P&L staff salary calc
description: How the admin P&L (/api/admin/analytics/pnl) computes Staff Salary cost, and why it is NOT calendar-day prorated.
---

# P&L Staff Salary cost

The admin P&L "Staff Salary" figure must equal what staff would actually be paid (payslip parity), NOT a calendar-day-prorated run-rate.

## Rules
- Monthly-salaried staff (`monthlyRate > 0`): full `monthlyRate` for EVERY month employed within the selected range — no proration by today's date.
- All staff additionally get actual hourly + overtime + meal allowance derived from real clock-in/out attendance logs within range.
- OT split mirrors the payslip generator: net hours = (clockOut − clockIn − deductionMinutes); regular capped at 8h/day; remainder is OT; OT rate falls back to 1.5× hourly when no explicit overtime rate is set.
- Meal allowance mirrors the payslip: $8 on any day whose OT exceeds 3h. The P&L calc reproduces payslip gross to the cent when replayed against real attendance.
- Monthly vs hourly cohorts are disjoint (`monthlyRate===0 && hourlyRate>0` is "hourly only"), so attendance pay is never double-counted.

**Why:** A monthly salary is paid in full regardless of the date; prorating it down to today understated the real monthly cost (showed $2,612.90 = 2700×30/31 instead of $2,700). User wants the P&L to match payslip cost.

**How to apply:** Keep the P&L salary math in lockstep with the payslip generator in the same file. If the payslip formula changes (OT rule, deduction handling), update the P&L `addAttendancePay` helper too.

## Known limitations (not bugs unless user asks)
- Staff with NULL `start_date` default to first-of-current-month, so multi-month ranges (e.g. "Last 6 Months") only count the current month's basic salary for them. Set start dates for accurate historical P&L.
- P&L salary includes basic + hourly + OT + meal allowance. It excludes transport allowance (only 1 job ever toggled; $0 on all prod payslips), unpaid-leave deductions ($0 — all leave is paid annual), and loan repayments (loan recovery, not a labour cost). Add these only if the user asks or they become material.
