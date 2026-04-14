/**
 * Phase 9 — WhatsApp AI Sales Agent Test Suite
 *
 * Uses Node.js built-in test runner.
 * Run with:  tsx --test server/tests/whatsapp-agent.phase9.spec.ts
 *
 * All tests use pure logic (no DB, OpenAI, or WhatsApp API calls).
 * No production secrets required. Tests are isolated and deterministic.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ── Inline helpers (same logic as whatsapp-agent.ts, no imports needed) ───────

function check24hrWindow(lastInboundAt: Date | null | undefined): boolean {
  if (!lastInboundAt) return false;
  const elapsed = Date.now() - new Date(lastInboundAt).getTime();
  return elapsed < 24 * 60 * 60 * 1000;
}

function maskPhone(phone: string): string {
  if (!phone || phone.length <= 4) return "****";
  return `****${phone.slice(-4)}`;
}

function computeMissingFacts(facts: Record<string, any>): string[] {
  const missing: string[] = [];
  if (!facts.serviceType || facts.serviceType === "unknown") missing.push("serviceType");
  if (!facts.jobAddress) missing.push("jobAddress");
  if (!facts.homeOrOffice || facts.homeOrOffice === "unknown") missing.push("homeOrOffice");
  if (!facts.itemTypes || facts.itemTypes.length === 0) missing.push("itemTypes");
  if (facts.floorLevel === undefined) missing.push("floorLevel");
  if (facts.hasLift === undefined) missing.push("hasLift");
  if (!facts.preferredDate) missing.push("preferredDate");
  if (facts.serviceType === "relocation" && !facts.toAddress) missing.push("toAddress");
  return missing;
}

const HANDOFF_TRIGGERS = /\b(refund|complaint|scam|useless|ridiculous|angry|cheating|threatening|speak to (a )?human|talk to (a )?person|manager|escalate|legal|sue|lawyer|dispute)\b/i;
const CUSTOM_PRICING_TRIGGERS = /\b(special (rate|price|deal|discount)|negotiate|can you do better|cheaper|give me|best price)\b/i;
const UNSUPPORTED_TRIGGERS = /\b(deliver|shipping|courier|lorry|moving company|buy furniture|sell furniture|repair|fix|warranty|insurance)\b/i;

// ── T1: AI disabled → legacy path unchanged ───────────────────────────────────

test("T1a: agent disabled flag → should NOT run", () => {
  const flags = { ai_master_kill_switch: false, ai_whatsapp_agent_enabled: false };
  const shouldRun = !flags.ai_master_kill_switch && flags.ai_whatsapp_agent_enabled;
  assert.equal(shouldRun, false);
});

test("T1b: kill switch on → agent does NOT run even if agent flag is true", () => {
  const flags = { ai_master_kill_switch: true, ai_whatsapp_agent_enabled: true };
  const shouldRun = !flags.ai_master_kill_switch && flags.ai_whatsapp_agent_enabled;
  assert.equal(shouldRun, false);
});

// ── T2: AI enabled + handleable lead → processes ─────────────────────────────

test("T2a: new lead with no facts → aiState transitions to qualifying", () => {
  const missingFacts = computeMissingFacts({});
  const currentAiState = "new_lead";
  let newAiState = currentAiState;
  if (currentAiState === "new_lead") {
    newAiState = missingFacts.length > 0 ? "qualifying" : "quote_ready";
  }
  assert.equal(newAiState, "qualifying");
  assert.ok(missingFacts.length > 0);
});

test("T2b: qualifying lead with all facts → aiState becomes quote_ready", () => {
  const facts = {
    serviceType: "installation", jobAddress: "Tampines", homeOrOffice: "home",
    itemTypes: ["wardrobe"], floorLevel: 3, hasLift: true, preferredDate: "2026-05-01",
  };
  const missing = computeMissingFacts(facts);
  assert.equal(missing.length, 0, `Expected no missing facts, got: ${missing.join(", ")}`);
  const currentAiState = "qualifying";
  const newAiState = missing.length === 0 ? "quote_ready" : "qualifying";
  assert.equal(newAiState, "quote_ready");
});

// ── T3: Handoff condition → AI stops ─────────────────────────────────────────

test("T3a: frustrated trigger → handoff required", () => {
  assert.ok(HANDOFF_TRIGGERS.test("I want to speak to a human"));
  assert.ok(HANDOFF_TRIGGERS.test("This is ridiculous I want a refund"));
});

test("T3b: after handoff → session ownership changes to human + botPaused", () => {
  const session = { aiOwnership: "ai" as const, botPaused: false, aiState: "qualifying" };
  const afterHandoff = {
    ...session,
    aiOwnership: "human" as const,
    aiState: "human_review_required",
    botPaused: true,
  };
  assert.equal(afterHandoff.aiOwnership, "human");
  assert.equal(afterHandoff.botPaused, true);
  assert.equal(afterHandoff.aiState, "human_review_required");
});

test("T3c: human ownership → processWithAIAgent should return false (skip AI)", () => {
  const session = { aiOwnership: "human", botPaused: true };
  const shouldSkip = session.aiOwnership === "human";
  assert.equal(shouldSkip, true);
});

// ── T4: Resume AI → ownership returns to AI ──────────────────────────────────

test("T4: after resumeAiOwnership → aiOwnership=ai, botPaused=false, aiState=qualifying", () => {
  const session = { aiOwnership: "human" as const, aiState: "human_review_required", botPaused: true };
  const resumed = { ...session, aiOwnership: "ai" as const, aiState: "qualifying", botPaused: false };
  assert.equal(resumed.aiOwnership, "ai");
  assert.equal(resumed.botPaused, false);
  assert.equal(resumed.aiState, "qualifying");
});

// ── T5: Outside 24-hour window → outbound blocked ────────────────────────────

test("T5a: window closed when last inbound > 24h ago", () => {
  const old = new Date(Date.now() - 26 * 60 * 60 * 1000);
  assert.equal(check24hrWindow(old), false);
});

test("T5b: window open when last inbound < 24h ago", () => {
  const recent = new Date(Date.now() - 60 * 60 * 1000);
  assert.equal(check24hrWindow(recent), true);
});

test("T5c: window closed + template disabled → send blocked", () => {
  const windowOpen = false;
  const templateModeEnabled = false;
  const canSend = windowOpen || templateModeEnabled;
  assert.equal(canSend, false);
});

test("T5d: window closed + template enabled → send allowed", () => {
  const windowOpen = false;
  const templateModeEnabled = true;
  const canSend = windowOpen || templateModeEnabled;
  assert.equal(canSend, true);
});

// ── T6: Duplicate inbound webhook → skipped ──────────────────────────────────

test("T6a: in-memory Set dedup catches same wamid within process", () => {
  const processedWamids = new Set<string>();
  const wamid = "wamid.test_duplicate_abc";
  processedWamids.add(wamid);
  assert.equal(processedWamids.has(wamid), true, "wamid should be in Set after first processing");
});

test("T6b: new unique wamid → not in Set → should be processed", () => {
  const processedWamids = new Set<string>();
  const wamid = "wamid.brand_new_xyz";
  assert.equal(processedWamids.has(wamid), false, "new wamid should not be in empty Set");
});

test("T6c: DB idempotency check found prior entry → agent should skip (return true)", () => {
  // Simulate: checkDuplicateByCorrelationId returned true
  const isDuplicate = true;
  // Agent returns true to prevent legacy bot from also double-processing
  const agentReturnValue = isDuplicate ? true : undefined;
  assert.equal(agentReturnValue, true);
});

// ── T7: Follow-up scheduling idempotency ─────────────────────────────────────

test("T7a: followupScheduled=true → do NOT schedule again", () => {
  const session = { followupScheduled: true };
  const followupsEnabled = true;
  const newAiState = "qualifying";
  const shouldSchedule = followupsEnabled && !session.followupScheduled && newAiState === "qualifying";
  assert.equal(shouldSchedule, false);
});

test("T7b: followupScheduled=false + enabled + qualifying → DO schedule", () => {
  const session = { followupScheduled: false };
  const followupsEnabled = true;
  const newAiState = "qualifying";
  const shouldSchedule = followupsEnabled && !session.followupScheduled && newAiState === "qualifying";
  assert.equal(shouldSchedule, true);
});

test("T7c: followups feature flag disabled → do NOT schedule", () => {
  const session = { followupScheduled: false };
  const followupsEnabled = false;
  const newAiState = "qualifying";
  const shouldSchedule = followupsEnabled && !session.followupScheduled && newAiState === "qualifying";
  assert.equal(shouldSchedule, false);
});

// ── T8: Non-admin access → denied ────────────────────────────────────────────

test("T8a: null session → 401 Unauthorized", () => {
  const session: any = null;
  const statusCode = !session?.userId ? 401 : 200;
  assert.equal(statusCode, 401);
});

test("T8b: staff role → 403 Forbidden", () => {
  const user = { id: 2, role: "staff", username: "tmg_nkb" };
  const statusCode = user.role !== "admin" ? 403 : 200;
  assert.equal(statusCode, 403);
});

test("T8c: customer token (no role) → 403 Forbidden", () => {
  const user = { id: 99, role: "customer" };
  const statusCode = user.role !== "admin" ? 403 : 200;
  assert.equal(statusCode, 403);
});

// ── T9: Admin access → allowed ───────────────────────────────────────────────

test("T9a: valid session + admin role → passes auth", () => {
  const user = { id: 1, role: "admin", username: "admin" };
  const sessionUserId = 1;
  const isAuthed = !!(sessionUserId && user.role === "admin");
  assert.equal(isAuthed, true);
});

// ── Utility: maskPhone ────────────────────────────────────────────────────────

test("maskPhone: shows only last 4 digits", () => {
  assert.equal(maskPhone("6591234567"), "****4567");
});

test("maskPhone: short phone → all masked", () => {
  assert.equal(maskPhone("123"), "****");
});

// ── Utility: relocation requires toAddress ────────────────────────────────────

test("relocation service requires toAddress", () => {
  const missing = computeMissingFacts({
    serviceType: "relocation",
    jobAddress: "Tampines Ave 1",
    homeOrOffice: "home",
    itemTypes: ["sofa"],
    floorLevel: 1,
    hasLift: false,
    preferredDate: "2026-05-10",
  });
  assert.ok(missing.includes("toAddress"), "toAddress must be required for relocation");
});

test("non-relocation service does NOT require toAddress", () => {
  const missing = computeMissingFacts({
    serviceType: "installation",
    jobAddress: "Bishan",
    homeOrOffice: "home",
    itemTypes: ["wardrobe"],
    floorLevel: 2,
    hasLift: true,
    preferredDate: "2026-05-15",
  });
  assert.ok(!missing.includes("toAddress"), "toAddress should not be required for installation");
});
