import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import {
 Receipt, Download, Check, X, Loader2, Filter, ChevronDown, ChevronUp,
 FileText, AlertCircle, Plus, Upload, User, Sparkles, Pencil, Trash2,
 ChevronRight, ImagePlus,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

const RECEIPT_CATEGORIES = [
 { value: "fuel", label: "Fuel", emoji: "⛽" },
 { value: "tools", label: "Tools", emoji: "🔧" },
 { value: "transport", label: "Transport", emoji: "🚌" },
 { value: "meals", label: "Meals", emoji: "🍱" },
 { value: "parking", label: "Parking", emoji: "🅿️" },
 { value: "other", label: "Other", emoji: "📎" },
];

const MONTHS = [
 "January","February","March","April","May","June",
 "July","August","September","October","November","December",
];

function StatusBadge({ status }: { status: string }) {
 const map: Record<string, string> = {
 pending: "bg-amber-50 text-amber-700 border border-amber-200",
 approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
 rejected: "bg-red-50 text-red-700 border border-red-200",
 };
 const labels: Record<string, string> = {
 pending: "Pending", approved: "Approved", rejected: "Rejected",
 };
 return (
 <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${map[status] || "bg-[#EBE9E2] text-black/65"}`}>
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
 ["Staff", (receipt.user?.name || "—")],
 ["Date", receipt.receiptDate],
 ["Category", cat?.label || receipt.category],
 ["Amount", `SGD ${parseFloat(receipt.amount).toFixed(2)}`],
 ["Status", receipt.status.toUpperCase()],
 ["Description", receipt.description || "—"],
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

// ── Multi-receipt types ────────────────────────────────────────────────────────

let _entryCounter = 0;
function genId() { return `entry-${++_entryCounter}`; }

type ReceiptEntry = {
 id: string;
 file: File;
 preview: string | null;
 b64: string | null; // base64 — stored after conversion so we don't re-encode on submit
 scanning: boolean;
 amount: string;
 receiptDate: string;
 category: string;
 description: string;
 merchant: string;
 aiFields: Set<string>;
};

function AiBadge() {
 return (
 <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-[#0A0A0A] text-[10px] font-bold px-1.5 py-0.5 ml-1.5">
 <Sparkles className="w-2.5 h-2.5" /> AI
 </span>
 );
}

// ── Per-entry edit card ────────────────────────────────────────────────────────

function ReceiptCard({
 entry,
 expanded,
 onToggleExpand,
 onUpdate,
 onRemove,
}: {
 entry: ReceiptEntry;
 expanded: boolean;
 onToggleExpand: () => void;
 onUpdate: (patch: Partial<ReceiptEntry>) => void;
 onRemove: () => void;
}) {
 const today = format(new Date(), "yyyy-MM-dd");
 const cat = RECEIPT_CATEGORIES.find(c => c.value === entry.category);

 function clearAi(field: string, patch: Partial<ReceiptEntry>) {
 const n = new Set(entry.aiFields);
 n.delete(field);
 onUpdate({ ...patch, aiFields: n });
 }

 return (
 <div
 className={`border rounded-none overflow-hidden transition-colors ${entry.scanning ? "border-violet-300 bg-[#EBE9E2]/30" : "border-black/12 bg-white"}`}
 data-testid={`receipt-entry-${entry.id}`}
 >
 {/* Collapsed row */}
 <div className="flex items-center gap-3 px-3 py-3">
 {/* Thumbnail */}
 <div className="w-12 h-12 rounded-none overflow-hidden bg-[#EBE9E2] shrink-0 relative">
 {entry.preview ? (
 <>
 <img src={entry.preview} alt="" className="w-full h-full object-cover" />
 {entry.scanning && (
 <div className="absolute inset-0 bg-violet-800/60 flex items-center justify-center">
 <Loader2 className="w-4 h-4 text-white animate-spin" />
 </div>
 )}
 {!entry.scanning && entry.aiFields.size > 0 && (
 <div className="absolute bottom-0 right-0 bg-[#0A0A0A] text-white text-[9px] font-bold px-1 py-0.5 rounded-tl-lg">
 <Sparkles className="w-2.5 h-2.5" />
 </div>
 )}
 </>
 ) : (
 <div className="w-full h-full flex items-center justify-center">
 {entry.scanning
 ? <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
 : <FileText className="w-5 h-5 text-black/45" />}
 </div>
 )}
 </div>

 {/* Summary */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 {entry.amount ? (
 <span className="text-sm font-bold text-[#0A0A0A]">S${parseFloat(entry.amount).toFixed(2)}</span>
 ) : (
 <span className="text-sm font-medium text-black/45 italic">Amount needed</span>
 )}
 {cat && (
 <span className="text-[11px] bg-[#EBE9E2] text-black/65 rounded-full px-2 py-0.5 font-medium">
 {cat.emoji} {cat.label}
 </span>
 )}
 {entry.scanning && (
 <span className="text-[11px] bg-violet-100 text-[#0A0A0A] rounded-full px-2 py-0.5 font-semibold animate-pulse">
 Scanning…
 </span>
 )}
 </div>
 <p className="text-xs text-black/45 truncate mt-0.5">
 {entry.receiptDate} · {entry.merchant || entry.file.name}
 </p>
 </div>

 {/* Actions */}
 <div className="flex items-center gap-1 shrink-0">
 <button
 type="button"
 onClick={onRemove}
 className="w-7 h-7 flex items-center justify-center rounded-lg text-black/45 hover:text-red-500 hover:bg-red-50 transition-colors"
 data-testid={`button-remove-entry-${entry.id}`}
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 <button
 type="button"
 onClick={onToggleExpand}
 className="w-7 h-7 flex items-center justify-center rounded-lg text-black/45 hover:bg-[#EBE9E2] transition-colors"
 data-testid={`button-expand-entry-${entry.id}`}
 >
 <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
 </button>
 </div>
 </div>

 {/* Expanded edit fields */}
 {expanded && (
 <div className="border-t border-black/8 px-4 py-4 space-y-3 bg-white/50">

 {/* Merchant banner */}
 {entry.merchant && (
 <div className="bg-[#EBE9E2] border border-violet-200 rounded-none px-3 py-2 flex items-center gap-2">
 <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
 <p className="text-xs font-semibold text-violet-900 truncate flex-1">{entry.merchant}</p>
 <button type="button" onClick={() => onUpdate({ merchant: "" })} className="text-violet-400 hover:text-[#0A0A0A] ml-auto">
 <X className="w-3 h-3" />
 </button>
 </div>
 )}

 {/* Date + Amount */}
 <div className="grid grid-cols-2 gap-2">
 <div>
 <label className="text-[11px] font-semibold text-black/65 flex items-center mb-1">
 Date {entry.aiFields.has("receiptDate") && <AiBadge />}
 </label>
 <input
 type="date"
 value={entry.receiptDate}
 max={today}
 onChange={e => clearAi("receiptDate", { receiptDate: e.target.value })}
 data-testid={`input-date-${entry.id}`}
 className={`w-full h-9 px-2.5 border rounded-none text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0A0A0A] transition-colors ${entry.aiFields.has("receiptDate") ? "border-violet-400 bg-[#EBE9E2]/60" : "border-black/20"}`}
 />
 </div>
 <div>
 <label className="text-[11px] font-semibold text-black/65 flex items-center mb-1">
 Amount (SGD) <span className="text-red-500 ml-0.5">*</span>
 {entry.aiFields.has("amount") && <AiBadge />}
 </label>
 <div className="relative">
 <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-black/55 font-semibold pointer-events-none">$</span>
 <input
 type="number"
 min="0.01"
 step="0.01"
 placeholder="0.00"
 value={entry.amount}
 onChange={e => clearAi("amount", { amount: e.target.value })}
 data-testid={`input-amount-${entry.id}`}
 className={`w-full h-9 pl-6 pr-2.5 border rounded-none text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0A0A0A] transition-colors ${entry.aiFields.has("amount") ? "border-violet-400 bg-[#EBE9E2]/60" : "border-black/20"}`}
 />
 </div>
 </div>
 </div>

 {/* Category */}
 <div>
 <label className="text-[11px] font-semibold text-black/65 flex items-center mb-1.5">
 Category {entry.aiFields.has("category") && <AiBadge />}
 </label>
 <div className="grid grid-cols-3 gap-1.5">
 {RECEIPT_CATEGORIES.map(c => (
 <button
 key={c.value}
 type="button"
 onClick={() => clearAi("category", { category: c.value })}
 data-testid={`button-category-${c.value}-${entry.id}`}
 className={`flex items-center gap-1.5 px-2 py-2 rounded-none border text-[11px] font-medium transition-all ${
 entry.category === c.value
 ? entry.aiFields.has("category")
 ? "border-violet-500 bg-[#EBE9E2] text-[#0A0A0A]"
 : "border-[#0A0A0A] bg-[#EBE9E2] text-[#0A0A0A]"
 : "border-black/12 text-black/65 hover:bg-white"
 }`}
 >
 <span>{c.emoji}</span><span>{c.label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Description */}
 <div>
 <label className="text-[11px] font-semibold text-black/65 flex items-center mb-1">
 Description <span className="text-black/45 ml-1 font-normal">(optional)</span>
 {entry.aiFields.has("description") && <AiBadge />}
 </label>
 <textarea
 placeholder="Brief description of purchase"
 value={entry.description}
 onChange={e => clearAi("description", { description: e.target.value })}
 rows={2}
 maxLength={500}
 data-testid={`input-description-${entry.id}`}
 className={`w-full px-3 py-2 border rounded-none text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#0A0A0A] transition-colors resize-none ${entry.aiFields.has("description") ? "border-violet-400 bg-[#EBE9E2]/60" : "border-black/20"}`}
 />
 </div>
 </div>
 )}
 </div>
 );
}

// ── Add Receipt Modal (multi-file) ─────────────────────────────────────────────

function AddReceiptModal({
 onClose,
 onSuccess,
}: {
 onClose: () => void;
 onSuccess: () => void;
}) {
 const { toast } = useToast();
 const fileInputRef = useRef<HTMLInputElement>(null);
 const addMoreRef = useRef<HTMLInputElement>(null);

 const today = format(new Date(), "yyyy-MM-dd");

 const [userId, setUserId] = useState<string>("");
 const [entries, setEntries] = useState<ReceiptEntry[]>([]);
 const [expandedId, setExpandedId] = useState<string | null>(null);
 const [dragOver, setDragOver] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);

 const { data: staffList = [] } = useQuery<any[]>({ queryKey: ["/api/staff"] });

 // Update a single entry by id
 const patchEntry = useCallback((id: string, patch: Partial<ReceiptEntry>) => {
 setEntries(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
 }, []);

 const removeEntry = useCallback((id: string) => {
 setEntries(prev => prev.filter(e => e.id !== id));
 setExpandedId(curr => curr === id ? null : curr);
 }, []);

 // Run AI scan for one entry
 const runScan = useCallback(async (id: string, f: File, b64: string) => {
 if (!f.type.startsWith("image/")) return;
 patchEntry(id, { scanning: true });
 try {
 const res = await fetch("/api/admin/receipts/analyze", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 credentials: "include",
 body: JSON.stringify({ fileData: b64, fileType: f.type }),
 });
 if (!res.ok) return;
 const data = await res.json();
 const detected = new Set<string>();
 const patch: Partial<ReceiptEntry> = {};
 if (data.amount) { patch.amount = data.amount; detected.add("amount"); }
 if (data.receiptDate) { patch.receiptDate = data.receiptDate; detected.add("receiptDate"); }
 if (data.category) { patch.category = data.category; detected.add("category"); }
 if (data.description) { patch.description = data.description; detected.add("description"); }
 if (data.merchant) { patch.merchant = data.merchant; detected.add("merchant"); }
 patchEntry(id, { ...patch, aiFields: detected, scanning: false });
 } catch {
 patchEntry(id, { scanning: false });
 }
 }, [patchEntry]);

 // Add files — filter, create entries, kick off parallel scans
 const addFiles = useCallback(async (files: FileList | File[]) => {
 const list = Array.from(files);
 const allowed = ["image/jpeg","image/png","image/webp","image/heic","image/heif","application/pdf"];
 const valid: File[] = [];
 for (const f of list) {
 if (!allowed.includes(f.type) && !f.type.startsWith("image/")) continue;
 if (f.size > 16 * 1024 * 1024) { toast({ title: `${f.name} is too large (max 16 MB)`, variant: "destructive" }); continue; }
 valid.push(f);
 }
 if (!valid.length) return;

 // Create entries immediately so they appear in the list
 const newEntries: ReceiptEntry[] = valid.map(f => ({
 id: genId(),
 file: f,
 preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
 b64: null,
 scanning: false,
 amount: "",
 receiptDate: today,
 category: "other",
 description: "",
 merchant: "",
 aiFields: new Set(),
 }));

 setEntries(prev => [...prev, ...newEntries]);
 // Auto-expand first new entry if list was empty
 if (entries.length === 0 && newEntries.length > 0) setExpandedId(newEntries[0].id);

 // Convert to base64 + scan in parallel
 await Promise.all(newEntries.map(async entry => {
 const b64 = await fileToBase64(entry.file);
 patchEntry(entry.id, { b64 });
 runScan(entry.id, entry.file, b64);
 }));
 }, [today, entries.length, patchEntry, runScan, toast]);

 const anyScanning = entries.some(e => e.scanning);
 const canSave = !submitting && !anyScanning && entries.length > 0 && !!userId;

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 if (!userId) { toast({ title: "Select a staff member", variant: "destructive" }); return; }
 if (!entries.length) { toast({ title: "Upload at least one receipt", variant: "destructive" }); return; }

 const invalid = entries.filter(en => !en.amount || parseFloat(en.amount) <= 0);
 if (invalid.length) {
 toast({ title: `${invalid.length} receipt${invalid.length > 1 ? "s" : ""} missing amount`, description: "Expand each card and fill in the amount.", variant: "destructive" });
 if (invalid[0]) setExpandedId(invalid[0].id);
 return;
 }

 setSubmitting(true);
 setSaveProgress({ done: 0, total: entries.length });
 let saved = 0;
 let failed = 0;

 for (const en of entries) {
 try {
 const fileData = en.b64 ?? await fileToBase64(en.file);
 await apiRequest("POST", "/api/admin/receipts", {
 userId: parseInt(userId),
 receiptDate: en.receiptDate,
 amount: parseFloat(en.amount).toFixed(2),
 category: en.category,
 description: [en.merchant, en.description].filter(Boolean).join(" · ").trim() || undefined,
 fileData,
 fileType: en.file.type,
 fileName: en.file.name,
 });
 saved++;
 setSaveProgress({ done: saved, total: entries.length });
 } catch { failed++; }
 }

 setSaveProgress(null);
 setSubmitting(false);

 if (failed === 0) {
 toast({ title: `${saved} receipt${saved > 1 ? "s" : ""} saved`, description: "All approved and logged." });
 onSuccess();
 onClose();
 } else {
 toast({ title: `${saved} saved, ${failed} failed`, description: "Some receipts could not be saved.", variant: "destructive" });
 onSuccess();
 }
 }

 return (
 <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
 <div className="absolute inset-0 bg-black/50" onClick={onClose} />

 <div
 className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-none overflow-hidden max-h-[92dvh] flex flex-col"
 data-testid="modal-add-receipt"
 >
 {/* Header */}
 <div className="flex items-center justify-between px-5 py-4 border-b border-black/8 shrink-0">
 <div>
 <div className="flex items-center gap-2">
 <h2 className="text-base font-bold text-[#0A0A0A]">
 Add Receipts{entries.length > 0 ? ` (${entries.length})` : ""}
 </h2>
 <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-[#0A0A0A] text-[10px] font-bold px-2 py-0.5">
 <Sparkles className="w-3 h-3" /> AI Scan
 </span>
 </div>
 <p className="text-xs text-black/55 mt-0.5">
 {entries.length === 0
 ? "Upload one or more receipts — AI auto-fills the details"
 : `${entries.filter(e => !e.scanning && e.amount).length} of ${entries.length} scanned`}
 </p>
 </div>
 <button
 onClick={onClose}
 className="w-8 h-8 flex items-center justify-center rounded-full bg-[#EBE9E2] text-black/55 hover:bg-[#EBE9E2] transition-colors"
 data-testid="button-close-add-receipt"
 >
 <X className="w-4 h-4" />
 </button>
 </div>

 {/* Scrollable body */}
 <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
 <div className="px-5 py-4 space-y-4">

 {/* Staff selector */}
 <div>
 <label className="text-xs font-semibold text-black/70 block mb-1.5">
 Staff Member <span className="text-red-500">*</span>
 </label>
 <div className="relative">
 <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/45 pointer-events-none" />
 <select
 value={userId}
 onChange={e => setUserId(e.target.value)}
 required
 data-testid="select-staff-member"
 className="w-full h-10 pl-9 pr-4 border border-black/20 rounded-none text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0A0A0A] focus:border-[#0A0A0A] transition-colors appearance-none"
 >
 <option value="">Select staff member…</option>
 {(staffList as any[]).map((s: any) => (
 <option key={s.id} value={s.id}>{s.name}</option>
 ))}
 </select>
 </div>
 </div>

 {/* Drop zone — compact when files exist, full when empty */}
 {entries.length === 0 ? (
 <div
 onClick={() => fileInputRef.current?.click()}
 onDragOver={e => { e.preventDefault(); setDragOver(true); }}
 onDragLeave={() => setDragOver(false)}
 onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
 data-testid="dropzone-receipt-file"
 className={`flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed rounded-none cursor-pointer transition-all ${
 dragOver ? "border-violet-400 bg-[#EBE9E2]" : "border-black/20 bg-white hover:border-violet-400 hover:bg-[#EBE9E2]/30"
 }`}
 >
 <div className="w-14 h-14 rounded-full bg-white border border-black/12 flex items-center justify-center ">
 <Sparkles className="w-6 h-6 text-violet-500" />
 </div>
 <div className="text-center">
 <p className="text-sm font-bold text-black/70">Click or drag receipts here</p>
 <p className="text-xs text-black/45 mt-1">Multiple files supported · AI scans each one</p>
 </div>
 </div>
 ) : (
 <div
 onClick={() => addMoreRef.current?.click()}
 onDragOver={e => { e.preventDefault(); setDragOver(true); }}
 onDragLeave={() => setDragOver(false)}
 onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
 data-testid="dropzone-receipt-file"
 className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-none cursor-pointer transition-all ${
 dragOver ? "border-violet-400 bg-[#EBE9E2]" : "border-black/12 hover:border-violet-400 hover:bg-[#EBE9E2]/20"
 }`}
 >
 <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
 <ImagePlus className="w-4 h-4 text-[#0A0A0A]" />
 </div>
 <div>
 <p className="text-xs font-semibold text-black/70">Add more receipts</p>
 <p className="text-[11px] text-black/45">Drop files or click to browse</p>
 </div>
 </div>
 )}

 {/* Hidden file inputs */}
 <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
 data-testid="input-file-upload"
 onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
 <input ref={addMoreRef} type="file" accept="image/*,application/pdf" multiple className="hidden"
 onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />

 {/* Receipt entry cards */}
 {entries.length > 0 && (
 <div className="space-y-2">
 <div className="flex items-center justify-between">
 <p className="text-xs font-semibold text-black/55 uppercase tracking-widest">
 {entries.length} Receipt{entries.length > 1 ? "s" : ""}
 </p>
 {anyScanning && (
 <span className="text-[11px] text-[#0A0A0A] font-semibold flex items-center gap-1 animate-pulse">
 <Sparkles className="w-3 h-3" /> Scanning…
 </span>
 )}
 </div>
 {entries.map((entry) => (
 <ReceiptCard
 key={entry.id}
 entry={entry}
 expanded={expandedId === entry.id}
 onToggleExpand={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
 onUpdate={patch => patchEntry(entry.id, patch)}
 onRemove={() => removeEntry(entry.id)}
 />
 ))}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="px-5 py-4 border-t border-black/8 bg-white flex gap-3 shrink-0">
 <button
 type="button"
 onClick={onClose}
 className="w-24 h-11 rounded-none border border-black/12 text-sm font-semibold text-black/70 hover:bg-white transition-colors shrink-0"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={!canSave}
 data-testid="button-submit-add-receipt"
 className="flex-1 h-11 rounded-none bg-[#0A0A0A] hover:bg-black text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
 >
 {submitting && saveProgress
 ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving {saveProgress.done}/{saveProgress.total}…</>
 : anyScanning
 ? <><Loader2 className="w-4 h-4 animate-spin text-violet-300" /> Scanning…</>
 : entries.length === 0
 ? <><Plus className="w-4 h-4" /> Upload Receipts</>
 : <><Check className="w-4 h-4" /> Save {entries.length} Receipt{entries.length > 1 ? "s" : ""}</>
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

 const [filterYear, setFilterYear] = useState<string>(String(currentYear));
 const [filterMonth, setFilterMonth] = useState<string>(String(currentMonth));
 const [filterDay, setFilterDay] = useState<string>("");
 const [expandedId, setExpandedId] = useState<number | null>(null);
 const [reviewingId, setReviewingId] = useState<number | null>(null);
 const [adminNote, setAdminNote] = useState("");
 const [downloadingId, setDownloadingId] = useState<number | null>(null);
 const [showAddModal, setShowAddModal] = useState(false);

 const params = new URLSearchParams();
 if (filterYear) params.set("year", filterYear);
 if (filterMonth) params.set("month", filterMonth);
 if (filterDay) params.set("day", filterDay);

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

 const pendingCount = allReceipts.filter((r: any) => r.status === "pending").length;
 const totalAmount = allReceipts.reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
 const approvedAmount = allReceipts
 .filter((r: any) => r.status === "approved")
 .reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);

 const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

 return (
 <div className="min-h-screen bg-white pt-14 lg:pl-56 pb-24">

 {/* Page Header */}
 <div className="bg-white border-b border-black/12 px-5 py-4 mb-5">
 <div className="max-w-5xl mx-auto flex items-start justify-between gap-4">
 <div>
 <p className="text-xs text-black/45 font-medium">Finance → Receipts</p>
 <h1 className="text-lg font-bold text-[#0A0A0A] mt-0.5">Staff Receipts</h1>
 <p className="text-sm text-black/55 mt-0.5">Review, approve and download expense receipts</p>
 </div>
 <button
 onClick={() => setShowAddModal(true)}
 data-testid="button-add-receipt"
 className="inline-flex items-center gap-2 h-10 px-4 rounded-none bg-[#0A0A0A] hover:bg-black text-white text-sm font-bold transition-colors shrink-0 mt-1"
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
 <div className="bg-white border border-black/12 rounded-none p-4 ">
 <p className="text-[10px] font-bold text-black/45 uppercase tracking-widest mb-2">Pending</p>
 <p className="text-2xl font-bold text-amber-600 leading-none tabular-nums">{pendingCount}</p>
 </div>
 <div className="bg-white border border-black/12 rounded-none p-4 overflow-hidden">
 <p className="text-[10px] font-bold text-black/45 uppercase tracking-widest mb-2">Submitted</p>
 <p className="text-sm font-extrabold text-[#0A0A0A] leading-tight tabular-nums break-all">S${totalAmount.toFixed(2)}</p>
 </div>
 <div className="bg-white border border-black/12 rounded-none p-4 overflow-hidden">
 <p className="text-[10px] font-bold text-black/45 uppercase tracking-widest mb-2">Approved</p>
 <p className="text-sm font-extrabold text-emerald-600 leading-tight tabular-nums break-all">S${approvedAmount.toFixed(2)}</p>
 </div>
 </div>

 {/* Filters */}
 <div className="bg-white border border-black/12 rounded-none overflow-hidden ">
 <div className="px-5 py-3.5 border-b border-black/8 flex items-center gap-2">
 <Filter className="w-3.5 h-3.5 text-black/45" />
 <h2 className="text-sm font-semibold text-[#0A0A0A]">Filter</h2>
 </div>
 <div className="p-4 flex flex-wrap gap-3">
 <div className="flex-1 min-w-[130px]">
 <label className="text-xs text-black/55 block mb-1">Year</label>
 <select
 value={filterYear}
 onChange={e => setFilterYear(e.target.value)}
 data-testid="select-filter-year"
 className="h-9 w-full px-3 border border-black/20 rounded-none text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]"
 >
 <option value="">All years</option>
 {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
 </select>
 </div>
 <div className="flex-1 min-w-[130px]">
 <label className="text-xs text-black/55 block mb-1">Month</label>
 <select
 value={filterMonth}
 onChange={e => setFilterMonth(e.target.value)}
 data-testid="select-filter-month"
 className="h-9 w-full px-3 border border-black/20 rounded-none text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]"
 >
 <option value="">All months</option>
 {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
 </select>
 </div>
 <div className="flex-1 min-w-[130px]">
 <label className="text-xs text-black/55 block mb-1">Day</label>
 <select
 value={filterDay}
 onChange={e => setFilterDay(e.target.value)}
 data-testid="select-filter-day"
 className="h-9 w-full px-3 border border-black/20 rounded-none text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]"
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
 className="h-9 px-4 rounded-none border border-black/12 text-black/70 hover:bg-white text-sm font-medium transition-colors"
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
 <p className="text-sm text-black/55">Loading receipts…</p>
 </div>
 )}

 {/* Empty state */}
 {!isLoading && allReceipts.length === 0 && (
 <div className="text-center py-20 bg-white border border-dashed border-black/12 rounded-none">
 <Receipt className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
 <p className="font-semibold text-[#0A0A0A]">No receipts found</p>
 <p className="text-sm text-black/55 mt-1 mb-4">Adjust filters or add a receipt manually</p>
 <button
 onClick={() => setShowAddModal(true)}
 className="inline-flex items-center gap-2 h-9 px-4 rounded-none bg-[#0A0A0A] hover:bg-black text-white text-sm font-semibold transition-colors"
 >
 <Plus className="w-4 h-4" /> Add Receipt
 </button>
 </div>
 )}

 {/* Receipts grouped by month */}
 {months.map(month => {
 const label = (() => { try { return format(parseISO(month + "-01"), "MMMM yyyy"); } catch { return month; } })();
 const monthTotal = grouped[month].reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
 const monthApproved = grouped[month].filter((r: any) => r.status === "approved").reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
 const monthPending = grouped[month].filter((r: any) => r.status === "pending").length;

 return (
 <div key={month} className="bg-white border border-black/12 rounded-none overflow-hidden ">
 <div className="px-5 py-4 border-b border-black/8 flex items-center justify-between">
 <div className="flex items-center gap-2.5">
 <h2 className="text-sm font-bold text-[#0A0A0A]">{label}</h2>
 {monthPending > 0 && (
 <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700">
 {monthPending} pending
 </span>
 )}
 </div>
 <div className="text-right flex items-center gap-4">
 <p className="text-xs text-black/55 hidden sm:block">Total: <span className="font-bold text-[#0A0A0A]">S${monthTotal.toFixed(2)}</span></p>
 <p className="text-xs text-black/55">Approved: <span className="font-bold text-emerald-600">S${monthApproved.toFixed(2)}</span></p>
 </div>
 </div>

 <div className="divide-y divide-black/8">
 {grouped[month].map((receipt: any) => {
 const cat = RECEIPT_CATEGORIES.find(c => c.value === receipt.category);
 const isExpanded = expandedId === receipt.id;
 const isReviewing = reviewingId === receipt.id;

 return (
 <div key={receipt.id} data-testid={`receipt-row-${receipt.id}`}>
 <div className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-white/80 transition-colors">
 <div className="w-10 h-10 rounded-none bg-[#EBE9E2] flex items-center justify-center text-lg shrink-0">
 {cat?.emoji || "📎"}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap mb-0.5">
 <p className="font-bold text-sm text-[#0A0A0A]">S${parseFloat(receipt.amount).toFixed(2)}</p>
 <p className="text-xs text-black/55">{receipt.user?.name || "Unknown"}</p>
 <StatusBadge status={receipt.status} />
 </div>
 <div className="flex items-center gap-2 flex-wrap text-xs text-black/45">
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
 className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-black/12 text-black/65 hover:bg-white transition-colors disabled:opacity-50"
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
 className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-black/12 text-amber-600 hover:bg-amber-50 transition-colors"
 title="Review"
 >
 <AlertCircle className="w-3.5 h-3.5" />
 </button>
 )}
 <button
 onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
 data-testid={`button-expand-receipt-${receipt.id}`}
 className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-black/45 hover:bg-[#EBE9E2] transition-colors"
 >
 {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
 </button>
 </div>
 </div>

 {isExpanded && (
 <div className="border-t border-black/8 bg-white/50 px-5 py-3.5 space-y-2">
 {receipt.adminNote && (
 <div className="bg-white border border-black/12 rounded-none p-3">
 <p className="text-xs font-semibold text-black/55 mb-1">Admin Note</p>
 <p className="text-sm text-black/70">{receipt.adminNote}</p>
 </div>
 )}
 <p className="text-xs text-black/45">
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
 className="w-full border border-amber-300 rounded-none px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white resize-none"
 />
 <div className="flex gap-2">
 <button onClick={() => { setReviewingId(null); setAdminNote(""); }}
 className="h-9 px-3 flex-1 rounded-none bg-white border border-black/12 text-black/70 hover:bg-white text-xs font-semibold transition-colors">
 Cancel
 </button>
 <button
 onClick={() => reviewMut.mutate({ id: receipt.id, status: "rejected", note: adminNote })}
 disabled={reviewMut.isPending}
 data-testid={`button-reject-receipt-${receipt.id}`}
 className="h-9 px-3 flex-1 rounded-none bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
 <X className="w-3.5 h-3.5" /> Reject
 </button>
 <button
 onClick={() => reviewMut.mutate({ id: receipt.id, status: "approved", note: adminNote })}
 disabled={reviewMut.isPending}
 data-testid={`button-approve-receipt-${receipt.id}`}
 className="h-9 px-3 flex-1 rounded-none bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1">
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
