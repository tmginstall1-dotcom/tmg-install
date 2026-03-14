import { useParams, Link } from "wouter";
import { useQuote, useStaffArrived, useStaffCompleted } from "@/hooks/use-quotes";
import { useState, useRef } from "react";
import { ArrowLeft, MapPin, Phone, CheckCircle2, Camera, Map, Navigation, MessageCircle, Upload, X, Loader2, Clock } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

async function captureGPS(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(`GPS error: ${err.message}`)),
      { timeout: 15000, enableHighAccuracy: true }
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

export default function JobDetail() {
  const { id } = useParams();
  const { data: job, isLoading } = useQuote(id!);
  const arrivedMutation = useStaffArrived();
  const completedMutation = useStaffCompleted();
  const { toast } = useToast();

  const [photos, setPhotos] = useState<{ file: File; dataUrl: string }[]>([]);
  const [note, setNote] = useState("");
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsTimestamp, setGpsTimestamp] = useState<Date | null>(null);
  const [actionType, setActionType] = useState<'arrived' | 'completed' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) return (
    <div className="min-h-screen pt-32 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  if (!job) return <div className="pt-32 text-center">Job not found</div>;

  const handleGetGPS = async () => {
    setGpsStatus('loading');
    try {
      const coords = await captureGPS();
      setGpsCoords(coords);
      setGpsTimestamp(new Date());
      setGpsStatus('ok');
    } catch (err: any) {
      setGpsStatus('error');
      toast({ title: "GPS Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    for (const file of files) {
      try {
        const dataUrl = await compressToDataUrl(file);
        setPhotos(prev => [...prev, { file, dataUrl }]);
      } catch {
        toast({ title: "Photo Error", description: "Could not process photo. Please try again.", variant: "destructive" });
      }
    }
  };

  const handleRemovePhoto = (i: number) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleAction = async () => {
    if (!actionType) return;

    if (!gpsCoords) {
      toast({ title: "GPS Required", description: "Please capture your GPS location first.", variant: "destructive" });
      return;
    }
    if (photos.length === 0) {
      toast({ title: "Photo Required", description: "Please take at least one photo.", variant: "destructive" });
      return;
    }

    const photoUrls = photos.map(p => p.dataUrl);

    try {
      if (actionType === 'arrived') {
        await arrivedMutation.mutateAsync({
          id: id!,
          gpsLat: gpsCoords.lat,
          gpsLng: gpsCoords.lng,
          photoUrls,
          note: note || undefined,
        });
        toast({ title: "Checked In!", description: "Arrived check-in recorded." });
      } else {
        await completedMutation.mutateAsync({
          id: id!,
          gpsLat: gpsCoords.lat,
          gpsLng: gpsCoords.lng,
          photoUrls,
          note: note || undefined,
        });
        toast({ title: "Job Completed!", description: "Completion recorded with proof." });
      }
      setActionType(null);
      setPhotos([]);
      setGpsCoords(null);
      setGpsStatus('idle');
      setNote("");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  };

  const isPending = arrivedMutation.isPending || completedMutation.isPending;

  return (
    <div className="min-h-screen pt-24 pb-36 bg-secondary/20">
      <div className="max-w-2xl mx-auto px-4">
        
        <Link href="/staff" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to My Jobs
        </Link>

        {/* Header */}
        <div className="bg-card rounded-[2rem] border shadow-sm overflow-hidden mb-5">
          <div className="p-6 border-b bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
            <div className="flex justify-between items-start mb-3">
              <StatusBadge status={job.status} />
              <span className="text-sm font-bold text-muted-foreground">{job.referenceNo}</span>
            </div>
            <h1 className="text-2xl font-display font-bold mb-1">{job.customer?.name}</h1>
            <div className="flex gap-3 mt-3">
              <a href={`tel:${job.customer?.phone}`} data-testid="button-call"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 border text-sm font-bold hover:bg-white transition-colors">
                <Phone className="w-4 h-4" /> {job.customer?.phone}
              </a>
              <a href={`https://wa.me/${job.customer?.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" data-testid="button-whatsapp"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors">
                <MessageCircle className="w-4 h-4" /> WA
              </a>
            </div>
          </div>

          {/* Location */}
          <div className="p-5 border-b">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">Location</p>
                <p className="font-bold leading-tight mb-3">{job.serviceAddress}</p>
                {job.scheduledAt && (
                  <p className="text-sm font-semibold text-primary mb-3">
                    {format(new Date(job.scheduledAt), 'EEE, MMM d')} · {job.timeWindow}
                  </p>
                )}
                <a href={`https://maps.google.com/?q=${encodeURIComponent(job.serviceAddress)}`} target="_blank" rel="noreferrer"
                  data-testid="button-maps"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm font-bold hover:bg-border transition-colors">
                  <Map className="w-4 h-4" /> Open Maps
                </a>
              </div>
            </div>
          </div>

          {/* Task List */}
          <div className="p-5">
            <h3 className="font-bold mb-4 text-sm">Tasks ({job.items?.length})</h3>
            <div className="space-y-2">
              {job.items?.map((item: any) => (
                <div key={item.id} className="p-3 rounded-xl border bg-secondary/30 flex justify-between items-center"
                  data-testid={`task-${item.id}`}>
                  <div>
                    <p className="font-bold text-sm">{item.detectedName || item.originalDescription}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.serviceType}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center font-bold text-sm">
                    ×{item.quantity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Check-in / Check-out Modal */}
        {actionType && (
          <div className="bg-card rounded-[2rem] border shadow-sm p-5 mb-5">
            <h3 className="font-bold text-lg mb-5">
              {actionType === 'arrived' ? '📍 Arrived Check-In' : '✅ Job Completion'}
            </h3>

            {/* GPS */}
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">1. Capture GPS Location *</p>
              <button onClick={handleGetGPS} disabled={gpsStatus === 'loading'}
                data-testid="button-get-gps"
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                  gpsStatus === 'ok' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' :
                  gpsStatus === 'error' ? 'bg-red-50 border border-red-200 text-red-600' :
                  'bg-secondary border hover:bg-border'
                }`}>
                {gpsStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                {gpsStatus === 'idle' && 'Get My Location'}
                {gpsStatus === 'loading' && 'Getting Location...'}
                {gpsStatus === 'ok' && `✓ ${gpsCoords?.lat.toFixed(4)}, ${gpsCoords?.lng.toFixed(4)}`}
                {gpsStatus === 'error' && 'Retry GPS'}
              </button>
              {gpsStatus === 'ok' && gpsTimestamp && (
                <p className="mt-2 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Captured at {gpsTimestamp.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  {' '}on {gpsTimestamp.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* Photos */}
            <div className="mb-4">
              <p className="text-sm font-semibold mb-2">2. Take Photo(s) * (min 1)</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {photos.map((p, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border">
                    <img src={p.dataUrl} alt="proof" className="w-full h-full object-cover" />
                    <button onClick={() => handleRemovePhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button onClick={() => fileInputRef.current?.click()}
                  data-testid="button-add-photo"
                  className="w-20 h-20 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <Camera className="w-5 h-5 mb-1" />
                  <span className="text-xs">Add</span>
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" onChange={handleAddPhoto} className="hidden" data-testid="input-photo" />
            </div>

            {/* Note */}
            <div className="mb-5">
              <p className="text-sm font-semibold mb-2">3. Note (optional)</p>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder={actionType === 'arrived' ? 'Any access issues, notes on arrival...' : 'Job completion notes, any issues...'}
                className="w-full px-3 py-2.5 rounded-xl border bg-background text-sm outline-none focus:border-primary resize-none"
                data-testid="input-note" />
            </div>

            <div className="flex gap-3">
              <button onClick={handleAction} disabled={isPending}
                data-testid="button-submit-checkin"
                className={`flex-1 py-3.5 rounded-2xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all ${
                  actionType === 'arrived'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25'
                }`}>
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                {isPending ? "Uploading..." : actionType === 'arrived' ? "Confirm Arrived" : "Confirm Completed"}
              </button>
              <button onClick={() => { setActionType(null); setPhotos([]); setGpsCoords(null); setGpsTimestamp(null); setGpsStatus('idle'); setNote(""); }}
                className="px-5 py-3.5 rounded-2xl border font-bold hover:bg-secondary transition-colors"
                data-testid="button-cancel-action">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Fixed Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-xl border-t z-40">
          <div className="max-w-2xl mx-auto flex gap-3">

            {/* STEP 1 — Awaiting admin to confirm booking */}
            {['deposit_paid', 'booking_requested'].includes(job.status) && !actionType && (
              <div className="w-full py-3.5 px-4 text-center font-semibold text-amber-700 bg-amber-50 rounded-2xl border border-amber-200 text-sm">
                ⏳ Awaiting admin to confirm your booking slot
              </div>
            )}

            {/* STEP 2 — Awaiting admin to assign staff */}
            {job.status === 'booked' && !actionType && (
              <div className="w-full py-3.5 px-4 text-center font-semibold text-blue-700 bg-blue-50 rounded-2xl border border-blue-200 text-sm">
                📋 Booking confirmed — awaiting staff assignment
              </div>
            )}

            {/* STEP 3 — Assigned: tap to check in with GPS + photo */}
            {job.status === 'assigned' && !actionType && (
              <button onClick={() => setActionType('arrived')} data-testid="button-arrived"
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all">
                <Navigation className="w-5 h-5" /> Tap When Arrived (GPS + Photo Required)
              </button>
            )}

            {/* STEP 4 — In progress: tap to complete with GPS + photo */}
            {job.status === 'in_progress' && !actionType && (
              <button onClick={() => setActionType('completed')} data-testid="button-complete-job"
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all">
                <CheckCircle2 className="w-6 h-6" /> Job Done — Submit Completion (GPS + Photo Required)
              </button>
            )}

            {/* Done */}
            {['completed', 'final_payment_requested', 'final_paid', 'closed'].includes(job.status) && (
              <div className="w-full py-4 text-center font-bold text-emerald-600 bg-emerald-50 rounded-2xl border border-emerald-200">
                ✅ Job Completed & Submitted
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
