// =============================================================================
// scripts/check-migrations.sh — guard tests
//
// Run: npx tsx --test tests/checkMigrations.test.ts
//
// check-migrations.sh fails when shared/schema.ts is AHEAD of the committed
// migrations (someone edited the schema but forgot to run
// `npx drizzle-kit generate` and commit the result). It works by running
// `drizzle-kit generate` against a throwaway copy of the migrations folder: if
// generate would produce a NEW .sql file (or prompts / errors), the schema is
// ahead and the script exits 1; otherwise it exits 0.
//
// To test this without ever touching the real shared/schema.ts or migrations/,
// each test builds an isolated sandbox INSIDE the repo (so `npx drizzle-kit`
// can resolve node_modules by walking up the tree):
//
//   <repo>/.tmp-checkmig-<rand>/
//       scripts/check-migrations.sh   (copy of the real script)
//       shared/schema.ts              (a controlled minimal schema)
//       migrations/                   (a baseline generated from that schema)
//
// The real script does `cd "$(dirname "$0")/.."`, so running the copied script
// makes it operate entirely within the sandbox.
//
// Scenarios covered:
//   1. schema in sync with migrations -> exit 0, success message.
//   2. schema ahead of migrations     -> exit 1, "NOT saved as a migration".
//
// These tests do not require a database (generate uses CLI flags only).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const REAL_SCRIPT = path.join(REPO_ROOT, "scripts", "check-migrations.sh");

const BASE_SCHEMA = `import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const widgets = pgTable("widgets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});
`;

const AHEAD_SCHEMA = `import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const widgets = pgTable("widgets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"),
});
`;

// Create a sandbox under the repo root (so npx can find drizzle-kit), copy the
// real script into it, write the given schema, and generate the baseline
// migration set from it. Returns the path to the copied script.
function makeSandbox(schemaSource: string): { dir: string; scriptPath: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(REPO_ROOT, ".tmp-checkmig-"));
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "shared"), { recursive: true });
  fs.mkdirSync(path.join(dir, "migrations"), { recursive: true });
  fs.copyFileSync(REAL_SCRIPT, path.join(dir, "scripts", "check-migrations.sh"));
  fs.writeFileSync(path.join(dir, "shared", "schema.ts"), schemaSource);

  // Generate the baseline migration so the sandbox starts "in sync".
  const gen = spawnSync(
    "npx",
    [
      "drizzle-kit",
      "generate",
      `--schema=./${path.relative(REPO_ROOT, path.join(dir, "shared", "schema.ts"))}`,
      `--out=./${path.relative(REPO_ROOT, path.join(dir, "migrations"))}`,
      "--dialect=postgresql",
    ],
    { cwd: REPO_ROOT, encoding: "utf8", timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] },
  );
  if (gen.status !== 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`baseline drizzle-kit generate failed: ${gen.stdout ?? ""}${gen.stderr ?? ""}`);
  }

  return {
    dir,
    scriptPath: path.join(dir, "scripts", "check-migrations.sh"),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

function runScript(scriptPath: string) {
  const res = spawnSync("bash", [scriptPath], { encoding: "utf8", timeout: 120_000 });
  return { status: res.status, output: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

// ---------------------------------------------------------------------------
// 1. schema in sync with committed migrations -> exit 0.
// ---------------------------------------------------------------------------
test("check-migrations: passes with exit 0 when schema and migrations are in sync", () => {
  const sb = makeSandbox(BASE_SCHEMA);
  try {
    const { status, output } = runScript(sb.scriptPath);
    assert.equal(status, 0, output);
    assert.match(output, /in sync/);
  } finally {
    sb.cleanup();
  }
});

// ---------------------------------------------------------------------------
// 2. schema ahead of committed migrations -> exit 1, instructive error.
//    The baseline is generated from BASE_SCHEMA, then we overwrite the
//    schema with an extra column so `drizzle-kit generate` would emit a new
//    migration file the sandbox does not yet have.
// ---------------------------------------------------------------------------
test("check-migrations: fails with exit 1 when schema is ahead of committed migrations", () => {
  const sb = makeSandbox(BASE_SCHEMA);
  try {
    fs.writeFileSync(path.join(sb.dir, "shared", "schema.ts"), AHEAD_SCHEMA);
    const { status, output } = runScript(sb.scriptPath);
    assert.equal(status, 1, output);
    assert.match(output, /NOT saved as a migration/);
  } finally {
    sb.cleanup();
  }
});
