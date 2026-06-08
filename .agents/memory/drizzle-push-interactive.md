---
name: drizzle-kit push is interactive
description: Why `npm run db:push` can stall and how to add simple columns reliably.
---

# drizzle-kit push prompts can't be answered via piped stdin

`npm run db:push` (drizzle-kit) asks interactive questions when a schema change
is ambiguous — e.g. a brand-new column it suspects is a rename ("create column"
vs "rename column"). It reads the keyboard in raw TTY mode, so `printf '\n' |
npm run db:push` does NOT select the highlighted option; the prompt just re-renders.

**How to apply:** for a simple additive change (new nullable/defaulted column),
skip the prompt entirely and run the SQL directly, e.g.
`psql "$DATABASE_URL" -c "ALTER TABLE quotes ADD COLUMN IF NOT EXISTS site_visits jsonb DEFAULT '[]'::jsonb;"`
then verify with `\d quotes`. Keep the Drizzle schema in sync so the ORM types
match. Reserve full `db:push` for an interactive session where you can answer.
