# WhatsApp AI Agent — Phase 9 Rollback Runbook

**Version:** Phase 9  
**Last updated:** 2026-04-14  
**Scope:** Operational rollback via feature flags. No destructive schema changes required.

---

## 1. When to Rollback

Trigger an immediate rollback if any of the following occur after enabling the AI agent:

- Customers receive duplicate or garbled messages
- AI sends incorrect pricing information
- AI does not hand off when it should (customer frustration not caught)
- Follow-ups are sent outside the 24-hour window without template compliance
- Admin reports AI-owned conversations not receiving human responses
- Unexpected errors in server logs with `[WA-Agent]` prefix

---

## 2. Immediate Rollback (Flag-Only — Preferred Path)

This disables the AI agent instantly without any schema changes or data loss.

### Step 1 — Disable AI agent via admin UI

1. Log in to the admin panel at `/admin/ai/whatsapp`
2. Find the flag **`ai_whatsapp_agent_enabled`** → toggle to **OFF**
3. Find the flag **`ai_whatsapp_followups_enabled`** → toggle to **OFF**
4. Confirm both flags show **OFF**

### Step 2 — Verify legacy bot is still active

Send a test WhatsApp message to the business number and confirm:
- The legacy bot responds normally
- No AI-style qualification questions appear
- The message flow continues as before Phase 9

### Step 3 — Pause any pending follow-ups (if needed)

If follow-ups were already scheduled and you want to prevent them from firing:

```sql
UPDATE ai_whatsapp_followups
SET status = 'cancelled', skip_reason = 'emergency_rollback'
WHERE status = 'pending';
```

Run via: `psql $DATABASE_URL -c "UPDATE ai_whatsapp_followups SET status='cancelled', skip_reason='emergency_rollback' WHERE status='pending';"`

---

## 3. What is Preserved After Rollback

| Data | Preserved? | Notes |
|------|------------|-------|
| All conversation history (`whatsapp_sessions`) | ✅ Yes | No rows deleted |
| All inbound/outbound messages (`whatsapp_messages`) | ✅ Yes | No rows deleted |
| All handoff records (`ai_whatsapp_handoffs`) | ✅ Yes | Historical record intact |
| All follow-up records (`ai_whatsapp_followups`) | ✅ Yes | Cancelled, not deleted |
| AI audit log (`ai_audit_log`) | ✅ Yes | Full history preserved |
| Legacy bot behaviour | ✅ Yes | Unchanged, resumes immediately |
| Customer quotes, bookings, payments | ✅ Yes | Never touched by AI agent |

---

## 4. Verify Recovery After Rollback

1. Confirm `ai_whatsapp_agent_enabled = false` in DB:
   ```sql
   SELECT key, value FROM ai_feature_flags WHERE key LIKE 'ai_whatsapp%';
   ```

2. Send a test WhatsApp message and verify:
   - Legacy bot responds (not AI qualification flow)
   - No `[WA-Agent]` log lines for the new message

3. Check for any open handoffs that need human attention:
   ```sql
   SELECT phone, reason, handed_at FROM ai_whatsapp_handoffs
   WHERE resumed_at IS NULL
   ORDER BY handed_at DESC;
   ```
   These conversations are waiting for human response. Assign them manually.

4. Run the verification script:
   ```bash
   tsx scripts/verify-whatsapp-ai.ts
   ```
   All checks should still pass (schema is unchanged).

---

## 5. Re-enable After Fix

When the root cause is resolved:

1. Fix the issue (code or config)
2. Restart the application
3. Run `tsx scripts/verify-whatsapp-ai.ts` — ensure all checks pass
4. Enable `ai_whatsapp_agent_enabled` in the admin UI
5. Monitor logs for `[WA-Agent]` entries for the first 30 minutes

---

## 6. Optional: Schema Cleanup (Non-Emergency)

> ⚠️ Only run this if you are permanently removing Phase 9 and are certain no data needs to be kept.
> **Never run this as part of an emergency rollback.**

```sql
-- Remove AI columns from whatsapp_sessions (optional cleanup only)
ALTER TABLE whatsapp_sessions DROP COLUMN IF EXISTS ai_state;
ALTER TABLE whatsapp_sessions DROP COLUMN IF EXISTS ai_ownership;
ALTER TABLE whatsapp_sessions DROP COLUMN IF EXISTS last_inbound_at;
ALTER TABLE whatsapp_sessions DROP COLUMN IF EXISTS window_open;
ALTER TABLE whatsapp_sessions DROP COLUMN IF EXISTS handoff_reason;
ALTER TABLE whatsapp_sessions DROP COLUMN IF EXISTS confidence_score;
ALTER TABLE whatsapp_sessions DROP COLUMN IF EXISTS case_facts;
ALTER TABLE whatsapp_sessions DROP COLUMN IF EXISTS missing_facts;
ALTER TABLE whatsapp_sessions DROP COLUMN IF EXISTS template_mode_only;
ALTER TABLE whatsapp_sessions DROP COLUMN IF EXISTS followup_scheduled;

-- Drop new Phase 9 tables (optional cleanup only)
DROP TABLE IF EXISTS ai_whatsapp_followups;
DROP TABLE IF EXISTS ai_whatsapp_handoffs;
```

---

## 7. All Rollback Flags Reference

| Flag | Safe OFF value | Effect of OFF |
|------|---------------|---------------|
| `ai_whatsapp_agent_enabled` | `false` | Agent disabled; legacy bot handles all messages |
| `ai_whatsapp_followups_enabled` | `false` | No follow-up messages sent |
| `ai_whatsapp_auto_qualify_enabled` | `true` | OK to leave on; harmless without agent |
| `ai_whatsapp_template_mode_enabled` | `true` | OK to leave on |
| `ai_whatsapp_handoff_required_on_low_confidence` | `true` | OK to leave on |
| `ai_master_kill_switch` | `true` | Nuclear option — disables all AI ops |

---

## 8. Contact & Escalation

- Admin panel: `/admin/ai/whatsapp`
- Audit log: `/admin/ai/audit`
- AI Hub: `/admin/ai`
- WhatsApp conversations: `/admin/conversations`
