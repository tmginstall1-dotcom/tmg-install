import { useQuotes } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { Printer, ArrowLeft, Download, X, SlidersHorizontal, Search, MapPin, Clock, CheckCircle2, FileText } from "lucide-react";
import { useState, useMemo } from "react";

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

/* ─── Detail panel (right pane) ─────────────────────────────── */
function DetailPanel({ q }: { q: any }) {
  const items    = q.items || [];
  const arrived  = (q.updates || []).find((u: any) => u.statusChange === "in_progress" && u.gpsLat);
  const done     = (q.updates || []).find((u: any) => u.statusChange === "completed" && u.gpsLat);
  const notes    = (q.updates || []).filter((u: any) => u.note && !u.gpsLat);
  const services = (() => { try { return JSON.parse(q.selectedServices || "[]"); } catch { return []; } })();
  const isReloc  = !!q.pickupAddress;

  const onSiteMins = arrived && done
    ? Math.round((new Date(done.createdAt).getTime() - new Date(arrived.createdAt).getTime()) / 60000)
    : null;

  return (
    <div className="h-full flex flex-col">
      {/* ── Detail header ── */}
      <div className="px-6 py-4 border-b bg-white shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-lg font-black text-primary">{q.referenceNo}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusCls(q.status)}`}>
                {statusLabel(q.status)}
              </span>
            </div>
            <p className="text-xs text-gray-400">Submitted {dt(q.createdAt)} · {q.customer?.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right mr-1">
              <p className="text-xl font-black text-gray-900">{money(q.total)}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Grand Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Row 1: Customer + Appointment */}
        <div className="grid grid-cols-2 gap-4">
          <Section title="Customer">
            <InfoRow label="Name"  value={q.customer?.name  || "—"} />
            <InfoRow label="Phone" value={q.customer?.phone || "—"} />
            <InfoRow label="Email" value={q.customer?.email || "—"} />
          </Section>
          <Section title="Appointment">
            <InfoRow label="Date"  value={q.scheduledAt ? format(new Date(q.scheduledAt), "EEE, d MMM yyyy") : "—"} />
            {q.timeWindow && <InfoRow label="Time"  value={q.timeWindow} />}
            <InfoRow label="Staff" value={q.assignedStaff?.name || "—"} />
            {services.length > 0 && <InfoRow label="Services" value={services.join(", ")} />}
          </Section>
        </div>

        {/* Address */}
        <Section title="Service Location">
          {isReloc ? (
            <div className="space-y-1">
              <InfoRow label="Pickup"    value={q.pickupAddress || "—"} />
              <InfoRow label="Drop-off"  value={q.dropoffAddress || "—"} />
            </div>
          ) : (
            <InfoRow label="Address" value={q.serviceAddress || "—"} />
          )}
          {q.accessDifficulty && <InfoRow label="Access" value={q.accessDifficulty} />}
          {q.floorsInfo       && <InfoRow label="Floors" value={q.floorsInfo} />}
        </Section>

        {/* Scope of work */}
        <Section title="Scope of Work">
          {items.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No line items.</p>
          ) : (
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500">
                    <th className="px-3 py-2 text-left font-semibold">Item</th>
                    <th className="px-3 py-2 text-right font-semibold w-12">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">Unit Price</th>
                    <th className="px-3 py-2 text-right font-semibold w-24">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((it: any) => (
                    <tr key={it.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-800">{it.detectedName || it.originalDescription}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{it.quantity}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{money(it.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">{money(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Financial summary */}
        <Section title="Financial Summary">
          <div className="space-y-1.5">
            <FinLine label="Labour" value={money(q.subtotal)} />
            {Number(q.transportFee || 0) > 0 && <FinLine label="Transport" value={money(q.transportFee)} />}
            {Number(q.discount     || 0) > 0 && <FinLine label="Discount"  value={`−${money(q.discount)}`} red />}
            <div className="flex justify-between pt-2 mt-1 border-t-2 border-gray-900 font-black text-sm">
              <span>Grand Total</span><span>{money(q.total)}</span>
            </div>
            <div className={`flex items-center justify-between text-xs pt-1 ${q.depositPaidAt ? "text-emerald-600" : "text-gray-400"}`}>
              <div className="flex items-center gap-1">
                {q.depositPaidAt ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />}
                <span>Deposit 50%</span>
              </div>
              <div className="text-right">
                <span className="font-semibold">{money(q.depositAmount)}</span>
                {q.depositPaidAt && <div className="text-[10px] text-emerald-400">{dt(q.depositPaidAt, true)}</div>}
              </div>
            </div>
            <div className={`flex items-center justify-between text-xs ${q.finalPaidAt ? "text-emerald-600" : "text-gray-400"}`}>
              <div className="flex items-center gap-1">
                {q.finalPaidAt ? <CheckCircle2 className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />}
                <span>Final 50%</span>
              </div>
              <div className="text-right">
                <span className="font-semibold">{money(q.finalAmount)}</span>
                {q.finalPaidAt && <div className="text-[10px] text-emerald-400">{dt(q.finalPaidAt, true)}</div>}
              </div>
            </div>
          </div>
        </Section>

        {/* On-site GPS */}
        <Section title="On-Site GPS Record">
          <div className="grid grid-cols-2 gap-3">
            {arrived ? (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">Staff Arrived</span>
                </div>
                <p className="text-2xl font-black text-blue-900">{format(new Date(arrived.createdAt), "h:mm a")}</p>
                <p className="text-xs text-blue-600 mt-0.5">{format(new Date(arrived.createdAt), "EEE, d MMM yyyy")}</p>
                <p className="text-[10px] text-blue-300 mt-1 font-mono">
                  {Number(arrived.gpsLat).toFixed(5)}, {Number(arrived.gpsLng).toFixed(5)}
                </p>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-gray-300 text-xs">
                <MapPin className="w-6 h-6 mb-1" />
                No arrival GPS
              </div>
            )}
            {done ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Completed</span>
                </div>
                <p className="text-2xl font-black text-emerald-900">{format(new Date(done.createdAt), "h:mm a")}</p>
                <p className="text-xs text-emerald-600 mt-0.5">{format(new Date(done.createdAt), "EEE, d MMM yyyy")}</p>
                {onSiteMins !== null && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400">{onSiteMins} min on-site</span>
                  </div>
                )}
                <p className="text-[10px] text-emerald-300 mt-1 font-mono">
                  {Number(done.gpsLat).toFixed(5)}, {Number(done.gpsLng).toFixed(5)}
                </p>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-gray-300 text-xs">
                <CheckCircle2 className="w-6 h-6 mb-1" />
                No completion GPS
              </div>
            )}
          </div>
        </Section>

        {/* Notes */}
        {notes.length > 0 && (
          <Section title={`Notes (${notes.length})`}>
            <div className="space-y-2">
              {notes.map((n: any) => (
                <div key={n.id} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-amber-400 mb-0.5">{dt(n.createdAt, true)}</p>
                  <p className="text-xs text-amber-900 italic">"{n.note}"</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}

/* ─── Section wrapper ────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-1 border-b border-gray-50 last:border-0 text-xs">
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}

function FinLine({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className={`flex justify-between text-xs ${red ? "text-red-500" : "text-gray-600"}`}>
      <span>{label}</span><span className="font-semibold">{value}</span>
    </div>
  );
}

/* ─── Print-only job detail ──────────────────────────────────── */
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
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
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch]           = useState("");

  const now = new Date();
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo,   setDateTo]           = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "final_paid" | "closed">("all");
  const generatedAt = format(now, "d MMMM yyyy, HH:mm");

  const preset = (p: string) => {
    if (p === "month") { setDateFrom(format(startOfMonth(now), "yyyy-MM-dd")); setDateTo(format(endOfMonth(now), "yyyy-MM-dd")); }
    if (p === "last")  { const pm = subMonths(now, 1); setDateFrom(format(startOfMonth(pm), "yyyy-MM-dd")); setDateTo(format(endOfMonth(pm), "yyyy-MM-dd")); }
    if (p === "year")  { setDateFrom(format(startOfYear(now), "yyyy-MM-dd")); setDateTo(format(endOfYear(now), "yyyy-MM-dd")); }
    if (p === "all")   { setDateFrom(""); setDateTo(""); }
  };

  const hasFilter = !!(dateFrom || dateTo || statusFilter !== "all");
  const clear = () => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); };

  const baseJobs = useMemo(() => ((allQuotes || []) as any[])
    .filter(q => ["closed", "final_paid"].includes(q.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [allQuotes]);

  const filteredJobs = useMemo(() => baseJobs.filter(q => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    const ref = q.scheduledAt || q.createdAt;
    if (dateFrom && ref && new Date(ref) < new Date(dateFrom))              return false;
    if (dateTo   && ref && new Date(ref) > new Date(dateTo + "T23:59:59")) return false;
    return true;
  }), [baseJobs, statusFilter, dateFrom, dateTo]);

  const jobs = useMemo(() => {
    if (!search.trim()) return filteredJobs;
    const q = search.toLowerCase();
    return filteredJobs.filter(j =>
      j.referenceNo?.toLowerCase().includes(q) ||
      j.customer?.name?.toLowerCase().includes(q) ||
      j.customer?.phone?.toLowerCase().includes(q) ||
      j.assignedStaff?.name?.toLowerCase().includes(q)
    );
  }, [filteredJobs, search]);

  const selectedJob = jobs.find(j => j.id === selectedId) ?? null;

  const rev  = filteredJobs.reduce((s: number, q: any) => s + Number(q.total || 0), 0);
  const dep  = filteredJobs.reduce((s: number, q: any) => s + Number(q.depositAmount || 0), 0);
  const fin  = filteredJobs.reduce((s: number, q: any) => s + Number(q.finalAmount || 0), 0);
  const paid = filteredJobs.filter((q: any) => q.status === "final_paid").length;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      {/* ══ FULL-HEIGHT WRAPPER (below fixed navbar) ══ */}
      <div className="screen-only fixed inset-0 top-14 flex flex-col bg-gray-50">

        {/* ── Toolbar ── */}
        <div className="bg-white border-b px-5 py-2.5 shrink-0 z-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/admin">
                <button className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors shrink-0">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              </Link>
              <span className="text-gray-200">|</span>
              <span className="text-sm font-semibold text-gray-700 truncate">Closed Jobs — Audit Report</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                {filteredJobs.length}{filteredJobs.length !== baseJobs.length ? ` / ${baseJobs.length}` : ""}
              </span>
              {hasFilter && (
                <button onClick={clear} className="flex items-center gap-1 text-xs text-primary font-semibold shrink-0">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${showFilters || hasFilter ? "border-primary bg-primary/5 text-primary" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
                data-testid="button-toggle-filters">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
              </button>
              <button onClick={() => downloadCSV(filteredJobs)}
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

        {/* ── Split pane ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT: Job list */}
          <div className="w-80 xl:w-96 flex flex-col border-r bg-white shrink-0 overflow-hidden">

            {/* Stats strip */}
            <div className="grid grid-cols-2 gap-px bg-gray-100 shrink-0">
              <div className="bg-white px-4 py-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Revenue</p>
                <p className="text-sm font-black text-emerald-700">{money(rev)}</p>
              </div>
              <div className="bg-white px-4 py-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Fully Paid</p>
                <p className="text-sm font-black text-gray-800">{paid} / {filteredJobs.length}</p>
              </div>
              <div className="bg-white px-4 py-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Deposits</p>
                <p className="text-sm font-bold text-gray-700">{money(dep)}</p>
              </div>
              <div className="bg-white px-4 py-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Finals</p>
                <p className="text-sm font-bold text-gray-700">{money(fin)}</p>
              </div>
            </div>

            {/* Search */}
            <div className="px-3 py-2.5 border-b shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search ref, customer, staff…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-gray-50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  data-testid="input-search-jobs"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Job list */}
            <div className="flex-1 overflow-y-auto">
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs py-12">
                  <FileText className="w-8 h-8 mb-2 opacity-30" />
                  <p className="font-semibold">No jobs found</p>
                  {(hasFilter || search) && (
                    <button onClick={() => { clear(); setSearch(""); }} className="mt-2 text-primary font-semibold underline">Clear filters</button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {jobs.map((q: any) => {
                    const isSelected = selectedId === q.id;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setSelectedId(q.id)}
                        className={`w-full text-left px-4 py-3 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-primary" : "hover:bg-gray-50 border-l-2 border-transparent"}`}
                        data-testid={`row-job-${q.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-primary leading-tight">{q.referenceNo}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0 ${statusCls(q.status)}`}>
                            {statusLabel(q.status)}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 truncate">{q.customer?.name || "—"}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[10px] text-gray-400">
                            {q.scheduledAt ? format(new Date(q.scheduledAt), "d MMM yyyy") : dt(q.createdAt)}
                            {q.timeWindow ? ` · ${q.timeWindow}` : ""}
                          </p>
                          <p className="text-xs font-bold text-gray-800">{money(q.total)}</p>
                        </div>
                        {q.assignedStaff?.name && (
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{q.assignedStaff.name}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* List footer */}
            <div className="border-t bg-gray-900 text-white px-4 py-2.5 shrink-0">
              <div className="flex justify-between text-xs font-bold">
                <span>{jobs.length} job{jobs.length !== 1 ? "s" : ""}{search ? ` matching "${search}"` : ""}</span>
                <span>{money(jobs.reduce((s: number, q: any) => s + Number(q.total || 0), 0))}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Detail panel */}
          <div className="flex-1 overflow-hidden bg-white">
            {selectedJob ? (
              <DetailPanel q={selectedJob} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <FileText className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-sm font-semibold text-gray-400">Select a job to view details</p>
                <p className="text-xs text-gray-300 mt-1">{jobs.length} job{jobs.length !== 1 ? "s" : ""} in the list</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ PRINT-ONLY REPORT (outside split pane) ══ */}
      <div className="print-only" id="report-body">
        {/* Document header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 10, borderBottom: "2px solid #111" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: -0.5 }}>TMG INSTALL</div>
            <div style={{ fontSize: 8, color: "#9ca3af", marginTop: 2 }}>{CO} · UEN {UEN}</div>
            <div style={{ fontSize: 8, color: "#9ca3af" }}>{ADDR}</div>
            <div style={{ fontSize: 8, color: "#9ca3af" }}>{WEB} · {TEL} · {MAIL}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, fontWeight: 900 }}>Closed Jobs — Audit Report</div>
            {(dateFrom || dateTo) && (
              <div style={{ fontSize: 10, color: "#2563eb", marginTop: 2 }}>
                {dateFrom ? format(new Date(dateFrom), "d MMM yyyy") : "—"} → {dateTo ? format(new Date(dateTo), "d MMM yyyy") : "Today"}
              </div>
            )}
            <div style={{ fontSize: 8, color: "#9ca3af", marginTop: 4 }}>Generated: {generatedAt}</div>
            <div style={{ fontSize: 8, color: "#9ca3af" }}>{filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Total Revenue",     value: money(rev),  em: true },
            { label: "Deposits Received", value: money(dep) },
            { label: "Finals Received",   value: money(fin) },
            { label: "Fully Paid",        value: `${paid} of ${filteredJobs.length}` },
          ].map(c => (
            <div key={c.label} style={{ border: `1px solid ${c.em ? "#a7f3d0" : "#e5e7eb"}`, background: c.em ? "#f0fdf4" : "#f9fafb", borderRadius: 6, padding: "8px 12px" }}>
              <div style={{ fontSize: 7, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: c.em ? 14 : 11, fontWeight: 900, color: c.em ? "#059669" : "#111" }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Summary table */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
          <thead>
            <tr style={{ background: "#111", color: "#fff" }}>
              {["Ref No","Customer","Address","Job Date","Staff","Total","Deposit","Final","Status"].map(h => (
                <th key={h} style={{ padding: "5px 8px", fontWeight: 700, fontSize: 8, textAlign: ["Total","Deposit","Final"].includes(h) ? "right" : "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredJobs.map((q: any, i: number) => (
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
              <td colSpan={5} style={{ padding: "5px 8px", fontSize: 9 }}>TOTALS — {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}</td>
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

      {/* ══ PRINT-ONLY JOB DETAILS ══ */}
      <div id="print-details">
        {filteredJobs.map((q: any) => <PrintJob key={q.id} q={q} today={generatedAt} />)}
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
