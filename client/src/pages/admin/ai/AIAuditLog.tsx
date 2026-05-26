import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText, Check, X, Bot, User, AlertTriangle, Info, RefreshCw, Shield,
} from "lucide-react";
import {
  PageShell, PageHeader, PageBody, Card, EmptyState, LoadingState, Pill,
} from "@/components/admin/AdminUI";

const ACTION_LABEL: Record<string, { icon: any; tone: "ink" | "stone" | "urgent" | "ok" }> = {
  recommendation_generated: { icon: Bot, tone: "stone" },
  action_approved:          { icon: Check, tone: "ink" },
  action_rejected:          { icon: X, tone: "urgent" },
  action_deferred:          { icon: AlertTriangle, tone: "stone" },
  action_applied:           { icon: Check, tone: "ink" },
  audit_run:                { icon: RefreshCw, tone: "stone" },
  snapshot_added:           { icon: Info, tone: "stone" },
  flag_changed:             { icon: Shield, tone: "stone" },
  publish_event:            { icon: Check, tone: "ink" },
  rollback:                 { icon: AlertTriangle, tone: "urgent" },
};

export default function AIAuditLog() {
  const [moduleFilter, setModuleFilter] = useState("all");
  const [expandedId, setExpandedId]     = useState<number | null>(null);

  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ai/audit-log", moduleFilter],
    queryFn: async () => {
      const url = moduleFilter === "all"
        ? "/api/ai/audit-log?limit=200"
        : `/api/ai/audit-log?module=${moduleFilter}&limit=200`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const modules = ["all", "ads", "site", "attribution", "flags"];

  if (isLoading) {
    return <PageShell><LoadingState label="Loading audit log" /></PageShell>;
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="AI Ops · Audit"
        title="Audit Log"
        subtitle="Immutable record of every AI action — recommendations, approvals, and applied changes."
        actions={
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#0A0A0A] tabular-nums">
            {logs.length} entries
          </span>
        }
        meta={
          <div className="flex items-center gap-1 overflow-x-auto">
            {modules.map(m => {
              const active = moduleFilter === m;
              return (
                <button
                  key={m}
                  onClick={() => setModuleFilter(m)}
                  data-testid={`module-filter-${m}`}
                  className={`h-8 px-3 text-[10px] font-black uppercase tracking-[0.18em] whitespace-nowrap transition-colors ${
                    active
                      ? "bg-[#0A0A0A] text-white"
                      : "bg-white text-[#0A0A0A]/65 border border-black/15 hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        }
      />

      <PageBody>
        {logs.length === 0 ? (
          <Card>
            <EmptyState
              icon={ScrollText}
              title="No log entries yet"
              hint="AI actions will be recorded here as they happen."
            />
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-black/8">
              {logs.map((log: any) => {
                const style = ACTION_LABEL[log.actionType] ?? ACTION_LABEL.recommendation_generated;
                const Icon = style.icon;
                const isExpanded = expandedId === log.id;
                return (
                  <div
                    key={log.id}
                    data-testid={`log-entry-${log.id}`}
                    className="px-4 sm:px-5 py-3.5 hover:bg-[#EBE9E2] transition-colors cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 flex items-center justify-center shrink-0 mt-0.5 ${
                        style.tone === "urgent" ? "bg-[#C1121F] text-white" :
                        style.tone === "ink"    ? "bg-[#0A0A0A] text-white" :
                                                  "bg-[#EBE9E2] text-[#0A0A0A]"
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-black uppercase tracking-[0.08em] text-[#0A0A0A] font-mono">
                            {log.actionType}
                          </span>
                          {log.module && <Pill tone="stone">{log.module}</Pill>}
                          {log.outcome && (
                            <span className={`text-[10px] uppercase font-black tracking-[0.16em] ${
                              log.outcome === "success" ? "text-[#0A0A0A]" :
                              log.outcome === "failed"  ? "text-[#C1121F]" :
                                                          "text-black/55"
                            }`}>
                              {log.outcome}
                            </span>
                          )}
                        </div>
                        {log.summary && (
                          <p className="text-[12px] text-black/65 mt-1 leading-snug font-medium">{log.summary}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-black/55 font-bold uppercase tracking-[0.14em] flex items-center gap-1">
                            {log.actor === "ai_agent" ? <Bot className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {log.actor ?? "system"}
                          </span>
                          <span className="text-[10px] text-black/55 font-bold uppercase tracking-[0.14em] tabular-nums">
                            {new Date(log.createdAt).toLocaleString("en-SG")}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isExpanded && log.detail && (
                      <pre className="mt-3 ml-11 p-3 bg-[#0A0A0A] text-white text-[11px] overflow-x-auto whitespace-pre-wrap font-mono leading-snug">
                        {JSON.stringify(log.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </PageBody>
    </PageShell>
  );
}
