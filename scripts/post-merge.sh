#!/bin/bash
set -e

# Apply schema changes non-interactively (sends empty to answer prompts with default)
echo "" | npm run db:push 2>&1 || true

# Drizzle-kit push is interactive: it can't reliably answer the "create vs rename
# column" prompt over a piped/closed stdin (see memory drizzle-push-interactive.md),
# so additive columns it considers ambiguous can silently fail to apply. Apply the
# multi-stop relocation columns explicitly and idempotently so the DB-backed
# price-math safety test (tests/multiStopReconciliation.test.ts) actually runs
# against a migrated database instead of skipping.
if [ -n "$DATABASE_URL" ]; then
  psql "$DATABASE_URL" \
    -c "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS stops jsonb DEFAULT '[]'::jsonb;" \
    -c "ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS from_stop_id text;" \
    -c "ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS to_stop_id text;" \
    2>&1 || true
fi
