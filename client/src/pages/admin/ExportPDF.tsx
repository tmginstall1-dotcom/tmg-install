import { useQuotes } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { format } from "date-fns";
import { Printer, ArrowLeft, FileText } from "lucide-react";

function fmt(v: any) {
  return `$${Number(v || 0).toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExportPDF() {
  const { data: allQuotes, isLoading } = useQuotes();

  const jobs = (allQuotes || [])
    .filter((q: any) => ["closed", "final_paid"].includes(q.status))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalRevenue = jobs.reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);
  const totalDeposit = jobs.reduce((sum: number, q: any) => sum + Number(q.depositAmount || 0), 0);
  const totalFinal   = jobs.reduce((sum: number, q: any) => sum + Number(q.finalAmount || 0), 0);
  const today = format(new Date(), "d MMMM yyyy, HH:mm");

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <button className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </button>
          </Link>
          <span className="text-muted-foreground/40">|</span>
          <div className="flex items-center gap-2 text-sm font-bold">
            <FileText className="w-4 h-4 text-primary" />
            Closed Jobs — Accounting Export
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-xl text-sm font-bold hover:bg-foreground/90 transition-colors"
          data-testid="button-print-pdf"
        >
          <Printer className="w-4 h-4" /> Print / Save PDF
        </button>
      </div>

      {/* Printable document */}
      <div className="max-w-5xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-foreground print:mb-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">TMG INSTALL</h1>
            <p className="text-sm text-muted-foreground">Singapore · tmginstall.com · +65 8088 0757</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">Closed Jobs Report</p>
            <p className="text-sm text-muted-foreground">Generated: {today}</p>
            <p className="text-sm text-muted-foreground">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4 mb-6 print:mb-4">
          {[
            { label: "Total Revenue", value: fmt(totalRevenue), highlight: true },
            { label: "Total Deposits Collected", value: fmt(totalDeposit) },
            { label: "Total Final Payments Collected", value: fmt(totalFinal) },
          ].map(card => (
            <div key={card.label} className={`rounded-xl border p-4 ${card.highlight ? "bg-emerald-50 border-emerald-200" : "bg-secondary/40"}`}>
              <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
              <p className={`text-lg font-black ${card.highlight ? "text-emerald-700" : ""}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        {jobs.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">No closed jobs found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-foreground text-background">
                  <th className="px-3 py-2.5 text-left font-bold text-xs">Ref No</th>
                  <th className="px-3 py-2.5 text-left font-bold text-xs">Date</th>
                  <th className="px-3 py-2.5 text-left font-bold text-xs">Customer</th>
                  <th className="px-3 py-2.5 text-left font-bold text-xs">Service Address</th>
                  <th className="px-3 py-2.5 text-left font-bold text-xs">Job Date</th>
                  <th className="px-3 py-2.5 text-left font-bold text-xs">Assigned To</th>
                  <th className="px-3 py-2.5 text-right font-bold text-xs">Grand Total</th>
                  <th className="px-3 py-2.5 text-right font-bold text-xs">Deposit (50%)</th>
                  <th className="px-3 py-2.5 text-right font-bold text-xs">Balance (50%)</th>
                  <th className="px-3 py-2.5 text-center font-bold text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((q: any, i: number) => (
                  <tr key={q.id} className={i % 2 === 0 ? "bg-white" : "bg-secondary/20"}>
                    <td className="px-3 py-2 font-mono text-xs font-bold text-primary">{q.referenceNo}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {q.createdAt ? format(new Date(q.createdAt), "d MMM yyyy") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{q.customer?.name}</div>
                      <div className="text-xs text-muted-foreground">{q.customer?.phone}</div>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[180px]">
                      <span className="line-clamp-2">{q.serviceAddress}</span>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {q.scheduledAt ? format(new Date(q.scheduledAt), "d MMM yyyy") : "—"}
                      {q.timeWindow ? <div className="text-muted-foreground">{q.timeWindow}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-xs">{q.assignedStaff?.name || "—"}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmt(q.total)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">
                      {q.depositPaidAt ? <span className="font-semibold">✓ {fmt(q.depositAmount)}</span> : fmt(q.depositAmount)}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-700">
                      {q.finalPaidAt ? <span className="font-semibold">✓ {fmt(q.finalAmount)}</span> : fmt(q.finalAmount)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                        q.status === "final_paid" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                      }`}>
                        {q.status === "final_paid" ? "Paid" : "Closed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-foreground text-background font-bold">
                  <td colSpan={6} className="px-3 py-2.5 text-xs">TOTALS ({jobs.length} jobs)</td>
                  <td className="px-3 py-2.5 text-right text-sm">{fmt(totalRevenue)}</td>
                  <td className="px-3 py-2.5 text-right text-sm">{fmt(totalDeposit)}</td>
                  <td className="px-3 py-2.5 text-right text-sm">{fmt(totalFinal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t text-xs text-muted-foreground flex justify-between print:mt-6">
          <span>TMG Install Pte Ltd · Singapore</span>
          <span>Confidential — For internal accounting use only</span>
          <span>Exported {today}</span>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          body { font-size: 11px; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      `}</style>
    </>
  );
}
