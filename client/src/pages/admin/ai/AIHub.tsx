import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Bot, TrendingUp, Globe, CheckSquare, ScrollText,
  Zap, ZapOff, ToggleLeft, ToggleRight, AlertTriangle,
  ArrowRight, Shield, HelpCircle, X, Clock, User, Check, Database
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
    { key: "ai_scheduler_enabled",          label: "Sync Scheduler",             risk: "low" },
    { key: "ai_auto_execute_enabled",       label: "Auto-Execute on Approval",   risk: "medium" },
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
