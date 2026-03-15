import { useParams, Link } from "wouter";
import { useQuote, useUpdateQuoteStatus, useRequestFinalPayment, useConfirmBooking, useEditQuote, useCloseQuote } from "@/hooks/use-quotes";
import { useStaffList } from "@/hooks/use-staff";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, UserPlus, CheckCircle2, Clock, MapPin, Receipt, AlertTriangle, 
  DollarSign, Phone, MessageCircle, Edit2, Save, X, Plus, Trash2, Calendar, XCircle, Camera,
  ClipboardList, Banknote, CalendarCheck, Zap, BadgeCheck
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function formatMoney(v: any) {
  return `$${Number(v || 0).toFixed(2)}`;
}

export default function AdminQuoteDetail() {
  const params = useParams();
  const id = params.id!;
  
  const { data: quote, isLoading } = useQuote(id);
  const { data: staffList } = useStaffList();
  const { data: teamsList = [] } = useQuery<any[]>({ queryKey: ["/api/teams"] });
  const updateStatus = useUpdateQuoteStatus();
  const requestFinalPayment = useRequestFinalPayment();
  const confirmBooking = useConfirmBooking();
  const editQuote = useEditQuote();
  const closeQuote = useCloseQuote();
  const { toast } = useToast();

  const [selectedAssignee, setSelectedAssignee] = useState(""); // "staff:2" | "team:3"
  const [isEditing, setIsEditing] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>({});
  const [editQuoteData, setEditQuoteData] = useState<any>({});
  const [editItems, setEditItems] = useState<any[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxPhoto(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (isLoading) return <div className="pt-32 text-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div></div>;
  if (!quote) return <div className="pt-32 text-center">Not found</div>;

  const canEdit = ['submitted', 'under_review', 'approved', 'deposit_requested'].includes(quote.status);

  const handleStartEdit = () => {
    setEditCustomer({
      name: quote.customer?.name || '',
      email: quote.customer?.email || '',
      phone: quote.customer?.phone || '',
    });
    setEditQuoteData({
      serviceAddress: quote.serviceAddress || '',
      pickupAddress: quote.pickupAddress || '',
      dropoffAddress: quote.dropoffAddress || '',
      transportFee: quote.transportFee || '0',
      notes: quote.notes || '',
    });
    setEditItems((quote.items || []).map((item: any) => ({
      catalogItemId: item.catalogItemId,
      originalDescription: item.detectedName || item.originalDescription,
      detectedName: item.detectedName || item.originalDescription,
      serviceType: item.serviceType,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      subtotal: String(item.subtotal),
    })));
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    try {
      const items = editItems.map(item => ({
        ...item,
        subtotal: (Number(item.unitPrice) * Number(item.quantity)).toFixed(2),
      }));
      await editQuote.mutateAsync({
        id,
        customerUpdates: editCustomer,
        quoteUpdates: {
          ...editQuoteData,
          transportFee: editQuoteData.transportFee,
        },
        items,
      });
      setIsEditing(false);
      toast({ title: "Quote updated", description: "Changes saved successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleApproveAndRequestDeposit = async () => {
    try {
      await updateStatus.mutateAsync({ id, status: 'deposit_requested', note: 'Quote approved. Deposit requested.' });
      toast({ title: "Deposit Requested", description: "Email sent to customer with payment details." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleConfirmBooking = async () => {
    try {
      await confirmBooking.mutateAsync(parseInt(id));
      toast({ title: "Booking Confirmed", description: "Confirmation email sent to customer." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAssign = async () => {
    if (!selectedAssignee) return toast({ title: "Select a staff member or team", variant: "destructive" });
    try {
      const [type, rawId] = selectedAssignee.split(":");
      const numId = parseInt(rawId);
      if (type === "team") {
        await updateStatus.mutateAsync({ id, status: 'assigned', assignedTeamId: numId });
        toast({ title: "Team assigned", description: "The whole team has been assigned to this job." });
      } else {
        await updateStatus.mutateAsync({ id, status: 'assigned', assignedStaffId: numId });
        toast({ title: "Staff assigned", description: "Staff member assigned to this job." });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRequestFinalPayment = async () => {
    try {
      await requestFinalPayment.mutateAsync(parseInt(id));
      toast({ title: "Final Payment Requested", description: "Email sent to customer." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleManualClose = async () => {
    const reason = prompt("Reason for manual close (optional):");
    try {
      await closeQuote.mutateAsync({ id, reason: reason || undefined });
      toast({ title: "Case Closed", description: "Case has been manually closed." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const addEditItem = () => {
    setEditItems([...editItems, {
      originalDescription: '',
      detectedName: '',
      serviceType: 'install',
      quantity: 1,
      unitPrice: '0',
      subtotal: '0',
    }]);
  };

  const removeEditItem = (i: number) => {
    setEditItems(editItems.filter((_, idx) => idx !== i));
  };

  const updateEditItem = (i: number, field: string, value: any) => {
    setEditItems(editItems.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      updated.subtotal = (Number(updated.unitPrice) * Number(updated.quantity)).toFixed(2);
      return updated;
    }));
  };

  const editSubtotal = editItems.reduce((sum, i) => sum + Number(i.unitPrice) * Number(i.quantity), 0);
  const editTransport = Number(editQuoteData.transportFee || 0);
  const editTotal = editSubtotal + editTransport;

  return (
    <div className="min-h-screen pt-14 pb-32 lg:pb-20 bg-slate-50 overflow-x-hidden">

      {/* Dark hero header */}
      <div className="bg-slate-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-slate-300 transition-colors mb-4 uppercase tracking-[0.2em]">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-mono font-black text-slate-400 bg-white/[0.07] border border-white/10 px-2 py-0.5 tracking-widest">
                  {quote.referenceNo}
                </span>
                <StatusBadge status={quote.status} />
              </div>
              <h1 className="font-heading font-black text-white uppercase tracking-[-0.02em] text-2xl sm:text-3xl leading-none truncate">{quote.customer?.name}</h1>
              <p className="text-slate-500 text-xs mt-2">
                {format(new Date(quote.createdAt), "d MMM yyyy, h:mm a")}
                {quote.scheduledAt && (
                  <span className="ml-2 text-slate-400 font-semibold">
                    · Job {format(new Date(quote.scheduledAt), "d MMM, h:mm a")}
                  </span>
                )}
              </p>
            </div>
            {/* Total + edit button */}
            <div className="shrink-0 flex flex-col items-end gap-3">
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">Total</p>
                <p className="text-2xl font-black text-white tabular-nums leading-none">{formatMoney(quote.total)}</p>
              </div>
              {canEdit && !isEditing && (
                <button onClick={handleStartEdit} data-testid="button-edit-quote"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-white/20 bg-white/[0.07] hover:bg-white/[0.15] text-white text-[10px] font-black uppercase tracking-[0.1em] transition-colors">
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT GRID ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 lg:gap-8">
          <div className="space-y-6 order-2 lg:order-1">

            {/* ── Job Status Pipeline ── */}
            {(() => {
              type Phase = { id: string; label: string; Icon: React.ElementType; statuses: string[] };
              const PIPELINE: Phase[] = [
                { id: "quote",    label: "Quote",    Icon: ClipboardList, statuses: ["submitted", "under_review", "approved"] },
                { id: "deposit",  label: "Deposit",  Icon: Banknote,       statuses: ["deposit_requested", "deposit_paid"] },
                { id: "booked",   label: "Booked",   Icon: CalendarCheck,  statuses: ["booked"] },
                { id: "assigned", label: "Assigned", Icon: UserPlus,       statuses: ["assigned"] },
                { id: "job",      label: "On-site",  Icon: Zap,            statuses: ["in_progress", "completed"] },
                { id: "closed",   label: "Closed",   Icon: BadgeCheck,     statuses: ["final_payment_requested", "final_paid", "closed"] },
              ];
              const isCancelled = quote.status === "cancelled";
              const activeIdx   = isCancelled ? -1 : PIPELINE.findIndex(p => p.statuses.includes(quote.status));

              const subLabel: Record<string, string> = {
                submitted: "New request",
                under_review: "Reviewing",
                approved: "Approved",
                deposit_requested: "Email sent",
                deposit_paid: "Paid ✓",
                booked: "Confirmed ✓",
                assigned: "Staff set",
                in_progress: "Live",
                completed: "Done ✓",
                final_payment_requested: "Email sent",
                final_paid: "Paid ✓",
                closed: "Case closed",
              };

              return (
                <div className="bg-white border border-black/[0.07] p-4" data-testid="status-pipeline">
                  <p className="text-[10px] font-black text-black/35 uppercase tracking-[0.2em] mb-4">Job Pipeline</p>
                  {/* Stepper — horizontal scroll on mobile */}
                  <div className="overflow-x-auto -mx-4 px-4 pb-2">
                  <div className="flex items-start min-w-[380px]">
                    {PIPELINE.map((phase, i) => {
                      const isDone     = !isCancelled && activeIdx > i;
                      const isActive   = !isCancelled && activeIdx === i;
                      const { Icon }   = phase;
                      return (
                        <div key={phase.id} className="flex items-center flex-1 last:flex-none">
                          <div className="flex flex-col items-center gap-1.5 min-w-0">
                            {/* Circle node */}
                            <div className={[
                              "relative w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0",
                              isDone   ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" :
                              isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-primary/20" :
                                         "bg-muted text-muted-foreground/50",
                            ].join(" ")}>
                              {isDone
                                ? <CheckCircle2 className="w-4 h-4" />
                                : <Icon className="w-4 h-4" />
                              }
                              {isActive && (
                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-white animate-ping opacity-75" />
                              )}
                            </div>
                            {/* Label */}
                            <span className={[
                              "text-[10px] font-bold whitespace-nowrap",
                              isActive ? "text-primary" : isDone ? "text-foreground/70" : "text-muted-foreground/40",
                            ].join(" ")}>
                              {phase.label}
                            </span>
                            {/* Sub-label for active phase */}
                            {isActive && (
                              <span className="text-[9px] text-primary/70 font-medium whitespace-nowrap -mt-1">
                                {subLabel[quote.status] || ""}
                              </span>
                            )}
                          </div>
                          {/* Connector line */}
                          {i < PIPELINE.length - 1 && (
                            <div className={[
                              "flex-1 h-0.5 mx-1 mb-6 rounded-full transition-all",
                              isDone ? "bg-primary" : "bg-border",
                            ].join(" ")} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>{/* end overflow-x-auto */}
                  {/* Cancelled state */}
                  {isCancelled && (
                    <div className="mt-2 text-center text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl py-2">
                      This job was cancelled
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Customer + Address */}
            <div className="bg-white p-5 border border-black/[0.07]">
              <h3 className="text-[11px] font-black mb-5 text-slate-900 flex items-center gap-2 uppercase tracking-[0.15em]">
                <MapPin className="w-4 h-4" /> Customer & Location
              </h3>
              
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Name', key: 'name' },
                      { label: 'Email', key: 'email' },
                      { label: 'Phone', key: 'phone' },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">{f.label}</label>
                        <input value={editCustomer[f.key] || ''} onChange={e => setEditCustomer({ ...editCustomer, [f.key]: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border bg-background text-sm outline-none focus:border-primary transition-colors"
                          data-testid={`input-edit-${f.key}`} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Service Address</label>
                    <input value={editQuoteData.serviceAddress || ''} onChange={e => setEditQuoteData({ ...editQuoteData, serviceAddress: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border bg-background text-sm outline-none focus:border-primary transition-colors"
                      data-testid="input-edit-address" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">Pickup Address (relocation)</label>
                      <input value={editQuoteData.pickupAddress || ''} onChange={e => setEditQuoteData({ ...editQuoteData, pickupAddress: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border bg-background text-sm outline-none focus:border-primary transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1 block">Dropoff Address (relocation)</label>
                      <input value={editQuoteData.dropoffAddress || ''} onChange={e => setEditQuoteData({ ...editQuoteData, dropoffAddress: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border bg-background text-sm outline-none focus:border-primary transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Internal Notes</label>
                    <textarea value={editQuoteData.notes || ''} onChange={e => setEditQuoteData({ ...editQuoteData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border bg-background text-sm outline-none focus:border-primary transition-colors resize-none"
                      placeholder="Internal admin notes..." />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Customer Info</p>
                    <p className="font-bold text-lg leading-tight">{quote.customer?.name}</p>
                    <p className="text-sm text-muted-foreground">{quote.customer?.email}</p>
                    <p className="text-sm text-muted-foreground">{quote.customer?.phone}</p>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <a href={`tel:${quote.customer?.phone}`} data-testid="button-call"
                        className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors">
                        <Phone className="w-4 h-4" /> Call
                      </a>
                      <a href={`https://wa.me/${quote.customer?.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" data-testid="button-whatsapp"
                        className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors">
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>
                      <a href={`mailto:${quote.customer?.email}`} data-testid="button-email"
                        className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                        Email
                      </a>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Service Location</p>
                    <p className="font-medium text-sm">{quote.serviceAddress}</p>
                    {quote.pickupAddress && (
                      <div className="mt-2 text-sm">
                        <p className="text-xs text-muted-foreground">Pickup</p>
                        <p className="font-medium">{quote.pickupAddress}</p>
                      </div>
                    )}
                    {quote.dropoffAddress && (
                      <div className="mt-2 text-sm">
                        <p className="text-xs text-muted-foreground">Dropoff</p>
                        <p className="font-medium">{quote.dropoffAddress}</p>
                      </div>
                    )}
                    {quote.distanceKm && Number(quote.distanceKm) > 0 && (
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 text-xs font-bold text-blue-700">
                        <MapPin className="w-3 h-3" /> Route: {Number(quote.distanceKm).toFixed(1)} km
                      </div>
                    )}
                    {quote.preferredDate && !quote.scheduledAt && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-xs text-amber-700 font-semibold">Customer's Requested Slot</p>
                        <p className="font-bold text-sm mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          {format(new Date(quote.preferredDate + "T12:00:00"), 'EEE, MMM d, yyyy')} · {quote.preferredTimeWindow}
                        </p>
                      </div>
                    )}
                    {quote.scheduledAt && (
                      <div className="mt-3 p-3 rounded-xl bg-secondary/50 border">
                        <p className="text-xs text-muted-foreground font-semibold">Confirmed Slot</p>
                        <p className="font-bold text-sm mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-primary" />
                          {format(new Date(quote.scheduledAt), 'EEE, MMM d, yyyy')} · {quote.timeWindow}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Items & Pricing */}
            <div className="bg-white p-5 border border-black/[0.07]">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[11px] font-black text-slate-900 flex items-center gap-2 uppercase tracking-[0.15em]">
                  <Receipt className="w-4 h-4" /> Items & Pricing
                </h3>
                {isEditing && (
                  <button onClick={addEditItem} data-testid="button-add-item"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                )}
                {!isEditing && quote.aiConfidenceScore && quote.aiConfidenceScore < 80 && (
                  <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Low Confidence
                  </div>
                )}
              </div>

              {/* AI photo scan thumbnail */}
              {!isEditing && quote.detectionPhotoUrl && (
                <div className="flex items-start gap-4 mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <button type="button" onClick={() => setLightboxPhoto(quote.detectionPhotoUrl)} className="focus:outline-none group relative shrink-0" data-testid="button-ai-photo">
                    <img src={quote.detectionPhotoUrl} alt="Customer submitted photo" className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-300 group-hover:border-emerald-500 transition-colors" />
                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">View</span>
                    </div>
                  </button>
                  <div>
                    <p className="text-sm font-bold text-emerald-800 flex items-center gap-1.5 mb-0.5">
                      <Camera className="w-4 h-4" /> AI Photo Scan
                    </p>
                    <p className="text-xs text-emerald-700">Photo submitted by customer — items were auto-detected from this image. Verify quantities below match the actual order.</p>
                  </div>
                </div>
              )}

              {isEditing ? (
                <div className="space-y-2">
                  {editItems.map((item, i) => (
                    <div key={i} className="p-3 rounded-xl border bg-secondary/30 space-y-2" data-testid={`edit-item-${i}`}>
                      <div className="flex gap-2">
                        <input value={item.detectedName || item.originalDescription} onChange={e => updateEditItem(i, 'detectedName', e.target.value)}
                          placeholder="Item name" className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border bg-background text-sm outline-none focus:border-primary" />
                        <button onClick={() => removeEditItem(i)} className="w-8 h-8 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <select value={item.serviceType} onChange={e => updateEditItem(i, 'serviceType', e.target.value)}
                          className="px-2 py-1.5 rounded-lg border bg-background text-xs outline-none focus:border-primary">
                          <option value="install">Install</option>
                          <option value="dismantle">Dismantle</option>
                          <option value="relocate">Relocate</option>
                        </select>
                        <input type="number" min="1" value={item.quantity} onChange={e => updateEditItem(i, 'quantity', parseInt(e.target.value) || 1)}
                          placeholder="Qty" className="px-2 py-1.5 rounded-lg border bg-background text-sm outline-none focus:border-primary text-center" />
                        <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateEditItem(i, 'unitPrice', e.target.value)}
                          className="px-2 py-1.5 rounded-lg border bg-background text-sm outline-none focus:border-primary" placeholder="$Price" />
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 mt-3 pt-3 border-t">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1">Transport Fee ($)</label>
                      <input type="number" min="0" step="0.01" value={editQuoteData.transportFee || '0'} onChange={e => setEditQuoteData({ ...editQuoteData, transportFee: e.target.value })}
                        className="w-28 px-3 py-1.5 rounded-lg border bg-background text-sm outline-none focus:border-primary" />
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-muted-foreground">Subtotal: <strong>${editSubtotal.toFixed(2)}</strong></p>
                      <p className="text-xs text-muted-foreground">Transport: <strong>${editTransport.toFixed(2)}</strong></p>
                      <p className="text-base font-black text-foreground mt-1">Total: ${editTotal.toFixed(2)}</p>
                      <p className="text-xs text-emerald-600 font-semibold">50% Deposit: ${(editTotal * 0.5).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveEdit} disabled={editQuote.isPending} data-testid="button-save-edit"
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50">
                      <Save className="w-4 h-4" /> {editQuote.isPending ? "Saving..." : "Save Changes"}
                    </button>
                    <button onClick={() => setIsEditing(false)} data-testid="button-cancel-edit"
                      className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-secondary border font-bold text-sm hover:bg-border transition-colors">
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="divide-y border-t border-b mb-5">
                    {quote.items?.map((item: any) => (
                      <div key={item.id} className="py-3.5 flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">{item.detectedName || item.originalDescription}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.serviceType} × {item.quantity} @ {formatMoney(item.unitPrice)}</p>
                        </div>
                        <p className="font-bold shrink-0">{formatMoney(item.subtotal)}</p>
                      </div>
                    ))}
                    {(!quote.items || quote.items.length === 0) && (
                      <p className="py-4 text-sm text-muted-foreground text-center">No items</p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <div className="w-full sm:w-72 space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Labor subtotal</span><span className="shrink-0 ml-4">{formatMoney(quote.subtotal)}</span></div>
                      {Number(quote.discount || 0) > 0 && (
                        <div className="flex justify-between text-emerald-700 font-medium">
                          <span>Bulk discount</span><span className="shrink-0 ml-4">−{formatMoney(quote.discount)}</span>
                        </div>
                      )}
                      {Number(quote.transportFee || 0) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Logistics fees</span><span className="shrink-0 ml-4">{formatMoney(quote.transportFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span className="shrink-0 ml-4">{formatMoney(quote.total)}</span></div>
                      <div className="flex justify-between text-emerald-600 font-semibold text-xs"><span>50% Deposit</span><span className="shrink-0 ml-4">{formatMoney(quote.depositAmount)}</span></div>
                      <div className="flex justify-between text-muted-foreground text-xs"><span>Balance (50%)</span><span className="shrink-0 ml-4">{formatMoney(quote.finalAmount)}</span></div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-white p-5 border border-black/[0.07]">
              <h3 className="text-[11px] font-black mb-5 text-slate-900 flex items-center gap-2 uppercase tracking-[0.15em]">
                <Clock className="w-4 h-4" /> Job Timeline &amp; Field Proof
              </h3>
              <div className="space-y-4">
                {quote.updates?.map((update: any) => {
                  const isArrival   = update.statusChange === 'in_progress' && update.gpsLat;
                  const isCompletion = update.statusChange === 'completed' && update.gpsLat;
                  const isFieldEvent = isArrival || isCompletion;
                  let photos: string[] = [];
                  if (update.photoUrl) {
                    try { photos = JSON.parse(update.photoUrl); } catch { photos = [update.photoUrl]; }
                  }
                  const eventTime = new Date(update.createdAt);

                  return (
                    <div key={update.id} className="flex gap-3 items-start">
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-1 ${
                        isArrival    ? 'bg-blue-100 border-blue-500' :
                        isCompletion ? 'bg-emerald-100 border-emerald-500' :
                        'bg-primary/20 border-primary'
                      }`}></div>
                      <div className="flex-1 pb-4 border-b last:border-0">

                        {/* Field event — arrival or completion: show prominent timestamp block */}
                        {isFieldEvent ? (
                          <div className={`rounded-2xl border p-4 mb-3 ${
                            isArrival    ? 'bg-blue-50 border-blue-200' :
                            'bg-emerald-50 border-emerald-200'
                          }`}>
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div>
                                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                                  isArrival ? 'text-blue-600' : 'text-emerald-600'
                                }`}>
                                  {isArrival ? '📍 Staff Arrived' : '✅ Job Completed'}
                                </p>
                                <p className={`text-lg font-black ${
                                  isArrival ? 'text-blue-900' : 'text-emerald-900'
                                }`}>
                                  {format(eventTime, 'h:mm a')}
                                </p>
                                <p className={`text-xs font-medium mt-0.5 ${
                                  isArrival ? 'text-blue-700' : 'text-emerald-700'
                                }`}>
                                  {format(eventTime, 'EEEE, d MMM yyyy')}
                                </p>
                              </div>
                              <div className={`text-right text-xs ${
                                isArrival ? 'text-blue-600' : 'text-emerald-600'
                              }`}>
                                <p className="font-semibold capitalize">{update.actorType}</p>
                              </div>
                            </div>
                            {update.note && (
                              <p className={`text-xs mt-2 italic border-t pt-2 ${
                                isArrival ? 'text-blue-700 border-blue-200' : 'text-emerald-700 border-emerald-200'
                              }`}>
                                "{update.note}"
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-bold text-sm capitalize">{update.statusChange.replace(/_/g, ' ')}</h4>
                            <time className="text-xs text-muted-foreground">{format(eventTime, 'MMM d, HH:mm')}</time>
                          </div>
                        )}

                        {/* Non-field event meta */}
                        {!isFieldEvent && (
                          <>
                            <p className="text-xs text-muted-foreground capitalize">{update.actorType}</p>
                            {update.note && <p className="text-xs text-muted-foreground mt-1 italic">"{update.note}"</p>}
                          </>
                        )}

                        {/* GPS Proof */}
                        {update.gpsLat && (
                          <div className="mt-2 inline-flex items-center gap-2 bg-white border border-blue-200 rounded-xl px-3 py-2">
                            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="text-xs font-semibold text-blue-800">
                              {Number(update.gpsLat).toFixed(5)}, {Number(update.gpsLng).toFixed(5)}
                            </span>
                            <a
                              href={`https://maps.google.com/?q=${update.gpsLat},${update.gpsLng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-bold text-blue-600 underline hover:text-blue-800 ml-1"
                            >
                              Maps ↗
                            </a>
                          </div>
                        )}

                        {/* Photo Proof */}
                        {photos.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">
                              📷 Photo Proof ({photos.length} photo{photos.length !== 1 ? 's' : ''})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {photos.map((p: string, i: number) => (
                                <button key={i} type="button" onClick={() => setLightboxPhoto(p)}
                                  className="focus:outline-none group relative" data-testid={`button-photo-${i}`}>
                                  <img src={p} alt={`proof-${i + 1}`}
                                    className="w-24 h-24 rounded-xl object-cover border-2 border-border group-hover:border-primary transition-colors shadow-sm" />
                                  <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <span className="text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">View</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!quote.updates || quote.updates.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">No updates yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Actions — appears first on mobile, second on desktop */}
          <div className="space-y-5 order-1 lg:order-2">
            {/* ── Next Action Card ── */}
            <div className="bg-white p-5 border border-black/[0.07] space-y-4">

              {/* Section heading */}
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-black" />
                <h3 className="font-black text-[11px] uppercase tracking-[0.18em] text-slate-900">Next Action</h3>
              </div>

              {/* ── PHASE 1: New / Under Review ── */}
              {['submitted', 'under_review'].includes(quote.status) && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-sm">
                    <p className="font-bold text-blue-800 flex items-center gap-1.5 mb-1">
                      <ClipboardList className="w-4 h-4" /> Quote Received
                    </p>
                    <p className="text-xs text-blue-700">Review the items and pricing below, then approve to request the deposit from the customer.</p>
                  </div>
                  <button onClick={handleApproveAndRequestDeposit} disabled={updateStatus.isPending} data-testid="button-approve-deposit"
                    className="w-full bg-black text-white py-3.5 font-black text-xs uppercase tracking-[0.12em] flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-neutral-800 transition-colors">
                    <CheckCircle2 className="w-4 h-4" /> Approve & Request Deposit
                  </button>
                </div>
              )}

              {/* ── PHASE 2a: Deposit Requested ── */}
              {quote.status === 'deposit_requested' && (
                <div className="bg-amber-50 border border-amber-200 p-4 space-y-2">
                  <p className="font-black text-amber-800 flex items-center gap-1.5 text-xs uppercase tracking-[0.12em]">
                    <Banknote className="w-4 h-4" /> Awaiting Deposit
                  </p>
                  <p className="text-xs text-amber-700">Email sent. Waiting for customer to pay the 50% deposit of <strong>{formatMoney(quote.depositAmount)}</strong>.</p>
                  <div className="bg-amber-100 px-3 py-2 text-xs text-amber-700 flex items-center justify-between">
                    <span>Deposit amount</span>
                    <span className="font-black">{formatMoney(quote.depositAmount)}</span>
                  </div>
                </div>
              )}

              {/* ── PHASE 2b: Deposit Paid ── */}
              {quote.status === 'deposit_paid' && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 space-y-1.5">
                  <p className="font-bold text-emerald-800 flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Deposit Received
                  </p>
                  <p className="text-xs text-emerald-700">Deposit of {formatMoney(quote.depositAmount)} confirmed. Customer will now select a booking slot — you'll be notified once they submit a request.</p>
                  {quote.preferredDate && (
                    <div className="mt-2 bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs">
                      <p className="text-muted-foreground mb-0.5">Preferred slot (from estimate)</p>
                      <p className="font-bold text-foreground flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-emerald-600" />
                        {format(new Date(quote.preferredDate + "T12:00:00"), 'EEE, d MMM yyyy')} · {quote.preferredTimeWindow}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ── PHASE 3a: Booked — assign staff ── */}
              {quote.status === 'booked' && (
                <div className="space-y-3">
                  {quote.scheduledAt && (
                    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3.5 text-sm">
                      <p className="font-bold text-violet-800 flex items-center gap-1.5 mb-1">
                        <CalendarCheck className="w-4 h-4" /> Booking Confirmed
                      </p>
                      <p className="font-bold text-violet-900 text-xs">
                        {format(new Date(quote.scheduledAt), 'EEE, d MMM yyyy')} · {quote.timeWindow}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-bold mb-2 block text-muted-foreground uppercase tracking-wide">
                      Assign Staff or Team
                    </label>
                    <select value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)} data-testid="select-staff"
                      className="w-full px-4 py-2.5 rounded-xl bg-secondary border mb-3 outline-none focus:border-primary text-sm">
                      <option value="">Select staff or team...</option>
                      {teamsList.length > 0 && (
                        <optgroup label="── Teams">
                          {teamsList.map((t: any) => (
                            <option key={`team:${t.id}`} value={`team:${t.id}`}>👥 {t.name} ({t.members?.length ?? 0} members)</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="── Individual Staff">
                        {staffList?.map((s: any) => (
                          <option key={`staff:${s.id}`} value={`staff:${s.id}`}>{s.name}</option>
                        ))}
                      </optgroup>
                    </select>
                    <button onClick={handleAssign} disabled={updateStatus.isPending || !selectedAssignee} data-testid="button-assign-staff"
                      className="w-full bg-black text-white py-3 font-black text-xs uppercase tracking-[0.12em] flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50">
                      <UserPlus className="w-4 h-4" /> Assign Staff
                    </button>
                  </div>
                </div>
              )}

              {/* ── PHASE 3b: Assigned — awaiting on-site work ── */}
              {quote.status === 'assigned' && (
                <div className="space-y-3">
                  {quote.scheduledAt && (
                    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-3.5 text-sm">
                      <p className="font-bold text-violet-800 flex items-center gap-1.5 mb-1">
                        <CalendarCheck className="w-4 h-4" /> Booking Confirmed
                      </p>
                      <p className="font-bold text-violet-900 text-xs">
                        {format(new Date(quote.scheduledAt), 'EEE, d MMM yyyy')} · {quote.timeWindow}
                      </p>
                    </div>
                  )}
                  {/* Show assigned team */}
                  {(quote as any).assignedTeam && (
                    <div className="bg-secondary/60 rounded-2xl px-4 py-3 text-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                          style={{ background: (quote as any).assignedTeam.color || "#6366f1" }}>
                          👥
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-tight">{(quote as any).assignedTeam.name}</p>
                          <p className="text-xs text-muted-foreground">Team assigned — {(quote as any).assignedTeam.members?.length ?? 0} members</p>
                        </div>
                      </div>
                      {(quote as any).assignedTeam.members?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(quote as any).assignedTeam.members.map((m: any) => (
                            <span key={m.id} className="bg-background border rounded-full px-2.5 py-0.5 text-xs font-medium">{m.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Show assigned individual staff */}
                  {quote.assignedStaff && !(quote as any).assignedTeam && (
                    <div className="bg-secondary/60 rounded-2xl px-4 py-3 text-sm flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shrink-0">
                        {quote.assignedStaff.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-sm leading-tight">{quote.assignedStaff.name}</p>
                        <p className="text-xs text-muted-foreground">Individual staff assigned</p>
                      </div>
                    </div>
                  )}
                  <div className="pt-1 border-t">
                    <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Job Done?</p>
                    <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-final-payment-early"
                      className="w-full bg-black text-white py-3 font-black text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50">
                      <DollarSign className="w-4 h-4" /> {requestFinalPayment.isPending ? "Sending..." : "Mark Done & Request Final Payment"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── PHASE 4: In Progress ── */}
              {quote.status === 'in_progress' && (
                <div className="space-y-3">
                  <div className="bg-pink-50 border border-pink-200 rounded-2xl p-4 text-sm">
                    <p className="font-bold text-pink-800 flex items-center gap-1.5 mb-1">
                      <Zap className="w-4 h-4" /> Job In Progress
                    </p>
                    <p className="text-xs text-pink-700">Staff are on-site. Field check-ins will appear in the timeline below.</p>
                  </div>
                  <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-final-payment-inprogress"
                    className="w-full bg-black text-white py-3 font-black text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50">
                    <DollarSign className="w-4 h-4" /> {requestFinalPayment.isPending ? "Sending..." : "Mark Done & Request Final Payment"}
                  </button>
                </div>
              )}

              {/* ── PHASE 4b: Completed — request final payment ── */}
              {quote.status === 'completed' && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-sm">
                    <p className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-4 h-4" /> Job Completed
                    </p>
                    <p className="text-xs text-emerald-700">Field work is done. Send the final payment request to the customer.</p>
                  </div>
                  <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-final-payment"
                    className="w-full bg-black text-white py-3.5 font-black text-xs uppercase tracking-[0.12em] flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors disabled:opacity-50">
                    <DollarSign className="w-4 h-4" /> {requestFinalPayment.isPending ? "Sending..." : "Request Final Payment"}
                  </button>
                </div>
              )}

              {/* ── PHASE 5a: Awaiting Final Payment ── */}
              {quote.status === 'final_payment_requested' && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                    <p className="font-bold text-amber-800 flex items-center gap-1.5 text-sm">
                      <DollarSign className="w-4 h-4" /> Awaiting Final Payment
                    </p>
                    <p className="text-xs text-amber-700">Payment request sent. Waiting for customer to pay the remaining balance.</p>
                    <div className="bg-amber-100 rounded-xl px-3 py-2 text-xs text-amber-700 flex items-center justify-between">
                      <span>Balance due</span>
                      <span className="font-black">{formatMoney(quote.finalAmount)}</span>
                    </div>
                  </div>
                  <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-resend-final-payment"
                    className="w-full border border-black/20 text-slate-700 bg-white hover:bg-slate-50 py-2.5 font-black text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                    <DollarSign className="w-4 h-4" /> {requestFinalPayment.isPending ? "Sending..." : "Resend Final Payment Email"}
                  </button>
                </div>
              )}

              {/* ── PHASE 5b: Closed / Fully Paid ── */}
              {['closed', 'final_paid'].includes(quote.status) && (
                <div className="bg-emerald-50 border border-emerald-200 p-5 text-center">
                  <BadgeCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-black text-emerald-700 text-xs uppercase tracking-[0.15em]">Case Closed</p>
                  <p className="text-xs text-emerald-600 mt-1">Total collected: <strong>{formatMoney(quote.total)}</strong></p>
                </div>
              )}

              {/* ── Cancelled ── */}
              {quote.status === 'cancelled' && (
                <div className="bg-red-50 border border-red-200 p-4 text-center">
                  <XCircle className="w-8 h-8 text-red-400 mx-auto mb-1" />
                  <p className="font-black text-red-700 text-xs uppercase tracking-[0.15em]">Job Cancelled</p>
                </div>
              )}

              {/* Manual Close (always available unless terminal) */}
              {!['closed', 'cancelled', 'final_paid'].includes(quote.status) && (
                <div className="pt-2 border-t">
                  <button onClick={handleManualClose} data-testid="button-manual-close"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border text-xs font-black uppercase tracking-[0.1em] text-muted-foreground hover:bg-secondary transition-colors">
                    <XCircle className="w-4 h-4" /> Manual Close / Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Payment Summary */}
            <div className="bg-white border border-black/[0.07] overflow-hidden">
              {/* Total header */}
              <div className="px-5 pt-5 pb-4 border-b border-black/[0.06]">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Contract Value</p>
                <p className="text-2xl font-black text-slate-900 tabular-nums">{formatMoney(quote.total)}</p>
              </div>
              {/* Payment rows */}
              <div className="p-4 space-y-2">
                {/* Deposit row */}
                <div className={`flex items-center justify-between px-3 py-2.5 text-sm ${
                  quote.depositPaidAt
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-slate-50 border border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 flex items-center justify-center text-[10px] font-black ${
                      quote.depositPaidAt ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'
                    }`}>{quote.depositPaidAt ? '✓' : '1'}</div>
                    <span className={`font-semibold text-xs ${quote.depositPaidAt ? 'text-emerald-700' : 'text-slate-500'}`}>
                      Deposit (50%)
                    </span>
                  </div>
                  <span className={`font-black tabular-nums text-sm ${quote.depositPaidAt ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {formatMoney(quote.depositAmount)}
                  </span>
                </div>
                {/* Balance row */}
                <div className={`flex items-center justify-between px-3 py-2.5 text-sm ${
                  quote.finalPaidAt
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-slate-50 border border-slate-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 flex items-center justify-center text-[10px] font-black ${
                      quote.finalPaidAt ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-white'
                    }`}>{quote.finalPaidAt ? '✓' : '2'}</div>
                    <span className={`font-semibold text-xs ${quote.finalPaidAt ? 'text-emerald-700' : 'text-slate-500'}`}>
                      Balance (50%)
                    </span>
                  </div>
                  <span className={`font-black tabular-nums text-sm ${quote.finalPaidAt ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {formatMoney(quote.finalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Staff / Team Assignment */}
            {((quote as any).assignedTeam || quote.assignedStaff) && (
              <div className="bg-white p-5 border border-black/[0.07]">
                <h3 className="font-black mb-3 text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                  {(quote as any).assignedTeam ? "Assigned Team" : "Assigned Staff"}
                </h3>
                {(quote as any).assignedTeam ? (
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base"
                        style={{ background: (quote as any).assignedTeam.color || "#6366f1" }}>
                        👥
                      </div>
                      <div>
                        <p className="font-bold text-sm">{(quote as any).assignedTeam.name}</p>
                        <p className="text-xs text-muted-foreground">{(quote as any).assignedTeam.members?.length ?? 0} members</p>
                      </div>
                    </div>
                    {(quote as any).assignedTeam.members?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(quote as any).assignedTeam.members.map((m: any) => (
                          <span key={m.id} className="bg-secondary border rounded-full px-2.5 py-0.5 text-xs font-medium">{m.name}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {quote.assignedStaff!.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{quote.assignedStaff!.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{quote.assignedStaff!.role}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Internal Notes */}
            {quote.notes && (
              <div className="bg-amber-50 p-4 border border-amber-200">
                <h3 className="font-black mb-2 text-[10px] text-amber-600 uppercase tracking-[0.2em]">Internal Notes</h3>
                <p className="text-sm text-amber-800 leading-relaxed">{quote.notes}</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Mobile sticky bottom action bar — sits above AdminBottomNav (h-16) */}
      <div className="fixed bottom-16 sm:bottom-0 inset-x-0 lg:hidden bg-white border-t border-black/[0.1] z-40 p-3">
        {['submitted', 'under_review'].includes(quote.status) && (
          <button onClick={handleApproveAndRequestDeposit} disabled={updateStatus.isPending} data-testid="button-mobile-approve"
            className="w-full bg-black text-white py-3.5 font-black text-xs uppercase tracking-[0.12em] flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-neutral-800 transition-colors">
            <CheckCircle2 className="w-4 h-4" /> Approve & Request Deposit
          </button>
        )}
        {quote.status === 'deposit_requested' && (
          <div className="w-full py-3 text-center text-xs font-black uppercase tracking-[0.1em] text-amber-700 bg-amber-50 border border-amber-200">
            Awaiting deposit — {formatMoney(quote.depositAmount)}
          </div>
        )}
        {quote.status === 'deposit_paid' && (
          <div className="w-full py-3 text-center text-xs font-black uppercase tracking-[0.1em] text-emerald-700 bg-emerald-50 border border-emerald-200">
            Deposit paid — awaiting booking
          </div>
        )}
        {quote.status === 'booked' && (
          <div className="flex gap-2">
            <select value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}
              className="flex-1 px-3 py-3 bg-slate-50 border border-black/10 outline-none focus:border-black text-sm">
              <option value="">Select staff or team…</option>
              {teamsList.length > 0 && (
                <optgroup label="── Teams">
                  {teamsList.map((t: any) => (
                    <option key={`team:${t.id}`} value={`team:${t.id}`}>👥 {t.name}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="── Individual Staff">
                {staffList?.map((s: any) => (
                  <option key={`staff:${s.id}`} value={`staff:${s.id}`}>{s.name}</option>
                ))}
              </optgroup>
            </select>
            <button onClick={handleAssign} disabled={updateStatus.isPending || !selectedAssignee} data-testid="button-mobile-assign"
              className="px-4 py-3 bg-black text-white font-black text-xs uppercase tracking-[0.1em] flex items-center gap-2 disabled:opacity-50 hover:bg-neutral-800 transition-colors">
              <UserPlus className="w-4 h-4" /> Assign
            </button>
          </div>
        )}
        {['in_progress', 'completed', 'assigned'].includes(quote.status) && (
          <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-mobile-final-payment"
            className="w-full bg-black text-white py-3.5 font-black text-xs uppercase tracking-[0.12em] flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-neutral-800 transition-colors">
            <DollarSign className="w-4 h-4" /> {requestFinalPayment.isPending ? "Sending…" : "Mark Done & Request Final Payment"}
          </button>
        )}
        {quote.status === 'final_payment_requested' && (
          <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-mobile-resend-payment"
            className="w-full border border-black/20 text-slate-700 bg-white py-3.5 font-black text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-50 transition-colors">
            <DollarSign className="w-4 h-4" /> Resend Final Payment Email
          </button>
        )}
        {['closed', 'final_paid'].includes(quote.status) && (
          <div className="w-full py-3 text-center text-xs font-black uppercase tracking-[0.1em] text-emerald-700 bg-emerald-50 border border-emerald-200">
            Case Closed — {formatMoney(quote.total)} collected
          </div>
        )}
        {quote.status === 'cancelled' && (
          <div className="w-full py-3 text-center text-xs font-black uppercase tracking-[0.1em] text-red-600 bg-red-50 border border-red-200">
            Job Cancelled
          </div>
        )}
      </div>

      {/* Photo Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
          data-testid="lightbox-overlay"
        >
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
            data-testid="button-lightbox-close"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxPhoto}
            alt="Photo proof enlarged"
            className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
            data-testid="lightbox-image"
          />
        </div>
      )}
    </div>
  );
}
