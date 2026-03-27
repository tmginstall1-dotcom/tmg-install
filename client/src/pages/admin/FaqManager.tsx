import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  HelpCircle, MessageSquare, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Search, Tag,
  Brain, Zap, AlertTriangle, CheckCircle,
} from "lucide-react";

type FaqEntry = {
  id: number;
  question: string;
  answer: string;
  category: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type CannedReply = {
  id: number;
  shortcut: string;
  title: string;
  body: string;
  active: boolean;
  createdAt: string;
};

const FAQ_CATEGORIES = [
  { value: "general",  label: "General" },
  { value: "services", label: "Services" },
  { value: "pricing",  label: "Pricing" },
  { value: "booking",  label: "Booking" },
  { value: "hours",    label: "Hours & Coverage" },
  { value: "policies", label: "Policies" },
];

const CATEGORY_COLORS: Record<string, string> = {
  general:  "bg-zinc-100 text-zinc-700",
  services: "bg-blue-50 text-blue-700",
  pricing:  "bg-emerald-50 text-emerald-700",
  booking:  "bg-violet-50 text-violet-700",
  hours:    "bg-amber-50 text-amber-700",
  policies: "bg-rose-50 text-rose-700",
};

// ── Modals ───────────────────────────────────────────────────────────────────

function FaqModal({
  entry,
  onClose,
  onSave,
  saving,
}: {
  entry: Partial<FaqEntry> | null;
  onClose: () => void;
  onSave: (data: Partial<FaqEntry>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<FaqEntry>>({
    question: entry?.question ?? "",
    answer: entry?.answer ?? "",
    category: entry?.category ?? "general",
    active: entry?.active !== false,
    sortOrder: entry?.sortOrder ?? 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-slate-900">{entry?.id ? "Edit FAQ" : "Add FAQ"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">Question</Label>
            <Input
              data-testid="input-faq-question"
              value={form.question}
              onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
              placeholder="e.g. How much do you charge?"
              className="h-9 text-sm border-zinc-300"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">Answer</Label>
            <Textarea
              data-testid="input-faq-answer"
              value={form.answer}
              onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
              rows={5}
              placeholder="The answer the bot will use when this question is matched..."
              className="text-sm border-zinc-300 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">Category</Label>
              <select
                data-testid="select-faq-category"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full h-9 px-3 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                {FAQ_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">Sort Order</Label>
              <Input
                data-testid="input-faq-sort"
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                className="h-9 text-sm border-zinc-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="toggle-faq-active"
              type="button"
              onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className="flex items-center gap-2 text-sm text-zinc-700"
            >
              {form.active
                ? <ToggleRight className="w-5 h-5 text-blue-600" />
                : <ToggleLeft className="w-5 h-5 text-zinc-400" />}
              {form.active ? "Active — visible to bot" : "Inactive — hidden from bot"}
            </button>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-sm">
            Cancel
          </Button>
          <Button
            data-testid="button-save-faq"
            size="sm"
            disabled={saving || !form.question?.trim() || !form.answer?.trim()}
            onClick={() => onSave(form)}
            className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? "Saving..." : "Save FAQ"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CannedModal({
  reply,
  onClose,
  onSave,
  saving,
}: {
  reply: Partial<CannedReply> | null;
  onClose: () => void;
  onSave: (data: Partial<CannedReply>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<CannedReply>>({
    shortcut: reply?.shortcut ?? "/",
    title: reply?.title ?? "",
    body: reply?.body ?? "",
    active: reply?.active !== false,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-slate-900">{reply?.id ? "Edit Canned Reply" : "Add Canned Reply"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">Shortcut</Label>
              <Input
                data-testid="input-canned-shortcut"
                value={form.shortcut}
                onChange={e => {
                  let v = e.target.value;
                  if (!v.startsWith("/")) v = "/" + v;
                  setForm(f => ({ ...f, shortcut: v }));
                }}
                placeholder="/quote"
                className="h-9 text-sm border-zinc-300 font-mono"
              />
              <p className="text-[11px] text-zinc-400 mt-1">Must start with /</p>
            </div>
            <div>
              <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">Title</Label>
              <Input
                data-testid="input-canned-title"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Start Quote"
                className="h-9 text-sm border-zinc-300"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">Message Body</Label>
            <Textarea
              data-testid="input-canned-body"
              value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={6}
              placeholder="The message text to send..."
              className="text-sm border-zinc-300 resize-none font-mono"
            />
            <p className="text-[11px] text-zinc-400 mt-1">Use \n for new lines. Plain text only.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="toggle-canned-active"
              type="button"
              onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className="flex items-center gap-2 text-sm text-zinc-700"
            >
              {form.active
                ? <ToggleRight className="w-5 h-5 text-blue-600" />
                : <ToggleLeft className="w-5 h-5 text-zinc-400" />}
              {form.active ? "Active" : "Inactive"}
            </button>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-sm">
            Cancel
          </Button>
          <Button
            data-testid="button-save-canned"
            size="sm"
            disabled={saving || !form.shortcut?.trim() || !form.title?.trim() || !form.body?.trim()}
            onClick={() => onSave(form)}
            className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? "Saving..." : "Save Reply"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── FAQ Tab ──────────────────────────────────────────────────────────────────

function FaqTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [editEntry, setEditEntry] = useState<Partial<FaqEntry> | null | false>(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: entries = [], isLoading } = useQuery<FaqEntry[]>({
    queryKey: ["/api/admin/faq"],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<FaqEntry>) => apiRequest("POST", "/api/admin/faq", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/faq"] });
      setEditEntry(false);
      toast({ title: "FAQ added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FaqEntry> }) =>
      apiRequest("PATCH", `/api/admin/faq/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/faq"] });
      setEditEntry(false);
      toast({ title: "FAQ updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/faq/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/faq"] });
      toast({ title: "FAQ deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActive = (entry: FaqEntry) =>
    updateMutation.mutate({ id: entry.id, data: { active: !entry.active } });

  const filtered = entries.filter(e => {
    const matchCat = filterCat === "all" || e.category === filterCat;
    const matchSearch = !search || e.question.toLowerCase().includes(search.toLowerCase()) || e.answer.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSave = (data: Partial<FaqEntry>) => {
    if ((editEntry as FaqEntry)?.id) {
      updateMutation.mutate({ id: (editEntry as FaqEntry).id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const activeFaqs = entries.filter(e => e.active).length;

  return (
    <>
      {editEntry !== false && (
        <FaqModal
          entry={editEntry}
          onClose={() => setEditEntry(false)}
          onSave={handleSave}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">FAQ Entries</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{activeFaqs} active · {entries.length} total</p>
          </div>
          <Button
            data-testid="button-add-faq"
            size="sm"
            onClick={() => setEditEntry({})}
            className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add FAQ
          </Button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <Input
              data-testid="input-faq-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="h-9 pl-9 text-sm border-zinc-300"
            />
          </div>
          <select
            data-testid="select-faq-filter-category"
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="h-9 px-3 border border-zinc-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            <option value="all">All categories</option>
            {FAQ_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <HelpCircle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No FAQ entries found</p>
            <p className="text-xs text-zinc-400 mt-1">
              {search || filterCat !== "all" ? "Try clearing your filters" : "Add your first FAQ entry above"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map(entry => (
              <div key={entry.id} data-testid={`faq-row-${entry.id}`} className={`px-5 py-3.5 hover:bg-zinc-50 transition-colors ${!entry.active ? "opacity-50" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <button
                      className="text-left w-full"
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900">{entry.question}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${CATEGORY_COLORS[entry.category] || "bg-zinc-100 text-zinc-700"}`}>
                          {FAQ_CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}
                        </span>
                        {!entry.active && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500">Inactive</span>
                        )}
                      </div>
                      {expandedId === entry.id ? (
                        <p className="text-sm text-zinc-600 mt-2 whitespace-pre-wrap leading-relaxed">{entry.answer}</p>
                      ) : (
                        <p className="text-xs text-zinc-400 mt-0.5 truncate">{entry.answer}</p>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      data-testid={`toggle-active-faq-${entry.id}`}
                      onClick={() => toggleActive(entry)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                      title={entry.active ? "Deactivate" : "Activate"}
                    >
                      {entry.active ? <ToggleRight className="w-4 h-4 text-blue-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      data-testid={`edit-faq-${entry.id}`}
                      onClick={() => setEditEntry(entry)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      data-testid={`delete-faq-${entry.id}`}
                      onClick={() => {
                        if (confirm("Delete this FAQ entry?")) deleteMutation.mutate(entry.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      {expandedId === entry.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Canned Replies Tab ───────────────────────────────────────────────────────

function CannedRepliesTab() {
  const { toast } = useToast();
  const [editReply, setEditReply] = useState<Partial<CannedReply> | null | false>(false);

  const { data: replies = [], isLoading } = useQuery<CannedReply[]>({
    queryKey: ["/api/admin/canned-replies"],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<CannedReply>) => apiRequest("POST", "/api/admin/canned-replies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canned-replies"] });
      setEditReply(false);
      toast({ title: "Canned reply added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CannedReply> }) =>
      apiRequest("PATCH", `/api/admin/canned-replies/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canned-replies"] });
      setEditReply(false);
      toast({ title: "Reply updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/canned-replies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/canned-replies"] });
      toast({ title: "Reply deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActive = (reply: CannedReply) =>
    updateMutation.mutate({ id: reply.id, data: { active: !reply.active } });

  const handleSave = (data: Partial<CannedReply>) => {
    if ((editReply as CannedReply)?.id) {
      updateMutation.mutate({ id: (editReply as CannedReply).id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <>
      {editReply !== false && (
        <CannedModal
          reply={editReply}
          onClose={() => setEditReply(false)}
          onSave={handleSave}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Canned Replies</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Quick reply templates for manual admin responses</p>
          </div>
          <Button
            data-testid="button-add-canned"
            size="sm"
            onClick={() => setEditReply({})}
            className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Reply
          </Button>
        </div>

        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">Loading...</div>
        ) : replies.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <MessageSquare className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No canned replies yet</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {replies.map(reply => (
              <div key={reply.id} data-testid={`canned-row-${reply.id}`} className={`px-5 py-3.5 hover:bg-zinc-50 transition-colors ${!reply.active ? "opacity-50" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <code className="text-xs font-mono bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded-md">{reply.shortcut}</code>
                      <span className="text-sm font-medium text-slate-900">{reply.title}</span>
                      {!reply.active && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 whitespace-pre-wrap line-clamp-2">{reply.body}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      data-testid={`toggle-active-canned-${reply.id}`}
                      onClick={() => toggleActive(reply)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      {reply.active ? <ToggleRight className="w-4 h-4 text-blue-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      data-testid={`edit-canned-${reply.id}`}
                      onClick={() => setEditReply(reply)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      data-testid={`delete-canned-${reply.id}`}
                      onClick={() => {
                        if (confirm("Delete this canned reply?")) deleteMutation.mutate(reply.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
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
    </>
  );
}

// ── Bot Training Tab ─────────────────────────────────────────────────────────

type PricingCorrection = {
  id: number;
  detectedDescription: string;
  correctedName: string;
  catalogItemName: string | null;
  notes: string | null;
  active: boolean;
  autoLearned: boolean;
  createdAt: string;
};

function CorrectionModal({
  correction,
  onClose,
  onSave,
  saving,
}: {
  correction: Partial<PricingCorrection> | null;
  onClose: () => void;
  onSave: (data: Partial<PricingCorrection>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<PricingCorrection>>({
    detectedDescription: correction?.detectedDescription ?? "",
    correctedName: correction?.correctedName ?? "",
    catalogItemName: correction?.catalogItemName ?? "",
    notes: correction?.notes ?? "",
    active: correction?.active !== false,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-600" />
            {correction?.id ? "Edit Correction" : "Teach the Bot"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="bg-violet-50 border border-violet-100 rounded-lg px-4 py-3 text-xs text-violet-800">
            <strong>How this works:</strong> When the bot detects an item matching the phrase below, it will look up the corrected catalog item for pricing instead of guessing.
          </div>
          <div>
            <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">
              What the customer / AI says <span className="text-red-500">*</span>
            </Label>
            <Input
              data-testid="input-correction-detected"
              value={form.detectedDescription}
              onChange={e => setForm(f => ({ ...f, detectedDescription: e.target.value }))}
              placeholder='e.g. "Framery O", "privacy pod", "acoustic cabin"'
              className="h-9 text-sm border-zinc-300"
            />
            <p className="text-[11px] text-zinc-400 mt-1">The phrase or item name that gets misidentified</p>
          </div>
          <div>
            <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">
              Correct item name (shown to customer) <span className="text-red-500">*</span>
            </Label>
            <Input
              data-testid="input-correction-corrected"
              value={form.correctedName}
              onChange={e => setForm(f => ({ ...f, correctedName: e.target.value }))}
              placeholder='e.g. "Solo Phone Booth (1-Person)"'
              className="h-9 text-sm border-zinc-300"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">
              Catalog item to use for pricing
            </Label>
            <Input
              data-testid="input-correction-catalog"
              value={form.catalogItemName ?? ""}
              onChange={e => setForm(f => ({ ...f, catalogItemName: e.target.value }))}
              placeholder='Must match exactly, e.g. "Solo Phone Booth (1-Person)"'
              className="h-9 text-sm border-zinc-300 font-mono text-xs"
            />
            <p className="text-[11px] text-zinc-400 mt-1">Leave blank to use corrected name as the lookup key</p>
          </div>
          <div>
            <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">Admin notes (optional)</Label>
            <Input
              data-testid="input-correction-notes"
              value={form.notes ?? ""}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Framery O is a 1-person acoustic phone booth brand"
              className="h-9 text-sm border-zinc-300"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="toggle-correction-active"
              type="button"
              onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className="flex items-center gap-2 text-sm text-zinc-700"
            >
              {form.active
                ? <ToggleRight className="w-5 h-5 text-violet-600" />
                : <ToggleLeft className="w-5 h-5 text-zinc-400" />}
              {form.active ? "Active — bot uses this correction" : "Inactive — bot ignores this"}
            </button>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-sm">Cancel</Button>
          <Button
            data-testid="button-save-correction"
            size="sm"
            disabled={saving || !form.detectedDescription?.trim() || !form.correctedName?.trim()}
            onClick={() => onSave(form)}
            className="h-9 px-4 text-sm bg-violet-600 hover:bg-violet-700 text-white"
          >
            {saving ? "Saving..." : "Save Correction"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BotTrainingTab() {
  const { toast } = useToast();
  const [editCorrection, setEditCorrection] = useState<Partial<PricingCorrection> | null | false>(false);

  const { data: corrections = [], isLoading } = useQuery<PricingCorrection[]>({
    queryKey: ["/api/admin/pricing-corrections"],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<PricingCorrection>) => apiRequest("POST", "/api/admin/pricing-corrections", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing-corrections"] });
      setEditCorrection(false);
      toast({ title: "Correction saved — bot will use this immediately" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PricingCorrection> }) =>
      apiRequest("PATCH", `/api/admin/pricing-corrections/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing-corrections"] });
      setEditCorrection(false);
      toast({ title: "Correction updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/pricing-corrections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing-corrections"] });
      toast({ title: "Correction deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActive = (c: PricingCorrection) =>
    updateMutation.mutate({ id: c.id, data: { active: !c.active } });

  const handleSave = (data: Partial<PricingCorrection>) => {
    if ((editCorrection as PricingCorrection)?.id) {
      updateMutation.mutate({ id: (editCorrection as PricingCorrection).id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const [filter, setFilter] = useState<"all" | "manual" | "auto">("all");

  const activeCount = corrections.filter(c => c.active).length;
  const autoCount = corrections.filter(c => c.autoLearned).length;
  const manualCount = corrections.length - autoCount;

  const filtered = corrections.filter(c => {
    if (filter === "auto") return c.autoLearned;
    if (filter === "manual") return !c.autoLearned;
    return true;
  });

  return (
    <>
      {editCorrection !== false && (
        <CorrectionModal
          correction={editCorrection}
          onClose={() => setEditCorrection(false)}
          onSave={handleSave}
          saving={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
          <p className="text-xs text-zinc-500">Total Rules</p>
          <p className="text-2xl font-bold text-slate-900 mt-0.5">{corrections.length}</p>
          <p className="text-[11px] text-zinc-400">{activeCount} active</p>
        </div>
        <div className="bg-white border border-violet-100 rounded-xl px-4 py-3">
          <p className="text-xs text-violet-600 flex items-center gap-1"><Brain className="w-3 h-3" /> Auto-Learned</p>
          <p className="text-2xl font-bold text-violet-700 mt-0.5">{autoCount}</p>
          <p className="text-[11px] text-zinc-400">discovered from live chats</p>
        </div>
        <div className="bg-white border border-blue-100 rounded-xl px-4 py-3">
          <p className="text-xs text-blue-600">Manually Added</p>
          <p className="text-2xl font-bold text-blue-700 mt-0.5">{manualCount}</p>
          <p className="text-[11px] text-zinc-400">added by admin</p>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {(["all", "manual", "auto"] as const).map(f => (
              <button
                key={f}
                data-testid={`filter-corrections-${f}`}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? "bg-violet-100 text-violet-700"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {f === "all" ? "All" : f === "manual" ? "Manual" : "Auto-Learned"}
              </button>
            ))}
          </div>
          <Button
            data-testid="button-add-correction"
            size="sm"
            onClick={() => setEditCorrection({})}
            className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Teach Bot Manually
          </Button>
        </div>

        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Brain className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">
              {filter === "auto" ? "No auto-learned rules yet" : filter === "manual" ? "No manual rules" : "No corrections yet"}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {filter === "auto"
                ? "Rules appear here automatically as customers chat with the bot"
                : "Add a correction to teach the bot how to price specific items"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {filtered.map(c => (
              <div
                key={c.id}
                data-testid={`correction-row-${c.id}`}
                className={`px-5 py-3.5 hover:bg-zinc-50 transition-colors ${!c.active ? "opacity-50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {c.autoLearned && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700">
                          <Brain className="w-2.5 h-2.5" /> Auto
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs font-mono bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" />
                        {c.detectedDescription}
                      </span>
                      <Zap className="w-3 h-3 text-violet-400 shrink-0" />
                      <span className="inline-flex items-center gap-1 text-xs font-mono bg-violet-50 text-violet-800 border border-violet-200 px-1.5 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3" />
                        {c.correctedName}
                      </span>
                      {!c.active && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500">Inactive</span>}
                    </div>
                    {c.catalogItemName && (
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Catalog: <code className="bg-zinc-100 px-1 rounded text-[10px]">{c.catalogItemName}</code>
                      </p>
                    )}
                    {c.notes && (
                      <p className="text-xs text-zinc-500 mt-0.5 italic">{c.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      data-testid={`toggle-active-correction-${c.id}`}
                      onClick={() => toggleActive(c)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                      title={c.active ? "Deactivate" : "Activate"}
                    >
                      {c.active ? <ToggleRight className="w-4 h-4 text-violet-500" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      data-testid={`edit-correction-${c.id}`}
                      onClick={() => setEditCorrection(c)}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      data-testid={`delete-correction-${c.id}`}
                      onClick={() => {
                        if (confirm("Delete this correction?")) deleteMutation.mutate(c.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors"
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
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function FaqManager() {
  const [tab, setTab] = useState<"faq" | "canned" | "training">("faq");

  return (
    <div className="min-h-screen pt-14 pb-16 lg:pl-56 bg-[#F5F5F7]">
      {/* Page header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <p className="text-xs text-zinc-400 mb-1">Chatbot</p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">FAQ Manager</h1>
              <p className="text-sm text-zinc-500 mt-0.5">Manage knowledge used by the WhatsApp bot to answer customer questions</p>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 border-b border-zinc-200 -mb-5">
            <button
              data-testid="tab-faq"
              onClick={() => setTab("faq")}
              className={`pb-4 px-1 text-sm font-medium border-b-2 transition-colors ${
                tab === "faq"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              FAQ Entries
            </button>
            <button
              data-testid="tab-canned"
              onClick={() => setTab("canned")}
              className={`pb-4 px-1 ml-6 text-sm font-medium border-b-2 transition-colors ${
                tab === "canned"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              Canned Replies
            </button>
            <button
              data-testid="tab-training"
              onClick={() => setTab("training")}
              className={`pb-4 px-1 ml-6 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                tab === "training"
                  ? "border-violet-600 text-violet-600"
                  : "border-transparent text-zinc-500 hover:text-zinc-700"
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              Bot Training
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Info banner */}
        <div className={`border rounded-xl px-5 py-4 flex items-start gap-3 ${
          tab === "training"
            ? "bg-violet-50 border-violet-100"
            : "bg-blue-50 border-blue-100"
        }`}>
          {tab === "training"
            ? <Brain className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
            : <HelpCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />}
          <div>
            <p className={`text-sm font-medium ${tab === "training" ? "text-violet-900" : "text-blue-900"}`}>
              {tab === "faq" ? "How FAQ entries work" : tab === "canned" ? "How canned replies work" : "How Bot Training works"}
            </p>
            <p className={`text-xs mt-0.5 ${tab === "training" ? "text-violet-700" : "text-blue-700"}`}>
              {tab === "faq"
                ? "Active FAQ entries are loaded into the WhatsApp bot's knowledge base at runtime. When a customer asks a question, the bot searches these entries first before generating a response. Inactive entries are ignored."
                : tab === "canned"
                ? "Canned replies are quick-response templates for admin use in manual conversations. Type the shortcut in the message box to insert the template."
                : "Teach the bot to correctly identify items it misidentifies. For example, if a customer sends a photo of a Framery pod but the bot calls it 'installation', add a correction: Framery → Solo Phone Booth (1-Person). Active corrections are consulted on every pricing lookup."}
            </p>
          </div>
        </div>

        {tab === "faq" ? <FaqTab /> : tab === "canned" ? <CannedRepliesTab /> : <BotTrainingTab />}
      </div>
    </div>
  );
}
