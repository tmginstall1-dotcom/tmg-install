---
name: drizzle-kit push is interactive here
description: Why `npm run db:push` can hang when adding columns, and the workaround.
---

When adding a new column to an existing table, `drizzle-kit push` (the `db:push`
script) may pause on a TTY prompt: "Is <col> created or renamed from another
column?" with create/rename options. Passing `--force` does NOT skip this, and
piping newlines (`printf '\n' | ...`) does not satisfy it — drizzle re-renders
and the command hangs.

**Workaround:** apply additive column changes with direct SQL instead, then the
schema already matches and push won't prompt. Use the code_execution sandbox:
`executeSql({ sqlQuery: "ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <col> <type>;" })`.

**Why:** the rename-detection heuristic fires whenever a new column name is
"close enough" to an existing one, and the prompt is unavoidable non-
interactively in this environment.

**How to apply:** for simple additive (nullable) columns, prefer `ALTER TABLE
... ADD COLUMN IF NOT EXISTS` via SQL. Keep the Drizzle schema in sync so types
flow through. Reserve interactive `db:push` for when a real terminal is
available.
