import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
 Bot, TrendingUp, Globe, CheckSquare, ScrollText,
 Zap, ZapOff, ToggleLeft, ToggleRight, AlertTriangle,
 ArrowRight, Shield, HelpCircle, X, Clock, User, Check, Database, MessageCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Status badge derivation ───────────────────────────────────────────────────
type ModuleStatus = "off" | "preview" | "active";

const STATUS_META: Record<ModuleStatus, { label: string; color: string; dot: string }> = {
 off: { label: "OFF", color: "text-black/55 bg-black/[0.04] border-black/10", dot: "bg-[#F5F4F0]0" },
 preview: { label: "PREVIEW", color: "text-[#C1121F] bg-[#FBEBEB] border-[#C1121F]/20", dot: "bg-[#C1121F]" },
 active: { label: "ACTIVE", color: "text-[#0A0A0A] bg-[#EBE9E2] border-black/10", dot: "bg-[#0A0A0A]" },
};

function adsStatus(flags: Record<string, boolean>): ModuleStatus {
 if (!flags["ai_ads_enabled"]) return "off";
 if (!flags["ai_ads_auto_low_risk_enabled"]) return "preview";
 return "active";
}
function siteStatus(flags: Record<string, boolean>): ModuleStatus {
 if (!flags["ai_site_audit_enabled"] && !flags["ai_site_preview_enabled"]) return "off";
 if (!flags["ai_site_publish_enabled"]) return "preview";
 return "active";
}
function connectorStatus(flags: Record<string, boolean>): ModuleStatus {
 const anyLive = flags["ai_google_ads_sync_enabled"] || flags["ai_meta_ads_sync_enabled"] || flags["ai_search_console_enabled"];
 if (!flags["ai_pagespeed_enabled"] && !anyLive) return "off";
 if (anyLive) return "active";
 return "preview";
}

// ── Flag help text ────────────────────────────────────────────────────────────
const FLAG_HELP: Record<string, { what: string; effect: string; safe: string }> = {
 ai_ads_enabled: {
 what: "Enables reading of ads performance snapshots and running the AI analysis engine.",
 effect: "AI can ingest Google/Meta data you upload and produce recommendations. No ad platform changes are made.",
 safe: "Read-only. Safe to enable.",
 },
 ai_ads_auto_low_risk_enabled: {
 what: "Allows AI to auto-queue low-risk ad actions (e.g. adding negative keywords) without waiting for manual approval.",
 effect: "Low-risk recommendations bypass the approval queue and go directly to applied status. Medium/high still require approval.",
 safe: "Medium risk. Enable only when you trust the AI's recommendation quality.",
 },
 ai_site_audit_enabled: {
 what: "Allows running AI-powered CRO, SEO, and UX audits against the live TMGInstall.com site.",
 effect: "AI reads your public site pages and returns structured findings. No writes to the site.",
 safe: "Read-only. Safe to enable.",
 },
 ai_site_preview_enabled: {
 what: "Enables AI to generate suggested copy/layout changes as previews in the admin panel.",
 effect: "Suggested changes are shown to you as text proposals. Nothing is pushed to the live site until Site Publish is also enabled.",
 safe: "View-only. Safe to enable.",
 },
 ai_site_publish_enabled: {
 what: "Permits AI-approved site change recommendations to be published to the live site.",
 effect: "Once enabled, approved changes from the approval queue can be applied automatically to the live site. This directly affects what customers see.",
 safe: "High risk. Only enable after thoroughly reviewing the approval queue and with a rollback plan ready.",
 },
 ai_pagespeed_enabled: {
 what: "Enables on-demand PageSpeed Insights checks for TMGInstall.com via Google's API.",
 effect: "Fetches Lighthouse performance, SEO, accessibility, and best-practices scores. Results are stored and surfaced in Site Health and the Connectors page.",
 safe: "Read-only. Safe to enable. No credentials required — uses the public API endpoint.",
 },
 ai_google_ads_sync_enabled: {
 what: "Enables live data pull from Google Ads API into the AI ads snapshots table.",
 effect: "Imports campaign and ad group spend, clicks, conversions per day. Replaces the date range on each sync. Credentials required in Replit Secrets.",
 safe: "Read-only import. Safe once credentials are set. Does not modify any Google Ads campaigns.",
 },
 ai_meta_ads_sync_enabled: {
 what: "Enables live data pull from Meta Marketing API into the AI ads snapshots table.",
 effect: "Imports campaign/adset spend, impressions, lead actions per day. Credentials required in Replit Secrets.",
 safe: "Read-only import. Safe once credentials are set. Does not modify any Meta campaigns.",
 },
 ai_search_console_enabled: {
 what: "Enables live data pull from Google Search Console for TMGInstall.com.",
 effect: "Imports top search queries with clicks, impressions, CTR, and average position for the last 28 days. Credentials required in Replit Secrets.",
 safe: "Read-only import. Safe once credentials are set.",
 },
 ai_scheduler_enabled: {
 what: "Enables the background scheduler that automatically syncs connectors on a fixed schedule (Google Ads & Meta every 6h, Search Console & PageSpeed every 24h).",
 effect: "Syncs run silently in the background. Each connector also requires its own individual flag to be ON. If the master kill-switch is active, no syncs run regardless.",
 safe: "Safe to enable. All syncs are read-only imports — no ad platform changes are made. Disable at any time to pause all scheduled syncs.",
 },
 ai_auto_execute_enabled: {
 what: "When an approval queue item is approved, immediately generate the implementation deliverable (CRO brief, ad copy spec, negative keyword CSV, or landing page brief).",
 effect: "Deliverable is generated and saved the moment you click Approve — no need to click Execute separately. Works for site_change, creative, negative_keyword, and landing_page types only. Does NOT call any live API or modify any ad account or site.",
 safe: "Medium risk label — the deliverable is generated automatically, but no live changes are made. Disable if you prefer to review first and execute manually.",
 },
 ai_google_ads_execution_enabled: {
 what: "Allows the 'Push to Platform' button in the Approval Queue to send approved actions directly to the Google Ads API.",
 effect: "When ON, clicking 'Push to Platform' on an approved Google Ads action will call the live Google Ads REST API to apply the change (e.g. add negative keywords, pause/enable ads, adjust budgets). Credentials must be configured in Secrets. Budget increases are hard-capped at +10% per execution.",
 safe: "High risk. Enable only after verifying Google Ads credentials are correct and test mode is working as expected. Always enable ai_platform_execution_test_mode first and verify the dry-run output before going live.",
 },
 ai_meta_ads_execution_enabled: {
 what: "Allows the 'Push to Platform' button in the Approval Queue to send approved actions directly to the Meta Ads API.",
 effect: "When ON, clicking 'Push to Platform' on an approved Meta Ads action will call the live Meta Graph API to apply the change (e.g. pause/enable ads or adsets, adjust budgets). Credentials must be configured in Secrets. Budget increases are hard-capped at +10% per execution.",
 safe: "High risk. Enable only after verifying Meta credentials are correct and test mode is working as expected. Always enable ai_platform_execution_test_mode first and verify the dry-run output before going live.",
 },
 ai_platform_execution_test_mode: {
 what: "Test mode for all platform executions. When ON, the full API payload is generated and logged, but the actual API call is NOT sent to Google Ads or Meta.",
 effect: "Every 'Push to Platform' click generates and logs the exact payload that would be sent, shows you the target IDs, budget changes, and rollback instructions — but no live change is made. Turn OFF to send real API calls.",
 safe: "Safe when ON (dry run). This is the default. Turn OFF only when you are ready to push real changes to live ad accounts.",
 },
 ai_whatsapp_agent_enabled: {
 what: "Enables the AI Sales Agent layer for inbound WhatsApp messages. When ON, the agent intercepts each message, extracts lead facts with GPT-4o, and asks qualifying questions automatically.",
 effect: "Inbound messages are processed by the AI first. If the agent handles the message it replies immediately; if it cannot handle or is uncertain it falls through to the legacy bot. No booking, payment, or existing job logic is affected.",
 safe: "Medium risk. Safe to enable — the agent never modifies quotes or payments. Turn on the master kill switch at any time to disable all AI instantly.",
 },
 ai_whatsapp_followups_enabled: {
 what: "Enables scheduled follow-up messages sent by the AI when a lead goes quiet — e.g. after 30 minutes with missing info, or 10 minutes after a quote is ready.",
 effect: "The follow-up scheduler runs every 5 minutes and sends the next due message. Follow-ups respect the 24-hr customer window and skip conversations owned by humans.",
 safe: "Medium risk. Follow-ups are sent only within the Meta 24-hr window unless template mode is also enabled. Start with this OFF while you verify the agent is qualifying correctly.",
 },
 ai_whatsapp_auto_qualify_enabled: {
 what: "Allows the AI to automatically send its qualifying question reply inside the 24-hr customer window, without waiting for a human to review.",
 effect: "Each inbound message triggers fact extraction and an immediate AI reply asking for the next missing piece of information. If OFF, the agent still extracts facts but does not reply — falling through to the legacy bot.",
 safe: "Low risk. Replies are polite, single-question messages. The agent never invents pricing or confirms bookings.",
 },
 ai_whatsapp_template_mode_enabled: {
 what: "Allows sending pre-approved template-style outbound messages outside the 24-hr customer window — e.g. stale reactivation pings.",
 effect: "When enabled, the follow-up scheduler may send a short reactivation message to leads that have gone stale. Only applies when the 24-hr window is closed and a follow-up is due.",
 safe: "Low risk. Reactivation messages are brief and non-intrusive. Disable if you prefer to never contact leads outside the 24-hr window.",
 },
 ai_whatsapp_handoff_required_on_low_confidence: {
 what: "Forces the AI to hand the conversation to a human when its confidence score drops below 30% — meaning it cannot determine what service the customer needs.",
 effect: "When confidence is low, the AI sends a polite handover message and sets the conversation to human ownership. The admin sees it flagged in the WhatsApp AI Agent page.",
 safe: "Low risk. Recommended to keep ON — prevents the AI from guessing and annoying confused customers. Human takeover is always recoverable via the admin panel.",
 },
};

const ACTION_LABELS: Record<string, string> = {
 flag_changed: "Flag changed",
 recommendation_generated: "Recommendation generated",
 action_approved: "Action approved",
 action_rejected: "Action rejected",
 action_deferred: "Action deferred",
 action_applied: "Action applied",
 audit_run: "Site audit run",
 snapshot_added: "Snapshot added",
 publish_event: "Site published",
 rollback: "Rollback",
};

export default function AIHub() {
 const { toast } = useToast();
 const qc = useQueryClient();
 const [helpFor, setHelpFor] = useState<string | null>(null);

 const { data: summary, isLoading } = useQuery<any>({
 queryKey: ["/api/ai/summary"],
 });

 const { data: activity } = useQuery<any>({
 queryKey: ["/api/ai/activity-summary"],
 refetchInterval: 60000,
 });

 const { data: recQuality } = useQuery<any>({
 queryKey: ["/api/ai/recommendation-quality"],
 refetchInterval: 5 * 60000,
 });

 const { data: waPerf } = useQuery<any>({
 queryKey: ["/api/ai/whatsapp-agent-performance"],
 refetchInterval: 5 * 60000,
 });

 const { data: hotLeads } = useQuery<any>({
 queryKey: ["/api/ai/hot-leads"],
 refetchInterval: 60000,
 });

 const { data: spend } = useQuery<any>({
 queryKey: ["/api/ai/spend-status"],
 refetchInterval: 60000,
 });

 const { data: llmHealth } = useQuery<any>({
 queryKey: ["/api/ai/llm-health"],
 refetchInterval: 60000,
 });

 const { data: recentLogs = [] } = useQuery<any[]>({
 queryKey: ["/api/ai/audit-log", "hub-recent"],
 queryFn: () => fetch("/api/ai/audit-log?limit=3", { credentials: "include" }).then(r => r.json()),
 });

 // Background activity — live connector sync status (auto-refreshes faster while jobs run)
 const { data: connectorStatusMap } = useQuery<Record<string, {
 label?: string; lastSyncStatus: string; lastSyncAt: string | null;
 nextSyncAt: string | null; schedulerEnabled: boolean;
 }>>({
 queryKey: ["/api/ai/connectors/status"],
 refetchInterval: (q) => {
 const data = q.state.data as Record<string, any> | undefined;
 const anyRunning = data && Object.values(data).some((c: any) => c?.lastSyncStatus === "running");
 return anyRunning ? 4_000 : 30_000;
 },
 });

 const CONNECTOR_LABELS: Record<string, string> = {
 google_ads: "Google Ads",
 meta_ads: "Meta Ads",
 search_console: "Search Console",
 pagespeed: "PageSpeed",
 };
 const connectorEntries = Object.entries(connectorStatusMap ?? {});
 const runningJobs = connectorEntries
 .filter(([, c]) => c?.lastSyncStatus === "running")
 .map(([k]) => CONNECTOR_LABELS[k] ?? k);
 const upcomingJobs = connectorEntries
 .filter(([, c]) => c?.schedulerEnabled && c?.nextSyncAt)
 .map(([k, c]) => ({ name: CONNECTOR_LABELS[k] ?? k, at: new Date(c!.nextSyncAt!) }))
 .sort((a, b) => a.at.getTime() - b.at.getTime());
 const nextUp = upcomingJobs[0];

 function relTime(d: Date): string {
 const diffMs = d.getTime() - Date.now();
 const abs = Math.abs(diffMs);
 const m = Math.round(abs / 60000);
 if (m < 1) return diffMs < 0 ? "just now" : "in <1 min";
 if (m < 60) return diffMs < 0 ? `${m} min ago` : `in ${m} min`;
 const h = Math.round(m / 60);
 if (h < 24) return diffMs < 0 ? `${h}h ago` : `in ${h}h`;
 const days = Math.round(h / 24);
 return diffMs < 0 ? `${days}d ago` : `in ${days}d`;
 }

 const toggleFlag = useMutation({
 mutationFn: ({ key, value }: { key: string; value: boolean }) =>
 apiRequest("PATCH", `/api/ai/flags/${key}`, { value }),
 onSuccess: () => {
 qc.invalidateQueries({ queryKey: ["/api/ai/summary"] });
 qc.invalidateQueries({ queryKey: ["/api/ai/flags"] });
 qc.invalidateQueries({ queryKey: ["/api/ai/audit-log", "hub-recent"] });
 },
 onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
 });

 const flags = summary?.flags ?? {};
 const killSwitch = flags["ai_master_kill_switch"] ?? false;
 const stats = summary?.conversionStats ?? {};

 const modules = [
 {
 href: "/admin/ai/ads",
 icon: TrendingUp,
 label: "Ads Intelligence",
 description: "Attribution funnel, spend analysis, campaign recommendations",
 color: "from-[#0A0A0A]/10 to-[#0A0A0A]/10 border-[#0A0A0A]/20",
 iconColor: "text-[#0A0A0A]",
 badge: summary?.pendingAdRecs?.length ?? 0,
 badgeLabel: "pending recs",
 status: adsStatus(flags),
 },
 {
 href: "/admin/ai/site",
 icon: Globe,
 label: "Site Health",
 description: "CRO audits, SEO structure, trust signals, speed analysis",
 color: "from-[#EBE9E2] to-white border-black/10",
 iconColor: "text-[#0A0A0A]",
 badge: summary?.openSiteRecs?.length ?? 0,
 badgeLabel: "open findings",
 status: siteStatus(flags),
 },
 {
 href: "/admin/ai/approvals",
 icon: CheckSquare,
 label: "Approval Queue",
 description: "Review and approve/reject AI-proposed actions before they run",
 color: "from-[#FBEBEB] to-white border-[#C1121F]/20",
 iconColor: "text-[#C1121F]",
 badge: summary?.pendingApprovalsCount ?? 0,
 badgeLabel: "pending",
 urgent: (summary?.pendingApprovalsCount ?? 0) > 0,
 status: "preview" as ModuleStatus,
 },
 {
 href: "/admin/ai/audit",
 icon: ScrollText,
 label: "Audit Log",
 description: "Complete immutable history of every AI action and recommendation",
 color: "from-[#EBE9E2] to-[#EBE9E2] border-black/10",
 iconColor: "text-black/55",
 status: "active" as ModuleStatus,
 },
 {
 href: "/admin/ai/connectors",
 icon: Database,
 label: "Data Connectors",
 description: "Google Ads API · Meta Ads API · Search Console · PageSpeed Insights",
 color: "from-[#0A0A0A]/10 to-[#EBE9E2] border-[#0A0A0A]/15",
 iconColor: "text-[#0A0A0A]",
 status: connectorStatus(flags),
 },
 {
 href: "/admin/ai/whatsapp",
 icon: MessageCircle,
 label: "WhatsApp AI Agent",
 description: "AI lead qualification · Fact extraction · Follow-up · Handoff",
 color: "from-[#EBE9E2] to-[#EBE9E2] border-black/10",
 iconColor: "text-[#0A0A0A]",
 status: (flags["ai_whatsapp_agent_enabled"] ? "active" : "off") as ModuleStatus,
 },
 ];

 const featureFlags = [
 { key: "ai_ads_enabled", label: "Ads Analysis", risk: "low" },
 { key: "ai_ads_auto_low_risk_enabled", label: "Auto Low-Risk Ads Actions", risk: "medium" },
 { key: "ai_site_audit_enabled", label: "Site Audits", risk: "low" },
 { key: "ai_site_preview_enabled", label: "Site Previews", risk: "low" },
 { key: "ai_site_publish_enabled", label: "Auto-Publish Changes", risk: "high" },
 { key: "ai_pagespeed_enabled", label: "PageSpeed Checks", risk: "low" },
 { key: "ai_google_ads_sync_enabled", label: "Google Ads Live Sync", risk: "low" },
 { key: "ai_meta_ads_sync_enabled", label: "Meta Ads Live Sync", risk: "low" },
 { key: "ai_search_console_enabled", label: "Search Console Sync", risk: "low" },
 { key: "ai_scheduler_enabled", label: "Sync Scheduler", risk: "low" },
 { key: "ai_auto_execute_enabled", label: "Auto-Execute on Approval", risk: "medium" },
 { key: "ai_google_ads_execution_enabled", label: "Google Ads Live Push", risk: "high" },
 { key: "ai_meta_ads_execution_enabled", label: "Meta Ads Live Push", risk: "high" },
 { key: "ai_platform_execution_test_mode", label: "Platform Execution Test Mode", risk: "low" },
 { key: "ai_whatsapp_agent_enabled", label: "WhatsApp AI Agent", risk: "medium" },
 { key: "ai_whatsapp_followups_enabled", label: "WhatsApp Auto Follow-ups", risk: "medium" },
 { key: "ai_whatsapp_auto_qualify_enabled", label: "WhatsApp Auto Qualify", risk: "low" },
 { key: "ai_whatsapp_template_mode_enabled", label: "WhatsApp Template Mode", risk: "low" },
 { key: "ai_whatsapp_handoff_required_on_low_confidence", label: "WhatsApp Low-Confidence Handoff",risk: "low" },
 // ── Phase 9b/9c — alerting, auto-approve hardening, feedback loop ───────
 { key: "ai_hot_lead_alerts_enabled", label: "Hot-Lead Real-Time Alerts", risk: "low" },
 { key: "ai_alert_digest_enabled", label: "Alert Digest (group low-sev)", risk: "low" },
 { key: "ai_high_confidence_autoapprove", label: "High-Confidence Auto-Approve", risk: "high" },
 { key: "ai_autoapprove_allow_high_impact", label: "Allow Auto-Approve on Spend Actions", risk: "high" },
 { key: "ai_customer_feedback_loop_enabled", label: "Customer Feedback Loop (1–5 rating)", risk: "low" },
 // ── Phase 9d — sales recovery + reputation flywheel ─────────────────────
 { key: "ai_abandoned_quote_rescue_enabled", label: "Abandoned-Quote Rescue (24h/3d/7d nudges + web-wizard WA)", risk: "medium" },
 { key: "ai_review_after_rating_only", label: "Google Review Only After 4+★ Rating", risk: "low" },
 ];

 const lastLog = recentLogs[0];

 return (
 <div className="pt-14 pb-20 lg:pb-6 lg:pl-56 min-h-screen bg-[#F5F4F0]">
 <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

 {/* Header */}
 <div className="flex items-start justify-between gap-4">
 <div>
 <div className="flex items-center gap-3 mb-1">
 <div className="w-9 h-9 rounded-none bg-gradient-to-br from-[#0A0A0A] to-[#0A0A0A] flex items-center justify-center ">
 <Bot className="w-5 h-5 text-[#0A0A0A]" />
 </div>
 <h1 className="text-2xl font-bold text-[#0A0A0A] tracking-tight">AI Operations</h1>
 </div>
 <p className="text-sm text-black/55 mt-1">
 Isolated AI analysis layer — ads intelligence + site health + attribution tracking
 </p>
 </div>
 <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#EBE9E2] border border-black/10">
 <div className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A] shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
 <span className="text-xs font-semibold text-[#0A0A0A]">Live site protected</span>
 </div>
 </div>

 {/* Kill Switch Banner */}
 {killSwitch && (
 <div className="flex items-start gap-3 p-4 rounded-none bg-[#FBEBEB] border border-[#C1121F]/30">
 <ZapOff className="w-5 h-5 text-[#C1121F] shrink-0 mt-0.5" />
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-[#0A0A0A]">Master Kill Switch is ACTIVE</p>
 <p className="text-xs text-[#C1121F]/80 mt-0.5">All AI automations are disabled. Manual review only.</p>
 </div>
 <button
 onClick={() => toggleFlag.mutate({ key: "ai_master_kill_switch", value: false })}
 className="shrink-0 text-xs font-semibold text-[#0A0A0A] hover:text-[#0A0A0A] bg-[#EBE9E2] px-3 py-1.5 rounded-lg border border-[#C1121F]/30 hover:border-black/10 transition-colors"
 >
 Deactivate
 </button>
 </div>
 )}

 {/* Last AI Action Card */}
 {lastLog && (
 <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-black/10 rounded-none">
 <div className="w-7 h-7 rounded-lg bg-[#EBE9E2] flex items-center justify-center shrink-0">
 <Bot className="w-3.5 h-3.5 text-[#0A0A0A]" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-xs font-semibold text-black/65 truncate">
 Last AI action: <span className="text-[#0A0A0A]">{ACTION_LABELS[lastLog.actionType] ?? lastLog.actionType}</span>
 </p>
 {lastLog.summary && (
 <p className="text-xs text-black/55 mt-0.5 truncate">{lastLog.summary}</p>
 )}
 </div>
 <div className="shrink-0 text-right hidden sm:block">
 <div className="flex items-center gap-1.5 text-[11px] text-black/75">
 {lastLog.actor === "ai_agent" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
 <span>{lastLog.actor ?? "system"}</span>
 </div>
 <div className="flex items-center gap-1 text-[11px] text-black/75 mt-0.5">
 <Clock className="w-3 h-3" />
 <span>{new Date(lastLog.createdAt).toLocaleString("en-SG", { dateStyle: "short", timeStyle: "short" })}</span>
 </div>
 </div>
 <Link href="/admin/ai/audit">
 <button className="ml-1 text-black/75 hover:text-black/55 transition-colors">
 <ArrowRight className="w-4 h-4" />
 </button>
 </Link>
 </div>
 )}

 {/* Background Activity Strip — live status of AI background jobs */}
 <Link href="/admin/ai/connectors">
 <div data-testid="strip-background-activity"
 className={`flex items-center gap-3 px-4 py-3 rounded-none border transition-colors cursor-pointer ${
 runningJobs.length > 0
 ? "bg-[#EBE9E2] border-[#0A0A0A]/30 hover:bg-[#EBE9E2]"
 : "bg-white/5 border-black/10 hover:bg-white/8"
 }`}>
 <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
 runningJobs.length > 0 ? "bg-[#0A0A0A]/20" : "bg-[#F5F4F0]"
 }`}>
 <Database className={`w-3.5 h-3.5 ${runningJobs.length > 0 ? "text-[#0A0A0A]/65" : "text-black/55"}`} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 {runningJobs.length > 0 && (
 <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A] animate-pulse shadow-[0_0_6px_rgba(167,139,250,0.8)] shrink-0" />
 )}
 <p className="text-xs font-semibold text-black/65 truncate" data-testid="text-bg-activity-status">
 {runningJobs.length > 0
 ? <>Running now: <span className="text-[#0A0A0A]">{runningJobs.join(", ")}</span></>
 : connectorEntries.length === 0
 ? "Background jobs — status unavailable"
 : <>Background jobs idle{nextUp ? <> · next: <span className="text-[#0A0A0A]">{nextUp.name}</span> {relTime(nextUp.at)}</> : ""}</>}
 </p>
 </div>
 <p className="text-[11px] text-black/55 mt-0.5 truncate">
 {runningJobs.length > 0
 ? "Auto-refreshing every few seconds while jobs run."
 : connectorEntries.filter(([, c]) => c?.lastSyncAt).length > 0
 ? `${connectorEntries.filter(([, c]) => c?.lastSyncAt).length} of ${connectorEntries.length} connectors have synced data — tap to view`
 : "Tap to view connector schedules and run a sync"}
 </p>
 </div>
 <ArrowRight className="w-4 h-4 text-black/55 shrink-0" />
 </div>
 </Link>

 {/* AI Activity Summary — what AI has done in the last 7 days */}
 {activity && (
 <div className="bg-gradient-to-br from-[#0A0A0A]/10 to-white border border-[#0A0A0A]/15 rounded-none p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]/65">AI Activity</span>
 <span className="text-[10px] text-black/55">last {activity.windowDays}d</span>
 </div>
 <Link href="/admin/ai/audit"><span className="text-[11px] text-[#0A0A0A] hover:text-[#0A0A0A]/65 cursor-pointer">View audit log →</span></Link>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
 <div data-testid="stat-platform-pushes">
 <p className="text-2xl font-bold text-[#0A0A0A] tabular-nums">{activity.platform?.totalPushes ?? 0}</p>
 <p className="text-[10px] uppercase text-black/55 mt-0.5">Platform pushes</p>
 </div>
 <div data-testid="stat-success-rate">
 <p className="text-2xl font-bold text-[#0A0A0A]/65 tabular-nums">{activity.platform?.successRate ?? 0}%</p>
 <p className="text-[10px] uppercase text-black/55 mt-0.5">Success rate</p>
 </div>
 <div data-testid="stat-auto-approved">
 <p className="text-2xl font-bold text-[#0A0A0A]/65 tabular-nums">{activity.approvals?.autoApproved ?? 0}</p>
 <p className="text-[10px] uppercase text-black/55 mt-0.5">Auto-approved</p>
 </div>
 <div data-testid="stat-site-changes">
 <p className="text-2xl font-bold text-[#0A0A0A]/65 tabular-nums">{activity.site?.changesApplied ?? 0}</p>
 <p className="text-[10px] uppercase text-black/55 mt-0.5">Site updates</p>
 </div>
 <div data-testid="stat-rollbacks">
 <p className={`text-2xl font-bold tabular-nums ${(activity.platform?.rollbacks ?? 0) > 0 ? "text-[#C1121F]" : "text-black/55"}`}>{activity.platform?.rollbacks ?? 0}</p>
 <p className="text-[10px] uppercase text-black/55 mt-0.5">Rollbacks</p>
 </div>
 <div data-testid="stat-time-saved">
 <p className="text-2xl font-bold text-[#0A0A0A] tabular-nums">{activity.minutesSaved ?? 0}m</p>
 <p className="text-[10px] uppercase text-black/55 mt-0.5">Admin time saved</p>
 </div>
 </div>
 {activity.platform?.failed > 0 && (
 <p className="text-[11px] text-[#0A0A0A] mt-3 flex items-center gap-1.5">
 ⚠ {activity.platform.failed} push(es) failed in this window — review the approval queue.
 </p>
 )}
 <div className="mt-3 pt-3 border-t border-black/10 flex items-center gap-2">
 <button
 data-testid="button-test-alert"
 onClick={async () => {
 const r = await fetch("/api/ai/alerts/test", { method: "POST", credentials: "include" }).then(r => r.json()).catch(() => ({}));
 alert(`Push: ${r.pushSent ? "✓ sent" : "✗"} WhatsApp: ${r.whatsappSent ? "✓ sent" : r.throttled ? "throttled (10m)" : "skipped (flag off or no phone set)"}`);
 }}
 className="text-[11px] text-[#0A0A0A]/65 hover:text-[#0A0A0A] px-2 py-1 rounded border border-[#0A0A0A]/30 hover:border-[#0A0A0A] transition-colors"
 >
 Test real-time alert
 </button>
 <button
 data-testid="button-send-digest"
 onClick={async () => {
 const r = await fetch("/api/ai/digest/send-now", { method: "POST", credentials: "include" }).then(r => r.json()).catch(() => ({}));
 alert(r.sent ? `Digest sent to ${r.recipient}` : `Could not send: ${r.reason ?? "unknown"}`);
 }}
 className="text-[11px] text-[#0A0A0A]/65 hover:text-[#0A0A0A] px-2 py-1 rounded border border-[#0A0A0A]/30 hover:border-[#0A0A0A] transition-colors"
 >
 Send digest now
 </button>
 <button
 data-testid="button-run-anomaly"
 onClick={async () => {
 const r = await fetch("/api/ai/anomaly/run", { method: "POST", credentials: "include" }).then(r => r.json()).catch(() => ({}));
 alert(`Scanned ${r.scanned ?? 0} campaigns. Alerted on ${r.alerted ?? 0}. Skipped ${r.insufficientHistory ?? 0} (not enough history).`);
 }}
 className="text-[11px] text-[#0A0A0A]/65 hover:text-[#0A0A0A] px-2 py-1 rounded border border-[#0A0A0A]/30 hover:border-[#0A0A0A] transition-colors"
 >
 Run anomaly scan
 </button>
 </div>
 </div>
 )}

 {/* HOT LEADS — top of revenue funnel, refresh every minute */}
 {hotLeads && hotLeads.totalLeads > 0 && (
 <div data-testid="card-hot-leads" className="bg-gradient-to-br from-[#FBEBEB] to-white border border-[#C1121F]/30 rounded-none p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]">🔥 Hot Leads (24h)</span>
 <span className="text-[10px] text-black/55">threshold {hotLeads.hotThreshold}/100 · auto-refresh 1m</span>
 </div>
 <Link href="/admin/whatsapp"><span className="text-[11px] text-[#C1121F] hover:text-[#0A0A0A] cursor-pointer">View conversations →</span></Link>
 </div>
 <div className="flex items-baseline gap-4 mb-3">
 <div>
 <p className="text-3xl font-bold text-[#0A0A0A] tabular-nums" data-testid="text-hot-count">{hotLeads.hotCount}</p>
 <p className="text-[10px] uppercase text-black/55">hot — call now</p>
 </div>
 <div>
 <p className="text-2xl font-bold text-yellow-300 tabular-nums" data-testid="text-warm-count">{hotLeads.warmCount}</p>
 <p className="text-[10px] uppercase text-black/55">warm</p>
 </div>
 <div>
 <p className="text-2xl font-bold text-black/55 tabular-nums">{hotLeads.totalLeads}</p>
 <p className="text-[10px] uppercase text-black/55">scored total</p>
 </div>
 </div>
 <div className="space-y-1.5">
 {hotLeads.leads.slice(0, 5).map((l: any) => (
 <div
 key={l.phone}
 data-testid={`row-hot-lead-${l.phone}`}
 className={`flex items-center gap-3 p-2 rounded-lg border ${
 l.tier === "hot" ? "bg-[#FBEBEB] border-[#C1121F]/30"
 : l.tier === "warm" ? "bg-yellow-500/5 border-yellow-500/20"
 : "bg-white/5 border-black/10"
 }`}
 >
 <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold tabular-nums ${
 l.tier === "hot" ? "bg-[#EBE9E2] text-[#0A0A0A]"
 : l.tier === "warm" ? "bg-yellow-500/20 text-yellow-200"
 : "bg-white text-black/65"
 }`}>
 <span className="text-lg leading-none">{l.score}</span>
 <span className="text-[8px] uppercase mt-0.5">{l.tier}</span>
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className="text-sm font-semibold text-[#0A0A0A] truncate">{l.customerName ?? l.phoneMasked}</p>
 {l.urgency === "asap" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#EBE9E2] text-[#0A0A0A] font-bold uppercase">ASAP</span>}
 {l.aiOwnership === "human" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0A0A0A]/20 text-[#0A0A0A]/65 uppercase">Human</span>}
 </div>
 <p className="text-[11px] text-black/55 truncate">
 {l.serviceType ?? "—"} {l.quantity ? `· ${l.quantity} items` : ""} {l.jobAddress ? `· ${l.jobAddress.slice(0, 35)}` : ""}
 </p>
 {l.topReasons && l.topReasons.length > 0 && (
 <p className="text-[10px] text-black/55 truncate mt-0.5">
 {l.topReasons.map((r: any) => `${r.label} (+${r.points})`).join(" · ")}
 </p>
 )}
 </div>
 <a
 href={`https://wa.me/${l.phone}`}
 target="_blank"
 rel="noopener noreferrer"
 data-testid={`link-wa-${l.phone}`}
 className="text-[11px] px-3 py-1.5 rounded bg-[#0A0A0A]/20 hover:bg-[#0A0A0A]/30 text-[#0A0A0A] border border-black/10 transition-colors shrink-0"
 >
 Open chat
 </a>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* SPEND GUARDRAILS — daily/monthly AI-driven ad spend vs caps */}
 {spend && (
 <div data-testid="card-spend-guardrails" className="bg-gradient-to-br from-[#EBE9E2] to-[#0A0A0A]/5 border border-black/10 rounded-none p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]">💰 Spend Guardrails</span>
 <span className="text-[10px] text-black/55">AI-driven ad-budget changes · auto-refresh 1m</span>
 </div>
 {spend.recentBlocks > 0 && (
 <span className="text-[10px] px-2 py-0.5 rounded bg-[#FBEBEB] text-[#C1121F] font-bold uppercase">
 {spend.recentBlocks} blocked this month
 </span>
 )}
 </div>
 <div className="grid grid-cols-2 gap-4">
 {/* Today */}
 <div>
 <div className="flex items-baseline justify-between mb-1">
 <p className="text-[10px] uppercase text-black/55">Today</p>
 <p className="text-[11px] text-black/55 tabular-nums">
 SGD <span data-testid="text-spend-today" className="text-[#0A0A0A] font-semibold">{spend.todaySgd.toFixed(2)}</span>
 <span className="text-black/55"> / {spend.dailyCapSgd.toFixed(0)}</span>
 </p>
 </div>
 <div className="h-2 bg-white rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all ${
 spend.dailyUtilization >= 1 ? "bg-[#0A0A0A]"
 : spend.dailyUtilization >= 0.8 ? "bg-[#C1121F]"
 : "bg-[#EBE9E2]0"
 }`}
 style={{ width: `${Math.min(100, spend.dailyUtilization * 100).toFixed(1)}%` }}
 />
 </div>
 <p className="text-[10px] text-black/55 mt-1">{(spend.dailyUtilization * 100).toFixed(0)}% of daily cap</p>
 </div>
 {/* Month */}
 <div>
 <div className="flex items-baseline justify-between mb-1">
 <p className="text-[10px] uppercase text-black/55">Month-to-date</p>
 <p className="text-[11px] text-black/55 tabular-nums">
 SGD <span data-testid="text-spend-month" className="text-[#0A0A0A] font-semibold">{spend.monthSgd.toFixed(2)}</span>
 <span className="text-black/55"> / {spend.monthlyCapSgd.toFixed(0)}</span>
 </p>
 </div>
 <div className="h-2 bg-white rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all ${
 spend.monthlyUtilization >= 1 ? "bg-[#0A0A0A]"
 : spend.monthlyUtilization >= 0.8 ? "bg-[#C1121F]"
 : "bg-[#EBE9E2]0"
 }`}
 style={{ width: `${Math.min(100, spend.monthlyUtilization * 100).toFixed(1)}%` }}
 />
 </div>
 <p className="text-[10px] text-black/55 mt-1">{(spend.monthlyUtilization * 100).toFixed(0)}% of monthly cap · trips kill switch at 100%</p>
 </div>
 </div>
 </div>
 )}

 {/* LLM HEALTH — per-agent telemetry from server/ai-llm-client.ts */}
 {llmHealth && (
 <div data-testid="card-llm-health" className="bg-gradient-to-br from-[#0A0A0A]/10 to-white border border-[#0A0A0A]/15 rounded-none p-4">
 <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
 <div className="flex items-center gap-2">
 <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]/65">🧠 LLM Health · 24h</span>
 <span className="text-[10px] text-black/55">retries · circuit breakers · token cost</span>
 </div>
 <div className="flex items-center gap-2 flex-wrap">
 {llmHealth.openBreakers?.length > 0 && (
 <span data-testid="badge-breakers-open" className="text-[10px] px-2 py-0.5 rounded bg-[#EBE9E2] text-[#0A0A0A] font-bold uppercase">
 ⚠ {llmHealth.openBreakers.length} breaker{llmHealth.openBreakers.length > 1 ? 's' : ''} open
 </span>
 )}
 {llmHealth.totals?.repairs > 0 && (
 <span className="text-[10px] px-2 py-0.5 rounded bg-[#FBEBEB] text-[#C1121F] font-bold uppercase">
 {llmHealth.totals.repairs} schema repair{llmHealth.totals.repairs > 1 ? 's' : ''}
 </span>
 )}
 </div>
 </div>

 {/* Aggregate strip */}
 <div className="grid grid-cols-4 gap-3 mb-3">
 <div className="bg-white rounded-lg p-2">
 <p className="text-[9px] uppercase text-black/55">Calls</p>
 <p data-testid="text-llm-calls" className="text-sm font-bold text-[#0A0A0A] tabular-nums">{(llmHealth.totals?.calls ?? 0).toLocaleString()}</p>
 </div>
 <div className="bg-white rounded-lg p-2">
 <p className="text-[9px] uppercase text-black/55">Success</p>
 <p data-testid="text-llm-success-rate" className={`text-sm font-bold tabular-nums ${
 llmHealth.totals?.successRate == null ? "text-black/55"
 : llmHealth.totals.successRate >= 0.98 ? "text-[#0A0A0A]/65"
 : llmHealth.totals.successRate >= 0.9 ? "text-[#C1121F]"
 : "text-[#0A0A0A]"
 }`}>
 {llmHealth.totals?.successRate == null ? "—" : `${(llmHealth.totals.successRate * 100).toFixed(1)}%`}
 </p>
 </div>
 <div className="bg-white rounded-lg p-2">
 <p className="text-[9px] uppercase text-black/55">Tokens</p>
 <p data-testid="text-llm-tokens" className="text-sm font-bold text-[#0A0A0A] tabular-nums">
 {((llmHealth.totals?.tokens ?? 0) / 1000).toFixed(1)}k
 </p>
 </div>
 <div className="bg-white rounded-lg p-2">
 <p className="text-[9px] uppercase text-black/55">Cost SGD</p>
 <p data-testid="text-llm-cost" className="text-sm font-bold text-[#0A0A0A] tabular-nums">
 {(llmHealth.totals?.costSgd ?? 0).toFixed(2)}
 </p>
 </div>
 </div>

 {/* Per-agent rows */}
 {llmHealth.agents?.length > 0 ? (
 <div className="space-y-1.5">
 {llmHealth.agents.slice(0, 6).map((a: any) => (
 <div
 key={a.agent}
 data-testid={`row-llm-agent-${a.agent}`}
 className="flex items-center justify-between gap-2 text-[11px] bg-white0 rounded px-2 py-1.5"
 >
 <div className="flex items-center gap-2 min-w-0 flex-1">
 {a.breaker?.open && <span className="text-[#C1121F]">⚠</span>}
 <span className="font-mono text-black/65 truncate">{a.agent}</span>
 </div>
 <div className="flex items-center gap-3 text-black/55 tabular-nums shrink-0">
 <span title="calls">{a.calls}×</span>
 <span
 title="success rate"
 className={a.successRate == null ? "text-black/55"
 : a.successRate >= 0.98 ? "text-[#0A0A0A]/65"
 : a.successRate >= 0.9 ? "text-[#C1121F]"
 : "text-[#0A0A0A]"}
 >
 {a.successRate == null ? "—" : `${(a.successRate * 100).toFixed(0)}%`}
 </span>
 <span title="p95 latency">p95 {a.p95LatencyMs}ms</span>
 <span title="cost">${a.costSgd.toFixed(3)}</span>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-[11px] text-black/55 italic">No LLM calls in the last 24h.</p>
 )}
 </div>
 )}

 {/* Two-column: Recommendation Quality + WhatsApp Agent Performance */}
 {(recQuality || waPerf) && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
 {/* Recommendation Quality */}
 {recQuality && (
 <div data-testid="card-rec-quality" className="bg-gradient-to-br from-[#EBE9E2] to-white border border-black/10 rounded-none p-4">
 <div className="flex items-center justify-between mb-3">
 <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]/65">Recommendation Quality</span>
 <span className="text-[10px] text-black/55">last {recQuality.windowDays}d</span>
 </div>
 <div className="flex items-baseline gap-3 mb-3">
 <p className="text-3xl font-bold text-[#0A0A0A] tabular-nums" data-testid="text-overall-approve-rate">{recQuality.overallApproveRate}%</p>
 <p className="text-[11px] text-black/55">approve rate · {recQuality.totalRecommendations} total</p>
 </div>
 {recQuality.breakdown && recQuality.breakdown.length > 0 && (
 <div className="space-y-1.5">
 {recQuality.breakdown.slice(0, 5).map((b: any) => (
 <div key={b.type} className="flex items-center gap-2 text-[11px]" data-testid={`row-rec-type-${b.type}`}>
 <span className="text-black/65 w-32 truncate">{b.type}</span>
 <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
 <div className="h-full bg-[#0A0A0A]" style={{ width: `${b.approveRate}%` }} />
 </div>
 <span className="text-black/55 tabular-nums w-14 text-right">{b.approveRate}% / {b.total}</span>
 </div>
 ))}
 </div>
 )}
 {recQuality.suggestions?.message && (
 <p className="text-[11px] text-[#0A0A0A] mt-3 italic" data-testid="text-rec-suggestion">💡 {recQuality.suggestions.message}</p>
 )}
 </div>
 )}

 {/* WhatsApp Agent Performance */}
 {waPerf && (
 <div data-testid="card-wa-perf" className="bg-gradient-to-br from-[#EBE9E2] to-white border border-black/10 rounded-none p-4">
 <div className="flex items-center justify-between mb-3">
 <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]">WhatsApp Sales Agent</span>
 <span className="text-[10px] text-black/55">last {waPerf.windowDays}d</span>
 </div>
 <div className="grid grid-cols-3 gap-2 mb-3">
 <div>
 <p className="text-2xl font-bold text-[#0A0A0A] tabular-nums" data-testid="text-wa-conversations">{waPerf.uniqueConversations}</p>
 <p className="text-[10px] uppercase text-black/55 mt-0.5">Conversations</p>
 </div>
 <div>
 <p className="text-2xl font-bold text-[#0A0A0A]/65 tabular-nums" data-testid="text-wa-followups">{waPerf.followups?.sent ?? 0}</p>
 <p className="text-[10px] uppercase text-black/55 mt-0.5">Follow-ups sent</p>
 </div>
 <div>
 <p className={`text-2xl font-bold tabular-nums ${(waPerf.handoffs?.rate ?? 0) >= 50 ? "text-[#C1121F]" : "text-[#0A0A0A]"}`} data-testid="text-wa-handoff-rate">{waPerf.handoffs?.rate ?? 0}%</p>
 <p className="text-[10px] uppercase text-black/55 mt-0.5">Handoff rate</p>
 </div>
 </div>
 {waPerf.handoffs?.byReason && Object.keys(waPerf.handoffs.byReason).length > 0 && (
 <div className="text-[11px] text-black/55">
 <span className="text-black/55">Handoff reasons: </span>
 {Object.entries(waPerf.handoffs.byReason).map(([r, n]: any) => (
 <span key={r} className="inline-block mr-2 text-black/65">{r} ({n})</span>
 ))}
 </div>
 )}
 <p className="text-[11px] text-[#0A0A0A] mt-2 italic" data-testid="text-wa-verdict">💬 {waPerf.verdict}</p>
 </div>
 )}
 </div>
 )}

 {/* Conversion Stats */}
 {!isLoading && (
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {[
 { label: "Total Leads", value: stats.totalLeads ?? 0, sub: "all time" },
 { label: "Deposit Paid", value: stats.deposited ?? 0, sub: `${stats.totalLeads ? Math.round((stats.deposited / stats.totalLeads) * 100) : 0}% of leads` },
 { label: "Final Paid", value: stats.finalPaid ?? 0, sub: "completed jobs" },
 { label: "Revenue", value: `$${parseFloat(stats.totalRevenue ?? "0").toLocaleString()}`, sub: "paid-in-full" },
 ].map(stat => (
 <div key={stat.label} className="bg-white/5 border border-black/10 rounded-none p-4">
 <p className="text-xs font-medium text-black/55 uppercase tracking-wider mb-1">{stat.label}</p>
 <p className="text-2xl font-bold text-[#0A0A0A] tabular-nums">{stat.value}</p>
 <p className="text-xs text-black/55 mt-0.5">{stat.sub}</p>
 </div>
 ))}
 </div>
 )}

 {/* Module Cards — with status badges */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 {modules.map(mod => {
 const sm = STATUS_META[mod.status ?? "off"];
 return (
 <Link key={mod.href} href={mod.href}>
 <div className={`relative p-5 rounded-none bg-gradient-to-br border cursor-pointer  transition-all group ${mod.color}`}>
 {/* Status badge — top-left */}
 <span className={`absolute top-3 left-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${sm.color}`}>
 <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sm.dot}`} />
 {sm.label}
 </span>

 {/* Count badge — top-right */}
 {mod.urgent && (mod.badge ?? 0) > 0 && (
 <span className="absolute top-3 right-3 bg-[#C1121F] text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
 {mod.badge} {mod.badgeLabel}
 </span>
 )}
 {!mod.urgent && (mod.badge ?? 0) > 0 && (
 <span className="absolute top-3 right-3 bg-[#0A0A0A]/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
 {mod.badge} {mod.badgeLabel}
 </span>
 )}

 <mod.icon className={`w-7 h-7 mt-6 mb-3 ${mod.iconColor}`} />
 <h3 className="text-base font-bold text-[#0A0A0A] mb-1">{mod.label}</h3>
 <p className="text-xs text-black/55 leading-relaxed">{mod.description}</p>
 <div className="flex items-center gap-1.5 mt-4 text-xs font-medium text-black/55 group-hover:text-[#0A0A0A] transition-colors">
 Open <ArrowRight className="w-3.5 h-3.5" />
 </div>
 </div>
 </Link>
 );
 })}
 </div>

 {/* Feature Flags + Inline Help */}
 <div className="bg-white/5 border border-black/10 rounded-none overflow-hidden">
 <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Shield className="w-4 h-4 text-black/55" />
 <h2 className="text-sm font-semibold text-[#0A0A0A]">Feature Flags</h2>
 </div>
 <button
 onClick={() => toggleFlag.mutate({ key: "ai_master_kill_switch", value: !killSwitch })}
 data-testid="toggle-kill-switch"
 className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
 killSwitch
 ? "bg-[#EBE9E2] border-[#C1121F]/30 text-[#0A0A0A] hover:bg-[#EBE9E2]"
 : "bg-white/5 border-black/10 text-black/55 hover:text-[#0A0A0A] hover:bg-[#FBEBEB] hover:border-[#C1121F]/20"
 }`}
 >
 {killSwitch ? <Zap className="w-3.5 h-3.5" /> : <ZapOff className="w-3.5 h-3.5" />}
 Master Kill Switch: {killSwitch ? "ON" : "OFF"}
 </button>
 </div>

 <div className="divide-y divide-white/5">
 {featureFlags.map(flag => {
 const enabled = flags[flag.key] ?? false;
 const help = FLAG_HELP[flag.key];
 const isHelpOpen = helpFor === flag.key;
 return (
 <div key={flag.key}>
 <div className="flex items-center justify-between px-5 py-3.5">
 <div className="flex items-center gap-3 flex-1 min-w-0">
 <div className={`w-2 h-2 rounded-full shrink-0 ${
 flag.risk === "high" ? "bg-[#0A0A0A]" :
 flag.risk === "medium" ? "bg-[#C1121F]" : "bg-[#0A0A0A]"
 }`} />
 <span className="text-sm font-medium text-[#0A0A0A] truncate">{flag.label}</span>
 <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide shrink-0 ${
 flag.risk === "high" ? "bg-[#EBE9E2] text-[#C1121F]" :
 flag.risk === "medium" ? "bg-[#FBEBEB] text-[#C1121F]" :
 "bg-[#EBE9E2] text-[#0A0A0A]"
 }`}>{flag.risk} risk</span>
 {help && (
 <button
 onClick={() => setHelpFor(isHelpOpen ? null : flag.key)}
 data-testid={`help-${flag.key}`}
 className="shrink-0 text-black/75 hover:text-black/55 transition-colors"
 title="What does this do?"
 >
 {isHelpOpen ? <X className="w-3.5 h-3.5" /> : <HelpCircle className="w-3.5 h-3.5" />}
 </button>
 )}
 </div>
 <button
 onClick={() => toggleFlag.mutate({ key: flag.key, value: !enabled })}
 data-testid={`flag-toggle-${flag.key}`}
 className="flex items-center gap-1.5 text-xs transition-colors ml-3"
 disabled={toggleFlag.isPending}
 >
 {enabled
 ? <ToggleRight className="w-8 h-8 text-[#0A0A0A]" />
 : <ToggleLeft className="w-8 h-8 text-black/75" />}
 </button>
 </div>

 {/* Inline help panel */}
 {isHelpOpen && help && (
 <div className="mx-5 mb-3 p-3.5 bg-black/20 border border-black/10 rounded-none space-y-2.5">
 <div>
 <p className="text-[11px] font-semibold text-black/55 uppercase tracking-wider mb-1">What it does</p>
 <p className="text-xs text-black/65 leading-relaxed">{help.what}</p>
 </div>
 <div>
 <p className="text-[11px] font-semibold text-black/55 uppercase tracking-wider mb-1">Effect when enabled</p>
 <p className="text-xs text-black/65 leading-relaxed">{help.effect}</p>
 </div>
 <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${
 flag.risk === "high" ? "bg-[#FBEBEB] border-[#C1121F]/15" :
 flag.risk === "medium" ? "bg-[#C1121F]/5 border-black/10" :
 "bg-[#EBE9E2] border-black/10"
 }`}>
 {flag.risk === "high"
 ? <AlertTriangle className="w-3.5 h-3.5 text-[#C1121F] shrink-0 mt-0.5" />
 : flag.risk === "medium"
 ? <AlertTriangle className="w-3.5 h-3.5 text-[#C1121F] shrink-0 mt-0.5" />
 : <Check className="w-3.5 h-3.5 text-[#0A0A0A] shrink-0 mt-0.5" />}
 <p className={`text-xs leading-relaxed ${
 flag.risk === "high" ? "text-[#0A0A0A]" :
 flag.risk === "medium" ? "text-[#C1121F]" : "text-[#0A0A0A]/65"
 }`}>{help.safe}</p>
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>

 <div className="px-5 py-3 bg-black/20 border-t border-white/5 flex items-start gap-2">
 <AlertTriangle className="w-3.5 h-3.5 text-[#C1121F] shrink-0 mt-0.5" />
 <p className="text-[11px] text-black/55">
 High-risk flags require approval queue sign-off. Medium-risk flags auto-queue for review. Low-risk flags run automatically and log to the audit trail.
 The live booking/payment/admin/staff workflow is never affected by any AI flag setting.
 </p>
 </div>
 </div>

 </div>
 </div>
 );
}
