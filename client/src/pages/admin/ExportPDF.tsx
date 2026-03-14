import { useQuotes } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { Printer, ArrowLeft, Download, ChevronDown, ChevronRight, X, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

/* ─── Constants ─────────────────────────────────────────────── */
const CO   = "The Moving Guy Pte Ltd";
const UEN  = "202424156H";
const ADDR = "160 Robinson Road, #14-04 SBF Center, Singapore 068914";
const TEL  = "+65 8088 0757";
const MAIL = "sales@tmginstall.com";
const WEB  = "tmginstall.com";

/* ─── Formatters ─────────────────────────────────────────────── */
const money = (v: any) =>
  `S$${Number(v || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dt = (v?: string | null, withTime = false) =>
  v ? format(new Date(v), withTime ? "d MMM yyyy, h:mm a" : "d MMM yyyy") : "—";

const addr = (q: any) =>
  q.pickupAddress ? `${q.pickupAddress} → ${q.dropoffAddress}` : (q.serviceAddress || "—");

const statusLabel = (s: string) => (s === "final_paid" ? "Paid" : "Closed");
const statusCls   = (s: string) =>
  s === "final_paid"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-100 text-slate-500";

/* ─── CSV ────────────────────────────────────────────────────── */
function downloadCSV(jobs: any[]) {
  const headers = ["Ref","Date Created","Customer","Phone","Address","Job Date","Time","Staff","Total","Deposit Paid","Final Paid","Status"];
  const rows = jobs.map(q => [
    q.referenceNo, dt(q.createdAt), q.customer?.name || "", q.customer?.phone || "",
    addr(q), q.scheduledAt ? dt(q.scheduledAt) : "", q.timeWindow || "",
    q.assignedStaff?.name || "",
    Number(q.total || 0).toFixed(2),
    q.depositPaidAt ? dt(q.depositPaidAt) : "Unpaid",
    q.finalPaidAt   ? dt(q.finalPaidAt)   : "Unpaid",
    statusLabel(q.status),
  ].map(v => `"${String(v).replace(/"/g, '""')}"`));

  const csv = [headers.map(h => `"${h}"`).join(","), ...rows.map(r => r.join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" })),
    download: `TMG_Audit_${format(new Date(), "yyyy-MM-dd")}.csv`,
  });
  a.click();
}

/* ─── Print trigger ──────────────────────────────────────────── */
function doPrint(mode: "summary" | "full") {
  document.body.dataset.printMode = mode;
  setTimeout(() => {
    window.print();
    setTimeout(() => delete document.body.dataset.printMode, 800);
  }, 60);
}

/* ─── Small helpers ──────────────────────────────────────────── */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex text-xs py-1 border-b border-gray-50 last:border-0 gap-3">
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

/* ─── Expanded screen panel ──────────────────────────────────── */
function JobPanel({ q }: { q: any }) {
  const items    = q.items || [];
  const arrived  = (q.updates || []).find((u: any) => u.statusChange === "in_progress" && u.gpsLat);
  const done     = (q.updates || []).find((u: any) => u.statusChange === "completed" && u.gpsLat);
  const services = (() => { try { return JSON.parse(q.selectedServices || "[]"); } catch { return []; } })();

  return (
    <div className="bg-gray-50 border-t border-b border-gray-200 px-6 py-5">
      <div className="grid grid-cols-3 gap-6 max-w-4xl">

        {/* ── Column 1: Info ── */}
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Customer</p>
            <Row label="Name"  value={q.customer?.name  || "—"} />
            <Row label="Phone" value={q.customer?.phone || "—"} />
            <Row label="Email" value={q.customer?.email || "—"} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Appointment</p>
            <Row label="Date"     value={q.scheduledAt ? format(new Date(q.scheduledAt), "EEE, d MMM yyyy") : "—"} />
            {q.timeWindow && <Row label="Time"  value={q.timeWindow} />}
            <Row label="Staff"    value={q.assignedStaff?.name || "—"} />
            {services.length > 0 && <Row label="Services" value={services.join(", ")} />}
          </div>
        </div>

        {/* ── Column 2: Financials ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Financials</p>
          {items.length > 0 && (
            <div className="mb-3">
              {items.map((it: any) => (
                <div key={it.id} className="flex justify-between text-xs py-1 border-b border-gray-100 last:border-0">
                  <span className="text-gray-700">{it.detectedName || it.originalDescription} ×{it.quantity}</span>
                  <span className="font-semibold">{money(it.subtotal)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1 text-xs">
            {Number(q.transportFee || 0) > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Transport</span><span>{money(q.transportFee)}</span>
              </div>
            )}
            {Number(q.discount || 0) > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Discount</span><span>−{money(q.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-gray-200 pt-2 mt-2 text-sm">
              <span>Total</span><span>{money(q.total)}</span>
            </div>
            <div className={`flex justify-between text-xs ${q.depositPaidAt ? "text-emerald-600" : "text-gray-400"}`}>
              <span>Deposit {q.depositPaidAt ? "✓" : ""}</span><span>{money(q.depositAmount)}</span>
            </div>
            <div className={`flex justify-between text-xs ${q.finalPaidAt ? "text-emerald-600" : "text-gray-400"}`}>
              <span>Final {q.finalPaidAt ? "✓" : ""}</span><span>{money(q.finalAmount)}</span>
            </div>
          </div>
        </div>

        {/* ── Column 3: On-site ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">On-Site Record</p>
          {arrived ? (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-2">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide mb-1">Arrived</p>
              <p className="text-sm font-bold text-blue-800">{format(new Date(arrived.createdAt), "h:mm a")}</p>
              <p className="text-xs text-blue-600">{format(new Date(arrived.createdAt), "d MMM yyyy")}</p>
            </div>
          ) : (
            <div className="border border-dashed border-gray-200 rounded-lg p-3 mb-2 text-xs text-gray-400">No arrival GPS</div>
          )}
          {done ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide mb-1">Completed</p>
              <p className="text-sm font-bold text-emerald-800">{format(new Date(done.createdAt), "h:mm a")}</p>
              <p className="text-xs text-emerald-600">{format(new Date(done.createdAt), "d MMM yyyy")}</p>
              {arrived && (
                <p className="text-[10px] text-emerald-400 mt-1">
                  {Math.round((new Date(done.createdAt).getTime() - new Date(arrived.createdAt).getTime()) / 60000)} min on-site
                </p>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-gray-200 rounded-lg p-3 text-xs text-gray-400">No completion GPS</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Print-only job detail (proper break-before: page on div) ── */
function PrintJob({ q, today }: { q: any; today: string }) {
  const items    = q.items || [];
  const arrived  = (q.updates || []).find((u: any) => u.statusChange === "in_progress" && u.gpsLat);
  const done     = (q.updates || []).find((u: any) => u.statusChange === "completed" && u.gpsLat);
  const notes    = (q.updates || []).filter((u: any) => u.note && !u.gpsLat);
  const services = (() => { try { return JSON.parse(q.selectedServices || "[]"); } catch { return []; } })();
  const isReloc  = !!q.pickupAddress;

  const cell: React.CSSProperties = { padding: "3px 0", fontSize: 9 };
  const th: React.CSSProperties   = { padding: "3px 5px", fontWeight: 700, fontSize: 8, textAlign: "left" };

  return (
    <div style={{ pageBreakBefore: "always", breakBefore: "page", fontFamily: "Arial, sans-serif", padding: "0 4px" }}>

      {/* Header band */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#000", color: "#fff", padding: "8px 12px", borderRadius: "4px 4px 0 0", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 7, letterSpacing: 2, opacity: .5, textTransform: "uppercase" }}>Job Detail — Audit Record</div>
          <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace" }}>{q.referenceNo}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ background: q.status === "final_paid" ? "#22c55e" : "rgba(255,255,255,.2)", color: "#fff", padding: "2px 8px", borderRadius: 99, fontSize: 8, fontWeight: 700, textTransform: "uppercase" }}>
            {q.status === "final_paid" ? "FULLY PAID" : "CLOSED"}
          </span>
          <div style={{ fontSize: 8, opacity: .4, marginTop: 2 }}>Submitted {dt(q.createdAt)}</div>
        </div>
      </div>

      {/* 3-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>

        {/* Col 1 */}
        <div>
          <Sect title="Customer">
            <PR label="Name"  val={q.customer?.name  || "—"} />
            <PR label="Phone" val={q.customer?.phone || "—"} />
            <PR label="Email" val={q.customer?.email || "—"} />
          </Sect>
          <Sect title="Service Location">
            {isReloc ? (<><PR label="Pickup" val={q.pickupAddress} /><PR label="Drop-off" val={q.dropoffAddress} /></>) : <PR label="Address" val={q.serviceAddress || "—"} />}
            {services.length > 0 && <PR label="Services" val={services.join(", ")} />}
            {q.accessDifficulty && <PR label="Access"   val={q.accessDifficulty} />}
            {q.floorsInfo       && <PR label="Floors"   val={q.floorsInfo} />}
          </Sect>
          <Sect title="Appointment">
            <PR label="Date"  val={q.scheduledAt ? format(new Date(q.scheduledAt), "EEEE, d MMMM yyyy") : "—"} />
            {q.timeWindow && <PR label="Time"  val={q.timeWindow} />}
            <PR label="Staff" val={q.assignedStaff?.name || "—"} />
          </Sect>
          {notes.length > 0 && (
            <Sect title="Notes">
              {notes.map((n: any) => (
                <div key={n.id} style={{ background: "#f9fafb", borderRadius: 4, padding: "3px 6px", marginBottom: 3, fontSize: 8 }}>
                  <span style={{ color: "#9ca3af" }}>{dt(n.createdAt, true)} · </span>
                  <span style={{ fontStyle: "italic" }}>"{n.note}"</span>
                </div>
              ))}
            </Sect>
          )}
        </div>

        {/* Col 2: Items + Financials */}
        <div>
          <Sect title="Scope of Work">
            {items.length === 0 ? <div style={{ fontSize: 8, color: "#9ca3af" }}>No items.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={th}>Item</th>
                    <th style={{ ...th, textAlign: "right" }}>Qty</th>
                    <th style={{ ...th, textAlign: "right" }}>Unit</th>
                    <th style={{ ...th, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any, ii: number) => (
                    <tr key={it.id} style={{ background: ii % 2 ? "#f9fafb" : "#fff" }}>
                      <td style={{ ...cell, padding: "3px 5px" }}>{it.detectedName || it.originalDescription}</td>
                      <td style={{ ...cell, padding: "3px 5px", textAlign: "right" }}>{it.quantity}</td>
                      <td style={{ ...cell, padding: "3px 5px", textAlign: "right" }}>{money(it.unitPrice)}</td>
                      <td style={{ ...cell, padding: "3px 5px", textAlign: "right", fontWeight: 700 }}>{money(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Sect>
          <Sect title="Financial Summary">
            <table style={{ width: "100%" }}>
              <tbody>
                <FinRow label="Labour"    val={money(q.subtotal)} />
                {Number(q.transportFee||0)>0 && <FinRow label="Transport" val={money(q.transportFee)} />}
                {Number(q.discount||0)>0     && <FinRow label="Discount"  val={`−${money(q.discount)}`} color="#dc2626" />}
                <tr style={{ borderTop: "2px solid #000", borderBottom: "2px solid #000" }}>
                  <td style={{ ...cell, fontWeight: 900, fontSize: 11, padding: "5px 0" }}>GRAND TOTAL</td>
                  <td style={{ ...cell, fontWeight: 900, fontSize: 11, textAlign: "right", padding: "5px 0" }}>{money(q.total)}</td>
                </tr>
                <FinRow label={`Deposit 50%${q.depositPaidAt?" ✓":""}`} val={money(q.depositAmount)} color={q.depositPaidAt?"#15803d":undefined} />
                {q.depositPaidAt && <tr><td colSpan={2} style={{ fontSize: 7, color: "#9ca3af", paddingLeft: 8 }}>Paid {dt(q.depositPaidAt, true)}</td></tr>}
                <FinRow label={`Final 50%${q.finalPaidAt?" ✓":""}`}     val={money(q.finalAmount)}   color={q.finalPaidAt?"#15803d":undefined} />
                {q.finalPaidAt && <tr><td colSpan={2} style={{ fontSize: 7, color: "#9ca3af", paddingLeft: 8 }}>Paid {dt(q.finalPaidAt, true)}</td></tr>}
              </tbody>
            </table>
          </Sect>
        </div>

        {/* Col 3: GPS + Certification */}
        <div>
          <Sect title="On-Site GPS Record">
            {arrived ? (
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, padding: "6px 8px", marginBottom: 6 }}>
                <div style={{ fontSize: 7, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: 1 }}>📍 Staff Arrived</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#1e3a8a" }}>{format(new Date(arrived.createdAt), "h:mm a")}</div>
                <div style={{ fontSize: 8, color: "#3b82f6" }}>{format(new Date(arrived.createdAt), "EEEE, d MMM yyyy")}</div>
                <div style={{ fontSize: 7, color: "#93c5fd", marginTop: 2 }}>GPS {Number(arrived.gpsLat).toFixed(5)}, {Number(arrived.gpsLng).toFixed(5)}</div>
              </div>
            ) : <div style={{ border: "1px dashed #e5e7eb", borderRadius: 6, padding: "6px 8px", fontSize: 8, color: "#9ca3af", marginBottom: 6 }}>No arrival GPS</div>}

            {done ? (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "6px 8px" }}>
                <div style={{ fontSize: 7, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: 1 }}>✅ Completed</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#14532d" }}>{format(new Date(done.createdAt), "h:mm a")}</div>
                <div style={{ fontSize: 8, color: "#22c55e" }}>{format(new Date(done.createdAt), "EEEE, d MMM yyyy")}</div>
                {arrived && <div style={{ fontSize: 7, color: "#86efac", marginTop: 2 }}>⏱ {Math.round((new Date(done.createdAt).getTime() - new Date(arrived.createdAt).getTime()) / 60000)} min on-site</div>}
                <div style={{ fontSize: 7, color: "#86efac" }}>GPS {Number(done.gpsLat).toFixed(5)}, {Number(done.gpsLng).toFixed(5)}</div>
              </div>
            ) : <div style={{ border: "1px dashed #e5e7eb", borderRadius: 6, padding: "6px 8px", fontSize: 8, color: "#9ca3af" }}>No completion GPS</div>}
          </Sect>

          <Sect title="Audit Certification">
            <div style={{ border: "2px dashed #e5e7eb", borderRadius: 6, padding: 10 }}>
              {["Verified by", "Date verified", "Signature"].map(lbl => (
                <div key={lbl} style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 8, color: "#9ca3af", width: 70, flexShrink: 0 }}>{lbl}</span>
                  <div style={{ flex: 1, borderBottom: "1px solid #d1d5db", paddingBottom: 2 }} />
                </div>
              ))}
            </div>
          </Sect>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 10, paddingTop: 6, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: 7, color: "#9ca3af" }}>
        <span>{CO} · UEN {UEN}</span>
        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{q.referenceNo}</span>
        <span>Confidential · Audit use only · {today}</span>
      </div>
    </div>
  );
}

function Sect({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 7, fontWeight: 900, textTransform: "uppercase", letterSpacing: 2, color: "#6b7280", borderBottom: "1px solid #e5e7eb", paddingBottom: 2, marginBottom: 5 }}>{title}</div>
      {children}
    </div>
  );
}
function PR({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "2px 0", fontSize: 8 }}>
      <span style={{ color: "#9ca3af", width: 52, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{val}</span>
    </div>
  );
}
function FinRow({ label, val, color }: { label: string; val: string; color?: string }) {
  const s: React.CSSProperties = { padding: "3px 0", fontSize: 9, color: color || "#6b7280" };
  return (
    <tr>
      <td style={s}>{label}</td>
      <td style={{ ...s, textAlign: "right", fontWeight: 600 }}>{val}</td>
    </tr>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function ExportPDF() {
  const { data: allQuotes, isLoading } = useQuotes();
  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const now = new Date();
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo,   setDateTo]           = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "final_paid" | "closed">("all");
  const generatedAt = format(now, "d MMMM yyyy, HH:mm");

  const preset = (p: string) => {
    if (p === "month")     { setDateFrom(format(startOfMonth(now), "yyyy-MM-dd"));           setDateTo(format(endOfMonth(now), "yyyy-MM-dd")); }
    if (p === "last")      { const pm = subMonths(now, 1); setDateFrom(format(startOfMonth(pm), "yyyy-MM-dd")); setDateTo(format(endOfMonth(pm), "yyyy-MM-dd")); }
    if (p === "year")      { setDateFrom(format(startOfYear(now), "yyyy-MM-dd"));            setDateTo(format(endOfYear(now), "yyyy-MM-dd")); }
    if (p === "all")       { setDateFrom(""); setDateTo(""); }
  };

  const hasFilter = !!(dateFrom || dateTo || statusFilter !== "all");
  const clear = () => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); };

  const baseJobs = ((allQuotes || []) as any[])
    .filter(q => ["closed", "final_paid"].includes(q.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const jobs = baseJobs.filter(q => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    const ref = q.scheduledAt || q.createdAt;
    if (dateFrom && ref && new Date(ref) < new Date(dateFrom))                  return false;
    if (dateTo   && ref && new Date(ref) > new Date(dateTo + "T23:59:59"))     return false;
    return true;
  });

  const rev  = jobs.reduce((s, q) => s + Number(q.total || 0), 0);
  const dep  = jobs.reduce((s, q) => s + Number(q.depositAmount || 0), 0);
  const fin  = jobs.reduce((s, q) => s + Number(q.finalAmount || 0), 0);
  const paid = jobs.filter(q => q.status === "final_paid").length;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      {/* ══ TOOLBAR ══ */}
      <div className="screen-only bg-white border-b px-5 py-2.5 sticky top-14 z-40">
        <div className="flex items-center justify-between gap-3">
          {/* left */}
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin">
              <button className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors shrink-0">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            </Link>
            <span className="text-gray-200">|</span>
            <span className="text-sm font-semibold text-gray-700 truncate">Closed Jobs — Audit Report</span>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
              {jobs.length}{jobs.length !== baseJobs.length ? ` / ${baseJobs.length}` : ""}
            </span>
            {hasFilter && (
              <button onClick={clear} className="flex items-center gap-1 text-xs text-primary font-semibold shrink-0">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          {/* right */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${showFilters || hasFilter ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
              data-testid="button-toggle-filters">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filter
            </button>
            <button onClick={() => downloadCSV(jobs)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
              data-testid="button-export-csv">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={() => doPrint("summary")}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
              data-testid="button-print-summary">
              <Printer className="w-3.5 h-3.5" /> Print Summary
            </button>
            <button onClick={() => doPrint("full")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors"
              data-testid="button-print-full">
              <Printer className="w-3.5 h-3.5" /> Print Full Report
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {showFilters && (
          <div className="mt-2.5 pt-2.5 border-t flex flex-wrap items-end gap-3">
            <div className="flex gap-1.5">
              {[["all","All time"],["month","This month"],["last","Last month"],["year","This year"]].map(([v,l]) => (
                <button key={v} onClick={() => preset(v)}
                  className="px-2.5 py-1 text-xs border rounded-md hover:bg-gray-50 transition-colors">{l}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Job date from</p>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="px-2.5 py-1 border rounded-md text-xs bg-white" data-testid="input-filter-from" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">To</p>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="px-2.5 py-1 border rounded-md text-xs bg-white" data-testid="input-filter-to" />
              </div>
            </div>
            <div className="flex gap-1.5">
              {([["all","All"],["final_paid","Fully paid"],["closed","Unpaid"]] as const).map(([v,l]) => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  className={`px-2.5 py-1 text-xs border-2 rounded-md transition-all ${statusFilter === v ? "border-primary bg-primary/5 text-primary" : "border-gray-200"}`}>{l}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ BODY ══ */}
      <div className="max-w-6xl mx-auto px-6 py-6" id="report-body">

        {/* Document header */}
        <div className="flex items-start justify-between mb-5 pb-4 border-b-2 border-gray-900">
          <div>
            <h1 className="text-xl font-black tracking-tight">TMG INSTALL</h1>
            <p className="text-xs text-gray-400 mt-0.5">{CO} · UEN {UEN}</p>
            <p className="text-xs text-gray-400">{ADDR}</p>
            <p className="text-xs text-gray-400">{WEB} · {TEL} · {MAIL}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black">Closed Jobs — Audit Report</p>
            {(dateFrom || dateTo) && (
              <p className="text-sm font-semibold text-primary mt-0.5">
                {dateFrom ? format(new Date(dateFrom), "d MMM yyyy") : "—"} → {dateTo ? format(new Date(dateTo), "d MMM yyyy") : "Today"}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">Generated: {generatedAt}</p>
            <p className="text-xs text-gray-400">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Revenue",     value: money(rev),  accent: true },
            { label: "Deposits Received", value: money(dep) },
            { label: "Finals Received",   value: money(fin) },
            { label: "Fully Paid",        value: `${paid} of ${jobs.length}` },
          ].map(c => (
            <div key={c.label} className={`rounded-xl p-4 border ${c.accent ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{c.label}</p>
              <p className={`font-black ${c.accent ? "text-xl text-emerald-700" : "text-base text-gray-800"}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* ── Screen table ── */}
        <div className="screen-only">
          {jobs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-semibold">No jobs match the current filters.</p>
              {hasFilter && <button onClick={clear} className="mt-2 text-primary text-sm font-semibold underline">Clear filters</button>}
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-900 text-white text-xs">
                    <th className="w-8 px-3 py-2.5" />
                    {["Ref No","Customer","Job Date","Staff","Total","Status"].map(h => (
                      <th key={h} className={`px-3 py-2.5 font-semibold text-left`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map((q, i) => {
                    const isOpen = expandedId === q.id;
                    return (
                      <>
                        <tr key={`r-${q.id}`}
                          onClick={() => setExpandedId(isOpen ? null : q.id)}
                          className={`cursor-pointer transition-colors ${isOpen ? "bg-primary/5" : "hover:bg-gray-50"}`}
                          data-testid={`row-job-${q.id}`}>
                          <td className="px-3 py-3 text-gray-400">
                            {isOpen ? <ChevronDown className="w-4 h-4 text-primary" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-mono text-xs font-bold text-primary">{q.referenceNo}</span>
                            <div className="text-[10px] text-gray-400 mt-0.5">{dt(q.createdAt)}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="text-sm font-semibold">{q.customer?.name}</div>
                            <div className="text-xs text-gray-400">{q.customer?.phone}</div>
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {q.scheduledAt ? format(new Date(q.scheduledAt), "d MMM yyyy") : "—"}
                            {q.timeWindow && <div className="text-xs text-gray-400">{q.timeWindow}</div>}
                          </td>
                          <td className="px-3 py-3 text-sm text-gray-600">{q.assignedStaff?.name || "—"}</td>
                          <td className="px-3 py-3 font-bold text-sm">{money(q.total)}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusCls(q.status)}`}>
                              {statusLabel(q.status)}
                            </span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`p-${q.id}`}>
                            <td colSpan={7} className="p-0">
                              <JobPanel q={q} />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-900 text-white text-xs font-bold">
                    <td />
                    <td colSpan={4} className="px-3 py-2.5">TOTALS — {jobs.length} job{jobs.length !== 1 ? "s" : ""}</td>
                    <td className="px-3 py-2.5">{money(rev)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Screen footer */}
          <div className="mt-6 pt-4 border-t text-xs text-gray-400 flex justify-between">
            <span>TMG Install · {CO} · UEN {UEN}</span>
            <span>Confidential — Internal audit use only</span>
            <span>Generated {generatedAt}</span>
          </div>
        </div>

        {/* ── Print-only summary table ── */}
        <div className="print-only">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
            <thead>
              <tr style={{ background: "#111", color: "#fff" }}>
                {["Ref No","Customer","Address","Job Date","Staff","Total","Deposit","Final","Status"].map(h => (
                  <th key={h} style={{ padding: "5px 8px", fontWeight: 700, fontSize: 8, textAlign: ["Total","Deposit","Final"].includes(h) ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((q, i) => (
                <tr key={q.id} style={{ background: i % 2 ? "#f9fafb" : "#fff" }}>
                  <td style={{ padding: "4px 8px", fontFamily: "monospace", fontSize: 8, fontWeight: 700, color: "#1d4ed8" }}>{q.referenceNo}</td>
                  <td style={{ padding: "4px 8px" }}>
                    <div style={{ fontWeight: 600, fontSize: 9 }}>{q.customer?.name}</div>
                    <div style={{ fontSize: 7, color: "#9ca3af" }}>{q.customer?.phone}</div>
                  </td>
                  <td style={{ padding: "4px 8px", fontSize: 8, maxWidth: 120 }}>{addr(q)}</td>
                  <td style={{ padding: "4px 8px", fontSize: 8, whiteSpace: "nowrap" }}>
                    {q.scheduledAt ? format(new Date(q.scheduledAt), "d MMM yyyy") : "—"}
                    {q.timeWindow && <div style={{ color: "#9ca3af", fontSize: 7 }}>{q.timeWindow}</div>}
                  </td>
                  <td style={{ padding: "4px 8px", fontSize: 8 }}>{q.assignedStaff?.name || "—"}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, fontSize: 9 }}>{money(q.total)}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", fontSize: 8, color: q.depositPaidAt ? "#15803d" : "#9ca3af" }}>
                    {q.depositPaidAt ? "✓ " : ""}{money(q.depositAmount)}
                  </td>
                  <td style={{ padding: "4px 8px", textAlign: "right", fontSize: 8, color: q.finalPaidAt ? "#15803d" : "#9ca3af" }}>
                    {q.finalPaidAt ? "✓ " : ""}{money(q.finalAmount)}
                  </td>
                  <td style={{ padding: "4px 8px", textAlign: "center" }}>
                    <span style={{ background: q.status === "final_paid" ? "#dcfce7" : "#f1f5f9", color: q.status === "final_paid" ? "#15803d" : "#64748b", padding: "1px 6px", borderRadius: 99, fontSize: 7, fontWeight: 700, textTransform: "uppercase" }}>
                      {statusLabel(q.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#111", color: "#fff", fontWeight: 700 }}>
                <td colSpan={5} style={{ padding: "5px 8px", fontSize: 9 }}>TOTALS — {jobs.length} job{jobs.length !== 1 ? "s" : ""}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 9 }}>{money(rev)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 9 }}>{money(dep)}</td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontSize: 9 }}>{money(fin)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <div style={{ marginTop: 14, paddingTop: 8, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", fontSize: 8, color: "#9ca3af" }}>
            <span>TMG Install · {CO} · UEN {UEN}</span>
            <span>Confidential — Internal audit use only</span>
            <span>Generated {generatedAt}</span>
          </div>
        </div>
      </div>

      {/* ══ PRINT-ONLY JOB DETAILS (outside table — proper break-before: page on divs) ══ */}
      <div id="print-details">
        {jobs.map(q => <PrintJob key={q.id} q={q} today={generatedAt} />)}
      </div>

      {/* ══ CSS ══ */}
      <style>{`
        .print-only { display: none !important; }

        @media print {
          .screen-only { display: none !important; }
          .print-only  { display: block !important; }

          @page { size: A4 landscape; margin: 8mm; }
          body  { font-size: 9px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          body[data-print-mode="summary"] #print-details { display: none !important; }
          body[data-print-mode="full"]    #print-details { display: block !important; }

          #report-body { page-break-before: avoid; break-before: avoid; }
        }
      `}</style>
    </>
  );
}
