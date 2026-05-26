import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
 MessageCircle, User, Bot, AlertTriangle, Clock,
 CheckCircle2, XCircle, ArrowRight, RefreshCw,
 Shield, ChevronDown, ChevronUp, Phone, Activity,
 Zap, TrendingUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AiConvState =
 | "new_lead" | "qualifying" | "waiting_for_customer"
 | "quote_ready" | "human_review_required" | "quote_sent"
 | "deposit_pending" | "booking_pending" | "completed"
 | "stale_reactivation_candidate" | "blocked_outside_window";

const STATE_META: Record<AiConvState, { label: string; color: string }> = {
 new_lead: { label: "New Lead", color: "text-[#0A0A0A] bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-500/10 dark:border-[#0A0A0A]/20" },
 qualifying: { label: "Qualifying", color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20" },
 waiting_for_customer: { label: "Waiting", color: "text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-500/10 dark:border-slate-500/20" },
 quote_ready: { label: "Quote Ready", color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20" },
 human_review_required: { label: "Needs Human", color: "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20" },
 quote_sent: { label: "Quote Sent", color: "text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-500/10 dark:border-purple-500/20" },
 deposit_pending: { label: "Deposit Pending", color: "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-500/10 dark:border-orange-500/20" },
 booking_pending: { label: "Booking Pending", color: "text-cyan-600 bg-cyan-50 border-cyan-200 dark:text-cyan-400 dark:bg-cyan-500/10 dark:border-cyan-500/20" },
 completed: { label: "Completed", color: "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-500/10 dark:border-green-500/20" },
 stale_reactivation_candidate:{ label: "Stale", color: "text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-500 dark:bg-slate-600/10 dark:border-slate-600/20" },
 blocked_outside_window: { label: "Window Closed", color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20" },
};

function StateBadge({ state }: { state: string }) {
 const meta = STATE_META[state as AiConvState] ?? { label: state, color: "text-slate-500 bg-slate-50 border-slate-200" };
 return (
 <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${meta.color}`}>
 {meta.label}
 </span>
 );
}

function OwnerBadge({ ownership }: { ownership: string }) {
 if (ownership === "ai") {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border text-[#0A0A0A] bg-[#EBE9E2] border-violet-200 dark:text-violet-400 dark:bg-violet-500/10 dark:border-violet-500/20">
 <Bot className="w-3 h-3" /> AI
 </span>
 );
 }
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20">
 <User className="w-3 h-3" /> Human
 </span>
 );
}

function WindowBadge({ open }: { open: boolean }) {
 return open ? (
 <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
 <CheckCircle2 className="w-3 h-3" /> 24hr Open
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-500 dark:text-rose-400">
 <XCircle className="w-3 h-3" /> Closed
 </span>
 );
}

function ConfidenceBar({ value }: { value: number }) {
 const color = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
 const textColor = value >= 70 ? "text-emerald-600 dark:text-emerald-400" : value >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
 return (
 <div className="flex items-center gap-2">
 <div className="flex-1 h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
 <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
 </div>
 <span className={`text-[10px] font-bold tabular-nums ${textColor}`}>{value}%</span>
 </div>
 );
}

function ConversationRow({ conv, onRefresh }: { conv: any; onRefresh: () => void }) {
 const [expanded, setExpanded] = useState(false);
 const { toast } = useToast();

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
 const needsHuman = aiState === "human_review_required" || ownership === "human";

 return (
 <div
 className={`border-b border-black/5 dark:border-white/5 last:border-b-0 ${needsHuman ? "bg-amber-50/50 dark:bg-amber-500/5" : ""}`}
 data-testid={`conv-row-${conv.phone}`}
 >
 <button
 className="w-full text-left px-4 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/5 transition-colors"
 onClick={() => setExpanded(!expanded)}
 >
 <div className="flex items-start gap-3">
 {/* Icon */}
 <div className={`mt-0.5 p-1.5 rounded-full flex-shrink-0 ${needsHuman ? "bg-amber-100 dark:bg-amber-500/15" : "bg-slate-100 dark:bg-white/5"}`}>
 <Phone className={`w-3.5 h-3.5 ${needsHuman ? "text-amber-500" : "text-slate-400 dark:text-white/40"}`} />
 </div>

 {/* Main content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-mono text-sm font-semibold text-slate-800 dark:text-white/90">+{conv.phone}</span>
 {conv.collectedName && (
 <span className="text-sm text-slate-500 dark:text-white/40 truncate max-w-[120px]">{conv.collectedName}</span>
 )}
 </div>
 <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
 <StateBadge state={aiState} />
 <OwnerBadge ownership={ownership} />
 <WindowBadge open={windowOpen} />
 </div>
 {confidence !== null && (
 <div className="mt-2 max-w-[200px]">
 <ConfidenceBar value={confidence} />
 </div>
 )}
 </div>

 {/* Chevron */}
 <div className="flex-shrink-0 mt-1">
 {expanded
 ? <ChevronUp className="w-4 h-4 text-slate-300 dark:text-white/20" />
 : <ChevronDown className="w-4 h-4 text-slate-300 dark:text-white/20" />}
 </div>
 </div>
 </button>

 {expanded && (
 <div className="px-4 pb-4 pt-1 space-y-4 bg-black/[0.01] dark:bg-black/10 border-t border-black/5 dark:border-white/5">
 {facts && (
 <div>
 <p className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest mb-2">Extracted Facts</p>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
 {Object.entries(facts).filter(([k]) => k !== "confidenceLevel").map(([k, v]) => (
 <div key={k} className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 px-3 py-2 rounded-lg">
 <p className="text-[9px] text-slate-400 dark:text-white/30 uppercase tracking-wider">{k}</p>
 <p className="text-xs text-slate-700 dark:text-white/80 mt-0.5 break-words">
 {Array.isArray(v) ? (v as string[]).join(", ") : String(v)}
 </p>
 </div>
 ))}
 </div>
 </div>
 )}

 {missing.length > 0 && (
 <div>
 <p className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest mb-2">Missing Facts</p>
 <div className="flex flex-wrap gap-1.5">
 {missing.map((f: string) => (
 <span key={f} className="px-2 py-1 text-[10px] bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-300 rounded-full">{f}</span>
 ))}
 </div>
 </div>
 )}

 {conv.handoffReason && (
 <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg">
 <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
 <span className="text-sm text-amber-700 dark:text-amber-300">
 Handoff reason: <strong>{conv.handoffReason}</strong>
 </span>
 </div>
 )}

 <div className="flex gap-2 flex-wrap pt-1">
 {ownership === "ai" && (
 <button
 data-testid={`btn-handoff-${conv.phone}`}
 onClick={() => handoffMutation.mutate(conv.phone)}
 disabled={handoffMutation.isPending}
 className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/30 transition-colors disabled:opacity-50"
 >
 {handoffMutation.isPending ? "…" : "Hand Off to Human"}
 </button>
 )}
 {ownership === "human" && (
 <button
 data-testid={`btn-resume-ai-${conv.phone}`}
 onClick={() => resumeMutation.mutate(conv.phone)}
 disabled={resumeMutation.isPending}
 className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold bg-[#EBE9E2] dark:bg-violet-500/20 text-[#0A0A0A] dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 rounded-lg hover:bg-violet-100 dark:hover:bg-violet-500/30 transition-colors disabled:opacity-50"
 >
 {resumeMutation.isPending ? "…" : "Resume AI"}
 </button>
 )}
 <a
 href={`/admin/conversations?phone=${conv.phone}`}
 className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-white/60 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors inline-flex items-center justify-center gap-1"
 >
 View Chat <ArrowRight className="w-3 h-3" />
 </a>
 </div>
 </div>
 )}
 </div>
 );
}

function DiagnosticsPanel() {
 const { data, isLoading, refetch } = useQuery<{
 pendingFollowups: number;
 openHandoffs: number;
 aiOwnedSessions: number;
 humanOwnedSessions: number;
 duplicateSkipped: number;
 windowBlocked: number;
 lastProcessedEvent: string | null;
 recentEvents: Array<{ id: number; actionType: string; summary: string; createdAt: string }>;
 }>({
 queryKey: ["/api/admin/ai/whatsapp/diagnostics"],
 refetchInterval: 30000,
 });

 const stats = [
 { label: "Follow-ups", value: data?.pendingFollowups ?? "—", warn: (data?.pendingFollowups ?? 0) > 10 },
 { label: "Open Handoffs", value: data?.openHandoffs ?? "—", warn: (data?.openHandoffs ?? 0) > 0 },
 { label: "AI Owned", value: data?.aiOwnedSessions ?? "—", warn: false },
 { label: "Human Owned", value: data?.humanOwnedSessions ?? "—", warn: (data?.humanOwnedSessions ?? 0) > 0 },
 { label: "Duplicates", value: data?.duplicateSkipped ?? "—", warn: false },
 { label: "Win. Blocked", value: data?.windowBlocked ?? "—", warn: false },
 ];

 const ACTION_COLORS: Record<string, string> = {
 ai_reply_sent: "text-emerald-600 dark:text-emerald-400",
 handoff_triggered: "text-amber-600 dark:text-amber-400",
 manual_handoff: "text-amber-600 dark:text-amber-400",
 manual_resume: "text-[#0A0A0A] dark:text-violet-400",
 ai_duplicate_skipped: "text-slate-500 dark:text-slate-400",
 ai_window_blocked: "text-rose-600 dark:text-rose-400",
 followup_sent: "text-[#0A0A0A] dark:text-blue-400",
 };

 return (
 <div className="bg-white dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-none overflow-hidden">
 <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
 <Activity className="w-4 h-4 text-slate-400" />
 <h3 className="text-sm font-bold text-slate-700 dark:text-white/70">System Diagnostics</h3>
 <span className="ml-auto text-xs text-slate-400 dark:text-white/20 italic hidden sm:block">auto-refreshes 30s</span>
 <button
 onClick={() => refetch()}
 className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
 data-testid="btn-refresh-diagnostics"
 >
 <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
 </button>
 </div>

 <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-black/5 dark:divide-white/5">
 {stats.map(({ label, value, warn }) => (
 <div key={label} className="px-3 py-3 text-center">
 <p className="text-[9px] text-slate-400 dark:text-white/30 uppercase tracking-wider leading-tight">{label}</p>
 <p className={`text-xl font-black mt-1 ${warn ? "text-amber-500" : "text-slate-700 dark:text-white/70"}`}>{value}</p>
 </div>
 ))}
 </div>

 {data?.lastProcessedEvent && (
 <div className="px-4 py-2 border-t border-black/5 dark:border-white/5 text-xs text-slate-400 dark:text-white/30">
 Last event: <span className="text-slate-600 dark:text-white/50">{new Date(data.lastProcessedEvent).toLocaleString("en-SG")}</span>
 </div>
 )}

 {isLoading ? (
 <p className="px-4 py-4 text-xs text-slate-400 dark:text-white/20 text-center">Loading diagnostics…</p>
 ) : (data?.recentEvents ?? []).length === 0 ? (
 <p className="px-4 py-4 text-xs text-slate-400 dark:text-white/20 text-center border-t border-black/5 dark:border-white/5">
 No events yet — agent has not been active.
 </p>
 ) : (
 <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03] border-t border-black/5 dark:border-white/5">
 {(data?.recentEvents ?? []).map(ev => (
 <div key={ev.id} className="px-4 py-2.5 flex items-start gap-3">
 <span className={`text-[10px] font-mono font-bold flex-shrink-0 mt-0.5 ${ACTION_COLORS[ev.actionType] ?? "text-slate-400"}`}>
 {ev.actionType}
 </span>
 <span className="text-xs text-slate-500 dark:text-white/40 flex-1 min-w-0 truncate">{ev.summary}</span>
 <span className="ml-auto text-[10px] text-slate-300 dark:text-white/20 flex-shrink-0 tabular-nums">
 {new Date(ev.createdAt).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

export default function AIWhatsApp() {
 const { toast } = useToast();
 const qc = useQueryClient();

 const { data: allFlags = [], isLoading: flagsLoading } = useQuery<Array<{ key: string; value: boolean; description: string }>>({
 queryKey: ["/api/ai/flags"],
 });

 const { data: convsData, isLoading: convsLoading, refetch } = useQuery<{ conversations: any[] }>({
 queryKey: ["/api/admin/ai/whatsapp/conversations"],
 });

 const toggleFlag = useMutation({
 mutationFn: ({ key, value }: { key: string; value: boolean }) =>
 apiRequest("PATCH", `/api/ai/flags/${key}`, { value }),
 onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ai/flags"] }); },
 onError: () => toast({ title: "Failed to update flag", variant: "destructive" }),
 });

 const waFlags = allFlags.filter(f => f.key.startsWith("ai_whatsapp"));
 const conversations = convsData?.conversations ?? [];
 const agentEnabled = allFlags.find(f => f.key === "ai_whatsapp_agent_enabled")?.value ?? false;

 const stateBreakdown = conversations.reduce<Record<string, number>>((acc, c) => {
 const s = c.aiState || "new_lead";
 acc[s] = (acc[s] || 0) + 1;
 return acc;
 }, {});

 const humanOwned = conversations.filter(c => c.aiOwnership === "human").length;
 const needsAttention = conversations.filter(c =>
 c.aiState === "human_review_required" || c.aiOwnership === "human"
 ).length;

 const sortedConversations = [...conversations].sort((a, b) => {
 const needsHumanA = a.aiOwnership === "human" ? 1 : 0;
 const needsHumanB = b.aiOwnership === "human" ? 1 : 0;
 return needsHumanB - needsHumanA;
 });

 return (
 <div className="pt-14 pb-20 lg:pb-6 lg:pl-56 min-h-screen bg-[#0B0F19]">
 <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

 {/* ── Header ────────────────────────────────────────────── */}
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-none flex-shrink-0">
 <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
 </div>
 <div className="min-w-0">
 <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">WhatsApp AI Agent</h2>
 <p className="text-xs text-slate-500 dark:text-white/40">Qualification · Handoff · Follow-up</p>
 </div>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap ${
 agentEnabled
 ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20"
 : "text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-500/10 dark:border-slate-500/20"
 }`}>
 <span className={`w-1.5 h-1.5 rounded-full ${agentEnabled ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
 {agentEnabled ? "ACTIVE" : "OFF"}
 </div>
 <button
 onClick={() => refetch()}
 className="p-2 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-none hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
 data-testid="btn-refresh-wa-convs"
 >
 <RefreshCw className="w-4 h-4 text-slate-400" />
 </button>
 </div>
 </div>

 {/* ── Stat Cards ─────────────────────────────────────────── */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 { label: "Total Leads", value: conversations.length, icon: TrendingUp, color: "text-[#0A0A0A] dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10", border: "border-blue-100 dark:border-[#0A0A0A]/20" },
 { label: "Needs Human", value: needsAttention, icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-100 dark:border-amber-500/20" },
 { label: "Human Owned", value: humanOwned, icon: User, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-500/10", border: "border-rose-100 dark:border-rose-500/20" },
 { label: "Quote Ready", value: stateBreakdown["quote_ready"] || 0, icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-100 dark:border-emerald-500/20" },
 ].map(({ label, value, icon: Icon, color, bg, border }) => (
 <div key={label} className={`${bg} border ${border} rounded-none p-4`}>
 <div className="flex items-center gap-2 mb-2">
 <Icon className={`w-4 h-4 ${color}`} />
 <span className="text-xs text-slate-500 dark:text-white/40 font-medium">{label}</span>
 </div>
 <p className={`text-3xl font-black ${color}`}>{value}</p>
 </div>
 ))}
 </div>

 {/* ── Feature Flags ──────────────────────────────────────── */}
 <div className="bg-white dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-none overflow-hidden">
 <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
 <Shield className="w-4 h-4 text-slate-400" />
 <h3 className="text-sm font-bold text-slate-700 dark:text-white/70">Feature Flags</h3>
 </div>
 <div className="divide-y divide-black/5 dark:divide-white/5">
 {flagsLoading ? (
 <p className="px-4 py-4 text-sm text-slate-400 dark:text-white/30">Loading flags…</p>
 ) : waFlags.length === 0 ? (
 <p className="px-4 py-4 text-sm text-slate-400 dark:text-white/30">No WhatsApp flags found</p>
 ) : (
 waFlags.map(flag => {
 const shortKey = flag.key.replace("ai_whatsapp_", "").replace(/_/g, " ");
 return (
 <div key={flag.key} className="px-4 py-3 flex items-center gap-3">
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-slate-700 dark:text-white/70 capitalize leading-tight">{shortKey}</p>
 <p className="text-[10px] font-mono text-slate-300 dark:text-white/25 mt-0.5 truncate">{flag.key}</p>
 </div>
 <button
 data-testid={`toggle-${flag.key}`}
 onClick={() => toggleFlag.mutate({ key: flag.key, value: !flag.value })}
 disabled={toggleFlag.isPending}
 className={`flex-shrink-0 relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
 flag.value
 ? "bg-emerald-500 border-emerald-500"
 : "bg-slate-200 dark:bg-slate-700 border-slate-200 dark:border-slate-700"
 }`}
 role="switch"
 aria-checked={flag.value}
 >
 <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${flag.value ? "translate-x-5" : "translate-x-0.5"}`} />
 </button>
 </div>
 );
 })
 )}
 </div>
 </div>

 {/* ── Conversations ──────────────────────────────────────── */}
 <div className="bg-white dark:bg-white/[0.02] border border-black/10 dark:border-white/10 rounded-none overflow-hidden">
 <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
 <Bot className="w-4 h-4 text-slate-400" />
 <h3 className="text-sm font-bold text-slate-700 dark:text-white/70">AI Conversations</h3>
 <span className="ml-auto text-xs font-semibold text-slate-400 dark:text-white/30 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
 {conversations.length}
 </span>
 </div>

 {convsLoading ? (
 <div className="px-4 py-10 text-center">
 <div className="w-6 h-6 border-2 border-slate-300 dark:border-white/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
 <p className="text-sm text-slate-400 dark:text-white/30">Loading conversations…</p>
 </div>
 ) : sortedConversations.length === 0 ? (
 <div className="px-4 py-10 text-center">
 <MessageCircle className="w-8 h-8 text-slate-200 dark:text-white/10 mx-auto mb-3" />
 <p className="text-sm text-slate-400 dark:text-white/30">No conversations yet.</p>
 <p className="text-xs text-slate-300 dark:text-white/20 mt-1">Enable the agent to start qualifying inbound leads.</p>
 </div>
 ) : (
 sortedConversations.map(conv => (
 <ConversationRow key={conv.phone} conv={conv} onRefresh={refetch} />
 ))
 )}
 </div>

 {/* ── Diagnostics ────────────────────────────────────────── */}
 <DiagnosticsPanel />

 {/* ── Policy notice ──────────────────────────────────────── */}
 <div className="flex items-start gap-3 px-4 py-3.5 bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-none">
 <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
 <div className="text-xs text-amber-700 dark:text-amber-300/80 space-y-1">
 <p className="font-bold text-amber-700 dark:text-amber-300">WhatsApp 24-Hour Window Policy</p>
 <p>The AI agent may only send free-form messages within 24 hours of the last customer-initiated message. Outside this window, only approved templates are permitted. The system enforces this automatically.</p>
 </div>
 </div>

 </div>
 </div>
 );
}
