import { useParams, useLocation } from "wouter";
import { useQuote, useRequestBooking, useRescheduleBooking, useBlockedSlots } from "@/hooks/use-quotes";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  CheckCircle2, CreditCard, CalendarDays, Receipt, Clock, MapPin,
  RefreshCw, AlertCircle, MessageCircle, Loader2, ArrowRight, Package,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { format, differenceInHours } from "date-fns";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const WHATSAPP_HREF = "https://wa.me/6580880757";
const WHATSAPP_DISPLAY = "+65 8088 0757";

const ALL_SLOTS = [
  { value: "09:00-12:00", label: "Morning (09:00 – 12:00)" },
  { value: "13:00-17:00", label: "Afternoon (13:00 – 17:00)" },
];

function getAvailableSlots(date: string, blockedSlots: { date: string; timeSlot: string | null }[]) {
  if (!date) return ALL_SLOTS;
  const dayBlocks = blockedSlots.filter(b => b.date === date);
  if (dayBlocks.some(b => b.timeSlot === null)) return [];
  const blockedTimes = new Set(dayBlocks.map(b => b.timeSlot));
  return ALL_SLOTS.filter(s => !blockedTimes.has(s.value));
}

function formatMoney(amount: string | number | null | undefined) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(amount || 0));
}

function getTodayPlus1() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

const MONTHS = [
  { v: "01", l: "Jan" }, { v: "02", l: "Feb" }, { v: "03", l: "Mar" },
  { v: "04", l: "Apr" }, { v: "05", l: "May" }, { v: "06", l: "Jun" },
  { v: "07", l: "Jul" }, { v: "08", l: "Aug" }, { v: "09", l: "Sep" },
  { v: "10", l: "Oct" }, { v: "11", l: "Nov" }, { v: "12", l: "Dec" },
];

function daysInMonth(month: string, year: string) {
  if (!month || !year) return 31;
  return new Date(parseInt(year), parseInt(month), 0).getDate();
}

function buildDateStr(day: string, month: string, year: string) {
  if (!day || !month || !year) return "";
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay },
});

export default function QuoteStatus() {
  const params = useParams();
  const id = params.id!;
  const { data: quote, isLoading } = useQuote(id);
  const { toast } = useToast();

  const bookMutation = useRequestBooking();
  const rescheduleMutation = useRescheduleBooking();
  const { data: blockedSlotsList = [] } = useBlockedSlots();

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selDay, setSelDay] = useState("");
  const [selMonth, setSelMonth] = useState("");
  const [selYear, setSelYear] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("payment_success") === "1" && p.get("session_id")) {
      setVerifying(true);
      window.history.replaceState({}, "", window.location.pathname);
      apiRequest("POST", `/api/quotes/${id}/verify-payment`, { session_id: p.get("session_id") })
        .then(() => {
          setPaymentVerified(true);
          queryClient.invalidateQueries({ queryKey: [`/api/quotes/${id}`] });
          toast({ title: "Payment confirmed!", description: "Your payment has been received." });
        })
        .catch(() => {
          toast({ title: "Could not confirm payment", description: "Please contact us on WhatsApp if your payment was charged.", variant: "destructive" });
        })
        .finally(() => setVerifying(false));
    }
  }, []);

  const handleStripeCheckout = async (type: "deposit" | "final") => {
    setCheckoutLoading(true);
    try {
      const res = await apiRequest("GET", `/api/quotes/${id}/checkout?type=${type}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast({ title: "Payment unavailable", description: "Could not create payment link. Please contact us.", variant: "destructive" });
    } catch {
      toast({ title: "Error", description: "Could not start payment. Please try again.", variant: "destructive" });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleBookingRequest = async () => {
    if (!selectedDate || !selectedTime) return toast({ title: "Please select a date and time slot", variant: "destructive" });
    try {
      await bookMutation.mutateAsync({ id, scheduledAt: new Date(selectedDate).toISOString(), timeWindow: selectedTime });
      toast({ title: "Booking Request Sent!", description: "Our team will confirm your slot within 24 hours." });
    } catch (e: any) {
      toast({ title: "Booking Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) return toast({ title: "Please select a new date and time slot", variant: "destructive" });
    try {
      await rescheduleMutation.mutateAsync({ id, scheduledAt: new Date(rescheduleDate).toISOString(), timeWindow: rescheduleTime });
      setShowReschedule(false);
      toast({ title: "Reschedule Requested", description: "Pending admin confirmation. You'll receive a confirmation email." });
    } catch (e: any) {
      toast({ title: "Reschedule Failed", description: e.message, variant: "destructive" });
    }
  };

  const canReschedule = (() => {
    if (quote?.status !== "booked") return false;
    if ((quote?.rescheduledCount || 0) >= 1) return false;
    if (!quote?.scheduledAt) return false;
    return differenceInHours(new Date(quote.scheduledAt), new Date()) >= 24;
  })();

  const rescheduleBlockedReason = (() => {
    if (quote?.status !== "booked") return null;
    if ((quote?.rescheduledCount || 0) >= 1) return "You've already used your free reschedule. Please contact us on WhatsApp.";
    if (!quote?.scheduledAt) return null;
    if (differenceInHours(new Date(quote.scheduledAt), new Date()) < 24)
      return "Your appointment is less than 24 hours away. Please contact us on WhatsApp to reschedule.";
    return null;
  })();

  const statusMessages: Record<string, string> = {
    submitted: "Your quote request has been received and is being reviewed.",
    under_review: "Our team is reviewing your quote.",
    approved: "Your quote is approved! Awaiting deposit request from our team.",
    deposit_requested: "Please pay the deposit to confirm your booking.",
    deposit_paid: "Deposit received! Please select your preferred appointment date.",
    booking_requested: "Your booking request has been sent. We'll confirm your slot shortly.",
    booked: "Your booking is confirmed. Our team will arrive at the scheduled time.",
    assigned: "A team member has been assigned to your job.",
    in_progress: "Your job is currently in progress.",
    completed: "Your job is complete. Please make the final payment.",
    final_payment_requested: "Please complete your final payment.",
    final_paid: "Final payment received. Your case is closing.",
    closed: "Your case is closed. Thank you for choosing TMG Install.",
    cancelled: "This quote has been cancelled.",
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen pt-32 text-center px-4 bg-white">
        <p className="text-xs font-semibold tracking-widest uppercase text-black/40 mb-4" style={{ letterSpacing: "0.15em" }}>Error</p>
        <h2 className="text-3xl font-bold text-black">Quote not found</h2>
        <p className="mt-2 text-black/50">The reference number may be invalid.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-24 bg-white text-black">

      {/* Payment verification overlay */}
      {verifying && (
        <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center">
          <div className="border border-black/12 bg-white p-10 text-center shadow-[0_8px_48px_rgba(0,0,0,0.08)]">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-black" />
            <p className="font-bold text-lg text-black">Confirming your payment…</p>
            <p className="text-black/50 text-sm mt-1">Please wait a moment.</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        {/* Payment verified banner */}
        {paymentVerified && (
          <motion.div {...fadeUp()} className="mb-8 flex items-center gap-3 border border-black/12 px-5 py-4 bg-black/[0.02]">
            <CheckCircle2 className="w-5 h-5 text-black shrink-0" />
            <div>
              <p className="font-bold text-black text-sm">Payment received</p>
              <p className="text-xs text-black/50 mt-0.5">Your payment has been confirmed. You can now book your appointment below.</p>
            </div>
          </motion.div>
        )}

        {/* ═══ HEADER ═══ */}
        <motion.div {...fadeUp()} className="mb-12 border-b border-black/10 pb-10">
          <p className="text-[10px] font-semibold tracking-widest uppercase text-black/35 mb-3" style={{ letterSpacing: "0.18em" }}>
            TMG Install · Quote Reference
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="font-heading text-4xl sm:text-5xl font-black text-black tracking-tight mb-3">
                {quote.referenceNo}
              </h1>
              <StatusBadge status={quote.status} className="text-xs px-3 py-1" />
            </div>
            {statusMessages[quote.status] && (
              <p className="text-sm text-black/50 max-w-xs sm:text-right leading-relaxed">
                {statusMessages[quote.status]}
              </p>
            )}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-[2fr_1fr] gap-8 items-start">

          {/* ═══ LEFT COLUMN ═══ */}
          <div className="space-y-6">

            {/* Itemised Breakdown */}
            <motion.div {...fadeUp(0.05)} className="border border-black/12 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
              <div className="px-6 py-4 border-b border-black/8 flex items-center gap-2">
                <Package className="w-4 h-4 text-black/40" />
                <p className="text-[10px] font-semibold tracking-widest uppercase text-black/60" style={{ letterSpacing: "0.15em" }}>
                  Itemised Breakdown
                </p>
              </div>
              <div className="px-6 py-5 space-y-0">
                {quote.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-start py-3 border-b border-black/6 last:border-0">
                    <div>
                      <p className="font-semibold text-sm text-black">{item.detectedName || item.originalDescription}</p>
                      <p className="text-xs text-black/40 mt-0.5 capitalize">{item.serviceType} · Qty {item.quantity}</p>
                    </div>
                    <p className="font-bold text-sm text-black tabular-nums">{formatMoney(item.subtotal)}</p>
                  </div>
                ))}
                {(!quote.items || quote.items.length === 0) && (
                  <p className="text-black/40 text-sm text-center py-4">No items</p>
                )}
              </div>
              <div className="px-6 pb-5 pt-3 border-t border-black/8 space-y-2">
                <div className="flex justify-between text-xs text-black/45">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatMoney(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-black/45">
                  <span>Transport</span>
                  <span className="tabular-nums">{formatMoney(quote.transportFee)}</span>
                </div>
                <div className="flex justify-between font-black text-base text-black pt-2 border-t border-black/10">
                  <span className="uppercase tracking-wide text-sm" style={{ letterSpacing: "0.08em" }}>Total</span>
                  <span className="tabular-nums">{formatMoney(quote.total)}</span>
                </div>
              </div>
            </motion.div>

            {/* Details */}
            <motion.div {...fadeUp(0.1)} className="border border-black/12 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
              <div className="px-6 py-4 border-b border-black/8 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-black/40" />
                <p className="text-[10px] font-semibold tracking-widest uppercase text-black/60" style={{ letterSpacing: "0.15em" }}>
                  Job Details
                </p>
              </div>
              <div className="px-6 py-5 grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] text-black/35 font-semibold uppercase mb-1.5" style={{ letterSpacing: "0.12em" }}>Name</p>
                  <p className="font-semibold text-sm text-black">{quote.customer?.name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-black/35 font-semibold uppercase mb-1.5" style={{ letterSpacing: "0.12em" }}>Contact</p>
                  <p className="font-semibold text-sm text-black">{quote.customer?.phone}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-[10px] text-black/35 font-semibold uppercase mb-1.5" style={{ letterSpacing: "0.12em" }}>Service Address</p>
                  <p className="font-semibold text-sm text-black">{quote.serviceAddress}</p>
                </div>
                {quote.pickupAddress && (
                  <div>
                    <p className="text-[10px] text-black/35 font-semibold uppercase mb-1.5" style={{ letterSpacing: "0.12em" }}>Pickup</p>
                    <p className="font-semibold text-sm text-black">{quote.pickupAddress}</p>
                  </div>
                )}
                {quote.dropoffAddress && (
                  <div>
                    <p className="text-[10px] text-black/35 font-semibold uppercase mb-1.5" style={{ letterSpacing: "0.12em" }}>Dropoff</p>
                    <p className="font-semibold text-sm text-black">{quote.dropoffAddress}</p>
                  </div>
                )}
              </div>

              {/* Confirmed appointment */}
              {quote.scheduledAt && ["booked", "assigned", "in_progress", "completed", "final_payment_requested"].includes(quote.status) && (
                <div className="mx-6 mb-5 border border-black/12 bg-black/[0.025] p-4">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-black/40 mb-3" style={{ letterSpacing: "0.15em" }}>
                    Confirmed Appointment
                  </p>
                  <div className="flex items-center gap-2 font-bold text-sm text-black">
                    <CalendarDays className="w-4 h-4 text-black/40" />
                    {format(new Date(quote.scheduledAt), "EEEE, MMMM d, yyyy")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-black/60 mt-1.5">
                    <Clock className="w-4 h-4 text-black/40" />
                    {quote.timeWindow}
                  </div>
                </div>
              )}

              {/* Pending booking */}
              {quote.status === "booking_requested" && quote.scheduledAt && (
                <div className="mx-6 mb-5 border border-black/12 bg-black/[0.025] p-4">
                  <p className="text-[10px] font-semibold tracking-widest uppercase text-black/40 mb-3" style={{ letterSpacing: "0.15em" }}>
                    Pending Confirmation
                  </p>
                  <div className="flex items-center gap-2 font-bold text-sm text-black">
                    <CalendarDays className="w-4 h-4 text-black/40" />
                    {format(new Date(quote.scheduledAt), "EEEE, MMMM d, yyyy")}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-black/60 mt-1.5">
                    <Clock className="w-4 h-4 text-black/40" />
                    {quote.timeWindow}
                  </div>
                  <p className="text-xs text-black/40 mt-2">Our team will confirm within 24 hours.</p>
                </div>
              )}

              {/* Reschedule */}
              {quote.status === "booked" && (
                <div className="mx-6 mb-5">
                  {rescheduleBlockedReason ? (
                    <div className="border border-black/12 bg-black/[0.02] p-4 flex items-start gap-3">
                      <AlertCircle className="w-4 h-4 text-black/40 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-black/60">{rescheduleBlockedReason}</p>
                        <a href={WHATSAPP_HREF} target="_blank" rel="noreferrer"
                          className="text-xs font-bold text-black underline mt-1.5 inline-flex items-center gap-1 hover:no-underline">
                          <MessageCircle className="w-3 h-3" /> Contact on WhatsApp
                        </a>
                      </div>
                    </div>
                  ) : canReschedule && !showReschedule ? (
                    <button onClick={() => setShowReschedule(true)} data-testid="button-reschedule"
                      className="flex items-center gap-1.5 text-xs font-semibold text-black/50 hover:text-black transition-colors border border-black/15 px-4 py-2 hover:border-black/30">
                      <RefreshCw className="w-3.5 h-3.5" /> Request Reschedule (1 free)
                    </button>
                  ) : null}

                  {showReschedule && canReschedule && (() => {
                    const slots = getAvailableSlots(rescheduleDate, blockedSlotsList);
                    const blocked = rescheduleDate && slots.length === 0;
                    return (
                      <div className="mt-4 border border-black/10">
                        <div className="px-4 py-3 border-b border-black/8 bg-black/[0.02] flex items-center gap-2">
                          <CalendarDays className="w-3.5 h-3.5 text-black/40" />
                          <p className="text-[10px] font-semibold tracking-widest uppercase text-black/40" style={{ letterSpacing: "0.18em" }}>Select New Date & Time</p>
                        </div>
                        <div className="p-4 space-y-3">
                          <div>
                            <p className="text-[10px] font-semibold tracking-widest uppercase text-black/35 mb-1.5" style={{ letterSpacing: "0.15em" }}>Date</p>
                            <input type="date" min={getTodayPlus1()} value={rescheduleDate}
                              onChange={e => { setRescheduleDate(e.target.value); setRescheduleTime(""); }}
                              className="w-full h-11 px-4 border border-black/15 bg-white text-sm outline-none focus:border-black/40 transition-all"
                              data-testid="input-reschedule-date" />
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold tracking-widest uppercase text-black/35 mb-1.5" style={{ letterSpacing: "0.15em" }}>Time Window</p>
                            {blocked ? (
                              <div className="h-11 flex items-center gap-2 px-4 border border-black/15 bg-black/[0.03]">
                                <AlertCircle className="w-4 h-4 text-black/40 shrink-0" />
                                <p className="text-xs text-black/50">This date is fully booked — choose another</p>
                              </div>
                            ) : (
                              <select value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                                className="w-full h-11 px-4 border border-black/15 bg-white text-sm outline-none focus:border-black/40 transition-all appearance-none"
                                data-testid="select-reschedule-time">
                                <option value="">Select a time window</option>
                                {slots.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                            )}
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button onClick={handleReschedule} disabled={rescheduleMutation.isPending || !!blocked || !rescheduleDate || !rescheduleTime} data-testid="button-confirm-reschedule"
                              className="flex-1 h-11 bg-black text-white text-xs font-bold uppercase tracking-widest disabled:opacity-40 hover:bg-black/85 transition-colors"
                              style={{ letterSpacing: "0.12em" }}>
                              {rescheduleMutation.isPending ? "Sending…" : "Submit Reschedule"}
                            </button>
                            <button onClick={() => setShowReschedule(false)}
                              className="h-11 px-5 border border-black/15 text-xs font-bold hover:border-black/30 transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </motion.div>
          </div>

          {/* ═══ RIGHT SIDEBAR ═══ */}
          <div className="space-y-4">

            {/* Payment Summary — black card */}
            <motion.div {...fadeUp(0.15)} className="bg-black text-white shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden">
              <div className="px-6 py-5 border-b border-white/10">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-white/40" style={{ letterSpacing: "0.18em" }}>
                  Payment Summary
                </p>
              </div>
              <div className="px-6 py-5 space-y-3">
                <div className="flex justify-between text-sm text-white/60">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatMoney(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-white/60">
                  <span>Transport</span>
                  <span className="tabular-nums">{formatMoney(quote.transportFee)}</span>
                </div>
                <div className="flex justify-between border-t border-white/15 pt-3 text-white font-black text-lg">
                  <span className="text-sm uppercase tracking-wide" style={{ letterSpacing: "0.08em" }}>Total</span>
                  <span className="tabular-nums">{formatMoney(quote.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-white/40">
                  <span>50% Deposit</span>
                  <span className={`tabular-nums ${quote.depositPaidAt ? "line-through" : ""}`}>{formatMoney(quote.depositAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-white/40">
                  <span>Balance Due</span>
                  <span className={`tabular-nums ${quote.finalPaidAt ? "line-through" : ""}`}>{formatMoney(quote.finalAmount)}</span>
                </div>
              </div>

              {/* Pay Deposit */}
              {quote.status === "deposit_requested" && (
                <div className="px-6 pb-6 border-t border-white/10 pt-5">
                  <p className="text-xs text-white/50 mb-1">Deposit Required</p>
                  <p className="text-2xl font-black mb-4 tabular-nums">{formatMoney(quote.depositAmount)}</p>
                  <button onClick={() => handleStripeCheckout("deposit")} disabled={checkoutLoading} data-testid="button-pay-deposit"
                    className="w-full bg-white text-black font-bold py-3.5 text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-white/90 transition-colors"
                    style={{ letterSpacing: "0.12em" }}>
                    {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    {checkoutLoading ? "Opening Checkout…" : "Pay Deposit Now"}
                  </button>
                </div>
              )}

              {/* Request Booking */}
              {quote.status === "deposit_paid" && (() => {
                const slots = getAvailableSlots(selectedDate, blockedSlotsList);
                const blocked = selectedDate && slots.length === 0;
                return (
                  <div className="border-t border-white/10">
                    {/* Section header */}
                    <div className="px-6 py-4 border-b border-white/10 flex items-center gap-2">
                      <CalendarDays className="w-3.5 h-3.5 text-white/40" />
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-white/40" style={{ letterSpacing: "0.18em" }}>
                        Choose Appointment
                      </p>
                    </div>

                    <div className="px-6 py-5 space-y-4">
                      {/* Date field — three selects to avoid iOS native date input issues */}
                      {(() => {
                        const minDate = getTodayPlus1(); // "YYYY-MM-DD"
                        const minY = minDate.split("-")[0];
                        const numDays = daysInMonth(selMonth, selYear);
                        const days = Array.from({ length: numDays }, (_, i) => String(i + 1).padStart(2, "0"));

                        const handlePart = (day: string, month: string, year: string) => {
                          const ds = buildDateStr(day, month, year);
                          if (ds && ds < minDate) return; // block past/today
                          setSelectedDate(ds);
                          setSelectedTime("");
                        };

                        const selectCls = "h-12 bg-white/[0.07] border border-white/15 text-white text-sm outline-none focus:border-white/40 transition-all appearance-none text-center";

                        return (
                          <div>
                            <p className="text-[10px] font-semibold tracking-widest uppercase text-white/35 mb-2" style={{ letterSpacing: "0.15em" }}>Date</p>
                            <div className="grid grid-cols-3 gap-2">
                              <select value={selDay} onChange={e => { setSelDay(e.target.value); handlePart(e.target.value, selMonth, selYear); }}
                                className={selectCls} data-testid="select-booking-day">
                                <option value="" className="text-black bg-white">DD</option>
                                {days.map(d => <option key={d} value={d} className="text-black bg-white">{d}</option>)}
                              </select>
                              <select value={selMonth} onChange={e => { setSelMonth(e.target.value); handlePart(selDay, e.target.value, selYear); }}
                                className={selectCls} data-testid="select-booking-month">
                                <option value="" className="text-black bg-white">MM</option>
                                {MONTHS.map(m => <option key={m.v} value={m.v} className="text-black bg-white">{m.l}</option>)}
                              </select>
                              <select value={selYear} onChange={e => { setSelYear(e.target.value); handlePart(selDay, selMonth, e.target.value); }}
                                className={selectCls} data-testid="select-booking-year">
                                <option value="" className="text-black bg-white">YYYY</option>
                                {[minY, String(parseInt(minY) + 1)].map(y => <option key={y} value={y} className="text-black bg-white">{y}</option>)}
                              </select>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Time field */}
                      <div>
                        <p className="text-[10px] font-semibold tracking-widest uppercase text-white/35 mb-2" style={{ letterSpacing: "0.15em" }}>Time Window</p>
                        {blocked ? (
                          <div className="h-12 flex items-center gap-2 px-4 bg-white/[0.07] border border-white/15">
                            <AlertCircle className="w-4 h-4 text-white/50 shrink-0" />
                            <p className="text-xs text-white/50">This date is fully booked — choose another</p>
                          </div>
                        ) : (
                          <select
                            value={selectedTime}
                            onChange={e => setSelectedTime(e.target.value)}
                            className="w-full h-12 px-4 bg-white/[0.07] border border-white/15 text-white text-sm outline-none focus:border-white/40 focus:bg-white/[0.10] transition-all appearance-none"
                            data-testid="select-booking-time"
                          >
                            <option value="" className="text-black bg-white">Select a time window</option>
                            {slots.map(s => <option key={s.value} value={s.value} className="text-black bg-white">{s.label}</option>)}
                          </select>
                        )}
                      </div>

                      {/* Submit */}
                      <div className="pt-1">
                        <button
                          onClick={handleBookingRequest}
                          disabled={bookMutation.isPending || !!blocked || !selectedDate || !selectedTime}
                          data-testid="button-request-booking"
                          className="w-full h-12 bg-white text-black font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 hover:bg-white/90 transition-colors"
                          style={{ letterSpacing: "0.14em" }}
                        >
                          {bookMutation.isPending
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                            : <><span>Request This Slot</span><ArrowRight className="w-4 h-4" /></>
                          }
                        </button>
                        <p className="text-[10px] text-white/25 mt-3 text-center tracking-wide">
                          Our team will confirm within 24 hours
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Booking pending */}
              {quote.status === "booking_requested" && (
                <div className="px-6 pb-6 border-t border-white/10 pt-5 text-center">
                  <Clock className="w-6 h-6 mx-auto mb-2 text-white/40" />
                  <p className="font-bold text-sm">Booking Pending</p>
                  <p className="text-xs text-white/40 mt-1">We'll confirm your slot within 24 hours</p>
                </div>
              )}

              {/* Confirmed booking */}
              {["booked", "assigned", "in_progress"].includes(quote.status) && quote.scheduledAt && (
                <div className="px-6 pb-6 border-t border-white/10 pt-5">
                  <p className="text-xs text-white/40 mb-3 uppercase tracking-widest" style={{ letterSpacing: "0.15em" }}>Confirmed</p>
                  <p className="font-bold text-sm flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-white/50" />
                    {format(new Date(quote.scheduledAt), "MMM d, yyyy")}
                  </p>
                  <p className="font-bold text-sm flex items-center gap-2 mt-1.5 text-white/70">
                    <Clock className="w-4 h-4 text-white/40" />
                    {quote.timeWindow}
                  </p>
                </div>
              )}

              {/* Pay Final */}
              {["completed", "final_payment_requested"].includes(quote.status) && (
                <div className="px-6 pb-6 border-t border-white/10 pt-5">
                  <p className="text-xs text-white/50 mb-1">Balance Due</p>
                  <p className="text-2xl font-black mb-4 tabular-nums">{formatMoney(quote.finalAmount)}</p>
                  <button onClick={() => handleStripeCheckout("final")} disabled={checkoutLoading} data-testid="button-pay-final"
                    className="w-full bg-white text-black font-bold py-3.5 text-sm uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-white/90 transition-colors"
                    style={{ letterSpacing: "0.12em" }}>
                    {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    {checkoutLoading ? "Opening Checkout…" : "Pay Final Balance"}
                  </button>
                </div>
              )}

              {/* Closed */}
              {["closed", "final_paid"].includes(quote.status) && (
                <div className="px-6 pb-6 border-t border-white/10 pt-5 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-white/50" />
                  <p className="font-bold text-sm">All Paid — Case Closed</p>
                  <p className="text-xs text-white/40 mt-1">Thank you for choosing TMG Install</p>
                </div>
              )}
            </motion.div>

            {/* WhatsApp Contact — premium */}
            <motion.div {...fadeUp(0.2)} className="border border-black/12">
              <div className="px-5 py-4 border-b border-black/8">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-black/40" style={{ letterSpacing: "0.15em" }}>
                  Need Help?
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-xs text-black/50 mb-4 leading-relaxed">
                  Our team typically replies within minutes on WhatsApp for urgent assistance.
                </p>
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-whatsapp"
                  className="group flex items-center justify-between w-full px-5 py-4 bg-black text-white hover:bg-black/85 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <SiWhatsapp className="w-5 h-5 text-[#25D366]" />
                    <div>
                      <p className="text-[10px] font-semibold tracking-widest uppercase text-white/50 mb-0.5" style={{ letterSpacing: "0.15em" }}>
                        WhatsApp
                      </p>
                      <p className="font-bold text-sm text-white">Contact Us</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white/70 group-hover:translate-x-0.5 transition-all" />
                </a>
              </div>
            </motion.div>

          </div>
        </div>

      </div>
    </div>
  );
}
