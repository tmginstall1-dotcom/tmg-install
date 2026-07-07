---
name: Payslip working-time deduction display
description: How admin working-time deductions (deductionMinutes/deductionReason) surface on the payslip without changing net pay
---

# Payslip working-time deduction

Admin working-time deductions live on `attendance_logs` (`deductionMinutes` + `deductionReason`) and were historically subtracted from paid hours silently. The payslip now shows them as their own "Working-Time Deduction" line with the reason(s).

## Invariant (keep in lockstep)
The payslip Earnings section displays **GROSS** hours/pay (worked time after unpaid breaks, BEFORE the admin deduction). The deduction is shown as a separate line whose dollar value = `grossEarnings − netEarnings` (reg×hourly + OT×otRate, each split at the 8h/day cap). That line is subtracted in the generate route, so **net pay (grossPay) is byte-for-byte what it was before** the line existed.

- Meal allowance still uses **NET** daily OT (unchanged) — do not switch it to gross.
- Reasons are grouped by `deductionReason` string and summed into `deduction_details` (jsonb `[{reason, minutes}]`); totals in `time_deduction` (numeric $) + `time_deduction_minutes` (int) on the `payslips` table.
- Backward compatible: old payslips stored NET hours with null new columns → render with no deduction line, still reconcile.

**Why:** the user wanted the deduction reason visible on the payslip (e.g. van-pickup-point clock-in on non-loading days) without altering take-home pay.

**How to apply:** any edit to payslip hour math must update BOTH the gross and net accumulators. P&L (server/routes.ts P&L route) computes staff cost independently from attendance using NET hours — it does NOT read payslip fields, but its net-hours formula must stay consistent with the payslip's net side (see [P&L salary calc]).

## Entry point (already existed)
Deductions are entered via the per-row attendance PATCH (`deductionMinutes`/`deductionReason`) or the "Bulk Deduct" modal in StaffManagement (`/api/admin/attendance/bulk-deduct` → `bulkDeductAttendance`, set/add modes, one reason applied per working day in the range).
