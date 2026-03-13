import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const EFFECTIVE_DATE   = "1 January 2026";
const COMPANY          = "The Moving Guy Pte Ltd";
const UEN              = "202424156H";
const BRAND            = "TMG Install";
const ADDRESS          = "160 Robinson Road, #14-04 SBF Center, Singapore 068914";
const EMAIL            = "sales@tmginstall.com";
const WHATSAPP         = "https://wa.me/6580880757";
const WEBSITE          = "https://tmginstall.com";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white pt-14">
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
            Privacy<br />Policy
          </h1>
          <p className="text-sm text-black/40">
            Effective date: {EFFECTIVE_DATE} &nbsp;·&nbsp; {COMPANY} (UEN {UEN})
          </p>
        </div>

        {/* Body */}
        <div className="space-y-12 text-black/80">

          <Section title="1. Introduction">
            <p>
              {COMPANY} (UEN {UEN}), trading as <strong>{BRAND}</strong> ("we", "us", "our"), is committed to
              protecting the privacy and personal data of our customers and website visitors.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, store, disclose, and protect your personal data
              when you use our website at <strong>{WEBSITE}</strong> or engage our furniture installation,
              dismantling, and relocation services.
            </p>
            <p>
              This Policy is governed by Singapore's <strong>Personal Data Protection Act 2012 (PDPA)</strong>.
              By using our website or services, you consent to the practices described in this Policy.
            </p>
          </Section>

          <Section title="2. What Personal Data We Collect">
            <p>We collect only the personal data necessary to provide our services. This may include:</p>
            <ul>
              <li><strong>Identity data:</strong> Full name</li>
              <li><strong>Contact data:</strong> Email address, mobile phone number</li>
              <li><strong>Address data:</strong> Service address, pickup address, drop-off address</li>
              <li><strong>Booking data:</strong> Preferred appointment date and time, type and quantity of items, service requirements, special instructions</li>
              <li><strong>Payment data:</strong> Payment status and transaction references (we do not store card details — these are handled directly by Stripe)</li>
              <li><strong>Communications data:</strong> Records of email and WhatsApp communications between you and our team</li>
              <li><strong>Usage data:</strong> IP address, browser type, pages visited, and other technical data collected automatically when you use our website</li>
            </ul>
            <p>
              We do not collect sensitive personal data (e.g. race, religion, health, biometrics) and do not
              knowingly collect data from persons under 18 years of age.
            </p>
          </Section>

          <Section title="3. How We Collect Your Data">
            <ul>
              <li><strong>Directly from you</strong> — when you submit an estimate request, complete our booking form, make a payment, or contact us via email or WhatsApp</li>
              <li><strong>Automatically</strong> — when you visit our website, we may collect certain technical data via browser cookies and server logs (see Section 9 on Cookies)</li>
              <li><strong>From third-party services</strong> — payment confirmation data may be received from our payment processor, Stripe</li>
            </ul>
          </Section>

          <Section title="4. How We Use Your Personal Data">
            <p>We use your personal data for the following purposes:</p>
            <ul>
              <li>Processing and managing your booking, including generating quotes, sending invoices, and scheduling appointments</li>
              <li>Communicating with you about your job — appointment confirmations, reminders, status updates, and follow-ups</li>
              <li>Processing deposit and final payments securely via our payment processor</li>
              <li>Assigning our operations team and field technicians to your job</li>
              <li>Resolving disputes, complaints, or claims relating to your booking</li>
              <li>Complying with legal and regulatory obligations, including record-keeping requirements</li>
              <li>Improving our website and services through aggregated, anonymised usage analysis</li>
            </ul>
            <p>
              We will not use your personal data for direct marketing without your explicit consent.
              We do not sell your personal data to any third party.
            </p>
          </Section>

          <Section title="5. Disclosure of Your Personal Data">
            <p>
              We do not sell, rent, or trade your personal data. We only share it with trusted third parties
              where strictly necessary to deliver our services:
            </p>
            <ul>
              <li>
                <strong>Stripe, Inc.</strong> — our payment processor. Stripe processes your card payments
                and may store payment data in accordance with their own{" "}
                <a href="https://stripe.com/en-sg/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                We receive only a payment confirmation — we never see or store your card number, CVV, or full card details.
              </li>
              <li>
                <strong>Resend (Resend Inc.)</strong> — our email delivery provider. Resend handles the
                transmission of transactional emails (booking confirmations, invoices, receipts) on our behalf.
              </li>
              <li>
                <strong>Our operations team</strong> — relevant job details (name, address, appointment time, scope of work)
                are shared internally with the technicians assigned to your job.
              </li>
              <li>
                <strong>Legal and regulatory bodies</strong> — we may disclose your personal data if required by
                law, court order, or government authority, or if we reasonably believe disclosure is necessary
                to protect our rights, your safety, or the safety of others.
              </li>
            </ul>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your personal data only for as long as necessary for the purposes set out in this Policy,
              or as required by law. Specifically:
            </p>
            <ul>
              <li>
                <strong>Booking and job records</strong> — retained for a minimum of <strong>5 years</strong> from
                the date of service completion, for accounting, tax, and legal compliance purposes
              </li>
              <li>
                <strong>Payment records</strong> — retained in accordance with Singapore's accounting and
                tax requirements (typically 5–7 years)
              </li>
              <li>
                <strong>Enquiries that did not result in a booking</strong> — retained for up to 12 months,
                after which they are securely deleted
              </li>
            </ul>
            <p>
              When personal data is no longer required, we will securely delete or anonymise it.
            </p>
          </Section>

          <Section title="7. Your Rights Under the PDPA">
            <p>
              Under Singapore's Personal Data Protection Act, you have the following rights regarding your personal data:
            </p>
            <ul>
              <li>
                <strong>Right of access</strong> — you may request a copy of the personal data we hold about you
              </li>
              <li>
                <strong>Right of correction</strong> — you may request that we correct any inaccurate or incomplete
                personal data we hold about you
              </li>
              <li>
                <strong>Right to withdraw consent</strong> — where our processing is based on consent, you may
                withdraw it at any time. This will not affect the legality of processing carried out before your withdrawal.
                Note that withdrawing consent may prevent us from fulfilling a booking.
              </li>
              <li>
                <strong>Right to data portability</strong> — in certain circumstances, you may request that
                we provide your data in a structured, machine-readable format
              </li>
            </ul>
            <p>
              To exercise any of these rights, please contact our Data Protection Officer at{" "}
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. We will respond within <strong>30 days</strong>.
              We may require you to verify your identity before processing a request.
            </p>
          </Section>

          <Section title="8. Data Security">
            <p>
              We implement appropriate technical and organisational measures to protect your personal data
              against unauthorised access, disclosure, alteration, or destruction. These include:
            </p>
            <ul>
              <li>HTTPS encryption for all data transmitted through our website</li>
              <li>Access controls limiting personal data to authorised staff with a legitimate need</li>
              <li>Secure third-party payment processing (we never handle or store raw card data)</li>
              <li>Session-based authentication for our internal operations portal</li>
            </ul>
            <p>
              Despite our precautions, no system is completely secure. In the event of a data breach that
              is likely to result in significant harm to affected individuals, we will notify the Personal
              Data Protection Commission (PDPC) and affected individuals as required under the PDPA.
            </p>
          </Section>

          <Section title="9. Cookies and Tracking">
            <p>
              Our website uses cookies — small text files stored on your device — to support core functionality
              (such as maintaining your session during the booking process) and to understand how visitors
              use our website.
            </p>
            <ul>
              <li>
                <strong>Essential cookies</strong> — required for the website to function correctly
                (e.g. session management). These cannot be disabled.
              </li>
              <li>
                <strong>Analytics cookies</strong> — used to understand site usage in aggregate, anonymised form.
                No personally identifiable information is collected via analytics.
              </li>
            </ul>
            <p>
              You may disable non-essential cookies through your browser settings. This may affect
              some website functionality but will not prevent you from using our services.
            </p>
          </Section>

          <Section title="10. Third-Party Links">
            <p>
              Our website may contain links to third-party websites (e.g. WhatsApp, Stripe). This Policy applies
              only to {BRAND}. We are not responsible for the privacy practices of third-party sites and
              encourage you to review their respective policies before submitting any personal data to them.
            </p>
          </Section>

          <Section title="11. Children's Privacy">
            <p>
              Our services are intended for adults aged 18 and above. We do not knowingly collect personal data
              from anyone under the age of 18. If you believe a minor has provided us with personal data,
              please contact us immediately and we will take steps to delete it.
            </p>
          </Section>

          <Section title="12. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              technology, or legal requirements. The latest version will always be published at{" "}
              <strong>{WEBSITE}/privacy</strong> with an updated effective date. We encourage you to review
              this page periodically.
            </p>
            <p>
              Continued use of our website or services after a change is posted constitutes your acceptance
              of the updated Policy.
            </p>
          </Section>

          <Section title="13. Governing Law">
            <p>
              This Privacy Policy is governed by the laws of Singapore. Any disputes arising in connection
              with this Policy shall be subject to the exclusive jurisdiction of the Singapore courts.
            </p>
          </Section>

          {/* Contact */}
          <div className="mt-12 pt-10 border-t border-black/8">
            <p className="text-xs font-bold tracking-[3px] uppercase text-black/30 mb-4">Data Protection Enquiries</p>
            <p className="text-sm text-black/60 mb-4">
              For any questions about this Privacy Policy or to exercise your data rights, contact us:
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
      <div className="space-y-4 text-[15px] leading-relaxed text-black/70 [&_strong]:text-black [&_strong]:font-semibold [&_a]:text-black [&_a]:underline [&_a]:underline-offset-2 [&_ul]:space-y-2.5 [&_ul]:list-none [&_ul]:pl-0 [&_ul_li]:pl-5 [&_ul_li]:relative [&_ul_li::before]:content-['—'] [&_ul_li::before]:absolute [&_ul_li::before]:left-0 [&_ul_li::before]:text-black/30 [&_ul_li::before]:font-semibold">
        {children}
      </div>
    </div>
  );
}
