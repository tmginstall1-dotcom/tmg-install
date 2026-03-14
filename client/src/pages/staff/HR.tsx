import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, differenceInMinutes, differenceInCalendarDays, parseISO, addDays } from "date-fns";
import {
  Clock, Calendar, FileText, ChevronDown, ChevronUp, Edit3, Check, X,
  Loader2, Printer, TrendingUp, AlertCircle, CheckCircle2
} from "lucide-react";
import OfficialPayslip from "@/components/OfficialPayslip";

type Tab = "attendance" | "leave" | "payslips";

const LEAVE_TYPES = [
  { value: "annual", label: "Annual Leave", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "medical", label: "Medical Leave", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  { value: "unpaid", label: "Unpaid Leave", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "other", label: "Other", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
];

function fmtDur(mins: number) {
  if (mins <= 0) return "0m";
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

function LeaveStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

export default function StaffHR() {
  const initialTab = (() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "leave" || t === "payslips" || t === "attendance") return t;
    return "attendance";
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  const { user } = useAuth();

  const tabs = [
    { key: "attendance" as const, label: "Attendance", icon: Clock },
    { key: "leave" as const, label: "Leave", icon: Calendar },
    { key: "payslips" as const, label: "Payslips", icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b pt-16 pb-0">
        <div className="max-w-2xl mx-auto px-4 sm:px-5">
          <div className="py-5">
            <h1 className="text-2xl font-black">My HR</h1>
            <p className="text-sm text-muted-foreground">Attendance, leave and payslips</p>
          </div>
          {/* Tab bar */}
          <div className="flex gap-0">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-bold border-b-2 transition-all ${
                  tab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`tab-${key}`}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-5 py-5 pb-24">
        {tab === "attendance" && <AttendanceTab />}
        {tab === "leave" && <LeaveTab userId={user?.id} />}
        {tab === "payslips" && <PayslipsTab />}
      </div>
    </div>
  );
}

// ─── Attendance Tab ─────────────────────────────────────────────────────────

function AttendanceTab() {
  const { data: myLogs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/attendance"],
  });
  const { data: amendments = [] } = useQuery<any[]>({
    queryKey: ["/api/attendance/amendments"],
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (myLogs.length === 0) return (
    <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed mt-2">
      <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="font-bold text-muted-foreground">No records yet</p>
      <p className="text-sm text-muted-foreground mt-1">Clock in from your dashboard to get started</p>
    </div>
  );

  // Build ordered list of months (most recent first)
  const monthMap: Record<string, any[]> = {};
  for (const log of myLogs) {
    const key = format(new Date(log.clockInAt), "yyyy-MM");
    if (!monthMap[key]) monthMap[key] = [];
    monthMap[key].push(log);
  }
  const monthKeys = Object.keys(monthMap).sort((a, b) => b.localeCompare(a));

  const clampedIdx = Math.min(selectedMonthIdx, monthKeys.length - 1);
  const activeKey = monthKeys[clampedIdx];
  const activeLogs = monthMap[activeKey] || [];

  const monthMins = activeLogs.reduce((acc: number, l: any) => {
    if (!l.clockOutAt) return acc;
    return acc + differenceInMinutes(new Date(l.clockOutAt), new Date(l.clockInAt));
  }, 0);
  const daysWorked = activeLogs.filter((l: any) => l.clockOutAt).length;
  const monthLabel = format(new Date(activeKey + "-01"), "MMMM yyyy");

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="bg-card border-2 rounded-2xl overflow-hidden">
        <div className="flex items-center">
          <button
            onClick={() => setSelectedMonthIdx(i => Math.min(i + 1, monthKeys.length - 1))}
            disabled={clampedIdx >= monthKeys.length - 1}
            className="p-4 hover:bg-secondary/40 transition-colors disabled:opacity-30"
            data-testid="button-prev-month">
            <ChevronDown className="w-5 h-5 rotate-90" />
          </button>
          <div className="flex-1 text-center py-3">
            <p className="font-black text-lg">{monthLabel}</p>
            <p className="text-xs text-muted-foreground">{monthKeys.length - clampedIdx} of {monthKeys.length} months</p>
          </div>
          <button
            onClick={() => setSelectedMonthIdx(i => Math.max(i - 1, 0))}
            disabled={clampedIdx <= 0}
            className="p-4 hover:bg-secondary/40 transition-colors disabled:opacity-30"
            data-testid="button-next-month">
            <ChevronDown className="w-5 h-5 -rotate-90" />
          </button>
        </div>

        {/* Month stats strip */}
        <div className="border-t grid grid-cols-3 divide-x">
          <div className="px-3 py-2.5 text-center">
            <p className="text-lg font-black">{fmtDur(monthMins)}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Total Hours</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className="text-lg font-black">{daysWorked}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Days In</p>
          </div>
          <div className="px-3 py-2.5 text-center">
            <p className="text-lg font-black">{activeLogs.length > 0 && monthMins > 0 ? fmtDur(Math.round(monthMins / daysWorked)) : "—"}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Avg / Day</p>
          </div>
        </div>
      </div>

      {/* Records for selected month */}
      {activeLogs.length === 0 ? (
        <div className="text-center py-10 bg-secondary/30 rounded-2xl border-2 border-dashed">
          <p className="text-sm text-muted-foreground">No records for {monthLabel}</p>
        </div>
      ) : (
        <div className="bg-card border-2 rounded-2xl overflow-hidden divide-y">
          {activeLogs.map((log: any) => {
            const mins = log.clockOutAt
              ? differenceInMinutes(new Date(log.clockOutAt), new Date(log.clockInAt))
              : null;
            const pendingAmend = amendments.find((a: any) => a.attendanceLogId === log.id && a.status === "pending");
            const isOpen = expandedId === log.id;

            return (
              <div key={log.id}>
                <button
                  onClick={() => setExpandedId(isOpen ? null : log.id)}
                  className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                  data-testid={`attendance-row-${log.id}`}>
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 shrink-0 text-center">
                      <p className="text-[11px] font-bold text-muted-foreground leading-none uppercase">{format(new Date(log.clockInAt), "EEE")}</p>
                      <p className="text-xl font-black leading-tight">{format(new Date(log.clockInAt), "d")}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold leading-tight">
                        {format(new Date(log.clockInAt), "HH:mm")}
                        {log.clockOutAt
                          ? ` – ${format(new Date(log.clockOutAt), "HH:mm")}`
                          : <span className="text-emerald-600 ml-1.5 text-xs font-bold">● Active</span>}
                      </p>
                      {pendingAmend && (
                        <span className="text-[10px] font-bold text-amber-600">Amendment pending</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-black text-base tabular-nums">
                      {mins !== null ? fmtDur(mins) : "—"}
                    </p>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t bg-secondary/20 px-4 py-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Clock In</p>
                        <p className="font-bold text-base">{format(new Date(log.clockInAt), "HH:mm")}</p>
                        {log.clockInLat && (
                          <a href={`https://maps.google.com/?q=${log.clockInLat},${log.clockInLng}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-primary underline mt-0.5 inline-block">View GPS ↗</a>
                        )}
                      </div>
                      <div className={`border rounded-xl p-3 ${log.clockOutAt
                        ? "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900"
                        : "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900"}`}>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Clock Out</p>
                        <p className="font-bold text-base">{log.clockOutAt ? format(new Date(log.clockOutAt), "HH:mm") : "—"}</p>
                        {log.clockOutLat && (
                          <a href={`https://maps.google.com/?q=${log.clockOutLat},${log.clockOutLng}`}
                            target="_blank" rel="noreferrer"
                            className="text-xs text-primary underline mt-0.5 inline-block">View GPS ↗</a>
                        )}
                      </div>
                    </div>

                    {amendments.filter((a: any) => a.attendanceLogId === log.id).map((a: any) => (
                      <div key={a.id} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">Amendment</p>
                          <LeaveStatusBadge status={a.status} />
                        </div>
                        <p className="text-xs text-foreground font-medium">
                          Requested: {a.requestedClockIn && format(new Date(a.requestedClockIn), "HH:mm")}
                          {a.requestedClockOut && ` – ${format(new Date(a.requestedClockOut), "HH:mm")}`}
                        </p>
                        <p className="text-xs text-muted-foreground">Reason: {a.reason}</p>
                        {a.adminNote && <p className="text-xs text-muted-foreground mt-0.5 italic">Admin: {a.adminNote}</p>}
                      </div>
                    ))}

                    {!pendingAmend && <AmendmentForm log={log} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
      data-testid={`btn-amend-${log.id}`}>
      <Edit3 className="w-3.5 h-3.5" /> Request Time Amendment
    </button>
  );

  return (
    <div className="bg-card border-2 border-dashed border-primary/30 rounded-xl p-3 space-y-2.5">
      <p className="text-xs font-bold uppercase tracking-wide text-foreground">Request Amendment</p>
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
        placeholder="Reason for amendment (min 5 chars)"
        rows={2} className="w-full px-2 py-1.5 text-xs border rounded-lg bg-background resize-none" />
      <div className="flex gap-2">
        <button onClick={() => mut.mutate()} disabled={mut.isPending || reason.length < 5}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-50">
          {mut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Submit
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 border text-xs rounded-lg hover:bg-secondary transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Leave Tab ──────────────────────────────────────────────────────────────

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
    <div className="space-y-4">
      {/* Balance Card */}
      {balance && (
        <div className="bg-card border-2 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Annual Leave {year}</p>
          <div className="grid grid-cols-4 gap-2 text-center mb-3">
            {[
              { label: "Entitled", val: balance.entitlement, color: "text-foreground" },
              { label: "Used", val: balance.used, color: "text-red-600" },
              { label: "Pending", val: balance.pending, color: "text-amber-600" },
              { label: "Left", val: balance.remaining, color: "text-emerald-600 text-2xl font-black" },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-secondary/40 rounded-xl py-2.5">
                <p className={`text-xl font-black leading-tight ${color}`}>{val}</p>
                <p className="text-[10px] text-muted-foreground font-bold">{label}</p>
              </div>
            ))}
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, ((balance.used + balance.pending) / balance.entitlement) * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Apply Button */}
      <button onClick={() => setShowForm(!showForm)}
        className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-opacity"
        data-testid="button-apply-leave">
        <Calendar className="w-4 h-4" />
        {showForm ? "Cancel" : "Apply for Leave"}
      </button>

      {/* Apply Form */}
      {showForm && (
        <div className="bg-card border-2 rounded-2xl p-4 space-y-3">
          <p className="font-bold">New Leave Application</p>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Leave Type</label>
            <div className="grid grid-cols-2 gap-2">
              {LEAVE_TYPES.map(lt => (
                <button key={lt.value} onClick={() => setForm(f => ({ ...f, leaveType: lt.value }))}
                  className={`py-2.5 px-3 rounded-xl text-sm font-bold border-2 transition-all ${
                    form.leaveType === lt.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
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
            <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 text-sm font-bold text-primary">
              {totalDays} day{totalDays !== 1 ? "s" : ""} leave
            </div>
          )}
          <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
            placeholder="Reason (optional)" rows={2}
            className="w-full px-3 py-2 border rounded-xl text-sm bg-background resize-none" />
          <button onClick={() => submitMut.mutate()}
            disabled={!form.startDate || !form.endDate || totalDays < 1 || submitMut.isPending}
            className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-xl disabled:opacity-50 transition-opacity"
            data-testid="button-submit-leave">
            {submitMut.isPending ? "Submitting…" : `Submit${totalDays > 0 ? ` (${totalDays}d)` : ""}`}
          </button>
        </div>
      )}

      {/* Leave History */}
      {leaves.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">History</p>
          <div className="bg-card border-2 rounded-2xl overflow-hidden divide-y">
            {leaves.map((l: any) => {
              const lt = LEAVE_TYPES.find(t => t.value === l.leaveType);
              const icon = l.status === "approved" ? "✓" : l.status === "rejected" ? "✗" : "⏱";
              return (
                <div key={l.id} className="px-4 py-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${lt?.color || "bg-gray-100 text-gray-600"}`}>
                        {lt?.label || l.leaveType}
                      </span>
                      <LeaveStatusBadge status={l.status} />
                    </div>
                    <p className="text-sm font-bold">
                      {format(parseISO(l.startDate), "d MMM")} – {format(parseISO(l.endDate), "d MMM yyyy")}
                    </p>
                    {l.reason && <p className="text-xs text-muted-foreground truncate">{l.reason}</p>}
                    {l.adminNote && <p className="text-xs text-muted-foreground italic">Admin: {l.adminNote}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black">{parseFloat(l.totalDays)}d</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {leaves.length === 0 && !showForm && (
        <div className="text-center py-10 bg-secondary/30 rounded-2xl border-2 border-dashed">
          <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No leave applications yet</p>
        </div>
      )}
    </div>
  );
}

// ─── Payslips Tab ───────────────────────────────────────────────────────────

function PayslipsTab() {
  const { user } = useAuth();
  const { data: payslips = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/staff/payslips"] });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [printingPayslip, setPrintingPayslip] = useState<any | null>(null);

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (payslips.length === 0) return (
    <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed mt-2">
      <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="font-bold text-muted-foreground">No payslips yet</p>
      <p className="text-sm text-muted-foreground mt-1">Your payslips will appear once generated by admin</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="bg-card border-2 rounded-2xl overflow-hidden divide-y">
        {payslips.map((ps: any) => {
          const isOpen = expandedId === ps.id;
          const basicPay = parseFloat(ps.basicPay || "0");
          const mealAllowance = parseFloat(ps.mealAllowance || "0");
          const detailItems = ps.isMonthlyBased
            ? [
                { label: "Basic Salary", val: `S$${basicPay.toFixed(2)}` },
                { label: "Regular Hours", val: `${parseFloat(ps.regularHours).toFixed(1)}h` },
                { label: "Regular Pay", val: `S$${parseFloat(ps.regularPay).toFixed(2)}` },
                { label: "OT Hours", val: `${parseFloat(ps.overtimeHours).toFixed(1)}h` },
                { label: "OT Pay", val: `S$${parseFloat(ps.overtimePay).toFixed(2)}` },
                ...(mealAllowance > 0 ? [{ label: "Meal Allowance", val: `S$${mealAllowance.toFixed(2)}` }] : []),
                { label: "Leave Deduction", val: `-S$${parseFloat(ps.leaveDeduction).toFixed(2)}`, negative: true },
              ]
            : [
                { label: "Regular Hours", val: `${parseFloat(ps.regularHours).toFixed(1)}h` },
                { label: "OT Hours", val: `${parseFloat(ps.overtimeHours).toFixed(1)}h` },
                { label: "Regular Pay", val: `S$${parseFloat(ps.regularPay).toFixed(2)}` },
                { label: "OT Pay", val: `S$${parseFloat(ps.overtimePay).toFixed(2)}` },
                ...(mealAllowance > 0 ? [{ label: "Meal Allowance", val: `S$${mealAllowance.toFixed(2)}` }] : []),
                { label: "Leave Deduction", val: `-S$${parseFloat(ps.leaveDeduction).toFixed(2)}`, negative: true },
              ];

          return (
            <div key={ps.id}>
              <button onClick={() => setExpandedId(isOpen ? null : ps.id)}
                className="w-full px-4 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                data-testid={`payslip-${ps.id}`}>
                <div className="text-left">
                  <p className="font-bold text-sm">
                    {format(parseISO(ps.periodStart), "d MMM")} – {format(parseISO(ps.periodEnd), "d MMM yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">Generated {format(new Date(ps.createdAt), "d MMM yyyy")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-lg font-black text-primary">S${parseFloat(ps.grossPay).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">Gross Pay</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setPrintingPayslip(ps); }}
                    className="p-2 rounded-xl hover:bg-primary/10 text-primary transition-colors"
                    title="Print payslip"
                    data-testid={`button-print-${ps.id}`}>
                    <Printer className="w-4 h-4" />
                  </button>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t bg-secondary/20 px-4 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {detailItems.map(({ label, val, negative }) => (
                      <div key={label} className="bg-card border rounded-xl p-2.5">
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
                    <div className="bg-card border rounded-xl px-3 py-2">
                      <p className="text-xs text-muted-foreground">{ps.notes}</p>
                    </div>
                  )}
                  <button
                    onClick={() => setPrintingPayslip(ps)}
                    className="flex items-center gap-2 text-sm font-bold text-primary hover:underline"
                    data-testid={`button-view-payslip-${ps.id}`}>
                    <Printer className="w-4 h-4" /> View Official Payslip
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {printingPayslip && (
        <OfficialPayslip
          payslip={printingPayslip}
          staffName={user?.name}
          staffUsername={user?.username}
          onClose={() => setPrintingPayslip(null)}
        />
      )}
    </div>
  );
}
