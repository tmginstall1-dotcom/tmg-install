import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckSquare, ChevronLeft, Clock, AlertTriangle,
  Check, X, Pause, ShieldAlert
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

const TYPE_LABELS: Record<string, string> = {
  ads_change: "Ads Change", site_change: "Site Change",
  creative: "Creative Test", budget: "Budget", negative_keyword: "Negative Keyword",
};

interface ConfirmState {
  id: number;
  decision: "approved" | "rejected" | "deferred";
  note?: string;
  title: string;
}

const DECISION_META: Record<string, { label: string; color: string; borderColor: string; Icon: any }> = {
  approved: {
    label: "Approve",
    color: "bg-emerald-600/30 text-emerald-200 border-emerald-500/50",
    borderColor: "border-emerald-500/30",
    Icon: Check,
  },
  rejected: {
    label: "Reject",
    color: "bg-red-600/30 text-red-200 border-red-500/50",
    borderColor: "border-red-500/30",
    Icon: X,
  },
  deferred: {
    label: "Defer",
    color: "bg-slate-600/30 text-slate-200 border-slate-500/50",
    borderColor: "border-slate-500/30",
    Icon: Pause,
  },
};

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
        <div className="flex items-center gap-3">
          <Link href="/admin/ai">
            <button className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <CheckSquare className="w-6 h-6 text-amber-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Approval Queue</h1>
            <p className="text-xs text-slate-500">Review AI-proposed actions before they're applied</p>
          </div>
          {pendingItems.length > 0 && (
            <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {pendingItems.length} pending
            </span>
          )}
        </div>

        {/* Confirmation Dialog */}
        {confirmState && (() => {
          const meta = DECISION_META[confirmState.decision];
          const Icon = meta.Icon;
          return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-4 bg-black/60 backdrop-blur-sm">
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
                    <span className={`font-bold ${
                      confirmState.decision === "approved" ? "text-emerald-400" :
                      confirmState.decision === "rejected" ? "text-red-400" : "text-slate-300"
                    }`}>{confirmState.decision}</span>{" "}
                    this AI recommendation:
                  </p>
                  <div className="p-3 bg-black/20 border border-white/5 rounded-xl">
                    <p className="text-sm font-medium text-white leading-snug break-words">{confirmState.title}</p>
                    {confirmState.note && (
                      <p className="text-xs text-slate-400 mt-1.5 italic break-words">Note: "{confirmState.note}"</p>
                    )}
                  </div>
                  {confirmState.decision === "approved" && (
                    <div className="flex items-start gap-2 p-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-300">Approving will queue this action for execution. Ensure you've reviewed the proposed action details above.</p>
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 border-t border-white/5 flex flex-wrap gap-2 justify-end shrink-0">
                  <button
                    onClick={() => setConfirmState(null)}
                    data-testid="confirm-cancel"
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={executeConfirmed}
                    data-testid="confirm-execute"
                    disabled={review.isPending}
                    className={`flex items-center gap-1.5 px-4 py-2 border text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${meta.color}`}
                  >
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
          <div className="flex gap-1 bg-black/20 rounded-xl p-1 w-max sm:w-fit">
            {["pending", "approved", "rejected", "deferred"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                data-testid={`filter-${s}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                  statusFilter === s ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}>{s}</button>
            ))}
          </div>
        </div>

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
                ? "Run an AI audit or ads analysis to generate recommendations."
                : `No ${statusFilter} items in the queue.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item: any) => (
              <div key={item.id} data-testid={`approval-item-${item.id}`}
                className={`bg-white/5 border rounded-xl overflow-hidden transition-all ${
                  item.status === "pending" ? "border-white/10" : "border-white/5 opacity-70"
                }`}>
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
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
                            item.status === "approved" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                            item.status === "rejected" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                            "text-slate-400 bg-slate-500/10 border-slate-500/20"
                          }`}>{item.status}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-white leading-tight">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.description}</p>
                      )}
                      {item.expectedImpact && (
                        <p className="text-xs text-emerald-400 mt-1.5">Expected impact: {item.expectedImpact}</p>
                      )}
                      <p className="text-[11px] text-slate-600 mt-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.createdAt).toLocaleString("en-SG")}
                        {item.reviewedBy && ` · Reviewed by ${item.reviewedBy}`}
                      </p>
                      {item.reviewNote && (
                        <p className="text-xs text-slate-400 mt-1 italic">"{item.reviewNote}"</p>
                      )}
                    </div>
                  </div>

                  {/* Expand/collapse details */}
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    className="text-[11px] text-slate-600 hover:text-slate-400 mt-2 transition-colors"
                  >
                    {expandedId === item.id ? "Hide details" : "Show details"}
                  </button>
                  {expandedId === item.id && item.proposedAction && (
                    <pre className="mt-2 p-3 bg-black/20 border border-white/5 rounded-lg text-[11px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(item.proposedAction, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Action buttons — only for pending items */}
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
                      <button
                        onClick={() => requestConfirm(item, "approved")}
                        data-testid={`approve-${item.id}`}
                        disabled={review.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => requestConfirm(item, "deferred")}
                        data-testid={`defer-${item.id}`}
                        disabled={review.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Pause className="w-3.5 h-3.5" /> Defer
                      </button>
                      <button
                        onClick={() => requestConfirm(item, "rejected")}
                        data-testid={`reject-${item.id}`}
                        disabled={review.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-600 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      A confirmation dialog will appear before any action is applied.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
