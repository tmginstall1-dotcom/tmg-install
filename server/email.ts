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

// ─── Core layout ────────────────────────────────────────────────────────────────
// All layout uses tables + fully inlined styles for maximum email client compatibility
// (Outlook, Gmail, Apple Mail, Samsung Mail, iOS Mail, Outlook.com, Yahoo Mail)

const FONT = "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;";
const FONT_BLACK = "font-family:'Arial Black',Arial,'Helvetica Neue',Helvetica,sans-serif;";
const MONO = "font-family:'Courier New',Courier,monospace;";

function shell(contextLine: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="x-apple-disable-message-reformatting"/>
<title>TMG Install</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
@media only screen and (max-width:620px){
  .outer-td{padding:16px 8px 32px!important}
  .card-width{width:100%!important}
  .bdy-td{padding:28px 20px!important}
  .hdr-td{padding:36px 20px!important}
  .ftr-td{padding:20px!important}
  .cta-amt{font-size:28px!important}
  .cta-btn-td{padding:13px 28px!important}
  .itms-th,.itms-td{padding:8px 6px!important}
  .inf-td{padding:9px 0!important}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#f2f2f2;${FONT}">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f2f2" style="background-color:#f2f2f2;">
  <tr>
    <td align="center" class="outer-td" style="padding:32px 16px 48px;">
      <!--[if mso]>
      <table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
      <![endif]-->
      <table class="card-width" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:600px;background-color:#ffffff;border:1px solid #e0e0e0;">

        <!-- HEADER -->
        <tr>
          <td bgcolor="#111111" class="hdr-td" align="center" style="padding:48px 40px 40px;background-color:#111111;">
            <div style="${FONT_BLACK}font-size:17px;font-weight:900;letter-spacing:9px;color:#ffffff;text-transform:uppercase;mso-line-height-rule:exactly;line-height:1.2;">TMG&nbsp;Install</div>
            <!-- rule -->
            <table width="36" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 0;"><tr><td height="1" bgcolor="rgba(255,255,255,0.2)" style="background-color:#444444;font-size:0;line-height:0;">&nbsp;</td></tr></table>
            <div style="margin-top:16px;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.45);${FONT}">${contextLine}</div>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td class="bdy-td" style="padding:36px 40px 0;">
            ${body}
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="ftr-td" style="padding:24px 40px 32px;border-top:1px solid #ebebeb;text-align:center;">
            <p style="${FONT}font-size:11px;color:#bbbbbb;line-height:1.8;margin:0 0 4px;">
              <a href="${WEBSITE}" style="color:#999999;text-decoration:none;">tmginstall.com</a>
              &nbsp;&middot;&nbsp;
              <a href="${TERMS_URL}" style="color:#999999;text-decoration:none;">Terms &amp; Conditions</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:${SALES_EMAIL}" style="color:#999999;text-decoration:none;">${SALES_EMAIL}</a>
            </p>
            <p style="${FONT}font-size:11px;color:#bbbbbb;line-height:1.8;margin:0;">Operated by The Moving Guy Pte Ltd &middot; UEN 202424156H</p>
            <p style="${FONT}font-size:11px;color:#bbbbbb;line-height:1.8;margin:0;">${ADDRESS}</p>
            <p style="${FONT}font-size:10px;color:#cccccc;margin:8px 0 0;">&copy; 2026 TMG Install. All rights reserved.</p>
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</body>
</html>`;
}

// ─── Building-block helpers ─────────────────────────────────────────────────────

function refBlock(refNo: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid #ebebeb;">
      <tr>
        <td>
          <div style="${FONT}font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#aaaaaa;margin-bottom:6px;">Reference</div>
          <div style="${MONO}font-size:16px;font-weight:800;letter-spacing:3px;color:#111111;">${refNo}</div>
        </td>
      </tr>
    </table>`;
}

function sectionLabel(label: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;"><tr><td style="${FONT}font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#aaaaaa;padding-bottom:10px;border-bottom:1px solid #ebebeb;">${label}</td></tr></table>`;
}

function section(label: string, content: string): string {
  return `${sectionLabel(label)}<div style="margin-top:0;">${content}</div>`;
}

function infoTable(rows: Array<[string, string]>): string {
  const trs = rows.map(([l, v], i) => {
    const border = `border-bottom:1px solid #f2f2f2;`;
    return `<tr>
      <td class="inf-td" width="42%" valign="top" style="${FONT}padding:10px 0;font-size:14px;color:#888888;${border}">${l}</td>
      <td class="inf-td" valign="top" style="${FONT}padding:10px 0 10px 12px;font-size:14px;font-weight:600;color:#111111;${border}">${v}</td>
    </tr>`;
  }).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>${trs}</tbody></table>`;
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
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#111111" style="margin-top:2px;">
      <tr>
        <td bgcolor="#111111" style="padding:24px 28px;background-color:#111111;">
          <div style="${FONT}font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:8px;">Appointment</div>
          <div style="${FONT}font-size:16px;font-weight:700;color:#ffffff;margin-bottom:4px;line-height:1.3;">${dateStr}</div>
          <div style="${FONT}font-size:13px;color:rgba(255,255,255,0.5);">${timeWindow}</div>
        </td>
      </tr>
    </table>`;
}

function itemsTable(items: any[]): string {
  if (!items || items.length === 0) {
    return `<p style="${FONT}font-size:13px;color:#aaaaaa;padding:12px 0;">No items recorded.</p>`;
  }
  const rows = items.map(it => `
    <tr>
      <td valign="top" style="${FONT}padding:11px 8px;border-bottom:1px solid #f2f2f2;font-size:13px;color:#111111;word-break:break-word;">
        <strong>${it.detectedName || it.originalDescription}</strong>
        <span style="${FONT}font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#999999;display:block;margin-top:3px;">${it.serviceType}</span>
      </td>
      <td valign="top" align="center" style="${FONT}padding:11px 8px;border-bottom:1px solid #f2f2f2;font-size:13px;color:#888888;white-space:nowrap;">&times;${it.quantity}</td>
      <td valign="top" align="right" style="${FONT}padding:11px 8px;border-bottom:1px solid #f2f2f2;font-size:13px;color:#888888;white-space:nowrap;">$${Number(it.unitPrice).toFixed(2)}</td>
      <td valign="top" align="right" style="${FONT}padding:11px 8px;border-bottom:1px solid #f2f2f2;font-size:13px;font-weight:700;color:#111111;white-space:nowrap;">$${Number(it.subtotal).toFixed(2)}</td>
    </tr>`).join('');
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:2px;">
      <thead>
        <tr bgcolor="#111111">
          <th class="itms-th" align="left" width="46%" style="padding:9px 8px;${FONT}font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);background-color:#111111;">Item</th>
          <th class="itms-th" align="center" width="12%" style="padding:9px 8px;${FONT}font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);background-color:#111111;">Qty</th>
          <th class="itms-th" align="right" width="18%" style="padding:9px 8px;${FONT}font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);background-color:#111111;">Unit</th>
          <th class="itms-th" align="right" width="24%" style="padding:9px 8px;${FONT}font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.6);background-color:#111111;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function totRow(color: string, label: string, value: string, bold = false): string {
  const w = bold ? 'font-weight:800;font-size:15px;' : 'font-weight:600;font-size:14px;';
  return `<tr>
    <td style="${FONT}padding:10px 0;${w}color:${color};border-bottom:1px solid #f2f2f2;">${label}</td>
    <td align="right" style="${FONT}padding:10px 0 10px 16px;${w}color:${color};border-bottom:1px solid #f2f2f2;white-space:nowrap;">${value}</td>
  </tr>`;
}

function totals(subtotal: any, transport: any, total: any, deposit: any, balance: any): string {
  const hasTransport = Number(transport || 0) > 0;
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #111111;margin-top:2px;">
      <tbody>
        ${totRow('#444444', 'Labour', `$${Number(subtotal || 0).toFixed(2)}`)}
        ${hasTransport ? totRow('#444444', 'Transport &amp; logistics', `$${Number(transport || 0).toFixed(2)}`) : ''}
        ${totRow('#111111', 'Total', `$${Number(total || 0).toFixed(2)}`, true)}
        ${totRow('#15803d', 'Deposit paid (50%)', `$${Number(deposit || 0).toFixed(2)}`)}
        ${totRow('#999999', 'Balance on completion (50%)', `$${Number(balance || 0).toFixed(2)}`)}
      </tbody>
    </table>`;
}

function contactStrip(): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
      <tr>
        <td width="49%" style="border:1px solid #e0e0e0;padding:16px 12px;text-align:center;vertical-align:middle;">
          <a href="mailto:${SALES_EMAIL}" style="text-decoration:none;display:block;">
            <div style="${FONT}font-size:18px;margin-bottom:6px;">&#9993;</div>
            <div style="${FONT}font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#aaaaaa;margin-bottom:4px;">Email</div>
            <div style="${FONT}font-size:11px;font-weight:700;color:#111111;">${SALES_EMAIL}</div>
          </a>
        </td>
        <td width="2%">&nbsp;</td>
        <td width="49%" style="border:1px solid #e0e0e0;padding:16px 12px;text-align:center;vertical-align:middle;">
          <a href="${WHATSAPP_LINK}" style="text-decoration:none;display:block;">
            <div style="${FONT}font-size:18px;margin-bottom:6px;">&#128172;</div>
            <div style="${FONT}font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#aaaaaa;margin-bottom:4px;">WhatsApp</div>
            <div style="${FONT}font-size:11px;font-weight:700;color:#111111;">${WHATSAPP_NUMBER}</div>
          </a>
        </td>
      </tr>
    </table>`;
}

function notice(type: 'info' | 'ok' | 'warn', html: string): string {
  const cfg = {
    info: { bg: '#f0f7ff', border: '#3b82f6', color: '#1e3a6e' },
    ok:   { bg: '#f0fdf4', border: '#15803d', color: '#14532d' },
    warn: { bg: '#fffbeb', border: '#f59e0b', color: '#78350f' },
  }[type];
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
      <tr>
        <td width="3" bgcolor="${cfg.border}" style="background-color:${cfg.border};font-size:0;line-height:0;">&nbsp;</td>
        <td style="${FONT}background-color:${cfg.bg};padding:16px 18px;font-size:13px;line-height:1.7;color:${cfg.color};">${html}</td>
      </tr>
    </table>`;
}

function checklist(items: string[]): string {
  const lis = items.map(item => `
    <tr>
      <td valign="top" style="${FONT}font-size:14px;color:#555555;padding:2px 0 2px 8px;">&#8211;</td>
      <td valign="top" style="${FONT}font-size:14px;color:#333333;padding:9px 0 9px 10px;border-bottom:1px solid #f2f2f2;line-height:1.55;">${item}</td>
    </tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tbody>${lis}</tbody></table>`;
}

function divider(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;"><tr><td height="1" bgcolor="#f2f2f2" style="font-size:0;line-height:0;background-color:#f2f2f2;">&nbsp;</td></tr></table>`;
}

function ctaBlock(label: string, amount: string, btnText: string, btnUrl: string, sub: string, btnBg = '#111111'): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fafafa" style="background-color:#fafafa;border-top:1px solid #ebebeb;border-bottom:1px solid #ebebeb;margin:36px 0;">
      <tr>
        <td align="center" style="padding:40px 28px;">
          <div style="${FONT}font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#999999;margin-bottom:10px;">${label}</div>
          <div class="cta-amt" style="${FONT_BLACK}font-size:38px;font-weight:900;color:#111111;margin-bottom:24px;line-height:1;letter-spacing:-1px;">${amount}</div>
          <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>
              <td class="cta-btn-td" bgcolor="${btnBg}" align="center" style="background-color:${btnBg};padding:15px 44px;">
                <a href="${btnUrl}" style="${FONT}font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;display:block;">${btnText}</a>
              </td>
            </tr>
          </table>
          <div style="${FONT}font-size:11px;color:#bbbbbb;margin-top:14px;line-height:1.6;">${sub}</div>
        </td>
      </tr>
    </table>`;
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

function greeting(name: string, body: string): string {
  return `<p style="${FONT}font-size:16px;color:#111111;margin:0 0 24px;line-height:1.7;">Hi <strong>${name}</strong>,</p>
  <p style="${FONT}font-size:14px;color:#555555;margin:0 0 28px;line-height:1.75;">${body}</p>`;
}

// ─── Customer-facing emails ─────────────────────────────────────────────────────

export function estimateSubmittedEmail(quote: any): string {
  const c = quote.customer;
  return shell("Estimate Received", `
    ${greeting(c?.name, `Thank you for reaching out. We've received your estimate request and our team will review it shortly. You can expect to hear from us within 1 business day.`)}

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

    ${notice("info", `<strong>What happens next?</strong><br>Our team will review your estimate, confirm the pricing, and send you a deposit invoice. Once the 50% deposit is paid, your appointment slot is locked in.`)}

    ${divider()}
    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">
      By proceeding, you agree to our <a href="${TERMS_URL}" style="color:#888888;">Terms &amp; Conditions</a>.
      The 50% deposit is non-refundable once payment is made.
    </p>
  `);
}

export function depositRequestEmail(quote: any, paymentLink: string): string {
  const c = quote.customer;
  const slotDate = quote.preferredDate ? fmtDate(quote.preferredDate) : null;

  return shell("Deposit Invoice", `
    ${greeting(c?.name, `Your estimate has been reviewed and approved. Please pay the 50% deposit below to confirm your appointment. Your slot will be held for <strong>48 hours</strong> from the time of this email.`)}

    ${refBlock(quote.referenceNo)}

    ${slotDate ? section("Your Slot", `
      ${dateBox(slotDate, quote.preferredTimeWindow || '')}
      <p style="${FONT}font-size:12px;color:#aaaaaa;margin:10px 0 0;line-height:1.6;">This slot is provisionally reserved. Pay the deposit before it expires to guarantee your preferred date and time.</p>
    `) : ''}

    ${section("Service Details", infoTable([
      ...addressRows(quote),
      ["Contact name", c?.name || ""],
      ["Contact number", c?.phone || ""],
    ]))}

    ${section("Scope of Work", itemsTable(quote.items))}

    ${section("Payment Breakdown", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount))}

    ${ctaBlock(
      "Deposit due now — 50%",
      `$${Number(quote.depositAmount || 0).toFixed(2)}`,
      "Pay Now &rarr;",
      paymentLink,
      "Secure payment via Stripe &nbsp;&middot;&nbsp; Card details are never stored.",
    )}

    ${notice("warn", `<strong>Cancellation Policy</strong><br>Cancellation more than 48 hours before your appointment: deposit refunded minus a $30 admin fee.<br>Cancellation less than 48 hours before your appointment: deposit is forfeited in full.<br>Please review the full policy at <a href="${TERMS_URL}" style="color:#92400e;">${TERMS_URL}</a>.`)}

    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">
      By completing payment, you agree to our <a href="${TERMS_URL}" style="color:#888888;">Terms &amp; Conditions</a>.
    </p>
  `);
}

export function depositReceivedEmail(quote: any): string {
  const c = quote.customer;
  const slotDate = quote.preferredDate ? fmtDate(quote.preferredDate) : null;

  return shell("Booking Confirmed", `
    ${greeting(c?.name, `We've received your deposit — thank you. Your booking is now confirmed and our team has been notified. A technician will be assigned to your job and you'll receive your appointment confirmation shortly.`)}

    ${refBlock(quote.referenceNo)}

    ${slotDate ? section("Your Appointment", dateBox(slotDate, quote.preferredTimeWindow || '')) : ''}

    ${section("Payment Summary", `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #111111;margin-top:2px;">
        <tbody>
          ${totRow('#15803d', 'Deposit paid (50%)', `$${Number(quote.depositAmount || 0).toFixed(2)}`)}
          ${totRow('#999999', 'Balance due on completion (50%)', `$${Number(quote.finalAmount || 0).toFixed(2)}`)}
          ${totRow('#111111', 'Total', `$${Number(quote.total || 0).toFixed(2)}`, true)}
        </tbody>
      </table>
    `)}

    ${section("How to Prepare", checklist([
      "Ensure clear access to all items and the full work area before our team arrives",
      "Have photos, assembly manuals, or reference materials ready if available",
      "Make sure someone aged 18 or above is present at the address throughout the appointment",
      "Remove fragile or personal items from the immediate work area beforehand",
      "Note any special access instructions (carpark, loading bay, lift access) and send them to us via WhatsApp",
    ]))}

    ${notice("info", `<strong>Next step:</strong> Our team will assign a technician and send you a formal appointment confirmation with the date, time, and technician details.`)}

    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">
      Need to reschedule? Please contact us at least 48 hours before your appointment.<br>
      See our <a href="${TERMS_URL}" style="color:#888888;">Terms &amp; Conditions</a> for the rescheduling policy.
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
    ${notice("info", `<strong>${c?.name}</strong> has submitted a booking request and selected a preferred appointment slot. Please log in to the admin portal to review and confirm.`)}

    ${refBlock(quote.referenceNo)}

    ${section("Customer", infoTable([
      ["Name", `<strong>${c?.name}</strong>`],
      ["Phone", `<a href="tel:${c?.phone}" style="color:#111111;">${c?.phone}</a>`],
      ["Email", `<a href="mailto:${c?.email}" style="color:#111111;">${c?.email}</a>`],
    ]))}

    ${section("Requested Slot", dateBox(scheduledDate, quote.timeWindow || 'TBD'))}

    ${section("Service Details", infoTable([
      ...addressRows(quote),
      ...(svc.length ? [["Services", svc.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')] as [string, string]] : []),
    ]))}

    ${section("Scope of Work", itemsTable(quote.items))}

    ${section("Financial Summary", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount))}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 8px;text-align:center;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>
              <td bgcolor="#111111" style="padding:15px 44px;background-color:#111111;">
                <a href="${adminUrl}" style="${FONT}font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;display:block;">Review in Admin Portal &rarr;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">&nbsp;</p>
  `);
}

export function bookingConfirmationEmail(quote: any): string {
  const c = quote.customer;
  const scheduledDate = quote.scheduledAt ? fmtDateTime(quote.scheduledAt) : "TBD";

  return shell("Appointment Confirmed", `
    ${greeting(c?.name, `Your appointment has been confirmed by our team. A trained technician has been assigned to your job. Please read through the details below and let us know if you have any questions.`)}

    ${refBlock(quote.referenceNo)}

    ${section("Confirmed Appointment", dateBox(scheduledDate, quote.timeWindow || 'TBD'))}

    ${section("Service Address", infoTable(addressRows(quote)))}

    ${section("Scope of Work", itemsTable(quote.items))}

    ${section("Payment", `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #111111;margin-top:2px;">
        <tbody>
          ${totRow('#15803d', 'Deposit paid (50%)', `$${Number(quote.depositAmount || 0).toFixed(2)}`)}
          ${totRow('#999999', 'Balance due on completion (50%)', `$${Number(quote.finalAmount || 0).toFixed(2)}`)}
          ${totRow('#111111', 'Total', `$${Number(quote.total || 0).toFixed(2)}`, true)}
        </tbody>
      </table>
    `)}

    ${section("On the Day", checklist([
      "Ensure someone aged 18 or above is available at the address for the full duration",
      "Keep the work area clear — remove personal items and fragile objects beforehand",
      "Ensure access to a power outlet if power tools will be required",
      "Have assembly manuals or reference materials ready for the technician",
      `The remaining balance of <strong>$${Number(quote.finalAmount || 0).toFixed(2)}</strong> is due once all work is completed`,
    ]))}

    ${notice("warn", `<strong>Reschedule Policy:</strong> If you need to change your appointment, please contact us on WhatsApp at least <strong>48 hours</strong> before the scheduled time. Late changes may incur a rescheduling fee. Full details at <a href="${TERMS_URL}" style="color:#92400e;">${TERMS_URL}</a>.`)}

    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">&nbsp;</p>
  `);
}

export function rescheduleConfirmationEmail(quote: any): string {
  const c = quote.customer;
  const scheduledDate = quote.scheduledAt ? fmtDateTime(quote.scheduledAt) : "TBD";

  return shell("Reschedule Request Received", `
    ${greeting(c?.name, `We've received your reschedule request. The new slot is pending confirmation from our operations team, and you'll receive a follow-up email once it's confirmed.`)}

    ${refBlock(quote.referenceNo)}

    ${section("Requested New Slot", dateBox(scheduledDate, quote.timeWindow || 'TBD'))}

    ${section("Service Address", infoTable(addressRows(quote)))}

    ${notice("warn", `<strong>Please note:</strong> Each booking is entitled to one complimentary reschedule, subject to availability. Any further reschedule requests, or changes made less than 48 hours before the appointment, may be subject to a rescheduling fee. See our <a href="${TERMS_URL}" style="color:#92400e;">Terms &amp; Conditions</a> for details.`)}

    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">&nbsp;</p>
  `);
}

export function finalPaymentEmail(quote: any, paymentLink: string): string {
  const c = quote.customer;

  return shell("Final Payment Due", `
    ${greeting(c?.name, `Our team has completed all the work on your job. Please settle the remaining 50% balance below to officially close your case. A payment confirmation will be sent to you automatically.`)}

    ${refBlock(quote.referenceNo)}

    ${section("Work Completed", itemsTable(quote.items))}

    ${section("Payment Breakdown", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount))}

    ${ctaBlock(
      "Final balance due — 50%",
      `$${Number(quote.finalAmount || 0).toFixed(2)}`,
      "Pay Final Balance &rarr;",
      paymentLink,
      "Secure payment via Stripe &nbsp;&middot;&nbsp; Your case closes automatically on payment confirmation.",
      "#15803d",
    )}

    ${notice("info", `<strong>Not satisfied with the work?</strong> Please get in touch on WhatsApp before completing payment and we will address your concerns promptly. We stand behind the quality of our work.`)}

    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">
      Payment constitutes acknowledgement that all work has been completed to your satisfaction.<br>
      <a href="${TERMS_URL}" style="color:#888888;">Terms &amp; Conditions</a>
    </p>
  `);
}

export function caseClosedEmail(quote: any): string {
  const c = quote.customer;

  return shell("All Done — Thank You", `
    ${greeting(c?.name, `Your final payment has been received and your case is now closed. Thank you for choosing TMG Install — we hope you are pleased with the result.`)}

    ${refBlock(quote.referenceNo)}

    ${section("Payment Receipt", `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #111111;margin-top:2px;">
        <tbody>
          ${totRow('#15803d', 'Deposit (50%)', `$${Number(quote.depositAmount || 0).toFixed(2)}`)}
          ${totRow('#15803d', 'Final payment (50%)', `$${Number(quote.finalAmount || 0).toFixed(2)}`)}
          ${totRow('#111111', 'Total Paid', `$${Number(quote.total || 0).toFixed(2)}`, true)}
        </tbody>
      </table>
    `)}

    ${section("Work Summary", itemsTable(quote.items))}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fafafa" style="background-color:#fafafa;border-top:1px solid #ebebeb;border-bottom:1px solid #ebebeb;margin:32px 0;">
      <tr>
        <td align="center" style="padding:32px 24px;">
          <div style="${FONT}font-size:26px;margin-bottom:10px;color:#111111;">&#10003;</div>
          <div style="${FONT}font-size:14px;font-weight:700;color:#111111;letter-spacing:0.5px;">Case ${quote.referenceNo} &mdash; Closed</div>
          <div style="${FONT}font-size:12px;color:#aaaaaa;margin-top:6px;">All payments confirmed &nbsp;&middot;&nbsp; Work complete</div>
        </td>
      </tr>
    </table>

    ${notice("ok", `<strong>Need us again?</strong> Save our contact for your next furniture installation, assembly, or relocation job. We cover homes, offices, and commercial spaces across Singapore.`)}

    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">
      If you have any concerns about the completed work, please contact us within 7 days of job closure.<br>
      <a href="${TERMS_URL}" style="color:#888888;">Terms &amp; Conditions</a>
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
    ${notice("info", `A new estimate request has just come in from <strong>${c?.name}</strong>. Please review the items and pricing, then approve to trigger the deposit invoice.`)}

    ${refBlock(quote.referenceNo)}

    ${section("Customer", infoTable([
      ["Name", `<strong>${c?.name}</strong>`],
      ["Phone", `<a href="tel:${c?.phone}" style="color:#111111;">${c?.phone}</a>`],
      ["Email", `<a href="mailto:${c?.email}" style="color:#111111;">${c?.email}</a>`],
    ]))}

    ${section("Service Details", infoTable([
      ...addressRows(quote),
      ...(quote.preferredDate ? [["Preferred date", fmtDate(quote.preferredDate)] as [string, string]] : []),
      ...(quote.preferredTimeWindow ? [["Time window", quote.preferredTimeWindow] as [string, string]] : []),
      ...(svc.length ? [["Services", svc.map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')] as [string, string]] : []),
    ]))}

    ${section(`Items (${(quote.items || []).length})`, itemsTable(quote.items))}

    ${section("Estimated Value", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount))}

    ${quote.requiresManualReview ? notice("warn", `<strong>Manual Review Required</strong> — This estimate was flagged for manual review. Please verify all items and pricing before approving.`) : ''}

    ${quote.notes ? section("Customer Notes", `
      <p style="${FONT}font-size:14px;color:#555555;font-style:italic;line-height:1.7;padding:4px 0;">&ldquo;${quote.notes}&rdquo;</p>
    `) : ''}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 8px;text-align:center;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
            <tr>
              <td bgcolor="#111111" style="padding:15px 44px;background-color:#111111;">
                <a href="${adminUrl}" style="${FONT}font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;white-space:nowrap;display:block;">Review &amp; Approve &rarr;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">&nbsp;</p>
  `);
}

export { ADMIN_EMAIL, WHATSAPP_LINK, WHATSAPP_NUMBER };
