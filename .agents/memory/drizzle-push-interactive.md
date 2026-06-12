---
name: drizzle schema changes use committed migrations
description: How schema changes reach the DB after merge; why push was abandoned.
---

# Schema changes apply via committed migrations, not `db:push`

`npm run db:push` (drizzle-kit) is interactive: when a diff is ambiguous (e.g. it
suspects a new column is a rename, which happens whenever a table has BOTH added
and removed columns, including drift between schema and a stale DB) it stalls on a
raw-TTY prompt. Piped/closed stdin does NOT answer it, and the entire change set is
then silently dropped — that is why columns went missing and DB-backed tests
skipped. `--force` only auto-approves data-loss; it does NOT resolve the
rename prompt.

**Current workflow (post-merge applies schema reliably):**
- `scripts/post-merge.sh` runs `npx drizzle-kit migrate` (non-interactive,
  idempotent; tracks applied migrations in `drizzle.__drizzle_migrations` and
  skips by `created_at` >= journal `when`).
- After editing `shared/schema.ts`, run `npx drizzle-kit generate` interactively
  in your dev env (answer any create-vs-rename prompt there) and COMMIT the new
  `migrations/*.sql` + `migrations/meta/_journal.json`. They apply on merge.

**Baseline adoption:** existing DBs were built by push (tables exist, no journal).
The script stamps the first/baseline migration as already-applied (insert into
`drizzle.__drizzle_migrations` with that migration's `when`) ONLY when `quotes`
exists and the journal is empty, so migrate skips recreating tables. Fresh DBs
(no `quotes`) skip the stamp and migrate creates everything.

**Why:** moved off push because its interactive rename prompt can't run in the
merge environment. Verified end-to-end against a fresh temp DB, an adopted
push-built DB, idempotent re-runs, and an incremental migration.
