import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Startup guard: warn (loudly) when the connected database is BEHIND the
 * committed Drizzle migrations.
 *
 * This is the runtime complement to scripts/check-pending-migrations.sh. The
 * shell script only surfaces drift when someone runs it manually; this function
 * runs automatically on every server boot so a behind-schema production
 * database is noticed before a "column does not exist" error hits real users.
 *
 * Comparison logic (ported from scripts/check-pending-migrations.sh):
 *   - Committed migrations are tracked in migrations/meta/_journal.json. Each
 *     entry has a `when` timestamp and a `tag`.
 *   - When `drizzle-kit migrate` applies a migration it records a row in
 *     drizzle.__drizzle_migrations whose `created_at` equals that journal
 *     entry's `when` (see scripts/post-merge.sh).
 *   - We read the highest applied `created_at` and report every journal entry
 *     whose `when` is newer — those are the migrations the DB is missing.
 *
 * Important: this is READ-ONLY, non-fatal, and never auto-applies migrations.
 * It is a no-op when DATABASE_URL is unset.
 */

interface JournalEntry {
  when: number;
  tag: string;
}

type QueryablePool = {
  query: (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJournalEntries(): JournalEntry[] | null {
  const journalPath = path.resolve(__dirname, "../migrations/meta/_journal.json");
  if (!fs.existsSync(journalPath)) return null;
  try {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    return Array.isArray(journal.entries) ? journal.entries : [];
  } catch {
    return null;
  }
}

export async function warnIfBehindOnMigrations(pool: QueryablePool): Promise<void> {
  if (!process.env.DATABASE_URL) return; // safe no-op

  const entries = readJournalEntries();
  if (!entries) return; // no journal — nothing to compare against
  if (entries.length === 0) return;

  // Highest applied migration timestamp. If the drizzle schema/table does not
  // exist yet (DB never migrated), the query throws and we treat it as
  // "nothing applied" so every committed migration is reported as pending.
  let appliedMax = -1;
  try {
    const res = await pool.query(
      "SELECT COALESCE(MAX(created_at), -1) AS max FROM drizzle.__drizzle_migrations;",
    );
    const raw = res.rows?.[0]?.max;
    const parsed = raw === null || raw === undefined ? -1 : Number(raw);
    appliedMax = Number.isFinite(parsed) ? parsed : -1;
  } catch {
    appliedMax = -1; // drizzle.__drizzle_migrations missing → nothing applied
  }

  const pending = entries
    .filter((e) => Number(e.when) > appliedMax)
    .map((e) => e.tag);

  if (pending.length === 0) return;

  const lines = [
    "",
    "==============================================================================",
    "WARNING: the connected database is MISSING committed schema migrations.",
    "",
    "The following migrations are committed but have not been applied:",
    ...pending.map((tag) => `    - ${tag}`),
    "",
    "Runtime errors like \"column does not exist\" may occur until they are applied.",
    "Apply them by running the post-merge migrate step against this database:",
    "",
    "    bash scripts/post-merge.sh",
    "",
    "(post-merge.sh runs `drizzle-kit migrate`, which is non-interactive and",
    "idempotent. Make sure DATABASE_URL points at the database you intend to",
    "update. The app will keep running with the current — possibly behind — schema.)",
    "==============================================================================",
    "",
  ];
  console.warn(lines.join("\n"));
}
