# WhatsApp AI Agent — Phase 9 Verification Guide

**Version:** Phase 9  
**Last updated:** 2026-04-14

---

## Quick Verification Command

```bash
tsx scripts/verify-whatsapp-ai.ts
```

Runs 10 automated DB checks and prints a PASS/FAIL summary.
Exits `0` on all pass, `1` on any failure.
**No WhatsApp API or OpenAI secrets required.**

---

## Unit Test Suite

```bash
tsx --test server/tests/whatsapp-agent.phase9.spec.ts
```

Tests covered (9 scenarios):

| # | Scenario |
|---|----------|
| T1 | AI disabled → legacy path unchanged |
| T2 | AI enabled + handleable lead → AI path processes |
| T3 | Handoff condition → handoff created, AI stops |
| T4 | Resume AI → ownership/state returns to AI |
| T5 | Outside 24-hour window → outbound blocked safely |
| T6 | Duplicate inbound webhook → second delivery skipped |
| T7 | Follow-up scheduling idempotency |
| T8 | Non-admin access to admin APIs → denied |
| T9 | Admin access to admin APIs → allowed |

---

## What to Verify Before Enabling the Agent

### 1. Run verification script
```bash
tsx scripts/verify-whatsapp-ai.ts
```
Expected: all 10 checks PASS.

### 2. Run unit tests
```bash
tsx --test server/tests/whatsapp-agent.phase9.spec.ts
```
Expected: all test cases pass.

### 3. Confirm all flags are OFF (safe defaults)
```sql
SELECT key, value FROM ai_feature_flags WHERE key LIKE 'ai_whatsapp%';
```
Expected:
- `ai_whatsapp_agent_enabled` = **false**
- `ai_whatsapp_followups_enabled` = **false**
- `ai_whatsapp_auto_qualify_enabled` = true (safe — AI isn't enabled yet)
- `ai_whatsapp_template_mode_enabled` = true (safe)
- `ai_whatsapp_handoff_required_on_low_confidence` = true (safe)

### 4. Verify legacy bot is unaffected (agent still OFF)
Send a test WhatsApp message and confirm the legacy bot responds normally.
No AI qualification questions should appear.

### 5. Check the diagnostics panel
In the admin panel, navigate to **AI Hub → WhatsApp AI Agent → Diagnostics**.
All counters should be zero (no events yet).

---

## What to Verify After Enabling the Agent

### 6. Enable agent flag
In `/admin/ai/whatsapp`, toggle `ai_whatsapp_agent_enabled` → ON.

### 7. Send a test WhatsApp message
Send a message like: *"Hi, I need furniture installation at Tampines"*

Expected in server logs:
```
[WhatsApp] [corr:wamid.xxxxx] inbound received (from=****XXXX, type=text)
[WA-Agent] [corr:wamid.xxxxx] intercept start (phone=****XXXX, type=text)
[WA-Agent] [corr:wamid.xxxxx] reply sent [state:qualifying, conf:0.XX] (phone=****XXXX)
[WhatsApp] [corr:wamid.xxxxx] AI agent handled — legacy bot skipped
```

### 8. Test duplicate webhook replay
Replay the same webhook payload twice (e.g., using a REST client to POST the same payload to `/api/webhooks/whatsapp`).

Expected:
- First delivery: processed normally
- Second delivery: in-memory dedup logs `duplicate webhook ignored` and returns
- If process restarts in between: DB idempotency check logs `DUPLICATE — already processed, skipping`

### 9. Test handoff
Send a message containing: *"This is ridiculous, I want to speak to a manager"*

Expected:
- AI sends handoff message
- Session `ai_ownership` changes to `human`, `bot_paused = true`
- Entry appears in `ai_whatsapp_handoffs` table
- Audit log shows `handoff_triggered` event

### 10. Test resume AI
In the admin UI, find the conversation and click **Resume AI**.

Expected:
- Session `ai_ownership` returns to `ai`, `bot_paused = false`
- Audit log shows `manual_resume` event

---

## Structured Log Format

Every log line from the AI agent follows this format:

```
[WA-Agent] [corr:wamid.XXXXXXXX] <event description> (phone=****XXXX)
```

- `corr:` — first 12 chars of the wamid (correlation ID)
- `phone=****XXXX` — last 4 digits only (masked)

This allows tracing a single inbound event end-to-end in logs using the correlation ID.

---

## Admin API Security

All Phase 9 admin API routes require:
1. Valid session (`req.session.userId` present)
2. User role = `admin`

Non-admin access returns 401 (no session) or 403 (wrong role).

Routes secured:
- `GET /api/admin/ai/whatsapp/conversations`
- `GET /api/admin/ai/whatsapp/conversations/:phone`
- `POST /api/admin/ai/whatsapp/conversations/:phone/handoff`
- `POST /api/admin/ai/whatsapp/conversations/:phone/resume-ai`
- `GET /api/admin/ai/whatsapp/diagnostics`

---

## Remaining Risks

| Risk | Mitigation |
|------|-----------|
| OpenAI API down | Agent catches all errors and falls through to legacy bot. 100% non-fatal. |
| OpenAI returns malformed JSON | `extractFacts` has a try/catch and returns existing facts unchanged. |
| WhatsApp Cloud API rejects a send | `sendBotMessage` errors are caught in agent; legacy bot path not affected. |
| Very high message volume | Each webhook is async and non-blocking; dedup Set caps at 2000 entries. |
| DB connection failure in idempotency check | `checkDuplicateByCorrelationId` catches all errors and returns `false` (safe — allows processing to continue). |
| Follow-up sent after agent disabled | The `ai_whatsapp_followups_enabled` flag guards the scheduler. Disable to stop all follow-ups immediately. |
