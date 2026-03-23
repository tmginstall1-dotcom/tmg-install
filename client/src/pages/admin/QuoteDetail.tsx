import { useParams, Link, useLocation } from "wouter";
import { useQuote, useUpdateQuoteStatus, useRequestFinalPayment, useConfirmBooking, useEditQuote, useCloseQuote } from "@/hooks/use-quotes";
import { useStaffList } from "@/hooks/use-staff";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, UserPlus, CheckCircle2, Clock, MapPin, Receipt, AlertTriangle, 
  DollarSign, Phone, MessageCircle, Edit2, Save, X, Plus, Trash2, Calendar, XCircle, Camera,
  ClipboardList, Banknote, CalendarCheck, Zap, BadgeCheck, AlertOctagon, Send, Loader2, Mail
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

  if (isLoading) {
    return (
      <div className="min-h-screen pt-14 pb-16 lg:pl-56 bg-[#F5F5F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin border-2 border-zinc-200 border-t-zinc-700 rounded-full" />
          <p className="text-sm font-medium">Loading details…</p>
        </div>
      </div>
    );
  }
  
  if (!quote) {
    return (
      <div className="min-h-screen pt-14 pb-16 lg:pl-56 bg-[#F5F5F7] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-500">Quote not found</p>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen pt-14 pb-32 lg:pb-16 lg:pl-56 bg-[#F5F5F7] overflow-x-hidden relative">

      {/* Sticky Header */}
      <div className="sticky top-14 z-30 bg-white border-b border-zinc-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <button className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs text-zinc-500 font-mono tracking-wider">{quote.referenceNo}</span>
                <StatusBadge status={quote.status} />
                {!TERMINAL_STATUSES_UI.includes(quote.status) && isFetching && (
                  <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />
                )}
              </div>
              <h1 className="text-lg font-semibold text-zinc-900">{quote.customer?.name}</h1>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && !isEditing && (
              <button onClick={handleStartEdit} data-testid="button-edit-quote"
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors">
                <Edit2 className="w-4 h-4 text-zinc-400" /> Edit
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              data-testid="button-delete-quote"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          
          {/* Left Column */}
          <div className="space-y-6">
            
            {/* Customer & Service Info */}
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-zinc-400" /> Details
                </h2>
              </div>
              
              {isEditing ? (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Name</label>
                      <input value={editCustomer.name || ''} onChange={e => setEditCustomer({ ...editCustomer, name: e.target.value })}
                        className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        data-testid="input-edit-name" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Email</label>
                      <input value={editCustomer.email || ''} onChange={e => setEditCustomer({ ...editCustomer, email: e.target.value })}
                        className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        data-testid="input-edit-email" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Phone</label>
                      <input value={editCustomer.phone || ''} onChange={e => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                        className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        data-testid="input-edit-phone" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Service Address</label>
                    <input value={editQuoteData.serviceAddress || ''} onChange={e => setEditQuoteData({ ...editQuoteData, serviceAddress: e.target.value })}
                      className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      data-testid="input-edit-address" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Pickup Address</label>
                      <input value={editQuoteData.pickupAddress || ''} onChange={e => setEditQuoteData({ ...editQuoteData, pickupAddress: e.target.value })}
                        className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Dropoff Address</label>
                      <input value={editQuoteData.dropoffAddress || ''} onChange={e => setEditQuoteData({ ...editQuoteData, dropoffAddress: e.target.value })}
                        className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Internal Notes</label>
                    <textarea value={editQuoteData.notes || ''} onChange={e => setEditQuoteData({ ...editQuoteData, notes: e.target.value })}
                      rows={3}
                      className="w-full p-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                      placeholder="Internal admin notes..." />
                  </div>
                </div>
              ) : (
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                  <div className="space-y-4">
                    <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                      <span className="text-xs text-zinc-500">Customer</span>
                      <span className="text-sm font-medium text-zinc-900">{quote.customer?.name}</span>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                      <span className="text-xs text-zinc-500">Email</span>
                      <a href={`mailto:${quote.customer?.email}`} className="text-sm text-blue-600 hover:underline">{quote.customer?.email}</a>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                      <span className="text-xs text-zinc-500">Phone</span>
                      <div className="flex gap-3 items-center">
                        <a href={`tel:${quote.customer?.phone}`} className="text-sm text-zinc-900 hover:underline">{quote.customer?.phone}</a>
                        <a href={`https://wa.me/${quote.customer?.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 hover:bg-emerald-100 transition-colors">
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                      </div>
                    </div>
                    <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                      <span className="text-xs text-zinc-500">Created</span>
                      <span className="text-sm text-zinc-900">{format(new Date(quote.createdAt), "MMM d, yyyy h:mm a")}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                      <span className="text-xs text-zinc-500 mt-0.5">Service At</span>
                      <span className="text-sm text-zinc-900 leading-snug">{quote.serviceAddress}</span>
                    </div>
                    {quote.pickupAddress && (
                      <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                        <span className="text-xs text-zinc-500 mt-0.5">Pickup At</span>
                        <span className="text-sm text-zinc-900 leading-snug">{quote.pickupAddress}</span>
                      </div>
                    )}
                    {quote.dropoffAddress && (
                      <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                        <span className="text-xs text-zinc-500 mt-0.5">Dropoff At</span>
                        <span className="text-sm text-zinc-900 leading-snug">{quote.dropoffAddress}</span>
                      </div>
                    )}
                    {quote.distanceKm && Number(quote.distanceKm) > 0 && (
                      <div className="grid grid-cols-[100px_1fr] gap-2 items-center">
                        <span className="text-xs text-zinc-500">Distance</span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-zinc-100 text-zinc-700 text-xs font-medium rounded-md w-fit border border-zinc-200">
                          {Number(quote.distanceKm).toFixed(1)} km
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Photos Box */}
            {!isEditing && quote.detectionPhotoUrl && (
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-100">
                  <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-zinc-400" /> Reference Photos
                  </h2>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    <button 
                      type="button" 
                      onClick={() => setLightboxPhoto(quote.detectionPhotoUrl)} 
                      className="group relative aspect-square rounded-lg overflow-hidden border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <img src={quote.detectionPhotoUrl} alt="Customer submitted" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-medium">View</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items & Pricing */}
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-zinc-400" /> Quote Items
                </h2>
                {isEditing && (
                  <button onClick={addEditItem} data-testid="button-add-item"
                    className="inline-flex items-center gap-2 h-7 px-2.5 rounded-md text-blue-600 hover:bg-blue-50 text-xs font-medium transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="p-5">
                  <div className="space-y-3">
                    {editItems.map((item, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-3 p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                        <div className="flex-1 space-y-3">
                          <input value={item.detectedName || item.originalDescription} onChange={e => updateEditItem(i, 'detectedName', e.target.value)}
                            placeholder="Item description" className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                          <div className="grid grid-cols-3 gap-3">
                            <select value={item.serviceType} onChange={e => updateEditItem(i, 'serviceType', e.target.value)}
                              className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                              <option value="install">Install</option>
                              <option value="dismantle">Dismantle</option>
                              <option value="relocate">Relocate</option>
                              <option value="dispose">Dispose</option>
                              <option value="dismantle_dispose">Dismantle + Dispose</option>
                            </select>
                            <input type="number" min="1" value={item.quantity} onChange={e => updateEditItem(i, 'quantity', parseInt(e.target.value) || 1)}
                              placeholder="Qty" className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-center" />
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                              <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateEditItem(i, 'unitPrice', e.target.value)}
                                className="h-9 w-full pl-6 pr-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                            </div>
                          </div>
                        </div>
                        <button onClick={() => removeEditItem(i)} className="inline-flex items-center justify-center w-9 h-9 sm:w-auto sm:px-3 rounded-lg text-red-600 bg-white border border-zinc-300 hover:bg-red-50 hover:border-red-200 transition-colors self-start">
                          <Trash2 className="w-4 h-4 sm:mr-1.5" /> <span className="hidden sm:inline text-sm font-medium">Remove</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 pt-5 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1.5">Transport Fee</label>
                      <div className="relative w-32">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                        <input type="number" min="0" step="0.01" value={editQuoteData.transportFee || '0'} onChange={e => setEditQuoteData({ ...editQuoteData, transportFee: e.target.value })}
                          className="h-9 w-full pl-6 pr-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                      </div>
                    </div>
                    
                    <div className="text-right w-full sm:w-auto bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                      <div className="flex justify-between sm:justify-end gap-6 text-sm mb-1.5">
                        <span className="text-zinc-500">Subtotal</span>
                        <span className="font-medium text-zinc-900">${editSubtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between sm:justify-end gap-6 text-sm mb-3">
                        <span className="text-zinc-500">Transport</span>
                        <span className="font-medium text-zinc-900">${editTransport.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between sm:justify-end gap-6 text-base font-semibold border-t border-zinc-200 pt-2">
                        <span className="text-zinc-900">Total</span>
                        <span className="text-zinc-900">${editTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button onClick={handleSaveEdit} disabled={editQuote.isPending} data-testid="button-save-edit"
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                      <Save className="w-4 h-4" /> {editQuote.isPending ? "Saving..." : "Save Changes"}
                    </button>
                    <button onClick={() => setIsEditing(false)} data-testid="button-cancel-edit"
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <table className="table-fixed w-full">
                    <thead>
                      <tr>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Item Details</th>
                        <th className="w-20 px-5 py-3 text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Qty</th>
                        <th className="w-32 px-5 py-3 text-right text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.items?.map((item: any) => (
                        <tr key={item.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-5 py-3 border-b border-zinc-100">
                            <p className="text-sm font-medium text-zinc-900 leading-tight">{item.detectedName || item.originalDescription}</p>
                            <p className="text-xs text-zinc-500 mt-0.5 capitalize">{item.serviceType} · ${Number(item.unitPrice).toFixed(0)}/ea</p>
                          </td>
                          <td className="px-5 py-3 border-b border-zinc-100 text-center text-sm text-zinc-700">
                            {item.quantity}
                          </td>
                          <td className="px-5 py-3 border-b border-zinc-100 text-right text-sm font-medium text-zinc-900 tabular-nums">
                            {formatMoney(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                      {(!quote.items || quote.items.length === 0) && (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-sm text-zinc-500 border-b border-zinc-100">
                            No items in this quote.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  
                  <div className="bg-zinc-50 px-5 py-4 border-t border-zinc-200">
                    <div className="w-full sm:w-64 ml-auto space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Subtotal</span>
                        <span className="font-medium text-zinc-900 tabular-nums">{formatMoney(quote.subtotal || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Transport Fee</span>
                        <span className="font-medium text-zinc-900 tabular-nums">{formatMoney(quote.transportFee || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-zinc-200 mt-2">
                        <span className="text-sm font-semibold text-zinc-900">Total Due</span>
                        <span className="text-lg font-bold text-zinc-900 tabular-nums">{formatMoney(quote.total)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Internal Notes Display (if not editing) */}
            {!isEditing && quote.notes && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" /> Internal Notes
                </h3>
                <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{quote.notes}</p>
              </div>
            )}
            
          </div>
          
          {/* Right Column (Action Panel) */}
          <div className="space-y-6">
            
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-zinc-50 px-5 py-4 border-b border-zinc-200">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Job Pipeline</p>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-zinc-200">
                  {/* Status Timeline */}
                  {[
                    { id: "quote", label: "Quote Requested", done: true, active: quote.status === 'submitted' || quote.status === 'under_review' },
                    { id: "approved", label: "Quote Approved", done: !['submitted', 'under_review', 'cancelled'].includes(quote.status), active: quote.status === 'approved' },
                    { id: "deposit", label: "Deposit Paid", done: !!quote.depositPaidAt, active: quote.status === 'deposit_requested' },
                    { id: "booked", label: "Booked & Assigned", done: ['booked', 'assigned', 'in_progress', 'completed', 'final_payment_requested', 'final_paid', 'closed'].includes(quote.status), active: quote.status === 'deposit_paid' || quote.status === 'booking_pending' || quote.status === 'booked' || quote.status === 'assigned' },
                    { id: "completed", label: "Job Completed", done: ['completed', 'final_payment_requested', 'final_paid', 'closed'].includes(quote.status), active: quote.status === 'in_progress' },
                    { id: "paid", label: "Final Payment", done: !!quote.finalPaidAt || quote.status === 'closed', active: quote.status === 'completed' || quote.status === 'final_payment_requested' },
                  ].map((step, i) => (
                    <div key={step.id} className="relative flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 ${
                        step.done ? 'bg-blue-600 text-white' : 
                        step.active ? 'bg-white border-2 border-blue-600 text-blue-600' : 
                        'bg-zinc-100 border border-zinc-300 text-transparent'
                      }`}>
                        {step.done && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {!step.done && step.active && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <span className={`text-sm ${step.active ? 'font-semibold text-zinc-900' : step.done ? 'font-medium text-zinc-700' : 'text-zinc-400'}`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons based on status */}
              <div className="p-5 space-y-4">
                
                {['submitted', 'under_review'].includes(quote.status) && (
                  <button onClick={handleApproveAndRequestDeposit} disabled={updateStatus.isPending}
                    className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                    <CheckCircle2 className="w-4 h-4" /> Approve & Request Deposit
                  </button>
                )}

                {quote.status === 'deposit_requested' && (
                  <div className="space-y-3">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-center">
                      <p className="font-semibold text-orange-800">Awaiting Deposit</p>
                      <p className="text-orange-700 mt-0.5">{formatMoney(quote.depositAmount)}</p>
                    </div>
                    <button onClick={() => resendDepositEmail.mutate()} disabled={resendDepositEmail.isPending}
                      className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors disabled:opacity-50">
                      <Mail className="w-4 h-4" /> Resend Payment Email
                    </button>
                  </div>
                )}

                {quote.status === 'deposit_paid' && (
                  <div className="space-y-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-center">
                      <p className="font-semibold text-emerald-800 flex justify-center items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Deposit Paid</p>
                    </div>
                    <button onClick={handleConfirmBooking} disabled={confirmBooking.isPending}
                      className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                      <CalendarCheck className="w-4 h-4" /> Confirm Booking
                    </button>
                  </div>
                )}

                {['booked', 'assigned'].includes(quote.status) && (
                  <div className="space-y-4">
                    {quote.scheduledAt && (
                      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-sm">
                        <p className="text-xs text-zinc-500 mb-1">Confirmed Date</p>
                        <p className="font-semibold text-zinc-900 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                          {format(new Date(quote.scheduledAt), 'EEE, MMM d')} · {quote.timeWindow}
                        </p>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500">Assign Staff or Team</label>
                      <select value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}
                        className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                        <option value="">Select...</option>
                        {teamsList.length > 0 && (
                          <optgroup label="Teams">
                            {teamsList.map((t: any) => (
                              <option key={`team:${t.id}`} value={`team:${t.id}`}>👥 {t.name}</option>
                            ))}
                          </optgroup>
                        )}
                        <optgroup label="Staff">
                          {staffList?.map((s: any) => (
                            <option key={`staff:${s.id}`} value={`staff:${s.id}`}>{s.name}</option>
                          ))}
                        </optgroup>
                      </select>
                      <button onClick={handleAssign} disabled={updateStatus.isPending || !selectedAssignee}
                        className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors disabled:opacity-50">
                        <UserPlus className="w-4 h-4" /> Update Assignment
                      </button>
                    </div>

                    {(quote as any).assignedTeam && (
                      <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700">👥</div>
                        <div>
                          <p className="text-sm font-semibold text-indigo-900">{(quote as any).assignedTeam.name}</p>
                          <p className="text-xs text-indigo-700">Team Assigned</p>
                        </div>
                      </div>
                    )}
                    
                    {quote.assignedStaff && !(quote as any).assignedTeam && (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">{quote.assignedStaff.name[0]}</div>
                        <div>
                          <p className="text-sm font-semibold text-blue-900">{quote.assignedStaff.name}</p>
                          <p className="text-xs text-blue-700">Staff Assigned</p>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-zinc-100">
                      <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending}
                        className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                        <CheckCircle2 className="w-4 h-4" /> Mark Done & Request Final
                      </button>
                    </div>
                  </div>
                )}

                {quote.status === 'in_progress' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                      <Zap className="w-5 h-5 text-blue-500 shrink-0" />
                      <p className="text-sm font-medium text-blue-800">Job currently in progress by field team.</p>
                    </div>
                    <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending}
                      className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                        <CheckCircle2 className="w-4 h-4" /> Mark Done & Request Final
                    </button>
                  </div>
                )}

                {quote.status === 'completed' && (
                  <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending}
                    className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                    <DollarSign className="w-4 h-4" /> Request Final Payment
                  </button>
                )}

                {quote.status === 'final_payment_requested' && (
                  <div className="space-y-3">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-center">
                      <p className="font-semibold text-orange-800">Awaiting Final Payment</p>
                      <p className="text-orange-700 mt-0.5">{formatMoney(quote.finalAmount)}</p>
                    </div>
                    <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending}
                      className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors disabled:opacity-50">
                      <Mail className="w-4 h-4" /> Resend Payment Email
                    </button>
                  </div>
                )}

                {['closed', 'final_paid'].includes(quote.status) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                    <BadgeCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-emerald-800 text-sm">Case Closed</p>
                    <p className="text-xs text-emerald-700 mt-1">Fully paid and completed</p>
                  </div>
                )}

                {quote.status === 'cancelled' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="font-semibold text-red-800 text-sm">Job Cancelled</p>
                  </div>
                )}

                {/* Manual Close (always available unless terminal) */}
                {!['closed', 'cancelled', 'final_paid'].includes(quote.status) && (
                  <div className="pt-4 mt-2 border-t border-zinc-100">
                    <button onClick={handleManualClose} data-testid="button-manual-close"
                      className="inline-flex items-center justify-center w-full gap-2 h-8 px-3 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 text-xs font-medium transition-colors">
                      <XCircle className="w-3.5 h-3.5" /> Manual Close / Cancel
                    </button>
                  </div>
                )}

              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900">Payment Status</h3>
              </div>
              <div className="p-5 space-y-3">
                <div className={`flex items-center justify-between p-3 rounded-lg border ${quote.depositPaidAt ? 'bg-emerald-50 border-emerald-200' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${quote.depositPaidAt ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                      {quote.depositPaidAt ? '✓' : '1'}
                    </div>
                    <span className={`text-sm font-medium ${quote.depositPaidAt ? 'text-emerald-800' : 'text-zinc-700'}`}>Deposit (50%)</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${quote.depositPaidAt ? 'text-emerald-800' : 'text-zinc-900'}`}>
                    {formatMoney(quote.depositAmount)}
                  </span>
                </div>
                
                <div className={`flex items-center justify-between p-3 rounded-lg border ${quote.finalPaidAt ? 'bg-emerald-50 border-emerald-200' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${quote.finalPaidAt ? 'bg-emerald-500 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                      {quote.finalPaidAt ? '✓' : '2'}
                    </div>
                    <span className={`text-sm font-medium ${quote.finalPaidAt ? 'text-emerald-800' : 'text-zinc-700'}`}>Balance (50%)</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${quote.finalPaidAt ? 'text-emerald-800' : 'text-zinc-900'}`}>
                    {formatMoney(quote.finalAmount)}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="modal-delete-confirm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-3 bg-red-50">
              <AlertOctagon className="w-5 h-5 text-red-600" />
              <h2 className="text-base font-semibold text-red-700">Delete Job Case</h2>
            </div>
            <div className="p-6">
              <p className="text-sm text-zinc-600">
                Are you sure you want to permanently delete <strong>{quote.referenceNo}</strong> for <strong>{quote.customer?.name}</strong>?
                This action cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3 bg-zinc-50">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteQuoteMutation.isPending}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteQuoteMutation.mutate()}
                disabled={deleteQuoteMutation.isPending}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {deleteQuoteMutation.isPending ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxPhoto(null)}
        >
          <button
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxPhoto}
            alt="Enlarged reference"
            className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
