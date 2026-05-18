/**
 * commercial-reminders.ts — Net-30 invoice reminder sweep
 *
 * Runs once daily via the main scheduler. For each commercial quote that has
 * an unpaid Net-30 invoice (status='final_payment_requested', invoiceType=
 * 'commercial', no finalPaidAt), this checks the days-outstanding since the
 * invoice was first sent and emails the customer at three stages:
 *
 *   D15  — friendly halfway-through nudge
 *   D28  — "due in 2 days" reminder
 *   D31+ — overdue (sent once, on the first sweep after the due date passes)
 *
 * Each stage is recorded on quotes.commercialRemindersSent so a stage never
 * fires twice for the same invoice. Safe to run repeatedly per day — the
 * stage guard makes it idempotent.
 */

import { db } from "./db";
import { eq, and, isNotNull, isNull, sql } from "drizzle-orm";
import { quotes } from "@shared/schema";
import { storage } from "./storage";
import { sendEmail, commercialInvoiceReminderEmail } from "./email";

const APP_URL = process.env.APP_URL || "http://localhost:5000";

type Stage = "d15" | "d28" | "d31";

function pickStage(daysOutstanding: number, alreadySent: string[]): Stage | null {
  // Order matters: later stages take precedence so a sweep that's been
  // offline for a week still fires the most relevant single reminder.
  if (daysOutstanding >= 31 && !alreadySent.includes("d31")) return "d31";
  if (daysOutstanding >= 28 && daysOutstanding < 31 && !alreadySent.includes("d28")) return "d28";
  if (daysOutstanding >= 15 && daysOutstanding < 28 && !alreadySent.includes("d15")) return "d15";
  return null;
}

function stageToEmailVariant(stage: Stage): "nudge" | "due_soon" | "overdue" {
  if (stage === "d15") return "nudge";
  if (stage === "d28") return "due_soon";
  return "overdue";
}

export interface ReminderSweepResult {
  scanned: number;
  sent: number;
  skipped: number;
  errors: number;
}

export async function runCommercialInvoiceReminderSweep(
  triggeredBy: string = "scheduler",
): Promise<ReminderSweepResult> {
  const result: ReminderSweepResult = { scanned: 0, sent: 0, skipped: 0, errors: 0 };

  // Pull all candidate quotes: commercial, invoiced, not yet paid.
  const rows = await db.select().from(quotes).where(
    and(
      eq(quotes.invoiceType, "commercial"),
      eq(quotes.status, "final_payment_requested"),
      isNotNull(quotes.commercialInvoiceSentAt),
      isNull(quotes.finalPaidAt),
    ),
  );
  result.scanned = rows.length;

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const row of rows) {
    try {
      const sentAt = row.commercialInvoiceSentAt ? new Date(row.commercialInvoiceSentAt).getTime() : null;
      if (!sentAt) { result.skipped++; continue; }

      const daysOutstanding = Math.floor((now - sentAt) / DAY_MS);
      const alreadySent = Array.isArray(row.commercialRemindersSent) ? row.commercialRemindersSent : [];
      const stage = pickStage(daysOutstanding, alreadySent);
      if (!stage) { result.skipped++; continue; }

      // Hydrate the full quote so the email template has customer + items.
      const full = await storage.getQuote(row.id);
      if (!full || !full.customer?.email) { result.skipped++; continue; }
      const hasRealEmail = !full.customer.email.endsWith("@tmginstall.com") && full.customer.email.includes("@");
      if (!hasRealEmail) { result.skipped++; continue; }

      const dueDate = new Date(sentAt + 30 * DAY_MS);
      const dueDateStr = dueDate.toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" });
      const viewUrl = `${APP_URL}/quotes/${row.id}?ref=${row.referenceNo}`;
      const variant = stageToEmailVariant(stage);

      const subject =
        variant === "overdue"  ? `[${row.referenceNo}] Invoice Overdue — Day ${daysOutstanding}` :
        variant === "due_soon" ? `[${row.referenceNo}] Invoice Due in 2 Days` :
                                 `[${row.referenceNo}] Friendly Reminder — Invoice ${row.referenceNo}`;

      const html = commercialInvoiceReminderEmail(full, variant, dueDateStr, daysOutstanding, viewUrl);
      const ok = await sendEmail({ to: full.customer.email, subject, html }).catch(() => false);

      if (!ok) {
        result.errors++;
        console.error(`[CommercialReminders] failed to email ${row.referenceNo} (${stage})`);
        continue;
      }

      // Mark this stage as sent so it never re-fires for this invoice.
      await db.update(quotes)
        .set({ commercialRemindersSent: sql`array_append(coalesce(${quotes.commercialRemindersSent}, ARRAY[]::text[]), ${stage})` })
        .where(eq(quotes.id, row.id));

      result.sent++;
      console.log(`[CommercialReminders] sent ${stage} reminder for ${row.referenceNo} (${daysOutstanding}d outstanding)`);
    } catch (err: any) {
      result.errors++;
      console.error(`[CommercialReminders] sweep error for quote ${row.id}:`, err?.message);
    }
  }

  if (result.scanned > 0 || result.sent > 0) {
    console.log(`[CommercialReminders] sweep complete (${triggeredBy}):`, JSON.stringify(result));
  }
  return result;
}
