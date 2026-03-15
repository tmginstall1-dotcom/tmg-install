import { useQuotes, useUpdateQuoteStatus } from "@/hooks/use-quotes";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { useState } from "react";
import {
  ClipboardList, DollarSign, CalendarCheck,
  Zap, CheckCircle2, Calendar, TrendingUp, AlertCircle, Trash2, UserPlus,
  ChevronRight, Clock, Sparkles, Users, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatMoney(v: any) {
  return `$${Number(v || 0).toLocaleString("en-SG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function initials(name: string = "?") {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_PALETTE = [
  "bg-violet-100 text-violet-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];
function avatarBg(id: number) { return AVATAR_PALETTE[id % AVATAR_PALETTE.length]; }

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

// ─── Quote row ───────────────────────────────────────────────────────────────

function QuoteRow({ quote, showDate = false }: { quote: any; showDate?: boolean }) {
  const slotDate = quote.scheduledAt
    ? format(new Date(quote.scheduledAt), "d MMM")
    : quote.preferredDate
      ? format(new Date(quote.preferredDate + "T12:00:00"), "d MMM")
      : null;

  return (
    <Link href={`/admin/quotes/${quote.id}`} data-testid={`quote-row-${quote.id}`}
      className="block w-full">
      <div className="group flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-slate-100 last:border-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${avatarBg(quote.id)}`}>
          {initials(quote.customer?.name)}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="font-semibold text-sm text-slate-800 truncate leading-tight">
            {quote.customer?.name || "Unknown"}
          </p>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {quote.serviceAddress || "No address"}
          </p>
        </div>
        <div className="shrink-0 text-right ml-2">
          <p className="text-sm font-bold text-slate-800 tabular-nums">{formatMoney(quote.total)}</p>
          <p className="text-[11px] text-slate-400 tabular-nums">
            {showDate && slotDate ? slotDate : format(new Date(quote.createdAt), "d MMM")}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 group-hover:text-violet-400 transition-colors" />
      </div>
    </Link>
  );
}

// ─── Booked quote row with quick-assign ──────────────────────────────────────

function BookedQuoteRow({ quote }: { quote: any }) {
  const { toast } = useToast();
  const { data: staffList } = useQuery<any[]>({ queryKey: ["/api/staff"] });
  const updateStatus = useUpdateQuoteStatus();
  const [selectedStaff, setSelectedStaff] = useState("");
  const [expanded, setExpanded] = useState(false);

  const slotDate = quote.scheduledAt
    ? format(new Date(quote.scheduledAt), "EEE d MMM")
    : quote.preferredDate
      ? format(new Date(quote.preferredDate + "T12:00:00"), "EEE d MMM")
      : null;

  const handleAssign = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!selectedStaff) return;
    try {
      await updateStatus.mutateAsync({ id: quote.id, status: "assigned", assignedStaffId: parseInt(selectedStaff) });
      toast({ title: "Staff assigned" });
      setExpanded(false);
    } catch {
      toast({ title: "Failed to assign", variant: "destructive" });
    }
  };

  return (
    <div className="border-b border-slate-100 last:border-0">
      <Link href={`/admin/quotes/${quote.id}`} data-testid={`quote-row-${quote.id}`}
        className="block w-full">
        <div className="group flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 active:bg-slate-100 transition-colors">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${avatarBg(quote.id)}`}>
            {initials(quote.customer?.name)}
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-semibold text-sm text-slate-800 truncate leading-tight">
              {quote.customer?.name || "Unknown"}
            </p>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {slotDate || "No date set"}
            </p>
          </div>
          {quote.assignedStaffId
            ? <span className="shrink-0 text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">ASSIGNED</span>
            : <span className="shrink-0 text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-1 rounded-full">UNASSIGNED</span>
          }
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-slate-800 tabular-nums">{formatMoney(quote.total)}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 group-hover:text-violet-400 transition-colors" />
        </div>
      </Link>
      {!quote.assignedStaffId && (
        <div className="px-4 pb-3">
          {!expanded ? (
            <button onClick={() => setExpanded(true)} data-testid={`button-quick-assign-${quote.id}`}
              className="flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors py-1">
              <UserPlus className="w-3.5 h-3.5" /> Assign Staff
            </button>
          ) : (
            <div className="flex items-center gap-2" onClick={e => e.preventDefault()}>
              <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
                className="flex-1 min-w-0 text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                data-testid={`select-quick-staff-${quote.id}`}>
                <option value="">Select staff…</option>
                {staffList?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button onClick={handleAssign} disabled={!selectedStaff || updateStatus.isPending}
                className="text-sm font-bold bg-violet-600 text-white px-4 py-2.5 rounded-xl disabled:opacity-50 shrink-0"
                data-testid={`button-confirm-assign-${quote.id}`}>
                Assign
              </button>
              <button onClick={() => setExpanded(false)} className="p-2 text-slate-400 shrink-0">✕</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section panel ────────────────────────────────────────────────────────────

const ACCENT: Record<string, { dot: string; badge: string; border: string }> = {
  violet:  { dot: "bg-violet-500",  badge: "bg-violet-600 text-white",   border: "border-slate-200" },
  amber:   { dot: "bg-amber-500",   badge: "bg-amber-500 text-white",    border: "border-slate-200" },
  cyan:    { dot: "bg-cyan-500",    badge: "bg-cyan-600 text-white",     border: "border-slate-200" },
  orange:  { dot: "bg-orange-500",  badge: "bg-orange-500 text-white",   border: "border-orange-200" },
  emerald: { dot: "bg-emerald-500", badge: "bg-emerald-600 text-white",  border: "border-slate-200" },
};

function SectionPanel({
  title, accentColor, quotes, emptyMsg, showDate, urgent = false, bookedStyle = false,
}: {
  title: string; accentColor: string;
  quotes: any[]; emptyMsg: string; showDate?: boolean; urgent?: boolean; bookedStyle?: boolean;
}) {
  const ac = ACCENT[accentColor] || ACCENT.violet;

  return (
    <div className={`w-full bg-white rounded-2xl border overflow-hidden shadow-sm ${
      urgent && quotes.length > 0 ? "border-orange-200" : ac.border
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${ac.dot}`} />
          <h2 className="font-bold text-sm text-slate-800">{title}</h2>
        </div>
        <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-xs font-black ${
          quotes.length > 0 ? ac.badge : "bg-slate-100 text-slate-400"
        }`}>
          {quotes.length}
        </span>
      </div>

      {/* Rows */}
      <div className="overflow-hidden">
        {quotes.map((q: any) => bookedStyle
          ? <BookedQuoteRow key={q.id} quote={q} />
          : <QuoteRow key={q.id} quote={q} showDate={showDate} />
        )}
        {quotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-1.5 text-slate-300 overflow-hidden">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p className="text-xs font-medium text-center px-4">{emptyMsg}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data: allQuotes, isLoading } = useQuotes();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/clear-all-data", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setShowClearConfirm(false);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-violet-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  const quotes = allQuotes || [];

  const newQuotes       = quotes.filter((q: any) => ["submitted", "under_review"].includes(q.status));
  const awaitingDeposit = quotes.filter((q: any) =>
    ["deposit_requested", "approved"].includes(q.status) ||
    (q.status === "deposit_paid" && !q.scheduledAt)
  );
  const upcomingBooked  = quotes.filter((q: any) => ["booked", "assigned"].includes(q.status));
  const activeJobs      = quotes.filter((q: any) => q.status === "in_progress");
  const awaitingPayment = quotes.filter((q: any) => ["completed", "final_payment_requested"].includes(q.status));
  const recentlyClosed  = quotes.filter((q: any) => ["closed", "final_paid"].includes(q.status)).slice(0, 4);

  const totalRevenue = quotes
    .filter((q: any) => ["closed", "final_paid"].includes(q.status))
    .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

  const urgentCount = newQuotes.length + awaitingPayment.length;

  const statCards = [
    { label: "New",          value: newQuotes.length,       icon: ClipboardList, accent: "violet",  urgent: newQuotes.length > 0 },
    { label: "Deposit",      value: awaitingDeposit.length, icon: DollarSign,    accent: "amber",   urgent: false },
    { label: "Bookings",     value: upcomingBooked.length,  icon: CalendarCheck, accent: "cyan",    urgent: false },
    { label: "In Progress",  value: activeJobs.length,      icon: Zap,           accent: "orange",  urgent: false },
    { label: "Payment Due",  value: awaitingPayment.length, icon: AlertCircle,   accent: "emerald", urgent: awaitingPayment.length > 0 },
  ];

  const accentIconBg: Record<string, string> = {
    violet:  "bg-violet-100 text-violet-500",
    amber:   "bg-amber-100 text-amber-500",
    cyan:    "bg-sky-100 text-sky-500",
    orange:  "bg-orange-100 text-orange-500",
    emerald: "bg-emerald-100 text-emerald-500",
  };
  const accentBar: Record<string, string> = {
    violet:  "bg-violet-500",
    amber:   "bg-amber-500",
    cyan:    "bg-sky-500",
    orange:  "bg-orange-500",
    emerald: "bg-emerald-500",
  };

  return (
    <div className="min-h-screen pt-14 bg-slate-50 pb-24 overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-950 text-white">
        <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto py-5">

          {/* Top row: greeting + revenue */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Sparkles className="w-3 h-3 text-violet-400" />
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Good {greeting()}</p>
              </div>
              <h1 className="text-lg font-black text-white tracking-tight leading-tight">Operations</h1>
              <p className="text-slate-500 text-xs mt-0.5">{format(new Date(), "EEE, d MMM yyyy")}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Revenue</p>
              <p className="text-xl font-black text-white leading-none">{formatMoney(totalRevenue)}</p>
              <Link href="/admin/schedule" data-testid="link-schedule"
                className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-lg transition-colors">
                <Calendar className="w-3 h-3" /> Schedule
              </Link>
            </div>
          </div>

          {/* Stat grid — 3-col on mobile */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-4">
            {statCards.map((card) => (
              <div key={card.label}
                className={`rounded-xl px-3 py-3 border ${
                  card.urgent && card.value > 0
                    ? "bg-orange-500/15 border-orange-500/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${accentIconBg[card.accent]}`}>
                    <card.icon className="w-3 h-3" />
                  </div>
                  <span className={`text-xl font-black tabular-nums ${
                    card.urgent && card.value > 0 ? "text-orange-300" :
                    card.value > 0 ? "text-white" : "text-slate-600"
                  }`}>{card.value}</span>
                </div>
                <p className="text-[10px] font-semibold text-slate-500 leading-tight">{card.label}</p>
                <div className={`mt-1.5 h-[2px] rounded-full ${card.value > 0 ? accentBar[card.accent] : "bg-white/10"}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Attention banner */}
        {urgentCount > 0 && (
          <div className="mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800 truncate">
                {urgentCount} item{urgentCount !== 1 ? "s" : ""} need attention
              </p>
              <p className="text-xs text-amber-600 truncate">
                {[
                  newQuotes.length > 0 && `${newQuotes.length} new`,
                  awaitingPayment.length > 0 && `${awaitingPayment.length} awaiting payment`,
                ].filter(Boolean).join(" · ")}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
        )}

        {/* Section grid — single column on mobile, 2-col on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <SectionPanel
            title="New Quote Requests"
            accentColor="violet"
            quotes={newQuotes}
            emptyMsg="No new requests — all clear"
            urgent
          />
          <SectionPanel
            title="Awaiting Deposit"
            accentColor="amber"
            quotes={awaitingDeposit}
            emptyMsg="No outstanding deposits"
          />
          <SectionPanel
            title="Upcoming Bookings"
            accentColor="cyan"
            quotes={upcomingBooked}
            emptyMsg="No upcoming bookings"
            showDate
            bookedStyle
          />
          <SectionPanel
            title="Active / In Progress"
            accentColor="orange"
            quotes={activeJobs}
            emptyMsg="No active jobs right now"
            urgent
          />
          <div className="lg:col-span-2">
            <SectionPanel
              title="Awaiting Final Payment"
              accentColor="emerald"
              quotes={awaitingPayment.concat(recentlyClosed)}
              emptyMsg="No jobs awaiting payment"
            />
          </div>
        </div>

        {/* Quick-nav cards */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: "/admin/schedule", label: "Manage Schedule",  icon: Calendar,      desc: "Block dates & confirm bookings" },
            { href: "/admin/staff",    label: "Staff & HR",       icon: Users,         desc: "Payroll, leave & amendments" },
            { href: "/admin/export",   label: "Audit & Export",   icon: TrendingUp,    desc: "Generate reports & CSV export" },
          ].map(({ href, label, icon: Icon, desc }) => (
            <Link key={href} href={href} className="block w-full">
              <div className="group flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 hover:border-violet-300 hover:shadow-sm transition-all active:bg-slate-50">
                <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-violet-100 flex items-center justify-center transition-colors shrink-0">
                  <Icon className="w-4 h-4 text-slate-500 group-hover:text-violet-600 transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-800">{label}</p>
                  <p className="text-xs text-slate-400 truncate">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-400 shrink-0 transition-colors" />
              </div>
            </Link>
          ))}
        </div>

        {/* Danger zone — tucked away */}
        <div className="mt-6 mb-2">
          {!showClearConfirm ? (
            <button onClick={() => setShowClearConfirm(true)}
              className="text-[11px] font-semibold text-slate-300 hover:text-red-400 transition-colors"
              data-testid="button-clear-all-data">
              Clear test data
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-semibold flex-1">Delete ALL quotes & data?</p>
              <button onClick={() => clearAllMutation.mutate()} disabled={clearAllMutation.isPending}
                className="text-xs font-black text-white bg-red-600 px-3 py-1.5 rounded-lg disabled:opacity-50">
                {clearAllMutation.isPending ? "…" : "Delete"}
              </button>
              <button onClick={() => setShowClearConfirm(false)}
                className="text-xs font-semibold text-slate-500">Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
