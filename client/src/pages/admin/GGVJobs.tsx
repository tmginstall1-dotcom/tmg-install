import { useState, useRef, useCallback, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  TruckIcon, Flag, AlertCircle, Upload, Loader2, CheckCheck,
  FileImage, Eye,
} from "lucide-react";

type GGVJob = {
  id: number;
  date: string;
  vehicleGroup: string;
  vehicleType: string;
  jobNo: string | null;
  bookingRef: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  listedPrice: string | null;
  deduction: string | null;
  actualPrice: string | null;
  serviceType: string | null;
  remarks: string | null;
  address: string | null;
  postalCode: string | null;
  distanceKm: string | null;
  ratePerKm: string | null;
  flagged: boolean;
};

type ScannedJob = {
  jobNo: string | null;
  bookingRef: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  listedPrice: number | null;
  deduction: number | null;
  actualPrice: number | null;
  serviceType: string | null;
  remarks: string | null;
  address: string | null;
  postalCode: string | null;
  distanceKm: number | null;
  ratePerKm: number | null;
  flagged: boolean;
};

type ScanResult = {
  date: string | null;
  vehicleGroup: string;
  vehicleType: string;
  jobs: ScannedJob[];
};

const SERVICE_TYPES = [
  "D+A", "R+A+DISS", "ASD+ASA", "D+A+DISS", "A+DISS", "D only", "A only", "Other",
];

const EMPTY_FORM = {
  jobNo: "",
  bookingRef: "",
  timeStart: "",
  timeEnd: "",
  listedPrice: "",
  deduction: "",
  actualPrice: "",
  serviceType: "",
  remarks: "",
  address: "",
  postalCode: "",
  distanceKm: "",
  ratePerKm: "",
  flagged: false,
};

function todaySGT() {
  const nowSGT = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return nowSGT.toISOString().slice(0, 10);
}

const DELIVERY_FEE = 23.80;

function isDeliveryJob(jobNo: string | null | undefined): boolean {
  return !!(jobNo && jobNo.trim().toUpperCase().startsWith("S"));
}

function effectiveActual(job: GGVJob): number {
  const base = parseFloat(job.actualPrice ?? "");
  return (isNaN(base) ? 0 : base) + (isDeliveryJob(job.jobNo) ? DELIVERY_FEE : 0);
}

function fmt(val: string | number | null | undefined, prefix = "$") {
  const n = typeof val === "number" ? val : parseFloat(val ?? "");
  if (isNaN(n)) return "—";
  return `${prefix}${n.toFixed(2)}`;
}

function sum(jobs: GGVJob[], key: keyof GGVJob) {
  return jobs.reduce((s, j) => {
    const v = parseFloat((j[key] as string) ?? "");
    return s + (isNaN(v) ? 0 : v);
  }, 0);
}

function shiftDate(date: string, days: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDisplay(date: string) {
  const d = new Date(date + "T00:00:00Z");
  return d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function GGVJobs() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(todaySGT);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<GGVJob | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [vehicleGroup, setVehicleGroup] = useState("TMG1 GGV 029");
  const [vehicleType, setVehicleType] = useState("EV VAN");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Scan state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<boolean[]>([]);
  const [previewDate, setPreviewDate] = useState("");
  const [importing, setImporting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const queryKey = ["/api/admin/ggv-jobs", selectedDate];

  const { data: jobs = [], isLoading } = useQuery<GGVJob[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/admin/ggv-jobs?date=${selectedDate}`, { credentials: "include" });
      return res.json();
    },
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/ggv-jobs", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setDialogOpen(false); toast({ title: "Job added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/admin/ggv-jobs/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setDialogOpen(false); toast({ title: "Job updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/ggv-jobs/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey }); setDeleteId(null); toast({ title: "Job deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Upload & AI Scan (multi-file) ──────────────────────────────────────────

  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setScanning(true);
    setScanProgress({ current: 0, total: files.length });

    const mergedJobs: (ScannedJob & { _source?: string })[] = [];
    let detectedDate: string | null = null;
    let detectedGroup = "";
    let detectedType = "";
    const previews: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setScanProgress({ current: i + 1, total: files.length });

      // Collect image preview data URL
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => { previews.push(ev.target?.result as string); resolve(); };
        reader.readAsDataURL(file);
      });

      try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch("/api/admin/ggv-jobs/scan", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "Scan failed");
        }
        const data: ScanResult = await res.json();
        if (data.jobs?.length) {
          // Tag each row with its source filename for display
          data.jobs.forEach(j => mergedJobs.push({ ...j, _source: file.name }));
          if (!detectedDate && data.date) detectedDate = data.date;
          if (!detectedGroup && data.vehicleGroup) detectedGroup = data.vehicleGroup;
          if (!detectedType && data.vehicleType) detectedType = data.vehicleType;
        }
      } catch (err: any) {
        toast({ title: `File ${i + 1} scan failed`, description: `${file.name}: ${err.message}`, variant: "destructive" });
      }
    }

    setScanning(false);
    setScanProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (!mergedJobs.length) {
      toast({ title: "No jobs found", description: "AI couldn't extract any job rows from the uploaded image(s).", variant: "destructive" });
      return;
    }

    setScanResult({ date: detectedDate, vehicleGroup: detectedGroup, vehicleType: detectedType, jobs: mergedJobs });
    setSelectedRows(mergedJobs.map(() => true));
    setPreviewDate(detectedDate || selectedDate);
    if (detectedGroup) setVehicleGroup(detectedGroup);
    if (detectedType) setVehicleType(detectedType);
    setPreviewImage(previews[0] ?? null); // show first image as thumbnail
    setPreviewOpen(true);
  }, [selectedDate, toast]);

  async function handleImport() {
    if (!scanResult) return;
    setImporting(true);
    const toImport = scanResult.jobs.filter((_, i) => selectedRows[i]);
    let saved = 0;
    for (const job of toImport) {
      try {
        await apiRequest("POST", "/api/admin/ggv-jobs", {
          date: previewDate || selectedDate,
          vehicleGroup: scanResult.vehicleGroup || vehicleGroup,
          vehicleType: scanResult.vehicleType || vehicleType,
          jobNo: job.jobNo || null,
          bookingRef: job.bookingRef || null,
          timeStart: job.timeStart || null,
          timeEnd: job.timeEnd || null,
          listedPrice: job.listedPrice != null ? String(job.listedPrice) : null,
          deduction: job.deduction != null ? String(job.deduction) : "0",
          actualPrice: job.actualPrice != null ? String(job.actualPrice) : null,
          serviceType: job.serviceType || null,
          remarks: job.remarks || null,
          address: job.address || null,
          postalCode: job.postalCode || null,
          distanceKm: job.distanceKm != null ? String(job.distanceKm) : null,
          ratePerKm: job.ratePerKm != null ? String(job.ratePerKm) : null,
          flagged: job.flagged ?? false,
        });
        saved++;
      } catch {}
    }
    setImporting(false);
    setPreviewOpen(false);
    setScanResult(null);
    setPreviewImage(null);
    // If the date extracted matches selectedDate, the query will refresh
    if (previewDate) setSelectedDate(previewDate);
    queryClient.invalidateQueries({ queryKey: ["/api/admin/ggv-jobs"] });
    toast({ title: `${saved} job${saved !== 1 ? "s" : ""} imported successfully` });
  }

  // ── Manual add/edit ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditingJob(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  }

  function openEdit(job: GGVJob) {
    setEditingJob(job);
    setVehicleGroup(job.vehicleGroup);
    setVehicleType(job.vehicleType);
    setForm({
      jobNo: job.jobNo ?? "",
      bookingRef: job.bookingRef ?? "",
      timeStart: job.timeStart ?? "",
      timeEnd: job.timeEnd ?? "",
      listedPrice: job.listedPrice ?? "",
      deduction: job.deduction ?? "",
      actualPrice: job.actualPrice ?? "",
      serviceType: job.serviceType ?? "",
      remarks: job.remarks ?? "",
      address: job.address ?? "",
      postalCode: job.postalCode ?? "",
      distanceKm: job.distanceKm ?? "",
      ratePerKm: job.ratePerKm ?? "",
      flagged: job.flagged,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload = {
      date: selectedDate, vehicleGroup, vehicleType,
      jobNo: form.jobNo || null, bookingRef: form.bookingRef || null,
      timeStart: form.timeStart || null, timeEnd: form.timeEnd || null,
      listedPrice: form.listedPrice || null, deduction: form.deduction || "0",
      actualPrice: form.actualPrice || null, serviceType: form.serviceType || null,
      remarks: form.remarks || null, address: form.address || null,
      postalCode: form.postalCode || null, distanceKm: form.distanceKm || null,
      ratePerKm: form.ratePerKm || null, flagged: form.flagged,
    };
    if (editingJob) updateMut.mutate({ id: editingJob.id, data: payload });
    else createMut.mutate(payload);
  }

  const totalListed = sum(jobs, "listedPrice");
  const totalDeduction = sum(jobs, "deduction");
  const totalActual = jobs.reduce((s, j) => s + effectiveActual(j), 0);
  const isPending = createMut.isPending || updateMut.isPending;
  const selectedCount = selectedRows.filter(Boolean).length;

  return (
    <div className="lg:pl-56 pt-14 min-h-screen bg-slate-950">
      <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <TruckIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">GGV Job Tracker</h1>
              <p className="text-[11px] text-slate-500">Daily delivery & installation job log</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Upload & Scan — multiple files */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.png,.jpg,.jpeg,.webp"
              multiple
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-scan-file"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={scanning}
              data-testid="btn-scan-upload"
              variant="outline"
              className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 font-bold text-xs gap-1.5"
            >
              {scanning ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…</>
              ) : (
                <><Upload className="w-3.5 h-3.5" /> Upload & Scan</>
              )}
            </Button>
            <Button
              onClick={openAdd}
              data-testid="btn-add-ggv-job"
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Job
            </Button>
          </div>
        </div>

        {/* Scanning progress banner */}
        {scanning && (
          <div className="mb-4 flex items-center gap-3 bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-3">
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-blue-300 font-medium">
                {scanProgress.total > 1
                  ? `Scanning image ${scanProgress.current} of ${scanProgress.total}…`
                  : "AI is reading your spreadsheet…"}
              </p>
              {scanProgress.total > 1 && (
                <div className="mt-1.5 h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
            <span className="text-xs text-blue-500 font-mono">5–15s / image</span>
          </div>
        )}

        {/* Date nav + vehicle header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2 bg-slate-900 border border-white/8 rounded-lg px-2 py-1.5">
            <button onClick={() => setSelectedDate(d => shiftDate(d, -1))} data-testid="btn-prev-day" className="p-1 text-slate-400 hover:text-white rounded transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              data-testid="input-date"
              className="bg-transparent text-sm font-semibold text-white outline-none w-36"
            />
            <button onClick={() => setSelectedDate(d => shiftDate(d, 1))} data-testid="btn-next-day" className="p-1 text-slate-400 hover:text-white rounded transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-slate-400 text-sm hidden sm:block">{formatDisplay(selectedDate)}</span>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-white/8 rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Group</span>
              <input value={vehicleGroup} onChange={e => setVehicleGroup(e.target.value)} className="bg-transparent text-sm font-semibold text-emerald-400 outline-none w-28" />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900 border border-white/8 rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">Van</span>
              <input value={vehicleType} onChange={e => setVehicleType(e.target.value)} className="bg-transparent text-sm font-semibold text-slate-300 outline-none w-20" />
            </div>
          </div>
        </div>

        {/* ── Mobile card view (< md) ──────────────────────────────────────────── */}
        <div className="md:hidden space-y-2">
          {isLoading && (
            <div className="text-center py-10 text-slate-500 text-sm">Loading…</div>
          )}
          {!isLoading && jobs.length === 0 && (
            <div className="rounded-xl border border-white/8 bg-slate-900 p-8 flex flex-col items-center gap-3 text-slate-600">
              <FileImage className="w-9 h-9" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-400">No jobs for this day</p>
                <p className="text-xs mt-1">Upload a spreadsheet screenshot or tap Add Job</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-blue-400 font-semibold border border-blue-500/30 px-3 py-1.5 rounded-lg"
              >
                <Upload className="w-3 h-3" /> Upload & Scan
              </button>
            </div>
          )}
          {jobs.map((job) => {
            const isFlagged  = job.flagged;
            const isDelivery = isDeliveryJob(job.jobNo);
            const effActual  = effectiveActual(job);
            const deductAmt  = parseFloat(job.deduction ?? "0");
            return (
              <div
                key={job.id}
                data-testid={`row-ggv-${job.id}`}
                className={`rounded-xl border px-4 py-3 ${
                  isFlagged
                    ? "bg-rose-500/10 border-rose-500/30"
                    : job.remarks?.trim()
                    ? "bg-amber-500/8 border-amber-500/20"
                    : "bg-slate-900 border-white/8"
                }`}
              >
                {/* Top row: job no + service + actual $ */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isFlagged && <Flag className="w-3 h-3 text-rose-400 shrink-0" />}
                      <span className="font-mono text-[11px] text-slate-300">{job.jobNo || "—"}</span>
                      {job.serviceType && (
                        <span className="text-[10px] font-black bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded">
                          {job.serviceType}
                        </span>
                      )}
                      {isDelivery && (
                        <span className="text-[9px] font-black bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded">
                          DEL
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{job.address || "—"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-lg font-black tabular-nums text-emerald-400">${effActual.toFixed(2)}</span>
                    {isDelivery && (
                      <div className="text-[9px] text-emerald-700 font-medium">+${DELIVERY_FEE.toFixed(2)} del.</div>
                    )}
                  </div>
                </div>
                {/* Bottom row: time + prices + actions */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-3 text-[11px] text-slate-500">
                    {(job.timeStart || job.timeEnd) && (
                      <span>{job.timeStart ?? "?"}{job.timeEnd ? `–${job.timeEnd}` : ""}</span>
                    )}
                    {job.listedPrice && (
                      <span className="tabular-nums">${parseFloat(job.listedPrice).toFixed(2)}</span>
                    )}
                    {deductAmt > 0 && (
                      <span className="text-rose-400 tabular-nums">-${deductAmt.toFixed(2)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(job)}
                      data-testid={`btn-edit-${job.id}`}
                      className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(job.id)}
                      data-testid={`btn-delete-${job.id}`}
                      className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {job.remarks?.trim() && (
                  <p className="text-[11px] text-amber-400 mt-1.5 italic">{job.remarks}</p>
                )}
              </div>
            );
          })}
          {/* Mobile totals bar */}
          {jobs.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: "Listed",      value: `$${totalListed.toFixed(2)}`,                                    color: "text-slate-300" },
                { label: "Deductions",  value: totalDeduction > 0 ? `-$${totalDeduction.toFixed(2)}` : "—",     color: "text-rose-400"  },
                { label: "Actual",      value: `$${totalActual.toFixed(2)}`,                                    color: "text-emerald-400", big: true },
              ].map(({ label, value, color, big }) => (
                <div key={label} className="bg-slate-900 border border-white/8 rounded-xl p-3 text-center">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">{label}</p>
                  <p className={`font-black tabular-nums ${big ? "text-base" : "text-sm"} ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Desktop table (≥ md) ─────────────────────────────────────────────── */}
        <div className="hidden md:block rounded-xl border border-white/8 overflow-hidden bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="border-b border-white/8 bg-slate-800/60">
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-36">Job No</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-36">Booking Ref</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Time</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Listed</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-24">Deduction</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-emerald-500 w-28">Actual $</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-28">Service</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-44">Address</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-20">Postal</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-20">Dist km</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 w-16">Rate</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500">Remarks</th>
                  <th className="px-3 py-2.5 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={13} className="text-center py-12 text-slate-500 text-sm">Loading…</td></tr>
                )}
                {!isLoading && jobs.length === 0 && (
                  <tr>
                    <td colSpan={13} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3 text-slate-600">
                        <FileImage className="w-10 h-10" />
                        <div>
                          <p className="text-sm font-semibold text-slate-400">No jobs for this day</p>
                          <p className="text-xs mt-1">Upload a spreadsheet screenshot to auto-fill, or click "Add Job" to enter manually</p>
                        </div>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="mt-1 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold border border-blue-500/30 px-3 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors"
                        >
                          <Upload className="w-3 h-3" /> Upload & Scan
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {jobs.map((job) => {
                  const isFlagged = job.flagged;
                  const hasRemarks = !!(job.remarks?.trim());
                  const isDelivery = isDeliveryJob(job.jobNo);
                  const effActual = effectiveActual(job);
                  return (
                    <tr
                      key={job.id}
                      data-testid={`row-ggv-${job.id}`}
                      className={`border-b border-white/5 transition-colors ${
                        isFlagged ? "bg-rose-500/10 hover:bg-rose-500/15"
                          : hasRemarks ? "bg-amber-500/8 hover:bg-amber-500/12"
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-300">
                        <div className="flex items-center gap-1.5">
                          {isFlagged && <Flag className="w-3 h-3 text-rose-400 shrink-0" />}
                          {job.jobNo || <span className="text-slate-600">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-slate-400">{job.bookingRef || <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">
                        {job.timeStart && job.timeEnd ? `${job.timeStart}–${job.timeEnd}` : job.timeStart || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-400">{fmt(job.listedPrice)}</td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-rose-400">{parseFloat(job.deduction ?? "0") > 0 ? `-${fmt(job.deduction)}` : "—"}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-sm font-black tabular-nums text-emerald-400">${effActual.toFixed(2)}</span>
                        {isDelivery && (
                          <div className="text-[9px] tabular-nums text-emerald-700 font-medium leading-tight">
                            +${DELIVERY_FEE.toFixed(2)} del.
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {job.serviceType
                          ? <span className="text-[10px] font-black bg-blue-500/15 text-blue-300 px-1.5 py-0.5 rounded">{job.serviceType}</span>
                          : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[11rem] truncate" title={job.address ?? ""}>{job.address || "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-slate-400">{job.postalCode || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-400">{job.distanceKm ? parseFloat(job.distanceKm).toFixed(2) : "—"}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-slate-500">{job.ratePerKm ? parseFloat(job.ratePerKm).toFixed(2) : "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-amber-400 max-w-[10rem] truncate" title={job.remarks ?? ""}>{job.remarks || "—"}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(job)} data-testid={`btn-edit-${job.id}`} className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-white/10 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteId(job.id)} data-testid={`btn-delete-${job.id}`} className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {jobs.length > 0 && (
                <tfoot>
                  <tr className="border-t border-white/10 bg-slate-800/80">
                    <td colSpan={3} className="px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-slate-300">${totalListed.toFixed(2)}</td>
                    <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-rose-400">{totalDeduction > 0 ? `-$${totalDeduction.toFixed(2)}` : "—"}</td>
                    <td className="px-3 py-3 text-right"><span className="text-base font-black tabular-nums text-emerald-400">${totalActual.toFixed(2)}</span></td>
                    <td colSpan={7} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Summary cards — desktop only (mobile has inline totals in card view) */}
        {jobs.length > 0 && (
          <div className="hidden md:grid grid-cols-3 gap-3 mt-4">
            {[
              { label: "Total Listed", value: `$${totalListed.toFixed(2)}`, color: "text-slate-300" },
              { label: "Total Deductions", value: totalDeduction > 0 ? `-$${totalDeduction.toFixed(2)}` : "—", color: "text-rose-400" },
              { label: "Total Actual", value: `$${totalActual.toFixed(2)}`, color: "text-emerald-400", big: true },
            ].map(({ label, value, color, big }) => (
              <div key={label} className="bg-slate-900 border border-white/8 rounded-xl p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{label}</p>
                <p className={`font-black tabular-nums ${big ? "text-2xl" : "text-lg"} ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── AI Scan Preview Modal ────────────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={v => { if (!importing) setPreviewOpen(v); }}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-white">
              <Eye className="w-4 h-4 text-blue-400" />
              Review Scanned Jobs
              <span className="ml-auto text-xs font-normal text-slate-400">
                {scanResult?.jobs.length} row{scanResult?.jobs.length !== 1 ? "s" : ""} found — {selectedCount} selected
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* Date override */}
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <div className="flex items-center gap-2 flex-1">
              <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest shrink-0">Save to date</Label>
              <input
                type="date"
                value={previewDate}
                onChange={e => setPreviewDate(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded text-sm text-white px-2 py-1 outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedRows(r => r.map(() => true))}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >Select all</button>
              <span className="text-slate-600">·</span>
              <button
                onClick={() => setSelectedRows(r => r.map(() => false))}
                className="text-xs text-slate-400 hover:text-white font-semibold"
              >None</button>
            </div>
          </div>

          {/* Preview image thumbnail — only shown for single upload */}
          {previewImage && scanResult && !scanResult.jobs.some(j => (j as any)._source && (j as any)._source !== scanResult.jobs[0] && (j as any)._source !== (scanResult.jobs[0] as any)._source) && (
            <div className="rounded-lg overflow-hidden border border-white/8 max-h-36 flex items-center justify-center bg-black">
              <img src={previewImage} alt="Uploaded spreadsheet" className="max-h-36 object-contain opacity-80" />
            </div>
          )}

          {/* Extracted rows table */}
          <div className="overflow-x-auto rounded-lg border border-white/8">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="bg-slate-800/60 border-b border-white/8">
                  <th className="px-2 py-2 w-8"></th>
                  <th className="text-left px-2 py-2 text-slate-500 font-black uppercase tracking-wider">Job No</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-black uppercase tracking-wider">Booking Ref</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-black uppercase tracking-wider">Time</th>
                  <th className="text-right px-2 py-2 text-slate-500 font-black uppercase tracking-wider">Listed</th>
                  <th className="text-right px-2 py-2 text-slate-500 font-black uppercase tracking-wider">Deduct</th>
                  <th className="text-right px-2 py-2 text-emerald-500 font-black uppercase tracking-wider">Actual $</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-black uppercase tracking-wider">Type</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-black uppercase tracking-wider">Address</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-black uppercase tracking-wider">Postal</th>
                  <th className="text-right px-2 py-2 text-slate-500 font-black uppercase tracking-wider">km</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-black uppercase tracking-wider">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {scanResult?.jobs.map((job, i) => {
                  const source = (job as any)._source as string | undefined;
                  const prevSource = i > 0 ? ((scanResult.jobs[i - 1] as any)._source as string | undefined) : null;
                  const isNewSource = source && source !== prevSource;
                  const isMultiFile = scanResult.jobs.some((j, idx) => idx > 0 && (j as any)._source !== (scanResult.jobs[0] as any)._source);
                  return (
                    <Fragment key={i}>
                      {isMultiFile && isNewSource && (
                        <tr key={`source-${i}`} className="bg-slate-800/80 border-b border-white/10">
                          <td colSpan={12} className="px-2 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <FileImage className="w-3 h-3 text-blue-400" />
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest truncate max-w-xs">{source}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr
                        key={i}
                        className={`border-b border-white/5 transition-colors ${
                          !selectedRows[i] ? "opacity-40" :
                          job.flagged ? "bg-rose-500/10" : ""
                        }`}
                      >
                        <td className="px-2 py-2 text-center">
                          <Checkbox
                            checked={selectedRows[i] ?? true}
                            onCheckedChange={v => setSelectedRows(r => r.map((val, idx) => idx === i ? !!v : val))}
                            className="border-slate-500"
                          />
                        </td>
                        <td className="px-2 py-2 font-mono text-slate-300">
                          <div className="flex items-center gap-1">
                            {job.flagged && <Flag className="w-2.5 h-2.5 text-rose-400" />}
                            {job.jobNo || <span className="text-slate-600">—</span>}
                          </div>
                        </td>
                        <td className="px-2 py-2 font-mono text-slate-400">{job.bookingRef || "—"}</td>
                        <td className="px-2 py-2 text-slate-400">
                          {job.timeStart && job.timeEnd ? `${job.timeStart}–${job.timeEnd}` : job.timeStart || "—"}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-400">{fmt(job.listedPrice)}</td>
                        <td className="px-2 py-2 text-right text-rose-400">{(job.deduction ?? 0) > 0 ? `-${fmt(job.deduction)}` : "—"}</td>
                        <td className="px-2 py-2 text-right font-black text-emerald-400">{fmt(job.actualPrice)}</td>
                        <td className="px-2 py-2">
                          {job.serviceType
                            ? <span className="bg-blue-500/15 text-blue-300 px-1 py-0.5 rounded text-[10px] font-bold">{job.serviceType}</span>
                            : "—"}
                        </td>
                        <td className="px-2 py-2 text-slate-400 max-w-[12rem] truncate" title={job.address ?? ""}>{job.address || "—"}</td>
                        <td className="px-2 py-2 text-slate-400">{job.postalCode || "—"}</td>
                        <td className="px-2 py-2 text-right text-slate-400">{job.distanceKm != null ? job.distanceKm.toFixed(2) : "—"}</td>
                        <td className="px-2 py-2 text-amber-400 max-w-[10rem] truncate" title={job.remarks ?? ""}>{job.remarks || "—"}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
              {scanResult && selectedCount > 0 && (
                <tfoot>
                  <tr className="border-t border-white/10 bg-slate-800/60">
                    <td colSpan={6} className="px-2 py-2 text-slate-500">{selectedCount} selected</td>
                    <td className="px-2 py-2 text-right font-black text-emerald-400">
                      ${scanResult.jobs.filter((_, i) => selectedRows[i]).reduce((s, j) => s + (j.actualPrice ?? 0), 0).toFixed(2)}
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPreviewOpen(false)} disabled={importing} className="text-slate-400 hover:text-white">
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || selectedCount === 0}
              className="bg-emerald-500 hover:bg-emerald-400 text-black font-black gap-1.5"
              data-testid="btn-import-jobs"
            >
              {importing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing…</>
              ) : (
                <><CheckCheck className="w-3.5 h-3.5" /> Import {selectedCount} job{selectedCount !== 1 ? "s" : ""}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white font-black">{editingJob ? "Edit Job" : "Add Job"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 rounded-lg">
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Vehicle Group</Label>
                <Input value={vehicleGroup} onChange={e => setVehicleGroup(e.target.value)} className="bg-slate-800 border-white/10 text-white text-sm h-8" data-testid="input-vehicle-group" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Vehicle Type</Label>
                <Input value={vehicleType} onChange={e => setVehicleType(e.target.value)} className="bg-slate-800 border-white/10 text-white text-sm h-8" data-testid="input-vehicle-type" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Job No</Label>
                <Input value={form.jobNo} onChange={e => setForm(f => ({ ...f, jobNo: e.target.value }))} placeholder="S045260062103" className="bg-slate-800 border-white/10 text-white text-sm h-9 font-mono" data-testid="input-job-no" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Booking Ref</Label>
                <Input value={form.bookingRef} onChange={e => setForm(f => ({ ...f, bookingRef: e.target.value }))} placeholder="V045260161488" className="bg-slate-800 border-white/10 text-white text-sm h-9 font-mono" data-testid="input-booking-ref" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Time Start</Label>
                <Input type="time" value={form.timeStart} onChange={e => setForm(f => ({ ...f, timeStart: e.target.value }))} className="bg-slate-800 border-white/10 text-white text-sm h-9" data-testid="input-time-start" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Time End</Label>
                <Input type="time" value={form.timeEnd} onChange={e => setForm(f => ({ ...f, timeEnd: e.target.value }))} className="bg-slate-800 border-white/10 text-white text-sm h-9" data-testid="input-time-end" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Listed ($)</Label>
                <Input type="number" step="0.01" value={form.listedPrice} onChange={e => setForm(f => ({ ...f, listedPrice: e.target.value }))} placeholder="99.90" className="bg-slate-800 border-white/10 text-white text-sm h-9" data-testid="input-listed-price" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Deduction ($)</Label>
                <Input type="number" step="0.01" value={form.deduction} onChange={e => setForm(f => ({ ...f, deduction: e.target.value }))} placeholder="18.33" className="bg-slate-800 border-white/10 text-rose-300 text-sm h-9" data-testid="input-deduction" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-emerald-500 uppercase font-black tracking-widest">Actual Price ($) ★</Label>
                <Input type="number" step="0.01" value={form.actualPrice} onChange={e => setForm(f => ({ ...f, actualPrice: e.target.value }))} placeholder="9.17" className="bg-emerald-950/40 border-emerald-500/30 text-emerald-400 font-black text-sm h-9" data-testid="input-actual-price" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Service Type</Label>
                <Select value={form.serviceType || "__none__"} onValueChange={v => setForm(f => ({ ...f, serviceType: v === "__none__" ? "" : v }))}>
                  <SelectTrigger className="bg-slate-800 border-white/10 text-white h-9 text-sm" data-testid="select-service-type">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-white/10 text-white">
                    <SelectItem value="__none__">— None —</SelectItem>
                    {SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Flag Row</Label>
                <button type="button" onClick={() => setForm(f => ({ ...f, flagged: !f.flagged }))} data-testid="btn-flagged"
                  className={`w-full h-9 rounded-md border text-sm font-bold flex items-center justify-center gap-2 transition-colors ${form.flagged ? "bg-rose-500/20 border-rose-500/40 text-rose-400" : "bg-slate-800 border-white/10 text-slate-400 hover:text-white"}`}>
                  <Flag className="w-3.5 h-3.5" />{form.flagged ? "Flagged" : "Not Flagged"}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Address</Label>
                <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="17 Jalan Tenteram #08-120" className="bg-slate-800 border-white/10 text-white text-sm h-9" data-testid="input-address" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Postal Code</Label>
                <Input value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} placeholder="321017" className="bg-slate-800 border-white/10 text-white text-sm h-9" data-testid="input-postal-code" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Distance (km)</Label>
                <Input type="number" step="0.01" value={form.distanceKm} onChange={e => setForm(f => ({ ...f, distanceKm: e.target.value }))} placeholder="15.95" className="bg-slate-800 border-white/10 text-white text-sm h-9" data-testid="input-distance" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Rate / km</Label>
                <Input type="number" step="0.01" value={form.ratePerKm} onChange={e => setForm(f => ({ ...f, ratePerKm: e.target.value }))} placeholder="0.06" className="bg-slate-800 border-white/10 text-white text-sm h-9" data-testid="input-rate-per-km" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Remarks / Notes</Label>
              <Input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="SHI DONG 04/03 COMPLETED" className="bg-slate-800 border-white/10 text-amber-400 text-sm h-9" data-testid="input-remarks" />
            </div>
          </div>
          <DialogFooter className="mt-2 gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-slate-400 hover:text-white">Cancel</Button>
            <Button onClick={handleSave} disabled={isPending} className="bg-emerald-500 hover:bg-emerald-400 text-black font-black" data-testid="btn-save-job">
              {isPending ? "Saving…" : editingJob ? "Save Changes" : "Add Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5" /> Delete Job
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">This job entry will be permanently deleted.</p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteId(null)} className="text-slate-400 hover:text-white">Cancel</Button>
            <Button onClick={() => deleteId && deleteMut.mutate(deleteId)} disabled={deleteMut.isPending} className="bg-rose-500 hover:bg-rose-400 text-white font-black" data-testid="btn-confirm-delete">
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
