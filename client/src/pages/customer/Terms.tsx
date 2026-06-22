import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePromoBar } from "@/hooks/use-promo-bar";
import { useSEO } from "@/hooks/use-seo";
import { PricingConfig } from "@shared/pricing";
import { BusinessRulesDefaults } from "@shared/businessRules";
import { QuoteTermsPolicy } from "@shared/terms";

/** "18:00" → "6pm" for customer-facing copy. */
function to12h(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return hhmm;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  return min === 0 ? `${h}${ap}` : `${h}:${String(min).padStart(2, "0")}${ap}`;
}

const EFFECTIVE_DATE = "1 January 2026";
const COMPANY = "The Moving Guy Pte Ltd";
const UEN = "202424156H";
const ADDRESS = "160 Robinson Road, #14-04 SBF Center, Singapore 068914";
const EMAIL = "sales@tmginstall.com";
const WHATSAPP = "https://wa.me/6580880757?text=hi";

// Engine-derived figures — pulled from the pricing config so the Terms page can
// never drift out of sync with what customers are actually charged.
const OT_RATE = PricingConfig.overtime.perPersonHourlyRate;
const OT_BLOCK = PricingConfig.overtime.blockMinutes;
const SD_RETURN = PricingConfig.secondDay.returnFee;
const SD_RATE = PricingConfig.secondDay.perPersonHourlyRate;
const DEP_PCT = Math.round(PricingConfig.deposit.pct * 100);
const THRESHOLD = PricingConfig.deposit.fullPaymentThreshold;
const FLOOR_LIFT = PricingConfig.floor.perFloorWithLift;
const FLOOR_NOLIFT = PricingConfig.floor.perFloorNoLift;
const VALIDITY = QuoteTermsPolicy.validityDays;
const SPLIT_GAP = PricingConfig.splitJob.sameDayGapHours;
const TRIP_CHARGE = BusinessRulesDefaults.additionalTripCharge;
const AO_PCT = BusinessRulesDefaults.afterOfficeSurchargePct;
const AO_CUTOFF = to12h(BusinessRulesDefaults.afterOfficeCutoff);
const WORK_HOURS = `${to12h(BusinessRulesDefaults.workingHoursStart)}–${to12h(BusinessRulesDefaults.workingHoursEnd)}`;

export default function Terms() {
  const { visible: promoVisible } = usePromoBar();
  useSEO({
    title: "Terms & Conditions | TMG Install — The Moving Guy Pte Ltd",
    description: "Read the terms and conditions for furniture installation, dismantling, and relocation services by TMG Install (The Moving Guy Pte Ltd), Singapore.",
    canonical: "https://tmginstall.com/terms",
  });
  return (
    <div className={`min-h-screen bg-white ${promoVisible ? "pt-24" : "pt-14"}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">

        {/* Back */}
        <Link href="/">
          <a className="inline-flex items-center gap-2 text-sm font-semibold text-black/40 hover:text-black transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </a>
        </Link>

        {/* Header */}
        <div className="mb-12 pb-10 border-b border-black/8">
          <p className="text-xs font-bold tracking-[3px] uppercase text-black/30 mb-4">TMG Install</p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-black mb-4">
            Terms &amp;<br />Conditions
          </h1>
          <p className="text-sm text-black/40">
            Effective date: {EFFECTIVE_DATE} &nbsp;·&nbsp; {COMPANY} (UEN {UEN})
          </p>
        </div>

        {/* Body */}
        <div className="prose-tmg space-y-12 text-black/80">

          <Section title="1. Overview & Acceptance">
            <p>
              These Terms and Conditions ("Terms") govern the use of services provided by <strong>{COMPANY}</strong> (UEN {UEN}),
              trading as <strong>TMG Install</strong> ("we", "us", "our"). Our services include furniture installation,
              dismantling, disposal, and relocation across Singapore, arranged through our online quoting platform at{" "}
              <strong>tmginstall.com</strong>, WhatsApp, or by phone.
            </p>
            <p>
              By requesting a quote, paying a deposit or full payment, or otherwise engaging our services, you ("Customer",
              "you") confirm that you have read, understood, and agree to be bound by these Terms, together with the specific
              details, pricing, included on-site time, and crew shown on your quote. If you do not agree, please do not
              proceed with payment or booking.
            </p>
          </Section>

          <Section title="2. Quotes & Pricing">
            <p>
              All prices are quoted in Singapore Dollars (SGD) and are inclusive of GST where applicable. Quotes are valid
              for <strong>{VALIDITY} days</strong> from the issue date and are generated based on the information you provide
              (item list, quantities, floor levels, lift access, and distance).
            </p>
            <p>
              Your price is built from the scope of work, <strong>not</strong> from an hourly rate. We reserve the right to
              revise pricing if, upon arrival, the work required is found to differ materially from what was described (for
              example, more or larger items, different access conditions, or items not ready). Any such adjustment will be
              communicated to you before additional work proceeds.
            </p>
          </Section>

          <Section title="3. Included On-Site Time & Crew">
            <p>
              Each relocation quote includes a <strong>scheduled on-site time</strong> for a stated crew size — shown on your
              quote as, for example, "2 movers × 3 hours = 6 man-hours". This is the amount of crew time your price covers and
              is calculated from the items and distance for your job, rounded up to the nearest half hour.
            </p>
            <p>
              A "man-hour" means one crew member working for one hour. The included time is the agreed baseline against which
              any additional time is measured. The exact figure for your job is shown on your quote, invoice, and quotation PDF.
            </p>
            <p>
              Included on-site time and hourly overtime apply to <strong>carry-and-transport moves</strong>.
              Dismantle-and-reinstall (D&amp;R) items are priced individually per item and are not billed by the hour.
            </p>
          </Section>

          <Section title="4. Additional Charges & Surcharges">
            <p>
              The following charges may apply on top of your quoted price. Where they can be determined in advance they are
              shown on your quote; where they depend on what happens on site they are added afterwards and reflected in your
              final balance:
            </p>
            <ul>
              <li>
                <strong>Overtime (same day):</strong> For carry-and-transport moves, if a job runs beyond the included
                on-site time, additional time is charged at <strong>${OT_RATE} per mover, per hour</strong>, billed in{" "}
                {OT_BLOCK}-minute blocks, with no cap (for example, a 2-person crew is ${OT_RATE * 2} per hour).
                Dismantle-and-reinstall items are priced per item and are not subject to hourly overtime.
              </li>
              <li>
                <strong>Same-day split timing:</strong> Each booking covers one continuous on-site slot. If you ask us to
                leave and return later the <strong>same day</strong> with a gap of more than <strong>{SPLIT_GAP} hours</strong>{" "}
                between sessions (for example, dismantling first and coming back to reinstall), that counts as a second trip
                and a mobilisation charge of <strong>${TRIP_CHARGE.toFixed(2)}</strong> per extra trip applies. We will
                confirm any split timing with you in writing before the job.
              </li>
              <li>
                <strong>Second-day continuation:</strong> Large or complex jobs may not finish in one day due to access delays
                (lift congestion, loading-bay parking, items not ready, or scope larger than described). If the work
                continues to the <strong>next calendar day</strong>, it is charged at <strong>${SD_RETURN}</strong>{" "}
                (re-mobilisation) plus <strong>${SD_RATE} per mover, per hour</strong> of actual time on the second day.
              </li>
              <li>
                <strong>After-office work:</strong> Standard working hours are <strong>{WORK_HOURS}</strong>. Work that
                continues past <strong>{AO_CUTOFF}</strong> is treated as after-office and carries a{" "}
                <strong>{AO_PCT}% surcharge on the total job price</strong>. Where after-office work is expected the surcharge
                is shown on your quote; if it is waived this is confirmed in writing.
              </li>
              <li>
                <strong>Floor & access surcharges:</strong> Pricing assumes the floor level and lift access stated at booking.
                If actual conditions differ, surcharges apply: <strong>${FLOOR_LIFT} per floor</strong> above ground with a
                lift, and <strong>${FLOOR_NOLIFT} per floor</strong> above ground without a lift, plus any access-difficulty
                adjustment (long carry, restricted parking).
              </li>
              <li>
                <strong>Special-handling & survey items:</strong> Items that will not fit in a standard lift when intact, or
                that need 3+ movers or special equipment (pianos, safes, large display cabinets, kitchen islands, marble
                tops, etc.) may require an on-site survey. The quoted price for such items is an estimate until confirmed on
                site.
              </li>
              <li>
                <strong>Unprepared items / waiting time:</strong> Time lost because items are not ready, drawers/cabinets are
                not emptied, or access is delayed may be charged as additional on-site time at the overtime rate above.
              </li>
            </ul>
            <p>
              On-site time may be recorded by our crew checking in and out on their app at your address. These recorded times
              form the agreed basis for any time-based charges.
            </p>
          </Section>

          <Section title="5. Deposit & Payment">
            <ul>
              <li>
                For smaller jobs (total under <strong>S${THRESHOLD}</strong>), <strong>full payment</strong> is required to
                confirm your appointment. For larger jobs (<strong>S${THRESHOLD} and above</strong>), a{" "}
                <strong>{DEP_PCT}% deposit</strong> is required to confirm your appointment. Work will not be
                scheduled until the required payment is received.
              </li>
              <li>
                For larger jobs, the remaining <strong>{100 - DEP_PCT}% balance is due upon completion</strong> of all work,
                including any additional charges or surcharges incurred (see Section 4). A payment link is sent to you
                electronically once the job is marked complete. Smaller jobs paid in full upfront have no balance due on
                completion, but additional charges incurred on site remain payable.
              </li>
              <li>
                <strong>Paying your deposit (or full payment for smaller jobs) confirms that you accept your quote</strong> —
                including the included on-site time and crew shown on it — and these Terms.
              </li>
              <li>
                Payments are processed securely via <strong>Stripe</strong> and PayNow. We accept all major credit and debit
                cards. Card details are never stored by TMG Install.
              </li>
              <li>
                Invoices and payment confirmations are sent automatically to the email address provided at booking.
              </li>
            </ul>
          </Section>

          <Section title="6. Cancellation Policy">
            <p>We understand that plans can change. Our cancellation policy is as follows:</p>
            <ul>
              <li>
                <strong>More than 48 hours before the scheduled appointment:</strong>{" "}
                A refund of the deposit will be issued, minus a <strong>$30 administrative fee</strong>. Refunds are processed
                within 5–10 business days to the original payment method.
              </li>
              <li>
                <strong>48 hours or less before the scheduled appointment:</strong>{" "}
                The full deposit is <strong>forfeited</strong>. No refund will be issued.
              </li>
              <li>
                <strong>No-show or failure to provide access:</strong>{" "}
                If our team arrives and is unable to carry out the work due to access issues or your absence, the deposit is
                forfeited and a new booking will require a new deposit.
              </li>
            </ul>
            <p>
              Cancellations must be submitted in writing via email to{" "}
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a> or via WhatsApp at{" "}
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">+65 8088 0757</a>. The date and time of your
              cancellation message will be used to determine which policy applies.
            </p>
          </Section>

          <Section title="7. Rescheduling Policy">
            <ul>
              <li>
                Each booking is entitled to <strong>one complimentary reschedule</strong>, subject to availability.
                Reschedule requests must be made at least <strong>48 hours</strong> before the original appointment.
              </li>
              <li>
                Subsequent reschedule requests, or requests made less than 48 hours before the appointment, may incur a{" "}
                <strong>$30 rescheduling fee</strong>.
              </li>
              <li>
                Rescheduling is subject to availability and cannot be guaranteed. We will do our best to accommodate your
                preferred new date and time.
              </li>
            </ul>
          </Section>

          <Section title="8. Scope of Work & Exclusions">
            <p>
              Our services cover the installation, dismantling, disposal, and relocation of furniture items as specified in
              the confirmed quote. The following are <strong>not</strong> included unless explicitly quoted:
            </p>
            <ul>
              <li>Electrical, gas, or plumbing work of any kind</li>
              <li>Wall drilling, fixing to walls, or mounting of heavy items (e.g. TVs, shelves) unless specified</li>
              <li>Disposal or removal of old or dismantled furniture unless a disposal service is quoted</li>
              <li>Cleaning of the work area beyond a basic tidy-up</li>
              <li>Assembly of flat-pack furniture where the packaging has been opened and parts are missing or damaged</li>
              <li>Dismantling or moving of built-in, fixed, or structural fixtures</li>
            </ul>
          </Section>

          <Section title="9. Customer Responsibilities & Preparation">
            <ul>
              <li>Ensure that a person aged <strong>18 years or above</strong> is present at the service address for the full duration of the appointment.</li>
              <li>Provide clear access to the work area, including carpark, lift, and loading-bay access where applicable, and arrange any building permits, lift bookings, or management approvals required.</li>
              <li>Empty all drawers, cabinets, and shelves, and remove loose glass, mirror, and marble panels before the crew arrives.</li>
              <li>Remove fragile, personal, valuable, or irreplaceable items from the work area prior to the team's arrival, and declare any high-value items at booking.</li>
              <li>Provide accurate information about the items and scope of work. We are not liable for delays or additional costs arising from inaccurate or incomplete information.</li>
              <li>Not require our crew to move hazardous, illegal, perishable, or live items (e.g. chemicals, flammable goods, firearms, plants, animals, or items containing liquids).</li>
            </ul>
          </Section>

          <Section title="10. Fragile, High-Value & Specialty Items">
            <p>
              Glass, marble, mirror, stone, antiques, artwork, and electronics are handled with care but are moved{" "}
              <strong>at the owner's risk</strong> unless additional protection or insurance has been arranged in advance and
              in writing. Please declare high-value items at booking.
            </p>
            <p>
              Items requiring an on-site survey (see Section 4) are quoted as estimates until confirmed on site. We may
              decline to handle any item that we reasonably assess to be unsafe to move, structurally unsound, or beyond the
              capability of the booked crew and equipment.
            </p>
          </Section>

          <Section title="11. Our Team & Subcontractors">
            <p>
              We may carry out work using our own employees and/or vetted subcontractors acting on our behalf. In all cases,
              your contract for the service is with <strong>{COMPANY}</strong>, and these Terms govern that contract
              regardless of who performs the work. Please direct all instructions, requests, and concerns to us rather than to
              individual crew members.
            </p>
          </Section>

          <Section title="12. Liability & Insurance">
            <p>
              Our team takes care to carry out all work professionally and safely. In the unlikely event of damage to your
              property or furniture caused directly by our team's negligence, please notify us within <strong>24 hours</strong>{" "}
              of job completion with photographic evidence.
            </p>
            <p>
              To the fullest extent permitted by law, our total liability for any claim arising out of or in connection with a
              job is <strong>limited to the cost of repair or replacement of the affected item, up to the total value of that
              job</strong>. We are not liable for:
            </p>
            <ul>
              <li>Pre-existing damage, or wear and tear, to items or the property</li>
              <li>Damage arising from furniture that is structurally unsound, worn, previously repaired, or not fit for assembly, disassembly, or transport</li>
              <li>Damage to items not properly emptied, secured, or prepared by the Customer</li>
              <li>Damage to particle-board, flat-pack, or self-assembled furniture that cannot withstand being moved or re-assembled</li>
              <li>Indirect, consequential, incidental, or economic loss of any kind, including loss of use, profit, or data</li>
              <li>Delays or non-performance caused by events beyond our reasonable control (see Section 15)</li>
            </ul>
            <p>
              Nothing in these Terms excludes or limits any liability that cannot be excluded or limited under Singapore law.
            </p>
          </Section>

          <Section title="13. Indemnity">
            <p>
              You agree to indemnify and hold harmless {COMPANY}, its employees, and subcontractors against any claims,
              losses, damages, or expenses arising from your breach of these Terms, your provision of inaccurate information,
              your failure to obtain required building or lift permissions, or the moving of any item you instructed us to
              handle that was unsafe, illegal, or improperly declared.
            </p>
          </Section>

          <Section title="14. Photographs & Condition Record">
            <p>
              Our crew may photograph items at pickup, during work, and on completion. These photographs form the agreed
              record of item condition and of the work performed, and may be used to assess any damage claim. Photographs are
              stored securely and used for operational and quality purposes only.
            </p>
          </Section>

          <Section title="15. Force Majeure">
            <p>
              We are not liable for any failure or delay in performing our obligations caused by events beyond our reasonable
              control, including but not limited to extreme weather, floods, fire, accidents, traffic, government action,
              public health measures, industrial action, or building access restrictions. Where such an event occurs, we will
              work with you to reschedule the affected job at no rescheduling fee.
            </p>
          </Section>

          <Section title="16. Dispute Resolution & Governing Law">
            <p>
              If you are dissatisfied with any aspect of our service, please contact us within <strong>7 days</strong> of job
              completion at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. We will endeavour to resolve all disputes fairly and
              promptly.
            </p>
            <p>
              These Terms are governed by the laws of Singapore. Any disputes that cannot be resolved amicably shall be
              subject to the exclusive jurisdiction of the Singapore courts.
            </p>
          </Section>

          <Section title="17. Data Protection & Privacy">
            <p>
              We collect and use personal data (name, phone number, email address, and service address) solely to manage your
              booking and communicate with you about your job. We do not sell, share, or disclose your personal data to third
              parties except as necessary to provide the service (for example, payment processing via Stripe, or a
              subcontractor assigned to your job).
            </p>
            <p>
              By using our services, you consent to the collection and use of your personal data in accordance with
              Singapore's Personal Data Protection Act (PDPA). You may request access to, correction of, or deletion of your
              personal data by contacting us at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
            </p>
          </Section>

          <Section title="18. Amendments">
            <p>
              We reserve the right to update these Terms at any time. The latest version will always be published at{" "}
              <strong>tmginstall.com/terms</strong>. The Terms that apply to your job are those in effect on the date your
              quote is issued. Continued use of our services constitutes acceptance of the current Terms.
            </p>
          </Section>

          <Section title="19. General">
            <ul>
              <li><strong>Entire agreement:</strong> Your quote together with these Terms forms the entire agreement between you and us for the job, and supersedes any prior discussions.</li>
              <li><strong>Severability:</strong> If any provision of these Terms is found to be unenforceable, the remaining provisions continue in full force.</li>
              <li><strong>No waiver:</strong> Our failure to enforce any provision is not a waiver of our right to enforce it later.</li>
              <li><strong>Assignment:</strong> You may not transfer your booking to another party without our written consent. We may assign or subcontract our obligations as set out in Section 11.</li>
            </ul>
          </Section>

          {/* Contact box */}
          <div className="mt-12 pt-10 border-t border-black/8">
            <p className="text-xs font-bold tracking-[3px] uppercase text-black/30 mb-4">Questions?</p>
            <p className="text-sm text-black/60 mb-4">
              If you have any questions about these Terms, please get in touch:
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <a
                href={`mailto:${EMAIL}`}
                className="flex items-center gap-3 px-4 py-3.5 border border-black/10 hover:border-black/30 hover:bg-black/[0.02] transition-all text-sm font-semibold text-black/70"
              >
                <span className="text-base">✉</span>
                {EMAIL}
              </a>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3.5 border border-black/10 hover:border-black/30 hover:bg-black/[0.02] transition-all text-sm font-semibold text-black/70"
              >
                <span className="text-base">💬</span>
                +65 8088 0757
              </a>
            </div>
          </div>

          {/* Footer notice */}
          <div className="pt-8 border-t border-black/8">
            <p className="text-xs text-black/30 leading-relaxed">
              {COMPANY} &nbsp;·&nbsp; UEN {UEN}<br />
              {ADDRESS}
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-black uppercase tracking-[2px] text-black mb-5 pb-3 border-b border-black/8">
        {title}
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-black/70 [&_strong]:text-black [&_strong]:font-semibold [&_a]:text-black [&_a]:underline [&_a]:underline-offset-2 [&_ul]:space-y-2.5 [&_ul]:list-none [&_ul_li]:pl-5 [&_ul_li]:relative [&_ul_li::before]:content-['—'] [&_ul_li::before]:absolute [&_ul_li::before]:left-0 [&_ul_li::before]:text-black/30 [&_ul_li::before]:font-semibold">
        {children}
      </div>
    </div>
  );
}
