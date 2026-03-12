import { useState } from "react";
import { useSchedule, useConfirmBooking, useBlockedSlots, useCreateBlockedSlot, useDeleteBlockedSlot } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { format, addDays } from "date-fns";
import { ArrowLeft, CalendarCheck, Clock, MapPin, Phone, CheckCircle2, ChevronRight, MessageCircle, Ban, Plus, Trash2, Calendar, AlertCircle } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";

const TIME_SLOTS = [
  { value: "09:00-12:00", label: "Morning (09:00 – 12:00)" },
  { value: "13:00-17:00", label: "Afternoon (13:00 – 17:00)" },
];

function getTodayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

export default function AdminSchedule() {
  const { data: schedule, isLoading } = useSchedule();
  const { data: blockedSlots = [] } = useBlockedSlots();
  const confirmBooking = useConfirmBooking();
  const createBlocked = useCreateBlockedSlot();
  const deleteBlocked = useDeleteBlockedSlot();
  const { toast } = useToast();

  const [blockDate, setBlockDate] = useState("");
  const [blockSlot, setBlockSlot] = useState<string>("all");
  const [blockReason, setBlockReason] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleConfirm = async (id: number) => {
    try {
      await confirmBooking.mutateAsync(id);
      toast({ title: "Booking Confirmed", description: "Confirmation email sent to customer." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleBlock = async () => {
    if (!blockDate) return toast({ title: "Select a date", variant: "destructive" });
    try {
      await createBlocked.mutateAsync({
        date: blockDate,
        timeSlot: blockSlot === "all" ? null : blockSlot,
        reason: blockReason.trim() || undefined,
      });
      toast({ title: "Date blocked", description: `${blockDate}${blockSlot !== "all" ? ` — ${TIME_SLOTS.find(s => s.value === blockSlot)?.label}` : " (full day)"}` });
      setBlockDate("");
      setBlockSlot("all");
      setBlockReason("");
      setShowForm(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleUnblock = async (id: number) => {
    try {
      await deleteBlocked.mutateAsync(id);
      toast({ title: "Block removed" });
    } catch {
      toast({ title: "Error removing block", variant: "destructive" });
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

  // Group blocked slots by date for display
  const blockedByDate: Record<string, typeof blockedSlots> = {};
  blockedSlots.forEach(slot => {
    if (!blockedByDate[slot.date]) blockedByDate[slot.date] = [];
    blockedByDate[slot.date].push(slot);
  });
  const sortedBlockedDates = Object.keys(blockedByDate).sort();
  // Only show future/today blocks
  const today = getTodayStr();
  const upcomingBlocked = sortedBlockedDates.filter(d => d >= today);
  const pastBlocked = sortedBlockedDates.filter(d => d < today);

  return (
    <div className="min-h-screen pt-28 pb-20 bg-secondary/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <h1 className="text-3xl font-display font-bold mb-8">Schedule Management</h1>

        {/* ─── BLOCK DATES SECTION ──────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                <Ban className="w-4 h-4" />
              </div>
              <h2 className="text-xl font-bold">Blocked Dates</h2>
              {upcomingBlocked.length > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-bold rounded-full px-2.5 py-0.5">
                  {upcomingBlocked.length} upcoming
                </span>
              )}
            </div>
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-bold hover:opacity-90 transition-opacity"
              data-testid="button-add-block"
            >
              <Plus className="w-4 h-4" />
              Block Date
            </button>
          </div>

          {/* Add block form */}
          {showForm && (
            <div className="bg-card border-2 border-red-200 rounded-2xl p-5 mb-4 space-y-4">
              <h3 className="font-bold text-sm flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                Customers will not be able to book this date / time slot
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date *</label>
                  <input
                    type="date"
                    min={getTodayStr()}
                    value={blockDate}
                    onChange={e => setBlockDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border bg-secondary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    data-testid="input-block-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time Slot</label>
                  <select
                    value={blockSlot}
                    onChange={e => setBlockSlot(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border bg-secondary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    data-testid="select-block-slot"
                  >
                    <option value="all">Full Day (both slots)</option>
                    {TIME_SLOTS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reason (optional)</label>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    placeholder="e.g. Public holiday"
                    className="w-full px-3 py-2.5 rounded-xl border bg-secondary text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    data-testid="input-block-reason"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleBlock}
                  disabled={createBlocked.isPending || !blockDate}
                  className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                  data-testid="button-confirm-block"
                >
                  {createBlocked.isPending ? "Blocking…" : "Confirm Block"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2 rounded-xl bg-secondary text-sm font-semibold hover:bg-border transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Upcoming blocked list */}
          {upcomingBlocked.length > 0 ? (
            <div className="space-y-2">
              {upcomingBlocked.map(date => {
                const slots = blockedByDate[date];
                const isFullDay = slots.some(s => s.timeSlot === null);
                const displayDate = format(new Date(date + "T00:00:00"), "EEEE, MMM d, yyyy");
                return (
                  <div key={date} className="bg-card border border-red-200 rounded-2xl p-4 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex flex-col items-center justify-center text-red-600 shrink-0">
                        <span className="text-xs font-bold leading-none">{format(new Date(date + "T00:00:00"), "MMM")}</span>
                        <span className="text-base font-black leading-tight">{format(new Date(date + "T00:00:00"), "d")}</span>
                      </div>
                      <div>
                        <p className="font-bold text-sm">{displayDate}</p>
                        {isFullDay ? (
                          <p className="text-xs text-red-600 font-semibold mt-0.5">Full Day Blocked</p>
                        ) : (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {slots.map(s => (
                              <span key={s.id} className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                                {TIME_SLOTS.find(t => t.value === s.timeSlot)?.label || s.timeSlot}
                              </span>
                            ))}
                          </div>
                        )}
                        {slots[0]?.reason && (
                          <p className="text-xs text-muted-foreground mt-1">Reason: {slots[0].reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {slots.map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleUnblock(s.id)}
                          disabled={deleteBlocked.isPending}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove block"
                          data-testid={`button-unblock-${s.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-card rounded-2xl border-2 border-dashed p-8 text-center text-muted-foreground">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No upcoming blocked dates</p>
            </div>
          )}

          {/* Expired blocks (collapsed) */}
          {pastBlocked.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              {pastBlocked.length} past blocked date{pastBlocked.length > 1 ? "s" : ""} not shown
            </p>
          )}
        </section>

        {/* ─── PENDING CONFIRMATIONS ────────────────────────────── */}
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
                        <a href={`tel:${quote.customer?.phone}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-sm font-bold hover:bg-border transition-colors" data-testid={`call-${quote.id}`}>
                          <Phone className="w-4 h-4" /> Call
                        </a>
                        <a href={`https://wa.me/${quote.customer?.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors border border-emerald-200" data-testid={`whatsapp-${quote.id}`}>
                          <MessageCircle className="w-4 h-4" /> WA
                        </a>
                        <button onClick={() => handleConfirm(quote.id)} disabled={confirmBooking.isPending} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50" data-testid={`confirm-booking-${quote.id}`}>
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

        {/* ─── CONFIRMED BOOKINGS ───────────────────────────────── */}
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
