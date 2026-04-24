import { useQuotes } from "@/hooks/use-quotes";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CreateJobModal } from "@/components/admin/CreateJobModal";
import { PhoneCallIntakeModal } from "@/components/admin/PhoneCallIntakeModal";
import { format, isToday, isTomorrow, startOfWeek, subWeeks } from "date-fns";
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  ClipboardList, DollarSign, CalendarCheck, Zap, AlertCircle, Trash2,
  ChevronRight, Search, X, Loader2, TrendingUp, BellRing, Plus,
  Phone as PhoneIcon,
} from "lucide-react";

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
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function dateLabel(quote: any): string {
  if (quote.scheduledAt) {
    const d = new Date(quote.scheduledAt);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    return format(d, "d MMM");
  }
  if (quote.preferredDate) {
    if (quote.preferredDate.toLowerCase() === "flexible") {
      const tw = quote.preferredTimeWindow;
      if (tw === "13:00-17:00") return "Flexible · Afternoon";
      if (tw === "09:00-12:00") return "Flexible · Morning";
      return "Flexible";
    }
    try {
      const d = new Date(quote.preferredDate + "T12:00:00");
      if (isNaN(d.getTime())) return quote.preferredDate;
      if (isToday(d)) return "Today";
      if (isTomorrow(d)) return "Tomorrow";
      return format(d, "d MMM");
    } catch { return quote.preferredDate; }
  }
  return format(new Date(quote.createdAt), "d MMM");
}

const CHANNEL_BADGE: Record<string, { label: string; cls: string }> = {
  web:      { label: "🌐 Web",     cls: "bg-blue-50 text-blue-600 border-blue-100" },
  whatsapp: { label: "💬 WA",      cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  phone:    { label: "📞 Call",    cls: "bg-purple-50 text-purple-700 border-purple-100" },
  ikea:     { label: "🛋 IKEA",    cls: "bg-orange-50 text-orange-700 border-orange-100" },
  referral: { label: "🤝 Ref",     cls: "bg-teal-50 text-teal-700 border-teal-100" },
  walk_in:  { label: "🚶 Walk-in", cls: "bg-zinc-50 text-zinc-500 border-zinc-200" },
  other:    { label: "⚡ Other",   cls: "bg-zinc-50 text-zinc-500 border-zinc-200" },
};

function ChannelBadge({ channel }: { channel?: string }) {
  const ch = channel || "web";
  const cfg = CHANNEL_BADGE[ch] || { label: ch, cls: "bg-zinc-50 text-zinc-500 border-zinc-200" };
  return (
    <span className={`inline-flex items-center h-5 px-1.5 rounded text-[10px] font-bold border tracking-wide shrink-0 ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function QuoteRow({ quote, compact = false }: { quote: any; compact?: boolean }) {
  const [, navigate] = useLocation();
  return (
    <div
      onClick={() => navigate(`/admin/quotes/${quote.id}`)}
      data-testid={`quote-row-${quote.id}`}
      className="group flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-all active:bg-slate-100"
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 shadow-sm ${avatarBg(quote.id)}`}>
        {initials(quote.customer?.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[15px] font-bold text-slate-900 truncate leading-tight">
            {quote.customer?.name || "Unknown"}
          </p>
          <StatusBadge status={quote.status} />
          <ChannelBadge channel={quote.sourceChannel} />
        </div>
        {!compact && (
          <p className="text-[13px] text-slate-500 truncate mt-1.5 font-medium">
            <span className="text-slate-400 font-mono tracking-tight mr-1.5">{quote.referenceNo}</span>
            {quote.serviceAddress || quote.pickupAddress || "No address"}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right flex items-center gap-4">
        <div>
          <p className="text-[15px] font-bold text-slate-900 tabular-nums leading-tight">{formatMoney(quote.total)}</p>
          <p className="text-[12px] text-slate-500 font-medium mt-1 tabular-nums">{dateLabel(quote)}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    </div>
  );
}

function Panel({
  title, badge, badgeUrgent = false, quotes, emptyMsg, emptyIcon: EmptyIcon = ClipboardList,
  collapsible = false,
}: {
  title: string;
  badge?: number;
  badgeUrgent?: boolean;
  quotes: any[];
  emptyMsg: string;
  emptyIcon?: any;
  collapsible?: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsible || (quotes.length > 0));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div
        className={`flex items-center justify-between px-5 py-4 border-b border-slate-100 ${collapsible ? "cursor-pointer hover:bg-slate-50/50 transition-colors" : "bg-slate-50/30"}`}
        onClick={collapsible ? () => setExpanded(v => !v) : undefined}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">{title}</h2>
          {badge != null && badge > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-[11px] font-black tracking-wide ${
              badgeUrgent ? "bg-red-100 text-red-700 ring-1 ring-red-200" : "bg-blue-100 text-blue-700 ring-1 ring-blue-200"
            }`}>
              {badge}
            </span>
          )}
        </div>
        {quotes.length > 0 && (
          <Link href="/admin/schedule" onClick={e => e.stopPropagation()}>
            <span className="text-[13px] font-bold text-blue-600 hover:text-blue-700 transition-colors">View all</span>
          </Link>
        )}
      </div>

      {expanded && (
        quotes.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
            <EmptyIcon className="w-10 h-10 text-slate-200" />
            <p className="text-[14px] font-semibold">{emptyMsg}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {quotes.map(q => <QuoteRow key={q.id} quote={q} />)}
          </div>
        )
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const { data: allQuotes, isLoading } = useQuotes();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [search, setSearch] = useState("");
  const [showNewJob, setShowNewJob] = useState(false);
  const [showPhoneCall, setShowPhoneCall] = useState(false);

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
    ["deposit_requested", "approved"].includes(q.status)
  );
  const upcomingBooked  = quotes.filter((q: any) => ["booked", "assigned", "deposit_paid"].includes(q.status));
  const activeJobs      = quotes.filter((q: any) => q.status === "in_progress");
  const awaitingPayment = quotes.filter((q: any) => ["completed", "final_payment_requested"].includes(q.status));
  const recentlyClosed  = quotes.filter((q: any) => ["closed", "final_paid"].includes(q.status)).slice(0, 5);

  const todayJobs = useMemo(() => {
    return (quotes as any[]).filter((q: any) => {
      if (!["booked", "assigned", "in_progress", "deposit_paid"].includes(q.status)) return false;
      const raw = q.scheduledAt || q.preferredDate;
      if (!raw) return false;
      const d = q.scheduledAt ? new Date(q.scheduledAt) : new Date(raw + "T12:00:00");
      return isToday(d);
    });
  }, [quotes]);

  const totalRevenue = quotes
    .filter((q: any) => ["closed", "final_paid"].includes(q.status))
    .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

  const pipelineValue = quotes
    .filter((q: any) => !["closed", "cancelled", "final_paid"].includes(q.status))
    .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

  const { data: subSummary } = useQuery<any>({
    queryKey: ["/api/admin/subcontracts/summary"],
  });
  const netProfit = totalRevenue - Number(subSummary?.totalSubCosts || 0);

  // Build 12-week revenue trend from closed/final_paid quotes
  const revenueChartData = useMemo(() => {
    const weeks: { week: string; revenue: number; jobs: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
      const weekQuotes = (quotes as any[]).filter(q => {
        if (!["closed", "final_paid"].includes(q.status)) return false;
        const d = new Date(q.createdAt);
        return d >= weekStart && d < weekEnd;
      });
      weeks.push({
        week: format(weekStart, "d MMM"),
        revenue: weekQuotes.reduce((s, q) => s + Number(q.total || 0), 0),
        jobs: weekQuotes.length,
      });
    }
    return weeks;
  }, [quotes]);

  const urgentCount = newQuotes.length + awaitingPayment.length;

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
      <div className="min-h-screen pt-14 pb-16 lg:pl-56 bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <p className="text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  const isSearching = search.trim().length > 0;

  return (
    <div className="min-h-screen pt-14 pb-20 lg:pb-6 lg:pl-56 bg-zinc-50 overflow-x-hidden">

      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6 shadow-sm relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <p className="text-[13px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">{greeting()}</h1>
            </div>
            <div className="flex items-center gap-4 sm:pt-0.5 flex-wrap">
              {/* Log Phone Call button — AI extracts a draft quote from call notes */}
              <button
                onClick={() => setShowPhoneCall(true)}
                data-testid="button-log-phone-call"
                title="AI will extract a draft quote from your call notes"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-colors shadow-sm"
              >
                <PhoneIcon className="w-4 h-4" />
                Log Phone Call
              </button>

              {/* Quick New Job button */}
              <button
                onClick={() => setShowNewJob(true)}
                data-testid="button-new-job"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-black hover:bg-zinc-800 text-white text-sm font-bold transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Job
              </button>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Collected</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums leading-none tracking-tight">{formatMoney(totalRevenue)}</p>
                </div>
                <div className="w-px h-12 bg-slate-200" />
                <div className="text-right">
                  <p className="text-[11px] font-bold text-blue-500/70 uppercase tracking-widest mb-1.5">Pipeline</p>
                  <p className="text-2xl font-black text-blue-600 tabular-nums leading-none tracking-tight">{formatMoney(pipelineValue)}</p>
                </div>
                {subSummary?.totalSubCosts > 0 && (
                  <>
                    <div className="w-px h-12 bg-slate-200" />
                    <div className="text-right" data-testid="stat-net-profit">
                      <p className="text-[11px] font-bold text-emerald-500/80 uppercase tracking-widest mb-1.5">Net Profit</p>
                      <p className={`text-2xl font-black tabular-nums leading-none tracking-tight ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatMoney(netProfit)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Urgent alert banner */}
        {urgentCount > 0 && (
          <div className="flex items-center gap-3.5 px-5 py-4 bg-red-50 border border-red-200 rounded-2xl shadow-sm">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-[15px] font-bold text-red-800 flex-1 tracking-tight">
              {urgentCount} item{urgentCount > 1 ? "s" : ""} need{urgentCount === 1 ? "s" : ""} your attention
              {newQuotes.length > 0 && <span className="font-medium text-red-600/80 ml-2">· {newQuotes.length} new request{newQuotes.length > 1 ? "s" : ""}</span>}
              {awaitingPayment.length > 0 && <span className="font-medium text-red-600/80 ml-2">· {awaitingPayment.length} awaiting final payment</span>}
            </p>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "New Requests",    value: newQuotes.length,       icon: ClipboardList, urgent: newQuotes.length > 0,       color: newQuotes.length > 0 ? "text-red-600" : "text-slate-900" },
            { label: "Awaiting Deposit",value: awaitingDeposit.length, icon: DollarSign,    urgent: false,                      color: "text-slate-900" },
            { label: "Today's Jobs",    value: todayJobs.length,       icon: CalendarCheck, urgent: false,                      color: todayJobs.length > 0 ? "text-blue-600" : "text-slate-900" },
            { label: "Active Jobs",     value: activeJobs.length,      icon: Zap,           urgent: false,                      color: activeJobs.length > 0 ? "text-emerald-600" : "text-slate-900" },
            { label: "Payment Due",     value: awaitingPayment.length, icon: AlertCircle,   urgent: awaitingPayment.length > 0, color: awaitingPayment.length > 0 ? "text-orange-600" : "text-slate-900" },
          ].map((card, idx) => {
            const Icon = card.icon;
            const isOrphan = idx === 4 && true;
            return (
              <div
                key={card.label}
                className={`bg-white border rounded-2xl px-5 py-4 shadow-sm flex flex-col gap-3 transition-shadow hover:shadow-md ${
                  card.urgent && card.value > 0 ? "border-red-200 bg-gradient-to-b from-red-50/50 to-white ring-1 ring-inset ring-red-500/10" : "border-slate-200"
                } ${isOrphan ? "col-span-2 sm:col-span-1" : ""}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.urgent && card.value > 0 ? "bg-red-100" : "bg-slate-100"}`}>
                  <Icon className={`w-4 h-4 ${card.urgent && card.value > 0 ? "text-red-600" : "text-slate-500"}`} />
                </div>
                <div>
                  <div className={`text-3xl font-black tabular-nums tracking-tight leading-none ${card.color}`}>{card.value}</div>
                  <div className="text-[12px] text-slate-500 font-bold mt-1.5">{card.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Revenue trend chart */}
        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-zinc-900">Revenue — Last 12 Weeks</h2>
            </div>
            <span className="text-xs font-bold text-emerald-600">{formatMoney(totalRevenue)} collected</span>
          </div>
          <div className="px-2 pt-3 pb-1">
            {revenueChartData.every(d => d.revenue === 0) ? (
              <div className="h-24 flex items-center justify-center text-xs text-zinc-400">No completed jobs yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={90}>
                <AreaChart data={revenueChartData} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.18}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 11, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8 }}
                    formatter={(v: any, name: string) => [
                      name === "revenue" ? `$${Number(v).toLocaleString()}` : v,
                      name === "revenue" ? "Revenue" : "Jobs",
                    ]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ref no, address, phone…"
            data-testid="input-quote-search"
            className="h-10 w-full pl-10 pr-10 border border-zinc-300 rounded-xl text-sm bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
          />
          {isSearching && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600"
              data-testid="button-clear-search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search results */}
        {isSearching ? (
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">Search Results</h2>
              <span className="text-xs font-semibold text-zinc-500">{searchResults.length} found</span>
            </div>
            {searchResults.length > 0 ? (
              <div>
                {searchResults.map((q: any) => <QuoteRow key={q.id} quote={q} />)}
              </div>
            ) : (
              <div className="py-14 flex flex-col items-center gap-2 text-zinc-400">
                <Search className="w-8 h-8 text-zinc-300" />
                <p className="text-sm font-medium">No results for "{search}"</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">

            {/* Action required */}
            {(newQuotes.length > 0 || awaitingPayment.length > 0) && (
              <Panel
                title="Action Required"
                badge={urgentCount}
                badgeUrgent
                quotes={[...newQuotes, ...awaitingPayment]}
                emptyMsg="Nothing needs attention"
                emptyIcon={ClipboardList}
              />
            )}

            {/* Today's schedule */}
            {todayJobs.length > 0 && (
              <Panel
                title="Today's Jobs"
                badge={todayJobs.length}
                quotes={todayJobs}
                emptyMsg="Nothing scheduled for today"
                emptyIcon={CalendarCheck}
              />
            )}

            {/* Active jobs */}
            {activeJobs.length > 0 && (
              <Panel
                title="Active / In Progress"
                badge={activeJobs.length}
                quotes={activeJobs}
                emptyMsg="No active jobs"
                emptyIcon={Zap}
              />
            )}

            {/* Upcoming booked */}
            <Panel
              title="Upcoming Bookings"
              badge={upcomingBooked.length}
              quotes={upcomingBooked}
              emptyMsg="No upcoming bookings"
              emptyIcon={CalendarCheck}
            />

            {/* Awaiting deposit */}
            <Panel
              title="Awaiting Deposit"
              badge={awaitingDeposit.length}
              quotes={awaitingDeposit}
              emptyMsg="No outstanding deposits"
              emptyIcon={DollarSign}
            />

            {/* Recently closed */}
            {recentlyClosed.length > 0 && (
              <Panel
                title="Recently Closed"
                badge={recentlyClosed.length}
                quotes={recentlyClosed}
                emptyMsg="No closed jobs"
                emptyIcon={TrendingUp}
                collapsible
              />
            )}

            {/* Danger zone */}
            <div className="pt-4 pb-2">
              {!showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
                  data-testid="button-clear-all-data"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all job data
                </button>
              ) : (
                <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-red-200 rounded-2xl shadow-sm">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <p className="text-sm text-zinc-900 font-semibold flex-1 min-w-0">Delete ALL quotes & data permanently?</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => clearAllMutation.mutate()}
                      disabled={clearAllMutation.isPending}
                      className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {clearAllMutation.isPending ? "Deleting…" : "Delete Everything"}
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="h-9 px-4 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>

      {/* Quick New Job modal */}
      <CreateJobModal open={showNewJob} onClose={() => setShowNewJob(false)} />
      <PhoneCallIntakeModal open={showPhoneCall} onClose={() => setShowPhoneCall(false)} />
    </div>
  );
}
