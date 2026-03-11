import { useParams } from "wouter";
import { useQuote, useUpdateQuotePayment, useRequestBooking, useRescheduleBooking } from "@/hooks/use-quotes";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CheckCircle2, CreditCard, CalendarDays, Receipt, Clock, MapPin, RefreshCw, AlertCircle, MessageCircle } from "lucide-react";
import { format, differenceInHours } from "date-fns";
import { useState } from "react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

function formatMoney(amount: string | number | null | undefined) {
  return new Intl.NumberFormat('en-SG', { style: 'currency', currency: 'SGD' }).format(Number(amount || 0));
}

function getTodayPlus1() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function QuoteStatus() {
  const params = useParams();
  const id = params.id!;
  const { data: quote, isLoading } = useQuote(id);
  const { toast } = useToast();
  
  const payMutation = useUpdateQuotePayment();
  const bookMutation = useRequestBooking();
  const rescheduleMutation = useRescheduleBooking();
  
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen pt-32 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen pt-32 text-center px-4">
        <h2 className="text-3xl font-bold text-foreground">Quote not found</h2>
        <p className="mt-2 text-muted-foreground">The reference number might be invalid.</p>
      </div>
    );
  }

  const handlePayDeposit = async () => {
    try {
      await payMutation.mutateAsync({ id, paymentType: 'deposit', amount: quote.depositAmount?.toString() || "0" });
      toast({ title: "Deposit Paid!", description: "You'll receive a booking link via email." });
    } catch (e: any) {
      toast({ title: "Payment Failed", description: e.message, variant: "destructive" });
    }
  };

  const handlePayFinal = async () => {
    try {
      await payMutation.mutateAsync({ id, paymentType: 'final', amount: quote.finalAmount?.toString() || "0" });
      toast({ title: "Payment Complete!", description: "Your case is now closed. Thank you!" });
    } catch (e: any) {
      toast({ title: "Payment Failed", description: e.message, variant: "destructive" });
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

  // Reschedule eligibility checks
  const canReschedule = (() => {
    if (quote.status !== 'booked') return false;
    if ((quote.rescheduledCount || 0) >= 1) return false;
    if (!quote.scheduledAt) return false;
    const hoursUntil = differenceInHours(new Date(quote.scheduledAt), new Date());
    return hoursUntil >= 24;
  })();

  const rescheduleBlockedReason = (() => {
    if (quote.status !== 'booked') return null;
    if ((quote.rescheduledCount || 0) >= 1) return "You've already used your free reschedule. Please contact us on WhatsApp.";
    if (!quote.scheduledAt) return null;
    const hoursUntil = differenceInHours(new Date(quote.scheduledAt), new Date());
    if (hoursUntil < 24) return "Your appointment is less than 24 hours away. Please contact us on WhatsApp to reschedule.";
    return null;
  })();

  const statusMessages: Record<string, string> = {
    submitted: "Your quote request has been received and is being reviewed.",
    under_review: "Our team is reviewing your quote.",
    approved: "Your quote is approved! Awaiting deposit request from our team.",
    deposit_requested: "Please pay the deposit to confirm your booking.",
    deposit_paid: "Deposit received! Please select your preferred appointment date.",
    booking_requested: "Your booking request has been sent. We'll confirm your slot shortly.",
    booked: "Your booking is confirmed! Our team will arrive at the scheduled time.",
    assigned: "A team member has been assigned to your job.",
    in_progress: "Your job is currently in progress.",
    completed: "Your job is complete! Please make the final payment.",
    final_payment_requested: "Please complete your final payment.",
    final_paid: "Final payment received. Your case is closing.",
    closed: "Your case is closed. Thank you for choosing TMG Install!",
    cancelled: "This quote has been cancelled.",
  };

  return (
    <div className="min-h-screen pt-28 pb-20 bg-secondary/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg shadow-black/5 mb-6 border">
            <Receipt className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-4 text-foreground">{quote.referenceNo}</h1>
          <StatusBadge status={quote.status} className="text-sm px-4 py-2" />
          {statusMessages[quote.status] && (
            <p className="mt-4 text-muted-foreground max-w-md mx-auto">{statusMessages[quote.status]}</p>
          )}
        </div>

        <div className="grid md:grid-cols-[2fr_1fr] gap-8">
          {/* Main Details */}
          <div className="space-y-6">
            {/* Items */}
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-card rounded-3xl p-8 shadow-sm border">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <CheckCircle2 className="text-primary w-6 h-6" /> Itemised Breakdown
              </h3>
              <div className="space-y-3">
                {quote.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-start pb-3 border-b border-border/50 last:border-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-foreground">{item.detectedName || item.originalDescription}</p>
                      <p className="text-sm text-muted-foreground capitalize">{item.serviceType} · Qty: {item.quantity}</p>
                    </div>
                    <div className="font-bold text-base">{formatMoney(item.subtotal)}</div>
                  </div>
                ))}
                {(!quote.items || quote.items.length === 0) && (
                  <p className="text-muted-foreground text-sm text-center py-2">No items</p>
                )}
              </div>
              <div className="mt-6 pt-4 border-t space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatMoney(quote.subtotal)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Transport</span><span>{formatMoney(quote.transportFee)}</span></div>
                <div className="flex justify-between font-black text-lg pt-2 border-t"><span>Total</span><span>{formatMoney(quote.total)}</span></div>
              </div>
            </motion.div>

            {/* Details */}
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="bg-card rounded-3xl p-8 shadow-sm border">
              <h3 className="text-xl font-bold mb-5 flex items-center gap-2">
                <MapPin className="text-accent w-6 h-6" /> Details
              </h3>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Your Name</p>
                  <p className="font-semibold">{quote.customer?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Contact</p>
                  <p className="font-semibold">{quote.customer?.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Service Address</p>
                  <p className="font-semibold">{quote.serviceAddress}</p>
                </div>
                {quote.pickupAddress && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pickup Address</p>
                    <p className="font-semibold">{quote.pickupAddress}</p>
                  </div>
                )}
                {quote.dropoffAddress && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Dropoff Address</p>
                    <p className="font-semibold">{quote.dropoffAddress}</p>
                  </div>
                )}
              </div>

              {/* Confirmed booking details */}
              {quote.scheduledAt && ['booked', 'assigned', 'in_progress', 'completed', 'final_payment_requested'].includes(quote.status) && (
                <div className="mt-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <p className="text-xs font-bold text-emerald-700 mb-2">✅ CONFIRMED APPOINTMENT</p>
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <CalendarDays className="w-4 h-4" />
                    {format(new Date(quote.scheduledAt), 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className="flex items-center gap-2 font-semibold text-emerald-700 mt-1">
                    <Clock className="w-4 h-4" />
                    {quote.timeWindow}
                  </div>
                </div>
              )}

              {/* Pending booking confirmation */}
              {quote.status === 'booking_requested' && quote.scheduledAt && (
                <div className="mt-5 p-4 rounded-2xl bg-blue-50 border border-blue-200">
                  <p className="text-xs font-bold text-blue-700 mb-2">⏳ PENDING ADMIN CONFIRMATION</p>
                  <div className="flex items-center gap-2 font-bold text-blue-800">
                    <CalendarDays className="w-4 h-4" />
                    {format(new Date(quote.scheduledAt), 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className="flex items-center gap-2 text-blue-700 mt-1">
                    <Clock className="w-4 h-4" />
                    {quote.timeWindow}
                  </div>
                  <p className="text-xs text-blue-600 mt-2">Our team will confirm your slot within 24 hours.</p>
                </div>
              )}

              {/* Reschedule section */}
              {quote.status === 'booked' && (
                <div className="mt-5">
                  {rescheduleBlockedReason ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-700">{rescheduleBlockedReason}</p>
                        <a href="https://wa.me/6580880757" target="_blank" rel="noreferrer"
                          className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1 hover:underline">
                          <MessageCircle className="w-3 h-3" /> Contact on WhatsApp
                        </a>
                      </div>
                    </div>
                  ) : canReschedule && !showReschedule ? (
                    <button onClick={() => setShowReschedule(true)} data-testid="button-reschedule"
                      className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      <RefreshCw className="w-4 h-4" /> Request Reschedule (1 free)
                    </button>
                  ) : null}

                  {showReschedule && canReschedule && (
                    <div className="mt-3 p-4 rounded-2xl bg-secondary border">
                      <p className="text-sm font-bold mb-3">Select New Date & Time</p>
                      <input type="date" min={getTodayPlus1()} value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border bg-background text-sm mb-2 outline-none focus:border-primary"
                        data-testid="input-reschedule-date" />
                      <select value={rescheduleTime} onChange={e => setRescheduleTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border bg-background text-sm mb-3 outline-none focus:border-primary"
                        data-testid="select-reschedule-time">
                        <option value="">Select time window</option>
                        <option value="09:00-12:00">Morning (09:00 - 12:00)</option>
                        <option value="13:00-17:00">Afternoon (13:00 - 17:00)</option>
                      </select>
                      <div className="flex gap-2">
                        <button onClick={handleReschedule} disabled={rescheduleMutation.isPending} data-testid="button-confirm-reschedule"
                          className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-bold disabled:opacity-50">
                          {rescheduleMutation.isPending ? "Sending..." : "Submit Reschedule"}
                        </button>
                        <button onClick={() => setShowReschedule(false)} className="px-4 py-2 rounded-xl border text-sm font-bold hover:bg-background transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar Action Area */}
          <div className="space-y-5">
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} transition={{delay: 0.2}}
              className="bg-gradient-to-br from-primary to-violet-700 rounded-3xl p-7 text-white shadow-xl shadow-primary/20">
              <h3 className="text-lg font-bold text-white/90 mb-5">Payment Summary</h3>
              
              <div className="space-y-2.5 mb-5 text-sm font-medium text-white/80">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatMoney(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transport</span>
                  <span>{formatMoney(quote.transportFee)}</span>
                </div>
                <div className="flex justify-between border-t border-white/20 pt-2.5 text-white text-lg font-bold">
                  <span>Total</span>
                  <span>{formatMoney(quote.total)}</span>
                </div>
                <div className="flex justify-between text-white/70 text-xs">
                  <span>30% Deposit</span>
                  <span className={quote.depositPaidAt ? 'line-through' : ''}>{formatMoney(quote.depositAmount)}</span>
                </div>
                <div className="flex justify-between text-white/70 text-xs">
                  <span>Balance Due</span>
                  <span className={quote.finalPaidAt ? 'line-through' : ''}>{formatMoney(quote.finalAmount)}</span>
                </div>
              </div>

              {/* Pay Deposit */}
              {quote.status === 'deposit_requested' && (
                <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
                  <p className="text-sm mb-1 text-white/80">Deposit Required</p>
                  <p className="text-2xl font-bold mb-4">{formatMoney(quote.depositAmount)}</p>
                  <button onClick={handlePayDeposit} disabled={payMutation.isPending} data-testid="button-pay-deposit"
                    className="w-full bg-white text-primary font-bold py-3 rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-70">
                    <CreditCard className="w-5 h-5" />
                    {payMutation.isPending ? "Processing..." : "Pay Deposit Now"}
                  </button>
                </div>
              )}

              {/* Request Booking */}
              {quote.status === 'deposit_paid' && (
                <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
                  <h4 className="font-bold mb-4 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" /> Choose Appointment
                  </h4>
                  <input type="date" min={getTodayPlus1()} value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white mb-3 outline-none focus:bg-white/30 transition-colors"
                    data-testid="input-booking-date" />
                  <select value={selectedTime} onChange={e => setSelectedTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white mb-4 outline-none focus:bg-white/30 transition-colors appearance-none"
                    data-testid="select-booking-time">
                    <option value="" className="text-black">Select time window</option>
                    <option value="09:00-12:00" className="text-black">Morning (09:00 - 12:00)</option>
                    <option value="13:00-17:00" className="text-black">Afternoon (13:00 - 17:00)</option>
                  </select>
                  <button onClick={handleBookingRequest} disabled={bookMutation.isPending} data-testid="button-request-booking"
                    className="w-full bg-white text-primary font-bold py-3 rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-transform disabled:opacity-70">
                    {bookMutation.isPending ? "Sending..." : "Request This Slot"}
                  </button>
                  <p className="text-xs text-white/60 mt-3 text-center">Admin will confirm within 24 hours</p>
                </div>
              )}

              {/* Pending booking info */}
              {quote.status === 'booking_requested' && (
                <div className="bg-white/10 rounded-2xl p-5 border border-white/20 text-center">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-white/80" />
                  <p className="font-bold">Booking Pending Confirmation</p>
                  <p className="text-xs text-white/70 mt-1">We'll confirm your slot within 24 hours</p>
                </div>
              )}

              {/* Confirmed booking info */}
              {['booked', 'assigned', 'in_progress'].includes(quote.status) && quote.scheduledAt && (
                <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
                  <p className="text-xs text-white/70 mb-2">✅ CONFIRMED APPOINTMENT</p>
                  <p className="font-bold flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> {format(new Date(quote.scheduledAt), 'MMM d, yyyy')}
                  </p>
                  <p className="font-bold mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {quote.timeWindow}
                  </p>
                </div>
              )}

              {/* Pay Final */}
              {['completed', 'final_payment_requested'].includes(quote.status) && (
                <div className="bg-white/10 rounded-2xl p-5 border border-white/20">
                  <p className="text-sm mb-1 text-white/80">Balance Due</p>
                  <p className="text-2xl font-bold mb-4">{formatMoney(quote.finalAmount)}</p>
                  <button onClick={handlePayFinal} disabled={payMutation.isPending} data-testid="button-pay-final"
                    className="w-full bg-white text-primary font-bold py-3 rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-70">
                    <CreditCard className="w-5 h-5" />
                    {payMutation.isPending ? "Processing..." : "Pay Final Balance"}
                  </button>
                </div>
              )}

              {/* Closed */}
              {['closed', 'final_paid'].includes(quote.status) && (
                <div className="bg-white/10 rounded-2xl p-5 border border-white/20 text-center">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-300" />
                  <p className="font-bold">All Paid — Case Closed</p>
                  <p className="text-xs text-white/70 mt-1">Thank you for choosing TMG Install!</p>
                </div>
              )}
            </motion.div>

            {/* Contact Card */}
            <div className="bg-card rounded-3xl p-5 border shadow-sm">
              <p className="text-sm font-bold mb-3">Need Help?</p>
              <a href="https://wa.me/6580880757" target="_blank" rel="noreferrer" data-testid="link-whatsapp"
                className="flex items-center gap-2 w-full px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm hover:bg-emerald-100 transition-colors">
                <MessageCircle className="w-4 h-4" /> WhatsApp +65 8088 0757
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
