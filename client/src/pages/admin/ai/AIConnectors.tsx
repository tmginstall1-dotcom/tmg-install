import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  ChevronLeft, TrendingUp, BarChart3, Search, Gauge,
  RefreshCw, CheckCircle2, AlertCircle, Clock, Database,
  ChevronDown, ChevronUp, Zap, CalendarClock, Play,
  AlertTriangle, Cpu, ArrowRight,
  Rocket, FlaskConical, ShieldOff, Shield, ToggleLeft, ToggleRight, KeyRound, XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ConnectorStatus = {
  name: string;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  syncError: string | null;
  configured: boolean;
  missing: string[];
  rowCount: number;
  isStale: boolean;
  staleReason: string | null;
  scheduleIntervalHours: number;
  nextSyncAt: string | null;
  schedulerEnabled: boolean;
  // Execution fields (Phase 7)
  executionEnabled: boolean;
  executionTestMode: boolean;
  executionReady: boolean;
  missingExecCreds: string[];
};

type ScheduleJob = {
  name: string;
  intervalHours: number;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  nextSyncAt: string | null;
  isOverdue: boolean;
  flagEnabled: boolean;
};

type ScheduleInfo = {
  schedulerEnabled: boolean;
  jobs: ScheduleJob[];
};

type PageSpeedRow = {
  id: number;
  url: string;
  strategy: string;
  performanceScore: number | null;
  accessibilityScore: number | null;
  seoScore: number | null;
  bestPracticesScore: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  clsScore: string | null;
  ttfbMs: number | null;
  createdAt: string;
};

type GscRow = {
  id: number;
  query: string | null;
  page: string | null;
  clicks: number;
  impressions: number;
  ctr: string | null;
  position: string | null;
  device: string | null;
};

const CONNECTOR_DEFS = [
  {
    key: "google_ads",
    label: "Google Ads",
    Icon: TrendingUp,
    iconColor: "text-blue-400",
    bgGrad: "from-blue-500/10 to-indigo-500/5 border-blue-500/20",
    description: "Campaign & ad group performance — spend, clicks, conversions by day.",
    flagKey: "ai_google_ads_sync_enabled",
    credentials: ["GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN"],
    syncNote: "After sync, data is visible in Ads Intelligence.",
    supportsExecution: true,
    execFlagKey: "ai_google_ads_execution_enabled",
  },
  {
    key: "meta_ads",
    label: "Meta Ads",
    Icon: BarChart3,
    iconColor: "text-purple-400",
    bgGrad: "from-purple-500/10 to-indigo-500/5 border-purple-500/20",
    description: "Facebook & Instagram campaign/adset insights — spend, leads, clicks by day.",
    flagKey: "ai_meta_ads_sync_enabled",
    credentials: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
    syncNote: "META_APP_ID + META_APP_SECRET are already configured.",
    supportsExecution: true,
    execFlagKey: "ai_meta_ads_execution_enabled",
  },
  {
    key: "search_console",
    label: "Search Console",
    Icon: Search,
    iconColor: "text-emerald-400",
    bgGrad: "from-emerald-500/10 to-teal-500/5 border-emerald-500/20",
    description: "Organic keyword performance — clicks, impressions, CTR, average position.",
    flagKey: "ai_search_console_enabled",
    credentials: ["GSC_CLIENT_ID", "GSC_CLIENT_SECRET", "GSC_REFRESH_TOKEN"],
    syncNote: "Optional: GSC_SITE_URL (defaults to https://www.tmginstall.com/).",
  },
  {
    key: "pagespeed",
    label: "PageSpeed Insights",
    Icon: Gauge,
    iconColor: "text-amber-400",
    bgGrad: "from-amber-500/10 to-orange-500/5 border-amber-500/20",
    description: "Core Web Vitals + Lighthouse scores. No credentials required.",
    flagKey: "ai_pagespeed_enabled",
    credentials: [] as string[],
    syncNote: "Optional: GOOGLE_API_KEY (avoids rate limits). PAGESPEED_TARGET_URL to override site.",
  },
];

function ScoreCircle({ score, label }: { score: number | null; label: string }) {
  const color = score == null ? "text-slate-500"
    : score >= 90 ? "text-emerald-400"
    : score >= 50 ? "text-amber-400"
    : "text-red-400";
  const ring = score == null ? "border-slate-700/60"
    : score >= 90 ? "border-emerald-500/50"
    : score >= 50 ? "border-amber-500/50"
    : "border-red-500/50";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-14 h-14 rounded-full border-2 ${ring} bg-black/20 flex items-center justify-center`}>
        <span className={`text-lg font-bold ${color}`}>{score ?? "—"}</span>
      </div>
      <span className="text-[10px] text-slate-500 text-center leading-tight">{label}</span>
    </div>
  );
}

function timeAgo(ts: string | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AIConnectors() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [syncingName, setSyncingName] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: connectors, isLoading } = useQuery<Record<string, ConnectorStatus>>({
    queryKey: ["/api/ai/connectors/status"],
  });
  const { data: psData } = useQuery<{ mobile: PageSpeedRow | null; desktop: PageSpeedRow | null }>({
    queryKey: ["/api/ai/pagespeed/data"],
  });
  const { data: gscRows = [] } = useQuery<GscRow[]>({
    queryKey: ["/api/ai/search-console/data"],
    queryFn: () => fetch("/api/ai/search-console/data?limit=20", { credentials: "include" }).then(r => r.json()),
  });
  const { data: rawFlags = [] } = useQuery<any[]>({ queryKey: ["/api/ai/flags"] });
  const flags = rawFlags.reduce((acc: Record<string, boolean>, f: any) => { acc[f.key] = f.value; return acc; }, {});

  const { data: scheduleData } = useQuery<ScheduleInfo>({
    queryKey: ["/api/ai/connectors/schedule"],
    refetchInterval: 60_000,
  });

  const sync = useMutation({
    mutationFn: (name: string) => apiRequest("POST", `/api/ai/connectors/${name}/sync`, {}),
    onMutate: (name) => setSyncingName(name),
    onSettled: () => {
      setSyncingName(null);
      qc.invalidateQueries({ queryKey: ["/api/ai/connectors/status"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/connectors/schedule"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/pagespeed/data"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/search-console/data"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/ads/snapshots"] });
    },
    onSuccess: (data: any) => {
      const msg = data?.results
        ? `Scored: ${(data.results as any[]).map(r => `${r.strategy} ${r.performanceScore ?? "err"}/100`).join(" · ")}`
        : `${data?.inserted ?? 0} rows imported`;
      toast({ title: "Sync complete", description: msg });
    },
    onError: (err: any) => toast({ title: "Sync failed", description: err.message ?? "Unknown error", variant: "destructive" }),
  });

  const analyze = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/connectors/analyze", {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/ai/ads/recommendations"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/site/recommendations"] });
      const total = data?.total ?? 0;
      toast({
        title: total > 0 ? `Analysis complete — ${total} signal${total !== 1 ? "s" : ""} generated` : "Analysis complete — no new signals",
        description: total > 0
          ? `${data.adsSignals ?? 0} ads · ${data.gscSignals ?? 0} GSC · ${data.speedSignals ?? 0} speed (${data.skipped ?? 0} dupes skipped)`
          : "All existing signals are still pending — no duplicates were created.",
      });
    },
    onError: (err: any) => toast({ title: "Analysis failed", description: err.message ?? "Unknown error", variant: "destructive" }),
  });

  const execConfig = useMutation({
    mutationFn: ({ name, body }: { name: string; body: { executionEnabled?: boolean; testMode?: boolean } }) =>
      apiRequest("PATCH", `/api/ai/connectors/${name}/execution-config`, body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/ai/connectors/status"] });
      const label = "executionEnabled" in vars.body
        ? (vars.body.executionEnabled ? "Execution enabled" : "Execution disabled")
        : (vars.body.testMode ? "Test mode enabled" : "Live mode enabled");
      toast({ title: label, description: `Updated for ${vars.name}.` });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const toggleExpand = (key: string) => setExpanded(p => ({ ...p, [key]: !p[key] }));

  return (
    <div className="pt-14 pb-20 lg:pb-6 lg:pl-56 min-h-screen bg-[#0B0F19]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin/ai">
              <button className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0">
                <ChevronLeft className="w-5 h-5" />
              </button>
            </Link>
            <Database className="w-6 h-6 text-violet-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white">Data Connectors</h1>
              <p className="text-xs text-slate-500 truncate">Live API feeds — Google Ads · Meta · Search Console · PageSpeed</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto shrink-0">
            <button
              onClick={() => analyze.mutate()}
              disabled={analyze.isPending}
              data-testid="button-analyze-connectors"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Cpu className="w-4 h-4" />
              {analyze.isPending ? "Analyzing…" : "Analyze Now"}
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              <span className="text-xs font-semibold text-violet-400">Read-only imports</span>
            </div>
          </div>
        </div>

        {/* Connector Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CONNECTOR_DEFS.map(def => {
              const cfg = connectors?.[def.key];
              const isSyncing = syncingName === def.key;
              const flagOn = flags[def.flagKey] ?? false;
              const isExpanded = expanded[def.key] ?? false;
              const isConfigured = cfg?.configured ?? def.credentials.length === 0;

              return (
                <div key={def.key} data-testid={`connector-card-${def.key}`}
                  className={`p-5 rounded-2xl bg-gradient-to-br border space-y-3 ${def.bgGrad}`}>

                  {/* Card Header */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                      <def.Icon className={`w-5 h-5 ${def.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{def.label}</span>
                        {isConfigured ? (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                            <CheckCircle2 className="w-2.5 h-2.5" />{def.credentials.length === 0 ? "Ready" : "Configured"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
                            <AlertCircle className="w-2.5 h-2.5" /> Not Configured
                          </span>
                        )}
                        {cfg?.lastSyncStatus === "error" && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400">
                            Last sync failed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{def.description}</p>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3" />{cfg?.rowCount ?? 0} rows
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />{timeAgo(cfg?.lastSyncAt ?? null)}
                    </span>
                    {!flagOn && (
                      <span className="flex items-center gap-1 text-amber-500/60">
                        <Zap className="w-3 h-3" /> Flag OFF
                      </span>
                    )}
                  </div>

                  {/* Stale data warning */}
                  {cfg?.isStale && cfg.configured && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-500/8 border border-amber-500/20 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-amber-300/90 leading-relaxed">
                        {cfg.staleReason === "never_synced" && "No data yet — run Sync Now to fetch your first import."}
                        {cfg.staleReason === "last_sync_failed" && "Last sync failed. Data may be outdated — retry below."}
                        {cfg.staleReason === "overdue" && `Data overdue — last synced ${timeAgo(cfg.lastSyncAt ?? null)}.${cfg.schedulerEnabled ? " Scheduler will auto-retry." : " Enable the scheduler or sync manually."}`}
                        {cfg.staleReason === "zero_rows" && "Sync succeeded but returned 0 rows. Check credentials and API response."}
                      </p>
                    </div>
                  )}

                  {/* Next sync info (when scheduler on + fresh data) */}
                  {cfg?.nextSyncAt && !cfg.isStale && cfg.schedulerEnabled && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <CalendarClock className="w-3 h-3" />
                      Next auto-sync {new Date(cfg.nextSyncAt) < new Date() ? "imminent" : `~${timeAgo(cfg.nextSyncAt)}`}
                    </div>
                  )}

                  {/* Sync error */}
                  {cfg?.syncError && cfg.lastSyncStatus === "error" && (
                    <div className="p-2.5 bg-red-500/5 border border-red-500/15 rounded-lg">
                      <p className="text-[11px] text-red-400 break-words line-clamp-2">{cfg.syncError}</p>
                    </div>
                  )}

                  {/* Missing credentials */}
                  {(cfg?.missing?.length ?? 0) > 0 && (
                    <div className="space-y-1.5">
                      <button onClick={() => toggleExpand(def.key)}
                        className="flex items-center gap-1 text-xs text-amber-400/80 hover:text-amber-300 transition-colors">
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {cfg?.missing.length} credential{cfg!.missing.length !== 1 ? "s" : ""} needed in Secrets
                      </button>
                      {isExpanded && (
                        <div className="ml-4 space-y-1">
                          {cfg?.missing.map(k => (
                            <div key={k} className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500/50 shrink-0" />
                              <code className="text-[11px] text-amber-300/80 font-mono">{k}</code>
                            </div>
                          ))}
                          {def.syncNote && (
                            <p className="text-[10px] text-slate-600 mt-1.5">{def.syncNote}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Note for ready connectors */}
                  {def.credentials.length === 0 && def.syncNote && (
                    <p className="text-[11px] text-slate-600">{def.syncNote}</p>
                  )}

                  {/* ── Execution Readiness Panel (Google Ads + Meta only) ── */}
                  {(def as any).supportsExecution && (
                    <div className="mt-1 border-t border-white/5 pt-3 space-y-2.5">
                      {/* Section header + overall status badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Rocket className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                        <span className="text-[11px] font-bold uppercase text-violet-400 tracking-wider">Platform Execution</span>
                        {cfg?.executionReady ? (
                          cfg?.executionTestMode ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">
                              <FlaskConical className="w-2.5 h-2.5" /> Test Mode
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                              <Shield className="w-2.5 h-2.5" /> Live
                            </span>
                          )
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border text-slate-500 bg-slate-500/10 border-slate-500/20">
                            <ShieldOff className="w-2.5 h-2.5" /> OFF
                          </span>
                        )}
                      </div>

                      {/* execution_enabled toggle */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => execConfig.mutate({ name: def.key, body: { executionEnabled: !cfg?.executionEnabled } })}
                          disabled={execConfig.isPending}
                          data-testid={`exec-toggle-${def.key}`}
                          className="flex items-center gap-2 text-[11px] text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                        >
                          {cfg?.executionEnabled
                            ? <ToggleRight className="w-5 h-5 text-violet-400" />
                            : <ToggleLeft className="w-5 h-5 text-slate-600" />
                          }
                          {cfg?.executionEnabled ? "Execution ON" : "Execution OFF"}
                        </button>
                        <span className="text-[10px] text-slate-600">·</span>
                        {/* test_mode toggle — only visible when execution enabled */}
                        {cfg?.executionEnabled && (
                          <button
                            onClick={() => execConfig.mutate({ name: def.key, body: { testMode: !cfg?.executionTestMode } })}
                            disabled={execConfig.isPending}
                            data-testid={`testmode-toggle-${def.key}`}
                            className="flex items-center gap-2 text-[11px] text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                          >
                            {cfg?.executionTestMode
                              ? <FlaskConical className="w-3.5 h-3.5 text-blue-400" />
                              : <Shield className="w-3.5 h-3.5 text-emerald-400" />
                            }
                            {cfg?.executionTestMode ? "Test Mode (dry run)" : "Live Mode"}
                          </button>
                        )}
                      </div>

                      {/* Missing exec creds warning */}
                      {(cfg?.missingExecCreds?.length ?? 0) > 0 && (
                        <div className="flex items-start gap-2 p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                          <KeyRound className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                          <div className="space-y-1 min-w-0">
                            <p className="text-[11px] text-amber-300/90 leading-relaxed">Execution requires these secrets:</p>
                            {cfg?.missingExecCreds.map((k: string) => (
                              <code key={k} className="block text-[10px] font-mono text-amber-400/80">{k}</code>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Global flag reminder */}
                      {!(flags[(def as any).execFlagKey]) && (
                        <div className="flex items-start gap-2">
                          <XCircle className="w-3 h-3 text-slate-600 mt-0.5 shrink-0" />
                          <p className="text-[10px] text-slate-600">
                            Also enable <code className="font-mono">{(def as any).execFlagKey}</code> in AI Hub to allow execution.
                          </p>
                        </div>
                      )}

                      {/* Live mode safety warning */}
                      {cfg?.executionEnabled && !cfg?.executionTestMode && (
                        <div className="flex items-start gap-2 p-2.5 bg-red-500/5 border border-red-500/20 rounded-lg">
                          <Shield className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-red-300/90 leading-relaxed">
                            <strong>Live mode active.</strong> "Push to Platform" will make real API calls.
                            Budget increases are capped at +10%. Verify carefully before approving.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sync Button */}
                  <button
                    onClick={() => sync.mutate(def.key)}
                    disabled={isSyncing || (!isConfigured && def.credentials.length > 0) || !flagOn}
                    data-testid={`sync-${def.key}`}
                    className="flex items-center gap-1.5 w-full justify-center px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 bg-white/8 hover:bg-white/15 border border-white/10 text-white"
                  >
                    {isSyncing
                      ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing…</>
                      : <><RefreshCw className="w-3.5 h-3.5" /> Sync Now</>}
                  </button>
                  {!flagOn && (
                    <p className="text-[10px] text-slate-600 text-center -mt-2 truncate">
                      Enable <code className="font-mono">{def.flagKey}</code> in AI Hub
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Scheduler Status Panel */}
        {scheduleData && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <CalendarClock className="w-5 h-5 text-violet-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-white">Sync Scheduler</h2>
                <p className="text-xs text-slate-500">Automatic background syncs</p>
              </div>
              {scheduleData.schedulerEnabled ? (
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 shrink-0">
                  <Play className="w-2.5 h-2.5" /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-slate-500/15 border border-slate-500/25 text-slate-400 shrink-0">
                  <Zap className="w-2.5 h-2.5" /> Disabled
                </span>
              )}
            </div>

            {!scheduleData.schedulerEnabled && (
              <div className="flex items-start gap-2 p-3 bg-slate-500/8 border border-slate-500/15 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Automatic syncs are disabled. Enable <code className="font-mono text-violet-400">ai_scheduler_enabled</code> in AI Hub &gt; Feature Flags to activate background syncing.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scheduleData.jobs.map(job => {
                const labels: Record<string, string> = {
                  google_ads: "Google Ads", meta_ads: "Meta Ads",
                  search_console: "Search Console", pagespeed: "PageSpeed",
                };
                const isPast = job.nextSyncAt ? new Date(job.nextSyncAt) < new Date() : true;
                return (
                  <div key={job.name} className="flex items-center justify-between gap-2 px-4 py-3 bg-black/20 rounded-xl border border-white/5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-300 truncate">{labels[job.name] ?? job.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Every {job.intervalHours}h
                        {job.flagEnabled ? "" : " · flag off"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {job.nextSyncAt && scheduleData.schedulerEnabled && job.flagEnabled ? (
                        <p className={`text-[11px] font-semibold ${isPast ? "text-amber-400" : "text-emerald-400"}`}>
                          {isPast ? "Overdue" : timeAgo(job.nextSyncAt)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-600">—</p>
                      )}
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        {job.lastSyncStatus === "success" ? "Last OK" : job.lastSyncStatus === "error" ? "Last failed" : "Never synced"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <ArrowRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <p className="text-[11px] text-slate-500">
                After syncing, click <span className="text-violet-400 font-semibold">Analyze Now</span> to generate AI recommendations from the latest data.
              </p>
            </div>
          </div>
        )}

        {/* PageSpeed Panel */}
        {(psData?.mobile || psData?.desktop) && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-5">
            <div className="flex items-center gap-3">
              <Gauge className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-white">Latest PageSpeed Scores</h2>
                <p className="text-xs text-slate-500">
                  {psData.mobile?.createdAt
                    ? new Date(psData.mobile.createdAt).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" })
                    : ""}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {([{ label: "Mobile", data: psData.mobile }, { label: "Desktop", data: psData.desktop }] as const).map(({ label, data }) =>
                data && (
                  <div key={label} className="space-y-3">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                    <div className="flex gap-3 flex-wrap">
                      <ScoreCircle score={data.performanceScore} label="Performance" />
                      <ScoreCircle score={data.seoScore} label="SEO" />
                      <ScoreCircle score={data.accessibilityScore} label="Accessibility" />
                      <ScoreCircle score={data.bestPracticesScore} label="Best Practices" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { l: "LCP", v: data.lcpMs != null ? `${(data.lcpMs / 1000).toFixed(1)}s` : "—", ok: data.lcpMs != null && data.lcpMs <= 2500 },
                        { l: "FCP", v: data.fcpMs != null ? `${(data.fcpMs / 1000).toFixed(1)}s` : "—", ok: data.fcpMs != null && data.fcpMs <= 1800 },
                        { l: "CLS", v: data.clsScore ?? "—", ok: parseFloat(String(data.clsScore ?? "1")) <= 0.1 },
                        { l: "TTFB", v: data.ttfbMs != null ? `${data.ttfbMs}ms` : "—", ok: data.ttfbMs != null && data.ttfbMs <= 800 },
                      ].map(m => (
                        <div key={m.l} className="flex items-center justify-between px-3 py-2 bg-black/20 rounded-lg">
                          <span className="text-xs text-slate-500">{m.l}</span>
                          <span className={`text-xs font-bold ${m.ok ? "text-emerald-400" : "text-amber-400"}`}>{m.v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Search Console Panel */}
        {gscRows.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-white">Top Search Queries</h2>
                <p className="text-xs text-slate-500">Last 28 days · {gscRows.length} queries · sorted by clicks</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left pb-2 font-medium text-slate-500">Query</th>
                    <th className="text-right pb-2 font-medium text-slate-500">Clicks</th>
                    <th className="text-right pb-2 font-medium text-slate-500">Impr.</th>
                    <th className="text-right pb-2 font-medium text-slate-500">CTR</th>
                    <th className="text-right pb-2 font-medium text-slate-500">Pos.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {gscRows.map(row => {
                    const pos = parseFloat(String(row.position ?? "99"));
                    const posColor = pos <= 3 ? "text-emerald-400" : pos <= 10 ? "text-amber-400" : "text-slate-500";
                    return (
                      <tr key={row.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-2 pr-3 text-slate-300 max-w-[180px] truncate">{row.query ?? "(not set)"}</td>
                        <td className="py-2 text-right text-white font-semibold">{row.clicks}</td>
                        <td className="py-2 text-right text-slate-400">{row.impressions}</td>
                        <td className="py-2 text-right text-slate-400">{row.ctr ? `${parseFloat(row.ctr).toFixed(1)}%` : "—"}</td>
                        <td className={`py-2 text-right font-semibold ${posColor}`}>
                          {row.position ? parseFloat(String(row.position)).toFixed(1) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state — no data yet */}
        {!isLoading && gscRows.length === 0 && !psData?.mobile && !psData?.desktop && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Database className="w-8 h-8 text-slate-600" />
            <p className="text-sm text-slate-500 font-medium">No imported data yet</p>
            <p className="text-xs text-slate-600 max-w-sm">
              Configure credentials in Replit Secrets and enable the feature flags, then click Sync Now on each connector.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
