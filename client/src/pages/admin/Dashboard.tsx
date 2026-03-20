import { useQuotes, useUpdateQuoteStatus } from "@/hooks/use-quotes";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import {
  ClipboardList, DollarSign, CalendarCheck,
  Zap, CheckCircle2, Calendar, TrendingUp, AlertCircle, Trash2, UserPlus,
  ChevronRight, Clock, Users, ArrowRight, BarChart2, Search, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

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
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${avatarBg(quote.id)}`}>
          {initials(quote.customer?.name)}
        </div>
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="font-bold text-sm text-slate-800 truncate leading-tight">
            {quote.customer?.name || "Unknown"}
          </p>
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {quote.serviceAddress || "No address"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black text-slate-900 tabular-nums">{formatMoney(quote.total)}</p>
          <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
            {showDate && slotDate ? slotDate : format(new Date(quote.createdAt), "d MMM")}
          </p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 group-hover:text-violet-500 transition-colors" />
      </div>
    </Link>
  );
}

// ─── Search result row ─────────────────────────────────────────────────────

function SearchResultRow({ quote }: { quote: any }) {
  return (
    <Link href={`/admin/quotes/${quote.id}`} data-testid={`search-result-${quote.id}`}
      className="block w-full">
      <div className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 active:bg-slate-100 transition-colors border-b border-slate-100 last:border-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${avatarBg(quote.id)}`}>
          {initials(quote.customer?.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-bold text-sm text-slate-800 truncate leading-tight">
              {quote.customer?.name || "Unknown"}
            </p>
            <StatusBadge status={quote.status} />
          </div>
          <p className="text-xs text-slate-400 truncate">
            {quote.referenceNo} · {quote.serviceAddress || "No address"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black text-slate-900 tabular-nums">{formatMoney(quote.total)}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{format(new Date(quote.createdAt), "d MMM")}</p>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0 group-hover:text-violet-500 transition-colors" />
      </div>
    </Link>
  );
}

// ─── Booked quote row with quick-assign ──────────────────────────────────────

function BookedQuoteRow({ quote }: { quote: any }) {
  const { toast } = useToast();
  const { data: staffList } = useQuery<any[]>({ queryKey: ["/api/staff"], refetchInterval: 30_000 });
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
            ? <span className="shrink-0 text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-1">ASSIGNED</span>
            : <span className="shrink-0 text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-1">UNASSIGNED</span>
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
                className="flex-1 min-w-0 text-sm border border-black/10 px-3 py-2.5 bg-white outline-none focus:border-black"
                data-testid={`select-quick-staff-${quote.id}`}>
                <option value="">Select staff…</option>
                {staffList?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button onClick={handleAssign} disabled={!selectedStaff || updateStatus.isPending}
                className="text-[10px] font-black bg-black text-white uppercase tracking-[0.1em] px-4 py-2.5 disabled:opacity-50 shrink-0 hover:bg-neutral-800 transition-colors"
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

const ACCENT: Record<string, { dot: string; badge: string }> = {
  violet:  { dot: "bg-violet-500",  badge: "bg-violet-600 text-white" },
  amber:   { dot: "bg-amber-500",   badge: "bg-amber-500 text-white" },
  cyan:    { dot: "bg-cyan-500",    badge: "bg-cyan-600 text-white" },
  orange:  { dot: "bg-orange-500",  badge: "bg-orange-500 text-white" },
  emerald: { dot: "bg-emerald-500", badge: "bg-emerald-600 text-white" },
};

function SectionPanel({
  title, accentColor, quotes, emptyMsg, showDate, urgent = false, bookedStyle = false,
}: {
  title: string; accentColor: string;
  quotes: any[]; emptyMsg: string; showDate?: boolean; urgent?: boolean; bookedStyle?: boolean;
}) {
  const ac = ACCENT[accentColor] || ACCENT.violet;

  return (
    <div className={`w-full bg-white rounded-xl overflow-hidden shadow-sm ${
      urgent && quotes.length > 0 ? "border border-orange-200" : "border border-slate-200"
    }`}>
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${ac.dot}`} />
          <h2 className="font-black text-[11px] text-slate-700 uppercase tracking-[0.12em]">{title}</h2>
        </div>
        <span className={`min-w-[22px] h-[22px] px-1.5 rounded-md flex items-center justify-center text-xs font-black ${
          quotes.length > 0 ? ac.badge : "bg-slate-100 text-slate-400"
        }`}>
          {quotes.length}
        </span>
      </div>
      <div className="overflow-hidden divide-y divide-slate-50">
        {quotes.map((q: any) => bookedStyle
          ? <BookedQuoteRow key={q.id} quote={q} />
          : <QuoteRow key={q.id} quote={q} showDate={showDate} />
        )}
        {quotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-300">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
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
  const [search, setSearch] = useState("");

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/clear-all-data`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to clear");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setShowClearConfirm(false);
    },
  });

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

  const pipelineValue = quotes
    .filter((q: any) => !["closed", "cancelled", "final_paid"].includes(q.status))
    .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

  const urgentCount = newQuotes.length + awaitingPayment.length;

  // Search logic — must be before any early return
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase().trim();
    return (quotes as any[]).filter((quote: any) =>
      quote.customer?.name?.toLowerCase().includes(q) ||
      quote.referenceNo?.toLowerCase().includes(q) ||
      quote.serviceAddress?.toLowerCase().includes(q) ||
      quote.customer?.phone?.toLowerCase().includes(q) ||
      quote.customer?.email?.toLowerCase().includes(q) ||
      quote.pickupAddress?.toLowerCase().includes(q)
    );
  }, [quotes, search]);

  if (isLoading) {
    return (
      <div className="min-h-screen pt-14 lg:pl-56 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-violet-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  const isSearching = search.trim().length > 0;

  const statCards = [
    { label: "New",         value: newQuotes.length,       icon: ClipboardList, accent: "violet",  urgent: newQuotes.length > 0 },
    { label: "Deposit",     value: awaitingDeposit.length, icon: DollarSign,    accent: "amber",   urgent: false },
    { label: "Bookings",    value: upcomingBooked.length,  icon: CalendarCheck, accent: "cyan",    urgent: false },
    { label: "Live",        value: activeJobs.length,      icon: Zap,           accent: "orange",  urgent: false },
    { label: "Payment Due", value: awaitingPayment.length, icon: AlertCircle,   accent: "emerald", urgent: awaitingPayment.length > 0 },
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
    <div className="min-h-screen pt-14 lg:pl-56 bg-slate-50 pb-24 overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <div className="bg-slate-950 text-white">
        <div className="px-4 sm:px-6 max-w-6xl mx-auto py-5">

          {/* Top row: greeting + revenue + pipeline */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em] mb-1.5">Good {greeting()}</p>
              <h1 className="font-heading font-black text-white uppercase tracking-[-0.02em] text-2xl sm:text-3xl leading-none">Operations</h1>
              <p className="text-slate-500 text-xs mt-1.5">{format(new Date(), "EEE, d MMM yyyy")}</p>
            </div>
            <div className="shrink-0 flex gap-4 sm:gap-6 text-right">
              <div>
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.18em] mb-0.5">Collected</p>
                <p className="text-xl sm:text-2xl font-black text-white leading-none tabular-nums">{formatMoney(totalRevenue)}</p>
              </div>
              <div className="pl-4 sm:pl-6 border-l border-white/10">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-[0.18em] mb-0.5">Pipeline</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-400 leading-none tabular-nums">{formatMoney(pipelineValue)}</p>
              </div>
            </div>
          </div>

          {/* Stat grid — 5-col */}
          <div className="grid grid-cols-5 gap-2 mt-4">
            {statCards.map((card) => (
              <div key={card.label}
                className={`rounded-xl px-2 py-3 sm:px-3 flex flex-col items-center gap-1 ${
                  card.urgent && card.value > 0
                    ? "bg-orange-500/20 border border-orange-500/30"
                    : "bg-white/[0.07] border border-white/10"
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentIconBg[card.accent]}`}>
                  <card.icon className="w-3.5 h-3.5" />
                </div>
                <span className={`text-2xl font-black tabular-nums leading-none ${
                  card.urgent && card.value > 0 ? "text-orange-300" :
                  card.value > 0 ? "text-white" : "text-slate-600"
                }`}>{card.value}</span>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide leading-tight text-center truncate w-full">{card.label}</p>
              </div>
            ))}
          </div>

          {/* Search bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, ref, address, phone…"
              data-testid="input-quote-search"
              className="w-full pl-11 pr-10 py-3 bg-white/[0.08] border border-white/15 text-white placeholder:text-slate-500 text-sm outline-none focus:border-white/40 focus:bg-white/[0.12] transition-all rounded-xl"
              style={{ fontSize: 16 }}
            />
            {isSearching && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                data-testid="button-clear-search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* ── SEARCH RESULTS ─ */}
        {isSearching && (
          <div className="mt-5">
            <div className="bg-white border border-black/[0.08] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/[0.06]">
                <div className="flex items-center gap-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <h2 className="font-black text-[11px] text-slate-800 uppercase tracking-[0.12em]">
                    Search Results
                  </h2>
                </div>
                <span className={`min-w-[22px] h-[22px] px-1.5 flex items-center justify-center text-xs font-black ${
                  searchResults.length > 0 ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400"
                }`}>
                  {searchResults.length}
                </span>
              </div>
              {searchResults.length > 0 ? (
                <div>
                  {searchResults.map((q: any) => (
                    <SearchResultRow key={q.id} quote={q} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-300">
                  <Search className="w-6 h-6" />
                  <p className="text-xs font-medium">No quotes found for "{search}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NORMAL DASHBOARD ─ shown when not searching */}
        {!isSearching && (
          <>
            {/* Attention banner */}
            {urgentCount > 0 && (
              <div className="mt-5 flex items-center gap-3 bg-amber-50 border-l-4 border-amber-500 border-t border-r border-b border-amber-200 px-4 py-3">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-amber-800 uppercase tracking-[0.1em] truncate">
                    {urgentCount} item{urgentCount !== 1 ? "s" : ""} need attention
                  </p>
                  <p className="text-xs text-amber-600 truncate mt-0.5">
                    {[
                      newQuotes.length > 0 && `${newQuotes.length} new`,
                      awaitingPayment.length > 0 && `${awaitingPayment.length} awaiting payment`,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
              </div>
            )}

            {/* Section grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
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

            {/* Quick-nav cards — 2×2 on mobile (sidebar hidden), hidden on desktop */}
            <div className="mt-6 lg:hidden grid grid-cols-2 gap-3">
              {[
                { href: "/admin/schedule",  label: "Schedule",   icon: Calendar,   desc: "Bookings & jobs",    color: "bg-sky-50 border-sky-200 text-sky-700" },
                { href: "/admin/staff",     label: "Staff & HR", icon: Users,      desc: "Payroll & leave",    color: "bg-violet-50 border-violet-200 text-violet-700" },
                { href: "/admin/analytics", label: "Analytics",  icon: BarChart2,  desc: "Traffic & stats",    color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                { href: "/admin/export",    label: "Export",     icon: TrendingUp, desc: "Download reports",   color: "bg-amber-50 border-amber-200 text-amber-700" },
              ].map(({ href, label, icon: Icon, desc, color }) => (
                <Link key={href} href={href} className="block w-full">
                  <div className={`group flex items-center gap-3 bg-white rounded-xl border p-4 hover:shadow-md active:scale-[0.98] transition-all h-full shadow-sm border-slate-200`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[13px] text-slate-800 leading-tight">{label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Danger zone */}
            <div className="mt-6 mb-2">
              {!showClearConfirm ? (
                <button onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 transition-colors text-[11px] font-black uppercase tracking-[0.1em]"
                  data-testid="button-clear-all-data">
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all job data
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200">
                  <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-700 font-semibold flex-1">Delete ALL quotes & data?</p>
                  <button onClick={() => clearAllMutation.mutate()} disabled={clearAllMutation.isPending}
                    className="text-xs font-black text-white bg-red-600 px-3 py-1.5 disabled:opacity-50">
                    {clearAllMutation.isPending ? "…" : "Delete"}
                  </button>
                  <button onClick={() => setShowClearConfirm(false)}
                    className="text-xs font-semibold text-slate-500">Cancel</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
