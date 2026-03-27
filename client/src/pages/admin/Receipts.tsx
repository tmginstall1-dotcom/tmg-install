import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import {
  Receipt, Download, Check, X, Loader2, Filter, ChevronDown, ChevronUp,
  FileText, AlertCircle, Plus, Upload, ImageIcon, User,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

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
    pending:  "bg-amber-50 text-amber-700 border border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    rejected: "bg-red-50 text-red-700 border border-red-200",
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
  const fileRes = await fetch(`${API_BASE}/api/admin/receipts/${receipt.id}/file`, { credentials: "include" });
  const { fileData, fileType, fileName } = await fileRes.json();

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TMG Install", 14, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Expense Receipt", 14, 16);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Receipt #${receipt.id}`, pageW - 14, 14, { align: "right" });

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

  if (fileType === "application/pdf") {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 120);
    doc.text("[Original file is a PDF — see attached file]", 14, y);
  } else {
    try {
      const imgSrc = `data:${fileType};base64,${fileData}`;
      const maxW = pageW - 28;
      const maxH = pageH - y - 20;
      doc.addImage(imgSrc, fileType.split("/")[1].toUpperCase().replace("JPEG", "JPEG"), 14, y, maxW, Math.min(maxH, maxW * 1.4));
    } catch {
      doc.setFontSize(9);
      doc.setTextColor(180, 100, 100);
      doc.text("[Could not embed image]", 14, y);
    }
  }

  doc.setFontSize(7);
  doc.setTextColor(160, 160, 170);
  doc.text(`Generated ${new Date().toLocaleString("en-SG")} · TMG Install Pte Ltd`, pageW / 2, pageH - 8, { align: "center" });

  const safeName = (receipt.user?.name || "staff").replace(/\s+/g, "_");
  doc.save(`TMG_Receipt_${safeName}_${receipt.receiptDate}.pdf`);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Add Receipt Modal ──────────────────────────────────────────────────────────

function AddReceiptModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  const [userId, setUserId]         = useState<string>("");
  const [receiptDate, setDate]      = useState(today);
  const [amount, setAmount]         = useState("");
  const [category, setCategory]     = useState("other");
  const [description, setDesc]      = useState("");
  const [file, setFile]             = useState<File | null>(null);
  const [preview, setPreview]       = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: staffList = [] } = useQuery<any[]>({ queryKey: ["/api/staff"] });

  const handleFile = useCallback((selected: File | null) => {
    if (!selected) return;
    const allowed = ["image/jpeg","image/png","image/webp","image/heic","image/heif","application/pdf"];
    if (!allowed.includes(selected.type) && !selected.type.startsWith("image/")) {
      toast({ title: "Unsupported file", description: "Please upload a JPG, PNG, WebP or PDF.", variant: "destructive" });
      return;
    }
    if (selected.size > 16 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 16 MB.", variant: "destructive" });
      return;
    }
    setFile(selected);
    if (selected.type.startsWith("image/")) {
      const url = URL.createObjectURL(selected);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, [toast]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) { toast({ title: "Select a staff member", variant: "destructive" }); return; }
    if (!file)   { toast({ title: "Upload a receipt file", variant: "destructive" }); return; }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" }); return;
    }

    setSubmitting(true);
    try {
      const fileData = await fileToBase64(file);
      await apiRequest("POST", "/api/admin/receipts", {
        userId:      parseInt(userId),
        receiptDate,
        amount:      parseFloat(amount).toFixed(2),
        category,
        description: description.trim() || undefined,
        fileData,
        fileType:    file.type,
        fileName:    file.name,
      });
      toast({ title: "Receipt added", description: "Receipt saved and approved." });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to add receipt", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col"
        data-testid="modal-add-receipt"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Add Receipt</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Manually log an expense for a staff member</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
            data-testid="button-close-add-receipt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-5 py-5 space-y-4">

            {/* Staff member */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                Staff Member <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <select
                  value={userId}
                  onChange={e => setUserId(e.target.value)}
                  required
                  data-testid="select-staff-member"
                  className="w-full h-10 pl-9 pr-4 border border-zinc-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors appearance-none"
                >
                  <option value="">Select staff member…</option>
                  {(staffList as any[]).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date + Amount row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                  Receipt Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={receiptDate}
                  onChange={e => setDate(e.target.value)}
                  max={today}
                  required
                  data-testid="input-receipt-date"
                  className="w-full h-10 px-3 border border-zinc-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                  Amount (SGD) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500 font-semibold pointer-events-none">$</span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                    data-testid="input-receipt-amount"
                    className="w-full h-10 pl-7 pr-3 border border-zinc-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1.5">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {RECEIPT_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    data-testid={`button-category-${cat.value}`}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      category === cat.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <span className="text-base">{cat.emoji}</span>
                    <span className="text-xs">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                Description <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <textarea
                placeholder="e.g. Petrol for job at Tampines on 27 Mar"
                value={description}
                onChange={e => setDesc(e.target.value)}
                rows={2}
                maxLength={500}
                data-testid="input-receipt-description"
                className="w-full px-3 py-2.5 border border-zinc-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
              />
            </div>

            {/* File upload */}
            <div>
              <label className="text-xs font-semibold text-zinc-700 block mb-1.5">
                Receipt File <span className="text-red-500">*</span>
                <span className="text-zinc-400 font-normal ml-1">JPG, PNG, WebP or PDF · max 16 MB</span>
              </label>

              {file ? (
                <div className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50">
                  {preview ? (
                    <div className="relative group">
                      <img
                        src={preview}
                        alt="Receipt preview"
                        className="w-full max-h-52 object-contain bg-zinc-100"
                        data-testid="img-receipt-preview"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-900 truncate">{file.name}</p>
                        <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(0)} KB · PDF</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 bg-white">
                    <p className="text-xs text-zinc-600 truncate max-w-[200px]">{file.name}</p>
                    <button
                      type="button"
                      onClick={() => { setFile(null); setPreview(null); }}
                      data-testid="button-remove-file"
                      className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) handleFile(f);
                  }}
                  data-testid="dropzone-receipt-file"
                  className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    dragOver
                      ? "border-blue-400 bg-blue-50"
                      : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100"
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-white border border-zinc-200 flex items-center justify-center shadow-sm">
                    <Upload className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-zinc-700">Click or drag file here</p>
                    <p className="text-xs text-zinc-400 mt-1">Photo of receipt or PDF</p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                data-testid="input-file-upload"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-zinc-100 bg-white flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-xl border border-zinc-200 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !file || !userId}
              data-testid="button-submit-add-receipt"
              className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Check className="w-4 h-4" /> Save Receipt</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminReceipts() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [filterYear, setFilterYear]   = useState<string>(String(currentYear));
  const [filterMonth, setFilterMonth] = useState<string>(String(currentMonth));
  const [filterDay, setFilterDay]     = useState<string>("");
  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [adminNote, setAdminNote]     = useState("");
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal]   = useState(false);

  const params = new URLSearchParams();
  if (filterYear)  params.set("year",  filterYear);
  if (filterMonth) params.set("month", filterMonth);
  if (filterDay)   params.set("day",   filterDay);

  const { data: allReceipts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/receipts", filterYear, filterMonth, filterDay],
    queryFn: async () => {
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

  const grouped: Record<string, any[]> = {};
  for (const r of allReceipts) {
    const key = (r.receiptDate || "").slice(0, 7);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const pendingCount   = allReceipts.filter((r: any) => r.status === "pending").length;
  const totalAmount    = allReceipts.reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
  const approvedAmount = allReceipts
    .filter((r: any) => r.status === "approved")
    .reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-zinc-50 pt-14 lg:pl-56 pb-24">

      {/* Page Header */}
      <div className="bg-white border-b border-zinc-200 px-5 py-4 mb-5">
        <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-400 font-medium">Finance → Receipts</p>
            <h1 className="text-lg font-bold text-zinc-900 mt-0.5">Staff Receipts</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Review, approve and download expense receipts</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            data-testid="button-add-receipt"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors shadow-sm shrink-0 mt-1"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Receipt</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-5 space-y-5">

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Pending</p>
            <p className="text-2xl font-bold text-amber-600 leading-none tabular-nums">{pendingCount}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Submitted</p>
            <p className="text-2xl font-bold text-zinc-900 leading-none tabular-nums">S${totalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Approved</p>
            <p className="text-2xl font-bold text-emerald-600 leading-none tabular-nums">S${approvedAmount.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-zinc-100 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-900">Filter</h2>
          </div>
          <div className="p-4 flex flex-wrap gap-3">
            <div className="flex-1 min-w-[130px]">
              <label className="text-xs text-zinc-500 block mb-1">Year</label>
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                data-testid="select-filter-year"
                className="h-9 w-full px-3 border border-zinc-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All years</option>
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="text-xs text-zinc-500 block mb-1">Month</label>
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                data-testid="select-filter-month"
                className="h-9 w-full px-3 border border-zinc-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All months</option>
                {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[130px]">
              <label className="text-xs text-zinc-500 block mb-1">Day</label>
              <select
                value={filterDay}
                onChange={e => setFilterDay(e.target.value)}
                data-testid="select-filter-day"
                className="h-9 w-full px-3 border border-zinc-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="h-9 px-4 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <p className="text-sm text-zinc-500">Loading receipts…</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && allReceipts.length === 0 && (
          <div className="text-center py-20 bg-white border border-dashed border-zinc-200 rounded-2xl">
            <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <p className="font-semibold text-zinc-900">No receipts found</p>
            <p className="text-sm text-zinc-500 mt-1 mb-4">Adjust filters or add a receipt manually</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Receipt
            </button>
          </div>
        )}

        {/* Receipts grouped by month */}
        {months.map(month => {
          const label = (() => { try { return format(parseISO(month + "-01"), "MMMM yyyy"); } catch { return month; } })();
          const monthTotal    = grouped[month].reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
          const monthApproved = grouped[month].filter((r: any) => r.status === "approved").reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
          const monthPending  = grouped[month].filter((r: any) => r.status === "pending").length;

          return (
            <div key={month} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-bold text-zinc-900">{label}</h2>
                  {monthPending > 0 && (
                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700">
                      {monthPending} pending
                    </span>
                  )}
                </div>
                <div className="text-right flex items-center gap-4">
                  <p className="text-xs text-zinc-500 hidden sm:block">Total: <span className="font-bold text-zinc-900">S${monthTotal.toFixed(2)}</span></p>
                  <p className="text-xs text-zinc-500">Approved: <span className="font-bold text-emerald-600">S${monthApproved.toFixed(2)}</span></p>
                </div>
              </div>

              <div className="divide-y divide-zinc-100">
                {grouped[month].map((receipt: any) => {
                  const cat = RECEIPT_CATEGORIES.find(c => c.value === receipt.category);
                  const isExpanded  = expandedId  === receipt.id;
                  const isReviewing = reviewingId === receipt.id;

                  return (
                    <div key={receipt.id} data-testid={`receipt-row-${receipt.id}`}>
                      <div className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-zinc-50/80 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-lg shrink-0">
                          {cat?.emoji || "📎"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="font-bold text-sm text-zinc-900">S${parseFloat(receipt.amount).toFixed(2)}</p>
                            <p className="text-xs text-zinc-500">{receipt.user?.name || "Unknown"}</p>
                            <StatusBadge status={receipt.status} />
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
                            <span>{receipt.receiptDate}</span>
                            <span>·</span>
                            <span>{cat?.label || receipt.category}</span>
                            {receipt.description && (
                              <>
                                <span>·</span>
                                <span className="truncate max-w-[160px]">{receipt.description}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleDownload(receipt)}
                            disabled={downloadingId === receipt.id}
                            data-testid={`button-download-receipt-${receipt.id}`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                            title="Download PDF"
                          >
                            {downloadingId === receipt.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Download className="w-3.5 h-3.5" />}
                          </button>
                          {receipt.status === "pending" && (
                            <button
                              onClick={() => { setReviewingId(receipt.id); setAdminNote(""); }}
                              data-testid={`button-review-receipt-${receipt.id}`}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-zinc-200 text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Review"
                            >
                              <AlertCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
                            data-testid={`button-expand-receipt-${receipt.id}`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-zinc-400 hover:bg-zinc-100 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-3.5 space-y-2">
                          {receipt.adminNote && (
                            <div className="bg-white border border-zinc-200 rounded-xl p-3">
                              <p className="text-xs font-semibold text-zinc-500 mb-1">Admin Note</p>
                              <p className="text-sm text-zinc-700">{receipt.adminNote}</p>
                            </div>
                          )}
                          <p className="text-xs text-zinc-400">
                            Submitted: {receipt.createdAt ? format(new Date(receipt.createdAt), "d MMM yyyy, h:mm a") : "—"}
                          </p>
                        </div>
                      )}

                      {isReviewing && (
                        <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 space-y-3">
                          <p className="text-xs font-bold text-amber-800">Review Receipt</p>
                          <textarea
                            placeholder="Admin note (optional)"
                            value={adminNote}
                            onChange={e => setAdminNote(e.target.value)}
                            rows={2}
                            data-testid="input-admin-note"
                            className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white resize-none"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => { setReviewingId(null); setAdminNote(""); }}
                              className="h-9 px-3 flex-1 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-semibold transition-colors">
                              Cancel
                            </button>
                            <button
                              onClick={() => reviewMut.mutate({ id: receipt.id, status: "rejected", note: adminNote })}
                              disabled={reviewMut.isPending}
                              data-testid={`button-reject-receipt-${receipt.id}`}
                              className="h-9 px-3 flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                            <button
                              onClick={() => reviewMut.mutate({ id: receipt.id, status: "approved", note: adminNote })}
                              disabled={reviewMut.isPending}
                              data-testid={`button-approve-receipt-${receipt.id}`}
                              className="h-9 px-3 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
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

      {/* Add Receipt Modal */}
      {showAddModal && (
        <AddReceiptModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["/api/admin/receipts"] })}
        />
      )}
    </div>
  );
}
