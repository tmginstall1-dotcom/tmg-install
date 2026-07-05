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
 new_lead: { label: "New Lead", color: "text-[#0A0A0A] bg-[#EBE9E2] border-black/10 dark:border-[#0A0A0A]/20" },
 qualifying: { label: "Qualifying", color: "text-[#C1121F] bg-[#FBEBEB] border-[#C1121F]/20 dark:text-[#C1121F] dark:bg-[#FBEBEB] dark:border-[#C1121F]/20" },
 waiting_for_customer: { label: "Waiting", color: "text-black/75 bg-[#F5F4F0] border-black/10 dark:text-black/55 dark:bg-black/[0.04]" },
 quote_ready: { label: "Quote Ready", color: "text-[#0A0A0A] bg-[#EBE9E2] border-black/10" },
 human_review_required: { label: "Needs Human", color: "text-[#C1121F] bg-[#0A0A0A] border-black/10 dark:text-[#C1121F] dark:bg-[#FBEBEB] dark:border-[#C1121F]/20" },
 quote_sent: { label: "Quote Sent", color: "text-[#0A0A0A] bg-[#0A0A0A] border-black/10 dark:bg-[#EBE9E2]" },
 deposit_pending: { label: "Deposit Pending", color: "text-[#C1121F] bg-[#0A0A0A] border-black/10 dark:text-[#C1121F] dark:bg-[#FBEBEB] dark:border-[#C1121F]/20" },
 booking_pending: { label: "Booking Pending", color: "text-[#0A0A0A] bg-[#EBE9E2] border-black/100/10" },
 completed: { label: "Completed", color: "text-[#0A0A0A] bg-[#0A0A0A] border-black/10 dark:bg-[#0A0A0A]/10" },
 stale_reactivation_candidate:{ label: "Stale", color: "text-black/55 bg-[#F5F4F0] border-black/10 dark:text-black/55 dark:border-black/10" },
 blocked_outside_window: { label: "Window Closed", color: "text-[#0A0A0A] bg-[#0A0A0A] border-black/10 dark:text-[#C1121F] dark:bg-[#FBEBEB] dark:border-[#C1121F]/20" },
};

function StateBadge({ state }: { state: string }) {
 const meta = STATE_META[state as AiConvState] ?? { label: state, color: "text-black/55 bg-[#F5F4F0] border-black/10" };
 return (
 <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border ${meta.color}`}>
 {meta.label}
 </span>
 );
}

function OwnerBadge({ ownership }: { ownership: string }) {
 if (ownership === "ai") {
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border text-[#0A0A0A] bg-[#EBE9E2] border-black/10 dark:border-[#0A0A0A]/15">
 <Bot className="w-3 h-3" /> AI
 </span>
 );
 }
 return (
 <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border text-[#C1121F] bg-[#FBEBEB] border-[#C1121F]/20 dark:text-[#C1121F] dark:bg-[#FBEBEB] dark:border-[#C1121F]/20">
 <User className="w-3 h-3" /> Human
 </span>
 );
}

function WindowBadge({ open }: { open: boolean }) {
 return open ? (
 <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0A0A0A]">
 <CheckCircle2 className="w-3 h-3" /> 24hr Open
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#C1121F] dark:text-[#C1121F]">
 <XCircle className="w-3 h-3" /> Closed
 </span>
 );
}

function ConfidenceBar({ value }: { value: number }) {
 const color = value >= 70 ? "bg-[#EBE9E2]0" : value >= 40 ? "bg-[#C1121F]" : "bg-[#0A0A0A]";
 const textColor = value >= 70 ? "text-[#0A0A0A]" : value >= 40 ? "text-[#C1121F] dark:text-[#C1121F]" : "text-[#C1121F] dark:text-[#C1121F]";
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
 className={`border-b border-black/5 dark:border-white/5 last:border-b-0 ${needsHuman ? "bg-[#FBEBEB]/50 dark:bg-[#C1121F]/5" : ""}`}
 data-testid={`conv-row-${conv.phone}`}
 >
 <button
 className="w-full text-left px-4 py-3.5 hover:bg-black/[0.02] dark:hover:bg-white/5 transition-colors"
 onClick={() => setExpanded(!expanded)}
 >
 <div className="flex items-start gap-3">
 {/* Icon */}
 <div className={`mt-0.5 p-1.5 rounded-full flex-shrink-0 ${needsHuman ? "bg-[#FBEBEB] dark:bg-[#FBEBEB]" : "bg-[#EBE9E2] dark:bg-white/5"}`}>
 <Phone className={`w-3.5 h-3.5 ${needsHuman ? "text-[#C1121F]" : "text-black/55 dark:text-white/40"}`} />
 </div>

 {/* Main content */}
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="font-mono text-sm font-semibold text-[#0A0A0A]/90">+{conv.phone}</span>
 {conv.collectedName && (
 <span className="text-sm text-black/55/40 truncate max-w-[120px]">{conv.collectedName}</span>
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
 ? <ChevronUp className="w-4 h-4 text-black/65/20" />
 : <ChevronDown className="w-4 h-4 text-black/65/20" />}
 </div>
 </div>
 </button>

 {expanded && (
 <div className="px-4 pb-4 pt-1 space-y-4 bg-black/[0.01] dark:bg-black/10 border-t border-black/5 dark:border-white/5">
 {facts && (
 <div>
 <p className="text-[10px] font-bold text-black/55/30 uppercase tracking-widest mb-2">Extracted Facts</p>
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
 {Object.entries(facts).filter(([k]) => k !== "confidenceLevel").map(([k, v]) => (
 <div key={k} className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/5 px-3 py-2 rounded-lg">
 <p className="text-[9px] text-black/55/30 uppercase tracking-wider">{k}</p>
 <p className="text-xs text-[#0A0A0A]/80 mt-0.5 break-words">
 {Array.isArray(v) ? (v as string[]).join(", ") : String(v)}
 </p>
 </div>
 ))}
 </div>
 </div>
 )}

 {missing.length > 0 && (
 <div>
 <p className="text-[10px] font-bold text-black/55/30 uppercase tracking-widest mb-2">Missing Facts</p>
 <div className="flex flex-wrap gap-1.5">
 {missing.map((f: string) => (
 <span key={f} className="px-2 py-1 text-[10px] bg-[#0A0A0A] dark:bg-[#FBEBEB] border border-black/10 dark:border-[#C1121F]/20 text-[#0A0A0A] dark:text-[#C1121F] rounded-full">{f}</span>
 ))}
 </div>
 </div>
 )}

 {conv.handoffReason && (
 <div className="flex items-center gap-2 px-3 py-2 bg-[#FBEBEB] dark:bg-[#FBEBEB] border border-[#C1121F]/20 dark:border-[#C1121F]/20 rounded-lg">
 <AlertTriangle className="w-4 h-4 text-[#C1121F] flex-shrink-0" />
 <span className="text-sm text-[#C1121F] dark:text-[#C1121F]">
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
 className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold bg-[#FBEBEB] dark:bg-[#FBEBEB] text-[#C1121F] dark:text-[#C1121F] border border-[#C1121F]/20 dark:border-[#C1121F]/30 rounded-lg hover:bg-[#FBEBEB] dark:hover:bg-[#C1121F]/30 transition-colors disabled:opacity-50"
 >
 {handoffMutation.isPending ? "…" : "Hand Off to Human"}
 </button>
 )}
 {ownership === "human" && (
 <button
 data-testid={`btn-resume-ai-${conv.phone}`}
 onClick={() => resumeMutation.mutate(conv.phone)}
 disabled={resumeMutation.isPending}
 className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold bg-[#EBE9E2] dark:bg-[#0A0A0A]/20 text-[#0A0A0A]/65 border border-black/10 dark:border-[#0A0A0A]/30 rounded-lg hover:bg-[#0A0A0A] dark:hover:bg-[#0A0A0A]/30 transition-colors disabled:opacity-50"
 >
 {resumeMutation.isPending ? "…" : "Resume AI"}
 </button>
 )}
 <a
 href={`/admin/conversations?phone=${conv.phone}`}
 className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold bg-[#F5F4F0] dark:bg-white/5 text-black/75/60 border border-black/10 rounded-lg hover:bg-[#EBE9E2] dark:hover:bg-white/10 transition-colors inline-flex items-center justify-center gap-1"
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
 ai_reply_sent: "text-[#0A0A0A]",
 handoff_triggered: "text-[#C1121F] dark:text-[#C1121F]",
 manual_handoff: "text-[#C1121F] dark:text-[#C1121F]",
 manual_resume: "text-[#0A0A0A]",
 ai_duplicate_skipped: "text-black/55 dark:text-black/55",
 ai_window_blocked: "text-[#0A0A0A] dark:text-[#C1121F]",
 followup_sent: "text-[#0A0A0A]",
 };

 return (
 <div className="bg-white dark:bg-white/[0.02] border border-black/10 rounded-none overflow-hidden">
 <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
 <Activity className="w-4 h-4 text-black/55" />
 <h3 className="text-sm font-bold text-[#0A0A0A]/70">System Diagnostics</h3>
 <span className="ml-auto text-xs text-black/55/20 italic hidden sm:block">auto-refreshes 30s</span>
 <button
 onClick={() => refetch()}
 className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
 data-testid="btn-refresh-diagnostics"
 >
 <RefreshCw className="w-3.5 h-3.5 text-black/55" />
 </button>
 </div>

 <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-black/5 dark:divide-white/5">
 {stats.map(({ label, value, warn }) => (
 <div key={label} className="px-3 py-3 text-center">
 <p className="text-[9px] text-black/55/30 uppercase tracking-wider leading-tight">{label}</p>
 <p className={`text-xl font-black mt-1 ${warn ? "text-[#C1121F]" : "text-[#0A0A0A] dark:text-white/70"}`}>{value}</p>
 </div>
 ))}
 </div>

 {data?.lastProcessedEvent && (
 <div className="px-4 py-2 border-t border-black/5 dark:border-white/5 text-xs text-black/55/30">
 Last event: <span className="text-black/75/50">{new Date(data.lastProcessedEvent).toLocaleString("en-SG")}</span>
 </div>
 )}

 {isLoading ? (
 <p className="px-4 py-4 text-xs text-black/55/20 text-center">Loading diagnostics…</p>
 ) : (data?.recentEvents ?? []).length === 0 ? (
 <p className="px-4 py-4 text-xs text-black/55/20 text-center border-t border-black/5 dark:border-white/5">
 No events yet — agent has not been active.
 </p>
 ) : (
 <div className="divide-y divide-black/[0.03] dark:divide-white/[0.03] border-t border-black/5 dark:border-white/5">
 {(data?.recentEvents ?? []).map(ev => (
 <div key={ev.id} className="px-4 py-2.5 flex items-start gap-3">
 <span className={`text-[10px] font-mono font-bold flex-shrink-0 mt-0.5 ${ACTION_COLORS[ev.actionType] ?? "text-black/55"}`}>
 {ev.actionType}
 </span>
 <span className="text-xs text-black/55/40 flex-1 min-w-0 truncate">{ev.summary}</span>
 <span className="ml-auto text-[10px] text-black/65/20 flex-shrink-0 tabular-nums">
 {new Date(ev.createdAt).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}
 </span>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}

type LearnedLesson = {
 id: string;
 lesson: string;
 category: string;
 reinforced: number;
 active: boolean;
 createdAt: string;
 lastReinforcedAt: string;
 sourceOutcome: string;
};

function LessonsPanel() {
 const { toast } = useToast();
 const qc = useQueryClient();
 const { data, isLoading } = useQuery<{ lessons: LearnedLesson[] }>({
 queryKey: ["/api/admin/ai/whatsapp/lessons"],
 refetchInterval: 60000,
 });
 const lessons = data?.lessons ?? [];

 const toggleLesson = useMutation({
 mutationFn: ({ id, active }: { id: string; active: boolean }) =>
 apiRequest("PATCH", `/api/admin/ai/whatsapp/lessons/${id}`, { active }),
 onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/ai/whatsapp/lessons"] }),
 onError: () => toast({ title: "Failed to update lesson", variant: "destructive" }),
 });
 const deleteLesson = useMutation({
 mutationFn: (id: string) =>
 apiRequest("DELETE", `/api/admin/ai/whatsapp/lessons/${id}`),
 onSuccess: () => { toast({ title: "Lesson removed" }); qc.invalidateQueries({ queryKey: ["/api/admin/ai/whatsapp/lessons"] }); },
 onError: () => toast({ title: "Failed to remove lesson", variant: "destructive" }),
 });

 return (
 <div className="bg-white dark:bg-white/[0.02] border border-black/10 rounded-none overflow-hidden">
 <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
 <Zap className="w-4 h-4 text-black/55" />
 <h3 className="text-sm font-bold text-[#0A0A0A]/70">What the AI Has Learned</h3>
 <span className="ml-auto text-xs font-semibold text-black/55 dark:text-white/30 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
 {lessons.filter(l => l.active).length} active
 </span>
 </div>
 <div className="px-4 py-2 border-b border-black/5 dark:border-white/5">
 <p className="text-[11px] text-black/55 leading-snug">
 After real chats, the AI reviews what went well or badly and writes itself short lessons. It applies the active ones on every reply. Turn any off if you disagree.
 </p>
 </div>

 {isLoading ? (
 <p className="px-4 py-6 text-xs text-black/55 text-center">Loading lessons…</p>
 ) : lessons.length === 0 ? (
 <div className="px-4 py-8 text-center">
 <Zap className="w-8 h-8 text-[#0A0A0A]/10 mx-auto mb-3" />
 <p className="text-sm text-black/55">No lessons learned yet.</p>
 <p className="text-xs text-black/45 mt-1">Lessons appear here after the AI handles a few real conversations.</p>
 </div>
 ) : (
 <div className="divide-y divide-black/5 dark:divide-white/5">
 {lessons.map(l => (
 <div key={l.id} className="px-4 py-3 flex items-start gap-3" data-testid={`lesson-${l.id}`}>
 <div className="flex-1 min-w-0">
 <p className={`text-sm leading-snug ${l.active ? "text-[#0A0A0A]/80" : "text-black/40 line-through"}`}>
 {l.lesson}
 </p>
 <p className="text-[10px] text-black/45 mt-1 uppercase tracking-wider">
 {l.category} · reinforced {l.reinforced}×
 </p>
 </div>
 <button
 data-testid={`toggle-lesson-${l.id}`}
 onClick={() => toggleLesson.mutate({ id: l.id, active: !l.active })}
 disabled={toggleLesson.isPending}
 className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full border-2 transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
 l.active ? "bg-[#0A0A0A] border-black/10" : "bg-[#F5F4F0] border-black/10"
 }`}
 role="switch"
 aria-checked={l.active}
 title={l.active ? "Active — click to disable" : "Disabled — click to enable"}
 >
 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${l.active ? "translate-x-5" : "translate-x-0.5"}`} />
 </button>
 <button
 data-testid={`delete-lesson-${l.id}`}
 onClick={() => deleteLesson.mutate(l.id)}
 disabled={deleteLesson.isPending}
 className="flex-shrink-0 p-1.5 rounded-lg hover:bg-[#FBEBEB] transition-colors disabled:opacity-50"
 title="Delete lesson"
 >
 <XCircle className="w-4 h-4 text-[#C1121F]" />
 </button>
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
 <div className="pt-14 pb-20 lg:pb-6 lg:pl-56 min-h-screen bg-[#F5F4F0]">
 <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">

 {/* ── Header ────────────────────────────────────────────── */}
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 <div className="p-2.5 bg-[#EBE9E2] border border-black/10 rounded-none flex-shrink-0">
 <MessageCircle className="w-5 h-5 text-[#0A0A0A]" />
 </div>
 <div className="min-w-0">
 <h2 className="text-base font-bold text-[#0A0A0A] leading-tight">WhatsApp AI Agent</h2>
 <p className="text-xs text-black/55/40">Qualification · Handoff · Follow-up</p>
 </div>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap ${
 agentEnabled
 ? "text-[#0A0A0A] bg-[#EBE9E2] border-black/10"
 : "text-black/55 bg-[#F5F4F0] border-black/10 dark:text-black/55 dark:bg-black/[0.04]"
 }`}>
 <span className={`w-1.5 h-1.5 rounded-full ${agentEnabled ? "bg-[#EBE9E2]0 animate-pulse" : "bg-[#0A0A0A]"}`} />
 {agentEnabled ? "ACTIVE" : "OFF"}
 </div>
 <button
 onClick={() => refetch()}
 className="p-2 bg-white dark:bg-white/5 border border-black/10 rounded-none hover:bg-[#F5F4F0] dark:hover:bg-white/10 transition-colors"
 data-testid="btn-refresh-wa-convs"
 >
 <RefreshCw className="w-4 h-4 text-black/55" />
 </button>
 </div>
 </div>

 {/* ── Stat Cards ─────────────────────────────────────────── */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 {[
 { label: "Total Leads", value: conversations.length, icon: TrendingUp, color: "text-[#0A0A0A]", bg: "bg-[#EBE9E2]", border: "border-black/10 dark:border-[#0A0A0A]/20" },
 { label: "Needs Human", value: needsAttention, icon: AlertTriangle, color: "text-[#C1121F] dark:text-[#C1121F]", bg: "bg-[#FBEBEB] dark:bg-[#FBEBEB]", border: "border-black/10 dark:border-[#C1121F]/20" },
 { label: "Human Owned", value: humanOwned, icon: User, color: "text-[#0A0A0A] dark:text-[#C1121F]", bg: "bg-[#0A0A0A] dark:bg-[#FBEBEB]", border: "border-black/10 dark:border-[#C1121F]/20" },
 { label: "Quote Ready", value: stateBreakdown["quote_ready"] || 0, icon: CheckCircle2, color: "text-[#0A0A0A]", bg: "bg-[#EBE9E2]", border: "border-black/10" },
 ].map(({ label, value, icon: Icon, color, bg, border }) => (
 <div key={label} className={`${bg} border ${border} rounded-none p-4`}>
 <div className="flex items-center gap-2 mb-2">
 <Icon className={`w-4 h-4 ${color}`} />
 <span className="text-xs text-black/55/40 font-medium">{label}</span>
 </div>
 <p className={`text-3xl font-black ${color}`}>{value}</p>
 </div>
 ))}
 </div>

 {/* ── Feature Flags ──────────────────────────────────────── */}
 <div className="bg-white dark:bg-white/[0.02] border border-black/10 rounded-none overflow-hidden">
 <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
 <Shield className="w-4 h-4 text-black/55" />
 <h3 className="text-sm font-bold text-[#0A0A0A]/70">Feature Flags</h3>
 </div>
 <div className="divide-y divide-black/5 dark:divide-white/5">
 {flagsLoading ? (
 <p className="px-4 py-4 text-sm text-black/55/30">Loading flags…</p>
 ) : waFlags.length === 0 ? (
 <p className="px-4 py-4 text-sm text-black/55/30">No WhatsApp flags found</p>
 ) : (
 waFlags.map(flag => {
 const shortKey = flag.key.replace("ai_whatsapp_", "").replace(/_/g, " ");
 return (
 <div key={flag.key} className="px-4 py-3 flex items-center gap-3">
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-[#0A0A0A]/70 capitalize leading-tight">{shortKey}</p>
 <p className="text-[10px] font-mono text-black/65/25 mt-0.5 truncate">{flag.key}</p>
 </div>
 <button
 data-testid={`toggle-${flag.key}`}
 onClick={() => toggleFlag.mutate({ key: flag.key, value: !flag.value })}
 disabled={toggleFlag.isPending}
 className={`flex-shrink-0 relative inline-flex h-7 w-12 items-center rounded-full border-2 transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
 flag.value
 ? "bg-[#EBE9E2]0 border-black/10"
 : "bg-[#0A0A0A] dark:bg-white border-black/10"
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
 <div className="bg-white dark:bg-white/[0.02] border border-black/10 rounded-none overflow-hidden">
 <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
 <Bot className="w-4 h-4 text-black/55" />
 <h3 className="text-sm font-bold text-[#0A0A0A]/70">AI Conversations</h3>
 <span className="ml-auto text-xs font-semibold text-black/55 dark:text-white/30 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full">
 {conversations.length}
 </span>
 </div>

 {convsLoading ? (
 <div className="px-4 py-10 text-center">
 <div className="w-6 h-6 border-2 border-black/10 border-t-[#0A0A0A] rounded-full animate-spin mx-auto mb-3" />
 <p className="text-sm text-black/55/30">Loading conversations…</p>
 </div>
 ) : sortedConversations.length === 0 ? (
 <div className="px-4 py-10 text-center">
 <MessageCircle className="w-8 h-8 text-[#0A0A0A]/10 mx-auto mb-3" />
 <p className="text-sm text-black/55/30">No conversations yet.</p>
 <p className="text-xs text-black/65/20 mt-1">Enable the agent to start qualifying inbound leads.</p>
 </div>
 ) : (
 sortedConversations.map(conv => (
 <ConversationRow key={conv.phone} conv={conv} onRefresh={refetch} />
 ))
 )}
 </div>

 {/* ── Learned Lessons ────────────────────────────────────── */}
 <LessonsPanel />

 {/* ── Diagnostics ────────────────────────────────────────── */}
 <DiagnosticsPanel />

 {/* ── Policy notice ──────────────────────────────────────── */}
 <div className="flex items-start gap-3 px-4 py-3.5 bg-[#FBEBEB] dark:bg-[#C1121F]/5 border border-[#C1121F]/20 dark:border-[#C1121F]/20 rounded-none">
 <Clock className="w-4 h-4 text-[#C1121F] flex-shrink-0 mt-0.5" />
 <div className="text-xs text-[#C1121F] dark:text-[#C1121F]/80 space-y-1">
 <p className="font-bold text-[#C1121F] dark:text-[#C1121F]">WhatsApp 24-Hour Window Policy</p>
 <p>The AI agent may only send free-form messages within 24 hours of the last customer-initiated message. Outside this window, only approved templates are permitted. The system enforces this automatically.</p>
 </div>
 </div>

 </div>
 </div>
 );
}
