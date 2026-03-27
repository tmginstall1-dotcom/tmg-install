import { useQuotes } from "@/hooks/use-quotes";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format, isToday, isTomorrow, startOfDay, endOfDay } from "date-fns";
import { useState, useMemo } from "react";
import {
  ClipboardList, DollarSign, CalendarCheck, Zap, AlertCircle, Trash2,
  ChevronRight, Search, X, Loader2, TrendingUp, BellRing,
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
  const raw = quote.scheduledAt || quote.preferredDate;
  if (!raw) return format(new Date(quote.createdAt), "d MMM");
  const d = quote.scheduledAt ? new Date(quote.scheduledAt) : new Date(raw + "T12:00:00");
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "d MMM");
}

function QuoteRow({ quote, compact = false }: { quote: any; compact?: boolean }) {
  const [, navigate] = useLocation();
  return (
    <div
      onClick={() => navigate(`/admin/quotes/${quote.id}`)}
      data-testid={`quote-row-${quote.id}`}
      className="group flex items-center gap-3 px-4 py-3 hover:bg-zinc-50/80 cursor-pointer border-b border-zinc-100 last:border-0 transition-colors"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarBg(quote.id)}`}>
        {initials(quote.customer?.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-zinc-900 truncate leading-tight">
            {quote.customer?.name || "Unknown"}
          </p>
          <StatusBadge status={quote.status} />
        </div>
        {!compact && (
          <p className="text-xs text-zinc-400 truncate mt-0.5">
            {quote.referenceNo} · {quote.serviceAddress || "No address"}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right flex items-center gap-3">
        <div>
          <p className="text-sm font-bold text-zinc-900 tabular-nums leading-tight">{formatMoney(quote.total)}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">{dateLabel(quote)}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-blue-500 transition-colors shrink-0" />
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
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
      <div
        className={`flex items-center justify-between px-4 py-3.5 border-b border-zinc-100 ${collapsible ? "cursor-pointer hover:bg-zinc-50/50" : ""}`}
        onClick={collapsible ? () => setExpanded(v => !v) : undefined}
      >
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
          {badge != null && badge > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold ${
              badgeUrgent ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
            }`}>
              {badge}
            </span>
          )}
        </div>
        {quotes.length > 0 && (
          <Link href="/admin/schedule" onClick={e => e.stopPropagation()}>
            <span className="text-xs font-medium text-blue-600 hover:text-blue-700">View all</span>
          </Link>
        )}
      </div>

      {expanded && (
        quotes.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-2 text-zinc-400">
            <EmptyIcon className="w-8 h-8 text-zinc-300" />
            <p className="text-sm font-medium">{emptyMsg}</p>
          </div>
        ) : (
          <div>
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
  const recentlyClosed  = quotes.filter((q: any) => ["closed", "final_paid"].includes(q.status)).slice(0, 5);

  const todayJobs = useMemo(() => {
    return (quotes as any[]).filter((q: any) => {
      if (!["booked", "assigned", "in_progress"].includes(q.status)) return false;
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
      <div className="bg-white border-b border-zinc-200 px-5 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-400 font-medium tabular-nums">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
              <h1 className="text-lg font-bold text-zinc-900 mt-0.5 leading-tight">{greeting()}</h1>
            </div>
            <div className="flex items-center gap-5 pt-0.5">
              <div className="text-right">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Collected</p>
                <p className="text-xl font-bold text-zinc-900 tabular-nums leading-none">{formatMoney(totalRevenue)}</p>
              </div>
              <div className="w-px h-10 bg-zinc-200" />
              <div className="text-right">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Pipeline</p>
                <p className="text-xl font-bold text-blue-600 tabular-nums leading-none">{formatMoney(pipelineValue)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-5 py-5 space-y-4">

        {/* Urgent alert banner */}
        {urgentCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
            <BellRing className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm font-semibold text-red-700 flex-1">
              {urgentCount} item{urgentCount > 1 ? "s" : ""} need{urgentCount === 1 ? "s" : ""} your attention
              {newQuotes.length > 0 && ` · ${newQuotes.length} new request${newQuotes.length > 1 ? "s" : ""}`}
              {awaitingPayment.length > 0 && ` · ${awaitingPayment.length} awaiting final payment`}
            </p>
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "New Requests",    value: newQuotes.length,       icon: ClipboardList, urgent: newQuotes.length > 0,       color: newQuotes.length > 0 ? "text-red-600" : "text-zinc-900" },
            { label: "Awaiting Deposit",value: awaitingDeposit.length, icon: DollarSign,    urgent: false,                      color: "text-zinc-900" },
            { label: "Today's Jobs",    value: todayJobs.length,       icon: CalendarCheck, urgent: false,                      color: todayJobs.length > 0 ? "text-blue-600" : "text-zinc-900" },
            { label: "Active Jobs",     value: activeJobs.length,      icon: Zap,           urgent: false,                      color: activeJobs.length > 0 ? "text-emerald-600" : "text-zinc-900" },
            { label: "Payment Due",     value: awaitingPayment.length, icon: AlertCircle,   urgent: awaitingPayment.length > 0, color: awaitingPayment.length > 0 ? "text-orange-600" : "text-zinc-900" },
          ].map((card, idx) => {
            const Icon = card.icon;
            const isOrphan = idx === 4 && true;
            return (
              <div
                key={card.label}
                className={`bg-white border rounded-2xl px-4 py-3.5 shadow-sm flex flex-col gap-2 ${
                  card.urgent && card.value > 0 ? "border-red-200 bg-red-50/40" : "border-zinc-200"
                } ${isOrphan ? "col-span-2 sm:col-span-1" : ""}`}
              >
                <Icon className={`w-4 h-4 ${card.urgent && card.value > 0 ? "text-red-400" : "text-zinc-400"}`} />
                <div>
                  <div className={`text-2xl font-bold tabular-nums leading-none ${card.color}`}>{card.value}</div>
                  <div className="text-[11px] text-zinc-500 font-medium mt-1">{card.label}</div>
                </div>
              </div>
            );
          })}
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
    </div>
  );
}
