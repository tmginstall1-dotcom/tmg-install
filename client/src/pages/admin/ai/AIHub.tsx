import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Bot, TrendingUp, Globe, CheckSquare, ScrollText,
  Zap, ZapOff, ToggleLeft, ToggleRight, AlertTriangle,
  ArrowRight, Shield
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AIHub() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ["/api/ai/summary"],
  });

  const toggleFlag = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      apiRequest("PATCH", `/api/ai/flags/${key}`, { value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/ai/flags"] });
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
    },
    {
      href: "/admin/ai/approvals",
      icon: CheckSquare,
      label: "Approval Queue",
      description: "Review and approve/reject AI-proposed actions",
      color: "from-amber-500/10 to-orange-500/10 border-amber-500/20",
      iconColor: "text-amber-400",
      badge: summary?.pendingApprovalsCount ?? 0,
      badgeLabel: "pending",
      urgent: (summary?.pendingApprovalsCount ?? 0) > 0,
    },
    {
      href: "/admin/ai/audit",
      icon: ScrollText,
      label: "Audit Log",
      description: "Complete immutable history of every AI action and recommendation",
      color: "from-slate-500/10 to-zinc-500/10 border-slate-500/20",
      iconColor: "text-slate-400",
    },
  ];

  const featureFlags = [
    { key: "ai_ads_enabled", label: "Ads Analysis", risk: "low" },
    { key: "ai_ads_auto_low_risk_enabled", label: "Auto Low-Risk Ads Actions", risk: "medium" },
    { key: "ai_site_audit_enabled", label: "Site Audits", risk: "low" },
    { key: "ai_site_preview_enabled", label: "Site Previews", risk: "low" },
    { key: "ai_site_publish_enabled", label: "Auto-Publish Changes", risk: "high" },
  ];

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
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <ZapOff className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">Master Kill Switch is ACTIVE</p>
              <p className="text-xs text-red-400/80 mt-0.5">All AI automations are currently disabled. Manual review only.</p>
            </div>
            <button
              onClick={() => toggleFlag.mutate({ key: "ai_master_kill_switch", value: false })}
              className="text-xs font-semibold text-red-300 hover:text-red-200 bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-500/50 transition-colors"
            >
              Deactivate
            </button>
          </div>
        )}

        {/* Conversion Stats */}
        {!isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total Leads", value: stats.totalLeads ?? 0, sub: "all time" },
              { label: "Deposit Paid", value: stats.deposited ?? 0, sub: `${stats.totalLeads ? Math.round((stats.deposited/stats.totalLeads)*100) : 0}% of leads` },
              { label: "Final Paid", value: stats.finalPaid ?? 0, sub: "completed jobs" },
              { label: "Revenue", value: `$${parseFloat(stats.totalRevenue ?? "0").toLocaleString()}`, sub: "paid-in-full" },
            ].map(stat => (
              <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white tabular-nums">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Module Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {modules.map(mod => (
            <Link key={mod.href} href={mod.href}>
              <div className={`relative p-5 rounded-2xl bg-gradient-to-br border cursor-pointer hover:scale-[1.01] transition-all group ${mod.color}`}>
                {mod.urgent && mod.badge > 0 && (
                  <span className="absolute top-3 right-3 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                    {mod.badge} {mod.badgeLabel}
                  </span>
                )}
                {!mod.urgent && mod.badge > 0 && (
                  <span className="absolute top-3 right-3 bg-blue-500/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {mod.badge} {mod.badgeLabel}
                  </span>
                )}
                <mod.icon className={`w-7 h-7 mb-3 ${mod.iconColor}`} />
                <h3 className="text-base font-bold text-white mb-1">{mod.label}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{mod.description}</p>
                <div className="flex items-center gap-1.5 mt-4 text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                  Open <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Feature Flags */}
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
              return (
                <div key={flag.key} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${flag.risk === "high" ? "bg-red-400" : flag.risk === "medium" ? "bg-amber-400" : "bg-emerald-400"}`} />
                    <span className="text-sm font-medium text-slate-200">{flag.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                      flag.risk === "high" ? "bg-red-500/20 text-red-400" :
                      flag.risk === "medium" ? "bg-amber-500/20 text-amber-400" :
                      "bg-emerald-500/20 text-emerald-400"
                    }`}>{flag.risk} risk</span>
                  </div>
                  <button
                    onClick={() => toggleFlag.mutate({ key: flag.key, value: !enabled })}
                    data-testid={`flag-toggle-${flag.key}`}
                    className="flex items-center gap-1.5 text-xs transition-colors"
                    disabled={toggleFlag.isPending}
                  >
                    {enabled
                      ? <ToggleRight className="w-8 h-8 text-emerald-400" />
                      : <ToggleLeft className="w-8 h-8 text-slate-600" />}
                  </button>
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
