import { useQuotes } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import { Printer, ArrowLeft, X, SlidersHorizontal, Search, MapPin, Clock, CheckCircle2, FileText } from "lucide-react";
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

const statusLabel = (s: string) => (s === "final_paid" ? "Fully Paid" : "Closed");
const statusCls   = (s: string) =>
  s === "final_paid"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-slate-100 text-slate-500";

/* Parse floorsInfo JSON → human readable e.g. "Level 13 (with lift), Level 1 (no lift)" */
function parseFloors(raw: any): string {
  if (!raw) return "";
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map((f: any) =>
        `Level ${f.level ?? f.floor ?? "?"}${f.hasLift ? " (with lift)" : " (no lift)"}`
      ).join(", ");
    }
  } catch {}
  return typeof raw === "string" ? raw : String(raw);
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
              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase ${statusCls(q.status)}`}>
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
          {q.floorsInfo && parseFloors(q.floorsInfo) && <InfoRow label="Floors" value={parseFloors(q.floorsInfo)} />}
        </Section>

        {/* Scope of work */}
        <Section title="Scope of Work">
          {items.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No line items.</p>
          ) : (
            <div className="border border-gray-100 overflow-hidden">
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
              <div className="bg-blue-50 border border-blue-100 p-4">
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
              <div className="border-2 border-dashed border-gray-200 p-4 flex flex-col items-center justify-center text-gray-300 text-xs">
                <MapPin className="w-6 h-6 mb-1" />
                No arrival GPS
              </div>
            )}
            {done ? (
              <div className="bg-emerald-50 border border-emerald-100 p-4">
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
              <div className="border-2 border-dashed border-gray-200 p-4 flex flex-col items-center justify-center text-gray-300 text-xs">
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
                <div key={n.id} className="bg-amber-50 border border-amber-100 px-3 py-2">
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

/* ─── Print-only job detail — proper A4 portrait ─────────────── */
function PrintJob({ q, today }: { q: any; today: string }) {
  const items    = q.items || [];
  const arrived  = (q.updates || []).find((u: any) => u.statusChange === "in_progress" && u.gpsLat);
  const done     = (q.updates || []).find((u: any) => u.statusChange === "completed" && u.gpsLat);
  const notes    = (q.updates || []).filter((u: any) => u.note && !u.gpsLat);
  const services = (() => { try { return JSON.parse(q.selectedServices || "[]"); } catch { return []; } })();
  const isReloc  = !!q.pickupAddress;
  const floorsText = parseFloors(q.floorsInfo);
  const onSiteMins = arrived && done
    ? Math.round((new Date(done.createdAt).getTime() - new Date(arrived.createdAt).getTime()) / 60000)
    : null;

  const s = {
    page:    { pageBreakBefore: "always", breakBefore: "page", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 10, lineHeight: 1.5, color: "#111", padding: 0 } as React.CSSProperties,
    badge:   { display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: 9, fontWeight: 700, textTransform: "uppercase" as const, background: q.status === "final_paid" ? "#dcfce7" : "#f1f5f9", color: q.status === "final_paid" ? "#15803d" : "#475569" },
    grid2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 } as React.CSSProperties,
    thCell:  { padding: "5px 8px", fontWeight: 700, fontSize: 9, textAlign: "left" as const, background: "#111", color: "#fff" },
    tdCell:  { padding: "5px 8px", fontSize: 9, verticalAlign: "top" as const },
  };

  return (
    <div style={s.page}>

      {/* ── Full-width black job header band ── */}
      <div style={{ background: "#111", color: "#fff", padding: "10px 16px", borderRadius: "6px 6px 0 0", marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 3, marginBottom: 2 }}>Job Audit Record</div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>TMG INSTALL</div>
          <div style={{ fontSize: 7, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{CO} · UEN {UEN}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 3 }}>Job Reference No.</div>
          <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: 1 }}>{q.referenceNo}</div>
          <div style={{ marginTop: 5 }}><span style={s.badge}>{statusLabel(q.status)}</span></div>
        </div>
      </div>

      {/* ── Company sub-header with dates ── */}
      <div style={{ borderLeft: "3px solid #111", borderRight: "3px solid #111", borderBottom: "3px solid #111", padding: "6px 16px 8px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 8, color: "#6b7280", borderRadius: "0 0 6px 6px" }}>
        <span>{ADDR} · {TEL} · {MAIL} · {WEB}</span>
        <span>Submitted {dt(q.createdAt)} · Generated {today}</span>
      </div>

      {/* ── Customer + Appointment ── */}
      <div style={s.grid2}>
        <PSect title="Customer">
          <PRow label="Name"  val={q.customer?.name  || "—"} />
          <PRow label="Phone" val={q.customer?.phone || "—"} />
          <PRow label="Email" val={q.customer?.email || "—"} />
        </PSect>
        <PSect title="Appointment">
          <PRow label="Date"     val={q.scheduledAt ? format(new Date(q.scheduledAt), "EEEE, d MMMM yyyy") : "—"} />
          <PRow label="Time"     val={q.timeWindow || "—"} />
          <PRow label="Staff"    val={q.assignedStaff?.name || "—"} />
          {services.length > 0 && <PRow label="Services" val={services.join(", ")} />}
        </PSect>
      </div>

      {/* ── Service Location ── */}
      <PSect title="Service Location" mb={14}>
        {isReloc ? (
          <>
            <PRow label="Pickup"   val={q.pickupAddress   || "—"} />
            <PRow label="Drop-off" val={q.dropoffAddress  || "—"} />
          </>
        ) : (
          <PRow label="Address" val={q.serviceAddress || "—"} />
        )}
        {q.accessDifficulty && <PRow label="Access" val={q.accessDifficulty} />}
        {floorsText          && <PRow label="Floors" val={floorsText} />}
      </PSect>

      {/* ── Scope of Work ── */}
      <PSect title="Scope of Work" mb={14}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
          <thead>
            <tr>
              <th style={{ ...s.thCell, width: "58%" }}>Item / Description</th>
              <th style={{ ...s.thCell, width: "10%", textAlign: "center" }}>Qty</th>
              <th style={{ ...s.thCell, width: "16%", textAlign: "right" }}>Unit Price</th>
              <th style={{ ...s.thCell, width: "16%", textAlign: "right" }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={4} style={{ ...s.tdCell, color: "#9ca3af", fontStyle: "italic", textAlign: "center", padding: "10px 0" }}>No items recorded.</td></tr>
            )}
            {items.map((it: any, ii: number) => (
              <tr key={it.id} style={{ background: ii % 2 ? "#f9fafb" : "#fff" }}>
                <td style={s.tdCell}>{it.detectedName || it.originalDescription}</td>
                <td style={{ ...s.tdCell, textAlign: "center" }}>{it.quantity}</td>
                <td style={{ ...s.tdCell, textAlign: "right" }}>{money(it.unitPrice)}</td>
                <td style={{ ...s.tdCell, textAlign: "right", fontWeight: 700 }}>{money(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PSect>

      {/* ── Financial Summary ── */}
      <PSect title="Financial Summary" mb={14}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9 }}>
          <tbody>
            <PFinRow label="Labour (Sub-total)" val={money(q.subtotal)} />
            {Number(q.transportFee || 0) > 0 && <PFinRow label="Transport Fee" val={money(q.transportFee)} />}
            {Number(q.discount     || 0) > 0 && <PFinRow label="Discount"      val={`− ${money(q.discount)}`} color="#dc2626" />}
            <tr style={{ borderTop: "2.5px solid #111", borderBottom: "2.5px solid #111" }}>
              <td style={{ padding: "7px 0", fontWeight: 900, fontSize: 13 }}>GRAND TOTAL</td>
              <td style={{ padding: "7px 0", fontWeight: 900, fontSize: 13, textAlign: "right" }}>{money(q.total)}</td>
            </tr>
            <tr><td colSpan={2} style={{ height: 8 }} /></tr>
            <PFinRow
              label={`Deposit 50%${q.depositPaidAt ? " — PAID ✓" : " — UNPAID"}`}
              val={money(q.depositAmount)}
              color={q.depositPaidAt ? "#15803d" : "#9ca3af"}
            />
            {q.depositPaidAt && (
              <tr><td colSpan={2} style={{ fontSize: 8, color: "#6b7280", paddingLeft: 12, paddingBottom: 3 }}>
                Paid on {dt(q.depositPaidAt, true)}
              </td></tr>
            )}
            <PFinRow
              label={`Final 50%${q.finalPaidAt ? " — PAID ✓" : " — UNPAID"}`}
              val={money(q.finalAmount)}
              color={q.finalPaidAt ? "#15803d" : "#9ca3af"}
            />
            {q.finalPaidAt && (
              <tr><td colSpan={2} style={{ fontSize: 8, color: "#6b7280", paddingLeft: 12, paddingBottom: 3 }}>
                Paid on {dt(q.finalPaidAt, true)}
              </td></tr>
            )}
          </tbody>
        </table>
      </PSect>

      {/* ── On-Site GPS Record ── */}
      <PSect title="On-Site GPS Record" mb={14}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {arrived ? (
            <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: "#2563eb", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>📍 Staff Arrived</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#1e3a8a", lineHeight: 1 }}>{format(new Date(arrived.createdAt), "h:mm a")}</div>
              <div style={{ fontSize: 9, color: "#3b82f6", marginTop: 3 }}>{format(new Date(arrived.createdAt), "EEEE, d MMMM yyyy")}</div>
              <div style={{ fontSize: 8, color: "#93c5fd", marginTop: 4, fontFamily: "monospace" }}>
                GPS: {Number(arrived.gpsLat).toFixed(6)}, {Number(arrived.gpsLng).toFixed(6)}
              </div>
            </div>
          ) : (
            <div style={{ border: "1px dashed #d1d5db", borderRadius: 8, padding: "10px 14px", color: "#9ca3af", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
              No arrival GPS recorded
            </div>
          )}
          {done ? (
            <div style={{ border: "1px solid #bbf7d0", background: "#f0fdf4", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>✅ Job Completed</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#14532d", lineHeight: 1 }}>{format(new Date(done.createdAt), "h:mm a")}</div>
              <div style={{ fontSize: 9, color: "#22c55e", marginTop: 3 }}>{format(new Date(done.createdAt), "EEEE, d MMMM yyyy")}</div>
              {onSiteMins !== null && (
                <div style={{ fontSize: 8, color: "#4ade80", marginTop: 4 }}>⏱ On-site duration: {onSiteMins} minutes</div>
              )}
              <div style={{ fontSize: 8, color: "#86efac", marginTop: 2, fontFamily: "monospace" }}>
                GPS: {Number(done.gpsLat).toFixed(6)}, {Number(done.gpsLng).toFixed(6)}
              </div>
            </div>
          ) : (
            <div style={{ border: "1px dashed #d1d5db", borderRadius: 8, padding: "10px 14px", color: "#9ca3af", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
              No completion GPS recorded
            </div>
          )}
        </div>
      </PSect>

      {/* ── Notes (if any) ── */}
      {notes.length > 0 && (
        <PSect title={`Notes (${notes.length})`} mb={14}>
          {notes.map((n: any) => (
            <div key={n.id} style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 5, padding: "6px 10px", marginBottom: 5, fontSize: 9 }}>
              <span style={{ color: "#92400e", fontWeight: 600 }}>{dt(n.createdAt, true)}</span>
              <span style={{ color: "#6b7280", margin: "0 5px" }}>·</span>
              <span style={{ fontStyle: "italic", color: "#78350f" }}>"{n.note}"</span>
            </div>
          ))}
        </PSect>
      )}

      {/* ── Audit Certification ── */}
      <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: 2, color: "#374151", marginBottom: 12 }}>Audit Certification</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          {["Verified by", "Date verified"].map(lbl => (
            <div key={lbl} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <span style={{ fontSize: 8, color: "#9ca3af", whiteSpace: "nowrap", width: 72, flexShrink: 0 }}>{lbl}:</span>
              <div style={{ flex: 1, borderBottom: "1px solid #d1d5db", paddingBottom: 2 }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <span style={{ fontSize: 8, color: "#9ca3af", whiteSpace: "nowrap", width: 72, flexShrink: 0 }}>Signature:</span>
          <div style={{ flex: 1, borderBottom: "1px solid #d1d5db", paddingBottom: 2 }} />
        </div>
      </div>

      {/* ── Page footer ── */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 7, color: "#9ca3af" }}>
        <span>{CO} · UEN {UEN}</span>
        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{q.referenceNo}</span>
        <span>Confidential · Audit Record</span>
      </div>
    </div>
  );
}

/* ─── Print helpers ──────────────────────────────────────────── */
function PSect({ title, children, mb = 10 }: { title: string; children: React.ReactNode; mb?: number }) {
  return (
    <div style={{ marginBottom: mb }}>
      <div style={{ fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: 2, color: "#374151", background: "#f3f4f6", padding: "3px 6px", marginBottom: 6, borderLeft: "3px solid #111" }}>
        {title}
      </div>
      {children}
    </div>
  );
}
function PRow({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "3px 0", borderBottom: "1px solid #f9fafb", fontSize: 9 }}>
      <span style={{ color: "#6b7280", width: 72, flexShrink: 0, fontWeight: 600 }}>{label}</span>
      <span style={{ color: "#111", flex: 1 }}>{val}</span>
    </div>
  );
}
function PFinRow({ label, val, color }: { label: string; val: string; color?: string }) {
  return (
    <tr>
      <td style={{ padding: "4px 0", fontSize: 9, color: color || "#374151" }}>{label}</td>
      <td style={{ padding: "4px 0", fontSize: 9, color: color || "#374151", textAlign: "right", fontWeight: 600 }}>{val}</td>
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
  const [mobileView, setMobileView]   = useState<"list" | "detail">("list");

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
      {/* ══ FULL-HEIGHT WRAPPER ══ */}
      <div className="screen-only fixed inset-x-0 lg:left-56 top-14 bottom-16 sm:bottom-0 flex flex-col bg-gray-50">

        {/* ── Toolbar ── */}
        <div className="bg-slate-950 text-white px-4 py-3 shrink-0 z-20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile: back from detail to list */}
              {mobileView === "detail" ? (
                <button onClick={() => setMobileView("list")}
                  className="flex items-center gap-1.5 text-[10px] font-black text-slate-300 hover:text-white transition-colors shrink-0 sm:hidden uppercase tracking-[0.1em]">
                  <ArrowLeft className="w-3.5 h-3.5" /> Jobs
                </button>
              ) : (
                <Link href="/admin" className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors shrink-0 uppercase tracking-[0.1em]">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              )}
              <div className="min-w-0">
                <p className="text-xs font-black text-white uppercase tracking-[0.15em] truncate">Audit Report</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {filteredJobs.length}{filteredJobs.length !== baseJobs.length ? ` / ${baseJobs.length}` : ""} closed jobs
                  {hasFilter && <span className="text-white/50"> · filtered</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] border transition-all ${showFilters || hasFilter ? "border-white bg-white text-black" : "border-white/20 bg-white/10 text-white hover:bg-white/15"}`}
                data-testid="button-toggle-filters">
                <SlidersHorizontal className="w-3 h-3" />
                <span className="ml-1">Filter</span>
              </button>
              <button onClick={() => doPrint("summary")}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-white/20 text-white text-[10px] font-black uppercase tracking-[0.1em] hover:bg-white/10 transition-colors"
                data-testid="button-print-summary">
                <Printer className="w-3 h-3" /> Summary
              </button>
              <button onClick={() => doPrint("full")}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-black text-[10px] font-black uppercase tracking-[0.1em] hover:bg-white/90 transition-colors"
                data-testid="button-export-pdf">
                <Printer className="w-3 h-3" /> Export PDF
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {[["all","All time"],["month","This month"],["last","Last month"],["year","This year"]].map(([v,l]) => (
                  <button key={v} onClick={() => preset(v)}
                    className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] border border-white/20 hover:bg-white/10 text-white transition-colors">{l}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3">
                <div>
                  <p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wide">From</p>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-white/20 text-xs bg-white/10 text-white focus:outline-none focus:border-white" data-testid="input-filter-from" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1 font-bold uppercase tracking-wide">To</p>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-white/20 text-xs bg-white/10 text-white focus:outline-none focus:border-white" data-testid="input-filter-to" />
                </div>
                <div className="col-span-2 sm:col-span-1 flex flex-col justify-end">
                  <div className="flex gap-1.5 flex-wrap">
                    {([["all","All"],["final_paid","Paid"],["closed","Unpaid"]] as const).map(([v,l]) => (
                      <button key={v} onClick={() => setStatusFilter(v)}
                        className={`flex-1 sm:flex-none px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition-all ${statusFilter === v ? "bg-white text-black" : "border border-white/20 text-white hover:bg-white/10"}`}>{l}</button>
                    ))}
                  </div>
                </div>
              </div>
              {hasFilter && (
                <button onClick={clear} className="flex items-center gap-1 text-xs text-red-400 font-semibold">
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Stats strip (mobile only above list) ── */}
        <div className="grid grid-cols-4 gap-px bg-gray-200 shrink-0 sm:hidden">
          <div className="bg-white px-3 py-2">
            <p className="text-[9px] text-gray-400 uppercase">Revenue</p>
            <p className="text-xs font-black text-emerald-700 truncate">{money(rev)}</p>
          </div>
          <div className="bg-white px-3 py-2">
            <p className="text-[9px] text-gray-400 uppercase">Paid</p>
            <p className="text-xs font-black text-gray-800">{paid}/{filteredJobs.length}</p>
          </div>
          <div className="bg-white px-3 py-2">
            <p className="text-[9px] text-gray-400 uppercase">Deposits</p>
            <p className="text-xs font-bold text-gray-700 truncate">{money(dep)}</p>
          </div>
          <div className="bg-white px-3 py-2">
            <p className="text-[9px] text-gray-400 uppercase">Finals</p>
            <p className="text-xs font-bold text-gray-700 truncate">{money(fin)}</p>
          </div>
        </div>

        {/* ── Desktop split pane / Mobile single pane ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* LEFT / MOBILE LIST: Job list */}
          <div className={`flex flex-col bg-white overflow-hidden
            sm:w-80 xl:w-96 sm:border-r sm:shrink-0
            ${mobileView === "detail" ? "hidden sm:flex" : "flex w-full"}`}>

            {/* Stats strip — desktop only */}
            <div className="hidden sm:grid grid-cols-2 gap-px bg-gray-100 shrink-0">
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
                  className="w-full pl-8 pr-3 py-2 text-sm border border-black/10 bg-gray-50 focus:outline-none focus:border-black transition-all"
                  data-testid="input-search-jobs"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Job list */}
            <div className="flex-1 overflow-y-auto">
              {jobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs py-12 px-4">
                  <FileText className="w-8 h-8 mb-2 opacity-30" />
                  <p className="font-semibold text-center">No jobs found</p>
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
                        onClick={() => { setSelectedId(q.id); setMobileView("detail"); }}
                        className={`w-full text-left px-4 py-3.5 transition-colors ${isSelected ? "bg-violet-50 border-l-2 border-violet-600" : "hover:bg-gray-50 border-l-2 border-transparent"}`}
                        data-testid={`row-job-${q.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-violet-700 leading-tight">{q.referenceNo}</span>
                          <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase shrink-0 ${statusCls(q.status)}`}>
                            {statusLabel(q.status)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 truncate">{q.customer?.name || "—"}</p>
                        <div className="flex items-center justify-between mt-1 gap-2">
                          <p className="text-[11px] text-gray-400 truncate">
                            {q.scheduledAt ? format(new Date(q.scheduledAt), "d MMM yyyy") : dt(q.createdAt)}
                            {q.timeWindow ? ` · ${q.timeWindow}` : ""}
                          </p>
                          <p className="text-sm font-bold text-gray-800 shrink-0">{money(q.total)}</p>
                        </div>
                        {q.assignedStaff?.name && (
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{q.assignedStaff.name}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* List footer */}
            <div className="border-t bg-slate-950 text-white px-4 py-2.5 shrink-0">
              <div className="flex justify-between text-xs font-bold">
                <span>{jobs.length} job{jobs.length !== 1 ? "s" : ""}{search ? ` matching "${search}"` : ""}</span>
                <span>{money(jobs.reduce((s: number, q: any) => s + Number(q.total || 0), 0))}</span>
              </div>
            </div>
          </div>

          {/* RIGHT / MOBILE DETAIL: Detail panel */}
          <div className={`overflow-hidden bg-white
            flex-1
            ${mobileView === "list" ? "hidden sm:block" : "block w-full"}`}>
            {selectedJob ? (
              <DetailPanel q={selectedJob} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 px-4">
                <FileText className="w-16 h-16 mb-4 opacity-30" />
                <p className="text-sm font-semibold text-gray-400 text-center">Select a job to view its details</p>
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
          /* Hide all app chrome — navbar, screen-only UI */
          nav, header { display: none !important; }
          .screen-only { display: none !important; }
          .print-only  { display: block !important; }

          @page { size: A4 portrait; margin: 12mm; }
          body  { font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }

          body[data-print-mode="summary"] #print-details { display: none !important; }
          body[data-print-mode="full"]    #print-details { display: block !important; }

          #report-body { page-break-before: avoid; break-before: avoid; }
        }
      `}</style>
    </>
  );
}
