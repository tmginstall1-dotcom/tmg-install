import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { BarChart2, MousePointerClick, Users, TrendingUp, Globe, ArrowRight, Eye } from "lucide-react";

type AnalyticsData = {
  today: { pageViews: number; sessions: number; wizardStarts: number; wizardSubmits: number };
  yesterday: { pageViews: number; sessions: number; wizardStarts: number; wizardSubmits: number };
  last7Days: { date: string; pageViews: number }[];
  sources: { source: string; count: number }[];
  funnel: { step: string; count: number }[];
  recent: {
    id: number; event: string; page: string | null; label: string | null;
    referrer: string | null; utmSource: string | null; sessionId: string | null;
    createdAt: string;
  }[];
};

function delta(today: number, yesterday: number) {
  if (yesterday === 0) return null;
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  return pct;
}

function DeltaBadge({ today, yesterday }: { today: number; yesterday: number }) {
  const pct = delta(today, yesterday);
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 ${up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
      {up ? "+" : ""}{pct}%
    </span>
  );
}

function StatCard({ label, value, yesterdayValue, icon: Icon }: { label: string; value: number; yesterdayValue: number; icon: any }) {
  return (
    <div className="bg-white border border-black/[0.07] p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-8 h-8 bg-black flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <DeltaBadge today={value} yesterday={yesterdayValue} />
      </div>
      <p className="text-2xl font-black text-slate-900 leading-none mb-1">{value.toLocaleString()}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
    </div>
  );
}

function eventLabel(event: string) {
  switch (event) {
    case "page_view": return "Page View";
    case "cta_click": return "CTA Click";
    case "wizard_start": return "Estimate Start";
    case "wizard_submit": return "Lead Submit";
    default: return event;
  }
}

function eventColor(event: string) {
  switch (event) {
    case "page_view": return "bg-slate-100 text-slate-600";
    case "cta_click": return "bg-blue-50 text-blue-600";
    case "wizard_start": return "bg-violet-50 text-violet-600";
    case "wizard_submit": return "bg-emerald-50 text-emerald-600";
    default: return "bg-gray-100 text-gray-600";
  }
}

function sourceLabel(src: string) {
  return src || "Direct";
}

export default function Analytics() {
  const { data, isLoading } = useQuery<AnalyticsData>({ queryKey: ["/api/admin/analytics"] });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-14 pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxPageViews = Math.max(...data.last7Days.map(d => d.pageViews), 1);
  const maxSource = data.sources[0]?.count ?? 1;

  const funnelMax = data.funnel[0]?.count ?? 1;

  return (
    <div className="min-h-screen bg-slate-50 pt-14 pb-24">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="font-black text-xl text-slate-900 uppercase tracking-[0.08em]">Site Analytics</h1>
          <p className="text-xs text-slate-400 mt-1">Customer interactions on tmginstall.com</p>
        </div>

        {/* Today stats */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 mb-3">Today vs Yesterday</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Page Views" value={data.today.pageViews} yesterdayValue={data.yesterday.pageViews} icon={Eye} />
            <StatCard label="Sessions" value={data.today.sessions} yesterdayValue={data.yesterday.sessions} icon={Users} />
            <StatCard label="Estimate Starts" value={data.today.wizardStarts} yesterdayValue={data.yesterday.wizardStarts} icon={MousePointerClick} />
            <StatCard label="Leads Submitted" value={data.today.wizardSubmits} yesterdayValue={data.yesterday.wizardSubmits} icon={TrendingUp} />
          </div>
        </div>

        {/* 7-day bar chart */}
        <div className="bg-white border border-black/[0.07] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 mb-4">Page Views — Last 7 Days</p>
          <div className="flex items-end gap-2 h-28">
            {data.last7Days.map(({ date, pageViews }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-slate-400 font-semibold">{pageViews || ""}</span>
                <div
                  className="w-full bg-black transition-all"
                  style={{ height: `${Math.max(4, (pageViews / maxPageViews) * 80)}px` }}
                />
                <span className="text-[9px] text-slate-400 whitespace-nowrap">
                  {format(parseISO(date), "d MMM")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Traffic Sources + Funnel side by side */}
        <div className="grid sm:grid-cols-2 gap-3">

          {/* Traffic Sources */}
          <div className="bg-white border border-black/[0.07] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Traffic Sources — 7 days</p>
            </div>
            {data.sources.length === 0 ? (
              <p className="text-xs text-slate-400">No data yet</p>
            ) : (
              <div className="space-y-3">
                {data.sources.map(({ source, count }) => (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700">{sourceLabel(source)}</span>
                      <span className="text-xs font-black text-slate-900">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 w-full">
                      <div className="h-full bg-black transition-all" style={{ width: `${(count / maxSource) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversion Funnel */}
          <div className="bg-white border border-black/[0.07] p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Conversion Funnel — 7 days</p>
            </div>
            <div className="space-y-3">
              {data.funnel.map(({ step, count }, i) => {
                const pct = funnelMax > 0 ? Math.round((count / funnelMax) * 100) : 0;
                const convPct = i > 0 && data.funnel[i - 1].count > 0
                  ? Math.round((count / data.funnel[i - 1].count) * 100)
                  : null;
                return (
                  <div key={step}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {i > 0 && <ArrowRight className="w-3 h-3 text-slate-300" />}
                        <span className="text-xs font-semibold text-slate-700">{step}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {convPct !== null && (
                          <span className="text-[10px] text-slate-400">{convPct}% conv.</span>
                        )}
                        <span className="text-xs font-black text-slate-900">{count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 w-full">
                      <div className="h-full bg-black transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white border border-black/[0.07]">
          <div className="px-5 py-4 border-b border-black/[0.06]">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Recent Events</p>
          </div>
          {data.recent.length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-400">No events recorded yet. Events will appear here once customers visit the site.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {data.recent.map((evt) => (
                <div key={evt.id} data-testid={`event-row-${evt.id}`}
                  className="flex items-center gap-3 px-5 py-3">
                  <span className={`text-[10px] font-black uppercase tracking-[0.08em] px-2 py-1 shrink-0 ${eventColor(evt.event)}`}>
                    {eventLabel(evt.event)}
                  </span>
                  <span className="text-xs text-slate-500 font-mono truncate flex-1">{evt.page ?? ""}{evt.label ? ` · ${evt.label}` : ""}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {evt.utmSource ?? (evt.referrer ? (() => { try { return new URL(evt.referrer!).hostname.replace("www.", ""); } catch { return "—"; } })() : "Direct")}
                  </span>
                  <span className="text-[10px] text-slate-300 shrink-0">
                    {format(new Date(evt.createdAt), "d MMM HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
