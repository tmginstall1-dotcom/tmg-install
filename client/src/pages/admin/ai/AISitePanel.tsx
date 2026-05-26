import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Globe, Play, CheckCircle2, Clock, AlertTriangle, TrendingUp, Search,
  Zap, Shield, FileText, Layout, RefreshCw, Gauge, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  PageShell, PageHeader, PageBody, Card, SectionHeader,
  EmptyState, LoadingState, Button, Pill,
} from "@/components/admin/AdminUI";

const PRIORITY_TONE: Record<string, "urgent" | "ink" | "stone" | "outline"> = {
  critical: "urgent",
  high:     "urgent",
  medium:   "ink",
  low:      "stone",
};

const CATEGORY_ICONS: Record<string, any> = {
  cro: TrendingUp, seo: Search, speed: Zap,
  trust: Shield, copy: FileText, layout: Layout,
};

function PageSpeedMini() {
  const { data: ps } = useQuery<{ mobile: any; desktop: any }>({
    queryKey: ["/api/ai/pagespeed/data"],
  });
  if (!ps?.mobile && !ps?.desktop) return null;

  const scoreClass = (s: number | null) =>
    s == null ? "text-black/55" : s >= 90 ? "text-[#0A0A0A]" : s >= 50 ? "text-[#0A0A0A]/70" : "text-[#C1121F]";

  const row = (label: string, data: any) => {
    if (!data) return null;
    return (
      <div key={label} className="flex items-center gap-4 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0A0A0A] w-14 shrink-0">{label}</span>
        {[["Perf", data.performanceScore], ["SEO", data.seoScore], ["A11y", data.accessibilityScore]].map(([l, s]) => (
          <span key={l as string} className="flex items-center gap-1.5">
            <span className="text-[10px] text-black/55 font-bold uppercase tracking-[0.14em]">{l}</span>
            <span className={`text-[14px] font-black tabular-nums ${scoreClass(s as number | null)}`}>{s ?? "—"}</span>
          </span>
        ))}
        {data.lcpMs != null && (
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] text-black/55 font-bold uppercase tracking-[0.14em]">LCP</span>
            <span className={`text-[14px] font-black tabular-nums ${data.lcpMs <= 2500 ? "text-[#0A0A0A]" : "text-[#C1121F]"}`}>
              {(data.lcpMs / 1000).toFixed(1)}s
            </span>
          </span>
        )}
      </div>
    );
  };

  return (
    <Card>
      <SectionHeader
        icon={Gauge}
        title="PageSpeed Insights"
        action={
          <div className="flex items-center gap-3">
            {ps.mobile?.createdAt && (
              <span className="text-[10px] text-black/55 font-bold uppercase tracking-[0.14em] tabular-nums">
                {new Date(ps.mobile.createdAt).toLocaleString("en-SG", { dateStyle: "short", timeStyle: "short" })}
              </span>
            )}
            <Link href="/admin/ai/connectors">
              <a className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-[#0A0A0A] flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Details
              </a>
            </Link>
          </div>
        }
      />
      <div className="px-4 sm:px-5 py-4 space-y-3">
        {row("Mobile", ps.mobile)}
        {row("Desktop", ps.desktop)}
      </div>
    </Card>
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
    refetchInterval: 5000,
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
    <PageShell>
      <PageHeader
        eyebrow="AI Ops · Site Health"
        title="Site Health"
        subtitle="CRO · SEO · Speed · Trust · Copy — AI-graded findings for tmginstall.com."
        actions={
          <>
            <select
              value={selectedAuditType}
              onChange={e => setSelectedAuditType(e.target.value as any)}
              className="h-10 px-3 border border-black/20 bg-white text-[11px] font-black uppercase tracking-[0.15em] text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
            >
              <option value="full">Full Audit</option>
              <option value="cro">CRO Only</option>
              <option value="seo">SEO Only</option>
              <option value="speed">Speed Only</option>
            </select>
            <Button
              variant="ink"
              icon={isRunning ? RefreshCw : Play}
              onClick={() => runAudit.mutate(selectedAuditType)}
              disabled={runAudit.isPending || isRunning}
              data-testid="button-run-audit"
              className={isRunning ? "[&_svg]:animate-spin" : ""}
            >
              {isRunning ? "Running…" : "Run Audit"}
            </Button>
          </>
        }
      />

      <PageBody>

        <PageSpeedMini />

        {/* Latest audit */}
        {latestAudit && (
          <Card className={isRunning ? "border-black/20" : latestAudit.status === "failed" ? "border-[#C1121F]" : ""}>
            <div className="px-4 sm:px-5 py-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {isRunning ? (
                  <RefreshCw className="w-4 h-4 text-[#0A0A0A] animate-spin shrink-0 mt-0.5" />
                ) : latestAudit.status === "complete" ? (
                  <CheckCircle2 className="w-4 h-4 text-[#0A0A0A] shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#C1121F] shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-[12px] font-black uppercase tracking-[0.08em] text-[#0A0A0A]">
                    {isRunning ? "Audit in progress…" : `${latestAudit.auditType?.toUpperCase()} Audit — ${latestAudit.status}`}
                  </p>
                  {latestAudit.summary && (
                    <p className="text-[12px] text-black/65 mt-1.5 leading-relaxed max-w-xl font-medium">{latestAudit.summary}</p>
                  )}
                  {latestAudit.createdAt && (
                    <p className="text-[10px] text-black/55 mt-2 flex items-center gap-1 font-bold uppercase tracking-[0.14em] tabular-nums">
                      <Clock className="w-3 h-3" />
                      {new Date(latestAudit.createdAt).toLocaleString("en-SG")}
                    </p>
                  )}
                </div>
              </div>
              {latestAudit.score != null && (
                <div className="text-right shrink-0">
                  <div className={`text-[36px] font-black tabular-nums leading-none ${
                    latestAudit.score >= 80 ? "text-[#0A0A0A]" :
                    latestAudit.score >= 60 ? "text-[#0A0A0A]/70" :
                                              "text-[#C1121F]"
                  }`}>
                    {latestAudit.score}
                  </div>
                  <p className="text-[10px] text-black/55 mt-1 font-bold uppercase tracking-[0.18em]">/100</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Category counters */}
        {Object.keys(categoryCounts).length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-black/10 border border-black/12">
            {["cro","seo","speed","trust","copy","layout"].map(cat => {
              const count = categoryCounts[cat] ?? 0;
              const Icon = CATEGORY_ICONS[cat] ?? Globe;
              const active = filterCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(active ? "all" : cat)}
                  className={`px-3 py-4 transition-colors text-center ${
                    active ? "bg-[#0A0A0A] text-white" : "bg-white hover:bg-[#EBE9E2]"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 mx-auto mb-2 ${active ? "text-white" : "text-black/45"}`} strokeWidth={1.75} />
                  <p className={`text-[22px] font-black tabular-nums leading-none ${active ? "text-white" : "text-[#0A0A0A]"}`}>{count}</p>
                  <p className={`text-[10px] font-black uppercase tracking-[0.18em] mt-1.5 ${active ? "text-white/65" : "text-black/55"}`}>{cat}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Priority filter */}
        {recommendations.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55">Priority</span>
            {["all","critical","high","medium","low"].map(p => {
              const active = filterPriority === p;
              return (
                <button
                  key={p}
                  onClick={() => setFilterPriority(p)}
                  className={`h-7 px-2.5 text-[10px] font-black uppercase tracking-[0.16em] transition-colors ${
                    active ? "bg-[#0A0A0A] text-white" : "bg-white text-black/55 border border-black/15 hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
                  }`}
                >
                  {p === "all" ? "All" : p}
                </button>
              );
            })}
          </div>
        )}

        {/* Recommendations */}
        {filteredRecs.length > 0 ? (
          <Card>
            <SectionHeader
              icon={Globe}
              title="Open Findings"
              badge={filteredRecs.length}
            />
            <div className="divide-y divide-black/8">
              {filteredRecs.map((rec: any) => {
                const Icon = CATEGORY_ICONS[rec.category] ?? Globe;
                return (
                  <div
                    key={rec.id}
                    data-testid={`rec-card-${rec.id}`}
                    className="px-4 sm:px-5 py-4 hover:bg-[#EBE9E2] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="w-4 h-4 mt-1 shrink-0 text-[#0A0A0A]" strokeWidth={1.75} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <Pill tone={PRIORITY_TONE[rec.priority] ?? "stone"}>{rec.priority}</Pill>
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-black/55">{rec.category}</span>
                          {rec.page && <span className="text-[10px] text-black/55 font-mono">{rec.page}</span>}
                          {!rec.page && (rec.category === "speed" || rec.category === "seo") && (
                            <Pill tone="outline">Live API</Pill>
                          )}
                        </div>
                        <p className="text-[13px] font-black uppercase tracking-[0.04em] text-[#0A0A0A] leading-tight">{rec.title}</p>
                        {rec.description && (
                          <p className="text-[12px] text-black/65 mt-1.5 leading-relaxed font-medium">{rec.description}</p>
                        )}
                        {rec.suggestedChange && (
                          <div className="mt-2.5 p-3 bg-[#EBE9E2] border-l-2 border-[#0A0A0A]">
                            <p className="text-[11px] text-[#0A0A0A] leading-relaxed font-medium">
                              <span className="font-black uppercase tracking-[0.16em] mr-2">Suggested fix</span>
                              {rec.suggestedChange}
                            </p>
                          </div>
                        )}
                      </div>
                      <Pill tone={rec.riskLevel === "high" ? "urgent" : rec.riskLevel === "medium" ? "ink" : "stone"}>
                        {rec.riskLevel} risk
                      </Pill>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : recommendations.length === 0 && !auditsLoading ? (
          <Card>
            <EmptyState
              icon={Globe}
              title="No audit results yet"
              hint="Run a site audit to get AI-powered CRO, SEO, and UX recommendations."
            />
          </Card>
        ) : filteredRecs.length === 0 ? (
          <Card>
            <EmptyState icon={Search} title="No findings match the current filters" />
          </Card>
        ) : null}

        {/* History */}
        {audits.length > 1 && (
          <Card>
            <SectionHeader icon={Clock} title="Audit History" />
            <div className="divide-y divide-black/8">
              {audits.map((a: any) => (
                <div key={a.id} className="px-4 sm:px-5 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {a.status === "complete" ? <CheckCircle2 className="w-3.5 h-3.5 text-[#0A0A0A] shrink-0" />
                      : a.status === "running"  ? <RefreshCw className="w-3.5 h-3.5 text-[#0A0A0A] animate-spin shrink-0" />
                      :                            <AlertTriangle className="w-3.5 h-3.5 text-[#C1121F] shrink-0" />}
                    <span className="text-[11px] text-[#0A0A0A] font-black uppercase tracking-[0.12em] font-mono">{a.auditType}</span>
                    <span className="text-[10px] text-black/55 font-bold uppercase tracking-[0.14em] tabular-nums">
                      {new Date(a.createdAt).toLocaleDateString("en-SG")}
                    </span>
                  </div>
                  {a.score != null && (
                    <span className={`text-[14px] font-black tabular-nums ${
                      a.score >= 80 ? "text-[#0A0A0A]" : a.score >= 60 ? "text-[#0A0A0A]/70" : "text-[#C1121F]"
                    }`}>
                      {a.score}<span className="text-[10px] text-black/45 ml-0.5">/100</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

      </PageBody>
    </PageShell>
  );
}
