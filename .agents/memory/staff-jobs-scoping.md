---
name: Per-person staff job scoping
description: When a feature is about ONE staff member's own jobs (payroll, job-site check), getQuotesForStaff is too broad — it includes teammates' solo jobs.
---

`storage.getQuotesForStaff(staffId)` expands to the whole team: it pulls every
job assigned to any teammate individually PLUS team-assigned jobs. That is right
for the staff mobile app (a member can see the team's work) but WRONG for any
per-person view.

For per-person scope (payroll, GPS job-site check, "did THIS person go to THEIR
jobs"), use `storage.getQuotesAssignedTo(staffId)` — only `assignedStaffId === me`
OR `assignedTeamId === my teamId`.

**Why:** a payroll/site-check panel that includes teammates' solo jobs produces
false "not visited" rows and inflated off-job / dragging-hours signals.

**How to apply:** any new per-individual reporting over jobs picks
getQuotesAssignedTo, not getQuotesForStaff.
