import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  MapPin, CalendarDays, ChevronRight, Phone, MessageCircle, User,
  Clock, Timer, AlertCircle, CheckCircle2, FileText, CalendarCheck,
  Briefcase, TrendingUp, Wifi, WifiOff
} from "lucide-react";
import { format, isToday, differenceInSeconds } from "date-fns";
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

export default function StaffDashboard() {
  const { user } = useAuth();

  const { data: quotes, isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/quotes"],
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const { data: attendance, isLoading: attLoading } = useQuery<any>({
    queryKey: ["/api/attendance/today"],
    refetchInterval: 30000,
    refetchOnMount: "always",
    staleTime: 0,
  });

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

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-background">
      <ClockHero attendance={attendance} user={user} isLoading={attLoading} firstName={firstName} />

      <div className="max-w-2xl mx-auto px-4 sm:px-5 pb-24 -mt-4 relative z-10">
        {/* Quick Nav Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/staff/hr?tab=leave">
            <div className="bg-card border-2 rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
              data-testid="button-my-requests">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight">Leave</p>
                <p className="text-xs text-muted-foreground">Apply & track</p>
              </div>
            </div>
          </Link>
          <Link href="/staff/hr?tab=attendance">
            <div className="bg-card border-2 rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
              data-testid="button-timesheet">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight">Timesheet</p>
                <p className="text-xs text-muted-foreground">Hours & records</p>
              </div>
            </div>
          </Link>
          <Link href="/staff/hr?tab=payslips">
            <div className="bg-card border-2 rounded-2xl p-4 flex items-center gap-3 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
              data-testid="button-payslips">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm leading-tight">Payslips</p>
                <p className="text-xs text-muted-foreground">Salary & pay</p>
              </div>
            </div>
          </Link>
          <div className="bg-card border-2 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">
                {totalVisible === 0 ? "No active jobs" : `${totalVisible} Job${totalVisible !== 1 ? "s" : ""}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeNow.length > 0 ? `${activeNow.length} active now` : upcoming.length > 0 ? `${upcoming.length} upcoming` : "All done!"}
              </p>
            </div>
          </div>
        </div>

        {/* Jobs Section */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-black">My Jobs</h2>
          {totalVisible > 0 && (
            <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
              {totalVisible} assigned
            </span>
          )}
        </div>

        {jobsLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeNow.length > 0 && (
              <section className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Active Now</p>
                </div>
                <div className="space-y-2.5">
                  {activeNow.map((job: any) => <JobCard key={job.id} job={job} priority myUserId={user?.id} />)}
                </div>
              </section>
            )}
            {upcoming.length > 0 && (
              <section className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Upcoming ({upcoming.length})</p>
                </div>
                <div className="space-y-2.5">
                  {upcoming.map((job: any) => <JobCard key={job.id} job={job} myUserId={user?.id} />)}
                </div>
              </section>
            )}
            {totalVisible === 0 && (
              <div className="text-center py-14 bg-secondary/30 rounded-3xl border-2 border-dashed">
                <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                {allJobs.length > 0 ? (
                  <>
                    <p className="font-bold text-muted-foreground">All jobs completed</p>
                    <p className="text-sm text-muted-foreground mt-1">Great work! No active or upcoming jobs right now.</p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-muted-foreground">No jobs assigned</p>
                    <p className="text-sm text-muted-foreground mt-1">Jobs will appear once booked and assigned to you.</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
      qc.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast({ title: "Clocked in", description: `${format(new Date(), "HH:mm")} — location recorded` });
    },
    onError: (e: any) => toast({ title: "Clock-in failed", description: e.message, variant: "destructive" }),
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
      qc.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast({ title: "Clocked out", description: "See you next time!" });
    },
    onError: (e: any) => toast({ title: "Clock-out failed", description: e.message, variant: "destructive" }),
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
    <div className="relative w-full" style={{ minHeight: 380 }}>
      {/* Map Background */}
      <div className="absolute inset-0 overflow-hidden">
        {(gpsState === "ok" || gpsState === "idle") ? (
          <iframe src={mapUrl} className="w-full h-full border-0 pointer-events-none" title="Location map" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
            <MapPin className="w-12 h-12 text-slate-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/80" />
      </div>

      {/* Top greeting bar */}
      <div className="absolute top-0 left-0 right-0 pt-16 px-5 flex items-start justify-between">
        <div>
          <p className="text-white/70 text-xs font-medium">{format(now, "EEE, d MMM yyyy")}</p>
          <p className="text-white font-black text-lg leading-tight">Hello, {firstName}</p>
        </div>
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur text-white text-xs font-bold px-3 py-1.5 rounded-full">
          {gpsState === "ok" ? (
            <><Wifi className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-emerald-300">GPS OK</span></>
          ) : gpsState === "denied" ? (
            <><WifiOff className="w-3.5 h-3.5 text-red-400" /> <button onClick={requestLocation} className="text-red-300 underline">Retry</button></>
          ) : gpsState === "loading" ? (
            <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Locating</>
          ) : (
            <><MapPin className="w-3.5 h-3.5" /> Waiting</>
          )}
        </div>
      </div>

      {/* Bottom panel */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-8">
        <div className="flex items-end justify-between gap-4">
          {/* Work timer */}
          <div>
            {isClockedIn && (
              <p className="text-white/60 text-xs font-medium mb-0.5">Since {format(new Date(attendance.clockInAt), "HH:mm")}</p>
            )}
            {isClockedOut && (
              <p className="text-white/60 text-xs font-medium mb-0.5">
                {format(new Date(attendance.clockInAt), "HH:mm")} – {format(new Date(attendance.clockOutAt), "HH:mm")}
              </p>
            )}
            {!attendance && !isLoading && (
              <p className="text-white/60 text-xs font-medium mb-0.5">Not clocked in today</p>
            )}
            <div className="flex items-baseline gap-1">
              <Timer className="w-4 h-4 text-white/70 mb-0.5" />
              <span className="text-white font-mono font-black text-3xl tracking-tight">
                {fmtHHMM(workedSecs).slice(0, 5)}
              </span>
              <span className="text-white/60 text-sm font-medium">today</span>
            </div>
          </div>

          {/* Clock button */}
          {!isClockedOut ? (
            <div className="flex flex-col items-end gap-2">
              {gpsState === "denied" && (
                <div className="bg-red-500/90 backdrop-blur text-white text-xs font-bold px-3 py-2 rounded-xl max-w-[200px] text-right leading-tight">
                  📍 Location blocked<br />
                  <span className="font-normal opacity-90">Enable GPS in your browser/phone settings to clock in</span>
                  <button onClick={requestLocation} className="block mt-1 underline font-bold">Retry</button>
                </div>
              )}
              <button
                onClick={() => isClockedIn ? clockOutMut.mutate() : clockInMut.mutate()}
                disabled={isPending || gpsState === "denied"}
                data-testid={isClockedIn ? "button-clock-out" : "button-clock-in"}
                className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-1.5 font-black shadow-2xl transition-all active:scale-95 disabled:opacity-50 border-2 border-white/20 ${
                  isClockedIn
                    ? "bg-red-500 text-white"
                    : gpsState === "denied"
                    ? "bg-white/30 text-white/60 cursor-not-allowed"
                    : "bg-white text-black"
                }`}
              >
                {isPending ? (
                  <div className="w-6 h-6 border-3 border-current/40 border-t-current rounded-full animate-spin" />
                ) : gpsState === "denied" ? (
                  <>
                    <WifiOff className="w-7 h-7" />
                    <span className="text-xs">No GPS</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-7 h-7" />
                    <span className="text-xs">{isClockedIn ? "Clock Out" : "Clock In"}</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur border-2 border-white/20 flex flex-col items-center justify-center gap-1">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              <span className="text-white text-xs font-bold">Done</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JobCard({ job, priority, myUserId }: { job: any; priority?: boolean; myUserId?: number }) {
  const isMyJob = job.assignedStaffId && job.assignedStaffId === myUserId;
  const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt) : null;
  const dateLabel = scheduledDate
    ? isToday(scheduledDate) ? "Today" : format(scheduledDate, "EEE, d MMM")
    : null;

  return (
    <Link href={`/staff/jobs/${job.id}`}>
      <div className={[
        "bg-card border-2 rounded-2xl p-4 hover:shadow-md transition-all cursor-pointer active:scale-[0.99]",
        priority ? "border-orange-300 bg-orange-50/50 dark:bg-orange-950/10" :
        isMyJob ? "border-primary/40" : "border-border hover:border-primary/30",
      ].join(" ")}
        data-testid={`job-card-${job.id}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="font-bold text-base leading-tight">{job.customer?.name}</h3>
              {isMyJob && (
                <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                  You
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono">{job.referenceNo}</p>
          </div>
          <StatusBadge status={job.status} className="scale-90 origin-top-right shrink-0" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <span className="text-sm leading-snug font-medium">{job.serviceAddress}</span>
          </div>
          {job.scheduledAt && (
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className={`font-semibold text-sm ${dateLabel === "Today" ? "text-orange-600" : "text-muted-foreground"}`}>
                {dateLabel} · {job.timeWindow || "TBD"}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <a href={`tel:${job.customer?.phone}`}
            onClick={e => e.stopPropagation()}
            data-testid={`call-${job.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-xs font-bold hover:bg-secondary/80 transition-colors">
            <Phone className="w-3.5 h-3.5" /> Call
          </a>
          <a href={`https://wa.me/${job.customer?.phone?.replace(/\D/g, "")}`}
            target="_blank" rel="noreferrer"
            onClick={e => e.stopPropagation()}
            data-testid={`wa-${job.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-200 transition-colors">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
          <div className="ml-auto">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </Link>
  );
}
