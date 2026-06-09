// =============================================================================
// TMG Install — Standard Quote & Job Terms
// =============================================================================
// A single source of truth for the operational terms that appear on every
// quote and invoice. These are the clauses that make extra on-site time,
// return visits, and access surcharges actually billable — they must be shown
// to the customer up front so they have agreed before the crew is dispatched.
//
// Numbers are pulled from PricingConfig wherever possible so the wording can
// never drift out of sync with what the engine actually charges.
// =============================================================================

import { PricingConfig } from "./pricing";

export interface QuoteTerm {
  title: string;
  body: string;
}

// Non-pricing policy values (scheduling / admin policy, not part of the pricing
// engine). Tunable here.
export const QuoteTermsPolicy = {
  validityDays: 14,            // how long a quote stays valid
  freeRescheduleHours: 48,     // free reschedule notice window
  cancelForfeitHours: 48,      // cancellations inside this window may forfeit deposit
};

function money(n: number): string {
  return `$${Number(n).toFixed(Number.isInteger(n) ? 0 : 2)}`;
}

/**
 * Returns the standard quote terms as a structured list. Pass `isRelocation`
 * so move-only clauses (included time, transport, second-day continuation) are
 * only shown when they apply.
 */
export function getQuoteTerms(opts?: { isRelocation?: boolean }): QuoteTerm[] {
  const isRelocation = opts?.isRelocation ?? true;
  const ot = PricingConfig.overtime;
  const sd = PricingConfig.secondDay;
  const fl = PricingConfig.floor;
  const dep = PricingConfig.deposit;

  const terms: QuoteTerm[] = [];

  terms.push({
    title: "Quote validity",
    body: `This quote is valid for ${QuoteTermsPolicy.validityDays} days from the issue date. Prices may change after this period or if the scope of work changes.`,
  });

  if (isRelocation) {
    terms.push({
      title: "Crew & included time",
      body: `Your price covers the crew and scheduled on-site time shown on this quote (based on the items and distance for your job). If the job runs beyond the scheduled time, additional time is charged at ${money(ot.perPersonHourlyRate)} per mover, per hour, billed in ${ot.blockMinutes}-minute blocks. Included on-site time and hourly overtime apply to carry-and-transport moves; dismantle-and-reinstall items are priced individually per item and are not billed by the hour.`,
    });
    terms.push({
      title: "Same-day completion",
      body: `Large or complex jobs may not finish in one day due to access delays (lift congestion, loading-bay parking, items not ready). If a return visit is needed, it is charged at ${money(sd.returnFee)} plus ${money(sd.perPersonHourlyRate)} per mover per hour of actual time on the second day.`,
    });
  }

  terms.push({
    title: "Site & access conditions",
    body: `Pricing assumes the floor level and lift access stated at booking. If actual conditions differ (no lift, extra floors, long carry distance, restricted parking), surcharges apply: ${money(fl.perFloorWithLift)} per floor with a lift and ${money(fl.perFloorNoLift)} per floor without a lift, plus any access-difficulty adjustment.`,
  });

  terms.push({
    title: "Customer preparation",
    body: `Please empty all drawers, cabinets, and shelves and remove loose glass, mirror, and marble panels before the crew arrives. Time lost to unprepared items may be charged as additional on-site time.`,
  });

  terms.push({
    title: "Fragile & high-value items",
    body: `Glass, marble, mirror, antiques, and electronics are handled with care but moved at the owner's risk unless additional protection or insurance is arranged in advance. Please declare high-value items at booking. Our liability is governed by our full Terms & Conditions.`,
  });

  terms.push({
    title: "Large & specialty items",
    body: `Items that will not fit in a standard lift when intact, or that need 3+ movers or special equipment (pianos, safes, large display cabinets, kitchen islands, etc.), require an on-site survey. The quoted price for such items is an estimate until confirmed on site.`,
  });

  terms.push({
    title: "Promotions & discounts",
    body: `Only one discount applies per job — promo codes cannot be combined with any other discount or promotion. In particular, relocation jobs priced with the dismantle-&-reinstall (D&R) bundle rate already include a built-in discount, so promo codes do NOT stack on top of relocation / D&R bundle pricing. Promo codes also do not apply to survey-required or specialty items.`,
  });

  const acceptance = isRelocation
    ? "Paying the deposit confirms that you accept this quote, the included on-site time shown above, and these Standard Terms & Conditions."
    : "Paying the deposit confirms that you accept this quote and these Standard Terms & Conditions.";
  terms.push({
    title: "Payment",
    body: `A ${Math.round(dep.pct * 100)}% deposit confirms the booking and the balance is due on completion. Jobs under ${money(dep.fullPaymentThreshold)} are payable in full to confirm the booking. ${acceptance}`,
  });

  terms.push({
    title: "Reschedule & cancellation",
    body: `Your first reschedule is free with at least ${QuoteTermsPolicy.freeRescheduleHours} hours' notice; further changes or short-notice requests may incur a $30 admin fee. Cancellations more than ${QuoteTermsPolicy.cancelForfeitHours} hours before the appointment are refunded less a $30 admin fee; cancellations ${QuoteTermsPolicy.cancelForfeitHours} hours or less before the appointment forfeit the deposit. See our full Terms & Conditions for details.`,
  });

  terms.push({
    title: "Condition record",
    body: `Our crew photographs items at pickup and on completion. These photos form the agreed record of item condition for the job.`,
  });

  return terms;
}

/** Plain-text version of the terms, e.g. for PDF footers or WhatsApp messages. */
export function getQuoteTermsText(opts?: { isRelocation?: boolean }): string {
  return getQuoteTerms(opts)
    .map((t, i) => `${i + 1}. ${t.title}: ${t.body}`)
    .join("\n");
}

/** Short heading used above the terms block on documents. */
export const QUOTE_TERMS_HEADING = "Standard Terms & Conditions";
