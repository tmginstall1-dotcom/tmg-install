/**
 * Centralized LLM client wrapper — Phase 9d
 *
 * Every LLM call in the system should route through `callLLM`. It provides:
 *   1. **Telemetry**   — every call logged to ai_llm_calls (model, latency,
 *                        tokens in/out, SGD cost, success/failure, agent name)
 *   2. **Retries**     — exponential backoff (200/800/2000ms) on transient
 *                        errors (network/5xx/429). Non-retryable errors
 *                        (4xx other than 429) fail fast.
 *   3. **Timeout**     — AbortController-based hard timeout (default 25s).
 *   4. **Circuit breaker**
 *                      — Per-agent rolling 60s window. Opens for 2 min when
 *                        ≥10 failures in window AND failure rate ≥50%.
 *                        Open state short-circuits to throw immediately so
 *                        callers fall back to deterministic behavior fast.
 *   5. **Schema-validated outputs**
 *                      — Optional Zod schema. On parse failure, ONE auto-
 *                        repair retry is attempted with the validation
 *                        error surfaced to the model. Repair attempts are
 *                        marked in telemetry as schema_repaired=true.
 *   6. **Master kill switch**
 *                      — Respects ai_master_kill_switch like every other AI
 *                        surface; throws KillSwitchError when tripped.
 *
 * Cost model (gpt-4o, public OpenAI pricing × 1.35 USD→SGD):
 *   $5/M input  → SGD 6.75/M input
 *   $15/M output → SGD 20.25/M output
 * Override per-model in MODEL_PRICING below.
 */

import { z, type ZodSchema } from "zod";
import { db } from "./db";
import { aiLlmCalls, aiFeatureFlags } from "@shared/schema";
import { eq } from "drizzle-orm";
import { openai } from "./replit_integrations/audio/client";

// ── Pricing (SGD per 1M tokens) ──────────────────────────────────────────────
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o":          { in: 6.75,  out: 20.25 },
  "gpt-4o-mini":     { in: 0.20,  out: 0.81  },
  "gpt-4o-2024-08-06": { in: 3.38,  out: 13.50 },
  "gpt-4-turbo":     { in: 13.50, out: 40.50 },
};

function priceSgd(model: string, inTok: number, outTok: number): number {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING["gpt-4o"];
  return (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out;
}

// ── Circuit breaker (in-memory, per-agent) ───────────────────────────────────
// In-memory is fine here: this server is the only writer, and a brief breaker
// reset after a restart is acceptable (worst case: one extra failed batch).
interface BreakerEntry { successes: number[]; failures: number[]; openUntil: number }
const breakerState = new Map<string, BreakerEntry>();
const BREAKER_WINDOW_MS = 60_000;
const BREAKER_OPEN_MS   = 120_000;
const BREAKER_MIN_FAILS = 10;
const BREAKER_FAIL_RATE = 0.5;

function recordOutcome(agent: string, ok: boolean): void {
  const now = Date.now();
  const e = breakerState.get(agent) ?? { successes: [], failures: [], openUntil: 0 };
  const cutoff = now - BREAKER_WINDOW_MS;
  e.successes = e.successes.filter(t => t > cutoff);
  e.failures  = e.failures.filter(t => t > cutoff);
  if (ok) e.successes.push(now); else e.failures.push(now);
  if (e.failures.length >= BREAKER_MIN_FAILS) {
    const total = e.successes.length + e.failures.length;
    const rate = e.failures.length / Math.max(1, total);
    if (rate >= BREAKER_FAIL_RATE) e.openUntil = now + BREAKER_OPEN_MS;
  }
  breakerState.set(agent, e);
}

function breakerIsOpen(agent: string): boolean {
  const e = breakerState.get(agent);
  if (!e) return false;
  if (Date.now() < e.openUntil) return true;
  // half-open: clear flag automatically once cooldown elapses
  if (e.openUntil !== 0 && Date.now() >= e.openUntil) {
    e.openUntil = 0;
    e.failures = [];
  }
  return false;
}

export function getBreakerSnapshot(): Array<{ agent: string; openUntil: number; failures: number; successes: number }> {
  const out: Array<{ agent: string; openUntil: number; failures: number; successes: number }> = [];
  for (const [agent, e] of breakerState.entries()) {
    out.push({ agent, openUntil: e.openUntil, failures: e.failures.length, successes: e.successes.length });
  }
  return out;
}

// ── Errors ───────────────────────────────────────────────────────────────────
export class KillSwitchError extends Error {
  constructor() { super("ai_master_kill_switch is on — LLM calls disabled"); this.name = "KillSwitchError"; }
}
export class CircuitOpenError extends Error {
  constructor(agent: string) { super(`circuit breaker open for agent=${agent}`); this.name = "CircuitOpenError"; }
}
export class LLMTimeoutError extends Error {
  constructor(ms: number) { super(`LLM call timed out after ${ms}ms`); this.name = "LLMTimeoutError"; }
}
export class LLMSchemaError extends Error {
  constructor(public issues: string) { super(`LLM output failed schema validation: ${issues}`); this.name = "LLMSchemaError"; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
async function killSwitchOn(): Promise<boolean> {
  try {
    const [r] = await db.select().from(aiFeatureFlags).where(eq(aiFeatureFlags.key, "ai_master_kill_switch")).limit(1);
    return r?.value === true;
  } catch { return false; }
}

function isRetryable(err: any): boolean {
  if (!err) return false;
  if (err.name === "AbortError") return true; // our timeout — retry once or twice
  const status = err.status ?? err.response?.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  // Network/socket
  const code = err.code ?? err.cause?.code;
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "EAI_AGAIN") return true;
  return false;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function logCall(row: {
  agent: string; model: string; latencyMs: number;
  promptTokens: number; completionTokens: number; totalTokens: number;
  costSgd: number; success: boolean; error: string | null;
  schemaRepaired: boolean; attempts: number;
}): Promise<void> {
  try {
    await db.insert(aiLlmCalls).values({
      agent: row.agent,
      model: row.model,
      latencyMs: row.latencyMs,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      costSgd: row.costSgd.toFixed(6),
      success: row.success,
      errorMessage: row.error,
      schemaRepaired: row.schemaRepaired,
      attempts: row.attempts,
    } as any);
  } catch (e: any) {
    console.warn("[llm-client] failed to log call:", e?.message);
  }
}

// ── Main entry point ─────────────────────────────────────────────────────────
export interface CallLLMOptions<T = string> {
  /** Stable identifier used for telemetry + circuit breaker bucket. e.g. "whatsapp_extract_facts" */
  agent: string;
  model?: string;
  /**
   * OpenAI chat messages. `content` may be a plain string OR an array of
   * content parts (supports vision: `{ type: "image_url", image_url: { url } }`
   * alongside `{ type: "text", text }`).
   */
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
    >;
  }>;
  /** If provided, response_format=json_object AND output is parsed + validated against this Zod schema. */
  schema?: ZodSchema<T>;
  max_tokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** How many *additional* attempts after the first try. Default 2 (so up to 3 total). */
  maxRetries?: number;
}

export interface CallLLMResult<T = string> {
  /** Parsed value when schema given, else the raw string content. */
  value: T;
  raw: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costSgd: number;
  latencyMs: number;
  attempts: number;
  schemaRepaired: boolean;
}

/**
 * Sentinel marker — when set on a thrown error, the outer catch knows the
 * inner branch already logged + recorded the outcome, so we don't double-
 * count failures (which would prematurely trip the breaker).
 */
const ALREADY_LOGGED = Symbol("__llmClientAlreadyLogged");

export async function callLLM<T = string>(opts: CallLLMOptions<T>): Promise<CallLLMResult<T>> {
  const {
    agent,
    model = "gpt-4o",
    messages,
    schema,
    max_tokens = 600,
    temperature,
    timeoutMs = 25_000,
    // Default 3 retries so all three backoff steps (200/800/2000ms) are usable.
    maxRetries = 3,
  } = opts;

  if (await killSwitchOn()) throw new KillSwitchError();
  if (breakerIsOpen(agent)) throw new CircuitOpenError(agent);

  const startedAt = Date.now();
  let attempt = 0;
  let lastErr: any = null;
  let schemaRepaired = false;
  // Per architect feedback: schema repair is a SINGLE auto-fix, not a loop.
  // Once we've attempted a repair and it still fails, we throw immediately.
  let repairAttempted = false;
  let workingMessages = messages.slice();

  while (attempt <= maxRetries) {
    attempt++;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const req: any = {
        model,
        max_tokens,
        messages: workingMessages,
      };
      if (typeof temperature === "number") req.temperature = temperature;
      if (schema) req.response_format = { type: "json_object" };

      const res = await openai.chat.completions.create(req, { signal: ac.signal as any });
      clearTimeout(timer);

      const raw = res.choices?.[0]?.message?.content ?? "";
      const promptTokens = res.usage?.prompt_tokens ?? 0;
      const completionTokens = res.usage?.completion_tokens ?? 0;
      const totalTokens = res.usage?.total_tokens ?? promptTokens + completionTokens;
      const costSgd = priceSgd(model, promptTokens, completionTokens);

      // Schema validation path
      if (schema) {
        let parsed: any;
        try { parsed = JSON.parse(raw); }
        catch (pe: any) {
          if (!repairAttempted && attempt <= maxRetries) {
            repairAttempted = true;
            schemaRepaired = true;
            workingMessages = [
              ...messages,
              { role: "assistant", content: raw },
              { role: "user", content: `Your previous reply was not valid JSON (${pe?.message ?? "parse error"}). Reply ONLY with the JSON object — no prose, no code fences.` },
            ];
            lastErr = pe;
            continue;
          }
          await logCall({ agent, model, latencyMs: Date.now() - startedAt, promptTokens, completionTokens, totalTokens, costSgd, success: false, error: `json_parse: ${pe?.message}`, schemaRepaired, attempts: attempt });
          recordOutcome(agent, false);
          const e = new LLMSchemaError(pe?.message ?? "json parse failed");
          (e as any)[ALREADY_LOGGED] = true;
          throw e;
        }
        const check = schema.safeParse(parsed);
        if (!check.success) {
          if (!repairAttempted && attempt <= maxRetries) {
            repairAttempted = true;
            schemaRepaired = true;
            const issues = check.error.issues.slice(0, 5).map(i => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
            workingMessages = [
              ...messages,
              { role: "assistant", content: raw },
              { role: "user", content: `Your previous JSON failed validation: ${issues}. Reply ONLY with a corrected JSON object that satisfies the schema.` },
            ];
            lastErr = check.error;
            continue;
          }
          const issues = check.error.issues.slice(0, 5).map(i => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
          await logCall({ agent, model, latencyMs: Date.now() - startedAt, promptTokens, completionTokens, totalTokens, costSgd, success: false, error: `schema: ${issues}`, schemaRepaired, attempts: attempt });
          recordOutcome(agent, false);
          const e = new LLMSchemaError(issues);
          (e as any)[ALREADY_LOGGED] = true;
          throw e;
        }
        await logCall({ agent, model, latencyMs: Date.now() - startedAt, promptTokens, completionTokens, totalTokens, costSgd, success: true, error: null, schemaRepaired, attempts: attempt });
        recordOutcome(agent, true);
        return { value: check.data as T, raw, model, promptTokens, completionTokens, totalTokens, costSgd, latencyMs: Date.now() - startedAt, attempts: attempt, schemaRepaired };
      }

      // No schema — return raw string
      await logCall({ agent, model, latencyMs: Date.now() - startedAt, promptTokens, completionTokens, totalTokens, costSgd, success: true, error: null, schemaRepaired, attempts: attempt });
      recordOutcome(agent, true);
      return { value: raw as unknown as T, raw, model, promptTokens, completionTokens, totalTokens, costSgd, latencyMs: Date.now() - startedAt, attempts: attempt, schemaRepaired };
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err;
      // If the schema branch already logged this failure + tripped breaker,
      // re-throw without double-counting (architect feedback).
      if (err?.[ALREADY_LOGGED]) throw err;

      const aborted = err?.name === "AbortError";
      if (aborted && attempt > maxRetries) {
        await logCall({ agent, model, latencyMs: Date.now() - startedAt, promptTokens: 0, completionTokens: 0, totalTokens: 0, costSgd: 0, success: false, error: `timeout:${timeoutMs}ms`, schemaRepaired, attempts: attempt });
        recordOutcome(agent, false);
        throw new LLMTimeoutError(timeoutMs);
      }
      if (!aborted && !isRetryable(err)) {
        await logCall({ agent, model, latencyMs: Date.now() - startedAt, promptTokens: 0, completionTokens: 0, totalTokens: 0, costSgd: 0, success: false, error: `non_retryable: ${err?.message ?? String(err)}`, schemaRepaired, attempts: attempt });
        recordOutcome(agent, false);
        throw err;
      }
      if (attempt > maxRetries) {
        await logCall({ agent, model, latencyMs: Date.now() - startedAt, promptTokens: 0, completionTokens: 0, totalTokens: 0, costSgd: 0, success: false, error: `retries_exhausted: ${err?.message ?? String(err)}`, schemaRepaired, attempts: attempt });
        recordOutcome(agent, false);
        throw err;
      }
      // Exponential backoff: 200ms, 800ms, 2000ms
      const delay = [200, 800, 2000][Math.min(attempt - 1, 2)];
      await sleep(delay);
      // continue loop
    }
  }

  // Defensive — loop should always return or throw above.
  throw lastErr ?? new Error("callLLM: exhausted without result");
}

// ── Retention pruner ─────────────────────────────────────────────────────────
/**
 * Delete telemetry rows older than `keepDays` (default 90).
 * Wire into a daily cron in server/index.ts to prevent unbounded growth.
 * Returns number of rows deleted.
 */
export async function pruneOldLlmCalls(keepDays = 90): Promise<number> {
  try {
    const { sql: drizzleSql } = await import("drizzle-orm");
    const r: any = await db.execute(drizzleSql`
      DELETE FROM ai_llm_calls
      WHERE created_at < NOW() - (${keepDays} || ' days')::interval
    `);
    return r?.rowCount ?? r?.rows?.length ?? 0;
  } catch (e: any) {
    console.warn("[llm-client] pruneOldLlmCalls failed:", e?.message);
    return 0;
  }
}

// ── Conversation summarization (for long histories) ──────────────────────────
/**
 * If history has > maxKeep entries, summarize the OLDER half into a single
 * paragraph and return [summary, recentTurns]. Otherwise returns
 * [null, history]. Caller should prepend the summary as a system note.
 */
export async function summarizeIfLong(
  agent: string,
  history: Array<{ role: string; content: string }>,
  maxKeep = 16,
): Promise<{ summary: string | null; recent: Array<{ role: string; content: string }> }> {
  if (history.length <= maxKeep) return { summary: null, recent: history };
  const olderCount = history.length - Math.floor(maxKeep / 2);
  const older = history.slice(0, olderCount);
  const recent = history.slice(olderCount);
  try {
    const { value } = await callLLM<string>({
      agent: `${agent}_summarize`,
      max_tokens: 250,
      timeoutMs: 12_000,
      maxRetries: 1,
      messages: [
        { role: "system", content: "Summarize the following customer conversation into ONE concise paragraph (max 4 sentences). Capture: customer intent, facts already shared (service, address, items, dates), open questions, and tone. Plain prose, no bullet points." },
        { role: "user", content: older.map(h => `${h.role}: ${h.content}`).join("\n") },
      ],
    });
    return { summary: value.trim(), recent };
  } catch {
    // If summarization itself fails, just drop the older half — better than
    // exploding the prompt.
    return { summary: null, recent };
  }
}
