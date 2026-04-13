import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ScrollText, ChevronLeft, Check, X, Bot,
  User, AlertTriangle, Info, RefreshCw, Shield
} from "lucide-react";

const ACTION_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  recommendation_generated: { icon: Bot, color: "text-blue-400", bg: "bg-blue-500/10" },
  action_approved: { icon: Check, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  action_rejected: { icon: X, color: "text-red-400", bg: "bg-red-500/10" },
  action_deferred: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
  action_applied: { icon: Check, color: "text-teal-400", bg: "bg-teal-500/10" },
  audit_run: { icon: RefreshCw, color: "text-violet-400", bg: "bg-violet-500/10" },
  snapshot_added: { icon: Info, color: "text-slate-400", bg: "bg-slate-500/10" },
  flag_changed: { icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10" },
  publish_event: { icon: Check, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  rollback: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
};

const MODULE_COLORS: Record<string, string> = {
  ads: "text-blue-400 bg-blue-500/10",
  site: "text-emerald-400 bg-emerald-500/10",
  attribution: "text-violet-400 bg-violet-500/10",
  flags: "text-amber-400 bg-amber-500/10",
};

export default function AIAuditLog() {
  const [moduleFilter, setModuleFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ai/audit-log", moduleFilter],
    queryFn: async () => {
      const url = moduleFilter === "all" ? "/api/ai/audit-log?limit=200" : `/api/ai/audit-log?module=${moduleFilter}&limit=200`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const modules = ["all", "ads", "site", "attribution", "flags"];

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
          <ScrollText className="w-6 h-6 text-slate-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Audit Log</h1>
            <p className="text-xs text-slate-500">Immutable record of all AI actions, approvals, and recommendations</p>
          </div>
          <span className="ml-auto text-xs text-slate-600">{logs.length} entries</span>
        </div>

        {/* Module Filter */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
          <div className="flex gap-1 bg-black/20 rounded-xl p-1 w-max sm:w-fit">
            {modules.map(m => (
              <button key={m} onClick={() => setModuleFilter(m)}
                data-testid={`module-filter-${m}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                  moduleFilter === m ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
                }`}>{m}</button>
            ))}
          </div>
        </div>

        {/* Log Entries */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-white/10 rounded-2xl">
            <ScrollText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No log entries yet</p>
            <p className="text-sm text-slate-600 mt-1">AI actions will be recorded here as they happen.</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="divide-y divide-white/5">
              {logs.map((log: any) => {
                const style = ACTION_STYLES[log.actionType] ?? ACTION_STYLES.recommendation_generated;
                const Icon = style.icon;
                const isExpanded = expandedId === log.id;
                return (
                  <div key={log.id} data-testid={`log-entry-${log.id}`}
                    className="px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                    <div className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${style.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-slate-300 font-mono">{log.actionType}</span>
                          {log.module && (
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${MODULE_COLORS[log.module] ?? "text-slate-400 bg-slate-500/10"}`}>
                              {log.module}
                            </span>
                          )}
                          {log.outcome && (
                            <span className={`text-[10px] uppercase font-semibold ${log.outcome === "success" ? "text-emerald-400" : log.outcome === "failed" ? "text-red-400" : "text-slate-500"}`}>
                              {log.outcome}
                            </span>
                          )}
                        </div>
                        {log.summary && <p className="text-xs text-slate-400 mt-0.5 leading-snug">{log.summary}</p>}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] text-slate-600 flex items-center gap-1">
                            {log.actor === "ai_agent" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {log.actor ?? "system"}
                          </span>
                          <span className="text-[11px] text-slate-600">
                            {new Date(log.createdAt).toLocaleString("en-SG")}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isExpanded && log.detail && (
                      <pre className="mt-3 ml-10 p-3 bg-black/20 border border-white/5 rounded-lg text-[11px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
