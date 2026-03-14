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
    const el = printRef.current;
    if (!el) return;
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Payslip – ${name} – ${payslip.periodStart}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #111; background: #fff; }
  .page { max-width: 700px; margin: 0 auto; padding: 32px 40px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; }
  .company-name { font-size:17pt; font-weight:900; letter-spacing:-0.5px; color:#111; }
  .company-sub { font-size:9pt; color:#555; margin-top:3px; }
  .badge { background:#111; color:#fff; font-size:11pt; font-weight:900; padding:8px 14px; border-radius:6px; letter-spacing:1px; }
  .divider { border:none; border-top:2.5px solid #111; margin:16px 0; }
  .divider-thin { border:none; border-top:1px solid #ccc; margin:10px 0; }
  .title { font-size:14pt; font-weight:900; text-align:center; letter-spacing:4px; margin-bottom:18px; }
  .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; margin-bottom:18px; font-size:10pt; }
  .meta-label { color:#777; font-size:8.5pt; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
  .meta-value { font-weight:700; }
  .section-title { font-size:9pt; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:#555; margin:14px 0 6px; }
  table { width:100%; border-collapse:collapse; }
  tr.row { border-bottom:1px solid #f0f0f0; }
  td { padding:5px 0; font-size:10.5pt; }
  td.right { text-align:right; font-family:monospace; font-size:10.5pt; }
  tr.subtotal td { font-weight:700; border-top:1.5px solid #111; padding-top:8px; }
  tr.deduction td { color:#c00; }
  tr.net td { font-size:13pt; font-weight:900; color:#111; border-top:2px solid #111; padding-top:8px; }
  .footer { margin-top:30px; font-size:8.5pt; color:#888; text-align:center; border-top:1px solid #ddd; padding-top:12px; }
  .sig-row { display:flex; justify-content:space-between; margin-top:30px; font-size:9.5pt; }
  .sig-block { width:220px; }
  .sig-line { border-bottom:1px solid #111; margin-bottom:5px; height:28px; }
  .notes-box { background:#f9f9f9; border:1px solid #ddd; border-radius:4px; padding:8px 12px; font-size:9.5pt; color:#555; margin-top:12px; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="company-name">The Moving Guy Pte Ltd</div>
      <div class="company-sub">UEN: 202424156H &nbsp;|&nbsp; Singapore &nbsp;|&nbsp; tmginstall.com</div>
    </div>
    <div class="badge">TMG INSTALL</div>
  </div>
  <hr class="divider"/>
  <div class="title">PAYSLIP</div>

  <div class="meta-grid">
    <div>
      <div class="meta-label">Employee Name</div>
      <div class="meta-value">${name}</div>
    </div>
    <div>
      <div class="meta-label">Pay Period</div>
      <div class="meta-value">${pStart} – ${pEnd}</div>
    </div>
    <div>
      <div class="meta-label">Employee ID</div>
      <div class="meta-value">@${username}</div>
    </div>
    <div>
      <div class="meta-label">Date Issued</div>
      <div class="meta-value">${genDate}</div>
    </div>
  </div>
  <hr class="divider"/>

  <div class="section-title">Earnings</div>
  <table>
    ${isMonthly ? `
    <tr class="row"><td>Basic Salary (fixed)</td><td class="right">${sg(basic)}</td></tr>
    <tr class="row"><td>Regular Pay &nbsp;<span style="color:#777;font-size:9pt;">${regH.toFixed(1)}h</span></td><td class="right">${sg(regP)}</td></tr>
    ` : `
    <tr class="row"><td>Regular Pay &nbsp;<span style="color:#777;font-size:9pt;">${regH.toFixed(1)}h</span></td><td class="right">${sg(regP)}</td></tr>
    `}
    <tr class="row"><td>Overtime Pay &nbsp;<span style="color:#777;font-size:9pt;">${otH.toFixed(1)}h</span></td><td class="right">${sg(otP)}</td></tr>
    ${meal > 0 ? `<tr class="row"><td>Meal Allowance &nbsp;<span style="color:#777;font-size:9pt;">${mealDays} day${mealDays !== 1 ? "s" : ""} × S$8.00</span></td><td class="right">${sg(meal)}</td></tr>` : ""}
    <tr class="subtotal"><td>Total Earnings</td><td class="right">${sg(totalEarnings)}</td></tr>
  </table>

  <div class="section-title" style="margin-top:16px;">Deductions</div>
  <table>
    <tr class="row deduction"><td>Unpaid Leave Deduction</td><td class="right">( ${sg(leave)} )</td></tr>
  </table>

  <hr class="divider" style="margin-top:16px;"/>
  <table>
    <tr class="net"><td>NET PAY</td><td class="right">${sg(gross)}</td></tr>
  </table>

  ${payslip.notes ? `<div class="notes-box"><strong>Notes:</strong> ${payslip.notes}</div>` : ""}

  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div>Authorised Signature &amp; Company Stamp</div>
    </div>
    <div class="sig-block" style="text-align:right;">
      <div class="sig-line"></div>
      <div>Employee Acknowledgement</div>
    </div>
  </div>

  <div class="footer">
    This is a computer-generated payslip issued by The Moving Guy Pte Ltd (UEN: 202424156H).<br/>
    For queries, contact <strong>sales@tmginstall.com</strong> | tmginstall.com
  </div>
</div>
<script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { alert("Please allow popups to print the payslip."); return; }
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white dark:bg-zinc-900 z-10 rounded-t-3xl">
          <div>
            <p className="font-black text-base">Official Payslip</p>
            <p className="text-xs text-muted-foreground">{name} &nbsp;·&nbsp; {pStart} – {pEnd}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors"
              data-testid="button-print-payslip">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </button>
            <button onClick={onClose}
              className="p-2 hover:bg-secondary rounded-xl transition-colors"
              data-testid="button-close-payslip-modal">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Payslip preview */}
        <div ref={printRef} className="p-8 font-sans text-sm text-zinc-900 dark:text-zinc-100">

          {/* Company header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-xl font-black tracking-tight">The Moving Guy Pte Ltd</p>
              <p className="text-xs text-muted-foreground mt-0.5">UEN: 202424156H &nbsp;·&nbsp; Singapore &nbsp;·&nbsp; tmginstall.com</p>
            </div>
            <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-xs px-3 py-1.5 rounded-lg tracking-widest">
              TMG INSTALL
            </div>
          </div>

          <div className="border-t-2 border-zinc-900 dark:border-zinc-100 mb-4" />

          <p className="text-center font-black text-base tracking-[6px] mb-5 uppercase">Payslip</p>

          {/* Employee & period info */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-5 text-sm">
            {[
              { label: "Employee Name", val: name },
              { label: "Pay Period",    val: `${pStart} – ${pEnd}` },
              { label: "Employee ID",   val: `@${username}` },
              { label: "Date Issued",   val: genDate },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                <p className="font-bold">{val}</p>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-zinc-900 dark:border-zinc-100 mb-4" />

          {/* Earnings */}
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Earnings</p>
          <table className="w-full text-sm mb-4">
            <tbody>
              {isMonthly && (
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5">Basic Salary <span className="text-muted-foreground text-xs">(fixed monthly)</span></td>
                  <td className="py-1.5 text-right font-mono font-bold">{sg(basic)}</td>
                </tr>
              )}
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-1.5">Regular Pay <span className="text-muted-foreground text-xs">({regH.toFixed(1)}h)</span></td>
                <td className="py-1.5 text-right font-mono font-bold">{sg(regP)}</td>
              </tr>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-1.5">Overtime Pay <span className="text-muted-foreground text-xs">({otH.toFixed(1)}h)</span></td>
                <td className="py-1.5 text-right font-mono font-bold">{sg(otP)}</td>
              </tr>
              {meal > 0 && (
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-1.5">Meal Allowance <span className="text-muted-foreground text-xs">({mealDays} day{mealDays !== 1 ? "s" : ""} × S$8.00)</span></td>
                  <td className="py-1.5 text-right font-mono font-bold">{sg(meal)}</td>
                </tr>
              )}
              <tr>
                <td className="py-2 pt-3 font-black border-t border-zinc-900 dark:border-zinc-100">Total Earnings</td>
                <td className="py-2 pt-3 text-right font-mono font-black border-t border-zinc-900 dark:border-zinc-100">{sg(totalEarnings)}</td>
              </tr>
            </tbody>
          </table>

          {/* Deductions */}
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Deductions</p>
          <table className="w-full text-sm mb-4">
            <tbody>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-1.5 text-red-600 dark:text-red-400">Unpaid Leave Deduction</td>
                <td className="py-1.5 text-right font-mono text-red-600 dark:text-red-400">({sg(leave)})</td>
              </tr>
            </tbody>
          </table>

          {/* Net pay */}
          <div className="border-t-2 border-zinc-900 dark:border-zinc-100 pt-3 flex items-center justify-between">
            <p className="text-lg font-black tracking-tight">NET PAY</p>
            <p className="text-2xl font-black font-mono text-primary">{sg(gross)}</p>
          </div>

          {payslip.notes && (
            <div className="mt-4 bg-zinc-50 dark:bg-zinc-800 border rounded-xl px-4 py-3 text-xs text-muted-foreground">
              <span className="font-bold">Notes: </span>{payslip.notes}
            </div>
          )}

          {/* Signature area */}
          <div className="mt-8 grid grid-cols-2 gap-8 text-xs">
            <div>
              <div className="border-b border-zinc-900 dark:border-zinc-300 mb-1.5 h-8" />
              <p className="text-muted-foreground">Authorised Signature &amp; Company Stamp</p>
            </div>
            <div>
              <div className="border-b border-zinc-900 dark:border-zinc-300 mb-1.5 h-8" />
              <p className="text-muted-foreground">Employee Acknowledgement</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t text-center text-[10px] text-muted-foreground leading-relaxed">
            This is a computer-generated payslip issued by The Moving Guy Pte Ltd (UEN: 202424156H).<br />
            For queries, please contact <strong>sales@tmginstall.com</strong> &nbsp;·&nbsp; tmginstall.com
          </div>
        </div>
      </div>
    </div>
  );
}
