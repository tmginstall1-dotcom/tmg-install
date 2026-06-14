import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, MessageSquareText, Plus, Pencil, Trash2, X, ToggleLeft, ToggleRight, Copy,
} from "lucide-react";
import type { QuickReplyTemplate } from "@shared/schema";
import { renderQuickReply, type BusinessRules } from "@shared/businessRules";

function TemplateModal({
  template,
  onClose,
  onSave,
  saving,
}: {
  template: Partial<QuickReplyTemplate> | null;
  onClose: () => void;
  onSave: (data: Partial<QuickReplyTemplate>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<QuickReplyTemplate>>({
    slug: template?.slug ?? "",
    title: template?.title ?? "",
    category: template?.category ?? "general",
    body: template?.body ?? "",
    active: template?.active !== false,
    sortOrder: template?.sortOrder ?? 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-none border border-black/12 w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/8">
          <h2 className="text-base font-semibold text-[#0A0A0A]">
            {template?.id ? "Edit Template" : "Add Template"}
          </h2>
          <button data-testid="button-close-template-modal" onClick={onClose} className="text-black/45 hover:text-black/65">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-black/55 uppercase tracking-[0.12em] font-bold mb-1.5 block">Slug</Label>
              <Input
                data-testid="input-template-slug"
                value={form.slug ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="deposit-required"
                className="h-9 text-sm border-black/20 rounded-none font-mono"
              />
            </div>
            <div>
              <Label className="text-[11px] text-black/55 uppercase tracking-[0.12em] font-bold mb-1.5 block">Category</Label>
              <Input
                data-testid="input-template-category"
                value={form.category ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="general"
                className="h-9 text-sm border-black/20 rounded-none"
              />
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-black/55 uppercase tracking-[0.12em] font-bold mb-1.5 block">Title</Label>
            <Input
              data-testid="input-template-title"
              value={form.title ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Deposit required"
              className="h-9 text-sm border-black/20 rounded-none"
            />
          </div>
          <div>
            <Label className="text-[11px] text-black/55 uppercase tracking-[0.12em] font-bold mb-1.5 block">Body</Label>
            <Textarea
              data-testid="input-template-body"
              value={form.body ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              rows={6}
              placeholder="The reusable message. {{placeholders}} are filled from Business Rules."
              className="text-sm border-black/20 rounded-none resize-none"
            />
            <p className="text-[11px] text-black/45 mt-1">Use {"{{placeholders}}"} to inject live business-rule values.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label className="text-[11px] text-black/55 uppercase tracking-[0.12em] font-bold mb-1.5 block">Sort Order</Label>
              <Input
                data-testid="input-template-sort"
                type="number"
                value={form.sortOrder ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                className="h-9 text-sm border-black/20 rounded-none"
              />
            </div>
            <button
              data-testid="toggle-template-active"
              type="button"
              onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
              className="flex items-center gap-2 text-sm text-black/70 h-9"
            >
              {form.active
                ? <ToggleRight className="w-6 h-6 text-[#0A0A0A]" />
                : <ToggleLeft className="w-6 h-6 text-black/35" />}
              {form.active ? "Active" : "Inactive"}
            </button>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-black/8 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-sm rounded-none">
            Cancel
          </Button>
          <Button
            data-testid="button-save-template"
            size="sm"
            disabled={saving || !form.slug?.trim() || !form.title?.trim() || !form.body?.trim()}
            onClick={() => onSave(form)}
            className="h-9 px-4 text-sm bg-[#0A0A0A] hover:bg-black text-white rounded-none"
          >
            {saving ? "Saving…" : "Save Template"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminQuickReplies() {
  const { toast } = useToast();
  const [editTemplate, setEditTemplate] = useState<Partial<QuickReplyTemplate> | null | false>(false);

  const { data: templates = [], isLoading } = useQuery<QuickReplyTemplate[]>({
    queryKey: ["/api/admin/quick-replies"],
  });

  // Live business-rule values used to fill {{placeholders}} when copying.
  const { data: rules } = useQuery<BusinessRules>({
    queryKey: ["/api/business-rules"],
  });

  const copyTemplate = async (t: QuickReplyTemplate) => {
    const text = rules ? renderQuickReply(t.body, rules) : t.body;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Message copied with live values filled in." });
    } catch {
      toast({ title: "Copy failed", description: text, variant: "destructive" });
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: Partial<QuickReplyTemplate>) => apiRequest("POST", "/api/admin/quick-replies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quick-replies"] });
      setEditTemplate(false);
      toast({ title: "Template added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<QuickReplyTemplate> }) =>
      apiRequest("PATCH", `/api/admin/quick-replies/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quick-replies"] });
      setEditTemplate(false);
      toast({ title: "Template updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/quick-replies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/quick-replies"] });
      toast({ title: "Template deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message, variant: "destructive" }),
  });

  const toggleActive = (t: QuickReplyTemplate) =>
    updateMutation.mutate({ id: t.id, data: { active: !t.active } });

  const handleSave = (data: Partial<QuickReplyTemplate>) => {
    const existing = editTemplate as QuickReplyTemplate;
    if (existing?.id) {
      updateMutation.mutate({ id: existing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const activeCount = templates.filter((t) => t.active).length;

  return (
    <div className="min-h-screen bg-[#F5F4F0] pt-14 lg:pl-56 pb-[calc(64px+env(safe-area-inset-bottom)+2rem)] lg:pb-12">
      {editTemplate !== false && (
        <TemplateModal
          template={editTemplate}
          onClose={() => setEditTemplate(false)}
          onSave={handleSave}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <div className="bg-white border-b border-black/12 px-6 py-5 mb-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/admin/settings" data-testid="link-back-settings" className="inline-flex items-center gap-1.5 text-xs text-black/45 hover:text-black/70 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Settings
          </Link>
          <h1 className="text-xl font-semibold text-[#0A0A0A] tracking-tight flex items-center gap-2">
            <MessageSquareText className="w-5 h-5" /> Quick-reply Templates
          </h1>
          <p className="text-sm text-black/55 mt-1">
            Reusable message snippets for deposits, cancellations, after-office and other common scenarios.
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-8 space-y-6">
        <div className="bg-white border border-black/12 rounded-none overflow-hidden">
          <div className="px-5 py-4 border-b border-black/8 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-black/55">Templates</h2>
              <p className="text-xs text-black/55 mt-0.5">{activeCount} active · {templates.length} total</p>
            </div>
            <Button
              data-testid="button-add-template"
              size="sm"
              onClick={() => setEditTemplate({})}
              className="h-9 px-4 text-sm bg-[#0A0A0A] hover:bg-black text-white rounded-none gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Template
            </Button>
          </div>

          {isLoading ? (
            <div className="px-5 py-12 text-center text-sm text-black/45">Loading…</div>
          ) : templates.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <MessageSquareText className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
              <p className="text-sm text-black/55">No templates yet</p>
              <p className="text-xs text-black/45 mt-1">Add your first quick-reply template above</p>
            </div>
          ) : (
            <div className="divide-y divide-black/8">
              {templates.map((t) => (
                <div
                  key={t.id}
                  data-testid={`template-row-${t.id}`}
                  className={`px-5 py-3.5 ${!t.active ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <code className="text-xs font-mono bg-[#EBE9E2] text-black/70 px-1.5 py-0.5 rounded-none">{t.slug}</code>
                        <span className="text-sm font-medium text-[#0A0A0A]">{t.title}</span>
                        {t.category && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-none bg-[#EBE9E2] text-black/70">{t.category}</span>
                        )}
                        {!t.active && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-none bg-[#EBE9E2] text-black/55">Inactive</span>
                        )}
                      </div>
                      <p className="text-xs text-black/55 whitespace-pre-wrap line-clamp-2">{t.body}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        data-testid={`copy-template-${t.id}`}
                        onClick={() => copyTemplate(t)}
                        className="p-1.5 rounded-none hover:bg-[#EBE9E2] text-black/45 hover:text-black/65 transition-colors"
                        title="Copy message with live values"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        data-testid={`toggle-active-template-${t.id}`}
                        onClick={() => toggleActive(t)}
                        className="p-1.5 rounded-none hover:bg-[#EBE9E2] text-black/45 hover:text-black/65 transition-colors"
                        title={t.active ? "Deactivate" : "Activate"}
                      >
                        {t.active ? <ToggleRight className="w-4 h-4 text-blue-500" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        data-testid={`edit-template-${t.id}`}
                        onClick={() => setEditTemplate(t)}
                        className="p-1.5 rounded-none hover:bg-[#EBE9E2] text-black/45 hover:text-black/65 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        data-testid={`delete-template-${t.id}`}
                        onClick={() => {
                          if (confirm("Delete this template?")) deleteMutation.mutate(t.id);
                        }}
                        className="p-1.5 rounded-none hover:bg-red-50 text-black/45 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
