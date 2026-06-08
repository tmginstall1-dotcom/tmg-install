---
name: Staff job action gating
description: Why staff action buttons must treat "booked"-with-assignment like "assigned"
---

# Staff job action gating

Staff-app actions (arrive/pickup photo, completion photo) must be available when a
job is status `booked` AND has an assignment (`assignedStaffId` or `assignedTeamId`),
not only when status is `assigned`.

**Why:** Jobs do NOT always pass through `assigned`. Admin "Create Job" and WhatsApp
phone-intake create jobs directly at `booked` with a staff/team already attached, and
a pre-assigned quote that gets auto-booked on deposit payment also lands at
`booked`-with-assignment. If the action gate only handles `assigned`, the assigned
crew sees "awaiting staff assignment" and has no submit button — the classic
"staff can't submit anything" report.

**How to apply:** Keep client `nextAction()` (staff/JobDetail) and the server state
guards in lockstep. The server `/stage` endpoint must accept `booked` as a source for
`at_pickup`, and `/arrived` must allow source status `assigned` or `booked`. All three
staff endpoints (`/arrived`, `/stage`, `/completed-checkout`) must enforce the same
authz: admin, the assigned solo staff, or a member of the assigned team.

Relocation detection caveat: admin-created relocation jobs carry `serviceType: "manual"`
line items (not `"relocate"`), so `isRelocationJob()` must also fall back to a non-empty
pickup/dropoff address (installs never set one) or `selectedServices` containing
"relocat".
