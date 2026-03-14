import { useQuotes } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";
import {
  Printer, ArrowLeft, FileText, ChevronDown, ChevronRight,
  Download, Filter, X, CheckCircle2, Clock, MapPin
} from "lucide-react";
import { useState } from "react";

/* ─── Company constants ─────────────────────────────────────── */
const COMPANY = "The Moving Guy Pte Ltd";
const UEN     = "202424156H";
const ADDRESS = "160 Robinson Road, #14-04 SBF Center, Singapore 068914";
const PHONE   = "+65 8088 0757";
const EMAIL   = "sales@tmginstall.com";
const WEBSITE = "tmginstall.com";

/* ─── Helpers ───────────────────────────────────────────────── */
function sgd(v: any) {
  return `S$${Number(v || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function d(v?: string | null, time = false) {
  if (!v) return "—";
  return time ? format(new Date(v), "d MMM yyyy, h:mm a") : format(new Date(v), "d MMM yyyy");
}
function getUpdate(updates: any[], statusChange: string) {
  return (updates || []).find((u: any) => u.statusChange === statusChange && u.gpsLat);
}
function parseServices(raw: string | null) {
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

/* ─── CSV Export ────────────────────────────────────────────── */
function exportCSV(jobs: any[]) {
  const h = ["Ref No","Created","Customer","Phone","Email","Service Address","Job Date","Time Window","Staff","Subtotal","Transport","Discount","Total","Deposit Amt","Deposit Paid","Final Amt","Final Paid","Status"];
  const rows = jobs.map(q => {
    const addr = q.pickupAddress ? `${q.pickupAddress} → ${q.dropoffAddress}` : (q.serviceAddress || "");
    return [
      q.referenceNo, d(q.createdAt), q.customer?.name || "", q.customer?.phone || "", q.customer?.email || "",
      addr, q.scheduledAt ? format(new Date(q.scheduledAt), "d MMM yyyy") : "", q.timeWindow || "",
      q.assignedStaff?.name || "",
      Number(q.subtotal||0).toFixed(2), Number(q.transportFee||0).toFixed(2), Number(q.discount||0).toFixed(2),
      Number(q.total||0).toFixed(2),
      Number(q.depositAmount||0).toFixed(2), q.depositPaidAt ? d(q.depositPaidAt) : "",
      Number(q.finalAmount||0).toFixed(2), q.finalPaidAt ? d(q.finalPaidAt) : "",
      q.status === "final_paid" ? "Fully Paid" : "Closed",
    ].map(v => `"${String(v).replace(/"/g,'""')}"`);
  });
  const csv = [h.map(x=>`"${x}"`).join(","), ...rows.map(r=>r.join(","))].join("\n");
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8;" })),
    download: `TMG_Jobs_${format(new Date(),"yyyy-MM-dd")}.csv`,
  });
  a.click();
}

/* ─── Print helpers ─────────────────────────────────────────── */
function triggerPrint(mode: "summary" | "full") {
  document.body.dataset.printMode = mode;
  setTimeout(() => {
    window.print();
    setTimeout(() => { delete document.body.dataset.printMode; }, 800);
  }, 80);
}

/* ══════════════════════════════════════════════════════════════
   PRINT-ONLY JOB DETAIL  (rendered outside the <table>)
══════════════════════════════════════════════════════════════ */
function PrintJobDetail({ q, today }: { q: any; today: string }) {
  const arrived   = getUpdate(q.updates, "in_progress");
  const completed = getUpdate(q.updates, "completed");
  const notes     = (q.updates || []).filter((u: any) => u.note && !u.gpsLat);
  const items     = q.items || [];
  const services  = parseServices(q.selectedServices);
  const isRelocation = !!q.pickupAddress;

  return (
    <div className="print-job-detail" style={{ pageBreakBefore:"always", breakBefore:"page" }}>
      {/* ── Job header band ── */}
      <div style={{ background:"#000", color:"#fff", padding:"10px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div>
          <div style={{ fontSize:8, letterSpacing:2, opacity:.5, textTransform:"uppercase", marginBottom:2 }}>Job Detail — Audit Record</div>
          <div style={{ fontSize:16, fontWeight:900, fontFamily:"monospace" }}>{q.referenceNo}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{
            display:"inline-block", padding:"2px 8px", borderRadius:99, fontSize:9, fontWeight:700,
            background: q.status==="final_paid" ? "#22c55e" : "rgba(255,255,255,0.15)", color:"#fff"
          }}>
            {q.status === "final_paid" ? "FULLY PAID" : "CLOSED"}
          </div>
          <div style={{ fontSize:9, opacity:.4, marginTop:3 }}>Submitted {d(q.createdAt)}</div>
        </div>
      </div>

      {/* ── Two-column body ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, padding:"0 4px" }}>

        {/* LEFT COLUMN */}
        <div>
          <PBlock title="Customer">
            <PRow label="Name"  val={q.customer?.name  || "—"} />
            <PRow label="Phone" val={q.customer?.phone || "—"} />
            <PRow label="Email" val={q.customer?.email || "—"} />
          </PBlock>

          <PBlock title="Service Location">
            {isRelocation ? (
              <>
                <PRow label="Pickup"   val={q.pickupAddress} />
                <PRow label="Drop-off" val={q.dropoffAddress} />
              </>
            ) : (
              <PRow label="Address" val={q.serviceAddress || "—"} />
            )}
            {services.length > 0 && <PRow label="Services" val={services.join(", ")} />}
            {q.accessDifficulty && <PRow label="Access"   val={q.accessDifficulty} />}
            {q.floorsInfo       && <PRow label="Floors"   val={q.floorsInfo} />}
          </PBlock>

          <PBlock title="Appointment">
            <PRow label="Date"  val={q.scheduledAt ? format(new Date(q.scheduledAt), "EEEE, d MMMM yyyy") : "—"} />
            {q.timeWindow && <PRow label="Time" val={q.timeWindow} />}
            <PRow label="Staff" val={q.assignedStaff?.name || "—"} />
          </PBlock>

          <PBlock title="On-Site GPS Record">
            {arrived ? (
              <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:6, padding:"6px 8px", marginBottom:6 }}>
                <div style={{ fontSize:8, fontWeight:700, color:"#2563eb", textTransform:"uppercase", letterSpacing:1 }}>📍 Staff Arrived</div>
                <div style={{ fontSize:13, fontWeight:900, color:"#1e3a8a" }}>{format(new Date(arrived.createdAt),"h:mm a")}</div>
                <div style={{ fontSize:9, color:"#3b82f6" }}>{format(new Date(arrived.createdAt),"EEEE, d MMM yyyy")}</div>
                <div style={{ fontSize:8, color:"#93c5fd", marginTop:2 }}>GPS {Number(arrived.gpsLat).toFixed(5)}, {Number(arrived.gpsLng).toFixed(5)}</div>
              </div>
            ) : (
              <div style={{ border:"1px dashed #e5e7eb", borderRadius:6, padding:"6px 8px", fontSize:9, color:"#9ca3af", marginBottom:6 }}>No arrival GPS recorded</div>
            )}
            {completed ? (
              <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:6, padding:"6px 8px" }}>
                <div style={{ fontSize:8, fontWeight:700, color:"#16a34a", textTransform:"uppercase", letterSpacing:1 }}>✅ Completed</div>
                <div style={{ fontSize:13, fontWeight:900, color:"#14532d" }}>{format(new Date(completed.createdAt),"h:mm a")}</div>
                <div style={{ fontSize:9, color:"#22c55e" }}>{format(new Date(completed.createdAt),"EEEE, d MMM yyyy")}</div>
                {arrived && (
                  <div style={{ fontSize:8, color:"#86efac", marginTop:2 }}>
                    ⏱ {Math.round((new Date(completed.createdAt).getTime() - new Date(arrived.createdAt).getTime()) / 60000)} min on-site
                  </div>
                )}
                <div style={{ fontSize:8, color:"#86efac" }}>GPS {Number(completed.gpsLat).toFixed(5)}, {Number(completed.gpsLng).toFixed(5)}</div>
              </div>
            ) : (
              <div style={{ border:"1px dashed #e5e7eb", borderRadius:6, padding:"6px 8px", fontSize:9, color:"#9ca3af" }}>No completion GPS recorded</div>
            )}
          </PBlock>

          {notes.length > 0 && (
            <PBlock title="Notes & Updates">
              {notes.map((u: any) => (
                <div key={u.id} style={{ background:"#f9fafb", borderRadius:4, padding:"4px 6px", marginBottom:4, fontSize:9 }}>
                  <div style={{ color:"#6b7280", marginBottom:2 }}>{u.actorType} · {d(u.createdAt, true)}</div>
                  <div style={{ color:"#374151", fontStyle:"italic" }}>"{u.note}"</div>
                </div>
              ))}
            </PBlock>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div>
          <PBlock title="Scope of Work">
            {items.length === 0 ? (
              <div style={{ fontSize:9, color:"#9ca3af" }}>No items recorded.</div>
            ) : (
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:9 }}>
                <thead>
                  <tr style={{ background:"#f3f4f6" }}>
                    {["Item","Type","Qty","Unit Price","Total"].map(h => (
                      <th key={h} style={{ padding:"3px 5px", textAlign:["Qty","Unit Price","Total"].includes(h)?"right":"left", fontWeight:700, fontSize:8 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any, ii: number) => (
                    <tr key={it.id} style={{ background: ii%2===0 ? "#fff" : "#f9fafb" }}>
                      <td style={{ padding:"3px 5px", fontWeight:600, borderBottom:"1px solid #f3f4f6" }}>{it.detectedName || it.originalDescription}</td>
                      <td style={{ padding:"3px 5px", color:"#6b7280", textTransform:"capitalize", borderBottom:"1px solid #f3f4f6" }}>{it.serviceType}</td>
                      <td style={{ padding:"3px 5px", textAlign:"right", borderBottom:"1px solid #f3f4f6" }}>{it.quantity}</td>
                      <td style={{ padding:"3px 5px", textAlign:"right", borderBottom:"1px solid #f3f4f6" }}>{sgd(it.unitPrice)}</td>
                      <td style={{ padding:"3px 5px", textAlign:"right", fontWeight:700, borderBottom:"1px solid #f3f4f6" }}>{sgd(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </PBlock>

          <PBlock title="Financial Summary">
            <table style={{ width:"100%", fontSize:9 }}>
              <tbody>
                <PFinRow label="Labour subtotal"   val={sgd(q.subtotal)} />
                {Number(q.transportFee||0)>0 && <PFinRow label="Transport & logistics" val={sgd(q.transportFee)} />}
                {Number(q.discount||0)>0     && <PFinRow label="Discount"              val={`−${sgd(q.discount)}`} red />}
                <tr style={{ borderTop:"2px solid #000", borderBottom:"2px solid #000" }}>
                  <td style={{ padding:"5px 0", fontWeight:900, fontSize:11 }}>GRAND TOTAL</td>
                  <td style={{ padding:"5px 0", textAlign:"right", fontWeight:900, fontSize:11 }}>{sgd(q.total)}</td>
                </tr>
                <PFinRow label={`Deposit 50%${q.depositPaidAt?" ✓":""}`} val={sgd(q.depositAmount)} green={!!q.depositPaidAt} />
                {q.depositPaidAt && <tr><td colSpan={2} style={{ fontSize:8, color:"#6b7280", padding:"1px 0 3px 12px" }}>Paid {d(q.depositPaidAt, true)}</td></tr>}
                <PFinRow label={`Final 50%${q.finalPaidAt?" ✓":""}`} val={sgd(q.finalAmount)} green={!!q.finalPaidAt} />
                {q.finalPaidAt && <tr><td colSpan={2} style={{ fontSize:8, color:"#6b7280", padding:"1px 0 3px 12px" }}>Paid {d(q.finalPaidAt, true)}</td></tr>}
              </tbody>
            </table>
          </PBlock>

          {/* Audit certification box */}
          <PBlock title="Audit Certification">
            <div style={{ border:"2px dashed #e5e7eb", borderRadius:8, padding:10 }}>
              {["Verified by","Date verified","Signature"].map(label => (
                <div key={label} style={{ display:"flex", alignItems:"flex-end", gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:8, color:"#9ca3af", width:72, flexShrink:0 }}>{label}</span>
                  <div style={{ flex:1, borderBottom:"1px solid #d1d5db", paddingBottom:2 }}>
                    {label === "Verified by" && <span style={{ fontSize:8, color:"#d1d5db" }}>Admin / Operations</span>}
                  </div>
                </div>
              ))}
            </div>
          </PBlock>
        </div>
      </div>

      {/* Footer strip */}
      <div style={{ marginTop:12, paddingTop:6, borderTop:"1px solid #e5e7eb", display:"flex", justifyContent:"space-between", fontSize:8, color:"#9ca3af" }}>
        <span>{COMPANY} · UEN {UEN}</span>
        <span style={{ fontFamily:"monospace", fontWeight:700 }}>{q.referenceNo}</span>
        <span>Confidential · Audit use only · {today}</span>
      </div>
    </div>
  );
}

function PBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:8, fontWeight:900, textTransform:"uppercase", letterSpacing:2, color:"#6b7280", borderBottom:"1px solid #e5e7eb", paddingBottom:3, marginBottom:6 }}>{title}</div>
      {children}
    </div>
  );
}
function PRow({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ display:"flex", gap:6, padding:"2px 0", fontSize:9, borderBottom:"1px solid #f9fafb" }}>
      <span style={{ color:"#9ca3af", width:56, flexShrink:0 }}>{label}</span>
      <span style={{ fontWeight:600, flex:1 }}>{val}</span>
    </div>
  );
}
function PFinRow({ label, val, red, green }: { label: string; val: string; red?: boolean; green?: boolean }) {
  return (
    <tr>
      <td style={{ padding:"3px 0", color: green ? "#15803d" : red ? "#dc2626" : "#6b7280" }}>{label}</td>
      <td style={{ padding:"3px 0", textAlign:"right", fontWeight:600, color: green ? "#15803d" : red ? "#dc2626" : undefined }}>{val}</td>
    </tr>
  );
}

/* ══════════════════════════════════════════════════════════════
   SCREEN EXPANDED JOB DETAIL
══════════════════════════════════════════════════════════════ */
function ScreenJobDetail({ q }: { q: any }) {
  const arrived   = getUpdate(q.updates, "in_progress");
  const completed = getUpdate(q.updates, "completed");
  const notes     = (q.updates || []).filter((u: any) => u.note && !u.gpsLat);
  const items     = q.items || [];
  const services  = parseServices(q.selectedServices);
  const isRelocation = !!q.pickupAddress;

  return (
    <div className="p-5 grid grid-cols-2 gap-6 bg-white">
      <div className="space-y-5">
        <SBlock title="Customer">
          <SRow label="Name"  val={q.customer?.name  || "—"} />
          <SRow label="Phone" val={q.customer?.phone || "—"} />
          <SRow label="Email" val={q.customer?.email || "—"} />
        </SBlock>
        <SBlock title="Service Location">
          {isRelocation ? (<><SRow label="Pickup" val={q.pickupAddress} /><SRow label="Drop-off" val={q.dropoffAddress} /></>) : <SRow label="Address" val={q.serviceAddress || "—"} />}
          {services.length > 0 && <SRow label="Services" val={services.join(", ")} />}
          {q.accessDifficulty && <SRow label="Access"  val={q.accessDifficulty} />}
          {q.floorsInfo       && <SRow label="Floors"  val={q.floorsInfo} />}
        </SBlock>
        <SBlock title="Appointment">
          <SRow label="Date"  val={q.scheduledAt ? format(new Date(q.scheduledAt), "EEEE, d MMMM yyyy") : "—"} />
          {q.timeWindow && <SRow label="Time" val={q.timeWindow} />}
          <SRow label="Staff" val={q.assignedStaff?.name || "—"} />
        </SBlock>
        <SBlock title="On-Site GPS Record">
          <div className="space-y-2">
            {arrived ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wide">Staff Arrived</span>
                </div>
                <p className="text-sm font-black text-blue-900">{format(new Date(arrived.createdAt),"h:mm a")}</p>
                <p className="text-xs text-blue-700">{format(new Date(arrived.createdAt),"EEEE, d MMM yyyy")}</p>
                <p className="text-[9px] text-blue-400 mt-1">GPS {Number(arrived.gpsLat).toFixed(5)}, {Number(arrived.gpsLng).toFixed(5)}</p>
              </div>
            ) : <div className="border border-dashed rounded-xl p-3 text-xs text-muted-foreground">No arrival GPS recorded</div>}
            {completed ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">Job Completed</span>
                </div>
                <p className="text-sm font-black text-emerald-900">{format(new Date(completed.createdAt),"h:mm a")}</p>
                <p className="text-xs text-emerald-700">{format(new Date(completed.createdAt),"EEEE, d MMM yyyy")}</p>
                {arrived && <p className="text-[9px] text-emerald-400 mt-1">⏱ {Math.round((new Date(completed.createdAt).getTime() - new Date(arrived.createdAt).getTime())/60000)} min on-site</p>}
                <p className="text-[9px] text-emerald-400">GPS {Number(completed.gpsLat).toFixed(5)}, {Number(completed.gpsLng).toFixed(5)}</p>
              </div>
            ) : <div className="border border-dashed rounded-xl p-3 text-xs text-muted-foreground">No completion GPS recorded</div>}
          </div>
        </SBlock>
        {notes.length > 0 && (
          <SBlock title="Notes & Updates">
            {notes.map((u: any) => (
              <div key={u.id} className="bg-secondary/40 rounded-lg px-3 py-2 mb-1.5">
                <div className="flex justify-between mb-0.5">
                  <span className="text-[9px] font-bold text-muted-foreground capitalize">{u.actorType} · {u.statusChange?.replace(/_/g," ")}</span>
                  <span className="text-[9px] text-muted-foreground">{d(u.createdAt,true)}</span>
                </div>
                <p className="text-xs italic">"{u.note}"</p>
              </div>
            ))}
          </SBlock>
        )}
      </div>
      <div className="space-y-5">
        <SBlock title="Scope of Work">
          {items.length === 0 ? <p className="text-xs text-muted-foreground">No items recorded.</p> : (
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-foreground/5">
                {["Item","Type","Qty","Unit","Total"].map(h => (
                  <th key={h} className={`px-2 py-1.5 font-bold text-[9px] ${["Qty","Unit","Total"].includes(h)?"text-right":"text-left"}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{items.map((it:any,ii:number) => (
                <tr key={it.id} className={ii%2===0?"":"bg-secondary/20"}>
                  <td className="px-2 py-1.5 border-b border-gray-100 font-semibold">{it.detectedName||it.originalDescription}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 capitalize text-muted-foreground">{it.serviceType}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right">{it.quantity}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right">{sgd(it.unitPrice)}</td>
                  <td className="px-2 py-1.5 border-b border-gray-100 text-right font-bold">{sgd(it.subtotal)}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </SBlock>
        <SBlock title="Financial Summary">
          <table className="w-full text-xs">
            <tbody>
              <tr><td className="py-1.5 text-muted-foreground">Labour</td><td className="py-1.5 text-right font-semibold">{sgd(q.subtotal)}</td></tr>
              {Number(q.transportFee||0)>0 && <tr><td className="py-1.5 text-muted-foreground">Transport &amp; logistics</td><td className="py-1.5 text-right font-semibold">{sgd(q.transportFee)}</td></tr>}
              {Number(q.discount||0)>0 && <tr><td className="py-1.5 text-muted-foreground">Discount</td><td className="py-1.5 text-right font-semibold text-red-600">−{sgd(q.discount)}</td></tr>}
              <tr className="border-t-2 border-b-2 border-black font-black">
                <td className="py-2 text-sm">Grand Total</td><td className="py-2 text-right text-sm">{sgd(q.total)}</td>
              </tr>
              <tr><td className="py-1.5 text-muted-foreground">Deposit 50% {q.depositPaidAt && <span className="text-emerald-600">✓</span>}</td><td className="py-1.5 text-right font-semibold text-emerald-700">{sgd(q.depositAmount)}</td></tr>
              {q.depositPaidAt && <tr><td colSpan={2} className="text-[9px] text-muted-foreground pl-4 pb-1">Paid {d(q.depositPaidAt,true)}</td></tr>}
              <tr><td className="py-1.5 text-muted-foreground">Final 50% {q.finalPaidAt && <span className="text-emerald-600">✓</span>}</td><td className="py-1.5 text-right font-semibold text-emerald-700">{sgd(q.finalAmount)}</td></tr>
              {q.finalPaidAt && <tr><td colSpan={2} className="text-[9px] text-muted-foreground pl-4 pb-1">Paid {d(q.finalPaidAt,true)}</td></tr>}
            </tbody>
          </table>
        </SBlock>
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4">
          <p className="text-[9px] font-black uppercase tracking-[2px] text-muted-foreground mb-3">Audit Certification</p>
          {["Verified by","Date verified","Signature"].map(label => (
            <div key={label} className="flex items-end gap-2 mb-3">
              <span className="text-[9px] text-muted-foreground w-20 shrink-0">{label}</span>
              <div className="flex-1 border-b border-gray-300 pb-0.5">
                {label==="Verified by" && <span className="text-[9px] text-muted-foreground/40">Admin / Operations</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function SBlock({ title, children }: { title:string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[2px] text-muted-foreground mb-2 pb-1.5 border-b">{title}</p>
      <div>{children}</div>
    </div>
  );
}
function SRow({ label, val }: { label:string; val:string }) {
  return (
    <div className="flex gap-2 py-1 text-xs border-b border-gray-50 last:border-0">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="font-semibold flex-1">{val}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════ */
export default function ExportPDF() {
  const { data: allQuotes, isLoading } = useQuotes();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const today = new Date();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"final_paid"|"closed">("all");
  const generatedAt = format(new Date(), "d MMMM yyyy, HH:mm");

  const applyPreset = (p: string) => {
    if (p==="thisMonth")  { setDateFrom(format(startOfMonth(today),"yyyy-MM-dd")); setDateTo(format(endOfMonth(today),"yyyy-MM-dd")); }
    else if (p==="lastMonth") { const pm=subMonths(today,1); setDateFrom(format(startOfMonth(pm),"yyyy-MM-dd")); setDateTo(format(endOfMonth(pm),"yyyy-MM-dd")); }
    else if (p==="thisYear")  { setDateFrom(format(startOfYear(today),"yyyy-MM-dd")); setDateTo(format(endOfYear(today),"yyyy-MM-dd")); }
    else { setDateFrom(""); setDateTo(""); }
  };
  const clearFilters = () => { setDateFrom(""); setDateTo(""); setStatusFilter("all"); };
  const hasFilters = !!(dateFrom || dateTo || statusFilter !== "all");

  const baseJobs = (allQuotes||[])
    .filter((q:any) => ["closed","final_paid"].includes(q.status))
    .sort((a:any,b:any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const jobs = baseJobs.filter((q:any) => {
    if (statusFilter!=="all" && q.status!==statusFilter) return false;
    const ref = q.scheduledAt || q.createdAt;
    if (dateFrom && ref && new Date(ref) < new Date(dateFrom)) return false;
    if (dateTo   && ref && new Date(ref) > new Date(dateTo+"T23:59:59")) return false;
    return true;
  });

  const totalRev  = jobs.reduce((s:number,q:any)=>s+Number(q.total||0),0);
  const totalDep  = jobs.reduce((s:number,q:any)=>s+Number(q.depositAmount||0),0);
  const totalFin  = jobs.reduce((s:number,q:any)=>s+Number(q.finalAmount||0),0);
  const paidCount = jobs.filter((q:any)=>q.status==="final_paid").length;
  const avgDeal   = jobs.length ? totalRev/jobs.length : 0;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      {/* ══ TOOLBAR (screen only) ══ */}
      <div className="screen-only bg-white border-b px-5 py-2.5 sticky top-14 z-40 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link href="/admin">
              <button className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            </Link>
            <span className="text-muted-foreground/30">|</span>
            <div className="flex items-center gap-1.5 text-sm font-bold">
              <FileText className="w-4 h-4 text-primary" /> Closed Jobs — Audit Report
            </div>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {jobs.length} of {baseJobs.length}
            </span>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-primary font-bold">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowFilters(f=>!f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-xl border-2 transition-all ${showFilters||hasFilters?"border-primary bg-primary/5 text-primary":"border-border"}`}
              data-testid="button-toggle-filters">
              <Filter className="w-3.5 h-3.5" /> Filter {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </button>
            <button onClick={() => exportCSV(jobs)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors"
              data-testid="button-export-csv">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={() => triggerPrint("summary")}
              className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-foreground text-foreground text-sm font-bold rounded-xl hover:bg-secondary transition-colors"
              data-testid="button-print-summary">
              <Printer className="w-3.5 h-3.5" /> Print Summary
            </button>
            <button onClick={() => triggerPrint("full")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-sm font-bold rounded-xl hover:bg-foreground/90 transition-colors"
              data-testid="button-print-full">
              <Printer className="w-3.5 h-3.5" /> Print Full Report
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-2.5 pt-2.5 border-t flex flex-wrap items-end gap-3">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Period</p>
              <div className="flex gap-1.5">
                {[["all","All Time"],["thisMonth","This Month"],["lastMonth","Last Month"],["thisYear","This Year"]].map(([v,l])=>(
                  <button key={v} onClick={()=>applyPreset(v)}
                    className="px-2.5 py-1 text-xs font-bold border rounded-lg hover:bg-secondary transition-colors">{l}</button>
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground mb-1">From (Job Date)</p>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                  className="px-3 py-1.5 border rounded-xl text-sm bg-background" data-testid="input-filter-from" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground mb-1">To</p>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                  className="px-3 py-1.5 border rounded-xl text-sm bg-background" data-testid="input-filter-to" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wide">Status</p>
              <div className="flex gap-1.5">
                {([["all","All"],["final_paid","Fully Paid"],["closed","Closed (Unpaid)"]] as const).map(([v,l])=>(
                  <button key={v} onClick={()=>setStatusFilter(v)}
                    className={`px-2.5 py-1 text-xs font-bold border-2 rounded-lg transition-all ${statusFilter===v?"border-primary bg-primary/5 text-primary":"border-border"}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ SHARED HEADER (screen + print) ══ */}
      <div id="report-header" className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-start justify-between mb-5 pb-4 border-b-2 border-foreground">
          <div>
            <h1 className="text-2xl font-black tracking-tight">TMG INSTALL</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{COMPANY} · UEN {UEN}</p>
            <p className="text-xs text-muted-foreground">{ADDRESS}</p>
            <p className="text-xs text-muted-foreground">{WEBSITE} · {PHONE} · {EMAIL}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black">Closed Jobs — Audit Report</p>
            {(dateFrom||dateTo) && (
              <p className="text-sm font-bold text-primary mt-0.5">
                {dateFrom ? format(new Date(dateFrom),"d MMM yyyy") : "Beginning"} – {dateTo ? format(new Date(dateTo),"d MMM yyyy") : "Today"}
              </p>
            )}
            {statusFilter!=="all" && <p className="text-xs text-muted-foreground">{statusFilter==="final_paid"?"Fully Paid Only":"Closed (Unpaid) Only"}</p>}
            <p className="text-xs text-muted-foreground mt-1">Generated: {generatedAt}</p>
            <p className="text-xs text-muted-foreground">{jobs.length} job{jobs.length!==1?"s":""}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {[
            { label:"Total Revenue",        val:sgd(totalRev),  cls:"bg-emerald-50 border-emerald-200 text-emerald-800 border", big:true },
            { label:"Deposits Collected",   val:sgd(totalDep),  cls:"bg-secondary/40 border" },
            { label:"Finals Collected",     val:sgd(totalFin),  cls:"bg-secondary/40 border" },
            { label:"Fully Paid",           val:`${paidCount} / ${jobs.length}`, cls:"bg-secondary/40 border" },
            { label:"Avg Deal",             val:sgd(avgDeal),   cls:"bg-secondary/40 border" },
          ].map(c => (
            <div key={c.label} className={`rounded-xl p-4 ${c.cls}`}>
              <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{c.label}</p>
              <p className={`font-black ${c.big?"text-xl":"text-base"}`}>{c.val}</p>
            </div>
          ))}
        </div>

        {/* ── Screen summary table ── */}
        <div className="screen-only">
          {jobs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold">No jobs match the current filters.</p>
              <button onClick={clearFilters} className="mt-2 text-primary text-sm font-bold underline">Clear filters</button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-foreground text-background">
                    <th className="w-6 px-2 py-2.5" />
                    {["Ref No","Created","Customer","Service Address","Job Date","Staff","Total","Deposit","Balance","Status"].map(h=>(
                      <th key={h} className={`px-3 py-2.5 font-bold text-xs whitespace-nowrap ${["Total","Deposit","Balance"].includes(h)?"text-right":h==="Status"?"text-center":"text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((q:any, i:number) => {
                    const isOpen = expandedId === q.id;
                    const addr = q.pickupAddress ? `${q.pickupAddress} → ${q.dropoffAddress}` : (q.serviceAddress||"—");
                    return (
                      <>
                        <tr key={`r-${q.id}`}
                          onClick={() => setExpandedId(isOpen?null:q.id)}
                          className={`cursor-pointer transition-colors ${isOpen?"bg-primary/5 border-l-4 border-l-primary":i%2===0?"bg-white hover:bg-secondary/30":"bg-secondary/10 hover:bg-secondary/30"}`}
                          data-testid={`row-job-${q.id}`}>
                          <td className="px-2 py-2.5">{isOpen?<ChevronDown className="w-4 h-4 text-primary"/>:<ChevronRight className="w-4 h-4 text-muted-foreground"/>}</td>
                          <td className="px-3 py-2.5 font-mono text-xs font-bold text-primary whitespace-nowrap">{q.referenceNo}</td>
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap">{d(q.createdAt)}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-xs">{q.customer?.name}</div>
                            <div className="text-xs text-muted-foreground">{q.customer?.phone}</div>
                          </td>
                          <td className="px-3 py-2.5 text-xs max-w-[150px]"><span className="line-clamp-2">{addr}</span></td>
                          <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                            {q.scheduledAt ? format(new Date(q.scheduledAt),"d MMM yyyy") : "—"}
                            {q.timeWindow && <div className="text-muted-foreground text-xs">{q.timeWindow}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-xs">{q.assignedStaff?.name||"—"}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-xs">{sgd(q.total)}</td>
                          <td className="px-3 py-2.5 text-right text-xs">
                            {q.depositPaidAt?<span className="font-bold text-emerald-700">✓ {sgd(q.depositAmount)}</span>:<span className="text-muted-foreground">{sgd(q.depositAmount)}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs">
                            {q.finalPaidAt?<span className="font-bold text-emerald-700">✓ {sgd(q.finalAmount)}</span>:<span className="text-muted-foreground">{sgd(q.finalAmount)}</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${q.status==="final_paid"?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-600"}`}>
                              {q.status==="final_paid"?"Paid":"Closed"}
                            </span>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`d-${q.id}`}>
                            <td colSpan={11} className="p-0 border-b-2 border-primary/20">
                              <div className="bg-foreground text-background px-5 py-3 flex items-center justify-between">
                                <div>
                                  <p className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Job Detail — Audit Record</p>
                                  <p className="text-base font-black font-mono">{q.referenceNo}</p>
                                </div>
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${q.status==="final_paid"?"bg-emerald-500 text-white":"bg-white/20 text-white"}`}>
                                  {q.status==="final_paid"?"Fully Paid":"Closed"}
                                </span>
                              </div>
                              <ScreenJobDetail q={q} />
                              <div className="px-5 py-2 border-t bg-secondary/20 flex items-center justify-between text-[9px] text-muted-foreground">
                                <span>{COMPANY} · UEN {UEN}</span>
                                <span className="font-mono font-bold">{q.referenceNo}</span>
                                <span>Confidential · {generatedAt}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-foreground text-background font-bold">
                    <td />
                    <td colSpan={5} className="px-3 py-2.5 text-xs">TOTALS ({jobs.length} job{jobs.length!==1?"s":""})</td>
                    <td className="px-3 py-2.5 text-right text-xs">{sgd(totalRev)}</td>
                    <td className="px-3 py-2.5 text-right text-xs">{sgd(totalDep)}</td>
                    <td className="px-3 py-2.5 text-right text-xs">{sgd(totalFin)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ── Print summary table (inline, no expand chevrons) ── */}
        <div className="print-only">
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:9 }}>
            <thead>
              <tr style={{ background:"#000", color:"#fff" }}>
                {["Ref No","Created","Customer","Service Address","Job Date","Staff","Total","Deposit","Balance","Status"].map(h=>(
                  <th key={h} style={{ padding:"5px 8px", fontWeight:700, fontSize:9, textAlign:["Total","Deposit","Balance"].includes(h)?"right":h==="Status"?"center":"left", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((q:any, i:number) => {
                const addr = q.pickupAddress ? `${q.pickupAddress} → ${q.dropoffAddress}` : (q.serviceAddress||"—");
                return (
                  <tr key={q.id} style={{ background:i%2===0?"#fff":"#f9fafb" }}>
                    <td style={{ padding:"4px 8px", fontFamily:"monospace", fontWeight:700, fontSize:8, color:"#1d4ed8", whiteSpace:"nowrap" }}>{q.referenceNo}</td>
                    <td style={{ padding:"4px 8px", fontSize:8, whiteSpace:"nowrap" }}>{d(q.createdAt)}</td>
                    <td style={{ padding:"4px 8px" }}>
                      <div style={{ fontWeight:600, fontSize:9 }}>{q.customer?.name}</div>
                      <div style={{ fontSize:8, color:"#6b7280" }}>{q.customer?.phone}</div>
                    </td>
                    <td style={{ padding:"4px 8px", fontSize:8, maxWidth:130 }}>{addr}</td>
                    <td style={{ padding:"4px 8px", fontSize:8, whiteSpace:"nowrap" }}>
                      {q.scheduledAt ? format(new Date(q.scheduledAt),"d MMM yyyy") : "—"}
                      {q.timeWindow && <div style={{ color:"#6b7280", fontSize:8 }}>{q.timeWindow}</div>}
                    </td>
                    <td style={{ padding:"4px 8px", fontSize:8 }}>{q.assignedStaff?.name||"—"}</td>
                    <td style={{ padding:"4px 8px", textAlign:"right", fontWeight:700, fontSize:9 }}>{sgd(q.total)}</td>
                    <td style={{ padding:"4px 8px", textAlign:"right", fontSize:9, color:q.depositPaidAt?"#15803d":"#6b7280", fontWeight:q.depositPaidAt?700:400 }}>
                      {q.depositPaidAt?"✓ ":""}{sgd(q.depositAmount)}
                    </td>
                    <td style={{ padding:"4px 8px", textAlign:"right", fontSize:9, color:q.finalPaidAt?"#15803d":"#6b7280", fontWeight:q.finalPaidAt?700:400 }}>
                      {q.finalPaidAt?"✓ ":""}{sgd(q.finalAmount)}
                    </td>
                    <td style={{ padding:"4px 8px", textAlign:"center" }}>
                      <span style={{ display:"inline-block", padding:"1px 6px", borderRadius:99, fontSize:8, fontWeight:700, textTransform:"uppercase", background:q.status==="final_paid"?"#dcfce7":"#f1f5f9", color:q.status==="final_paid"?"#15803d":"#475569" }}>
                        {q.status==="final_paid"?"PAID":"CLOSED"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:"#000", color:"#fff", fontWeight:700 }}>
                <td colSpan={6} style={{ padding:"5px 8px", fontSize:9 }}>TOTALS ({jobs.length} job{jobs.length!==1?"s":""})</td>
                <td style={{ padding:"5px 8px", textAlign:"right", fontSize:9 }}>{sgd(totalRev)}</td>
                <td style={{ padding:"5px 8px", textAlign:"right", fontSize:9 }}>{sgd(totalDep)}</td>
                <td style={{ padding:"5px 8px", textAlign:"right", fontSize:9 }}>{sgd(totalFin)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
          <div style={{ marginTop:16, paddingTop:8, borderTop:"1px solid #e5e7eb", display:"flex", justifyContent:"space-between", fontSize:8, color:"#9ca3af" }}>
            <span>TMG Install · {COMPANY} · UEN {UEN}</span>
            <span>Confidential — For internal audit use only</span>
            <span>Generated {generatedAt}</span>
          </div>
        </div>

        {/* Page footer (screen) */}
        <div className="screen-only mt-6 pt-4 border-t text-xs text-muted-foreground flex justify-between">
          <span>TMG Install · {COMPANY} · UEN {UEN}</span>
          <span>Confidential — For internal audit use only</span>
          <span>Generated {generatedAt}</span>
        </div>
      </div>

      {/* ══ PRINT-ONLY JOB DETAILS (completely outside table, proper page breaks) ══ */}
      <div id="print-details">
        {jobs.map(q => (
          <PrintJobDetail key={q.id} q={q} today={generatedAt} />
        ))}
      </div>

      {/* ══ STYLES ══ */}
      <style>{`
        /* Screen: hide print-only elements */
        .print-only  { display: none !important; }

        @media print {
          /* Hide ALL screen navigation, toolbar, etc. */
          .screen-only { display: none !important; }

          /* Show print-only content */
          .print-only { display: block !important; }

          /* Base print settings */
          @page { size: A4 landscape; margin: 10mm; }
          body  { font-size: 9px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* Summary mode: hide the per-job detail divs */
          body[data-print-mode="summary"] #print-details { display: none !important; }

          /* Full mode: show per-job detail divs */
          body[data-print-mode="full"] #print-details { display: block !important; }

          /* Each job detail gets its own page — this works on <div>, not <tr> */
          .print-job-detail {
            page-break-before: always;
            break-before: page;
            page-break-inside: avoid;
          }

          /* The report header section has no page break before it */
          #report-header { page-break-before: avoid; break-before: avoid; }

          /* Hide interactive chrome */
          button, a[href] { text-decoration: none !important; }
        }
      `}</style>
    </>
  );
}
