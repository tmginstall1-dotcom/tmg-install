import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  MapPin, CalendarDays, ChevronRight, Phone, MessageCircle,
  Clock, Timer, CheckCircle2, Wifi, WifiOff,
  Package, TrendingUp, AlertTriangle, RefreshCw, Radio, CloudOff, Download,
} from "lucide-react";
import { useOfflineBanner, useWithOfflineCache } from "@/hooks/use-offline-cache";
import { format, isToday, differenceInMinutes, startOfWeek } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useBackgroundLocation } from "@/hooks/use-background-location";
import { Capacitor } from "@capacitor/core";

function useAppUpdateCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [apkUrl, setApkUrl] = useState("");
  const [latestVersion, setLatestVersion] = useState("");

  const { data: versionInfo } = useQuery<{ version: string; apkUrl: string }>({
    queryKey: ["/api/app-version"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!versionInfo || !Capacitor.isNativePlatform()) return;
    const currentVersion = import.meta.env.VITE_APP_VERSION ?? "";
    const serverVersion = versionInfo.version ?? "";
    if (serverVersion && currentVersion && serverVersion !== currentVersion) {
      setUpdateAvailable(true);
      setApkUrl(versionInfo.apkUrl);
      setLatestVersion(serverVersion);
    }
  }, [versionInfo]);

  return { updateAvailable, apkUrl, latestVersion };
}

function fmtHHMMSS(secs: number) {
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
  const { isTracking, startTracking } = useBackgroundLocation();
  const { showBanner, isOnline } = useOfflineBanner();
  const { updateAvailable, apkUrl, latestVersion } = useAppUpdateCheck();

  const { data: rawQuotes, isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/quotes"],
    refetchInterval: 30000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Cache jobs for offline access
  const { data: quotes } = useWithOfflineCache<any[]>("staff-jobs", rawQuotes, jobsLoading);

  const { data: allAttendance, isLoading: attLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/attendance"],
    refetchInterval: 10000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // All of today's records (server returns newest first)
  const todayLogs: any[] = (allAttendance || []).filter((l: any) => isToday(new Date(l.clockInAt)));

  // The currently open session (clocked in, not yet clocked out)
  const activeSession = todayLogs.find((l: any) => !l.clockOutAt) ?? null;

  // Sum of all fully-completed sessions today (minutes)
  const todayCompletedMins = todayLogs.reduce((acc: number, l: any) => {
    if (!l.clockOutAt) return acc;
    return acc + differenceInMinutes(new Date(l.clockOutAt), new Date(l.clockInAt));
  }, 0);

  const allJobs = quotes || [];
  const activeNow = allJobs.filter((q: any) => q.status === "in_progress");

  // Auto-resume background tracking if clocked in OR has an active in_progress job
  // (covers app restart mid-shift/job scenario)
  useEffect(() => {
    if ((activeSession || activeNow.length > 0) && user?.id && !isTracking) {
      startTracking(user.id).catch(() => {});
    }
  }, [!!activeSession, activeNow.length, user?.id]);

  const upcoming = allJobs
    .filter((q: any) => ["booked", "assigned"].includes(q.status))
    .sort((a: any, b: any) => {
      const da = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const db = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return da - db;
    });
  const totalVisible = activeNow.length + upcoming.length;

  // Weekly hours (all completed sessions this week)
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
      <ClockHero
        todayLogs={todayLogs}
        activeSession={activeSession}
        todayCompletedMins={todayCompletedMins}
        isLoading={attLoading}
        firstName={firstName}
        userId={user?.id}
      />

      {/* Offline / Reconnected banner */}
      {showBanner && (
        <div className={`fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-2 text-xs font-black uppercase tracking-widest transition-all ${
          isOnline
            ? "bg-emerald-500 text-white"
            : "bg-slate-900 text-white"
        }`}>
          {isOnline ? (
            <><Wifi className="w-3 h-3" /> Back online</>
          ) : (
            <><CloudOff className="w-3 h-3" /> Offline — showing cached data</>
          )}
        </div>
      )}

      {/* App update banner */}
      {updateAvailable && (
        <div className="fixed bottom-20 inset-x-0 z-50 px-4">
          <button
            onClick={() => window.open(apkUrl, "_system")}
            data-testid="banner-app-update"
            className="w-full flex items-center gap-3 bg-blue-600 text-white rounded-xl px-4 py-3 shadow-lg"
          >
            <Download className="w-5 h-5 shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-bold">Update available — {latestVersion}</div>
              <div className="text-xs text-blue-200">Tap to download and install</div>
            </div>
          </button>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 sm:px-5 pb-28 -mt-2 relative z-10">

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[
            {
              icon: Timer,
              iconColor: "text-emerald-600",
              bg: "bg-emerald-50 dark:bg-emerald-950/20",
              label: "Today",
              value: attLoading
                ? "—"
                : todayLogs.length === 0
                ? "—"
                : fmtHM(todayCompletedMins + (activeSession
                    ? differenceInMinutes(new Date(), new Date(activeSession.clockInAt))
                    : 0)),
              highlight: !!activeSession,
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
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <p className="text-xs font-black text-red-600 uppercase tracking-widest">Live — In Progress</p>
              </div>
              {isTracking && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-700 rounded-full" data-testid="tracking-indicator">
                  <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">GPS On</span>
                </div>
              )}
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

function ClockHero({
  todayLogs,
  activeSession,
  todayCompletedMins,
  isLoading,
  firstName,
  userId,
}: {
  todayLogs: any[];
  activeSession: any | null;
  todayCompletedMins: number;
  isLoading: boolean;
  firstName: string;
  userId?: number;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { startTracking, stopTracking } = useBackgroundLocation();
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
      const sessionNum = todayLogs.length + 1;
      toast({
        title: `Clocked In ✓`,
        description: `Session ${sessionNum} started at ${format(new Date(), "HH:mm")}`,
      });
      // Start GPS tracking so admin can see staff location
      if (userId) startTracking(userId).catch(() => {});
    },
    onError: (e: any) => {
      refreshAttendance();
      const msg = e.message || "";
      if (msg.includes("409") || msg.toLowerCase().includes("already clocked in")) {
        toast({ title: "Already clocked in", description: "You have an active session." });
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
      toast({ title: "Clocked Out ✓", description: "Session ended. Clock in again when ready." });
      // Stop GPS tracking when shift ends
      stopTracking().catch(() => {});
    },
    onError: (e: any) => {
      refreshAttendance();
      toast({ title: "Clock-out failed", description: e.message, variant: "destructive" });
    },
  });

  const isClockedIn = !!activeSession;
  const isPending = clockInMut.isPending || clockOutMut.isPending || gpsState === "loading";

  // Live total seconds = completed sessions + current open session
  const completedSecs = todayCompletedMins * 60;
  const activeSecs = activeSession
    ? Math.floor((now.getTime() - new Date(activeSession.clockInAt).getTime()) / 1000)
    : 0;
  const workedSecs = completedSecs + activeSecs;

  const mapLat = coords?.lat ?? 1.3521;
  const mapLng = coords?.lng ?? 103.8198;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - 0.008},${mapLat - 0.008},${mapLng + 0.008},${mapLat + 0.008}&layer=mapnik&marker=${mapLat},${mapLng}`;

  // Last completed session (for display)
  const lastCompleted = todayLogs.find((l: any) => l.clockOutAt);

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
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
      </div>

      {/* Top bar: greeting + GPS */}
      <div className="absolute top-0 left-0 right-0 pt-16 px-5 flex items-start justify-between">
        <div>
          <p className="text-white/60 text-xs font-semibold tracking-wide uppercase">{format(now, "EEE, d MMM yyyy")}</p>
          <p className="text-white font-black text-2xl leading-tight mt-0.5">Hi, {firstName}</p>
        </div>

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

      {/* Session count badge */}
      {todayLogs.length > 0 && (
        <div className="absolute top-16 left-5 mt-12">
          <span className="flex items-center gap-1 bg-white/10 backdrop-blur-sm border border-white/20 text-white/70 text-[10px] font-bold px-2 py-1 rounded-full">
            <RefreshCw className="w-2.5 h-2.5" />
            {todayLogs.length} session{todayLogs.length !== 1 ? "s" : ""} today
          </span>
        </div>
      )}

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
        <div className="flex items-end justify-between gap-4">

          {/* Timer + status */}
          <div className="flex-1">
            {/* Status label */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isClockedIn && (
                <span className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Session {todayLogs.length} · In since {format(new Date(activeSession.clockInAt), "HH:mm")}
                </span>
              )}

              {/* Not clocked in but had sessions today — show last session info */}
              {!isClockedIn && lastCompleted && (
                <span className="flex items-center gap-1.5 bg-white/10 border border-white/20 text-white/60 text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Last out {format(new Date(lastCompleted.clockOutAt), "HH:mm")} · Tap to start new session
                </span>
              )}

              {!isClockedIn && todayLogs.length === 0 && !isLoading && (
                <span className="text-white/50 text-xs font-semibold">Not clocked in today</span>
              )}
            </div>

            {/* Big timer — shows accumulated total */}
            <div className="flex items-baseline gap-2">
              <Timer className="w-4 h-4 text-white/50 mb-1" />
              <span className="text-white font-mono font-black text-4xl tracking-tight leading-none">
                {fmtHHMMSS(workedSecs).slice(0, 5)}
              </span>
              <span className="text-white/50 text-sm font-semibold">total today</span>
            </div>
          </div>

          {/* Clock button */}
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
              className={`w-24 h-24 rounded-3xl flex flex-col items-center justify-center gap-1.5 font-black shadow-2xl transition-all active:scale-95 disabled:opacity-50 ${
                isClockedIn
                  ? "bg-red-500 text-white shadow-red-500/50 pulse-ring-red"
                  : gpsState === "denied"
                  ? "bg-white/20 text-white/50 cursor-not-allowed"
                  : "bg-white text-slate-900 shadow-white/30 pulse-ring-green"
              }`}
            >
              {isPending ? (
                <div className="w-7 h-7 border-[3px] border-current/30 border-t-current rounded-full animate-spin" />
              ) : gpsState === "denied" ? (
                <>
                  <WifiOff className="w-7 h-7" />
                  <span className="text-[10px] font-bold">No GPS</span>
                </>
              ) : (
                <>
                  <Clock className="w-8 h-8" />
                  <span className="text-[11px] font-bold">{isClockedIn ? "Clock Out" : "Clock In"}</span>
                </>
              )}
            </button>
          </div>
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
        className={`bg-white rounded-2xl overflow-hidden transition-all cursor-pointer active:scale-[0.99] ${
          variant === "active"
            ? "border-2 border-orange-400 shadow-lg shadow-orange-100"
            : "border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200"
        }`}
        data-testid={`job-card-${job.id}`}
      >
        {variant === "active" && (
          <div className="h-1.5 w-full bg-gradient-to-r from-orange-400 via-red-400 to-red-500" />
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h3 className="font-black text-[15px] leading-tight text-slate-900 truncate">{job.customer?.name}</h3>
                {isMyJob && (
                  <span className="shrink-0 text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    YOU
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">{job.referenceNo}</p>
            </div>
            <StatusBadge status={job.status} className="scale-90 origin-top-right shrink-0" />
          </div>

          <div className="space-y-2 mb-3.5 bg-slate-50 rounded-xl px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
              <span className="text-[13px] leading-snug font-medium text-slate-700 line-clamp-2">
                {job.serviceAddress}
              </span>
            </div>
            {scheduledDate && (
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className={`text-[13px] font-bold ${dateLabel === "Today" ? "text-orange-600" : "text-slate-500"}`}>
                  {dateLabel}
                  {job.timeWindow && ` · ${job.timeWindow}`}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`tel:${job.customer?.phone}`}
              onClick={e => e.stopPropagation()}
              data-testid={`call-${job.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
            <a
              href={`https://wa.me/${job.customer?.phone?.replace(/\D/g, "")}`}
              target="_blank" rel="noreferrer"
              onClick={e => e.stopPropagation()}
              data-testid={`wa-${job.id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
            <div className="ml-auto flex items-center gap-1 text-xs font-bold text-blue-600">
              View job <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
