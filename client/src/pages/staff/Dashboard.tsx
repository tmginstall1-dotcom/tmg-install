import { useQuotes } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MapPin, CalendarDays, ChevronRight } from "lucide-react";
import { format } from "date-fns";

export default function StaffDashboard() {
  // In a real app, backend would filter by assignedStaffId based on auth token.
  // We'll fetch all and filter client side for demo, assuming we just show assigned jobs.
  const { data: quotes, isLoading } = useQuotes();

  if (isLoading) return <div className="pt-32 text-center">Loading...</div>;

  const myJobs = quotes?.filter((q: any) => ['assigned', 'in_progress'].includes(q.status)) || [];

  return (
    <div className="min-h-screen pt-24 pb-20 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        
        <div className="mb-8">
          <h1 className="text-3xl font-display font-black">My Jobs</h1>
          <p className="text-muted-foreground">Your schedule for today</p>
        </div>

        <div className="space-y-4">
          {myJobs.map((job: any) => (
            <Link key={job.id} href={`/staff/jobs/${job.id}`}>
              <div className="bg-card border-2 border-border p-5 rounded-3xl shadow-sm hover:border-primary/50 transition-all active:scale-[0.98]">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{job.customer?.name}</h3>
                    <p className="text-sm text-muted-foreground">REF-{job.referenceNo.split('-')[1]}</p>
                  </div>
                  <StatusBadge status={job.status} className="scale-90 origin-top-right" />
                </div>
                
                <div className="space-y-2 mb-5 bg-secondary/50 p-3 rounded-xl">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span className="font-medium">{job.serviceAddress}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="w-4 h-4 shrink-0" />
                    <span>{job.scheduledAt ? format(new Date(job.scheduledAt), 'MMM dd') : 'No Date'} • {job.timeWindow}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-4">
                  <span className="text-sm font-bold text-muted-foreground">{job.items?.length || 0} Items</span>
                  <div className="flex items-center gap-1 text-primary font-bold text-sm">
                    View Details <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {myJobs.length === 0 && (
            <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed">
              <div className="w-16 h-16 bg-card rounded-full mx-auto flex items-center justify-center mb-4 shadow-sm">
                <CalendarDays className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-lg">No active jobs</h3>
              <p className="text-muted-foreground text-sm">You're all caught up for now!</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
