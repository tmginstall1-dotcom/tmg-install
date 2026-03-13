const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@tmginstall.com";
const WHATSAPP_NUMBER = "+65 8088 0757";
const WHATSAPP_LINK  = "https://wa.me/6580880757";
const SALES_EMAIL    = "sales@tmginstall.com";
const ADMIN_EMAIL    = "sales@tmginstall.com";
const WEBSITE        = "https://tmginstall.com";
const TERMS_URL      = "https://tmginstall.com/terms";
const ADDRESS        = "160 Robinson Road, #14-04 SBF Center, Singapore 068914";

interface EmailParams { to: string; subject: string; html: string; }

export async function sendEmail({ to, subject, html }: EmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) { console.warn("RESEND_API_KEY not configured. Email not sent to", to); return false; }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!response.ok) { console.error("Failed to send email:", await response.text()); return false; }
    return true;
  } catch (err) { console.error("Error sending email:", err); return false; }
}

// ─── Shared CSS ────────────────────────────────────────────────────────────────
const css = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#111;background:#f2f2f2;-webkit-font-smoothing:antialiased}
.shell{max-width:600px;margin:0 auto;padding:32px 16px 48px}
.card{background:#fff;border:1px solid #e0e0e0}
/* ── Header ── */
.hdr{background:#111;padding:52px 48px 44px;text-align:center}
.hdr-logo{font-size:18px;font-weight:900;letter-spacing:10px;color:#fff;text-transform:uppercase;font-family:'Arial Black',Arial,sans-serif}
.hdr-rule{width:36px;height:1px;background:rgba(255,255,255,0.18);margin:22px auto}
.hdr-context{font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.45)}
/* ── Body ── */
.bdy{padding:44px 48px}
.greeting{font-size:16px;color:#111;margin-bottom:28px;line-height:1.7}
/* ── Reference ── */
.ref-blk{margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid #ebebeb}
.ref-label{font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;margin-bottom:6px}
.ref-num{font-size:17px;font-weight:800;letter-spacing:3px;color:#111;font-family:'Courier New',Courier,monospace}
/* ── Section ── */
.sec{margin-top:36px}
.sec-lbl{font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#aaa;padding-bottom:10px;border-bottom:1px solid #ebebeb;margin-bottom:0}
/* ── Info rows ── */
.inf{width:100%;border-collapse:collapse}
.inf td{padding:11px 0;font-size:14px;vertical-align:top;border-bottom:1px solid #f2f2f2;color:#111}
.inf td:first-child{color:#888;width:42%;font-weight:400}
.inf td:last-child{font-weight:600;padding-left:12px}
.inf tr:last-child td{border-bottom:none}
/* ── Date highlight ── */
.date-bx{background:#111;padding:28px 32px;margin-top:2px}
.date-bx .dl{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:10px}
.date-bx .dv{font-size:17px;font-weight:700;color:#fff;margin-bottom:5px;line-height:1.3}
.date-bx .dt{font-size:13px;color:rgba(255,255,255,0.5)}
/* ── Items table ── */
.itms{width:100%;border-collapse:collapse;margin-top:2px;font-size:13px}
.itms thead tr{background:#111}
.itms thead th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6)}
.itms thead th.r{text-align:right}
.itms tbody td{padding:13px 14px;border-bottom:1px solid #f2f2f2;vertical-align:top;color:#111;font-size:14px}
.itms tbody td.r{text-align:right;font-weight:700}
.itms tbody tr:last-child td{border-bottom:none}
.svc-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999;display:block;margin-top:3px}
/* ── Totals ── */
.tot-wrap{border-top:2px solid #111;margin-top:2px}
.tot-row{display:flex;justify-content:space-between;align-items:baseline;padding:11px 0;font-size:14px;border-bottom:1px solid #f2f2f2;color:#444}
.tot-row:last-child{border-bottom:none}
.tot-row.grand{font-size:16px;font-weight:800;color:#111;padding-top:16px;border-top:1px solid #e0e0e0;margin-top:4px;border-bottom:none}
.tot-row.dep{color:#15803d;font-weight:600}
.tot-row.bal{color:#999;font-size:13px}
/* ── CTA block ── */
.cta{text-align:center;padding:44px 36px;background:#fafafa;border-top:1px solid #ebebeb;border-bottom:1px solid #ebebeb;margin:40px 0}
.cta-lbl{font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#999;margin-bottom:12px}
.cta-amt{font-size:44px;font-weight:900;color:#111;margin-bottom:28px;line-height:1;letter-spacing:-2px;font-family:'Arial Black',Arial,sans-serif}
.cta-btn{display:inline-block;background:#111;color:#fff!important;padding:17px 48px;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase}
.cta-btn.grn{background:#15803d}
.cta-sub{font-size:11px;color:#bbb;margin-top:16px;line-height:1.6}
/* ── Notice ── */
.ntc{padding:18px 20px;font-size:13px;line-height:1.7;margin:28px 0;border-left:3px solid}
.ntc.info{background:#f0f7ff;border-color:#3b82f6;color:#1e3a6e}
.ntc.ok{background:#f0fdf4;border-color:#15803d;color:#14532d}
.ntc.warn{background:#fffbeb;border-color:#f59e0b;color:#78350f}
/* ── Checklist ── */
.chk{list-style:none;padding:0}
.chk li{padding:10px 0 10px 24px;font-size:14px;color:#333;border-bottom:1px solid #f2f2f2;position:relative;line-height:1.55}
.chk li::before{content:'–';position:absolute;left:0;color:#888;font-weight:600}
.chk li:last-child{border-bottom:none}
/* ── Contacts ── */
.ctcts{display:flex;gap:10px;margin:32px 0}
.ctct{flex:1;border:1px solid #e0e0e0;padding:18px 12px;text-align:center;text-decoration:none;display:block;color:#111}
.ctct-ico{font-size:20px;display:block;margin-bottom:8px}
.ctct-lbl{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#aaa;display:block;margin-bottom:5px}
.ctct-val{font-size:12px;font-weight:700;color:#111;display:block}
/* ── Footer ── */
.ftr{padding:28px 48px;border-top:1px solid #ebebeb;text-align:center}
.ftr p{font-size:11px;color:#bbb;line-height:1.8;margin:2px 0}
.ftr a{color:#999;text-decoration:none}
.ftr-links{margin-bottom:8px}
.divider{height:1px;background:#f2f2f2;border:none;margin:32px 0}
`;

// ─── Core helpers ──────────────────────────────────────────────────────────────

function shell(contextLine: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>TMG Install</title>
<style>${css}</style>
</head>
<body>
<div class="shell">
<div class="card">
  <div class="hdr">
    <div class="hdr-logo">TMG Install</div>
    <div class="hdr-rule"></div>
    <div class="hdr-context">${contextLine}</div>
  </div>
  <div class="bdy">
    ${body}
  </div>
  <div class="ftr">
    <p class="ftr-links">
      <a href="${WEBSITE}">tmginstall.com</a>
      &nbsp;&middot;&nbsp;
      <a href="${TERMS_URL}">Terms &amp; Conditions</a>
      &nbsp;&middot;&nbsp;
      <a href="mailto:${SALES_EMAIL}">${SALES_EMAIL}</a>
    </p>
    <p>Operated by The Moving Guy Pte Ltd &middot; UEN 202424156H</p>
    <p>${ADDRESS}</p>
    <p style="margin-top:8px;font-size:10px;color:#ccc;">&copy; 2026 TMG Install. All rights reserved.</p>
  </div>
</div>
</div>
</body>
</html>`;
}

function refBlock(refNo: string): string {
  return `
    <div class="ref-blk">
      <div class="ref-label">Reference</div>
      <div class="ref-num">${refNo}</div>
    </div>`;
}

function section(label: string, content: string): string {
  return `
    <div class="sec">
      <div class="sec-lbl">${label}</div>
      ${content}
    </div>`;
}

function infoTable(rows: Array<[string, string]>): string {
  const trs = rows.map(([l, v]) => `<tr><td>${l}</td><td>${v}</td></tr>`).join('');
  return `<table class="inf"><tbody>${trs}</tbody></table>`;
}

function addressRows(quote: any): Array<[string, string]> {
  const svc = Array.isArray(quote.selectedServices)
    ? quote.selectedServices
    : (quote.selectedServices ? (() => { try { return JSON.parse(quote.selectedServices as string); } catch { return []; } })() : []);
  if ((svc.includes('relocate') || quote.pickupAddress) && quote.pickupAddress && quote.dropoffAddress) {
    return [['Pickup', quote.pickupAddress], ['Drop-off', quote.dropoffAddress]];
  }
  return [['Service address', quote.serviceAddress || '—']];
}

function dateBox(dateStr: string, timeWindow: string): string {
  return `
    <div class="date-bx">
      <div class="dl">Appointment</div>
      <div class="dv">${dateStr}</div>
      <div class="dt">${timeWindow}</div>
    </div>`;
}

function itemsTable(items: any[]): string {
  if (!items || items.length === 0) {
    return `<p style="font-size:13px;color:#aaa;padding:16px 0;">No items recorded.</p>`;
  }
  const rows = items.map(it => `
    <tr>
      <td>
        <strong>${it.detectedName || it.originalDescription}</strong>
        <span class="svc-tag">${it.serviceType}</span>
      </td>
      <td style="text-align:center;color:#888;">×${it.quantity}</td>
      <td style="text-align:right;color:#888;">$${Number(it.unitPrice).toFixed(2)}</td>
      <td class="r">$${Number(it.subtotal).toFixed(2)}</td>
    </tr>`).join('');
  return `
    <table class="itms">
      <thead><tr>
        <th>Item</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit</th>
        <th class="r">Subtotal</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function totals(subtotal: any, transport: any, total: any, deposit: any, balance: any): string {
  const hasTransport = Number(transport || 0) > 0;
  return `
    <div class="tot-wrap">
      <div class="tot-row"><span>Labour</span><span>$${Number(subtotal || 0).toFixed(2)}</span></div>
      ${hasTransport ? `<div class="tot-row"><span>Transport &amp; logistics</span><span>$${Number(transport || 0).toFixed(2)}</span></div>` : ''}
      <div class="tot-row grand"><span>Total</span><span>$${Number(total || 0).toFixed(2)}</span></div>
      <div class="tot-row dep"><span>Deposit paid &nbsp;(50%)</span><span>$${Number(deposit || 0).toFixed(2)}</span></div>
      <div class="tot-row bal"><span>Balance on completion &nbsp;(50%)</span><span>$${Number(balance || 0).toFixed(2)}</span></div>
    </div>`;
}

function contactStrip(): string {
  return `
    <div class="ctcts">
      <a href="mailto:${SALES_EMAIL}" class="ctct">
        <span class="ctct-ico">✉</span>
        <span class="ctct-lbl">Email</span>
        <span class="ctct-val">${SALES_EMAIL}</span>
      </a>
      <a href="${WHATSAPP_LINK}" class="ctct">
        <span class="ctct-ico">💬</span>
        <span class="ctct-lbl">WhatsApp</span>
        <span class="ctct-val">${WHATSAPP_NUMBER}</span>
      </a>
    </div>`;
}

function notice(type: 'info' | 'ok' | 'warn', html: string): string {
  return `<div class="ntc ${type}">${html}</div>`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-SG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function fmtDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-SG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ─── Customer-facing emails ────────────────────────────────────────────────────

export function estimateSubmittedEmail(quote: any): string {
  const c = quote.customer;
  return shell("Estimate Received", `
    <p class="greeting">Hi <strong>${c?.name}</strong>,</p>
    <p style="font-size:14px;color:#555;margin-bottom:32px;line-height:1.7;">
      Thank you for reaching out. We've received your estimate request and our team will review it shortly.
      You can expect to hear from us within 1 business day.
    </p>

    ${refBlock(quote.referenceNo)}

    ${section("Your Details", infoTable([
      ["Name", c?.name || ""],
      ["Email", c?.email || ""],
      ["Phone", c?.phone || ""],
      ...addressRows(quote),
      ...(quote.preferredDate ? [["Preferred date", fmtDate(quote.preferredDate)] as [string, string]] : []),
      ...(quote.preferredTimeWindow ? [["Time window", quote.preferredTimeWindow] as [string, string]] : []),
    ]))}

    ${section("Requested Work", itemsTable(quote.items))}

    ${section("Estimated Pricing", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount))}

    ${notice("info", `
      <strong>What happens next?</strong><br>
      Our team will review your estimate, confirm the pricing, and send you a deposit invoice.
      Once the 50% deposit is paid, your appointment slot is locked in.
    `)}

    <hr class="divider">
    ${contactStrip()}

    <p style="font-size:11px;color:#bbb;text-align:center;margin-top:8px;">
      By proceeding, you agree to our <a href="${TERMS_URL}" style="color:#888;">Terms &amp; Conditions</a>.
      The 50% deposit is non-refundable once payment is made.
    </p>
  `);
}

export function depositRequestEmail(quote: any, paymentLink: string): string {
  const c = quote.customer;
  const slotDate = quote.preferredDate ? fmtDate(quote.preferredDate) : null;

  return shell("Deposit Invoice", `
    <p class="greeting">Hi <strong>${c?.name}</strong>,</p>
    <p style="font-size:14px;color:#555;margin-bottom:32px;line-height:1.7;">
      Your estimate has been reviewed and approved. Please pay the 50% deposit below to confirm
      your appointment. Your slot will be held for <strong>48 hours</strong> from the time of this email.
    </p>

    ${refBlock(quote.referenceNo)}

    ${slotDate ? section("Your Slot", `
      ${dateBox(slotDate, quote.preferredTimeWindow || '')}
      <p style="font-size:12px;color:#aaa;margin-top:10px;line-height:1.6;">
        This slot is provisionally reserved. Pay the deposit before it expires to guarantee your preferred date and time.
      </p>
    `) : ''}

    ${section("Service Details", infoTable([
      ...addressRows(quote),
      ["Contact name", c?.name || ""],
      ["Contact number", c?.phone || ""],
    ]))}

    ${section("Scope of Work", itemsTable(quote.items))}

    ${section("Payment Breakdown", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount))}

    <div class="cta">
      <div class="cta-lbl">Deposit due now — 50%</div>
      <div class="cta-amt">$${Number(quote.depositAmount || 0).toFixed(2)}</div>
      <a href="${paymentLink}" class="cta-btn">Pay Now &rarr;</a>
      <div class="cta-sub">
        Secure payment via Stripe &nbsp;&middot;&nbsp; Card details are never stored.
      </div>
    </div>

    ${notice("warn", `
      <strong>Cancellation Policy</strong><br>
      Cancellation more than 48 hours before your appointment: deposit refunded minus a $30 admin fee.<br>
      Cancellation less than 48 hours before your appointment: deposit is forfeited in full.<br>
      Please review the full policy at <a href="${TERMS_URL}" style="color:#92400e;">${TERMS_URL}</a>.
    `)}

    ${contactStrip()}

    <p style="font-size:11px;color:#bbb;text-align:center;">
      By completing payment, you agree to our <a href="${TERMS_URL}" style="color:#888;">Terms &amp; Conditions</a>.
    </p>
  `);
}

export function depositReceivedEmail(quote: any): string {
  const c = quote.customer;
  const slotDate = quote.preferredDate ? fmtDate(quote.preferredDate) : null;

  return shell("Booking Confirmed", `
    <p class="greeting">Hi <strong>${c?.name}</strong>,</p>
    <p style="font-size:14px;color:#555;margin-bottom:32px;line-height:1.7;">
      We've received your deposit — thank you. Your booking is now confirmed and our team has been notified.
      A technician will be assigned to your job and you'll receive your appointment confirmation shortly.
    </p>

    ${refBlock(quote.referenceNo)}

    ${slotDate ? section("Your Appointment", dateBox(slotDate, quote.preferredTimeWindow || '')) : ''}

    ${section("Payment Summary", `
      <div class="tot-wrap">
        <div class="tot-row dep"><span>Deposit paid &nbsp;(50%)</span><span>$${Number(quote.depositAmount || 0).toFixed(2)}</span></div>
        <div class="tot-row bal"><span>Balance due on completion &nbsp;(50%)</span><span>$${Number(quote.finalAmount || 0).toFixed(2)}</span></div>
        <div class="tot-row grand"><span>Total</span><span>$${Number(quote.total || 0).toFixed(2)}</span></div>
      </div>
    `)}

    ${section("How to Prepare", `
      <ul class="chk">
        <li>Ensure clear access to all items and the full work area before our team arrives</li>
        <li>Have photos, assembly manuals, or reference materials ready if available</li>
        <li>Make sure someone aged 18 or above is present at the address throughout the appointment</li>
        <li>Remove fragile or personal items from the immediate work area beforehand</li>
        <li>Note any special access instructions (carpark, loading bay, lift access) and send them to us via WhatsApp</li>
      </ul>
    `)}

    ${notice("info", `
      <strong>Next step:</strong> Our team will assign a technician and send you a formal appointment confirmation with the date, time, and technician details.
    `)}

    ${contactStrip()}

    <p style="font-size:11px;color:#bbb;text-align:center;margin-top:4px;">
      Need to reschedule? Please contact us at least 48 hours before your appointment.<br>
      See our <a href="${TERMS_URL}" style="color:#888;">Terms &amp; Conditions</a> for the rescheduling policy.
    </p>
  `);
}

export function bookingRequestAdminEmail(quote: any): string {
  const c = quote.customer;
  const svc = Array.isArray(quote.selectedServices)
    ? quote.selectedServices
    : (quote.selectedServices ? (() => { try { return JSON.parse(quote.selectedServices as string); } catch { return []; } })() : []);
  const scheduledDate = quote.scheduledAt ? fmtDateTime(quote.scheduledAt) : "TBD";
  const adminUrl = `${WEBSITE}/admin/quotes/${quote.id}`;

  return shell("New Booking Request", `
    ${notice("info", `
      <strong>${c?.name}</strong> has submitted a booking request and selected a preferred appointment slot.
      Please log in to the admin portal to review and confirm.
    `)}

    ${refBlock(quote.referenceNo)}

    ${section("Customer", infoTable([
      ["Name", `<strong>${c?.name}</strong>`],
      ["Phone", `<a href="tel:${c?.phone}" style="color:#111;">${c?.phone}</a>`],
      ["Email", `<a href="mailto:${c?.email}" style="color:#111;">${c?.email}</a>`],
    ]))}

    ${section("Requested Slot", dateBox(scheduledDate, quote.timeWindow || 'TBD'))}

    ${section("Service Details", infoTable([
      ...addressRows(quote),
      ...(svc.length ? [["Services", svc.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')] as [string, string]] : []),
    ]))}

    ${section("Scope of Work", itemsTable(quote.items))}

    ${section("Financial Summary", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount))}

    <div style="text-align:center;margin:40px 0 8px;">
      <a href="${adminUrl}" class="cta-btn" style="display:inline-block;background:#111;color:#fff!important;padding:17px 48px;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;">
        Review in Admin Portal &rarr;
      </a>
    </div>
  `);
}

export function bookingConfirmationEmail(quote: any): string {
  const c = quote.customer;
  const scheduledDate = quote.scheduledAt ? fmtDateTime(quote.scheduledAt) : "TBD";

  return shell("Appointment Confirmed", `
    <p class="greeting">Hi <strong>${c?.name}</strong>,</p>
    <p style="font-size:14px;color:#555;margin-bottom:32px;line-height:1.7;">
      Your appointment has been confirmed by our team. A trained technician has been assigned to your job.
      Please read through the details below and let us know if you have any questions.
    </p>

    ${refBlock(quote.referenceNo)}

    ${section("Confirmed Appointment", dateBox(scheduledDate, quote.timeWindow || 'TBD'))}

    ${section("Service Address", infoTable(addressRows(quote)))}

    ${section("Scope of Work", itemsTable(quote.items))}

    ${section("Payment", `
      <div class="tot-wrap">
        <div class="tot-row dep"><span>Deposit paid &nbsp;(50%)</span><span>$${Number(quote.depositAmount || 0).toFixed(2)}</span></div>
        <div class="tot-row bal"><span>Balance due on completion &nbsp;(50%)</span><span>$${Number(quote.finalAmount || 0).toFixed(2)}</span></div>
        <div class="tot-row grand"><span>Total</span><span>$${Number(quote.total || 0).toFixed(2)}</span></div>
      </div>
    `)}

    ${section("On the Day", `
      <ul class="chk">
        <li>Ensure someone aged 18 or above is available at the address for the full duration</li>
        <li>Keep the work area clear — remove personal items and fragile objects beforehand</li>
        <li>Ensure access to a power outlet if power tools will be required</li>
        <li>Have assembly manuals or reference materials ready for the technician</li>
        <li>The remaining balance of <strong>$${Number(quote.finalAmount || 0).toFixed(2)}</strong> is due once all work is completed</li>
      </ul>
    `)}

    ${notice("warn", `
      <strong>Reschedule Policy:</strong> If you need to change your appointment, please contact us on WhatsApp
      at least <strong>48 hours</strong> before the scheduled time. Late changes may incur a rescheduling fee.
      Full details at <a href="${TERMS_URL}" style="color:#92400e;">${TERMS_URL}</a>.
    `)}

    ${contactStrip()}
  `);
}

export function rescheduleConfirmationEmail(quote: any): string {
  const c = quote.customer;
  const scheduledDate = quote.scheduledAt ? fmtDateTime(quote.scheduledAt) : "TBD";

  return shell("Reschedule Request Received", `
    <p class="greeting">Hi <strong>${c?.name}</strong>,</p>
    <p style="font-size:14px;color:#555;margin-bottom:32px;line-height:1.7;">
      We've received your reschedule request. The new slot is pending confirmation from our operations team,
      and you'll receive a follow-up email once it's confirmed.
    </p>

    ${refBlock(quote.referenceNo)}

    ${section("Requested New Slot", dateBox(scheduledDate, quote.timeWindow || 'TBD'))}

    ${section("Service Address", infoTable(addressRows(quote)))}

    ${notice("warn", `
      <strong>Please note:</strong> Each booking is entitled to one complimentary reschedule, subject to availability.
      Any further reschedule requests, or changes made less than 48 hours before the appointment,
      may be subject to a rescheduling fee. See our
      <a href="${TERMS_URL}" style="color:#92400e;">Terms &amp; Conditions</a> for details.
    `)}

    ${contactStrip()}
  `);
}

export function finalPaymentEmail(quote: any, paymentLink: string): string {
  const c = quote.customer;

  return shell("Final Payment Due", `
    <p class="greeting">Hi <strong>${c?.name}</strong>,</p>
    <p style="font-size:14px;color:#555;margin-bottom:32px;line-height:1.7;">
      Our team has completed all the work on your job. Please settle the remaining 50% balance below
      to officially close your case. A payment confirmation will be sent to you automatically.
    </p>

    ${refBlock(quote.referenceNo)}

    ${section("Work Completed", itemsTable(quote.items))}

    ${section("Payment Breakdown", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount))}

    <div class="cta">
      <div class="cta-lbl">Final balance due — 50%</div>
      <div class="cta-amt">$${Number(quote.finalAmount || 0).toFixed(2)}</div>
      <a href="${paymentLink}" class="cta-btn grn">Pay Final Balance &rarr;</a>
      <div class="cta-sub">
        Secure payment via Stripe &nbsp;&middot;&nbsp; Your case closes automatically on payment confirmation.
      </div>
    </div>

    ${notice("info", `
      <strong>Not satisfied with the work?</strong> Please get in touch on WhatsApp before completing payment
      and we will address your concerns promptly. We stand behind the quality of our work.
    `)}

    ${contactStrip()}

    <p style="font-size:11px;color:#bbb;text-align:center;margin-top:4px;">
      Payment constitutes acknowledgement that all work has been completed to your satisfaction.<br>
      <a href="${TERMS_URL}" style="color:#888;">Terms &amp; Conditions</a>
    </p>
  `);
}

export function caseClosedEmail(quote: any): string {
  const c = quote.customer;

  return shell("All Done — Thank You", `
    <p class="greeting">Hi <strong>${c?.name}</strong>,</p>
    <p style="font-size:14px;color:#555;margin-bottom:32px;line-height:1.7;">
      Your final payment has been received and your case is now closed. Thank you for choosing TMG Install —
      we hope you are pleased with the result.
    </p>

    ${refBlock(quote.referenceNo)}

    ${section("Payment Receipt", `
      <div class="tot-wrap">
        <div class="tot-row dep"><span>Deposit &nbsp;(50%)</span><span>$${Number(quote.depositAmount || 0).toFixed(2)}</span></div>
        <div class="tot-row dep"><span>Final payment &nbsp;(50%)</span><span>$${Number(quote.finalAmount || 0).toFixed(2)}</span></div>
        <div class="tot-row grand"><span>Total Paid</span><span>$${Number(quote.total || 0).toFixed(2)}</span></div>
      </div>
    `)}

    ${section("Work Summary", itemsTable(quote.items))}

    <div style="text-align:center;padding:36px 24px;background:#fafafa;border-top:1px solid #ebebeb;border-bottom:1px solid #ebebeb;margin:36px 0;">
      <div style="font-size:28px;margin-bottom:12px;">✓</div>
      <div style="font-size:15px;font-weight:700;color:#111;letter-spacing:0.5px;">Case ${quote.referenceNo} — Closed</div>
      <div style="font-size:13px;color:#aaa;margin-top:6px;">All payments confirmed &nbsp;&middot;&nbsp; Work complete</div>
    </div>

    ${notice("ok", `
      <strong>Need us again?</strong> Save our contact for your next furniture installation, assembly,
      or relocation job. We cover homes, offices, and commercial spaces across Singapore.
    `)}

    ${contactStrip()}

    <p style="font-size:11px;color:#bbb;text-align:center;margin-top:4px;">
      If you have any concerns about the completed work, please contact us within 7 days of job closure.<br>
      <a href="${TERMS_URL}" style="color:#888;">Terms &amp; Conditions</a>
    </p>
  `);
}

export function newEstimateAdminAlert(quote: any): string {
  const c = quote.customer;
  const svc = Array.isArray(quote.selectedServices)
    ? quote.selectedServices
    : (quote.selectedServices ? (() => { try { return JSON.parse(quote.selectedServices as string); } catch { return []; } })() : []);
  const adminUrl = `${WEBSITE}/admin/quotes/${quote.id}`;

  return shell("New Estimate Submitted", `
    ${notice("info", `
      A new estimate request has just come in from <strong>${c?.name}</strong>.
      Please review the items and pricing, then approve to trigger the deposit invoice.
    `)}

    ${refBlock(quote.referenceNo)}

    ${section("Customer", infoTable([
      ["Name", `<strong>${c?.name}</strong>`],
      ["Phone", `<a href="tel:${c?.phone}" style="color:#111;">${c?.phone}</a>`],
      ["Email", `<a href="mailto:${c?.email}" style="color:#111;">${c?.email}</a>`],
    ]))}

    ${section("Service Details", infoTable([
      ...addressRows(quote),
      ...(quote.preferredDate ? [["Preferred date", fmtDate(quote.preferredDate)] as [string, string]] : []),
      ...(quote.preferredTimeWindow ? [["Time window", quote.preferredTimeWindow] as [string, string]] : []),
      ...(svc.length ? [["Services", svc.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')] as [string, string]] : []),
    ]))}

    ${section(`Items &nbsp;(${(quote.items || []).length})`, itemsTable(quote.items))}

    ${section("Estimated Value", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount))}

    ${quote.requiresManualReview ? notice("warn", `
      <strong>Manual Review Required</strong> — This estimate was flagged for manual review.
      Please verify all items and pricing before approving.
    `) : ''}

    ${quote.notes ? section("Customer Notes", `
      <p style="font-size:14px;color:#555;font-style:italic;line-height:1.7;padding:4px 0;">"${quote.notes}"</p>
    `) : ''}

    <div style="text-align:center;margin:40px 0 8px;">
      <a href="${adminUrl}" style="display:inline-block;background:#111;color:#fff!important;padding:17px 48px;text-decoration:none;font-size:12px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;">
        Review &amp; Approve &rarr;
      </a>
    </div>
  `);
}

export { ADMIN_EMAIL, WHATSAPP_LINK, WHATSAPP_NUMBER };
