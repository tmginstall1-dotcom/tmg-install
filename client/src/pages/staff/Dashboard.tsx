import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  MapPin, CalendarDays, ChevronRight, Phone, MessageCircle,
  Clock, Timer, CheckCircle2, Wifi, WifiOff,
  Package, TrendingUp, AlertTriangle
} from "lucide-react";
import { format, isToday, differenceInMinutes, startOfWeek } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

function fmtHHMM(secs: number) {
  if (secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtHM(mins: number) {
  if (mins <= 0) return "0h";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export default function StaffDashboard() {
  const { user } = useAuth();

  const { data: quotes, isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/quotes"],
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: allAttendance, isLoading: attLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/attendance"],
    refetchInterval: 10000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const attendance = allAttendance?.find((l: any) => isToday(new Date(l.clockInAt))) ?? null;

  const allJobs = quotes || [];
  const activeNow = allJobs.filter((q: any) => q.status === "in_progress");
  const upcoming = allJobs
    .filter((q: any) => ["booked", "assigned"].includes(q.status))
    .sort((a: any, b: any) => {
      const da = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const db = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return da - db;
    });
  const totalVisible = activeNow.length + upcoming.length;

  // Weekly hours
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekMins = (allAttendance || []).reduce((acc: number, l: any) => {
    if (!l.clockOutAt) return acc;
    const d = new Date(l.clockInAt);
    if (d < weekStart) return acc;
    return acc + differenceInMinutes(new Date(l.clockOutAt), new Date(l.clockInAt));
  }, 0);

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-background">
      <ClockHero attendance={attendance} user={user} isLoading={attLoading} firstName={firstName} />

      <div className="max-w-2xl mx-auto px-4 sm:px-5 pb-28 -mt-2 relative z-10">

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[
            {
              icon: Timer,
              iconColor: "text-emerald-600",
              bg: "bg-emerald-50 dark:bg-emerald-950/20",
              label: "Today",
              value: attLoading ? "—" : attendance?.clockOutAt
                ? fmtHM(differenceInMinutes(new Date(attendance.clockOutAt), new Date(attendance.clockInAt)))
                : attendance
                ? "Active"
                : "—",
              highlight: attendance && !attendance.clockOutAt,
            },
            {
              icon: TrendingUp,
              iconColor: "text-blue-600",
              bg: "bg-blue-50 dark:bg-blue-950/20",
              label: "This Week",
              value: fmtHM(weekMins),
            },
            {
              icon: Package,
              iconColor: "text-violet-600",
              bg: "bg-violet-50 dark:bg-violet-950/20",
              label: "My Jobs",
              value: String(totalVisible),
            },
          ].map(({ icon: Icon, iconColor, bg, label, value, highlight }) => (
            <div key={label} className={`${bg} rounded-2xl px-3 py-3 border border-transparent`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
              </div>
              <p className={`text-lg font-black leading-none ${highlight ? "text-emerald-600" : ""}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Active Jobs Banner */}
        {activeNow.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <p className="text-xs font-black text-red-600 uppercase tracking-widest">Live — In Progress</p>
            </div>
            <div className="space-y-3">
              {activeNow.map((job: any) => (
                <JobCard key={job.id} job={job} variant="active" myUserId={user?.id} />
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Jobs */}
        {upcoming.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                  Upcoming
                </p>
              </div>
              <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                {upcoming.length} job{upcoming.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-3">
              {upcoming.map((job: any) => (
                <JobCard key={job.id} job={job} variant="upcoming" myUserId={user?.id} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!jobsLoading && totalVisible === 0 && (
          <div className="mt-2 text-center py-14 bg-secondary/30 rounded-3xl border-2 border-dashed">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            {allJobs.length > 0 ? (
              <>
                <p className="font-bold">All done for now!</p>
                <p className="text-sm text-muted-foreground mt-1">Great work — no active or upcoming jobs.</p>
              </>
            ) : (
              <>
                <p className="font-bold text-muted-foreground">No jobs assigned yet</p>
                <p className="text-sm text-muted-foreground mt-1">Jobs will appear once assigned to you.</p>
              </>
            )}
          </div>
        )}

        {jobsLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading jobs…</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Clock Hero ──────────────────────────────────────────────────────────────

function ClockHero({ attendance, user, isLoading, firstName }: {
  attendance: any; user: any; isLoading: boolean; firstName: string;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [now, setNow] = useState(new Date());
  const [gpsState, setGpsState] = useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const hasRequested = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (hasRequested.current) return;
    hasRequested.current = true;
    requestLocation();
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) { setGpsState("denied"); return; }
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsState("ok");
      },
      () => setGpsState("denied"),
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const getGps = (): Promise<{ lat: string; lng: string } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }),
        () => resolve(null),
        { timeout: 10000, enableHighAccuracy: true }
      );
    });

  const refreshAttendance = () => {
    qc.invalidateQueries({ queryKey: ["/api/staff/attendance"] });
    qc.invalidateQueries({ queryKey: ["/api/attendance/today"] });
  };

  const clockInMut = useMutation({
    mutationFn: async () => {
      setGpsState("loading");
      const gps = await getGps();
      if (!gps) { setGpsState("denied"); throw new Error("Location is required to clock in."); }
      setGpsState("ok");
      if (gps) setCoords({ lat: parseFloat(gps.lat), lng: parseFloat(gps.lng) });
      return apiRequest("POST", "/api/attendance/clock-in", { lat: gps.lat, lng: gps.lng });
    },
    onSuccess: () => {
      refreshAttendance();
      toast({ title: "Clocked in ✓", description: `${format(new Date(), "HH:mm")} — location recorded` });
    },
    onError: (e: any) => {
      refreshAttendance();
      const msg = e.message || "";
      if (msg.includes("409") || msg.toLowerCase().includes("already clocked in")) {
        toast({ title: "Already clocked in", description: "Your clock-in was already recorded." });
      } else {
        toast({ title: "Clock-in failed", description: msg, variant: "destructive" });
      }
    },
  });

  const clockOutMut = useMutation({
    mutationFn: async () => {
      setGpsState("loading");
      const gps = await getGps();
      if (!gps) { setGpsState("denied"); throw new Error("Location is required to clock out."); }
      setGpsState("ok");
      if (gps) setCoords({ lat: parseFloat(gps.lat), lng: parseFloat(gps.lng) });
      return apiRequest("POST", "/api/attendance/clock-out", { lat: gps.lat, lng: gps.lng });
    },
    onSuccess: () => {
      refreshAttendance();
      toast({ title: "Clocked out", description: "See you next time!" });
    },
    onError: (e: any) => {
      refreshAttendance();
      toast({ title: "Clock-out failed", description: e.message, variant: "destructive" });
    },
  });

  const isClockedIn = attendance && !attendance.clockOutAt;
  const isClockedOut = attendance && attendance.clockOutAt;
  const isPending = clockInMut.isPending || clockOutMut.isPending || gpsState === "loading";

  const workedSecs = isClockedOut
    ? Math.floor((new Date(attendance.clockOutAt).getTime() - new Date(attendance.clockInAt).getTime()) / 1000)
    : isClockedIn
    ? Math.floor((now.getTime() - new Date(attendance.clockInAt).getTime()) / 1000)
    : 0;

  const mapLat = coords?.lat ?? 1.3521;
  const mapLng = coords?.lng ?? 103.8198;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - 0.008},${mapLat - 0.008},${mapLng + 0.008},${mapLat + 0.008}&layer=mapnik&marker=${mapLat},${mapLng}`;

  return (
    <div className="relative w-full" style={{ minHeight: 340 }}>
      {/* Map background */}
      <div className="absolute inset-0 overflow-hidden">
        {(gpsState === "ok" || gpsState === "idle") ? (
          <iframe src={mapUrl} className="w-full h-full border-0 pointer-events-none" title="Location" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <MapPin className="w-16 h-16 text-slate-600" />
          </div>
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
      </div>

      {/* Top bar: greeting + GPS */}
      <div className="absolute top-0 left-0 right-0 pt-16 px-5 flex items-start justify-between">
        <div>
          <p className="text-white/60 text-xs font-semibold tracking-wide uppercase">{format(now, "EEE, d MMM yyyy")}</p>
          <p className="text-white font-black text-2xl leading-tight mt-0.5">Hi, {firstName}</p>
        </div>

        {/* GPS pill */}
        <button
          onClick={gpsState === "denied" ? requestLocation : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm border transition-all ${
            gpsState === "ok"
              ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300"
              : gpsState === "denied"
              ? "bg-red-500/20 border-red-400/40 text-red-300 cursor-pointer hover:bg-red-500/30"
              : "bg-white/10 border-white/20 text-white/70"
          }`}
        >
          {gpsState === "ok" ? (
            <><Wifi className="w-3 h-3" /> GPS Ready</>
          ) : gpsState === "denied" ? (
            <><WifiOff className="w-3 h-3" /> Retry GPS</>
          ) : gpsState === "loading" ? (
            <><div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> Locating…</>
          ) : (
            <><MapPin className="w-3 h-3" /> Waiting</>
          )}
        </button>
      </div>

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
        <div className="flex items-end justify-between gap-4">

          {/* Timer + status */}
          <div className="flex-1">
            {/* Status label */}
            <div className="flex items-center gap-2 mb-2">
              {isClockedIn && (
                <span className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Clocked In · since {format(new Date(attendance.clockInAt), "HH:mm")}
                </span>
              )}
              {isClockedOut && (
                <span className="flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/70 text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Done · {format(new Date(attendance.clockInAt), "HH:mm")}–{format(new Date(attendance.clockOutAt), "HH:mm")}
                </span>
              )}
              {!attendance && !isLoading && (
                <span className="text-white/50 text-xs font-semibold">Not clocked in today</span>
              )}
            </div>

            {/* Big timer */}
            <div className="flex items-baseline gap-2">
              <Timer className="w-4 h-4 text-white/50 mb-1" />
              <span className="text-white font-mono font-black text-4xl tracking-tight leading-none">
                {fmtHHMM(workedSecs).slice(0, 5)}
              </span>
              <span className="text-white/50 text-sm font-semibold">hrs today</span>
            </div>
          </div>

          {/* Clock button */}
          {isClockedOut ? (
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex flex-col items-center justify-center gap-1 shrink-0">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <span className="text-white text-xs font-bold">Signed Off</span>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-2 shrink-0">
              {gpsState === "denied" && (
                <div className="bg-red-500/90 backdrop-blur text-white text-[11px] font-bold px-3 py-2 rounded-xl max-w-[180px] text-right leading-tight">
                  📍 Enable GPS<br />
                  <span className="font-normal opacity-90 text-[10px]">Required for clock-in/out</span>
                </div>
              )}
              <button
                onClick={() => isClockedIn ? clockOutMut.mutate() : clockInMut.mutate()}
                disabled={isPending || gpsState === "denied"}
                data-testid={isClockedIn ? "button-clock-out" : "button-clock-in"}
                className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center gap-1.5 font-black shadow-2xl transition-all active:scale-95 disabled:opacity-50 ${
                  isClockedIn
                    ? "bg-red-500 text-white shadow-red-500/40"
                    : gpsState === "denied"
                    ? "bg-white/20 text-white/50 cursor-not-allowed"
                    : "bg-white text-black shadow-white/20"
                }`}
              >
                {isPending ? (
                  <div className="w-6 h-6 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                ) : gpsState === "denied" ? (
                  <>
                    <WifiOff className="w-6 h-6" />
                    <span className="text-[10px]">No GPS</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-7 h-7" />
                    <span className="text-[10px]">{isClockedIn ? "Clock Out" : "Clock In"}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, variant, myUserId }: {
  job: any;
  variant: "active" | "upcoming";
  myUserId?: number;
}) {
  const isMyJob = job.assignedStaffId && job.assignedStaffId === myUserId;
  const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt) : null;
  const dateLabel = scheduledDate
    ? isToday(scheduledDate) ? "Today" : format(scheduledDate, "EEE, d MMM")
    : null;

  return (
    <Link href={`/staff/jobs/${job.id}`}>
      <div
        className={`bg-card border rounded-2xl overflow-hidden hover:shadow-md active:scale-[0.99] transition-all cursor-pointer ${
          variant === "active"
            ? "border-orange-300 dark:border-orange-700 shadow-sm"
            : "border-border hover:border-primary/20"
        }`}
        data-testid={`job-card-${job.id}`}
      >
        {/* Top colored accent bar for active jobs */}
        {variant === "active" && (
          <div className="h-1 w-full bg-gradient-to-r from-orange-400 to-red-500" />
        )}

        <div className="p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base leading-tight truncate">{job.customer?.name}</h3>
                {isMyJob && (
                  <span className="shrink-0 text-[10px] font-black bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    YOU
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{job.referenceNo}</p>
            </div>
            <StatusBadge status={job.status} className="scale-90 origin-top-right shrink-0" />
          </div>

          {/* Details */}
          <div className="space-y-1.5 mb-3">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm leading-snug font-medium text-foreground/80 line-clamp-2">
                {job.serviceAddress}
              </span>
            </div>
            {scheduledDate && (
              <div className="flex items-center gap-2">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className={`text-sm font-bold ${dateLabel === "Today" ? "text-orange-600" : "text-muted-foreground"}`}>
                  {dateLabel}
                  {job.timeWindow && ` · ${job.timeWindow}`}
                </span>
              </div>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center gap-2 pt-3 border-t border-border/60">
            <a
              href={`tel:${job.customer?.phone}`}
              onClick={e => e.stopPropagation()}
              data-testid={`call-${job.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-xs font-bold hover:bg-secondary/70 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
            <a
              href={`https://wa.me/${job.customer?.phone?.replace(/\D/g, "")}`}
              target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              data-testid={`wa-${job.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-200 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <div className="ml-auto flex items-center gap-1 text-xs font-bold text-primary">
              View <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
