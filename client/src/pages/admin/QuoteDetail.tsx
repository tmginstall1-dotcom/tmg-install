import { useParams, Link, useLocation } from "wouter";
import { useQuote, useUpdateQuoteStatus, useRequestFinalPayment, useConfirmBooking, useEditQuote, useCloseQuote } from "@/hooks/use-quotes";
import { useStaffList } from "@/hooks/use-staff";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, UserPlus, CheckCircle2, Clock, MapPin, Receipt, AlertTriangle, 
  DollarSign, Phone, MessageCircle, Edit2, Save, X, Plus, Trash2, Calendar, XCircle, Camera,
  ClipboardList, CalendarCheck, Zap, BadgeCheck, AlertOctagon, Send, Loader2, Mail,
  Printer, Timer, QrCode, RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calcOvertimeCharge, PricingConfig } from "@shared/pricing";

const TERMINAL_STATUSES_UI = ['closed', 'cancelled'];

function formatMoney(v: any) {
  return `$${Number(v || 0).toFixed(2)}`;
}

/** Determine which contact channels are available for a quote */
function getContactChannels(quote: any) {
  const email = quote?.customer?.email || "";
  const hasRealEmail = !!email && !email.includes("@tmginstall.com");
  const rawPhone = quote?.customerWhatsappPhone || quote?.customer?.phone || "";
  const hasPhone = !!rawPhone;
  return { hasRealEmail, hasPhone, email: hasRealEmail ? email : "", phone: rawPhone };
}

/**
 * Standardised payment notification buttons.
 * Renders Email / WhatsApp / Both buttons depending on available contact data.
 * Falls back to a phone-entry form when no contact info is stored.
 */
function PaymentChannelButtons({
  quote,
  emailPending,
  whatsappPending,
  onEmail,
  onWhatsApp,
  compact = false,
}: {
  quote: any;
  emailPending: boolean;
  whatsappPending: boolean;
  onEmail: () => void;
  onWhatsApp: (phone?: string) => void;
  compact?: boolean;
}) {
  const [phoneInput, setPhoneInput] = useState("");
  const { hasRealEmail, hasPhone } = getContactChannels(quote);
  const isPending = emailPending || whatsappPending;

  const baseBtn = compact
    ? "inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
    : "inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";

  // If deposit is already paid, the WA button sends the FINAL payment message
  const depositAlreadyPaid = !!quote?.depositPaidAt;
  const waLabel = depositAlreadyPaid ? "Send Final Payment" : "Send WhatsApp Payment";
  const waLabelShort = depositAlreadyPaid ? "Final Payment" : "WhatsApp";

  if (!hasRealEmail && !hasPhone) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-500">No contact info stored — enter a phone number to send via WhatsApp:</p>
        <input
          type="tel"
          value={phoneInput}
          onChange={e => setPhoneInput(e.target.value)}
          placeholder="e.g. 91234567"
          className="w-full h-9 px-3 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          onClick={() => phoneInput && onWhatsApp(phoneInput)}
          disabled={isPending || !phoneInput.trim()}
          className={`${baseBtn} w-full bg-emerald-600 hover:bg-emerald-700 text-white`}
          data-testid="button-send-whatsapp-override"
        >
          <MessageCircle className="w-4 h-4" />
          {whatsappPending ? "Sending…" : waLabel}
        </button>
      </div>
    );
  }

  if (hasRealEmail && hasPhone) {
    return (
      <div className="flex gap-2">
        <button
          onClick={onEmail}
          disabled={isPending}
          className={`${baseBtn} flex-1 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50`}
          data-testid="button-send-payment-email"
        >
          <Mail className="w-4 h-4" />
          {emailPending ? "Sending…" : "Email"}
        </button>
        <button
          onClick={() => onWhatsApp()}
          disabled={isPending}
          className={`${baseBtn} flex-1 bg-emerald-600 hover:bg-emerald-700 text-white`}
          data-testid="button-send-payment-whatsapp"
        >
          <MessageCircle className="w-4 h-4" />
          {whatsappPending ? "Sending…" : waLabelShort}
        </button>
      </div>
    );
  }

  if (hasRealEmail) {
    return (
      <button
        onClick={onEmail}
        disabled={isPending}
        className={`${baseBtn} w-full bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50`}
        data-testid="button-send-payment-email"
      >
        <Mail className="w-4 h-4" />
        {emailPending ? "Sending…" : "Send Payment Email"}
      </button>
    );
  }

  return (
    <button
      onClick={() => onWhatsApp()}
      disabled={isPending}
      className={`${baseBtn} w-full bg-emerald-600 hover:bg-emerald-700 text-white`}
      data-testid="button-send-payment-whatsapp"
    >
      <MessageCircle className="w-4 h-4" />
      {whatsappPending ? "Sending…" : waLabel}
    </button>
  );
}

export default function AdminQuoteDetail() {
  const params = useParams();
  const id = params.id!;
  const [, navigate] = useLocation();
  
  const { data: quote, isLoading, isFetching } = useQuote(id);
  const { data: staffList } = useStaffList();
  const { data: teamsList = [] } = useQuery<any[]>({ queryKey: ["/api/teams"] });

  const { data: trackerData } = useQuery<{
    updates: { statusChange: string; photoUrls: string[]; note: string | null; createdAt: string }[];
  }>({
    queryKey: [`/api/public/track/${quote?.referenceNo}`],
    queryFn: () => fetch(`/api/public/track/${quote!.referenceNo}`).then(r => r.json()),
    enabled: !!quote?.referenceNo && ["in_progress", "completed", "final_payment_requested", "final_paid", "closed"].includes(quote?.status ?? ""),
    staleTime: 60_000,
  });

  const workPhotos = (trackerData?.updates ?? [])
    .filter(u => ["in_progress", "completed"].includes(u.statusChange))
    .flatMap(u => u.photoUrls ?? [])
    .filter(Boolean);
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
  const [jobMinutes, setJobMinutes] = useState(""); // actual job duration in minutes (for overtime calc)
  const [addChargeNote, setAddChargeNote] = useState(""); // additional charge note
  const [addChargeCustom, setAddChargeCustom] = useState(""); // override amount for non-overtime charges

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

  const reopenJob = useMutation({
    mutationFn: (reason?: string) =>
      apiRequest("POST", `/api/admin/quotes/${id}/reopen`, { reason }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "✅ Job Reopened", description: "Job is now active and visible to assigned staff." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to reopen", description: err.message, variant: "destructive" });
    },
  });

  const saveAdditionalCharge = useMutation({
    mutationFn: (body: { additionalCharge: string; additionalChargeNote: string }) =>
      apiRequest("PATCH", `/api/quotes/${id}/additional-charges`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", id] });
      toast({ title: "Saved", description: "Additional charge updated." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sendWhatsAppPayment = useMutation({
    mutationFn: (phone?: string) =>
      apiRequest("POST", `/api/admin/quotes/${id}/send-whatsapp-payment`, phone ? { phone } : undefined),
    onSuccess: async (res) => {
      setWaSentAt(new Date());
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", parseInt(id)] });
      let data: any = {};
      try { data = await res.clone().json(); } catch {}
      const isFinal = data?.type === "final";
      toast({
        title: "✅ WhatsApp Sent",
        description: isFinal
          ? "Final payment reminder sent to customer."
          : "Deposit payment reminder sent to customer.",
      });
    },
    onError: (err: any) => {
      let reason = err?.message || "Could not send WhatsApp message.";
      try { reason = JSON.parse(reason.replace(/^\d+:\s*/, "")).message || reason; } catch {}
      toast({ title: "Failed to send", description: reason, variant: "destructive" });
    },
  });

  const resetDeposit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/quotes/${id}/reset-deposit`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", id] });
      toast({ title: "Deposit reset", description: "Status reset to deposit requested. You can now resend the payment link." });
    },
    onError: () => toast({ title: "Reset failed", variant: "destructive" }),
  });

  const resendDepositEmail = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/quotes/${id}/resend-deposit-email`);
      return res.json();
    },
    onSuccess: (data: any) => {
      setEmailSentAt(new Date());
      const both = data?.emailSent && data?.whatsappSent;
      const title = both
        ? "✅ Sent via WhatsApp + Email"
        : data?.whatsappSent
          ? "✅ WhatsApp Sent"
          : "✅ Email Sent";
      toast({
        title,
        description: data?.message || "Deposit notification sent.",
      });
    },
    onError: (err: any) => {
      let reason = err?.message || "Could not send payment notification.";
      try { reason = JSON.parse(reason.replace(/^\d+:\s*/, "")).message || reason; } catch {}
      toast({ title: "Failed to send", description: reason, variant: "destructive" });
    },
  });

  const [showPayNowConfirm, setShowPayNowConfirm] = useState(false);
  const [payNowNote, setPayNowNote] = useState("");
  const markPayNowPaid = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/quotes/${id}/mark-paynow-paid`, { note: payNowNote.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${id}`] });
      setShowPayNowConfirm(false);
      setPayNowNote("");
      toast({ title: "✅ Deposit Confirmed", description: "Quote moved to Deposit Paid. Email + WhatsApp sent to customer." });
    },
    onError: (err: any) => {
      const msg = err?.message || "Could not confirm payment.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  // Mark final PayNow payment received — confirms customer paid via PayNow/Stripe, closes case, sends WA invoice
  const [showFinalPayConfirm, setShowFinalPayConfirm] = useState(false);
  const [finalPayNote, setFinalPayNote] = useState("");
  const collectFinalPayment = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/quotes/${id}/collect-final-payment`, { note: finalPayNote.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${id}`] });
      setShowFinalPayConfirm(false);
      setFinalPayNote("");
      toast({ title: "✅ Final Payment Confirmed", description: "Case closed. Invoice sent to customer via WhatsApp." });
    },
    onError: (err: any) => {
      const msg = err?.message || "Could not confirm final payment.";
      toast({ title: "Error", description: msg, variant: "destructive" });
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

  // Effective 50/50 split — falls back when stored amounts are 0 (e.g. manually created jobs)
  const quoteTotal = parseFloat(quote.total || "0");
  const effectiveDeposit = parseFloat(quote.depositAmount || "0") > 0
    ? parseFloat(quote.depositAmount!)
    : quoteTotal * 0.5;
  const effectiveFinal = parseFloat(quote.finalAmount || "0") > 0
    ? parseFloat(quote.finalAmount!)
    : quoteTotal * 0.5;

  const canEdit = ['submitted', 'under_review', 'approved', 'deposit_requested', 'deposit_paid', 'booked', 'assigned', 'closed', 'final_paid'].includes(quote.status);

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
    setEditItems((quote.items || []).filter((item: any) => item.serviceType !== 'discount').map((item: any) => ({
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
      const data = await requestFinalPayment.mutateAsync(parseInt(id));
      const both = data?.emailSent && data?.whatsappSent;
      const title = both
        ? "✅ Sent via WhatsApp + Email"
        : data?.whatsappSent
          ? "✅ WhatsApp Sent"
          : "✅ Final Payment Email Sent";
      toast({
        title,
        description: data?.message || "Final payment notification sent.",
      });
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
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
  const editPromoDiscount = Number(quote?.promoDiscount || 0);
  const editTotal = Math.max(0, editSubtotal - editPromoDiscount + editTransport);

  const handlePrintQuote = () => {
    const q = quote;
    const items = (q.items || []) as any[];
    const services = (() => { try { return JSON.parse(q.selectedServices || "[]"); } catch { return []; } })();
    const scheduledDate = q.scheduledAt ? new Date(q.scheduledAt).toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : null;
    const address = q.pickupAddress ? `${q.pickupAddress} → ${q.dropoffAddress}` : (q.serviceAddress || "—");

    const isFullyPaid = !!(q.finalPaidAt) || q.paymentStatus === "paid_in_full";
    const isDepositPaid = !!(q.depositPaidAt) || q.paymentStatus === "deposit_paid";
    const totalAmt = Number(q.total || 0);
    const depositAmt = Number(q.depositAmount || 0) > 0 ? Number(q.depositAmount) : totalAmt * 0.5;
    const balanceAmt = Number(q.finalAmount || 0) > 0 ? Number(q.finalAmount) : totalAmt * 0.5;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${q.referenceNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #000; }
    .company h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .company p { font-size: 10px; color: #555; margin-top: 2px; line-height: 1.5; }
    .doc-meta { text-align: right; }
    .doc-meta .ref { font-size: 16px; font-weight: 700; font-family: monospace; }
    .doc-meta .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; }
    .doc-meta .status { display: inline-block; background: #000; color: #fff; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 2px 8px; border-radius: 99px; margin-top: 4px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .card { background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 14px 16px; }
    .card-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 8px; }
    .card p { font-size: 11px; line-height: 1.6; color: #222; }
    .card strong { color: #000; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; font-weight: 700; text-align: left; padding: 8px 10px; border-bottom: 2px solid #000; }
    th:last-child, td:last-child { text-align: right; }
    th:nth-child(2), td:nth-child(2) { text-align: center; width: 60px; }
    th:nth-child(3), td:nth-child(3) { text-align: right; width: 90px; }
    td { padding: 9px 10px; border-bottom: 1px solid #eee; font-size: 11px; color: #333; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    .totals { margin-left: auto; width: 280px; }
    .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 11px; color: #444; }
    .totals-row.grand { font-size: 15px; font-weight: 800; color: #000; border-top: 2px solid #000; margin-top: 6px; padding-top: 8px; }
    .payment-section { margin-top: 32px; display: flex; gap: 24px; align-items: flex-start; padding: 16px 18px; background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; }
    .payment-details { flex: 1; }
    .payment-details h3 { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 8px; }
    .payment-details table { margin-bottom: 0; }
    .payment-details table th, .payment-details table td { padding: 3px 8px; font-size: 10px; border-bottom: none; text-align: left; }
    .payment-details table th { width: 110px; color: #888; font-weight: 600; background: none; border: none; }
    .payment-details table td { color: #111; font-weight: 500; }
    .qr-block { text-align: center; flex-shrink: 0; }
    .qr-block img { width: 130px; height: 100px; display: block; object-fit: contain; background: #fff; }
    .qr-block p { font-size: 8px; color: #999; margin-top: 4px; }
    .tnc { margin-top: 24px; padding: 14px 18px; border: 1px solid #e5e5e5; border-radius: 8px; }
    .tnc h3 { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin-bottom: 8px; }
    .tnc ol { padding-left: 14px; }
    .tnc li { font-size: 9px; color: #555; line-height: 1.7; }
    .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e5e5; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer p { font-size: 9px; color: #999; line-height: 1.7; }
    .sig-box { border: 1px dashed #ccc; border-radius: 6px; padding: 10px 16px; min-width: 180px; }
    .sig-box .sig-label { font-size: 9px; color: #999; margin-top: 24px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .badge-paid { background: #dcfce7; color: #166534; }
    .badge-partial { background: #fef9c3; color: #713f12; }
    .badge-unpaid { background: #fee2e2; color: #991b1b; }
    @media print { body { padding: 20px; } button { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      <h1>The Moving Guy Pte Ltd</h1>
      <p>UEN: 202424156H &nbsp;|&nbsp; 160 Robinson Road #14-04, Singapore 068914<br/>+65 8088 0757 &nbsp;|&nbsp; sales@tmginstall.com &nbsp;|&nbsp; tmginstall.com</p>
    </div>
    <div class="doc-meta">
      <div class="label">Job Order / Quotation</div>
      <div class="ref">${q.referenceNo}</div>
      <div class="status">${(q.status || "").replace(/_/g, " ")}</div>
    </div>
  </div>

  <div class="grid2">
    <div class="card">
      <div class="card-title">Customer</div>
      <p><strong>${q.customer?.name || "—"}</strong></p>
      <p>${q.customer?.phone || "—"}</p>
      <p>${q.customer?.email ? q.customer.email.includes("@tmginstall.com") ? "" : q.customer.email : ""}</p>
    </div>
    <div class="card">
      <div class="card-title">Job Details</div>
      <p><strong>Address:</strong> ${address}</p>
      ${scheduledDate ? `<p><strong>Date:</strong> ${scheduledDate}${q.timeWindow ? ` · ${q.timeWindow}` : ""}</p>` : ""}
      ${services.length ? `<p><strong>Services:</strong> ${services.join(", ")}</p>` : ""}
      ${q.notes ? `<p><strong>Notes:</strong> ${q.notes}</p>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${items.length > 0
        ? items.map((item: any) => `
        <tr>
          <td>
            ${item.detectedName || item.originalDescription || "—"}
            ${item.remark ? `<div style="font-size:9px;color:#888;margin-top:3px;line-height:1.5;">${item.remark}</div>` : ""}
          </td>
          <td>${item.quantity}</td>
          <td>S$${Number(item.unitPrice || 0).toFixed(2)}</td>
          <td>S$${Number(item.subtotal || 0).toFixed(2)}</td>
        </tr>`).join("")
        : '<tr><td colspan="4" style="text-align:center;color:#999;padding:20px">No line items</td></tr>'
      }
    </tbody>
  </table>

  <div class="totals">
    ${Number(q.discount || 0) > 0 ? `<div class="totals-row"><span>Discount</span><span>−S$${Number(q.discount).toFixed(2)}</span></div>` : ""}
    ${Number(q.transportFee || 0) > 0 ? `<div class="totals-row"><span>Transport</span><span>S$${Number(q.transportFee).toFixed(2)}</span></div>` : ""}
    ${Number(q.promoDiscount || 0) > 0 ? `<div class="totals-row"><span>Promo (${q.promoCode || ""})</span><span>−S$${Number(q.promoDiscount).toFixed(2)}</span></div>` : ""}
    <div class="totals-row grand"><span>Total</span><span>S$${Number(q.total || 0).toFixed(2)}</span></div>
    ${isFullyPaid ? `
    <div class="totals-row" style="margin-top:12px;border-top:2px solid #16a34a;padding-top:10px;">
      <span style="font-size:11px;font-weight:700;color:#15803d;">① Deposit (50%)</span>
      <span style="font-size:11px;font-weight:700;color:#15803d;">S$${depositAmt.toFixed(2)} ✓</span>
    </div>
    <div class="totals-row" style="padding-top:4px;">
      <span style="font-size:11px;font-weight:700;color:#15803d;">② Balance (50%)</span>
      <span style="font-size:11px;font-weight:700;color:#15803d;">S$${balanceAmt.toFixed(2)} ✓</span>
    </div>
    <div style="margin-top:8px;background:#dcfce7;border:1.5px solid #16a34a;border-radius:8px;padding:8px 12px;text-align:center;">
      <span style="font-size:13px;font-weight:800;color:#15803d;letter-spacing:0.05em;">✅ FULLY PAID — CASE CLOSED</span>
    </div>` : isDepositPaid ? `
    <div class="totals-row" style="margin-top:12px;border-top:2px solid #ca8a04;padding-top:10px;">
      <span style="font-size:11px;font-weight:700;color:#15803d;">① Deposit (50%)</span>
      <span style="font-size:11px;font-weight:700;color:#15803d;">S$${depositAmt.toFixed(2)} ✓ PAID</span>
    </div>
    <div class="totals-row" style="padding-top:4px;">
      <span style="font-size:11px;font-weight:700;color:#b45309;">② Balance (50%) — DUE ON COMPLETION</span>
      <span style="font-size:12px;font-weight:800;color:#b45309;">S$${balanceAmt.toFixed(2)}</span>
    </div>` : `
    <div class="totals-row" style="margin-top:8px;">
      <span>Payment</span>
      <span><span class="badge badge-unpaid">UNPAID</span></span>
    </div>`}
  </div>

  <!-- Payment Details -->
  ${isFullyPaid ? `
  <div class="payment-section" style="background:#f0fdf4;border-color:#86efac;margin-top:24px;">
    <div style="flex:1;text-align:center;padding:8px 0;">
      <div style="font-size:18px;font-weight:800;color:#15803d;margin-bottom:4px;">✅ RECEIPT — PAID IN FULL</div>
      <div style="font-size:10px;color:#166534;">Both deposit and final balance have been received. Thank you!</div>
      <div style="margin-top:10px;display:flex;justify-content:center;gap:32px;font-size:10px;color:#15803d;">
        <span>Deposit: <strong>S$${depositAmt.toFixed(2)}</strong></span>
        <span>Balance: <strong>S$${balanceAmt.toFixed(2)}</strong></span>
        <span>Total: <strong>S$${totalAmt.toFixed(2)}</strong></span>
      </div>
    </div>
  </div>` : `
  <div class="payment-section">
    <div class="payment-details">
      <h3>Payment Details${isDepositPaid ? ' — Balance Due' : ''}</h3>
      <table>
        <tr><th>Bank</th><td>OCBC Bank</td></tr>
        <tr><th>Account No.</th><td>596795617001</td></tr>
        <tr><th>Account Name</th><td>The Moving Guy Pte. Ltd.</td></tr>
        <tr><th>Currency</th><td>SGD</td></tr>
        <tr><th>PayNow (UEN)</th><td>202424156H</td></tr>
      </table>
      <p style="margin-top:10px;font-size:9px;color:#555;">
        Please include your <strong>reference number (${q.referenceNo})</strong> in the payment remarks.
      </p>
    </div>
    <div class="qr-block">
      <img src="${window.location.origin}/paynow-qr.png" alt="PayNow QR Code" />
      <p>Scan to Pay via PayNow</p>
    </div>
  </div>`}

  <!-- Terms & Conditions -->
  <div class="tnc">
    <h3>Terms &amp; Conditions</h3>
    <ol>
      <li>This quotation is valid for <strong>14 days</strong> from the date of issue.</li>
      <li><strong>Payment Terms:</strong> 50% deposit is required to confirm the booking. The remaining balance is payable upon completion of the installation.</li>
      <li>Rescheduling with less than <strong>24 hours' notice</strong> may incur a cancellation/admin fee.</li>
      <li>Transport fee applies for locations outside central Singapore or where lift access is unavailable.</li>
      <li>TMG Install is not liable for pre-existing damage to furniture, walls, or fixtures.</li>
      <li>Customer is responsible for ensuring clear access to the premises on the scheduled date and time.</li>
      <li>Any additional work not stated in this quotation will be charged separately and agreed upon in writing.</li>
      <li>All prices are in Singapore Dollars (SGD) and are <strong>not subject to GST</strong> (we are not GST-registered).</li>
    </ol>
  </div>

  <div class="footer">
    <div>
      <p>Generated ${new Date().toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" })} &nbsp;·&nbsp; TMG Install Pte Ltd &nbsp;·&nbsp; UEN 202424156H<br/>+65 8088 0757 &nbsp;·&nbsp; sales@tmginstall.com &nbsp;·&nbsp; tmginstall.com</p>
    </div>
    <div class="sig-box">
      <div class="sig-label">Customer Signature &amp; Date</div>
    </div>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <div className="min-h-screen pt-14 pb-32 lg:pb-16 lg:pl-56 bg-[#F5F5F7] overflow-x-hidden relative">

      {/* Sticky Header */}
      <div className="sticky top-14 z-30 bg-white border-b border-zinc-200 px-3 sm:px-6 py-2 sm:py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/admin">
              <button className="inline-flex items-center justify-center w-8 h-8 shrink-0 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className="text-[11px] text-zinc-500 font-mono tracking-wider">{quote.referenceNo}</span>
                <StatusBadge status={quote.status} />
                {!TERMINAL_STATUSES_UI.includes(quote.status) && isFetching && (
                  <Loader2 className="w-3 h-3 text-zinc-400 animate-spin" />
                )}
              </div>
              <h1 className="text-sm sm:text-base font-semibold text-zinc-900 truncate">{quote.customer?.name}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && !isEditing && !['closed', 'final_paid', 'cancelled'].includes(quote.status) && (
              <button onClick={handleStartEdit} data-testid="button-edit-quote"
                className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs sm:text-sm font-medium transition-colors">
                <Edit2 className="w-3.5 h-3.5 text-zinc-400" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            {['closed', 'final_paid'].includes(quote.status) && (
              <button
                data-testid="button-reopen-job-header"
                disabled={reopenJob.isPending}
                onClick={() => {
                  const reason = prompt("Reason for reopening (optional):");
                  if (reason === null) return;
                  reopenJob.mutate(reason || undefined);
                }}
                className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
              >
                {reopenJob.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Reopen</span>
              </button>
            )}
            <button
              onClick={handlePrintQuote}
              data-testid="button-print-quote"
              title="Print / Download PDF"
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs sm:text-sm font-medium transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              data-testid="button-delete-quote"
              className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-white border border-zinc-200 text-red-500 hover:bg-red-50 text-xs sm:text-sm font-medium transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 sm:gap-6">
          
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
                    {(quote.preferredDate || quote.scheduledAt) && (() => {
                      const tw = quote.scheduledAt ? quote.timeWindow : quote.preferredTimeWindow;
                      const twLabel = tw === "09:00-12:00" ? "Morning (9 AM–12 PM)"
                        : tw === "13:00-17:00" ? "Afternoon (1–5 PM)" : tw ?? null;
                      const dateLabel = quote.scheduledAt
                        ? format(new Date(quote.scheduledAt), "EEE, MMM d, yyyy")
                        : (() => {
                            try { return format(new Date(quote.preferredDate + "T12:00:00"), "EEE, MMM d, yyyy"); }
                            catch { return quote.preferredDate; }
                          })();
                      const isFlexible = !quote.scheduledAt && quote.preferredDate?.toLowerCase() === "flexible";
                      return (
                        <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                          <span className="text-xs text-zinc-500 mt-0.5">{quote.scheduledAt ? "Scheduled" : "Requested"}</span>
                          <div className="flex flex-col gap-1">
                            <span className="text-sm text-zinc-900 font-medium flex items-center gap-1.5">
                              {isFlexible
                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">Flexible Date</span>
                                : dateLabel}
                            </span>
                            {twLabel && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit bg-blue-50 text-blue-700 border border-blue-200">
                                <Clock className="w-3 h-3" /> {twLabel}
                              </span>
                            )}
                            {isFlexible && !twLabel && (
                              <span className="text-xs text-zinc-400 italic">No time preference specified</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
                      {editPromoDiscount > 0 && (
                        <div className="flex justify-between sm:justify-end gap-6 text-sm mb-1.5">
                          <span className="text-zinc-500">Promo ({quote?.promoCode})</span>
                          <span className="font-medium text-green-700">−${editPromoDiscount.toFixed(2)}</span>
                        </div>
                      )}
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
                  {/* Mobile card layout */}
                  <div className="sm:hidden divide-y divide-zinc-100">
                    {quote.items?.map((item: any) => (
                      <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 leading-snug">{item.detectedName || item.originalDescription}</p>
                          <p className="text-xs text-zinc-400 mt-0.5 capitalize">
                            {item.serviceType} · qty {item.quantity} · ${Number(item.unitPrice).toFixed(0)}/ea
                          </p>
                          {item.remark && (
                            <p className="text-xs text-zinc-400 mt-1 italic leading-snug">{item.remark}</p>
                          )}
                        </div>
                        <span className="text-sm font-semibold text-zinc-900 tabular-nums shrink-0">{formatMoney(item.subtotal)}</span>
                      </div>
                    ))}
                    {(!quote.items || quote.items.length === 0) && (
                      <div className="px-4 py-8 text-center text-sm text-zinc-400">No items in this quote.</div>
                    )}
                  </div>

                  {/* Desktop table layout */}
                  <table className="hidden sm:table table-fixed w-full">
                    <thead>
                      <tr>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Item Details</th>
                        <th className="w-16 px-3 py-3 text-center text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Qty</th>
                        <th className="w-28 px-5 py-3 text-right text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.items?.map((item: any) => (
                        <tr key={item.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-5 py-3 border-b border-zinc-100">
                            <p className="text-sm font-medium text-zinc-900 leading-tight">{item.detectedName || item.originalDescription}</p>
                            <p className="text-xs text-zinc-500 mt-0.5 capitalize">{item.serviceType} · ${Number(item.unitPrice).toFixed(0)}/ea</p>
                            {item.remark && (
                              <p className="text-xs text-zinc-400 mt-0.5 italic leading-snug">{item.remark}</p>
                            )}
                          </td>
                          <td className="px-3 py-3 border-b border-zinc-100 text-center text-sm text-zinc-700">
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
                  
                  <div className="bg-zinc-50 px-4 sm:px-5 py-4 border-t border-zinc-200">
                    <div className="w-full sm:w-64 ml-auto space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-500">Subtotal</span>
                        <span className="font-medium text-zinc-900 tabular-nums">{formatMoney(quote.subtotal || 0)}</span>
                      </div>
                      {quote.items?.some((i: any) => i.serviceType === 'relocate') && (
                        <div className="flex items-start gap-1.5 text-xs text-emerald-700 font-medium">
                          <span className="mt-0.5">✓</span>
                          <span>D&R bundle rate: relocation items priced at 40% off (install + dismantle combined)</span>
                        </div>
                      )}
                      {Number(quote.discount || 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Discount</span>
                          <span className="font-medium text-green-700 tabular-nums">−{formatMoney(quote.discount)}</span>
                        </div>
                      )}
                      {Number(quote.promoDiscount || 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Promo ({quote.promoCode})</span>
                          <span className="font-medium text-green-700 tabular-nums">−{formatMoney(quote.promoDiscount)}</span>
                        </div>
                      )}
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
          <div className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-zinc-50 px-5 py-4 border-b border-zinc-200">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Job Pipeline</p>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-zinc-200">
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
                      <p className="text-orange-700 mt-0.5">{formatMoney(effectiveDeposit)}</p>
                    </div>
                    {/* PayNow QR reference for admin */}
                    <div className="border border-zinc-200 rounded-lg p-3 space-y-2 bg-zinc-50">
                      <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide text-center">Customer PayNow Details</p>
                      <div className="flex items-center gap-3">
                        <img
                          src="/paynow-qr.png"
                          alt="PayNow QR"
                          data-testid="img-admin-paynow-qr"
                          className="w-16 h-16 rounded object-cover border border-zinc-200 shrink-0"
                        />
                        <div className="text-xs text-zinc-600 space-y-0.5">
                          <p><span className="font-semibold">UEN:</span> 202424156H</p>
                          <p><span className="font-semibold">Name:</span> TMG Install by The Moving Guy Pte Ltd</p>
                          <p className="text-emerald-700 font-semibold">Amount: {formatMoney(effectiveDeposit)}</p>
                          <p className="text-zinc-400 mt-1 leading-tight">Customer should WhatsApp receipt screenshot after transfer</p>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPayNowConfirm(true)}
                      data-testid="button-mark-paynow-paid"
                      className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                      <QrCode className="w-4 h-4" /> Mark PayNow Received
                    </button>
                    <PaymentChannelButtons
                      quote={quote}
                      emailPending={resendDepositEmail.isPending}
                      whatsappPending={sendWhatsAppPayment.isPending}
                      onEmail={() => resendDepositEmail.mutate()}
                      onWhatsApp={(phone) => sendWhatsAppPayment.mutate(phone)}
                    />
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

                {['deposit_paid', 'booked', 'assigned'].includes(quote.status) && (
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

                    {/* Request deposit for manual jobs that skipped the normal approval flow */}
                    {!quote.depositPaidAt && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-amber-800">Deposit not yet received</p>
                        <PaymentChannelButtons
                          quote={quote}
                          emailPending={resendDepositEmail.isPending}
                          whatsappPending={sendWhatsAppPayment.isPending}
                          onEmail={() => resendDepositEmail.mutate()}
                          onWhatsApp={(phone) => sendWhatsAppPayment.mutate(phone)}
                        />
                        <button
                          onClick={() => setShowPayNowConfirm(true)}
                          data-testid="button-mark-deposit-received"
                          className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-50 text-sm font-medium transition-colors">
                          <QrCode className="w-4 h-4" /> Mark Deposit Received (PayNow)
                        </button>
                      </div>
                    )}

                    {/* Re-collect deposit — for cases where previous payment needs to be reset (e.g. test mode) */}
                    {quote.depositPaidAt && (
                      <div className="border border-zinc-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-zinc-500">Need to re-collect deposit?</p>
                        <p className="text-xs text-zinc-400">Use this if the previous payment was a test or failed. This will reset the deposit status and let you send a new payment link.</p>
                        <button
                          data-testid="button-reset-deposit"
                          onClick={() => resetDeposit.mutate()}
                          disabled={resetDeposit.isPending}
                          className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors disabled:opacity-50">
                          {resetDeposit.isPending ? "Resetting…" : "↺ Reset & Re-send Deposit Link"}
                        </button>
                      </div>
                    )}

                    <div className="pt-2 border-t border-zinc-100 space-y-2">
                      {!quote.finalPaidAt && (
                        <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending}
                          data-testid="button-mark-done-request-final"
                          className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                          <CheckCircle2 className="w-4 h-4" />
                          {requestFinalPayment.isPending ? "Sending…" : "Mark Done & Request Final Payment"}
                        </button>
                      )}
                      {!quote.finalPaidAt && (
                        <button
                          onClick={() => setShowFinalPayConfirm(true)}
                          data-testid="button-mark-final-received-manual"
                          className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
                          <QrCode className="w-4 h-4" /> Mark Final Payment Already Received
                        </button>
                      )}
                      {quote.finalPaidAt && (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <p className="text-xs text-emerald-700 font-medium">Customer has fully paid — use <strong>Reopen</strong> in the header first if job needs to be redone, or <strong>Manual Close</strong> to close the case now.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {quote.status === 'in_progress' && (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                      <Zap className="w-5 h-5 text-blue-500 shrink-0" />
                      <p className="text-sm font-medium text-blue-800">Job currently in progress by field team.</p>
                    </div>
                    <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending}
                      className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                        <CheckCircle2 className="w-4 h-4" /> Mark Done & Request Final Payment
                    </button>
                  </div>
                )}

                {quote.status === 'completed' && (
                  <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending}
                    className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                    <DollarSign className="w-4 h-4" /> Request Final Payment (Stripe / PayNow)
                  </button>
                )}

                {quote.status === 'final_payment_requested' && (
                  <div className="space-y-3">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-center">
                      <p className="font-semibold text-orange-800">Awaiting Final Payment</p>
                      <p className="text-orange-700 mt-0.5">{formatMoney(effectiveFinal)}</p>
                    </div>
                    <button
                      onClick={() => setShowFinalPayConfirm(true)}
                      data-testid="button-mark-final-paid"
                      className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
                      <QrCode className="w-4 h-4" /> Mark PayNow Payment Received
                    </button>
                    <PaymentChannelButtons
                      quote={quote}
                      emailPending={requestFinalPayment.isPending}
                      whatsappPending={sendWhatsAppPayment.isPending}
                      onEmail={() => handleRequestFinalPayment()}
                      onWhatsApp={(phone) => sendWhatsAppPayment.mutate(phone)}
                    />
                  </div>
                )}

                {['closed', 'final_paid'].includes(quote.status) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <BadgeCheck className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-emerald-800 text-sm">Case Closed</p>
                        <p className="text-xs text-emerald-700 mt-0.5">Fully paid — job marked complete</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-emerald-200">
                      <p className="text-xs text-emerald-700 mb-2">Job not done yet? Reopen to reassign staff.</p>
                      <button
                        data-testid="button-reopen-job"
                        disabled={reopenJob.isPending}
                        onClick={() => {
                          const reason = prompt("Reason for reopening (optional):");
                          if (reason === null) return; // cancelled
                          reopenJob.mutate(reason || undefined);
                        }}
                        className="w-full flex items-center justify-center gap-2 h-8 px-3 rounded-lg bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {reopenJob.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Reopen Job
                      </button>
                    </div>
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
                    {formatMoney(effectiveDeposit)}
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
                    {formatMoney(effectiveFinal)}
                  </span>
                </div>

                {Number(quote.additionalCharge || 0) > 0 && (
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 border-amber-200">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-amber-400 text-white">!</div>
                      <div>
                        <span className="text-sm font-medium text-amber-800">Additional Charge</span>
                        {quote.additionalChargeNote && <p className="text-xs text-amber-700 mt-0.5">{quote.additionalChargeNote}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-amber-900" data-testid="text-additional-charge">
                      {formatMoney(quote.additionalCharge)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Overtime / Additional Charges Calculator — relocation jobs only */}
            {['in_progress', 'completed', 'final_payment_requested', 'final_paid', 'closed'].includes(quote.status) &&
             (quote.items || []).some((item: any) => item.serviceType === 'relocate') && (
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
                  <Timer className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-zinc-900">Overtime / Additional Charges</h3>
                </div>
                <div className="p-5 space-y-4">
                  <p className="text-xs text-zinc-500">Standard job includes <strong>{PricingConfig.overtime.capMinutes} min</strong> crew time. Overtime is charged at <strong>${PricingConfig.overtime.blockRate}/30 min</strong> block (max ${PricingConfig.overtime.maxCharge}).</p>

                  {/* Overtime calculator */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-600">Actual job duration (minutes)</label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        placeholder="e.g. 120"
                        value={jobMinutes}
                        onChange={e => setJobMinutes(e.target.value)}
                        data-testid="input-job-minutes"
                        className="flex-1 h-9 px-3 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {jobMinutes && Number(jobMinutes) > 0 && (
                        <div className="text-sm font-semibold text-amber-700 tabular-nums whitespace-nowrap">
                          {(() => {
                            const { blocks, charge } = calcOvertimeCharge(Number(jobMinutes));
                            return charge > 0
                              ? `${blocks} block${blocks !== 1 ? 's' : ''} × $${PricingConfig.overtime.blockRate} = $${charge.toFixed(2)}`
                              : 'No overtime';
                          })()}
                        </div>
                      )}
                    </div>
                    {jobMinutes && Number(jobMinutes) > 0 && calcOvertimeCharge(Number(jobMinutes)).charge > 0 && (
                      <button
                        data-testid="button-use-overtime"
                        onClick={() => {
                          const { blocks, charge } = calcOvertimeCharge(Number(jobMinutes));
                          setAddChargeCustom(charge.toFixed(2));
                          setAddChargeNote(`Overtime: ${blocks} block${blocks !== 1 ? 's' : ''} × $${PricingConfig.overtime.blockRate} (job was ${jobMinutes} min)`);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        → Use this amount
                      </button>
                    )}
                  </div>

                  <div className="border-t border-zinc-100 pt-4 space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-600">Charge amount ($)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={addChargeCustom}
                        onChange={e => setAddChargeCustom(e.target.value)}
                        data-testid="input-additional-charge-amount"
                        className="w-full h-9 px-3 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-zinc-600">Note (optional)</label>
                      <input
                        type="text"
                        placeholder="Reason for charge…"
                        value={addChargeNote}
                        onChange={e => setAddChargeNote(e.target.value)}
                        data-testid="input-additional-charge-note"
                        className="w-full h-9 px-3 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      data-testid="button-save-additional-charge"
                      disabled={saveAdditionalCharge.isPending}
                      onClick={() => saveAdditionalCharge.mutate({
                        additionalCharge: addChargeCustom || '0',
                        additionalChargeNote: addChargeNote,
                      })}
                      className="w-full h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saveAdditionalCharge.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Additional Charge
                    </button>
                    {Number(quote.additionalCharge || 0) > 0 && (
                      <button
                        data-testid="button-clear-additional-charge"
                        onClick={() => { saveAdditionalCharge.mutate({ additionalCharge: '0', additionalChargeNote: '' }); setAddChargeCustom(''); setAddChargeNote(''); }}
                        className="w-full text-xs text-zinc-400 hover:text-zinc-600 underline"
                      >
                        Clear additional charge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Work Photos */}
            {workPhotos.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-4 border-b border-zinc-100">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Work Photos
                  </p>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-2">
                    {workPhotos.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        data-testid={`img-work-photo-${i}`}
                        onClick={() => setLightboxPhoto(url)}
                        className="group relative aspect-square rounded-lg overflow-hidden border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <img src={url} alt={`Work photo ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-medium">View</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Mobile floating action bar — primary action pinned to bottom, hidden on lg */}
      {!isEditing && (() => {
        const s = quote.status;
        if (['submitted', 'under_review'].includes(s)) return (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-1 bg-white border-t border-zinc-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
            <button onClick={handleApproveAndRequestDeposit} disabled={updateStatus.isPending}
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> Approve & Request Deposit
            </button>
          </div>
        );
        if (s === 'deposit_paid') return (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-1 bg-white border-t border-zinc-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
            <button onClick={handleConfirmBooking} disabled={confirmBooking.isPending}
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              <CalendarCheck className="w-4 h-4" /> Confirm Booking
            </button>
          </div>
        );
        if (['deposit_paid', 'booked', 'assigned', 'in_progress', 'completed'].includes(s)) return (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-1 bg-white border-t border-zinc-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
            <button onClick={handleRequestFinalPayment} disabled={requestFinalPayment.isPending}
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" /> Mark Done & Request Final Payment
            </button>
          </div>
        );
        if (s === 'deposit_requested') return (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-1 bg-white border-t border-zinc-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPayNowConfirm(true)}
                data-testid="button-mark-paynow-paid-mobile"
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                <QrCode className="w-4 h-4" /> PayNow Received
              </button>
              <div className="flex-1">
                <PaymentChannelButtons
                  quote={quote}
                  emailPending={resendDepositEmail.isPending}
                  whatsappPending={sendWhatsAppPayment.isPending}
                  onEmail={() => resendDepositEmail.mutate()}
                  onWhatsApp={(phone) => sendWhatsAppPayment.mutate(phone)}
                  compact
                />
              </div>
            </div>
          </div>
        );
        return null;
      })()}

      {/* PayNow Confirmation Modal */}
      {showPayNowConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="modal-paynow-confirm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-3 bg-emerald-50">
              <QrCode className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-semibold text-emerald-800">Confirm PayNow Payment Received</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Reference</span>
                  <span className="font-bold font-mono text-zinc-900">{quote?.referenceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Customer</span>
                  <span className="font-semibold text-zinc-900">{quote?.customer?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Deposit Amount</span>
                  <span className="font-bold text-emerald-700">{formatMoney(effectiveDeposit)}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                  Transaction Note <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={payNowNote}
                  onChange={e => setPayNowNote(e.target.value)}
                  placeholder="e.g. PayNow ref #12345678, received 11:30am"
                  data-testid="input-paynow-note"
                  className="w-full h-9 px-3 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition-colors"
                />
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This will mark the deposit as paid, send a confirmation email to the customer, and move the quote to <strong>Deposit Paid</strong> status — ready for booking.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setShowPayNowConfirm(false); setPayNowNote(""); }}
                className="flex-1 h-10 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => markPayNowPaid.mutate()}
                disabled={markPayNowPaid.isPending}
                data-testid="button-confirm-paynow"
                className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {markPayNowPaid.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirming…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Confirm Received</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark PayNow Final Payment Received Modal */}
      {showFinalPayConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" data-testid="modal-collect-final">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-3 bg-emerald-50">
              <QrCode className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-semibold text-emerald-800">Mark PayNow Payment Received</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Reference</span>
                  <span className="font-bold font-mono text-zinc-900">{quote?.referenceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Customer</span>
                  <span className="font-semibold text-zinc-900">{quote?.customer?.name}</span>
                </div>
                {quote?.depositPaidAt && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Deposit Paid</span>
                    <span className="text-emerald-700 font-medium">{formatMoney(effectiveDeposit)} ✓</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-zinc-200 pt-1 mt-1">
                  <span className="text-zinc-700 font-semibold">Balance Due</span>
                  <span className="font-bold text-emerald-700 text-base">{formatMoney(effectiveFinal)}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
                  PayNow Reference <span className="text-zinc-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={finalPayNote}
                  onChange={e => setFinalPayNote(e.target.value)}
                  placeholder="e.g. PayNow ref #98765, received 2:15pm"
                  data-testid="input-final-pay-note"
                  className="w-full h-9 px-3 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition-colors"
                />
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Confirm that the customer's PayNow transfer has been received. This will close the case and send them a full invoice via WhatsApp.
              </p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => { setShowFinalPayConfirm(false); setFinalPayNote(""); }}
                className="flex-1 h-10 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => collectFinalPayment.mutate()}
                disabled={collectFinalPayment.isPending}
                data-testid="button-confirm-final-pay"
                className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
              >
                {collectFinalPayment.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                  : <><CheckCircle2 className="w-4 h-4" /> Confirm & Close Case</>}
              </button>
            </div>
          </div>
        </div>
      )}

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
