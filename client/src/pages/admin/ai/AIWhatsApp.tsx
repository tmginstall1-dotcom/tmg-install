import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  MessageCircle, User, Bot, AlertTriangle, Clock,
  CheckCircle2, XCircle, ArrowRight, RefreshCw,
  Shield, Zap, ChevronDown, ChevronUp, Phone
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AiConvState =
  | "new_lead" | "qualifying" | "waiting_for_customer"
  | "quote_ready" | "human_review_required" | "quote_sent"
  | "deposit_pending" | "booking_pending" | "completed"
  | "stale_reactivation_candidate" | "blocked_outside_window";

const STATE_META: Record<AiConvState, { label: string; color: string }> = {
  new_lead:                    { label: "New Lead",        color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  qualifying:                  { label: "Qualifying",      color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  waiting_for_customer:        { label: "Waiting",         color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
  quote_ready:                 { label: "Quote Ready",     color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  human_review_required:       { label: "Needs Human",     color: "text-red-400 bg-red-500/10 border-red-500/20" },
  quote_sent:                  { label: "Quote Sent",      color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  deposit_pending:             { label: "Deposit Pending", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  booking_pending:             { label: "Booking Pending", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  completed:                   { label: "Completed",       color: "text-green-400 bg-green-500/10 border-green-500/20" },
  stale_reactivation_candidate:{ label: "Stale",           color: "text-slate-500 bg-slate-600/10 border-slate-600/20" },
  blocked_outside_window:      { label: "Window Closed",   color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
};

function StateBadge({ state }: { state: string }) {
  const meta = STATE_META[state as AiConvState] ?? { label: state, color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function OwnerBadge({ ownership }: { ownership: string }) {
  if (ownership === "ai") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border text-violet-400 bg-violet-500/10 border-violet-500/20">
        <Bot className="w-3 h-3" /> AI
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border text-amber-400 bg-amber-500/10 border-amber-500/20">
      <User className="w-3 h-3" /> Human
    </span>
  );
}

function WindowBadge({ open }: { open: boolean }) {
  return open ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
      <CheckCircle2 className="w-3 h-3" /> 24hr Window Open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400">
      <XCircle className="w-3 h-3" /> Window Closed
    </span>
  );
}

function ConversationRow({ conv, onRefresh }: { conv: any; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handoffMutation = useMutation({
    mutationFn: (phone: string) =>
      apiRequest("POST", `/api/admin/ai/whatsapp/conversations/${phone}/handoff`, { reason: "manual_admin" }),
    onSuccess: () => { toast({ title: "Handed off to human" }); onRefresh(); },
    onError: () => toast({ title: "Handoff failed", variant: "destructive" }),
  });

  const resumeMutation = useMutation({
    mutationFn: (phone: string) =>
      apiRequest("POST", `/api/admin/ai/whatsapp/conversations/${phone}/resume-ai`, {}),
    onSuccess: () => { toast({ title: "AI ownership resumed" }); onRefresh(); },
    onError: () => toast({ title: "Resume failed", variant: "destructive" }),
  });

  const facts = (() => { try { return conv.caseFacts ? JSON.parse(conv.caseFacts) : null; } catch { return null; } })();
  const missing = (() => { try { return conv.missingFacts ? JSON.parse(conv.missingFacts) : []; } catch { return []; } })();
  const confidence = conv.confidenceScore ? Math.round(parseFloat(conv.confidenceScore) * 100) : null;
  const windowOpen = conv.windowOpen ?? false;
  const aiState = conv.aiState || "new_lead";
  const ownership = conv.aiOwnership || "ai";

  return (
    <div className="border border-white/10 bg-white/[0.02] rounded-none" data-testid={`conv-row-${conv.phone}`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Phone className="w-4 h-4 text-white/40 flex-shrink-0" />
        <span className="font-mono text-sm text-white/80 flex-shrink-0">+{conv.phone}</span>
        <span className="text-white/40 text-xs flex-shrink-0">{conv.collectedName || "—"}</span>
        <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
          <WindowBadge open={windowOpen} />
          <OwnerBadge ownership={ownership} />
          <StateBadge state={aiState} />
          {confidence !== null && (
            <span className={`text-[10px] font-bold ${confidence >= 70 ? "text-emerald-400" : confidence >= 40 ? "text-amber-400" : "text-red-400"}`}>
              {confidence}% conf
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 space-y-4 pt-3">
          {/* Facts */}
          {facts && (
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Extracted Facts</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(facts).filter(([k]) => k !== "confidenceLevel").map(([k, v]) => (
                  <div key={k} className="bg-white/5 px-2 py-1.5 rounded-none">
                    <p className="text-[9px] text-white/30 uppercase tracking-wider">{k}</p>
                    <p className="text-xs text-white/80 truncate">{Array.isArray(v) ? (v as string[]).join(", ") : String(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing facts */}
          {missing.length > 0 && (
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Missing Facts</p>
              <div className="flex flex-wrap gap-1">
                {missing.map((f: string) => (
                  <span key={f} className="px-2 py-0.5 text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-none">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Handoff reason */}
          {conv.handoffReason && (
            <div className="flex items-center gap-2 text-sm text-amber-300">
              <AlertTriangle className="w-4 h-4" />
              <span>Handoff reason: <strong>{conv.handoffReason}</strong></span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {ownership === "ai" && (
              <button
                data-testid={`btn-handoff-${conv.phone}`}
                onClick={() => handoffMutation.mutate(conv.phone)}
                disabled={handoffMutation.isPending}
                className="px-3 py-1.5 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
              >
                {handoffMutation.isPending ? "..." : "Hand Off to Human"}
              </button>
            )}
            {ownership === "human" && (
              <button
                data-testid={`btn-resume-ai-${conv.phone}`}
                onClick={() => resumeMutation.mutate(conv.phone)}
                disabled={resumeMutation.isPending}
                className="px-3 py-1.5 text-xs font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
              >
                {resumeMutation.isPending ? "..." : "Resume AI"}
              </button>
            )}
            <a
              href={`/admin/conversations?phone=${conv.phone}`}
              className="px-3 py-1.5 text-xs font-bold bg-white/5 text-white/60 border border-white/10 hover:bg-white/10 transition-colors inline-flex items-center gap-1"
            >
              View Chat <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AIWhatsApp() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: flagsData, isLoading: flagsLoading } = useQuery<{ flags: Array<{ key: string; value: boolean; description: string }> }>({
    queryKey: ["/api/ai/flags"],
  });

  const { data: convsData, isLoading: convsLoading, refetch } = useQuery<{ conversations: any[] }>({
    queryKey: ["/api/admin/ai/whatsapp/conversations"],
  });

  const toggleFlag = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      apiRequest("POST", "/api/ai/flags", { key, value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ai/flags"] }); },
    onError: () => toast({ title: "Failed to update flag", variant: "destructive" }),
  });

  const flags = flagsData?.flags ?? [];
  const waFlags = flags.filter(f => f.key.startsWith("ai_whatsapp"));
  const conversations = convsData?.conversations ?? [];
  const agentEnabled = flags.find(f => f.key === "ai_whatsapp_agent_enabled")?.value ?? false;

  const stateBreakdown = conversations.reduce<Record<string, number>>((acc, c) => {
    const s = c.aiState || "new_lead";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const humanOwned = conversations.filter(c => c.aiOwnership === "human").length;
  const needsAttention = conversations.filter(c =>
    c.aiState === "human_review_required" || c.aiOwnership === "human"
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20">
            <MessageCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">WhatsApp AI Sales Agent</h2>
            <p className="text-xs text-white/40">Lead qualification · Fact extraction · Follow-up · Handoff</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2 py-1 border text-xs font-bold ${agentEnabled ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-slate-400 bg-slate-500/10 border-slate-500/20"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${agentEnabled ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            {agentEnabled ? "AGENT ACTIVE" : "AGENT OFF"}
          </div>
          <button
            onClick={() => refetch()}
            className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            data-testid="btn-refresh-wa-convs"
          >
            <RefreshCw className="w-4 h-4 text-white/40" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: conversations.length, icon: MessageCircle, color: "text-blue-400" },
          { label: "Needs Human", value: needsAttention, icon: AlertTriangle, color: "text-amber-400" },
          { label: "Human Owned", value: humanOwned, icon: User, color: "text-rose-400" },
          { label: "Quote Ready", value: stateBreakdown["quote_ready"] || 0, icon: CheckCircle2, color: "text-emerald-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Feature Flags */}
      <div className="border border-white/10 bg-white/[0.02]">
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
          <Shield className="w-4 h-4 text-white/40" />
          <h3 className="text-sm font-bold text-white/70">Agent Feature Flags</h3>
        </div>
        <div className="divide-y divide-white/5">
          {flagsLoading ? (
            <p className="px-4 py-3 text-sm text-white/30">Loading flags…</p>
          ) : waFlags.length === 0 ? (
            <p className="px-4 py-3 text-sm text-white/30">No WhatsApp flags found</p>
          ) : (
            waFlags.map(flag => (
              <div key={flag.key} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-mono text-white/60">{flag.key}</p>
                  <p className="text-xs text-white/30 mt-0.5 truncate">{flag.description}</p>
                </div>
                <button
                  data-testid={`toggle-${flag.key}`}
                  onClick={() => toggleFlag.mutate({ key: flag.key, value: !flag.value })}
                  disabled={toggleFlag.isPending}
                  className={`flex-shrink-0 px-3 py-1 text-xs font-bold border transition-colors ${
                    flag.value
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
                      : "bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20"
                  }`}
                >
                  {flag.value ? "ON" : "OFF"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversations */}
      <div className="border border-white/10 bg-white/[0.02]">
        <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
          <Bot className="w-4 h-4 text-white/40" />
          <h3 className="text-sm font-bold text-white/70">AI Conversations</h3>
          <span className="ml-auto text-xs text-white/30">{conversations.length} leads</span>
        </div>

        {convsLoading ? (
          <p className="px-4 py-6 text-sm text-white/30 text-center">Loading conversations…</p>
        ) : conversations.length === 0 ? (
          <p className="px-4 py-6 text-sm text-white/30 text-center">
            No conversations yet. Enable the agent to start qualifying inbound leads.
          </p>
        ) : (
          <div className="divide-y divide-white/5">
            {conversations
              .sort((a, b) => {
                const needsHumanA = a.aiOwnership === "human" ? 1 : 0;
                const needsHumanB = b.aiOwnership === "human" ? 1 : 0;
                return needsHumanB - needsHumanA;
              })
              .map(conv => (
                <ConversationRow key={conv.phone} conv={conv} onRefresh={refetch} />
              ))}
          </div>
        )}
      </div>

      {/* Policy reminder */}
      <div className="border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3">
        <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-300/80 space-y-1">
          <p className="font-bold text-amber-300">WhatsApp 24-Hour Window Policy</p>
          <p>The AI agent may only send free-form messages within 24 hours of the last customer-initiated message. Outside this window, only approved message templates are permitted. The system enforces this automatically.</p>
        </div>
      </div>
    </div>
  );
}
