---
name: GGV job-sheet scan has three money columns
description: The GGV/Gogovan daily job-sheet screenshot has THREE money columns; actualPrice is the rightmost one, read directly — never derived.
---

The GGV daily delivery/installation sheet (imported via the
`/api/admin/ggv-jobs/scan` vision endpoint) prints **three** money columns per
row, left to right:

1. listedPrice — gross/listed price, the LARGEST value (e.g. 587.90)
2. deduction — middle fee column (e.g. 107.87)
3. actualPrice — the ACTUAL installation payout TMG receives, the
   rightmost/SMALLEST value (e.g. 53.94)

**Rule:** `actualPrice` is its own printed column. It is NOT
`listedPrice − deduction`. Read all three directly from the image and persist
them independently.

**Why:** an earlier version of the scan assumed only two columns and recomputed
`actualPrice = listedPrice − deduction`, which silently overwrote the real
payout (53.94) with a wrong derived number (587.90 − 107.87 = 480.03). The three
columns have no fixed arithmetic relationship (a D-only row can have payout 0
while deduction is non-zero), so any "compute the third from the other two"
logic is wrong.

**How to apply:** if you touch the GGV scan prompt or its post-processing, keep
the three values independent — only normalize rounding and flag rows where
listedPrice or actualPrice is unreadable. Downstream, revenue/P&L
(`ggvEffective`) keys off `actualPrice`, and the admin review UI shows
Listed/Deduction/Actual as three separate columns.
