// =============================================================================
// GoGoVan first-job anchor tests (server/lib/ggv-first-job.ts)
//
// Run: npx tsx --test tests/ggvFirstJob.test.ts
//
// The monthly clock-in review uses pickFirstGgvJobForStaff to stand a GoGoVan
// job in as the day's first-job anchor when no assigned quote exists (the large
// historical set of GGV rows was imported before quote-mirroring, so those rows
// carry no assignment at all). These tests lock in the matching + earliest-first
// rules that decide which GGV job becomes the anchor.
//
// Pure logic only — no DB, network, or secrets required. Deterministic.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { pickFirstGgvJobForStaff, type GgvJobLike } from "../server/lib/ggv-first-job.ts";

const staff = { id: 2, teamId: 1 };

test("picks the earliest GoGoVan job of the day by start time", () => {
  const jobs: GgvJobLike[] = [
    { jobNo: "LATE", address: "6 Ardmore Park", postalCode: "259953", timeStart: "12:00", assignedStaffId: null, assignedTeamId: null },
    { jobNo: "EARLY", address: "95 Grange Road", postalCode: "249616", timeStart: "09:00", assignedStaffId: null, assignedTeamId: null },
  ];
  const first = pickFirstGgvJobForStaff(jobs, staff);
  assert.equal(first?.referenceNo, "EARLY");
  assert.equal(first?.address, "95 Grange Road 249616");
});

test("historical unassigned GGV rows are still matched (the core fix)", () => {
  const jobs: GgvJobLike[] = [
    { jobNo: "S045", address: "28 Leonie Hill", postalCode: "239227", timeStart: "09:00", assignedStaffId: null, assignedTeamId: null },
  ];
  const first = pickFirstGgvJobForStaff(jobs, staff);
  assert.ok(first, "an unassigned GGV job must anchor the day, else the review shows 'no scheduled job'");
  assert.equal(first?.referenceNo, "S045");
});

test("GGV jobs assigned to another team are ignored", () => {
  const jobs: GgvJobLike[] = [
    { jobNo: "OTHER", address: "10 Martin Place", postalCode: "237963", timeStart: "08:00", assignedStaffId: null, assignedTeamId: 99 },
    { jobNo: "MINE", address: "202 Kim Seng Road", postalCode: "239496", timeStart: "10:00", assignedStaffId: null, assignedTeamId: 1 },
  ];
  const first = pickFirstGgvJobForStaff(jobs, staff);
  assert.equal(first?.referenceNo, "MINE", "must skip the earlier job that belongs to another team");
});

test("a job assigned directly to the staff matches", () => {
  const jobs: GgvJobLike[] = [
    { jobNo: "DIRECT", address: "57 Paterson Road", postalCode: "238551", timeStart: "15:00", assignedStaffId: 2, assignedTeamId: null },
  ];
  const first = pickFirstGgvJobForStaff(jobs, staff);
  assert.equal(first?.referenceNo, "DIRECT");
});

test("jobs without a usable address are skipped in favour of one that has it", () => {
  const jobs: GgvJobLike[] = [
    { jobNo: "NOADDR", address: "", postalCode: "", timeStart: "07:00", assignedStaffId: null, assignedTeamId: null },
    { jobNo: "HASADDR", address: "3 Ardmore Park", postalCode: "259950", timeStart: "09:00", assignedStaffId: null, assignedTeamId: null },
  ];
  const first = pickFirstGgvJobForStaff(jobs, staff);
  assert.equal(first?.referenceNo, "HASADDR");
});

test("returns null when nothing matches the staff / team", () => {
  const jobs: GgvJobLike[] = [
    { jobNo: "X", address: "somewhere", postalCode: "111111", timeStart: "09:00", assignedStaffId: 999, assignedTeamId: 88 },
  ];
  assert.equal(pickFirstGgvJobForStaff(jobs, staff), null);
});

test("returns null for an empty job list", () => {
  assert.equal(pickFirstGgvJobForStaff([], staff), null);
});

test("falls back to booking ref, then a generic label, when jobNo is missing", () => {
  const byRef = pickFirstGgvJobForStaff(
    [{ bookingRef: "BK-1", address: "a", postalCode: "1", timeStart: "09:00", assignedStaffId: null, assignedTeamId: null }],
    staff,
  );
  assert.equal(byRef?.referenceNo, "BK-1");
  const generic = pickFirstGgvJobForStaff(
    [{ address: "a", postalCode: "1", timeStart: "09:00", assignedStaffId: null, assignedTeamId: null }],
    staff,
  );
  assert.equal(generic?.referenceNo, "GoGoVan job");
});
