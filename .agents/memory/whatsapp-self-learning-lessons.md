---
name: WhatsApp AI self-learning lessons
description: How the WhatsApp sales bot's self-learning loop works and why lessons must be sanitized before persist/inject.
---

The WhatsApp sales bot self-improves by distilling short BEHAVIORAL lessons from
real chats and injecting the active ones into every future sales system prompt.

- Lessons live as one JSON blob in `appSettings` key `ai_whatsapp_learned_lessons`
  (no schema migration). Reviewer = `reviewConversationForLessons()` in
  `server/whatsapp-agent.ts`, fired fire-and-forget on handoff / first quote_ready
  / low_rating(<=3). Gated by master kill switch + default-ON flag
  `ai_whatsapp_self_learning_enabled`.

**Rule:** every candidate lesson MUST pass `sanitizeLessonText()` before it is
persisted or injected.
**Why:** lessons are distilled by an LLM from UNTRUSTED customer transcripts and
then injected verbatim into future prompts — a durable prompt-injection /
PII-retention vector (architect flagged this as severe). The sanitizer drops PII
(email/phone/postal/unit/block), money amounts, 3+ digit numbers, URLs, and
prompt-injection phrasing. Pricing must ALWAYS come from the catalog, never from
a learned lesson — that's why numbers/`$` are rejected outright.
**How to apply:** any new path that stores or surfaces a learned lesson must run
it through the same sanitizer, and any concurrent read-modify-write of the blob
must go through `withLessonLock()` or overlapping reviewers clobber each other.

Product decision: lessons stay auto-active by default (goal is a self-correcting
bot); admin toggle/delete in AIWhatsApp.tsx `LessonsPanel` is the off-switch. Do
NOT switch to approval-before-active without user sign-off.
