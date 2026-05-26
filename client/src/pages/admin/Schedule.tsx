import { useState } from "react";
import { useSchedule, useConfirmBooking, useBlockedSlots, useCreateBlockedSlot, useDeleteBlockedSlot } from "@/hooks/use-quotes";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  CalendarCheck, Clock, MapPin, Phone, CheckCircle2,
  ChevronRight, MessageCircle, Ban, Plus, Trash2, Calendar, X,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { CreateJobModal } from "@/components/admin/CreateJobModal";
import {
  PageShell, PageHeader, PageBody, Card, SectionHeader,
  EmptyState, LoadingState, Button, Pill,
} from "@/components/admin/AdminUI";

const TIME_SLOTS = [
  { value: "09:00-12:00", label: "Morning · 09:00 – 12:00" },
  { value: "13:00-17:00", label: "Afternoon · 13:00 – 17:00" },
];

function getTodayStr() { return format(new Date(), "yyyy-MM-dd"); }

function fmtMoney(n: any) {
  return `$${Number(n || 0).toLocaleString("en-SG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

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
  const [showNewJob, setShowNewJob]   = useState(false);

  const handleConfirm = async (id: number) => {
    try {
      await confirmBooking.mutateAsync(id);
      toast({ title: "Booking confirmed", description: "Confirmation email sent to customer." });
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
      <PageShell>
        <LoadingState label="Loading schedule" />
      </PageShell>
    );
  }

  const { pending = [], confirmed = [] } = (schedule as any) || {};

  const blockedByDate: Record<string, typeof blockedSlots> = {};
  blockedSlots.forEach((slot: any) => {
    if (!blockedByDate[slot.date]) blockedByDate[slot.date] = [];
    blockedByDate[slot.date].push(slot);
  });
  const sortedBlockedDates = Object.keys(blockedByDate).sort();
  const today = getTodayStr();
  const upcomingBlocked = sortedBlockedDates.filter(d => d >= today);
  const pastBlocked     = sortedBlockedDates.filter(d => d < today);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations · Schedule"
        title="Schedule"
        subtitle={
          pending.length > 0
            ? `${pending.length} booking${pending.length > 1 ? "s" : ""} awaiting confirmation${confirmed.length ? ` · ${confirmed.length} upcoming` : ""}`
            : `All bookings confirmed${confirmed.length ? ` · ${confirmed.length} upcoming` : ""}`
        }
        actions={
          <>
            <Button
              variant="outline"
              icon={showForm ? X : Ban}
              onClick={() => setShowForm(v => !v)}
              data-testid="button-add-block"
            >
              {showForm ? "Cancel" : "Block Date"}
            </Button>
            <Button
              variant="ink"
              icon={Plus}
              onClick={() => setShowNewJob(true)}
              data-testid="button-new-job"
            >
              New Job
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap items-end gap-6 sm:gap-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55 mb-1.5">Pending</p>
              <p className={`text-[24px] sm:text-[28px] font-black tabular-nums leading-none tracking-tight ${pending.length > 0 ? "text-[#C1121F]" : "text-[#0A0A0A]"}`}>
                {pending.length}
              </p>
            </div>
            <div className="h-10 w-px bg-black/12" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55 mb-1.5">Confirmed</p>
              <p className="text-[24px] sm:text-[28px] font-black text-[#0A0A0A] tabular-nums leading-none tracking-tight">{confirmed.length}</p>
            </div>
            <div className="h-10 w-px bg-black/12" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55 mb-1.5">Blocked Dates</p>
              <p className="text-[24px] sm:text-[28px] font-black text-[#0A0A0A] tabular-nums leading-none tracking-tight">{upcomingBlocked.length}</p>
            </div>
          </div>
        }
      />

      <PageBody>

        {/* BLOCK DATE FORM */}
        {showForm && (
          <Card className="border-[#C1121F]">
            <div className="flex items-center gap-3 px-4 sm:px-5 h-12 border-b border-[#C1121F]/30 bg-[#FBEBEB]">
              <Ban className="w-3.5 h-3.5 text-[#C1121F]" />
              <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C1121F]">Block a Date</h2>
              <span className="text-[10px] text-[#C1121F]/70 font-bold uppercase tracking-[0.16em] ml-auto">customers can't book this slot</span>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Date *">
                  <input type="date" min={getTodayStr()} value={blockDate}
                    onChange={e => setBlockDate(e.target.value)}
                    className="h-10 w-full px-3 border border-black/20 bg-white text-[12px] text-[#0A0A0A] font-medium focus:outline-none focus:border-[#0A0A0A]"
                    data-testid="input-block-date" />
                </Field>
                <Field label="Time Slot">
                  <select value={blockSlot} onChange={e => setBlockSlot(e.target.value)}
                    className="h-10 w-full px-3 border border-black/20 bg-white text-[12px] text-[#0A0A0A] font-medium focus:outline-none focus:border-[#0A0A0A]"
                    data-testid="select-block-slot">
                    <option value="all">Full Day (both slots)</option>
                    {TIME_SLOTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
                <Field label="Reason">
                  <input type="text" value={blockReason} onChange={e => setBlockReason(e.target.value)}
                    placeholder="e.g. Public holiday"
                    className="h-10 w-full px-3 border border-black/20 bg-white text-[12px] text-[#0A0A0A] font-medium placeholder:text-black/40 focus:outline-none focus:border-[#0A0A0A]"
                    data-testid="input-block-reason" />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="danger" onClick={handleBlock} disabled={createBlocked.isPending || !blockDate} data-testid="button-confirm-block">
                  {createBlocked.isPending ? "Blocking…" : "Confirm Block"}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          </Card>
        )}

        {/* BLOCKED DATES */}
        <Card>
          <SectionHeader
            icon={Ban}
            title="Blocked Dates"
            action={upcomingBlocked.length > 0 ? <Pill tone="urgent">{upcomingBlocked.length} upcoming</Pill> : undefined}
          />
          {upcomingBlocked.length > 0 ? (
            <div className="divide-y divide-black/8">
              {upcomingBlocked.map(date => {
                const slots = blockedByDate[date];
                const isFullDay = slots.some((s: any) => s.timeSlot === null);
                const displayDate = format(new Date(date + "T00:00:00"), "EEEE, MMM d, yyyy");
                const mon = format(new Date(date + "T00:00:00"), "MMM");
                const day = format(new Date(date + "T00:00:00"), "d");
                return (
                  <div key={date} className="flex items-center gap-4 px-4 sm:px-5 py-4">
                    <div className="w-12 h-12 bg-[#FBEBEB] border border-[#C1121F]/25 flex flex-col items-center justify-center text-[#C1121F] shrink-0">
                      <span className="text-[9px] font-black uppercase leading-none tracking-[0.1em]">{mon}</span>
                      <span className="text-[18px] font-black tabular-nums leading-tight mt-0.5">{day}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black uppercase tracking-[0.08em] text-[#0A0A0A]">{displayDate}</p>
                      {isFullDay ? (
                        <p className="text-[10px] text-[#C1121F] font-black uppercase tracking-[0.16em] mt-1">Full Day Blocked</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {slots.map((s: any) => (
                            <Pill key={s.id} tone="urgent">{TIME_SLOTS.find(t => t.value === s.timeSlot)?.label || s.timeSlot}</Pill>
                          ))}
                        </div>
                      )}
                      {slots[0]?.reason && (
                        <p className="text-[11px] text-black/55 mt-1.5 italic">"{slots[0].reason}"</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {slots.map((s: any) => (
                        <button key={s.id} onClick={() => handleUnblock(s.id)} disabled={deleteBlocked.isPending}
                          className="w-8 h-8 flex items-center justify-center text-black/35 hover:text-[#C1121F] hover:bg-[#FBEBEB] transition-colors"
                          title="Remove block" data-testid={`button-unblock-${s.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Calendar} title="No upcoming blocked dates" />
          )}
          {pastBlocked.length > 0 && (
            <p className="text-[10px] text-black/45 font-bold uppercase tracking-[0.18em] px-5 py-3 border-t border-black/8 bg-[#EBE9E2]/40 text-center">
              {pastBlocked.length} past blocked date{pastBlocked.length > 1 ? "s" : ""} not shown
            </p>
          )}
        </Card>

        {/* PENDING CONFIRMATIONS */}
        <Card>
          <SectionHeader
            icon={Clock}
            title="Pending Confirmations"
            badge={pending.length}
            badgeUrgent={pending.length > 0}
          />
          {pending.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No pending booking requests" />
          ) : (
            <div className="divide-y divide-black/8">
              {pending.map((quote: any) => {
                const scheduledDate = quote.scheduledAt ? format(new Date(quote.scheduledAt), "EEEE, MMM d, yyyy") : "TBD";
                return (
                  <div key={quote.id} className="p-4 sm:p-5" data-testid={`pending-booking-${quote.id}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-black/55 tracking-tight">{quote.referenceNo}</span>
                          <StatusBadge status={quote.status} />
                          {quote.rescheduledCount > 0 && (
                            <Pill tone="urgent">Reschedule #{quote.rescheduledCount}</Pill>
                          )}
                        </div>
                        <h3 className="text-[15px] font-black uppercase tracking-[0.04em] text-[#0A0A0A] leading-tight">{quote.customer?.name}</h3>
                        <p className="text-[12px] flex items-start gap-1.5 text-black/65 mt-2 font-medium">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-black/40 mt-px" />{quote.serviceAddress}
                        </p>
                        <p className="text-[11px] flex items-center gap-1.5 text-[#0A0A0A] mt-1.5 font-black uppercase tracking-[0.12em]">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          Requested: {scheduledDate} · {quote.timeWindow}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[16px] font-black text-[#0A0A0A] tabular-nums leading-none">{fmtMoney(quote.total)}</p>
                        <p className="text-[10px] text-black/55 font-bold uppercase tracking-[0.16em] mt-1">{quote.items?.length || 0} items</p>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-black/8 grid sm:grid-cols-3 gap-2">
                      <Button
                        variant="ink"
                        icon={CheckCircle2}
                        onClick={() => handleConfirm(quote.id)}
                        disabled={confirmBooking.isPending}
                        data-testid={`confirm-booking-${quote.id}`}
                      >
                        Confirm Booking
                      </Button>
                      <a href={`tel:${quote.customer?.phone}`} data-testid={`call-${quote.id}`}
                         className="inline-flex items-center justify-center gap-1.5 h-10 px-4 border border-black/25 bg-white text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors text-[11px] font-black uppercase tracking-[0.15em]">
                        <Phone className="w-3.5 h-3.5" /> Call
                      </a>
                      <a href={`https://wa.me/${quote.customer?.phone?.replace(/\D/g, "")}`}
                         target="_blank" rel="noreferrer" data-testid={`whatsapp-${quote.id}`}
                         className="inline-flex items-center justify-center gap-1.5 h-10 px-4 bg-[#25D366] hover:bg-[#1ea855] text-white transition-colors text-[11px] font-black uppercase tracking-[0.15em]">
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    </div>

                    <Link href={`/admin/quotes/${quote.id}`}>
                      <a className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#0A0A0A] transition-colors">
                        View Quote <ChevronRight className="w-3 h-3" />
                      </a>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* CONFIRMED BOOKINGS */}
        <Card>
          <SectionHeader
            icon={CalendarCheck}
            title="Confirmed Schedule"
            badge={confirmed.length}
          />
          {confirmed.length === 0 ? (
            <EmptyState icon={Calendar} title="No confirmed bookings yet" />
          ) : (
            <div className="divide-y divide-black/8">
              {confirmed.map((quote: any) => {
                const scheduledDate = quote.scheduledAt ? format(new Date(quote.scheduledAt), "EEE, MMM d, yyyy") : "TBD";
                const mon = quote.scheduledAt ? format(new Date(quote.scheduledAt), "MMM") : "—";
                const day = quote.scheduledAt ? format(new Date(quote.scheduledAt), "d") : "?";
                return (
                  <Link key={quote.id} href={`/admin/quotes/${quote.id}`} data-testid={`confirmed-booking-${quote.id}`}>
                    <a className="group flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-[#EBE9E2] cursor-pointer transition-colors">
                      <div className="w-11 h-11 bg-[#EBE9E2] border border-black/12 flex flex-col items-center justify-center text-[#0A0A0A] shrink-0">
                        <span className="text-[9px] font-black uppercase leading-none tracking-[0.1em]">{mon}</span>
                        <span className="text-[16px] font-black tabular-nums leading-tight mt-0.5">{day}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-[13px] font-black uppercase tracking-[0.06em] text-[#0A0A0A] truncate leading-tight">{quote.customer?.name}</p>
                          <StatusBadge status={quote.status} />
                        </div>
                        <p className="text-[11px] text-black/55 truncate flex items-center gap-1 font-medium">
                          <MapPin className="w-3 h-3 shrink-0" /> {quote.serviceAddress}
                        </p>
                        <p className="text-[10px] text-[#0A0A0A] mt-1 font-black uppercase tracking-[0.14em] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {scheduledDate} · {quote.timeWindow}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-black text-[#0A0A0A] tabular-nums leading-tight">{fmtMoney(quote.total)}</p>
                        <p className="text-[10px] text-black/45 font-mono mt-0.5 tracking-tight">{quote.referenceNo}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-black/25 group-hover:text-[#0A0A0A] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </a>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

      </PageBody>

      <CreateJobModal open={showNewJob} onClose={() => setShowNewJob(false)} />
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-black/55 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
