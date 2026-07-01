import { useParams, Link } from "wouter";
import { useQuote, useStaffArrived, useStaffCompleted, useStaffStage, useStaffSiteClock } from "@/hooks/use-quotes";
import { computeSiteTime, type SiteVisit } from "@shared/pricing";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft, CheckCircle2, X, Loader2, Clock, Package, User, CalendarDays,
  Upload, AlertTriangle, ZoomIn, ImagePlus, Navigation2, MapPin, Radio, ListChecks, Square, SquareCheck, Truck,
  PenLine, RotateCcw, LogIn, LogOut, Timer,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useBackgroundLocation } from "@/hooks/use-background-location";
import { groupStops, itemRouteLabel } from "@/lib/stops";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

// ── Checklists ─────────────────────────────────────────────────────────────
const INSTALL_CHECKLIST = [
  "Verify customer name & job reference",
  "Confirm items list with customer",
  "Unbox and inspect all items for damage",
  "Complete installation / assembly",
  "Clean up packaging & work area",
  "Walk-through completed with customer",
  "Customer confirms satisfaction",
];

const RELOCATION_PICKUP_CHECKLIST = [
  "Verify customer name & job reference",
  "Floor protection laid at pickup",
  "All items photographed before moving (condition record)",
  "Items wrapped / padded as needed",
  "Lift padded (if applicable)",
  "All items loaded into vehicle",
];

const RELOCATION_DROPOFF_CHECKLIST = [
  "Floor protection laid at dropoff",
  "Items unloaded & placed as per customer instruction",
  "Reinstalled / reassembled where applicable",
  "Packaging removed / disposed",
  "Walk-through completed with customer",
  "Customer confirms satisfaction",
];

async function captureGPS(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Geolocation not supported")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(`Location unavailable: ${err.message}`)),
      { timeout: 20000, enableHighAccuracy: true, maximumAge: 0 }
    );
  });
}

async function compressToDataUrl(file: File, maxPx = 1024, quality = 0.72): Promise<string> {
  // Prefer createImageBitmap when available — it handles HEIC on iOS Safari
  // and decodes off the main thread, avoiding the hangs we saw with <img>.
  const renderFromBitmap = async (): Promise<string> => {
    // @ts-ignore — createImageBitmap exists on all modern mobile browsers
    const bitmap: ImageBitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxPx / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const out = canvas.toDataURL("image/jpeg", quality);
    if (!out || out.length < 100) throw new Error("Empty image output");
    return out;
  };

  const renderFromImageEl = (): Promise<string> => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("Photo decode timed out — try a different photo (HEIC may not be supported)"));
    }, 12000);
    img.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas 2D context unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", quality);
        if (!out || out.length < 100) return reject(new Error("Empty image output"));
        resolve(out);
      } catch (e: any) {
        reject(e);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode photo (unsupported format?)"));
    };
    img.src = url;
  });

  if (typeof (window as any).createImageBitmap === "function") {
    try { return await renderFromBitmap(); } catch { /* fall through to <img> path */ }
  }
  return renderFromImageEl();
}

// ── Status step models ─────────────────────────────────────────────────────
const INSTALL_STEPS = [
  { key: "booked", label: "Booked" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

const RELOCATION_STEPS_FULL = [
  { key: "assigned", label: "Assigned" },
  { key: "at_pickup", label: "Pickup Photo" },
  { key: "at_dropoff", label: "Dropoff Photo" },
  { key: "completed", label: "Done" },
];

const RELOCATION_STEPS_SAMEPROP = [
  { key: "assigned", label: "Assigned" },
  { key: "at_pickup", label: "On Site" },
  { key: "at_dropoff", label: "Placing" },
  { key: "completed", label: "Done" },
];

function getStepIndex(steps: { key: string }[], status: string) {
  // Treat post-completion lifecycle statuses as "completed" for the bar
  if (["final_payment_requested", "final_paid", "closed"].includes(status)) {
    return steps.length - 1;
  }
  const idx = steps.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

// Detect if a job is a relocation vs installation
function isRelocationJob(job: any): boolean {
  if (!job) return false;
  const items: any[] = job.items || [];
  if (items.some((i: any) => i.serviceType === 'relocate')) return true;
  // A non-empty pickup OR dropoff address only ever exists on relocation jobs —
  // installation/dismantle jobs never set one. This reliably catches
  // admin/WhatsApp-created moves whose line items are generic ("manual") and
  // which may not always have BOTH addresses filled in.
  if (job.pickupAddress && String(job.pickupAddress).trim()) return true;
  if (job.dropoffAddress && String(job.dropoffAddress).trim()) return true;
  // Admin/WhatsApp jobs also flag the move via selectedServices (e.g. "Relocation").
  let services: any = job.selectedServices;
  if (typeof services === 'string') {
    try { services = JSON.parse(services); } catch { services = []; }
  }
  if (Array.isArray(services) && services.some((s: any) => typeof s === 'string' && s.toLowerCase().includes('relocat'))) {
    return true;
  }
  return false;
}

function normalizeAddr(s?: string | null): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.,]/g, '');
}

function isSameProperty(job: any): boolean {
  const a = normalizeAddr(job?.pickupAddress);
  const b = normalizeAddr(job?.dropoffAddress);
  return !!a && a === b;
}

// What action button (if any) should be shown for the current status
type Action =
  | { kind: 'install_arrive' }
  | { kind: 'install_complete' }
  | { kind: 'stage_at_pickup' }
  | { kind: 'stage_at_dropoff' }
  | { kind: 'stage_completed' };

function nextAction(job: any): Action | null {
  if (!job) return null;
  // A job assigned at admin/WhatsApp creation (or a pre-assigned quote that was
  // auto-booked on deposit) can sit at status "booked" with a staff/team already
  // attached. Such a job is ready to be worked, so we treat "booked" the same as
  // "assigned" — but only when there IS an assignment, otherwise the crew is
  // genuinely still waiting for the admin to assign someone.
  const assigned = !!(job.assignedStaffId || job.assignedTeamId);
  const relocation = isRelocationJob(job);
  if (relocation) {
    switch (job.status) {
      case 'booked':      return assigned ? { kind: 'stage_at_pickup' } : null;
      case 'assigned':    return { kind: 'stage_at_pickup' };
      case 'at_pickup':   return { kind: 'stage_at_dropoff' };
      // Legacy: any quote already at 'in_transit' from the old flow
      // jumps straight to the dropoff photo step.
      case 'in_transit':  return { kind: 'stage_at_dropoff' };
      case 'at_dropoff':  return { kind: 'stage_completed' };
      default: return null;
    }
  }
  switch (job.status) {
    case 'booked':      return assigned ? { kind: 'install_arrive' } : null;
    case 'assigned':    return { kind: 'install_arrive' };
    case 'in_progress': return { kind: 'install_complete' };
    default: return null;
  }
}

interface ActionMeta {
  title: string;
  subtitle: string;
  buttonLabel: string;
  notePlaceholder: string;
  gradientFrom: string;
  gradientTo: string;
  shadowColor: string;
}

function metaFor(action: Action): ActionMeta {
  switch (action.kind) {
    case 'install_arrive':
      return {
        title: '📍 Arrived Check-In',
        subtitle: 'Confirm you have arrived at the location',
        buttonLabel: 'Confirm Arrived',
        notePlaceholder: 'Access issues, parking notes…',
        gradientFrom: 'from-blue-500', gradientTo: 'to-blue-600', shadowColor: 'shadow-blue-500/25',
      };
    case 'install_complete':
      return {
        title: '✅ Job Completion',
        subtitle: 'Submit proof of job completion',
        buttonLabel: 'Confirm Job Completed',
        notePlaceholder: 'Completion notes, any issues encountered…',
        gradientFrom: 'from-emerald-500', gradientTo: 'to-emerald-600', shadowColor: 'shadow-emerald-500/25',
      };
    case 'stage_at_pickup':
      return {
        title: '📸 Pickup Photo',
        subtitle: 'Photograph items at the pickup location — protects against damage claims',
        buttonLabel: 'Submit Pickup Photo',
        notePlaceholder: 'Access, lift booking, pre-existing damage notes…',
        gradientFrom: 'from-sky-500', gradientTo: 'to-sky-600', shadowColor: 'shadow-sky-500/25',
      };
    case 'stage_at_dropoff':
      return {
        title: '📸 Dropoff Photo',
        subtitle: 'Photograph items delivered at the dropoff location',
        buttonLabel: 'Submit Dropoff Photo',
        notePlaceholder: 'Access, lift, floor condition notes…',
        gradientFrom: 'from-fuchsia-500', gradientTo: 'to-fuchsia-600', shadowColor: 'shadow-fuchsia-500/25',
      };
    case 'stage_completed':
      return {
        title: '✅ Job Completion',
        subtitle: 'Photograph items placed as agreed — final proof',
        buttonLabel: 'Confirm Job Completed',
        notePlaceholder: 'Placement notes, customer feedback…',
        gradientFrom: 'from-emerald-500', gradientTo: 'to-emerald-600', shadowColor: 'shadow-emerald-500/25',
      };
  }
}

// ── Customer signature pad ───────────────────────────────────────────────────
// A lightweight canvas-based signature capture. The customer signs with a
// finger (touch) or mouse on the staff member's device. Every stroke is drawn
// onto a backing canvas and, on each change, exported to a PNG data URL which
// the parent stores and submits with the job completion.
function SignaturePad({ value, onChange }: { value: string | null; onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Size the canvas backing store to its rendered size (accounting for device
  // pixel ratio) so the signature stays crisp on high-density screens.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0A0A0A";
    }
  }, []);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pointFromEvent(e);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !last.current) return;
    const p = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasInk.current = true;
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    const canvas = canvasRef.current;
    if (canvas && hasInk.current) {
      onChange(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    hasInk.current = false;
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-border bg-background overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full h-40 touch-none block cursor-crosshair"
          data-testid="canvas-signature"
        />
        {!value && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold text-muted-foreground">Sign here</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[11px] text-muted-foreground">
          {value ? "Signed ✓" : "Customer signs above"}
        </span>
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
          data-testid="button-clear-signature"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const { data: job, isLoading, isFetching, refetch } = useQuote(id!);
  const arrivedMutation = useStaffArrived();
  const completedMutation = useStaffCompleted();
  const stageMutation = useStaffStage();
  const siteClockMutation = useStaffSiteClock();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isTracking, startTracking, stopTracking } = useBackgroundLocation();

  const [photos, setPhotos] = useState<{ file: File; dataUrl: string }[]>([]);
  const [photoProcessing, setPhotoProcessing] = useState<number>(0);
  const [note, setNote] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [customerSignName, setCustomerSignName] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single combined checklist for the job. The UI splits it into "Pickup"
  // and "Dropoff" sections (for relocation) by filtering the label arrays.
  const { data: checklistData } = useQuery<{ checkItems: string[] }>({
    queryKey: [`/api/staff/jobs/${id}/checklist`],
    enabled: !!id,
  });
  const checkedItems: string[] = checklistData?.checkItems ?? [];

  const updateChecklist = useMutation({
    mutationFn: (items: string[]) =>
      apiRequest("PATCH", `/api/staff/jobs/${id}/checklist`, { checkItems: items }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/staff/jobs/${id}/checklist`] }),
  });

  const toggleCheckItem = (label: string) => {
    const next = checkedItems.includes(label)
      ? checkedItems.filter(l => l !== label)
      : [...checkedItems, label];
    updateChecklist.mutate(next);
  };

  // Auto-capture GPS silently as soon as action panel opens
  useEffect(() => {
    if (!pendingAction) return;
    setGpsStatus('loading');
    setGpsCoords(null);
    captureGPS()
      .then(coords => {
        setGpsCoords(coords);
        setGpsStatus('ok');
      })
      .catch(() => {
        setGpsStatus('error');
      });
  }, [pendingAction]);

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading job details…</p>
      </div>
    </div>
  );
  if (!job) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center px-6">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <p className="font-bold text-slate-800 mb-1">Job not found</p>
        <p className="text-sm text-slate-500 mb-4">This job may still be loading. Try refreshing.</p>
        <button
          onClick={() => { queryClient.invalidateQueries({ queryKey: ['/api/quotes/:id'] }); refetch(); }}
          disabled={isFetching}
          className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg mb-4 disabled:opacity-60"
          data-testid="button-retry-job"
        >
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isFetching ? "Retrying…" : "Retry"}
        </button>
        <br />
        <Link href="/staff" className="text-primary text-sm underline">← Back to Home</Link>
      </div>
    </div>
  );

  const relocation = isRelocationJob(job);
  const sameProp = isSameProperty(job);
  // Multi-stop relocation: only treat as multi-stop when there are >2 stops.
  // 0–2 stops fall back to the legacy pickup/drop-off block (see lib/stops.ts).
  const groupedStops = groupStops((job as any).stops);
  const isMultiStop = groupedStops.all.length > 2;
  const steps = relocation
    ? (sameProp ? RELOCATION_STEPS_SAMEPROP : RELOCATION_STEPS_FULL)
    : INSTALL_STEPS;
  const stepIdx = getStepIndex(steps, job.status);
  const isDone = ["completed", "final_payment_requested", "final_paid", "closed"].includes(job.status);
  const action = pendingAction ?? nextAction(job);
  const showChecklistSection = relocation
    ? ['at_pickup', 'at_dropoff', 'completed'].includes(job.status)
    : ['in_progress', 'completed'].includes(job.status);

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length === 0) return;
    setPhotoProcessing(files.length);
    let failures = 0;
    for (const file of files) {
      try {
        const dataUrl = await compressToDataUrl(file);
        setPhotos(prev => [...prev, { file, dataUrl }]);
      } catch (err: any) {
        failures += 1;
        console.error('[photo] compress failed', file.name, file.type, file.size, err);
        toast({
          title: "Photo Error",
          description: err?.message || `Could not process ${file.name}. Try a JPEG/PNG.`,
          variant: "destructive",
        });
      } finally {
        setPhotoProcessing(p => Math.max(0, p - 1));
      }
    }
    if (failures === 0 && files.length > 0) {
      toast({ title: "✓ Photos added", description: `${files.length} photo${files.length !== 1 ? 's' : ''} ready to upload.` });
    }
  };

  const handleRemovePhoto = (i: number) => setPhotos(prev => prev.filter((_, idx) => idx !== i));

  const closeModal = () => {
    setPendingAction(null);
    setPhotos([]);
    setPhotoProcessing(0);
    setGpsCoords(null);
    setGpsStatus('idle');
    setNote("");
    setSignatureDataUrl(null);
    setCustomerSignName("");
  };

  const openAction = (a: Action) => {
    setPendingAction(a);
  };

  const submitAction = async () => {
    if (!action) return;

    if (photoProcessing > 0) {
      toast({ title: "Still processing photos…", description: `${photoProcessing} photo${photoProcessing !== 1 ? 's' : ''} still being prepared. Please wait.` });
      return;
    }

    if (photos.length === 0) {
      toast({ title: "Photo Required", description: "Please take at least one photo.", variant: "destructive" });
      return;
    }

    // Guard against payloads that would be rejected by the server (15MB body limit).
    const approxBytes = photos.reduce((sum, p) => sum + Math.floor(p.dataUrl.length * 0.75), 0)
      + (signatureDataUrl ? Math.floor(signatureDataUrl.length * 0.75) : 0);
    if (approxBytes > 12 * 1024 * 1024) {
      toast({
        title: "Too many photos",
        description: `Your photos total ~${Math.round(approxBytes / 1024 / 1024)}MB. Please remove some and try again.`,
        variant: "destructive",
      });
      return;
    }

    const isCompletion = action.kind === 'install_complete' || action.kind === 'stage_completed';
    if (isCompletion) {
      if (!customerSignName.trim()) {
        toast({ title: "Customer Name Required", description: "Please enter the name of the person signing.", variant: "destructive" });
        return;
      }
      if (!signatureDataUrl) {
        toast({ title: "Signature Required", description: "Please ask the customer to sign before completing.", variant: "destructive" });
        return;
      }
    }

    if (gpsStatus === 'loading') {
      toast({ title: "Getting Location…", description: "Please wait a moment." });
      return;
    }

    let coords = gpsCoords;
    if (!coords) {
      try {
        setGpsStatus('loading');
        coords = await captureGPS();
        setGpsCoords(coords);
        setGpsStatus('ok');
      } catch {
        setGpsStatus('error');
        toast({ title: "Location Required", description: "Please enable location services and try again.", variant: "destructive" });
        return;
      }
    }

    const photoUrls = photos.map(p => p.dataUrl);
    const payload = { id: id!, gpsLat: coords.lat, gpsLng: coords.lng, photoUrls, note: note || undefined };
    const ack = { signatureDataUrl: signatureDataUrl || undefined, customerName: customerSignName.trim() || undefined };

    try {
      switch (action.kind) {
        case 'install_arrive':
          await arrivedMutation.mutateAsync(payload);
          if (user?.id) startTracking(user.id).catch(() => {});
          toast({ title: "✓ Checked In", description: "Arrival recorded. Location tracking started." });
          break;
        case 'install_complete':
          await completedMutation.mutateAsync({ ...payload, ...ack });
          stopTracking().catch(() => {});
          toast({ title: "✓ Job Completed", description: "Completion submitted. Location tracking stopped." });
          break;
        case 'stage_at_pickup':
          await stageMutation.mutateAsync({ ...payload, stage: 'at_pickup' });
          if (user?.id) startTracking(user.id).catch(() => {});
          toast({ title: "✓ Pickup Photo Submitted", description: "Pickup recorded." });
          break;
        case 'stage_at_dropoff':
          await stageMutation.mutateAsync({ ...payload, stage: 'at_dropoff' });
          toast({ title: "✓ Dropoff Photo Submitted", description: "Dropoff recorded." });
          break;
        case 'stage_completed':
          await stageMutation.mutateAsync({ ...payload, ...ack, stage: 'completed' });
          stopTracking().catch(() => {});
          toast({ title: "✓ Job Completed", description: "Completion submitted. Location tracking stopped." });
          break;
      }
      closeModal();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const isPending =
    arrivedMutation.isPending || completedMutation.isPending || stageMutation.isPending;

  const actionMeta = action ? metaFor(action) : null;
  const isAtDropoffOrCompleted = relocation && ['at_dropoff', 'completed'].includes(job.status);

  // On-Site Time Clock state. Sessions are stored on the quote; the system
  // groups them by Singapore day and auto-fills Second-Day Continuation hours.
  const siteVisits = (job.siteVisits as SiteVisit[] | undefined) || [];
  const siteSummary = computeSiteTime(siteVisits);
  const onSite = siteSummary.hasOpenVisit;
  const fmtTime = (iso: string) => format(new Date(iso), "h:mma");

  // Photos shared with the crew: the customer's submitted reference photo plus
  // every photo already uploaded against this job (e.g. the morning dismantle
  // shots, visible when the crew returns to reinstall). Pricing is never shown.
  const customerPhoto: string | null = (job as any).detectionPhotoUrl || null;
  const jobUpdatePhotos: string[] = (((job as any).updates as any[]) || [])
    .flatMap((u: any) => {
      const raw = u?.photoUrl;
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      const s = String(raw);
      if (s.trim().startsWith("[")) {
        try { return JSON.parse(s); } catch { return []; }
      }
      return [s];
    })
    .filter((x: any) => typeof x === "string" && x.length > 0);
  const sharedPhotoCount = (customerPhoto ? 1 : 0) + jobUpdatePhotos.length;

  // Split-job pause state: off site, but at least one session is already closed
  // and the job isn't finished — i.e. the crew has stepped away mid-job and will
  // return (e.g. dismantle done in the morning, reinstall later the same day).
  const hasClosedSession = siteVisits.some((v: any) => v?.arrivedAt && v?.leftAt);
  const isPausedMidJob = !onSite && hasClosedSession && !isDone;

  const handleSiteClock = (action: 'arrive' | 'leave') => {
    siteClockMutation.mutate(
      { id: job.id, action },
      {
        onSuccess: () => toast({
          title: action === 'arrive' ? "Checked in on site" : "Checked out — off site",
          description: action === 'arrive'
            ? "Your on-site time is now being tracked."
            : "Your on-site hours have been recorded.",
        }),
        onError: (err: any) => toast({
          title: "Could not update on-site time",
          description: err?.message || "Please try again.",
          variant: "destructive",
        }),
      },
    );
  };

  return (
    <div className="min-h-screen bg-secondary/20 pb-36">

      {/* Photo preview modal */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setPreviewPhoto(null)}>
          <img src={previewPhoto} alt="Preview" className="max-w-full max-h-full object-contain rounded-xl" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pt-20 space-y-4">

        {/* Back */}
        <Link href="/staff" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        {/* Job header card */}
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          {/* Header gradient */}
          <div className="px-5 py-4 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={job.status} />
                  {relocation && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-white bg-white/10 px-2 py-0.5 rounded">
                      <Truck className="w-3 h-3" /> {sameProp ? 'Same-Property Move' : 'Relocation'}
                    </span>
                  )}
                </div>
                <span className="text-white/60 text-xs font-mono font-bold">{job.referenceNo}</span>
              </div>
              <h1 className="text-xl font-black text-white leading-tight">{job.ggv?.jobNo || job.customer?.name}</h1>
              {job.scheduledAt && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-white/50" />
                  <span className="text-white/70 text-sm font-semibold">
                    {format(new Date(job.scheduledAt), "EEE, d MMM yyyy")}
                    {job.timeWindow && ` · ${job.timeWindow}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Progress steps */}
          <div className="px-5 py-3 bg-secondary/30 border-b">
            <div className="flex items-center justify-between">
              {steps.map((step, i) => (
                <div key={step.key} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      i < stepIdx
                        ? "bg-emerald-500 text-white"
                        : i === stepIdx
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-border text-muted-foreground"
                    }`}>
                      {i < stepIdx ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="text-[10px] font-black">{i + 1}</span>}
                    </div>
                    <span className={`text-[9px] font-bold mt-1 ${i === stepIdx ? "text-primary" : i < stepIdx ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 transition-colors ${i < stepIdx ? "bg-emerald-400" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Job details */}
          <div className="px-5 py-4 space-y-3">
            {!relocation && job.serviceAddress && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide mb-0.5">Service Address</p>
                  <p className="text-sm font-semibold">{job.serviceAddress}</p>
                </div>
              </div>
            )}
            {relocation && isMultiStop && (
              <div className="space-y-2">
                {groupedStops.all.map((s, idx) => {
                  const isPickup = s.kind === "pickup";
                  return (
                    <div key={s.id} className="flex items-start gap-2.5" data-testid={`stop-${s.id}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${
                        isPickup ? 'bg-sky-500 text-white' : 'bg-fuchsia-500 text-white'
                      }`}>{s.label.replace(/^Pickup\s/, "P").replace(/^Drop-off\s/, "")}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide mb-0.5">{s.label}</p>
                        <p className="text-sm font-semibold" data-testid={`text-stop-address-${s.id}`}>
                          {s.address}
                          {s.floor ? `, ${s.floor}` : ""}
                          {s.hasLift === false ? " (no lift)" : ""}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {relocation && !isMultiStop && (job.pickupAddress || job.dropoffAddress) && (
              <div className="space-y-2">
                {job.pickupAddress && (
                  <div className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${
                      ['at_pickup'].includes(job.status) ? 'bg-sky-500 text-white' :
                      ['at_dropoff', 'completed', 'final_payment_requested', 'final_paid', 'closed'].includes(job.status) ? 'bg-emerald-500 text-white' :
                      'bg-secondary text-muted-foreground'
                    }`}>A</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide mb-0.5">Pickup</p>
                      <p className="text-sm font-semibold">{job.pickupAddress}</p>
                    </div>
                  </div>
                )}
                {!sameProp && job.dropoffAddress && (
                  <div className="flex items-start gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black ${
                      ['at_dropoff'].includes(job.status) ? 'bg-fuchsia-500 text-white' :
                      ['completed', 'final_payment_requested', 'final_paid', 'closed'].includes(job.status) ? 'bg-emerald-500 text-white' :
                      'bg-secondary text-muted-foreground'
                    }`}>B</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide mb-0.5">Dropoff</p>
                      <p className="text-sm font-semibold">{job.dropoffAddress}</p>
                    </div>
                  </div>
                )}
                {sameProp && (
                  <p className="text-xs text-muted-foreground font-semibold pl-9">↳ Same property — no transit between addresses</p>
                )}
              </div>
            )}
            {!relocation && (job.pickupAddress || job.dropoffAddress) && (
              <div className="flex items-start gap-2.5">
                <Navigation2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  {job.pickupAddress && <p className="text-sm"><span className="font-bold text-muted-foreground text-xs">Pickup: </span>{job.pickupAddress}</p>}
                  {job.dropoffAddress && <p className="text-sm"><span className="font-bold text-muted-foreground text-xs">Dropoff: </span>{job.dropoffAddress}</p>}
                </div>
              </div>
            )}
            {job.customer?.phone && !job.ggv && (
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide mb-0.5">Customer</p>
                  <p className="text-sm font-semibold">{job.customer.name} · {job.customer.phone}</p>
                </div>
              </div>
            )}
            {job.ggv && (
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide mb-0.5">GoGoVan Job</p>
                  <p className="text-sm font-semibold">
                    {job.ggv.jobNo || "—"}
                    {job.ggv.serviceType ? ` · ${job.ggv.serviceType}` : ""}
                  </p>
                  {job.ggv.remarks && <p className="text-[13px] font-semibold text-foreground/90 mt-0.5 leading-snug break-words">{job.ggv.remarks}</p>}
                  <p className="text-base font-black text-emerald-700 mt-0.5">
                    ${Number(job.ggv.actualPrice || 0).toFixed(2)}
                    <span className="text-[11px] font-semibold text-muted-foreground ml-1.5">paid via GoGoVan</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Photos shared with the crew (customer reference + prior job photos) */}
        {sharedPhotoCount > 0 && (
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b bg-secondary/30 flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-muted-foreground" />
              <p className="font-black text-sm">Photos for This Job</p>
              <span className="ml-auto text-xs text-muted-foreground font-semibold">
                {sharedPhotoCount} photo{sharedPhotoCount !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="px-5 py-4 space-y-4">
              {customerPhoto && (
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide mb-2">From Customer</p>
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(customerPhoto)}
                    className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-border group"
                    data-testid="img-customer-photo"
                  >
                    <img src={customerPhoto} alt="Customer submitted" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                </div>
              )}
              {jobUpdatePhotos.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide mb-2">Job Photos</p>
                  <div className="flex flex-wrap gap-2">
                    {jobUpdatePhotos.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPreviewPhoto(url)}
                        className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-border group"
                        data-testid={`img-job-photo-${i}`}
                      >
                        <img src={url} alt={`Job photo ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ZoomIn className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* On-Site Time Clock */}
        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b bg-secondary/30 flex items-center gap-2">
            <Timer className="w-4 h-4 text-muted-foreground" />
            <p className="font-black text-sm">On-Site Time</p>
            {onSite && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                <Radio className="w-3 h-3" /> On site now
              </span>
            )}
          </div>
          <div className="px-5 py-4 space-y-4">
            <button
              type="button"
              onClick={() => handleSiteClock(onSite ? 'leave' : 'arrive')}
              disabled={siteClockMutation.isPending}
              data-testid="button-site-clock"
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm uppercase tracking-wide transition-colors disabled:opacity-60 ${
                onSite
                  ? 'bg-rose-600 text-white hover:bg-rose-700'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {siteClockMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : onSite ? (
                <><LogOut className="w-5 h-5" /> Going Off Site</>
              ) : (
                <><LogIn className="w-5 h-5" /> Arrived On Site</>
              )}
            </button>

            {isPausedMidJob && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-start gap-2">
                <RotateCcw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 leading-snug">
                  Paused — you're off site. When you come back (for example, to reinstall later today), tap <strong>Arrived On Site</strong> and your return is recorded as a new session.
                </p>
              </div>
            )}
            {onSite && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 flex items-start gap-2">
                <Timer className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 leading-snug">
                  Need to split the job (e.g. dismantle now, reinstall later)? Tap <strong>Going Off Site</strong> to pause — you can clock back in when you return.
                </p>
              </div>
            )}

            {siteSummary.days.length > 0 ? (
              <div className="space-y-3">
                {siteSummary.days.map((day) => (
                  <div key={day.date} className="rounded-xl border bg-secondary/20 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-black uppercase tracking-wide">
                        Day {day.dayNumber}
                        <span className="ml-1.5 text-muted-foreground font-bold normal-case">{day.label}</span>
                      </p>
                      <span className="text-xs font-black" data-testid={`text-site-day-hours-${day.dayNumber}`}>
                        {day.hours.toFixed(2)}h
                      </span>
                    </div>
                    <div className="space-y-1">
                      {day.visits.map((v, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {fmtTime(v.arrivedAt)} – {v.open ? <span className="text-emerald-600 font-black">on site now</span> : fmtTime(v.leftAt!)}
                          </span>
                          {!v.open && <span className="font-bold">{v.hours.toFixed(2)}h</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {siteSummary.spansMultipleDays && (
                  <p className="text-[11px] font-semibold text-muted-foreground leading-snug">
                    This job spans more than one day. The {siteSummary.secondDayHours.toFixed(2)}h after Day 1
                    have been added automatically as Second-Day Continuation on the quote.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs font-semibold text-muted-foreground text-center">
                Tap "Arrived On Site" when you start work. Your hours are tracked automatically.
              </p>
            )}
          </div>
        </div>

        {/* Items */}
        {job.items && job.items.length > 0 && (
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b bg-secondary/30 flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <p className="font-black text-sm">Items to Handle ({job.items.length})</p>
            </div>
            <div className="divide-y">
              {job.items.map((item: any, i: number) => (
                <div key={item.id ?? i} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-black text-primary">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm leading-tight">{item.detectedName || item.originalDescription}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.serviceType}</p>
                    {isMultiStop && itemRouteLabel((job as any).stops, item.fromStopId, item.toStopId) && (
                      <p className="text-xs font-bold text-primary mt-0.5" data-testid={`text-item-route-${item.id ?? i}`}>
                        {itemRouteLabel((job as any).stops, item.fromStopId, item.toStopId)}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black">×{item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Checklist(s) — shown when the job is in progress */}
        {showChecklistSection && relocation && (() => {
          const pickupChecked = RELOCATION_PICKUP_CHECKLIST.filter(l => checkedItems.includes(l)).length;
          const dropoffChecked = RELOCATION_DROPOFF_CHECKLIST.filter(l => checkedItems.includes(l)).length;
          return (
            <>
              {/* Pickup checklist */}
              <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-sky-500" />
                    <p className="font-black text-sm">Pickup Checklist</p>
                  </div>
                  <span className="text-xs text-muted-foreground font-semibold">
                    {pickupChecked}/{RELOCATION_PICKUP_CHECKLIST.length} done
                  </span>
                </div>
                <div className="divide-y">
                  {RELOCATION_PICKUP_CHECKLIST.map((item, i) => {
                    const checked = checkedItems.includes(item);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleCheckItem(item)}
                        disabled={job.status === "completed" || updateChecklist.isPending}
                        data-testid={`checklist-pickup-${i}`}
                        className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors ${
                          checked ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "hover:bg-secondary/30"
                        } disabled:opacity-60`}
                      >
                        {checked
                          ? <SquareCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                          : <Square className="w-5 h-5 text-muted-foreground shrink-0" />}
                        <span className={`text-sm font-semibold leading-snug ${checked ? "line-through text-muted-foreground" : ""}`}>
                          {item}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dropoff checklist — only shown once at dropoff or after */}
              {isAtDropoffOrCompleted && (
                <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-4 h-4 text-fuchsia-500" />
                      <p className="font-black text-sm">Dropoff Checklist</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {dropoffChecked}/{RELOCATION_DROPOFF_CHECKLIST.length} done
                    </span>
                  </div>
                  <div className="divide-y">
                    {RELOCATION_DROPOFF_CHECKLIST.map((item, i) => {
                      const checked = checkedItems.includes(item);
                      return (
                        <button
                          key={i}
                          onClick={() => toggleCheckItem(item)}
                          disabled={job.status === "completed" || updateChecklist.isPending}
                          data-testid={`checklist-dropoff-${i}`}
                          className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors ${
                            checked ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "hover:bg-secondary/30"
                          } disabled:opacity-60`}
                        >
                          {checked
                            ? <SquareCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                            : <Square className="w-5 h-5 text-muted-foreground shrink-0" />}
                          <span className={`text-sm font-semibold leading-snug ${checked ? "line-through text-muted-foreground" : ""}`}>
                            {item}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {dropoffChecked === RELOCATION_DROPOFF_CHECKLIST.length && (
                    <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-t border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">All items completed — ready to submit!</p>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })()}

        {showChecklistSection && !relocation && (
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b bg-secondary/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-muted-foreground" />
                <p className="font-black text-sm">Job Checklist</p>
              </div>
              <span className="text-xs text-muted-foreground font-semibold">
                {checkedItems.length}/{INSTALL_CHECKLIST.length} done
              </span>
            </div>
            <div className="divide-y">
              {INSTALL_CHECKLIST.map((item, i) => {
                const checked = checkedItems.includes(item);
                return (
                  <button
                    key={i}
                    onClick={() => toggleCheckItem(item)}
                    disabled={job.status === "completed" || updateChecklist.isPending}
                    data-testid={`checklist-item-${i}`}
                    className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors ${
                      checked ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "hover:bg-secondary/30"
                    } disabled:opacity-60`}
                  >
                    {checked
                      ? <SquareCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                      : <Square className="w-5 h-5 text-muted-foreground shrink-0" />}
                    <span className={`text-sm font-semibold leading-snug ${checked ? "line-through text-muted-foreground" : ""}`}>
                      {item}
                    </span>
                  </button>
                );
              })}
            </div>
            {checkedItems.length === INSTALL_CHECKLIST.length && (
              <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-t border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">All items completed — ready to submit!</p>
              </div>
            )}
          </div>
        )}

        {/* Check-in action panel */}
        {pendingAction && actionMeta && (
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            {/* Panel header */}
            <div className={`px-5 py-4 border-b flex items-center justify-between bg-gradient-to-r ${actionMeta.gradientFrom} ${actionMeta.gradientTo}`}>
              <div>
                <p className="text-white font-black text-base">{actionMeta.title}</p>
                <p className="text-white/80 text-xs mt-0.5">{actionMeta.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1" title="Location">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    gpsStatus === 'ok' ? 'bg-green-300' :
                    gpsStatus === 'loading' ? 'bg-yellow-300 animate-pulse' :
                    gpsStatus === 'error' ? 'bg-red-400' : 'bg-white/20'
                  }`} />
                  <MapPin className={`w-3.5 h-3.5 ${gpsStatus === 'ok' ? 'text-green-300' : 'text-white/40'}`} />
                </div>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
                  data-testid="button-cancel-action"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-5">

              {/* Step 1: Photos */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                    photos.length > 0 ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground"
                  }`}>
                    {photos.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : "1"}
                  </div>
                  <p className="font-bold text-sm">
                    Take Photo(s) <span className="text-red-500">*</span>
                  </p>
                  {photos.length > 0 && <span className="text-xs font-bold text-emerald-600 ml-1">{photos.length} added</span>}
                  {photoProcessing > 0 && (
                    <span className="text-xs font-bold text-amber-600 ml-1 inline-flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Processing {photoProcessing}…
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-border group">
                      <img src={p.dataUrl} alt="proof" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <button
                          onClick={() => setPreviewPhoto(p.dataUrl)}
                          className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center"
                        >
                          <ZoomIn className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemovePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-add-photo"
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all gap-1"
                  >
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-[10px] font-bold">Add Photo</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={handleAddPhoto}
                  className="hidden"
                  data-testid="input-photo"
                />
              </div>

              {/* Step 2: Note */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-secondary text-muted-foreground flex items-center justify-center text-xs font-black shrink-0">2</div>
                  <p className="font-bold text-sm text-muted-foreground">Note <span className="font-normal">(optional)</span></p>
                </div>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  placeholder={actionMeta.notePlaceholder}
                  className="w-full px-3 py-2.5 rounded-xl border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-colors"
                  data-testid="input-note"
                />
              </div>

              {/* Step 3: Customer acknowledgment (completion only) */}
              {(action?.kind === 'install_complete' || action?.kind === 'stage_completed') && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                      signatureDataUrl && customerSignName.trim() ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground"
                    }`}>
                      {signatureDataUrl && customerSignName.trim() ? <CheckCircle2 className="w-3.5 h-3.5" /> : "3"}
                    </div>
                    <p className="font-bold text-sm flex items-center gap-1.5">
                      <PenLine className="w-3.5 h-3.5" /> Customer Sign-Off <span className="text-red-500">*</span>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    The customer confirms the work is completed to their satisfaction.
                  </p>
                  <input
                    type="text"
                    value={customerSignName}
                    onChange={e => setCustomerSignName(e.target.value)}
                    placeholder="Customer name"
                    maxLength={120}
                    className="w-full px-3 py-2.5 rounded-xl border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors mb-3"
                    data-testid="input-customer-name"
                  />
                  <SignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} />
                </div>
              )}

              {gpsStatus === 'error' && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5 -mt-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  Location services unavailable — please enable GPS and try again.
                </p>
              )}

              {/* Submit */}
              <button
                onClick={submitAction}
                disabled={isPending || gpsStatus === 'loading' || photoProcessing > 0}
                data-testid="button-submit-checkin"
                className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.98] bg-gradient-to-r ${actionMeta.gradientFrom} ${actionMeta.gradientTo} ${actionMeta.shadowColor} ${
                  isPending || gpsStatus === 'loading' || photoProcessing > 0 ? "opacity-70 cursor-wait" : ""
                }`}
              >
                {isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Uploading…</>
                ) : photoProcessing > 0 ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing photos…</>
                ) : gpsStatus === 'loading' ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Getting location…</>
                ) : (
                  <><Upload className="w-5 h-5" /> {actionMeta.buttonLabel}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t shadow-2xl">
        <div className="max-w-2xl mx-auto px-4 py-3 pb-20">

          {['deposit_paid', 'booking_requested'].includes(job.status) && !pendingAction && (
            <div className="w-full py-3.5 px-4 text-center font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 text-sm flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" /> Awaiting admin to confirm your booking
            </div>
          )}

          {job.status === 'booked' && !action && (
            <div className="w-full py-3.5 px-4 text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Booking confirmed — awaiting staff assignment
            </div>
          )}

          {/* Stage-aware action button */}
          {action && !pendingAction && (
            <div className="space-y-2">
              {/* GPS tracking indicator (visible once on-site) */}
              {isTracking && ['in_progress', 'at_pickup', 'at_dropoff'].includes(job.status) && (
                <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Location tracking active</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
              )}
              <button
                onClick={() => openAction(action)}
                data-testid={`button-${action.kind}`}
                className={`w-full bg-gradient-to-r ${metaFor(action).gradientFrom} ${metaFor(action).gradientTo} text-white shadow-lg ${metaFor(action).shadowColor} py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 hover:shadow-xl active:scale-[0.98] transition-all`}
              >
                {action.kind === 'install_arrive'   && <><Navigation2 className="w-5 h-5" /> I Have Arrived — Check In</>}
                {action.kind === 'install_complete' && <><CheckCircle2 className="w-6 h-6" /> Job Done — Submit Completion</>}
                {action.kind === 'stage_at_pickup'  && <><Navigation2 className="w-5 h-5" /> Submit Pickup Photo</>}
                {action.kind === 'stage_at_dropoff' && <><Navigation2 className="w-5 h-5" /> Submit Dropoff Photo</>}
                {action.kind === 'stage_completed'  && <><CheckCircle2 className="w-6 h-6" /> Job Done — Submit Completion</>}
              </button>
            </div>
          )}

          {isDone && (
            <div className="w-full py-4 text-center font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Job Completed & Submitted
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
