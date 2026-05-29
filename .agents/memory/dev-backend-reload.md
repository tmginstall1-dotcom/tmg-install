---
name: Dev backend reload
description: Why the dev server misses schema/storage changes until a manual workflow restart
---

The "Start application" workflow runs `NODE_ENV=development tsx server/index.ts` — plain `tsx`, NOT `tsx watch`. Vite HMR refreshes the frontend, but the Express/Drizzle backend keeps running the module graph it loaded at boot.

**Symptom:** after adding a column to `shared/schema.ts` (and the DB) and updating `server/storage.ts`, an `editQuote`/update call fails with Drizzle `Error: No values to set` (from `mapUpdateSet`). The running server still has the OLD schema object, so the new keys in the `.set({...})` payload map to no known columns and get dropped.

**Fix:** restart the `Start application` workflow after any `shared/schema.ts` or `server/*` change. Auto-restart-on-edit is unreliable for the backend here; restart explicitly before live-testing.

**Why:** prevents wasting time debugging "correct-looking" code that 500s only because the process is stale.
