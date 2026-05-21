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
  Printer, Timer, QrCode, RotateCcw, Handshake, Sparkles, FileText, Copy, Users,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatItemDescription } from "@/lib/itemLabel";
import { calcOvertimeCharge, PricingConfig } from "@shared/pricing";
import { PaymentMessageDialog } from "@/components/shared/PaymentMessageDialog";
import { InvoiceMessageDialog } from "@/components/shared/InvoiceMessageDialog";

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
const TIME_WINDOWS = [
  { value: "09:00-12:00", label: "Morning (09:00 – 12:00)" },
  { value: "13:00-17:00", label: "Afternoon (13:00 – 17:00)" },
  { value: "09:00-17:00", label: "Full Day (09:00 – 17:00)" },
];
const TIME_PRESETS = TIME_WINDOWS.map(t => t.value);
const CUSTOM_TW = "__custom__";

function ScheduleEditor({
  quoteId,
  scheduledAt,
  timeWindow,
  preferredDate,
  preferredTimeWindow,
  currentStatus,
}: {
  quoteId: number;
  scheduledAt: string | Date | null | undefined;
  timeWindow: string | null | undefined;
  preferredDate?: string | null;
  preferredTimeWindow?: string | null;
  currentStatus: string;
}) {
  const { toast } = useToast();

  // Pre-deposit statuses use preferredDate / preferredTimeWindow; once the
  // booking is real (deposit paid onwards) we use scheduledAt / timeWindow.
  // The editor falls back to the preferred values so admins can change a
  // requested date even before deposit has been received.
  const isPreBooking = ['submitted', 'under_review', 'approved', 'deposit_requested'].includes(currentStatus);
  const preferredDateNorm = preferredDate && preferredDate.toLowerCase() !== 'flexible'
    ? preferredDate
    : '';

  const computeInitialDate = () => {
    if (scheduledAt) return format(new Date(scheduledAt), "yyyy-MM-dd");
    if (preferredDateNorm) {
      try { return format(new Date(preferredDateNorm + "T12:00:00"), "yyyy-MM-dd"); }
      catch { return ""; }
    }
    return "";
  };
  const computeInitialTw = () => {
    const tw = scheduledAt ? timeWindow : (timeWindow || preferredTimeWindow);
    return tw && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(tw) ? tw : "09:00-12:00";
  };

  const initialDate = computeInitialDate();
  const initialTw = computeInitialTw();
  const [editing, setEditing] = useState(false);
  const [dateVal, setDateVal] = useState(initialDate);
  const [twVal, setTwVal] = useState(initialTw);
  // We need a separate flag for custom mode because a custom range can
  // legitimately equal a preset (e.g. someone typing 09:00–17:00 manually),
  // and conversely picking Custom while currently on Full Day must NOT collapse
  // back to Full Day. Without this flag the Custom inputs never appear.
  const [customMode, setCustomMode] = useState(!TIME_PRESETS.includes(initialTw));

  // Resync local state if the upstream quote changes (e.g. after another save).
  useEffect(() => {
    const fresh = computeInitialTw();
    setDateVal(computeInitialDate());
    setTwVal(fresh);
    setCustomMode(!TIME_PRESETS.includes(fresh));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduledAt, timeWindow, preferredDate, preferredTimeWindow]);

  const save = useMutation({
    mutationFn: async (mode: "save" | "pending") => {
      if (mode === "pending") {
        // Customer has asked to reschedule but the new date isn't decided yet.
        // Clear the booking slot AND flip status to booking_pending so the
        // header badge reads "Pending Date Confirmation" instead of staying
        // on "In Progress".
        return apiRequest("PATCH", `/api/quotes/${quoteId}/edit`, {
          quoteUpdates: { scheduledAt: null, timeWindow: null, status: "booking_pending" },
        }).then(r => r.json());
      }
      if (!dateVal) throw new Error("Please select a date");
      if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(twVal)) throw new Error("Please select a time window");
      const startTime = twVal.split("-")[0];
      // Build SG-local datetime (UTC+08:00) so the saved instant matches what the admin sees.
      const isoLocalSg = `${dateVal}T${startTime}:00+08:00`;
      const scheduledAtIso = new Date(isoLocalSg).toISOString();
      // If we're saving a fresh date for a job that was sitting in booking_pending,
      // promote it back to "booked" so the badge stops saying "Pending Date Confirmation".
      // For pre-deposit statuses (e.g. deposit_requested) we leave the status alone —
      // the customer still needs to pay the deposit.
      const statusFlip = (currentStatus === "booking_pending") ? { status: "booked" as const } : {};
      return apiRequest("PATCH", `/api/quotes/${quoteId}/edit`, {
        quoteUpdates: { scheduledAt: scheduledAtIso, timeWindow: twVal, ...statusFlip },
      }).then(r => r.json());
    },
    onSuccess: (_data, mode) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', String(quoteId)] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes'] });
      toast({ title: mode === "pending" ? "Marked as pending date confirmation" : "Schedule updated" });
      setEditing(false);
    },
    onError: (e: any) => {
      toast({ title: "Could not update schedule", description: e?.message || "Please try again", variant: "destructive" });
    },
  });

  if (!editing) {
    const displayDate = scheduledAt
      ? `${format(new Date(scheduledAt), 'EEE, MMM d')} · ${timeWindow || "—"}`
      : preferredDateNorm
        ? (() => {
            try {
              const d = format(new Date(preferredDateNorm + "T12:00:00"), 'EEE, MMM d');
              return `${d} · ${preferredTimeWindow || timeWindow || "—"} (requested)`;
            } catch { return `${preferredDateNorm} (requested)`; }
          })()
        : null;
    const headerLabel = scheduledAt ? "Confirmed Date" : (isPreBooking ? "Requested Date" : "Confirmed Date");
    return (
      <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-zinc-500 mb-1.5">{headerLabel}</p>
            {displayDate ? (
              <p className="font-semibold text-zinc-900 text-sm flex items-center gap-1.5" data-testid="text-confirmed-date">
                <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>{displayDate}</span>
              </p>
            ) : (
              <p className="text-amber-700 text-sm font-medium flex items-center gap-1.5" data-testid="text-pending-date">
                <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Pending date confirmation</span>
              </p>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            data-testid="button-edit-schedule"
            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline whitespace-nowrap mt-0.5"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-3">
      <p className="text-xs font-medium text-zinc-500">Edit Date & Time</p>
      <div className="space-y-2">
        <input
          type="date"
          value={dateVal}
          onChange={e => setDateVal(e.target.value)}
          data-testid="input-scheduled-date"
          className="h-10 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {(() => {
          const [startVal, endVal] = (twVal && twVal.includes("-")) ? twVal.split("-") : ["09:00", "18:00"];
          // Show Custom in the dropdown whenever the user is in custom mode OR the
          // saved value isn't a preset (e.g. an admin previously saved 09:00–18:00).
          const showAsCustom = customMode || !TIME_PRESETS.includes(twVal);
          return (
            <>
              <select
                value={showAsCustom ? CUSTOM_TW : twVal}
                onChange={e => {
                  if (e.target.value === CUSTOM_TW) {
                    setCustomMode(true);
                    // Seed with a non-preset range (an hour of overtime past Full Day)
                    // so the inputs render and the user immediately sees a custom value
                    // rather than collapsing back to "Full Day".
                    if (TIME_PRESETS.includes(twVal)) {
                      setTwVal("09:00-18:00");
                    }
                  } else {
                    setCustomMode(false);
                    setTwVal(e.target.value);
                  }
                }}
                data-testid="select-time-window"
                className="h-10 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIME_WINDOWS.map(tw => (
                  <option key={tw.value} value={tw.value}>{tw.label}</option>
                ))}
                <option value={CUSTOM_TW}>Custom (overtime)…</option>
              </select>
              {showAsCustom && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 mb-1 block">Start</label>
                    <input
                      type="time"
                      value={startVal}
                      onChange={e => setTwVal(`${e.target.value}-${endVal}`)}
                      data-testid="input-time-start"
                      className="h-10 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 mb-1 block">End (overtime allowed)</label>
                    <input
                      type="time"
                      value={endVal}
                      onChange={e => setTwVal(`${startVal}-${e.target.value}`)}
                      data-testid="input-time-end"
                      className="h-10 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => save.mutate("save")}
          disabled={save.isPending}
          data-testid="button-save-schedule"
          className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {save.isPending && save.variables === "save" ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => {
            setDateVal(initialDate);
            setTwVal(initialTw);
            setEditing(false);
          }}
          disabled={save.isPending}
          data-testid="button-cancel-schedule"
          className="h-10 px-4 rounded-lg bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
      {!isPreBooking && (
        <button
          onClick={() => save.mutate("pending")}
          disabled={save.isPending}
          data-testid="button-mark-pending-date"
          className="w-full h-10 px-4 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {save.isPending && save.variables === "pending" ? "Saving…" : "Mark as Pending — date to be confirmed"}
        </button>
      )}
    </div>
  );
}

function AiEmailDrafter({ quote }: { quote: any }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<"follow_up" | "send_quote" | "reschedule" | "reminder" | "custom">("follow_up");
  const [extra, setExtra] = useState("");
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);

  const draftMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/draft-email", {
        quoteId: quote.id,
        intent,
        extraInstructions: extra || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setDraft({ subject: data.subject, body: data.body });
    },
    onError: (e: any) => {
      toast({ title: "Could not draft email", description: e?.message || "Try again", variant: "destructive" });
    },
  });

  const copyAll = async () => {
    if (!draft) return;
    const txt = `Subject: ${draft.subject}\n\n${draft.body}`;
    try {
      await navigator.clipboard.writeText(txt);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", description: "Select and copy manually", variant: "destructive" });
    }
  };

  if (!quote.customer?.email || quote.customer.email.endsWith("@whatsapp.tmginstall.local")) {
    return null;
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        data-testid="button-toggle-ai-email-drafter"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <Sparkles className="w-4 h-4 text-violet-500" />
          AI Email Drafter
        </span>
        <span className="text-xs text-zinc-400">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-zinc-100">
          <div className="space-y-1.5 pt-3">
            <label className="text-xs font-medium text-zinc-500">Email type</label>
            <select
              value={intent}
              onChange={e => setIntent(e.target.value as any)}
              data-testid="select-email-intent"
              className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="follow_up">Follow-up (no response)</option>
              <option value="send_quote">Send quote</option>
              <option value="reschedule">Reschedule request</option>
              <option value="reminder">Day-before reminder</option>
              <option value="custom">Custom (use instructions)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">Extra instructions (optional)</label>
            <textarea
              value={extra}
              onChange={e => setExtra(e.target.value.slice(0, 500))}
              placeholder="e.g. Mention free reschedule once if they ask…"
              data-testid="input-email-extra"
              rows={2}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
          <button
            onClick={() => draftMut.mutate()}
            disabled={draftMut.isPending}
            data-testid="button-generate-email-draft"
            className="w-full h-9 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {draftMut.isPending ? "Drafting…" : (draft ? "Re-draft" : "Draft email with AI")}
          </button>

          {draft && (
            <div className="space-y-2 pt-2 border-t border-zinc-100">
              <div>
                <label className="text-xs font-medium text-zinc-500">Subject</label>
                <input
                  value={draft.subject}
                  onChange={e => setDraft({ ...draft, subject: e.target.value })}
                  data-testid="input-email-subject"
                  className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500">Body</label>
                <textarea
                  value={draft.body}
                  onChange={e => setDraft({ ...draft, body: e.target.value })}
                  data-testid="input-email-body"
                  rows={10}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 mt-1 font-mono text-xs leading-relaxed"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={copyAll}
                  data-testid="button-copy-email"
                  className="flex-1 h-9 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium"
                >
                  Copy subject + body
                </button>
                <a
                  href={`mailto:${encodeURIComponent(quote.customer.email)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
                  data-testid="link-open-mail-client"
                  className="h-9 px-4 rounded-lg bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium flex items-center"
                >
                  Open in mail
                </a>
              </div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                AI draft — review before sending. Not auto-delivered.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentChannelButtons({
  quote,
  emailPending,
  whatsappPending,
  onEmail,
  onWhatsApp,
  onCopy,
  compact = false,
}: {
  quote: any;
  emailPending: boolean;
  whatsappPending: boolean;
  onEmail: () => void;
  onWhatsApp: (phone?: string) => void;
  onCopy?: () => void;
  compact?: boolean;
}) {
  const [phoneInput, setPhoneInput] = useState("");
  const { hasRealEmail, hasPhone } = getContactChannels(quote);
  const isPending = emailPending || whatsappPending;

  const baseBtn = compact
    ? "inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
    : "inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50";

  const copyBtn = onCopy ? (
    <button
      onClick={onCopy}
      className={`${baseBtn} w-full bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200`}
      data-testid="button-copy-payment-message"
    >
      <FileText className="w-4 h-4" />
      Copy / send manually
    </button>
  ) : null;

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
        {copyBtn}
      </div>
    );
  }

  if (hasRealEmail && hasPhone) {
    return (
      <div className="space-y-2">
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
        {copyBtn}
      </div>
    );
  }

  if (hasRealEmail) {
    return (
      <div className="space-y-2">
        <button
          onClick={onEmail}
          disabled={isPending}
          className={`${baseBtn} w-full bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50`}
          data-testid="button-send-payment-email"
        >
          <Mail className="w-4 h-4" />
          {emailPending ? "Sending…" : "Send Payment Email"}
        </button>
        {copyBtn}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => onWhatsApp()}
        disabled={isPending}
        className={`${baseBtn} w-full bg-emerald-600 hover:bg-emerald-700 text-white`}
        data-testid="button-send-payment-whatsapp"
      >
        <MessageCircle className="w-4 h-4" />
        {whatsappPending ? "Sending…" : waLabel}
      </button>
      {copyBtn}
    </div>
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
    enabled: !!quote?.referenceNo && ["in_progress", "at_pickup", "in_transit", "at_dropoff", "completed", "final_payment_requested", "final_paid", "closed"].includes(quote?.status ?? ""),
    staleTime: 60_000,
  });

  const workPhotos = (trackerData?.updates ?? [])
    .filter(u => ["in_progress", "at_pickup", "in_transit", "at_dropoff", "completed"].includes(u.statusChange))
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
  // These setters are still called from send-handlers; the values are no longer
  // displayed but the state writes are kept to avoid behavioural drift.
  const [, setWaSentAt] = useState<Date | null>(null);
  const [, setEmailSentAt] = useState<Date | null>(null);
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

  // Multi-day phase tracker — mark dismantle / delivery / install done on
  // their own day. Final-payment button is gated until every applicable
  // phase has a completion entry. Phases derived from selectedServices.
  const togglePhase = useMutation({
    mutationFn: ({ phase, done, note }: { phase: 'dismantle' | 'delivery' | 'install'; done: boolean; note?: string }) =>
      apiRequest("POST", `/api/admin/quotes/${id}/phase`, { phase, done, note }).then(r => r.json()),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: vars.done ? `✓ ${vars.phase[0].toUpperCase() + vars.phase.slice(1)} marked done` : "Phase reopened",
        description: vars.done ? "Other phases can still be completed on later days." : "You can re-tick it when the work is done.",
      });
    },
    onError: (err: any) => toast({ title: "Phase update failed", description: err.message, variant: "destructive" }),
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

  // Commercial flow — approve & book without deposit (no upfront payment).
  const approveCommercial = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/quotes/${id}/approve-commercial`).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/:id", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/schedule"] });
      toast({
        title: "Booking Confirmed",
        description: data?.emailSent
          ? "Job is booked. Confirmation email sent to customer (no deposit required)."
          : "Job is booked. No email sent — please share confirmation manually.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to confirm booking", description: err.message, variant: "destructive" });
    },
  });

  // Commercial flow — send Net 30 tax invoice for a completed job.
  const sendCommercialInvoice = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/admin/quotes/${id}/send-invoice`).then(r => r.json()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes/:id", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({
        title: "Invoice Sent",
        description: `Net 30 tax invoice emailed to customer. Due ${data?.dueDate || "in 30 days"}.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send invoice", description: err.message, variant: "destructive" });
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

  // ── Subcontract state ──────────────────────────────────────────────────────
  const [showSubForm, setShowSubForm] = useState(false);
  const [subForm, setSubForm] = useState({ subcontractorId: "", agreedCost: "", notes: "" });

  const { data: subcontracts = [], refetch: refetchSubcontracts } = useQuery<any[]>({
    queryKey: [`/api/admin/quotes/${id}/subcontracts`],
    queryFn: async () => {
      const res = await fetch(`/api/admin/quotes/${id}/subcontracts`, { credentials: "include" });
      return res.json();
    },
    enabled: !!id,
  });

  const { data: allSubs = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/subcontractors"],
  });

  const assignSubMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/admin/quotes/${id}/subcontracts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${id}/subcontracts`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subcontracts/summary"] });
      setShowSubForm(false);
      setSubForm({ subcontractorId: "", agreedCost: "", notes: "" });
      toast({ title: "Subcontractor assigned" });
    },
    onError: () => toast({ title: "Failed to assign", variant: "destructive" }),
  });

  const markSubPaidMutation = useMutation({
    mutationFn: ({ scId, paid }: { scId: number; paid: boolean }) =>
      apiRequest("PATCH", `/api/admin/subcontracts/${scId}`, { paymentStatus: paid ? "paid" : "unpaid" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${id}/subcontracts`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subcontracts/summary"] });
    },
  });

  const removeSubMutation = useMutation({
    mutationFn: (scId: number) => apiRequest("DELETE", `/api/admin/subcontracts/${scId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/quotes/${id}/subcontracts`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subcontracts/summary"] });
      toast({ title: "Removed" });
    },
  });

  const [showPayNowConfirm, setShowPayNowConfirm] = useState(false);
  const [payNowNote, setPayNowNote] = useState("");
  const [showPaymentMessageDialog, setShowPaymentMessageDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const markPayNowPaid = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/quotes/${id}/mark-paynow-paid`, { note: payNowNote.trim() || undefined });
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/quotes/${id}`] });
      setShowPayNowConfirm(false);
      setPayNowNote("");
      if (data?.synced) {
        toast({ title: "✅ Status Synced", description: "Deposit was already on record — quote moved forward. No new message sent to customer." });
      } else {
        toast({ title: "✅ Deposit Confirmed", description: "Quote moved to Deposit Paid. Email + WhatsApp sent to customer." });
      }
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

  // ── Multi-day phase tracker ─────────────────────────────────────────
  // Phases applicable to this job are derived from the booked services:
  //   selectedServices includes "dismantle"  → Dismantle phase
  //   selectedServices includes "relocate"   → Delivery phase (transport leg)
  //   selectedServices includes "install"    → Install phase
  // The "Mark Done & Request Final Payment" button is gated until every
  // applicable phase has a completion entry. Jobs with 0 or 1 applicable
  // phases skip the gate entirely (it would just be noise).
  const phaseSelectedServices: string[] = (() => {
    try { return JSON.parse(quote.selectedServices || "[]"); } catch { return []; }
  })();
  const phaseCompletions: Array<{ phase: string; completedAt: string; completedByUserId?: number; note?: string }> =
    Array.isArray((quote as any).phaseCompletions) ? (quote as any).phaseCompletions : [];
  const applicablePhases: Array<{ key: 'dismantle' | 'delivery' | 'install'; label: string }> = [];
  if (phaseSelectedServices.includes("dismantle")) applicablePhases.push({ key: 'dismantle', label: 'Dismantle' });
  if (phaseSelectedServices.includes("relocate"))  applicablePhases.push({ key: 'delivery',  label: 'Delivery'  });
  if (phaseSelectedServices.includes("install"))   applicablePhases.push({ key: 'install',   label: 'Install'   });
  const phaseStatus = (key: 'dismantle' | 'delivery' | 'install') =>
    phaseCompletions.find((c) => c.phase === key);
  const allPhasesDone = applicablePhases.length === 0
    ? true
    : applicablePhases.every((p) => !!phaseStatus(p.key));
  const hasMultiplePhases = applicablePhases.length > 1;
  const finalPaymentBlockedByPhases = hasMultiplePhases && !allPhasesDone;

  // Effective 50/50 split — falls back when stored amounts are 0 (e.g. manually created jobs)
  const quoteTotal = parseFloat(quote.total || "0");
  const effectiveDeposit = parseFloat(quote.depositAmount || "0") > 0
    ? parseFloat(quote.depositAmount!)
    : quoteTotal * 0.5;
  const effectiveFinal = parseFloat(quote.finalAmount || "0") > 0
    ? parseFloat(quote.finalAmount!)
    : quoteTotal * 0.5;

  const canEdit = ['submitted', 'under_review', 'approved', 'deposit_requested', 'deposit_paid', 'booked', 'booking_pending', 'assigned', 'in_progress', 'at_pickup', 'in_transit', 'at_dropoff', 'completed', 'final_payment_requested', 'closed', 'final_paid'].includes(quote.status);

  const handleStartEdit = () => {
    setEditCustomer({
      name: quote.customer?.name || '',
      email: quote.customer?.email || '',
      phone: quote.customer?.phone || '',
      companyName: quote.customer?.companyName || '',
      companyUen: quote.customer?.companyUen || '',
      billingAddress: quote.customer?.billingAddress || '',
    });
    setEditQuoteData({
      serviceAddress: quote.serviceAddress || '',
      pickupAddress: quote.pickupAddress || '',
      dropoffAddress: quote.dropoffAddress || '',
      transportFee: quote.transportFee || '0',
      notes: quote.notes || '',
      staffTransportAllowance: !!quote.staffTransportAllowance,
      invoiceType: (quote.invoiceType === 'commercial') ? 'commercial' : 'residential',
      billingAddress: quote.billingAddress || '',
      billingCompanyName: quote.billingCompanyName || '',
      billingCompanyUen: quote.billingCompanyUen || '',
      poNumber: quote.poNumber || '',
      goodwillDiscount: quote.goodwillDiscount ? String(quote.goodwillDiscount) : '0',
      goodwillReason: quote.goodwillReason || '',
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

  const handleApproveCommercialBooking = async () => {
    try {
      await approveCommercial.mutateAsync();
    } catch {
      /* toast handled in mutation */
    }
  };

  const handleSendCommercialInvoice = async () => {
    try {
      await sendCommercialInvoice.mutateAsync();
    } catch {
      /* toast handled in mutation */
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
  const editGoodwillDiscount = Number(editQuoteData.goodwillDiscount || 0);
  const editTotal = Math.max(0, editSubtotal - editPromoDiscount - editGoodwillDiscount + editTransport);

  const handlePrintQuote = () => {
    const q = quote;
    const items = (q.items || []) as any[];
    const services = (() => { try { return JSON.parse(q.selectedServices || "[]"); } catch { return []; } })();
    // Labour overage clause only applies to relocation jobs (where unpacking,
    // re-arranging and on-site decisions commonly extend crew time). Pure
    // installation jobs are charged on agreed scope only.
    const hasRelocation = (items || []).some((i: any) => i.serviceType === 'relocate');
    const scheduledDate = q.scheduledAt ? new Date(q.scheduledAt).toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : null;
    const address = (q as any).samePropertyMove
      ? (q.pickupAddress || q.serviceAddress || "—")
      : (q.pickupAddress ? `${q.pickupAddress} → ${q.dropoffAddress}` : (q.serviceAddress || "—"));

    // Escape user-controlled values before interpolation into the printable
    // HTML template (this template is opened via window.open in the admin's
    // browser, so unescaped customer/billing input would be an XSS risk).
    const esc = (v: any) => String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    const isFullyPaid = !!(q.finalPaidAt) || q.paymentStatus === "paid_in_full";
    const isDepositPaid = !!(q.depositPaidAt) || q.paymentStatus === "deposit_paid";
    const totalAmt = Number(q.total || 0);
    const depositAmt = Number(q.depositAmount || 0) > 0 ? Number(q.depositAmount) : totalAmt * 0.5;
    const balanceAmt = Number(q.finalAmount || 0) > 0 ? Number(q.finalAmount) : totalAmt * 0.5;

    // Decide what kind of document this print is. Commercial customers
    // pay against an INVOICE (B2B norm: vendor issues invoice, customer
    // pays per terms). Residential customers receive a QUOTATION first
    // and only get an INVOICE / RECEIPT once the job is done.
    //
    //  • QUOTATION  — pre-deposit, awaiting customer approval
    //  • JOB ORDER  — residential, deposit cleared, work scheduled
    //  • TAX INVOICE — commercial booked-and-onwards, OR any job that
    //                  has reached the completion / paid stages
    const isCommercialDoc = (q.invoiceType === "commercial");
    const PRE_BOOKING = ['submitted', 'under_review', 'approved', 'deposit_requested'];
    const COMPLETED = ['job_completed', 'completed', 'final_paid', 'closed', 'final_payment_requested', 'awaiting_final_payment'];
    let docType: "QUOTATION" | "JOB ORDER" | "TAX INVOICE";
    if (isFullyPaid || COMPLETED.includes(q.status)) docType = "TAX INVOICE";
    else if (isCommercialDoc && !PRE_BOOKING.includes(q.status)) docType = "TAX INVOICE";
    else if (!PRE_BOOKING.includes(q.status)) docType = "JOB ORDER";
    else docType = "QUOTATION";
    const isInvoiceDoc = docType === "TAX INVOICE";

    // Human-friendly status label for the masthead meta row.
    const statusLabel = (() => {
      if (isFullyPaid) return "PAID";
      if (q.status === "final_payment_requested" || q.status === "awaiting_final_payment") return "FINAL PAYMENT DUE";
      if (q.status === "completed" || q.status === "job_completed") return "COMPLETED";
      if (q.status === "closed") return "CLOSED";
      if (isDepositPaid) return "BOOKED · DEPOSIT IN";
      if (q.status === "booked" || q.status === "scheduled" || q.status === "in_progress" || q.status === "at_pickup" || q.status === "in_transit" || q.status === "at_dropoff") return "BOOKED";
      if (q.status === "booking_pending") return "BOOKING PENDING";
      if (q.status === "deposit_requested") return "DEPOSIT REQUESTED";
      if (q.status === "approved") return "APPROVED";
      if (q.status === "under_review") return "UNDER REVIEW";
      if (q.status === "submitted") return "SUBMITTED";
      if (q.status === "cancelled") return "CANCELLED";
      return String(q.status || "—").toUpperCase().replace(/_/g, " ");
    })();
    const termsLabel = isInvoiceDoc ? "Net 30" : (docType === "JOB ORDER" ? "50% Deposit Paid" : "50% Deposit");
    // Stable invoice number: TMG-MOJN5PS9 → INV-MOJN5PS9
    const refTail = String(q.referenceNo || "").replace(/^TMG-?/i, "");
    const invoiceNo = `INV-${refTail || q.id}`;
    const issuedDate = isFullyPaid && q.finalPaidAt
      ? new Date(q.finalPaidAt).toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" });
    // Net 30 payment terms for commercial invoices
    const dueDate = (() => {
      const base = isFullyPaid && q.finalPaidAt ? new Date(q.finalPaidAt) : new Date();
      base.setDate(base.getDate() + 30);
      return base.toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" });
    })();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${q.referenceNo}</title>
  <style>
    /* === The Moving Guy Pte Ltd — professional invoice / quotation print template === */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 0; }

    :root {
      --ink: #0a0a0a;          /* near-black — headings, total */
      --ink-2: #2a2a2a;        /* charcoal — body */
      --muted: #6b7280;        /* gray-500 — labels */
      --muted-2: #9ca3af;      /* gray-400 — small print */
      --line: #e5e7eb;         /* gray-200 — dividers */
      --line-2: #d1d5db;       /* gray-300 — strong dividers */
      --bg-soft: #fafafa;      /* near-white — page tint */
      --bg-soft-2: #f5f5f7;    /* very pale — zebra */
      --accent: #0a0a0a;       /* charcoal — primary */
      --accent-2: #1f2937;     /* gray-800 — secondary */
      --gold: #b08a3e;         /* subtle gold accent */
      --green: #047857;
      --green-soft: #ecfdf5;
      --green-line: #6ee7b7;
      --amber: #b45309;
      --amber-soft: #fef3c7;
      --red: #b91c1c;
      --red-soft: #fee2e2;
    }

    html, body { background: #fff; }
    body {
      font-family: 'Inter', 'Helvetica Neue', 'Segoe UI', system-ui, -apple-system, Arial, sans-serif;
      font-size: 10px;
      line-height: 1.6;
      color: var(--ink-2);
      padding: 0;
      -webkit-font-smoothing: antialiased;
      font-feature-settings: 'tnum' 1, 'lnum' 1, 'ss01' 1;
    }

    /* Editorial inner margins — generous side gutters like a real printed
       letter. Everything sits inside this container; no full-bleed bands.
       On screen these stay generous; @media print collapses them so the
       document fits within a single A4 page without spilling. */
    .doc-body { padding: 18mm 16mm 12mm; }

    /* numerical text */
    .num, td.amount, .totals-row span:last-child, .pay-grid dd {
      font-variant-numeric: tabular-nums;
      font-feature-settings: 'tnum' 1;
    }

    /* ── Letterhead ──────────────────────────────────────────────
       Three-column accounting-stationery letterhead inspired by
       classical invoice templates:
        [ TMG ]  [ Company name / tagline / address ]  [ Doc meta ]
       Left band: big TMG wordmark vertically centered.
       Center: company name (heading), then tracked subtitle, then
       address lines in muted gray with subtle dot separators.
       Right column: document type wordmark, then reference, then
       a stacked key/value meta block (ISSUED / DUE / TERMS / STATUS). */
    .letterhead {
      display: grid;
      grid-template-columns: 56px 1fr auto;
      gap: 22px; align-items: start;
      padding-bottom: 16px;
      border-bottom: 1.5px solid var(--ink);
      margin-bottom: 22px;
    }
    .lh-mark {
      display: flex; align-items: flex-start; justify-content: flex-start;
      padding-top: 2px;
    }
    .lh-mark .wm {
      font-size: 30px; font-weight: 900; color: var(--ink);
      letter-spacing: -0.025em; line-height: 1;
      font-family: 'Inter', 'Helvetica Neue', sans-serif;
    }
    .lh-mark .wm .dot { color: var(--gold); }
    .lh-brand { display: flex; flex-direction: column; min-width: 0; }
    .lh-coname {
      font-size: 12px; font-weight: 700; color: var(--ink);
      letter-spacing: -0.005em; line-height: 1.2;
    }
    .lh-tag {
      font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.32em;
      color: var(--ink-2); font-weight: 700; margin-top: 4px;
    }
    .lh-addr {
      font-size: 8.5px; color: var(--muted); margin-top: 10px; line-height: 1.7;
    }
    .lh-addr strong { color: var(--ink-2); font-weight: 600; }
    .lh-addr .sep { color: var(--muted-2); padding: 0 4px; }

    .lh-doc { text-align: right; min-width: 220px; }
    .lh-doc .type {
      font-size: 22px; font-weight: 300; color: var(--ink);
      letter-spacing: 0.36em; text-transform: uppercase; line-height: 1;
      font-family: 'Inter', 'Helvetica Neue', sans-serif;
    }
    .lh-doc .ref-block { margin-top: 10px; }
    .lh-doc .ref-value {
      font-size: 13px; color: var(--ink); font-weight: 700;
      font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
      letter-spacing: 0; line-height: 1.1;
    }
    .lh-doc .sub-ref {
      font-size: 8.5px; color: var(--muted); margin-top: 3px;
      font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    }
    .lh-doc .meta-grid {
      margin-top: 14px; padding-top: 10px;
      border-top: 0.5px solid var(--line-2);
      display: grid; grid-template-columns: auto auto;
      gap: 4px 14px; justify-content: end;
      font-size: 9px; color: var(--ink-2);
    }
    .lh-doc .meta-grid .k {
      color: var(--muted); text-transform: uppercase; letter-spacing: 0.22em;
      font-size: 7px; font-weight: 700; text-align: right; align-self: center;
    }
    .lh-doc .meta-grid .v {
      font-weight: 600; color: var(--ink); font-size: 9px;
      text-align: right; align-self: center;
    }
    .lh-doc .meta-grid .v.status {
      font-family: 'Inter', 'Helvetica Neue', sans-serif;
      text-transform: uppercase; letter-spacing: 0.14em; font-weight: 800;
      font-size: 8.5px;
    }

    /* ── Parties block (Bill To / Job Details) ─────────────────── */
    .parties {
      display: grid; grid-template-columns: 1fr 1fr; gap: 28px;
      margin-bottom: 18px;
    }
    .party { page-break-inside: avoid; break-inside: avoid; }
    .party-label {
      font-size: 7.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.32em; color: var(--muted);
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--line);
    }
    .party .name {
      font-size: 13px; font-weight: 700; color: var(--ink);
      letter-spacing: -0.01em; margin-bottom: 4px; line-height: 1.3;
    }
    .party p { font-size: 9.5px; line-height: 1.65; color: var(--ink-2); margin: 0; }
    .party .kv { display: flex; gap: 8px; margin-top: 2px; }
    .party .kv .k {
      color: var(--muted); font-weight: 600; min-width: 64px;
      font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.1em;
      padding-top: 1px;
    }
    .party .kv .v { color: var(--ink-2); flex: 1; font-size: 9.5px; }

    /* ── Items table — editorial, hairline rules only ──────────── */
    table.items { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    table.items thead th {
      font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.22em;
      color: var(--muted); font-weight: 700; text-align: left;
      padding: 8px 0 8px;
      border-bottom: 1px solid var(--ink);
    }
    table.items thead th:nth-child(1) { padding-left: 0; width: auto; }
    table.items thead th:nth-child(2) { width: 50px; text-align: center; padding: 8px 8px; }
    table.items thead th:nth-child(3) { width: 100px; text-align: right; padding: 8px 8px; }
    table.items thead th:nth-child(4) { width: 110px; text-align: right; padding-right: 0; }
    table.items tbody td {
      padding: 11px 0; font-size: 10px; color: var(--ink-2);
      vertical-align: top; border-bottom: 1px solid var(--line);
    }
    table.items tbody td:nth-child(2) { padding: 11px 8px; text-align: center; color: var(--ink); font-weight: 600; }
    table.items tbody td:nth-child(3) { padding: 11px 8px; text-align: right; font-variant-numeric: tabular-nums; }
    table.items tbody td:nth-child(4) { text-align: right; font-variant-numeric: tabular-nums; color: var(--ink); font-weight: 600; padding-right: 0; }
    table.items tbody td:first-child { color: var(--ink); font-weight: 500; padding-left: 0; }
    table.items tbody tr:last-child td { border-bottom: 1px solid var(--ink); }
    table.items tr { page-break-inside: avoid; break-inside: avoid; }
    table.items thead { display: table-header-group; }
    .item-remark { font-size: 8.5px; color: var(--muted); margin-top: 3px; line-height: 1.5; }

    /* ── Totals ────────────────────────────────────────────────── */
    .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 14px; }
    .totals {
      width: 320px;
      page-break-inside: avoid; break-inside: avoid;
    }
    .totals-row {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 5px 0; font-size: 10px; color: var(--muted);
    }
    .totals-row .k { color: var(--muted); }
    .totals-row span:last-child { color: var(--ink); font-variant-numeric: tabular-nums; font-weight: 500; }
    .totals-row.grand {
      margin-top: 8px; padding: 12px 0 0;
      border-top: 1px solid var(--ink);
      font-size: 10px; color: var(--ink-2); font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.22em;
    }
    .totals-row.grand .k { color: var(--ink-2); }
    .totals-row.grand span:last-child {
      font-size: 22px; font-weight: 700; color: var(--ink);
      letter-spacing: -0.015em; text-transform: none;
      font-family: 'Inter', 'Helvetica Neue', sans-serif;
    }
    .amount-due {
      margin-top: 14px; padding: 14px 0 0;
      border-top: 3px double var(--ink);
      display: flex; justify-content: space-between; align-items: baseline;
    }
    .amount-due .lbl-wrap { display: flex; flex-direction: column; }
    .amount-due .lbl { font-size: 8px; text-transform: uppercase; letter-spacing: 0.32em; font-weight: 700; color: var(--gold); }
    .amount-due .amt { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; color: var(--ink); }
    .amount-due .due-date { font-size: 8.5px; color: var(--muted); margin-top: 4px; letter-spacing: 0.06em; }

    .paid-stamp {
      margin-top: 10px; padding: 14px;
      border: 2px solid var(--green-line);
      background: var(--green-soft);
      border-radius: 6px; text-align: center;
    }
    .paid-stamp .big { font-size: 13px; font-weight: 800; letter-spacing: 0.08em; color: var(--green); text-transform: uppercase; }
    .paid-stamp .sub { font-size: 9.5px; color: var(--green); margin-top: 4px; opacity: 0.85; }
    .paid-split { display: flex; gap: 18px; justify-content: center; margin-top: 8px; font-size: 9.5px; color: var(--green); }

    .deposit-note {
      margin-top: 8px; padding: 8px 12px;
      border: 1px solid var(--amber); background: var(--amber-soft);
      border-radius: 6px; display: flex; justify-content: space-between; align-items: center;
      font-size: 10px; color: var(--amber); font-weight: 600;
    }

    /* ── Payment section ───────────────────────────────────────── */
    /* Right column is sized to hold the PayNow QR (frame + label)
       at a real-world 40 mm — the PayNow merchant guideline for
       reliable phone-camera scanning from paper. The 170 px column
       gives the 150 px QR frame + 8 px padding + 1 px borders
       enough room without clipping. */
    .payment-section {
      margin-top: 14px;
      display: grid; grid-template-columns: 1fr 170px; gap: 24px;
      padding-top: 12px;
      border-top: 1px solid var(--line);
      page-break-inside: avoid; break-inside: avoid;
      page-break-before: avoid; break-before: avoid;
    }
    .payment-section h3 {
      font-size: 7.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.32em; color: var(--muted);
      padding-bottom: 8px; margin-bottom: 10px;
      border-bottom: 1px solid var(--line);
    }
    .pay-grid {
      display: grid; grid-template-columns: 96px 1fr;
      gap: 6px 12px; font-size: 10px;
    }
    .pay-grid dt {
      color: var(--muted); font-weight: 600; text-transform: uppercase;
      font-size: 8px; letter-spacing: 0.16em; align-self: center;
    }
    .pay-grid dd {
      color: var(--ink); font-weight: 500; font-size: 10.5px;
      font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
      letter-spacing: 0;
    }
    .pay-note {
      margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line);
      font-size: 9px; color: var(--muted); line-height: 1.65;
    }
    .pay-note strong { color: var(--ink); font-weight: 600; }
    .qr-block { text-align: center; align-self: start; }
    /* PayNow QR — sized at ~40 mm square, the PayNow merchant
       guideline for reliable phone-camera scanning from paper.
       A white background and generous quiet zone (padding) are
       required for scanners to find the finder patterns.
       image-rendering: pixelated keeps the black modules crisp
       during print scaling instead of being blurred by browser
       anti-aliasing. */
    .qr-block .qr-frame {
      width: 150px; height: 150px; padding: 10px;
      background: #fff; border: 1px solid var(--line);
      box-sizing: content-box; display: inline-block;
      border-radius: 6px;
    }
    .qr-block img {
      width: 150px; height: 150px; display: block;
      background: #fff; margin: 0; padding: 0; border: 0;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      image-rendering: pixelated;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .qr-block .qr-label {
      font-size: 9px; color: var(--ink); margin-top: 8px;
      font-weight: 800; text-transform: uppercase; letter-spacing: 0.28em;
    }
    .qr-block .qr-sub {
      font-size: 8.5px; color: var(--muted); margin-top: 3px;
      font-weight: 600; letter-spacing: 0.04em;
    }

    /* ── Terms & Conditions ────────────────────────────────────── */
    .tnc {
      margin-top: 12px;
      padding: 8px 12px 9px;
      border: 1px solid var(--line);
      border-radius: 6px;
      page-break-inside: avoid; break-inside: avoid;
    }
    .tnc h3 {
      font-size: 7px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.18em; color: var(--muted);
      padding-bottom: 4px; margin-bottom: 5px;
      border-bottom: 1px solid var(--line);
      display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap;
    }
    .tnc h3 .tnc-title { color: var(--ink-2); font-weight: 800; letter-spacing: 0.22em; }
    .tnc h3 .tnc-ref {
      color: var(--ink); font-weight: 700; letter-spacing: 0.06em;
      font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
      text-transform: none; font-size: 7.5px;
    }
    .tnc h3 .tnc-ref strong { color: var(--ink); font-weight: 800; }
    .tnc h3 .tnc-link { margin-left: auto; color: var(--muted); font-weight: 600; text-transform: none; letter-spacing: 0.02em; }
    .tnc ol {
      padding-left: 11px;
      column-count: 2; column-gap: 14px; column-rule: 1px solid var(--line);
    }
    .tnc li {
      font-size: 6.2px; color: var(--ink-2); line-height: 1.35;
      margin-bottom: 1.5px; break-inside: avoid;
    }
    .tnc li strong { color: var(--ink); font-weight: 600; }

    /* ── Footer ────────────────────────────────────────────────── */
    .footer {
      margin-top: 12px; padding-top: 10px;
      border-top: 1px solid var(--line);
      display: grid; grid-template-columns: 1fr 240px; gap: 20px;
      align-items: flex-end;
      page-break-inside: avoid; break-inside: avoid;
    }
    .thanks {
      font-size: 11px; font-weight: 700; color: var(--ink);
      margin-bottom: 4px; letter-spacing: -0.01em;
    }
    /* Reference subtitle inside the footer block. Ensures any page
       that carries the footer (commonly the last page when content
       breaks across two A4 pages) clearly identifies the document
       it belongs to — quote/invoice number, customer, issue date. */
    .footer-ref {
      font-size: 8.5px; color: var(--ink-2); margin-bottom: 6px;
      font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
      letter-spacing: 0;
    }
    .footer-ref strong { color: var(--ink); font-weight: 700; }
    .footer p { font-size: 8px; color: var(--muted); line-height: 1.6; }
    .footer a, .tnc a { color: var(--ink-2); text-decoration: underline; }
    .sig-box {
      position: relative;
      border: 1px solid var(--line); border-radius: 6px;
      padding: 10px 14px 10px; background: #fff;
      min-height: 86px;
      display: flex; flex-direction: column; align-items: stretch; justify-content: flex-end;
      overflow: visible;
    }
    .sig-line { height: 30px; border-bottom: 1px solid var(--line-2); margin-bottom: 6px; }
    .sig-label {
      font-size: 8.5px; color: var(--muted); text-align: left;
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;
      line-height: 1.5;
      max-width: 60%;
    }
    .sig-label .sig-name { display: block; color: var(--ink); font-weight: 700; margin-bottom: 1px; letter-spacing: 0.04em; }
    .sig-label.sig-label-center { text-align: center; max-width: 100%; }

    /* Company rubber stamp — slightly rotated, semi-transparent navy ink.
       All fill/stroke is inline SVG attributes (not CSS) because iOS Safari's
       print engine ignores CSS classes inside SVG. */
    .company-stamp {
      position: absolute;
      top: 0px; right: 4px;
      width: 86px; height: 86px;
      transform: rotate(-6deg);
      opacity: 0.88;
      pointer-events: none;
    }
    .company-stamp svg { width: 100%; height: 100%; display: block; overflow: visible; }

    .badge { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
    .badge-paid { background: var(--green-soft); color: var(--green); }
    .badge-partial { background: var(--amber-soft); color: var(--amber); }
    .badge-unpaid { background: var(--red-soft); color: var(--red); }
    .badge-status { background: var(--ink); color: #fff; padding: 3px 10px; }

    /* Running header/footer (kept hidden — Safari/Chrome's own
       print chrome already prints the page URL on every page, which
       contains the quote id and provides cross-page identification.
       A custom position:fixed band caused the masthead to be clipped
       in iOS Safari print preview, so we don't use one anymore.) */
    .print-running-header,
    .print-running-footer { display: none !important; }

    @media print {
      /* A4 with comfortable outer margins. The in-body letterhead is
         the only masthead — Safari/Chrome stamp the page URL and page
         numbers in their own print chrome on every page. */
      @page { size: A4; margin: 14mm 12mm 12mm; }
      html, body { padding: 0; margin: 0; }
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .doc-body { padding: 0; }
      button { display: none; }

      /* Compress vertical rhythm just for print so a typical invoice fits one A4. */
      .letterhead { padding-bottom: 10px; margin-bottom: 14px; }
      .parties { margin-bottom: 10px; gap: 20px; }
      table.items { margin-bottom: 8px; }
      table.items tbody td { padding: 6px 0; font-size: 9.5px; }
      table.items tbody td:nth-child(2),
      table.items tbody td:nth-child(3) { padding: 6px 8px; }
      .totals-wrap { margin-bottom: 8px; }
      .totals-row { padding: 3px 0; }
      .totals-row.grand { padding-top: 7px; }
      .amount-due { margin-top: 8px; padding-top: 8px; }
      /* Print column wide enough for the 40 mm QR + padding + borders. */
      .payment-section { margin-top: 8px; padding-top: 7px; gap: 18px; grid-template-columns: 1fr 160px; }
      .payment-section h3 { padding-bottom: 4px; margin-bottom: 6px; }
      .pay-grid { gap: 3px 12px; }
      .pay-note { margin-top: 7px; padding-top: 6px; }
      /* PayNow QR at ~40 mm square — PayNow's recommended print
         size for reliable scanning by a customer's phone camera. */
      .qr-block .qr-frame { width: 140px; height: 140px; padding: 8px; }
      .qr-block img { width: 140px; height: 140px; padding: 0; }
      .qr-block .qr-label { margin-top: 6px; font-size: 8.5px; }
      .tnc { margin-top: 7px; padding: 5px 10px 6px; }
      .tnc h3 { padding-bottom: 3px; margin-bottom: 3px; }
      .tnc ol { column-gap: 12px; }
      .tnc li { font-size: 6px; line-height: 1.3; margin-bottom: 0.5px; }
      .footer { margin-top: 7px; padding-top: 6px; gap: 16px; grid-template-columns: 1fr 200px; }
      .footer p { font-size: 7px; line-height: 1.5; }
      .thanks { font-size: 10px; margin-bottom: 3px; }
      .sig-box { min-height: 58px; padding: 6px 10px; }
      .sig-line { height: 16px; margin-bottom: 4px; }
      .sig-label { font-size: 7.5px; }
      .company-stamp { width: 60px; height: 60px; }
      .card, .tnc, .payment-section, .totals, .footer, table.items tr { page-break-inside: avoid; break-inside: avoid; }
      .totals-wrap { page-break-after: avoid; break-after: avoid; }
      .payment-section { page-break-before: avoid; break-before: avoid; }
      .tnc li { break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <div class="doc-body">

  <!-- Letterhead — three-column accounting-stationery masthead -->
  <div class="letterhead">
    <div class="lh-mark"><div class="wm">TMG<span class="dot">.</span></div></div>
    <div class="lh-brand">
      <div class="lh-coname">The Moving Guy Pte Ltd</div>
      <div class="lh-tag">Furniture Installation · Singapore</div>
      <div class="lh-addr">
        <strong>UEN 202424156H</strong><span class="sep">·</span>160 Robinson Road #14-04,<br/>
        Singapore 068914<br/>
        +65 8088 0757<span class="sep">·</span>sales@tmginstall.com<span class="sep">·</span>tmginstall.com
      </div>
    </div>
    <div class="lh-doc">
      <div class="type">${docType}</div>
      <div class="ref-block">
        <div class="ref-value">${esc(isInvoiceDoc ? invoiceNo : q.referenceNo)}</div>
        ${isInvoiceDoc ? `<div class="sub-ref">Job Ref · ${esc(q.referenceNo)}</div>` : ""}
      </div>
      <div class="meta-grid">
        <div class="k">Issued</div><div class="v">${esc(issuedDate)}</div>
        ${(isInvoiceDoc && !isFullyPaid) ? `<div class="k">Due</div><div class="v">${esc(dueDate)}</div>` : ""}
        <div class="k">Terms</div><div class="v">${esc(termsLabel)}</div>
        <div class="k">Status</div><div class="v status">${esc(statusLabel)}</div>
      </div>
    </div>
  </div>

  ${(() => {
    const isCommercial = (q.invoiceType === "commercial");
    const billingCompanyName = q.billingCompanyName || q.customer?.companyName || "";
    const billingCompanyUen  = q.billingCompanyUen  || q.customer?.companyUen  || "";
    const billingAddress     = q.billingAddress     || q.customer?.billingAddress || address || "";
    const showCustomerEmail  = q.customer?.email && !q.customer.email.includes("@tmginstall.com");
    const escAddr = (v: any) => esc(v).replace(/\n/g, "<br/>");
    const billToHtml = isCommercial
      ? `
        <p class="name">${esc(billingCompanyName || q.customer?.name || "—")}</p>
        ${billingCompanyUen ? `<p class="kv"><span class="k">UEN</span><span class="v">${esc(billingCompanyUen)}</span></p>` : ""}
        ${billingAddress ? `<p>${escAddr(billingAddress)}</p>` : ""}
        ${q.customer?.name && billingCompanyName ? `<p class="kv" style="margin-top:6px;"><span class="k">Attn</span><span class="v">${esc(q.customer.name)}</span></p>` : ""}
        ${q.customer?.phone ? `<p class="kv"><span class="k">Phone</span><span class="v">${esc(q.customer.phone)}</span></p>` : ""}
        ${showCustomerEmail ? `<p class="kv"><span class="k">Email</span><span class="v">${esc(q.customer.email)}</span></p>` : ""}
        ${q.poNumber ? `<p class="kv" style="margin-top:6px;"><span class="k">PO No.</span><span class="v">${esc(q.poNumber)}</span></p>` : ""}
      `
      : `
        <p class="name">${esc(q.customer?.name || "—")}</p>
        ${billingAddress ? `<p>${escAddr(billingAddress)}</p>` : ""}
        ${q.customer?.phone ? `<p class="kv"><span class="k">Phone</span><span class="v">${esc(q.customer.phone)}</span></p>` : ""}
        ${showCustomerEmail ? `<p class="kv"><span class="k">Email</span><span class="v">${esc(q.customer.email)}</span></p>` : ""}
      `;
    return `
  <div class="parties">
    <div class="party">
      <div class="party-label">Billed To${isCommercial ? " · Commercial" : ""}</div>
      ${billToHtml}
    </div>
    <div class="party">
      <div class="party-label">Engagement</div>
      <p class="kv"><span class="k">Service At</span><span class="v">${esc(address)}</span></p>
      ${scheduledDate ? `<p class="kv"><span class="k">Scheduled</span><span class="v">${esc(scheduledDate)}${q.timeWindow ? ` · ${esc(q.timeWindow)}` : ""}</span></p>` : ""}
      ${services.length ? `<p class="kv"><span class="k">Services</span><span class="v">${esc(services.join(", "))}</span></p>` : ""}
      ${q.notes ? `<p class="kv"><span class="k">Notes</span><span class="v">${esc(q.notes)}</span></p>` : ""}
    </div>
  </div>`;
  })()}

  <table class="items">
    <thead>
      <tr>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Price (S$)</th>
        <th>Amount (S$)</th>
      </tr>
    </thead>
    <tbody>
      ${items.length > 0
        ? items.map((item: any) => `
        <tr>
          <td>
            ${esc(formatItemDescription(item, items))}
            ${item.remark ? `<div class="item-remark">${esc(item.remark)}</div>` : ""}
          </td>
          <td>${item.quantity}</td>
          <td>${Number(item.unitPrice || 0).toFixed(2)}</td>
          <td>${Number(item.subtotal || 0).toFixed(2)}</td>
        </tr>`).join("")
        : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:24px;font-style:italic;">No line items</td></tr>'
      }
    </tbody>
  </table>

  <div class="totals-wrap">
    <div class="totals">
      ${Number(q.discount || 0) > 0 ? `<div class="totals-row"><span class="k">Discount</span><span>−S$${Number(q.discount).toFixed(2)}</span></div>` : ""}
      ${Number(q.transportFee || 0) > 0 ? `<div class="totals-row"><span class="k">Transport</span><span>S$${Number(q.transportFee).toFixed(2)}</span></div>` : ""}
      ${Number(q.promoDiscount || 0) > 0 ? `<div class="totals-row"><span class="k">Promo · ${esc(q.promoCode || "")}</span><span>−S$${Number(q.promoDiscount).toFixed(2)}</span></div>` : ""}
      ${Number((q as any).goodwillDiscount || 0) > 0 ? `<div class="totals-row"><span class="k">Goodwill discount${(q as any).goodwillReason ? ` · ${esc((q as any).goodwillReason)}` : ""}</span><span>−S$${Number((q as any).goodwillDiscount).toFixed(2)}</span></div>` : ""}
      <div class="totals-row grand"><span class="k">Total</span><span>S$${Number(q.total || 0).toFixed(2)}</span></div>
      ${isFullyPaid ? `
      <div class="paid-stamp">
        <div class="big">Paid in Full</div>
        <div class="sub">Both deposit and balance received. Thank you for your business.</div>
        <div class="paid-split">
          <span>Deposit · <strong>S$${depositAmt.toFixed(2)}</strong></span>
          <span>Balance · <strong>S$${balanceAmt.toFixed(2)}</strong></span>
        </div>
      </div>` : isDepositPaid ? `
      <div class="totals-row" style="margin-top:6px;color:var(--green);">
        <span class="k" style="color:var(--green);">Deposit Received</span><span style="color:var(--green);">−S$${depositAmt.toFixed(2)}</span>
      </div>
      <div class="amount-due">
        <div class="lbl-wrap">
          <div class="lbl">Balance Due</div>
          <div class="due-date">on completion${isInvoiceDoc && !isFullyPaid ? ` · by ${esc(dueDate)}` : ""}</div>
        </div>
        <div class="amt">S$${balanceAmt.toFixed(2)}</div>
      </div>` : `
      <div class="amount-due">
        <div class="lbl-wrap">
          <div class="lbl">${isInvoiceDoc ? "Amount Due" : "Total Payable"}</div>
          ${isInvoiceDoc ? `<div class="due-date">By ${esc(dueDate)} · Net 30</div>` : `<div class="due-date">50% deposit to confirm booking</div>`}
        </div>
        <div class="amt">S$${Number(q.total || 0).toFixed(2)}</div>
      </div>`}
    </div>
  </div>

  <!-- Payment Details -->
  ${isFullyPaid ? "" : `
  <div class="payment-section">
    <div class="payment-details">
      <h3>Payment Details${isDepositPaid ? ' — Balance Due' : ''}</h3>
      <dl class="pay-grid">
        <dt>Bank</dt><dd>OCBC Bank</dd>
        <dt>Account No.</dt><dd>596-795617-001</dd>
        <dt>Account Name</dt><dd>The Moving Guy Pte. Ltd.</dd>
        <dt>Currency</dt><dd>SGD</dd>
        <dt>PayNow (UEN)</dt><dd>202424156H</dd>
      </dl>
      <div class="pay-note">
        Please include the reference <strong>${esc(isInvoiceDoc ? invoiceNo : q.referenceNo)}</strong> in your payment remarks.
        ${isInvoiceDoc ? `Email remittance advice to <strong>sales@tmginstall.com</strong>.` : ""}
      </div>
    </div>
    <div class="qr-block">
      <div class="qr-frame"><img src="${window.location.origin}/paynow-qr.png" alt="PayNow QR Code" width="150" height="150" /></div>
      <div class="qr-label">Scan to Pay · PayNow</div>
      <div class="qr-sub">UEN 202424156H</div>
    </div>
  </div>`}

  <!-- Terms & Conditions -->
  <div class="tnc">
    <h3>
      <span class="tnc-title">Terms &amp; Conditions</span>
      <span class="tnc-ref">${isInvoiceDoc ? "Invoice" : "Quotation"} <strong>${esc(isInvoiceDoc ? invoiceNo : q.referenceNo)}</strong>${isInvoiceDoc ? ` · Job ${esc(q.referenceNo)}` : ""}</span>
      <span class="tnc-link">Full version: <a href="https://tmginstall.com/terms" target="_blank">tmginstall.com/terms</a></span>
    </h3>
    <ol>
      ${isInvoiceDoc ? `
      <li><strong>Payment Terms:</strong> Net 30 days from invoice date${isFullyPaid ? "" : ` — payment due by <strong>${esc(dueDate)}</strong>`}. Please quote the invoice number <strong>${esc(invoiceNo)}</strong> in the payment remarks.</li>
      <li>Late payments may incur a <strong>1.5% per month</strong> administrative charge on the outstanding balance.</li>
      <li>Goods and services described above have been delivered / completed as agreed. Any defect claim must be raised in writing within <strong>7 days</strong> of completion.</li>
      <li><strong>On-site Charges:</strong> Any additional drilling requested on site is <strong>S$5 per hole</strong>. Wall-anchor / fastening hardware supplied on site is charged at cost.${hasRelocation ? ` For relocation work, extra labour beyond the agreed scope is <strong>S$50/hr per crew member</strong>.` : ""}</li>
      <li>Transport fee applies for locations outside central Singapore or where lift access is unavailable. Long-carry &gt; 30 m or stairs without lift access incurs an additional fee, quoted on site before work proceeds.</li>
      <li>The Moving Guy Pte Ltd is not liable for pre-existing damage to furniture, walls, or fixtures.</li>
      <li>Any additional work not stated in this invoice has been agreed upon separately in writing.</li>
      <li>All prices are in Singapore Dollars (SGD) and are <strong>not subject to GST</strong> (The Moving Guy Pte Ltd is not GST-registered).</li>
      <li>By making payment, the customer is deemed to have read and accepted our full Terms &amp; Conditions at <a href="https://tmginstall.com/terms" target="_blank">tmginstall.com/terms</a>.</li>
      ` : `
      <li>This quotation is valid for <strong>14 days</strong> from the date of issue.</li>
      <li><strong>Payment Terms:</strong> 50% deposit is required to confirm the booking. The remaining balance is payable upon completion of the installation.</li>
      <li>Rescheduling with less than <strong>24 hours' notice</strong> may incur a cancellation/admin fee.</li>
      <li><strong>On-site Charges:</strong> Any additional drilling requested on site is <strong>S$5 per hole</strong>. Wall-anchor / fastening hardware supplied on site is charged at cost.${hasRelocation ? ` For relocation work, extra labour beyond the agreed scope is <strong>S$50/hr per crew member</strong>.` : ""}</li>
      <li>Transport fee applies for locations outside central Singapore or where lift access is unavailable. Long-carry &gt; 30 m or stairs without lift access incurs an additional fee, quoted on site before work proceeds.</li>
      <li>The Moving Guy Pte Ltd is not liable for pre-existing damage to furniture, walls, or fixtures.</li>
      <li>Customer is responsible for ensuring clear access to the premises on the scheduled date and time.</li>
      <li>Any additional work not stated in this quotation will be charged separately and agreed upon in writing.</li>
      <li>All prices are in Singapore Dollars (SGD) and are <strong>not subject to GST</strong> (we are not GST-registered).</li>
      <li>By paying the deposit, the customer is deemed to have read and accepted our full Terms &amp; Conditions at <a href="https://tmginstall.com/terms" target="_blank">tmginstall.com/terms</a>.</li>
      `}
    </ol>
  </div>

  <div class="footer">
    <div>
      <div class="thanks">${isInvoiceDoc ? "Thank you for your business." : "We appreciate the opportunity to quote for you."}</div>
      <div class="footer-ref">${isInvoiceDoc ? "Invoice" : "Quotation"} <strong>${esc(isInvoiceDoc ? invoiceNo : q.referenceNo)}</strong>${isInvoiceDoc ? ` · Job ${esc(q.referenceNo)}` : ""} · For ${esc(q.customer?.name || "—")} · Issued ${esc(issuedDate)}</div>
      <p>Generated ${esc(new Date().toLocaleDateString("en-SG", { year: "numeric", month: "long", day: "numeric" }))} · The Moving Guy Pte Ltd · UEN 202424156H · Vehicle GBM550L<br/>+65 8088 0757 · sales@tmginstall.com · <a href="https://tmginstall.com" target="_blank">tmginstall.com</a> · Terms: <a href="https://tmginstall.com/terms" target="_blank">tmginstall.com/terms</a></p>
    </div>
    <div class="sig-box">
      ${isInvoiceDoc ? `
      <div class="company-stamp" aria-hidden="true">
        <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          <defs>
            <!-- Top text path: r=42, sweep=1 (clockwise via top). Glyphs extend
                 OUTWARD from the path, sitting in the band r=42..r=49.5. -->
            <path id="tmgStampTopArc" d="M 18,60 A 42,42 0 0 1 102,60" fill="none" />
            <!-- Bottom text path: r=53, sweep=0 = counterclockwise via BOTTOM
                 (sweep=1 wrongly went via top, putting text upside-down on top).
                 Going left-to-right via bottom, text glyphs sit ABOVE the path
                 = toward center, occupying band r=47..r=53. Reads upright. -->
            <path id="tmgStampBottomArc" d="M 7,60 A 53,53 0 0 0 113,60" fill="none" />
          </defs>
          <!-- Outer thick ring -->
          <circle cx="60" cy="60" r="56" fill="none" stroke="#15407a" stroke-width="2.4" />
          <!-- Inner thin ring -->
          <circle cx="60" cy="60" r="39" fill="none" stroke="#15407a" stroke-width="0.9" />
          <!-- Top curved text: company name -->
          <text fill="#15407a" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="7.4" letter-spacing="1.3">
            <textPath xlink:href="#tmgStampTopArc" href="#tmgStampTopArc" startOffset="50%" text-anchor="middle">
              THE MOVING GUY PTE LTD
            </textPath>
          </text>
          <!-- Bottom curved text: UEN \u00B7 SINGAPORE -->
          <text fill="#15407a" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="6" letter-spacing="1.5">
            <textPath xlink:href="#tmgStampBottomArc" href="#tmgStampBottomArc" startOffset="50%" text-anchor="middle">
              UEN 202424156H \u00B7 SINGAPORE
            </textPath>
          </text>
          <!-- Center block: thin rules safely inside inner ring r=39 -->
          <line x1="32" y1="55" x2="88" y2="55" stroke="#15407a" stroke-width="0.6" />
          <line x1="32" y1="76" x2="88" y2="76" stroke="#15407a" stroke-width="0.6" />
          <text x="60" y="65" text-anchor="middle" fill="#15407a" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="8.6" letter-spacing="1.3">AUTHORISED</text>
          <text x="60" y="73" text-anchor="middle" fill="#15407a" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="5.4" letter-spacing="1.4">SIGNATORY</text>
        </svg>
      </div>
      <div class="sig-line"></div>
      <div class="sig-label">
        <span class="sig-name">The Moving Guy Pte Ltd</span>Authorised Signatory
      </div>` : `
      <div class="sig-line"></div>
      <div class="sig-label sig-label-center">
        <span class="sig-name">Customer</span>Signature &amp; Date
      </div>`}
    </div>
  </div>

  </div><!-- /.doc-body -->

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
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link
              href="/admin"
              data-testid="link-back-to-admin"
              className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0 flex-1">
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

          {/* Action toolbar — Edit always shown first when allowed so it remains visible
              on narrow iOS screens. Touch targets sized h-10 to meet mobile guidelines. */}
          <div className="flex items-center gap-1.5 shrink-0">
            {canEdit && !isEditing && quote.status !== 'cancelled' && (
              <button
                onClick={handleStartEdit}
                data-testid="button-edit-quote"
                title="Edit quote"
                aria-label="Edit quote"
                className="inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 rounded-lg bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 text-sm font-medium transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
            {['completed', 'final_payment_requested', 'final_paid', 'closed'].includes(quote.status) && (
              <button
                data-testid="button-reopen-job-header"
                disabled={reopenJob.isPending}
                onClick={() => {
                  const reason = prompt("Reason for reopening (optional):");
                  if (reason === null) return;
                  reopenJob.mutate(reason || undefined);
                }}
                title="Reopen job"
                aria-label="Reopen job"
                className="inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 active:bg-amber-200 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {reopenJob.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Reopen</span>
              </button>
            )}
            {quote.status !== "cancelled" && (quote.finalPaidAt || quote.paymentStatus === "paid_in_full" || ["closed", "final_paid"].includes(quote.status)) && (
              <button
                onClick={() => setShowInvoiceDialog(true)}
                data-testid="button-send-invoice"
                title="Send invoice / receipt to customer"
                aria-label="Send invoice"
                className="inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 text-sm font-medium transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Invoice</span>
              </button>
            )}
            <button
              onClick={handlePrintQuote}
              data-testid="button-print-quote"
              title="Print / Download PDF"
              aria-label="Print"
              className="inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 rounded-lg bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 active:bg-zinc-100 text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              data-testid="button-delete-quote"
              title="Delete quote"
              aria-label="Delete quote"
              className="inline-flex items-center justify-center gap-1.5 h-10 w-10 sm:w-auto sm:px-3 rounded-lg bg-white border border-zinc-300 text-red-600 hover:bg-red-50 active:bg-red-100 text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
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

                  {/* ── Invoice / Billing Presentation ──────────────────────── */}
                  <div className="border-t border-zinc-200 pt-4 mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">Billing & Invoice</h3>
                      <div className="inline-flex rounded-lg border border-zinc-300 p-0.5 bg-zinc-50">
                        <button type="button"
                          onClick={() => setEditQuoteData({ ...editQuoteData, invoiceType: 'residential' })}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${editQuoteData.invoiceType === 'residential' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                          data-testid="button-invoice-type-residential">
                          Residential
                        </button>
                        <button type="button"
                          onClick={() => setEditQuoteData({ ...editQuoteData, invoiceType: 'commercial' })}
                          className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${editQuoteData.invoiceType === 'commercial' ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                          data-testid="button-invoice-type-commercial">
                          Commercial
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-zinc-500 mb-1.5 block">
                          Billing Address (this quote)
                          <span className="text-zinc-400 font-normal"> — overrides customer default. Leave blank to use customer's saved billing address, then service address.</span>
                        </label>
                        <textarea value={editQuoteData.billingAddress || ''} onChange={e => setEditQuoteData({ ...editQuoteData, billingAddress: e.target.value })}
                          rows={2}
                          className="w-full p-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                          placeholder="e.g. 160 Robinson Road #14-04, Singapore 068914"
                          data-testid="input-billing-address" />
                      </div>

                      {editQuoteData.invoiceType === 'commercial' && (
                        <div className="space-y-3">
                          {/* Quick actions to copy company details to/from the saved customer profile,
                              so re-invoicing the same company is a one-click operation. */}
                          <div className="flex flex-wrap items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                            <span className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider mr-1">Company Profile:</span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditQuoteData({
                                  ...editQuoteData,
                                  billingCompanyName: editCustomer.companyName || editQuoteData.billingCompanyName || '',
                                  billingCompanyUen:  editCustomer.companyUen  || editQuoteData.billingCompanyUen  || '',
                                  billingAddress:     editCustomer.billingAddress || editQuoteData.billingAddress || '',
                                });
                                toast({ title: "Loaded from customer profile", description: "Company name, UEN and billing address copied into this quote." });
                              }}
                              disabled={!editCustomer.companyName && !editCustomer.companyUen && !editCustomer.billingAddress}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-white border border-blue-300 text-blue-800 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              data-testid="button-use-customer-profile">
                              ↓ Use customer profile
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!editQuoteData.billingCompanyName && !editQuoteData.billingCompanyUen && !editQuoteData.billingAddress) {
                                  toast({ title: "Nothing to save", description: "Fill in the company name, UEN or billing address first.", variant: "destructive" });
                                  return;
                                }
                                setEditCustomer({
                                  ...editCustomer,
                                  companyName:    editQuoteData.billingCompanyName || editCustomer.companyName || '',
                                  companyUen:     editQuoteData.billingCompanyUen  || editCustomer.companyUen  || '',
                                  billingAddress: editQuoteData.billingAddress     || editCustomer.billingAddress || '',
                                });
                                toast({ title: "Saved to customer profile", description: "Click Save below to persist. Future invoices for this customer will auto-fill these details." });
                              }}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
                              data-testid="button-save-to-customer-profile">
                              ↑ Save to customer profile
                            </button>
                            <span className="text-[10.5px] text-blue-700/80 ml-auto">Next invoice for this customer will start with these details pre-filled.</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Company Name (this quote)</label>
                              <input value={editQuoteData.billingCompanyName || ''} onChange={e => setEditQuoteData({ ...editQuoteData, billingCompanyName: e.target.value })}
                                className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="ABC Pte Ltd"
                                data-testid="input-billing-company-name" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">UEN (this quote)</label>
                              <input value={editQuoteData.billingCompanyUen || ''} onChange={e => setEditQuoteData({ ...editQuoteData, billingCompanyUen: e.target.value })}
                                className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="202012345A"
                                data-testid="input-billing-company-uen" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">PO Number <span className="text-zinc-400 font-normal">(optional)</span></label>
                              <input value={editQuoteData.poNumber || ''} onChange={e => setEditQuoteData({ ...editQuoteData, poNumber: e.target.value })}
                                className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="PO-2025-001"
                                data-testid="input-po-number" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Customer-profile defaults — saved on the customer record so future quotes inherit them. */}
                      <div className="border-t border-dashed border-zinc-200 pt-4 mt-2">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                          Customer Profile Defaults
                          <span className="text-zinc-400 font-normal normal-case tracking-normal"> — used when this quote leaves the fields above blank, and applied to future quotes for this customer.</span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Default Billing Address</label>
                            <textarea value={editCustomer.billingAddress || ''} onChange={e => setEditCustomer({ ...editCustomer, billingAddress: e.target.value })}
                              rows={2}
                              className="w-full p-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                              placeholder="Customer's standard billing address"
                              data-testid="input-customer-billing-address" />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Default Company Name</label>
                              <input value={editCustomer.companyName || ''} onChange={e => setEditCustomer({ ...editCustomer, companyName: e.target.value })}
                                className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="ABC Pte Ltd"
                                data-testid="input-customer-company-name" />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-zinc-500 mb-1.5 block">Default UEN</label>
                              <input value={editCustomer.companyUen || ''} onChange={e => setEditCustomer({ ...editCustomer, companyUen: e.target.value })}
                                className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                placeholder="202012345A"
                                data-testid="input-customer-company-uen" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
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
                    {(quote as any).samePropertyMove && (
                      <div className="grid grid-cols-[100px_1fr] gap-2 items-start" data-testid="badge-same-property-move">
                        <span className="text-xs text-zinc-500 mt-0.5">Move Type</span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-800 text-xs font-semibold rounded-md w-fit border border-amber-200">
                          Same-Property Move (no transport)
                        </span>
                      </div>
                    )}
                    {quote.pickupAddress && (
                      <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                        <span className="text-xs text-zinc-500 mt-0.5">{(quote as any).samePropertyMove ? "Property" : "Pickup At"}</span>
                        <span className="text-sm text-zinc-900 leading-snug">{quote.pickupAddress}</span>
                      </div>
                    )}
                    {quote.dropoffAddress && !(quote as any).samePropertyMove && (
                      <div className="grid grid-cols-[100px_1fr] gap-2 items-start">
                        <span className="text-xs text-zinc-500 mt-0.5">Dropoff At</span>
                        <span className="text-sm text-zinc-900 leading-snug">{quote.dropoffAddress}</span>
                      </div>
                    )}
                    {quote.distanceKm && Number(quote.distanceKm) > 0 && !(quote as any).samePropertyMove && (
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
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-zinc-500 block mb-1.5">Transport Fee</label>
                        <div className="relative w-32">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                          <input type="number" min="0" step="0.01" value={editQuoteData.transportFee || '0'} onChange={e => setEditQuoteData({ ...editQuoteData, transportFee: e.target.value })}
                            className="h-9 w-full pl-6 pr-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                        </div>
                      </div>
                      <label className="flex items-start gap-2.5 cursor-pointer select-none" data-testid="toggle-staff-transport-allowance">
                        <input
                          type="checkbox"
                          checked={!!editQuoteData.staffTransportAllowance}
                          onChange={e => setEditQuoteData({ ...editQuoteData, staffTransportAllowance: e.target.checked })}
                          className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          <span className="block text-sm font-medium text-zinc-900">Pay $8 transport allowance to assigned staff</span>
                          <span className="block text-xs text-zinc-500 mt-0.5">Adds $8 to the assigned staff's monthly payslip for this job.</span>
                        </span>
                      </label>
                      <div>
                        <label className="text-xs font-medium text-zinc-500 block mb-1.5">Goodwill Discount</label>
                        <div className="relative w-32">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                          <input
                            type="number" min="0" step="0.01"
                            value={editQuoteData.goodwillDiscount || '0'}
                            onChange={e => setEditQuoteData({ ...editQuoteData, goodwillDiscount: e.target.value })}
                            data-testid="input-goodwill-discount"
                            className="h-9 w-full pl-6 pr-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
                        </div>
                        <input
                          type="text"
                          placeholder="Reason (optional, shown to customer)"
                          value={editQuoteData.goodwillReason || ''}
                          onChange={e => setEditQuoteData({ ...editQuoteData, goodwillReason: e.target.value })}
                          data-testid="input-goodwill-reason"
                          maxLength={500}
                          className="mt-1.5 h-9 w-full sm:w-72 px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" />
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
                      {editGoodwillDiscount > 0 && (
                        <div className="flex justify-between sm:justify-end gap-6 text-sm mb-1.5">
                          <span className="text-zinc-500">Goodwill discount</span>
                          <span className="font-medium text-green-700">−${editGoodwillDiscount.toFixed(2)}</span>
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
                      {Number((quote as any).goodwillDiscount || 0) > 0 && (
                        <div className="flex justify-between text-sm" data-testid="row-goodwill-discount">
                          <span className="text-zinc-500">
                            Goodwill discount
                            {(quote as any).goodwillReason ? <span className="text-zinc-400"> · {(quote as any).goodwillReason}</span> : null}
                          </span>
                          <span className="font-medium text-green-700 tabular-nums">−{formatMoney((quote as any).goodwillDiscount)}</span>
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

            {/* ── Subcontractors ─────────────────────────────────────────────── */}
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-3.5 bg-zinc-50 border-b border-zinc-200">
                <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider flex items-center gap-2">
                  <Handshake className="w-3.5 h-3.5" /> Subcontractors
                </h3>
                <button
                  data-testid="button-add-subcontract"
                  onClick={() => setShowSubForm(v => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Assign
                </button>
              </div>

              {/* Add Form */}
              {showSubForm && (
                <div className="px-5 py-4 bg-blue-50 border-b border-blue-100 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-600 mb-1 block">Subcontractor</label>
                    <select
                      data-testid="select-subcontractor"
                      value={subForm.subcontractorId}
                      onChange={e => setSubForm(f => ({ ...f, subcontractorId: e.target.value }))}
                      className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select subcontractor…</option>
                      {(allSubs as any[]).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name} {s.company ? `(${s.company})` : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600 mb-1 block">Agreed Cost (SGD)</label>
                    <input
                      data-testid="input-subcontract-cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={subForm.agreedCost}
                      onChange={e => setSubForm(f => ({ ...f, agreedCost: e.target.value }))}
                      placeholder="0.00"
                      className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600 mb-1 block">Notes (optional)</label>
                    <input
                      data-testid="input-subcontract-notes"
                      type="text"
                      value={subForm.notes}
                      onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="e.g. Labour only, supply excluded"
                      className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      data-testid="button-confirm-subcontract"
                      onClick={() => {
                        if (!subForm.subcontractorId || !subForm.agreedCost) return;
                        assignSubMutation.mutate({
                          subcontractorId: parseInt(subForm.subcontractorId),
                          agreedCost: parseFloat(subForm.agreedCost),
                          notes: subForm.notes || undefined,
                        });
                      }}
                      disabled={assignSubMutation.isPending || !subForm.subcontractorId || !subForm.agreedCost}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      {assignSubMutation.isPending ? "Saving…" : "Confirm"}
                    </button>
                    <button
                      data-testid="button-cancel-subcontract"
                      onClick={() => { setShowSubForm(false); setSubForm({ subcontractorId: "", agreedCost: "", notes: "" }); }}
                      className="px-4 py-2 text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Subcontract List */}
              <div className="divide-y divide-zinc-100">
                {(subcontracts as any[]).length === 0 ? (
                  <p className="text-xs text-zinc-400 px-5 py-4 text-center">No subcontractors assigned to this job.</p>
                ) : (
                  (subcontracts as any[]).map((sc: any) => (
                    <div key={sc.id} data-testid={`row-subcontract-${sc.id}`} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{sc.subcontractor?.name || "—"}</p>
                        {sc.notes && <p className="text-xs text-zinc-400 truncate">{sc.notes}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-zinc-900">${Number(sc.agreedCost).toFixed(2)}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          sc.paymentStatus === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {sc.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          data-testid={`button-toggle-subpaid-${sc.id}`}
                          title={sc.paymentStatus === "paid" ? "Mark unpaid" : "Mark paid"}
                          onClick={() => markSubPaidMutation.mutate({ scId: sc.id, paid: sc.paymentStatus !== "paid" })}
                          disabled={markSubPaidMutation.isPending}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          data-testid={`button-remove-subcontract-${sc.id}`}
                          title="Remove"
                          onClick={() => { if (confirm("Remove this subcontractor from the job?")) removeSubMutation.mutate(sc.id); }}
                          disabled={removeSubMutation.isPending}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cost summary */}
              {(subcontracts as any[]).length > 0 && (() => {
                const totalSubCost = (subcontracts as any[]).reduce((s: number, sc: any) => s + Number(sc.agreedCost), 0);
                const jobTotal = Number(quote.totalAmount || 0);
                const net = jobTotal - totalSubCost;
                return (
                  <div className="px-5 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-xs text-zinc-500">
                    <span>Sub costs: <strong className="text-zinc-800">${totalSubCost.toFixed(2)}</strong></span>
                    <span>Net profit: <strong className={net >= 0 ? "text-emerald-700" : "text-red-600"}>${net.toFixed(2)}</strong></span>
                  </div>
                );
              })()}
            </div>
            
          </div>
          
          {/* Right Column (Action Panel) */}
          <div className="space-y-5 lg:sticky lg:top-28 lg:self-start">

            <AiEmailDrafter quote={quote} />

            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-zinc-50 px-5 py-4 border-b border-zinc-200">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Job Pipeline</p>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-zinc-200">
                  {/* Status Timeline */}
                  {[
                    { id: "quote", label: "Quote Requested", done: true, active: quote.status === 'submitted' || quote.status === 'under_review' },
                    { id: "approved", label: "Quote Approved", done: !['submitted', 'under_review', 'cancelled'].includes(quote.status), active: quote.status === 'approved' },
                    { id: "deposit", label: "Deposit Paid", done: !!quote.depositPaidAt, active: quote.status === 'deposit_requested' },
                    { id: "booked", label: "Booked & Assigned", done: ['booked', 'assigned', 'in_progress', 'at_pickup', 'in_transit', 'at_dropoff', 'completed', 'final_payment_requested', 'final_paid', 'closed'].includes(quote.status), active: quote.status === 'deposit_paid' || quote.status === 'booking_pending' || quote.status === 'booked' || quote.status === 'assigned' },
                    { id: "completed", label: "Job Completed", done: ['completed', 'final_payment_requested', 'final_paid', 'closed'].includes(quote.status), active: ['in_progress', 'at_pickup', 'in_transit', 'at_dropoff'].includes(quote.status) },
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
                  (quote as any).invoiceType === 'commercial' ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                        <span className="font-semibold">Commercial customer</span> — no deposit collected. Booking is confirmed on approval; a Net 30 invoice is sent after job completion.
                      </div>
                      <button onClick={handleApproveCommercialBooking} disabled={approveCommercial.isPending}
                        data-testid="button-approve-commercial-booking"
                        className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                        <CalendarCheck className="w-4 h-4" />
                        {approveCommercial.isPending ? "Confirming…" : "Approve & Book Job"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button onClick={handleApproveAndRequestDeposit} disabled={updateStatus.isPending}
                        className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                        <CheckCircle2 className="w-4 h-4" /> Approve & Request Deposit
                      </button>
                      <button
                        onClick={() => setShowPayNowConfirm(true)}
                        data-testid="button-mark-deposit-already-paid"
                        title="Customer already paid via PayNow — record it without sending the deposit request message"
                        className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-sm font-medium transition-colors">
                        <QrCode className="w-4 h-4" /> Customer Already Paid Deposit (PayNow)
                      </button>
                    </div>
                  )
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
                      onCopy={() => setShowPaymentMessageDialog(true)}
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

                {['submitted', 'under_review', 'approved', 'deposit_requested'].includes(quote.status) && (
                  <ScheduleEditor
                    quoteId={quote.id}
                    scheduledAt={quote.scheduledAt}
                    timeWindow={quote.timeWindow}
                    preferredDate={quote.preferredDate}
                    preferredTimeWindow={quote.preferredTimeWindow}
                    currentStatus={quote.status}
                  />
                )}

                {['deposit_paid', 'booking_pending', 'booked', 'assigned', 'in_progress', 'at_pickup', 'in_transit', 'at_dropoff'].includes(quote.status) && (
                  <div className="space-y-4">
                    <ScheduleEditor
                      quoteId={quote.id}
                      scheduledAt={quote.scheduledAt}
                      timeWindow={quote.timeWindow}
                      preferredDate={quote.preferredDate}
                      preferredTimeWindow={quote.preferredTimeWindow}
                      currentStatus={quote.status}
                    />
                    
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500">Assign Staff or Team</label>
                      <select value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)}
                        data-testid="select-assignee"
                        className="h-10 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors">
                        <option value="">Select...</option>
                        {teamsList.length > 0 && (
                          <optgroup label="Teams">
                            {teamsList.map((t: any) => (
                              <option key={`team:${t.id}`} value={`team:${t.id}`}>{t.name}</option>
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
                        data-testid="button-update-assignment"
                        className="inline-flex items-center justify-center w-full gap-2 h-10 px-4 rounded-lg bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors disabled:opacity-50">
                        <UserPlus className="w-4 h-4" /> Update Assignment
                      </button>
                    </div>

                    {(quote as any).assignedTeam && (
                      <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700">
                          <Users className="w-4 h-4" />
                        </div>
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
                          onCopy={() => setShowPaymentMessageDialog(true)}
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
                          {resetDeposit.isPending ? (
                            "Resetting…"
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reset & Re-send Deposit Link
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {hasMultiplePhases && (
                      <div className="pt-2 border-t border-zinc-100">
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">Multi-Day Job Progress</p>
                            <p className="text-[10px] text-zinc-500">
                              {applicablePhases.filter(p => !!phaseStatus(p.key)).length} / {applicablePhases.length} done
                            </p>
                          </div>
                          <div className="space-y-1.5">
                            {applicablePhases.map((p) => {
                              const done = phaseStatus(p.key);
                              return (
                                <div key={p.key} className="flex items-center justify-between gap-2 bg-white rounded border border-zinc-200 px-2.5 py-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {done ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full border-2 border-zinc-300 shrink-0" />
                                    )}
                                    <div className="min-w-0">
                                      <p className={`text-sm font-medium ${done ? 'text-zinc-500 line-through' : 'text-zinc-800'}`}>{p.label}</p>
                                      {done && (
                                        <p className="text-[10px] text-zinc-400">
                                          Done {new Date(done.completedAt).toLocaleDateString("en-SG", { day: 'numeric', month: 'short' })}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {done ? (
                                    <button
                                      onClick={() => togglePhase.mutate({ phase: p.key, done: false })}
                                      disabled={togglePhase.isPending}
                                      data-testid={`button-undo-phase-${p.key}`}
                                      className="text-[10px] uppercase tracking-wide text-zinc-400 hover:text-zinc-700 disabled:opacity-50 px-2 py-1"
                                    >
                                      Undo
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => togglePhase.mutate({ phase: p.key, done: true })}
                                      disabled={togglePhase.isPending}
                                      data-testid={`button-mark-phase-${p.key}`}
                                      className="text-xs font-medium px-2.5 py-1.5 rounded bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 shrink-0"
                                    >
                                      Mark Done
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {!allPhasesDone && (
                            <p className="text-[11px] text-zinc-500 pt-1">
                              Tick each phase as it's completed across the different days. Final payment can be requested once all phases are done.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-zinc-100 space-y-2">
                      {!quote.finalPaidAt && (
                        <button
                          onClick={handleRequestFinalPayment}
                          disabled={requestFinalPayment.isPending || finalPaymentBlockedByPhases}
                          data-testid="button-mark-done-request-final"
                          title={finalPaymentBlockedByPhases ? "Tick all phases above before requesting final payment" : undefined}
                          className="inline-flex items-center justify-center w-full gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {requestFinalPayment.isPending
                            ? "Sending…"
                            : finalPaymentBlockedByPhases
                              ? `Waiting on ${applicablePhases.filter(p => !phaseStatus(p.key)).map(p => p.label).join(" + ")}`
                              : "Mark Done & Request Final Payment"}
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

                {['in_progress', 'at_pickup', 'in_transit', 'at_dropoff'].includes(quote.status) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
                    <Zap className="w-5 h-5 text-blue-500 shrink-0" />
                    <p className="text-sm font-medium text-blue-800">
                      {quote.status === 'at_pickup' && 'Field team at pickup address, loading items.'}
                      {quote.status === 'in_transit' && 'Items loaded — field team in transit to dropoff.'}
                      {quote.status === 'at_dropoff' && 'Field team at dropoff address, unloading.'}
                      {quote.status === 'in_progress' && 'Job currently in progress by field team.'}
                    </p>
                  </div>
                )}

                {quote.status === 'completed' && (
                  (quote as any).invoiceType === 'commercial' ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                        <span className="font-semibold">Commercial job complete</span> — send the Net 30 tax invoice to the customer.
                      </div>
                      <button onClick={handleSendCommercialInvoice} disabled={sendCommercialInvoice.isPending}
                        data-testid="button-send-commercial-invoice"
                        className="inline-flex items-center justify-center w-full gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                        <DollarSign className="w-4 h-4" />
                        {sendCommercialInvoice.isPending ? "Sending Invoice…" : "Send Invoice (Net 30)"}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleRequestFinalPayment}
                      disabled={requestFinalPayment.isPending || finalPaymentBlockedByPhases}
                      data-testid="button-request-final-payment"
                      title={finalPaymentBlockedByPhases ? "Tick all job phases before requesting final payment" : undefined}
                      className="inline-flex items-center justify-center w-full gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <DollarSign className="w-4 h-4" />
                      {finalPaymentBlockedByPhases
                        ? `Waiting on ${applicablePhases.filter(p => !phaseStatus(p.key)).map(p => p.label).join(" + ")}`
                        : "Request Final Payment (Stripe / PayNow)"}
                    </button>
                  )
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
                      onCopy={() => setShowPaymentMessageDialog(true)}
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
            {['in_progress', 'at_pickup', 'in_transit', 'at_dropoff', 'completed', 'final_payment_requested', 'final_paid', 'closed'].includes(quote.status) &&
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
        if (['submitted', 'under_review'].includes(s)) {
          if ((quote as any).invoiceType === 'commercial') return (
            <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-1 bg-white border-t border-zinc-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
              <button onClick={handleApproveCommercialBooking} disabled={approveCommercial.isPending}
                data-testid="button-approve-commercial-booking-mobile"
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                <CalendarCheck className="w-4 h-4" />
                {approveCommercial.isPending ? "Confirming…" : "Approve & Book Job (Commercial)"}
              </button>
            </div>
          );
          return (
            <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-1 bg-white border-t border-zinc-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] space-y-1.5">
              <button onClick={handleApproveAndRequestDeposit} disabled={updateStatus.isPending}
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> Approve & Request Deposit
              </button>
              <button
                onClick={() => setShowPayNowConfirm(true)}
                data-testid="button-mark-deposit-already-paid-mobile"
                className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-xl bg-white border border-emerald-300 text-emerald-700 text-xs font-semibold transition-colors">
                <QrCode className="w-3.5 h-3.5" /> Already Paid via PayNow — Skip Request
              </button>
            </div>
          );
        }
        if (s === 'deposit_paid') return (
          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-1 bg-white border-t border-zinc-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
            <button onClick={handleConfirmBooking} disabled={confirmBooking.isPending}
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
              <CalendarCheck className="w-4 h-4" /> Confirm Booking
            </button>
          </div>
        );
        if (['deposit_paid', 'booked', 'assigned', 'in_progress', 'at_pickup', 'in_transit', 'at_dropoff', 'completed'].includes(s)) {
          if ((quote as any).invoiceType === 'commercial' && s === 'completed') return (
            <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-1 bg-white border-t border-zinc-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
              <button onClick={handleSendCommercialInvoice} disabled={sendCommercialInvoice.isPending}
                data-testid="button-send-commercial-invoice-mobile"
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                <DollarSign className="w-4 h-4" />
                {sendCommercialInvoice.isPending ? "Sending Invoice…" : "Send Invoice (Net 30)"}
              </button>
            </div>
          );
          return (
            <div className="lg:hidden fixed bottom-16 left-0 right-0 z-30 px-4 pb-2 pt-1 bg-white border-t border-zinc-200 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
              <button
                onClick={handleRequestFinalPayment}
                disabled={requestFinalPayment.isPending || finalPaymentBlockedByPhases}
                title={finalPaymentBlockedByPhases ? "Tick all job phases before requesting final payment" : undefined}
                className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                {finalPaymentBlockedByPhases
                  ? `Waiting on ${applicablePhases.filter(p => !phaseStatus(p.key)).map(p => p.label).join(" + ")}`
                  : "Mark Done & Request Final Payment"}
              </button>
            </div>
          );
        }
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
                  onCopy={() => setShowPaymentMessageDialog(true)}
                  compact
                />
              </div>
            </div>
          </div>
        );
        return null;
      })()}

      {/* Payment-message snippet dialog (manual fallback when WhatsApp delivery fails) */}
      <PaymentMessageDialog
        open={showPaymentMessageDialog}
        onClose={() => setShowPaymentMessageDialog(false)}
        fetchUrl={`/api/admin/quotes/${id}/payment-message`}
      />

      {/* Invoice / receipt sharing dialog (only available once paid in full) */}
      <InvoiceMessageDialog
        open={showInvoiceDialog}
        onClose={() => setShowInvoiceDialog(false)}
        fetchUrl={`/api/admin/quotes/${id}/invoice-message`}
      />

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
