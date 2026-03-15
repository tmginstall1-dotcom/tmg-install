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
      <div className="min-h-screen pt-14 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-violet-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading schedule…</p>
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
    <div className="min-h-screen pt-14 bg-slate-50 pb-20">

      {/* ── HEADER BAR ──────────────────────────────────────────── */}
      <div className="bg-slate-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors mb-4 uppercase tracking-wider">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Schedule Management</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                {pending.length > 0
                  ? <span className="text-amber-400 font-semibold">{pending.length} booking{pending.length > 1 ? "s" : ""} awaiting confirmation</span>
                  : "All bookings confirmed"
                }
                {confirmed.length > 0 && ` · ${confirmed.length} upcoming`}
              </p>
            </div>
            <button onClick={() => setShowForm(v => !v)}
              data-testid="button-add-block"
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
                showForm
                  ? "bg-white/10 text-white border border-white/20"
                  : "bg-red-600 hover:bg-red-500 text-white shadow-sm shadow-red-900/40"
              }`}>
              {showForm ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Block Date</>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-8 pt-6">

        {/* ── BLOCK DATE FORM ──────────────────────────────────── */}
        {showForm && (
          <div className="bg-white border-2 border-red-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-red-100 bg-red-50/50">
              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Ban className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-sm text-red-800">Block a Date</p>
                <p className="text-xs text-red-500 mt-0.5">Customers won't be able to book this date / time slot</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Date *</label>
                  <input type="date" min={getTodayStr()} value={blockDate}
                    onChange={e => setBlockDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-900/8 outline-none transition-all"
                    data-testid="input-block-date" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Time Slot</label>
                  <select value={blockSlot} onChange={e => setBlockSlot(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-slate-400 outline-none transition-all"
                    data-testid="select-block-slot">
                    <option value="all">Full Day (both slots)</option>
                    {TIME_SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Reason (optional)</label>
                  <input type="text" value={blockReason} onChange={e => setBlockReason(e.target.value)}
                    placeholder="e.g. Public holiday"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:border-slate-400 outline-none transition-all"
                    data-testid="input-block-reason" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleBlock} disabled={createBlocked.isPending || !blockDate}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                  data-testid="button-confirm-block">
                  {createBlocked.isPending ? "Blocking…" : "Confirm Block"}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── BLOCKED DATES ────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <h2 className="font-bold text-base text-slate-800">Blocked Dates</h2>
            {upcomingBlocked.length > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-bold rounded-full px-2.5 py-0.5">
                {upcomingBlocked.length} upcoming
              </span>
            )}
          </div>

          {upcomingBlocked.length > 0 ? (
            <div className="space-y-2">
              {upcomingBlocked.map(date => {
                const slots = blockedByDate[date];
                const isFullDay = slots.some(s => s.timeSlot === null);
                const displayDate = format(new Date(date + "T00:00:00"), "EEEE, MMM d, yyyy");
                const mon = format(new Date(date + "T00:00:00"), "MMM");
                const day = format(new Date(date + "T00:00:00"), "d");
                return (
                  <div key={date} className="bg-white border border-red-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                    <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-200 flex flex-col items-center justify-center text-red-600 shrink-0">
                      <span className="text-[9px] font-black uppercase leading-none">{mon}</span>
                      <span className="text-lg font-black leading-tight">{day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-800">{displayDate}</p>
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
                        <p className="text-xs text-slate-400 mt-1">"{slots[0].reason}"</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {slots.map(s => (
                        <button key={s.id} onClick={() => handleUnblock(s.id)} disabled={deleteBlocked.isPending}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm text-slate-400 font-medium">No upcoming blocked dates</p>
            </div>
          )}

          {pastBlocked.length > 0 && (
            <p className="text-xs text-slate-400 mt-3 text-center">
              {pastBlocked.length} past blocked date{pastBlocked.length > 1 ? "s" : ""} not shown
            </p>
          )}
        </section>

        {/* ── PENDING CONFIRMATIONS ────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <h2 className="font-bold text-base text-slate-800">Pending Confirmations</h2>
            {pending.length > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold rounded-full px-2.5 py-0.5">{pending.length}</span>
            )}
          </div>

          <div className="space-y-3">
            {pending.map((quote: any) => {
              const scheduledDate = quote.scheduledAt ? format(new Date(quote.scheduledAt), "EEEE, MMM d, yyyy") : "TBD";
              return (
                <div key={quote.id} className="bg-white border border-amber-200 rounded-2xl overflow-hidden shadow-sm"
                  data-testid={`pending-booking-${quote.id}`}>
                  <div className="h-1 bg-amber-400" />
                  <div className="p-5">
                    {/* Info row */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-mono font-bold text-slate-400">{quote.referenceNo}</span>
                        <StatusBadge status={quote.status} />
                        {quote.rescheduledCount > 0 && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                            Reschedule #{quote.rescheduledCount}
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 leading-tight">{quote.customer?.name}</h3>
                      <div className="mt-2.5 space-y-1.5">
                        <p className="text-sm flex items-center gap-2 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />{quote.serviceAddress}
                        </p>
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>Requested: <strong>{scheduledDate}</strong> · {quote.timeWindow}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons — confirm prominent, contact secondary */}
                    <div className="mt-4 grid gap-2">
                      <button onClick={() => handleConfirm(quote.id)} disabled={confirmBooking.isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-sm shadow-emerald-900/20"
                        data-testid={`confirm-booking-${quote.id}`}>
                        <CheckCircle2 className="w-4 h-4" /> Confirm Booking
                      </button>
                      <div className="grid grid-cols-2 gap-2">
                        <a href={`tel:${quote.customer?.phone}`}
                          className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition-colors"
                          data-testid={`call-${quote.id}`}>
                          <Phone className="w-3.5 h-3.5" /> Call
                        </a>
                        <a href={`https://wa.me/${quote.customer?.phone?.replace(/\D/g, "")}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition-colors border border-emerald-200"
                          data-testid={`whatsapp-${quote.id}`}>
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      </div>
                    </div>

                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm text-slate-400">
                        {quote.items?.length || 0} items · <span className="font-semibold text-slate-600">${Number(quote.total || 0).toFixed(2)}</span>
                      </span>
                      <Link href={`/admin/quotes/${quote.id}`}
                        className="text-sm font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors">
                        View Quote <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
            {pending.length === 0 && (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400 font-medium">No pending booking requests</p>
              </div>
            )}
          </div>
        </section>

        {/* ── CONFIRMED BOOKINGS ───────────────────────────────── */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h2 className="font-bold text-base text-slate-800">Confirmed Schedule</h2>
            <span className="bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full px-2.5 py-0.5">{confirmed.length}</span>
          </div>

          <div className="space-y-2">
            {confirmed.map((quote: any) => {
              const scheduledDate = quote.scheduledAt ? format(new Date(quote.scheduledAt), "EEE, MMM d, yyyy") : "TBD";
              const mon = quote.scheduledAt ? format(new Date(quote.scheduledAt), "MMM") : "—";
              const day = quote.scheduledAt ? format(new Date(quote.scheduledAt), "d") : "?";
              return (
                <Link key={quote.id} href={`/admin/quotes/${quote.id}`} data-testid={`confirmed-booking-${quote.id}`}>
                  <div className="group bg-white border border-slate-200 rounded-2xl p-4 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col items-center justify-center text-emerald-700 shrink-0">
                      <span className="text-[9px] font-black uppercase leading-none">{mon}</span>
                      <span className="text-lg font-black leading-tight">{day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{quote.customer?.name}</p>
                        <StatusBadge status={quote.status} />
                      </div>
                      <p className="text-xs text-slate-400 truncate">{quote.serviceAddress}</p>
                      <p className="text-xs font-semibold text-emerald-600 mt-0.5">{scheduledDate} · {quote.timeWindow}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-800">${Number(quote.total || 0).toFixed(0)}</p>
                      <p className="text-xs text-slate-400">{quote.referenceNo}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
                  </div>
                </Link>
              );
            })}
            {confirmed.length === 0 && (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400 font-medium">No confirmed bookings yet</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
