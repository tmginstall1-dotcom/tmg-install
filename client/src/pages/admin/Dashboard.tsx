import { useQuotes, useUpdateQuoteStatus } from "@/hooks/use-quotes";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import {
  ClipboardList, DollarSign, CalendarCheck,
  Zap, CheckCircle2, Calendar, TrendingUp, AlertCircle, Trash2, UserPlus,
  ChevronRight, Clock, Users, ArrowRight, BarChart2, Search, X, Loader2
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

function SearchResultRow({ quote }: { quote: any }) {
  const [, navigate] = useLocation();
  return (
    <div 
      onClick={() => navigate(`/admin/quotes/${quote.id}`)}
      data-testid={`search-result-${quote.id}`}
      className="group flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 cursor-pointer border-b border-zinc-100 last:border-0 transition-colors"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${avatarBg(quote.id)}`}>
        {initials(quote.customer?.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-medium text-sm text-zinc-900 truncate leading-tight">
            {quote.customer?.name || "Unknown"}
          </p>
          <StatusBadge status={quote.status} />
        </div>
        <p className="text-xs text-zinc-500 truncate">
          {quote.referenceNo} · {quote.serviceAddress || "No address"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-zinc-900 tabular-nums">{formatMoney(quote.total)}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{format(new Date(quote.createdAt), "d MMM")}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0 group-hover:text-blue-600 transition-colors" />
    </div>
  );
}

function SectionPanel({
  title, quotes, emptyMsg, showDate, urgent = false, bookedStyle = false,
}: {
  title: string;
  quotes: any[]; emptyMsg: string; showDate?: boolean; urgent?: boolean; bookedStyle?: boolean;
}) {
  const [, navigate] = useLocation();

  return (
    <div className={`bg-white border ${urgent && quotes.length > 0 ? 'border-orange-300' : 'border-zinc-200'} rounded-xl overflow-hidden`}>
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {quotes.length > 0 && (
          <Link href="/admin/schedule">
            <span className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer">View all</span>
          </Link>
        )}
      </div>
      {quotes.length === 0 ? (
        <div className="py-16 text-center">
          <CheckCircle2 className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-500">{emptyMsg}</p>
          <p className="text-xs text-zinc-400 mt-1">All caught up</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-fixed w-full min-w-[600px]">
            <thead>
              <tr>
                <th className="w-12 px-4 py-3 bg-zinc-50 border-b border-zinc-200"></th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Customer</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Address</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Amount</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Status</th>
                {showDate && <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">Date</th>}
                <th className="w-10 px-4 py-3 bg-zinc-50 border-b border-zinc-200"></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map(quote => {
                const slotDate = quote.scheduledAt
                  ? format(new Date(quote.scheduledAt), "d MMM")
                  : quote.preferredDate
                    ? format(new Date(quote.preferredDate + "T12:00:00"), "d MMM")
                    : format(new Date(quote.createdAt), "d MMM");

                return (
                  <tr key={quote.id} onClick={() => navigate(`/admin/quotes/${quote.id}`)} className="group cursor-pointer hover:bg-zinc-50 transition-colors">
                    <td className="px-4 py-3 border-b border-zinc-100">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${avatarBg(quote.id)}`}>
                        {initials(quote.customer?.name)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 font-medium border-b border-zinc-100 truncate max-w-[150px]">
                      {quote.customer?.name || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 border-b border-zinc-100 truncate max-w-[200px]">
                      {quote.serviceAddress || "No address"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 font-semibold tabular-nums text-right border-b border-zinc-100">
                      {formatMoney(quote.total)}
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-zinc-100">
                      <StatusBadge status={quote.status} />
                    </td>
                    {showDate && (
                      <td className="px-4 py-3 text-sm text-zinc-700 border-b border-zinc-100 whitespace-nowrap tabular-nums">
                        {slotDate}
                      </td>
                    )}
                    <td className="px-4 py-3 border-b border-zinc-100 text-right">
                      <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-blue-600 inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
  const recentlyClosed  = quotes.filter((q: any) => ["closed", "final_paid"].includes(q.status)).slice(0, 4);

  const totalRevenue = quotes
    .filter((q: any) => ["closed", "final_paid"].includes(q.status))
    .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

  const pipelineValue = quotes
    .filter((q: any) => !["closed", "cancelled", "final_paid"].includes(q.status))
    .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

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
      <div className="min-h-screen pt-14 pb-16 lg:pl-56 bg-[#F5F5F7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin border-2 border-zinc-200 border-t-zinc-700 rounded-full" />
          <p className="text-sm font-medium">Loading Dashboard…</p>
        </div>
      </div>
    );
  }

  const isSearching = search.trim().length > 0;

  const statCards = [
    { label: "New Requests", value: newQuotes.length, icon: ClipboardList, urgent: newQuotes.length > 0 },
    { label: "Awaiting Deposit", value: awaitingDeposit.length, icon: DollarSign, urgent: false },
    { label: "Booked Jobs", value: upcomingBooked.length, icon: CalendarCheck, urgent: false },
    { label: "Active Jobs", value: activeJobs.length, icon: Zap, urgent: false },
    { label: "Payment Due", value: awaitingPayment.length, icon: AlertCircle, urgent: awaitingPayment.length > 0 },
  ];

  return (
    <div className="min-h-screen pt-14 pb-16 lg:pl-56 bg-[#F5F5F7] overflow-x-hidden">
      {/* Page Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-400 mb-1">Operations → Dashboard</p>
            <h1 className="text-xl font-semibold text-zinc-900">Good {greeting()}</h1>
            <p className="text-sm text-zinc-500 mt-1">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
          </div>
          <div className="flex gap-6 sm:text-right">
            <div>
              <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Collected</p>
              <p className="text-2xl font-bold text-zinc-900 tabular-nums leading-none">{formatMoney(totalRevenue)}</p>
            </div>
            <div className="pl-6 border-l border-zinc-200">
              <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider font-semibold">Pipeline</p>
              <p className="text-2xl font-bold text-blue-600 tabular-nums leading-none">{formatMoney(pipelineValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Search */}
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, ref, address, phone…"
            data-testid="input-quote-search"
            className="h-9 w-full pl-9 pr-10 border border-zinc-300 rounded-lg text-sm bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
          />
          {isSearching && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1 rounded-md"
              data-testid="button-clear-search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isSearching ? (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Search Results</h2>
              <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap bg-blue-100 text-blue-700">
                {searchResults.length}
              </span>
            </div>
            {searchResults.length > 0 ? (
              <div className="divide-y divide-zinc-100">
                {searchResults.map((q: any) => (
                  <SearchResultRow key={q.id} quote={q} />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <Search className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-zinc-500">No quotes found for "{search}"</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className={`bg-white border ${card.urgent && card.value > 0 ? 'border-orange-300 bg-orange-50/30' : 'border-zinc-200'} rounded-xl p-5 shadow-sm`}>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-5 h-5 ${card.urgent && card.value > 0 ? 'text-orange-500' : 'text-zinc-400'}`} />
                    </div>
                    <div className={`text-2xl font-bold tabular-nums ${card.urgent && card.value > 0 ? 'text-orange-600' : 'text-zinc-900'}`}>
                      {card.value}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 font-medium">{card.label}</div>
                  </div>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { href: "/admin/schedule", label: "Schedule", icon: Calendar },
                { href: "/admin/staff", label: "Staff & HR", icon: Users },
                { href: "/admin/analytics", label: "Analytics", icon: BarChart2 },
                { href: "/admin/export", label: "Export", icon: TrendingUp },
              ].map(action => (
                <Link key={action.href} href={action.href}>
                  <div className="inline-flex items-center justify-center gap-2 h-9 w-full px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors cursor-pointer shadow-sm">
                    <action.icon className="w-4 h-4 text-zinc-400" />
                    {action.label}
                  </div>
                </Link>
              ))}
            </div>

            {/* Main Sections */}
            <div className="space-y-6">
              <SectionPanel
                title="Recent Requests & Action Required"
                quotes={[...newQuotes, ...awaitingPayment]}
                emptyMsg="No pending requests"
                showDate
                urgent
              />
              <SectionPanel
                title="Upcoming Bookings"
                quotes={upcomingBooked}
                emptyMsg="No upcoming bookings"
                showDate
                bookedStyle
              />
              <SectionPanel
                title="Active / In Progress"
                quotes={activeJobs}
                emptyMsg="No active jobs right now"
              />
              <SectionPanel
                title="Awaiting Deposit"
                quotes={awaitingDeposit}
                emptyMsg="No outstanding deposits"
              />
            </div>

            {/* Danger zone */}
            <div className="pt-8">
              {!showClearConfirm ? (
                <button onClick={() => setShowClearConfirm(true)}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-colors"
                  data-testid="button-clear-all-data">
                  <Trash2 className="w-4 h-4" />
                  Clear all job data
                </button>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-white border border-red-200 rounded-xl shadow-sm">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <p className="text-sm text-zinc-900 font-medium flex-1">Delete ALL quotes & data permanently?</p>
                  <button onClick={() => clearAllMutation.mutate()} disabled={clearAllMutation.isPending}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                    {clearAllMutation.isPending ? "Deleting..." : "Yes, Delete Everything"}
                  </button>
                  <button onClick={() => setShowClearConfirm(false)}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  );
}
