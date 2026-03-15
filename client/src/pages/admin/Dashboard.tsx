import { useQuotes, useUpdateQuoteStatus } from "@/hooks/use-quotes";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { useState } from "react";
import {
  ArrowRight, ClipboardList, DollarSign, CalendarCheck,
  Zap, CheckCircle2, Calendar, TrendingUp, AlertCircle, Trash2, UserPlus,
  ArrowUpRight, ChevronRight, Clock, Sparkles, Users,
} from "lucide-react";
import { motion } from "framer-motion";
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
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Quote row ───────────────────────────────────────────────────────────────

function QuoteRow({ quote, showDate = false }: { quote: any; showDate?: boolean }) {
  const slotDate = quote.scheduledAt
    ? format(new Date(quote.scheduledAt), "d MMM")
    : quote.preferredDate
      ? format(new Date(quote.preferredDate + "T12:00:00"), "d MMM") + " (pref.)"
      : null;

  return (
    <Link href={`/admin/quotes/${quote.id}`} data-testid={`quote-row-${quote.id}`}>
      <div className="group flex items-center gap-3.5 px-5 py-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer border-b border-slate-100 last:border-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${avatarBg(quote.id)}`}>
          {initials(quote.customer?.name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-800 leading-tight truncate group-hover:text-violet-700 transition-colors">
            {quote.customer?.name || "Unknown"}
          </p>
          <p className="text-xs text-slate-400 truncate mt-0.5">{quote.serviceAddress}</p>
        </div>
        <span className="hidden md:inline text-[11px] font-mono font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
          {quote.referenceNo}
        </span>
        <StatusBadge status={quote.status} className="hidden lg:inline-flex shrink-0" />
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-slate-800">{formatMoney(quote.total)}</p>
          <p className="text-[11px] text-slate-400">
            {showDate && slotDate ? slotDate : format(new Date(quote.createdAt), "d MMM")}
          </p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all shrink-0" />
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
    ? format(new Date(quote.scheduledAt), "d MMM")
    : quote.preferredDate
      ? format(new Date(quote.preferredDate + "T12:00:00"), "d MMM")
      : null;

  const handleAssign = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!selectedStaff) return;
    try {
      await updateStatus.mutateAsync({ id: quote.id, status: "assigned", assignedStaffId: parseInt(selectedStaff) });
      toast({ title: "Staff assigned", description: "Job is now assigned." });
      setExpanded(false);
    } catch {
      toast({ title: "Failed to assign", variant: "destructive" });
    }
  };

  return (
    <div className="border-b border-slate-100 last:border-0">
      <Link href={`/admin/quotes/${quote.id}`} data-testid={`quote-row-${quote.id}`}>
        <div className="group flex items-center gap-3.5 px-5 py-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${avatarBg(quote.id)}`}>
            {initials(quote.customer?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-slate-800 leading-tight truncate group-hover:text-violet-700 transition-colors">
              {quote.customer?.name || "Unknown"}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-slate-400 truncate">{quote.serviceAddress}</p>
              {slotDate && (
                <span className="hidden sm:inline shrink-0 text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md">{slotDate}</span>
              )}
            </div>
          </div>
          <span className="hidden md:inline text-[11px] font-mono font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
            {quote.referenceNo}
          </span>
          {quote.assignedStaffId
            ? <StatusBadge status="assigned" className="shrink-0" />
            : <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0 tracking-wide">UNASSIGNED</span>
          }
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-slate-800">{formatMoney(quote.total)}</p>
            {slotDate && <p className="text-[11px] text-slate-400">{slotDate}</p>}
          </div>
        </div>
      </Link>
      {!quote.assignedStaffId && (
        <div className="px-5 pb-3">
          {!expanded ? (
            <button onClick={() => setExpanded(true)} data-testid={`button-quick-assign-${quote.id}`}
              className="flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Quick Assign Staff
            </button>
          ) : (
            <div className="flex items-center gap-2" onClick={e => e.preventDefault()}>
              <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)}
                className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                data-testid={`select-quick-staff-${quote.id}`}>
                <option value="">Select staff…</option>
                {staffList?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button onClick={handleAssign} disabled={!selectedStaff || updateStatus.isPending}
                className="text-sm font-bold bg-violet-600 text-white px-4 py-2.5 rounded-xl disabled:opacity-50 hover:bg-violet-700 transition-colors shrink-0"
                data-testid={`button-confirm-assign-${quote.id}`}>
                Assign
              </button>
              <button onClick={() => setExpanded(false)}
                className="p-2.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg">✕</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section panel ────────────────────────────────────────────────────────────

const ACCENT_DOT: Record<string, string> = {
  violet: "bg-violet-500",
  amber:  "bg-amber-500",
  cyan:   "bg-cyan-500",
  orange: "bg-orange-500",
  emerald:"bg-emerald-500",
};

function SectionPanel({
  title, icon: Icon, accentColor, quotes, emptyMsg, showDate, urgent = false, bookedStyle = false,
}: {
  title: string; icon: React.ElementType; accentColor: string;
  quotes: any[]; emptyMsg: string; showDate?: boolean; urgent?: boolean; bookedStyle?: boolean;
}) {
  const dot = ACCENT_DOT[accentColor] || "bg-slate-400";
  const countBg = quotes.length > 0
    ? urgent ? "bg-orange-500 text-white" : "bg-violet-600 text-white"
    : "bg-slate-100 text-slate-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${
        urgent && quotes.length > 0 ? "border-orange-200 shadow-orange-100/60 shadow-sm" : "border-slate-200 shadow-sm"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <h2 className="font-bold text-sm text-slate-800">{title}</h2>
          {urgent && quotes.length > 0 && (
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">URGENT</span>
          )}
        </div>
        <span className={`min-w-[1.5rem] h-6 px-2 rounded-full flex items-center justify-center text-xs font-black ${countBg}`}>
          {quotes.length}
        </span>
      </div>

      {/* Rows */}
      <div>
        {quotes.map((q: any) => bookedStyle
          ? <BookedQuoteRow key={q.id} quote={q} />
          : <QuoteRow key={q.id} quote={q} showDate={showDate} />
        )}
        {quotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-300">
            <CheckCircle2 className="w-6 h-6" />
            <p className="text-sm font-medium">{emptyMsg}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data: allQuotes, isLoading } = useQuotes();

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/clear-all-data", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/quotes"] }),
  });

  function handleClearAll() {
    if (window.confirm("⚠️ Delete ALL quotes, customers and job data? This cannot be undone.")) {
      clearAllMutation.mutate();
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-14 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-violet-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading dashboard…</p>
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
    { label: "New Requests",       value: newQuotes.length,       icon: ClipboardList, accent: "violet",  urgent: newQuotes.length > 0 },
    { label: "Awaiting Deposit",   value: awaitingDeposit.length, icon: DollarSign,    accent: "amber",   urgent: false },
    { label: "Upcoming Bookings",  value: upcomingBooked.length,  icon: CalendarCheck, accent: "cyan",    urgent: false },
    { label: "In Progress",        value: activeJobs.length,      icon: Zap,           accent: "orange",  urgent: false },
    { label: "Awaiting Payment",   value: awaitingPayment.length, icon: AlertCircle,   accent: "emerald", urgent: awaitingPayment.length > 0 },
  ];

  const accentIconBg: Record<string, string> = {
    violet:  "bg-violet-100 text-violet-600",
    amber:   "bg-amber-100 text-amber-600",
    cyan:    "bg-sky-100 text-sky-600",
    orange:  "bg-orange-100 text-orange-600",
    emerald: "bg-emerald-100 text-emerald-600",
  };
  const accentBar: Record<string, string> = {
    violet:  "bg-violet-500",
    amber:   "bg-amber-500",
    cyan:    "bg-sky-500",
    orange:  "bg-orange-500",
    emerald: "bg-emerald-500",
  };

  return (
    <div className="min-h-screen pt-14 bg-slate-50">

      {/* ── PAGE HERO ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

            {/* Left: greeting */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{greeting()}</p>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Operations Dashboard</h1>
              <p className="text-slate-500 text-sm mt-0.5">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
            </div>

            {/* Right: revenue + actions — stacks cleanly on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Revenue spotlight */}
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 sm:py-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-0.5">Closed Revenue</p>
                  <p className="text-lg font-black text-white leading-none">{formatMoney(totalRevenue)}</p>
                </div>
              </div>

              {/* Action buttons — full-width on mobile, auto on sm+ */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                <Link href="/admin/schedule" data-testid="link-schedule">
                  <div className="flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-colors shadow-sm shadow-violet-900/30 w-full">
                    <Calendar className="w-4 h-4" /> Schedule
                  </div>
                </Link>
                <button onClick={handleClearAll} disabled={clearAllMutation.isPending}
                  data-testid="button-clear-all-data"
                  className="flex items-center justify-center gap-2 px-3 py-3 sm:py-2.5 rounded-xl border border-red-900/60 bg-red-950/40 text-red-400 font-bold text-sm hover:bg-red-900/30 transition-colors disabled:opacity-50"
                  title="Clear all test data">
                  <Trash2 className="w-4 h-4" />
                  {clearAllMutation.isPending ? "Clearing…" : "Clear Data"}
                </button>
              </div>
            </div>
          </div>

          {/* Stat strip — horizontal scroll on mobile, grid on larger screens */}
          <div className="flex sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible scrollbar-none">
            {statCards.map((card, i) => (
              <motion.div key={card.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`relative rounded-xl px-4 py-3.5 border transition-all min-w-[150px] sm:min-w-0 shrink-0 sm:shrink ${
                  card.urgent && card.value > 0
                    ? "bg-orange-500/10 border-orange-500/20"
                    : "bg-white/5 border-white/8 hover:bg-white/8"
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentIconBg[card.accent]}`}>
                    <card.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-2xl font-black tracking-tight ${
                    card.urgent && card.value > 0 ? "text-orange-300" :
                    card.value > 0 ? "text-white" : "text-slate-600"
                  }`}>{card.value}</span>
                </div>
                <p className="text-xs font-semibold text-slate-400 leading-snug">{card.label}</p>
                <div className={`mt-2 h-[2px] rounded-full ${card.value > 0 ? accentBar[card.accent] : "bg-white/8"}`} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">

        {/* Action required banner */}
        {urgentCount > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800">
                {urgentCount} item{urgentCount !== 1 ? "s" : ""} need your attention
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {newQuotes.length > 0 && `${newQuotes.length} new request${newQuotes.length > 1 ? "s" : ""}`}
                {newQuotes.length > 0 && awaitingPayment.length > 0 && " · "}
                {awaitingPayment.length > 0 && `${awaitingPayment.length} awaiting final payment`}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-500 shrink-0" />
          </motion.div>
        )}

        {/* Section grid */}
        <div className="grid md:grid-cols-2 gap-5 mt-6">
          <SectionPanel
            title="New Quote Requests"
            icon={ClipboardList}
            accentColor="violet"
            quotes={newQuotes}
            emptyMsg="No new requests — all clear"
            urgent
          />
          <SectionPanel
            title="Awaiting Deposit"
            icon={DollarSign}
            accentColor="amber"
            quotes={awaitingDeposit}
            emptyMsg="No outstanding deposits"
          />
          <SectionPanel
            title="Upcoming Confirmed Bookings"
            icon={CalendarCheck}
            accentColor="cyan"
            quotes={upcomingBooked}
            emptyMsg="No upcoming bookings"
            showDate
            bookedStyle
          />
          <SectionPanel
            title="Active / In Progress"
            icon={Zap}
            accentColor="orange"
            quotes={activeJobs}
            emptyMsg="No active jobs right now"
            urgent
          />
          <div className="md:col-span-2">
            <SectionPanel
              title="Awaiting Final Payment"
              icon={AlertCircle}
              accentColor="emerald"
              quotes={awaitingPayment.concat(recentlyClosed)}
              emptyMsg="No jobs awaiting payment"
            />
          </div>
        </div>

        {/* Quick-nav footer */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { href: "/admin/schedule", label: "Manage Schedule", icon: Calendar, desc: "Block dates & confirm bookings" },
            { href: "/admin/staff",    label: "Staff & HR",      icon: Users,    desc: "Payroll, leave & amendments" },
            { href: "/admin/export",   label: "Export PDF",      icon: ArrowUpRight, desc: "Generate client reports" },
          ].map(({ href, label, icon: Icon, desc }) => (
            <Link key={href} href={href}>
              <div className="group flex items-center gap-3.5 bg-white border border-slate-200 rounded-2xl p-4 hover:border-violet-300 hover:shadow-sm transition-all cursor-pointer">
                <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-violet-100 flex items-center justify-center transition-colors shrink-0">
                  <Icon className="w-4 h-4 text-slate-500 group-hover:text-violet-600 transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-800 group-hover:text-violet-700 transition-colors">{label}</p>
                  <p className="text-xs text-slate-400 truncate">{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-400 ml-auto shrink-0 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
