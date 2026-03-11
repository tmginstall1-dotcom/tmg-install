import { useQuotes } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MapPin, CalendarDays, ChevronRight, Phone, MessageCircle } from "lucide-react";
import { format } from "date-fns";

const ACTIVE_STATUSES = ['booked', 'assigned', 'in_progress', 'deposit_paid', 'booking_requested', 'completed', 'final_payment_requested', 'final_paid'];

export default function StaffDashboard() {
  const { data: quotes, isLoading } = useQuotes();

  if (isLoading) return (
    <div className="min-h-screen pt-32 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  // Staff can only see jobs where deposit has been paid (or later statuses)
  const myJobs = (quotes || []).filter((q: any) => ACTIVE_STATUSES.includes(q.status));
  const urgent = myJobs.filter((q: any) => ['assigned', 'in_progress'].includes(q.status));
  const upcoming = myJobs.filter((q: any) => ['booked', 'booking_requested', 'deposit_paid'].includes(q.status));
  const completed = myJobs.filter((q: any) => ['completed', 'final_payment_requested', 'final_paid'].includes(q.status));

  return (
    <div className="min-h-screen pt-24 pb-20 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        
        <div className="mb-8">
          <h1 className="text-3xl font-display font-black">My Jobs</h1>
          <p className="text-muted-foreground">Active assignments and upcoming schedule</p>
        </div>

        {/* Urgent / Today */}
        {urgent.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">🔴 Active Now</h2>
            <div className="space-y-3">
              {urgent.map((job: any) => <JobCard key={job.id} job={job} priority />)}
            </div>
          </section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">📅 Upcoming</h2>
            <div className="space-y-3">
              {upcoming.map((job: any) => <JobCard key={job.id} job={job} />)}
            </div>
          </section>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">✅ Completed</h2>
            <div className="space-y-3">
              {completed.map((job: any) => <JobCard key={job.id} job={job} />)}
            </div>
          </section>
        )}

        {myJobs.length === 0 && (
          <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed">
            <div className="w-16 h-16 bg-card rounded-full mx-auto flex items-center justify-center mb-4 shadow-sm">
              <CalendarDays className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-lg">No active jobs</h3>
            <p className="text-muted-foreground text-sm">You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, priority }: { job: any; priority?: boolean }) {
  return (
    <div className={`bg-card border-2 rounded-3xl shadow-sm overflow-hidden transition-all ${priority ? 'border-orange-300' : 'border-border hover:border-primary/50'}`}
      data-testid={`job-card-${job.id}`}>
      <div className={`px-5 pt-5 pb-3 ${priority ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="font-bold text-lg leading-tight">{job.customer?.name}</h3>
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
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="w-4 h-4 shrink-0" />
              <span>{format(new Date(job.scheduledAt), 'EEE, MMM d')} · {job.timeWindow || 'TBD'}</span>
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
          <span className="text-sm font-bold text-muted-foreground">{job.items?.length || 0} items · ${Number(job.total || 0).toFixed(0)}</span>
          <div className="flex items-center gap-1 text-primary font-bold text-sm">
            View & Action <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </div>
  );
}
