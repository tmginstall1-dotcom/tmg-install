import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, ToggleLeft, ToggleRight, RefreshCw, Scale } from "lucide-react";

type FieldType = "number" | "percent" | "money" | "boolean" | "time" | "text" | "textarea";

interface RuleField {
  key: string;
  label: string;
  type: FieldType;
  group: string;
  help?: string;
}

interface BusinessRulesResponse {
  rules: Record<string, unknown>;
  fields: RuleField[];
}

const NUMERIC_TYPES: FieldType[] = ["number", "percent", "money"];

function slugify(group: string) {
  return group.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminBusinessRules() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<BusinessRulesResponse>({
    queryKey: ["/api/admin/business-rules"],
  });

  const [form, setForm] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    if (!data?.rules || !data?.fields) return;
    const next: Record<string, string | boolean> = {};
    for (const f of data.fields) {
      const v = data.rules[f.key];
      if (f.type === "boolean") {
        next[f.key] = Boolean(v);
      } else {
        next[f.key] = v === undefined || v === null ? "" : String(v);
      }
    }
    setForm(next);
  }, [data]);

  const save = useMutation({
    mutationFn: (partial: Record<string, unknown>) =>
      apiRequest("POST", "/api/admin/business-rules", partial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/business-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-rules"] });
      toast({ title: "Business rules saved", description: "All surfaces will use the updated terms immediately." });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!data?.fields || !data?.rules) return;
    const partial: Record<string, unknown> = {};
    for (const f of data.fields) {
      const current = form[f.key];
      const original = data.rules[f.key];
      if (f.type === "boolean") {
        const cur = Boolean(current);
        if (cur !== Boolean(original)) partial[f.key] = cur;
      } else if (NUMERIC_TYPES.includes(f.type)) {
        const num = Number(current);
        if (!Number.isFinite(num)) continue;
        if (num !== Number(original)) partial[f.key] = num;
      } else {
        const cur = String(current ?? "");
        if (cur !== String(original ?? "")) partial[f.key] = cur;
      }
    }
    if (Object.keys(partial).length === 0) {
      toast({ title: "No changes", description: "Nothing to save." });
      return;
    }
    save.mutate(partial);
  };

  const fields = data?.fields ?? [];
  const groups: string[] = [];
  for (const f of fields) {
    if (!groups.includes(f.group)) groups.push(f.group);
  }

  const update = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-[#F5F4F0] pt-14 lg:pl-56 pb-[calc(64px+env(safe-area-inset-bottom)+2rem)] lg:pb-12">
      <div className="bg-white border-b border-black/12 px-6 py-5 mb-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/admin/settings" data-testid="link-back-settings" className="inline-flex items-center gap-1.5 text-xs text-black/45 hover:text-black/70 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Settings
          </Link>
          <h1 className="text-xl font-semibold text-[#0A0A0A] tracking-tight flex items-center gap-2">
            <Scale className="w-5 h-5" /> Business Rules &amp; Terms
          </h1>
          <p className="text-sm text-black/55 mt-1">
            The single source of truth for deposits, surcharges, cancellation and policy wording across every quote, invoice and message.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-8 space-y-6">
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-black/45">Loading…</div>
        ) : (
          <>
            {groups.map((group) => (
              <div key={group} className="bg-white border border-black/12 rounded-none overflow-hidden">
                <div className="px-5 py-4 border-b border-black/8">
                  <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-black/55">{group}</h2>
                </div>
                <div className="p-5 space-y-5">
                  {fields.filter((f) => f.group === group).map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <label
                        htmlFor={`field-${f.key}`}
                        className="text-[11px] font-bold uppercase tracking-[0.12em] text-black/55 block"
                      >
                        {f.label}
                      </label>
                      {f.type === "boolean" ? (
                        <button
                          type="button"
                          data-testid={`toggle-${slugify(f.key)}`}
                          onClick={() => update(f.key, !form[f.key])}
                          className="flex items-center gap-2 text-sm text-black/70"
                        >
                          {form[f.key]
                            ? <ToggleRight className="w-6 h-6 text-[#0A0A0A]" />
                            : <ToggleLeft className="w-6 h-6 text-black/35" />}
                          {form[f.key] ? "Enabled" : "Disabled"}
                        </button>
                      ) : f.type === "textarea" ? (
                        <Textarea
                          id={`field-${f.key}`}
                          data-testid={`input-${slugify(f.key)}`}
                          value={(form[f.key] as string) ?? ""}
                          onChange={(e) => update(f.key, e.target.value)}
                          rows={4}
                          className="text-sm border-black/20 rounded-none resize-none"
                        />
                      ) : (
                        <Input
                          id={`field-${f.key}`}
                          data-testid={`input-${slugify(f.key)}`}
                          type={f.type === "time" ? "time" : NUMERIC_TYPES.includes(f.type) ? "number" : "text"}
                          step={f.type === "percent" ? "0.01" : "any"}
                          value={(form[f.key] as string) ?? ""}
                          onChange={(e) => update(f.key, e.target.value)}
                          className="h-9 text-sm border-black/20 rounded-none"
                        />
                      )}
                      {f.help && <p className="text-[11px] text-black/45">{f.help}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-end">
              <Button
                data-testid="button-save-business-rules"
                onClick={handleSave}
                disabled={save.isPending}
                className="h-10 px-5 text-sm bg-[#0A0A0A] hover:bg-black text-white rounded-none gap-2"
              >
                {save.isPending
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> Save Changes</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
