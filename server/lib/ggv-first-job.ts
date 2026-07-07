// =============================================================================
// GoGoVan (GGV) first-job anchor for the monthly clock-in review
//
// GoGoVan jobs are imported into the `ggv_jobs` table (text date, start time,
// address). Only SOME of them are mirrored into an assigned `quotes` row, so on
// a real GGV work day the clock-in review can otherwise find "no scheduled job"
// even though the crew clearly worked. This helper lets the day's GoGoVan jobs
// stand in as the first-job anchor for the location + van→site travel checks.
//
// Business context (TMG): the GoGoVan crew is a single team that rides out
// together, so the day's EARLIEST GoGoVan job (by start time) is their shared
// first stop. Jobs are matched to a staff member when they are assigned to that
// staff / their team, OR when they are not yet assigned to anyone — the large
// historical set of GGV rows was imported before the quote-mirroring feature and
// so carries no assignment at all. This is why unassigned rows are included:
// dropping them would leave every historical GGV day showing "no scheduled job".
//
// Pure logic only — no DB, network, or secrets. Deterministic.
// =============================================================================

export interface GgvJobLike {
  jobNo?: string | null;
  bookingRef?: string | null;
  address?: string | null;
  postalCode?: string | null;
  timeStart?: string | null;
  assignedStaffId?: number | null;
  assignedTeamId?: number | null;
}

export interface GgvFirstJob {
  referenceNo: string;
  address: string;
}

// Pick the day's first GoGoVan job to use as a stand-in first-job anchor for a
// staff member. Considers only GGV jobs assigned to this staff or their team, or
// not yet assigned to anyone. Returns the earliest by start time that has a
// usable address, or null when there is nothing to anchor on.
export function pickFirstGgvJobForStaff(
  jobs: GgvJobLike[],
  staff: { id: number; teamId: number | null | undefined },
): GgvFirstJob | null {
  const candidates = jobs
    .filter((g) =>
      g.assignedStaffId === staff.id ||
      (staff.teamId != null && g.assignedTeamId === staff.teamId) ||
      (g.assignedStaffId == null && g.assignedTeamId == null))
    .map((g) => ({
      ref: (g.jobNo || g.bookingRef || "GoGoVan job") as string,
      address: [g.address, g.postalCode].filter(Boolean).join(" ").trim(),
      // Normalise start time to HH:MM for a stable earliest-first sort; rows
      // without a valid time sink to the end so a timed job always wins.
      t: g.timeStart && /^\d{1,2}:\d{2}$/.test(g.timeStart) ? g.timeStart.padStart(5, "0") : "99:99",
    }))
    .filter((x) => x.address)
    .sort((a, b) => (a.t === b.t ? 0 : a.t < b.t ? -1 : 1));

  if (!candidates.length) return null;
  return { referenceNo: candidates[0].ref, address: candidates[0].address };
}
