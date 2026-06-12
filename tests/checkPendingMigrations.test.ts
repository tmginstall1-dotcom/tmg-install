// =============================================================================
// scripts/check-pending-migrations.sh — guard tests
//
// Run: npx tsx --test tests/checkPendingMigrations.test.ts
//
// check-pending-migrations.sh warns when a target database is BEHIND the
// committed migrations: it reads the highest applied migration timestamp from
// drizzle.__drizzle_migrations and reports every journal entry
// (migrations/meta/_journal.json) whose `when` is newer.
//
// These tests run the REAL script against a throwaway sandbox that mirrors the
// repo layout (scripts/ + migrations/meta/_journal.json). Because the script
// derives the journal path from its own location, copying it into a temp dir
// lets us feed it a controlled journal without ever touching the real one.
//
// Scenarios covered:
//   1. DATABASE_URL unset           -> exit 0 (safe no-op skip). Deterministic.
//   2. Database up to date          -> exit 0. Uses the real journal against the
//                                      real DB; skips if no DB / DB is drifted.
//   3. Database missing a migration -> exit 1, lists the pending tag. Simulated
//                                      by appending a future-dated journal entry
//                                      to a copy of _journal.json (per the task).
//
// The DB-backed cases skip gracefully (like the multi-stop tests) when
// DATABASE_URL is unset, so they never produce a false failure off-platform.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REAL_SCRIPT = path.join(REPO_ROOT, "scripts", "check-pending-migrations.sh");
const REAL_JOURNAL = path.join(REPO_ROOT, "migrations", "meta", "_journal.json");

const DATABASE_URL = process.env.DATABASE_URL ?? "";

type Journal = {
  version: string;
  dialect: string;
  entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[];
};

// Build a self-contained sandbox: <tmp>/scripts/check-pending-migrations.sh and
// <tmp>/migrations/meta/_journal.json, seeded with the given journal contents.
function makeSandbox(journal: Journal): { scriptPath: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pendmig-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "migrations", "meta"), { recursive: true });
  fs.copyFileSync(REAL_SCRIPT, path.join(dir, "scripts", "check-pending-migrations.sh"));
  fs.writeFileSync(
    path.join(dir, "migrations", "meta", "_journal.json"),
    JSON.stringify(journal, null, 2),
  );
  return {
    scriptPath: path.join(dir, "scripts", "check-pending-migrations.sh"),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function runScript(scriptPath: string, env: NodeJS.ProcessEnv) {
  const res = spawnSync("bash", [scriptPath], {
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, ...env },
  });
  return { status: res.status, output: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

const realJournal: Journal = JSON.parse(fs.readFileSync(REAL_JOURNAL, "utf8"));
const maxJournalWhen = Math.max(0, ...realJournal.entries.map((e) => Number(e.when)));

// Query the DB the same way the script does so we know whether the local DB is
// actually caught up (and therefore whether the "up to date" assertion is valid
// in this environment).
function appliedMax(): number | null {
  if (!DATABASE_URL) return null;
  const res = spawnSync(
    "psql",
    [
      DATABASE_URL,
      "-t",
      "-A",
      "-c",
      "SELECT COALESCE(MAX(created_at), -1) FROM drizzle.__drizzle_migrations;",
    ],
    { encoding: "utf8", timeout: 30_000 },
  );
  if (res.status !== 0) return null;
  const n = Number((res.stdout ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

const dbMax = appliedMax();
const dbCaughtUp = dbMax !== null && dbMax >= maxJournalWhen;

// ---------------------------------------------------------------------------
// 1. DATABASE_URL unset -> exit 0, skip message. Deterministic, no DB needed.
// ---------------------------------------------------------------------------
test("check-pending-migrations: skips with exit 0 when DATABASE_URL is unset", () => {
  const sb = makeSandbox(realJournal);
  try {
    const { status, output } = runScript(sb.scriptPath, { DATABASE_URL: "" });
    assert.equal(status, 0, output);
    assert.match(output, /DATABASE_URL not set, skipping/);
  } finally {
    sb.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 2. Database up to date -> exit 0, success message.
// ---------------------------------------------------------------------------
test(
  "check-pending-migrations: passes with exit 0 when the database is up to date",
  { skip: !dbCaughtUp ? "no DATABASE_URL or local DB is behind committed migrations" : false },
  () => {
    const sb = makeSandbox(realJournal);
    try {
      const { status, output } = runScript(sb.scriptPath, { DATABASE_URL });
      assert.equal(status, 0, output);
      assert.match(output, /database is up to date/);
    } finally {
      sb.cleanup();
    }
  },
);

// ---------------------------------------------------------------------------
// 3. Database behind -> exit 1, lists the pending tag. A future-dated entry is
//    always newer than any applied migration, so this holds regardless of the
//    local DB's exact state (it only requires DATABASE_URL to be set so the
//    script does not take the skip path).
// ---------------------------------------------------------------------------
test(
  "check-pending-migrations: fails with exit 1 and lists the pending migration when the DB is behind",
  { skip: !DATABASE_URL ? "no DATABASE_URL set" : false },
  () => {
    const behind: Journal = {
      ...realJournal,
      entries: [
        ...realJournal.entries,
        {
          idx: realJournal.entries.length,
          version: "7",
          when: 9999999999999, // year 2286 — newer than anything applied
          tag: "9999_future_test_only",
          breakpoints: true,
        },
      ],
    };
    const sb = makeSandbox(behind);
    try {
      const { status, output } = runScript(sb.scriptPath, { DATABASE_URL });
      assert.equal(status, 1, output);
      assert.match(output, /MISSING committed migrations/);
      assert.match(output, /9999_future_test_only/);
    } finally {
      sb.cleanup();
    }
  },
);
