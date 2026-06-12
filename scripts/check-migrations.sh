#!/bin/bash
set -e

# -----------------------------------------------------------------------------
# Guard: fail if shared/schema.ts is ahead of the committed migrations.
#
# Schema changes only reach the database after merge via committed migration
# files (migrations/*.sql) applied by `drizzle-kit migrate` (see
# scripts/post-merge.sh). If someone edits shared/schema.ts but forgets to run
# `npx drizzle-kit generate` and commit the resulting migration, the change
# silently never reaches the database after merge.
#
# This check runs `drizzle-kit generate` against a throwaway copy of the
# migrations folder. If generate would produce a NEW .sql migration, the schema
# is ahead of the committed migrations and we fail with instructions. When the
# schema and migrations are in sync, generate creates nothing and we pass.
#
# Note: this does NOT touch the real migrations/ folder or the database.
# -----------------------------------------------------------------------------

cd "$(dirname "$0")/.."

MIGRATIONS_DIR="migrations"
TMP_DIR=".tmp-migcheck"
TMP_MIGRATIONS="$TMP_DIR/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "check-migrations: '$MIGRATIONS_DIR' not found — nothing to check."
  exit 0
fi

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"
cp -r "$MIGRATIONS_DIR" "$TMP_MIGRATIONS"

before_count="$(find "$TMP_MIGRATIONS" -maxdepth 1 -name '*.sql' | wc -l | tr -d ' ')"

# Use CLI flags (not drizzle.config.ts) so this runs without DATABASE_URL.
# stdin is closed so an interactive rename prompt cannot hang the check; if
# generate prompts (which only happens when there ARE schema changes) it exits
# non-zero, which we treat as "schema ahead" below.
set +e
gen_output="$(npx drizzle-kit generate \
  --schema=./shared/schema.ts \
  --out="./$TMP_MIGRATIONS" \
  --dialect=postgresql </dev/null 2>&1)"
gen_exit=$?
set -e

after_count="$(find "$TMP_MIGRATIONS" -maxdepth 1 -name '*.sql' | wc -l | tr -d ' ')"

if [ "$after_count" -gt "$before_count" ] || [ "$gen_exit" -ne 0 ]; then
  echo "$gen_output"
  echo ""
  echo "=============================================================================="
  echo "ERROR: shared/schema.ts has changes that are NOT saved as a migration."
  echo ""
  echo "Your schema edits will silently never reach the database after merge."
  echo "Fix this by generating and committing a migration:"
  echo ""
  echo "    npx drizzle-kit generate"
  echo ""
  echo "Then commit the new migrations/*.sql file and migrations/meta/_journal.json."
  echo "=============================================================================="
  exit 1
fi

echo "check-migrations: schema.ts and committed migrations are in sync. ✅"
exit 0
