import { useParams } from "wouter";
import { useQuote, useUpdateQuotePayment, useUpdateQuoteBooking } from "@/hooks/use-quotes";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CheckCircle2, CreditCard, CalendarDays, Receipt, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { motion } from "framer-motion";
import { format as formatCurrency } from "@/lib/utils"; // Wait, I'll just write a quick inline formatter

function formatMoney(amount: string | number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount));
}

export default function QuoteStatus() {
  const params = useParams();
  const id = params.id!;
  const { data: quote, isLoading } = useQuote(id);
  
  const payMutation = useUpdateQuotePayment();
  const bookMutation = useUpdateQuoteBooking();
  
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

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
      alert("Deposit payment successful! (Mocked)");
    } catch (e) {
      alert("Payment failed");
    }
  };

  const handleBook = async () => {
    if (!selectedDate || !selectedTime) return alert("Please select date and time");
    try {
      await bookMutation.mutateAsync({ id, scheduledAt: new Date(selectedDate).toISOString(), timeWindow: selectedTime });
      alert("Booking confirmed!");
    } catch (e) {
      alert("Booking failed");
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-20 bg-secondary/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-lg shadow-black/5 mb-6 border">
            <Receipt className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-4 text-foreground">Quote #{quote.referenceNo}</h1>
          <StatusBadge status={quote.status} className="text-sm px-4 py-2" />
        </div>

        <div className="grid md:grid-cols-[2fr_1fr] gap-8">
          {/* Main Details */}
          <div className="space-y-8">
            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-card rounded-3xl p-8 shadow-sm border">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <CheckCircle2 className="text-primary w-6 h-6" /> Itemized Breakdown
              </h3>
              
              <div className="space-y-4">
                {quote.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-start pb-4 border-b border-border/50 last:border-0 last:pb-0">
                    <div>
                      <p className="font-semibold text-foreground">{item.detectedName || item.originalDescription}</p>
                      <p className="text-sm text-muted-foreground capitalize">{item.serviceType} • Qty: {item.quantity}</p>
                    </div>
                    <div className="font-bold text-lg">{formatMoney(item.subtotal)}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay: 0.1}} className="bg-card rounded-3xl p-8 shadow-sm border">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <MapPin className="text-accent w-6 h-6" /> Details
              </h3>
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Customer</p>
                  <p className="font-semibold">{quote.customer?.name}</p>
                  <p className="text-sm">{quote.customer?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Service Address</p>
                  <p className="font-semibold">{quote.serviceAddress}</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Sidebar Action Area */}
          <div className="space-y-6">
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} transition={{delay: 0.2}} className="bg-gradient-to-br from-primary to-violet-700 rounded-3xl p-8 text-white shadow-xl shadow-primary/20">
              <h3 className="text-xl font-bold text-white/90 mb-6">Summary</h3>
              
              <div className="space-y-3 mb-6 text-sm font-medium text-white/80">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatMoney(quote.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transport</span>
                  <span>{formatMoney(quote.transportFee)}</span>
                </div>
                <div className="flex justify-between border-t border-white/20 pt-3 text-white text-lg font-bold">
                  <span>Total</span>
                  <span>{formatMoney(quote.total)}</span>
                </div>
              </div>

              {quote.status === 'deposit_requested' && (
                <div className="mt-8 bg-white/10 rounded-2xl p-5 border border-white/20">
                  <p className="text-sm mb-1 text-white/80">Deposit Required</p>
                  <p className="text-2xl font-bold mb-4">{formatMoney(quote.depositAmount)}</p>
                  <button 
                    onClick={handlePayDeposit}
                    disabled={payMutation.isPending}
                    className="w-full bg-white text-primary font-bold py-3 rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-5 h-5" />
                    {payMutation.isPending ? "Processing..." : "Pay Deposit"}
                  </button>
                </div>
              )}

              {['deposit_paid', 'booking_pending'].includes(quote.status) && (
                <div className="mt-8 bg-white/10 rounded-2xl p-5 border border-white/20">
                  <h4 className="font-bold mb-4 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5" /> Select Date
                  </h4>
                  <input 
                    type="date" 
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white mb-3 placeholder:text-white/50 outline-none focus:bg-white/30 transition-colors"
                  />
                  <select 
                    value={selectedTime}
                    onChange={e => setSelectedTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-white/20 border border-white/30 text-white mb-4 outline-none focus:bg-white/30 transition-colors appearance-none"
                  >
                    <option value="" className="text-black">Select Time</option>
                    <option value="09:00-12:00" className="text-black">Morning (09:00 - 12:00)</option>
                    <option value="13:00-17:00" className="text-black">Afternoon (13:00 - 17:00)</option>
                  </select>
                  <button 
                    onClick={handleBook}
                    disabled={bookMutation.isPending}
                    className="w-full bg-accent text-white font-bold py-3 rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-transform"
                  >
                    {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
                  </button>
                </div>
              )}

              {quote.scheduledAt && (
                <div className="mt-8 bg-emerald-500/20 rounded-2xl p-5 border border-emerald-500/30">
                  <p className="text-sm mb-1 text-white/80">Scheduled For</p>
                  <p className="font-bold flex items-center gap-2">
                    <CalendarDays className="w-4 h-4" /> {format(new Date(quote.scheduledAt), 'MMM dd, yyyy')}
                  </p>
                  <p className="font-bold mt-1 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {quote.timeWindow}
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>

      </div>
    </div>
  );
}
