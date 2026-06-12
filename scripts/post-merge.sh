#!/bin/bash
set -e

# -----------------------------------------------------------------------------
# Apply database schema changes after a merge.
#
# We use committed Drizzle migration files (in ./migrations) applied with
# `drizzle-kit migrate`, NOT `drizzle-kit push`. `push` is interactive: when a
# schema diff is ambiguous (e.g. it suspects a new column is a rename) it stalls
# on a TTY prompt that can't be answered over piped/closed stdin, and the whole
# change set is then silently dropped. `migrate` only replays the SQL we already
# committed, so it is fully non-interactive and idempotent (it records applied
# migrations in drizzle.__drizzle_migrations and skips them on re-runs).
#
# Workflow for future schema changes:
#   1. Edit shared/schema.ts.
#   2. Run `npx drizzle-kit generate` (interactively, in your dev env, where you
#      can answer any create-vs-rename prompt). Commit the new migrations/*.sql.
#   3. This script applies them on merge via `drizzle-kit migrate`.
# -----------------------------------------------------------------------------

if [ -z "$DATABASE_URL" ]; then
  echo "post-merge: DATABASE_URL not set, skipping database migration."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"
JOURNAL="$MIGRATIONS_DIR/meta/_journal.json"

# Baseline adoption: this project's databases were originally built with
# `drizzle-kit push`, so they already contain all the application tables but have
# no drizzle migration journal. Running `migrate` against such a database would
# try to CREATE TABLE objects that already exist and fail. If the database
# already has the app schema (the `quotes` table) but no recorded migrations,
# stamp the FIRST (baseline) migration as already applied so `migrate` skips it
# and only applies genuinely new migrations going forward. On a fresh database
# (no `quotes` table) we do nothing here and let `migrate` create everything.
if [ -f "$JOURNAL" ]; then
  BASELINE_WHEN="$(JOURNAL_PATH="$JOURNAL" node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(process.env.JOURNAL_PATH,'utf8')); const e=j.entries&&j.entries[0]; process.stdout.write(e? String(e.when):'');" 2>/dev/null || true)"
  BASELINE_TAG="$(JOURNAL_PATH="$JOURNAL" node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync(process.env.JOURNAL_PATH,'utf8')); const e=j.entries&&j.entries[0]; process.stdout.write(e? String(e.tag):'');" 2>/dev/null || true)"
  if [ -n "$BASELINE_WHEN" ] && [ -n "$BASELINE_TAG" ] && [ -f "$MIGRATIONS_DIR/$BASELINE_TAG.sql" ]; then
    BASELINE_HASH="$(sha256sum "$MIGRATIONS_DIR/$BASELINE_TAG.sql" | cut -d' ' -f1)"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
      -c "CREATE SCHEMA IF NOT EXISTS drizzle;" \
      -c "CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);" \
      -c "INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          SELECT '$BASELINE_HASH', $BASELINE_WHEN
          WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quotes')
            AND NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations);" \
      >/dev/null
  fi
fi

# Apply any pending migrations. Non-interactive and idempotent.
npx drizzle-kit migrate
