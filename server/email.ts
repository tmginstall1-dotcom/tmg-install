const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@tmginstall.com";
const WHATSAPP_NUMBER = "+6580880757";
const WHATSAPP_LINK = "https://wa.me/6580880757";
const SALES_EMAIL = "sales@tmginstall.com";
const ADMIN_EMAIL = "sales@tmginstall.com";
const WEBSITE = "https://tmginstall.com";
const TERMS_URL = "https://tmginstall.com/terms";
const UEN = "202424156H";
const ADDRESS = "160 Robinson Road, #14-04 SBF Center, Singapore 068914";

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured. Email not sent to", to);
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      console.error("Failed to send email:", await response.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error sending email:", err);
    return false;
  }
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  black:      "#0a0a0a",
  white:      "#ffffff",
  offWhite:   "#f8f8f8",
  border:     "#e5e5e5",
  mutedText:  "#6b6b6b",
  green:      "#15803d",
  greenBg:    "#f0fdf4",
  greenBorder:"#bbf7d0",
  amber:      "#92400e",
  amberBg:    "#fffbeb",
  amberBorder:"#fde68a",
  red:        "#b91c1c",
  redBg:      "#fef2f2",
  redBorder:  "#fecaca",
  blue:       "#1d4ed8",
  blueBg:     "#eff6ff",
  blueBorder: "#bfdbfe",
};

// ─── Shared CSS ───────────────────────────────────────────────────────────────
const emailStyles = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: ${C.black}; margin: 0; padding: 0; background: ${C.offWhite}; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 600px; margin: 0 auto; padding: 24px 16px; }
  .card { background: ${C.white}; border: 1px solid ${C.border}; border-radius: 4px; overflow: hidden; }
  .header { background: ${C.black}; color: ${C.white}; padding: 36px 32px 32px; text-align: center; }
  .logo { font-size: 26px; font-weight: 900; letter-spacing: 6px; color: ${C.white}; text-transform: uppercase; margin: 0 0 4px; font-family: 'Arial Black', Arial, sans-serif; }
  .logo-sub { font-size: 11px; color: rgba(255,255,255,0.4); letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 20px; }
  .phase-badge { display: inline-block; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 5px 16px; border-radius: 2px; margin-bottom: 12px; }
  .header-title { font-size: 22px; font-weight: 800; color: ${C.white}; margin: 0 0 6px; letter-spacing: 0.5px; }
  .header-sub { font-size: 13px; color: rgba(255,255,255,0.55); margin: 0; }
  .body { padding: 32px; }
  .ref-row { display: flex; align-items: center; gap: 12px; background: ${C.offWhite}; border: 1px solid ${C.border}; border-radius: 4px; padding: 12px 16px; margin-bottom: 24px; }
  .ref-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${C.mutedText}; }
  .ref-value { font-size: 16px; font-weight: 800; letter-spacing: 2px; color: ${C.black}; font-family: 'Courier New', monospace; }
  .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: ${C.mutedText}; margin: 24px 0 10px; border-bottom: 1px solid ${C.border}; padding-bottom: 6px; }
  .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  .info-grid td { padding: 5px 0; font-size: 14px; vertical-align: top; }
  .info-grid td:first-child { color: ${C.mutedText}; width: 38%; }
  .info-grid td:last-child { font-weight: 600; color: ${C.black}; }
  .items-table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 4px 0 8px; }
  .items-table th { background: ${C.black}; color: ${C.white}; padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .items-table th:last-child { text-align: right; }
  .items-table td { padding: 9px 10px; border-bottom: 1px solid ${C.border}; vertical-align: middle; color: ${C.black}; }
  .items-table td:last-child { text-align: right; font-weight: 700; }
  .items-table tr:last-child td { border-bottom: none; }
  .items-table .svc-tag { display: inline-block; background: ${C.offWhite}; border: 1px solid ${C.border}; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 1px 6px; border-radius: 2px; color: ${C.mutedText}; }
  .totals-box { border: 1px solid ${C.border}; border-radius: 4px; overflow: hidden; margin: 4px 0; }
  .totals-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 16px; font-size: 14px; border-bottom: 1px solid ${C.border}; }
  .totals-row:last-child { border-bottom: none; }
  .totals-row.grand { background: ${C.black}; color: ${C.white}; font-size: 16px; font-weight: 800; }
  .totals-row.deposit { background: ${C.greenBg}; color: ${C.green}; font-weight: 700; }
  .totals-row.balance { color: ${C.mutedText}; font-size: 13px; }
  .cta-block { text-align: center; margin: 28px 0; padding: 28px 24px; border: 1px solid ${C.border}; border-radius: 4px; background: ${C.offWhite}; }
  .cta-amount-label { font-size: 12px; color: ${C.mutedText}; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px; }
  .cta-amount { font-size: 36px; font-weight: 900; color: ${C.black}; margin: 0 0 20px; letter-spacing: -1px; font-family: 'Arial Black', Arial, sans-serif; }
  .btn { display: inline-block; background: ${C.black}; color: ${C.white} !important; padding: 14px 36px; border-radius: 2px; text-decoration: none; font-weight: 800; font-size: 14px; letter-spacing: 1.5px; text-transform: uppercase; }
  .btn-green { background: ${C.green}; }
  .btn-amber { background: #b45309; }
  .notice { border-radius: 4px; padding: 14px 16px; font-size: 13px; line-height: 1.6; margin: 16px 0; }
  .notice.info { background: ${C.blueBg}; border-left: 3px solid ${C.blue}; color: #1e3a5f; }
  .notice.success { background: ${C.greenBg}; border-left: 3px solid ${C.green}; color: #14532d; }
  .notice.warning { background: ${C.amberBg}; border-left: 3px solid #f59e0b; color: ${C.amber}; }
  .notice.danger { background: ${C.redBg}; border-left: 3px solid #ef4444; color: ${C.red}; }
  .checklist { margin: 0; padding: 0; list-style: none; }
  .checklist li { padding: 5px 0 5px 22px; font-size: 13px; color: ${C.black}; position: relative; border-bottom: 1px solid ${C.border}; }
  .checklist li:last-child { border-bottom: none; }
  .checklist li::before { content: "✓"; position: absolute; left: 0; color: ${C.green}; font-weight: 700; }
  .date-card { background: ${C.black}; color: ${C.white}; border-radius: 4px; padding: 20px 24px; margin: 4px 0; }
  .date-card .dc-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.45); margin-bottom: 4px; }
  .date-card .dc-value { font-size: 18px; font-weight: 800; color: ${C.white}; }
  .date-card .dc-time { font-size: 14px; color: rgba(255,255,255,0.65); margin-top: 2px; }
  .contact-strip { display: flex; gap: 12px; margin: 20px 0; }
  .contact-item { flex: 1; background: ${C.offWhite}; border: 1px solid ${C.border}; border-radius: 4px; padding: 12px; text-align: center; text-decoration: none; }
  .contact-item .ci-icon { font-size: 18px; display: block; margin-bottom: 4px; }
  .contact-item .ci-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${C.mutedText}; display: block; margin-bottom: 2px; }
  .contact-item .ci-value { font-size: 13px; font-weight: 700; color: ${C.black}; display: block; }
  .footer { padding: 24px 32px; border-top: 1px solid ${C.border}; text-align: center; }
  .footer p { font-size: 11px; color: ${C.mutedText}; margin: 3px 0; line-height: 1.6; }
  .footer a { color: ${C.mutedText}; text-decoration: underline; }
  .divider { height: 1px; background: ${C.border}; margin: 20px 0; }
  .step-track { display: flex; justify-content: center; gap: 6px; margin: 16px 0 0; }
  .step-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.25); }
  .step-dot.active { background: ${C.white}; width: 20px; border-radius: 3px; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildItemsTable(items: any[]): string {
  if (!items || items.length === 0) return `<p style="font-size:13px;color:${C.mutedText};margin:8px 0;">No items recorded.</p>`;
  const rows = items.map(item => `
    <tr>
      <td>
        <strong style="font-size:13px;">${item.detectedName || item.originalDescription}</strong>
        <br><span class="svc-tag">${item.serviceType}</span>
      </td>
      <td style="text-align:center;font-size:13px;color:${C.mutedText};">×${item.quantity}</td>
      <td style="text-align:right;font-size:13px;color:${C.mutedText};">$${Number(item.unitPrice).toFixed(2)}</td>
      <td>$${Number(item.subtotal).toFixed(2)}</td>
    </tr>
  `).join('');
  return `
    <table class="items-table">
      <thead><tr>
        <th>Item</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Price</th>
        <th style="text-align:right;">Subtotal</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildTotalsBox(subtotal: any, transportFee: any, total: any, depositAmount: any, finalAmount: any): string {
  const hasTransport = Number(transportFee || 0) > 0;
  return `
    <div class="totals-box">
      <div class="totals-row"><span>Labour subtotal</span><span>$${Number(subtotal || 0).toFixed(2)}</span></div>
      ${hasTransport ? `<div class="totals-row"><span>Logistics / transport</span><span>$${Number(transportFee || 0).toFixed(2)}</span></div>` : ''}
      <div class="totals-row grand"><span>Grand Total</span><span>$${Number(total || 0).toFixed(2)}</span></div>
      <div class="totals-row deposit"><span>✓ Deposit (50%)</span><span>$${Number(depositAmount || 0).toFixed(2)}</span></div>
      <div class="totals-row balance"><span>Balance due on completion (50%)</span><span>$${Number(finalAmount || 0).toFixed(2)}</span></div>
    </div>
  `;
}

function buildAddressRows(quote: any): string {
  const services = Array.isArray(quote.selectedServices) ? quote.selectedServices : (quote.selectedServices ? JSON.parse(quote.selectedServices as string) : []);
  const isRelocation = services.includes('relocate') || quote.pickupAddress;
  if (isRelocation && quote.pickupAddress && quote.dropoffAddress) {
    return `
      <tr><td>Pickup address</td><td>${quote.pickupAddress}</td></tr>
      <tr><td>Drop-off address</td><td>${quote.dropoffAddress}</td></tr>
    `;
  }
  return `<tr><td>Service address</td><td>${quote.serviceAddress}</td></tr>`;
}

function buildContactStrip(): string {
  return `
    <div class="contact-strip">
      <a href="mailto:${SALES_EMAIL}" class="contact-item" style="text-decoration:none;">
        <span class="ci-icon">✉️</span>
        <span class="ci-label">Email</span>
        <span class="ci-value">${SALES_EMAIL}</span>
      </a>
      <a href="${WHATSAPP_LINK}" class="contact-item" style="text-decoration:none;">
        <span class="ci-icon">💬</span>
        <span class="ci-label">WhatsApp</span>
        <span class="ci-value">${WHATSAPP_NUMBER}</span>
      </a>
    </div>
  `;
}

function buildFooter(): string {
  return `
    <div class="footer">
      <p><strong>TMG Install / The Moving Guy Pte Ltd</strong> &nbsp;·&nbsp; UEN ${UEN}</p>
      <p>${ADDRESS}</p>
      <p style="margin-top:8px;">
        <a href="${WEBSITE}">tmginstall.com</a>
        &nbsp;·&nbsp;
        <a href="${TERMS_URL}">Terms &amp; Conditions</a>
        &nbsp;·&nbsp;
        <a href="mailto:${SALES_EMAIL}">Contact Us</a>
      </p>
      <p style="margin-top:8px;font-size:10px;color:#aaa;">© 2026 The Moving Guy Pte Ltd. All rights reserved.</p>
    </div>
  `;
}

function buildRefRow(referenceNo: string): string {
  return `
    <div class="ref-row">
      <div>
        <div class="ref-label">Reference No.</div>
        <div class="ref-value">${referenceNo}</div>
      </div>
    </div>
  `;
}

function buildStepDots(active: number, total: number): string {
  return `<div class="step-track">${Array.from({ length: total }, (_, i) =>
    `<div class="step-dot${i + 1 === active ? ' active' : ''}"></div>`
  ).join('')}</div>`;
}

function buildEmailShell(headerContent: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <style>${emailStyles}</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="header">
        <div class="logo">TMG INSTALL</div>
        <div class="logo-sub">The Moving Guy Pte Ltd · Singapore</div>
        ${headerContent}
      </div>
      <div class="body">
        ${bodyContent}
      </div>
      ${buildFooter()}
    </div>
  </div>
</body>
</html>`;
}

// ─── Customer-facing emails ───────────────────────────────────────────────────

// 1. Estimate submitted confirmation (for customer)
export function estimateSubmittedEmail(quote: any): string {
  const customer = quote.customer;
  const header = `
    ${buildStepDots(1, 5)}
    <div class="phase-badge">Step 1 of 5 · Quote Received</div>
    <div class="header-title">We've Received Your Estimate</div>
    <div class="header-sub">Our team will review and respond within 1 business day</div>
  `;
  const body = `
    <p style="font-size:15px;margin:0 0 8px;">Hi <strong>${customer?.name}</strong>,</p>
    <p style="font-size:14px;color:${C.mutedText};margin:0 0 20px;">Thank you for submitting your furniture installation estimate. We've received all the details and our team is reviewing your request.</p>

    ${buildRefRow(quote.referenceNo)}

    <div class="section-label">Your Details</div>
    <table class="info-grid">
      <tr><td>Name</td><td>${customer?.name}</td></tr>
      <tr><td>Email</td><td>${customer?.email}</td></tr>
      <tr><td>Phone</td><td>${customer?.phone}</td></tr>
      ${buildAddressRows(quote)}
    </table>

    <div class="section-label">Requested Items</div>
    ${buildItemsTable(quote.items)}

    <div class="section-label">Estimated Pricing</div>
    ${buildTotalsBox(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount)}

    <div class="notice info" style="margin-top:20px;">
      <strong>What happens next?</strong><br>
      Our team will review your quote, verify pricing, and send you a deposit request within 1 business day. Once you pay the 50% deposit, your slot is confirmed.
    </div>

    ${buildContactStrip()}

    <p style="font-size:12px;color:${C.mutedText};text-align:center;margin-top:8px;">
      By proceeding, you agree to our <a href="${TERMS_URL}" style="color:${C.black};">Terms &amp; Conditions</a>.
      The 50% deposit is non-refundable once paid.
    </p>
  `;
  return buildEmailShell(header, body);
}

// 2. Deposit request email — customer pays 50% to confirm slot
export function depositRequestEmail(quote: any, paymentLink: string): string {
  const customer = quote.customer;
  const slotDate = quote.preferredDate
    ? new Date(quote.preferredDate + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;
  const header = `
    ${buildStepDots(2, 5)}
    <div class="phase-badge">Step 2 of 5 · Quote Approved</div>
    <div class="header-title">Deposit Payment Required</div>
    <div class="header-sub">Pay to lock in your appointment slot</div>
  `;
  const body = `
    <p style="font-size:15px;margin:0 0 8px;">Hi <strong>${customer?.name}</strong>,</p>
    <p style="font-size:14px;color:${C.mutedText};margin:0 0 20px;">Your estimate has been reviewed and approved. Pay the 50% deposit below to confirm your appointment slot and proceed with the booking.</p>

    ${buildRefRow(quote.referenceNo)}

    ${slotDate ? `
    <div class="section-label">Your Reserved Slot</div>
    <div class="date-card">
      <div class="dc-label">Appointment</div>
      <div class="dc-value">${slotDate}</div>
      <div class="dc-time">⏱ ${quote.preferredTimeWindow}</div>
    </div>
    <div class="notice warning" style="margin-top:8px;margin-bottom:0;">
      ⏳ <strong>This slot is held for 48 hours.</strong> Pay before it expires to guarantee your preferred date.
    </div>` : ''}

    <div class="section-label">Service Details</div>
    <table class="info-grid">
      <tr><td>Customer</td><td>${customer?.name}</td></tr>
      <tr><td>Phone</td><td>${customer?.phone}</td></tr>
      ${buildAddressRows(quote)}
    </table>

    <div class="section-label">Itemised Scope of Work</div>
    ${buildItemsTable(quote.items)}

    <div class="section-label">Payment Breakdown</div>
    ${buildTotalsBox(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount)}

    <div class="cta-block">
      <div class="cta-amount-label">Deposit due now (50%)</div>
      <div class="cta-amount">$${Number(quote.depositAmount || 0).toFixed(2)}</div>
      <a href="${paymentLink}" class="btn">Pay Deposit Now →</a>
      <p style="font-size:11px;color:${C.mutedText};margin:14px 0 0;">Secure payment via Stripe. Card details are never stored.</p>
    </div>

    <div class="notice warning">
      <strong>Cancellation Policy</strong><br>
      · Cancellation more than 48 hours before appointment: refund of deposit minus $30 admin fee<br>
      · Cancellation less than 48 hours before appointment: deposit is forfeited<br>
      · The 50% deposit is non-refundable in all other circumstances<br>
      Full terms at <a href="${TERMS_URL}" style="color:${C.amber};">${TERMS_URL}</a>
    </div>

    ${buildContactStrip()}

    <p style="font-size:12px;color:${C.mutedText};text-align:center;">
      By paying, you agree to our <a href="${TERMS_URL}" style="color:${C.black};">Terms &amp; Conditions</a>.
    </p>
  `;
  return buildEmailShell(header, body);
}

// 3. Deposit received — booking confirmed
export function depositReceivedEmail(quote: any): string {
  const customer = quote.customer;
  const slotDate = quote.preferredDate
    ? new Date(quote.preferredDate + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;
  const header = `
    ${buildStepDots(3, 5)}
    <div class="phase-badge">Step 3 of 5 · Booking Confirmed</div>
    <div class="header-title">Deposit Received — You're Booked!</div>
    <div class="header-sub">Your appointment slot is now confirmed</div>
  `;
  const body = `
    <p style="font-size:15px;margin:0 0 8px;">Hi <strong>${customer?.name}</strong>,</p>
    <p style="font-size:14px;color:${C.mutedText};margin:0 0 20px;">We've received your deposit payment — thank you! Your booking is now locked in and our team has been notified.</p>

    ${buildRefRow(quote.referenceNo)}

    ${slotDate ? `
    <div class="section-label">Confirmed Appointment Slot</div>
    <div class="date-card">
      <div class="dc-label">Your Appointment</div>
      <div class="dc-value">${slotDate}</div>
      <div class="dc-time">⏱ ${quote.preferredTimeWindow}</div>
    </div>` : ''}

    <div class="section-label">Payment Status</div>
    <div class="totals-box">
      <div class="totals-row deposit"><span>✓ Deposit paid (50%)</span><span>$${Number(quote.depositAmount || 0).toFixed(2)}</span></div>
      <div class="totals-row balance"><span>Balance due on completion</span><span>$${Number(quote.finalAmount || 0).toFixed(2)}</span></div>
      <div class="totals-row grand"><span>Grand Total</span><span>$${Number(quote.total || 0).toFixed(2)}</span></div>
    </div>

    <div class="section-label">What to Prepare</div>
    <ul class="checklist">
      <li>Ensure clear access to all items and the service area</li>
      <li>Have photos or assembly manuals ready if available</li>
      <li>Make sure someone (18+) is present at the address</li>
      <li>Remove fragile or personal items from the work area beforehand</li>
      <li>Note down any special instructions and WhatsApp us in advance</li>
    </ul>

    <div class="notice info" style="margin-top:16px;">
      <strong>Next Step:</strong> Our team will confirm your exact schedule and assign a technician. You'll receive another email once your appointment is formally confirmed with a date and time.
    </div>

    ${buildContactStrip()}

    <p style="font-size:12px;color:${C.mutedText};text-align:center;">
      Need to reschedule? Contact us at least 48 hours before your appointment.
      See our <a href="${TERMS_URL}" style="color:${C.black};">Terms &amp; Conditions</a> for the rescheduling policy.
    </p>
  `;
  return buildEmailShell(header, body);
}

// 4. Admin notification — new booking request
export function bookingRequestAdminEmail(quote: any): string {
  const customer = quote.customer;
  const services = Array.isArray(quote.selectedServices) ? quote.selectedServices : (quote.selectedServices ? JSON.parse(quote.selectedServices as string) : []);
  const scheduledDate = quote.scheduledAt ? new Date(quote.scheduledAt).toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "TBD";
  const adminUrl = `${WEBSITE}/admin/quotes/${quote.id}`;
  const header = `
    <div class="phase-badge">Admin Alert · New Booking Request</div>
    <div class="header-title">Booking Request Received</div>
    <div class="header-sub">Customer has selected a slot — please confirm in the admin portal</div>
  `;
  const body = `
    <div class="notice info">
      📅 <strong>${customer?.name}</strong> has submitted a booking request and selected their preferred appointment slot. Please log in to the admin portal to review and confirm.
    </div>

    ${buildRefRow(quote.referenceNo)}

    <div class="section-label">Customer</div>
    <table class="info-grid">
      <tr><td>Name</td><td><strong>${customer?.name}</strong></td></tr>
      <tr><td>Phone</td><td><a href="tel:${customer?.phone}" style="color:${C.black};">${customer?.phone}</a></td></tr>
      <tr><td>Email</td><td><a href="mailto:${customer?.email}" style="color:${C.black};">${customer?.email}</a></td></tr>
    </table>

    <div class="section-label">Requested Appointment</div>
    <div class="date-card">
      <div class="dc-label">Requested Slot</div>
      <div class="dc-value">${scheduledDate}</div>
      <div class="dc-time">⏱ ${quote.timeWindow || 'TBD'}</div>
    </div>

    <div class="section-label">Service Location</div>
    <table class="info-grid">
      ${buildAddressRows(quote)}
      ${services.length ? `<tr><td>Services</td><td>${services.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}</td></tr>` : ''}
    </table>

    <div class="section-label">Scope of Work</div>
    ${buildItemsTable(quote.items)}

    <div class="section-label">Financial Summary</div>
    ${buildTotalsBox(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount)}

    <div style="text-align:center;margin:28px 0;">
      <a href="${adminUrl}" class="btn">Review &amp; Confirm in Admin Portal →</a>
    </div>
  `;
  return buildEmailShell(header, body);
}

// 5. Booking confirmation — admin confirmed the slot
export function bookingConfirmationEmail(quote: any): string {
  const customer = quote.customer;
  const scheduledDate = quote.scheduledAt
    ? new Date(quote.scheduledAt).toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "TBD";
  const header = `
    ${buildStepDots(3, 5)}
    <div class="phase-badge">Step 3 of 5 · Appointment Confirmed</div>
    <div class="header-title">Your Appointment is Confirmed</div>
    <div class="header-sub">Everything is set — here's what you need to know</div>
  `;
  const body = `
    <p style="font-size:15px;margin:0 0 8px;">Hi <strong>${customer?.name}</strong>,</p>
    <p style="font-size:14px;color:${C.mutedText};margin:0 0 20px;">Your appointment has been confirmed by our team. A trained technician has been assigned to your job. Please review the details below.</p>

    ${buildRefRow(quote.referenceNo)}

    <div class="section-label">Confirmed Appointment</div>
    <div class="date-card">
      <div class="dc-label">Date &amp; Time</div>
      <div class="dc-value">${scheduledDate}</div>
      <div class="dc-time">⏱ ${quote.timeWindow || 'TBD'}</div>
    </div>

    <div class="section-label">Service Address</div>
    <table class="info-grid">
      ${buildAddressRows(quote)}
    </table>

    <div class="section-label">Scope of Work</div>
    ${buildItemsTable(quote.items)}

    <div class="section-label">Payment Status</div>
    <div class="totals-box">
      <div class="totals-row deposit"><span>✓ Deposit paid (50%)</span><span>$${Number(quote.depositAmount || 0).toFixed(2)}</span></div>
      <div class="totals-row balance"><span>Balance due on completion</span><span>$${Number(quote.finalAmount || 0).toFixed(2)}</span></div>
      <div class="totals-row grand"><span>Grand Total</span><span>$${Number(quote.total || 0).toFixed(2)}</span></div>
    </div>

    <div class="section-label">Day-of Checklist</div>
    <ul class="checklist">
      <li>Ensure someone (18+) is available at the address during the time window</li>
      <li>Keep the work area clear of personal belongings</li>
      <li>Have access to power outlets if required for power tools</li>
      <li>Prepare any assembly manuals or reference photos for the technician</li>
      <li>The balance of <strong>$${Number(quote.finalAmount || 0).toFixed(2)}</strong> is due upon completion of work</li>
    </ul>

    <div class="notice warning">
      <strong>Reschedule Policy:</strong> If you need to change the appointment, please contact us on WhatsApp at least <strong>48 hours</strong> before the scheduled time. Late reschedules may be subject to a fee.
      See <a href="${TERMS_URL}" style="color:${C.amber};">Terms &amp; Conditions</a> for details.
    </div>

    ${buildContactStrip()}
  `;
  return buildEmailShell(header, body);
}

// 6. Reschedule confirmation
export function rescheduleConfirmationEmail(quote: any): string {
  const customer = quote.customer;
  const scheduledDate = quote.scheduledAt
    ? new Date(quote.scheduledAt).toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "TBD";
  const header = `
    <div class="phase-badge">Reschedule · Pending Confirmation</div>
    <div class="header-title">Reschedule Request Received</div>
    <div class="header-sub">We'll confirm your new slot shortly</div>
  `;
  const body = `
    <p style="font-size:15px;margin:0 0 8px;">Hi <strong>${customer?.name}</strong>,</p>
    <p style="font-size:14px;color:${C.mutedText};margin:0 0 20px;">We've received your request to reschedule. Your new slot is pending confirmation from our team — you'll receive a confirmation email shortly.</p>

    ${buildRefRow(quote.referenceNo)}

    <div class="section-label">Requested New Slot</div>
    <div class="date-card">
      <div class="dc-label">Requested Date</div>
      <div class="dc-value">${scheduledDate}</div>
      <div class="dc-time">⏱ ${quote.timeWindow || 'TBD'}</div>
    </div>

    <div class="section-label">Service Address</div>
    <table class="info-grid">
      ${buildAddressRows(quote)}
    </table>

    <div class="notice warning">
      <strong>Important:</strong> Each booking is entitled to one free reschedule (subject to availability).
      Subsequent reschedule requests or changes made less than 48 hours before the appointment may incur a rescheduling fee.
      Please see our <a href="${TERMS_URL}" style="color:${C.amber};">Terms &amp; Conditions</a> for the full rescheduling policy.
    </div>

    ${buildContactStrip()}
  `;
  return buildEmailShell(header, body);
}

// 7. Final payment request
export function finalPaymentEmail(quote: any, paymentLink: string): string {
  const customer = quote.customer;
  const header = `
    ${buildStepDots(5, 5)}
    <div class="phase-badge">Step 5 of 5 · Job Complete</div>
    <div class="header-title">Final Payment Due</div>
    <div class="header-sub">Your job is complete — please settle the remaining balance</div>
  `;
  const body = `
    <p style="font-size:15px;margin:0 0 8px;">Hi <strong>${customer?.name}</strong>,</p>
    <p style="font-size:14px;color:${C.mutedText};margin:0 0 20px;">Our team has completed all work on your job. Please pay the remaining 50% balance to close your case. A receipt will be emailed to you upon payment.</p>

    ${buildRefRow(quote.referenceNo)}

    <div class="section-label">Completed Work</div>
    ${buildItemsTable(quote.items)}

    <div class="section-label">Payment Breakdown</div>
    ${buildTotalsBox(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount)}

    <div class="cta-block">
      <div class="cta-amount-label">Balance due now (50%)</div>
      <div class="cta-amount">$${Number(quote.finalAmount || 0).toFixed(2)}</div>
      <a href="${paymentLink}" class="btn btn-green">Pay Final Balance →</a>
      <p style="font-size:11px;color:${C.mutedText};margin:14px 0 0;">Secure payment via Stripe. Your case closes automatically once payment is confirmed.</p>
    </div>

    <div class="notice info">
      <strong>Not happy with the work?</strong> Please contact us on WhatsApp before making payment so we can address any concerns. We stand by our workmanship.
    </div>

    ${buildContactStrip()}

    <p style="font-size:12px;color:${C.mutedText};text-align:center;">
      By paying, you acknowledge that all work has been completed to your satisfaction.
      See our <a href="${TERMS_URL}" style="color:${C.black};">Terms &amp; Conditions</a>.
    </p>
  `;
  return buildEmailShell(header, body);
}

// 8. Case closed — full receipt
export function caseClosedEmail(quote: any): string {
  const customer = quote.customer;
  const header = `
    ${buildStepDots(5, 5)}
    <div class="phase-badge">Complete · Case Closed</div>
    <div class="header-title">All Done — Thank You!</div>
    <div class="header-sub">Payment confirmed · Job closed</div>
  `;
  const body = `
    <p style="font-size:15px;margin:0 0 8px;">Hi <strong>${customer?.name}</strong>,</p>
    <p style="font-size:14px;color:${C.mutedText};margin:0 0 20px;">Your final payment has been received and your case is now fully closed. Thank you for choosing TMG Install!</p>

    ${buildRefRow(quote.referenceNo)}

    <div class="section-label">Payment Receipt</div>
    <div class="totals-box">
      <div class="totals-row deposit"><span>✓ Deposit (50%)</span><span>$${Number(quote.depositAmount || 0).toFixed(2)}</span></div>
      <div class="totals-row deposit"><span>✓ Final payment (50%)</span><span>$${Number(quote.finalAmount || 0).toFixed(2)}</span></div>
      <div class="totals-row grand"><span>Total Paid</span><span>$${Number(quote.total || 0).toFixed(2)}</span></div>
    </div>

    <div class="section-label">Work Completed</div>
    ${buildItemsTable(quote.items)}

    <div style="text-align:center;padding:28px 20px;background:${C.offWhite};border:1px solid ${C.border};border-radius:4px;margin:20px 0;">
      <div style="font-size:32px;margin-bottom:8px;">✅</div>
      <div style="font-size:18px;font-weight:800;color:${C.black};letter-spacing:0.5px;">Case #${quote.referenceNo} Closed</div>
      <div style="font-size:13px;color:${C.mutedText};margin-top:4px;">All payments confirmed · Work complete</div>
    </div>

    <div class="notice success">
      <strong>Need us again?</strong> Save our contact for your next move, assembly, or installation job. We cover the whole of Singapore and handle offices, homes, and commercial spaces.
    </div>

    ${buildContactStrip()}

    <p style="font-size:12px;color:${C.mutedText};text-align:center;">
      If you have any concerns about the completed work, please contact us within 7 days.
      See our <a href="${TERMS_URL}" style="color:${C.black};">Terms &amp; Conditions</a> for warranty details.
    </p>
  `;
  return buildEmailShell(header, body);
}

// 9. Admin alert — new estimate submitted
export function newEstimateAdminAlert(quote: any): string {
  const customer = quote.customer;
  const services = Array.isArray(quote.selectedServices) ? quote.selectedServices : (quote.selectedServices ? JSON.parse(quote.selectedServices as string) : []);
  const adminUrl = `${WEBSITE}/admin/quotes/${quote.id}`;
  const header = `
    <div class="phase-badge">Admin Alert · New Submission</div>
    <div class="header-title">New Estimate Request</div>
    <div class="header-sub">From ${customer?.name} · ${quote.referenceNo}</div>
  `;
  const body = `
    <div class="notice info">
      🔔 <strong>New estimate just came in!</strong> A customer has submitted an estimate request through the website. Please review the items and pricing, then approve to trigger the deposit payment email.
    </div>

    ${buildRefRow(quote.referenceNo)}

    <div class="section-label">Customer Details</div>
    <table class="info-grid">
      <tr><td>Name</td><td><strong>${customer?.name}</strong></td></tr>
      <tr><td>Phone</td><td><a href="tel:${customer?.phone}" style="color:${C.black};">${customer?.phone}</a></td></tr>
      <tr><td>Email</td><td><a href="mailto:${customer?.email}" style="color:${C.black};">${customer?.email}</a></td></tr>
    </table>

    <div class="section-label">Service Details</div>
    <table class="info-grid">
      ${buildAddressRows(quote)}
      ${quote.preferredDate ? `<tr><td>Preferred date</td><td><strong>${new Date(quote.preferredDate + "T12:00:00").toLocaleDateString("en-SG", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</strong></td></tr>` : ''}
      ${quote.preferredTimeWindow ? `<tr><td>Time window</td><td>${quote.preferredTimeWindow}</td></tr>` : ''}
      ${services.length ? `<tr><td>Services</td><td>${services.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}</td></tr>` : ''}
    </table>

    <div class="section-label">Estimated Items (${(quote.items || []).length} item${(quote.items || []).length !== 1 ? 's' : ''})</div>
    ${buildItemsTable(quote.items)}

    <div class="section-label">Estimated Value</div>
    ${buildTotalsBox(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount)}

    ${quote.requiresManualReview ? `
    <div class="notice warning">
      ⚠️ <strong>Manual Review Required</strong> — This quote was flagged for manual review. Please verify all items and pricing before approving.
    </div>` : ''}

    ${quote.notes ? `
    <div class="section-label">Customer Notes</div>
    <div style="background:${C.offWhite};border:1px solid ${C.border};border-radius:4px;padding:12px 16px;font-size:14px;font-style:italic;color:${C.mutedText};">"${quote.notes}"</div>
    ` : ''}

    <div style="text-align:center;margin:28px 0;">
      <a href="${adminUrl}" class="btn">Review &amp; Approve in Admin Portal →</a>
    </div>
  `;
  return buildEmailShell(header, body);
}

export { ADMIN_EMAIL, WHATSAPP_LINK, WHATSAPP_NUMBER };
