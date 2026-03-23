import { useParams, Link, useLocation } from "wouter";
import { useQuote, useUpdateQuoteStatus, useRequestFinalPayment, useConfirmBooking, useEditQuote, useCloseQuote } from "@/hooks/use-quotes";
import { useStaffList } from "@/hooks/use-staff";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, UserPlus, CheckCircle2, Clock, MapPin, Receipt, AlertTriangle, 
  DollarSign, Phone, MessageCircle, Edit2, Save, X, Plus, Trash2, Calendar, XCircle, Camera,
  ClipboardList, Banknote, CalendarCheck, Zap, BadgeCheck, AlertOctagon, Send
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const TERMINAL_STATUSES_UI = ['closed', 'cancelled'];

function formatMoney(v: any) {
  return `$${Number(v || 0).toFixed(2)}`;
}

export default function AdminQuoteDetail() {
  const params = useParams();
  const id = params.id!;
  const [, navigate] = useLocation();
  
  const { data: quote, isLoading, isFetching } = useQuote(id);
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [waPhoneOverride, setWaPhoneOverride] = useState(""); // for web quotes with no stored WA phone
  const [waSentAt, setWaSentAt] = useState<Date | null>(null); // tracks last WA send
  const [emailSentAt, setEmailSentAt] = useState<Date | null>(null); // tracks last email send

  const deleteQuoteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/admin/quotes/${id}`),
    onSuccess: () => {
      toast({ title: "Case Deleted", description: "The job case has been permanently removed." });
      navigate("/admin");
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const sendWhatsAppPayment = useMutation({
    mutationFn: (phone?: string) =>
      apiRequest("POST", `/api/admin/quotes/${id}/send-whatsapp-payment`, phone ? { phone } : undefined),
    onSuccess: () => {
      setWaSentAt(new Date());
      toast({ title: "✅ WhatsApp Sent", description: "Payment reminder sent to customer." });
    },
    onError: (err: any) => {
      let reason = err?.message || "Could not send WhatsApp message.";
      try { reason = JSON.parse(reason.replace(/^\d+:\s*/, "")).message || reason; } catch {}
      toast({ title: "Failed to send", description: reason, variant: "destructive" });
    },
  });

  const resendDepositEmail = useMutation({
    mutationFn: () => apiRequest("POST", `/api/admin/quotes/${id}/resend-deposit-email`),
    onSuccess: () => {
      setEmailSentAt(new Date());
      toast({ title: "✅ Email Sent", description: "Deposit payment email resent to customer." });
    },
    onError: (err: any) => {
      let reason = err?.message || "Could not send email.";
      try { reason = JSON.parse(reason.replace(/^\d+:\s*/, "")).message || reason; } catch {}
      toast({ title: "Failed to send email", description: reason, variant: "destructive" });
    },
  });

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
    <div className="min-h-screen pt-14 pb-32 lg:pb-20 lg:pl-56 bg-[#F5F5F7] overflow-x-hidden">

      {/* Light header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors mb-4">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-mono font-medium text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-lg tracking-widest">
                  {quote.referenceNo}
                </span>
                <StatusBadge status={quote.status} />
                {!TERMINAL_STATUSES_UI.includes(quote.status) && (
                  <span className="flex items-center gap-1 text-xs font-medium text-gray-400" title="Page auto-refreshes every few seconds">
                    <span className={`w-1.5 h-1.5 rounded-full ${isFetching ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                    Live
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight truncate">{quote.customer?.name}</h1>
              <p className="text-gray-400 text-sm mt-1.5">
                {format(new Date(quote.createdAt), "d MMM yyyy, h:mm a")}
                {quote.scheduledAt && (
                  <span className="ml-2 text-blue-600 font-semibold">
                    · Job {format(new Date(quote.scheduledAt), "d MMM, h:mm a")}
                  </span>
                )}
              </p>
            </div>
            {/* Total + edit button */}
            <div className="shrink-0 flex flex-col items-end gap-3">
              <div className="text-right">
                <p className="text-xs font-medium text-gray-400 mb-0.5">Total</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{formatMoney(quote.total)}</p>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && !isEditing && (
                  <button onClick={handleStartEdit} data-testid="button-edit-quote"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-xl transition-all">
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  data-testid="button-delete-quote"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-xl transition-all"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
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
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm" data-testid="status-pipeline">
                  <p className="text-xs font-medium text-gray-400 mb-4">Job Pipeline</p>
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
                    <div className="mt-2 text-center text-xs font-semibold text-red-600 bg-red-50 border border-red-200 py-2">
                      This job was cancelled
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Customer + Address */}
            <div className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-5">
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
                        <label className="text-xs font-medium text-gray-500 mb-1 block">{f.label}</label>
                        <input value={editCustomer[f.key] || ''} onChange={e => setEditCustomer({ ...editCustomer, [f.key]: e.target.value })}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none focus:bg-white focus:border-blue-400 transition-all"
                          data-testid={`input-edit-${f.key}`} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Service Address</label>
                    <input value={editQuoteData.serviceAddress || ''} onChange={e => setEditQuoteData({ ...editQuoteData, serviceAddress: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none focus:bg-white focus:border-blue-400 transition-all"
                      data-testid="input-edit-address" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Pickup Address</label>
                      <input value={editQuoteData.pickupAddress || ''} onChange={e => setEditQuoteData({ ...editQuoteData, pickupAddress: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none focus:bg-white focus:border-blue-400 transition-all" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Dropoff Address</label>
                      <input value={editQuoteData.dropoffAddress || ''} onChange={e => setEditQuoteData({ ...editQuoteData, dropoffAddress: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none focus:bg-white focus:border-blue-400 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Internal Notes</label>
                    <textarea value={editQuoteData.notes || ''} onChange={e => setEditQuoteData({ ...editQuoteData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-sm outline-none focus:bg-white focus:border-blue-400 transition-all resize-none"
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
                    <div className="grid grid-cols-3 gap-1.5 mt-4">
                      <a href={`tel:${quote.customer?.phone}`} data-testid="button-call"
                        className="flex flex-col items-center gap-1 px-3 py-2.5 border border-gray-200 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-50 transition-all">
                        <Phone className="w-4 h-4" /> Call
                      </a>
                      <a href={`https://wa.me/${quote.customer?.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" data-testid="button-whatsapp"
                        className="flex flex-col items-center gap-1 px-3 py-2.5 border border-emerald-300 text-emerald-700 text-xs font-medium rounded-xl hover:bg-emerald-50 transition-all">
                        <MessageCircle className="w-4 h-4" /> WhatsApp
                      </a>
                      <a href={`mailto:${quote.customer?.email}`} data-testid="button-email"
                        className="flex flex-col items-center gap-1 px-3 py-2.5 border border-gray-200 text-gray-700 text-xs font-medium rounded-xl hover:bg-gray-50 transition-all">
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
                      <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-bold text-blue-700">
                        <MapPin className="w-3 h-3" /> Route: {Number(quote.distanceKm).toFixed(1)} km
                      </div>
                    )}
                    {quote.preferredDate && !quote.scheduledAt && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200">
                        <p className="text-xs font-medium text-amber-700 mb-1">Customer's Requested Slot</p>
                        <p className="font-bold text-sm mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-600" />
                          {format(new Date(quote.preferredDate + "T12:00:00"), 'EEE, MMM d, yyyy')} · {quote.preferredTimeWindow}
                        </p>
                      </div>
                    )}
                    {quote.scheduledAt && (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                        <p className="text-xs font-medium text-gray-500 mb-1">Confirmed Slot</p>
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
            <div className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Receipt className="w-4 h-4" /> Items & Pricing
                </h3>
                {isEditing && (
                  <button onClick={addEditItem} data-testid="button-add-item"
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 bg-gray-50 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-100 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                )}
                {!isEditing && quote.aiConfidenceScore && quote.aiConfidenceScore < 80 && (
                  <div className="bg-amber-100 text-amber-700 px-2.5 py-1 text-xs font-medium rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Low Confidence
                  </div>
                )}
              </div>

              {/* AI photo scan thumbnail */}
              {!isEditing && quote.detectionPhotoUrl && (
                <div className="flex items-start gap-4 mb-5 p-4 bg-emerald-50 border border-emerald-200">
                  <button type="button" onClick={() => setLightboxPhoto(quote.detectionPhotoUrl)} className="focus:outline-none group relative shrink-0" data-testid="button-ai-photo">
                    <img src={quote.detectionPhotoUrl} alt="Customer submitted photo" className="w-20 h-20 object-cover border-2 border-emerald-300 group-hover:border-emerald-500 transition-colors" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
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
                    <div key={i} className="p-3 border border-gray-200 rounded-xl bg-gray-50 space-y-2" data-testid={`edit-item-${i}`}>
                      <div className="flex gap-2">
                        <input value={item.detectedName || item.originalDescription} onChange={e => updateEditItem(i, 'detectedName', e.target.value)}
                          placeholder="Item name" className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-xl bg-white text-sm outline-none focus:border-blue-400 transition-all" />
                        <button onClick={() => removeEditItem(i)} className="w-8 h-8 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center shrink-0 border border-gray-200">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <select value={item.serviceType} onChange={e => updateEditItem(i, 'serviceType', e.target.value)}
                          className="px-2 py-2 border border-gray-200 rounded-xl bg-white text-xs outline-none focus:border-blue-400 transition-all">
                          <option value="install">Install</option>
                          <option value="dismantle">Dismantle</option>
                          <option value="relocate">Relocate</option>
                          <option value="dispose">Dispose (Haul Away)</option>
                          <option value="dismantle_dispose">Dismantle + Dispose</option>
                        </select>
                        <input type="number" min="1" value={item.quantity} onChange={e => updateEditItem(i, 'quantity', parseInt(e.target.value) || 1)}
                          placeholder="Qty" className="px-2 py-2 border border-gray-200 rounded-xl bg-white text-sm outline-none focus:border-blue-400 text-center transition-all" />
                        <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateEditItem(i, 'unitPrice', e.target.value)}
                          className="px-2 py-2 border border-gray-200 rounded-xl bg-white text-sm outline-none focus:border-blue-400 transition-all" placeholder="$Price" />
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-3 mt-3 pt-3 border-t">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Transport Fee ($)</label>
                      <input type="number" min="0" step="0.01" value={editQuoteData.transportFee || '0'} onChange={e => setEditQuoteData({ ...editQuoteData, transportFee: e.target.value })}
                        className="w-28 px-3 py-2 border border-gray-200 rounded-xl bg-white text-sm outline-none focus:border-blue-400 transition-all" />
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-muted-foreground">Subtotal: <strong>${editSubtotal.toFixed(2)}</strong></p>
                      <p className="text-xs text-muted-foreground">Transport: <strong>${editTransport.toFixed(2)}</strong></p>
                      <p className="text-base font-bold text-gray-900 mt-1">Total: ${editTotal.toFixed(2)}</p>
                      <p className="text-xs text-emerald-600 font-semibold">50% Deposit: ${(editTotal * 0.5).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSaveEdit} disabled={editQuote.isPending} data-testid="button-save-edit"
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50">
                      <Save className="w-4 h-4" /> {editQuote.isPending ? "Saving..." : "Save Changes"}
                    </button>
                    <button onClick={() => setIsEditing(false)} data-testid="button-cancel-edit"
                      className="flex items-center gap-1.5 px-5 py-2.5 border border-gray-200 font-medium text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-all">
                      <X className="w-4 h-4" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Items table */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden mb-5">
                    <div className="grid grid-cols-[1fr_auto_auto] bg-gray-50 border-b border-gray-100">
                      <span className="px-4 py-2.5 text-xs font-medium text-gray-500">Item</span>
                      <span className="px-3 py-2.5 text-xs font-medium text-gray-500 text-center">Qty</span>
                      <span className="px-4 py-2.5 text-xs font-medium text-gray-500 text-right">Amount</span>
                    </div>
                    {quote.items?.map((item: any, idx: number) => (
                      <div key={item.id} className={`grid grid-cols-[1fr_auto_auto] items-start border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? "bg-gray-50/40" : "bg-white"}`}>
                        <div className="px-4 py-3 min-w-0">
                          <p className="font-semibold text-[13px] text-slate-800 leading-tight">{item.detectedName || item.originalDescription}</p>
                          <p className="text-[11px] text-slate-400 capitalize mt-0.5">{item.serviceType} · ${Number(item.unitPrice).toFixed(0)}/unit</p>
                        </div>
                        <div className="px-4 py-3 text-center">
                          <span className="text-sm font-bold text-slate-700 tabular-nums">×{item.quantity}</span>
                        </div>
                        <div className="px-4 py-3 text-right">
                          <span className="text-sm font-bold text-gray-900 tabular-nums">{formatMoney(item.subtotal)}</span>
                        </div>
                      </div>
                    ))}
                    {(!quote.items || quote.items.length === 0) && (
                      <p className="py-6 text-sm text-slate-400 text-center">No items</p>
                    )}
                  </div>
                  {/* Pricing breakdown */}
                  <div className="flex justify-end">
                    <div className="w-full sm:w-64 border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="divide-y divide-black/[0.05]">
                        <div className="flex justify-between px-4 py-2.5 text-sm">
                          <span className="text-slate-500">Labor subtotal</span>
                          <span className="font-semibold text-slate-700 tabular-nums">{formatMoney(quote.subtotal)}</span>
                        </div>
                        {Number(quote.discount || 0) > 0 && (
                          <div className="flex justify-between px-4 py-2.5 text-sm">
                            <span className="text-emerald-600">Bulk discount</span>
                            <span className="font-semibold text-emerald-600 tabular-nums">−{formatMoney(quote.discount)}</span>
                          </div>
                        )}
                        {Number(quote.transportFee || 0) > 0 && (
                          <div className="flex justify-between px-4 py-2.5 text-sm">
                            <span className="text-slate-500">Logistics fees</span>
                            <span className="font-semibold text-slate-700 tabular-nums">{formatMoney(quote.transportFee)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center px-4 py-3 bg-blue-600 text-white">
                        <span className="text-xs font-semibold text-white">Total</span>
                        <span className="text-lg font-bold tabular-nums">{formatMoney(quote.total)}</span>
                      </div>
                      <div className="divide-y divide-black/[0.05]">
                        <div className="flex justify-between px-4 py-2 text-xs">
                          <span className="text-emerald-600 font-semibold">50% Deposit</span>
                          <span className="font-bold text-emerald-700 tabular-nums">{formatMoney(quote.depositAmount)}</span>
                        </div>
                        <div className="flex justify-between px-4 py-2 text-xs">
                          <span className="text-slate-400">Balance (50%)</span>
                          <span className="font-semibold text-slate-600 tabular-nums">{formatMoney(quote.finalAmount)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-5">
                <Clock className="w-4 h-4" /> Job Timeline &amp; Field Proof
              </h3>
              <div className="space-y-0">
                {quote.updates?.map((update: any, updateIdx: number) => {
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
                      <div className="flex flex-col items-center shrink-0 mt-1">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          isArrival    ? 'bg-blue-100 border-blue-500' :
                          isCompletion ? 'bg-emerald-100 border-emerald-500' :
                          'bg-primary/10 border-primary/60'
                        }`} />
                        {updateIdx < (quote.updates?.length ?? 1) - 1 && (
                          <div className="w-px flex-1 bg-gray-200 min-h-[24px] mt-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-5">

                        {/* Field event — arrival or completion: show prominent timestamp block */}
                        {isFieldEvent ? (
                          <div className={`border rounded-2xl p-4 mb-3 ${
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
                                <p className={`text-lg font-bold ${
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
                          <div className="mt-2 inline-flex items-center gap-2 bg-white border border-blue-200 px-3 py-2">
                            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                            <span className="text-xs font-semibold text-blue-800">
                              {Number(update.gpsLat).toFixed(5)}, {Number(update.gpsLng).toFixed(5)}
                            </span>
                            <a
                              href={`https://maps.google.com/?q=${update.gpsLat},${update.gpsLng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 ml-1"
                            >
                              Maps ↗
                            </a>
                          </div>
                        )}

                        {/* Photo Proof */}
                        {photos.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-gray-500 mb-2">
                              Photo Proof ({photos.length})
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {photos.map((p: string, i: number) => (
                                <button key={i} type="button" onClick={() => setLightboxPhoto(p)}
                                  className="focus:outline-none group relative" data-testid={`button-photo-${i}`}>
                                  <img src={p} alt={`proof-${i + 1}`}
                                    className="w-24 h-24 object-cover border-2 border-slate-200 group-hover:border-slate-400 transition-colors" />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
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
            <div className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm space-y-4">

              {/* Section heading */}
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                <h3 className="text-sm font-semibold text-gray-700">Next Action</h3>
              </div>

              {/* ── PHASE 1: New / Under Review ── */}
              {['submitted', 'under_review'].includes(quote.status) && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 p-3.5 text-sm">
                    <p className="font-bold text-blue-800 flex items-center gap-1.5 mb-1">
                      <ClipboardList className="w-4 h-4" /> Quote Received
                    </p>
                    <p className="text-xs text-blue-700">Review the items and pricing below, then approve to request the deposit from the customer.</p>
                  </div>
                  <button onClick={handleApproveAndRequestDeposit} disabled={updateStatus.isPending} data-testid="button-approve-deposit"
                    className="w-full bg-blue-600 text-white py-3.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition-all">
                    <CheckCircle2 className="w-4 h-4" /> Approve & Request Deposit
                  </button>
                </div>
              )}

              {/* ── PHASE 2a: Deposit Requested ── */}
              {quote.status === 'deposit_requested' && (
                <div className="space-y-3">
                  {/* Status card */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                    <p className="font-semibold text-amber-800 flex items-center gap-1.5 text-sm">
                      <Banknote className="w-4 h-4" /> Awaiting Deposit
                    </p>
                    <p className="text-xs text-amber-700">
                      Waiting for <strong>{(quote as any).customer?.name || "customer"}</strong> to pay the deposit. Use the options below to notify them.
                    </p>
                    <div className="bg-amber-100 px-3 py-2 rounded-lg text-xs text-amber-700 flex items-center justify-between">
                      <span>Deposit due</span>
                      <span className="font-bold">{formatMoney(quote.depositAmount)}</span>
                    </div>
                    {(quote as any).preferredDate && (
                      <div className="bg-amber-100 px-3 py-2 rounded-lg text-xs text-amber-700 flex items-center justify-between">
                        <span>Reserved slot</span>
                        <span className="font-bold">{(quote as any).preferredDate} {(quote as any).preferredTimeWindow ? `· ${(quote as any).preferredTimeWindow}` : ""}</span>
                      </div>
                    )}
                  </div>

                  {/* ── Option 1: Email payment link ── */}
                  {(() => {
                    const custEmail = (quote as any).customer?.email || "";
                    const hasRealEmail = custEmail && !custEmail.endsWith("@tmginstall.com");
                    if (!hasRealEmail) return null;
                    return (
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="bg-blue-50 border-b border-gray-200 px-3.5 py-2.5 flex items-center gap-2">
                          <Send className="w-4 h-4 text-blue-600" />
                          <p className="text-xs font-semibold text-gray-700">Send Payment Link via Email</p>
                        </div>
                        <div className="p-3.5 space-y-3">
                          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                            <Send className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                            <span>Sending to:</span>
                            <span className="font-semibold text-gray-700 font-mono">{custEmail}</span>
                          </div>
                          {emailSentAt && (
                            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                              <BadgeCheck className="w-4 h-4 flex-shrink-0" />
                              <span>Email sent at <strong>{emailSentAt.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}</strong> — you can resend if needed.</span>
                            </div>
                          )}
                          <button
                            onClick={() => resendDepositEmail.mutate()}
                            disabled={resendDepositEmail.isPending}
                            data-testid="button-send-email-payment"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 transition-all shadow-sm"
                          >
                            <Send className="w-4 h-4" />
                            {resendDepositEmail.isPending ? "Sending…" : emailSentAt ? "Resend Payment Email" : "Send Payment Link via Email"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Option 2: WhatsApp payment link ── */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-[#25D366]/8 border-b border-gray-200 px-3.5 py-2.5 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-[#25D366]" />
                      <p className="text-xs font-semibold text-gray-700">Send Payment Link via WhatsApp</p>
                    </div>
                    <div className="p-3.5 space-y-3">
                      <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[11px] text-gray-500 leading-relaxed space-y-0.5">
                        <p className="text-gray-700 font-semibold text-xs mb-1">Message preview:</p>
                        <p>👋 Hi <em>{(quote as any).customer?.name || "Customer"}</em></p>
                        <p>💰 Deposit Required: <strong>{formatMoney(quote.depositAmount)}</strong></p>
                        {(quote as any).preferredDate && <p>📅 Reserved slot: <strong>{(quote as any).preferredDate}</strong></p>}
                        <p>👉 Payment link included</p>
                        <p>📧 Reminder to check Junk/Spam folder</p>
                      </div>

                      {(quote as any).customerWhatsappPhone ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span>Sending to:</span>
                          <span className="font-semibold text-gray-700 font-mono">+{(quote as any).customerWhatsappPhone}</span>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                            Customer WhatsApp Number
                          </label>
                          <input
                            type="tel"
                            value={waPhoneOverride}
                            onChange={e => setWaPhoneOverride(e.target.value)}
                            placeholder="+65 9123 4567"
                            className="w-full border border-gray-200 rounded-xl bg-gray-50 text-sm px-3 py-2.5 focus:outline-none focus:border-blue-400 focus:bg-white transition-all font-mono"
                            data-testid="input-wa-phone-override"
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Enter the customer's WhatsApp number to send the payment link.</p>
                        </div>
                      )}

                      {waSentAt && (
                        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                          <BadgeCheck className="w-4 h-4 flex-shrink-0" />
                          <span>WhatsApp sent at <strong>{waSentAt.toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}</strong> — you can resend if needed.</span>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          const phone = (quote as any).customerWhatsappPhone || waPhoneOverride.trim();
                          if (!phone) {
                            toast({ title: "Phone required", description: "Enter the customer's WhatsApp number.", variant: "destructive" });
                            return;
                          }
                          sendWhatsAppPayment.mutate((quote as any).customerWhatsappPhone ? undefined : phone);
                        }}
                        disabled={sendWhatsAppPayment.isPending || (!(quote as any).customerWhatsappPhone && !waPhoneOverride.trim())}
                        data-testid="button-send-whatsapp-payment"
                        className="w-full bg-[#25D366] hover:bg-[#1db954] text-white py-3 px-4 text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 transition-all shadow-sm"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {sendWhatsAppPayment.isPending ? "Sending…" : waSentAt ? "Resend Payment Link" : "Send Payment Link via WhatsApp"}
                      </button>
                    </div>
                  </div>

                  {/* ── Option 3: WhatsApp reminder (no payment link) ── */}
                  {(quote as any).customerWhatsappPhone && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 border-b border-gray-200 px-3.5 py-2.5 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4 text-gray-500" />
                        <p className="text-xs font-semibold text-gray-700">Send Gentle Reminder via WhatsApp</p>
                      </div>
                      <div className="p-3.5 space-y-3">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[11px] text-gray-500 leading-relaxed space-y-0.5">
                          <p className="text-gray-700 font-semibold text-xs mb-1">Message preview:</p>
                          <p>👋 Hi <em>{(quote as any).customer?.name || "Customer"}</em>, just checking in on your quote <strong>{quote.referenceNo}</strong>.</p>
                          <p>📧 Please check your email (including Spam/Junk) for the payment link we sent.</p>
                          <p>💬 Reply here if you need any help!</p>
                        </div>
                        <button
                          onClick={async () => {
                            const phone = (quote as any).customerWhatsappPhone;
                            const name = (quote as any).customer?.name || "there";
                            const msg = `👋 Hi *${name}*, just a friendly follow-up from TMG Install!\n\nWe noticed your deposit for quote *${quote.referenceNo}* is still pending.\n\n📧 Please check your email (including your *Junk / Spam / Promotions* folder) for the payment link we sent.\n\n💬 Reply here if you need any help or have questions. We're happy to assist!`;
                            try {
                              await apiRequest("POST", "/api/admin/whatsapp/send", { phone, message: msg });
                              toast({ title: "✅ Reminder Sent", description: "Follow-up message sent to customer." });
                            } catch (err: any) {
                              let reason = err?.message || "Could not send.";
                              try { reason = JSON.parse(reason.replace(/^\d+:\s*/, "")).message || reason; } catch {}
                              toast({ title: "Failed to send", description: reason, variant: "destructive" });
                            }
                          }}
                          data-testid="button-send-whatsapp-reminder"
                          className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Send Reminder via WhatsApp
                        </button>
                      </div>
                    </div>
                  )}
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
                    <div className="mt-2 bg-white border border-emerald-200 px-3 py-2 text-xs">
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
                    <div className="bg-violet-50 border border-violet-200 p-3.5 text-sm">
                      <p className="font-bold text-violet-800 flex items-center gap-1.5 mb-1">
                        <CalendarCheck className="w-4 h-4" /> Booking Confirmed
                      </p>
                      <p className="font-bold text-violet-900 text-xs">
                        {format(new Date(quote.scheduledAt), 'EEE, d MMM yyyy')} · {quote.timeWindow}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-2 block">
                      Assign Staff or Team
                    </label>
                    <select value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)} data-testid="select-staff"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl mb-3 outline-none focus:bg-white focus:border-blue-400 transition-all text-sm">
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
                      className="w-full bg-blue-600 text-white py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50">
                      <UserPlus className="w-4 h-4" /> Assign Staff
                    </button>
                  </div>
                </div>
              )}

              {/* ── PHASE 3b: Assigned — awaiting on-site work ── */}
              {quote.status === 'assigned' && (
                <div className="space-y-3">
                  {quote.scheduledAt && (
                    <div className="bg-violet-50 border border-violet-200 p-3.5 text-sm">
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
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 flex items-center justify-center text-white text-sm font-bold shrink-0"
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
                            <span key={m.id} className="bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full text-xs font-medium">{m.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Show assigned individual staff */}
                  {quote.assignedStaff && !(quote as any).assignedTeam && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 text-white font-bold rounded-lg flex items-center justify-center text-sm shrink-0">
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
                      className="w-full bg-blue-600 text-white py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50">
                      <DollarSign className="w-4 h-4" /> {requestFinalPayment.isPending ? "Sending..." : "Mark Done & Request Final Payment"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── PHASE 4: In Progress ── */}
              {quote.status === 'in_progress' && (
                <div className="space-y-3">
                  <div className="bg-pink-50 border border-pink-200 p-4 text-sm">
                    <p className="font-bold text-pink-800 flex items-center gap-1.5 mb-1">
                      <Zap className="w-4 h-4" /> Job In Progress
                    </p>
                    <p className="text-xs text-pink-700">Staff are on-site. Field check-ins will appear in the timeline below.</p>
                  </div>
                  <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-final-payment-inprogress"
                    className="w-full bg-blue-600 text-white py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50">
                    <DollarSign className="w-4 h-4" /> {requestFinalPayment.isPending ? "Sending..." : "Mark Done & Request Final Payment"}
                  </button>
                </div>
              )}

              {/* ── PHASE 4b: Completed — request final payment ── */}
              {quote.status === 'completed' && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 text-sm">
                    <p className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="w-4 h-4" /> Job Completed
                    </p>
                    <p className="text-xs text-emerald-700">Field work is done. Send the final payment request to the customer.</p>
                  </div>
                  <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-final-payment"
                    className="w-full bg-blue-600 text-white py-3.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50">
                    <DollarSign className="w-4 h-4" /> {requestFinalPayment.isPending ? "Sending..." : "Request Final Payment"}
                  </button>
                </div>
              )}

              {/* ── PHASE 5a: Awaiting Final Payment ── */}
              {quote.status === 'final_payment_requested' && (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 p-4 space-y-2">
                    <p className="font-bold text-amber-800 flex items-center gap-1.5 text-sm">
                      <DollarSign className="w-4 h-4" /> Awaiting Final Payment
                    </p>
                    <p className="text-xs text-amber-700">Payment request sent. Waiting for customer to pay the remaining balance.</p>
                    <div className="bg-amber-100 px-3 py-2 text-xs text-amber-700 flex items-center justify-between">
                      <span>Balance due</span>
                      <span className="font-bold">{formatMoney(quote.finalAmount)}</span>
                    </div>
                  </div>
                  <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-resend-final-payment"
                    className="w-full border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 rounded-xl py-2.5 font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    <DollarSign className="w-4 h-4" /> {requestFinalPayment.isPending ? "Sending..." : "Resend Final Payment Email"}
                  </button>
                </div>
              )}

              {/* ── PHASE 5b: Closed / Fully Paid ── */}
              {['closed', 'final_paid'].includes(quote.status) && (
                <div className="bg-emerald-50 border border-emerald-200 p-5 text-center">
                  <BadgeCheck className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-emerald-700 text-sm">Case Closed</p>
                  <p className="text-xs text-emerald-600 mt-1">Total collected: <strong>{formatMoney(quote.total)}</strong></p>
                </div>
              )}

              {/* ── Cancelled ── */}
              {quote.status === 'cancelled' && (
                <div className="bg-red-50 border border-red-200 p-4 text-center">
                  <XCircle className="w-8 h-8 text-red-400 mx-auto mb-1" />
                  <p className="font-semibold text-red-700 text-sm">Job Cancelled</p>
                </div>
              )}

              {/* Manual Close (always available unless terminal) */}
              {!['closed', 'cancelled', 'final_paid'].includes(quote.status) && (
                <div className="pt-2 border-t">
                  <button onClick={handleManualClose} data-testid="button-manual-close"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-all">
                    <XCircle className="w-4 h-4" /> Manual Close / Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Payment Summary */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Total header */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <p className="text-xs font-medium text-gray-400 mb-1">Total Contract Value</p>
                <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatMoney(quote.total)}</p>
              </div>
              {/* Payment rows */}
              <div className="p-4 space-y-2">
                {/* Deposit row */}
                <div className={`flex items-center justify-between px-3 py-2.5 text-sm rounded-xl ${
                  quote.depositPaidAt
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      quote.depositPaidAt ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'
                    }`}>{quote.depositPaidAt ? '✓' : '1'}</div>
                    <span className={`font-semibold text-xs ${quote.depositPaidAt ? 'text-emerald-700' : 'text-gray-500'}`}>
                      Deposit (50%)
                    </span>
                  </div>
                  <span className={`font-bold tabular-nums text-sm ${quote.depositPaidAt ? 'text-emerald-700' : 'text-gray-700'}`}>
                    {formatMoney(quote.depositAmount)}
                  </span>
                </div>
                {/* Balance row */}
                <div className={`flex items-center justify-between px-3 py-2.5 text-sm rounded-xl ${
                  quote.finalPaidAt
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-gray-50 border border-gray-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      quote.finalPaidAt ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'
                    }`}>{quote.finalPaidAt ? '✓' : '2'}</div>
                    <span className={`font-semibold text-xs ${quote.finalPaidAt ? 'text-emerald-700' : 'text-gray-500'}`}>
                      Balance (50%)
                    </span>
                  </div>
                  <span className={`font-bold tabular-nums text-sm ${quote.finalPaidAt ? 'text-emerald-700' : 'text-gray-700'}`}>
                    {formatMoney(quote.finalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Staff / Team Assignment */}
            {((quote as any).assignedTeam || quote.assignedStaff) && (
              <div className="bg-white p-5 border border-gray-200 rounded-2xl shadow-sm">
                <h3 className="text-xs font-medium text-gray-400 mb-3">
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
                          <span key={m.id} className="bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full text-xs font-medium">{m.name}</span>
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
              <div className="bg-amber-50 p-4 border border-amber-200 rounded-2xl">
                <h3 className="text-xs font-semibold text-amber-600 mb-2">Internal Notes</h3>
                <p className="text-sm text-amber-800 leading-relaxed">{quote.notes}</p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Mobile sticky bottom action bar — sits above AdminBottomNav (h-16) */}
      <div className="fixed bottom-16 sm:bottom-0 inset-x-0 lg:hidden bg-white border-t border-gray-200 z-40 p-3">
        {['submitted', 'under_review'].includes(quote.status) && (
          <button onClick={handleApproveAndRequestDeposit} disabled={updateStatus.isPending} data-testid="button-mobile-approve"
            className="w-full bg-blue-600 text-white py-3.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition-all">
            <CheckCircle2 className="w-4 h-4" /> Approve & Request Deposit
          </button>
        )}
        {quote.status === 'deposit_requested' && (
          <div className="w-full py-3 text-center text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
            Awaiting deposit — {formatMoney(quote.depositAmount)}
          </div>
        )}
        {quote.status === 'deposit_paid' && (
          <div className="w-full py-3 text-center text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
            Deposit paid — awaiting booking
          </div>
        )}
        {quote.status === 'booked' && (
          <div className="flex gap-2">
            <select value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}
              className="flex-1 px-3 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 transition-all text-sm">
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
              className="px-4 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition-all">
              <UserPlus className="w-4 h-4" /> Assign
            </button>
          </div>
        )}
        {['in_progress', 'completed', 'assigned'].includes(quote.status) && (
          <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-mobile-final-payment"
            className="w-full bg-blue-600 text-white py-3.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-blue-700 transition-all">
            <DollarSign className="w-4 h-4" /> {requestFinalPayment.isPending ? "Sending…" : "Mark Done & Request Final Payment"}
          </button>
        )}
        {quote.status === 'final_payment_requested' && (
          <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-mobile-resend-payment"
            className="w-full border border-gray-200 text-gray-700 bg-white rounded-xl py-3.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-gray-50 transition-all">
            <DollarSign className="w-4 h-4" /> Resend Final Payment Email
          </button>
        )}
        {['closed', 'final_paid'].includes(quote.status) && (
          <div className="w-full py-3 text-center text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl">
            Case Closed — {formatMoney(quote.total)} collected
          </div>
        )}
        {quote.status === 'cancelled' && (
          <div className="w-full py-3 text-center text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl">
            Job Cancelled
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" data-testid="modal-delete-confirm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-red-600 px-5 py-4 flex items-center gap-3">
              <AlertOctagon className="w-5 h-5 text-white shrink-0" />
              <p className="text-white font-semibold text-sm">Delete Job Case</p>
            </div>
            <div className="px-5 py-5 space-y-3">
              <p className="text-sm text-gray-600 leading-relaxed">
                Permanently delete <strong>{quote.referenceNo}</strong> for <strong>{quote.customer?.name}</strong>?
                This removes all items, updates, and history. <span className="text-red-600 font-bold">This cannot be undone.</span>
              </p>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => deleteQuoteMutation.mutate()}
                disabled={deleteQuoteMutation.isPending}
                data-testid="button-confirm-delete"
                className="flex-1 h-10 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-all"
              >
                {deleteQuoteMutation.isPending ? "Deleting…" : "Yes, Delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteQuoteMutation.isPending}
                data-testid="button-cancel-delete"
                className="flex-1 h-10 border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
