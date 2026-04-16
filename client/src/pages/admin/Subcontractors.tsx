import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, User, Phone, Mail, Building2, ChevronRight, Trash2,
  Pencil, DollarSign, TrendingUp, TrendingDown, AlertCircle, CheckCircle2,
  ArrowLeft, Briefcase, X, Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

type Subcontractor = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  notes: string | null;
  createdAt: string;
};

type SubJob = {
  id: number;
  quoteId: number;
  quoteRef: string;
  customerName: string | null;
  agreedCost: string;
  paymentStatus: string;
  paidAt: string | null;
  notes: string | null;
  scheduledAt: string | null;
  quoteTotal: string | null;
  createdAt: string;
};

type Summary = {
  totalRevenue: number;
  totalSubCosts: number;
  netProfit: number;
  totalUnpaid: number;
  payables: {
    subcontractorId: number;
    name: string;
    company: string | null;
    unpaidCount: number;
    unpaidTotal: number;
  }[];
};

function fmt(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

const EMPTY_FORM = { name: "", phone: "", email: "", company: "", notes: "" };

export default function Subcontractors() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedSub, setSelectedSub] = useState<Subcontractor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcontractor | null>(null);
  const [deletingSub, setDeletingSub] = useState<Subcontractor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: subs = [], isLoading } = useQuery<Subcontractor[]>({
    queryKey: ["/api/admin/subcontractors"],
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ["/api/admin/subcontracts/summary"],
  });

  const { data: jobs = [], isLoading: loadingJobs } = useQuery<SubJob[]>({
    queryKey: ["/api/admin/subcontractors", selectedSub?.id, "jobs"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/subcontractors/${selectedSub!.id}/jobs`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedSub,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) => apiRequest("POST", "/api/admin/subcontractors", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/subcontractors"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/subcontracts/summary"] });
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast({ title: "Subcontractor added" });
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof EMPTY_FORM }) =>
      apiRequest("PATCH", `/api/admin/subcontractors/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/subcontractors"] });
      setEditingSub(null);
      setForm(EMPTY_FORM);
      toast({ title: "Updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/subcontractors/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/subcontractors"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/subcontracts/summary"] });
      if (selectedSub?.id === deletingSub?.id) setSelectedSub(null);
      setDeletingSub(null);
      toast({ title: "Deleted" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, paid }: { id: number; paid: boolean }) =>
      apiRequest("PATCH", `/api/admin/subcontracts/${id}`, { paymentStatus: paid ? "paid" : "unpaid" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/subcontractors", selectedSub?.id, "jobs"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/subcontracts/summary"] });
      toast({ title: "Payment status updated" });
    },
  });

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditingSub(null);
    setShowForm(true);
  }

  function openEdit(sub: Subcontractor) {
    setForm({ name: sub.name, phone: sub.phone || "", email: sub.email || "", company: sub.company || "", notes: sub.notes || "" });
    setEditingSub(sub);
    setShowForm(true);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editingSub) {
      updateMutation.mutate({ id: editingSub.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F7] lg:pl-56">
      <div className="max-w-5xl mx-auto w-full px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">Subcontractors</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Manage subs, track costs and profit</p>
          </div>
          <Button onClick={openAdd} size="sm" className="gap-1.5" data-testid="add-sub-btn">
            <Plus className="w-4 h-4" /> Add Sub
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="Total Revenue"
            value={fmt(summary?.totalRevenue ?? 0)}
            icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
            color="text-emerald-700"
            bg="bg-emerald-50"
          />
          <SummaryCard
            label="Sub Costs"
            value={fmt(summary?.totalSubCosts ?? 0)}
            icon={<TrendingDown className="w-4 h-4 text-orange-600" />}
            color="text-orange-700"
            bg="bg-orange-50"
          />
          <SummaryCard
            label="Net Profit"
            value={fmt(summary?.netProfit ?? 0)}
            icon={<TrendingUp className="w-4 h-4 text-blue-600" />}
            color="text-blue-700"
            bg="bg-blue-50"
          />
          <SummaryCard
            label="Owed to Subs"
            value={fmt(summary?.totalUnpaid ?? 0)}
            icon={<AlertCircle className="w-4 h-4 text-red-500" />}
            color={(summary?.totalUnpaid ?? 0) > 0 ? "text-red-700" : "text-zinc-500"}
            bg={(summary?.totalUnpaid ?? 0) > 0 ? "bg-red-50" : "bg-zinc-50"}
          />
        </div>

        {/* Payables Alert */}
        {(summary?.payables ?? []).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> Outstanding Payments
            </p>
            <div className="space-y-1.5">
              {summary!.payables.map(p => (
                <div key={p.subcontractorId} className="flex items-center justify-between text-sm">
                  <span className="text-red-700 font-medium">
                    {p.name}{p.company ? ` (${p.company})` : ""}
                  </span>
                  <span className="text-red-800 font-bold">
                    {fmt(p.unpaidTotal)} · {p.unpaidCount} job{p.unpaidCount !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          {/* Subcontractor List */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-800">Subcontractors</span>
              <span className="text-xs text-zinc-400">{subs.length} total</span>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
              </div>
            ) : subs.length === 0 ? (
              <div className="flex flex-col items-center py-12 px-4 text-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-zinc-300" />
                </div>
                <p className="text-sm text-zinc-400">No subcontractors yet</p>
                <Button size="sm" variant="outline" onClick={openAdd} className="mt-1">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add first sub
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-50">
                {subs.map(sub => {
                  const payable = summary?.payables.find(p => p.subcontractorId === sub.id);
                  return (
                    <button
                      key={sub.id}
                      data-testid={`sub-row-${sub.id}`}
                      onClick={() => setSelectedSub(sub.id === selectedSub?.id ? null : sub)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        selectedSub?.id === sub.id ? "bg-blue-50" : "hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-700 font-bold text-sm">
                            {sub.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-800 truncate">{sub.name}</p>
                          {sub.company && (
                            <p className="text-xs text-zinc-400 truncate">{sub.company}</p>
                          )}
                          {payable && (
                            <p className="text-xs font-semibold text-red-600 mt-0.5">
                              Owes: {fmt(payable.unpaidTotal)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(sub); }}
                            className="w-7 h-7 rounded-lg hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeletingSub(sub); }}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-zinc-400 hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className={`w-4 h-4 text-zinc-300 transition-transform ${selectedSub?.id === sub.id ? "rotate-90" : ""}`} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Job History Panel */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
            {!selectedSub ? (
              <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-zinc-300" />
                </div>
                <p className="text-sm text-zinc-400">Select a subcontractor to view their jobs</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{selectedSub.name}</p>
                    <p className="text-xs text-zinc-400">
                      {selectedSub.company && `${selectedSub.company} · `}
                      {selectedSub.phone && `${selectedSub.phone}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedSub(null)}
                    className="w-7 h-7 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {loadingJobs ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center gap-2">
                    <p className="text-sm text-zinc-400">No jobs assigned yet</p>
                    <p className="text-xs text-zinc-300">Assign this sub to a job from the Quote Detail page</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-50">
                    {/* Totals row */}
                    <div className="px-4 py-2.5 bg-zinc-50 flex items-center justify-between text-xs text-zinc-500">
                      <span>{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
                      <span>
                        Total cost: <strong className="text-zinc-800">{fmt(jobs.reduce((s, j) => s + Number(j.agreedCost), 0))}</strong>
                        {" · "}
                        Unpaid: <strong className="text-red-600">{fmt(jobs.filter(j => j.paymentStatus === "unpaid").reduce((s, j) => s + Number(j.agreedCost), 0))}</strong>
                      </span>
                    </div>
                    {jobs.map(job => (
                      <div key={job.id} className="px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => setLocation(`/admin/quotes/${job.quoteId}`)}
                              className="text-sm font-semibold text-blue-600 hover:underline"
                              data-testid={`job-link-${job.id}`}
                            >
                              {job.quoteRef}
                            </button>
                            <Badge
                              variant="outline"
                              className={job.paymentStatus === "paid"
                                ? "text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px]"
                                : "text-red-700 bg-red-50 border-red-200 text-[10px]"}
                            >
                              {job.paymentStatus === "paid" ? "✓ Paid" : "Unpaid"}
                            </Badge>
                          </div>
                          {job.customerName && (
                            <p className="text-xs text-zinc-500 mt-0.5">{job.customerName}</p>
                          )}
                          {job.scheduledAt && (
                            <p className="text-xs text-zinc-400">
                              {format(new Date(job.scheduledAt), "EEE d MMM yyyy")}
                            </p>
                          )}
                          {job.notes && (
                            <p className="text-xs text-zinc-400 italic mt-0.5">"{job.notes}"</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className="text-sm font-bold text-zinc-800">{fmt(Number(job.agreedCost))}</span>
                          {job.quoteTotal && (
                            <span className="text-[10px] text-zinc-400">
                              Job: {fmt(Number(job.quoteTotal))}
                            </span>
                          )}
                          <button
                            onClick={() => markPaidMutation.mutate({ id: job.id, paid: job.paymentStatus !== "paid" })}
                            disabled={markPaidMutation.isPending}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                              job.paymentStatus === "paid"
                                ? "bg-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            }`}
                            data-testid={`mark-paid-${job.id}`}
                          >
                            {job.paymentStatus === "paid" ? "Mark Unpaid" : "Mark Paid"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditingSub(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSub ? "Edit Subcontractor" : "Add Subcontractor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Name *</label>
              <Input
                placeholder="Full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                data-testid="input-sub-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">Phone</label>
                <Input
                  placeholder="e.g. 91234567"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  data-testid="input-sub-phone"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 mb-1 block">Email</label>
                <Input
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  data-testid="input-sub-email"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Company</label>
              <Input
                placeholder="Company or trading name"
                value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                data-testid="input-sub-company"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Notes</label>
              <Textarea
                placeholder="Any notes about this subcontractor..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                data-testid="input-sub-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingSub(null); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || isBusy} data-testid="save-sub-btn">
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingSub ? "Save Changes" : "Add Subcontractor")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingSub} onOpenChange={open => { if (!open) setDeletingSub(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deletingSub?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the subcontractor and all their job records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingSub && deleteMutation.mutate(deletingSub.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ label, value, icon, color, bg }: {
  label: string; value: string; icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div className={`${bg} rounded-2xl p-4 border border-white/60 shadow-sm`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-zinc-500 font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
