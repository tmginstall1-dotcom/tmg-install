/**
 * ai-lead-scoring.ts — Score WhatsApp leads 0-100 by revenue potential.
 *
 * Goal: prioritize. Hot leads (score >= threshold) trigger an instant
 * real-time alert so a human can call back within minutes — that single
 * speed-of-response improvement is the biggest revenue lever in service
 * businesses. Cold/info-only leads stay with the AI agent.
 *
 * Signals (all from facts we already extract — no extra LLM calls):
 *   - Service type:    relocation/office_fitout = highest ticket
 *   - Quantity:        more items = bigger job
 *   - Urgency:         "asap" = ready to buy now
 *   - Quote-readiness: all required facts captured = qualified, not tyre-kicker
 *   - Floor + no lift: complex job = high-margin job
 *   - Address present: real customer, not just curious
 *   - Business hours:  small bonus — sales can call back fast
 */

import type { CaseFacts } from "./whatsapp-agent";

export interface LeadScoreReason {
  label: string;
  points: number;
}

export interface LeadScore {
  score: number;          // 0-100, capped
  reasons: LeadScoreReason[];
  tier: "cold" | "warm" | "hot";
}

/**
 * Compute a 0-100 score from extracted CaseFacts. Pure function — no I/O.
 * Reasons are returned for transparency in the admin UI ("why is this hot?").
 */
export function scoreLead(facts: CaseFacts, opts?: { hotThreshold?: number; warmThreshold?: number }): LeadScore {
  const hot = opts?.hotThreshold ?? 75;
  const warm = opts?.warmThreshold ?? 45;
  const reasons: LeadScoreReason[] = [];
  let score = 0;

  // ── Service type — biggest single signal of ticket size ──
  switch (facts.serviceType) {
    case "office_fitout": score += 25; reasons.push({ label: "Office fit-out (premium ticket)", points: 25 }); break;
    case "relocation":    score += 22; reasons.push({ label: "Relocation job (premium ticket)", points: 22 }); break;
    case "installation":  score += 15; reasons.push({ label: "Installation job", points: 15 }); break;
    case "dismantling":   score += 10; reasons.push({ label: "Dismantling job", points: 10 }); break;
  }

  // ── Item count — proxy for job size ──
  const qty = facts.quantity ?? facts.itemTypes?.length ?? 0;
  if (qty >= 5)      { score += 20; reasons.push({ label: `${qty} items (large job)`, points: 20 }); }
  else if (qty >= 3) { score += 12; reasons.push({ label: `${qty} items`, points: 12 }); }
  else if (qty >= 1) { score += 5;  reasons.push({ label: `${qty} item(s)`, points: 5 }); }

  // ── Urgency — biggest predictor of "will book today" ──
  switch (facts.urgency) {
    case "asap":       score += 25; reasons.push({ label: "ASAP — ready to book now", points: 25 }); break;
    case "this_week":  score += 15; reasons.push({ label: "Wants this week", points: 15 }); break;
    case "this_month": score += 5;  reasons.push({ label: "Wants this month", points: 5 }); break;
  }

  // ── Qualification depth — quote-ready means it's not a fishing trip ──
  const requiredCaptured = [
    facts.serviceType, facts.jobAddress, facts.homeOrOffice,
    facts.itemTypes && facts.itemTypes.length > 0,
    facts.floorLevel !== undefined, facts.hasLift !== undefined,
  ].filter(Boolean).length;
  if (requiredCaptured >= 6) { score += 15; reasons.push({ label: "Fully qualified (all key facts)", points: 15 }); }
  else if (requiredCaptured >= 4) { score += 8; reasons.push({ label: "Mostly qualified", points: 8 }); }

  // ── Job complexity = revenue (high floor + no lift = expensive job) ──
  if (facts.hasLift === false && (facts.floorLevel ?? 1) >= 3) {
    score += 10; reasons.push({ label: `Floor ${facts.floorLevel} no lift (high-margin)`, points: 10 });
  }

  // ── Address present — real lead, not curious browser ──
  if (facts.jobAddress && facts.jobAddress.length > 8) {
    score += 5; reasons.push({ label: "Provided full address", points: 5 });
  }

  // ── Photos present — engaged, has actually decided what to move ──
  if (facts.photosPresent) { score += 5; reasons.push({ label: "Sent photos (engaged)", points: 5 }); }

  // ── Business-hours boost (Singapore time, Mon-Sat 09:00-19:00) ──
  // Sales can respond within minutes during business hours, so a hot lead
  // landing then is more actionable than one at 2am. Modest weight only.
  const sgHour = new Date(Date.now() + 8 * 3600_000).getUTCHours();
  const sgDow = new Date(Date.now() + 8 * 3600_000).getUTCDay(); // 0=Sun
  if (sgDow !== 0 && sgHour >= 9 && sgHour < 19) {
    score += 3; reasons.push({ label: "Business hours (callable now)", points: 3 });
  }

  // Cap at 100
  if (score > 100) score = 100;

  const tier: LeadScore["tier"] = score >= hot ? "hot" : score >= warm ? "warm" : "cold";
  return { score, reasons, tier };
}
