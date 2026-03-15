import { useRef } from "react";
import { format, parseISO } from "date-fns";
import { X, Printer } from "lucide-react";

interface PayslipData {
  id: number;
  periodStart: string;
  periodEnd: string;
  regularHours: string;
  overtimeHours: string;
  basicPay: string;
  regularPay: string;
  overtimePay: string;
  mealAllowance: string;
  leaveDeduction: string;
  grossPay: string;
  notes?: string;
  createdAt?: string;
  isMonthlyBased?: boolean;
  user?: { name: string; username: string; monthlyRate?: string };
}

interface Props {
  payslip: PayslipData;
  staffName?: string;
  staffUsername?: string;
  onClose: () => void;
}

export default function OfficialPayslip({ payslip, staffName, staffUsername, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const name     = staffName     || payslip.user?.name     || "—";
  const username = staffUsername || payslip.user?.username || "—";

  const basic  = parseFloat(payslip.basicPay      || "0");
  const regH   = parseFloat(payslip.regularHours  || "0");
  const regP   = parseFloat(payslip.regularPay    || "0");
  const otH    = parseFloat(payslip.overtimeHours || "0");
  const otP    = parseFloat(payslip.overtimePay   || "0");
  const meal   = parseFloat(payslip.mealAllowance || "0");
  const leave  = parseFloat(payslip.leaveDeduction || "0");
  const gross  = parseFloat(payslip.grossPay       || "0");

  const totalEarnings = basic + regP + otP + meal;
  const mealDays      = meal > 0 ? Math.round(meal / 8) : 0;

  const isMonthly = (payslip.isMonthlyBased !== undefined)
    ? payslip.isMonthlyBased
    : parseFloat(payslip.user?.monthlyRate || "0") > 0;

  const sg = (n: number) => `S$ ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  const pStart  = (() => { try { return format(parseISO(payslip.periodStart), "d MMMM yyyy"); } catch { return payslip.periodStart; } })();
  const pEnd    = (() => { try { return format(parseISO(payslip.periodEnd),   "d MMMM yyyy"); } catch { return payslip.periodEnd;   } })();
  const genDate = payslip.createdAt
    ? (() => { try { return format(new Date(payslip.createdAt!), "d MMMM yyyy"); } catch { return ""; } })()
    : format(new Date(), "d MMMM yyyy");

  const refNo = `PS-${String(payslip.id).padStart(5, "0")}`;

  function handlePrint() {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Payslip – ${name} – ${payslip.periodStart}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    color: #000;
    background: #fff;
  }
  .page { max-width: 660px; margin: 0 auto; padding: 40px 44px 44px; }

  /* ── LETTERHEAD ── */
  .lh-company {
    font-size: 22pt;
    font-weight: 900;
    letter-spacing: -0.5px;
    line-height: 1;
    text-transform: uppercase;
  }
  .lh-sub {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 6px;
  }
  .lh-brand {
    font-size: 8pt;
    font-weight: 900;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #000;
  }
  .lh-meta {
    font-size: 7.5pt;
    color: #666;
    letter-spacing: 0.5px;
    text-align: right;
    line-height: 1.7;
  }

  .rule-thick { border: none; border-top: 3px solid #000; margin: 14px 0 0; }
  .rule-thin  { border: none; border-top: 1px solid #000; margin: 0; }

  /* ── DOC TITLE ── */
  .doc-title {
    font-size: 28pt;
    font-weight: 900;
    letter-spacing: 14px;
    text-transform: uppercase;
    text-align: center;
    padding: 18px 0 16px;
  }

  /* ── INFO GRID ── */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 20px; }
  .info-cell { padding: 9px 0; border-bottom: 1px solid #e0e0e0; }
  .info-cell:nth-child(odd) { padding-right: 24px; }
  .info-label {
    font-size: 7pt;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 3px;
  }
  .info-value { font-size: 10.5pt; font-weight: 700; }

  /* ── SECTION LABEL ── */
  .sec-label {
    font-size: 7pt;
    font-weight: 900;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #888;
    padding: 14px 0 5px;
    border-bottom: 1.5px solid #000;
    margin-bottom: 0;
  }

  /* ── TABLE ── */
  table { width: 100%; border-collapse: collapse; }
  .row td { padding: 7px 0; border-bottom: 1px solid #f0f0f0; font-size: 10pt; }
  .row .note { color: #888; font-size: 8pt; margin-left: 5px; }
  .row td.amt { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }
  .total-row td { padding: 10px 0 4px; font-weight: 900; font-size: 10.5pt; border-top: 1.5px solid #000; }
  .total-row td.amt { text-align: right; font-family: 'Courier New', monospace; }
  .deduct-row td { padding: 7px 0; border-bottom: 1px solid #f5f5f5; font-size: 10pt; color: #000; }
  .deduct-row td.amt { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }

  /* ── NET PAY ── */
  .net-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 16px 0 14px;
    border-top: 3px solid #000;
    margin-top: 16px;
  }
  .net-label {
    font-size: 13pt;
    font-weight: 900;
    letter-spacing: 6px;
    text-transform: uppercase;
  }
  .net-amount {
    font-size: 22pt;
    font-weight: 900;
    font-family: 'Courier New', monospace;
    letter-spacing: -0.5px;
  }

  /* ── NOTES ── */
  .notes-box {
    border: 1px solid #ccc;
    padding: 9px 12px;
    font-size: 9pt;
    color: #444;
    margin-top: 12px;
  }

  /* ── SIGNATURES ── */
  .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 32px; }
  .sig-block .sig-line { border-bottom: 1.5px solid #000; height: 36px; margin-bottom: 6px; }
  .sig-block .sig-label { font-size: 7.5pt; color: #888; letter-spacing: 0.5px; }

  /* ── FOOTER ── */
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-top: 28px;
    padding-top: 12px;
    border-top: 1px solid #e0e0e0;
  }
  .footer-text { font-size: 7.5pt; color: #999; line-height: 1.8; }
  .footer-ref  { font-size: 7pt; font-weight: 900; letter-spacing: 2px; color: #ccc; text-align: right; text-transform: uppercase; }

  @media print { @page { margin: 18mm; } .page { max-width: 100%; padding: 0; } }
</style>
</head>
<body>
<div class="page">

  <!-- Letterhead -->
  <div class="lh-company">The Moving Guy Pte Ltd</div>
  <div class="lh-sub">
    <div class="lh-brand">TMG Install</div>
    <div class="lh-meta">UEN: 202424156H &nbsp;·&nbsp; Singapore &nbsp;·&nbsp; tmginstall.com &nbsp;·&nbsp; sales@tmginstall.com</div>
  </div>
  <hr class="rule-thick"/>
  <hr class="rule-thin"/>

  <!-- Document title -->
  <div class="doc-title">Payslip</div>
  <hr class="rule-thin"/>

  <!-- Employee info -->
  <div class="info-grid" style="margin-top:0;">
    <div class="info-cell">
      <div class="info-label">Employee Name</div>
      <div class="info-value">${name}</div>
    </div>
    <div class="info-cell">
      <div class="info-label">Pay Period</div>
      <div class="info-value">${pStart} – ${pEnd}</div>
    </div>
    <div class="info-cell" style="border-bottom:none;">
      <div class="info-label">Employee ID</div>
      <div class="info-value">@${username}</div>
    </div>
    <div class="info-cell" style="border-bottom:none;">
      <div class="info-label">Date Issued</div>
      <div class="info-value">${genDate}</div>
    </div>
  </div>
  <hr class="rule-thick" style="margin-top:0;"/>

  <!-- Earnings -->
  <div class="sec-label">Earnings</div>
  <table>
    <tbody>
      ${isMonthly ? `
      <tr class="row">
        <td>Basic Salary <span class="note">fixed monthly</span></td>
        <td class="amt">${sg(basic)}</td>
      </tr>
      <tr class="row">
        <td>Regular Pay <span class="note">${regH.toFixed(1)}h</span></td>
        <td class="amt">${sg(regP)}</td>
      </tr>
      ` : `
      <tr class="row">
        <td>Regular Pay <span class="note">${regH.toFixed(1)}h</span></td>
        <td class="amt">${sg(regP)}</td>
      </tr>
      `}
      <tr class="row">
        <td>Overtime Pay <span class="note">${otH.toFixed(1)}h</span></td>
        <td class="amt">${sg(otP)}</td>
      </tr>
      ${meal > 0 ? `
      <tr class="row">
        <td>Meal Allowance <span class="note">${mealDays} day${mealDays !== 1 ? "s" : ""} × S$8.00</span></td>
        <td class="amt">${sg(meal)}</td>
      </tr>` : ""}
      <tr class="total-row">
        <td>Total Earnings</td>
        <td class="amt">${sg(totalEarnings)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Deductions -->
  <div class="sec-label">Deductions</div>
  <table>
    <tbody>
      <tr class="deduct-row">
        <td>Unpaid Leave Deduction</td>
        <td class="amt">( ${sg(leave)} )</td>
      </tr>
    </tbody>
  </table>

  <!-- Net Pay -->
  <div class="net-row">
    <div class="net-label">Net Pay</div>
    <div class="net-amount">${sg(gross)}</div>
  </div>

  ${payslip.notes ? `<div class="notes-box"><strong>Notes:</strong> ${payslip.notes}</div>` : ""}

  <!-- Signatures -->
  <div class="sig-grid">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Authorised Signature &amp; Company Stamp</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Employee Signature &amp; Date</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-text">
      Computer-generated payslip issued by The Moving Guy Pte Ltd (UEN: 202424156H).<br/>
      Payroll enquiries: sales@tmginstall.com
    </div>
    <div class="footer-ref">${refNo}</div>
  </div>

</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
    const w = window.open("", "_blank", "width=820,height=960");
    if (!w) { alert("Please allow popups to print the payslip."); return; }
    w.document.write(html);
    w.document.close();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-black/[0.08] sticky top-0 bg-white z-10">
          <div>
            <p className="font-black text-[11px] uppercase tracking-[0.15em]">Official Payslip</p>
            <p className="text-[10px] text-black/40 mt-0.5">{name} · {pStart} – {pEnd}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-[0.1em] hover:bg-neutral-800 transition-colors"
              data-testid="button-print-payslip"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-black/[0.04] transition-colors"
              data-testid="button-close-payslip-modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Payslip body ── */}
        <div ref={printRef} className="px-8 pt-8 pb-10 font-sans text-black bg-white">

          {/* Letterhead */}
          <h1 className="text-[22px] font-black uppercase tracking-[-0.3px] leading-none">
            The Moving Guy Pte Ltd
          </h1>
          <div className="flex items-end justify-between mt-1.5">
            <span className="text-[9px] font-black uppercase tracking-[3px]">TMG Install</span>
            <span className="text-[9px] text-black/40 tracking-[0.3px]">
              UEN: 202424156H · Singapore · tmginstall.com
            </span>
          </div>

          {/* Double rule */}
          <div className="mt-3 border-t-[3px] border-black" />
          <div className="border-t border-black mt-[3px]" />

          {/* Document title */}
          <p className="text-[32px] font-black uppercase tracking-[12px] text-center py-5 leading-none">
            Payslip
          </p>
          <div className="border-t border-black" />

          {/* Employee info */}
          <div className="grid grid-cols-2 mt-0">
            {[
              { label: "Employee Name", val: name },
              { label: "Pay Period",    val: `${pStart} – ${pEnd}` },
              { label: "Employee ID",   val: `@${username}` },
              { label: "Date Issued",   val: genDate },
            ].map(({ label, val }, i) => (
              <div key={label}
                className={`py-2.5 ${i < 2 ? "border-b border-black/[0.07]" : ""} ${i % 2 === 0 ? "pr-6" : ""}`}>
                <p className="text-[8px] font-black uppercase tracking-[2px] text-black/35 mb-1">{label}</p>
                <p className="text-sm font-bold leading-snug">{val}</p>
              </div>
            ))}
          </div>

          {/* Thick rule after info */}
          <div className="border-t-[3px] border-black mt-0" />

          {/* Earnings */}
          <p className="text-[8px] font-black uppercase tracking-[3px] text-black/35 pt-3.5 pb-2 border-b-[1.5px] border-black">
            Earnings
          </p>
          <table className="w-full text-sm mt-0">
            <tbody>
              {isMonthly && (
                <tr className="border-b border-black/[0.05]">
                  <td className="py-2">Basic Salary <span className="text-black/35 text-[11px]">fixed monthly</span></td>
                  <td className="py-2 text-right font-mono font-bold">{sg(basic)}</td>
                </tr>
              )}
              <tr className="border-b border-black/[0.05]">
                <td className="py-2">Regular Pay <span className="text-black/35 text-[11px]">{regH.toFixed(1)}h</span></td>
                <td className="py-2 text-right font-mono font-bold">{sg(regP)}</td>
              </tr>
              <tr className="border-b border-black/[0.05]">
                <td className="py-2">Overtime Pay <span className="text-black/35 text-[11px]">{otH.toFixed(1)}h</span></td>
                <td className="py-2 text-right font-mono font-bold">{sg(otP)}</td>
              </tr>
              {meal > 0 && (
                <tr className="border-b border-black/[0.05]">
                  <td className="py-2">Meal Allowance <span className="text-black/35 text-[11px]">{mealDays} day{mealDays !== 1 ? "s" : ""} × S$8.00</span></td>
                  <td className="py-2 text-right font-mono font-bold">{sg(meal)}</td>
                </tr>
              )}
              <tr>
                <td className="pt-3 pb-1.5 font-black border-t-[1.5px] border-black">Total Earnings</td>
                <td className="pt-3 pb-1.5 text-right font-mono font-black border-t-[1.5px] border-black">{sg(totalEarnings)}</td>
              </tr>
            </tbody>
          </table>

          {/* Deductions */}
          <p className="text-[8px] font-black uppercase tracking-[3px] text-black/35 pt-3.5 pb-2 border-b-[1.5px] border-black mt-3">
            Deductions
          </p>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-black/[0.05]">
                <td className="py-2 text-black/60">Unpaid Leave Deduction</td>
                <td className="py-2 text-right font-mono font-bold text-black/60">( {sg(leave)} )</td>
              </tr>
            </tbody>
          </table>

          {/* Net Pay */}
          <div className="flex items-baseline justify-between border-t-[3px] border-black mt-4 pt-4">
            <p className="text-[13px] font-black uppercase tracking-[5px]">Net Pay</p>
            <p className="text-[28px] font-black font-mono leading-none">{sg(gross)}</p>
          </div>

          {payslip.notes && (
            <div className="mt-4 border border-black/[0.1] px-4 py-3 text-xs text-black/60">
              <span className="font-bold text-black">Notes: </span>{payslip.notes}
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-10 mt-10">
            <div>
              <div className="border-b-[1.5px] border-black h-9 mb-1.5" />
              <p className="text-[8px] text-black/35 tracking-[0.5px]">Authorised Signature &amp; Company Stamp</p>
            </div>
            <div>
              <div className="border-b-[1.5px] border-black h-9 mb-1.5" />
              <p className="text-[8px] text-black/35 tracking-[0.5px]">Employee Signature &amp; Date</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-end justify-between mt-8 pt-4 border-t border-black/[0.08]">
            <p className="text-[8px] text-black/30 leading-relaxed">
              Computer-generated payslip issued by The Moving Guy Pte Ltd (UEN: 202424156H).<br />
              Payroll enquiries: sales@tmginstall.com
            </p>
            <p className="text-[8px] font-black tracking-[2px] text-black/20 uppercase shrink-0 ml-4">{refNo}</p>
          </div>

        </div>
      </div>
    </div>
  );
}
