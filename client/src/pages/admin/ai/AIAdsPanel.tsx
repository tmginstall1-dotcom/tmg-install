import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  TrendingUp, Plus, Cpu, RefreshCw, ChevronLeft,
  Target, AlertTriangle, TrendingDown, ArrowUp,
  DollarSign, MousePointerClick, Users, Zap, Database, ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RISK_COLORS: Record<string, string> = {
  low: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-red-400 bg-red-500/10 border-red-500/20",
};

const ACTION_ICONS: Record<string, any> = {
  cut: TrendingDown, scale: ArrowUp, keep: Target,
  test: Cpu, pause: AlertTriangle, negate: AlertTriangle,
  "fix-tracking": RefreshCw,
};

function ConnectorSyncBanner() {
  const { data: connectors } = useQuery<Record<string, any>>({
    queryKey: ["/api/ai/connectors/status"],
  });
  if (!connectors) return null;
  const gads = connectors["google_ads"];
  const meta = connectors["meta_ads"];
  const hasAnyData = (gads?.rowCount ?? 0) > 0 || (meta?.rowCount ?? 0) > 0;
  const hasAnyError = gads?.lastSyncStatus === "error" || meta?.lastSyncStatus === "error";
  if (!gads && !meta) return null;

  const pill = (label: string, cfg: any) => {
    if (!cfg) return null;
    const color = cfg.lastSyncStatus === "success" ? "border-emerald-500/20 text-emerald-400"
      : cfg.lastSyncStatus === "error" ? "border-red-500/20 text-red-400"
      : "border-white/10 text-slate-400";
    return (
      <span key={label} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${color}`}>
        <Database className="w-3 h-3" />
        {label} · {cfg.rowCount ?? 0} rows
        {cfg.lastSyncStatus === "error" && <AlertTriangle className="w-3 h-3 text-red-400" />}
      </span>
    );
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl border ${hasAnyError ? "bg-red-500/5 border-red-500/15" : hasAnyData ? "bg-emerald-500/5 border-emerald-500/15" : "bg-white/3 border-white/8"}`}>
      <span className="text-[11px] text-slate-500 font-medium mr-1">Live API data:</span>
      {pill("Google Ads", gads)}
      {pill("Meta Ads", meta)}
      <Link href="/admin/ai/connectors" className="ml-auto flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 transition-colors shrink-0">
        <ExternalLink className="w-3 h-3" /> Manage connectors
      </Link>
    </div>
  );
}

export default function AIAdsPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [platform, setPlatform] = useState<"google" | "meta">("google");
  const [formData, setFormData] = useState({
    campaignName: "", adSetName: "", snapshotDate: new Date().toISOString().split("T")[0],
    spend: "", impressions: "", clicks: "", conversions: "", conversionValue: "",
  });

  const { data: funnel } = useQuery<any>({ queryKey: ["/api/ai/attribution/funnel"] });
  const { data: snapshots = [] } = useQuery<any[]>({ queryKey: ["/api/ai/ads/snapshots"] });
  const { data: recommendations = [] } = useQuery<any[]>({ queryKey: ["/api/ai/ads/recommendations"] });

  const addSnapshot = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/ai/ads/snapshots", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/ai/ads/snapshots"] });
      setShowAddForm(false);
      setFormData({ campaignName: "", adSetName: "", snapshotDate: new Date().toISOString().split("T")[0], spend: "", impressions: "", clicks: "", conversions: "", conversionValue: "" });
      toast({ title: "Snapshot added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const analyze = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai/ads/analyze", {}),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/ai/ads/recommendations"] });
      toast({ title: `Analysis complete — ${data.recommendations?.length ?? 0} recommendations generated` });
    },
    onError: (err: any) => toast({ title: "Analysis failed", description: err.message, variant: "destructive" }),
  });

  const funnelData = funnel?.funnel ?? {};
  const byChannel = funnel?.byChannel ?? {};

  const handleAddSnapshot = () => {
    addSnapshot.mutate({
      platform,
      snapshotDate: formData.snapshotDate,
      campaignName: formData.campaignName || undefined,
      adSetName: formData.adSetName || undefined,
      spend: formData.spend ? parseFloat(formData.spend) : undefined,
      impressions: formData.impressions ? parseInt(formData.impressions) : undefined,
      clicks: formData.clicks ? parseInt(formData.clicks) : undefined,
      conversions: formData.conversions ? parseFloat(formData.conversions) : undefined,
      conversionValue: formData.conversionValue ? parseFloat(formData.conversionValue) : undefined,
    });
  };

  const pendingRecs = recommendations.filter((r: any) => r.status === "pending");

  return (
    <div className="pt-14 pb-20 lg:pb-6 lg:pl-56 min-h-screen bg-[#0B0F19]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/admin/ai">
              <button className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0">
                <ChevronLeft className="w-5 h-5" />
              </button>
            </Link>
            <TrendingUp className="w-6 h-6 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white">Ads Intelligence</h1>
              <p className="text-xs text-slate-500 truncate">Attribution funnel · Performance data · AI recommendations</p>
            </div>
          </div>
          <div className="flex gap-2 sm:ml-auto shrink-0">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              data-testid="button-add-snapshot"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/10 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Data
            </button>
            <button
              onClick={() => analyze.mutate()}
              data-testid="button-run-analysis"
              disabled={analyze.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Cpu className="w-4 h-4" /> {analyze.isPending ? "Analyzing…" : "Run AI Analysis"}
            </button>
          </div>
        </div>

        {/* Live Connector Sync Banner */}
        <ConnectorSyncBanner />
        {showAddForm && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Add Ads Performance Data</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Platform</label>
                <select value={platform} onChange={e => setPlatform(e.target.value as any)}
                  className="w-full h-9 px-3 bg-black/20 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="google">Google Ads</option>
                  <option value="meta">Meta Ads</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Date</label>
                <input type="date" value={formData.snapshotDate} onChange={e => setFormData(f => ({...f, snapshotDate: e.target.value}))}
                  className="w-full h-9 px-3 bg-black/20 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Campaign Name</label>
                <input value={formData.campaignName} onChange={e => setFormData(f => ({...f, campaignName: e.target.value}))}
                  placeholder="e.g. Singapore Furniture Install"
                  className="w-full h-9 px-3 bg-black/20 border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Spend (SGD)</label>
                <input type="number" min="0" step="0.01" value={formData.spend} onChange={e => setFormData(f => ({...f, spend: e.target.value}))}
                  placeholder="0.00"
                  className="w-full h-9 px-3 bg-black/20 border border-white/10 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Clicks</label>
                <input type="number" min="0" value={formData.clicks} onChange={e => setFormData(f => ({...f, clicks: e.target.value}))}
                  className="w-full h-9 px-3 bg-black/20 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Impressions</label>
                <input type="number" min="0" value={formData.impressions} onChange={e => setFormData(f => ({...f, impressions: e.target.value}))}
                  className="w-full h-9 px-3 bg-black/20 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Conversions</label>
                <input type="number" min="0" step="0.1" value={formData.conversions} onChange={e => setFormData(f => ({...f, conversions: e.target.value}))}
                  className="w-full h-9 px-3 bg-black/20 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddSnapshot} disabled={addSnapshot.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                {addSnapshot.isPending ? "Saving…" : "Save Snapshot"}
              </button>
              <button onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-sm rounded-lg transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Conversion Funnel */}
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Conversion Funnel</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-white/5">
            {[
              { label: "Leads", value: funnelData.leads ?? 0, icon: Users, color: "text-blue-400" },
              { label: "Quote Sent", value: funnelData.quoteSent ?? 0, icon: TrendingUp, color: "text-indigo-400" },
              { label: "Deposit Paid", value: funnelData.depositPaid ?? 0, icon: DollarSign, color: "text-emerald-400" },
              { label: "Booked", value: funnelData.booked ?? 0, icon: Target, color: "text-teal-400" },
              { label: "Final Paid", value: funnelData.finalPaid ?? 0, icon: Zap, color: "text-violet-400" },
            ].map(item => (
              <div key={item.label} className="p-4 text-center">
                <item.icon className={`w-4 h-4 mx-auto mb-2 ${item.color}`} />
                <p className="text-xl font-bold text-white tabular-nums">{item.value}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-black/20 border-t border-white/5 flex flex-wrap gap-4">
            <p className="text-xs text-slate-500">
              Revenue: <span className="text-white font-semibold">${parseFloat(funnelData.totalRevenue ?? "0").toLocaleString()}</span>
            </p>
            {Object.entries(byChannel).map(([ch, count]) => (
              <p key={ch} className="text-xs text-slate-500">
                {ch}: <span className="text-slate-300 font-semibold">{count as number}</span>
              </p>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        {pendingRecs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-400" /> AI Recommendations ({pendingRecs.length})
            </h2>
            {pendingRecs.map((rec: any) => {
              const Icon = ACTION_ICONS[rec.action] ?? Target;
              return (
                <div key={rec.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Icon className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${RISK_COLORS[rec.riskLevel ?? "medium"]}`}>{rec.action}</span>
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${RISK_COLORS[rec.riskLevel ?? "medium"]}`}>{rec.riskLevel} risk</span>
                        {rec.platform && <span className="text-[10px] text-slate-500 uppercase">{rec.platform}</span>}
                      </div>
                      {rec.targetName && <p className="text-sm font-medium text-white">{rec.targetName}</p>}
                      {rec.reason && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{rec.reason}</p>}
                      {rec.expectedEffect && <p className="text-xs text-emerald-400 mt-1">Expected: {rec.expectedEffect}</p>}
                    </div>
                    {rec.confidence && (
                      <span className="shrink-0 text-xs font-bold text-slate-400">{rec.confidence}%</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Snapshots Table */}
        {snapshots.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white">Performance Data ({snapshots.length} records)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Date","Platform","Campaign","Spend","Clicks","Conv.","CPC","CPL"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-black/20 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {snapshots.slice(0, 20).map((s: any) => (
                    <tr key={s.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">{s.snapshotDate}</td>
                      <td className="px-4 py-2.5"><span className="text-[10px] font-bold uppercase text-blue-400">{s.platform}</span></td>
                      <td className="px-4 py-2.5 text-xs text-slate-300 max-w-[160px] truncate">{s.campaignName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-white font-medium tabular-nums">${parseFloat(s.spend ?? "0").toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-300 tabular-nums">{s.clicks ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-300 tabular-nums">{s.conversions ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-300 tabular-nums">${parseFloat(s.cpc ?? "0").toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-300 tabular-nums">${parseFloat(s.cpl ?? "0").toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {snapshots.length === 0 && recommendations.length === 0 && (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
            <TrendingUp className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No ads data yet</p>
            <p className="text-sm text-slate-600 mt-1">Add performance data from Google or Meta Ads, then run AI analysis to get recommendations.</p>
          </div>
        )}

      </div>
    </div>
  );
}
