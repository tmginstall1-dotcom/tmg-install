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

  const basic  = parseFloat(payslip.basicPay     || "0");
  const regH   = parseFloat(payslip.regularHours || "0");
  const regP   = parseFloat(payslip.regularPay   || "0");
  const otH    = parseFloat(payslip.overtimeHours || "0");
  const otP    = parseFloat(payslip.overtimePay   || "0");
  const meal   = parseFloat(payslip.mealAllowance || "0");
  const leave  = parseFloat(payslip.leaveDeduction || "0");
  const gross  = parseFloat(payslip.grossPay      || "0");

  const totalEarnings = basic + regP + otP + meal;
  const mealDays      = meal > 0 ? Math.round(meal / 8) : 0;

  const isMonthly = (payslip.isMonthlyBased !== undefined)
    ? payslip.isMonthlyBased
    : parseFloat(payslip.user?.monthlyRate || "0") > 0;

  const sg  = (n: number) => `S$ ${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
  const pStart = (() => { try { return format(parseISO(payslip.periodStart), "d MMMM yyyy"); } catch { return payslip.periodStart; } })();
  const pEnd   = (() => { try { return format(parseISO(payslip.periodEnd),   "d MMMM yyyy"); } catch { return payslip.periodEnd;   } })();
  const genDate = payslip.createdAt ? (() => { try { return format(new Date(payslip.createdAt!), "d MMMM yyyy"); } catch { return ""; } })() : format(new Date(), "d MMMM yyyy");

  function handlePrint() {
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Payslip – ${name} – ${payslip.periodStart}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', Arial, Helvetica, sans-serif; font-size:10.5pt; color:#1a1a1a; background:#fff; }
  .page { max-width:680px; margin:0 auto; }

  /* ── Letterhead ── */
  .lh-top { background:#0f172a; padding:22px 32px 18px; display:flex; align-items:center; justify-content:space-between; }
  .lh-logo-mark { display:flex; align-items:center; gap:14px; }
  .lh-square { width:48px; height:48px; background:#e2b97e; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .lh-square span { font-size:11pt; font-weight:900; color:#0f172a; letter-spacing:1px; line-height:1.1; text-align:center; }
  .lh-company { color:#fff; }
  .lh-company-name { font-size:16pt; font-weight:800; letter-spacing:-0.3px; line-height:1.1; }
  .lh-company-sub { font-size:8pt; color:#94a3b8; margin-top:3px; letter-spacing:0.2px; }
  .lh-right { text-align:right; }
  .lh-contact { color:#94a3b8; font-size:8pt; line-height:1.8; }
  .lh-contact strong { color:#cbd5e1; font-weight:600; }
  .accent-bar { height:4px; background:linear-gradient(90deg,#e2b97e 0%,#f59e0b 40%,#0f172a 100%); }

  /* ── Document title band ── */
  .doc-title-band { border-left:4px solid #e2b97e; padding:12px 32px; background:#f8fafc; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; }
  .doc-title { font-size:13pt; font-weight:900; letter-spacing:6px; text-transform:uppercase; color:#0f172a; }
  .doc-ref { font-size:8pt; color:#64748b; font-weight:500; }

  /* ── Body ── */
  .body { padding:24px 32px 32px; }

  /* Employee info grid */
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid #e2e8f0; margin-bottom:22px; }
  .info-cell { padding:10px 14px; border-right:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; }
  .info-cell:nth-child(2n) { border-right:none; }
  .info-cell:nth-child(3), .info-cell:nth-child(4) { border-bottom:none; }
  .info-label { font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#64748b; margin-bottom:3px; }
  .info-value { font-size:10.5pt; font-weight:700; color:#0f172a; }

  /* Section heading */
  .sec-heading { font-size:7.5pt; font-weight:800; text-transform:uppercase; letter-spacing:1.2px; color:#64748b; padding:6px 0 6px; border-bottom:2px solid #0f172a; margin-bottom:2px; display:flex; align-items:center; gap:8px; }
  .sec-heading .pill { background:#0f172a; color:#fff; font-size:6.5pt; font-weight:700; padding:2px 7px; letter-spacing:0.5px; }

  /* Earnings table */
  table { width:100%; border-collapse:collapse; margin-bottom:0; }
  tr.earn-row td { padding:7px 0; border-bottom:1px solid #f1f5f9; font-size:10pt; }
  tr.earn-row td.amt { text-align:right; font-family:'Courier New',monospace; font-weight:700; font-size:10pt; }
  tr.earn-row .sub { color:#94a3b8; font-size:8.5pt; font-weight:400; margin-left:5px; }
  tr.subtotal-row td { padding:9px 0 0; font-weight:800; font-size:10.5pt; border-top:2px solid #0f172a; color:#0f172a; }
  tr.subtotal-row td.amt { text-align:right; font-family:'Courier New',monospace; }
  tr.deduct-row td { padding:7px 0; border-bottom:1px solid #fef2f2; color:#dc2626; font-size:10pt; }
  tr.deduct-row td.amt { text-align:right; font-family:'Courier New',monospace; font-weight:700; color:#dc2626; }

  /* Net pay box */
  .net-box { background:#0f172a; color:#fff; padding:14px 18px; display:flex; align-items:center; justify-content:space-between; margin-top:18px; }
  .net-label { font-size:11pt; font-weight:800; letter-spacing:2px; text-transform:uppercase; }
  .net-amount { font-size:20pt; font-weight:900; font-family:'Courier New',monospace; letter-spacing:-0.5px; color:#e2b97e; }

  /* Notes */
  .notes-box { background:#fffbeb; border:1px solid #fde68a; padding:10px 14px; font-size:9pt; color:#78350f; margin-top:14px; }
  .notes-box strong { font-weight:700; }

  /* Signature */
  .sig-section { margin-top:28px; display:grid; grid-template-columns:1fr 1fr; gap:32px; }
  .sig-block .sig-line { border-bottom:1.5px solid #1e293b; margin-bottom:6px; height:32px; }
  .sig-label { font-size:8pt; color:#64748b; font-weight:500; }
  .sig-block .company-stamp { width:70px; height:70px; border:1.5px dashed #cbd5e1; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:7pt; color:#94a3b8; text-align:center; float:right; margin-top:-36px; }

  /* Footer */
  .footer { margin-top:24px; padding-top:14px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:flex-end; }
  .footer-left { font-size:7.5pt; color:#94a3b8; line-height:1.7; }
  .footer-right { font-size:7.5pt; color:#94a3b8; text-align:right; }
  .footer-right .doc-no { font-size:7pt; font-weight:600; color:#cbd5e1; letter-spacing:0.3px; }

  @media print {
    @page { margin:15mm; }
    .page { max-width:100%; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Letterhead -->
  <div class="lh-top">
    <div class="lh-logo-mark">
      <div class="lh-square"><span>TMG</span></div>
      <div class="lh-company">
        <div class="lh-company-name">The Moving Guy Pte Ltd</div>
        <div class="lh-company-sub">UEN: 202424156H &nbsp;·&nbsp; Singapore</div>
      </div>
    </div>
    <div class="lh-right">
      <div class="lh-contact">
        <strong>TMG Install</strong><br/>
        tmginstall.com<br/>
        sales@tmginstall.com
      </div>
    </div>
  </div>
  <div class="accent-bar"></div>

  <!-- Document title -->
  <div class="doc-title-band">
    <div class="doc-title">Pay Slip</div>
    <div class="doc-ref">Issued: ${genDate}</div>
  </div>

  <div class="body">

    <!-- Employee info -->
    <div class="info-grid">
      <div class="info-cell">
        <div class="info-label">Employee Name</div>
        <div class="info-value">${name}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Pay Period</div>
        <div class="info-value">${pStart} – ${pEnd}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Employee ID</div>
        <div class="info-value">@${username}</div>
      </div>
      <div class="info-cell">
        <div class="info-label">Date Issued</div>
        <div class="info-value">${genDate}</div>
      </div>
    </div>

    <!-- Earnings -->
    <div class="sec-heading">Earnings <span class="pill">SGD</span></div>
    <table>
      <tbody>
        ${isMonthly ? `
        <tr class="earn-row">
          <td>Basic Salary <span class="sub">(fixed monthly)</span></td>
          <td class="amt">${sg(basic)}</td>
        </tr>
        <tr class="earn-row">
          <td>Regular Pay <span class="sub">${regH.toFixed(1)}h</span></td>
          <td class="amt">${sg(regP)}</td>
        </tr>
        ` : `
        <tr class="earn-row">
          <td>Regular Pay <span class="sub">${regH.toFixed(1)}h</span></td>
          <td class="amt">${sg(regP)}</td>
        </tr>
        `}
        <tr class="earn-row">
          <td>Overtime Pay <span class="sub">${otH.toFixed(1)}h</span></td>
          <td class="amt">${sg(otP)}</td>
        </tr>
        ${meal > 0 ? `
        <tr class="earn-row">
          <td>Meal Allowance <span class="sub">${mealDays} day${mealDays !== 1 ? "s" : ""} × S$8.00</span></td>
          <td class="amt">${sg(meal)}</td>
        </tr>` : ""}
        <tr class="subtotal-row">
          <td>Total Earnings</td>
          <td class="amt">${sg(totalEarnings)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Deductions -->
    <div class="sec-heading" style="margin-top:18px;">Deductions</div>
    <table>
      <tbody>
        <tr class="deduct-row">
          <td>Unpaid Leave Deduction</td>
          <td class="amt">( ${sg(leave)} )</td>
        </tr>
      </tbody>
    </table>

    <!-- Net pay -->
    <div class="net-box">
      <div class="net-label">Net Pay</div>
      <div class="net-amount">${sg(gross)}</div>
    </div>

    ${payslip.notes ? `<div class="notes-box"><strong>Notes: </strong>${payslip.notes}</div>` : ""}

    <!-- Signatures -->
    <div class="sig-section">
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-label">Authorised Signature &amp; Company Stamp</div>
        <div class="company-stamp">COMPANY<br/>STAMP</div>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-label">Employee Signature &amp; Date</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-left">
        This is a computer-generated payslip issued by The Moving Guy Pte Ltd (UEN: 202424156H).<br/>
        For payroll enquiries, contact <strong style="color:#64748b;">sales@tmginstall.com</strong>
      </div>
      <div class="footer-right">
        <div class="doc-no">REF: PS-${String(payslip.id).padStart(5,"0")}</div>
        <div style="margin-top:2px;color:#cbd5e1;">tmginstall.com</div>
      </div>
    </div>

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b sticky top-0 bg-white z-10 rounded-t-2xl">
          <div>
            <p className="font-black text-sm">Official Payslip</p>
            <p className="text-xs text-muted-foreground">{name} &nbsp;·&nbsp; {pStart} – {pEnd}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.08em] hover:bg-slate-800 transition-colors"
              data-testid="button-print-payslip">
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
            <button onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              data-testid="button-close-payslip-modal">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Payslip Preview ── */}
        <div ref={printRef} className="font-sans text-zinc-900 text-sm">

          {/* ── Letterhead ── */}
          <div className="bg-slate-900 px-7 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo mark */}
              <div className="w-12 h-12 bg-amber-400 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-black text-slate-900 leading-tight text-center tracking-wider">TMG</span>
              </div>
              <div>
                <p className="text-white font-black text-lg leading-tight tracking-tight">The Moving Guy Pte Ltd</p>
                <p className="text-slate-400 text-[11px] mt-0.5">UEN: 202424156H &nbsp;·&nbsp; Singapore</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-300 text-[11px] font-semibold">TMG Install</p>
              <p className="text-slate-400 text-[10px] mt-0.5">tmginstall.com</p>
              <p className="text-slate-400 text-[10px]">sales@tmginstall.com</p>
            </div>
          </div>
          {/* Accent stripe */}
          <div className="h-1" style={{ background: "linear-gradient(90deg,#e2b97e 0%,#f59e0b 40%,#0f172a 100%)" }} />

          {/* Document title band */}
          <div className="flex items-center justify-between px-7 py-3 bg-slate-50 border-b border-slate-200" style={{ borderLeft: "4px solid #e2b97e" }}>
            <p className="font-black text-slate-900 tracking-[5px] uppercase text-sm">Pay Slip</p>
            <p className="text-[10px] text-slate-500 font-medium">Issued: {genDate}</p>
          </div>

          {/* Body */}
          <div className="px-7 py-6 space-y-5">

            {/* Employee info grid */}
            <div className="grid grid-cols-2 border border-slate-200 text-sm">
              {[
                { label: "Employee Name", val: name },
                { label: "Pay Period",    val: `${pStart} – ${pEnd}` },
                { label: "Employee ID",   val: `@${username}` },
                { label: "Date Issued",   val: genDate },
              ].map(({ label, val }, i) => (
                <div key={label}
                  className={`px-4 py-3 ${i < 2 ? "border-b" : ""} ${i % 2 === 0 ? "border-r" : ""} border-slate-200`}>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400 mb-1">{label}</p>
                  <p className="font-bold text-slate-900 text-sm">{val}</p>
                </div>
              ))}
            </div>

            {/* Earnings */}
            <div>
              <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-1.5 mb-1">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Earnings</p>
                <span className="bg-slate-900 text-white text-[7px] font-black px-2 py-0.5 tracking-wide uppercase">SGD</span>
              </div>
              <table className="w-full">
                <tbody>
                  {isMonthly && (
                    <tr className="border-b border-slate-100">
                      <td className="py-2">Basic Salary <span className="text-slate-400 text-[11px]">(fixed monthly)</span></td>
                      <td className="py-2 text-right font-mono font-bold">{sg(basic)}</td>
                    </tr>
                  )}
                  <tr className="border-b border-slate-100">
                    <td className="py-2">Regular Pay <span className="text-slate-400 text-[11px]">{regH.toFixed(1)}h</span></td>
                    <td className="py-2 text-right font-mono font-bold">{sg(regP)}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="py-2">Overtime Pay <span className="text-slate-400 text-[11px]">{otH.toFixed(1)}h</span></td>
                    <td className="py-2 text-right font-mono font-bold">{sg(otP)}</td>
                  </tr>
                  {meal > 0 && (
                    <tr className="border-b border-slate-100">
                      <td className="py-2">Meal Allowance <span className="text-slate-400 text-[11px]">{mealDays} day{mealDays !== 1 ? "s" : ""} × S$8.00</span></td>
                      <td className="py-2 text-right font-mono font-bold">{sg(meal)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="pt-3 pb-1 font-black border-t-2 border-slate-900">Total Earnings</td>
                    <td className="pt-3 pb-1 text-right font-mono font-black border-t-2 border-slate-900">{sg(totalEarnings)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deductions */}
            <div>
              <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-1.5 mb-1">
                <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">Deductions</p>
              </div>
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-red-50">
                    <td className="py-2 text-red-600">Unpaid Leave Deduction</td>
                    <td className="py-2 text-right font-mono font-bold text-red-600">( {sg(leave)} )</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Pay */}
            <div className="bg-slate-900 flex items-center justify-between px-5 py-4">
              <p className="text-white font-black uppercase tracking-[3px] text-sm">Net Pay</p>
              <p className="text-amber-400 font-black font-mono text-2xl tracking-tight">{sg(gross)}</p>
            </div>

            {payslip.notes && (
              <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
                <span className="font-bold">Notes: </span>{payslip.notes}
              </div>
            )}

            {/* Signature area */}
            <div className="grid grid-cols-2 gap-8 pt-2">
              <div>
                <div className="border-b-2 border-slate-800 mb-1.5 h-10 flex items-end pb-1">
                  <div className="w-16 h-16 border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center ml-auto -mb-1">
                    <span className="text-[7px] text-slate-300 text-center leading-tight font-medium">COMPANY<br/>STAMP</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Authorised Signature &amp; Company Stamp</p>
              </div>
              <div>
                <div className="border-b-2 border-slate-800 mb-1.5 h-10" />
                <p className="text-[10px] text-slate-400 font-medium">Employee Signature &amp; Date</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-end justify-between pt-4 border-t border-slate-200">
              <p className="text-[9px] text-slate-400 leading-relaxed">
                This is a computer-generated payslip issued by The Moving Guy Pte Ltd (UEN: 202424156H).<br />
                For payroll enquiries, contact <span className="font-semibold text-slate-500">sales@tmginstall.com</span>
              </p>
              <div className="text-right shrink-0 ml-4">
                <p className="text-[8px] font-black text-slate-300 tracking-wide">REF: PS-{String(payslip.id).padStart(5, "0")}</p>
                <p className="text-[8px] text-slate-300 mt-0.5">tmginstall.com</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
