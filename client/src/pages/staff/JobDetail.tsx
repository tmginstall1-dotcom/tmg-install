import { useParams, Link } from "wouter";
import { useQuote, useUpdateQuoteStatus } from "@/hooks/use-quotes";
import { useState } from "react";
import { ArrowLeft, MapPin, Phone, CheckCircle2, Play, Camera, Map } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";

export default function JobDetail() {
  const { id } = useParams();
  const { data: job, isLoading } = useQuote(id!);
  const updateStatus = useUpdateQuoteStatus();

  const [isUploading, setIsUploading] = useState(false);

  if (isLoading) return <div className="pt-32 text-center">Loading...</div>;
  if (!job) return <div className="pt-32 text-center">Not found</div>;

  const handleAction = async (newStatus: string) => {
    let note = "";
    let photoUrl = "";
    
    if (newStatus === 'completed') {
      const confirm = window.confirm("Ready to complete job? Have you taken photos?");
      if(!confirm) return;
      note = prompt("Any final notes?") || "Job completed successfully.";
      // Mock photo upload
      setIsUploading(true);
      await new Promise(r => setTimeout(r, 1000)); 
      photoUrl = "https://example.com/proof.jpg";
      setIsUploading(false);
    }

    try {
      await updateStatus.mutateAsync({ id: id!, status: newStatus, note, photoUrl });
    } catch (e) {
      alert("Failed to update");
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-32 bg-secondary/20">
      <div className="max-w-2xl mx-auto px-4">
        
        <Link href="/staff" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to My Jobs
        </Link>

        <div className="bg-card rounded-[2rem] border shadow-sm overflow-hidden mb-6">
          <div className="p-6 border-b bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
            <div className="flex justify-between items-start mb-4">
              <StatusBadge status={job.status} />
              <span className="text-sm font-bold text-muted-foreground">REF-{job.referenceNo.split('-')[1]}</span>
            </div>
            <h1 className="text-2xl font-display font-bold mb-1">{job.customer?.name}</h1>
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4" /> {job.customer?.phone}
            </p>
          </div>

          <div className="p-6 border-b">
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-1">Location</p>
                <p className="font-bold leading-tight mb-3">{job.serviceAddress}</p>
                <a href={`https://maps.google.com/?q=${job.serviceAddress}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-sm font-bold text-foreground hover:bg-border transition-colors">
                  <Map className="w-4 h-4" /> Open Maps
                </a>
              </div>
            </div>
          </div>

          <div className="p-6">
            <h3 className="font-bold mb-4">Task List ({job.items?.length})</h3>
            <div className="space-y-3">
              {job.items?.map((item: any) => (
                <div key={item.id} className="p-4 rounded-xl border bg-secondary/30 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm">{item.detectedName || item.originalDescription}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.serviceType}</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center font-bold text-sm">
                    x{item.quantity}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Fixed Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t z-40">
          <div className="max-w-2xl mx-auto flex gap-3">
            {job.status === 'assigned' && (
              <button 
                onClick={() => handleAction('in_progress')}
                disabled={updateStatus.isPending}
                className="w-full btn-primary-gradient py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" /> Start Job
              </button>
            )}
            
            {job.status === 'in_progress' && (
              <button 
                onClick={() => handleAction('completed')}
                disabled={updateStatus.isPending || isUploading}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                {isUploading ? "Uploading Proof..." : (
                  <><CheckCircle2 className="w-6 h-6" /> Mark Completed</>
                )}
              </button>
            )}

            {job.status === 'completed' && (
              <div className="w-full py-4 text-center font-bold text-emerald-600 bg-emerald-50 rounded-2xl border border-emerald-200">
                Job Finished Successfully
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
