import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePromoBar } from "@/hooks/use-promo-bar";

const EFFECTIVE_DATE = "1 January 2026";
const COMPANY = "The Moving Guy Pte Ltd";
const UEN = "202424156H";
const ADDRESS = "160 Robinson Road, #14-04 SBF Center, Singapore 068914";
const EMAIL = "sales@tmginstall.com";
const WHATSAPP = "https://wa.me/6580880757?text=hi";

export default function Terms() {
  const { visible: promoVisible } = usePromoBar();
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

          <Section title="1. Overview">
            <p>
              These Terms and Conditions ("Terms") govern the use of services provided by <strong>{COMPANY}</strong> (UEN {UEN}),
              trading as <strong>TMG Install</strong> ("we", "us", "our"). By requesting a quote, making a payment, or
              engaging our services, you ("Customer", "you") agree to be bound by these Terms.
            </p>
            <p>
              Our services include furniture installation, dismantling, and relocation across Singapore. All jobs are
              arranged through our online quoting platform at <strong>tmginstall.com</strong>.
            </p>
          </Section>

          <Section title="2. Quotes and Pricing">
            <p>
              All prices are quoted in Singapore Dollars (SGD) and are inclusive of GST where applicable.
              Quotes are generated based on the information provided by the Customer and are subject to revision
              if the scope of work differs materially from what was described.
            </p>
            <p>
              We reserve the right to adjust pricing if, upon arrival at the site, the work required is found to
              be significantly different from the submitted estimate. Any such adjustments will be communicated
              and agreed upon with the Customer before work proceeds.
            </p>
          </Section>

          <Section title="3. Deposit and Payment">
            <ul>
              <li>
                A <strong>50% non-refundable deposit</strong> is required to confirm your appointment.
                Work will not be scheduled until the deposit is received.
              </li>
              <li>
                The remaining <strong>50% balance is due upon completion</strong> of all work at the site.
                A payment link will be sent to you electronically once the job is marked complete.
              </li>
              <li>
                Payments are processed securely via <strong>Stripe</strong>. We accept all major credit and debit cards.
                Card details are never stored by TMG Install.
              </li>
              <li>
                Invoices and payment confirmations are sent automatically to the email address provided at booking.
              </li>
            </ul>
          </Section>

          <Section title="4. Cancellation Policy">
            <p>
              We understand that plans can change. Our cancellation policy is as follows:
            </p>
            <ul>
              <li>
                <strong>Cancellation more than 48 hours before the scheduled appointment:</strong>{" "}
                A refund of the deposit will be issued, minus a <strong>$30 administrative fee</strong>.
                Refunds are processed within 5–10 business days to the original payment method.
              </li>
              <li>
                <strong>Cancellation less than 48 hours before the scheduled appointment:</strong>{" "}
                The full deposit is <strong>forfeited</strong>. No refund will be issued.
              </li>
              <li>
                <strong>No-show or failure to provide access:</strong>{" "}
                If our team arrives at the site and is unable to carry out the work due to access issues
                or the Customer's absence, the deposit is forfeited and a new booking will require a new deposit.
              </li>
            </ul>
            <p>
              Cancellations must be submitted in writing via email to{" "}
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a> or via WhatsApp at{" "}
              <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">+65 8088 0757</a>.
              The date and time of your cancellation message will be used to determine which policy applies.
            </p>
          </Section>

          <Section title="5. Rescheduling Policy">
            <ul>
              <li>
                Each booking is entitled to <strong>one complimentary reschedule</strong>, subject to availability.
                Reschedule requests must be made at least <strong>48 hours</strong> before the original appointment.
              </li>
              <li>
                Subsequent reschedule requests, or requests made less than 48 hours before the appointment,
                may incur a <strong>$30 rescheduling fee</strong>.
              </li>
              <li>
                Rescheduling is subject to availability and cannot be guaranteed. We will do our best to
                accommodate your preferred new date and time.
              </li>
            </ul>
          </Section>

          <Section title="6. Scope of Work and Exclusions">
            <p>
              Our services cover the installation, dismantling, and relocation of furniture items as specified
              in the confirmed quote. The following are not included unless explicitly quoted:
            </p>
            <ul>
              <li>Electrical or plumbing work of any kind</li>
              <li>Wall drilling, fixing to walls, or mounting of heavy items (e.g. TVs, shelves) unless specified</li>
              <li>Disposal or removal of old or dismantled furniture</li>
              <li>Cleaning of the work area beyond basic tidy-up</li>
              <li>Assembly of flat-pack furniture where the packaging has been opened and parts are missing or damaged</li>
            </ul>
          </Section>

          <Section title="7. Customer Responsibilities">
            <ul>
              <li>Ensure that a person aged <strong>18 years or above</strong> is present at the service address for the full duration of the appointment.</li>
              <li>Provide clear access to the work area including carpark access, lift access, and loading bay access where applicable.</li>
              <li>Remove fragile, personal, or irreplaceable items from the work area prior to the team's arrival.</li>
              <li>Provide accurate information about the items and scope of work in the estimate. We are not liable for delays or additional costs arising from inaccurate information.</li>
            </ul>
          </Section>

          <Section title="8. Liability">
            <p>
              Our team takes care to carry out all work professionally and safely. In the unlikely event of damage
              to your property or furniture caused directly by our team's negligence, please notify us within
              <strong> 24 hours</strong> of job completion with photographic evidence.
            </p>
            <p>
              Our liability is limited to the cost of repair or replacement of the damaged item, up to the
              total value of the job. We are not liable for:
            </p>
            <ul>
              <li>Pre-existing damage to items or the property</li>
              <li>Damage arising from furniture that is structurally unsound, worn, or not fit for assembly</li>
              <li>Indirect, consequential, or economic loss of any kind</li>
            </ul>
          </Section>

          <Section title="9. Dispute Resolution">
            <p>
              If you are dissatisfied with any aspect of our service, please contact us within <strong>7 days</strong> of
              job completion at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. We will endeavour to resolve all disputes
              fairly and promptly.
            </p>
            <p>
              These Terms are governed by the laws of Singapore. Any disputes that cannot be resolved amicably
              shall be subject to the exclusive jurisdiction of the Singapore courts.
            </p>
          </Section>

          <Section title="10. Privacy">
            <p>
              We collect and use personal data (name, phone number, email address, service address) solely for
              the purpose of managing your booking and communicating with you about your job.
              We do not sell, share, or disclose your personal data to third parties except as necessary
              to provide the service (e.g. payment processing via Stripe).
            </p>
            <p>
              By using our services, you consent to the collection and use of your personal data in accordance
              with Singapore's Personal Data Protection Act (PDPA).
            </p>
          </Section>

          <Section title="11. Amendments">
            <p>
              We reserve the right to update these Terms at any time. The latest version will always be published
              at <strong>tmginstall.com/terms</strong>. Continued use of our services constitutes acceptance
              of the current Terms.
            </p>
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
