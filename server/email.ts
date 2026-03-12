const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@tmginstall.com";
const WHATSAPP_NUMBER = "+6580880757";
const WHATSAPP_LINK = "https://wa.me/6580880757";
const SALES_EMAIL = "sales@tmginstall.com";
const ADMIN_EMAIL = "sales@tmginstall.com";

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

// Shared CSS styles for all emails
const emailStyles = `
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
  .container { max-width: 620px; margin: 30px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 32px; text-align: center; }
  .header h1 { margin: 0 0 8px; font-size: 24px; font-weight: 700; }
  .header p { margin: 0; opacity: 0.85; font-size: 15px; }
  .content { padding: 32px; }
  .ref-badge { display: inline-block; background: #f0f0f0; border-radius: 6px; padding: 6px 14px; font-weight: 700; font-size: 16px; letter-spacing: 1px; margin-bottom: 20px; color: #4f46e5; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin: 24px 0 12px; }
  .info-box { background: #f9f9fb; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 16px 20px; margin-bottom: 16px; }
  .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
  .info-row:last-child { margin-bottom: 0; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { background: #f0f0f0; text-align: left; padding: 10px 12px; font-size: 13px; font-weight: 700; color: #555; }
  td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
  tr:last-child td { border-bottom: none; }
  .totals-table td { padding: 8px 12px; }
  .totals-table tr.grand-total td { font-weight: 700; font-size: 16px; color: #4f46e5; border-top: 2px solid #e0e0e0; }
  .totals-table tr.deposit-row td { color: #16a34a; font-weight: 600; }
  .btn { display: inline-block; background: #4f46e5; color: white !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; margin: 20px 0; text-align: center; }
  .btn-green { background: #16a34a; }
  .contact-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px 20px; margin: 20px 0; }
  .footer { background: #f9f9fb; padding: 24px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 100px; background: #ede9fe; color: #4f46e5; font-weight: 700; font-size: 13px; }
  .alert-box { background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; font-size: 14px; margin: 16px 0; }
`;

// Build itemised table from items data
function buildItemsTable(items: any[]): string {
  if (!items || items.length === 0) return '<p style="color:#888;font-size:14px;">No items listed.</p>';
  const rows = items.map(item => `
    <tr>
      <td>${item.detectedName || item.originalDescription}</td>
      <td style="text-align:center">${item.serviceType}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">$${Number(item.unitPrice).toFixed(2)}</td>
      <td style="text-align:right"><strong>$${Number(item.subtotal).toFixed(2)}</strong></td>
    </tr>
  `).join('');
  return `
    <table>
      <thead>
        <tr>
          <th>Item</th><th style="text-align:center">Service</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildTotalsTable(subtotal: any, transportFee: any, total: any, depositAmount: any, finalAmount: any): string {
  return `
    <table class="totals-table">
      <tr><td>Subtotal</td><td style="text-align:right">$${Number(subtotal || 0).toFixed(2)}</td></tr>
      <tr><td>Transport Fee</td><td style="text-align:right">$${Number(transportFee || 0).toFixed(2)}</td></tr>
      <tr class="grand-total"><td>Grand Total</td><td style="text-align:right">$${Number(total || 0).toFixed(2)}</td></tr>
      <tr class="deposit-row"><td>Deposit (30%)</td><td style="text-align:right">$${Number(depositAmount || 0).toFixed(2)}</td></tr>
      <tr><td>Balance Due</td><td style="text-align:right">$${Number(finalAmount || 0).toFixed(2)}</td></tr>
    </table>
  `;
}

function buildAddressSection(quote: any): string {
  const services = quote.selectedServices ? JSON.parse(quote.selectedServices as string) : [];
  const isRelocation = services.includes('relocate') || quote.pickupAddress;
  if (isRelocation && quote.pickupAddress && quote.dropoffAddress) {
    return `
      <div class="info-row"><span><strong>Pickup:</strong></span><span>${quote.pickupAddress}</span></div>
      <div class="info-row"><span><strong>Dropoff:</strong></span><span>${quote.dropoffAddress}</span></div>
    `;
  }
  return `<div class="info-row"><span><strong>Service Address:</strong></span><span>${quote.serviceAddress}</span></div>`;
}

function buildContactSection(): string {
  return `
    <div class="contact-box">
      <p style="margin:0 0 8px;font-weight:700;font-size:15px;">Need help?</p>
      <p style="margin:0 0 4px;font-size:14px;">📧 Email: <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a></p>
      <p style="margin:0;font-size:14px;">💬 WhatsApp: <a href="${WHATSAPP_LINK}">${WHATSAPP_NUMBER}</a></p>
    </div>
  `;
}

function buildEmailWrapper(title: string, subtitle: string, body: string): string {
  return `
    <!DOCTYPE html><html><head><meta charset="UTF-8"><style>${emailStyles}</style></head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <div class="content">
          ${body}
        </div>
        <div class="footer">
          <p>© 2026 TMG Install / The Moving Guy. All rights reserved.</p>
          <p>160 Robinson Road, #14-04 SBF Center, Singapore 068914</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ─── Customer Emails ───────────────────────────────────────────────────────────

export function depositRequestEmail(quote: any, paymentLink: string): string {
  const customer = quote.customer;
  const slotDate = quote.preferredDate
    ? new Date(quote.preferredDate + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;
  const body = `
    <p>Hello <strong>${customer?.name}</strong>,</p>
    <p>Great news! Your quote has been reviewed and approved. Please pay the deposit to confirm your booking.</p>
    
    <div class="ref-badge">${quote.referenceNo}</div>

    ${slotDate ? `
    <div class="section-title">Your Reserved Slot</div>
    <div class="info-box" style="border-left: 4px solid #16a34a;">
      <div class="info-row"><span>📅 Date</span><span><strong>${slotDate}</strong></span></div>
      <div class="info-row"><span>🕐 Time Window</span><span><strong>${quote.preferredTimeWindow}</strong></span></div>
      <p style="margin:8px 0 0;font-size:13px;color:#666;">This slot is held for 48 hours from submission. Pay the deposit to confirm it permanently.</p>
    </div>` : ''}
    
    <div class="section-title">Customer Details</div>
    <div class="info-box">
      <div class="info-row"><span>Name</span><span>${customer?.name}</span></div>
      <div class="info-row"><span>Email</span><span>${customer?.email}</span></div>
      <div class="info-row"><span>Phone</span><span>${customer?.phone}</span></div>
    </div>

    <div class="section-title">Service Details</div>
    <div class="info-box">
      ${buildAddressSection(quote)}
      <div class="info-row"><span>Status</span><span><span class="status-badge">Deposit Requested</span></span></div>
    </div>

    <div class="section-title">Itemised Breakdown</div>
    ${buildItemsTable(quote.items)}

    <div class="section-title">Payment Summary</div>
    ${buildTotalsTable(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount)}

    <div style="background:#ede9fe;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:15px;color:#4f46e5;">Deposit Required to Confirm Your Slot</p>
      <p style="margin:0 0 16px;font-size:28px;font-weight:800;color:#4f46e5;">$${Number(quote.depositAmount || 0).toFixed(2)}</p>
      <a href="${paymentLink}" class="btn" style="display:inline-block">Pay Deposit Now →</a>
    </div>

    ${buildContactSection()}
  `;
  return buildEmailWrapper("Deposit Payment Required", "Your quote is approved — pay now to confirm your slot", body);
}

export function depositReceivedEmail(quote: any): string {
  const customer = quote.customer;
  const slotDate = quote.preferredDate
    ? new Date(quote.preferredDate + "T12:00:00").toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;
  const hasSlot = slotDate && quote.preferredTimeWindow;
  const body = `
    <p>Hello <strong>${customer?.name}</strong>,</p>
    <p>We've received your deposit payment — thank you! Your appointment slot is now <strong>confirmed</strong>.</p>

    <div class="ref-badge">${quote.referenceNo}</div>

    ${hasSlot ? `
    <div class="section-title">Confirmed Appointment Slot</div>
    <div class="info-box" style="border-left:4px solid #16a34a;background:#f0fdf4;">
      <div class="info-row"><span>📅 Date</span><span style="color:#15803d;font-weight:700">${slotDate}</span></div>
      <div class="info-row"><span>🕐 Time Window</span><span style="color:#15803d;font-weight:700">${quote.preferredTimeWindow}</span></div>
    </div>` : ''}

    <div class="section-title">Service Details</div>
    <div class="info-box">
      ${buildAddressSection(quote)}
    </div>

    <div class="section-title">Payment Summary</div>
    <div class="info-box">
      <div class="info-row"><span>Deposit Paid</span><span style="color:#16a34a;font-weight:700">✓ $${Number(quote.depositAmount || 0).toFixed(2)}</span></div>
      <div class="info-row"><span>Balance Due on Completion</span><span>$${Number(quote.finalAmount || 0).toFixed(2)}</span></div>
    </div>

    <div class="alert-box">
      <strong>📋 What Happens Next:</strong><br>
      • Our admin team will review and formally confirm your booking<br>
      • You'll receive a booking confirmation email once approved<br>
      • One free reschedule is available (at least 24 hours before your appointment)<br>
      • Contact us on WhatsApp for urgent changes
    </div>
    ${buildContactSection()}
  `;
  return buildEmailWrapper("Deposit Received — Slot Confirmed! 🎉", "Your appointment slot is secured", body);
}

export function bookingRequestAdminEmail(quote: any): string {
  const customer = quote.customer;
  const services = quote.selectedServices ? JSON.parse(quote.selectedServices as string) : [];
  const scheduledDate = quote.scheduledAt ? new Date(quote.scheduledAt).toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "TBD";
  const body = `
    <p><strong>New booking request received!</strong> Please review and confirm the customer's preferred slot.</p>
    
    <div class="ref-badge">${quote.referenceNo}</div>

    <div class="section-title">Customer</div>
    <div class="info-box">
      <div class="info-row"><span>Name</span><span>${customer?.name}</span></div>
      <div class="info-row"><span>Phone</span><span><a href="tel:${customer?.phone}">${customer?.phone}</a></span></div>
      <div class="info-row"><span>Email</span><span>${customer?.email}</span></div>
    </div>

    <div class="section-title">Requested Slot</div>
    <div class="info-box">
      <div class="info-row"><span>Date</span><span><strong>${scheduledDate}</strong></span></div>
      <div class="info-row"><span>Time Window</span><span><strong>${quote.timeWindow || 'TBD'}</strong></span></div>
      ${buildAddressSection(quote)}
      <div class="info-row"><span>Services</span><span>${services.join(', ') || 'See quote'}</span></div>
    </div>

    <div class="section-title">Items</div>
    ${buildItemsTable(quote.items)}

    <div class="section-title">Financials</div>
    ${buildTotalsTable(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount)}

    <p style="font-size:14px;">Please log in to the admin portal to confirm or reject this booking request.</p>
  `;
  return buildEmailWrapper("New Booking Request", `From ${customer?.name} — ${quote.referenceNo}`, body);
}

export function bookingConfirmationEmail(quote: any): string {
  const customer = quote.customer;
  const scheduledDate = quote.scheduledAt ? new Date(quote.scheduledAt).toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "TBD";
  const body = `
    <p>Hello <strong>${customer?.name}</strong>,</p>
    <p>Your appointment has been confirmed by our team. Please ensure someone is available at the address on the scheduled date.</p>

    <div class="ref-badge">${quote.referenceNo}</div>

    <div class="section-title">Confirmed Appointment</div>
    <div class="info-box" style="border-left-color:#16a34a;background:#f0fdf4">
      <div class="info-row"><span>📅 Date</span><span><strong>${scheduledDate}</strong></span></div>
      <div class="info-row"><span>🕐 Time Window</span><span><strong>${quote.timeWindow || 'TBD'}</strong></span></div>
      ${buildAddressSection(quote)}
    </div>

    <div class="section-title">Your Items</div>
    ${buildItemsTable(quote.items)}

    <div class="section-title">Payment Summary</div>
    ${buildTotalsTable(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount)}

    <div class="alert-box">
      <strong>📋 What to Expect:</strong><br>
      • Our team will arrive within the confirmed time window<br>
      • Please ensure access to the service area<br>
      • Reschedule must be requested at least 24 hours in advance via WhatsApp<br>
      • Balance of $${Number(quote.finalAmount || 0).toFixed(2)} is due upon completion
    </div>
    ${buildContactSection()}
  `;
  return buildEmailWrapper("Booking Confirmed! ✅", "Your appointment is locked in", body);
}

export function rescheduleConfirmationEmail(quote: any): string {
  const customer = quote.customer;
  const scheduledDate = quote.scheduledAt ? new Date(quote.scheduledAt).toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "TBD";
  const body = `
    <p>Hello <strong>${customer?.name}</strong>,</p>
    <p>Your reschedule request has been received and is pending admin confirmation. You'll receive another email once it's confirmed.</p>

    <div class="ref-badge">${quote.referenceNo}</div>

    <div class="section-title">Requested New Slot</div>
    <div class="info-box" style="border-left-color:#f59e0b;background:#fffbeb">
      <div class="info-row"><span>📅 Date</span><span><strong>${scheduledDate}</strong></span></div>
      <div class="info-row"><span>🕐 Time Window</span><span><strong>${quote.timeWindow || 'TBD'}</strong></span></div>
      ${buildAddressSection(quote)}
    </div>

    <div class="alert-box">
      ⚠️ <strong>Note:</strong> You have used your free reschedule. Any further changes may incur charges — please contact us on WhatsApp.
    </div>
    ${buildContactSection()}
  `;
  return buildEmailWrapper("Reschedule Request Received", "Pending admin confirmation", body);
}

export function finalPaymentEmail(quote: any, paymentLink: string): string {
  const customer = quote.customer;
  const body = `
    <p>Hello <strong>${customer?.name}</strong>,</p>
    <p>Your service has been completed! Please make the final payment to close your job.</p>

    <div class="ref-badge">${quote.referenceNo}</div>

    <div class="section-title">Customer Details</div>
    <div class="info-box">
      <div class="info-row"><span>Name</span><span>${customer?.name}</span></div>
      <div class="info-row"><span>Phone</span><span>${customer?.phone}</span></div>
      ${buildAddressSection(quote)}
    </div>

    <div class="section-title">Completed Items</div>
    ${buildItemsTable(quote.items)}

    <div class="section-title">Payment Summary</div>
    ${buildTotalsTable(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount)}

    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:15px;color:#92400e;">Balance Due</p>
      <p style="margin:0 0 16px;font-size:28px;font-weight:800;color:#92400e;">$${Number(quote.finalAmount || 0).toFixed(2)}</p>
      <a href="${paymentLink}" class="btn" style="background:#d97706;display:inline-block">Pay Final Balance →</a>
    </div>

    <p style="font-size:14px;color:#666;">Your case will be automatically closed once payment is confirmed.</p>
    ${buildContactSection()}
  `;
  return buildEmailWrapper("Final Payment Due", "Please complete your balance payment", body);
}

export function caseClosedEmail(quote: any): string {
  const customer = quote.customer;
  const body = `
    <p>Hello <strong>${customer?.name}</strong>,</p>
    <p>Thank you for choosing TMG Install! Your payment has been received and your case is now closed.</p>

    <div class="ref-badge">${quote.referenceNo}</div>

    <div class="section-title">Payment Confirmation</div>
    <div class="info-box" style="border-left-color:#16a34a;background:#f0fdf4">
      <div class="info-row"><span>✓ Deposit Paid</span><span style="color:#16a34a;font-weight:700">$${Number(quote.depositAmount || 0).toFixed(2)}</span></div>
      <div class="info-row"><span>✓ Final Payment</span><span style="color:#16a34a;font-weight:700">$${Number(quote.finalAmount || 0).toFixed(2)}</span></div>
      <div class="info-row" style="font-size:16px;font-weight:800;border-top:1px solid #bbf7d0;padding-top:8px;margin-top:8px"><span>Total Paid</span><span>$${Number(quote.total || 0).toFixed(2)}</span></div>
    </div>

    <div class="section-title">Completed Work</div>
    ${buildItemsTable(quote.items)}

    <div style="text-align:center;padding:20px;background:#f0fdf4;border-radius:10px;margin:20px 0;">
      <p style="font-size:24px;margin:0 0 8px">✅</p>
      <p style="font-weight:700;font-size:16px;color:#15803d;margin:0">Case Closed — Thank you!</p>
    </div>

    <p style="font-size:14px;color:#666;">We hope you're happy with our service! If you need help in future, don't hesitate to reach out.</p>
    ${buildContactSection()}
  `;
  return buildEmailWrapper("Case Closed — Payment Confirmed", "Thank you for your business!", body);
}

export { ADMIN_EMAIL, WHATSAPP_LINK, WHATSAPP_NUMBER };
