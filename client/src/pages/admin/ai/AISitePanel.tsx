import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Globe, ChevronLeft, Play, CheckCircle2, Clock,
  AlertTriangle, TrendingUp, Search, Zap, Shield,
  FileText, Layout, RefreshCw, Gauge, ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/20",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  low: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

const CATEGORY_ICONS: Record<string, any> = {
  cro: TrendingUp, seo: Search, speed: Zap,
  trust: Shield, copy: FileText, layout: Layout,
};

const CATEGORY_COLORS: Record<string, string> = {
  cro: "text-blue-400", seo: "text-green-400", speed: "text-yellow-400",
  trust: "text-violet-400", copy: "text-pink-400", layout: "text-cyan-400",
};

function PageSpeedMini() {
  const { data: ps } = useQuery<{ mobile: any; desktop: any }>({
    queryKey: ["/api/ai/pagespeed/data"],
  });
  if (!ps?.mobile && !ps?.desktop) return null;

  const scoreColor = (s: number | null) =>
    s == null ? "text-slate-500" : s >= 90 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-red-400";

  const mini = (label: string, data: any) => {
    if (!data) return null;
    return (
      <div key={label} className="flex items-center gap-3">
        <span className="text-[11px] text-slate-500 font-medium w-14 shrink-0">{label}</span>
        {[["Perf", data.performanceScore], ["SEO", data.seoScore], ["A11y", data.accessibilityScore]].map(([l, s]) => (
          <span key={l as string} className="flex items-center gap-1">
            <span className="text-[10px] text-slate-600">{l}</span>
            <span className={`text-xs font-bold ${scoreColor(s as number | null)}`}>{s ?? "—"}</span>
          </span>
        ))}
        {data.lcpMs != null && (
          <span className="flex items-center gap-1">
            <span className="text-[10px] text-slate-600">LCP</span>
            <span className={`text-xs font-bold ${data.lcpMs <= 2500 ? "text-emerald-400" : "text-amber-400"}`}>{(data.lcpMs / 1000).toFixed(1)}s</span>
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-semibold text-amber-400">PageSpeed Insights</span>
          {ps.mobile?.createdAt && (
            <span className="text-[10px] text-slate-600">
              · {new Date(ps.mobile.createdAt).toLocaleString("en-SG", { dateStyle: "short", timeStyle: "short" })}
            </span>
          )}
        </div>
        <Link href="/admin/ai/connectors" className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors">
          <ExternalLink className="w-3 h-3" /> Details
        </Link>
      </div>
      {mini("Mobile", ps.mobile)}
      {mini("Desktop", ps.desktop)}
    </div>
  );
}

export default function AISitePanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedAuditType, setSelectedAuditType] = useState<"full"|"cro"|"seo"|"speed">("full");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const { data: audits = [], isLoading: auditsLoading } = useQuery<any[]>({
    queryKey: ["/api/ai/site/audits"],
    refetchInterval: 5000, // poll while running
  });
  const { data: recommendations = [] } = useQuery<any[]>({
    queryKey: ["/api/ai/site/recommendations"],
  });

  const runAudit = useMutation({
    mutationFn: (auditType: string) => apiRequest("POST", "/api/ai/site/audit", { auditType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai/site/audits"] });
      toast({ title: "Site audit started", description: "Results will appear in a few seconds." });
    },
    onError: (err: any) => toast({ title: "Audit failed", description: err.message, variant: "destructive" }),
  });

  const latestAudit = audits[0];
  const isRunning = latestAudit?.status === "running";

  const filteredRecs = recommendations.filter((r: any) => {
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    if (filterPriority !== "all" && r.priority !== filterPriority) return false;
    return r.status === "open";
  });

  const categoryCounts = recommendations.reduce((acc: Record<string, number>, r: any) => {
    if (r.status === "open") acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});

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
            <Globe className="w-6 h-6 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white">Site Health</h1>
              <p className="text-xs text-slate-500">CRO · SEO · Speed · Trust · Copy analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto shrink-0">
            <select
              value={selectedAuditType}
              onChange={e => setSelectedAuditType(e.target.value as any)}
              className="flex-1 sm:flex-none h-9 px-3 bg-black/20 border border-white/10 rounded-lg text-sm text-white focus:outline-none"
            >
              <option value="full">Full Audit</option>
              <option value="cro">CRO Only</option>
              <option value="seo">SEO Only</option>
              <option value="speed">Speed Only</option>
            </select>
            <button
              onClick={() => runAudit.mutate(selectedAuditType)}
              data-testid="button-run-audit"
              disabled={runAudit.isPending || isRunning}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0"
            >
              {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isRunning ? "Running…" : "Run Audit"}
            </button>
          </div>
        </div>

        {/* PageSpeed Mini-Panel */}
        <PageSpeedMini />

        {/* Latest Audit Result */}
        {latestAudit && (
          <div className={`p-5 rounded-2xl border ${isRunning ? "bg-amber-500/5 border-amber-500/20" : latestAudit.status === "failed" ? "bg-red-500/5 border-red-500/20" : "bg-white/5 border-white/10"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {isRunning
                  ? <RefreshCw className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
                  : latestAudit.status === "complete"
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    : <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold text-white capitalize">
                    {isRunning ? "Audit in progress…" : `${latestAudit.auditType?.toUpperCase()} Audit — ${latestAudit.status}`}
                  </p>
                  {latestAudit.summary && (
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xl">{latestAudit.summary}</p>
                  )}
                </div>
              </div>
              {latestAudit.score != null && (
                <div className="text-center shrink-0">
                  <div className={`text-3xl font-black tabular-nums ${latestAudit.score >= 80 ? "text-emerald-400" : latestAudit.score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                    {latestAudit.score}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">/100</p>
                </div>
              )}
            </div>
            {latestAudit.createdAt && (
              <p className="text-[11px] text-slate-600 mt-3 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {new Date(latestAudit.createdAt).toLocaleString("en-SG")}
              </p>
            )}
          </div>
        )}

        {/* Category Summary */}
        {Object.keys(categoryCounts).length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {["cro","seo","speed","trust","copy","layout"].map(cat => {
              const count = categoryCounts[cat] ?? 0;
              const Icon = CATEGORY_ICONS[cat] ?? Globe;
              const active = filterCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(active ? "all" : cat)}
                  className={`p-3 rounded-xl border transition-all text-center ${active ? "bg-white/10 border-white/20" : "bg-white/5 border-white/5 hover:bg-white/8 hover:border-white/10"}`}
                >
                  <Icon className={`w-4 h-4 mx-auto mb-1.5 ${CATEGORY_COLORS[cat]}`} />
                  <p className={`text-base font-bold ${count > 0 ? "text-white" : "text-slate-600"}`}>{count}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">{cat}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Filters */}
        {recommendations.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">Filter:</span>
            {["all","critical","high","medium","low"].map(p => (
              <button key={p} onClick={() => setFilterPriority(p)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${filterPriority === p ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                {p === "all" ? "All priorities" : p}
              </button>
            ))}
          </div>
        )}

        {/* Recommendations List */}
        {filteredRecs.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {filteredRecs.length} Open Finding{filteredRecs.length !== 1 ? "s" : ""}
            </p>
            {filteredRecs.map((rec: any) => {
              const Icon = CATEGORY_ICONS[rec.category] ?? Globe;
              return (
                <div key={rec.id} data-testid={`rec-card-${rec.id}`} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 transition-colors">
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${CATEGORY_COLORS[rec.category] ?? "text-slate-400"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[rec.priority] ?? ""}`}>{rec.priority}</span>
                        <span className="text-[10px] uppercase text-slate-500 font-semibold">{rec.category}</span>
                        {rec.page && <span className="text-[10px] text-slate-600 font-mono">{rec.page}</span>}
                      </div>
                      <p className="text-sm font-semibold text-white leading-tight">{rec.title}</p>
                      {rec.description && <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{rec.description}</p>}
                      {rec.suggestedChange && (
                        <div className="mt-2.5 p-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                          <p className="text-xs text-emerald-300 leading-relaxed">
                            <span className="font-semibold">Suggested fix:</span> {rec.suggestedChange}
                          </p>
                        </div>
                      )}
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${rec.riskLevel === "high" ? PRIORITY_COLORS.high : rec.riskLevel === "medium" ? PRIORITY_COLORS.medium : PRIORITY_COLORS.low}`}>
                      {rec.riskLevel} risk
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : recommendations.length === 0 && !auditsLoading ? (
          <div className="text-center py-14 border border-dashed border-white/10 rounded-2xl">
            <Globe className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No audit results yet</p>
            <p className="text-sm text-slate-600 mt-1 max-w-xs mx-auto">
              Run a site audit to get AI-powered CRO, SEO, and UX recommendations for TMGInstall.com.
            </p>
          </div>
        ) : filteredRecs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-500">No findings match the current filters.</p>
          </div>
        ) : null}

        {/* Audit History */}
        {audits.length > 1 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audit History</h3>
            </div>
            <div className="divide-y divide-white/5">
              {audits.map((a: any) => (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    {a.status === "complete" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      : a.status === "running" ? <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                    <span className="text-xs text-slate-400 font-mono uppercase">{a.auditType}</span>
                    <span className="text-[10px] text-slate-600">{new Date(a.createdAt).toLocaleDateString("en-SG")}</span>
                  </div>
                  {a.score != null && (
                    <span className={`text-sm font-bold tabular-nums ${a.score >= 80 ? "text-emerald-400" : a.score >= 60 ? "text-amber-400" : "text-red-400"}`}>
                      {a.score}/100
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
