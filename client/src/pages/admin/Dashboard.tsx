import { useQuotes, useUpdateQuoteStatus } from "@/hooks/use-quotes";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { format } from "date-fns";
import { useState } from "react";
import {
  ArrowUpRight, ClipboardList, DollarSign, CalendarCheck,
  Zap, CheckCircle2, Calendar, TrendingUp, AlertCircle, Trash2, UserPlus,
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

function formatMoney(v: any) {
  return `$${Number(v || 0).toLocaleString('en-SG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function initials(name: string = "?") {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

const avatarColors = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
];

function avatarColor(id: number) {
  return avatarColors[id % avatarColors.length];
}

function QuoteRow({ quote, showDate = false }: { quote: any; showDate?: boolean }) {
  // Determine which date to show in the meta line
  const slotDate = quote.scheduledAt
    ? format(new Date(quote.scheduledAt), "d MMM")
    : quote.preferredDate
      ? format(new Date(quote.preferredDate + "T12:00:00"), "d MMM") + " (pref.)"
      : null;

  const needsAction = ["submitted", "under_review", "completed"].includes(quote.status);

  return (
    <Link href={`/admin/quotes/${quote.id}`} data-testid={`quote-row-${quote.id}`}>
      <div className={`group flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer border-b last:border-0 ${needsAction ? "bg-amber-50/40 hover:bg-amber-50" : ""}`}>
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(quote.id)}`}>
          {initials(quote.customer?.name)}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground leading-tight truncate group-hover:text-primary transition-colors">
            {quote.customer?.name || "Unknown"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground truncate">{quote.serviceAddress}</p>
            {slotDate && showDate && (
              <span className="hidden sm:inline shrink-0 text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md">
                {slotDate}
              </span>
            )}
          </div>
        </div>

        {/* Ref */}
        <span className="hidden sm:inline text-[11px] font-mono font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-md shrink-0">
          {quote.referenceNo}
        </span>

        {/* Status badge */}
        <StatusBadge status={quote.status} className="hidden md:inline-flex scale-90 origin-right shrink-0" />

        {/* Amount + date */}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">{formatMoney(quote.total)}</p>
          <p className="text-xs text-muted-foreground">
            {showDate && slotDate ? slotDate : format(new Date(quote.createdAt), "d MMM")}
          </p>
        </div>

        {/* Arrow — highlighted for action-needed rows */}
        <ArrowUpRight className={`w-4 h-4 transition-colors shrink-0 ${needsAction ? "text-amber-500 group-hover:text-amber-600" : "text-muted-foreground group-hover:text-primary"}`} />
      </div>
    </Link>
  );
}

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
    e.preventDefault();
    e.stopPropagation();
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
    <div className="border-b last:border-0">
      <Link href={`/admin/quotes/${quote.id}`} data-testid={`quote-row-${quote.id}`}>
        <div className="group flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(quote.id)}`}>
            {initials(quote.customer?.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground leading-tight truncate group-hover:text-primary transition-colors">
              {quote.customer?.name || "Unknown"}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-muted-foreground truncate">{quote.serviceAddress}</p>
              {slotDate && (
                <span className="hidden sm:inline shrink-0 text-[10px] font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md">{slotDate}</span>
              )}
            </div>
          </div>
          <span className="hidden sm:inline text-[11px] font-mono font-semibold text-muted-foreground bg-secondary px-2 py-0.5 rounded-md shrink-0">
            {quote.referenceNo}
          </span>
          {quote.assignedStaffId
            ? <StatusBadge status="assigned" className="scale-90 origin-right shrink-0" />
            : <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">No Staff</span>
          }
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-foreground">{formatMoney(quote.total)}</p>
            {slotDate && <p className="text-xs text-muted-foreground">{slotDate}</p>}
          </div>
        </div>
      </Link>
      {!quote.assignedStaffId && (
        <div className="px-5 pb-3">
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              data-testid={`button-quick-assign-${quote.id}`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Assign Staff
            </button>
          ) : (
            <div className="flex items-center gap-2" onClick={e => e.preventDefault()}>
              <select
                value={selectedStaff}
                onChange={e => setSelectedStaff(e.target.value)}
                className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                data-testid={`select-quick-staff-${quote.id}`}
              >
                <option value="">Select staff…</option>
                {staffList?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={!selectedStaff || updateStatus.isPending}
                className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg disabled:opacity-50 hover:bg-primary/90 transition-colors"
                data-testid={`button-confirm-assign-${quote.id}`}
              >
                Assign
              </button>
              <button
                onClick={() => setExpanded(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
              >✕</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionPanel({
  title, icon: Icon, accent, quotes, emptyMsg, showDate,
  urgent = false, bookedStyle = false,
}: {
  title: string;
  icon: React.ElementType;
  accent: string;
  quotes: any[];
  emptyMsg: string;
  showDate?: boolean;
  urgent?: boolean;
  bookedStyle?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${urgent && quotes.length > 0 ? "ring-2 ring-orange-300" : ""}`}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-white">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <h2 className="font-bold text-sm text-foreground">{title}</h2>
        </div>
        <span className={`min-w-[1.5rem] h-6 px-2 rounded-full flex items-center justify-center text-xs font-bold ${
          quotes.length > 0
            ? urgent ? "bg-orange-100 text-orange-700" : "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground"
        }`}>
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
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <CheckCircle2 className="w-6 h-6 opacity-30" />
            <p className="text-sm">{emptyMsg}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const { data: allQuotes, isLoading } = useQuotes();

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/clear-all-data", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
  });

  function handleClearAll() {
    if (window.confirm("⚠️ Delete ALL quotes, customers and job data? This cannot be undone.")) {
      clearAllMutation.mutate();
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-28 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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

  const statCards = [
    { label: "New Requests",         value: newQuotes.length,       icon: ClipboardList, color: "text-violet-600", bg: "bg-violet-50",  bar: "bg-violet-500" },
    { label: "Awaiting Deposit",     value: awaitingDeposit.length, icon: DollarSign,    color: "text-amber-600",  bg: "bg-amber-50",   bar: "bg-amber-500" },
    { label: "Upcoming Bookings",    value: upcomingBooked.length,  icon: CalendarCheck, color: "text-cyan-600",   bg: "bg-cyan-50",    bar: "bg-cyan-500" },
    { label: "Active / In Progress", value: activeJobs.length,      icon: Zap,           color: "text-orange-600", bg: "bg-orange-50",  bar: "bg-orange-500" },
    { label: "Awaiting Payment",     value: awaitingPayment.length, icon: AlertCircle,   color: "text-emerald-600",bg: "bg-emerald-50", bar: "bg-emerald-500" },
  ];

  return (
    <div className="min-h-screen pt-20 pb-20" style={{ background: "hsl(220 14% 96%)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-8 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Operations Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {format(new Date(), "EEEE, d MMMM yyyy")} · {quotes.length} total jobs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white rounded-xl border shadow-sm">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-bold text-foreground">{formatMoney(totalRevenue)}</span>
              <span className="text-xs text-muted-foreground">total revenue</span>
            </div>
            <button
              onClick={handleClearAll}
              disabled={clearAllMutation.isPending}
              data-testid="button-clear-all-data"
              className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
              title="Clear all test data"
            >
              <Trash2 className="w-4 h-4" />
              {clearAllMutation.isPending ? "Clearing…" : "Clear Data"}
            </button>
            <Link href="/admin/schedule" data-testid="link-schedule">
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground text-background font-bold text-sm shadow-sm hover:bg-foreground/90 transition-colors">
                <Calendar className="w-4 h-4" /> Schedule
              </div>
            </Link>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white rounded-2xl border shadow-sm p-4 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
                <span className={`text-2xl font-black tracking-tight ${card.value > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                  {card.value}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground leading-tight">{card.label}</p>
                <div className={`mt-1.5 h-1 rounded-full ${card.value > 0 ? card.bar : "bg-border"}`} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Action required banner */}
        {(newQuotes.length + awaitingPayment.length) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5"
          >
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800">
              {newQuotes.length + awaitingPayment.length} item{(newQuotes.length + awaitingPayment.length) !== 1 ? "s" : ""} need your attention
            </p>
          </motion.div>
        )}

        {/* Section grid */}
        <div className="grid md:grid-cols-2 gap-5">
          <SectionPanel
            title="New Quote Requests"
            icon={ClipboardList}
            accent="bg-violet-100 text-violet-700"
            quotes={newQuotes}
            emptyMsg="No new requests"
            urgent
          />
          <SectionPanel
            title="Awaiting Deposit"
            icon={DollarSign}
            accent="bg-amber-100 text-amber-700"
            quotes={awaitingDeposit}
            emptyMsg="No outstanding deposits"
          />
          <SectionPanel
            title="Upcoming Confirmed Bookings"
            icon={CalendarCheck}
            accent="bg-cyan-100 text-cyan-700"
            quotes={upcomingBooked}
            emptyMsg="No upcoming bookings"
            showDate
            bookedStyle
          />
          <SectionPanel
            title="Active / In Progress"
            icon={Zap}
            accent="bg-orange-100 text-orange-700"
            quotes={activeJobs}
            emptyMsg="No active jobs"
            urgent
          />
          <div className="md:col-span-2">
            <SectionPanel
              title="Awaiting Final Payment"
              icon={AlertCircle}
              accent="bg-emerald-100 text-emerald-700"
              quotes={awaitingPayment.concat(recentlyClosed)}
              emptyMsg="No jobs awaiting payment"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
