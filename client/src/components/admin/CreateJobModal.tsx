import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  User, MapPin, Calendar, Clock, Package,
  Plus, Trash2, CheckCircle2, ExternalLink, Sparkles, Upload,
  X, FileImage, AlertCircle, ChevronDown, ChevronUp,
  ArrowRight, Truck, Wrench, Mail, Tag, CheckCircle, XCircle,
} from "lucide-react";

const SERVICE_OPTIONS = [
  "Assembly", "Dismantling", "Relocation", "Wall Mounting",
  "Curtain / Blinds", "Electrical", "Other",
];

const TIME_WINDOWS = [
  { value: "09:00-12:00", label: "Morning  (09:00 – 12:00)" },
  { value: "13:00-17:00", label: "Afternoon  (13:00 – 17:00)" },
  { value: "09:00-17:00", label: "Full Day  (09:00 – 17:00)" },
];

const SOURCE_OPTIONS = [
  { value: "phone",      label: "📞  Phone Call" },
  { value: "ikea",       label: "🛋  IKEA Direct" },
  { value: "referral",   label: "🤝  Referral" },
  { value: "walk_in",    label: "🚶  Walk-in" },
  { value: "whatsapp",   label: "💬  WhatsApp" },
  { value: "other",      label: "⚡  Other" },
];

const PAYMENT_OPTIONS = [
  { value: "unpaid",       label: "Unpaid" },
  { value: "deposit_paid", label: "Deposit Paid" },
  { value: "paid_in_full", label: "Paid in Full" },
];

const CONFIDENCE_COLORS: Record<string, string> = {
  high:   "bg-green-50 text-green-700 border-green-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low:    "bg-red-50 text-red-700 border-red-200",
};

type JobType = "standard" | "relocation";

type LineItem = { id: number; description: string; quantity: number; unitPrice: string; remark?: string | null; aiGenerated?: boolean };
let _id = 1;
const genId = () => _id++;

type StaffMember = { id: number; name: string; role: string };

type ScanResult = {
  items: { name: string; quantity: number; unitPrice: string; serviceType: string; remark?: string | null }[];
  address: string | null;
  notes: string | null;
  confidence: "high" | "medium" | "low";
};

type CreatedJob = {
  id: number;
  referenceNo: string;
  serviceAddress: string;
  scheduledAt: string | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CreateJobModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scan state
  const [scanFile, setScanFile]         = useState<File | null>(null);
  const [scanPreview, setScanPreview]   = useState<string | null>(null);
  const [scanResult, setScanResult]     = useState<ScanResult | null>(null);
  const [scanning, setScanning]         = useState(false);
  const [scanError, setScanError]       = useState<string | null>(null);
  const [scanCollapsed, setScanCollapsed] = useState(false);

  // Job type
  const [jobType, setJobType] = useState<JobType>("standard");

  // Customer state
  const [customerName, setCustomerName]       = useState("");
  const [customerPhone, setCustomerPhone]     = useState("");
  const [customerEmail, setCustomerEmail]     = useState("");

  // Address state
  const [serviceAddress, setServiceAddress]   = useState("");
  const [dropoffAddress, setDropoffAddress]   = useState("");

  // Relocation-specific
  const [pickupFloor, setPickupFloor]         = useState("");
  const [dropoffFloor, setDropoffFloor]       = useState("");
  const [pickupLift, setPickupLift]           = useState<boolean | null>(null);
  const [dropoffLift, setDropoffLift]         = useState<boolean | null>(null);
  const [includeDismantle, setIncludeDismantle] = useState(false);
  const [includeAssembly, setIncludeAssembly]   = useState(false);

  // Schedule
  const [services, setServices]               = useState<string[]>([]);
  const [scheduledDate, setScheduledDate]     = useState("");
  const [timeWindow, setTimeWindow]           = useState("09:00-12:00");

  // Items & pricing
  const [items, setItems]                     = useState<LineItem[]>([{ id: genId(), description: "", quantity: 1, unitPrice: "" }]);
  const [manualTotal, setManualTotal]         = useState("");
  const [depositAmountInput, setDepositAmountInput] = useState("");
  const [paymentStatus, setPaymentStatus]     = useState("unpaid");

  // Assignment & meta
  const [assignedStaffId, setAssignedStaffId] = useState<string>("");
  const [sourceChannel, setSourceChannel]     = useState("whatsapp");
  const [notes, setNotes]                     = useState("");
  const [createdJob, setCreatedJob]           = useState<CreatedJob | null>(null);

  // AI pricing coach
  type CoachResult = {
    summary: string;
    recommendedTotal: number;
    confidence: "high" | "medium" | "low";
    priceCheck: { name: string; entered: number; catalog: number | null; catalogMatch: string | null; delta: number; verdict: "fair" | "low" | "high" | "no_match" }[];
    reasoning: string[];
    competitive: { competitor: string; priceRange: string; note: string }[];
    addOns: { label: string; price: number; when: string }[];
    meta?: { model: string; latencyMs: number; costSgd: number; catalogMatchesFound: number };
  };
  const [coachResult, setCoachResult]   = useState<CoachResult | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError]     = useState<string | null>(null);
  const [coachOpen, setCoachOpen]       = useState(false);

  // Promo code
  const [promoInput, setPromoInput]           = useState("");
  const [promoCode, setPromoCode]             = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount]     = useState(0);
  const [promoStatus, setPromoStatus]         = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [promoMessage, setPromoMessage]       = useState("");

  const { data: staff = [] } = useQuery<StaffMember[]>({
    queryKey: ["/api/staff"],
    enabled: open,
  });

  const itemsTotal = items.reduce((sum, item) => {
    return sum + (item.quantity * parseFloat(item.unitPrice || "0"));
  }, 0);
  const calculatedTotal = Math.max(0, itemsTotal - promoDiscount);

  const applyPromoCode = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoStatus("checking");
    setPromoMessage("");
    try {
      const res = await apiRequest("POST", "/api/promo/validate", { code });
      const data = await res.json();
      if (data.valid) {
        setPromoCode(code);
        setPromoDiscount(data.discount);
        setPromoStatus("valid");
        setPromoMessage(data.message || `$${data.discount.toFixed(0)} discount applied!`);
        setManualTotal("");
      } else {
        setPromoCode(null);
        setPromoDiscount(0);
        setPromoStatus("invalid");
        setPromoMessage(data.message || "Invalid or expired promo code.");
      }
    } catch {
      setPromoStatus("invalid");
      setPromoMessage("Could not validate promo code. Try again.");
    }
  };

  const runPricingCoach = async () => {
    const validItems = items.filter(i => i.description.trim());
    if (validItems.length === 0) {
      toast({ title: "Add some items first", description: "The coach needs at least one item description to analyse.", variant: "destructive" });
      return;
    }
    setCoachLoading(true);
    setCoachError(null);
    setCoachOpen(true);
    try {
      const res = await apiRequest("POST", "/api/ai/pricing-coach", {
        jobType,
        items: validItems.map(i => ({
          description: i.description.trim(),
          quantity:    i.quantity,
          unitPrice:   parseFloat(i.unitPrice || "0"),
        })),
        services,
        pickupFloor:  isRelocation ? (pickupFloor || null)  : null,
        pickupLift:   isRelocation ? pickupLift              : null,
        dropoffFloor: isRelocation ? (dropoffFloor || null) : null,
        dropoffLift:  isRelocation ? dropoffLift             : null,
        notes:        notes.trim() || null,
      });
      const data: CoachResult = await res.json();
      setCoachResult(data);
    } catch (e: any) {
      setCoachError(e?.message || "Coach failed. Try again in a moment.");
    } finally {
      setCoachLoading(false);
    }
  };

  const applyCoachTotal = () => {
    if (!coachResult) return;
    setManualTotal(coachResult.recommendedTotal.toFixed(2));
    toast({ title: "Recommended total applied", description: `Override total set to S$${coachResult.recommendedTotal.toFixed(2)}.` });
  };

  const addCoachAddOn = (label: string, price: number) => {
    setItems(prev => [...prev, { id: genId(), description: label, quantity: 1, unitPrice: price.toFixed(2), aiGenerated: true }]);
    toast({ title: "Add-on added", description: `${label} (S$${price.toFixed(2)}) appended to items.` });
  };

  const removePromoCode = () => {
    setPromoInput("");
    setPromoCode(null);
    setPromoDiscount(0);
    setPromoStatus("idle");
    setPromoMessage("");
  };

  const isRelocation = jobType === "relocation";

  // ── Job type switch ─────────────────────────────────────────────────────────
  const handleJobTypeChange = (type: JobType) => {
    setJobType(type);
    if (type === "relocation") {
      setSourceChannel(prev => prev);
      // Auto-add Relocation to services if not already there
      setServices(prev => prev.includes("Relocation") ? prev : [...prev, "Relocation"]);
    } else {
      setServices(prev => prev.filter(s => s !== "Relocation"));
    }
  };

  // ── AI Scan ─────────────────────────────────────────────────────────────────
  const handleFileSelect = (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isPdf   = file.type === "application/pdf";
    if (!isImage && !isPdf) {
      toast({ title: "Unsupported file", description: "Upload a JPG, PNG, WEBP image or PDF.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10 MB.", variant: "destructive" });
      return;
    }
    setScanFile(file);
    setScanResult(null);
    setScanError(null);
    setScanCollapsed(false);
    if (isImage) {
      const reader = new FileReader();
      reader.onload = e => setScanPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setScanPreview(null);
    }
    doScan(file);
  };

  const doScan = async (file: File) => {
    setScanning(true);
    setScanError(null);
    try {
      const base64 = await fileToBase64(file);
      const res = await apiRequest("POST", "/api/admin/jobs/scan-attachment", {
        fileData: base64,
        fileType: file.type,
        fileName: file.name,
      });
      const data: ScanResult = await res.json();
      setScanResult(data);
    } catch (e: any) {
      setScanError(e.message || "Scan failed. You can fill items manually.");
    } finally {
      setScanning(false);
    }
  };

  const applyScanResult = () => {
    if (!scanResult) return;
    if (scanResult.items.length > 0) {
      setItems(scanResult.items.map(i => ({
        id: genId(), description: i.name, quantity: i.quantity,
        unitPrice: i.unitPrice, remark: i.remark || null, aiGenerated: true,
      })));
    }
    if (scanResult.address && !serviceAddress) setServiceAddress(scanResult.address);
    if (scanResult.notes && !notes) setNotes(scanResult.notes);
    setScanCollapsed(true);
    toast({ title: "AI suggestions applied", description: `${scanResult.items.length} item${scanResult.items.length !== 1 ? "s" : ""} added.` });
  };

  // ── Job creation ─────────────────────────────────────────────────────────────
  const createJob = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/admin/jobs/create", data);
      return res.json() as Promise<CreatedJob>;
    },
    onSuccess: (data: CreatedJob) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setCreatedJob(data);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create job", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!customerName.trim()) return toast({ title: "Customer name required", variant: "destructive" });
    if (!customerPhone.trim()) return toast({ title: "Customer phone required", variant: "destructive" });
    if (!serviceAddress.trim()) return toast({ title: isRelocation ? "Pick-up address required" : "Service address required", variant: "destructive" });
    if (isRelocation && !dropoffAddress.trim()) return toast({ title: "Drop-off address required", variant: "destructive" });

    const validItems = items.filter(i => i.description.trim());

    // Build floor/access note for relocation
    const accessLines: string[] = [];
    if (isRelocation) {
      if (pickupFloor) accessLines.push(`Pick-up: ${pickupFloor}${pickupLift !== null ? ` (lift: ${pickupLift ? "yes" : "no"})` : ""}`);
      if (dropoffFloor) accessLines.push(`Drop-off: ${dropoffFloor}${dropoffLift !== null ? ` (lift: ${dropoffLift ? "yes" : "no"})` : ""}`);
      if (includeDismantle) accessLines.push("Include dismantling at pick-up");
      if (includeAssembly) accessLines.push("Include assembly at drop-off");
    }
    const combinedNotes = [
      notes.trim(),
      accessLines.length > 0 ? `Access info — ${accessLines.join("; ")}` : "",
    ].filter(Boolean).join("\n");

    createJob.mutate({
      customerName:     customerName.trim(),
      customerPhone:    customerPhone.trim(),
      customerEmail:    customerEmail.trim() || null,
      serviceAddress:   serviceAddress.trim(),
      dropoffAddress:   isRelocation ? dropoffAddress.trim() : null,
      isRelocation,
      scheduledDate:    scheduledDate || null,
      timeWindow:       scheduledDate ? timeWindow : null,
      selectedServices: isRelocation
        ? ["Relocation", ...services.filter(s => s !== "Relocation")]
        : services,
      notes:            combinedNotes || null,
      assignedStaffId:  assignedStaffId ? parseInt(assignedStaffId) : null,
      total:            manualTotal || calculatedTotal.toFixed(2),
      depositAmount:    depositAmountInput || "0",
      paymentStatus,
      sourceChannel,
      promoCode:        promoCode || null,
      promoDiscount:    promoDiscount > 0 ? promoDiscount.toFixed(2) : "0",
      items: validItems.map(i => ({
        description: i.description,
        quantity:    i.quantity,
        unitPrice:   i.unitPrice || "0",
        remark:      i.remark || null,
      })),
    });
  };

  const handleClose = () => {
    if (createdJob) { setCreatedJob(null); resetForm(); }
    onClose();
  };

  const resetForm = () => {
    setJobType("standard");
    setCustomerName(""); setCustomerPhone(""); setCustomerEmail("");
    setServiceAddress(""); setDropoffAddress("");
    setPickupFloor(""); setDropoffFloor(""); setPickupLift(null); setDropoffLift(null);
    setIncludeDismantle(false); setIncludeAssembly(false);
    setServices([]); setScheduledDate(""); setTimeWindow("09:00-12:00");
    setItems([{ id: genId(), description: "", quantity: 1, unitPrice: "" }]);
    setManualTotal(""); setDepositAmountInput(""); setPaymentStatus("unpaid"); setAssignedStaffId("");
    setSourceChannel("whatsapp"); setNotes("");
    setPromoInput(""); setPromoCode(null); setPromoDiscount(0); setPromoStatus("idle"); setPromoMessage("");
    setScanFile(null); setScanPreview(null); setScanResult(null);
    setScanError(null); setScanning(false); setScanCollapsed(false);
    setCoachResult(null); setCoachError(null); setCoachLoading(false); setCoachOpen(false);
  };

  const toggleService = (s: string) => {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const addItem = () => setItems(prev => [...prev, { id: genId(), description: "", quantity: 1, unitPrice: "" }]);
  const removeItem = (id: number) => setItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: number, field: keyof LineItem, value: string | number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const LiftToggle = ({
    value, onChange, label,
  }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) => (
    <div>
      <Label className="text-xs text-zinc-500 mb-1.5 block">{label}</Label>
      <div className="flex gap-1.5">
        {([true, false] as const).map(v => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              value === v
                ? v ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500"
                : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={open ? handleClose : undefined}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-zinc-100">
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-7 h-7 bg-black rounded-lg flex items-center justify-center">
              <Plus className="w-4 h-4 text-white" />
            </div>
            New Job
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 mt-1">
            Log a job from any source — phone call, IKEA direct, referral, WhatsApp.
          </DialogDescription>
        </DialogHeader>

        {createdJob ? (
          /* ── Success state ─────────────────────────────────── */
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-900">Job Created!</p>
              <p className="text-sm text-zinc-500 mt-1">
                Reference <span className="font-mono font-bold text-zinc-800">{createdJob.referenceNo}</span> is now live.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
              <Button
                data-testid="button-view-created-job"
                className="flex-1 bg-black hover:bg-zinc-800 text-white text-sm gap-2"
                onClick={() => { setLocation(`/admin/quotes/${createdJob.id}`); handleClose(); }}
              >
                <ExternalLink className="w-4 h-4" /> View & Edit Quote
              </Button>
              <Button
                data-testid="button-create-another-job"
                variant="outline"
                className="flex-1 text-sm"
                onClick={() => { setCreatedJob(null); resetForm(); }}
              >
                Add Another
              </Button>
            </div>
            <p className="text-xs text-zinc-400">
              Customer tracker:{" "}
              <a
                href={`/track/${createdJob.referenceNo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline font-mono"
              >
                /track/{createdJob.referenceNo}
              </a>
            </p>
          </div>
        ) : (
          /* ── Form ─────────────────────────────────────────── */
          <div className="divide-y divide-zinc-100">

            {/* ── Job Type ── */}
            <div className="px-6 py-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Job Type</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="chip-jobtype-standard"
                  onClick={() => handleJobTypeChange("standard")}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    !isRelocation
                      ? "bg-black text-white border-black"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <Wrench className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold">Installation / Service</div>
                    <div className={`text-xs mt-0.5 ${!isRelocation ? "text-zinc-300" : "text-zinc-400"}`}>Assembly, wall mounting, etc.</div>
                  </div>
                </button>
                <button
                  type="button"
                  data-testid="chip-jobtype-relocation"
                  onClick={() => handleJobTypeChange("relocation")}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    isRelocation
                      ? "bg-black text-white border-black"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold">Relocation / Moving</div>
                    <div className={`text-xs mt-0.5 ${isRelocation ? "text-zinc-300" : "text-zinc-400"}`}>Pickup → delivery, with/without D&R</div>
                  </div>
                </button>
              </div>
            </div>

            {/* ── AI Floor Plan / Photo Scan ── */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-500" /> Floor Plan / Photo Scan
                  <span className="ml-1 text-[10px] font-normal normal-case text-zinc-400">(optional — auto-fills items)</span>
                </p>
                {scanFile && (
                  <button
                    type="button"
                    onClick={() => setScanCollapsed(v => !v)}
                    className="text-xs text-zinc-400 hover:text-zinc-600 flex items-center gap-1"
                  >
                    {scanCollapsed ? <><ChevronDown className="w-3 h-3" /> Show</> : <><ChevronUp className="w-3 h-3" /> Hide</>}
                  </button>
                )}
              </div>

              {!scanFile && (
                <div
                  data-testid="scan-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFileSelect(file); }}
                  className="border-2 border-dashed border-zinc-200 rounded-xl p-6 text-center cursor-pointer hover:border-violet-300 hover:bg-violet-50/40 transition-all group"
                >
                  <Upload className="w-7 h-7 mx-auto mb-2 text-zinc-300 group-hover:text-violet-400 transition-colors" />
                  <p className="text-sm font-medium text-zinc-500 group-hover:text-violet-600">Upload floor plan, delivery order, or furniture photo</p>
                  <p className="text-xs text-zinc-400 mt-1">JPG, PNG, WEBP, PDF · Max 10 MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                    data-testid="input-scan-file"
                  />
                </div>
              )}

              {scanFile && !scanCollapsed && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {scanPreview ? (
                      <img src={scanPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-zinc-200 shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
                        <FileImage className="w-5 h-5 text-zinc-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-700 truncate">{scanFile.name}</p>
                      <p className="text-xs text-zinc-400">{(scanFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setScanFile(null); setScanPreview(null); setScanResult(null); setScanError(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {scanning && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 border border-violet-100 rounded-lg">
                      <div className="w-4 h-4 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin shrink-0" />
                      <span className="text-sm text-violet-700 font-medium">AI is analyzing your document…</span>
                    </div>
                  )}
                  {scanError && !scanning && (
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm text-red-700 font-medium">Scan failed</p>
                        <p className="text-xs text-red-500 mt-0.5">{scanError}</p>
                        <button type="button" onClick={() => doScan(scanFile)} className="text-xs text-red-600 underline mt-1">Retry</button>
                      </div>
                    </div>
                  )}
                  {scanResult && !scanning && (
                    <div className="border border-zinc-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                          <span className="text-xs font-semibold text-zinc-700">AI detected {scanResult.items.length} item{scanResult.items.length !== 1 ? "s" : ""}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CONFIDENCE_COLORS[scanResult.confidence]}`}>
                            {scanResult.confidence} confidence
                          </span>
                        </div>
                        <Button type="button" size="sm" data-testid="button-apply-scan" onClick={applyScanResult} className="h-7 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1">
                          <Plus className="w-3 h-3" /> Apply to Quote
                        </Button>
                      </div>
                      <div className="divide-y divide-zinc-50 max-h-48 overflow-y-auto">
                        {scanResult.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between px-4 py-2.5 text-sm">
                            <span className="text-zinc-700 flex-1 truncate">{item.name}</span>
                            <span className="text-zinc-400 text-xs mx-3 shrink-0">×{item.quantity}</span>
                            <span className="text-zinc-600 font-mono text-xs shrink-0">${item.unitPrice}</span>
                          </div>
                        ))}
                      </div>
                      {(scanResult.address || scanResult.notes) && (
                        <div className="px-4 py-2.5 bg-blue-50 border-t border-blue-100 space-y-1">
                          {scanResult.address && <p className="text-xs text-blue-700"><span className="font-semibold">Address: </span>{scanResult.address}</p>}
                          {scanResult.notes && <p className="text-xs text-blue-600"><span className="font-semibold">Notes: </span>{scanResult.notes}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {scanFile && scanCollapsed && scanResult && (
                <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 rounded-lg border border-violet-100">
                  <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="text-xs text-violet-700 font-medium">
                    {scanResult.items.length} AI items applied from <span className="font-semibold">{scanFile.name}</span>
                  </span>
                </div>
              )}
            </div>

            {/* ── Customer ── */}
            <Section icon={<User className="w-4 h-4 text-zinc-500" />} title="Customer">
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-zinc-500 mb-1.5 block">Name *</Label>
                    <Input
                      data-testid="input-customer-name"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="e.g. Ahmad bin Ismail"
                      className="h-9 text-sm border-zinc-300"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-500 mb-1.5 block">WhatsApp / Phone * (SG)</Label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 h-9 border border-r-0 border-zinc-300 rounded-l-md bg-zinc-50 text-sm text-zinc-500">+65</span>
                      <Input
                        data-testid="input-customer-phone"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                        placeholder="9123 4567"
                        className="h-9 text-sm border-zinc-300 rounded-l-none"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">
                    <Mail className="w-3 h-3 inline mr-1" />
                    Email (optional — for email confirmations)
                  </Label>
                  <Input
                    data-testid="input-customer-email"
                    type="email"
                    value={customerEmail}
                    onChange={e => setCustomerEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="h-9 text-sm border-zinc-300"
                  />
                </div>
              </div>
            </Section>

            {/* ── Address ── */}
            <Section icon={<MapPin className="w-4 h-4 text-zinc-500" />} title={isRelocation ? "Locations" : "Job Address"}>
              {isRelocation ? (
                <div className="space-y-4">
                  {/* Pickup */}
                  <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-blue-600">A</span>
                      </div>
                      <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Pick-up Address</span>
                    </div>
                    <div>
                      <Input
                        data-testid="input-service-address"
                        value={serviceAddress}
                        onChange={e => setServiceAddress(e.target.value)}
                        placeholder="Blk 123 Tampines St 86, #04-56, Singapore 520123"
                        className="h-9 text-sm border-zinc-300"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1.5 block">Floor / Unit</Label>
                        <Input
                          data-testid="input-pickup-floor"
                          value={pickupFloor}
                          onChange={e => setPickupFloor(e.target.value)}
                          placeholder="e.g. #04-56"
                          className="h-9 text-sm border-zinc-300"
                        />
                      </div>
                      <LiftToggle value={pickupLift} onChange={setPickupLift} label="Lift Available?" />
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-center">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <div className="h-px flex-1 bg-zinc-200 w-16" />
                      <ArrowRight className="w-4 h-4" />
                      <div className="h-px flex-1 bg-zinc-200 w-16" />
                    </div>
                  </div>

                  {/* Dropoff */}
                  <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-green-600">B</span>
                      </div>
                      <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Drop-off Address</span>
                    </div>
                    <div>
                      <Input
                        data-testid="input-dropoff-address"
                        value={dropoffAddress}
                        onChange={e => setDropoffAddress(e.target.value)}
                        placeholder="Blk 456 Jurong West Ave 3, #12-88, Singapore 640456"
                        className="h-9 text-sm border-zinc-300"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-zinc-500 mb-1.5 block">Floor / Unit</Label>
                        <Input
                          data-testid="input-dropoff-floor"
                          value={dropoffFloor}
                          onChange={e => setDropoffFloor(e.target.value)}
                          placeholder="e.g. #12-88"
                          className="h-9 text-sm border-zinc-300"
                        />
                      </div>
                      <LiftToggle value={dropoffLift} onChange={setDropoffLift} label="Lift Available?" />
                    </div>
                  </div>

                  {/* Relocation scope */}
                  <div>
                    <Label className="text-xs text-zinc-500 mb-2 block">Additional Services Included</Label>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        data-testid="chip-include-dismantle"
                        onClick={() => setIncludeDismantle(v => !v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          includeDismantle ? "bg-black text-white border-black" : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400"
                        }`}
                      >
                        Dismantle at pick-up
                      </button>
                      <button
                        type="button"
                        data-testid="chip-include-assembly"
                        onClick={() => setIncludeAssembly(v => !v)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          includeAssembly ? "bg-black text-white border-black" : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400"
                        }`}
                      >
                        Assembly at drop-off
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-zinc-500 mb-1.5 block">Service Address *</Label>
                    <Input
                      data-testid="input-service-address"
                      value={serviceAddress}
                      onChange={e => setServiceAddress(e.target.value)}
                      placeholder="Blk 123 Tampines St 86, #04-56, Singapore 520123"
                      className="h-9 text-sm border-zinc-300"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-500 mb-1.5 block">Services</Label>
                    <div className="flex flex-wrap gap-2">
                      {SERVICE_OPTIONS.map(s => (
                        <button
                          key={s}
                          type="button"
                          data-testid={`chip-service-${s.toLowerCase().replace(/\W/g, "-")}`}
                          onClick={() => toggleService(s)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            services.includes(s)
                              ? "bg-black text-white border-black"
                              : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Section>

            {/* ── Schedule ── */}
            <Section icon={<Calendar className="w-4 h-4 text-zinc-500" />} title="Schedule">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Date (optional)</Label>
                  <Input
                    data-testid="input-scheduled-date"
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="h-9 text-sm border-zinc-300"
                  />
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Time Window</Label>
                  <select
                    data-testid="select-time-window"
                    value={timeWindow}
                    onChange={e => setTimeWindow(e.target.value)}
                    disabled={!scheduledDate}
                    className="h-9 w-full px-3 border border-zinc-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-40"
                  >
                    {TIME_WINDOWS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            {/* ── Items & Pricing ── */}
            <Section icon={<Package className="w-4 h-4 text-zinc-500" />} title="Items & Pricing">
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2" data-testid={`item-row-${idx}`}>
                    <div className="relative flex-1">
                      {item.aiGenerated && (
                        <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-violet-400 pointer-events-none" />
                      )}
                      <Input
                        data-testid={`input-item-description-${idx}`}
                        value={item.description}
                        onChange={e => updateItem(item.id, "description", e.target.value)}
                        placeholder={isRelocation ? "e.g. 3-seater sofa relocation" : "e.g. IKEA Kallax shelf assembly"}
                        className={`h-9 text-sm border-zinc-300 ${item.aiGenerated ? "pl-8" : ""}`}
                      />
                    </div>
                    <Input
                      data-testid={`input-item-qty-${idx}`}
                      type="number" min={1}
                      value={item.quantity}
                      onChange={e => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                      className="h-9 w-16 text-sm border-zinc-300 text-center"
                    />
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                      <Input
                        data-testid={`input-item-price-${idx}`}
                        type="number" min={0} step={0.01}
                        value={item.unitPrice}
                        onChange={e => updateItem(item.id, "unitPrice", e.target.value)}
                        placeholder="0"
                        className="h-9 w-24 pl-6 text-sm border-zinc-300"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  data-testid="button-add-item"
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1 px-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add item
                </button>
              </div>

              {/* ── Promo Code ── */}
              <div className="mt-4 pt-3 border-t border-zinc-100">
                <Label className="text-xs text-zinc-500 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Promo Code (optional)
                </Label>
                {promoStatus === "valid" ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-green-700 font-mono">{promoCode}</span>
                      <span className="text-xs text-green-600 ml-2">{promoMessage}</span>
                    </div>
                    <button
                      type="button"
                      data-testid="button-remove-promo"
                      onClick={removePromoCode}
                      className="text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <Input
                        data-testid="input-promo-code"
                        value={promoInput}
                        onChange={e => { setPromoInput(e.target.value.toUpperCase()); if (promoStatus !== "idle") { setPromoStatus("idle"); setPromoMessage(""); } }}
                        onKeyDown={e => e.key === "Enter" && applyPromoCode()}
                        placeholder="e.g. TMG50"
                        className="h-9 text-sm border-zinc-300 font-mono uppercase flex-1"
                      />
                      <Button
                        type="button"
                        data-testid="button-apply-promo"
                        onClick={applyPromoCode}
                        disabled={!promoInput.trim() || promoStatus === "checking"}
                        className="h-9 px-4 text-sm bg-zinc-800 hover:bg-zinc-700 text-white shrink-0"
                      >
                        {promoStatus === "checking" ? (
                          <span className="flex items-center gap-1.5"><div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> Checking…</span>
                        ) : "Apply"}
                      </Button>
                    </div>
                    {promoStatus === "invalid" && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        {promoMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Pricing summary ── */}
              {(itemsTotal > 0 || promoDiscount > 0) && (
                <div className="mt-3 px-3 py-2.5 bg-zinc-50 rounded-lg border border-zinc-100 space-y-1 text-sm">
                  <div className="flex justify-between text-zinc-500">
                    <span>Subtotal</span>
                    <span className="font-mono">${itemsTotal.toFixed(2)}</span>
                  </div>
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Promo ({promoCode})</span>
                      <span className="font-mono">−${promoDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold text-zinc-900 pt-1 border-t border-zinc-200">
                    <span>Total</span>
                    <span className="font-mono">${calculatedTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* ── AI Pricing Coach ────────────────────────────────────────
                  Sanity-checks admin's quote against TMG catalog + SG market
                  benchmarks. Surfaces per-item delta, recommended total with
                  reasoning, competitor context, and one-click add-on chips. */}
              <div className="mt-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    data-testid="button-pricing-coach"
                    onClick={runPricingCoach}
                    disabled={coachLoading || items.every(i => !i.description.trim())}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-700 hover:to-blue-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {coachLoading ? "Analysing…" : coachResult ? "Re-run AI Coach" : "AI Pricing Coach"}
                  </button>
                  {coachResult && (
                    <button
                      type="button"
                      onClick={() => setCoachOpen(o => !o)}
                      className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 flex items-center gap-1"
                    >
                      {coachOpen ? <>Hide <ChevronUp className="w-3 h-3" /></> : <>Show <ChevronDown className="w-3 h-3" /></>}
                    </button>
                  )}
                </div>

                {coachOpen && (coachLoading || coachError || coachResult) && (
                  <div className="mt-2 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-blue-50 overflow-hidden" data-testid="pricing-coach-card">
                    {coachLoading && (
                      <div className="px-4 py-6 text-center">
                        <div className="inline-flex items-center gap-2 text-sm text-violet-700">
                          <div className="w-3 h-3 border-2 border-violet-300 border-t-violet-700 rounded-full animate-spin" />
                          Cross-checking catalog + SG market rates…
                        </div>
                      </div>
                    )}

                    {coachError && !coachLoading && (
                      <div className="px-4 py-3 flex items-start gap-2 text-sm text-red-700">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>{coachError}</div>
                      </div>
                    )}

                    {coachResult && !coachLoading && (
                      <div className="divide-y divide-violet-100">
                        {/* Headline */}
                        <div className="px-4 py-3 flex items-start gap-3">
                          <div className="shrink-0 w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-violet-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-wider text-violet-600 mb-0.5">
                              Recommendation · {coachResult.confidence} confidence
                            </p>
                            <p className="text-sm text-zinc-800 leading-snug">{coachResult.summary}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Suggested</p>
                            <p className="text-xl font-black text-violet-700 font-mono">S${coachResult.recommendedTotal.toFixed(0)}</p>
                            <button
                              type="button"
                              onClick={applyCoachTotal}
                              data-testid="button-apply-coach-total"
                              className="mt-1 text-[10px] font-bold text-violet-700 hover:text-violet-900 underline-offset-2 hover:underline"
                            >
                              Use this total →
                            </button>
                          </div>
                        </div>

                        {/* Per-item check */}
                        <div className="px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-2">Per-item check vs catalog</p>
                          <div className="space-y-1.5">
                            {coachResult.priceCheck.map((p, i) => {
                              const tone = p.verdict === "fair"     ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                        : p.verdict === "low"      ? "text-amber-700  bg-amber-50  border-amber-200"
                                        : p.verdict === "high"     ? "text-red-700    bg-red-50    border-red-200"
                                        :                            "text-zinc-500   bg-zinc-50   border-zinc-200";
                              const label = p.verdict === "fair" ? "fair" : p.verdict === "low" ? `under ${Math.abs(p.delta)}%` : p.verdict === "high" ? `over ${Math.abs(p.delta)}%` : "no catalog match";
                              return (
                                <div key={i} className="flex items-center justify-between gap-2 text-xs" data-testid={`coach-pricecheck-${i}`}>
                                  <div className="flex-1 min-w-0 truncate">
                                    <span className="font-semibold text-zinc-800">{p.name}</span>
                                    {p.catalogMatch && <span className="text-zinc-400"> · matched: {p.catalogMatch}</span>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono text-zinc-600">S${p.entered.toFixed(0)}</span>
                                    {p.catalog !== null && <span className="font-mono text-zinc-400">/ S${p.catalog.toFixed(0)}</span>}
                                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${tone}`}>{label}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Reasoning bullets */}
                        {coachResult.reasoning.length > 0 && (
                          <div className="px-4 py-3 bg-violet-50/40">
                            <p className="text-[10px] font-black uppercase tracking-wider text-violet-700 mb-1.5">Why this price</p>
                            <ul className="space-y-1">
                              {coachResult.reasoning.map((r, i) => (
                                <li key={i} className="text-xs text-zinc-700 leading-snug flex gap-1.5" data-testid={`coach-reason-${i}`}>
                                  <span className="text-violet-500 shrink-0">•</span>
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Competitor benchmarks */}
                        {coachResult.competitive.length > 0 && (
                          <div className="px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5">SG market context</p>
                            <div className="space-y-1.5">
                              {coachResult.competitive.map((c, i) => (
                                <div key={i} className="text-xs text-zinc-700 leading-snug" data-testid={`coach-competitor-${i}`}>
                                  <span className="font-semibold text-zinc-900">{c.competitor}:</span>{" "}
                                  <span className="font-mono text-zinc-600">{c.priceRange}</span>
                                  {c.note && <span className="text-zinc-500"> — {c.note}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Suggested add-ons */}
                        {coachResult.addOns.length > 0 && (
                          <div className="px-4 py-3 bg-blue-50/40">
                            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700 mb-1.5">Add-ons to mention</p>
                            <div className="flex flex-wrap gap-1.5">
                              {coachResult.addOns.map((a, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => addCoachAddOn(a.label, a.price)}
                                  data-testid={`button-coach-addon-${i}`}
                                  title={a.when}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-200 bg-white hover:bg-blue-50 text-[11px] text-blue-800 font-semibold transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  {a.label} · S${a.price.toFixed(0)}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-blue-600/70 mt-1.5">Click any chip to append it as a line item.</p>
                          </div>
                        )}

                        {coachResult.meta && (
                          <div className="px-4 py-2 text-[10px] text-zinc-400 flex items-center justify-between bg-white/50">
                            <span>{coachResult.meta.model} · {coachResult.meta.latencyMs}ms · S${coachResult.meta.costSgd.toFixed(4)} · {coachResult.meta.catalogMatchesFound} catalog rows considered</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">
                    Override Total (S$)
                    {calculatedTotal > 0 && <span className="ml-1 text-zinc-400">auto: ${calculatedTotal.toFixed(2)}</span>}
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                    <Input
                      data-testid="input-total"
                      type="number" min={0} step={0.01}
                      value={manualTotal}
                      onChange={e => setManualTotal(e.target.value)}
                      placeholder={calculatedTotal > 0 ? calculatedTotal.toFixed(2) : "0.00"}
                      className="h-9 pl-6 text-sm border-zinc-300"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Deposit Amount (S$)</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400">$</span>
                    <Input
                      data-testid="input-deposit-amount"
                      type="number" min={0} step={0.01}
                      value={depositAmountInput}
                      onChange={e => setDepositAmountInput(e.target.value)}
                      placeholder="0.00"
                      className="h-9 pl-6 text-sm border-zinc-300"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Payment Status</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {PAYMENT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        data-testid={`chip-payment-${opt.value}`}
                        onClick={() => setPaymentStatus(opt.value)}
                        className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          paymentStatus === opt.value
                            ? "bg-black text-white border-black"
                            : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Staff Assignment ── */}
            <Section icon={<User className="w-4 h-4 text-zinc-500" />} title="Staff Assignment">
              <div>
                <Label className="text-xs text-zinc-500 mb-1.5 block">Assign to (optional)</Label>
                <select
                  data-testid="select-staff"
                  value={assignedStaffId}
                  onChange={e => setAssignedStaffId(e.target.value)}
                  className="h-9 w-full sm:max-w-xs px-3 border border-zinc-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Unassigned —</option>
                  {staff.filter(s => s.role === "staff" || s.role === "admin").map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </Section>

            {/* ── Source & Notes ── */}
            <Section icon={<Clock className="w-4 h-4 text-zinc-500" />} title="Source & Notes">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">How did this job come in?</Label>
                  <div className="flex flex-wrap gap-2">
                    {SOURCE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        data-testid={`chip-source-${opt.value}`}
                        onClick={() => setSourceChannel(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          sourceChannel === opt.value
                            ? "bg-black text-white border-black"
                            : "bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-zinc-500 mb-1.5 block">Internal notes (optional)</Label>
                  <Textarea
                    data-testid="input-notes"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder={isRelocation
                      ? "e.g. Fragile antique furniture, wrap carefully. Customer will be present."
                      : "e.g. Customer prefers morning, has lift access, 3rd floor..."}
                    className="text-sm border-zinc-300 resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </Section>

            {/* ── Footer ── */}
            <div className="px-6 py-4 flex items-center justify-between gap-3 bg-zinc-50/60 rounded-b-xl">
              <button
                type="button"
                onClick={handleClose}
                className="text-sm text-zinc-500 hover:text-zinc-700 font-medium"
              >
                Cancel
              </button>
              <Button
                data-testid="button-create-job"
                onClick={handleSubmit}
                disabled={createJob.isPending}
                className="bg-black hover:bg-zinc-800 text-white text-sm px-6 gap-2"
              >
                {createJob.isPending ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
                ) : (
                  <><Plus className="w-4 h-4" /> Create {isRelocation ? "Relocation" : "Job"}</>
                )}
              </Button>
            </div>

          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
