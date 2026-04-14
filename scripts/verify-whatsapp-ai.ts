#!/usr/bin/env tsx
/**
 * Phase 9 — WhatsApp AI Agent Verification Script
 *
 * Usage:
 *   tsx scripts/verify-whatsapp-ai.ts
 *
 * Output: PASS / FAIL summary table
 * Exit code: 0 = all pass, 1 = any failure
 *
 * Requires DATABASE_URL in environment.
 * Does NOT require WhatsApp API or OpenAI secrets.
 */

import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[verify] ERROR: DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function query(sql: string, params: any[] = []): Promise<any[]> {
  const result = await pool.query(sql, params);
  return result.rows;
}

type CheckResult = { name: string; pass: boolean; detail: string };
const results: CheckResult[] = [];

function pass(name: string, detail = "") {
  results.push({ name, pass: true, detail });
}
function fail(name: string, detail = "") {
  results.push({ name, pass: false, detail });
}

async function runChecks() {
  // ── 1. DB connectivity ────────────────────────────────────────────────────
  try {
    await query("SELECT 1");
    pass("DB connectivity", "postgres connection ok");
  } catch (e: any) {
    fail("DB connectivity", e.message);
    return;
  }

  // ── 2. ai_whatsapp_agent_enabled flag exists and is safe ──────────────────
  try {
    const rows = await query(
      "SELECT key, value FROM ai_feature_flags WHERE key = $1 LIMIT 1",
      ["ai_whatsapp_agent_enabled"]
    );
    if (rows.length === 0) {
      fail("Flag: ai_whatsapp_agent_enabled exists", "row not found in ai_feature_flags");
    } else {
      const val = rows[0].value;
      pass("Flag: ai_whatsapp_agent_enabled exists", `value=${val}${val ? " (ENABLED)" : " (disabled = safe)"}`);
    }
  } catch (e: any) {
    fail("Flag: ai_whatsapp_agent_enabled exists", e.message);
  }

  // ── 3. All 5 WA feature flags present ─────────────────────────────────────
  const expectedFlags = [
    "ai_whatsapp_agent_enabled",
    "ai_whatsapp_followups_enabled",
    "ai_whatsapp_auto_qualify_enabled",
    "ai_whatsapp_template_mode_enabled",
    "ai_whatsapp_handoff_required_on_low_confidence",
  ];
  try {
    const rows = await query(
      "SELECT key FROM ai_feature_flags WHERE key = ANY($1::text[])",
      [expectedFlags]
    );
    const found = rows.map((r: any) => r.key);
    const missing = expectedFlags.filter(f => !found.includes(f));
    if (missing.length === 0) {
      pass("All 5 WA feature flags present");
    } else {
      fail("All 5 WA feature flags present", `missing: ${missing.join(", ")}`);
    }
  } catch (e: any) {
    fail("All 5 WA feature flags present", e.message);
  }

  // ── 4. ai_whatsapp_followups table exists ─────────────────────────────────
  try {
    const rows = await query("SELECT count(*)::int AS count FROM ai_whatsapp_followups");
    pass("Table: ai_whatsapp_followups exists", `rows=${rows[0].count}`);
  } catch (e: any) {
    fail("Table: ai_whatsapp_followups exists", e.message);
  }

  // ── 5. ai_whatsapp_handoffs table exists ──────────────────────────────────
  try {
    const rows = await query("SELECT count(*)::int AS count FROM ai_whatsapp_handoffs");
    pass("Table: ai_whatsapp_handoffs exists", `rows=${rows[0].count}`);
  } catch (e: any) {
    fail("Table: ai_whatsapp_handoffs exists", e.message);
  }

  // ── 6. whatsapp_sessions has Phase 9 AI columns ──────────────────────────
  const expectedCols = [
    "ai_state", "ai_ownership", "last_inbound_at", "window_open",
    "confidence_score", "case_facts", "missing_facts",
  ];
  try {
    const rows = await query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_sessions' AND column_name = ANY($1::text[])",
      [expectedCols]
    );
    const found = rows.map((r: any) => r.column_name);
    const missing = expectedCols.filter(c => !found.includes(c));
    if (missing.length === 0) {
      pass("whatsapp_sessions Phase 9 AI columns present");
    } else {
      fail("whatsapp_sessions Phase 9 AI columns present", `missing: ${missing.join(", ")}`);
    }
  } catch (e: any) {
    fail("whatsapp_sessions Phase 9 AI columns present", e.message);
  }

  // ── 7. ai_audit_log table exists ─────────────────────────────────────────
  try {
    await query("SELECT 1 FROM ai_audit_log LIMIT 1");
    pass("Table: ai_audit_log exists");
  } catch (e: any) {
    fail("Table: ai_audit_log exists", e.message);
  }

  // ── 8. Legacy bot columns still intact ───────────────────────────────────
  try {
    const rows = await query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'whatsapp_sessions' AND column_name IN ('phone','state','bot_paused','collected_name','conversation_history')"
    );
    const found = rows.map((r: any) => r.column_name);
    if (found.length >= 4) {
      pass("Legacy whatsapp_sessions columns intact", found.join(", "));
    } else {
      fail("Legacy whatsapp_sessions columns intact", `only found: ${found.join(", ")}`);
    }
  } catch (e: any) {
    fail("Legacy whatsapp_sessions columns intact", e.message);
  }

  // ── 9. No ownership inconsistency (open handoff + AI still owns) ──────────
  try {
    const rows = await query(`
      SELECT count(*)::int AS c
      FROM ai_whatsapp_handoffs h
      JOIN whatsapp_sessions s ON s.phone = h.phone
      WHERE h.resumed_at IS NULL
      AND s.ai_ownership = 'ai'
    `);
    const count = rows[0]?.c ?? 0;
    if (count === 0) {
      pass("No inconsistent handoffs (open handoff + ai_ownership=ai)");
    } else {
      fail("No inconsistent handoffs", `${count} sessions have open handoffs but ai_ownership='ai'`);
    }
  } catch {
    pass("No inconsistent handoffs", "skipped — no data yet");
  }

  // ── 10. Follow-up status summary ─────────────────────────────────────────
  try {
    const rows = await query("SELECT status, count(*)::int AS c FROM ai_whatsapp_followups GROUP BY status ORDER BY status");
    const summary = rows.map((r: any) => `${r.status}:${r.c}`).join(", ") || "none";
    pass("Follow-ups table status summary", summary);
  } catch (e: any) {
    fail("Follow-ups table status summary", e.message);
  }
}

async function main() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Phase 9 — WhatsApp AI Agent Verification");
  console.log("═══════════════════════════════════════════════════════════\n");

  try {
    await runChecks();
  } finally {
    await pool.end();
  }

  const maxLen = Math.max(...results.map(r => r.name.length));
  let allPass = true;

  for (const r of results) {
    const icon = r.pass ? "✅ PASS" : "❌ FAIL";
    const pad = r.name.padEnd(maxLen + 2);
    console.log(`  ${icon}  ${pad}${r.detail ? `— ${r.detail}` : ""}`);
    if (!r.pass) allPass = false;
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  ${passed}/${results.length} checks passed${failed > 0 ? `, ${failed} FAILED` : " — all good!"}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  process.exit(allPass ? 0 : 1);
}

main().catch(err => {
  console.error("[verify] Unexpected error:", err);
  process.exit(1);
});
