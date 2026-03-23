import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import {
  BarChart2, MousePointerClick, Users, TrendingUp,
  Globe, ArrowRight, Eye, Smartphone, Monitor, Tablet,
  Clock, FileText, Percent, Layers, Megaphone, MapPin,
  RefreshCw,
} from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

type AnalyticsData = {
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

const DAY_OPTIONS = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

function DeltaBadge({ today, yesterday, lowerIsBetter }: { today: number; yesterday: number; lowerIsBetter?: boolean }) {
  if (yesterday === 0) return null;
  const pct = Math.round(((today - yesterday) / yesterday) * 100);
  const positive = lowerIsBetter ? pct <= 0 : pct >= 0;
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 ${positive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
      {pct >= 0 ? "+" : ""}{pct}%
    </span>
  );
}

function StatCard({ label, value, yesterdayValue, icon: Icon, format: fmt, lowerIsBetter }:
  { label: string; value: number; yesterdayValue: number; icon: any; format?: (v: number) => string; lowerIsBetter?: boolean }) {
  const display = fmt ? fmt(value) : value.toLocaleString();
  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-zinc-400" />
        </div>
        <DeltaBadge today={value} yesterday={yesterdayValue} lowerIsBetter={lowerIsBetter} />
      </div>
      <p className="text-2xl font-bold text-zinc-900 leading-none mb-1">{display}</p>
      <p className="text-xs text-zinc-500 mt-1">{label}</p>
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
  return String.fromCodePoint(...Array.from(code.toUpperCase()).map(c => 0x1F1E0 - 65 + c.charCodeAt(0)));
}

function sourceIcon(source: string) {
  const s = source.toLowerCase();
  if (s === "google") return "🔍";
  if (s === "facebook") return "📘";
  if (s === "instagram") return "📸";
  if (s === "tiktok") return "🎵";
  if (s === "whatsapp") return "💬";
  if (s === "direct") return "🔗";
  if (s === "internal") return "🏠";
  return "🌐";
}

// SEA-centric projection settings
const SEA_PROJ = { scale: 700, center: [108, 3] as [number, number] };
const WORLD_PROJ = { scale: 140, center: [10, 10] as [number, number] };

export default function Analytics() {
  const [days, setDays] = useState(7);
  const [mapView, setMapView] = useState<"sea" | "world">("sea");
  const [hoveredPin, setHoveredPin] = useState<{ text: string; x: number; y: number } | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/analytics", days],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/analytics?days=${days}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] pt-14 pb-24 flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const proj = mapView === "sea" ? SEA_PROJ : WORLD_PROJ;
  const maxTrend = Math.max(...data.trend.map(d => d.pageViews), 1);
  const maxSource = data.sources[0]?.count ?? 1;
  const funnelMax = data.funnel[0]?.count ?? 1;
  const maxHourly = Math.max(...data.hourly.map(h => h.count), 1);
  const totalDevices = data.devices.reduce((s, d) => s + d.count, 0) || 1;
  const activeHours = data.hourly.filter(h => h.hour >= 6);

  const mapPins = (mapView === "sea" ? data.cities : data.countries).filter(p => p.lat && p.lng);

  return (
    <div className="min-h-screen bg-[#F5F5F7] pt-14 lg:pl-56 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-zinc-400 mb-1">Management → Analytics</p>
              <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Analytics</h1>
              <p className="text-sm text-zinc-500 mt-1">Customer interactions on tmginstall.com</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex p-1 rounded-lg border border-zinc-200 bg-zinc-100 overflow-hidden">
                {DAY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setDays(opt.value)}
                    data-testid={`days-${opt.value}`}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                      days === opt.value ? "bg-white text-zinc-900 shadow-sm border border-zinc-200" : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => refetch()}
                data-testid="btn-refresh-analytics"
                className={`p-2 rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 transition-all ${isFetching ? "animate-spin" : ""}`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Today stats — 6 cards */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">Today vs Yesterday</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <StatCard label="Page Views"      value={data.today.pageViews}          yesterdayValue={data.yesterday.pageViews}          icon={Eye} />
            <StatCard label="Sessions"        value={data.today.sessions}           yesterdayValue={data.yesterday.sessions}           icon={Users} />
            <StatCard label="Est. Starts"     value={data.today.wizardStarts}       yesterdayValue={data.yesterday.wizardStarts}       icon={MousePointerClick} />
            <StatCard label="Leads"           value={data.today.wizardSubmits}      yesterdayValue={data.yesterday.wizardSubmits}      icon={TrendingUp} />
            <StatCard label="Bounce Rate"     value={data.today.bounceRate}         yesterdayValue={data.yesterday.bounceRate}         icon={Percent} format={v => `${v}%`} lowerIsBetter />
            <StatCard label="Pages/Session"   value={data.today.avgPagesPerSession} yesterdayValue={data.yesterday.avgPagesPerSession} icon={Layers} format={v => v.toFixed(1)} />
          </div>
        </div>

        {/* Trend chart */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">
              Page Views — Last {days} Days
            </h2>
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

        {/* City-level Map */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900">
                Visitor Map — {days}-Day Window
              </h2>
            </div>
            <div className="flex p-0.5 rounded-md border border-zinc-200 bg-zinc-100">
              <button
                onClick={() => setMapView("sea")}
                data-testid="map-view-sea"
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-sm transition-colors
                  ${mapView === "sea" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                SEA
              </button>
              <button
                onClick={() => setMapView("world")}
                data-testid="map-view-world"
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-sm transition-colors
                  ${mapView === "world" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                World
              </button>
            </div>
          </div>
          
          <div className="p-5">
            {mapPins.length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-xs text-slate-400">No geo data yet — appears within minutes of the first real visit.</p>
            </div>
          ) : (
            <>
              {/* Map with hover tooltip */}
              <div
                ref={mapContainerRef}
                className="relative rounded overflow-hidden bg-slate-50 border border-slate-100"
                onMouseLeave={() => setHoveredPin(null)}
              >
                <ComposableMap
                  projectionConfig={proj}
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
                  {mapPins.map((pin) => {
                    const label = mapView === "sea"
                      ? `${(pin as any).city}, ${pin.country} — ${pin.count} visit${pin.count !== 1 ? "s" : ""}`
                      : `${pin.country} — ${pin.count} visit${pin.count !== 1 ? "s" : ""}`;
                    return (
                      <Marker key={`${pin.lat}-${pin.lng}`} coordinates={[pin.lng, pin.lat]}>
                        <circle
                          r={Math.max(4, Math.min(mapView === "sea" ? 12 : 18, 4 + Math.sqrt(pin.count) * (mapView === "sea" ? 1.5 : 2)))}
                          fill="#000"
                          fillOpacity={0.8}
                          stroke="#fff"
                          strokeWidth={1.5}
                          style={{ cursor: "pointer" }}
                          onMouseEnter={(e: any) => {
                            const rect = mapContainerRef.current?.getBoundingClientRect();
                            if (rect) setHoveredPin({ text: label, x: e.clientX - rect.left, y: e.clientY - rect.top });
                          }}
                          onMouseLeave={() => setHoveredPin(null)}
                        />
                      </Marker>
                    );
                  })}
                </ComposableMap>

                {/* Floating tooltip */}
                {hoveredPin && (
                  <div
                    className="absolute pointer-events-none z-10 bg-black text-white text-[11px] font-semibold px-2 py-1 whitespace-nowrap shadow-lg"
                    style={{
                      left: Math.min(hoveredPin.x + 10, (mapContainerRef.current?.offsetWidth ?? 400) - 220),
                      top: Math.max(hoveredPin.y - 30, 4),
                    }}
                  >
                    <MapPin className="w-3 h-3 inline mr-1 opacity-70" />
                    {hoveredPin.text}
                  </div>
                )}
              </div>

              {/* City + Country list side by side */}
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                {/* Top cities */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 mb-2">Top Cities</p>
                  {data.cities.length === 0 ? (
                    <p className="text-xs text-slate-400">City data appears once geo lookup resolves</p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.cities.slice(0, 8).map(({ city, country, countryCode, count }) => (
                        <div key={`${city}-${countryCode}`} className="flex items-center gap-2">
                          <span className="text-base leading-none shrink-0">{countryFlag(countryCode)}</span>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-slate-700 font-medium">{city}</span>
                            <span className="text-[10px] text-slate-400 ml-1">{country}</span>
                          </div>
                          <span className="text-xs font-black text-slate-900 shrink-0">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top countries */}
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
            </>
          )}
          </div>
        </div>

        {/* Devices | Sources | Funnel */}
        <div className="grid sm:grid-cols-3 gap-4">

          {/* Devices */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">Devices</h2>
            </div>
            <div className="p-5">
              {data.devices.length === 0 ? (
                <p className="text-sm text-zinc-500">No data yet</p>
              ) : (
                <div className="space-y-4">
                  {data.devices.map(({ device, count }) => {
                    const Icon = deviceIcon(device);
                    const pct = Math.round((count / totalDevices) * 100);
                    return (
                      <div key={device}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Icon className="w-4 h-4 text-zinc-400" />
                          <span className="text-sm font-medium text-zinc-700 capitalize flex-1">{device}</span>
                          <span className="text-sm font-bold text-zinc-900">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 w-full rounded-full overflow-hidden">
                          <div className={`h-full ${deviceColor(device)} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Traffic Sources */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">Traffic Sources</h2>
            </div>
            <div className="p-5">
              {data.sources.length === 0 ? (
                <p className="text-sm text-zinc-500">No data yet</p>
              ) : (
                <div className="space-y-4">
                  {data.sources.slice(0, 7).map(({ source, count }) => (
                    <div key={source}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-zinc-700 flex-1 flex items-center gap-1.5 truncate">
                          <span>{sourceIcon(source)}</span>
                          <span className="truncate">{source}</span>
                        </span>
                        <span className="text-sm font-bold text-zinc-900 ml-2 shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-100 w-full rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-800 rounded-full" style={{ width: `${(count / maxSource) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Conversion Funnel */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h2 className="text-sm font-semibold text-zinc-900">Conversion Funnel</h2>
            </div>
            <div className="p-5">
              <div className="space-y-4">
                {data.funnel.map(({ step, count }, i) => {
                  const pct = funnelMax > 0 ? Math.round((count / funnelMax) * 100) : 0;
                  const convPct = i > 0 && data.funnel[i - 1].count > 0
                    ? Math.round((count / data.funnel[i - 1].count) * 100) : null;
                  return (
                    <div key={step}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-zinc-300 shrink-0" />}
                          <span className="text-sm font-medium text-zinc-700">{step}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {convPct !== null && (
                            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${convPct >= 20 ? "bg-emerald-50 text-emerald-700" : convPct >= 5 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                              {convPct}%
                            </span>
                          )}
                          <span className="text-sm font-bold text-zinc-900">{count}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-zinc-100 w-full rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-800 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Hourly Traffic + Top Pages */}
        <div className="grid sm:grid-cols-2 gap-4">

          {/* Hourly Traffic */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900">Traffic by Hour — Today</h2>
            </div>
            <div className="p-5">
              <div className="flex items-end gap-0.5 h-24">
                {activeHours.map(({ hour, count }) => (
                  <div
                    key={hour}
                    className="flex-1 flex flex-col items-center gap-0.5 group"
                    title={`${hour}:00 — ${count} view${count !== 1 ? "s" : ""}`}
                  >
                    <div className="w-full bg-zinc-800 rounded-t-[1px] transition-opacity group-hover:opacity-70" style={{ height: `${Math.max(2, (count / maxHourly) * 80)}px` }} />
                    {hour % 4 === 0 && (
                      <span className="text-[10px] text-zinc-400 mt-1">{hour}h</span>
                    )}
                  </div>
                ))}
              </div>
              {data.today.pageViews === 0 && (
                <p className="text-sm text-zinc-500 mt-4">No visits today yet</p>
              )}
            </div>
          </div>

          {/* Top Pages */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900">Top Pages — {days} Days</h2>
            </div>
            <div className="p-5">
              {data.topPages.length === 0 ? (
                <p className="text-sm text-zinc-500">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {data.topPages.map(({ page, count }) => {
                    const maxPage = data.topPages[0]?.count ?? 1;
                    return (
                      <div key={page}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-mono text-zinc-600 flex-1 truncate">{page || "/"}</span>
                          <span className="text-sm font-bold text-zinc-900 shrink-0">{count}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 w-full rounded-full overflow-hidden">
                          <div className="h-full bg-zinc-400 rounded-full" style={{ width: `${(count / maxPage) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* UTM Campaigns (only show if there's data) */}
        {data.utmCampaigns.length > 0 && (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-900">UTM Campaigns — {days} Days</h2>
            </div>
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
                      <div className="h-1.5 bg-zinc-100 w-full rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(count / maxC) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Recent Events */}
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Recent Events</h2>
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-zinc-100 text-zinc-600">{data.recent.length} shown</span>
          </div>
          <div className="p-0">
            {data.recent.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-500">
                No events yet. Events appear as customers visit tmginstall.com.
              </p>
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
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${eventColor(evt.event)}`}>
                              {eventLabel(evt.event)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-600 font-mono text-xs truncate max-w-[150px]">
                            {evt.page ?? ""}{evt.label ? ` · ${evt.label}` : ""}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="flex items-center gap-1.5 text-zinc-700">
                              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className="truncate max-w-[140px]">{locationStr}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {evt.deviceType && (
                              <span className="text-zinc-500 capitalize">{evt.deviceType}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-violet-600">
                            {evt.utmCampaign && (
                              <span className="truncate max-w-[100px] inline-block">📣 {evt.utmCampaign}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-400 whitespace-nowrap text-xs">
                            {format(new Date(evt.createdAt), "d MMM HH:mm")}
                          </td>
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
    </div>
  );
}
