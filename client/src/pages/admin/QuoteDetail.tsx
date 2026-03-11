import { useParams, Link } from "wouter";
import { useQuote, useUpdateQuoteStatus, useRequestFinalPayment, useConfirmBooking, useEditQuote, useCloseQuote } from "@/hooks/use-quotes";
import { useStaffList } from "@/hooks/use-staff";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useState } from "react";
import { 
  ArrowLeft, UserPlus, CheckCircle2, Clock, MapPin, Receipt, AlertTriangle, 
  DollarSign, Phone, MessageCircle, Edit2, Save, X, Plus, Trash2, Calendar, XCircle, Camera
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
  const updateStatus = useUpdateQuoteStatus();
  const requestFinalPayment = useRequestFinalPayment();
  const confirmBooking = useConfirmBooking();
  const editQuote = useEditQuote();
  const closeQuote = useCloseQuote();
  const { toast } = useToast();

  const [selectedStaff, setSelectedStaff] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>({});
  const [editQuoteData, setEditQuoteData] = useState<any>({});
  const [editItems, setEditItems] = useState<any[]>([]);

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
    if (!selectedStaff) return toast({ title: "Select a staff member", variant: "destructive" });
    try {
      await updateStatus.mutateAsync({ id, status: 'assigned', assignedStaffId: parseInt(selectedStaff) });
      toast({ title: "Staff assigned", description: "Staff member assigned to this job." });
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
    <div className="min-h-screen pt-28 pb-20 bg-secondary/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="grid lg:grid-cols-[1fr_340px] gap-8">
          
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-card p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-3xl font-display font-bold mb-1">Quote #{quote.referenceNo}</h1>
                <p className="text-muted-foreground text-sm">Created {format(new Date(quote.createdAt), 'MMM dd, yyyy HH:mm')}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={quote.status} className="text-sm px-4 py-2" />
                {canEdit && !isEditing && (
                  <button onClick={handleStartEdit} data-testid="button-edit-quote"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary border text-sm font-bold hover:bg-border transition-colors">
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                )}
              </div>
            </div>

            {/* Customer + Address */}
            <div className="bg-card p-6 rounded-3xl border shadow-sm">
              <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
                <MapPin className="text-primary w-5 h-5" /> Customer & Location
              </h3>
              
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-3 gap-3">
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
                  <div className="grid sm:grid-cols-2 gap-3">
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
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">Customer Info</p>
                    <p className="font-bold text-lg leading-tight">{quote.customer?.name}</p>
                    <p className="text-sm text-muted-foreground">{quote.customer?.email}</p>
                    <p className="text-sm text-muted-foreground">{quote.customer?.phone}</p>
                    <div className="flex gap-2 mt-3">
                      <a href={`tel:${quote.customer?.phone}`} data-testid="button-call"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border text-xs font-bold hover:bg-border transition-colors">
                        <Phone className="w-3.5 h-3.5" /> Call
                      </a>
                      <a href={`https://wa.me/${quote.customer?.phone?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" data-testid="button-whatsapp"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors">
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
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
                    {quote.scheduledAt && (
                      <div className="mt-3 p-3 rounded-xl bg-secondary/50 border">
                        <p className="text-xs text-muted-foreground font-semibold">Scheduled Slot</p>
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
            <div className="bg-card p-6 rounded-3xl border shadow-sm">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Receipt className="text-accent w-5 h-5" /> Items & Pricing
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
                  <img src={quote.detectionPhotoUrl} alt="Customer submitted photo" className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-300 shrink-0" />
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
                    <div key={i} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center p-2 rounded-xl border bg-secondary/30" data-testid={`edit-item-${i}`}>
                      <input value={item.detectedName || item.originalDescription} onChange={e => updateEditItem(i, 'detectedName', e.target.value)}
                        placeholder="Item name" className="px-2 py-1.5 rounded-lg border bg-background text-sm outline-none focus:border-primary" />
                      <select value={item.serviceType} onChange={e => updateEditItem(i, 'serviceType', e.target.value)}
                        className="px-2 py-1.5 rounded-lg border bg-background text-xs outline-none focus:border-primary">
                        <option value="install">Install</option>
                        <option value="dismantle">Dismantle</option>
                        <option value="relocate">Relocate</option>
                      </select>
                      <input type="number" min="1" value={item.quantity} onChange={e => updateEditItem(i, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-14 px-2 py-1.5 rounded-lg border bg-background text-sm outline-none focus:border-primary text-center" />
                      <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateEditItem(i, 'unitPrice', e.target.value)}
                        className="w-20 px-2 py-1.5 rounded-lg border bg-background text-sm outline-none focus:border-primary" placeholder="Price" />
                      <button onClick={() => removeEditItem(i)} className="w-8 h-8 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors flex items-center justify-center">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
                      <div key={item.id} className="py-3.5 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-sm">{item.detectedName || item.originalDescription}</p>
                          <p className="text-xs text-muted-foreground capitalize">{item.serviceType} × {item.quantity} @ {formatMoney(item.unitPrice)}</p>
                        </div>
                        <p className="font-bold">{formatMoney(item.subtotal)}</p>
                      </div>
                    ))}
                    {(!quote.items || quote.items.length === 0) && (
                      <p className="py-4 text-sm text-muted-foreground text-center">No items</p>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Labor subtotal</span><span>{formatMoney(quote.subtotal)}</span></div>
                      {Number(quote.discount || 0) > 0 && (
                        <div className="flex justify-between text-emerald-700 font-medium">
                          <span>Bulk discount</span><span>−{formatMoney(quote.discount)}</span>
                        </div>
                      )}
                      {Number(quote.transportFee || 0) > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Logistics fees</span><span>{formatMoney(quote.transportFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span>{formatMoney(quote.total)}</span></div>
                      <div className="flex justify-between text-emerald-600 font-semibold text-xs"><span>50% Deposit</span><span>{formatMoney(quote.depositAmount)}</span></div>
                      <div className="flex justify-between text-muted-foreground text-xs"><span>Balance (50%)</span><span>{formatMoney(quote.finalAmount)}</span></div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Timeline */}
            <div className="bg-card p-6 rounded-3xl border shadow-sm">
              <h3 className="font-bold mb-5 flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" /> Job Timeline &amp; Field Proof
              </h3>
              <div className="space-y-4">
                {quote.updates?.map((update: any) => {
                  const isFieldEvent = update.gpsLat || update.photoUrl;
                  let photos: string[] = [];
                  if (update.photoUrl) {
                    try { photos = JSON.parse(update.photoUrl); } catch { photos = [update.photoUrl]; }
                  }
                  return (
                    <div key={update.id} className={`flex gap-3 ${isFieldEvent ? 'items-start' : ''}`}>
                      <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-1 ${
                        update.statusChange === 'in_progress' ? 'bg-blue-100 border-blue-500' :
                        update.statusChange === 'completed' ? 'bg-emerald-100 border-emerald-500' :
                        'bg-primary/20 border-primary'
                      }`}></div>
                      <div className="flex-1 pb-4 border-b last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-sm capitalize">{update.statusChange.replace(/_/g, ' ')}</h4>
                          <time className="text-xs text-muted-foreground">{format(new Date(update.createdAt), 'MMM d, HH:mm')}</time>
                        </div>
                        <p className="text-xs text-muted-foreground capitalize">{update.actorType}</p>
                        {update.note && <p className="text-xs text-muted-foreground mt-1 italic">"{update.note}"</p>}

                        {/* GPS Proof */}
                        {update.gpsLat && (
                          <div className="mt-2 inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
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
                              View on Maps ↗
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
                                <a key={i} href={p} target="_blank" rel="noreferrer">
                                  <img src={p} alt={`proof-${i + 1}`}
                                    className="w-24 h-24 rounded-xl object-cover border-2 border-border hover:border-primary transition-colors shadow-sm" />
                                </a>
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

          {/* Sidebar Actions */}
          <div className="space-y-5">
            <div className="bg-card rounded-3xl p-5 border shadow-sm space-y-3">
              <h3 className="font-bold mb-3">Admin Actions</h3>

              {/* Approve & Request Deposit */}
              {['submitted', 'under_review'].includes(quote.status) && (
                <button onClick={handleApproveAndRequestDeposit} disabled={updateStatus.isPending} data-testid="button-approve-deposit"
                  className="w-full btn-primary-gradient py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  <CheckCircle2 className="w-5 h-5" /> Approve & Request Deposit
                </button>
              )}

              {/* Re-request deposit if already requested */}
              {quote.status === 'deposit_requested' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                  <p className="font-bold mb-1">Deposit Requested</p>
                  <p className="text-xs">Waiting for customer to pay {formatMoney(quote.depositAmount)}</p>
                </div>
              )}

              {/* Deposit paid info */}
              {quote.status === 'deposit_paid' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
                  <p className="font-bold mb-1">✓ Deposit Paid</p>
                  <p className="text-xs">Waiting for customer to request a booking slot</p>
                </div>
              )}

              {/* Confirm Booking */}
              {quote.status === 'booking_requested' && (
                <div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-3">
                    <p className="text-sm font-bold text-blue-800 mb-1">📅 Booking Request Received</p>
                    {quote.scheduledAt && (
                      <p className="text-xs text-blue-700">
                        {format(new Date(quote.scheduledAt), 'EEE, MMM d, yyyy')} · {quote.timeWindow}
                      </p>
                    )}
                    {quote.rescheduledCount && quote.rescheduledCount > 0 ? (
                      <p className="text-xs text-amber-600 font-semibold mt-1">⚠ Reschedule #{quote.rescheduledCount}</p>
                    ) : null}
                  </div>
                  <button onClick={handleConfirmBooking} disabled={confirmBooking.isPending} data-testid="button-confirm-booking"
                    className="w-full btn-primary-gradient py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                    <Calendar className="w-5 h-5" /> Confirm Booking
                  </button>
                </div>
              )}

              {/* Assign Staff */}
              {['booked', 'assigned'].includes(quote.status) && (
                <div className="pt-2 border-t">
                  <label className="text-xs font-semibold mb-2 block text-muted-foreground">Assign Staff Member</label>
                  <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} data-testid="select-staff"
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border mb-3 outline-none focus:border-primary text-sm">
                    <option value="">Select staff...</option>
                    {staffList?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button onClick={handleAssign} disabled={updateStatus.isPending || !selectedStaff} data-testid="button-assign-staff"
                    className="w-full bg-foreground text-background py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-foreground/90 transition-colors disabled:opacity-50">
                    <UserPlus className="w-4 h-4" /> Assign Staff
                  </button>
                </div>
              )}

              {/* Request Final Payment */}
              {quote.status === 'completed' && (
                <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending} data-testid="button-final-payment"
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50">
                  <DollarSign className="w-5 h-5" /> Request Final Payment
                </button>
              )}

              {/* Final requested info */}
              {quote.status === 'final_payment_requested' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                  <p className="font-bold mb-1">Final Payment Requested</p>
                  <p className="text-xs">Waiting for customer to pay {formatMoney(quote.finalAmount)}</p>
                </div>
              )}

              {/* Closed */}
              {['closed', 'final_paid'].includes(quote.status) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1" />
                  <p className="font-bold text-emerald-700">Case Closed</p>
                  <p className="text-xs text-emerald-600 mt-1">Total received: {formatMoney(quote.total)}</p>
                </div>
              )}

              {/* Manual Close */}
              {!['closed', 'cancelled', 'final_paid'].includes(quote.status) && (
                <div className="pt-3 border-t">
                  <button onClick={handleManualClose} data-testid="button-manual-close"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold text-muted-foreground hover:bg-secondary transition-colors">
                    <XCircle className="w-4 h-4" /> Manual Close / Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Payment Summary */}
            <div className="bg-card rounded-3xl p-5 border shadow-sm">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" /> Payment Status
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grand Total</span>
                  <span className="font-bold">{formatMoney(quote.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deposit (50%)</span>
                  <span className={`font-semibold ${quote.depositPaidAt ? 'text-emerald-600' : ''}`}>
                    {quote.depositPaidAt ? '✓ ' : ''}{formatMoney(quote.depositAmount)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Balance (70%)</span>
                  <span className={`font-semibold ${quote.finalPaidAt ? 'text-emerald-600' : ''}`}>
                    {quote.finalPaidAt ? '✓ ' : ''}{formatMoney(quote.finalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Staff Assignment */}
            {quote.assignedStaff && (
              <div className="bg-card rounded-3xl p-5 border shadow-sm">
                <h3 className="font-bold mb-3 text-sm text-muted-foreground uppercase tracking-wide">Assigned Staff</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {quote.assignedStaff.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{quote.assignedStaff.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{quote.assignedStaff.role}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Internal Notes */}
            {quote.notes && (
              <div className="bg-amber-50 rounded-3xl p-5 border border-amber-200">
                <h3 className="font-bold mb-2 text-sm text-amber-700">Internal Notes</h3>
                <p className="text-sm text-amber-800">{quote.notes}</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
