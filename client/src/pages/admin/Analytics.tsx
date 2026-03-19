import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import {
  BarChart2, MousePointerClick, Users, TrendingUp,
  Globe, ArrowRight, Eye, Smartphone, Monitor, Tablet,
  Clock, FileText,
} from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type AnalyticsData = {
  today: { pageViews: number; sessions: number; wizardStarts: number; wizardSubmits: number };
  yesterday: { pageViews: number; sessions: number; wizardStarts: number; wizardSubmits: number };
  last7Days: { date: string; pageViews: number }[];
  sources: { source: string; count: number }[];
  funnel: { step: string; count: number }[];
  countries: { country: string; countryCode: string; count: number; lat: number; lng: number }[];
  devices: { device: string; count: number }[];
  hourly: { hour: number; count: number }[];
  topPages: { page: string; count: number }[];
  recent: {
    id: number; event: string; page: string | null; label: string | null;
    referrer: string | null; utmSource: string | null; sessionId: string | null;
    country: string | null; city: string | null; deviceType: string | null;
    createdAt: string;
  }[];
};

function DeltaBadge({ today, yesterday }: { today: number; yesterday: number }) {
  if (yesterday === 0) return null;
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  const up = pct >= 0;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 ${up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
      {up ? "+" : ""}{pct}%
    </span>
  );
}

function StatCard({ label, value, yesterdayValue, icon: Icon }: { label: string; value: number; yesterdayValue: number; icon: any }) {
  return (
    <div className="bg-white border border-black/[0.07] p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-7 h-7 bg-black flex items-center justify-center shrink-0">
          <Icon className="w-3 h-3 text-white" />
        </div>
        <DeltaBadge today={value} yesterday={yesterdayValue} />
      </div>
      <p className="text-2xl font-black text-slate-900 leading-none mb-1">{value.toLocaleString()}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
    </div>
  );
}

function deviceIcon(device: string) {
  if (device === "mobile") return Smartphone;
  if (device === "tablet") return Tablet;
  return Monitor;
}

function deviceColor(device: string) {
  if (device === "mobile") return "bg-violet-500";
  if (device === "tablet") return "bg-sky-500";
  return "bg-slate-800";
}

function eventLabel(event: string) {
  switch (event) {
    case "page_view": return "View";
    case "cta_click": return "Click";
    case "wizard_start": return "Start";
    case "wizard_submit": return "Submit";
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

function countryFlag(code: string) {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E0 - 65 + c.charCodeAt(0)));
}

export default function Analytics() {
  const { data, isLoading } = useQuery<AnalyticsData>({ queryKey: ["/api/admin/analytics"], refetchInterval: 60_000 });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-14 pb-24 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const maxPageViews = Math.max(...data.last7Days.map(d => d.pageViews), 1);
  const maxSource = data.sources[0]?.count ?? 1;
  const funnelMax = data.funnel[0]?.count ?? 1;
  const maxHourly = Math.max(...data.hourly.map(h => h.count), 1);
  const totalDevices = data.devices.reduce((s, d) => s + d.count, 0) || 1;

  // Only show hours 6-23 to avoid empty night hours dominating
  const activeHours = data.hourly.filter(h => h.hour >= 6);

  return (
    <div className="min-h-screen bg-slate-50 pt-14 lg:pl-56 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div>
          <h1 className="font-black text-xl text-slate-900 uppercase tracking-[0.08em]">Site Analytics</h1>
          <p className="text-xs text-slate-400 mt-0.5">Customer interactions on tmginstall.com · Last 7 days</p>
        </div>

        {/* Today stats */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 mb-2">Today vs Yesterday</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Page Views"      value={data.today.pageViews}     yesterdayValue={data.yesterday.pageViews}     icon={Eye} />
            <StatCard label="Sessions"        value={data.today.sessions}      yesterdayValue={data.yesterday.sessions}      icon={Users} />
            <StatCard label="Estimate Starts" value={data.today.wizardStarts}  yesterdayValue={data.yesterday.wizardStarts}  icon={MousePointerClick} />
            <StatCard label="Leads Submitted" value={data.today.wizardSubmits} yesterdayValue={data.yesterday.wizardSubmits} icon={TrendingUp} />
          </div>
        </div>

        {/* 7-day bar chart */}
        <div className="bg-white border border-black/[0.07] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 mb-4">
            Page Views — Last 7 Days
          </p>
          <div className="flex items-end gap-1.5 h-24">
            {data.last7Days.map(({ date, pageViews }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-slate-400 font-semibold leading-none">{pageViews || ""}</span>
                <div className="w-full bg-black" style={{ height: `${Math.max(3, (pageViews / maxPageViews) * 72)}px` }} />
                <span className="text-[9px] text-slate-400 whitespace-nowrap">{format(parseISO(date), "d MMM")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* World Map */}
        <div className="bg-white border border-black/[0.07] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
              Visitor Map — 7 Days
            </p>
          </div>
          {data.countries.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-xs text-slate-400">No geo data yet — location data appears within minutes of the first real visit.</p>
            </div>
          ) : (
            <>
              <div className="rounded overflow-hidden bg-slate-50 border border-slate-100">
                <ComposableMap
                  projectionConfig={{ scale: 140, center: [10, 10] }}
                  style={{ width: "100%", height: "auto" }}
                >
                  <Geographies geography={GEO_URL}>
                    {({ geographies }) =>
                      geographies.map((geo) => (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill="#e2e8f0"
                          stroke="#cbd5e1"
                          strokeWidth={0.4}
                          style={{ default: { outline: "none" }, hover: { outline: "none", fill: "#cbd5e1" }, pressed: { outline: "none" } }}
                        />
                      ))
                    }
                  </Geographies>
                  {data.countries.map(({ country, lat, lng, count }) => (
                    lat && lng ? (
                      <Marker key={country} coordinates={[lng, lat]}>
                        <circle
                          r={Math.max(4, Math.min(18, 4 + Math.sqrt(count) * 2))}
                          fill="#000"
                          fillOpacity={0.75}
                          stroke="#fff"
                          strokeWidth={1}
                        />
                        <title>{country}: {count} visit{count !== 1 ? "s" : ""}</title>
                      </Marker>
                    ) : null
                  ))}
                </ComposableMap>
              </div>
              {/* Country list */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                {data.countries.slice(0, 9).map(({ country, countryCode, count }) => (
                  <div key={country} className="flex items-center gap-2">
                    <span className="text-base leading-none">{countryFlag(countryCode)}</span>
                    <span className="text-xs text-slate-700 font-medium flex-1 truncate">{country}</span>
                    <span className="text-xs font-black text-slate-900">{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 3-column row: Devices | Sources | Funnel */}
        <div className="grid sm:grid-cols-3 gap-3">

          {/* Devices */}
          <div className="bg-white border border-black/[0.07] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 mb-4">Devices</p>
            {data.devices.length === 0 ? (
              <p className="text-xs text-slate-400">No data yet</p>
            ) : (
              <div className="space-y-3">
                {data.devices.map(({ device, count }) => {
                  const Icon = deviceIcon(device);
                  const pct = Math.round((count / totalDevices) * 100);
                  return (
                    <div key={device}>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-700 capitalize flex-1">{device}</span>
                        <span className="text-xs font-black text-slate-900">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 w-full">
                        <div className={`h-full ${deviceColor(device)}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Traffic Sources */}
          <div className="bg-white border border-black/[0.07] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 mb-4">Traffic Sources</p>
            {data.sources.length === 0 ? (
              <p className="text-xs text-slate-400">No data yet</p>
            ) : (
              <div className="space-y-3">
                {data.sources.slice(0, 6).map(({ source, count }) => (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700 truncate flex-1">{source}</span>
                      <span className="text-xs font-black text-slate-900 ml-2">{count}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 w-full">
                      <div className="h-full bg-black" style={{ width: `${(count / maxSource) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conversion Funnel */}
          <div className="bg-white border border-black/[0.07] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 mb-4">Conversion Funnel</p>
            <div className="space-y-3">
              {data.funnel.map(({ step, count }, i) => {
                const pct = funnelMax > 0 ? Math.round((count / funnelMax) * 100) : 0;
                const convPct = i > 0 && data.funnel[i - 1].count > 0
                  ? Math.round((count / data.funnel[i - 1].count) * 100) : null;
                return (
                  <div key={step}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-slate-300 shrink-0" />}
                        <span className="text-xs font-semibold text-slate-700">{step}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {convPct !== null && <span className="text-[10px] text-slate-400">{convPct}%</span>}
                        <span className="text-xs font-black text-slate-900">{count}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 w-full">
                      <div className="h-full bg-black" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Hourly Traffic + Top Pages side by side */}
        <div className="grid sm:grid-cols-2 gap-3">

          {/* Hourly Traffic */}
          <div className="bg-white border border-black/[0.07] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Traffic by Hour — Today</p>
            </div>
            <div className="flex items-end gap-0.5 h-20">
              {activeHours.map(({ hour, count }) => (
                <div key={hour} className="flex-1 flex flex-col items-center gap-0.5" title={`${hour}:00 — ${count} view${count !== 1 ? "s" : ""}`}>
                  <div className="w-full bg-black" style={{ height: `${Math.max(2, (count / maxHourly) * 64)}px` }} />
                  {hour % 4 === 0 && (
                    <span className="text-[8px] text-slate-400">{hour}h</span>
                  )}
                </div>
              ))}
            </div>
            {data.today.pageViews === 0 && (
              <p className="text-xs text-slate-400 mt-2">No visits today yet</p>
            )}
          </div>

          {/* Top Pages */}
          <div className="bg-white border border-black/[0.07] p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Top Pages — 7 Days</p>
            </div>
            {data.topPages.length === 0 ? (
              <p className="text-xs text-slate-400">No data yet</p>
            ) : (
              <div className="space-y-2">
                {data.topPages.map(({ page, count }) => (
                  <div key={page} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-600 flex-1 truncate">{page}</span>
                    <span className="text-xs font-black text-slate-900 shrink-0">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white border border-black/[0.07]">
          <div className="px-5 py-4 border-b border-black/[0.06] flex items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Recent Events</p>
          </div>
          {data.recent.length === 0 ? (
            <p className="px-5 py-6 text-xs text-slate-400">
              No events recorded yet. Events appear here as customers visit tmginstall.com.
            </p>
          ) : (
            <div className="divide-y divide-slate-50 overflow-x-auto">
              {data.recent.map((evt) => (
                <div key={evt.id} data-testid={`event-row-${evt.id}`}
                  className="flex items-center gap-2 px-4 py-2.5 min-w-0">
                  <span className={`text-[9px] font-black uppercase tracking-[0.06em] px-1.5 py-1 shrink-0 ${eventColor(evt.event)}`}>
                    {eventLabel(evt.event)}
                  </span>
                  <span className="text-xs text-slate-500 font-mono truncate w-24">{evt.page ?? ""}{evt.label ? ` · ${evt.label}` : ""}</span>
                  {evt.deviceType && (
                    <span className="text-[10px] text-slate-400 shrink-0 hidden sm:block">{evt.deviceType}</span>
                  )}
                  <span className="text-[10px] text-slate-400 shrink-0 hidden sm:block truncate max-w-[100px]">
                    {evt.city ? `${evt.city}, ` : ""}{evt.country ?? (evt.utmSource ?? (evt.referrer ? (() => { try { return new URL(evt.referrer!).hostname.replace("www.", ""); } catch { return "—"; } })() : "Direct"))}
                  </span>
                  <span className="text-[10px] text-slate-300 shrink-0 ml-auto">
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
