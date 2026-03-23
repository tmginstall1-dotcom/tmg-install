import { useState } from "react";
import { useSchedule, useConfirmBooking, useBlockedSlots, useCreateBlockedSlot, useDeleteBlockedSlot } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { format, addDays } from "date-fns";
import {
  ArrowLeft, CalendarCheck, Clock, MapPin, Phone, CheckCircle2,
  ChevronRight, MessageCircle, Ban, Plus, Trash2, Calendar, AlertCircle, X,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";

const TIME_SLOTS = [
  { value: "09:00-12:00", label: "Morning  09:00 – 12:00" },
  { value: "13:00-17:00", label: "Afternoon  13:00 – 17:00" },
];

function getTodayStr() { return format(new Date(), "yyyy-MM-dd"); }

export default function AdminSchedule() {
  const { data: schedule, isLoading } = useSchedule();
  const { data: blockedSlots = [] } = useBlockedSlots();
  const confirmBooking = useConfirmBooking();
  const createBlocked  = useCreateBlockedSlot();
  const deleteBlocked  = useDeleteBlockedSlot();
  const { toast } = useToast();

  const [blockDate, setBlockDate]     = useState("");
  const [blockSlot, setBlockSlot]     = useState<string>("all");
  const [blockReason, setBlockReason] = useState("");
  const [showForm, setShowForm]       = useState(false);

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
      toast({ title: "Date blocked" });
      setBlockDate(""); setBlockSlot("all"); setBlockReason(""); setShowForm(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleUnblock = async (id: number) => {
    try { await deleteBlocked.mutateAsync(id); toast({ title: "Block removed" }); }
    catch { toast({ title: "Error removing block", variant: "destructive" }); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center bg-[#F5F5F7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading schedule…</p>
        </div>
      </div>
    );
  }

  const { pending = [], confirmed = [] } = schedule || {};

  const blockedByDate: Record<string, typeof blockedSlots> = {};
  blockedSlots.forEach(slot => {
    if (!blockedByDate[slot.date]) blockedByDate[slot.date] = [];
    blockedByDate[slot.date].push(slot);
  });
  const sortedBlockedDates = Object.keys(blockedByDate).sort();
  const today = getTodayStr();
  const upcomingBlocked = sortedBlockedDates.filter(d => d >= today);
  const pastBlocked     = sortedBlockedDates.filter(d => d < today);

  return (
    <div className="min-h-screen pt-14 pb-16 lg:pl-56 bg-[#F5F5F7] overflow-x-hidden">

      {/* ── HEADER BAR ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <Link href="/admin" className="inline-flex items-center text-xs text-zinc-400 mb-1 hover:text-zinc-700 transition-colors">
            Operations → Schedule
          </Link>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900">Schedule</h1>
              <p className="text-zinc-500 text-sm mt-1">
                {pending.length > 0
                  ? <span className="text-amber-600 font-medium">{pending.length} booking{pending.length > 1 ? "s" : ""} awaiting confirmation</span>
                  : "All bookings confirmed"
                }
                {confirmed.length > 0 && ` · ${confirmed.length} upcoming`}
              </p>
            </div>
            <button onClick={() => setShowForm(v => !v)}
              data-testid="button-add-block"
              className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors shrink-0 ${
                showForm
                  ? "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}>
              {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Block Date</>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── BLOCK DATE FORM ──────────────────────────────────── */}
        {showForm && (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 bg-red-50/50">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Ban className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-800">Block a Date</p>
                <p className="text-xs text-red-500 mt-0.5">Customers won't be able to book this date / time slot</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Date *</label>
                  <input type="date" min={getTodayStr()} value={blockDate}
                    onChange={e => setBlockDate(e.target.value)}
                    className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    data-testid="input-block-date" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Time Slot</label>
                  <select value={blockSlot} onChange={e => setBlockSlot(e.target.value)}
                    className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    data-testid="select-block-slot">
                    <option value="all">Full Day (both slots)</option>
                    {TIME_SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 mb-1">Reason (optional)</label>
                  <input type="text" value={blockReason} onChange={e => setBlockReason(e.target.value)}
                    placeholder="e.g. Public holiday"
                    className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    data-testid="input-block-reason" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleBlock} disabled={createBlocked.isPending || !blockDate}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  data-testid="button-confirm-block">
                  {createBlocked.isPending ? "Blocking…" : "Confirm Block"}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BLOCKED DATES ────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-2">
            <h2 className="text-sm font-semibold text-zinc-900">Blocked Dates</h2>
            {upcomingBlocked.length > 0 && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-red-50 text-red-700">
                {upcomingBlocked.length} upcoming
              </span>
            )}
          </div>

          {upcomingBlocked.length > 0 ? (
            <div className="space-y-3">
              {upcomingBlocked.map(date => {
                const slots = blockedByDate[date];
                const isFullDay = slots.some(s => s.timeSlot === null);
                const displayDate = format(new Date(date + "T00:00:00"), "EEEE, MMM d, yyyy");
                const mon = format(new Date(date + "T00:00:00"), "MMM");
                const day = format(new Date(date + "T00:00:00"), "d");
                return (
                  <div key={date} className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-lg flex flex-col items-center justify-center text-red-600 shrink-0">
                      <span className="text-[10px] font-bold uppercase leading-none">{mon}</span>
                      <span className="text-lg font-black leading-tight">{day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-zinc-900">{displayDate}</p>
                      {isFullDay ? (
                        <p className="text-xs text-red-600 font-medium mt-0.5">Full Day Blocked</p>
                      ) : (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {slots.map(s => (
                            <span key={s.id} className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-red-50 text-red-700">
                              {TIME_SLOTS.find(t => t.value === s.timeSlot)?.label || s.timeSlot}
                            </span>
                          ))}
                        </div>
                      )}
                      {slots[0]?.reason && (
                        <p className="text-xs text-zinc-500 mt-1">"{slots[0].reason}"</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {slots.map(s => (
                        <button key={s.id} onClick={() => handleUnblock(s.id)} disabled={deleteBlocked.isPending}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remove block" data-testid={`button-unblock-${s.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-zinc-200 rounded-xl p-8 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
              <p className="text-sm text-zinc-500 font-medium">No upcoming blocked dates</p>
            </div>
          )}

          {pastBlocked.length > 0 && (
            <p className="text-xs text-zinc-400 mt-4 text-center">
              {pastBlocked.length} past blocked date{pastBlocked.length > 1 ? "s" : ""} not shown
            </p>
          )}
        </section>

        {/* ── PENDING CONFIRMATIONS ────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-2">
            <h2 className="text-sm font-semibold text-zinc-900">Pending Confirmations</h2>
            {pending.length > 0 && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-700">{pending.length}</span>
            )}
          </div>

          <div className="space-y-4">
            {pending.map((quote: any) => {
              const scheduledDate = quote.scheduledAt ? format(new Date(quote.scheduledAt), "EEEE, MMM d, yyyy") : "TBD";
              return (
                <div key={quote.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm"
                  data-testid={`pending-booking-${quote.id}`}>
                  <div className="h-1 bg-amber-400" />
                  <div className="p-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-mono font-medium text-zinc-500">{quote.referenceNo}</span>
                        <StatusBadge status={quote.status} />
                        {quote.rescheduledCount > 0 && (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-orange-100 text-orange-700">
                            Reschedule #{quote.rescheduledCount}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg text-zinc-900 leading-tight">{quote.customer?.name}</h3>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm flex items-center gap-2 text-zinc-600">
                          <MapPin className="w-4 h-4 shrink-0 text-zinc-400" />{quote.serviceAddress}
                        </p>
                        <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>Requested: <strong className="font-semibold">{scheduledDate}</strong> · {quote.timeWindow}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid sm:grid-cols-2 gap-3 border-t border-zinc-100 pt-4">
                      <button onClick={() => handleConfirm(quote.id)} disabled={confirmBooking.isPending}
                        className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                        data-testid={`confirm-booking-${quote.id}`}>
                        <CheckCircle2 className="w-4 h-4" /> Confirm Booking
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <a href={`tel:${quote.customer?.phone}`}
                          className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors"
                          data-testid={`call-${quote.id}`}>
                          <Phone className="w-4 h-4" /> Call
                        </a>
                        <a href={`https://wa.me/${quote.customer?.phone?.replace(/\D/g, "")}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-medium transition-colors"
                          data-testid={`whatsapp-${quote.id}`}>
                          <MessageCircle className="w-4 h-4" /> WhatsApp
                        </a>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-sm text-zinc-500">
                        {quote.items?.length || 0} items · <span className="font-semibold text-zinc-900">${Number(quote.total || 0).toFixed(2)}</span>
                      </span>
                      <Link href={`/admin/quotes/${quote.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                        View Quote <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            {pending.length === 0 && (
              <div className="bg-white border border-dashed border-zinc-200 rounded-xl p-8 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                <p className="text-sm text-zinc-500 font-medium">No pending booking requests</p>
              </div>
            )}
          </div>
        </section>

        {/* ── CONFIRMED BOOKINGS ───────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-2">
            <h2 className="text-sm font-semibold text-zinc-900">Confirmed Schedule</h2>
            {confirmed.length > 0 && (
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700">{confirmed.length}</span>
            )}
          </div>

          <div className="space-y-3">
            {confirmed.map((quote: any) => {
              const scheduledDate = quote.scheduledAt ? format(new Date(quote.scheduledAt), "EEE, MMM d, yyyy") : "TBD";
              const mon = quote.scheduledAt ? format(new Date(quote.scheduledAt), "MMM") : "—";
              const day = quote.scheduledAt ? format(new Date(quote.scheduledAt), "d") : "?";
              return (
                <Link key={quote.id} href={`/admin/quotes/${quote.id}`} data-testid={`confirmed-booking-${quote.id}`}>
                  <div className="group bg-white border border-zinc-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-lg flex flex-col items-center justify-center text-emerald-700 shrink-0">
                      <span className="text-[10px] font-bold uppercase leading-none">{mon}</span>
                      <span className="text-lg font-black leading-tight">{day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-semibold text-zinc-900 group-hover:text-emerald-700 transition-colors">{quote.customer?.name}</p>
                        <StatusBadge status={quote.status} />
                      </div>
                      <p className="text-sm text-zinc-500 truncate flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {quote.serviceAddress}</p>
                      <p className="text-sm font-medium text-emerald-600 mt-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {scheduledDate} · {quote.timeWindow}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-zinc-900">${Number(quote.total || 0).toFixed(0)}</p>
                      <p className="text-xs text-zinc-400 font-mono">{quote.referenceNo}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                  </div>
                </Link>
              );
            })}
            {confirmed.length === 0 && (
              <div className="bg-white border border-dashed border-zinc-200 rounded-xl p-8 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                <p className="text-sm text-zinc-500 font-medium">No confirmed bookings yet</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
