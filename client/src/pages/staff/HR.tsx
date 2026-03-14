import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, differenceInMinutes, differenceInCalendarDays, parseISO, addDays } from "date-fns";
import { Clock, Calendar, FileText, ChevronDown, ChevronUp, Edit3, Check, X, AlertCircle, Loader2 } from "lucide-react";

type Tab = "attendance" | "leave" | "payslips";

const LEAVE_TYPES = [
  { value: "annual", label: "Annual Leave", color: "bg-blue-100 text-blue-700" },
  { value: "medical", label: "Medical Leave", color: "bg-red-100 text-red-700" },
  { value: "unpaid", label: "Unpaid Leave", color: "bg-amber-100 text-amber-700" },
  { value: "other", label: "Other", color: "bg-gray-100 text-gray-700" },
];

function fmtDur(mins: number) {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${styles[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default function StaffHR() {
  const [tab, setTab] = useState<Tab>("attendance");
  const { user } = useAuth();

  return (
    <div className="min-h-screen pt-20 pb-20 bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-black">My HR</h1>
          <p className="text-muted-foreground">Attendance, leave and payslips</p>
        </div>

        <div className="flex gap-0 mb-6 border-b">
          {([
            { key: "attendance", label: "Attendance", icon: Clock },
            { key: "leave", label: "Leave", icon: Calendar },
            { key: "payslips", label: "Payslips", icon: FileText },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "attendance" && <AttendanceTab />}
        {tab === "leave" && <LeaveTab userId={user?.id} />}
        {tab === "payslips" && <PayslipsTab />}
      </div>
    </div>
  );
}

// ─── Attendance Tab ────────────────────────────────────────────────────────────

function AttendanceTab() {
  const { data: myLogs = [], isLoading: myLogsLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/attendance"],
  });

  const { data: amendments = [] } = useQuery<any[]>({
    queryKey: ["/api/attendance/amendments"],
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (myLogsLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      {myLogs.length === 0 ? (
        <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No attendance records yet</p>
          <p className="text-sm text-muted-foreground">Clock in from your dashboard to get started</p>
        </div>
      ) : (
        myLogs.map((log: any) => {
          const mins = log.clockOutAt
            ? differenceInMinutes(new Date(log.clockOutAt), new Date(log.clockInAt))
            : null;
          const pendingAmendment = amendments.find((a: any) => a.attendanceLogId === log.id && a.status === 'pending');
          const isOpen = expandedId === log.id;

          return (
            <div key={log.id} className="bg-card border rounded-2xl overflow-hidden">
              <button onClick={() => setExpandedId(isOpen ? null : log.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                data-testid={`attendance-row-${log.id}`}>
                <div className="text-left">
                  <p className="font-bold text-sm">{format(new Date(log.clockInAt), "EEE, d MMM yyyy")}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.clockInAt), "HH:mm")}
                    {log.clockOutAt ? ` – ${format(new Date(log.clockOutAt), "HH:mm")}` : " (no clock-out)"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {pendingAmendment && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Amendment Pending</span>}
                  <p className="font-black text-base">{mins !== null ? fmtDur(mins) : <span className="text-amber-600 text-sm font-bold">Active</span>}</p>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-1">Clock In</p>
                      <p className="font-bold">{format(new Date(log.clockInAt), "HH:mm")}</p>
                      {log.clockInLat && <a href={`https://maps.google.com/?q=${log.clockInLat},${log.clockInLng}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">GPS ↗</a>}
                    </div>
                    <div className={`rounded-xl p-3 ${log.clockOutAt ? "bg-red-50 dark:bg-red-950/20" : "bg-amber-50 dark:bg-amber-950/20"}`}>
                      <p className="text-xs text-muted-foreground mb-1">Clock Out</p>
                      <p className="font-bold">{log.clockOutAt ? format(new Date(log.clockOutAt), "HH:mm") : "—"}</p>
                      {log.clockOutLat && <a href={`https://maps.google.com/?q=${log.clockOutLat},${log.clockOutLng}`} target="_blank" rel="noreferrer" className="text-xs text-primary underline">GPS ↗</a>}
                    </div>
                  </div>

                  {/* Amendment history for this log */}
                  {amendments.filter((a: any) => a.attendanceLogId === log.id).map((a: any) => (
                    <div key={a.id} className="bg-secondary/30 rounded-xl p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-bold text-xs uppercase tracking-wide text-muted-foreground">Amendment Request</p>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-xs mb-1">
                        Requested: {a.requestedClockIn && format(new Date(a.requestedClockIn), "HH:mm")}
                        {a.requestedClockOut && ` – ${format(new Date(a.requestedClockOut), "HH:mm")}`}
                      </p>
                      <p className="text-xs text-muted-foreground">Reason: {a.reason}</p>
                      {a.adminNote && <p className="text-xs text-muted-foreground mt-1">Admin note: {a.adminNote}</p>}
                    </div>
                  ))}

                  {!pendingAmendment && (
                    <AmendmentForm log={log} />
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

function AmendmentForm({ log }: { log: any }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [clockIn, setClockIn] = useState(log.clockInAt ? format(new Date(log.clockInAt), "yyyy-MM-dd'T'HH:mm") : "");
  const [clockOut, setClockOut] = useState(log.clockOutAt ? format(new Date(log.clockOutAt), "yyyy-MM-dd'T'HH:mm") : "");
  const [reason, setReason] = useState("");

  const mut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/attendance/amendment", {
      attendanceLogId: log.id,
      requestedClockIn: clockIn ? new Date(clockIn).toISOString() : undefined,
      requestedClockOut: clockOut ? new Date(clockOut).toISOString() : undefined,
      reason,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendance/amendments"] });
      setOpen(false);
      setReason("");
      toast({ title: "Amendment submitted", description: "Admin will review your request." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        data-testid={`btn-amend-${log.id}`}>
        <Edit3 className="w-3.5 h-3.5" /> Request Time Amendment
      </button>
    );
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl p-3 space-y-2">
      <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">Request Amendment</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Correct Clock In</label>
          <input type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border rounded-lg bg-background" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Correct Clock Out</label>
          <input type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border rounded-lg bg-background" />
        </div>
      </div>
      <textarea value={reason} onChange={e => setReason(e.target.value)}
        placeholder="Reason for amendment (required, min 5 chars)"
        rows={2} className="w-full px-2 py-1.5 text-xs border rounded-lg bg-background resize-none" />
      <div className="flex gap-2">
        <button onClick={() => mut.mutate()} disabled={mut.isPending || reason.length < 5}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-50">
          {mut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Submit
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 border text-xs rounded-lg">Cancel</button>
      </div>
    </div>
  );
}

// ─── Leave Tab ─────────────────────────────────────────────────────────────────

function LeaveTab({ userId }: { userId?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const year = new Date().getFullYear();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveType: "annual", startDate: "", endDate: "", reason: "" });

  const { data: leaves = [] } = useQuery<any[]>({ queryKey: ["/api/leave"] });
  const { data: balance } = useQuery<any>({
    queryKey: ["/api/leave/balance", year],
    queryFn: () => fetch(`/api/leave/balance?year=${year}`).then(r => r.json()),
  });

  const totalDays = form.startDate && form.endDate
    ? Math.max(0, differenceInCalendarDays(parseISO(form.endDate), parseISO(form.startDate)) + 1)
    : 0;

  const submitMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/leave", { ...form, totalDays }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/leave"] });
      qc.invalidateQueries({ queryKey: ["/api/leave/balance", year] });
      setShowForm(false);
      setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      toast({ title: "Leave applied", description: "Waiting for admin approval." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5">
      {/* Leave Balance Card */}
      {balance && (
        <div className="bg-card border-2 border-primary/20 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Annual Leave Balance {year}</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { label: "Entitlement", val: balance.entitlement, color: "text-foreground" },
              { label: "Used", val: balance.used, color: "text-red-600" },
              { label: "Pending", val: balance.pending, color: "text-amber-600" },
              { label: "Remaining", val: balance.remaining, color: "text-emerald-600" },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <p className={`text-2xl font-black ${color}`}>{val}</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, ((balance.used + balance.pending) / balance.entitlement) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Apply Button */}
      <button onClick={() => setShowForm(!showForm)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/90 transition-colors"
        data-testid="button-apply-leave">
        <Calendar className="w-4 h-4" />
        {showForm ? "Cancel Application" : "Apply for Leave"}
      </button>

      {/* Apply Form */}
      {showForm && (
        <div className="bg-card border-2 border-dashed border-primary/30 rounded-2xl p-4 space-y-3">
          <p className="font-bold text-sm">New Leave Application</p>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Leave Type</label>
            <div className="grid grid-cols-2 gap-2">
              {LEAVE_TYPES.map(lt => (
                <button key={lt.value} onClick={() => setForm(f => ({ ...f, leaveType: lt.value }))}
                  className={`py-2 px-3 rounded-xl text-sm font-bold border-2 transition-all ${
                    form.leaveType === lt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}>
                  {lt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-xl text-sm bg-background" data-testid="input-leave-start" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">End Date</label>
              <input type="date" value={form.endDate} min={form.startDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-2 border rounded-xl text-sm bg-background" data-testid="input-leave-end" />
            </div>
          </div>
          {totalDays > 0 && (
            <div className="bg-primary/5 rounded-xl px-3 py-2 text-sm font-bold text-primary">
              {totalDays} day{totalDays !== 1 ? "s" : ""} leave
            </div>
          )}
          <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            placeholder="Reason (optional)" rows={2}
            className="w-full px-3 py-2 border rounded-xl text-sm bg-background resize-none" />
          <button onClick={() => submitMut.mutate()}
            disabled={!form.startDate || !form.endDate || totalDays < 1 || submitMut.isPending}
            className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-xl disabled:opacity-50"
            data-testid="button-submit-leave">
            {submitMut.isPending ? "Submitting..." : `Submit ${totalDays > 0 ? `(${totalDays}d)` : ""}`}
          </button>
        </div>
      )}

      {/* Leave History */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Leave History</p>
        {leaves.length === 0 ? (
          <div className="text-center py-10 bg-secondary/30 rounded-2xl border-2 border-dashed">
            <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No leave applications yet</p>
          </div>
        ) : (
          leaves.map((l: any) => {
            const lt = LEAVE_TYPES.find(t => t.value === l.leaveType);
            return (
              <div key={l.id} className="bg-card border rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lt?.color || "bg-gray-100 text-gray-600"}`}>{lt?.label || l.leaveType}</span>
                    <StatusBadge status={l.status} />
                  </div>
                  <p className="text-sm font-bold">
                    {format(parseISO(l.startDate), "d MMM")} – {format(parseISO(l.endDate), "d MMM yyyy")}
                  </p>
                  {l.reason && <p className="text-xs text-muted-foreground">{l.reason}</p>}
                  {l.adminNote && <p className="text-xs text-muted-foreground italic mt-0.5">Admin: {l.adminNote}</p>}
                </div>
                <p className="text-lg font-black text-muted-foreground shrink-0 ml-3">{parseFloat(l.totalDays)}d</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Payslips Tab ──────────────────────────────────────────────────────────────

function PayslipsTab() {
  const { data: payslips = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/staff/payslips"] });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (payslips.length === 0) {
    return (
      <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed">
        <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold text-muted-foreground">No payslips yet</p>
        <p className="text-sm text-muted-foreground">Your payslips will appear here once generated by admin</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payslips.map((ps: any) => {
        const isOpen = expandedId === ps.id;
        return (
          <div key={ps.id} className="bg-card border-2 rounded-2xl overflow-hidden">
            <button onClick={() => setExpandedId(isOpen ? null : ps.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors"
              data-testid={`payslip-${ps.id}`}>
              <div className="text-left">
                <p className="font-bold">
                  {format(parseISO(ps.periodStart), "d MMM")} – {format(parseISO(ps.periodEnd), "d MMM yyyy")}
                </p>
                <p className="text-xs text-muted-foreground">Generated {format(new Date(ps.createdAt), "d MMM yyyy")}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xl font-black text-primary">S${parseFloat(ps.grossPay).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Gross Pay</p>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: "Regular Hours", val: `${parseFloat(ps.regularHours).toFixed(1)}h` },
                    { label: "OT Hours", val: `${parseFloat(ps.overtimeHours).toFixed(1)}h` },
                    { label: "Regular Pay", val: `S$${parseFloat(ps.regularPay).toFixed(2)}` },
                    { label: "OT Pay (1.5x)", val: `S$${parseFloat(ps.overtimePay).toFixed(2)}` },
                    { label: "Leave Deduction", val: `-S$${parseFloat(ps.leaveDeduction).toFixed(2)}`, negative: true },
                  ].map(({ label, val, negative }) => (
                    <div key={label} className="bg-secondary/30 rounded-xl p-2.5">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">{label}</p>
                      <p className={`font-bold ${negative ? "text-red-600" : ""}`}>{val}</p>
                    </div>
                  ))}
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5">
                    <p className="text-[10px] text-primary font-bold uppercase mb-0.5">Gross Pay</p>
                    <p className="font-black text-primary">S${parseFloat(ps.grossPay).toFixed(2)}</p>
                  </div>
                </div>
                {ps.notes && (
                  <div className="bg-secondary/30 rounded-xl px-3 py-2">
                    <p className="text-xs text-muted-foreground">{ps.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
