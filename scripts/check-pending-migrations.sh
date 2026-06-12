#!/bin/bash
set -e

# -----------------------------------------------------------------------------
# Guard: warn if the target database is BEHIND the committed migrations.
#
# This is the complement to scripts/check-migrations.sh. That sibling catches
# the case where shared/schema.ts is ahead of the committed migration files
# (someone forgot to run `drizzle-kit generate`). THIS script catches the
# inverse: committed migrations exist in ./migrations but were never applied to
# a given database (e.g. production, or a fresh dev DB where post-merge never
# ran). Until something breaks at runtime with a "column does not exist" error,
# nothing surfaces that the DB is behind.
#
# How it works: committed migrations are tracked in the migrations journal
# (migrations/meta/_journal.json). When `drizzle-kit migrate` applies a
# migration it records a row in drizzle.__drizzle_migrations whose `created_at`
# equals that journal entry's `when` timestamp (see scripts/post-merge.sh).
# We read the highest applied `created_at` from the DB and report every journal
# entry whose `when` is newer — those are the migrations the DB is missing.
#
# Exit codes:
#   0  DATABASE_URL unset (safe no-op), or DB is up to date.
#   1  DB is missing one or more committed migrations.
#
# This script is READ-ONLY: it never writes to the database or the migrations
# folder. To run it against production, point DATABASE_URL at the production
# database (e.g. via the database skill's read path) before invoking it.
# -----------------------------------------------------------------------------

if [ -z "$DATABASE_URL" ]; then
  echo "check-pending-migrations: DATABASE_URL not set, skipping check."
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../migrations"
JOURNAL="$MIGRATIONS_DIR/meta/_journal.json"

if [ ! -f "$JOURNAL" ]; then
  echo "check-pending-migrations: no journal at $JOURNAL — nothing to check."
  exit 0
fi

# Highest applied migration timestamp. If the drizzle schema/table does not
# exist yet (DB never migrated), psql errors and we treat it as "nothing
# applied" so every committed migration is reported as pending.
APPLIED_MAX="$(psql "$DATABASE_URL" -t -A \
  -c "SELECT COALESCE(MAX(created_at), -1) FROM drizzle.__drizzle_migrations;" \
  2>/dev/null || echo "")"

PENDING="$(APPLIED_MAX="$APPLIED_MAX" JOURNAL_PATH="$JOURNAL" node -e '
const fs = require("fs");
const j = JSON.parse(fs.readFileSync(process.env.JOURNAL_PATH, "utf8"));
const raw = process.env.APPLIED_MAX;
const max = (raw === undefined || raw === "") ? -1 : Number(raw);
const ceiling = Number.isFinite(max) ? max : -1;
const pending = (j.entries || [])
  .filter((e) => Number(e.when) > ceiling)
  .map((e) => e.tag);
process.stdout.write(pending.join("\n"));
')"

if [ -n "$PENDING" ]; then
  echo ""
  echo "=============================================================================="
  echo "WARNING: the target database is MISSING committed migrations."
  echo ""
  echo "The following migrations are committed but have not been applied:"
  echo "$PENDING" | sed 's/^/    - /'
  echo ""
  echo "Apply them by running the post-merge migrate step against this database:"
  echo ""
  echo "    bash scripts/post-merge.sh"
  echo ""
  echo "(post-merge.sh runs \`drizzle-kit migrate\`, which is non-interactive and"
  echo "idempotent. Make sure DATABASE_URL points at the database you intend to"
  echo "update.)"
  echo "=============================================================================="
  exit 1
fi

echo "check-pending-migrations: database is up to date with committed migrations. ✅"
exit 0
