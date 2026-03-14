import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  MapPin, CalendarDays, ChevronRight, Phone, MessageCircle, User,
  Clock, Users, Timer, AlertCircle, CheckCircle2, ListTodo
} from "lucide-react";
import { format, isToday, differenceInSeconds } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtHHMM(secs: number) {
  if (secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StaffDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: quotes, isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/quotes"],
  });
  const { data: attendance, isLoading: attLoading } = useQuery<any>({
    queryKey: ["/api/attendance/today"],
    refetchInterval: 30000,
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

  return (
    <div className="min-h-screen bg-background">
      {/* ── Clock In Hero ── */}
      <ClockHero attendance={attendance} user={user} isLoading={attLoading} />

      {/* ── Jobs section ── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-24">
        <div className="mt-6 mb-4">
          <h2 className="text-lg font-black">My Jobs</h2>
          <p className="text-xs text-muted-foreground">Active assignments and upcoming schedule</p>
        </div>

        {jobsLoading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {activeNow.length > 0 && (
              <section className="mb-6">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">🔴 Active Now</p>
                <div className="space-y-3">
                  {activeNow.map((job: any) => <JobCard key={job.id} job={job} priority myUserId={user?.id} />)}
                </div>
              </section>
            )}
            {upcoming.length > 0 && (
              <section className="mb-6">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">📅 Upcoming ({upcoming.length})</p>
                <div className="space-y-3">
                  {upcoming.map((job: any) => <JobCard key={job.id} job={job} myUserId={user?.id} />)}
                </div>
              </section>
            )}
            {totalVisible === 0 && (
              <div className="text-center py-12 bg-secondary/30 rounded-3xl border-2 border-dashed">
                <CalendarDays className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="font-bold text-muted-foreground">No jobs yet</p>
                <p className="text-sm text-muted-foreground">Jobs will appear once booked and assigned.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Team Today (admin only — removed from staff dashboard) ───────────────────

function TeamToday({ myId }: { myId?: number }) {
  const { data: roster = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/team/today"],
    refetchInterval: 30000,
  });

  const clockedIn  = roster.filter(r => r.clockInAt && !r.clockOutAt);
  const clockedOut = roster.filter(r => r.clockInAt && r.clockOutAt);
  const absent     = roster.filter(r => !r.clockInAt);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-black flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Team Today
        </h2>
        <div className="flex gap-2 text-xs font-bold">
          <span className="flex items-center gap-1 text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {clockedIn.length} in
          </span>
          <span className="text-muted-foreground">· {absent.length} absent</span>
        </div>
      </div>

      <div className="bg-card border-2 rounded-2xl overflow-hidden divide-y">
        {isLoading && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Clocked In */}
        {clockedIn.map((m) => {
          const initials = m.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
          const isSelf = m.id === myId;
          return (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3"
              data-testid={`team-row-${m.id}`}>
              <div style={{ backgroundColor: avatarColor(m.id) }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight">
                  {m.name}
                  {isSelf && <span className="ml-1.5 text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full align-middle">You</span>}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-xs font-bold text-emerald-600">
                    Clocked in · {format(new Date(m.clockInAt), "h:mm a")}
                  </span>
                </div>
              </div>
              {m.clockInLat && m.clockInLng && (
                <a href={`https://maps.google.com/?q=${m.clockInLat},${m.clockInLng}`}
                  target="_blank" rel="noreferrer"
                  className="shrink-0 p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  title="View location">
                  <MapPin className="w-4 h-4" />
                </a>
              )}
            </div>
          );
        })}

        {/* Clocked Out */}
        {clockedOut.map((m) => {
          const initials = m.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
          const isSelf = m.id === myId;
          const mins = differenceInMinutes(new Date(m.clockOutAt), new Date(m.clockInAt));
          const h = Math.floor(mins / 60), min = mins % 60;
          return (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 opacity-70"
              data-testid={`team-row-${m.id}`}>
              <div style={{ backgroundColor: avatarColor(m.id) }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight">
                  {m.name}
                  {isSelf && <span className="ml-1.5 text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full align-middle">You</span>}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(m.clockInAt), "h:mm a")} – {format(new Date(m.clockOutAt), "h:mm a")}
                    <span className="font-bold text-foreground ml-1">
                      {h > 0 ? `${h}h ${min}m` : `${min}m`}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Absent / not yet in */}
        {absent.map((m) => {
          const initials = m.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
          const isSelf = m.id === myId;
          return (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 opacity-50"
              data-testid={`team-row-${m.id}`}>
              <div style={{ backgroundColor: avatarColor(m.id) }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 grayscale">
                {initials}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">{m.name}
                  {isSelf && <span className="ml-1.5 text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full align-middle">You</span>}
                </p>
                <p className="text-xs text-muted-foreground">Not clocked in</p>
              </div>
            </div>
          );
        })}

        {!isLoading && roster.length === 0 && (
          <p className="text-center py-6 text-sm text-muted-foreground">No team members found.</p>
        )}
      </div>
    </div>
  );
}

// ─── Clock Hero ───────────────────────────────────────────────────────────────

function ClockHero({ attendance, user, isLoading }: { attendance: any; user: any; isLoading: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [now, setNow] = useState(new Date());
  const [gpsState, setGpsState] = useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const hasRequested = useRef(false);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-request location on mount
  useEffect(() => {
    if (hasRequested.current) return;
    hasRequested.current = true;
    requestLocation();
  }, []);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGpsState("denied");
      return;
    }
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
      toast({ title: "Clocked in ✓", description: `${format(new Date(), "HH:mm")} — location recorded` });
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
      toast({ title: "Clocked out ✓", description: "See you next time!" });
    },
    onError: (e: any) => toast({ title: "Clock-out failed", description: e.message, variant: "destructive" }),
  });

  const isClockedIn = attendance && !attendance.clockOutAt;
  const isClockedOut = attendance && attendance.clockOutAt;
  const isPending = clockInMut.isPending || clockOutMut.isPending || gpsState === "loading";

  // Total work seconds today
  const workedSecs = isClockedOut
    ? Math.floor((new Date(attendance.clockOutAt).getTime() - new Date(attendance.clockInAt).getTime()) / 1000)
    : isClockedIn
    ? Math.floor((now.getTime() - new Date(attendance.clockInAt).getTime()) / 1000)
    : 0;

  // Map URL (OpenStreetMap embed)
  const mapLat = coords?.lat ?? 1.3521; // fallback: Singapore
  const mapLng = coords?.lng ?? 103.8198;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - 0.008},${mapLat - 0.008},${mapLng + 0.008},${mapLat + 0.008}&layer=mapnik&marker=${mapLat},${mapLng}`;

  return (
    <div className="relative w-full" style={{ minHeight: 420 }}>
      {/* Map Background */}
      <div className="absolute inset-0 overflow-hidden">
        {gpsState === "ok" || gpsState === "idle" ? (
          <iframe
            src={mapUrl}
            className="w-full h-full border-0 pointer-events-none"
            title="Location map"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-medium">
                {gpsState === "loading" ? "Getting location…" : "Location access denied"}
              </p>
            </div>
          </div>
        )}
        {/* Gradient overlay at bottom for content readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 pt-16 px-4 flex items-center justify-center">
        <div className="bg-black/50 backdrop-blur-md text-white text-sm font-bold px-4 py-2 rounded-full flex items-center gap-2">
          <Timer className="w-4 h-4" />
          Total work hours today
          <span className="font-mono font-black text-base ml-1">
            {fmtHHMM(workedSecs).slice(0, 5)}
          </span>
        </div>
      </div>

      {/* GPS status indicator */}
      {gpsState === "denied" && (
        <div className="absolute top-28 left-0 right-0 mx-4">
          <div className="bg-red-600/90 backdrop-blur text-white text-xs font-bold px-4 py-2.5 rounded-2xl flex items-center gap-2 max-w-sm mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Location access is required. Please allow in your browser settings and tap retry.
            <button onClick={requestLocation} className="underline ml-1 whitespace-nowrap">Retry</button>
          </div>
        </div>
      )}
      {gpsState === "ok" && (
        <div className="absolute top-28 left-0 right-0 mx-4">
          <div className="bg-emerald-600/80 backdrop-blur text-white text-xs font-bold px-4 py-2.5 rounded-2xl flex items-center gap-2 max-w-xs mx-auto">
            <CheckCircle2 className="w-4 h-4" />
            Location confirmed
          </div>
        </div>
      )}

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 flex flex-col items-center gap-5">
        {/* Status text */}
        <div className="text-center text-white">
          {isClockedIn && (
            <p className="text-sm font-bold bg-emerald-500/80 backdrop-blur px-3 py-1 rounded-full">
              Clocked in at {format(new Date(attendance.clockInAt), "HH:mm")}
            </p>
          )}
          {isClockedOut && (
            <p className="text-sm font-bold bg-slate-800/80 backdrop-blur px-3 py-1 rounded-full">
              {format(new Date(attendance.clockInAt), "HH:mm")} – {format(new Date(attendance.clockOutAt), "HH:mm")} · Done for today
            </p>
          )}
          {!attendance && !isLoading && (
            <p className="text-sm text-white/80">{format(now, "EEE, d MMMM yyyy")}</p>
          )}
        </div>

        {/* Big Clock In / Out button */}
        {!isClockedOut && (
          <button
            onClick={() => isClockedIn ? clockOutMut.mutate() : clockInMut.mutate()}
            disabled={isPending || gpsState === "denied"}
            data-testid={isClockedIn ? "button-clock-out" : "button-clock-in"}
            className={`w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 font-black text-lg shadow-2xl transition-all active:scale-95 disabled:opacity-60 border-4 border-white/30 ${
              isClockedIn
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-[#4A90E2] text-white hover:bg-[#357ABD]"
            }`}
          >
            {isPending ? (
              <>
                <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
                <span className="text-xs font-bold mt-1">Wait…</span>
              </>
            ) : (
              <>
                <Clock className="w-8 h-8" />
                <span className="text-base">{isClockedIn ? "Clock Out" : "Clock In"}</span>
              </>
            )}
          </button>
        )}

        {/* Quick action buttons */}
        <div className="flex gap-3 w-full max-w-xs">
          <Link href="/staff/hr" className="flex-1">
            <div className="bg-white/90 dark:bg-black/60 backdrop-blur rounded-2xl py-3 flex flex-col items-center gap-1 hover:bg-white transition-colors"
              data-testid="button-my-requests">
              <ListTodo className="w-5 h-5 text-amber-500" />
              <span className="text-xs font-bold">My Requests</span>
            </div>
          </Link>
          <Link href="/staff/hr" className="flex-1">
            <div className="bg-white/90 dark:bg-black/60 backdrop-blur rounded-2xl py-3 flex flex-col items-center gap-1 hover:bg-white transition-colors"
              data-testid="button-timesheet">
              <CalendarDays className="w-5 h-5 text-[#4A90E2]" />
              <span className="text-xs font-bold">Timesheet</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({ job, priority, myUserId }: { job: any; priority?: boolean; myUserId?: number }) {
  const isMyJob = job.assignedStaffId && job.assignedStaffId === myUserId;
  const isTeamJob = job.assignedStaffId && job.assignedStaffId !== myUserId;
  const isUnassigned = !job.assignedStaffId && job.status === "booked";

  const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt) : null;
  const dateLabel = scheduledDate
    ? isToday(scheduledDate) ? "Today" : format(scheduledDate, "EEE, MMM d")
    : null;

  return (
    <div className={[
      "bg-card border-2 rounded-3xl shadow-sm overflow-hidden transition-all",
      priority ? "border-orange-300" :
      isMyJob ? "border-primary/60 shadow-md shadow-primary/10" :
      "border-border hover:border-primary/40",
    ].join(" ")}
      data-testid={`job-card-${job.id}`}>
      <div className={`px-5 pt-5 pb-3 ${priority ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}>
        <div className="flex justify-between items-start mb-3">
          <div className="min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-lg leading-tight">{job.customer?.name}</h3>
              {isMyJob && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  <User className="w-2.5 h-2.5" /> Your Job
                </span>
              )}
              {isTeamJob && job.assignedStaff && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full dark:bg-violet-900/30 dark:text-violet-300">
                  <Users className="w-2.5 h-2.5" /> {job.assignedStaff.name}
                </span>
              )}
              {isUnassigned && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  Unassigned
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{job.referenceNo}</p>
          </div>
          <StatusBadge status={job.status} className="scale-90 origin-top-right shrink-0" />
        </div>

        <div className="space-y-1.5 mb-3">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span className="font-medium leading-snug">{job.serviceAddress}</span>
          </div>
          {job.scheduledAt && (
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="w-4 h-4 shrink-0 text-muted-foreground" />
              <span className={["font-semibold", dateLabel === "Today" ? "text-orange-600" : "text-muted-foreground"].join(" ")}>
                {dateLabel} · {job.timeWindow || "TBD"}
              </span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <a href={`tel:${job.customer?.phone}`} data-testid={`call-${job.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border text-xs font-bold hover:bg-secondary transition-colors">
            <Phone className="w-3.5 h-3.5" /> Call
          </a>
          <a href={`https://wa.me/${job.customer?.phone?.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" data-testid={`wa-${job.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
        </div>
      </div>

      <Link href={`/staff/jobs/${job.id}`} data-testid={`view-job-${job.id}`}>
        <div className="px-5 py-3 flex items-center justify-between border-t hover:bg-secondary/50 transition-colors cursor-pointer">
          <span className="text-sm font-bold text-muted-foreground">{job.items?.length || 0} item{job.items?.length !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-1 text-primary font-bold text-sm">
            View & Action <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </div>
  );
}
