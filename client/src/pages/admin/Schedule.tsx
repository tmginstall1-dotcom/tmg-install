import { useSchedule, useConfirmBooking, useUpdateQuoteStatus } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { format } from "date-fns";
import { ArrowLeft, CalendarCheck, Clock, MapPin, Phone, CheckCircle2, ChevronRight, MessageCircle } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";

export default function AdminSchedule() {
  const { data: schedule, isLoading } = useSchedule();
  const confirmBooking = useConfirmBooking();
  const updateStatus = useUpdateQuoteStatus();
  const { toast } = useToast();

  const handleConfirm = async (id: number) => {
    try {
      await confirmBooking.mutateAsync(id);
      toast({ title: "Booking Confirmed", description: "Confirmation email sent to customer." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-28 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const { pending = [], confirmed = [] } = schedule || {};

  return (
    <div className="min-h-screen pt-28 pb-20 bg-secondary/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <h1 className="text-3xl font-display font-bold mb-8">Schedule Management</h1>

        {/* Pending Confirmations */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold">Pending Confirmations</h2>
            {pending.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs font-bold rounded-full px-2.5 py-0.5">{pending.length}</span>
            )}
          </div>

          <div className="space-y-3">
            {pending.map((quote: any) => {
              const scheduledDate = quote.scheduledAt ? format(new Date(quote.scheduledAt), 'EEEE, MMM d, yyyy') : 'TBD';
              return (
                <div key={quote.id} className="bg-card rounded-2xl border-2 border-amber-200 shadow-sm overflow-hidden" data-testid={`pending-booking-${quote.id}`}>
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-muted-foreground">{quote.referenceNo}</span>
                          <StatusBadge status={quote.status} />
                        </div>
                        <h3 className="font-bold text-lg leading-tight">{quote.customer?.name}</h3>
                        <div className="mt-2 space-y-1">
                          <p className="text-sm flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 shrink-0" /> {quote.serviceAddress}
                          </p>
                          <p className="text-sm flex items-center gap-1.5 font-semibold text-amber-700">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            Requested: <strong>{scheduledDate}</strong> · {quote.timeWindow}
                          </p>
                          {quote.rescheduledCount > 0 && (
                            <p className="text-xs text-amber-600 font-semibold">⚠ Reschedule #{quote.rescheduledCount}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                        <a
                          href={`tel:${quote.customer?.phone}`}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-sm font-bold hover:bg-border transition-colors"
                          data-testid={`call-${quote.id}`}
                        >
                          <Phone className="w-4 h-4" /> Call
                        </a>
                        <a
                          href={`https://wa.me/${quote.customer?.phone?.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors border border-emerald-200"
                          data-testid={`whatsapp-${quote.id}`}
                        >
                          <MessageCircle className="w-4 h-4" /> WA
                        </a>
                        <button
                          onClick={() => handleConfirm(quote.id)}
                          disabled={confirmBooking.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                          data-testid={`confirm-booking-${quote.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4" /> Confirm
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{quote.items?.length || 0} items · ${Number(quote.total || 0).toFixed(2)}</span>
                      <Link href={`/admin/quotes/${quote.id}`} className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline">
                        View Quote <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            {pending.length === 0 && (
              <div className="bg-card rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">
                No pending booking requests
              </div>
            )}
          </div>
        </section>

        {/* Confirmed Bookings */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-bold">Confirmed Schedule</h2>
            <span className="ml-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full px-2.5 py-0.5">{confirmed.length}</span>
          </div>

          <div className="space-y-3">
            {confirmed.map((quote: any) => {
              const scheduledDate = quote.scheduledAt ? format(new Date(quote.scheduledAt), 'EEE, MMM d, yyyy') : 'TBD';
              return (
                <Link key={quote.id} href={`/admin/quotes/${quote.id}`} data-testid={`confirmed-booking-${quote.id}`}>
                  <div className="bg-card rounded-2xl border shadow-sm p-5 hover:border-primary/30 transition-all group cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col items-center justify-center text-emerald-700 shrink-0">
                        <span className="text-xs font-bold leading-none">{quote.scheduledAt ? format(new Date(quote.scheduledAt), 'MMM') : '—'}</span>
                        <span className="text-lg font-black leading-tight">{quote.scheduledAt ? format(new Date(quote.scheduledAt), 'd') : '?'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-bold group-hover:text-primary transition-colors">{quote.customer?.name}</p>
                          <StatusBadge status={quote.status} />
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{quote.serviceAddress}</p>
                        <p className="text-xs font-semibold text-emerald-600 mt-1">{scheduledDate} · {quote.timeWindow}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">${Number(quote.total || 0).toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">{quote.referenceNo}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
            {confirmed.length === 0 && (
              <div className="bg-card rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">
                No confirmed bookings
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
