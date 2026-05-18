import { PricingConfig } from "@shared/pricing";

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

function isRelocationJob(quote: any): boolean {
  const svc = Array.isArray(quote.selectedServices)
    ? quote.selectedServices
    : (quote.selectedServices ? (() => { try { return JSON.parse(quote.selectedServices as string); } catch { return []; } })() : []);
  return svc.includes('relocate') || (!!quote.pickupAddress && !!quote.dropoffAddress);
}

// Overtime only applies to Carry Only relocation jobs (D&R jobs have no time cap)
function isCarryOnlyRelocation(quote: any): boolean {
  if (!isRelocationJob(quote)) return false;
  // Preferred: explicit relocationMode field (set by /estimate and WhatsApp flows from Apr 2026)
  if (quote.relocationMode === 'carry') return true;
  if (quote.relocationMode === 'full') return false;
  // Legacy fallback for older quotes without the field — was: if any relocate item has unitPrice > 0
  // it's a D&R job. Still works for pre-Round-14 quotes where carry items had unitPrice=0.
  // Note: post-Round-14 carry items have positive unitPrice, but they always have relocationMode set,
  // so the legacy branch only runs for old data.
  const items: any[] = Array.isArray(quote.items) ? quote.items : [];
  const relocateItems = items.filter((i: any) => i.serviceType === 'relocate');
  if (relocateItems.length === 0) return false;
  return !relocateItems.some((i: any) => parseFloat(i.unitPrice ?? '0') > 0);
}

function relocationOvertimeNotice(): string {
  return notice("warn",
    `<strong>Relocation — Additional Charges Notice</strong><br>` +
    `Your quoted price includes up to <strong>2 hours (120 minutes)</strong> of crew and vehicle time. ` +
    `If the job runs longer than 120 minutes, the following additional charges apply:<br><br>` +
    `<strong>+$30 per 30-minute block</strong> &nbsp;&middot;&nbsp; Maximum cap: <strong>$200</strong><br><br>` +
    `These charges are based on Lalamove's standard overtime rates (2 crew × $5 per person per 10 min). ` +
    `To keep things running on time, please ensure all items are ready for collection and the route is clear before the crew arrives. ` +
    `If you expect a longer job, please let us know in advance via WhatsApp.`
  );
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

function totals(subtotal: any, transport: any, total: any, deposit: any, balance: any, promoCode?: string | null, promoDiscount?: any): string {
  const hasTransport = Number(transport || 0) > 0;
  const hasPromo = promoCode && Number(promoDiscount || 0) > 0;
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #111111;margin-top:2px;">
      <tbody>
        ${totRow('#444444', 'Labour', `$${Number(subtotal || 0).toFixed(2)}`)}
        ${hasTransport ? totRow('#444444', 'Transport &amp; logistics', `$${Number(transport || 0).toFixed(2)}`) : ''}
        ${hasPromo ? totRow('#15803d', `Promo code (${promoCode})`, `-$${Number(promoDiscount || 0).toFixed(2)}`) : ''}
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

// Pull the slot date+time-window for a customer email, preferring the
// admin-confirmed scheduledAt/timeWindow over the customer's original
// preferredDate/preferredTimeWindow so reschedules are reflected.
function quoteSlotForEmail(quote: any): { slotDate: string | null; timeWindow: string } {
  if (quote?.scheduledAt) {
    const d = new Date(quote.scheduledAt);
    // SG-local YYYY-MM-DD
    const sg = new Date(d.getTime() + 8 * 60 * 60 * 1000);
    const yyyy = sg.getUTCFullYear();
    const mm = String(sg.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(sg.getUTCDate()).padStart(2, "0");
    return { slotDate: fmtDate(`${yyyy}-${mm}-${dd}`), timeWindow: quote.timeWindow || "" };
  }
  if (quote?.preferredDate && quote.preferredDate.toLowerCase() !== "flexible") {
    return { slotDate: fmtDate(quote.preferredDate), timeWindow: quote.preferredTimeWindow || "" };
  }
  return { slotDate: null, timeWindow: "" };
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

    ${section("Estimated Pricing", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount, quote.promoCode, quote.promoDiscount))}

    ${notice("info", `<strong>What happens next?</strong><br>Our team will review your estimate, confirm the pricing, and send you a deposit invoice. Once the 50% deposit is paid, your appointment slot is locked in.`)}

    ${isCarryOnlyRelocation(quote) ? relocationOvertimeNotice() : ''}

    ${divider()}
    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">
      By proceeding, you agree to our <a href="${TERMS_URL}" style="color:#888888;">Terms &amp; Conditions</a>.
      The 50% deposit is non-refundable once payment is made.
    </p>
  `);
}

export function depositRequestEmail(quote: any, paymentLink: string, payNowQrUrl?: string): string {
  const c = quote.customer;
  const { slotDate, timeWindow: slotTimeWindow } = quoteSlotForEmail(quote);
  const depositAmt = `$${Number(quote.depositAmount || 0).toFixed(2)}`;
  const PAYNOW_UEN = "202424156H";
  const PAYNOW_NAME = "TMG Install by The Moving Guy Pte Ltd";

  const payNowSection = `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td align="center" style="padding:4px 0 20px;">
          <p style="${FONT}font-size:12px;color:#888888;margin:0;letter-spacing:1px;text-transform:uppercase;">— or pay via PayNow —</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px 20px;">
          ${payNowQrUrl ? `<img src="${payNowQrUrl}" width="160" height="160" alt="PayNow QR" style="display:block;margin:0 auto 16px;border-radius:8px;" />` : ''}
          <p style="${FONT}font-size:15px;font-weight:700;color:#111111;margin:0 0 4px;">PayNow Transfer</p>
          <p style="${FONT}font-size:13px;color:#444444;margin:0 0 2px;">UEN: <strong>${PAYNOW_UEN}</strong></p>
          <p style="${FONT}font-size:13px;color:#444444;margin:0 0 16px;">${PAYNOW_NAME}</p>
          <table style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 20px;margin:0 auto 16px;">
            <tr>
              <td style="${FONT}font-size:13px;color:#166534;text-align:center;">
                Amount to transfer: <strong style="font-size:18px;">${depositAmt}</strong>
              </td>
            </tr>
          </table>
          <p style="${FONT}font-size:12px;color:#555555;margin:0;line-height:1.7;">
            After transferring, please <strong>WhatsApp us at ${WHATSAPP_NUMBER}</strong><br>
            with a <strong>screenshot of your payment receipt</strong>.<br>
            <span style="color:#888888;">Our team will confirm your booking once payment is verified.</span>
          </p>
        </td>
      </tr>
    </table>
  `;

  return shell("Deposit Invoice", `
    ${greeting(c?.name, `Your estimate has been reviewed and approved. Please pay the 50% deposit below to confirm your appointment. Your slot will be held for <strong>48 hours</strong> from the time of this email.`)}

    ${refBlock(quote.referenceNo)}

    ${slotDate ? section("Your Slot", `
      ${dateBox(slotDate, slotTimeWindow)}
      <p style="${FONT}font-size:12px;color:#aaaaaa;margin:10px 0 0;line-height:1.6;">This slot is provisionally reserved. Pay the deposit before it expires to guarantee your preferred date and time.</p>
    `) : ''}

    ${section("Service Details", infoTable([
      ...addressRows(quote),
      ["Contact name", c?.name || ""],
      ["Contact number", c?.phone || ""],
    ]))}

    ${section("Scope of Work", itemsTable(quote.items))}

    ${section("Payment Breakdown", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount, quote.promoCode, quote.promoDiscount))}

    ${section("Pay Deposit — 2 Ways", `
      ${ctaBlock(
        "Option 1 — Pay by Card (Stripe)",
        depositAmt,
        "Pay Securely &rarr;",
        paymentLink,
        "Secure payment via Stripe &nbsp;&middot;&nbsp; Card details are never stored.",
      )}
      ${payNowSection}
    `)}

    ${isCarryOnlyRelocation(quote) ? relocationOvertimeNotice() : ''}

    ${notice("warn", `<strong>Cancellation Policy</strong><br>Cancellation more than 48 hours before your appointment: deposit refunded minus a $30 admin fee.<br>Cancellation less than 48 hours before your appointment: deposit is forfeited in full.<br>Please review the full policy at <a href="${TERMS_URL}" style="color:#92400e;">${TERMS_URL}</a>.`)}

    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">
      By completing payment, you agree to our <a href="${TERMS_URL}" style="color:#888888;">Terms &amp; Conditions</a>.
    </p>
  `);
}

export function depositReceivedEmail(quote: any): string {
  const c = quote.customer;
  const { slotDate, timeWindow: slotTimeWindow } = quoteSlotForEmail(quote);

  return shell("Booking Confirmed", `
    ${greeting(c?.name, `We've received your deposit — thank you. Your booking is now confirmed and our team has been notified. A technician will be assigned to your job and you'll receive your appointment confirmation shortly.`)}

    ${refBlock(quote.referenceNo)}

    ${slotDate ? section("Your Appointment", dateBox(slotDate, slotTimeWindow)) : ''}

    ${section("Payment Summary", `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #111111;margin-top:2px;">
        <tbody>
          ${totRow('#444444', 'Labour', `$${Number(quote.subtotal || 0).toFixed(2)}`)}
          ${Number(quote.transportFee || 0) > 0 ? totRow('#444444', 'Transport &amp; logistics', `$${Number(quote.transportFee || 0).toFixed(2)}`) : ''}
          ${quote.promoCode && Number(quote.promoDiscount || 0) > 0 ? totRow('#15803d', `Promo code (${quote.promoCode})`, `-$${Number(quote.promoDiscount || 0).toFixed(2)}`) : ''}
          ${totRow('#111111', 'Total', `$${Number(quote.total || 0).toFixed(2)}`, true)}
          ${totRow('#15803d', 'Deposit paid (50%)', `$${Number(quote.depositAmount || 0).toFixed(2)}`)}
          ${totRow('#999999', 'Balance due on completion (50%)', `$${Number(quote.finalAmount || 0).toFixed(2)}`)}
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

    ${isCarryOnlyRelocation(quote) ? relocationOvertimeNotice() : ''}

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

    ${section("Financial Summary", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount, quote.promoCode, quote.promoDiscount))}

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

    ${isCarryOnlyRelocation(quote) ? relocationOvertimeNotice() : ''}

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

  const hasOvertime = Number(quote.additionalCharge || 0) > 0;
  const baseBalance = Number(quote.finalAmount || 0);
  const overtimeAmt = Number(quote.additionalCharge || 0);
  const totalDueNow = baseBalance + overtimeAmt;

  return shell("Final Payment Due", `
    ${greeting(c?.name, `Our team has completed all the work on your job. Please settle the remaining balance below to officially close your case. A payment confirmation will be sent to you automatically.`)}

    ${refBlock(quote.referenceNo)}

    ${section("Work Completed", itemsTable(quote.items))}

    ${section("Payment Breakdown", `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #111111;margin-top:2px;">
        <tbody>
          ${totRow('#444444', 'Labour', `$${Number(quote.subtotal || 0).toFixed(2)}`)}
          ${Number(quote.transportFee || 0) > 0 ? totRow('#444444', 'Transport &amp; logistics', `$${Number(quote.transportFee || 0).toFixed(2)}`) : ''}
          ${quote.promoCode && Number(quote.promoDiscount || 0) > 0 ? totRow('#15803d', `Promo code (${quote.promoCode})`, `-$${Number(quote.promoDiscount || 0).toFixed(2)}`) : ''}
          ${totRow('#444444', 'Original total', `$${Number(quote.total || 0).toFixed(2)}`)}
          ${totRow('#15803d', 'Deposit paid (50%)', `-$${Number(quote.depositAmount || 0).toFixed(2)}`)}
          ${totRow('#444444', 'Balance (50%)', `$${baseBalance.toFixed(2)}`)}
          ${hasOvertime ? totRow('#b45309', `${quote.additionalChargeNote || 'Overtime charges'}`, `+$${overtimeAmt.toFixed(2)}`) : ''}
          ${totRow('#111111', 'Total due now', `$${totalDueNow.toFixed(2)}`, true)}
        </tbody>
      </table>
    `)}

    ${hasOvertime ? notice("warn",
      `<strong>Overtime charge applied automatically.</strong><br>` +
      `${quote.additionalChargeNote || `Overtime charges: $${overtimeAmt.toFixed(2)}`}<br><br>` +
      `Charges are billed at <strong>$${PricingConfig.overtime.blockRate} per 30-minute block</strong> beyond the included 120-minute allowance, capped at $200. ` +
      `If you have any questions about this charge, please contact us on WhatsApp before completing payment.`
    ) : ''}

    ${ctaBlock(
      "Option 1 — Pay by Card (Stripe)",
      `$${totalDueNow.toFixed(2)}`,
      "Pay Securely &rarr;",
      paymentLink,
      "Secure payment via Stripe &nbsp;&middot;&nbsp; Your case closes automatically on payment confirmation.",
      "#15803d",
    )}

    ${section("Option 2 — Pay via PayNow", `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
        <tr>
          <td align="center" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:24px 20px;">
            <p style="${FONT}font-size:15px;font-weight:700;color:#111111;margin:0 0 4px;">PayNow Transfer</p>
            <p style="${FONT}font-size:13px;color:#444444;margin:0 0 2px;">UEN: <strong>202424156H</strong></p>
            <p style="${FONT}font-size:13px;color:#444444;margin:0 0 16px;">TMG Install by The Moving Guy Pte Ltd</p>
            <table style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 20px;margin:0 auto 16px;">
              <tr>
                <td style="${FONT}font-size:13px;color:#166534;text-align:center;">
                  Amount to transfer: <strong style="font-size:18px;">$${totalDueNow.toFixed(2)}</strong>
                </td>
              </tr>
            </table>
            <p style="${FONT}font-size:12px;color:#555555;margin:0;line-height:1.7;">
              After transferring, please <strong>WhatsApp us at ${WHATSAPP_NUMBER}</strong><br>
              with a <strong>screenshot of your payment receipt</strong>.<br>
              <span style="color:#888888;">Our team will confirm once payment is verified.</span>
            </p>
          </td>
        </tr>
      </table>
    `)}

    ${notice("info", `<strong>Not satisfied with the work?</strong> Please get in touch on WhatsApp before completing payment and we will address your concerns promptly. We stand behind the quality of our work.`)}

    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">
      Payment constitutes acknowledgement that all work has been completed to your satisfaction.<br>
      <a href="${TERMS_URL}" style="color:#888888;">Terms &amp; Conditions</a>
    </p>
  `);
}

// ── Commercial flow ────────────────────────────────────────────────────────
// Commercial customers do not pay a deposit. Bookings are confirmed by the
// admin (no upfront money), and a full invoice with Net 30 terms is issued
// only after the job is completed.

export function commercialBookingConfirmEmail(quote: any): string {
  const c = quote.customer;
  const scheduledDate = quote.scheduledAt ? fmtDateTime(quote.scheduledAt) : "TBD";
  const companyName = (quote as any).billingCompanyName || c?.companyName || c?.name || "your company";
  const poLine = (quote as any).poNumber
    ? `<p style="${FONT}font-size:13px;color:#444444;margin:0 0 12px;">PO Reference: <strong>${(quote as any).poNumber}</strong></p>`
    : "";

  return shell("Booking Confirmed", `
    ${greeting(c?.name, `Thank you for engaging The Moving Guy for ${companyName}. Your booking has been confirmed by our operations team. A trained crew will be assigned to your job. No payment is required upfront — an invoice will be issued upon completion of the work, payable on Net 30 terms.`)}

    ${refBlock(quote.referenceNo)}

    ${poLine}

    ${section("Confirmed Appointment", dateBox(scheduledDate, quote.timeWindow || 'TBD'))}

    ${section("Service Address", infoTable(addressRows(quote)))}

    ${section("Scope of Work", itemsTable(quote.items))}

    ${section("Estimated Total", `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #111111;margin-top:2px;">
        <tbody>
          ${totRow('#111111', 'Total (invoiced after completion)', `$${Number(quote.total || 0).toFixed(2)}`, true)}
        </tbody>
      </table>
      <p style="${FONT}font-size:12px;color:#888888;margin:10px 0 0;line-height:1.6;">A tax invoice with our PayNow / bank transfer details will be sent once the work is completed, payable within 30 days.</p>
    `)}

    ${section("On the Day", checklist([
      "Ensure a designated contact aged 18 or above is on-site for the full duration",
      "Keep the work area clear and accessible",
      "Ensure access to a power outlet if power tools will be required",
      "Have assembly manuals or reference materials ready for the crew",
    ]))}

    ${notice("warn", `<strong>Reschedule Policy:</strong> If you need to change this appointment, please contact us on WhatsApp at least <strong>48 hours</strong> in advance. Late changes may incur a rescheduling fee. Full details at <a href="${TERMS_URL}" style="color:#92400e;">${TERMS_URL}</a>.`)}

    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">&nbsp;</p>
  `);
}

export function commercialInvoiceEmail(quote: any, viewUrl: string, dueDateStr: string): string {
  const c = quote.customer;
  const refTail = String(quote.referenceNo || "").replace(/^TMG-?/i, "");
  const invoiceNo = `INV-${refTail || quote.id}`;
  const companyName = (quote as any).billingCompanyName || c?.companyName || c?.name || "your company";
  const poLine = (quote as any).poNumber
    ? `<p style="${FONT}font-size:13px;color:#444444;margin:0 0 12px;">PO Reference: <strong>${(quote as any).poNumber}</strong></p>`
    : "";
  const PAYNOW_UEN = "202424156H";

  return shell("Tax Invoice — Net 30", `
    ${greeting(c?.name, `The work for ${companyName} has been completed. Please find below your tax invoice <strong>${invoiceNo}</strong>, payable on Net 30 terms by <strong>${dueDateStr}</strong>.`)}

    ${refBlock(quote.referenceNo)}

    ${poLine}

    ${section("Invoice Summary", `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:2px solid #111111;margin-top:2px;">
        <tbody>
          ${totRow('#444444', 'Invoice number', invoiceNo)}
          ${totRow('#444444', 'Job reference', quote.referenceNo)}
          ${totRow('#444444', 'Payment terms', 'Net 30')}
          ${totRow('#b45309', 'Due date', dueDateStr)}
          ${totRow('#111111', 'Amount due', `$${Number(quote.total || 0).toFixed(2)}`, true)}
        </tbody>
      </table>
    `)}

    ${section("Work Completed", itemsTable(quote.items))}

    ${section("Payment Methods", `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:18px;">
        <tr><td style="${FONT}font-size:14px;font-weight:700;color:#111111;padding:0 0 8px;">PayNow (UEN)</td></tr>
        <tr><td style="${FONT}font-size:13px;color:#444444;padding:0 0 14px;">UEN: <strong>${PAYNOW_UEN}</strong> &nbsp;&middot;&nbsp; The Moving Guy Pte Ltd</td></tr>
        <tr><td style="${FONT}font-size:14px;font-weight:700;color:#111111;padding:0 0 8px;">Bank Transfer</td></tr>
        <tr><td style="${FONT}font-size:13px;color:#444444;padding:0;">OCBC Bank &nbsp;&middot;&nbsp; <strong>596-795617-001</strong><br>Account name: The Moving Guy Pte. Ltd. &nbsp;&middot;&nbsp; SGD</td></tr>
      </table>
      <p style="${FONT}font-size:12px;color:#666666;margin:14px 0 0;line-height:1.6;">Please quote <strong>${invoiceNo}</strong> in your payment remarks and email the remittance advice to <a href="mailto:sales@tmginstall.com" style="color:#666666;">sales@tmginstall.com</a>.</p>
    `)}

    ${section("View / Download Invoice", ctaBlock(
      "Full Tax Invoice PDF",
      `$${Number(quote.total || 0).toFixed(2)}`,
      "View Invoice &rarr;",
      viewUrl,
      "Open the job page to view or download the full tax invoice PDF.",
    ))}

    ${notice("info", `<strong>Late payment:</strong> Invoices unpaid after the due date may incur a 1.5% per month administrative charge on the outstanding balance.`)}

    ${contactStrip()}

    <p style="${FONT}font-size:11px;color:#bbbbbb;text-align:center;margin:0 0 28px;">
      All prices are in Singapore Dollars (SGD). The Moving Guy Pte Ltd is not GST-registered.<br>
      <a href="${TERMS_URL}" style="color:#888888;">Terms &amp; Conditions</a>
    </p>
  `);
}

export function caseClosedEmail(quote: any, reviewUrl?: string): string {
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

    ${reviewUrl ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
      <tr>
        <td align="center" style="padding:28px 24px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
          <div style="${FONT}font-size:22px;margin-bottom:8px;">⭐</div>
          <div style="${FONT}font-size:15px;font-weight:700;color:#92400e;margin-bottom:6px;">Happy with the service?</div>
          <div style="${FONT}font-size:13px;color:#78350f;margin-bottom:16px;">A quick Google review means the world to our small team.</div>
          <a href="${reviewUrl}" style="display:inline-block;background:#111111;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">Leave a Google Review</a>
        </td>
      </tr>
    </table>
    ` : ""}

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

    ${section("Estimated Value", totals(quote.subtotal, quote.transportFee, quote.total, quote.depositAmount, quote.finalAmount, quote.promoCode, quote.promoDiscount))}

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
