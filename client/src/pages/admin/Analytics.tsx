import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  BarChart2, MousePointerClick, Users, TrendingUp, TrendingDown, Globe, ArrowRight,
  Eye, Smartphone, Monitor, Tablet, Clock, FileText, Percent, Layers,
  Megaphone, MapPin, RefreshCw, DollarSign, Briefcase, MessageSquare,
  CheckCircle, AlertCircle, Package, Activity, UserCheck, Star, Receipt,
  Wallet, PiggyBank,
} from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

/* ─── Types ─────────────────────────────────────────────────────────────────── */
type WebAnalyticsData = {
  days: number;
  today: { pageViews: number; sessions: number; wizardStarts: number; wizardSubmits: number; bounceRate: number; avgPagesPerSession: number };
  yesterday: { pageViews: number; sessions: number; wizardStarts: number; wizardSubmits: number; bounceRate: number; avgPagesPerSession: number };
  trend: { date: string; pageViews: number; sessions: number }[];
  sources: { source: string; count: number }[];
  funnel: { step: string; count: number }[];
  countries: { country: string; countryCode: string; count: number; lat: number; lng: number }[];
  cities: { city: string; country: string; countryCode: string; count: number; lat: number; lng: number }[];
  devices: { device: string; count: number }[];
  hourly: { hour: number; count: number }[];
  topPages: { page: string; count: number }[];
  utmCampaigns: { campaign: string; source: string; count: number }[];
  recent: {
    id: number; event: string; page: string | null; label: string | null;
    referrer: string | null; utmSource: string | null; utmCampaign: string | null;
    sessionId: string | null; country: string | null; city: string | null;
    deviceType: string | null; createdAt: string;
  }[];
};

type BusinessData = {
  period: { days: number; from: string; to: string };
  kpis: {
    pipelineValue: number; quotesThisPeriod: number; avgQuoteValue: number;
    completedJobs: number; conversionRate: number;
    whatsappLeads: number; waConversionRate: number; waEscalated: number;
    totalQuotes: number; totalWaSessions: number;
  };
  quotesByStatus: { status: string; count: number; value: number }[];
  quoteTrend: { month: string; count: number; value: number; label: string }[];
  paymentBreakdown: { status: string; count: number; value: number }[];
  sourceChannels: { channel: string; count: number }[];
  serviceBreakdown: { serviceType: string; count: number; value: number }[];
  selectedServicesBreakdown: { service: string; count: number }[];
  topItems: { name: string; count: number }[];
  staffAttendance: { id: number; name: string; hours: number; jobs: number }[];
  whatsappTrend: { date: string; count: number }[];
  waSubmitted: number; waEscalated: number;
};

type PnlData = {
  totalRevenue: number;
  tmgRevenue: number;
  ggvRevenue: number;
  ggvListedTotal: number;
  ggvDeductionTotal: number;
  ggvJobCount: number;
  totalExpenses: number;
  totalReceiptExpenses: number;
  totalSalaryCost: number;
  netProfit: number;
  profitMargin: number;
  jobCount: number;
  avgJobRevenue: number;
  pendingExpenses: number;
  monthlyTrend: {
    month: string; label: string;
    revenue: number; tmgRevenue: number; ggvRevenue: number;
    expenses: number; receiptsExpense: number; salaryExpense: number;
    profit: number;
  }[];
  expensesByCategory: { category: string; amount: number }[];
};

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const DAY_OPTIONS = [
  { label: "7d",  value: 7  },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

const BIZ_DAY_OPTIONS = [
  { label: "30d",  value: 30  },
  { label: "60d",  value: 60  },
  { label: "90d",  value: 90  },
  { label: "180d", value: 180 },
];

const STATUS_COLOR: Record<string, string> = {
  submitted:                "#64748b",
  under_review:             "#f59e0b",
  approved:                 "#06b6d4",
  deposit_requested:        "#a78bfa",
  deposit_paid:             "#8b5cf6",
  booking_requested:        "#6366f1",
  booked:                   "#3b82f6",
  assigned:                 "#0ea5e9",
  in_progress:              "#14b8a6",
  completed:                "#10b981",
  final_payment_requested:  "#22c55e",
  final_paid:               "#16a34a",
  closed:                   "#15803d",
  cancelled:                "#ef4444",
  rejected:                 "#f97316",
};

const PAY_COLOR: Record<string, string> = {
  unpaid:          "#64748b",
  deposit_pending: "#f59e0b",
  deposit_paid:    "#8b5cf6",
  final_pending:   "#06b6d4",
  paid_in_full:    "#10b981",
};

const SVC_COLOR: Record<string, string> = {
  install:    "#18181b",
  dismantle:  "#8b5cf6",
  relocate:   "#06b6d4",
  mount:      "#f59e0b",
  other:      "#64748b",
};

const SEA_PROJ  = { scale: 700, center: [108, 3]   as [number, number] };
const WORLD_PROJ = { scale: 140, center: [10,  10]  as [number, number] };

/* ─── Small helpers ──────────────────────────────────────────────────────────── */
function fmtSGD(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toLocaleString()}`;
}

function fmtStatus(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function countryFlag(code: string) {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(...Array.from(code.toUpperCase()).map(c => 0x1F1E0 - 65 + c.charCodeAt(0)));
}
function sourceIcon(source: string) {
  const s = source.toLowerCase();
  if (s === "google")    return "🔍";
  if (s === "facebook")  return "📘";
  if (s === "instagram") return "📸";
  if (s === "tiktok")    return "🎵";
  if (s === "whatsapp")  return "💬";
  if (s === "direct")    return "🔗";
  if (s === "internal")  return "🏠";
  return "🌐";
}
function deviceIcon(device: string) {
  if (device === "mobile")  return Smartphone;
  if (device === "tablet")  return Tablet;
  return Monitor;
}
function deviceColor(device: string) {
  if (device === "mobile") return "bg-violet-500";
  if (device === "tablet") return "bg-sky-500";
  return "bg-slate-800";
}
function eventLabel(event: string) {
  switch (event) {
    case "page_view":      return "View";
    case "cta_click":      return "Click";
    case "wizard_start":   return "Start";
    case "wizard_submit":  return "Submit";
    default:               return event;
  }
}
function eventColor(event: string) {
  switch (event) {
    case "page_view":      return "bg-slate-100 text-slate-600";
    case "cta_click":      return "bg-blue-50 text-blue-600";
    case "wizard_start":   return "bg-violet-50 text-violet-600";
    case "wizard_submit":  return "bg-emerald-50 text-emerald-600";
    default:               return "bg-gray-100 text-gray-600";
  }
}

/* ─── Shared components ──────────────────────────────────────────────────────── */
function DeltaBadge({ today, yesterday, lowerIsBetter }: { today: number; yesterday: number; lowerIsBetter?: boolean }) {
  if (yesterday === 0) return null;
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  const positive = lowerIsBetter ? pct <= 0 : pct >= 0;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
      {pct >= 0 ? "+" : ""}{pct}%
    </span>
  );
}

function KpiCard({ label, value, sub, icon: Icon, color = "text-zinc-400", badge, valueClass = "" }:
  { label: string; value: string; sub?: string; icon: any; color?: string; badge?: React.ReactNode; valueClass?: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        {badge}
      </div>
      <p className={`text-2xl font-bold leading-none mb-1 ${valueClass || "text-zinc-900"}`}>{value}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
      {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">{children}</p>;
}

function Panel({ title, icon: Icon, children, className = "" }: { title: string; icon?: any; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-zinc-200 rounded-xl overflow-hidden ${className}`}>
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-zinc-400" />}
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState({ msg = "No data yet" }: { msg?: string }) {
  return <p className="text-sm text-zinc-400 text-center py-6">{msg}</p>;
}

const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.07) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

/* ─── Business tab ───────────────────────────────────────────────────────────── */
function BusinessTab({ days }: { days: number }) {
  const { data, isLoading } = useQuery<BusinessData>({
    queryKey: ["/api/admin/analytics/business", days],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/analytics/business?days=${days}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 120_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { kpis, quotesByStatus, quoteTrend, paymentBreakdown, sourceChannels,
          serviceBreakdown, selectedServicesBreakdown, topItems,
          staffAttendance, whatsappTrend } = data;

  const sourceData = sourceChannels.map(s => ({ name: s.channel === "whatsapp" ? "WhatsApp" : "Website", value: s.count }));
  const srcColors = ["#25d366", "#18181b"];

  const maxSvc = serviceBreakdown[0]?.count ?? 1;
  const maxItem = topItems[0]?.count ?? 1;
  const maxStaff = staffAttendance[0]?.hours ?? 1;

  const payData = paymentBreakdown.map(p => ({
    name: fmtStatus(p.status), value: p.count, color: PAY_COLOR[p.status] || "#94a3b8",
  }));

  const statusChartData = quotesByStatus
    .filter(q => q.count > 0)
    .map(q => ({ name: fmtStatus(q.status), count: q.count, value: Math.round(q.value), color: STATUS_COLOR[q.status] || "#94a3b8" }));

  return (
    <div className="space-y-6">
      {/* KPI cards row 1 */}
      <div>
        <SectionTitle>Revenue Pipeline</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiCard label="Total Pipeline" value={fmtSGD(kpis.pipelineValue)} icon={DollarSign} color="text-emerald-500"
            sub="All active + completed" />
          <KpiCard label="Avg Quote Value" value={fmtSGD(kpis.avgQuoteValue)} icon={TrendingUp} color="text-violet-500" />
          <KpiCard label="Completed Jobs" value={kpis.completedJobs.toString()} icon={CheckCircle} color="text-emerald-500"
            sub="All time" />
          <KpiCard label="Conversion Rate" value={`${kpis.conversionRate}%`} icon={Percent} color="text-blue-500"
            sub="Submitted → Completed" />
        </div>
      </div>

      <div>
        <SectionTitle>This Period ({days} days)</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiCard label="New Quotes" value={kpis.quotesThisPeriod.toString()} icon={FileText} color="text-zinc-500"
            sub={`of ${kpis.totalQuotes} total`} />
          <KpiCard label="WA Leads" value={kpis.whatsappLeads.toString()} icon={MessageSquare} color="text-emerald-500"
            sub={`${kpis.waConversionRate}% bot→quote`} />
          <KpiCard label="Bot Escalations" value={(kpis.waEscalated ?? 0).toString()} icon={AlertCircle} color="text-amber-500"
            sub="Needed human help" />
          <KpiCard label="Total WA Sessions" value={kpis.totalWaSessions.toString()} icon={Users} color="text-blue-500"
            sub="All time" />
        </div>
      </div>

      {/* Quote trend */}
      <Panel title="Quote Volume & Value — Monthly" icon={BarChart2}>
        {quoteTrend.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={quoteTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#18181b" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#18181b" stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                formatter={(val: any, name: string) => name === "Value (SGD)" ? [`$${Number(val).toLocaleString()}`, name] : [val, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 8 }} />
              <Area yAxisId="left"  type="monotone" dataKey="count" name="Quotes" stroke="#18181b" strokeWidth={2} fill="url(#gradCount)" dot={false} />
              <Area yAxisId="right" type="monotone" dataKey="value" name="Value (SGD)" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradValue)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* Status + Source split */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Quote status horizontal bars */}
        <Panel title="Quotes by Status (All Time)" icon={Activity}>
          {statusChartData.length === 0 ? <EmptyState /> : (
            <div className="space-y-2.5">
              {statusChartData.map(({ name, count, value, color }) => {
                const maxCount = statusChartData[0].count;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        {name}
                      </span>
                      <div className="flex items-center gap-2">
                        {value > 0 && <span className="text-[10px] text-zinc-400">{fmtSGD(value)}</span>}
                        <span className="text-xs font-bold text-zinc-900">{count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxCount) * 100}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Source channel donut */}
        <Panel title="Lead Source Split" icon={Globe}>
          {sourceData.length === 0 ? <EmptyState /> : (
            <div className="flex flex-col items-center gap-4">
              <PieChart width={200} height={160}>
                <Pie data={sourceData} dataKey="value" cx={100} cy={80} innerRadius={48} outerRadius={72} labelLine={false} label={PieLabel}>
                  {sourceData.map((_, i) => <Cell key={i} fill={srcColors[i % srcColors.length]} />)}
                </Pie>
              </PieChart>
              <div className="flex gap-4 flex-wrap justify-center">
                {sourceData.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: srcColors[i] }} />
                    <span className="text-xs text-zinc-600 font-medium">{s.name}</span>
                    <span className="text-xs font-bold text-zinc-900">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Payment status + Service type */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Payment status donut */}
        <Panel title="Payment Status (Active Quotes)" icon={DollarSign}>
          {payData.length === 0 ? <EmptyState /> : (
            <div className="flex flex-col items-center gap-3">
              <PieChart width={200} height={160}>
                <Pie data={payData} dataKey="value" cx={100} cy={80} innerRadius={48} outerRadius={72} labelLine={false} label={PieLabel}>
                  {payData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
              <div className="w-full space-y-1.5">
                {payData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-zinc-600 flex-1">{d.name}</span>
                    <span className="text-xs font-bold text-zinc-900">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        {/* Service type breakdown */}
        <Panel title="Service Types Requested" icon={Package}>
          {serviceBreakdown.length === 0 ? <EmptyState /> : (
            <div className="space-y-2.5">
              {serviceBreakdown.map(({ serviceType, count, value }) => (
                <div key={serviceType}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-zinc-700 capitalize">{serviceType}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400">{fmtSGD(value)}</span>
                      <span className="text-xs font-bold text-zinc-900">{count}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(count / maxSvc) * 100}%`, background: SVC_COLOR[serviceType] || "#94a3b8" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Selected service tags + Top requested items */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Panel title="Service Tags Selected by Customers" icon={Star}>
          {selectedServicesBreakdown.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={selectedServicesBreakdown.slice(0, 8)} layout="vertical" margin={{ left: 4, right: 16, top: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="service" tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} width={80}
                  tickFormatter={v => v.charAt(0).toUpperCase() + v.slice(1)} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Quotes" radius={[0, 3, 3, 0]} fill="#18181b" barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Top Requested Items (from Scans)" icon={Package}>
          {topItems.length === 0 ? <EmptyState /> : (
            <div className="space-y-2">
              {topItems.slice(0, 8).map(({ name, count }) => (
                <div key={name} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-700 font-medium truncate">{name}</div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-violet-400 rounded-full" style={{ width: `${(count / maxItem) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-zinc-900 shrink-0 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ─── Operations tab ─────────────────────────────────────────────────────────── */
function OperationsTab({ days }: { days: number }) {
  const { data, isLoading } = useQuery<BusinessData>({
    queryKey: ["/api/admin/analytics/business", days],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/analytics/business?days=${days}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 120_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { staffAttendance, whatsappTrend, kpis } = data;
  const maxHours = staffAttendance[0]?.hours ?? 1;
  const waTotal = kpis.totalWaSessions;
  const waBotHandled = waTotal - (kpis.waEscalated ?? 0);

  const waPieData = [
    { name: "Bot Handled", value: waBotHandled, color: "#10b981" },
    { name: "Escalated", value: kpis.waEscalated ?? 0, color: "#f59e0b" },
  ];

  return (
    <div className="space-y-6">
      {/* WhatsApp KPIs */}
      <div>
        <SectionTitle>WhatsApp Bot Performance</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total WA Sessions" value={kpis.totalWaSessions.toString()} icon={MessageSquare} color="text-emerald-500" />
          <KpiCard label="Reached Quote" value={(data.waSubmitted ?? 0).toString()} icon={CheckCircle} color="text-blue-500"
            sub={`${kpis.waConversionRate}% conversion`} />
          <KpiCard label="Escalated to Admin" value={(kpis.waEscalated ?? 0).toString()} icon={AlertCircle} color="text-amber-500"
            sub="Bot paused" />
          <KpiCard label="WA Leads This Period" value={kpis.whatsappLeads.toString()} icon={TrendingUp} color="text-violet-500"
            sub={`Last ${days} days`} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* WhatsApp daily trend */}
        <Panel title={`WhatsApp Sessions — Last ${days} Days`} icon={MessageSquare}>
          {whatsappTrend.length === 0 ? <EmptyState msg="No WhatsApp sessions in this period" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={whatsappTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                  tickFormatter={v => format(parseISO(v), "d MMM")}
                  interval={Math.max(0, Math.floor(whatsappTrend.length / 6) - 1)} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={v => format(parseISO(v as string), "d MMM yyyy")} />
                <Bar dataKey="count" name="Sessions" fill="#25d366" radius={[3, 3, 0, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        {/* Bot vs Escalation donut */}
        <Panel title="Bot Handled vs Escalated (All Time)" icon={Activity}>
          {waTotal === 0 ? <EmptyState /> : (
            <div className="flex flex-col items-center gap-4">
              <PieChart width={180} height={140}>
                <Pie data={waPieData} dataKey="value" cx={90} cy={70} innerRadius={42} outerRadius={62} labelLine={false} label={PieLabel}>
                  {waPieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
              <div className="w-full space-y-2">
                {waPieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-zinc-600 flex-1">{d.name}</span>
                    <span className="text-xs font-bold text-zinc-900">{d.value}</span>
                    <span className="text-[10px] text-zinc-400">{waTotal > 0 ? `${Math.round((d.value / waTotal) * 100)}%` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Staff attendance */}
      <div>
        <SectionTitle>Staff Performance — Last 30 Days</SectionTitle>

        {staffAttendance.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-6 text-center">
            <p className="text-sm text-zinc-400">No attendance records yet</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Staff hours bar chart */}
            <Panel title="Hours Worked" icon={Clock}>
              <ResponsiveContainer width="100%" height={Math.max(120, staffAttendance.length * 44)}>
                <BarChart data={staffAttendance} layout="vertical" margin={{ left: 4, right: 24, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => [`${v}h`, "Hours"]} />
                  <Bar dataKey="hours" name="Hours Worked" fill="#18181b" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            {/* Staff jobs completed */}
            <Panel title="Jobs Completed (All Time)" icon={Briefcase}>
              {staffAttendance.every(s => s.jobs === 0) ? (
                <EmptyState msg="No completed jobs assigned to staff yet" />
              ) : (
                <div className="space-y-3">
                  {staffAttendance.filter(s => s.jobs > 0).map(s => (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-zinc-700 flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
                          {s.name}
                        </span>
                        <span className="text-xs font-bold text-zinc-900">{s.jobs} jobs</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${(s.jobs / Math.max(...staffAttendance.map(x => x.jobs))) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}

        {/* Staff summary table */}
        {staffAttendance.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden mt-4">
            <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900">Staff Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Hours (30d)</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Jobs Done</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">Efficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {staffAttendance.map(s => {
                    const efficiency = s.hours > 0 && s.jobs > 0 ? (s.jobs / s.hours * 8).toFixed(1) : "–";
                    return (
                      <tr key={s.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-zinc-800">{s.name}</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{s.hours}h</td>
                        <td className="px-4 py-3 text-right text-zinc-600">{s.jobs}</td>
                        <td className="px-4 py-3 text-right">
                          {efficiency !== "–" ? (
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                              {efficiency} jobs/day
                            </span>
                          ) : <span className="text-zinc-400">–</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Website tab (preserved from original) ──────────────────────────────────── */
function WebsiteTab({ days }: { days: number }) {
  const [mapView, setMapView] = useState<"sea" | "world">("sea");
  const [hoveredPin, setHoveredPin] = useState<{ text: string; x: number; y: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<WebAnalyticsData>({
    queryKey: ["/api/admin/analytics", days],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/analytics?days=${days}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const proj = mapView === "sea" ? SEA_PROJ : WORLD_PROJ;
  const maxTrend = Math.max(...data.trend.map(d => d.pageViews), 1);
  const funnelMax = data.funnel[0]?.count ?? 1;
  const maxHourly = Math.max(...data.hourly.map(h => h.count), 1);
  const totalDevices = data.devices.reduce((s, d) => s + d.count, 0) || 1;
  const maxSource = data.sources[0]?.count ?? 1;
  const activeHours = data.hourly.filter(h => h.hour >= 6);
  const mapPins = (mapView === "sea" ? data.cities : data.countries).filter(p => p.lat && p.lng);

  return (
    <div className="space-y-6">
      {/* Today stats */}
      <div>
        <SectionTitle>Today vs Yesterday</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { label: "Page Views",    value: data.today.pageViews,          yest: data.yesterday.pageViews,          icon: Eye,             fmt: undefined,           lower: false },
            { label: "Sessions",      value: data.today.sessions,           yest: data.yesterday.sessions,           icon: Users,           fmt: undefined,           lower: false },
            { label: "Est. Starts",   value: data.today.wizardStarts,       yest: data.yesterday.wizardStarts,       icon: MousePointerClick,fmt: undefined,          lower: false },
            { label: "Leads",         value: data.today.wizardSubmits,      yest: data.yesterday.wizardSubmits,      icon: TrendingUp,      fmt: undefined,           lower: false },
            { label: "Bounce Rate",   value: data.today.bounceRate,         yest: data.yesterday.bounceRate,         icon: Percent,         fmt: (v: number) => `${v}%`, lower: true },
            { label: "Pages/Session", value: data.today.avgPagesPerSession, yest: data.yesterday.avgPagesPerSession, icon: Layers,          fmt: (v: number) => v.toFixed(1), lower: false },
          ].map(({ label, value, yest, icon: Icon, fmt, lower }) => (
            <div key={label} className="bg-white border border-zinc-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-zinc-400" />
                </div>
                <DeltaBadge today={value} yesterday={yest} lowerIsBetter={lower} />
              </div>
              <p className="text-2xl font-bold text-zinc-900 leading-none mb-1">{fmt ? fmt(value) : value.toLocaleString()}</p>
              <p className="text-xs text-zinc-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Page Views — Last {days} Days</h2>
          <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-medium">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-800" /> Views</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-400" /> Sessions</span>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-0.5" style={{ height: "80px" }}>
            {data.trend.map(({ date, pageViews, sessions }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-0.5 group relative" title={`${format(parseISO(date), "d MMM")}: ${pageViews} views, ${sessions} sessions`}>
                <div className="w-full flex items-end gap-px" style={{ height: "72px" }}>
                  <div className="flex-1 bg-zinc-800 rounded-t-[1px]" style={{ height: `${Math.max(2, (pageViews / maxTrend) * 68)}px` }} />
                  <div className="flex-1 bg-violet-300 rounded-t-[1px]" style={{ height: `${Math.max(2, (sessions / maxTrend) * 68)}px` }} />
                </div>
                {(days <= 14 || data.trend.indexOf(data.trend.find(d => d.date === date)!) % Math.ceil(days / 7) === 0) && (
                  <span className="text-[9px] text-zinc-400 whitespace-nowrap mt-1">{format(parseISO(date), days > 14 ? "d" : "d MMM")}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-zinc-400" /><h2 className="text-sm font-semibold text-zinc-900">Visitor Map — {days}-Day Window</h2></div>
          <div className="flex p-0.5 rounded-md border border-zinc-200 bg-zinc-100">
            {["sea","world"].map(v => (
              <button key={v} onClick={() => setMapView(v as any)} data-testid={`map-view-${v}`}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-sm transition-colors ${mapView === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}>
                {v.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="p-5">
          {mapPins.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-xs text-slate-400">No geo data yet.</p>
            </div>
          ) : (
            <div>
              <div ref={mapContainerRef} className="relative rounded overflow-hidden bg-slate-50 border border-slate-100" onMouseLeave={() => setHoveredPin(null)}>
                <ComposableMap projectionConfig={proj} style={{ width: "100%", height: "auto" }}>
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) => geographies.map((geo) => (
                      <Geography key={geo.rsmKey} geography={geo} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={0.4}
                        style={{ default: { outline: "none" }, hover: { outline: "none", fill: "#cbd5e1" }, pressed: { outline: "none" } }} />
                    ))}
                  </Geographies>
                  {mapPins.map((pin) => {
                    const label = mapView === "sea"
                      ? `${(pin as any).city}, ${pin.country} — ${pin.count} visit${pin.count !== 1 ? "s" : ""}`
                      : `${pin.country} — ${pin.count} visit${pin.count !== 1 ? "s" : ""}`;
                    return (
                      <Marker key={`${pin.lat}-${pin.lng}`} coordinates={[pin.lng, pin.lat]}>
                        <circle r={Math.max(4, Math.min(mapView === "sea" ? 12 : 18, 4 + Math.sqrt(pin.count) * (mapView === "sea" ? 1.5 : 2)))}
                          fill="#000" fillOpacity={0.8} stroke="#fff" strokeWidth={1.5} style={{ cursor: "pointer" }}
                          onMouseEnter={(e: any) => { const rect = mapContainerRef.current?.getBoundingClientRect(); if (rect) setHoveredPin({ text: label, x: e.clientX - rect.left, y: e.clientY - rect.top }); }}
                          onMouseLeave={() => setHoveredPin(null)} />
                      </Marker>
                    );
                  })}
                </ComposableMap>
                {hoveredPin && (
                  <div className="absolute pointer-events-none z-10 bg-black text-white text-[11px] font-semibold px-2 py-1 whitespace-nowrap shadow-lg"
                    style={{ left: Math.min(hoveredPin.x + 10, (mapContainerRef.current?.offsetWidth ?? 400) - 220), top: Math.max(hoveredPin.y - 30, 4) }}>
                    <MapPin className="w-3 h-3 inline mr-1 opacity-70" />{hoveredPin.text}
                  </div>
                )}
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-2">Top Cities</p>
                  <div className="space-y-1.5">
                    {data.cities.slice(0, 8).map(({ city, country, countryCode, count }) => (
                      <div key={`${city}-${countryCode}`} className="flex items-center gap-2">
                        <span className="text-base leading-none shrink-0">{countryFlag(countryCode)}</span>
                        <div className="flex-1 min-w-0"><span className="text-xs text-slate-700 font-medium">{city}</span><span className="text-[10px] text-slate-400 ml-1">{country}</span></div>
                        <span className="text-xs font-black text-slate-900 shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-2">Countries</p>
                  <div className="space-y-1.5">
                    {data.countries.slice(0, 8).map(({ country, countryCode, count }) => (
                      <div key={country} className="flex items-center gap-2">
                        <span className="text-base leading-none shrink-0">{countryFlag(countryCode)}</span>
                        <span className="text-xs text-slate-700 font-medium flex-1 truncate">{country}</span>
                        <span className="text-xs font-black text-slate-900 shrink-0">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Devices | Sources | Funnel */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100"><h2 className="text-sm font-semibold text-zinc-900">Devices</h2></div>
          <div className="p-5">
            {data.devices.length === 0 ? <EmptyState /> : (
              <div className="space-y-4">
                {data.devices.map(({ device, count }) => {
                  const Icon = deviceIcon(device);
                  const pct = Math.round((count / totalDevices) * 100);
                  return (
                    <div key={device}>
                      <div className="flex items-center gap-2 mb-1.5"><Icon className="w-4 h-4 text-zinc-400" /><span className="text-sm font-medium text-zinc-700 capitalize flex-1">{device}</span><span className="text-sm font-bold text-zinc-900">{pct}%</span></div>
                      <div className="h-1.5 bg-zinc-100 w-full rounded-full overflow-hidden"><div className={`h-full ${deviceColor(device)} rounded-full`} style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100"><h2 className="text-sm font-semibold text-zinc-900">Traffic Sources</h2></div>
          <div className="p-5">
            {data.sources.length === 0 ? <EmptyState /> : (
              <div className="space-y-4">
                {data.sources.slice(0, 7).map(({ source, count }) => (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-zinc-700 flex-1 flex items-center gap-1.5 truncate"><span>{sourceIcon(source)}</span><span className="truncate">{source}</span></span>
                      <span className="text-sm font-bold text-zinc-900 ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 w-full rounded-full overflow-hidden"><div className="h-full bg-zinc-800 rounded-full" style={{ width: `${(count / maxSource) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100"><h2 className="text-sm font-semibold text-zinc-900">Conversion Funnel</h2></div>
          <div className="p-5">
            <div className="space-y-4">
              {data.funnel.map(({ step, count }, i) => {
                const pct = funnelMax > 0 ? Math.round((count / funnelMax) * 100) : 0;
                const convPct = i > 0 && data.funnel[i - 1].count > 0 ? Math.round((count / data.funnel[i - 1].count) * 100) : null;
                return (
                  <div key={step}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-zinc-300 shrink-0" />}
                        <span className="text-sm font-medium text-zinc-700">{step}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {convPct !== null && (
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${convPct >= 20 ? "bg-emerald-50 text-emerald-700" : convPct >= 5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>{convPct}%</span>
                        )}
                        <span className="text-sm font-bold text-zinc-900">{count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-zinc-100 w-full rounded-full overflow-hidden"><div className="h-full bg-zinc-800 rounded-full" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Hourly + Top pages */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2"><Clock className="w-4 h-4 text-zinc-400" /><h2 className="text-sm font-semibold text-zinc-900">Traffic by Hour — Today</h2></div>
          <div className="p-5">
            <div className="flex items-end gap-0.5 h-24">
              {activeHours.map(({ hour, count }) => (
                <div key={hour} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${hour}:00 — ${count} view${count !== 1 ? "s" : ""}`}>
                  <div className="w-full bg-zinc-800 rounded-t-[1px] transition-opacity group-hover:opacity-70" style={{ height: `${Math.max(2, (count / maxHourly) * 80)}px` }} />
                  {hour % 4 === 0 && <span className="text-[10px] text-zinc-400 mt-1">{hour}h</span>}
                </div>
              ))}
            </div>
            {data.today.pageViews === 0 && <p className="text-sm text-zinc-500 mt-4">No visits today yet</p>}
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2"><FileText className="w-4 h-4 text-zinc-400" /><h2 className="text-sm font-semibold text-zinc-900">Top Pages — {days} Days</h2></div>
          <div className="p-5">
            {data.topPages.length === 0 ? <EmptyState /> : (
              <div className="space-y-3">
                {data.topPages.map(({ page, count }) => {
                  const maxPage = data.topPages[0]?.count ?? 1;
                  return (
                    <div key={page}>
                      <div className="flex items-center gap-2 mb-1"><span className="text-sm font-mono text-zinc-600 flex-1 truncate">{page || "/"}</span><span className="text-sm font-bold text-zinc-900 shrink-0">{count}</span></div>
                      <div className="h-1.5 bg-zinc-100 w-full rounded-full overflow-hidden"><div className="h-full bg-zinc-400 rounded-full" style={{ width: `${(count / maxPage) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* UTM Campaigns */}
      {data.utmCampaigns.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2"><Megaphone className="w-4 h-4 text-zinc-400" /><h2 className="text-sm font-semibold text-zinc-900">UTM Campaigns — {days} Days</h2></div>
          <div className="p-5">
            <div className="divide-y divide-zinc-100">
              {data.utmCampaigns.map(({ campaign, source, count }) => {
                const maxC = data.utmCampaigns[0]?.count ?? 1;
                return (
                  <div key={campaign} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-medium text-zinc-800 flex-1 truncate">{campaign}</span>
                      {source && <span className="text-xs text-zinc-500 shrink-0">{sourceIcon(source)} {source}</span>}
                      <span className="text-sm font-bold text-zinc-900 shrink-0">{count}</span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 w-full rounded-full overflow-hidden"><div className="h-full bg-violet-500 rounded-full" style={{ width: `${(count / maxC) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Recent events */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Recent Events</h2>
          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-zinc-100 text-zinc-600">{data.recent.length} shown</span>
        </div>
        <div className="p-0">
          {data.recent.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-500">No events yet. Events appear as customers visit tmginstall.com.</p>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="px-4 py-3">Event</th>
                    <th className="px-4 py-3">Page / Label</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Location / Source</th>
                    <th className="px-4 py-3 hidden md:table-cell">Device</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Campaign</th>
                    <th className="px-4 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white">
                  {data.recent.map((evt) => {
                    const referrerHost = evt.referrer ? (() => { try { return new URL(evt.referrer!).hostname.replace("www.", ""); } catch { return null; } })() : null;
                    const locationStr = [evt.city, evt.country].filter(Boolean).join(", ") || referrerHost || evt.utmSource || "Direct";
                    return (
                      <tr key={evt.id} data-testid={`event-row-${evt.id}`} className="hover:bg-zinc-50">
                        <td className="px-4 py-3 whitespace-nowrap"><span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${eventColor(evt.event)}`}>{eventLabel(evt.event)}</span></td>
                        <td className="px-4 py-3 text-zinc-600 font-mono text-xs truncate max-w-[150px]">{evt.page ?? ""}{evt.label ? ` · ${evt.label}` : ""}</td>
                        <td className="px-4 py-3 hidden sm:table-cell"><span className="flex items-center gap-1.5 text-zinc-700"><MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" /><span className="truncate max-w-[140px]">{locationStr}</span></span></td>
                        <td className="px-4 py-3 hidden md:table-cell">{evt.deviceType && <span className="text-zinc-500 capitalize">{evt.deviceType}</span>}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-violet-600">{evt.utmCampaign && <span className="truncate max-w-[100px] inline-block">📣 {evt.utmCampaign}</span>}</td>
                        <td className="px-4 py-3 text-right text-zinc-400 whitespace-nowrap text-xs">{format(new Date(evt.createdAt), "d MMM HH:mm")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── P&L tab ────────────────────────────────────────────────────────────────── */
const CAT_COLORS: Record<string, string> = {
  fuel:      "#f59e0b",
  tools:     "#8b5cf6",
  transport: "#06b6d4",
  meals:     "#f97316",
  parking:   "#64748b",
  other:     "#94a3b8",
};

function PnLTab() {
  const { data, isLoading } = useQuery<PnlData>({
    queryKey: ["/api/admin/analytics/pnl"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/analytics/pnl`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 120_000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const {
    totalRevenue, tmgRevenue, ggvRevenue, ggvJobCount,
    totalExpenses, totalReceiptExpenses, totalSalaryCost,
    netProfit, profitMargin, jobCount, avgJobRevenue,
    pendingExpenses, monthlyTrend, expensesByCategory,
  } = data;

  const profitable = netProfit >= 0;
  const maxCatAmount = expensesByCategory[0]?.amount ?? 1;

  return (
    <div className="space-y-6">

      {/* ── Row 1: Revenue KPIs ── */}
      <div>
        <SectionTitle>Revenue — All Time</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <KpiCard label="Total Revenue" value={fmtSGD(totalRevenue)}
            sub="TMG jobs + GGV combined" icon={Wallet} color="text-emerald-500" />
          <KpiCard label="TMG Jobs" value={fmtSGD(tmgRevenue)}
            sub={`${jobCount} completed`} icon={Briefcase} color="text-blue-500" />
          <KpiCard label="GoGoVan Net Earnings" value={fmtSGD(ggvRevenue)}
            sub={`${ggvJobCount} trips · net transport payout`} icon={TrendingUp} color="text-violet-500" />
        </div>
      </div>

      {/* ── Row 2: Expense KPIs ── */}
      <div>
        <SectionTitle>Expenses — All Time</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total Expenses" value={fmtSGD(totalExpenses)}
            sub="Salary + approved claims" icon={Receipt} color="text-red-500" />
          <KpiCard label="Staff Salary" value={fmtSGD(totalSalaryCost)}
            sub="Monthly salary (prorated) + hourly hours" icon={Users} color="text-red-400" />
          <KpiCard label="Receipts & Claims" value={fmtSGD(totalReceiptExpenses)}
            sub="Approved expense claims" icon={FileText} color="text-red-400" />
          <KpiCard label="Net Profit" value={fmtSGD(Math.abs(netProfit))}
            sub={`${profitable ? "Profit" : "Loss"} · ${profitMargin}% margin`}
            icon={profitable ? TrendingUp : TrendingDown}
            color={profitable ? "text-emerald-500" : "text-red-500"}
            valueClass={profitable ? "text-emerald-600" : "text-red-600"} />
        </div>
      </div>

      {/* Pending expenses alert */}
      {pendingExpenses > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3.5">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{fmtSGD(pendingExpenses)}</span> in pending expense claims awaiting approval — not included above.
          </p>
        </div>
      )}

      {/* ── Monthly chart: stacked revenue vs expenses ── */}
      <Panel title="Monthly Revenue vs Expenses (last 6 months)" icon={BarChart2}>
        {monthlyTrend.length === 0 ? <EmptyState msg="No data yet" /> : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={52}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ fontSize: 12, border: "1px solid #e2e8f0", borderRadius: 8 }}
                formatter={(val: any, name: string) => [`$${Number(val).toLocaleString()}`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 8 }} />
              <Bar dataKey="tmgRevenue"     name="TMG Jobs"      stackId="rev" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="ggvRevenue"     name="GoGoVan"       stackId="rev" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="salaryExpense"  name="Staff Salary"  stackId="exp" fill="#ef4444" radius={[0, 0, 0, 0]} />
              <Bar dataKey="receiptsExpense" name="Receipts"     stackId="exp" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>

      {/* ── Expense categories + P&L Summary ── */}
      <div className="grid sm:grid-cols-2 gap-4">

        {/* Expense breakdown by category */}
        <Panel title="Expenses by Category" icon={Receipt}>
          {expensesByCategory.length === 0 ? <EmptyState msg="No expenses yet" /> : (
            <div className="space-y-3">
              {expensesByCategory.map(({ category, amount }) => {
                const label = category === "staff_salary" ? "Staff Salary" : category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, " ");
                const color = category === "staff_salary" ? "#ef4444" : CAT_COLORS[category] || "#94a3b8";
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-zinc-700">{label}</span>
                      <span className="text-xs font-bold text-zinc-900">${amount.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(amount / maxCatAmount) * 100}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-zinc-100 flex justify-between">
                <span className="text-xs text-zinc-500 font-medium">Total expenses</span>
                <span className="text-xs font-bold text-red-600">{fmtSGD(totalExpenses)}</span>
              </div>
            </div>
          )}
        </Panel>

        {/* Full P&L waterfall summary */}
        <Panel title="P&L Summary" icon={PiggyBank}>
          <div className="space-y-2">
            {/* Revenue */}
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-emerald-50">
              <span className="text-xs font-medium text-zinc-700">TMG Job Revenue</span>
              <span className="text-sm font-bold text-emerald-600">{fmtSGD(tmgRevenue)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-violet-50">
              <span className="text-xs font-medium text-zinc-700">GoGoVan Net Earnings</span>
              <span className="text-sm font-bold text-violet-600">{fmtSGD(ggvRevenue)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-emerald-100">
              <span className="text-xs font-semibold text-zinc-700">= Total Revenue</span>
              <span className="text-sm font-bold text-emerald-700">{fmtSGD(totalRevenue)}</span>
            </div>
            {/* Expenses */}
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-red-50">
              <span className="text-xs font-medium text-zinc-700">Staff Salary Cost</span>
              <span className="text-sm font-bold text-red-500">– {fmtSGD(totalSalaryCost)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-red-50">
              <span className="text-xs font-medium text-zinc-700">Receipts &amp; Claims</span>
              <span className="text-sm font-bold text-red-500">– {fmtSGD(totalReceiptExpenses)}</span>
            </div>
            {/* Bottom line */}
            <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${profitable ? "bg-emerald-100" : "bg-red-100"}`}>
              <span className="text-xs font-bold text-zinc-800">Net {profitable ? "Profit" : "Loss"}</span>
              <span className={`text-base font-black ${profitable ? "text-emerald-700" : "text-red-700"}`}>
                {profitable ? "" : "– "}{fmtSGD(Math.abs(netProfit))}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-blue-50">
              <span className="text-xs font-medium text-zinc-700">Profit Margin</span>
              <span className={`text-sm font-bold ${profitable ? "text-blue-600" : "text-red-600"}`}>{profitMargin}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg px-3 py-2 bg-zinc-50">
              <span className="text-xs font-medium text-zinc-700">Avg TMG Revenue / Job</span>
              <span className="text-sm font-bold text-zinc-900">{fmtSGD(avgJobRevenue)}</span>
            </div>
          </div>
        </Panel>
      </div>

      <p className="text-xs text-zinc-400 text-center pb-2">
        TMG Revenue = completed/final-paid/closed job totals. GoGoVan = net transport payout (actualPrice after GoGoVan platform fee).
        Staff Salary = monthly rate × months employed (prorated for current month), or hours logged × hourly rate for hourly staff.
        Receipts = approved expense claims only. Pending claims excluded until approved.
      </p>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
type Tab = "business" | "website" | "operations" | "pnl";

export default function Analytics() {
  const [tab, setTab] = useState<Tab>("business");
  const [days, setDays] = useState(30);
  const [webDays, setWebDays] = useState(7);

  const dayOptions = tab === "business" || tab === "operations" ? BIZ_DAY_OPTIONS : DAY_OPTIONS;
  const activeDays = tab === "website" ? webDays : days;
  const setActiveDays = tab === "website" ? setWebDays : setDays;

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "business",   label: "Business",   icon: BarChart2     },
    { key: "operations", label: "Operations", icon: Activity      },
    { key: "pnl",        label: "P&L",        icon: PiggyBank     },
    { key: "website",    label: "Website",    icon: Globe         },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] pt-14 lg:pl-56 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-zinc-400 mb-1">Management → Analytics</p>
              <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Analytics</h1>
              <p className="text-sm text-zinc-500 mt-1">Business intelligence &amp; site performance</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Tab switcher */}
              <div className="flex p-1 rounded-lg border border-zinc-200 bg-zinc-100 overflow-hidden">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setTab(key)} data-testid={`tab-${key}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      tab === key ? "bg-white text-zinc-900 shadow-sm border border-zinc-200" : "text-zinc-500 hover:text-zinc-700"
                    }`}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              {/* Day range — hidden on P&L tab (all-time data) */}
              {tab !== "pnl" && (
                <div className="flex p-1 rounded-lg border border-zinc-200 bg-zinc-100 overflow-hidden">
                  {dayOptions.map(opt => (
                    <button key={opt.value} onClick={() => setActiveDays(opt.value)} data-testid={`days-${opt.value}`}
                      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        activeDays === opt.value ? "bg-white text-zinc-900 shadow-sm border border-zinc-200" : "text-zinc-500 hover:text-zinc-700"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {tab === "business"   && <BusinessTab   days={days}    />}
        {tab === "operations" && <OperationsTab days={days}    />}
        {tab === "pnl"        && <PnLTab />}
        {tab === "website"    && <WebsiteTab    days={webDays} />}
      </div>
    </div>
  );
}
