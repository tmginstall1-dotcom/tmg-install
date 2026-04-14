import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckSquare, ChevronLeft, Clock, AlertTriangle,
  Check, X, Pause, ShieldAlert, ChevronDown, ChevronUp,
  Database, FileText, RotateCcw, ScrollText, Zap,
  Target, TrendingDown, ArrowUp, Cpu, Globe, Search,
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
      <EvidenceSection sourceData={evidence} />
      <ProposedActionSection proposedAction={proposedAction} queueType={item.queueType} />
      <RollbackSection rollbackPath={item.rollbackPath} linkedRec={linkedRec} />
      <LinkedRecSection linkedRec={linkedRec} refType={item.refType} />
      <AuditTrailSection auditTrail={auditTrail} />

      {/* Fallback: show raw JSON if no structured view matched */}
      {!proposedAction && !evidence && !linkedRec && (
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
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/ai/approvals"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/summary"] });
      setConfirmState(null);
      toast({ title: vars.decision === "approved" ? "Approved" : vars.decision === "rejected" ? "Rejected" : "Deferred" });
    },
    onError: (err: any) => {
      setConfirmState(null);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
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
                      <AlertTriangle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-300">Approving records this decision. No live platform changes are made until manually executed by your team.</p>
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

        {/* Info banner — no auto-execution reminder */}
        <div className="flex items-start gap-2 px-4 py-3 bg-slate-500/5 border border-slate-500/10 rounded-xl">
          <ShieldAlert className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-slate-500 leading-relaxed">
            All actions are <strong className="text-slate-400">approval-only</strong>. Approving an item records your decision and routes it for manual execution by your team. No automated changes are made to Google Ads, Meta, or the live site.
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
              return (
                <div key={item.id} data-testid={`approval-item-${item.id}`}
                  className={`bg-white/5 border rounded-xl overflow-hidden transition-all ${item.status === "pending" ? "border-white/10" : "border-white/5 opacity-70"}`}>

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
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
