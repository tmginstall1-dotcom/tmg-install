import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, User, ChevronRight, Trash2, Pencil, TrendingUp, TrendingDown,
  AlertCircle, Briefcase, X, Wallet, Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import {
  PageShell, PageHeader, PageBody, Card, SectionHeader,
  EmptyState, LoadingState, Button, Pill,
} from "@/components/admin/AdminUI";

type Subcontractor = {
  id: number; name: string; phone: string | null; email: string | null;
  company: string | null; notes: string | null; createdAt: string;
};

type SubJob = {
  id: number; quoteId: number; quoteRef: string; customerName: string | null;
  agreedCost: string; paymentStatus: string; paidAt: string | null;
  notes: string | null; scheduledAt: string | null; quoteTotal: string | null; createdAt: string;
};

type Summary = {
  totalRevenue: number; totalSubCosts: number; netProfit: number; totalUnpaid: number;
  payables: {
    subcontractorId: number; name: string; company: string | null;
    unpaidCount: number; unpaidTotal: number;
  }[];
};

function fmt(n: number) {
  return `$${n.toLocaleString("en-SG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
      setShowForm(false); setForm(EMPTY_FORM);
      toast({ title: "Subcontractor added" });
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof EMPTY_FORM }) =>
      apiRequest("PATCH", `/api/admin/subcontractors/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/subcontractors"] });
      setEditingSub(null); setForm(EMPTY_FORM);
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

  function openAdd() { setForm(EMPTY_FORM); setEditingSub(null); setShowForm(true); }
  function openEdit(sub: Subcontractor) {
    setForm({ name: sub.name, phone: sub.phone || "", email: sub.email || "", company: sub.company || "", notes: sub.notes || "" });
    setEditingSub(sub); setShowForm(true);
  }
  function handleSave() {
    if (!form.name.trim()) return;
    if (editingSub) updateMutation.mutate({ id: editingSub.id, data: form });
    else createMutation.mutate(form);
  }

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <PageShell>
      <PageHeader
        eyebrow="People · Subcontractors"
        title="Subcontractors"
        subtitle="Manage external partners, agreed costs, and outstanding payables."
        actions={
          <Button variant="ink" icon={Plus} onClick={openAdd} data-testid="add-sub-btn">
            Add Sub
          </Button>
        }
        meta={
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-black/10 border border-black/12">
            <StatCell label="Revenue" value={fmt(summary?.totalRevenue ?? 0)} icon={Wallet} />
            <StatCell label="Sub Costs" value={fmt(summary?.totalSubCosts ?? 0)} icon={TrendingDown} />
            <StatCell label="Net Profit" value={fmt(summary?.netProfit ?? 0)} icon={TrendingUp} accent={(summary?.netProfit ?? 0) < 0 ? "urgent" : "ink"} />
            <StatCell label="Owed to Subs" value={fmt(summary?.totalUnpaid ?? 0)} icon={AlertCircle} accent={(summary?.totalUnpaid ?? 0) > 0 ? "urgent" : "ink"} />
          </div>
        }
      />

      <PageBody>

        {/* Payables Alert */}
        {(summary?.payables ?? []).length > 0 && (
          <Card className="border-[#C1121F]">
            <div className="flex items-center gap-3 px-4 sm:px-5 h-12 border-b border-[#C1121F]/30 bg-[#FBEBEB]">
              <AlertCircle className="w-3.5 h-3.5 text-[#C1121F]" />
              <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C1121F]">Outstanding Payments</h2>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C1121F]/70 ml-auto tabular-nums">
                {fmt(summary?.totalUnpaid ?? 0)} total
              </span>
            </div>
            <div className="divide-y divide-[#C1121F]/15">
              {summary!.payables.map(p => (
                <div key={p.subcontractorId} className="flex items-center justify-between px-4 sm:px-5 py-3">
                  <span className="text-[12px] font-black uppercase tracking-[0.06em] text-[#0A0A0A]">
                    {p.name}{p.company ? <span className="text-black/55"> · {p.company}</span> : ""}
                  </span>
                  <span className="text-[12px] font-black text-[#C1121F] tabular-nums">
                    {fmt(p.unpaidTotal)} <span className="text-[10px] font-bold opacity-70">· {p.unpaidCount} job{p.unpaidCount !== 1 ? "s" : ""}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Sub list */}
          <div className="lg:col-span-1">
            <Card>
              <SectionHeader
                icon={User}
                title="Subcontractors"
                action={<span className="text-[10px] font-black uppercase tracking-[0.18em] text-black/55 tabular-nums">{subs.length} total</span>}
              />
              {isLoading ? (
                <LoadingState label="Loading subs" />
              ) : subs.length === 0 ? (
                <div className="py-12 px-6 flex flex-col items-center gap-3 text-center">
                  <User className="w-8 h-8 text-black/20" strokeWidth={1.4} />
                  <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]">No subcontractors yet</p>
                  <Button size="sm" variant="outline" icon={Plus} onClick={openAdd}>Add first sub</Button>
                </div>
              ) : (
                <div className="divide-y divide-black/8">
                  {subs.map(sub => {
                    const payable = summary?.payables.find(p => p.subcontractorId === sub.id);
                    const active = selectedSub?.id === sub.id;
                    return (
                      <button
                        key={sub.id}
                        data-testid={`sub-row-${sub.id}`}
                        onClick={() => setSelectedSub(active ? null : sub)}
                        className={`w-full text-left px-4 py-3 transition-colors ${active ? "bg-[#0A0A0A] text-white" : "hover:bg-[#EBE9E2]"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 flex items-center justify-center text-[11px] font-black tracking-wider shrink-0 ${
                            active ? "bg-white text-[#0A0A0A]" : "bg-[#0A0A0A] text-white"
                          }`}>
                            {sub.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[12px] font-black uppercase tracking-[0.06em] truncate ${active ? "text-white" : "text-[#0A0A0A]"}`}>{sub.name}</p>
                            {sub.company && (
                              <p className={`text-[10px] font-medium truncate mt-0.5 ${active ? "text-white/65" : "text-black/55"}`}>{sub.company}</p>
                            )}
                            {payable && (
                              <p className={`text-[10px] font-black uppercase tracking-[0.14em] tabular-nums mt-1 ${active ? "text-[#FBA5AB]" : "text-[#C1121F]"}`}>
                                Owes {fmt(payable.unpaidTotal)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5">
                            <span
                              onClick={e => { e.stopPropagation(); openEdit(sub); }}
                              className={`w-7 h-7 flex items-center justify-center cursor-pointer ${active ? "text-white/70 hover:text-white hover:bg-white/10" : "text-black/40 hover:text-[#0A0A0A] hover:bg-black/5"}`}
                            >
                              <Pencil className="w-3 h-3" />
                            </span>
                            <span
                              onClick={e => { e.stopPropagation(); setDeletingSub(sub); }}
                              className={`w-7 h-7 flex items-center justify-center cursor-pointer ${active ? "text-white/70 hover:text-[#FBA5AB] hover:bg-white/10" : "text-black/40 hover:text-[#C1121F] hover:bg-[#FBEBEB]"}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </span>
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${active ? "text-white rotate-90" : "text-black/25"}`} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Job history panel */}
          <div className="lg:col-span-2">
            <Card>
              {!selectedSub ? (
                <EmptyState icon={Briefcase} title="Select a subcontractor" hint="View their job history and payment status." />
              ) : (
                <>
                  <SectionHeader
                    icon={Receipt}
                    title={`${selectedSub.name}${selectedSub.company ? ` · ${selectedSub.company}` : ""}`}
                    action={
                      <button
                        onClick={() => setSelectedSub(null)}
                        className="w-7 h-7 flex items-center justify-center text-black/45 hover:text-[#0A0A0A] hover:bg-black/5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    }
                  />
                  {loadingJobs ? (
                    <LoadingState label="Loading jobs" />
                  ) : jobs.length === 0 ? (
                    <EmptyState icon={Briefcase} title="No jobs assigned yet" hint="Assign this sub to a job from the Quote Detail page." />
                  ) : (
                    <div className="divide-y divide-black/8">
                      <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#EBE9E2]/60 text-[10px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]">
                        <span>{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
                        <span className="tabular-nums">
                          Total <span>{fmt(jobs.reduce((s, j) => s + Number(j.agreedCost), 0))}</span>
                          <span className="mx-2 text-black/30">·</span>
                          Unpaid <span className="text-[#C1121F]">{fmt(jobs.filter(j => j.paymentStatus === "unpaid").reduce((s, j) => s + Number(j.agreedCost), 0))}</span>
                        </span>
                      </div>
                      {jobs.map(job => (
                        <div key={job.id} className="px-4 sm:px-5 py-3.5 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() => setLocation(`/admin/quotes/${job.quoteId}`)}
                                className="text-[12px] font-black uppercase tracking-[0.06em] text-[#0A0A0A] hover:underline"
                                data-testid={`job-link-${job.id}`}
                              >
                                {job.quoteRef}
                              </button>
                              <Pill tone={job.paymentStatus === "paid" ? "stone" : "urgent"}>
                                {job.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                              </Pill>
                            </div>
                            {job.customerName && (
                              <p className="text-[11px] text-black/65 font-medium mt-1">{job.customerName}</p>
                            )}
                            {job.scheduledAt && (
                              <p className="text-[10px] text-black/55 font-bold uppercase tracking-[0.14em] mt-0.5">
                                {format(new Date(job.scheduledAt), "EEE d MMM yyyy")}
                              </p>
                            )}
                            {job.notes && (
                              <p className="text-[11px] text-black/55 italic mt-1">"{job.notes}"</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className="text-[14px] font-black text-[#0A0A0A] tabular-nums">{fmt(Number(job.agreedCost))}</span>
                            {job.quoteTotal && (
                              <span className="text-[10px] text-black/45 font-bold uppercase tracking-[0.14em]">
                                Job {fmt(Number(job.quoteTotal))}
                              </span>
                            )}
                            <button
                              onClick={() => markPaidMutation.mutate({ id: job.id, paid: job.paymentStatus !== "paid" })}
                              disabled={markPaidMutation.isPending}
                              className={`text-[10px] font-black uppercase tracking-[0.14em] px-2 py-1 transition-colors ${
                                job.paymentStatus === "paid"
                                  ? "bg-[#EBE9E2] text-[#0A0A0A] hover:bg-[#FBEBEB] hover:text-[#C1121F]"
                                  : "bg-[#0A0A0A] text-white hover:bg-black"
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
            </Card>
          </div>
        </div>
      </PageBody>

      {/* Add / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditingSub(null); } }}>
        <DialogContent className="max-w-md rounded-none border-black/15">
          <DialogHeader>
            <DialogTitle className="text-[14px] font-black uppercase tracking-[0.12em]">
              {editingSub ? "Edit Subcontractor" : "Add Subcontractor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Field label="Name *">
              <Input className="rounded-none border-black/20" placeholder="Full name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-sub-name" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input className="rounded-none border-black/20" placeholder="e.g. 91234567" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} data-testid="input-sub-phone" />
              </Field>
              <Field label="Email">
                <Input className="rounded-none border-black/20" placeholder="email@example.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="input-sub-email" />
              </Field>
            </div>
            <Field label="Company">
              <Input className="rounded-none border-black/20" placeholder="Company or trading name" value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))} data-testid="input-sub-company" />
            </Field>
            <Field label="Notes">
              <Textarea className="rounded-none border-black/20" placeholder="Any notes about this subcontractor…"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-sub-notes" />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingSub(null); }}>Cancel</Button>
            <Button variant="ink" onClick={handleSave} disabled={!form.name.trim() || isBusy} data-testid="save-sub-btn">
              {isBusy ? "Saving…" : (editingSub ? "Save Changes" : "Add Subcontractor")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingSub} onOpenChange={open => { if (!open) setDeletingSub(null); }}>
        <AlertDialogContent className="rounded-none border-black/15">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px] font-black uppercase tracking-[0.12em]">Delete {deletingSub?.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] text-black/65">
              This removes the subcontractor and all their job records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-none bg-[#C1121F] hover:bg-[#a30f1a]"
              onClick={() => deletingSub && deleteMutation.mutate(deletingSub.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-black/55 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function StatCell({ label, value, icon: Icon, accent = "ink" }: {
  label: string; value: string; icon: any; accent?: "ink" | "urgent";
}) {
  return (
    <div className="bg-white px-4 sm:px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-black/55">{label}</p>
        <Icon className="w-3.5 h-3.5 text-black/35" strokeWidth={1.75} />
      </div>
      <p className={`text-[22px] sm:text-[26px] font-black tabular-nums leading-none tracking-tight ${accent === "urgent" ? "text-[#C1121F]" : "text-[#0A0A0A]"}`}>
        {value}
      </p>
    </div>
  );
}
