import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { format, differenceInMinutes, differenceInCalendarDays, parseISO } from "date-fns";
import {
  Clock, Calendar, FileText, ChevronDown, ChevronUp, Edit3, Check, X,
  Loader2, Printer, LogIn, LogOut, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2, PlusCircle, TrendingDown, Heart, Briefcase,
  Receipt, Upload, Trash2, ImageIcon,
} from "lucide-react";
import OfficialPayslip from "@/components/OfficialPayslip";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

type Tab = "attendance" | "leave" | "payslips" | "receipts";

const LEAVE_TYPES = [
  { value: "annual", label: "Annual Leave", emoji: "🌴", color: "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300" },
  { value: "medical", label: "Medical Leave", emoji: "🏥", color: "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-700 dark:text-red-300" },
  { value: "unpaid", label: "Unpaid Leave", emoji: "💸", color: "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-300" },
  { value: "other", label: "Other", emoji: "📋", color: "border-gray-300 bg-gray-50 text-gray-700 dark:bg-gray-800/50 dark:border-gray-600 dark:text-gray-300" },
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
    <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {status === "approved" && "✓ "}
      {status === "rejected" && "✗ "}
      {status === "pending" && "⏱ "}
      {status}
    </span>
  );
}

export default function StaffHR() {
  const initialTab = (() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "leave" || t === "payslips" || t === "attendance" || t === "receipts") return t as Tab;
    return "attendance";
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  const { user } = useAuth();

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "attendance", label: "Attendance", icon: Clock },
    { key: "leave", label: "Leave", icon: Calendar },
    { key: "payslips", label: "Payslips", icon: FileText },
    { key: "receipts", label: "Receipts", icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* Page header */}
      <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-5">
          <div className="pt-16 pb-3">
            <h1 className="text-2xl font-black text-slate-900">My HR</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Attendance, leave, payslips & receipts</p>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-slate-100">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                data-testid={`tab-${key}`}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-bold transition-all relative border-b-2 -mb-px ${
                  tab === key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-5 py-5 pb-28">
        {tab === "attendance" && <AttendanceTab />}
        {tab === "leave" && <LeaveTab userId={user?.id} />}
        {tab === "payslips" && <PayslipsTab />}
        {tab === "receipts" && <ReceiptsTab userId={user?.id} />}
      </div>
    </div>
  );
}

// ─── Attendance Tab ──────────────────────────────────────────────────────────

function AttendanceTab() {
  const { data: myLogs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/attendance"],
    refetchInterval: 30_000,
  });
  const { data: amendments = [] } = useQuery<any[]>({
    queryKey: ["/api/attendance/amendments"],
    refetchInterval: 30_000,
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading records…</p>
    </div>
  );

  if (myLogs.length === 0) return (
    <div className="text-center py-20 bg-secondary/30 rounded-3xl border-2 border-dashed mt-2">
      <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
      <p className="font-bold text-muted-foreground">No records yet</p>
      <p className="text-sm text-muted-foreground mt-1">Clock in from your dashboard to get started</p>
    </div>
  );

  // Build months
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
  // Count unique calendar days (multiple sessions on same day = 1 day)
  const daysWorked = new Set(
    activeLogs.filter((l: any) => l.clockOutAt).map((l: any) => format(new Date(l.clockInAt), "yyyy-MM-dd"))
  ).size;
  const monthLabel = format(new Date(activeKey + "-01"), "MMMM yyyy");

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="bg-card border rounded-2xl overflow-hidden">
        {/* Nav row */}
        <div className="flex items-center border-b">
          <button
            onClick={() => setSelectedMonthIdx(i => Math.min(i + 1, monthKeys.length - 1))}
            disabled={clampedIdx >= monthKeys.length - 1}
            className="p-4 hover:bg-secondary/40 transition-colors disabled:opacity-30"
            data-testid="button-prev-month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 text-center py-3">
            <p className="font-black text-lg">{monthLabel}</p>
            <p className="text-xs text-muted-foreground">{monthKeys.length - clampedIdx} of {monthKeys.length} months</p>
          </div>
          <button
            onClick={() => setSelectedMonthIdx(i => Math.max(i - 1, 0))}
            disabled={clampedIdx <= 0}
            className="p-4 hover:bg-secondary/40 transition-colors disabled:opacity-30"
            data-testid="button-next-month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x">
          <div className="px-3 py-3 text-center">
            <p className="text-xl font-black">{fmtDur(monthMins)}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Total Hours</p>
          </div>
          <div className="px-3 py-3 text-center">
            <p className="text-xl font-black">{daysWorked}</p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Days In</p>
          </div>
          <div className="px-3 py-3 text-center">
            <p className="text-xl font-black">
              {daysWorked > 0 && monthMins > 0 ? fmtDur(Math.round(monthMins / daysWorked)) : "—"}
            </p>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Avg / Day</p>
          </div>
        </div>
      </div>

      {/* Records list */}
      {activeLogs.length === 0 ? (
        <div className="text-center py-10 bg-secondary/30 rounded-2xl border-2 border-dashed">
          <p className="text-sm text-muted-foreground">No records for {monthLabel}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeLogs.map((log: any) => {
            const mins = log.clockOutAt
              ? differenceInMinutes(new Date(log.clockOutAt), new Date(log.clockInAt))
              : null;
            const pendingAmend = amendments.find((a: any) => a.attendanceLogId === log.id && a.status === "pending");
            const isOpen = expandedId === log.id;

            return (
              <div key={log.id} className="bg-card border rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isOpen ? null : log.id)}
                  className="w-full px-4 py-3.5 flex items-center gap-4 hover:bg-secondary/20 transition-colors"
                  data-testid={`attendance-row-${log.id}`}
                >
                  {/* Date block */}
                  <div className="w-11 shrink-0 text-center">
                    <p className="text-[10px] font-black text-muted-foreground uppercase leading-none">{format(new Date(log.clockInAt), "EEE")}</p>
                    <p className="text-2xl font-black leading-tight">{format(new Date(log.clockInAt), "d")}</p>
                  </div>

                  <div className="w-px h-8 bg-border shrink-0" />

                  {/* Times */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <LogIn className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span className="font-mono font-bold text-sm">{format(new Date(log.clockInAt), "HH:mm")}</span>
                      <span className="text-muted-foreground text-sm">→</span>
                      <LogOut className="w-3 h-3 text-red-400 shrink-0" />
                      {log.clockOutAt
                        ? <span className="font-mono font-bold text-sm">{format(new Date(log.clockOutAt), "HH:mm")}</span>
                        : <span className="text-emerald-600 text-xs font-black">● ACTIVE</span>
                      }
                    </div>
                    {pendingAmend && (
                      <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                        <AlertCircle className="w-3 h-3" /> Amendment pending
                      </p>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="font-black text-base tabular-nums">
                      {mins !== null ? fmtDur(mins) : "—"}
                    </p>
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t bg-secondary/10 px-4 py-4 space-y-3">
                    {/* Clock in / out detail */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <LogIn className="w-3.5 h-3.5 text-emerald-600" />
                          <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Clock In</p>
                        </div>
                        <p className="font-mono font-black text-lg">{format(new Date(log.clockInAt), "HH:mm")}</p>
                        {log.clockInLat && (
                          <a href={`https://maps.google.com/?q=${log.clockInLat},${log.clockInLng}`}
                            target="_blank" rel="noreferrer"
                            className="text-[11px] text-primary underline mt-1 inline-flex items-center gap-0.5">
                            View GPS ↗
                          </a>
                        )}
                      </div>
                      <div className={`border rounded-xl p-3 ${
                        log.clockOutAt
                          ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                          : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <LogOut className="w-3.5 h-3.5 text-red-500" />
                          <p className="text-[10px] font-black text-red-700 dark:text-red-400 uppercase tracking-wider">Clock Out</p>
                        </div>
                        <p className="font-mono font-black text-lg">{log.clockOutAt ? format(new Date(log.clockOutAt), "HH:mm") : "—"}</p>
                        {log.clockOutLat && (
                          <a href={`https://maps.google.com/?q=${log.clockOutLat},${log.clockOutLng}`}
                            target="_blank" rel="noreferrer"
                            className="text-[11px] text-primary underline mt-1 inline-flex items-center gap-0.5">
                            View GPS ↗
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Existing amendments */}
                    {amendments.filter((a: any) => a.attendanceLogId === log.id).map((a: any) => (
                      <div key={a.id} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">Amendment Request</p>
                          <LeaveStatusBadge status={a.status} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-foreground mb-1">
                          <span className="font-mono font-bold">
                            {a.requestedClockIn && format(new Date(a.requestedClockIn), "HH:mm")}
                            {a.requestedClockOut && ` → ${format(new Date(a.requestedClockOut), "HH:mm")}`}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">"{a.reason}"</p>
                        {a.adminNote && (
                          <p className="text-xs text-muted-foreground mt-1 italic border-t border-amber-200 dark:border-amber-700 pt-1">
                            Admin: {a.adminNote}
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Amendment form */}
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

// ─── Amendment Form ───────────────────────────────────────────────────────────

function AmendmentForm({ log }: { log: any }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [clockIn, setClockIn] = useState(log.clockInAt ? format(new Date(log.clockInAt), "yyyy-MM-dd'T'HH:mm") : "");
  const [clockOut, setClockOut] = useState(log.clockOutAt ? format(new Date(log.clockOutAt), "yyyy-MM-dd'T'HH:mm") : "");
  const [reason, setReason] = useState("");

  const MIN_REASON = 5;
  const reasonOk = reason.trim().length >= MIN_REASON;

  const mut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/attendance/amendment", {
      attendanceLogId: log.id,
      requestedClockIn: clockIn ? new Date(clockIn).toISOString() : undefined,
      requestedClockOut: clockOut ? new Date(clockOut).toISOString() : undefined,
      reason: reason.trim(),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendance/amendments"] });
      setOpen(false);
      setReason("");
      toast({ title: "Amendment submitted", description: "Your request has been sent to admin for review." });
    },
    onError: (e: any) => {
      let msg = e.message || "Something went wrong. Please try again.";
      try {
        const jsonPart = msg.includes(": ") ? msg.substring(msg.indexOf(": ") + 2) : msg;
        const parsed = JSON.parse(jsonPart);
        if (parsed.message) msg = parsed.message;
      } catch {}
      toast({ title: "Could not submit amendment", description: msg, variant: "destructive" });
    },
  });

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
      data-testid={`btn-amend-${log.id}`}
    >
      <Edit3 className="w-3.5 h-3.5" /> Request Time Amendment
    </button>
  );

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-foreground">Request Amendment</p>
        <button onClick={() => { setOpen(false); setReason(""); }}
          className="w-6 h-6 rounded-full hover:bg-secondary flex items-center justify-center transition-colors">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Enter the correct clock-in/out times and a reason.</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground mb-1 block uppercase tracking-wider">Correct In</label>
          <input type="datetime-local" value={clockIn} onChange={e => setClockIn(e.target.value)}
            className="w-full px-2 py-2 text-xs border rounded-lg bg-background font-mono" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground mb-1 block uppercase tracking-wider">Correct Out</label>
          <input type="datetime-local" value={clockOut} onChange={e => setClockOut(e.target.value)}
            className="w-full px-2 py-2 text-xs border rounded-lg bg-background font-mono" />
        </div>
      </div>

      <div>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for amendment (required, at least 5 characters)"
          rows={3}
          data-testid={`textarea-amend-reason-${log.id}`}
          className={`w-full px-3 py-2 text-sm border rounded-lg bg-background resize-none transition-colors focus:outline-none focus:ring-1 focus:ring-primary ${
            reason.length > 0 && !reasonOk ? "border-destructive" : "focus:border-primary"
          }`}
        />
        <div className="flex items-center justify-between mt-1.5">
          {reason.length > 0 && !reasonOk ? (
            <p className="text-[10px] text-destructive font-semibold">
              {MIN_REASON - reason.trim().length} more character{MIN_REASON - reason.trim().length !== 1 ? "s" : ""} needed
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              {reasonOk ? <span className="text-emerald-600 font-semibold">✓ Good to go</span> : "A reason is required"}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground tabular-nums">{reason.trim().length}/{MIN_REASON}+</p>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending || !reasonOk}
          data-testid={`btn-submit-amend-${log.id}`}
          title={!reasonOk ? "Please enter a reason (at least 5 characters)" : "Submit amendment request"}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {mut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {mut.isPending ? "Submitting…" : "Submit Request"}
        </button>
        <button
          onClick={() => { setOpen(false); setReason(""); }}
          className="px-4 py-2 border text-sm font-bold rounded-xl hover:bg-secondary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Leave Tab ───────────────────────────────────────────────────────────────

function LeaveTab({ userId }: { userId?: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const year = new Date().getFullYear();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveType: "annual", startDate: "", endDate: "", reason: "" });

  const { data: leaves = [], isLoading: leavesLoading } = useQuery<any[]>({
    queryKey: ["/api/leave"],
    refetchInterval: 30_000,
  });

  const { data: balance, isLoading: balanceLoading } = useQuery<any>({
    queryKey: ["/api/leave/balance", year],
    queryFn: () => fetch(`${API_BASE}/api/leave/balance?year=${year}`, { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30_000,
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
      toast({ title: "Leave applied ✓", description: "Waiting for admin approval." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Compute leave usage by type from the fetched leaves list
  const yearLeaves = leaves.filter((l: any) => l.startDate?.startsWith(String(year)));
  const medicalUsed = yearLeaves.filter((l: any) => l.leaveType === "medical" && l.status === "approved")
    .reduce((s: number, l: any) => s + parseFloat(l.totalDays || 0), 0);
  const medicalPending = yearLeaves.filter((l: any) => l.leaveType === "medical" && l.status === "pending")
    .reduce((s: number, l: any) => s + parseFloat(l.totalDays || 0), 0);
  const unpaidUsed = yearLeaves.filter((l: any) => l.leaveType === "unpaid" && l.status === "approved")
    .reduce((s: number, l: any) => s + parseFloat(l.totalDays || 0), 0);

  const annualRemaining = balance?.remaining ?? "—";
  const annualEntitlement = balance?.entitlement ?? 14;
  const annualUsed = balance?.used ?? 0;
  const annualPending = balance?.pending ?? 0;
  const usedPercent = balance
    ? Math.min(100, ((annualUsed + annualPending) / Math.max(1, annualEntitlement)) * 100)
    : 0;

  return (
    <div className="space-y-4">

      {/* ─── Leave Summary Cards ────────────────────────────── */}
      {balanceLoading ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-sm text-slate-500 font-medium">Loading leave balance…</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Annual Leave — main card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Annual Leave {year}</p>
                    <p className="text-[11px] text-slate-400">{annualEntitlement} days entitlement</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-3xl font-black leading-none ${Number(annualRemaining) > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {annualRemaining}
                  </span>
                  <p className="text-[11px] text-slate-400 font-medium">days left</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usedPercent >= 100 ? "bg-red-500" : usedPercent >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {annualUsed} day{annualUsed !== 1 ? "s" : ""} used
                {annualPending > 0 && ` · ${annualPending} day${annualPending !== 1 ? "s" : ""} pending`}
              </p>
            </div>

            <div className="grid grid-cols-3 divide-x border-t border-slate-100">
              {[
                { label: "Entitled", val: annualEntitlement, icon: "🏖️", color: "text-slate-800" },
                { label: "Used", val: annualUsed, icon: "✓", color: annualUsed > 0 ? "text-blue-700" : "text-slate-400" },
                { label: "Remaining", val: annualRemaining, icon: "→", color: Number(annualRemaining) > 0 ? "text-emerald-600" : "text-red-600" },
              ].map(({ label, val, icon, color }) => (
                <div key={label} className="px-3 py-3 text-center">
                  <p className={`text-xl font-black leading-tight ${color}`}>{val}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Medical + Unpaid leave — smaller row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-red-50 rounded-lg flex items-center justify-center">
                  <Heart className="w-3.5 h-3.5 text-red-500" />
                </div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Medical {year}</p>
              </div>
              <p className={`text-2xl font-black ${medicalUsed > 0 ? "text-red-600" : "text-slate-300"}`}>{medicalUsed}d</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {medicalUsed > 0 ? "used" : "none taken"}
                {medicalPending > 0 && ` · ${medicalPending}d pending`}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
                  <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-wide">Unpaid {year}</p>
              </div>
              <p className={`text-2xl font-black ${unpaidUsed > 0 ? "text-amber-600" : "text-slate-300"}`}>{unpaidUsed}d</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {unpaidUsed > 0 ? "taken" : "none taken"}
              </p>
            </div>
          </div>

          {annualPending > 0 && (
            <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700 font-semibold">
                {annualPending} day{annualPending !== 1 ? "s" : ""} of annual leave pending admin approval
              </p>
            </div>
          )}
        </div>
      )}

      {/* Apply button */}
      <button
        onClick={() => setShowForm(!showForm)}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-sm shadow-blue-200 transition-all active:scale-[0.98]"
        data-testid="button-apply-leave"
      >
        {showForm ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
        {showForm ? "Cancel Application" : "Apply for Leave"}
      </button>

      {/* Apply form */}
      {showForm && (
        <div className="bg-card border-2 border-primary/20 rounded-2xl p-4 space-y-4">
          <p className="font-black text-base">New Leave Application</p>

          {/* Leave type */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Leave Type</label>
            <div className="grid grid-cols-2 gap-2">
              {LEAVE_TYPES.map(lt => (
                <button
                  key={lt.value}
                  onClick={() => setForm(f => ({ ...f, leaveType: lt.value }))}
                  className={`flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-bold border-2 transition-all ${
                    form.leaveType === lt.value
                      ? lt.color
                      : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <span>{lt.emoji}</span> {lt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl bg-white font-medium focus:border-blue-500 outline-none transition-colors"
                style={{ fontSize: 16 }}
                data-testid="input-leave-start"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">End Date</label>
              <input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl bg-white font-medium focus:border-blue-500 outline-none transition-colors"
                style={{ fontSize: 16 }}
                data-testid="input-leave-end"
              />
            </div>
          </div>

          {totalDays > 0 && (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="font-bold text-sm text-primary">
                {totalDays} day{totalDays !== 1 ? "s" : ""} of leave
              </span>
              {totalDays > (balance?.remaining ?? 0) && (
                <span className="ml-auto text-[11px] font-bold text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Exceeds balance
                </span>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Reason (optional)</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Family trip, medical appointment…"
              rows={2}
              className="w-full px-3 py-2.5 border rounded-xl text-sm bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            onClick={() => submitMut.mutate()}
            disabled={!form.startDate || !form.endDate || totalDays < 1 || submitMut.isPending}
            className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            data-testid="button-submit-leave"
          >
            {submitMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {submitMut.isPending ? "Submitting…" : `Submit${totalDays > 0 ? ` — ${totalDays}d` : ""}`}
          </button>
        </div>
      )}

      {/* Leave history */}
      {leaves.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">History</p>
          <div className="space-y-2">
            {leaves.map((l: any) => {
              const lt = LEAVE_TYPES.find(t => t.value === l.leaveType);
              return (
                <div key={l.id} className="bg-card border rounded-2xl px-4 py-3.5 flex items-center gap-3">
                  <div className="text-2xl shrink-0">{lt?.emoji || "📋"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-sm">
                        {format(parseISO(l.startDate), "d MMM")} – {format(parseISO(l.endDate), "d MMM yyyy")}
                      </p>
                      <LeaveStatusBadge status={l.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {lt?.label || l.leaveType}
                      {l.reason && ` · ${l.reason}`}
                    </p>
                    {l.adminNote && (
                      <p className="text-xs text-muted-foreground italic mt-0.5">Admin: {l.adminNote}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-black">{parseFloat(l.totalDays)}d</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {leaves.length === 0 && !showForm && (
        <div className="text-center py-14 bg-secondary/30 rounded-3xl border-2 border-dashed">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-bold text-muted-foreground">No leave applications yet</p>
          <p className="text-sm text-muted-foreground mt-1">Tap "Apply for Leave" to get started</p>
        </div>
      )}
    </div>
  );
}

// ─── Payslips Tab ─────────────────────────────────────────────────────────────

function PayslipsTab() {
  const { user } = useAuth();
  const { data: payslips = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/staff/payslips"], refetchInterval: 30_000 });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [printingPayslip, setPrintingPayslip] = useState<any | null>(null);

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading payslips…</p>
    </div>
  );

  if (payslips.length === 0) return (
    <div className="text-center py-20 bg-secondary/30 rounded-3xl border-2 border-dashed mt-2">
      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
      <p className="font-bold text-muted-foreground">No payslips yet</p>
      <p className="text-sm text-muted-foreground mt-1">Your payslips will appear once generated by admin</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {payslips.map((ps: any) => {
          const isOpen = expandedId === ps.id;
          const basicPay = parseFloat(ps.basicPay || "0");
          const mealAllowance = parseFloat(ps.mealAllowance || "0");
          const detailItems = ps.isMonthlyBased
            ? [
                { label: "Basic Salary", val: `S$${basicPay.toFixed(2)}`, highlight: false },
                { label: "Regular Hours", val: `${parseFloat(ps.regularHours).toFixed(1)}h`, highlight: false },
                { label: "Regular Pay", val: `S$${parseFloat(ps.regularPay).toFixed(2)}`, highlight: false },
                { label: "OT Hours", val: `${parseFloat(ps.overtimeHours).toFixed(1)}h`, highlight: false },
                { label: "OT Pay", val: `S$${parseFloat(ps.overtimePay).toFixed(2)}`, highlight: false },
                ...(mealAllowance > 0 ? [{ label: "Meal Allowance", val: `S$${mealAllowance.toFixed(2)}`, highlight: false }] : []),
                { label: "Leave Deduction", val: `-S$${parseFloat(ps.leaveDeduction).toFixed(2)}`, highlight: true, negative: true },
              ]
            : [
                { label: "Regular Hours", val: `${parseFloat(ps.regularHours).toFixed(1)}h`, highlight: false },
                { label: "OT Hours", val: `${parseFloat(ps.overtimeHours).toFixed(1)}h`, highlight: false },
                { label: "Regular Pay", val: `S$${parseFloat(ps.regularPay).toFixed(2)}`, highlight: false },
                { label: "OT Pay", val: `S$${parseFloat(ps.overtimePay).toFixed(2)}`, highlight: false },
                ...(mealAllowance > 0 ? [{ label: "Meal Allowance", val: `S$${mealAllowance.toFixed(2)}`, highlight: false }] : []),
                { label: "Leave Deduction", val: `-S$${parseFloat(ps.leaveDeduction).toFixed(2)}`, highlight: true, negative: true },
              ];

          return (
            <div key={ps.id} className="bg-card border rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedId(isOpen ? null : ps.id)}
                className="w-full px-4 py-4 flex items-center justify-between hover:bg-secondary/20 transition-colors"
                data-testid={`payslip-${ps.id}`}
              >
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">
                      {format(parseISO(ps.periodStart), "d MMM")} – {format(parseISO(ps.periodEnd), "d MMM yyyy")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Generated {format(new Date(ps.createdAt), "d MMM yyyy")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-black">S${parseFloat(ps.grossPay).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Gross Pay</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setPrintingPayslip(ps); }}
                    className="w-8 h-8 rounded-xl hover:bg-primary/10 text-primary flex items-center justify-center transition-colors"
                    title="Print payslip"
                    data-testid={`button-print-${ps.id}`}
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t bg-secondary/10 px-4 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {detailItems.map(({ label, val, negative, highlight }) => (
                      <div
                        key={label}
                        className={`rounded-xl p-2.5 border ${
                          highlight
                            ? "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900"
                            : "bg-card border-border/60"
                        }`}
                      >
                        <p className="text-[10px] text-muted-foreground font-black uppercase mb-0.5">{label}</p>
                        <p className={`font-bold text-sm ${negative ? "text-red-600" : ""}`}>{val}</p>
                      </div>
                    ))}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-2.5 col-span-1">
                      <p className="text-[10px] text-primary font-black uppercase mb-0.5">Gross Pay</p>
                      <p className="font-black text-primary">S${parseFloat(ps.grossPay).toFixed(2)}</p>
                    </div>
                  </div>

                  {ps.notes && (
                    <div className="bg-secondary/40 border rounded-xl px-3 py-2">
                      <p className="text-xs text-muted-foreground">{ps.notes}</p>
                    </div>
                  )}

                  <button
                    onClick={() => setPrintingPayslip(ps)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity text-sm"
                    data-testid={`button-view-payslip-${ps.id}`}
                  >
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

// ─── Receipts Tab ─────────────────────────────────────────────────────────────

const RECEIPT_CATEGORIES = [
  { value: "fuel",      label: "Fuel",       emoji: "⛽" },
  { value: "tools",     label: "Tools",      emoji: "🔧" },
  { value: "transport", label: "Transport",  emoji: "🚌" },
  { value: "meals",     label: "Meals",      emoji: "🍱" },
  { value: "parking",   label: "Parking",    emoji: "🅿️" },
  { value: "other",     label: "Other",      emoji: "📎" },
];

function ReceiptStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  const icon = status === "approved" ? "✓ " : status === "rejected" ? "✗ " : "⏱ ";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${map[status] || "bg-gray-100 text-gray-600"}`}>
      {icon}{status}
    </span>
  );
}

function ReceiptsTab({ userId }: { userId?: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    receiptDate: today,
    amount: "",
    category: "fuel",
    description: "",
  });
  const [filePreview, setFilePreview] = useState<{ data: string; type: string; name: string } | null>(null);

  const { data: myReceipts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/staff/receipts"],
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!filePreview) throw new Error("Please attach a receipt image or PDF");
      if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0)
        throw new Error("Please enter a valid amount");
      return apiRequest("POST", "/api/staff/receipts", {
        ...form,
        amount: parseFloat(form.amount).toFixed(2),
        fileData: filePreview.data,
        fileType: filePreview.type,
        fileName: filePreview.name,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/staff/receipts"] });
      toast({ title: "Receipt submitted!", description: "Admin will review it shortly." });
      setShowForm(false);
      setForm({ receiptDate: today, amount: "", category: "fuel", description: "" });
      setFilePreview(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/staff/receipts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/staff/receipts"] });
      toast({ title: "Receipt deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 8 MB per receipt", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // strip "data:image/jpeg;base64," prefix to get raw base64
      const base64 = dataUrl.split(",")[1];
      setFilePreview({ data: base64, type: file.type, name: file.name });
    };
    reader.readAsDataURL(file);
  }

  // Group receipts by month
  const grouped: Record<string, any[]> = {};
  for (const r of myReceipts) {
    const key = r.receiptDate?.slice(0, 7) || "Unknown";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }
  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading receipts…</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header + Upload button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-black text-slate-900">My Receipts</p>
          <p className="text-xs text-muted-foreground">Submit expense receipts for reimbursement</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          data-testid="button-new-receipt"
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          New Receipt
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
          <p className="font-bold text-sm text-slate-800">Submit a Receipt</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Date</label>
              <input
                type="date"
                value={form.receiptDate}
                max={today}
                onChange={e => setForm(f => ({ ...f, receiptDate: e.target.value }))}
                data-testid="input-receipt-date"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1 block">Amount (SGD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                data-testid="input-receipt-amount"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Category</label>
            <div className="flex flex-wrap gap-2">
              {RECEIPT_CATEGORIES.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: c.value }))}
                  data-testid={`button-category-${c.value}`}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    form.category === c.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-gray-200 hover:border-blue-300"
                  }`}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Description (optional)</label>
            <input
              type="text"
              placeholder="e.g. Petrol for job on 22 Mar"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              data-testid="input-receipt-description"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* File upload */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">Receipt Photo / PDF</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFile}
              className="hidden"
              data-testid="input-receipt-file"
            />
            {filePreview ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                <ImageIcon className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-xs font-semibold text-green-800 flex-1 truncate">{filePreview.name}</span>
                <button onClick={() => { setFilePreview(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-red-400 hover:text-red-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                data-testid="button-attach-file"
                className="w-full flex flex-col items-center justify-center gap-2 py-5 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-gray-400 hover:text-blue-600"
              >
                <Upload className="w-6 h-6" />
                <span className="text-xs font-semibold">Tap to attach photo or PDF (max 8 MB)</span>
              </button>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setFilePreview(null); }}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => uploadMut.mutate()}
              disabled={uploadMut.isPending}
              data-testid="button-submit-receipt"
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {uploadMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Submit
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {myReceipts.length === 0 && !showForm && (
        <div className="text-center py-20 bg-secondary/30 rounded-3xl border-2 border-dashed mt-2">
          <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="font-bold text-muted-foreground">No receipts yet</p>
          <p className="text-sm text-muted-foreground mt-1">Tap "New Receipt" to submit an expense</p>
        </div>
      )}

      {/* Receipts grouped by month */}
      {months.map(month => {
        const label = (() => { try { return format(parseISO(month + "-01"), "MMMM yyyy"); } catch { return month; } })();
        const total = grouped[month].reduce((s: number, r: any) => s + parseFloat(r.amount || "0"), 0);
        return (
          <div key={month}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">{label}</p>
              <p className="text-xs font-bold text-slate-600">Total: S${total.toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              {grouped[month].map((r: any) => {
                const cat = RECEIPT_CATEGORIES.find(c => c.value === r.category);
                return (
                  <div key={r.id} data-testid={`receipt-card-${r.id}`} className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg shrink-0">
                      {cat?.emoji || "📎"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-slate-800">S${parseFloat(r.amount).toFixed(2)}</p>
                        <span className="text-xs text-slate-500">{cat?.label || r.category}</span>
                        <ReceiptStatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{r.receiptDate}</p>
                      {r.description && <p className="text-xs text-slate-600 mt-0.5 truncate">{r.description}</p>}
                      {r.status === "rejected" && r.adminNote && (
                        <p className="text-xs text-red-600 mt-0.5">Admin note: {r.adminNote}</p>
                      )}
                    </div>
                    {r.status === "pending" && (
                      <button
                        onClick={() => { if (confirm("Delete this receipt?")) deleteMut.mutate(r.id); }}
                        data-testid={`button-delete-receipt-${r.id}`}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
