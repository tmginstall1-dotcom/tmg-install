import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import {
  Receipt, Download, Check, X, Loader2, Filter, ChevronDown, ChevronUp,
  FileText, ImageIcon, AlertCircle,
} from "lucide-react";

const RECEIPT_CATEGORIES = [
  { value: "fuel",      label: "Fuel",       emoji: "⛽" },
  { value: "tools",     label: "Tools",      emoji: "🔧" },
  { value: "transport", label: "Transport",  emoji: "🚌" },
  { value: "meals",     label: "Meals",      emoji: "🍱" },
  { value: "parking",   label: "Parking",    emoji: "🅿️" },
  { value: "other",     label: "Other",      emoji: "📎" },
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
  };
  const labels: Record<string, string> = {
    pending: "Pending", approved: "Approved", rejected: "Rejected",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${map[status] || "bg-zinc-100 text-zinc-600"}`}>
      {labels[status] || status}
    </span>
  );
}

async function downloadReceiptPdf(receipt: any) {
  const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";
  const fileRes = await fetch(`${API_BASE}/api/admin/receipts/${receipt.id}/file`, { credentials: "include" });
  const { fileData, fileType, fileName } = await fileRes.json();

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header bar
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TMG Install", 14, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Expense Receipt", 14, 16);

  // Reference line
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Receipt #${receipt.id}`, pageW - 14, 14, { align: "right" });

  // Info section
  doc.setTextColor(30, 30, 30);
  const cat = RECEIPT_CATEGORIES.find(c => c.value === receipt.category);
  const infoRows = [
    ["Staff",        (receipt.user?.name || "—")],
    ["Date",         receipt.receiptDate],
    ["Category",     cat?.label || receipt.category],
    ["Amount",       `SGD ${parseFloat(receipt.amount).toFixed(2)}`],
    ["Status",       receipt.status.toUpperCase()],
    ["Description",  receipt.description || "—"],
  ];

  let y = 30;
  for (const [label, value] of infoRows) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 120);
    doc.text(label, 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(String(value), 60, y);
    y += 7;
  }

  if (receipt.adminNote) {
    y += 2;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 120);
    doc.text("Admin Note", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(receipt.adminNote, 60, y);
    y += 7;
  }

  y += 5;
  doc.setDrawColor(220, 220, 230);
  doc.line(14, y, pageW - 14, y);
  y += 8;

  // Embed the receipt image / PDF
  if (fileType === "application/pdf") {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 120);
    doc.text("[Original file is a PDF — see attached file]", 14, y);
    // For PDF attachments, just note it — embedding PDFs in PDFs via jsPDF is complex
  } else {
    // Image (JPEG, PNG, WebP, etc.)
    try {
      const imgSrc = `data:${fileType};base64,${fileData}`;
      const maxW = pageW - 28;
      const maxH = pageH - y - 20;
      doc.addImage(imgSrc, fileType.split("/")[1].toUpperCase().replace("JPEG", "JPEG"), 14, y, maxW, Math.min(maxH, maxW * 1.4));
    } catch {
      doc.setFontSize(9);
      doc.setTextColor(180, 100, 100);
      doc.text("[Could not embed image — unsupported format]", 14, y);
    }
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 170);
  doc.text(`Generated ${new Date().toLocaleString("en-SG")} · TMG Install Pte Ltd`, pageW / 2, pageH - 8, { align: "center" });

  const safeName = (receipt.user?.name || "staff").replace(/\s+/g, "_");
  doc.save(`TMG_Receipt_${safeName}_${receipt.receiptDate}.pdf`);
}

export default function AdminReceipts() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [filterYear, setFilterYear] = useState<string>(String(currentYear));
  const [filterMonth, setFilterMonth] = useState<string>(String(currentMonth));
  const [filterDay, setFilterDay] = useState<string>("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const params = new URLSearchParams();
  if (filterYear) params.set("year", filterYear);
  if (filterMonth) params.set("month", filterMonth);
  if (filterDay) params.set("day", filterDay);

  const { data: allReceipts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/receipts", filterYear, filterMonth, filterDay],
    queryFn: async () => {
      const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";
      const res = await fetch(`${API_BASE}/api/admin/receipts?${params.toString()}`, { credentials: "include" });
      return res.json();
    },
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: "approved" | "rejected"; note: string }) =>
      apiRequest("PATCH", `/api/admin/receipts/${id}/status`, { status, adminNote: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/receipts"] });
      toast({ title: "Receipt updated" });
      setReviewingId(null);
      setAdminNote("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function handleDownload(receipt: any) {
    setDownloadingId(receipt.id);
    try {
      await downloadReceiptPdf(receipt);
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  }

  // Group by month (yyyy-MM)
  const grouped: Record<string, any[]> = {};
  for (const r of allReceipts) {
    const key = (r.receiptDate || "").slice(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const pendingCount = allReceipts.filter((r: any) => r.status === "pending").length;
  const totalAmount = allReceipts.reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
  const approvedAmount = allReceipts
    .filter((r: any) => r.status === "approved")
    .reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-[#F5F5F7] pt-14 lg:pl-56 pb-24">
      {/* Page Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5 mb-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-zinc-400 mb-1">Management → Receipts</p>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Staff Receipts</h1>
          <p className="text-sm text-zinc-500 mt-1">Review and download expense receipts submitted by staff</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Pending Review</p>
            <p className="text-2xl font-bold text-amber-600 leading-none">{pendingCount}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Total Submitted</p>
            <p className="text-2xl font-bold text-zinc-900 leading-none">S${totalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold mb-1">Approved</p>
            <p className="text-2xl font-bold text-emerald-600 leading-none">S${approvedAmount.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-900">Filter</h2>
          </div>
          <div className="p-5 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs text-zinc-500 block mb-1">Year</label>
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                data-testid="select-filter-year"
                className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">All years</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs text-zinc-500 block mb-1">Month</label>
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                data-testid="select-filter-month"
                className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">All months</option>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs text-zinc-500 block mb-1">Day</label>
              <select
                value={filterDay}
                onChange={e => setFilterDay(e.target.value)}
                data-testid="select-filter-day"
                className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="">All days</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            {(filterYear || filterMonth || filterDay) && (
              <div className="flex items-end">
                <button
                  onClick={() => { setFilterYear(""); setFilterMonth(""); setFilterDay(""); }}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-sm text-zinc-500">Loading receipts…</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && allReceipts.length === 0 && (
          <div className="text-center py-20 bg-white border border-dashed border-zinc-200 rounded-xl">
            <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="font-semibold text-zinc-900">No receipts found</p>
            <p className="text-sm text-zinc-500 mt-1">Try adjusting the filters or wait for staff to submit receipts</p>
          </div>
        )}

        {/* Receipts grouped by month */}
        {months.map(month => {
          const label = (() => { try { return format(parseISO(month + "-01"), "MMMM yyyy"); } catch { return month; } })();
          const monthTotal = grouped[month].reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
          const monthApproved = grouped[month]
            .filter((r: any) => r.status === "approved")
            .reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
          const monthPending = grouped[month].filter((r: any) => r.status === "pending").length;

          return (
            <div key={month} className="bg-white border border-zinc-200 rounded-xl overflow-hidden mb-6">
              {/* Month header */}
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-900 tracking-wider">{label}</h2>
                  {monthPending > 0 && (
                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-700">
                      {monthPending} pending
                    </span>
                  )}
                </div>
                <div className="text-right flex items-center gap-4">
                  <p className="text-xs text-zinc-500">Total: <span className="font-bold text-zinc-900">S${monthTotal.toFixed(2)}</span></p>
                  <p className="text-xs text-zinc-500">Approved: <span className="font-bold text-emerald-600">S${monthApproved.toFixed(2)}</span></p>
                </div>
              </div>

              <div className="divide-y divide-zinc-100">
                {grouped[month].map((receipt: any) => {
                  const cat = RECEIPT_CATEGORIES.find(c => c.value === receipt.category);
                  const isExpanded = expandedId === receipt.id;
                  const isReviewing = reviewingId === receipt.id;

                  return (
                    <div
                      key={receipt.id}
                      data-testid={`receipt-row-${receipt.id}`}
                      className="bg-white"
                    >
                      {/* Main row */}
                      <div className="flex items-center gap-4 p-4 hover:bg-zinc-50 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-lg shrink-0">
                          {cat?.emoji || "📎"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-bold text-sm text-zinc-900">S${parseFloat(receipt.amount).toFixed(2)}</p>
                            <p className="text-xs text-zinc-500 font-medium">{receipt.user?.name || "Unknown"}</p>
                            <StatusBadge status={receipt.status} />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-500">
                            <span>{receipt.receiptDate}</span>
                            <span>·</span>
                            <span>{cat?.label || receipt.category}</span>
                            {receipt.description && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[200px]">{receipt.description}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleDownload(receipt)}
                            disabled={downloadingId === receipt.id}
                            data-testid={`button-download-receipt-${receipt.id}`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                            title="Download as PDF"
                          >
                            {downloadingId === receipt.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Download className="w-4 h-4" />}
                          </button>
                          {receipt.status === "pending" && (
                            <>
                              <button
                                onClick={() => { setReviewingId(receipt.id); setAdminNote(""); }}
                                data-testid={`button-review-receipt-${receipt.id}`}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
                                title="Review"
                              >
                                <AlertCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
                            data-testid={`button-expand-receipt-${receipt.id}`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t border-zinc-100 bg-zinc-50/50 p-4 space-y-3">
                          {receipt.adminNote && (
                            <div className="bg-white border border-zinc-200 rounded-lg p-3">
                              <p className="text-xs font-semibold text-zinc-500 mb-1">Admin Note</p>
                              <p className="text-sm text-zinc-700">{receipt.adminNote}</p>
                            </div>
                          )}
                          <div className="text-xs text-zinc-500">
                            Submitted: {receipt.createdAt ? format(new Date(receipt.createdAt), "d MMM yyyy, h:mm a") : "—"}
                          </div>
                        </div>
                      )}

                      {/* Inline review panel */}
                      {isReviewing && (
                        <div className="border-t border-amber-200 bg-amber-50 p-4 space-y-3">
                          <p className="text-xs font-semibold text-amber-800">Review Receipt</p>
                          <textarea
                            placeholder="Admin note (optional)"
                            value={adminNote}
                            onChange={e => setAdminNote(e.target.value)}
                            rows={2}
                            data-testid="input-admin-note"
                            className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setReviewingId(null); setAdminNote(""); }}
                              className="inline-flex items-center justify-center gap-2 h-8 px-3 flex-1 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => reviewMut.mutate({ id: receipt.id, status: "rejected", note: adminNote })}
                              disabled={reviewMut.isPending}
                              data-testid={`button-reject-receipt-${receipt.id}`}
                              className="inline-flex items-center justify-center gap-1 h-8 px-3 flex-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                            <button
                              onClick={() => reviewMut.mutate({ id: receipt.id, status: "approved", note: adminNote })}
                              disabled={reviewMut.isPending}
                              data-testid={`button-approve-receipt-${receipt.id}`}
                              className="inline-flex items-center justify-center gap-1 h-8 px-3 flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
