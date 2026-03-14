import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MapPin, CalendarDays, ChevronRight, Phone, MessageCircle, User, LogIn, LogOut, Clock, Users } from "lucide-react";
import { format, isToday, differenceInMinutes } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

export default function StaffDashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: quotes, isLoading: jobsLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/quotes"],
  });

  const { data: attendance, isLoading: attLoading } = useQuery<any>({
    queryKey: ["/api/attendance/today"],
    refetchInterval: 30000,
  });

  const isLoading = jobsLoading || attLoading;

  if (isLoading) return (
    <div className="min-h-screen pt-32 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const allJobs = quotes || [];
  const activeNow = allJobs.filter((q: any) => q.status === 'in_progress');
  const upcoming = allJobs
    .filter((q: any) => ['booked', 'assigned'].includes(q.status))
    .sort((a: any, b: any) => {
      const da = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const db = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return da - db;
    });

  const totalVisible = activeNow.length + upcoming.length;

  return (
    <div className="min-h-screen pt-24 pb-20 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">

        <div className="mb-6">
          <h1 className="text-3xl font-display font-black">My Jobs</h1>
          <p className="text-muted-foreground">Active assignments and upcoming schedule</p>
        </div>

        {/* Clock In/Out Widget */}
        <ClockWidget attendance={attendance} userId={user?.id} />

        {/* Active Now */}
        {activeNow.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">🔴 Active Now</h2>
            <div className="space-y-3">
              {activeNow.map((job: any) => (
                <JobCard key={job.id} job={job} priority myUserId={user?.id} />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
              📅 Upcoming ({upcoming.length})
            </h2>
            <div className="space-y-3">
              {upcoming.map((job: any) => (
                <JobCard key={job.id} job={job} myUserId={user?.id} />
              ))}
            </div>
          </section>
        )}

        {totalVisible === 0 && (
          <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed">
            <div className="w-16 h-16 bg-card rounded-full mx-auto flex items-center justify-center mb-4 shadow-sm">
              <CalendarDays className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-lg">No jobs yet</h3>
            <p className="text-muted-foreground text-sm">Jobs will appear here once booked.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ClockWidget({ attendance, userId }: { attendance: any; userId?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [now, setNow] = useState(new Date());
  const [gpsLoading, setGpsLoading] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isClockedIn = attendance && !attendance.clockOutAt;
  const isClockedOut = attendance && attendance.clockOutAt;

  const elapsed = isClockedIn
    ? differenceInMinutes(now, new Date(attendance.clockInAt))
    : isClockedOut
    ? differenceInMinutes(new Date(attendance.clockOutAt), new Date(attendance.clockInAt))
    : 0;

  const fmtDuration = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getGps = (): Promise<{ lat: string; lng: string } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }),
        () => resolve(null),
        { timeout: 8000 }
      );
    });

  const clockInMut = useMutation({
    mutationFn: async () => {
      setGpsLoading(true);
      const gps = await getGps();
      setGpsLoading(false);
      return apiRequest("POST", "/api/attendance/clock-in", { lat: gps?.lat, lng: gps?.lng });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast({ title: "Clocked in", description: `${format(new Date(), "HH:mm")} — have a great day!` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clockOutMut = useMutation({
    mutationFn: async () => {
      setGpsLoading(true);
      const gps = await getGps();
      setGpsLoading(false);
      return apiRequest("POST", "/api/attendance/clock-out", { lat: gps?.lat, lng: gps?.lng });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      toast({ title: "Clocked out", description: `See you tomorrow!` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isPending = clockInMut.isPending || clockOutMut.isPending || gpsLoading;

  return (
    <div className={`mb-8 rounded-3xl border-2 overflow-hidden shadow-sm ${
      isClockedIn ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20"
      : isClockedOut ? "border-border bg-card"
      : "border-border bg-card"
    }`}>
      <div className="px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
            {isClockedIn ? "On the Clock" : isClockedOut ? "Today's Attendance" : "Not Clocked In"}
          </p>
          <p className="text-2xl font-black font-mono tabular-nums">
            {isClockedIn
              ? format(now, "HH:mm:ss")
              : isClockedOut
              ? fmtDuration(elapsed)
              : format(now, "HH:mm")}
          </p>
          {isClockedIn && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
              In at {format(new Date(attendance.clockInAt), "HH:mm")} · {fmtDuration(elapsed)} elapsed
            </p>
          )}
          {isClockedOut && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(attendance.clockInAt), "HH:mm")} – {format(new Date(attendance.clockOutAt), "HH:mm")} · {fmtDuration(elapsed)} worked
            </p>
          )}
          {!attendance && (
            <p className="text-xs text-muted-foreground mt-0.5">{format(now, "EEE, d MMM yyyy")}</p>
          )}
        </div>

        {!isClockedOut && (
          <button
            onClick={() => isClockedIn ? clockOutMut.mutate() : clockInMut.mutate()}
            disabled={isPending}
            data-testid={isClockedIn ? "button-clock-out" : "button-clock-in"}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-60 ${
              isClockedIn
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : isClockedIn ? (
              <><LogOut className="w-4 h-4" /> Clock Out</>
            ) : (
              <><LogIn className="w-4 h-4" /> Clock In</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, priority, myUserId }: { job: any; priority?: boolean; myUserId?: number }) {
  const isMyJob = job.assignedStaffId && job.assignedStaffId === myUserId;
  const isTeamJob = job.assignedStaffId && job.assignedStaffId !== myUserId;
  const isUnassigned = !job.assignedStaffId && job.status === 'booked';

  const scheduledDate = job.scheduledAt ? new Date(job.scheduledAt) : null;
  const dateLabel = scheduledDate
    ? isToday(scheduledDate) ? "Today" : format(scheduledDate, 'EEE, MMM d')
    : null;

  return (
    <div className={[
      "bg-card border-2 rounded-3xl shadow-sm overflow-hidden transition-all",
      priority ? "border-orange-300" :
      isMyJob ? "border-primary/60 shadow-md shadow-primary/10" :
      "border-border hover:border-primary/40"
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
          <a href={`https://wa.me/${job.customer?.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" data-testid={`wa-${job.id}`}
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
