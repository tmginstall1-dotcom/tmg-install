import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckSquare, ChevronLeft, Clock, AlertTriangle,
  Check, X, Pause, ShieldAlert, ChevronDown, ChevronUp,
  Database, FileText, RotateCcw, ScrollText, Zap,
  Target, TrendingDown, ArrowUp, Cpu, Globe, Search,
  PlayCircle, Copy, CheckCheck, XCircle, Timer, Loader2, BotIcon,
  Rocket, FlaskConical, Send, BadgeAlert,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

const TYPE_LABELS: Record<string, string> = {
  ads_change: "Ads Change",
  site_change: "Site Change",
  creative: "Ad Copy Test",
  budget: "Budget",
  negative_keyword: "Negative Keywords",
};

const TYPE_ICONS: Record<string, any> = {
  ads_change: TrendingDown,
  site_change: Globe,
  creative: Cpu,
  budget: Database,
  negative_keyword: Target,
};

const ACTION_SOURCE_LABELS: Record<string, string> = {
  google_ads_api: "Google Ads API",
  meta_ads_api: "Meta Ads API",
  google_search_console: "Search Console",
  cro_best_practices: "CRO Best Practices",
  connector_rules: "Connector Rules",
  phase4_actions: "Action Generator",
};

interface ConfirmState {
  id: number;
  decision: "approved" | "rejected" | "deferred";
  note?: string;
  title: string;
}

const DECISION_META: Record<string, { label: string; color: string; Icon: any }> = {
  approved: { label: "Approve", color: "bg-emerald-600/30 text-emerald-200 border-emerald-500/50", Icon: Check },
  rejected: { label: "Reject", color: "bg-red-600/30 text-red-200 border-red-500/50", Icon: X },
  deferred: { label: "Defer", color: "bg-slate-600/30 text-slate-200 border-slate-500/50", Icon: Pause },
};

// ── Structured detail panel subcomponents ─────────────────────────────────────

function EvidenceSection({ sourceData, evidence }: { sourceData?: any; evidence?: any }) {
  const d = sourceData ?? evidence;
  if (!d || typeof d !== "object") return null;
  const skip = new Set(["analysisSource", "source", "instructions"]);
  const entries = Object.entries(d).filter(([k]) => !skip.has(k));
  if (entries.length === 0) return null;

  const formatVal = (v: any): string => {
    if (v == null) return "—";
    if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
    return String(v);
  };

  const sourceLabel = ACTION_SOURCE_LABELS[d.source ?? d.analysisSource] ?? d.source ?? "Unknown";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Database className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Evidence</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 font-semibold">
          {sourceLabel}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {entries.map(([k, v]) => (
          <div key={k} className="px-3 py-2 bg-black/20 rounded-lg border border-white/5">
            <p className="text-[10px] text-slate-600 capitalize">{k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}</p>
            <p className="text-xs font-semibold text-slate-300 mt-0.5 truncate">{formatVal(v)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProposedActionSection({ proposedAction, queueType }: { proposedAction?: any; queueType?: string }) {
  if (!proposedAction || typeof proposedAction !== "object") return null;

  const pa = proposedAction;

  if (queueType === "negative_keyword" && Array.isArray(pa.negativeKeywords)) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Proposed Negative Keywords</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {pa.negativeKeywords.map((kw: any, i: number) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/15 text-red-300">
              -{kw.term} <span className="text-red-600">({kw.matchType})</span>
            </span>
          ))}
        </div>
        {pa.instructions && (
          <div className="flex items-start gap-2 p-2.5 bg-blue-500/5 border border-blue-500/15 rounded-lg mt-1">
            <FileText className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-300 leading-relaxed">{pa.instructions}</p>
          </div>
        )}
      </div>
    );
  }

  if (queueType === "creative" && (pa.headlines || pa.descriptions)) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Proposed Ad Creative</span>
        </div>
        {pa.headlines && (
          <div className="space-y-1">
            <p className="text-[10px] text-slate-600 font-semibold uppercase">Headlines</p>
            {pa.headlines.map((h: string, i: number) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 bg-black/20 rounded-lg border border-white/5">
                <span className="text-[10px] text-slate-600 shrink-0 pt-0.5">{i + 1}.</span>
                <p className="text-xs text-slate-300">{h}</p>
              </div>
            ))}
          </div>
        )}
        {pa.descriptions && (
          <div className="space-y-1">
            <p className="text-[10px] text-slate-600 font-semibold uppercase">Descriptions</p>
            {pa.descriptions.map((d: string, i: number) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2 bg-black/20 rounded-lg border border-white/5">
                <span className="text-[10px] text-slate-600 shrink-0 pt-0.5">{i + 1}.</span>
                <p className="text-xs text-slate-300">{d}</p>
              </div>
            ))}
          </div>
        )}
        {pa.instructions && (
          <div className="flex items-start gap-2 p-2.5 bg-blue-500/5 border border-blue-500/15 rounded-lg">
            <FileText className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-300 leading-relaxed">{pa.instructions}</p>
          </div>
        )}
      </div>
    );
  }

  if ((queueType === "site_change") && pa.suggestedChanges) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Proposed Page Changes</span>
          {pa.targetPage && <span className="text-[10px] text-slate-600 font-mono truncate max-w-[180px]">{pa.targetPage}</span>}
        </div>
        <div className="space-y-1.5">
          {Object.entries(pa.suggestedChanges).map(([k, v]: [string, any]) => (
            <div key={k} className="px-3 py-2 bg-black/20 rounded-lg border border-white/5">
              <p className="text-[10px] text-slate-600 uppercase font-semibold">{k.replace(/([A-Z])/g, " $1").trim()}</p>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{v}</p>
            </div>
          ))}
        </div>
        {pa.instructions && (
          <div className="flex items-start gap-2 p-2.5 bg-blue-500/5 border border-blue-500/15 rounded-lg">
            <FileText className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-300 leading-relaxed">{pa.instructions}</p>
          </div>
        )}
      </div>
    );
  }

  // Generic proposed action — for CRO copy and other site_change types
  if (pa.suggestedChange) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Proposed Copy Change</span>
        </div>
        <div className="p-3 bg-black/20 rounded-lg border border-emerald-500/10">
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{pa.suggestedChange}</p>
        </div>
        {pa.instructions && (
          <div className="flex items-start gap-2 p-2.5 bg-blue-500/5 border border-blue-500/15 rounded-lg">
            <FileText className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-300 leading-relaxed">{pa.instructions}</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function RollbackSection({ rollbackPath, linkedRec }: { rollbackPath?: string | null; linkedRec?: any }) {
  const text = rollbackPath ?? linkedRec?.rollbackInfo;
  if (!text) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Rollback Path</span>
      </div>
      <div className="flex items-start gap-2 p-3 bg-slate-500/5 border border-slate-500/15 rounded-lg">
        <p className="text-[11px] text-slate-400 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function AuditTrailSection({ auditTrail }: { auditTrail?: any[] }) {
  if (!auditTrail?.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ScrollText className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Audit Trail</span>
      </div>
      <div className="space-y-1.5">
        {auditTrail.map((e: any) => (
          <div key={e.id} className="flex items-start gap-2 px-3 py-2 bg-black/20 rounded-lg border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 mt-1.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-300 leading-snug">{e.summary}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                {e.actor} · {new Date(e.createdAt).toLocaleString("en-SG", { dateStyle: "short", timeStyle: "short" })}
              </p>
            </div>
            <span className={`shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${e.outcome === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              {e.outcome}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutionResultSection({ executionResult, executionStatus, executedAt, executedBy }: {
  executionResult?: any; executionStatus?: string | null; executedAt?: string | null; executedBy?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  if (!executionResult && executionStatus !== "execution_failed") return null;

  if (executionStatus === "execution_failed") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <XCircle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-[11px] font-bold uppercase text-red-400 tracking-wider">Execution Failed</span>
        </div>
        <div className="flex items-start gap-2 p-3 bg-red-500/5 border border-red-500/15 rounded-lg">
          <p className="text-[11px] text-red-300 leading-relaxed">The last execution attempt failed. Retry by clicking Execute again.</p>
        </div>
      </div>
    );
  }

  const r = executionResult;

  function copyToClipboard() {
    if (!r.deliverable) return;
    navigator.clipboard.writeText(r.deliverable).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const TYPE_LABELS: Record<string, string> = {
    negative_keywords_export: "Negative Keywords Export",
    ad_copy_spec: "Ad Copy Spec (RSA)",
    landing_page_brief: "Landing Page Brief",
    cro_copy_brief: "CRO Copy Brief",
    ads_change_spec: "Ads Change Spec",
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[11px] font-bold uppercase text-emerald-400 tracking-wider">Execution Result</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
          {TYPE_LABELS[r.type] ?? r.type}
        </span>
        <span className="ml-auto text-[10px] text-slate-600 flex items-center gap-1">
          <Timer className="w-3 h-3" />
          {executedBy} · {executedAt ? new Date(executedAt).toLocaleString("en-SG", { dateStyle: "short", timeStyle: "short" }) : ""}
        </span>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {r.platform && (
          <div className="px-3 py-2 bg-black/20 rounded-lg border border-white/5">
            <p className="text-[10px] text-slate-600">Platform</p>
            <p className="text-xs font-semibold text-slate-300 mt-0.5">{r.platform}</p>
          </div>
        )}
        {r.estimatedTime && (
          <div className="px-3 py-2 bg-black/20 rounded-lg border border-white/5">
            <p className="text-[10px] text-slate-600">Est. Time</p>
            <p className="text-xs font-semibold text-slate-300 mt-0.5">{r.estimatedTime}</p>
          </div>
        )}
        {r.negativeCount != null && (
          <div className="px-3 py-2 bg-black/20 rounded-lg border border-white/5">
            <p className="text-[10px] text-slate-600">Keywords</p>
            <p className="text-xs font-semibold text-slate-300 mt-0.5">{r.negativeCount}</p>
          </div>
        )}
      </div>

      {/* Deliverable output */}
      {r.deliverable && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-600 font-semibold uppercase">Deliverable — Copy and implement manually</p>
            <button
              onClick={copyToClipboard}
              data-testid={`copy-deliverable-${executedBy}`}
              className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              {copied ? <><CheckCheck className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
            </button>
          </div>
          <pre className="p-3 bg-black/30 border border-white/5 rounded-lg text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">
            {r.deliverable}
          </pre>
        </div>
      )}

      {/* Implementation steps */}
      {r.implementationSteps?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-600 font-semibold uppercase">Implementation Steps</p>
          <div className="space-y-1">
            {r.implementationSteps.map((step: string, i: number) => (
              <div key={i} className="flex items-start gap-2 px-3 py-1.5 bg-black/10 rounded-lg border border-white/5">
                <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] text-blue-400 font-bold">{i + 1}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{step.replace(/^\d+\.\s*/, "")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rollback note */}
      {r.rollbackNote && (
        <div className="flex items-start gap-2 p-2.5 bg-slate-500/5 border border-slate-500/15 rounded-lg">
          <RotateCcw className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-400 leading-relaxed">
            <strong className="text-slate-500">Rollback:</strong> {r.rollbackNote}
          </p>
        </div>
      )}
    </div>
  );
}

function PlatformExecutionSection({ platformExecution }: { platformExecution?: any }) {
  const [rawOpen, setRawOpen] = useState(false);
  if (!platformExecution) return null;
  const pe = platformExecution;

  const STATUS_META: Record<string, { label: string; color: string; Icon: any }> = {
    success:      { label: "Live Push Succeeded",        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", Icon: CheckCheck },
    test_mode:    { label: "Dry Run Complete",           color: "text-blue-400 bg-blue-500/10 border-blue-500/20",         Icon: FlaskConical },
    export_only:  { label: "Export Only — apply manually", color: "text-amber-400 bg-amber-500/10 border-amber-500/20",   Icon: FileText },
    failed:       { label: "Live Push Failed",           color: "text-red-400 bg-red-500/10 border-red-500/20",           Icon: XCircle },
    missing_ids:  { label: "Missing Target IDs",         color: "text-orange-400 bg-orange-500/10 border-orange-500/20", Icon: BadgeAlert },
  };

  const sm = STATUS_META[pe.resultStatus] ?? STATUS_META["export_only"];
  const StatusIcon = sm.Icon;
  const PLATFORM_LABEL: Record<string, string> = {
    google_ads: "Google Ads",
    meta_ads:   "Meta Ads",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Rocket className="w-3.5 h-3.5 text-violet-400" />
        <span className="text-[11px] font-bold uppercase text-violet-400 tracking-wider">Platform Execution</span>
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 ${sm.color}`}>
          <StatusIcon className="w-2.5 h-2.5" />
          {sm.label}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 border border-slate-500/20 text-slate-400 font-semibold">
          {PLATFORM_LABEL[pe.platform] ?? pe.platform}
        </span>
        {pe.testMode && (
          <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
            <FlaskConical className="w-2.5 h-2.5" /> Dry run
          </span>
        )}
        <span className="ml-auto text-[10px] text-slate-600 flex items-center gap-1">
          <Timer className="w-3 h-3" />
          {pe.actor} · {pe.executedAt ? new Date(pe.executedAt).toLocaleString("en-SG", { dateStyle: "short", timeStyle: "short" }) : ""}
        </span>
      </div>

      {/* Summary */}
      <div className={`p-3 rounded-lg border ${pe.resultStatus === "failed" || pe.resultStatus === "missing_ids" ? "bg-red-500/5 border-red-500/15" : pe.resultStatus === "success" ? "bg-emerald-500/5 border-emerald-500/15" : pe.resultStatus === "test_mode" ? "bg-blue-500/5 border-blue-500/15" : "bg-slate-500/5 border-slate-500/15"}`}>
        <p className="text-[11px] leading-relaxed text-slate-300">{pe.summary}</p>
      </div>

      {/* Error */}
      {pe.errorMessage && (
        <div className="flex items-start gap-2 p-2.5 bg-red-500/5 border border-red-500/15 rounded-lg">
          <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-red-300 leading-relaxed">{pe.errorMessage}</p>
        </div>
      )}

      {/* Rollback path */}
      {pe.rollbackPath && pe.rollbackPath !== "No changes made." && pe.rollbackPath !== "No changes made — export only." && (
        <div className="flex items-start gap-2 p-2.5 bg-slate-500/5 border border-slate-500/15 rounded-lg">
          <RotateCcw className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-600 mb-1">Rollback Path</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">{pe.rollbackPath}</p>
          </div>
        </div>
      )}

      {/* Execution receipt row */}
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-slate-600 font-mono">
        {pe.id && <span>#{pe.id}</span>}
        {pe.id && <span className="text-slate-700">·</span>}
        <span className="text-slate-500 font-sans">{pe.actionType ?? pe.action_type ?? "—"}</span>
        {pe.pilotFence && (
          <span className="text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-sans">
            Pilot Fence
          </span>
        )}
      </div>

      {/* Raw response / payload toggle — available for all statuses */}
      <button
        onClick={() => setRawOpen(!rawOpen)}
        className={`flex items-center gap-1 text-[10px] hover:opacity-80 transition-opacity ${pe.resultStatus === "test_mode" ? "text-blue-400" : pe.resultStatus === "success" ? "text-emerald-400" : pe.resultStatus === "failed" ? "text-red-400" : "text-slate-500"}`}
      >
        {rawOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {rawOpen ? "Hide" : "Show"} {pe.resultStatus === "test_mode" ? "dry-run payload" : pe.resultStatus === "success" ? "platform receipt" : "response details"}
      </button>
      {rawOpen && (
        <pre className="p-3 bg-black/30 border border-white/5 rounded-lg text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
          {JSON.stringify(pe, null, 2)}
        </pre>
      )}
    </div>
  );
}

function LinkedRecSection({ linkedRec, refType }: { linkedRec?: any; refType?: string | null }) {
  if (!linkedRec) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ArrowUp className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
          Linked {refType === "ad_recommendation" ? "Ad Recommendation" : "Site Recommendation"}
        </span>
        <span className="text-[10px] text-slate-600 font-mono">#{linkedRec.id}</span>
      </div>
      <div className="px-3 py-2.5 bg-black/20 rounded-lg border border-white/5 space-y-1">
        {linkedRec.reason && <p className="text-xs text-slate-300 leading-relaxed">{linkedRec.reason}</p>}
        {linkedRec.expectedEffect && <p className="text-xs text-emerald-400 mt-1">Expected: {linkedRec.expectedEffect}</p>}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-600">
          {linkedRec.confidence && <span>Confidence: {linkedRec.confidence}%</span>}
          {linkedRec.status && <span>Status: {linkedRec.status}</span>}
          {linkedRec.platform && <span>Platform: {linkedRec.platform}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Detail panel — fires a query only when expanded ───────────────────────────

function DetailPanel({ item }: { item: any }) {
  const { data: detail, isLoading } = useQuery<any>({
    queryKey: ["/api/ai/approvals", item.id, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/ai/approvals/${item.id}/detail`, { credentials: "include" });
      return res.json();
    },
  });

  const proposedAction = item.proposedAction as any;
  const linkedRec = detail?.linkedRec;
  const auditTrail = detail?.auditTrail;
  const evidence = (linkedRec?.sourceData) ?? proposedAction?.evidence;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-600 text-xs">
        <div className="w-4 h-4 border border-white/10 border-t-white/50 rounded-full animate-spin" />
        Loading detail…
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      {/* Execution result is always shown first if the item has been executed */}
      <ExecutionResultSection
        executionResult={item.executionResult}
        executionStatus={item.executionStatus}
        executedAt={item.executedAt}
        executedBy={item.executedBy}
      />
      {/* Platform execution result — shown if Push to Platform was clicked */}
      <PlatformExecutionSection platformExecution={item.executionResult?.platformExecution} />
      <EvidenceSection sourceData={evidence} />
      <ProposedActionSection proposedAction={proposedAction} queueType={item.queueType} />
      <RollbackSection rollbackPath={item.rollbackPath} linkedRec={linkedRec} />
      <LinkedRecSection linkedRec={linkedRec} refType={item.refType} />
      <AuditTrailSection auditTrail={auditTrail} />

      {/* Fallback: show raw JSON if no structured view matched */}
      {!proposedAction && !evidence && !linkedRec && !item.executionResult && (
        <p className="text-[11px] text-slate-600 italic">No detail data available for this item.</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AIApprovalQueue() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewNote, setReviewNote] = useState<Record<number, string>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ai/approvals", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/ai/approvals?status=${statusFilter}`, { credentials: "include" });
      return res.json();
    },
  });

  const review = useMutation({
    mutationFn: ({ id, decision, note }: { id: number; decision: string; note?: string }) =>
      apiRequest("POST", `/api/ai/approvals/${id}/review`, { decision, note }),
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/ai/approvals"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/summary"] });
      setConfirmState(null);
      if (vars.decision === "approved") {
        // Surface what the auto-executor actually did so admins know it's live
        const platform = data?.platformExecution;
        const site = data?.siteApply;
        if (platform && !platform.skipped && !platform.error) {
          const verb = platform.testMode ? "Dry-run executed" : "Pushed live to platform";
          toast({
            title: `Approved · ${verb}`,
            description: `${platform.platform} → ${platform.actionType} (${platform.resultStatus}). ${platform.summary || ""}`.trim(),
          });
        } else if (site && !site.error) {
          toast({
            title: "Approved · Site updated live",
            description: `Applied ${site.applied?.join(", ")} to ${site.page}. Changes visible immediately.`,
          });
        } else if (platform?.skipped || platform?.error) {
          toast({
            title: "Approved · Platform push skipped",
            description: platform.reason || platform.error || "Enable platform execution flags to auto-push.",
            variant: platform.error ? "destructive" : "default",
          });
        } else if (data?.autoExecuted) {
          toast({ title: "Approved · Deliverable generated", description: "Expand to copy the implementation spec." });
        } else {
          toast({ title: "Approved", description: "Enable 'ai_auto_execute_enabled' to auto-execute on approve." });
        }
      } else {
        toast({ title: vars.decision === "rejected" ? "Rejected" : "Deferred" });
      }
    },
    onError: (err: any) => {
      setConfirmState(null);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const execute = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/ai/approvals/${id}/execute`, {}),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["/api/ai/approvals"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/approvals", id, "detail"] });
      toast({ title: "Execution complete", description: "Deliverable generated. Expand the item to view and copy the implementation spec." });
    },
    onError: (err: any) => toast({ title: "Execution failed", description: err.message, variant: "destructive" }),
  });

  const platformExecute = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/ai/approvals/${id}/platform-execute`, {}),
    onSuccess: (data: any, id) => {
      qc.invalidateQueries({ queryKey: ["/api/ai/approvals"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/approvals", id, "detail"] });
      const testMode = data?.testMode;
      const status = data?.resultStatus ?? "unknown";
      if (status === "success") {
        toast({ title: "Live push succeeded", description: data?.summary ?? "Change sent to the ad platform." });
      } else if (testMode || status === "test_mode") {
        toast({ title: "Dry run complete", description: "No live API call made. Expand the item to view the payload." });
      } else if (status === "failed" || status === "missing_ids") {
        toast({ title: "Platform push failed", description: data?.summary ?? data?.errorMessage, variant: "destructive" });
      } else if (status === "export_only") {
        toast({ title: "Export only — apply manually", description: data?.summary ?? "This action type requires manual application. The payload is in the detail panel." });
      } else {
        toast({ title: "Platform push complete", description: data?.summary ?? "Done." });
      }
    },
    onError: (err: any) => {
      if (err?.message?.includes("already been pushed") || err?.message?.includes("already been")) {
        toast({ title: "Already pushed", description: "This action was already pushed. Expand the item to view the existing result." });
      } else {
        toast({ title: "Platform push failed", description: err.message, variant: "destructive" });
      }
    },
  });

  const { data: connectorStatus } = useQuery<Record<string, any>>({
    queryKey: ["/api/ai/connectors/status"],
    staleTime: 30_000,
  });

  const generateActions = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/actions/generate", {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/ai/approvals"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/summary"] });
      const total = data?.total ?? 0;
      toast({
        title: total > 0 ? `${total} approval-ready action${total !== 1 ? "s" : ""} generated` : "No new actions",
        description: total > 0
          ? `${data.negKeywords ?? 0} neg-kw · ${data.copyTests ?? 0} copy tests · ${data.landingPages ?? 0} landing pages · ${data.croSuggestions ?? 0} CRO (${data.skipped ?? 0} dupes skipped)`
          : "All action types already have pending items — no duplicates created.",
      });
    },
    onError: (err: any) => toast({ title: "Generation failed", description: err.message, variant: "destructive" }),
  });

  const pendingItems = items.filter((i: any) => i.status === "pending");

  function requestConfirm(item: any, decision: "approved" | "rejected" | "deferred") {
    setConfirmState({ id: item.id, decision, note: reviewNote[item.id], title: item.title });
  }

  function executeConfirmed() {
    if (!confirmState) return;
    review.mutate({ id: confirmState.id, decision: confirmState.decision, note: confirmState.note });
  }

  return (
    <div className="pt-14 pb-20 lg:pb-6 lg:pl-56 min-h-screen bg-[#0B0F19]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin/ai">
              <button className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0">
                <ChevronLeft className="w-5 h-5" />
              </button>
            </Link>
            <CheckSquare className="w-6 h-6 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white">Approval Queue</h1>
              <p className="text-xs text-slate-500 truncate">Review AI-proposed actions — all require explicit approval</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto shrink-0">
            {pendingItems.length > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {pendingItems.length} pending
              </span>
            )}
            <button
              onClick={() => generateActions.mutate()}
              disabled={generateActions.isPending}
              data-testid="button-generate-actions"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Zap className="w-4 h-4" />
              {generateActions.isPending ? "Generating…" : "Generate Actions"}
            </button>
          </div>
        </div>

        {/* Confirm Dialog */}
        {confirmState && (() => {
          const meta = DECISION_META[confirmState.decision];
          const Icon = meta.Icon;
          return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md bg-[#131929] border border-white/15 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Confirm Action</p>
                    <p className="text-xs text-slate-500 mt-0.5">This will be recorded in the audit log</p>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-3 overflow-y-auto">
                  <p className="text-sm text-slate-300">
                    You are about to{" "}
                    <span className={`font-bold ${confirmState.decision === "approved" ? "text-emerald-400" : confirmState.decision === "rejected" ? "text-red-400" : "text-slate-300"}`}>
                      {confirmState.decision}
                    </span>{" "}this AI recommendation:
                  </p>
                  <div className="p-3 bg-black/20 border border-white/5 rounded-xl">
                    <p className="text-sm font-medium text-white leading-snug break-words">{confirmState.title}</p>
                    {confirmState.note && <p className="text-xs text-slate-400 mt-1.5 italic break-words">Note: "{confirmState.note}"</p>}
                  </div>
                  {confirmState.decision === "approved" && (
                    <div className="flex items-start gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                      <BotIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-300">
                        Approving will <strong>immediately generate an implementation deliverable</strong> (CRO brief, ad copy spec, or keyword export) for your team to implement manually.
                        No live platform changes are made automatically.
                      </p>
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 border-t border-white/5 flex flex-wrap gap-2 justify-end shrink-0">
                  <button onClick={() => setConfirmState(null)} data-testid="confirm-cancel"
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-sm rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button onClick={executeConfirmed} data-testid="confirm-execute" disabled={review.isPending}
                    className={`flex items-center gap-1.5 px-4 py-2 border text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {review.isPending ? "Processing…" : `Confirm ${meta.label}`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Filter Tabs */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
          <div className="flex gap-1 bg-black/20 rounded-xl p-1 w-max">
            {["pending", "approved", "rejected", "deferred"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} data-testid={`filter-${s}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap ${statusFilter === s ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Info banner — auto-execution note */}
        <div className="flex items-start gap-2 px-4 py-3 bg-violet-500/5 border border-violet-500/10 rounded-xl">
          <BotIcon className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
          <p className="text-[11px] text-violet-300/80 leading-relaxed">
            <strong className="text-violet-300">Auto-execution enabled.</strong> Approving a CRO, ad copy, negative keyword, or landing page action immediately generates a structured deliverable for your team to implement manually.
            No changes are made to Google Ads, Meta, or the live site automatically.
          </p>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-white/10 rounded-2xl">
            <CheckSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No {statusFilter} items</p>
            <p className="text-sm text-slate-600 mt-1">
              {statusFilter === "pending"
                ? "Click Generate Actions to create approval-ready items from your data."
                : `No ${statusFilter} items in the queue.`}
            </p>
            {statusFilter === "pending" && (
              <button onClick={() => generateActions.mutate()} disabled={generateActions.isPending}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold mx-auto transition-colors disabled:opacity-50">
                <Zap className="w-4 h-4" />
                {generateActions.isPending ? "Generating…" : "Generate Actions"}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item: any) => {
              const TypeIcon = TYPE_ICONS[item.queueType] ?? CheckSquare;
              const isExpanded = expandedId === item.id;
              const isApprovedUnexecuted = item.status === "approved" && !item.executionStatus;
              const isExecuting = item.executionStatus === "executing";
              const isExecuted = item.executionStatus === "executed";
              const isExecutionFailed = item.executionStatus === "execution_failed";

              // Platform detection for "Push to Platform" button
              const pa = (item.proposedAction as any) ?? {};
              const pRaw = (pa.platform ?? "").toLowerCase();
              const isGoogleItem = pRaw === "google" || pRaw === "google_ads" || item.queueType === "negative_keyword";
              const isMetaItem   = pRaw === "meta" || pRaw === "meta_ads";
              const isPlatformItem = isGoogleItem || isMetaItem;
              const platformLabel = isGoogleItem ? "Google Ads" : isMetaItem ? "Meta Ads" : null;
              const hasPlatformExec = !!(item.executionResult as any)?.platformExecution;

              // Determine if next push will be live or dry-run from connector status
              const connKey = isGoogleItem ? "google_ads" : isMetaItem ? "meta_ads" : null;
              const connStat = connKey ? connectorStatus?.[connKey] : null;
              const pushWillBeLive = connStat
                ? (connStat.executionEnabled && !connStat.executionTestMode)
                : false;
              return (
                <div key={item.id} data-testid={`approval-item-${item.id}`}
                  className={`bg-white/5 border rounded-xl overflow-hidden transition-all ${
                    item.status === "pending" ? "border-white/10"
                    : isExecuting ? "border-blue-500/30"
                    : isApprovedUnexecuted ? "border-emerald-500/20"
                    : isExecuted ? "border-emerald-500/10 opacity-75"
                    : isExecutionFailed ? "border-red-500/15"
                    : "border-white/5 opacity-70"
                  }`}>

                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center shrink-0 mt-0.5">
                        <TypeIcon className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="text-[10px] font-bold uppercase text-slate-500 bg-black/20 px-1.5 py-0.5 rounded">
                            {TYPE_LABELS[item.queueType] ?? item.queueType}
                          </span>
                          {platformLabel && (
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 ${isGoogleItem ? "text-blue-400 bg-blue-500/10 border-blue-500/20" : "text-purple-400 bg-purple-500/10 border-purple-500/20"}`}>
                              {isGoogleItem ? "Google Ads" : "Meta Ads"}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${RISK_COLORS[item.riskLevel ?? "medium"]}`}>
                            {item.riskLevel} risk
                          </span>
                          {item.confidence && (
                            <span className="text-[10px] text-slate-500">{item.confidence}% confidence</span>
                          )}
                          {item.status !== "pending" && (
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                              item.status === "approved" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                              : item.status === "rejected" ? "text-red-400 bg-red-500/10 border-red-500/20"
                              : "text-slate-400 bg-slate-500/10 border-slate-500/20"}`}>
                              {item.status}
                            </span>
                          )}
                          {isExecuted && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border text-teal-400 bg-teal-500/10 border-teal-500/20 flex items-center gap-1">
                              <CheckCheck className="w-2.5 h-2.5" /> Executed
                            </span>
                          )}
                          {isExecutionFailed && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border text-red-400 bg-red-500/10 border-red-500/15 flex items-center gap-1">
                              <XCircle className="w-2.5 h-2.5" /> Exec Failed
                            </span>
                          )}
                          {isExecuting && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20 flex items-center gap-1">
                              <Loader2 className="w-2.5 h-2.5 animate-spin" /> Executing…
                            </span>
                          )}
                          {isApprovedUnexecuted && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border text-amber-400 bg-amber-500/10 border-amber-500/20 flex items-center gap-1">
                              <Timer className="w-2.5 h-2.5" /> Awaiting Execution
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-white leading-tight">{item.title}</p>
                        {item.description && <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.description}</p>}
                        {item.expectedImpact && <p className="text-xs text-emerald-400 mt-1.5">Expected impact: {item.expectedImpact}</p>}
                        <p className="text-[11px] text-slate-600 mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(item.createdAt).toLocaleString("en-SG")}
                          {item.reviewedBy && ` · Reviewed by ${item.reviewedBy}`}
                        </p>
                        {item.reviewNote && <p className="text-xs text-slate-400 mt-1 italic">"{item.reviewNote}"</p>}
                      </div>
                    </div>

                    {/* Expand/collapse detail */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      data-testid={`expand-detail-${item.id}`}
                      className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 mt-2.5 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {isExpanded ? "Hide detail" : "View evidence · proposed action · rollback"}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-white/5 space-y-4">
                        <DetailPanel item={item} />
                      </div>
                    )}
                  </div>

                  {/* Action buttons — pending only */}
                  {item.status === "pending" && (
                    <div className="border-t border-white/5 px-4 py-3 bg-black/10 space-y-2">
                      <input
                        type="text"
                        placeholder="Optional review note…"
                        value={reviewNote[item.id] ?? ""}
                        onChange={e => setReviewNote(n => ({ ...n, [item.id]: e.target.value }))}
                        data-testid={`note-${item.id}`}
                        className="w-full h-8 px-3 bg-black/20 border border-white/10 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => requestConfirm(item, "approved")} data-testid={`approve-${item.id}`}
                          disabled={review.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button onClick={() => requestConfirm(item, "deferred")} data-testid={`defer-${item.id}`}
                          disabled={review.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                          <Pause className="w-3.5 h-3.5" /> Defer
                        </button>
                        <button onClick={() => requestConfirm(item, "rejected")} data-testid={`reject-${item.id}`}
                          disabled={review.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
                          <X className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-600 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        A confirmation dialog will appear. Approving does not execute live platform changes.
                      </p>
                    </div>
                  )}

                  {/* Executing in-progress banner */}
                  {isExecuting && (
                    <div className="border-t border-blue-500/20 px-4 py-3 bg-blue-500/5 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-blue-400 shrink-0 animate-spin" />
                      <p className="text-[11px] text-blue-400">Generating implementation deliverable… Refresh in a moment.</p>
                    </div>
                  )}

                  {/* Execute section — approved items awaiting execution or retry after failure */}
                  {item.status === "approved" && !isExecuting && (isApprovedUnexecuted || isExecutionFailed) && (
                    <div className={`border-t px-4 py-3 space-y-2 ${isExecutionFailed ? "border-red-500/15 bg-red-500/5" : "border-emerald-500/10 bg-emerald-500/5"}`}>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white">
                            {isExecutionFailed ? "Execution failed — retry to regenerate deliverable" : "Ready to execute — generate implementation deliverable"}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Clicking Execute generates a formatted spec (CSV / brief / ad copy) for your team to implement manually.
                            No automated changes will be made to any live system.
                          </p>
                        </div>
                        <button
                          onClick={() => execute.mutate(item.id)}
                          disabled={execute.isPending}
                          data-testid={`execute-${item.id}`}
                          className={`flex items-center gap-1.5 px-3 py-2 border text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0 ${
                            isExecutionFailed
                              ? "bg-red-600/20 hover:bg-red-600/40 border-red-500/30 text-red-300"
                              : "bg-emerald-600/20 hover:bg-emerald-600/40 border-emerald-500/30 text-emerald-300"
                          }`}
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          {execute.isPending ? "Executing…" : isExecutionFailed ? "Retry Execute" : "Execute"}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-600 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        Execution is logged to the audit trail with actor, timestamp, and full deliverable content.
                      </p>
                    </div>
                  )}

                  {/* Execution complete footer */}
                  {isExecuted && (
                    <div className="border-t border-teal-500/10 px-4 py-3 bg-teal-500/5 space-y-2">
                      <div className="flex items-center gap-2">
                        {item.executionResult?.autoExecuted
                          ? <BotIcon className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          : <CheckCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        }
                        <p className="text-[11px] text-teal-400 flex-1">
                          {item.executionResult?.autoExecuted
                            ? <><strong>Auto-executed after approval</strong> · </>
                            : <><strong>Manually executed</strong> by {item.executedBy} · </>
                          }
                          {item.executedAt ? new Date(item.executedAt).toLocaleString("en-SG", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                          {" "}· Expand to view and copy the deliverable
                        </p>
                      </div>
                      {/* Push to Platform button — appears for ad items after deliverable is generated */}
                      {isPlatformItem && (
                        <div className={`flex flex-wrap items-center gap-2 pt-1 border-t ${hasPlatformExec ? "border-violet-500/10" : "border-teal-500/10"}`}>
                          {hasPlatformExec ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-violet-400">
                              <Rocket className="w-3 h-3" />
                              <span>
                                Platform {(item.executionResult as any)?.platformExecution?.testMode ? "dry-run" : "live push"} recorded
                                {" "}· <span className={`font-semibold ${(item.executionResult as any)?.platformExecution?.resultStatus === "success" ? "text-emerald-400" : (item.executionResult as any)?.platformExecution?.resultStatus === "test_mode" ? "text-blue-400" : (item.executionResult as any)?.platformExecution?.resultStatus === "failed" ? "text-red-400" : "text-amber-400"}`}>{(item.executionResult as any)?.platformExecution?.resultStatus === "success" ? "Succeeded" : (item.executionResult as any)?.platformExecution?.resultStatus === "test_mode" ? "Dry Run Complete" : (item.executionResult as any)?.platformExecution?.resultStatus === "failed" ? "Failed" : (item.executionResult as any)?.platformExecution?.resultStatus}</span>
                                {" "}· Expand to view receipt
                              </span>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1 min-w-0 space-y-1">
                                {/* Readiness indicator */}
                                {pushWillBeLive ? (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                    <p className="text-[10px] text-red-400 font-semibold">Ready to push LIVE — this will make a real API call</p>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    <p className="text-[10px] text-blue-400">Ready — dry run mode · no live changes</p>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => platformExecute.mutate(item.id)}
                                disabled={platformExecute.isPending}
                                data-testid={`platform-execute-${item.id}`}
                                className={`flex items-center gap-1.5 px-3 py-1.5 border text-[11px] font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0 ${
                                  pushWillBeLive
                                    ? "bg-red-600/20 hover:bg-red-600/40 border-red-500/30 text-red-300"
                                    : "bg-violet-600/20 hover:bg-violet-600/40 border-violet-500/30 text-violet-300"
                                }`}
                              >
                                {platformExecute.isPending
                                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Pushing…</>
                                  : pushWillBeLive
                                    ? <><Send className="w-3 h-3" /> Push LIVE to {platformLabel}</>
                                    : <><FlaskConical className="w-3 h-3" /> Dry Run — {platformLabel}</>
                                }
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
