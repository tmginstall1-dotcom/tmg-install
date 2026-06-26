import { useQuotes } from "@/hooks/use-quotes";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CreateJobModal } from "@/components/admin/CreateJobModal";
import { PhoneCallIntakeModal } from "@/components/admin/PhoneCallIntakeModal";
import { format, isToday, isTomorrow, isYesterday, startOfWeek, subWeeks } from "date-fns";
import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  ClipboardList, DollarSign, CalendarCheck, Zap, AlertCircle, Trash2,
  ChevronRight, Search, X, TrendingUp, BellRing, Plus,
  Phone as PhoneIcon, FileText, Target, Wallet, TrendingDown, Clock,
  Bell, BellOff,
} from "lucide-react";
import { PageShell, PageHeader, PageBody, Card, SectionHeader, EmptyState, LoadingState, Button, Pill } from "@/components/admin/AdminUI";
import { useAdminPush } from "@/hooks/use-admin-push";
import { useToast } from "@/hooks/use-toast";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

function formatMoney(v: any) {
  return `$${Number(v || 0).toLocaleString("en-SG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function initials(name: string = "?") {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

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

const CHANNEL_LABEL: Record<string, string> = {
  web:      "Web",
  whatsapp: "WhatsApp",
  phone:    "Call",
  ikea:     "IKEA",
  referral: "Referral",
  walk_in:  "Walk-in",
  other:    "Other",
};

function ChannelBadge({ channel }: { channel?: string }) {
  const ch = channel || "web";
  return <Pill tone="outline">{CHANNEL_LABEL[ch] || ch}</Pill>;
}

function QuoteRow({ quote }: { quote: any }) {
  const [, navigate] = useLocation();
  return (
    <div
      onClick={() => navigate(`/admin/quotes/${quote.id}`)}
      data-testid={`quote-row-${quote.id}`}
      className="group flex items-center gap-4 px-4 sm:px-5 py-3.5 hover:bg-[#EBE9E2] cursor-pointer transition-colors"
    >
      <div className="w-9 h-9 flex items-center justify-center text-[11px] font-black shrink-0 bg-[#0A0A0A] text-white tracking-wider">
        {initials(quote.customer?.name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-black uppercase tracking-[0.06em] text-[#0A0A0A] truncate leading-tight">
            {quote.customer?.name || "Unknown"}
          </p>
          <StatusBadge status={quote.status} />
          <ChannelBadge channel={quote.sourceChannel} />
        </div>
        <p className="text-[11px] text-black/55 truncate mt-1 font-medium">
          <span className="text-[#0A0A0A]/65 font-mono tracking-tight mr-2">{quote.referenceNo}</span>
          {quote.serviceAddress || quote.pickupAddress || "No address"}
        </p>
      </div>
      <div className="shrink-0 text-right flex items-center gap-4">
        <div>
          <p className="text-[14px] font-black text-[#0A0A0A] tabular-nums leading-tight">{formatMoney(quote.total)}</p>
          <p className="text-[10px] text-black/55 font-bold uppercase tracking-[0.16em] mt-1 tabular-nums">{dateLabel(quote)}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-black/25 group-hover:text-[#0A0A0A] group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    </div>
  );
}

function Panel({
  title, badge, badgeUrgent = false, quotes, emptyMsg, emptyIcon: EmptyIcon = ClipboardList,
  collapsible = false, accentRed = false,
}: {
  title: string;
  badge?: number;
  badgeUrgent?: boolean;
  quotes: any[];
  emptyMsg: string;
  emptyIcon?: any;
  collapsible?: boolean;
  accentRed?: boolean;
}) {
  const [expanded, setExpanded] = useState(!collapsible || (quotes.length > 0));

  return (
    <Card className={accentRed ? "border-[#C1121F]" : ""}>
      <div
        className={`flex items-center justify-between px-4 sm:px-5 h-12 border-b ${accentRed ? "border-[#C1121F]/30 bg-[#FBEBEB]" : "border-black/10 bg-white"} ${collapsible ? "cursor-pointer hover:bg-[#EBE9E2] transition-colors" : ""}`}
        onClick={collapsible ? () => setExpanded(v => !v) : undefined}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className={`text-[11px] font-black uppercase tracking-[0.18em] truncate ${accentRed ? "text-[#C1121F]" : "text-[#0A0A0A]"}`}>{title}</h2>
          {badge != null && badge > 0 && (
            <span className={`inline-flex items-center h-5 px-1.5 text-[10px] font-black tabular-nums ${
              accentRed || badgeUrgent ? "bg-[#C1121F] text-white" : "bg-[#0A0A0A] text-white"
            }`}>
              {badge}
            </span>
          )}
        </div>
        {quotes.length > 0 && (
          <Link href="/admin/schedule" onClick={e => e.stopPropagation()}>
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]/65 hover:text-[#0A0A0A] transition-colors">View all →</span>
          </Link>
        )}
      </div>

      {expanded && (
        quotes.length === 0 ? (
          <EmptyState icon={EmptyIcon} title={emptyMsg} />
        ) : (
          <div className="divide-y divide-black/8">
            {quotes.map(q => <QuoteRow key={q.id} quote={q} />)}
          </div>
        )
      )}
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: allQuotes, isLoading, isError, isFetching, refetch } = useQuotes();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [search, setSearch] = useState("");
  const [showNewJob, setShowNewJob] = useState(false);
  const [showPhoneCall, setShowPhoneCall] = useState(false);

  // Web-push opt-in for this device. When `state === "default"` we show a
  // banner at the top of the dashboard so admins can turn alerts on with one
  // tap — otherwise the toggle is buried in Settings and easy to miss, which
  // is the root cause of "I'm not getting any alerts" reports. `dismissed`
  // hides the banner for this session only (sessionStorage), so a refresh
  // brings it back if alerts are still off.
  const { state: pushState, subscribe: subscribePush } = useAdminPush();
  const { toast } = useToast();
  const [pushBannerDismissed, setPushBannerDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("admin-push-banner-dismissed") === "1";
  });
  const dismissPushBanner = () => {
    sessionStorage.setItem("admin-push-banner-dismissed", "1");
    setPushBannerDismissed(true);
  };
  const handleEnablePush = async () => {
    const ok = await subscribePush();
    if (ok) {
      toast({
        title: "Alerts enabled on this device",
        description: "You'll get a push for every new booking and WhatsApp message.",
      });
    } else {
      toast({
        title: "Couldn't enable alerts",
        description: "Check your browser notification permission and try again.",
        variant: "destructive",
      });
    }
  };

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
  const upcomingBooked  = quotes.filter((q: any) => ["booked", "assigned", "deposit_paid", "booking_pending"].includes(q.status));
  const activeJobs      = quotes.filter((q: any) => ["in_progress", "at_pickup", "in_transit", "at_dropoff"].includes(q.status));
  const awaitingPayment = quotes.filter((q: any) => ["completed", "final_payment_requested"].includes(q.status));
  const recentlyClosed  = quotes.filter((q: any) => ["closed", "final_paid"].includes(q.status)).slice(0, 5);

  const todayJobs = useMemo(() => {
    return (quotes as any[]).filter((q: any) => {
      if (!["booked", "assigned", "in_progress", "at_pickup", "in_transit", "at_dropoff", "deposit_paid"].includes(q.status)) return false;
      const raw = q.scheduledAt || q.preferredDate;
      if (!raw) return false;
      const d = q.scheduledAt ? new Date(q.scheduledAt) : new Date(raw + "T12:00:00");
      return isToday(d);
    });
  }, [quotes]);

  const lateJobs = useMemo(() => {
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    return (quotes as any[]).filter((q: any) => {
      if (!["booked", "assigned", "deposit_paid", "at_pickup", "in_transit", "at_dropoff"].includes(q.status)) return false;
      const raw = q.scheduledAt || q.preferredDate;
      if (!raw) return false;
      const d = q.scheduledAt ? new Date(q.scheduledAt) : new Date(raw + "T12:00:00");
      return !isNaN(d.getTime()) && d < startOfToday;
    });
  }, [quotes]);

  const closedQuotes = quotes.filter((q: any) => ["closed", "final_paid"].includes(q.status));
  const totalRevenue = closedQuotes.reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

  const pipelineValue = quotes
    .filter((q: any) => !["closed", "cancelled", "final_paid"].includes(q.status))
    .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

  const todaysRevenue = useMemo(() => {
    return closedQuotes.reduce((sum: number, q: any) => {
      const raw = q.scheduledAt || q.preferredDate;
      if (!raw) return sum;
      const d = q.scheduledAt ? new Date(q.scheduledAt) : new Date(raw + "T12:00:00");
      return isToday(d) ? sum + Number(q.total || 0) : sum;
    }, 0);
  }, [closedQuotes]);

  const yesterdaysRevenue = useMemo(() => {
    return closedQuotes.reduce((sum: number, q: any) => {
      const raw = q.scheduledAt || q.preferredDate;
      if (!raw) return sum;
      const d = q.scheduledAt ? new Date(q.scheduledAt) : new Date(raw + "T12:00:00");
      return isYesterday(d) ? sum + Number(q.total || 0) : sum;
    }, 0);
  }, [closedQuotes]);

  const funnel = useMemo(() => {
    const live = (quotes as any[]).filter(q => q.status !== "cancelled");
    const submitted = live.length;
    const quoted = live.filter((q: any) => !["submitted"].includes(q.status)).length;
    const booked = live.filter((q: any) => ["booked", "assigned", "deposit_paid", "in_progress", "at_pickup", "in_transit", "at_dropoff", "completed", "final_payment_requested", "closed", "final_paid"].includes(q.status)).length;
    const paid = live.filter((q: any) => ["closed", "final_paid"].includes(q.status)).length;
    return { submitted, quoted, booked, paid };
  }, [quotes]);

  const winRate = funnel.submitted > 0 ? Math.round((funnel.paid / funnel.submitted) * 100) : 0;
  const avgJobSize = closedQuotes.length > 0 ? totalRevenue / closedQuotes.length : 0;

  const { data: subSummary } = useQuery<any>({
    queryKey: ["/api/admin/subcontracts/summary"],
  });

  type OutstandingInvoice = {
    id: number; referenceNo: string; customerName: string | null;
    companyName: string | null; poNumber: string | null; total: number;
    daysOutstanding: number; daysUntilDue: number; dueDate: string;
    bucket: "current" | "due_soon" | "overdue";
  };
  const { data: outstandingInvoices } = useQuery<{
    items: OutstandingInvoice[]; totalDue: number; overdueCount: number; count: number;
  }>({
    queryKey: ["/api/admin/commercial/outstanding-invoices"],
  });
  const netProfit = totalRevenue - Number(subSummary?.totalSubCosts || 0);

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
  const hasLate = lateJobs.length > 0;

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
      <PageShell>
        <LoadingState label="Loading dashboard" />
      </PageShell>
    );
  }

  // The full quote list can stall on a flaky connection. Rather than spin the
  // loading state forever, show a clear retry path once the query has given up.
  if (isError && !allQuotes) {
    return (
      <PageShell>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-6" data-testid="error-dashboard">
          <AlertCircle className="w-7 h-7 text-black/30" strokeWidth={1.5} />
          <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]">Couldn't load dashboard</p>
          <p className="text-[12px] text-black/55 font-medium max-w-xs">The connection timed out. Check your internet and try again.</p>
          <Button onClick={() => refetch()} disabled={isFetching} data-testid="button-retry-dashboard">
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      </PageShell>
    );
  }

  const isSearching = search.trim().length > 0;

  // KPI strip data
  const kpis = [
    { label: "New Requests",     value: newQuotes.length,       icon: ClipboardList, urgent: newQuotes.length > 0 },
    { label: "Awaiting Deposit", value: awaitingDeposit.length, icon: DollarSign,    urgent: false },
    { label: "Today's Jobs",     value: todayJobs.length,       icon: CalendarCheck, urgent: false },
    { label: "Active Jobs",      value: activeJobs.length,      icon: Zap,           urgent: false },
    { label: "Payment Due",      value: awaitingPayment.length, icon: AlertCircle,   urgent: awaitingPayment.length > 0 },
  ];

  return (
    <PageShell>
      {/* Page header — Yeezy editorial */}
      <PageHeader
        eyebrow={format(new Date(), "EEEE · d MMMM yyyy")}
        title={greeting()}
        subtitle="Operations dashboard — pipeline, performance and what needs attention right now."
        actions={
          <>
            <Button
              variant="outline"
              icon={PhoneIcon}
              onClick={() => setShowPhoneCall(true)}
              data-testid="button-log-phone-call"
              title="AI will extract a draft quote from your call notes"
            >
              Log Call
            </Button>
            <Button
              variant="ink"
              icon={Plus}
              onClick={() => setShowNewJob(true)}
              data-testid="button-new-job"
            >
              New Job
            </Button>
          </>
        }
        meta={
          <div className="flex flex-wrap items-end gap-6 sm:gap-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55 mb-1.5">Collected</p>
              <p className="text-[24px] sm:text-[28px] font-black text-[#0A0A0A] tabular-nums leading-none tracking-tight">{formatMoney(totalRevenue)}</p>
            </div>
            <div className="h-10 w-px bg-black/12" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55 mb-1.5">Pipeline</p>
              <p className="text-[24px] sm:text-[28px] font-black text-[#0A0A0A] tabular-nums leading-none tracking-tight">{formatMoney(pipelineValue)}</p>
            </div>
            {subSummary?.totalSubCosts > 0 && (
              <>
                <div className="h-10 w-px bg-black/12" />
                <div data-testid="stat-net-profit">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55 mb-1.5">Net Profit</p>
                  <p className={`text-[24px] sm:text-[28px] font-black tabular-nums leading-none tracking-tight ${netProfit >= 0 ? "text-[#0A0A0A]" : "text-[#C1121F]"}`}>
                    {formatMoney(netProfit)}
                  </p>
                </div>
              </>
            )}
          </div>
        }
      />

      <PageBody>

        {/* Push-alert opt-in — only shown when this device hasn't subscribed yet.
            Without this most admins never find the toggle in Settings and end
            up missing booking + WhatsApp alerts. */}
        {pushState === "default" && !pushBannerDismissed && (
          <div
            className="flex items-start sm:items-center gap-3 px-4 py-3 bg-[#0A0A0A] text-white border-b border-black"
            data-testid="banner-enable-push"
          >
            <Bell className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                Turn on booking alerts
              </p>
              <p className="text-[11px] text-white/70 mt-0.5">
                Get an instant push on this device for every new booking and WhatsApp message — even when the tab is closed.
              </p>
            </div>
            <button
              onClick={handleEnablePush}
              className="text-[11px] font-black uppercase tracking-[0.16em] bg-white text-black px-3 py-1.5 hover:bg-white/90 shrink-0"
              data-testid="button-enable-push"
            >
              Enable
            </button>
            <button
              onClick={dismissPushBanner}
              className="text-white/60 hover:text-white shrink-0"
              data-testid="button-dismiss-push-banner"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {pushState === "denied" && !pushBannerDismissed && (
          <div
            className="flex items-start sm:items-center gap-3 px-4 py-3 bg-[#C1121F] text-white border-b border-black"
            data-testid="banner-push-blocked"
          >
            <BellOff className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-[11px] font-black uppercase tracking-[0.16em] flex-1">
              Booking alerts are blocked in your browser. Open site settings and allow notifications, then reload this page.
            </p>
            <button
              onClick={dismissPushBanner}
              className="text-white/60 hover:text-white shrink-0"
              data-testid="button-dismiss-push-banner-blocked"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Urgent alert */}
        {(urgentCount + lateJobs.length) > 0 && (() => {
          const total = urgentCount + lateJobs.length;
          return (
            <div className="flex items-center gap-3 px-4 py-3 bg-[#C1121F] text-white" data-testid="urgent-banner">
              <BellRing className="w-4 h-4 shrink-0" />
              <p className="text-[11px] font-black uppercase tracking-[0.16em] flex-1">
                {total} item{total > 1 ? "s" : ""} need{total === 1 ? "s" : ""} attention
                {newQuotes.length > 0 && <span className="font-bold ml-3 opacity-80">· {newQuotes.length} new request{newQuotes.length > 1 ? "s" : ""}</span>}
                {awaitingPayment.length > 0 && <span className="font-bold ml-3 opacity-80">· {awaitingPayment.length} payment due</span>}
                {hasLate && <span className="font-bold ml-3 opacity-80">· {lateJobs.length} late job{lateJobs.length > 1 ? "s" : ""}</span>}
              </p>
            </div>
          );
        })()}

        {/* KPI strip — flat editorial grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-black/10 border border-black/12">
          {kpis.map((card, idx) => {
            const Icon = card.icon;
            const isOrphan = idx === 4;
            return (
              <div
                key={card.label}
                className={`bg-white px-4 sm:px-5 py-4 ${isOrphan ? "col-span-2 sm:col-span-1" : ""} ${
                  card.urgent && card.value > 0 ? "bg-[#FBEBEB]" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55">{card.label}</p>
                  <Icon className={`w-3.5 h-3.5 ${card.urgent && card.value > 0 ? "text-[#C1121F]" : "text-black/35"}`} strokeWidth={1.75} />
                </div>
                <div className={`text-[32px] sm:text-[36px] font-black tabular-nums tracking-tight leading-none ${
                  card.urgent && card.value > 0 ? "text-[#C1121F]" : "text-[#0A0A0A]"
                }`}>
                  {card.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Performance row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-black/10 border border-black/12">
          {(() => {
            const delta = todaysRevenue - yesterdaysRevenue;
            const up = delta >= 0;
            return (
              <div className="bg-white px-4 sm:px-5 py-4" data-testid="card-todays-revenue">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55">Today's Revenue</p>
                  <Wallet className="w-3.5 h-3.5 text-black/35" strokeWidth={1.75} />
                </div>
                <div className="flex items-end gap-3">
                  <p className="text-[32px] sm:text-[36px] font-black text-[#0A0A0A] tabular-nums tracking-tight leading-none">{formatMoney(todaysRevenue)}</p>
                  {yesterdaysRevenue > 0 && (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-black uppercase tracking-[0.16em] mb-1 ${up ? "text-[#0A0A0A]" : "text-[#C1121F]"}`}>
                      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {up ? "+" : ""}{formatMoney(delta)}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-black/45 font-bold uppercase tracking-[0.16em] mt-2">yesterday {formatMoney(yesterdaysRevenue)}</p>
              </div>
            );
          })()}

          <div className="bg-white px-4 sm:px-5 py-4" data-testid="card-win-rate">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55">Win Rate</p>
              <Target className="w-3.5 h-3.5 text-black/35" strokeWidth={1.75} />
            </div>
            <div className="flex items-end gap-3">
              <p className="text-[32px] sm:text-[36px] font-black text-[#0A0A0A] tabular-nums tracking-tight leading-none">{winRate}%</p>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black/45 mb-1 tabular-nums">{funnel.paid} / {funnel.submitted}</span>
            </div>
            <p className="text-[10px] text-black/45 font-bold uppercase tracking-[0.16em] mt-2">lead → paid</p>
          </div>

          <div className="bg-white px-4 sm:px-5 py-4" data-testid="card-avg-job-size">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55">Avg Job Size</p>
              <TrendingUp className="w-3.5 h-3.5 text-black/35" strokeWidth={1.75} />
            </div>
            <div className="flex items-end gap-3">
              <p className="text-[32px] sm:text-[36px] font-black text-[#0A0A0A] tabular-nums tracking-tight leading-none">{formatMoney(avgJobSize)}</p>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black/45 mb-1 tabular-nums">{closedQuotes.length} jobs</span>
            </div>
            <p className="text-[10px] text-black/45 font-bold uppercase tracking-[0.16em] mt-2">closed jobs</p>
          </div>
        </div>

        {/* Late jobs */}
        {lateJobs.length > 0 && (
          <Card className="border-[#C1121F]" data-testid="card-late-jobs">
            <div className="flex items-center justify-between px-4 sm:px-5 h-12 border-b border-[#C1121F]/30 bg-[#FBEBEB]">
              <div className="flex items-center gap-2.5">
                <Clock className="w-3.5 h-3.5 text-[#C1121F]" />
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C1121F]">Late Jobs</h2>
                <span className="inline-flex items-center h-5 px-1.5 text-[10px] font-black tabular-nums bg-[#C1121F] text-white">
                  {lateJobs.length}
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C1121F]/70">scheduled · not completed</span>
            </div>
            <div className="divide-y divide-[#C1121F]/15">
              {lateJobs.slice(0, 5).map((q: any) => (
                <QuoteRow key={q.id} quote={q} />
              ))}
            </div>
          </Card>
        )}

        {/* Conversion funnel */}
        {funnel.submitted > 0 && (
          <Card data-testid="card-funnel">
            <SectionHeader
              icon={Target}
              title="Conversion Funnel"
              action={<span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">all-time · {funnel.submitted} leads</span>}
            />
            <div className="px-4 sm:px-5 py-5 space-y-3.5">
              {[
                { label: "Submitted", value: funnel.submitted, prev: null as number | null },
                { label: "Quoted",    value: funnel.quoted,    prev: funnel.submitted },
                { label: "Booked",    value: funnel.booked,    prev: funnel.quoted },
                { label: "Paid",      value: funnel.paid,      prev: funnel.booked },
              ].map(step => {
                const pct = funnel.submitted > 0 ? (step.value / funnel.submitted) * 100 : 0;
                const dropPct = step.prev != null && step.prev > 0
                  ? Math.round(((step.prev - step.value) / step.prev) * 100)
                  : null;
                return (
                  <div key={step.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-black uppercase tracking-[0.18em] text-[#0A0A0A]">{step.label}</span>
                      <span className="font-black text-[#0A0A0A] tabular-nums">
                        {step.value}
                        {dropPct != null && dropPct > 0 && (
                          <span className="ml-2 text-[10px] font-black text-[#C1121F]">−{dropPct}%</span>
                        )}
                      </span>
                    </div>
                    <div className="relative h-1.5 bg-black/8 overflow-hidden">
                      <div className="absolute inset-y-0 left-0 bg-[#0A0A0A] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Outstanding commercial invoices */}
        {outstandingInvoices && outstandingInvoices.count > 0 && (
          <Card data-testid="card-outstanding-invoices">
            <SectionHeader
              icon={FileText}
              title="Outstanding Invoices · Net 30"
              action={
                <div className="flex items-center gap-3">
                  {outstandingInvoices.overdueCount > 0 && (
                    <Pill tone="urgent" data-testid="badge-overdue-count">{outstandingInvoices.overdueCount} overdue</Pill>
                  )}
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]" data-testid="text-total-due">
                    {formatMoney(outstandingInvoices.totalDue)} due
                  </span>
                </div>
              }
            />
            <div className="divide-y divide-black/8">
              {outstandingInvoices.items.map((inv) => {
                const accentClass =
                  inv.bucket === "overdue"  ? "border-l-[#C1121F] bg-[#FBEBEB]/60" :
                  inv.bucket === "due_soon" ? "border-l-[#0A0A0A] bg-[#EBE9E2]/40" :
                                              "border-l-black/15 bg-white";
                const daysLabel =
                  inv.bucket === "overdue"
                    ? `${inv.daysOutstanding - 30}d overdue`
                    : inv.daysUntilDue <= 0
                      ? "Due today"
                      : `Due in ${inv.daysUntilDue}d`;
                const daysClass =
                  inv.bucket === "overdue"  ? "text-[#C1121F]" :
                  inv.bucket === "due_soon" ? "text-[#0A0A0A]" :
                                              "text-black/55";
                return (
                  <Link key={inv.id} href={`/admin/quotes/${inv.id}`}>
                    <a
                      className={`flex items-center gap-3 px-4 py-3.5 border-l-[3px] hover:bg-[#EBE9E2] transition-colors cursor-pointer ${accentClass}`}
                      data-testid={`row-outstanding-invoice-${inv.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-[12px] font-black uppercase tracking-[0.06em] text-[#0A0A0A] truncate">
                            {inv.companyName || inv.customerName || "—"}
                          </p>
                          <span className="text-[10px] font-mono font-semibold text-[#0A0A0A]/65 shrink-0">
                            {inv.referenceNo}
                          </span>
                          {inv.poNumber && (
                            <Pill tone="stone">PO {inv.poNumber}</Pill>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.14em]">
                          <span className={`${daysClass}`} data-testid={`text-days-${inv.id}`}>{daysLabel}</span>
                          <span className="text-black/35">·</span>
                          <span className="text-black/55">Sent {inv.daysOutstanding}d ago</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[14px] font-black tabular-nums text-[#0A0A0A]">{formatMoney(inv.total)}</p>
                        <p className="text-[10px] text-black/45 font-bold uppercase tracking-[0.14em] mt-0.5">Due {format(new Date(inv.dueDate + "T12:00:00"), "d MMM")}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-black/25" />
                    </a>
                  </Link>
                );
              })}
            </div>
          </Card>
        )}

        {/* Revenue trend */}
        <Card>
          <SectionHeader
            icon={TrendingUp}
            title="Revenue · Last 12 Weeks"
            action={<span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0A0A0A] tabular-nums">{formatMoney(totalRevenue)} collected</span>}
          />
          <div className="px-2 pt-4 pb-2">
            {revenueChartData.every(d => d.revenue === 0) ? (
              <div className="h-24 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.18em] text-black/35">No completed jobs yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={110}>
                <AreaChart data={revenueChartData} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0A0A0A" stopOpacity={0.18}/>
                      <stop offset="95%" stopColor="#0A0A0A" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#0A0A0A99", fontWeight: 700 }} tickLine={false} axisLine={false} interval={1} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 11, background: "#fff", border: "1px solid #0A0A0A", borderRadius: 0, fontWeight: 700 }}
                    formatter={(v: any, name: string) => [
                      name === "revenue" ? `$${Number(v).toLocaleString()}` : v,
                      name === "revenue" ? "Revenue" : "Jobs",
                    ]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0A0A0A" strokeWidth={1.5} fill="url(#revGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black/40" strokeWidth={1.75} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="SEARCH BY NAME, REF NO, ADDRESS, PHONE…"
            data-testid="input-quote-search"
            className="h-11 w-full pl-10 pr-10 border border-black/20 bg-white text-[11px] font-bold uppercase tracking-[0.08em] text-[#0A0A0A] placeholder:text-black/35 placeholder:font-black placeholder:tracking-[0.16em] focus:outline-none focus:border-[#0A0A0A] transition-colors"
          />
          {isSearching && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-black/45 hover:text-[#0A0A0A]"
              data-testid="button-clear-search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search results / panels */}
        {isSearching ? (
          <Card>
            <SectionHeader
              title="Search Results"
              action={<span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55 tabular-nums">{searchResults.length} found</span>}
            />
            {searchResults.length > 0 ? (
              <div className="divide-y divide-black/8">
                {searchResults.map((q: any) => <QuoteRow key={q.id} quote={q} />)}
              </div>
            ) : (
              <EmptyState icon={Search} title="No results" hint={`Nothing matches "${search}"`} />
            )}
          </Card>
        ) : (
          <div className="space-y-6">

            {(newQuotes.length > 0 || awaitingPayment.length > 0) && (
              <Panel
                title="Action Required"
                badge={urgentCount}
                badgeUrgent
                accentRed
                quotes={[...newQuotes, ...awaitingPayment]}
                emptyMsg="Nothing needs attention"
                emptyIcon={ClipboardList}
              />
            )}

            {todayJobs.length > 0 && (
              <Panel
                title="Today's Jobs"
                badge={todayJobs.length}
                quotes={todayJobs}
                emptyMsg="Nothing scheduled for today"
                emptyIcon={CalendarCheck}
              />
            )}

            {activeJobs.length > 0 && (
              <Panel
                title="Active / In Progress"
                badge={activeJobs.length}
                quotes={activeJobs}
                emptyMsg="No active jobs"
                emptyIcon={Zap}
              />
            )}

            <Panel
              title="Upcoming Bookings"
              badge={upcomingBooked.length}
              quotes={upcomingBooked}
              emptyMsg="No upcoming bookings"
              emptyIcon={CalendarCheck}
            />

            <Panel
              title="Awaiting Deposit"
              badge={awaitingDeposit.length}
              quotes={awaitingDeposit}
              emptyMsg="No outstanding deposits"
              emptyIcon={DollarSign}
            />

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
                <Button
                  variant="outline"
                  icon={Trash2}
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  data-testid="button-clear-all-data"
                  className="!text-[#C1121F] !border-[#C1121F]/30 hover:!border-[#C1121F] hover:!bg-[#FBEBEB]"
                >
                  Clear all job data
                </Button>
              ) : (
                <Card className="border-[#C1121F]">
                  <div className="flex flex-wrap items-center gap-3 p-4 bg-[#FBEBEB]">
                    <AlertCircle className="w-4 h-4 text-[#C1121F] shrink-0" />
                    <p className="text-[12px] font-black uppercase tracking-[0.08em] text-[#0A0A0A] flex-1 min-w-0">Delete ALL quotes & data permanently?</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => clearAllMutation.mutate()}
                        disabled={clearAllMutation.isPending}
                      >
                        {clearAllMutation.isPending ? "Deleting…" : "Delete Everything"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>

          </div>
        )}
      </PageBody>

      <CreateJobModal open={showNewJob} onClose={() => setShowNewJob(false)} />
      <PhoneCallIntakeModal open={showPhoneCall} onClose={() => setShowPhoneCall(false)} />
    </PageShell>
  );
}
