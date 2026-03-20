import { useParams, Link } from "wouter";
import { useQuote, useStaffArrived, useStaffCompleted } from "@/hooks/use-quotes";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeft, CheckCircle2, X, Loader2, Clock, Package, User, CalendarDays,
  Upload, AlertTriangle, ZoomIn, ImagePlus, Navigation2, MapPin, Radio,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useBackgroundLocation } from "@/hooks/use-background-location";
import { useAuth } from "@/hooks/use-auth";

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

async function compressToDataUrl(file: File, maxPx = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const STATUS_STEPS = [
  { key: "booked", label: "Booked" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
];

function getStepIndex(status: string) {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  if (["final_payment_requested", "final_paid", "closed"].includes(status)) return 3;
  return idx === -1 ? 0 : idx;
}

export default function JobDetail() {
  const { id } = useParams();
  const { data: job, isLoading } = useQuote(id!);
  const arrivedMutation = useStaffArrived();
  const completedMutation = useStaffCompleted();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isTracking, startTracking, stopTracking } = useBackgroundLocation();

  const [photos, setPhotos] = useState<{ file: File; dataUrl: string }[]>([]);
  const [note, setNote] = useState("");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [actionType, setActionType] = useState<'arrived' | 'completed' | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-capture GPS silently as soon as modal opens
  useEffect(() => {
    if (!actionType) return;
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
  }, [actionType]);

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
      <div className="text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <p className="font-bold">Job not found</p>
        <Link href="/staff" className="text-primary text-sm underline mt-2 inline-block">← Back to Home</Link>
      </div>
    </div>
  );

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    for (const file of files) {
      try {
        const dataUrl = await compressToDataUrl(file);
        setPhotos(prev => [...prev, { file, dataUrl }]);
      } catch {
        toast({ title: "Photo Error", description: "Could not process photo.", variant: "destructive" });
      }
    }
  };

  const handleRemovePhoto = (i: number) => setPhotos(prev => prev.filter((_, idx) => idx !== i));

  const closeModal = () => {
    setActionType(null);
    setPhotos([]);
    setGpsCoords(null);
    setGpsStatus('idle');
    setNote("");
  };

  const handleAction = async () => {
    if (!actionType) return;

    if (photos.length === 0) {
      toast({ title: "Photo Required", description: "Please take at least one photo.", variant: "destructive" });
      return;
    }

    // If GPS still loading, wait briefly for it
    if (gpsStatus === 'loading') {
      toast({ title: "Getting Location…", description: "Please wait a moment." });
      return;
    }

    // If GPS failed, retry once before blocking
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

    try {
      if (actionType === 'arrived') {
        await arrivedMutation.mutateAsync({ id: id!, gpsLat: coords.lat, gpsLng: coords.lng, photoUrls: photos.map(p => p.dataUrl), note: note || undefined });
        // Start continuous background location tracking
        if (user?.id) {
          startTracking(user.id).catch(() => {});
        }
        toast({ title: "✓ Checked In", description: "Arrival recorded. Location tracking started." });
      } else {
        await completedMutation.mutateAsync({ id: id!, gpsLat: coords.lat, gpsLng: coords.lng, photoUrls: photos.map(p => p.dataUrl), note: note || undefined });
        // Stop background location tracking
        stopTracking().catch(() => {});
        toast({ title: "✓ Job Completed", description: "Completion submitted. Location tracking stopped." });
      }
      closeModal();
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const isPending = arrivedMutation.isPending || completedMutation.isPending;
  const stepIdx = getStepIndex(job.status);
  const isDone = ["completed", "final_payment_requested", "final_paid", "closed"].includes(job.status);

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
                <StatusBadge status={job.status} />
                <span className="text-white/60 text-xs font-mono font-bold">{job.referenceNo}</span>
              </div>
              <h1 className="text-xl font-black text-white leading-tight">{job.customer?.name}</h1>
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
              {STATUS_STEPS.map((step, i) => (
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
                  {i < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 transition-colors ${i < stepIdx ? "bg-emerald-400" : "bg-border"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Job details */}
          <div className="px-5 py-4 space-y-3">
            {job.serviceAddress && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide mb-0.5">Service Address</p>
                  <p className="text-sm font-semibold">{job.serviceAddress}</p>
                </div>
              </div>
            )}
            {(job.pickupAddress || job.dropoffAddress) && (
              <div className="flex items-start gap-2.5">
                <Navigation2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-0.5">
                  {job.pickupAddress && <p className="text-sm"><span className="font-bold text-muted-foreground text-xs">Pickup: </span>{job.pickupAddress}</p>}
                  {job.dropoffAddress && <p className="text-sm"><span className="font-bold text-muted-foreground text-xs">Dropoff: </span>{job.dropoffAddress}</p>}
                </div>
              </div>
            )}
            {job.customer?.phone && (
              <div className="flex items-center gap-2.5">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wide mb-0.5">Customer</p>
                  <p className="text-sm font-semibold">{job.customer.name} · {job.customer.phone}</p>
                </div>
              </div>
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
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black">×{item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Check-in action panel */}
        {actionType && (
          <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
            {/* Panel header */}
            <div className={`px-5 py-4 border-b flex items-center justify-between ${
              actionType === 'arrived'
                ? "bg-gradient-to-r from-blue-600 to-blue-700"
                : "bg-gradient-to-r from-emerald-600 to-emerald-700"
            }`}>
              <div>
                <p className="text-white font-black text-base">
                  {actionType === 'arrived' ? '📍 Arrived Check-In' : '✅ Job Completion'}
                </p>
                <p className="text-white/70 text-xs mt-0.5">
                  {actionType === 'arrived' ? 'Confirm you have arrived at the location' : 'Submit proof of job completion'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Silent GPS status indicator — subtle, not labelled as "tracking" */}
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
                  placeholder={actionType === 'arrived' ? 'Access issues, parking notes…' : 'Completion notes, any issues encountered…'}
                  className="w-full px-3 py-2.5 rounded-xl border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none transition-colors"
                  data-testid="input-note"
                />
              </div>

              {/* GPS error hint (non-alarming) */}
              {gpsStatus === 'error' && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5 -mt-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  Location services unavailable — please enable GPS and try again.
                </p>
              )}

              {/* Submit */}
              <button
                onClick={handleAction}
                disabled={isPending || gpsStatus === 'loading'}
                data-testid="button-submit-checkin"
                className={`w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2.5 transition-all shadow-lg active:scale-[0.98] ${
                  isPending || gpsStatus === 'loading'
                    ? "opacity-70 cursor-wait"
                    : ""
                } ${
                  actionType === 'arrived'
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 shadow-blue-500/25"
                    : "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/25"
                }`}
              >
                {isPending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Uploading…</>
                ) : gpsStatus === 'loading' ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Getting location…</>
                ) : (
                  <><Upload className="w-5 h-5" /> {actionType === 'arrived' ? "Confirm Arrived" : "Confirm Job Completed"}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-xl border-t shadow-2xl">
        <div className="max-w-2xl mx-auto px-4 py-3 pb-20">

          {['deposit_paid', 'booking_requested'].includes(job.status) && !actionType && (
            <div className="w-full py-3.5 px-4 text-center font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800 text-sm flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" /> Awaiting admin to confirm your booking
            </div>
          )}

          {job.status === 'booked' && !actionType && (
            <div className="w-full py-3.5 px-4 text-center font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-800 text-sm flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Booking confirmed — awaiting staff assignment
            </div>
          )}

          {job.status === 'assigned' && !actionType && (
            <button
              onClick={() => setActionType('arrived')}
              data-testid="button-arrived"
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 hover:shadow-blue-500/40 active:scale-[0.98] transition-all"
            >
              <Navigation2 className="w-5 h-5" /> I Have Arrived — Check In
            </button>
          )}

          {job.status === 'in_progress' && !actionType && (
            <div className="space-y-2">
              {/* GPS tracking indicator */}
              {isTracking && (
                <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Location tracking active</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
              )}
              <button
                onClick={() => setActionType('completed')}
                data-testid="button-complete-job"
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 hover:shadow-emerald-500/40 active:scale-[0.98] transition-all"
              >
                <CheckCircle2 className="w-6 h-6" /> Job Done — Submit Completion
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
