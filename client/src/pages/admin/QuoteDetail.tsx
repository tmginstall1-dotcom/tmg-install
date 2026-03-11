import { useParams, Link } from "wouter";
import { useQuote, useUpdateQuoteStatus, useRequestFinalPayment } from "@/hooks/use-quotes";
import { useStaffList } from "@/hooks/use-staff";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useState } from "react";
import { ArrowLeft, UserPlus, CheckCircle2, Clock, MapPin, Receipt, AlertTriangle, Mail, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function AdminQuoteDetail() {
  const params = useParams();
  const id = params.id!;
  
  const { data: quote, isLoading } = useQuote(id);
  const { data: staffList } = useStaffList();
  const updateStatus = useUpdateQuoteStatus();
  const requestFinalPayment = useRequestFinalPayment();

  const [selectedStaff, setSelectedStaff] = useState("");

  if (isLoading) return <div className="pt-32 text-center">Loading...</div>;
  if (!quote) return <div className="pt-32 text-center">Not found</div>;

  const handleApprove = async () => {
    // Calculate a 20% deposit
    const deposit = (Number(quote.total) * 0.2).toFixed(2);
    // Actually the real logic should update payment too, but for UI sake we update status
    await updateStatus.mutateAsync({ id, status: 'deposit_requested', note: `Approved. Deposit set to $${deposit}` });
  };

  const handleAssign = async () => {
    if (!selectedStaff) return alert("Select staff");
    await updateStatus.mutateAsync({ id, status: 'assigned', assignedStaffId: parseInt(selectedStaff) });
  };

  const handleRequestFinalPayment = async () => {
    try {
      await requestFinalPayment.mutateAsync(parseInt(id));
      alert("Final payment request sent to customer");
    } catch (err) {
      alert("Failed to send final payment email");
    }
  };

  return (
    <div className="min-h-screen pt-28 pb-20 bg-secondary/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="grid lg:grid-cols-[1fr_350px] gap-8">
          
          <div className="space-y-8">
            <div className="bg-card p-8 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-display font-bold mb-2">Quote #{quote.referenceNo}</h1>
                <p className="text-muted-foreground">Created {format(new Date(quote.createdAt), 'MMM dd, yyyy HH:mm')}</p>
              </div>
              <StatusBadge status={quote.status} className="text-sm px-4 py-2 scale-110 origin-right" />
            </div>

            <div className="bg-card p-8 rounded-3xl border shadow-sm">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <MapPin className="text-primary w-5 h-5" /> Job Details
              </h3>
              <div className="grid sm:grid-cols-2 gap-8">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Customer Info</p>
                  <p className="font-bold text-lg">{quote.customer?.name}</p>
                  <p className="text-muted-foreground">{quote.customer?.email}</p>
                  <p className="text-muted-foreground">{quote.customer?.phone}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Service Location</p>
                  <p className="font-medium">{quote.serviceAddress}</p>
                </div>
              </div>
            </div>

            <div className="bg-card p-8 rounded-3xl border shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Receipt className="text-accent w-5 h-5" /> Items & Pricing
                </h3>
                {quote.aiConfidenceScore && quote.aiConfidenceScore < 80 && (
                  <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Low AI Confidence: Review Items
                  </div>
                )}
              </div>
              
              <div className="divide-y border-t border-b mb-6">
                {quote.items?.map((item: any) => (
                  <div key={item.id} className="py-4 flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{item.detectedName || item.originalDescription}</p>
                      <p className="text-sm text-muted-foreground">{item.serviceType} x{item.quantity}</p>
                    </div>
                    <p className="font-bold">${item.subtotal}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span> <span>${quote.subtotal}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Transport</span> <span>${quote.transportFee}</span></div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t text-foreground"><span>Total</span> <span>${quote.total}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            
            {/* Actions Panel */}
            <div className="bg-card rounded-3xl p-6 border shadow-lg shadow-black/5 space-y-3">
              <h3 className="font-bold mb-4">Admin Actions</h3>
              
              {quote.status === 'submitted' && (
                <button 
                  onClick={handleApprove}
                  disabled={updateStatus.isPending}
                  className="w-full btn-primary-gradient py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" /> Approve & Req Deposit
                </button>
              )}

              {quote.status === 'completed' && (
                <button 
                  onClick={handleRequestFinalPayment}
                  disabled={requestFinalPayment.isPending}
                  className="w-full btn-primary-gradient py-3 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-5 h-5" /> Request Final Payment
                </button>
              )}

              {['booked', 'assigned'].includes(quote.status) && (
                <div className="pt-4 border-t">
                  <label className="text-sm font-semibold mb-2 block">Assign Staff</label>
                  <select 
                    value={selectedStaff}
                    onChange={e => setSelectedStaff(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-secondary border mb-3 outline-none focus:border-primary"
                  >
                    <option value="">Select Staff</option>
                    {staffList?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={handleAssign}
                    disabled={updateStatus.isPending || !selectedStaff}
                    className="w-full bg-foreground text-background py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50"
                  >
                    <UserPlus className="w-5 h-5" /> Update Assignment
                  </button>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-card rounded-3xl p-6 border shadow-sm">
              <h3 className="font-bold mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" /> Job Timeline
              </h3>
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {quote.updates?.map((update: any) => (
                  <div key={update.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-white bg-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10"></div>
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] bg-secondary p-3 rounded-xl border">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-bold text-sm capitalize">{update.statusChange.replace('_', ' ')}</h4>
                        <time className="text-xs text-muted-foreground">{format(new Date(update.createdAt), 'MMM d, HH:mm')}</time>
                      </div>
                      {update.note && <p className="text-xs text-muted-foreground mt-1">{update.note}</p>}
                    </div>
                  </div>
                ))}
                {(!quote.updates || quote.updates.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center">No updates yet.</p>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
