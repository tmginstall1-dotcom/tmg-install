import { useQuotes } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { format } from "date-fns";
import { Printer, ArrowLeft, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const COMPANY  = "The Moving Guy Pte Ltd";
const UEN      = "202424156H";
const ADDRESS  = "160 Robinson Road, #14-04 SBF Center, Singapore 068914";
const PHONE    = "+65 8088 0757";
const EMAIL    = "sales@tmginstall.com";
const WEBSITE  = "tmginstall.com";

function fmt(v: any) {
  return `$${Number(v || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null | undefined, includeTime = false) {
  if (!d) return "—";
  const date = new Date(d);
  return includeTime
    ? format(date, "d MMM yyyy, h:mm a")
    : format(date, "d MMM yyyy");
}

function getFieldEvent(updates: any[], statusChange: string) {
  return (updates || []).find((u: any) => u.statusChange === statusChange && u.gpsLat);
}

export default function ExportPDF() {
  const { data: allQuotes, isLoading } = useQuotes();
  const [showDetails, setShowDetails] = useState(true);

  const jobs = (allQuotes || [])
    .filter((q: any) => ["closed", "final_paid"].includes(q.status))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalRevenue = jobs.reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);
  const totalDeposit = jobs.reduce((sum: number, q: any) => sum + Number(q.depositAmount || 0), 0);
  const totalFinal   = jobs.reduce((sum: number, q: any) => sum + Number(q.finalAmount || 0), 0);
  const today        = format(new Date(), "d MMMM yyyy, HH:mm");

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      {/* ── Toolbar (hidden on print) ── */}
      <div className="print:hidden bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <button className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </Link>
          <span className="text-muted-foreground/40">|</span>
          <div className="flex items-center gap-2 text-sm font-bold">
            <FileText className="w-4 h-4 text-primary" />
            Closed Jobs — Audit Report
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDetails(v => !v)}
            className="flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-semibold hover:bg-secondary transition-colors"
          >
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {showDetails ? "Hide" : "Show"} Job Details
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-sm font-bold hover:bg-foreground/90 transition-colors"
            data-testid="button-print-pdf"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── Printable document ── */}
      <div className="max-w-5xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none">

        {/* ── Page 1: Summary ── */}
        <div className="print-page">

          {/* Document header */}
          <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-foreground">
            <div>
              <h1 className="text-2xl font-black tracking-tight">TMG INSTALL</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{COMPANY} · UEN {UEN}</p>
              <p className="text-xs text-muted-foreground">{ADDRESS}</p>
              <p className="text-xs text-muted-foreground">{WEBSITE} · {PHONE} · {EMAIL}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black">Closed Jobs — Audit Report</p>
              <p className="text-sm text-muted-foreground mt-1">Generated: {today}</p>
              <p className="text-sm text-muted-foreground">{jobs.length} job{jobs.length !== 1 ? "s" : ""} · {format(new Date(), "yyyy")}</p>
            </div>
          </div>

          {/* Summary stat boxes */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Revenue", value: fmt(totalRevenue), cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
              { label: "Total Deposits Collected", value: fmt(totalDeposit), cls: "bg-secondary/40 border" },
              { label: "Total Final Payments Collected", value: fmt(totalFinal), cls: "bg-secondary/40 border" },
            ].map(card => (
              <div key={card.label} className={`rounded-xl p-4 ${card.cls}`}>
                <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                <p className="text-lg font-black">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Summary table */}
          {jobs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">No closed jobs found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-foreground text-background">
                    {["Ref No", "Created", "Customer", "Service Address", "Job Date", "Staff", "Total", "Deposit", "Balance", "Status"].map(h => (
                      <th key={h} className={`px-3 py-2.5 font-bold text-xs ${["Total","Deposit","Balance"].includes(h) ? "text-right" : h === "Status" ? "text-center" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((q: any, i: number) => {
                    const addr = q.pickupAddress
                      ? `${q.pickupAddress} → ${q.dropoffAddress}`
                      : (q.serviceAddress || "—");
                    return (
                      <tr key={q.id} className={i % 2 === 0 ? "bg-white" : "bg-secondary/20"}>
                        <td className="px-3 py-2 font-mono text-xs font-bold text-primary whitespace-nowrap">{q.referenceNo}</td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(q.createdAt)}</td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-xs">{q.customer?.name}</div>
                          <div className="text-xs text-muted-foreground">{q.customer?.phone}</div>
                        </td>
                        <td className="px-3 py-2 text-xs max-w-[160px]">
                          <span className="line-clamp-2">{addr}</span>
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap">
                          {q.scheduledAt ? format(new Date(q.scheduledAt), "d MMM yyyy") : "—"}
                          {q.timeWindow && <div className="text-muted-foreground">{q.timeWindow}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs">{q.assignedStaff?.name || "—"}</td>
                        <td className="px-3 py-2 text-right font-bold text-xs">{fmt(q.total)}</td>
                        <td className="px-3 py-2 text-right text-xs text-emerald-700">
                          {q.depositPaidAt ? <span className="font-bold">✓ {fmt(q.depositAmount)}</span> : fmt(q.depositAmount)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-emerald-700">
                          {q.finalPaidAt ? <span className="font-bold">✓ {fmt(q.finalAmount)}</span> : fmt(q.finalAmount)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide ${
                            q.status === "final_paid" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                          }`}>{q.status === "final_paid" ? "Paid" : "Closed"}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-foreground text-background font-bold">
                    <td colSpan={6} className="px-3 py-2.5 text-xs">TOTALS ({jobs.length} job{jobs.length !== 1 ? "s" : ""})</td>
                    <td className="px-3 py-2.5 text-right text-xs">{fmt(totalRevenue)}</td>
                    <td className="px-3 py-2.5 text-right text-xs">{fmt(totalDeposit)}</td>
                    <td className="px-3 py-2.5 text-right text-xs">{fmt(totalFinal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Summary footer */}
          <div className="mt-6 pt-4 border-t text-xs text-muted-foreground flex justify-between">
            <span>TMG Install · {COMPANY} · UEN {UEN}</span>
            <span>Confidential — For internal audit use only</span>
            <span>Generated {today}</span>
          </div>
        </div>

        {/* ── Pages 2+: One detailed card per job ── */}
        {showDetails && jobs.length > 0 && (
          <div className="mt-12 print:mt-0 space-y-0">
            {jobs.map((q: any, idx: number) => {
              const arrivedUpdate   = getFieldEvent(q.updates, 'in_progress');
              const completedUpdate = getFieldEvent(q.updates, 'completed');
              const adminNotes      = (q.updates || []).filter((u: any) => u.note && !u.gpsLat);
              const hasRelocation   = !!q.pickupAddress;
              const services = (() => {
                try { return JSON.parse(q.selectedServices || "[]"); } catch { return []; }
              })();

              return (
                <div key={q.id} className="print-page-break">
                  {/* Job detail card */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden print:rounded-none print:border-0 print:border-t print:border-gray-300 mb-8 print:mb-0">

                    {/* Job header bar */}
                    <div className="bg-foreground text-background px-6 py-4 flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold tracking-widest text-white/40 uppercase mb-1">Job Detail — Audit Record</p>
                        <p className="text-xl font-black tracking-tight font-mono">{q.referenceNo}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${
                          q.status === "final_paid" ? "bg-emerald-500 text-white" : "bg-white/20 text-white"
                        }`}>
                          {q.status === "final_paid" ? "Fully Paid" : "Closed"}
                        </span>
                        <p className="text-xs text-white/50">Submitted {fmtDate(q.createdAt)}</p>
                      </div>
                    </div>

                    <div className="p-6 grid grid-cols-2 gap-6 print:gap-4">

                      {/* ── Left column ── */}
                      <div className="space-y-5">

                        {/* Customer */}
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground mb-2 pb-1.5 border-b">Customer</p>
                          <table className="w-full text-xs">
                            <tbody>
                              {[
                                ["Name",  q.customer?.name  || "—"],
                                ["Phone", q.customer?.phone || "—"],
                                ["Email", q.customer?.email || "—"],
                              ].map(([l, v]) => (
                                <tr key={l}>
                                  <td className="py-1 text-muted-foreground w-16 align-top">{l}</td>
                                  <td className="py-1 font-semibold">{v}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Service details */}
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground mb-2 pb-1.5 border-b">Service Details</p>
                          <table className="w-full text-xs">
                            <tbody>
                              {hasRelocation ? (
                                <>
                                  <tr><td className="py-1 text-muted-foreground w-20 align-top">Pickup</td><td className="py-1 font-semibold">{q.pickupAddress}</td></tr>
                                  <tr><td className="py-1 text-muted-foreground w-20 align-top">Drop-off</td><td className="py-1 font-semibold">{q.dropoffAddress}</td></tr>
                                </>
                              ) : (
                                <tr><td className="py-1 text-muted-foreground w-20 align-top">Address</td><td className="py-1 font-semibold">{q.serviceAddress || "—"}</td></tr>
                              )}
                              {services.length > 0 && (
                                <tr><td className="py-1 text-muted-foreground align-top">Services</td><td className="py-1 font-semibold capitalize">{services.join(", ")}</td></tr>
                              )}
                              {q.accessDifficulty && (
                                <tr><td className="py-1 text-muted-foreground align-top">Access</td><td className="py-1 font-semibold">{q.accessDifficulty}</td></tr>
                              )}
                              {q.floorsInfo && (
                                <tr><td className="py-1 text-muted-foreground align-top">Floors</td><td className="py-1 font-semibold">{q.floorsInfo}</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Appointment */}
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground mb-2 pb-1.5 border-b">Appointment</p>
                          <table className="w-full text-xs">
                            <tbody>
                              <tr>
                                <td className="py-1 text-muted-foreground w-20">Date</td>
                                <td className="py-1 font-semibold">
                                  {q.scheduledAt ? format(new Date(q.scheduledAt), "EEEE, d MMMM yyyy") : "—"}
                                </td>
                              </tr>
                              {q.timeWindow && (
                                <tr><td className="py-1 text-muted-foreground">Time</td><td className="py-1 font-semibold">{q.timeWindow}</td></tr>
                              )}
                              <tr>
                                <td className="py-1 text-muted-foreground">Staff</td>
                                <td className="py-1 font-semibold">{q.assignedStaff?.name || "—"}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Field timestamps */}
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground mb-2 pb-1.5 border-b">On-Site Record</p>
                          <div className="space-y-2">
                            {arrivedUpdate ? (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-0.5">📍 Staff Arrived</p>
                                <p className="text-sm font-black text-blue-900">{format(new Date(arrivedUpdate.createdAt), "h:mm a")}</p>
                                <p className="text-xs text-blue-700">{format(new Date(arrivedUpdate.createdAt), "EEEE, d MMM yyyy")}</p>
                                <p className="text-[10px] text-blue-500 mt-1">
                                  GPS: {Number(arrivedUpdate.gpsLat).toFixed(5)}, {Number(arrivedUpdate.gpsLng).toFixed(5)}
                                </p>
                              </div>
                            ) : (
                              <div className="border border-dashed rounded-xl p-3 text-xs text-muted-foreground">No arrival check-in recorded</div>
                            )}
                            {completedUpdate ? (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-0.5">✅ Job Completed</p>
                                <p className="text-sm font-black text-emerald-900">{format(new Date(completedUpdate.createdAt), "h:mm a")}</p>
                                <p className="text-xs text-emerald-700">{format(new Date(completedUpdate.createdAt), "EEEE, d MMM yyyy")}</p>
                                {arrivedUpdate && (
                                  <p className="text-[10px] text-emerald-500 mt-1">
                                    Duration: {Math.round((new Date(completedUpdate.createdAt).getTime() - new Date(arrivedUpdate.createdAt).getTime()) / 60000)} min on-site
                                  </p>
                                )}
                                <p className="text-[10px] text-emerald-500 mt-0.5">
                                  GPS: {Number(completedUpdate.gpsLat).toFixed(5)}, {Number(completedUpdate.gpsLng).toFixed(5)}
                                </p>
                              </div>
                            ) : (
                              <div className="border border-dashed rounded-xl p-3 text-xs text-muted-foreground">No completion check-in recorded</div>
                            )}
                          </div>
                        </div>

                        {/* Notes */}
                        {adminNotes.length > 0 && (
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground mb-2 pb-1.5 border-b">Notes &amp; Updates</p>
                            <div className="space-y-1.5">
                              {adminNotes.map((u: any) => (
                                <div key={u.id} className="bg-secondary/40 rounded-lg px-3 py-2">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[10px] font-bold text-muted-foreground capitalize">{u.actorType} · {u.statusChange?.replace(/_/g, " ")}</span>
                                    <span className="text-[10px] text-muted-foreground">{fmtDate(u.createdAt, true)}</span>
                                  </div>
                                  <p className="text-xs italic text-foreground/80">"{u.note}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Right column ── */}
                      <div className="space-y-5">

                        {/* Scope of work */}
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground mb-2 pb-1.5 border-b">Scope of Work</p>
                          {(q.items || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">No items recorded.</p>
                          ) : (
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-foreground/5">
                                  <th className="px-2 py-1.5 text-left font-bold text-[10px]">Item</th>
                                  <th className="px-2 py-1.5 text-left font-bold text-[10px]">Type</th>
                                  <th className="px-2 py-1.5 text-center font-bold text-[10px]">Qty</th>
                                  <th className="px-2 py-1.5 text-right font-bold text-[10px]">Unit</th>
                                  <th className="px-2 py-1.5 text-right font-bold text-[10px]">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(q.items || []).map((item: any, ii: number) => (
                                  <tr key={item.id} className={ii % 2 === 0 ? "" : "bg-secondary/20"}>
                                    <td className="px-2 py-1.5 border-b border-gray-100 font-semibold">
                                      {item.detectedName || item.originalDescription}
                                    </td>
                                    <td className="px-2 py-1.5 border-b border-gray-100 capitalize text-muted-foreground">{item.serviceType}</td>
                                    <td className="px-2 py-1.5 border-b border-gray-100 text-center">{item.quantity}</td>
                                    <td className="px-2 py-1.5 border-b border-gray-100 text-right">{fmt(item.unitPrice)}</td>
                                    <td className="px-2 py-1.5 border-b border-gray-100 text-right font-bold">{fmt(item.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {/* Financial summary */}
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground mb-2 pb-1.5 border-b">Financial Summary</p>
                          <table className="w-full text-xs">
                            <tbody>
                              <tr>
                                <td className="py-1.5 text-muted-foreground">Labour</td>
                                <td className="py-1.5 text-right font-semibold">{fmt(q.subtotal)}</td>
                              </tr>
                              {Number(q.transportFee || 0) > 0 && (
                                <tr>
                                  <td className="py-1.5 text-muted-foreground">Transport &amp; logistics</td>
                                  <td className="py-1.5 text-right font-semibold">{fmt(q.transportFee)}</td>
                                </tr>
                              )}
                              {Number(q.discount || 0) > 0 && (
                                <tr>
                                  <td className="py-1.5 text-muted-foreground">Discount</td>
                                  <td className="py-1.5 text-right font-semibold text-red-600">−{fmt(q.discount)}</td>
                                </tr>
                              )}
                              <tr className="border-t border-b font-black">
                                <td className="py-2">Grand Total</td>
                                <td className="py-2 text-right text-base">{fmt(q.total)}</td>
                              </tr>
                              <tr>
                                <td className="py-1.5 text-muted-foreground">
                                  Deposit (50%)
                                  {q.depositPaidAt && <span className="ml-1 text-emerald-600">✓</span>}
                                </td>
                                <td className="py-1.5 text-right font-semibold text-emerald-700">{fmt(q.depositAmount)}</td>
                              </tr>
                              {q.depositPaidAt && (
                                <tr>
                                  <td className="pl-4 pb-1.5 text-muted-foreground text-[10px]" colSpan={2}>
                                    Paid {fmtDate(q.depositPaidAt, true)}
                                  </td>
                                </tr>
                              )}
                              <tr>
                                <td className="py-1.5 text-muted-foreground">
                                  Final payment (50%)
                                  {q.finalPaidAt && <span className="ml-1 text-emerald-600">✓</span>}
                                </td>
                                <td className="py-1.5 text-right font-semibold text-emerald-700">{fmt(q.finalAmount)}</td>
                              </tr>
                              {q.finalPaidAt && (
                                <tr>
                                  <td className="pl-4 pb-1.5 text-muted-foreground text-[10px]" colSpan={2}>
                                    Paid {fmtDate(q.finalPaidAt, true)}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Certification block */}
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 mt-4">
                          <p className="text-[10px] font-black uppercase tracking-[2px] text-muted-foreground mb-3">Audit Certification</p>
                          <div className="space-y-3">
                            {[
                              { label: "Verified by", sub: "Admin / Operations" },
                              { label: "Date verified", sub: "" },
                              { label: "Signature", sub: "" },
                            ].map(r => (
                              <div key={r.label} className="flex items-end gap-2">
                                <span className="text-[10px] text-muted-foreground w-24 shrink-0">{r.label}</span>
                                <div className="flex-1 border-b border-gray-300 pb-0.5">
                                  <span className="text-[10px] text-muted-foreground/60">{r.sub}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card footer */}
                    <div className="px-6 py-3 border-t bg-secondary/20 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>TMG Install · {COMPANY} · UEN {UEN}</span>
                      <span className="font-mono font-bold">{q.referenceNo}</span>
                      <span>Confidential · Audit use only · {today}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { font-size: 10px; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          .print-page { page-break-after: always; }
          .print-page-break { page-break-before: always; }
          .print-page-break:first-child { page-break-before: always; }
        }
      `}</style>
    </>
  );
}
