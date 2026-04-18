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
  off:     { label: "OFF",     color: "text-slate-400 bg-slate-500/10 border-slate-500/20",   dot: "bg-slate-500" },
  preview: { label: "PREVIEW", color: "text-amber-400 bg-amber-500/10 border-amber-500/20",   dot: "bg-amber-400" },
  active:  { label: "ACTIVE",  color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
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

  const { data: recentLogs = [] } = useQuery<any[]>({
    queryKey: ["/api/ai/audit-log", "hub-recent"],
    queryFn: () => fetch("/api/ai/audit-log?limit=3", { credentials: "include" }).then(r => r.json()),
  });

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
      color: "from-blue-500/10 to-indigo-500/10 border-blue-500/20",
      iconColor: "text-blue-400",
      badge: summary?.pendingAdRecs?.length ?? 0,
      badgeLabel: "pending recs",
      status: adsStatus(flags),
    },
    {
      href: "/admin/ai/site",
      icon: Globe,
      label: "Site Health",
      description: "CRO audits, SEO structure, trust signals, speed analysis",
      color: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20",
      iconColor: "text-emerald-400",
      badge: summary?.openSiteRecs?.length ?? 0,
      badgeLabel: "open findings",
      status: siteStatus(flags),
    },
    {
      href: "/admin/ai/approvals",
      icon: CheckSquare,
      label: "Approval Queue",
      description: "Review and approve/reject AI-proposed actions before they run",
      color: "from-amber-500/10 to-orange-500/10 border-amber-500/20",
      iconColor: "text-amber-400",
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
      color: "from-slate-500/10 to-zinc-500/10 border-slate-500/20",
      iconColor: "text-slate-400",
      status: "active" as ModuleStatus,
    },
    {
      href: "/admin/ai/connectors",
      icon: Database,
      label: "Data Connectors",
      description: "Google Ads API · Meta Ads API · Search Console · PageSpeed Insights",
      color: "from-violet-500/10 to-purple-500/10 border-violet-500/20",
      iconColor: "text-violet-400",
      status: connectorStatus(flags),
    },
    {
      href: "/admin/ai/whatsapp",
      icon: MessageCircle,
      label: "WhatsApp AI Agent",
      description: "AI lead qualification · Fact extraction · Follow-up · Handoff",
      color: "from-emerald-500/10 to-green-500/10 border-emerald-500/20",
      iconColor: "text-emerald-400",
      status: (flags["ai_whatsapp_agent_enabled"] ? "active" : "off") as ModuleStatus,
    },
  ];

  const featureFlags = [
    { key: "ai_ads_enabled",                label: "Ads Analysis",              risk: "low" },
    { key: "ai_ads_auto_low_risk_enabled",  label: "Auto Low-Risk Ads Actions", risk: "medium" },
    { key: "ai_site_audit_enabled",         label: "Site Audits",               risk: "low" },
    { key: "ai_site_preview_enabled",       label: "Site Previews",             risk: "low" },
    { key: "ai_site_publish_enabled",       label: "Auto-Publish Changes",      risk: "high" },
    { key: "ai_pagespeed_enabled",          label: "PageSpeed Checks",          risk: "low" },
    { key: "ai_google_ads_sync_enabled",    label: "Google Ads Live Sync",      risk: "low" },
    { key: "ai_meta_ads_sync_enabled",      label: "Meta Ads Live Sync",        risk: "low" },
    { key: "ai_search_console_enabled",     label: "Search Console Sync",       risk: "low" },
    { key: "ai_scheduler_enabled",                label: "Sync Scheduler",                risk: "low" },
    { key: "ai_auto_execute_enabled",             label: "Auto-Execute on Approval",      risk: "medium" },
    { key: "ai_google_ads_execution_enabled",     label: "Google Ads Live Push",          risk: "high" },
    { key: "ai_meta_ads_execution_enabled",       label: "Meta Ads Live Push",            risk: "high" },
    { key: "ai_platform_execution_test_mode",     label: "Platform Execution Test Mode",  risk: "low" },
    { key: "ai_whatsapp_agent_enabled",                        label: "WhatsApp AI Agent",              risk: "medium" },
    { key: "ai_whatsapp_followups_enabled",                    label: "WhatsApp Auto Follow-ups",       risk: "medium" },
    { key: "ai_whatsapp_auto_qualify_enabled",                 label: "WhatsApp Auto Qualify",          risk: "low" },
    { key: "ai_whatsapp_template_mode_enabled",                label: "WhatsApp Template Mode",         risk: "low" },
    { key: "ai_whatsapp_handoff_required_on_low_confidence",   label: "WhatsApp Low-Confidence Handoff",risk: "low" },
  ];

  const lastLog = recentLogs[0];

  return (
    <div className="pt-14 pb-20 lg:pb-6 lg:pl-56 min-h-screen bg-[#0B0F19]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">AI Operations</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Isolated AI analysis layer — ads intelligence + site health + attribution tracking
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
            <span className="text-xs font-semibold text-emerald-400">Live site protected</span>
          </div>
        </div>

        {/* Kill Switch Banner */}
        {killSwitch && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <ZapOff className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-300">Master Kill Switch is ACTIVE</p>
              <p className="text-xs text-red-400/80 mt-0.5">All AI automations are disabled. Manual review only.</p>
            </div>
            <button
              onClick={() => toggleFlag.mutate({ key: "ai_master_kill_switch", value: false })}
              className="shrink-0 text-xs font-semibold text-red-300 hover:text-red-200 bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-500/50 transition-colors"
            >
              Deactivate
            </button>
          </div>
        )}

        {/* Last AI Action Card */}
        {lastLog && (
          <div className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-300 truncate">
                Last AI action: <span className="text-white">{ACTION_LABELS[lastLog.actionType] ?? lastLog.actionType}</span>
              </p>
              {lastLog.summary && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{lastLog.summary}</p>
              )}
            </div>
            <div className="shrink-0 text-right hidden sm:block">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                {lastLog.actor === "ai_agent" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                <span>{lastLog.actor ?? "system"}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-0.5">
                <Clock className="w-3 h-3" />
                <span>{new Date(lastLog.createdAt).toLocaleString("en-SG", { dateStyle: "short", timeStyle: "short" })}</span>
              </div>
            </div>
            <Link href="/admin/ai/audit">
              <button className="ml-1 text-slate-600 hover:text-slate-400 transition-colors">
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        )}

        {/* AI Activity Summary — what AI has done in the last 7 days */}
        {activity && (
          <div className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 border border-violet-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-300">AI Activity</span>
                <span className="text-[10px] text-slate-500">last {activity.windowDays}d</span>
              </div>
              <Link href="/admin/ai/audit"><span className="text-[11px] text-violet-400 hover:text-violet-300 cursor-pointer">View audit log →</span></Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div data-testid="stat-platform-pushes">
                <p className="text-2xl font-bold text-white tabular-nums">{activity.platform?.totalPushes ?? 0}</p>
                <p className="text-[10px] uppercase text-slate-400 mt-0.5">Platform pushes</p>
              </div>
              <div data-testid="stat-success-rate">
                <p className="text-2xl font-bold text-emerald-300 tabular-nums">{activity.platform?.successRate ?? 0}%</p>
                <p className="text-[10px] uppercase text-slate-400 mt-0.5">Success rate</p>
              </div>
              <div data-testid="stat-auto-approved">
                <p className="text-2xl font-bold text-violet-300 tabular-nums">{activity.approvals?.autoApproved ?? 0}</p>
                <p className="text-[10px] uppercase text-slate-400 mt-0.5">Auto-approved</p>
              </div>
              <div data-testid="stat-site-changes">
                <p className="text-2xl font-bold text-blue-300 tabular-nums">{activity.site?.changesApplied ?? 0}</p>
                <p className="text-[10px] uppercase text-slate-400 mt-0.5">Site updates</p>
              </div>
              <div data-testid="stat-rollbacks">
                <p className={`text-2xl font-bold tabular-nums ${(activity.platform?.rollbacks ?? 0) > 0 ? "text-amber-300" : "text-slate-500"}`}>{activity.platform?.rollbacks ?? 0}</p>
                <p className="text-[10px] uppercase text-slate-400 mt-0.5">Rollbacks</p>
              </div>
              <div data-testid="stat-time-saved">
                <p className="text-2xl font-bold text-fuchsia-300 tabular-nums">{activity.minutesSaved ?? 0}m</p>
                <p className="text-[10px] uppercase text-slate-400 mt-0.5">Admin time saved</p>
              </div>
            </div>
            {activity.platform?.failed > 0 && (
              <p className="text-[11px] text-red-300 mt-3 flex items-center gap-1.5">
                ⚠ {activity.platform.failed} push(es) failed in this window — review the approval queue.
              </p>
            )}
            <div className="mt-3 pt-3 border-t border-violet-500/10 flex items-center gap-2">
              <button
                data-testid="button-test-alert"
                onClick={async () => {
                  const r = await fetch("/api/ai/alerts/test", { method: "POST", credentials: "include" }).then(r => r.json()).catch(() => ({}));
                  alert(`Push: ${r.pushSent ? "✓ sent" : "✗"}   WhatsApp: ${r.whatsappSent ? "✓ sent" : r.throttled ? "throttled (10m)" : "skipped (flag off or no phone set)"}`);
                }}
                className="text-[11px] text-violet-300 hover:text-violet-200 px-2 py-1 rounded border border-violet-500/30 hover:border-violet-500/50 transition-colors"
              >
                Test real-time alert
              </button>
              <button
                data-testid="button-send-digest"
                onClick={async () => {
                  const r = await fetch("/api/ai/digest/send-now", { method: "POST", credentials: "include" }).then(r => r.json()).catch(() => ({}));
                  alert(r.sent ? `Digest sent to ${r.recipient}` : `Could not send: ${r.reason ?? "unknown"}`);
                }}
                className="text-[11px] text-violet-300 hover:text-violet-200 px-2 py-1 rounded border border-violet-500/30 hover:border-violet-500/50 transition-colors"
              >
                Send digest now
              </button>
              <button
                data-testid="button-run-anomaly"
                onClick={async () => {
                  const r = await fetch("/api/ai/anomaly/run", { method: "POST", credentials: "include" }).then(r => r.json()).catch(() => ({}));
                  alert(`Scanned ${r.scanned ?? 0} campaigns. Alerted on ${r.alerted ?? 0}. Skipped ${r.insufficientHistory ?? 0} (not enough history).`);
                }}
                className="text-[11px] text-violet-300 hover:text-violet-200 px-2 py-1 rounded border border-violet-500/30 hover:border-violet-500/50 transition-colors"
              >
                Run anomaly scan
              </button>
            </div>
          </div>
        )}

        {/* HOT LEADS — top of revenue funnel, refresh every minute */}
        {hotLeads && hotLeads.totalLeads > 0 && (
          <div data-testid="card-hot-leads" className="bg-gradient-to-br from-orange-500/15 to-red-500/5 border border-orange-500/30 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-300">🔥 Hot Leads (24h)</span>
                <span className="text-[10px] text-slate-500">threshold {hotLeads.hotThreshold}/100 · auto-refresh 1m</span>
              </div>
              <Link href="/admin/whatsapp"><span className="text-[11px] text-orange-400 hover:text-orange-300 cursor-pointer">View conversations →</span></Link>
            </div>
            <div className="flex items-baseline gap-4 mb-3">
              <div>
                <p className="text-3xl font-bold text-orange-300 tabular-nums" data-testid="text-hot-count">{hotLeads.hotCount}</p>
                <p className="text-[10px] uppercase text-slate-400">hot — call now</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-300 tabular-nums" data-testid="text-warm-count">{hotLeads.warmCount}</p>
                <p className="text-[10px] uppercase text-slate-400">warm</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-400 tabular-nums">{hotLeads.totalLeads}</p>
                <p className="text-[10px] uppercase text-slate-400">scored total</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {hotLeads.leads.slice(0, 5).map((l: any) => (
                <div
                  key={l.phone}
                  data-testid={`row-hot-lead-${l.phone}`}
                  className={`flex items-center gap-3 p-2 rounded-lg border ${
                    l.tier === "hot"  ? "bg-orange-500/10 border-orange-500/30"
                    : l.tier === "warm" ? "bg-yellow-500/5 border-yellow-500/20"
                    : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold tabular-nums ${
                    l.tier === "hot"  ? "bg-orange-500/30 text-orange-200"
                    : l.tier === "warm" ? "bg-yellow-500/20 text-yellow-200"
                    : "bg-slate-700 text-slate-300"
                  }`}>
                    <span className="text-lg leading-none">{l.score}</span>
                    <span className="text-[8px] uppercase mt-0.5">{l.tier}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate">{l.customerName ?? l.phoneMasked}</p>
                      {l.urgency === "asap" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-bold uppercase">ASAP</span>}
                      {l.aiOwnership === "human" && <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 uppercase">Human</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {l.serviceType ?? "—"} {l.quantity ? `· ${l.quantity} items` : ""} {l.jobAddress ? `· ${l.jobAddress.slice(0, 35)}` : ""}
                    </p>
                    {l.topReasons && l.topReasons.length > 0 && (
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {l.topReasons.map((r: any) => `${r.label} (+${r.points})`).join(" · ")}
                      </p>
                    )}
                  </div>
                  <a
                    href={`https://wa.me/${l.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`link-wa-${l.phone}`}
                    className="text-[11px] px-3 py-1.5 rounded bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 transition-colors shrink-0"
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
          <div data-testid="card-spend-guardrails" className="bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">💰 Spend Guardrails</span>
                <span className="text-[10px] text-slate-500">AI-driven ad-budget changes · auto-refresh 1m</span>
              </div>
              {spend.recentBlocks > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                  {spend.recentBlocks} blocked this month
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Today */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-[10px] uppercase text-slate-400">Today</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    SGD <span data-testid="text-spend-today" className="text-white font-semibold">{spend.todaySgd.toFixed(2)}</span>
                    <span className="text-slate-500"> / {spend.dailyCapSgd.toFixed(0)}</span>
                  </p>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      spend.dailyUtilization >= 1 ? "bg-red-500"
                      : spend.dailyUtilization >= 0.8 ? "bg-amber-500"
                      : "bg-cyan-500"
                    }`}
                    style={{ width: `${Math.min(100, spend.dailyUtilization * 100).toFixed(1)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{(spend.dailyUtilization * 100).toFixed(0)}% of daily cap</p>
              </div>
              {/* Month */}
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-[10px] uppercase text-slate-400">Month-to-date</p>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    SGD <span data-testid="text-spend-month" className="text-white font-semibold">{spend.monthSgd.toFixed(2)}</span>
                    <span className="text-slate-500"> / {spend.monthlyCapSgd.toFixed(0)}</span>
                  </p>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      spend.monthlyUtilization >= 1 ? "bg-red-500"
                      : spend.monthlyUtilization >= 0.8 ? "bg-amber-500"
                      : "bg-cyan-500"
                    }`}
                    style={{ width: `${Math.min(100, spend.monthlyUtilization * 100).toFixed(1)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{(spend.monthlyUtilization * 100).toFixed(0)}% of monthly cap · trips kill switch at 100%</p>
              </div>
            </div>
          </div>
        )}

        {/* Two-column: Recommendation Quality + WhatsApp Agent Performance */}
        {(recQuality || waPerf) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Recommendation Quality */}
            {recQuality && (
              <div data-testid="card-rec-quality" className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">Recommendation Quality</span>
                  <span className="text-[10px] text-slate-500">last {recQuality.windowDays}d</span>
                </div>
                <div className="flex items-baseline gap-3 mb-3">
                  <p className="text-3xl font-bold text-white tabular-nums" data-testid="text-overall-approve-rate">{recQuality.overallApproveRate}%</p>
                  <p className="text-[11px] text-slate-400">approve rate · {recQuality.totalRecommendations} total</p>
                </div>
                {recQuality.breakdown && recQuality.breakdown.length > 0 && (
                  <div className="space-y-1.5">
                    {recQuality.breakdown.slice(0, 5).map((b: any) => (
                      <div key={b.type} className="flex items-center gap-2 text-[11px]" data-testid={`row-rec-type-${b.type}`}>
                        <span className="text-slate-300 w-32 truncate">{b.type}</span>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400" style={{ width: `${b.approveRate}%` }} />
                        </div>
                        <span className="text-slate-400 tabular-nums w-14 text-right">{b.approveRate}% / {b.total}</span>
                      </div>
                    ))}
                  </div>
                )}
                {recQuality.suggestions?.message && (
                  <p className="text-[11px] text-emerald-200/80 mt-3 italic" data-testid="text-rec-suggestion">💡 {recQuality.suggestions.message}</p>
                )}
              </div>
            )}

            {/* WhatsApp Agent Performance */}
            {waPerf && (
              <div data-testid="card-wa-perf" className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/20 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-green-300">WhatsApp Sales Agent</span>
                  <span className="text-[10px] text-slate-500">last {waPerf.windowDays}d</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <p className="text-2xl font-bold text-white tabular-nums" data-testid="text-wa-conversations">{waPerf.uniqueConversations}</p>
                    <p className="text-[10px] uppercase text-slate-400 mt-0.5">Conversations</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-300 tabular-nums" data-testid="text-wa-followups">{waPerf.followups?.sent ?? 0}</p>
                    <p className="text-[10px] uppercase text-slate-400 mt-0.5">Follow-ups sent</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold tabular-nums ${(waPerf.handoffs?.rate ?? 0) >= 50 ? "text-amber-300" : "text-green-300"}`} data-testid="text-wa-handoff-rate">{waPerf.handoffs?.rate ?? 0}%</p>
                    <p className="text-[10px] uppercase text-slate-400 mt-0.5">Handoff rate</p>
                  </div>
                </div>
                {waPerf.handoffs?.byReason && Object.keys(waPerf.handoffs.byReason).length > 0 && (
                  <div className="text-[11px] text-slate-400">
                    <span className="text-slate-500">Handoff reasons: </span>
                    {Object.entries(waPerf.handoffs.byReason).map(([r, n]: any) => (
                      <span key={r} className="inline-block mr-2 text-slate-300">{r} ({n})</span>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-green-200/80 mt-2 italic" data-testid="text-wa-verdict">💬 {waPerf.verdict}</p>
              </div>
            )}
          </div>
        )}

        {/* Conversion Stats */}
        {!isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Leads",  value: stats.totalLeads ?? 0,    sub: "all time" },
              { label: "Deposit Paid", value: stats.deposited ?? 0,     sub: `${stats.totalLeads ? Math.round((stats.deposited / stats.totalLeads) * 100) : 0}% of leads` },
              { label: "Final Paid",   value: stats.finalPaid ?? 0,     sub: "completed jobs" },
              { label: "Revenue",      value: `$${parseFloat(stats.totalRevenue ?? "0").toLocaleString()}`, sub: "paid-in-full" },
            ].map(stat => (
              <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.sub}</p>
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
                <div className={`relative p-5 rounded-2xl bg-gradient-to-br border cursor-pointer hover:scale-[1.01] transition-all group ${mod.color}`}>
                  {/* Status badge — top-left */}
                  <span className={`absolute top-3 left-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${sm.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sm.dot}`} />
                    {sm.label}
                  </span>

                  {/* Count badge — top-right */}
                  {mod.urgent && (mod.badge ?? 0) > 0 && (
                    <span className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                      {mod.badge} {mod.badgeLabel}
                    </span>
                  )}
                  {!mod.urgent && (mod.badge ?? 0) > 0 && (
                    <span className="absolute top-3 right-3 bg-blue-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {mod.badge} {mod.badgeLabel}
                    </span>
                  )}

                  <mod.icon className={`w-7 h-7 mt-6 mb-3 ${mod.iconColor}`} />
                  <h3 className="text-base font-bold text-white mb-1">{mod.label}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{mod.description}</p>
                  <div className="flex items-center gap-1.5 mt-4 text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Feature Flags + Inline Help */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-white">Feature Flags</h2>
            </div>
            <button
              onClick={() => toggleFlag.mutate({ key: "ai_master_kill_switch", value: !killSwitch })}
              data-testid="toggle-kill-switch"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                killSwitch
                  ? "bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30"
                  : "bg-white/5 border-white/10 text-slate-400 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/20"
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
                        flag.risk === "high" ? "bg-red-400" :
                        flag.risk === "medium" ? "bg-amber-400" : "bg-emerald-400"
                      }`} />
                      <span className="text-sm font-medium text-slate-200 truncate">{flag.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide shrink-0 ${
                        flag.risk === "high" ? "bg-red-500/20 text-red-400" :
                        flag.risk === "medium" ? "bg-amber-500/20 text-amber-400" :
                        "bg-emerald-500/20 text-emerald-400"
                      }`}>{flag.risk} risk</span>
                      {help && (
                        <button
                          onClick={() => setHelpFor(isHelpOpen ? null : flag.key)}
                          data-testid={`help-${flag.key}`}
                          className="shrink-0 text-slate-600 hover:text-slate-400 transition-colors"
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
                        ? <ToggleRight className="w-8 h-8 text-emerald-400" />
                        : <ToggleLeft className="w-8 h-8 text-slate-600" />}
                    </button>
                  </div>

                  {/* Inline help panel */}
                  {isHelpOpen && help && (
                    <div className="mx-5 mb-3 p-3.5 bg-black/20 border border-white/8 rounded-xl space-y-2.5">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">What it does</p>
                        <p className="text-xs text-slate-300 leading-relaxed">{help.what}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Effect when enabled</p>
                        <p className="text-xs text-slate-300 leading-relaxed">{help.effect}</p>
                      </div>
                      <div className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                        flag.risk === "high" ? "bg-red-500/5 border-red-500/15" :
                        flag.risk === "medium" ? "bg-amber-500/5 border-amber-500/15" :
                        "bg-emerald-500/5 border-emerald-500/15"
                      }`}>
                        {flag.risk === "high"
                          ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                          : flag.risk === "medium"
                            ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            : <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                        <p className={`text-xs leading-relaxed ${
                          flag.risk === "high" ? "text-red-300" :
                          flag.risk === "medium" ? "text-amber-300" : "text-emerald-300"
                        }`}>{help.safe}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3 bg-black/20 border-t border-white/5 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500">
              High-risk flags require approval queue sign-off. Medium-risk flags auto-queue for review. Low-risk flags run automatically and log to the audit trail.
              The live booking/payment/admin/staff workflow is never affected by any AI flag setting.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
