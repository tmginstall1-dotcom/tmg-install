import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSearch, useLocation } from "wouter";
import { format, differenceInMinutes, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from "date-fns";
import {
  Plus, Trash2, Pencil, Check, X, Users, Clock, UserPlus, LogIn, LogOut,
  ChevronDown, ChevronUp, Calendar, FileText, Settings2, Loader2, AlertCircle, MapPin, Printer,
  ArrowRight, DollarSign, ChevronLeft, ChevronRight, Navigation2, MoveRight, CircleDot
} from "lucide-react";
import OfficialPayslip from "@/components/OfficialPayslip";
import GpsMap from "@/components/GpsMap";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

const TEAM_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#14b8a6"];

function fmt(mins: number) {
  if (mins < 0) mins = 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    approved: "bg-emerald-50 text-emerald-700",
    rejected: "bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${map[status] || "bg-zinc-100 text-zinc-600"}`}>
      {status}
    </span>
  );
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual Leave",
  medical: "Medical Leave",
  unpaid: "Unpaid Leave",
  other: "Other",
};

export default function StaffManagement() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const tabParam = params.get("tab");
  const validTabs = ["teams", "payroll", "amendments", "leave", "payslips", "tracking"] as const;
  type TabKey = typeof validTabs[number];
  const [tab, setTab] = useState<TabKey>(
    validTabs.includes(tabParam as TabKey) ? (tabParam as TabKey) : "teams"
  );

  useEffect(() => {
    const p = new URLSearchParams(search);
    const t = p.get("tab");
    if (validTabs.includes(t as TabKey)) setTab(t as TabKey);
  }, [search]);

  const switchTab = (key: TabKey) => {
    setTab(key);
    navigate(`/admin/staff?tab=${key}`, { replace: true });
  };

  // Fetch pending counts for badge display
  const { data: pendingAmendments = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/attendance/amendments"],
    select: (d) => d.filter((a: any) => a.status === "pending"),
    refetchInterval: 30_000,
  });
  const { data: pendingLeave = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/leave", "pending"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/leave?status=pending`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const pendingAmendCount = (pendingAmendments as any[]).length;
  const pendingLeaveCount = (pendingLeave as any[]).length;

  const tabs = [
    { key: "teams" as const, label: "Teams & Staff", icon: Users, badge: 0 },
    { key: "payroll" as const, label: "Attendance", icon: Clock, badge: 0 },
    { key: "amendments" as const, label: "Amendments", icon: AlertCircle, badge: pendingAmendCount },
    { key: "leave" as const, label: "Leave", icon: Calendar, badge: pendingLeaveCount },
    { key: "payslips" as const, label: "Payslips", icon: FileText, badge: 0 },
    { key: "tracking" as const, label: "GPS Track", icon: Navigation2, badge: 0 },
  ];

  // Staff count for header display
  const { data: allStaffForHeader = [] } = useQuery<any[]>({ queryKey: ["/api/staff"] });

  return (
    <div className="min-h-screen pt-14 pb-16 lg:pl-56 bg-[#F5F5F7] overflow-x-hidden">

      {/* Light header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-5">
        <p className="text-xs text-zinc-400 mb-1">Management → Staff & HR</p>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-zinc-900">Staff & HR</h1>
          {(pendingAmendCount + pendingLeaveCount) > 0 && (
            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-amber-50 text-amber-700">
              {pendingAmendCount + pendingLeaveCount} pending
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500 mt-0.5">{(allStaffForHeader as any[]).length} staff members</p>
        
        {/* Tab bar */}
        <div className="flex border-b border-zinc-200 overflow-x-auto scrollbar-none mt-5 -mb-5">
          {tabs.map(({ key, label, icon: Icon, badge }) => (
            <button key={key} onClick={() => switchTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors border-b-2 ${
                tab === key
                  ? "text-zinc-900 border-blue-600"
                  : "text-zinc-500 border-transparent hover:text-zinc-900"
              }`}
              data-testid={`tab-${key}`}>
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
              {badge > 0 && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ml-1.5">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {tab === "teams" && <TeamsTab />}
        {tab === "payroll" && <PayrollTab />}
        {tab === "amendments" && <AmendmentsTab />}
        {tab === "leave" && <LeaveTab />}
        {tab === "payslips" && <PayslipsTab />}
        {tab === "tracking" && <GpsTrackingTab />}
      </div>
    </div>
  );
}

// ─── Teams Tab ───────────────────────────────────────────────────────────────

function TeamsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamColor, setNewTeamColor] = useState(TEAM_COLORS[0]);
  const [addingTeam, setAddingTeam] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: "", username: "", password: "" });
  const [addingStaff, setAddingStaff] = useState(false);
  const [paySettingsStaffId, setPaySettingsStaffId] = useState<number | null>(null);
  const [editStaffId, setEditStaffId] = useState<number | null>(null);

  const { data: teams = [] } = useQuery<any[]>({ queryKey: ["/api/teams"], refetchInterval: 30_000 });
  const { data: allStaff = [] } = useQuery<any[]>({ queryKey: ["/api/staff"], refetchInterval: 30_000 });

  const unassigned = allStaff.filter((s: any) => !s.teamId);

  const createTeamMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/teams", { name: newTeamName, color: newTeamColor }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/teams"] }); setNewTeamName(""); setAddingTeam(false); toast({ title: "Team created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteTeamMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/teams/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/teams"] }); qc.invalidateQueries({ queryKey: ["/api/staff"] }); toast({ title: "Team deleted" }); },
  });

  const assignMut = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: number; userId: number }) =>
      apiRequest("POST", `/api/teams/${teamId}/assign`, { userId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/teams"] }); qc.invalidateQueries({ queryKey: ["/api/staff"] }); },
  });

  const unassignMut = useMutation({
    mutationFn: (userId: number) => apiRequest("POST", `/api/staff/${userId}/unassign-team`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/teams"] }); qc.invalidateQueries({ queryKey: ["/api/staff"] }); },
  });

  const createStaffMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/staff", newStaff),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/staff"] });
      setNewStaff({ name: "", username: "", password: "" });
      setAddingStaff(false);
      toast({ title: "Staff account created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteStaffMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/staff/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/staff"] }); qc.invalidateQueries({ queryKey: ["/api/teams"] }); toast({ title: "Staff removed" }); },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Staff Pool */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">All Staff</h2>
            <button onClick={() => setAddingStaff(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          <div className="p-0">
            {addingStaff && (
              <div className="m-4 p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3">
                <input value={newStaff.name} onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))}
                  placeholder="Full name" className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" data-testid="input-staff-name" />
                <input value={newStaff.username} onChange={e => setNewStaff(s => ({ ...s, username: e.target.value }))}
                  placeholder="Username" className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" data-testid="input-staff-username" />
                <input value={newStaff.password} onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))}
                  type="password" placeholder="Password (min 6)" className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" data-testid="input-staff-password" />
                <div className="flex gap-2">
                  <button onClick={() => createStaffMut.mutate()} disabled={createStaffMut.isPending}
                    className="inline-flex flex-1 justify-center items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50" data-testid="button-create-staff">
                    {createStaffMut.isPending ? "Creating..." : "Create Account"}
                  </button>
                  <button onClick={() => setAddingStaff(false)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}

            <div className="divide-y divide-zinc-100">
              {allStaff.map((s: any) => (
                <div key={s.id} className="p-4 hover:bg-zinc-50 transition-colors">
                  <StaffRow staff={s} teams={teams}
                    onAssign={(teamId) => assignMut.mutate({ teamId, userId: s.id })}
                    onUnassign={() => unassignMut.mutate(s.id)}
                    onDelete={() => { if (confirm(`Remove ${s.name}? This cannot be undone.`)) deleteStaffMut.mutate(s.id); }}
                    onEdit={() => { setEditStaffId(editStaffId === s.id ? null : s.id); setPaySettingsStaffId(null); }}
                    onPaySettings={() => { setPaySettingsStaffId(paySettingsStaffId === s.id ? null : s.id); setEditStaffId(null); }} />
                  {editStaffId === s.id && <EditStaffForm staff={s} onClose={() => setEditStaffId(null)} />}
                  {paySettingsStaffId === s.id && <PaySettingsForm staff={s} onClose={() => setPaySettingsStaffId(null)} />}
                </div>
              ))}
              {allStaff.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-6">No staff yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Teams */}
      <div className="lg:col-span-2 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Teams</h2>
          <button onClick={() => setAddingTeam(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            data-testid="button-add-team">
            <Plus className="w-4 h-4" /> New Team
          </button>
        </div>

        {addingTeam && (
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
              placeholder="Team name (e.g. Team A)" autoFocus
              className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" data-testid="input-team-name" />
            <div className="flex gap-2 items-center">
              <span className="text-xs text-zinc-500 font-medium">Colour:</span>
              <div className="flex gap-1.5">
                {TEAM_COLORS.map(c => (
                  <button key={c} onClick={() => setNewTeamColor(c)}
                    className={`w-6 h-6 rounded-full transition-all ${newTeamColor === c ? "ring-2 ring-offset-2 ring-zinc-400 scale-110" : ""}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => createTeamMut.mutate()} disabled={!newTeamName || createTeamMut.isPending}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50">
                <Check className="w-4 h-4" /> Create
              </button>
              <button onClick={() => setAddingTeam(false)} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {teams.length === 0 && !addingTeam && (
          <div className="text-center py-16 bg-white border border-dashed border-zinc-200 rounded-xl">
            <Users className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-500">No teams yet</p>
            <p className="text-xs text-zinc-400 mt-1">Create a team to group staff together</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team: any) => (
            <TeamCard key={team.id} team={team} allStaff={allStaff}
              onDelete={() => { if (confirm(`Delete ${team.name}? Members will become unassigned.`)) deleteTeamMut.mutate(team.id); }}
              onRemoveMember={(uid) => unassignMut.mutate(uid)}
              onAddMember={(uid) => assignMut.mutate({ teamId: team.id, userId: uid })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PaySettingsForm({ staff, onClose }: { staff: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    monthlyRate: staff.monthlyRate || "0",
    hourlyRate: staff.hourlyRate || "0",
    overtimeRate: staff.overtimeRate || "0",
    annualLeaveEntitlement: staff.annualLeaveEntitlement ?? 14,
  });

  const mut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/pay-settings/${staff.id}`, {
      ...form,
      annualLeaveEntitlement: parseInt(String(form.annualLeaveEntitlement)),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/staff"] });
      onClose();
      toast({ title: "Pay settings updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const field = (label: string, hint: string, key: keyof typeof form, testId: string) => (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-zinc-700">{label}</label>
        <span className="text-[10px] text-zinc-500">{hint}</span>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500">S$</span>
        <input type="number" step="0.01" min="0" value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="h-9 w-full pl-8 pr-3 border border-zinc-300 rounded-lg text-sm bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          data-testid={testId} />
      </div>
    </div>
  );

  return (
    <div className="mx-0 mb-4 bg-white border border-zinc-200 rounded-xl overflow-hidden mt-2 shadow-sm">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
        <p className="text-sm font-semibold text-zinc-900">Pay Package: {staff.name}</p>
        <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {field("Monthly Salary", "SGD/mo", "monthlyRate", "input-monthly-rate")}
          {field("Hourly Rate", "first 8 hrs", "hourlyRate", "input-hourly-rate")}
          {field("Overtime Rate", "after 8 hrs", "overtimeRate", "input-overtime-rate")}
        </div>

        {/* Leave entitlement */}
        <div className="space-y-1 w-full sm:w-1/3">
          <div className="flex items-baseline justify-between">
            <label className="text-xs font-medium text-zinc-700">Annual Leave</label>
            <span className="text-[10px] text-zinc-500">days/yr</span>
          </div>
          <input type="number" min="0" max="30" value={form.annualLeaveEntitlement}
            onChange={e => setForm(f => ({ ...f, annualLeaveEntitlement: parseInt(e.target.value) || 0 }))}
            className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            data-testid="input-leave-entitlement" />
        </div>

        <div className="flex gap-3 pt-4 border-t border-zinc-100 mt-6">
          <button onClick={() => mut.mutate()} disabled={mut.isPending}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            data-testid="button-save-pay">
            {mut.isPending ? "Saving…" : "Save Pay Package"}
          </button>
          <button onClick={onClose} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function StaffRow({ staff, teams, onAssign, onUnassign, onDelete, onPaySettings, onEdit }: any) {
  const team = teams.find((t: any) => t.id === staff.teamId);
  const monthly = parseFloat(staff.monthlyRate || "0");
  const hourly  = parseFloat(staff.hourlyRate  || "0");
  const hasPayConfig = monthly > 0 || hourly > 0;
  const missingDetails = !staff.phone && !staff.nricFin;

  return (
    <div className="px-5 py-4 border-b border-zinc-100 last:border-0 hover:bg-zinc-50 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-semibold text-zinc-600 shrink-0">
            {staff.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 truncate">{staff.name}</p>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
              <span>@{staff.username}</span>
              {(staff.phone || staff.email) && (
                <>
                  <span>•</span>
                  <span className="truncate">{[staff.phone, staff.email].filter(Boolean).join(" · ")}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {team ? (
                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                  style={{ backgroundColor: team.color + "1A", color: team.color }}>
                  {team.name}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap bg-zinc-100 text-zinc-600">
                  Unassigned
                </span>
              )}
              {hasPayConfig && (
                <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap bg-emerald-50 text-emerald-700">
                  <DollarSign className="w-3 h-3" />
                  {monthly > 0 ? `S$${monthly.toFixed(0)}/mo` : `S$${hourly.toFixed(2)}/hr`}
                </span>
              )}
              {missingDetails && (
                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap bg-amber-50 text-amber-700">
                  Profile incomplete
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <select onChange={e => { if (e.target.value === "__unassign__") onUnassign(); else if (e.target.value) onAssign(parseInt(e.target.value)); e.target.value = ""; }}
            className="h-8 pl-2 pr-8 text-xs border border-zinc-200 rounded-md bg-white text-zinc-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-w-[120px]"
            defaultValue=""
            data-testid={`select-assign-team-${staff.id}`}>
            <option value="" disabled>{staff.teamId ? "Move" : "Assign"}</option>
            {staff.teamId && <option value="__unassign__">— Remove</option>}
            {teams.filter((t: any) => t.id !== staff.teamId).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button onClick={onEdit} title="Edit account"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            data-testid={`button-edit-staff-${staff.id}`}>
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onPaySettings} title="Pay settings"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            data-testid={`button-pay-settings-${staff.id}`}>
            <Settings2 className="w-4 h-4" />
          </button>
          <button onClick={onDelete} title="Delete staff"
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            data-testid={`button-delete-staff-${staff.id}`}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function EditStaffForm({ staff, onClose }: { staff: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: staff.name || "",
    username: staff.username || "",
    password: "",
    phone: staff.phone || "",
    email: staff.email || "",
    nricFin: staff.nricFin || "",
    startDate: staff.startDate || "",
    emergencyName: staff.emergencyName || "",
    emergencyPhone: staff.emergencyPhone || "",
  });

  const set = (key: keyof typeof form) => (e: any) => setForm(f => ({ ...f, [key]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => {
      const payload: any = {
        name: form.name,
        username: form.username,
        phone: form.phone || null,
        email: form.email || null,
        nricFin: form.nricFin || null,
        startDate: form.startDate || null,
        emergencyName: form.emergencyName || null,
        emergencyPhone: form.emergencyPhone || null,
      };
      if (form.password) payload.password = form.password;
      return apiRequest("PATCH", `/api/admin/staff/${staff.id}`, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/staff"] });
      onClose();
      toast({ title: "Staff profile updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sectionLabel = (text: string) => (
    <p className="text-xs font-semibold text-zinc-900 mt-5 mb-3 first:mt-0 pb-2 border-b border-zinc-100">{text}</p>
  );

  const field = (label: string, key: keyof typeof form, opts?: { type?: string; placeholder?: string; hint?: string }) => (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-zinc-700">{label}</label>
        {opts?.hint && <span className="text-[10px] text-zinc-500">{opts.hint}</span>}
      </div>
      <input
        type={opts?.type || "text"}
        value={form[key]}
        onChange={set(key)}
        placeholder={opts?.placeholder}
        className="h-9 w-full px-3 border border-zinc-300 rounded-lg text-sm bg-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        data-testid={`input-edit-${key}-${staff.id}`}
      />
    </div>
  );

  return (
    <div className="mx-0 mb-4 bg-white border border-zinc-200 rounded-xl overflow-hidden mt-2 shadow-sm">
      <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
        <p className="text-sm font-semibold text-zinc-900">Edit Profile: {staff.name}</p>
        <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-900 transition-colors"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-5 space-y-4">
        {/* Account */}
        {sectionLabel("Account")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Full Name", "name")}
          {field("Username", "username")}
        </div>
        {field("New Password", "password", { type: "password", placeholder: "Leave blank to keep current", hint: "optional" })}

        {/* Contact */}
        {sectionLabel("Contact Details")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Phone", "phone", { placeholder: "+65 9xxx xxxx" })}
          {field("Email", "email", { type: "email", placeholder: "name@example.com" })}
        </div>

        {/* Employment */}
        {sectionLabel("Employment")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("NRIC / FIN", "nricFin", { placeholder: "S1234567A" })}
          {field("Start Date", "startDate", { type: "date" })}
        </div>

        {/* Emergency */}
        {sectionLabel("Emergency Contact")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Contact Name", "emergencyName", { placeholder: "Full name" })}
          {field("Contact Phone", "emergencyPhone", { placeholder: "+65 9xxx xxxx" })}
        </div>

        <div className="flex gap-3 pt-4 border-t border-zinc-100 mt-6">
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.name || !form.username}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            data-testid={`button-save-staff-${staff.id}`}
          >
            {mut.isPending ? "Saving..." : "Save Profile"}
          </button>
          <button onClick={onClose} className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamCard({ team, allStaff, onDelete, onRemoveMember, onAddMember }: any) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(team.name);
  const qc = useQueryClient();
  const { toast } = useToast();

  const updateMut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/teams/${team.id}`, { name }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/teams"] }); setEditingName(false); toast({ title: "Team renamed" }); },
  });

  const nonMembers = allStaff.filter((s: any) => s.teamId !== team.id);

  return (
    <div className="bg-card border overflow-hidden" style={{ borderColor: team.color + "44" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: team.color + "11" }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3" style={{ background: team.color }} />
          {editingName ? (
            <div className="flex items-center gap-1">
              <input value={name} onChange={e => setName(e.target.value)} autoFocus
                className="px-2 py-0.5 text-sm border border-black/20 bg-white font-bold w-32 outline-none focus:border-black" />
              <button onClick={() => updateMut.mutate()} className="p-1 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditingName(false)} className="p-1 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <h3 className="font-black text-sm">{team.name}</h3>
          )}
          <span className="text-xs text-muted-foreground">({team.members?.length || 0} staff)</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditingName(true)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4">
        {team.members?.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No members yet — assign staff from the panel on the left</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {team.members.map((m: any) => (
              <div key={m.id} className="flex items-center gap-2 px-3 py-1.5 border bg-background text-sm font-semibold">
                <span className="w-6 h-6 flex items-center justify-center text-white text-[11px] font-black shrink-0"
                  style={{ background: team.color }}>{m.name.charAt(0)}</span>
                {m.name}
                <button onClick={() => onRemoveMember(m.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-0.5 p-0.5"
                  data-testid={`button-remove-member-${m.id}`}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {nonMembers.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Add member</p>
            <div className="flex flex-wrap gap-2">
              {nonMembers.map((s: any) => (
                <button key={s.id} onClick={() => onAddMember(s.id)}
                  className="flex items-center gap-1.5 px-3 py-2 border text-[10px] font-black uppercase tracking-[0.08em] hover:bg-slate-50 transition-colors"
                  data-testid={`button-add-member-${s.id}`}>
                  <Plus className="w-3.5 h-3.5" /> {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Attendance / Payroll Tab ──────────────────────────────────────────────────

// Staff initials avatar with deterministic color
const AVATAR_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#14b8a6","#06b6d4","#84cc16"];
function staffColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function StaffAvatar({ user, size = 10 }: { user: any; size?: number }) {
  const initials = user?.name?.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div style={{ backgroundColor: staffColor(user?.id ?? 0), width: size * 4, height: size * 4, fontSize: size * 1.5 }}
      className="rounded-full flex items-center justify-center text-white font-black shrink-0">
      {initials}
    </div>
  );
}

function PayrollTab() {
  const [view, setView] = useState<"today" | "timesheets">("today");
  return (
    <div className="space-y-6">
      {/* Sub-tab switcher */}
      <div className="flex border-b border-zinc-200 w-full">
        {([["today","Today's Roster"],["timesheets","Timesheets"]] as const).map(([v,l]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors border-b-2 ${view === v ? "text-zinc-900 border-blue-600" : "text-zinc-500 border-transparent hover:text-zinc-900"}`}
            data-testid={`tab-att-${v}`}>
            {l}
          </button>
        ))}
      </div>
      {view === "today" ? <TodayRoster /> : <TimesheetsView />}
    </div>
  );
}

// ─── Today's Roster ────────────────────────────────────────────────────────────

function TodayRoster() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(todayStr);
  const { data: staff = [] } = useQuery<any[]>({ queryKey: ["/api/staff"] });
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(new Date(date).getTime());
  const isToday = date === todayStr;

  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/attendance", date, date, ""],
    queryFn: async () => {
      if (!isValidDate) return [];
      const params = new URLSearchParams({ from: date + "T00:00:00+08:00", to: date + "T23:59:59+08:00" });
      const res = await fetch(`${API_BASE}/api/admin/attendance?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isValidDate,
    refetchInterval: 30000,
  });

  // Live GPS locations for currently clocked-in staff (today only, refresh every 30s)
  const { data: liveLocations = {} } = useQuery<Record<number, { lat: string; lng: string; recordedAt: string }>>({
    queryKey: ["/api/admin/live-locations"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/live-locations`, { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: isToday,
    refetchInterval: 30000,
  });

  // Build roster: each staff member with their log for the day (if any)
  const roster = (staff as any[]).map((s: any) => {
    const log = (logs as any[]).find((l: any) => l.userId === s.id);
    return { staff: s, log: log || null };
  });

  const clockedIn = roster.filter(r => r.log && !r.log.clockOutAt);
  const clockedOut = roster.filter(r => r.log && r.log.clockOutAt);
  const notClockedIn = roster.filter(r => !r.log);

  return (
    <div className="space-y-6">
      {/* Date picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white border border-zinc-300 rounded-lg px-3 py-2 h-9 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-colors">
          <Calendar className="w-4 h-4 text-zinc-400" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="text-sm font-medium text-zinc-900 bg-transparent outline-none" data-testid="input-roster-date" />
        </div>
        {!isToday && (
          <button onClick={() => setDate(todayStr)}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors">Back to Today</button>
        )}
        <span className="text-sm text-zinc-500 font-medium">
          {(() => { try { const d = new Date(date + "T12:00:00"); if (isNaN(d.getTime())) return ""; return (isToday ? "Today, " : "") + format(d, "EEEE, d MMMM yyyy"); } catch { return ""; } })()}
        </span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500 mb-1">Clocked in</p>
          <p className="text-3xl font-semibold text-emerald-600">{clockedIn.length}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500 mb-1">Not in</p>
          <p className="text-3xl font-semibold text-zinc-400">{notClockedIn.length}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-medium text-zinc-500 mb-1">Clocked out</p>
          <p className="text-3xl font-semibold text-zinc-900">{clockedOut.length}</p>
        </div>
      </div>

      {/* Staff roster list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full" />
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden divide-y divide-zinc-100">
          {roster.length === 0 && (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-500">No staff found.</p>
            </div>
          )}
          {/* Clocked In section */}
          {clockedIn.map(({ staff: s, log }) => (
            <RosterRow key={s.id} staff={s} log={log} status="in" liveLocation={liveLocations[s.id]} />
          ))}
          {/* Clocked Out section */}
          {clockedOut.map(({ staff: s, log }) => (
            <RosterRow key={s.id} staff={s} log={log} status="out" />
          ))}
          {/* Not Clocked In section */}
          {notClockedIn.map(({ staff: s }) => (
            <RosterRow key={s.id} staff={s} log={null} status="absent" />
          ))}
        </div>
      )}
    </div>
  );
}

// Module-level cache so all pill instances share results and avoid duplicate requests
const geocodeCache: Record<string, string> = {};

function useReverseGeocode(lat: string, lng: string) {
  const key = `${parseFloat(lat).toFixed(5)},${parseFloat(lng).toFixed(5)}`;
  const [address, setAddress] = useState<string>(geocodeCache[key] || "");

  useEffect(() => {
    if (geocodeCache[key]) { setAddress(geocodeCache[key]); return; }
    let cancelled = false;
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=17&addressdetails=1`, {
      headers: { "Accept-Language": "en" },
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const a = data?.address;
        // Build a short readable label: road + suburb/district
        const parts = [
          a?.road || a?.pedestrian || a?.footway || a?.path,
          a?.suburb || a?.neighbourhood || a?.quarter || a?.city_district || a?.town || a?.village || a?.city,
        ].filter(Boolean);
        const result = parts.length ? parts.join(", ") : (data?.display_name?.split(",").slice(0, 2).join(",") || key);
        geocodeCache[key] = result;
        setAddress(result);
      })
      .catch(() => { if (!cancelled) setAddress(key); });
    return () => { cancelled = true; };
  }, [key]);

  return address;
}

function GpsLocationPill({ lat, lng, label, color }: { lat: string; lng: string; label: string; color: "green" | "red" }) {
  const address = useReverseGeocode(lat, lng);
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
  const colorCls = color === "green"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
    : "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900";
  return (
    <a href={mapsUrl} target="_blank" rel="noreferrer"
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 border hover:opacity-80 transition-opacity ${colorCls}`}
      title={`${label}: ${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)} — Open in Google Maps`}>
      <MapPin className="w-2.5 h-2.5 shrink-0" />
      {label} · {address || `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}`}
    </a>
  );
}

function RosterRow({ staff, log, status, liveLocation }: {
  staff: any; log: any; status: "in" | "out" | "absent";
  liveLocation?: { lat: string; lng: string; recordedAt: string };
}) {
  const [mapOpen, setMapOpen] = useState<"in" | "out" | "live" | null>(null);
  const mins = log?.clockOutAt
    ? differenceInMinutes(new Date(log.clockOutAt), new Date(log.clockInAt))
    : null;

  const hasInGps  = !!(log?.clockInLat  && log?.clockInLng);
  const hasOutGps = !!(log?.clockOutLat && log?.clockOutLng);

  const activeGps = mapOpen === "out" && hasOutGps
    ? { lat: log.clockOutLat, lng: log.clockOutLng }
    : mapOpen === "in" && hasInGps
    ? { lat: log.clockInLat,  lng: log.clockInLng  }
    : mapOpen === "live" && liveLocation
    ? { lat: liveLocation.lat, lng: liveLocation.lng }
    : null;

  const osmSrc = activeGps
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${+activeGps.lng - 0.003},${+activeGps.lat - 0.003},${+activeGps.lng + 0.003},${+activeGps.lat + 0.003}&layer=mapnik&marker=${activeGps.lat},${activeGps.lng}`
    : null;

  const liveMinutesAgo = liveLocation
    ? Math.floor((Date.now() - new Date(liveLocation.recordedAt).getTime()) / 60000)
    : null;

  return (
    <div className="px-4 py-3" data-testid={`roster-row-${staff.id}`}>
      {/* Main row */}
      <div className="flex items-center gap-3">
        <StaffAvatar user={staff} size={10} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">{staff.name}</p>
          <p className="text-xs font-mono text-muted-foreground">@{staff.username}</p>

          {/* Status + GPS location pills inline */}
          {status === "in" && log && (
            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs font-bold text-emerald-600">Clocked in · {format(new Date(log.clockInAt), "h:mm a")}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {hasInGps && (
                  <>
                    <GpsLocationPill lat={log.clockInLat} lng={log.clockInLng} label="In" color="green" />
                    <button onClick={() => setMapOpen(p => p === "in" ? null : "in")}
                      className={`text-[10px] px-2 py-0.5 border font-bold transition-colors ${mapOpen === "in" ? "bg-slate-700 text-white border-slate-700" : "border-border text-muted-foreground hover:bg-secondary"}`}
                      data-testid={`button-map-in-${staff.id}`}>
                      {mapOpen === "in" ? "▲" : "Map ▾"}
                    </button>
                  </>
                )}
                {!hasInGps && <span className="text-[10px] text-amber-600 font-bold">⚠ No GPS at clock-in</span>}
              </div>
              {/* Live location */}
              {liveLocation && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5">
                    <Navigation2 className="w-2.5 h-2.5 animate-pulse shrink-0" />
                    Live · {liveMinutesAgo === 0 ? "just now" : `${liveMinutesAgo}m ago`}
                  </div>
                  <GpsLocationPill lat={liveLocation.lat} lng={liveLocation.lng} label="Now" color="green" />
                  <button onClick={() => setMapOpen(p => p === "live" ? null : "live")}
                    className={`text-[10px] px-2 py-0.5 border font-bold transition-colors ${mapOpen === "live" ? "bg-blue-700 text-white border-blue-700" : "border-border text-muted-foreground hover:bg-secondary"}`}
                    data-testid={`button-map-live-${staff.id}`}>
                    {mapOpen === "live" ? "▲" : "Map ▾"}
                  </button>
                </div>
              )}
              {!liveLocation && (
                <span className="text-[10px] text-slate-400 font-medium">No live GPS yet — updates every 30 s</span>
              )}
            </div>
          )}

          {status === "out" && log && (
            <div className="mt-1 space-y-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.clockInAt), "h:mm a")} – {format(new Date(log.clockOutAt), "h:mm a")}
                  {mins !== null && <span className="font-bold text-foreground ml-1">{fmt(mins)}</span>}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {hasInGps && (
                  <>
                    <GpsLocationPill lat={log.clockInLat} lng={log.clockInLng} label="In" color="green" />
                    <button onClick={() => setMapOpen(p => p === "in" ? null : "in")}
                      className={`text-[10px] px-2 py-0.5 border font-bold transition-colors ${mapOpen === "in" ? "bg-slate-700 text-white border-slate-700" : "border-border text-muted-foreground hover:bg-secondary"}`}
                      data-testid={`button-map-in-${staff.id}`}>
                      {mapOpen === "in" ? "▲" : "Map ▾"}
                    </button>
                  </>
                )}
                {hasOutGps && (
                  <>
                    <GpsLocationPill lat={log.clockOutLat} lng={log.clockOutLng} label="Out" color="red" />
                    <button onClick={() => setMapOpen(p => p === "out" ? null : "out")}
                      className={`text-[10px] px-2 py-0.5 border font-bold transition-colors ${mapOpen === "out" ? "bg-slate-700 text-white border-slate-700" : "border-border text-muted-foreground hover:bg-secondary"}`}
                      data-testid={`button-map-out-${staff.id}`}>
                      {mapOpen === "out" ? "▲" : "Map ▾"}
                    </button>
                  </>
                )}
                {!hasInGps && !hasOutGps && <span className="text-[10px] text-amber-600 font-bold">⚠ No GPS recorded</span>}
              </div>
            </div>
          )}

          {status === "absent" && (
            <span className="text-xs text-muted-foreground">Not clocked in</span>
          )}
        </div>
      </div>

      {/* Inline OSM map panel */}
      {mapOpen && osmSrc && (
        <div className="mt-3 overflow-hidden border border-black/10">
          {/* Header strip */}
          <div className={`flex items-center justify-between px-3 py-2 ${
            mapOpen === "in" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
          }`}>
            <div className="flex items-center gap-2 text-xs font-bold">
              <MapPin className="w-3.5 h-3.5" />
              {mapOpen === "in"
                ? `Clock-In · ${log?.clockInAt ? format(new Date(log.clockInAt), "h:mm a") : ""}`
                : `Clock-Out · ${log?.clockOutAt ? format(new Date(log.clockOutAt), "h:mm a") : ""}`}
            </div>
            <div className="flex items-center gap-2">
              <a href={`https://maps.google.com/?q=${activeGps!.lat},${activeGps!.lng}`}
                target="_blank" rel="noreferrer"
                className="text-[10px] font-bold underline opacity-90 hover:opacity-100">
                Open in Maps ↗
              </a>
              <button onClick={() => setMapOpen(null)} className="opacity-80 hover:opacity-100 ml-1">✕</button>
            </div>
          </div>
          {/* Map iframe */}
          <iframe
            src={osmSrc}
            title={`${staff.name} ${mapOpen === "in" ? "clock-in" : "clock-out"} location`}
            className="w-full"
            style={{ height: 240, border: "none" }}
            loading="lazy"
          />
          {/* Coords footer */}
          <div className="px-3 py-1.5 bg-muted/60 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
            <span>{parseFloat(activeGps!.lat).toFixed(6)}, {parseFloat(activeGps!.lng).toFixed(6)}</span>
            <a href={`https://maps.google.com/?q=${activeGps!.lat},${activeGps!.lng}`}
              target="_blank" rel="noreferrer"
              className="text-primary font-sans text-[10px] font-bold hover:underline">
              Google Maps ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timesheets — helpers ───────────────────────────────────────────────────────

function calcOT(logs: any[]): { totalMins: number; regularMins: number; otMins: number } {
  let totalMins = 0, regularMins = 0, otMins = 0;
  for (const l of logs) {
    if (!l.clockOutAt) continue;
    const mins = differenceInMinutes(new Date(l.clockOutAt), new Date(l.clockInAt));
    totalMins += mins;
    regularMins += Math.min(mins, 8 * 60);
    otMins += Math.max(0, mins - 8 * 60);
  }
  return { totalMins, regularMins, otMins };
}

// ─── Inline edit form for a single attendance log ──────────────────────────────

function EditLogForm({ log, queryKeys, onClose }: { log: any; queryKeys: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const toLocal = (d: string | null) => d ? format(new Date(d), "yyyy-MM-dd'T'HH:mm") : "";
  const [inVal,  setInVal]  = useState(toLocal(log.clockInAt));
  const [outVal, setOutVal] = useState(toLocal(log.clockOutAt));
  const [notes,  setNotes]  = useState(log.notes || "");

  const previewMins = inVal && outVal
    ? differenceInMinutes(new Date(outVal), new Date(inVal))
    : null;

  const saveMut = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/admin/attendance/${log.id}`, {
      clockInAt:  inVal  ? new Date(inVal).toISOString()  : undefined,
      clockOutAt: outVal ? new Date(outVal).toISOString() : null,
      notes,
    }),
    onSuccess: () => {
      queryKeys.forEach(k => qc.invalidateQueries({ queryKey: k }));
      toast({ title: "Record updated" });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <tr className="border-t bg-slate-50">
      <td colSpan={7} className="px-4 py-3">
        <div className="space-y-3">
          <p className="text-xs font-black text-primary uppercase tracking-wider">Editing record #{log.id}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block flex items-center gap-1">
                <LogIn className="w-3 h-3 text-emerald-500" /> Clock In
              </label>
              <input type="datetime-local" value={inVal} onChange={e => setInVal(e.target.value)}
                className="w-full px-3 py-2.5 border border-black/10 text-sm bg-white outline-none focus:border-black"
                data-testid={`input-edit-clockin-${log.id}`} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block flex items-center gap-1">
                <LogOut className="w-3 h-3 text-red-500" /> Clock Out
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">(leave blank = still in)</span>
              </label>
              <input type="datetime-local" value={outVal} onChange={e => setOutVal(e.target.value)}
                className="w-full px-3 py-2.5 border border-black/10 text-sm bg-white outline-none focus:border-black"
                data-testid={`input-edit-clockout-${log.id}`} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Admin Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note…"
              className="w-full px-3 py-2.5 border border-black/10 text-sm bg-white outline-none focus:border-black"
              data-testid={`input-edit-notes-${log.id}`} />
          </div>
          {previewMins !== null && previewMins >= 0 && (
            <p className="text-xs text-muted-foreground">
              Duration: <strong>{fmt(previewMins)}</strong>
              {previewMins > 8 * 60 && <span className="ml-2 text-amber-600 font-bold">({fmt(previewMins - 8 * 60)} OT)</span>}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-[10px] font-black uppercase tracking-[0.1em] disabled:opacity-60 hover:bg-neutral-800 transition-colors"
              data-testid={`button-save-log-${log.id}`}>
              {saveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button onClick={onClose}
              className="px-3 py-1.5 border border-black/10 text-[10px] font-black uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors"
              data-testid={`button-cancel-edit-${log.id}`}>
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Add record form ───────────────────────────────────────────────────────────

function AddRecordForm({
  staff, presetUserId, presetDate, queryKeys, onClose,
}: {
  staff: any[]; presetUserId?: number; presetDate?: string; queryKeys: any[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const defaultDate = presetDate || format(new Date(), "yyyy-MM-dd");
  const [userId,  setUserId]  = useState(String(presetUserId || (staff[0]?.id ?? "")));
  const [inVal,   setInVal]   = useState(defaultDate + "T08:00");
  const [outVal,  setOutVal]  = useState(defaultDate + "T17:00");
  const [notes,   setNotes]   = useState("");

  const previewMins = inVal && outVal
    ? differenceInMinutes(new Date(outVal), new Date(inVal))
    : null;

  const addMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/attendance", {
      userId: parseInt(userId),
      clockInAt:  new Date(inVal).toISOString(),
      clockOutAt: outVal ? new Date(outVal).toISOString() : null,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      queryKeys.forEach(k => qc.invalidateQueries({ queryKey: k }));
      toast({ title: "Record added ✓", description: staff.find((s:any) => String(s.id) === userId)?.name });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="border border-black/10 bg-slate-50 p-4 space-y-4"
      data-testid="add-record-form">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black flex items-center justify-center">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <p className="font-black text-sm uppercase tracking-[0.05em]">Add Attendance Record</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Staff selector */}
        <div className="sm:col-span-2">
          <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Staff Member</label>
          <select value={userId} onChange={e => setUserId(e.target.value)}
            className="w-full px-3 py-2 border border-black/10 text-sm bg-white outline-none focus:border-black"
            data-testid="select-add-staff">
            {staff.filter((s:any) => s.role === "staff").map((s:any) => (
              <option key={s.id} value={s.id}>{s.name} (@{s.username})</option>
            ))}
          </select>
        </div>

        {/* Clock In */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground mb-1 block flex items-center gap-1">
            <LogIn className="w-3 h-3 text-emerald-500" /> Clock In
          </label>
          <input type="datetime-local" value={inVal} onChange={e => setInVal(e.target.value)}
            className="w-full px-3 py-2.5 border border-black/10 text-sm bg-white outline-none focus:border-black"
            data-testid="input-add-clockin" />
        </div>

        {/* Clock Out */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground mb-1 block flex items-center gap-1">
            <LogOut className="w-3 h-3 text-red-500" /> Clock Out
            <span className="text-[10px] text-muted-foreground font-normal ml-1">(optional)</span>
          </label>
          <input type="datetime-local" value={outVal} onChange={e => setOutVal(e.target.value)}
            className="w-full px-3 py-2.5 border border-black/10 text-sm bg-white outline-none focus:border-black"
            data-testid="input-add-clockout" />
        </div>

        {/* Notes */}
        <div className="sm:col-span-2">
          <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Notes / Reason</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Staff forgot to clock in — manually added by admin"
            className="w-full px-3 py-2.5 border border-black/10 text-sm bg-white outline-none focus:border-black"
            data-testid="input-add-notes" />
        </div>
      </div>

      {/* Duration preview */}
      {previewMins !== null && previewMins > 0 && (
        <p className="text-xs text-muted-foreground">
          Duration: <strong>{fmt(previewMins)}</strong>
          {previewMins > 8 * 60 && (
            <span className="ml-2 text-amber-600 font-bold">(+{fmt(previewMins - 8 * 60)} OT)</span>
          )}
        </p>
      )}
      {previewMins !== null && previewMins <= 0 && (
        <p className="text-xs text-red-500 font-bold">⚠ Clock Out must be after Clock In</p>
      )}

      <div className="flex gap-2">
        <button onClick={() => addMut.mutate()} disabled={addMut.isPending || !userId || !inVal || (previewMins !== null && previewMins <= 0)}
          className="flex items-center gap-1.5 px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-[0.1em] disabled:opacity-50 hover:bg-neutral-800 transition-colors"
          data-testid="button-save-add-record">
          {addMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Record
        </button>
        <button onClick={onClose}
          className="px-4 py-2 border border-black/10 text-[10px] font-black uppercase tracking-[0.1em] hover:bg-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Timesheets View ────────────────────────────────────────────────────────────

function TimesheetsView() {
  const today = new Date();
  const [view,       setView]       = useState<"daily" | "period">("period");
  const [from,       setFrom]       = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [to,         setTo]         = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [dailyDate,  setDailyDate]  = useState(format(today, "yyyy-MM-dd"));
  const [filterUid,  setFilterUid]  = useState("");
  const [sortBy,     setSortBy]     = useState<"name" | "hours">("name");
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("asc");
  const [expandedId,  setExpandedId]  = useState<number | null>(null);
  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [confirmDel,  setConfirmDel]  = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPresetUid, setAddPresetUid] = useState<number | undefined>();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: staff = [] } = useQuery<any[]>({ queryKey: ["/api/staff"] });

  // Period-view date validation
  const isValid = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d).getTime());

  // Shared fetcher
  const fetchLogs = async (f: string, t: string, uid: string) => {
    if (!isValid(f) || !isValid(t)) return [];
    const params = new URLSearchParams({ from: f + "T00:00:00+08:00", to: t + "T23:59:59+08:00" });
    if (uid) params.set("userId", uid);
    const res = await fetch(`${API_BASE}/api/admin/attendance?${params}`, { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  // Period logs
  const periodKey = ["/api/admin/attendance", from, to, filterUid];
  const { data: periodLogs = [], isLoading: periodLoading } = useQuery<any[]>({
    queryKey: periodKey,
    queryFn: () => fetchLogs(from, to, filterUid),
    enabled: view === "period",
    refetchInterval: 30_000,
  });

  // Daily logs
  const dailyKey = ["/api/admin/attendance", dailyDate, dailyDate, ""];
  const { data: dailyLogs = [], isLoading: dailyLoading } = useQuery<any[]>({
    queryKey: dailyKey,
    queryFn: () => fetchLogs(dailyDate, dailyDate, ""),
    enabled: view === "daily",
    refetchInterval: 30000,
  });

  const sharedQueryKeys = [periodKey, dailyKey];

  // Delete mutation
  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/attendance/${id}`),
    onSuccess: () => {
      sharedQueryKeys.forEach(k => qc.invalidateQueries({ queryKey: k }));
      toast({ title: "Record deleted" });
      setConfirmDel(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Period view: build per-staff rows
  const buildStaffRows = (logs: any[]) => {
    const map: Record<number, any> = {};
    for (const log of logs) {
      if (log.user?.role !== "staff") continue;
      const uid = log.userId;
      if (!map[uid]) map[uid] = { user: log.user, logs: [] };
      map[uid].logs.push(log);
    }
    (staff as any[]).forEach((s: any) => {
      if (!map[s.id]) map[s.id] = { user: s, logs: [] };
    });
    let rows = Object.values(map).map((r: any) => ({ ...r, ...calcOT(r.logs), days: r.logs.filter((l: any) => l.clockOutAt).length }));
    rows.sort((a: any, b: any) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "hours") return dir * (a.totalMins - b.totalMins);
      return dir * a.user.name.localeCompare(b.user.name);
    });
    return rows;
  };

  const staffRows = buildStaffRows(periodLogs as any[]);
  const grandTotals = calcOT(staffRows.flatMap((r: any) => r.logs));

  const setPreset = (p: string) => {
    const t = new Date();
    if (p === "today")     { setFrom(format(t, "yyyy-MM-dd")); setTo(format(t, "yyyy-MM-dd")); }
    if (p === "week")      { setFrom(format(startOfWeek(t, { weekStartsOn: 1 }), "yyyy-MM-dd")); setTo(format(endOfWeek(t, { weekStartsOn: 1 }), "yyyy-MM-dd")); }
    if (p === "month")     { setFrom(format(startOfMonth(t), "yyyy-MM-dd")); setTo(format(endOfMonth(t), "yyyy-MM-dd")); }
    if (p === "prevMonth") { const pm = new Date(t.getFullYear(), t.getMonth() - 1, 1); setFrom(format(startOfMonth(pm), "yyyy-MM-dd")); setTo(format(endOfMonth(pm), "yyyy-MM-dd")); }
  };

  // Shared log-row render (used by both views)
  const renderLogRow = (log: any, showDate = true) => {
    const mins = log.clockOutAt ? differenceInMinutes(new Date(log.clockOutAt), new Date(log.clockInAt)) : null;
    const otMins = mins !== null ? Math.max(0, mins - 8 * 60) : 0;
    const isEditing = editingId === log.id;
    const isDeleting = confirmDel === log.id;

    if (isEditing) return (
      <EditLogForm key={`edit-${log.id}`} log={log} queryKeys={sharedQueryKeys} onClose={() => setEditingId(null)} />
    );

    return (
      <tr key={log.id} className={`border-t transition-colors ${isDeleting ? "bg-red-50 dark:bg-red-950/20" : "hover:bg-secondary/20"}`}
        data-testid={`log-row-${log.id}`}>
        {showDate && (
          <td className="px-3 py-2.5 font-medium text-sm whitespace-nowrap">
            {format(new Date(log.clockInAt), "EEE, d MMM")}
          </td>
        )}
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1 text-sm">
            <LogIn className="w-3 h-3 text-emerald-500 shrink-0" />
            <span className="font-mono">{format(new Date(log.clockInAt), "HH:mm")}</span>
          </div>
          {log.clockInLat && log.clockInLng && (
            <div className="mt-0.5">
              <GpsLocationPill lat={log.clockInLat} lng={log.clockInLng} label="In" color="green" />
            </div>
          )}
        </td>
        <td className="px-3 py-2.5">
          {log.clockOutAt ? (
            <>
              <div className="flex items-center gap-1 text-sm">
                <LogOut className="w-3 h-3 text-red-500 shrink-0" />
                <span className="font-mono">{format(new Date(log.clockOutAt), "HH:mm")}</span>
              </div>
              {log.clockOutLat && log.clockOutLng && (
                <div className="mt-0.5">
                  <GpsLocationPill lat={log.clockOutLat} lng={log.clockOutLng} label="Out" color="red" />
                </div>
              )}
            </>
          ) : (
            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5">Still in</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-right">
          {mins !== null ? (
            <div>
              <span className="font-black text-sm">{fmt(mins)}</span>
              {otMins > 0 && <span className="ml-1 text-[10px] font-bold text-amber-600">+{fmt(otMins)} OT</span>}
            </div>
          ) : <span className="text-muted-foreground text-sm">—</span>}
        </td>
        {log.notes && <td className="px-3 py-2.5 text-xs text-muted-foreground italic max-w-[120px] truncate">{log.notes}</td>}
        {!log.notes && <td className="px-3 py-2.5" />}
        <td className="px-3 py-2.5">
          {isDeleting ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-red-600 font-bold">Delete?</span>
              <button onClick={() => deleteMut.mutate(log.id)} disabled={deleteMut.isPending}
                className="text-[11px] font-bold text-white bg-red-500 px-2 py-0.5 rounded hover:bg-red-600"
                data-testid={`button-confirm-delete-${log.id}`}>
                {deleteMut.isPending ? "…" : "Yes"}
              </button>
              <button onClick={() => setConfirmDel(null)}
                className="text-[11px] font-bold border px-2 py-0.5 rounded hover:bg-secondary">
                No
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => { setEditingId(log.id); setConfirmDel(null); }}
                className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Edit" data-testid={`button-edit-log-${log.id}`}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setConfirmDel(log.id); setEditingId(null); }}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors"
                title="Delete" data-testid={`button-delete-log-${log.id}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const logTableHead = (showDate = true) => (
    <thead>
      <tr className="bg-secondary/40">
        {showDate && <th className="text-left px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Date</th>}
        <th className="text-left px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Clock In</th>
        <th className="text-left px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Clock Out</th>
        <th className="text-right px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Hours</th>
        <th className="text-left px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Notes</th>
        <th className="px-3 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Actions</th>
      </tr>
    </thead>
  );

  return (
    <div className="space-y-6">
      {/* ── Controls bar ─────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm space-y-4">
        {/* View toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex border border-zinc-200 rounded-lg overflow-hidden h-9">
            {(["daily","period"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 text-sm font-medium transition-colors ${view === v ? "bg-zinc-100 text-zinc-900" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
                data-testid={`button-view-${v}`}>
                {v === "daily" ? "Daily" : "Period"}
              </button>
            ))}
          </div>

          {/* Add Record button — always visible */}
          <button
            onClick={() => { setAddPresetUid(undefined); setShowAddForm(f => !f); }}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors ${showAddForm ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}
            data-testid="button-open-add-record">
            <Plus className="w-4 h-4" />
            Add Record
          </button>

          {view === "period" && (
            <div className="flex gap-2 ml-auto flex-wrap">
              {[["today","Today"],["week","This Week"],["month","This Month"],["prevMonth","Last Month"]].map(([v,l]) => (
                <button key={v} onClick={() => setPreset(v)}
                  className="h-8 px-3 rounded-md border border-zinc-200 bg-white text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-4 items-end">
          {view === "daily" ? (
            <div className="flex items-center gap-3">
              <button onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate()-1); setDailyDate(format(d,"yyyy-MM-dd")); }}
                className="w-9 h-9 rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 transition-colors" title="Previous day">
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Date</label>
                <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
                  className="h-9 px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" data-testid="input-daily-date" />
              </div>
              <button onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate()+1); setDailyDate(format(d,"yyyy-MM-dd")); }}
                className="w-9 h-9 mt-[22px] rounded-lg border border-zinc-200 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 transition-colors" title="Next day">
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
              <button onClick={() => setDailyDate(format(today, "yyyy-MM-dd"))}
                className="h-9 mt-[22px] px-3 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors">
                Today
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">From</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="h-9 px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" data-testid="input-from-date" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">To</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="h-9 px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" data-testid="input-to-date" />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Staff</label>
                <select value={filterUid} onChange={e => setFilterUid(e.target.value)}
                  className="h-9 px-3 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors min-w-[150px]" data-testid="select-staff-filter">
                  <option value="">All Staff</option>
                  {(staff as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700 mb-1 block">Sort By</label>
                <div className="flex gap-2 h-9">
                  {[["name","Name"],["hours","Hours"]].map(([v,l]) => (
                    <button key={v} onClick={() => { if (sortBy === v) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(v as any); setSortDir("asc"); } }}
                      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${sortBy === v ? "bg-zinc-900 text-white" : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"}`}>
                      {l} {sortBy === v ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Record form (expanded inline) ───────────────────────── */}
      {showAddForm && (
        <AddRecordForm
          staff={staff as any[]}
          presetUserId={addPresetUid}
          presetDate={view === "daily" ? dailyDate : undefined}
          queryKeys={sharedQueryKeys}
          onClose={() => { setShowAddForm(false); setAddPresetUid(undefined); }}
        />
      )}

      {/* ── Stats ───────────────────────────────────────────────────── */}
      {view === "period" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Hours", val: fmt(grandTotals.totalMins), color: "text-zinc-900" },
            { label: "Regular", val: fmt(grandTotals.regularMins), color: "text-emerald-600" },
            { label: "Overtime", val: fmt(grandTotals.otMins), color: "text-amber-600" },
            { label: "Staff w/ Records", val: `${staffRows.filter((r:any)=>r.days>0).length} / ${staffRows.length}`, color: "text-zinc-900" },
          ].map(c => (
            <div key={c.label} className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
              <p className="text-sm font-medium text-zinc-500 mb-1">{c.label}</p>
              <p className={`text-2xl font-semibold ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Daily View ───────────────────────────────────────────────── */}
      {view === "daily" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900">
              {isValid(dailyDate) ? (() => { try { return format(new Date(dailyDate + "T12:00:00"), "EEEE, d MMMM yyyy"); } catch { return dailyDate; } })() : "Select a date"}
            </h3>
            {dailyLoading && <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-700 rounded-full animate-spin" />}
          </div>
          <div className="space-y-4">
            {(staff as any[]).filter((s:any)=>s.role==="staff").map((s: any) => {
              const sLogs = (dailyLogs as any[]).filter((l:any) => l.userId === s.id);
              const hasRecords = sLogs.length > 0;
              return (
                <div key={s.id} className={`bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden ${!hasRecords ? "opacity-75" : ""}`}
                  data-testid={`daily-staff-${s.id}`}>
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100 bg-zinc-50/50">
                    <StaffAvatar user={s} size={10} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-zinc-900">{s.name}</p>
                      <p className="text-xs text-zinc-500">@{s.username}</p>
                    </div>
                    {hasRecords ? (
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-emerald-600">{fmt(calcOT(sLogs).totalMins)}</span>
                        <button
                          onClick={() => { setAddPresetUid(s.id); setShowAddForm(true); }}
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition-colors"
                          title={`Add record for ${s.name}`}
                          data-testid={`button-quick-add-${s.id}`}>
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddPresetUid(s.id); setShowAddForm(true); }}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition-colors"
                        title={`Add record for ${s.name}`}
                        data-testid={`button-add-${s.id}`}>
                        <Plus className="w-3.5 h-3.5" /> Add Record
                      </button>
                    )}
                  </div>
                  {hasRecords && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        {logTableHead(false)}
                        <tbody className="divide-y divide-zinc-100">
                          {sLogs.map((log: any) => renderLogRow(log, false))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Period View ─────────────────────────────────────────────── */}
      {view === "period" && (
        periodLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-700 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {staffRows.map((row: any) => (
              <div key={row.user?.id} className={`bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden ${row.days === 0 ? "opacity-75" : ""}`}
                data-testid={`period-staff-${row.user?.id}`}>
                {/* Staff header */}
                <button
                  onClick={() => row.logs.length > 0 && setExpandedId(expandedId === row.user?.id ? null : row.user?.id)}
                  className={`w-full px-5 py-4 flex items-center gap-4 transition-colors bg-zinc-50/50 hover:bg-zinc-50 border-b border-zinc-100 ${row.logs.length > 0 ? "cursor-pointer" : "cursor-default"}`}
                  data-testid={`button-expand-staff-${row.user?.id}`}>
                  <StaffAvatar user={row.user} size={10} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-sm text-zinc-900">{row.user?.name}</p>
                    <p className="text-xs text-zinc-500">@{row.user?.username}</p>
                    <p className="text-xs mt-1">
                      {row.days > 0
                        ? <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700">{row.days} day{row.days !== 1 ? "s" : ""} clocked</span>
                        : <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold bg-zinc-100 text-zinc-600">No records this period</span>}
                    </p>
                  </div>
                  {/* Hour breakdown */}
                  {row.totalMins > 0 && (
                    <div className="text-right shrink-0 mr-4">
                      <p className="font-semibold text-lg text-zinc-900">{fmt(row.totalMins)}</p>
                      <div className="flex gap-2 justify-end mt-0.5">
                        <span className="text-[11px] font-medium text-emerald-600">{fmt(row.regularMins)} reg</span>
                        {row.otMins > 0 && <span className="text-[11px] font-medium text-amber-600">{fmt(row.otMins)} OT</span>}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{row.days > 0 ? fmt(Math.round(row.totalMins / row.days)) + " avg/day" : ""}</p>
                    </div>
                  )}
                  {row.logs.length > 0 && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-zinc-200 text-zinc-500 shrink-0">
                      {expandedId === row.user?.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  )}
                </button>

                {/* Expanded log table */}
                {expandedId === row.user?.id && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      {logTableHead(true)}
                      <tbody className="divide-y divide-zinc-100">
                        {row.logs.map((log: any) => renderLogRow(log, true))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ─── Amendments Tab ────────────────────────────────────────────────────────────


function AmendmentsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: amendments = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/attendance/amendments"], refetchInterval: 30_000 });
  const [notes, setNotes] = useState<Record<number, string>>({});

  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      apiRequest("PATCH", `/api/admin/attendance/amendments/${id}`, { status, adminNote: notes[id] || "" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/attendance/amendments"] });
      toast({ title: "Amendment reviewed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-700 rounded-full animate-spin" /></div>;

  if (amendments.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-dashed border-zinc-200 rounded-xl">
        <AlertCircle className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-zinc-500">No amendment requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {amendments.map((a: any) => (
        <div key={a.id} className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <p className="font-semibold text-sm text-zinc-900">{a.user?.name}</p>
                <StatusBadge status={a.status} />
              </div>
              <p className="text-xs text-zinc-500">Submitted {format(new Date(a.createdAt), "d MMM yyyy HH:mm")}</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {/* Before → After comparison */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
              {/* Original */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Original</p>
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <LogIn className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{a.originalClockIn ? format(new Date(a.originalClockIn), "d MMM, HH:mm") : <span className="text-zinc-400">—</span>}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{a.originalClockOut ? format(new Date(a.originalClockOut), "d MMM, HH:mm") : <span className="text-zinc-400">—</span>}</span>
                </div>
              </div>
              {/* Arrow */}
              <div className="flex flex-col items-center justify-center">
                <ArrowRight className="w-5 h-5 text-zinc-400" />
              </div>
              {/* Requested */}
              <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-2 shadow-sm">
                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest mb-1">Requested</p>
                <div className="flex items-center gap-2 text-sm text-zinc-900 font-medium">
                  <LogIn className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{a.requestedClockIn ? format(new Date(a.requestedClockIn), "d MMM, HH:mm") : <span className="text-zinc-400 font-normal">—</span>}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-zinc-900 font-medium">
                  <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{a.requestedClockOut ? format(new Date(a.requestedClockOut), "d MMM, HH:mm") : <span className="text-zinc-400 font-normal">—</span>}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-zinc-50 rounded-lg p-3 border border-zinc-100">
              <p className="text-xs font-semibold text-zinc-700 mb-1">Staff Reason</p>
              <p className="text-sm text-zinc-600">{a.reason}</p>
            </div>
            
            {a.status === 'pending' && (
              <div className="space-y-3 pt-2">
                <textarea value={notes[a.id] || ""} onChange={e => setNotes(n => ({ ...n, [a.id]: e.target.value }))}
                  placeholder="Admin note (optional)" rows={2}
                  className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors" />
                <div className="flex gap-3">
                  <button onClick={() => reviewMut.mutate({ id: a.id, status: "approved" })}
                    disabled={reviewMut.isPending}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    data-testid={`button-approve-amendment-${a.id}`}>
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button onClick={() => reviewMut.mutate({ id: a.id, status: "rejected" })}
                    disabled={reviewMut.isPending}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    data-testid={`button-reject-amendment-${a.id}`}>
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            )}
            {a.adminNote && (
              <p className="text-xs text-zinc-500 italic mt-2">Admin note: {a.adminNote}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Leave Tab ─────────────────────────────────────────────────────────────────

function LeaveTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data: leaves = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/leave", statusFilter],
    queryFn: async () => {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await fetch(`${API_BASE}/api/admin/leave${params}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 30_000,
  });

  // Fetch all leaves for the year to compute balances
  const { data: allLeaves = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/leave", "all"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/leave`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 30_000,
  });

  // Build per-staff used days map (approved annual leave only)
  const usedAnnualByStaff = (allLeaves as any[]).reduce((acc: Record<number, number>, l: any) => {
    if (l.leaveType === "annual" && l.status === "approved" && l.userId) {
      acc[l.userId] = (acc[l.userId] || 0) + parseFloat(l.totalDays || "0");
    }
    return acc;
  }, {});

  // Pending counts per filter
  const pendingCount = (allLeaves as any[]).filter((l: any) => l.status === "pending").length;

  const reviewMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      apiRequest("PATCH", `/api/admin/leave/${id}`, { status, adminNote: notes[id] || "" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/leave"] });
      toast({ title: "Leave request reviewed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {([["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]] as const).map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.1em] border transition-all ${statusFilter === v ? "bg-black text-white border-black" : "border-black/10 hover:border-black/30 hover:bg-slate-50"}`}
            data-testid={`filter-leave-${v}`}>
            {l}
            {v === "pending" && pendingCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : leaves.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-black/20">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No {statusFilter !== "all" ? statusFilter : ""} leave requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(leaves as any[]).map((l: any) => {
            const entitlement = parseInt(l.user?.annualLeaveEntitlement || "14");
            const usedDays = usedAnnualByStaff[l.userId] || 0;
            const remaining = entitlement - usedDays;
            const isAnnual = l.leaveType === "annual";

            return (
              <div key={l.id} className="bg-white border border-black/[0.07] overflow-hidden">
                {/* Card header */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-bold">{l.user?.name}</p>
                        <StatusBadge status={l.status} />
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 uppercase tracking-[0.06em]">
                          {LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <span className="font-bold text-foreground">
                          {format(parseISO(l.startDate), "d MMM")} – {format(parseISO(l.endDate), "d MMM yyyy")}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          Submitted {format(new Date(l.createdAt || l.startDate), "d MMM")}
                        </span>
                      </div>
                      {l.reason && <p className="text-xs text-muted-foreground mt-1 italic">"{l.reason}"</p>}
                    </div>
                    {/* Days requested + balance */}
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-black leading-none">{parseFloat(l.totalDays)}d</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">requested</p>
                      {isAnnual && (
                        <p className={`text-[10px] font-bold mt-1 ${remaining < 0 ? "text-red-500" : remaining < 3 ? "text-amber-600" : "text-emerald-600"}`}>
                          {remaining < 0 ? `${Math.abs(remaining).toFixed(1)}d over` : `${remaining.toFixed(1)}d left`}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Leave balance bar for annual leave */}
                  {isAnnual && (
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{usedDays.toFixed(1)} used of {entitlement} days entitlement</span>
                        <span className={remaining < 0 ? "text-red-500 font-bold" : ""}>{remaining > 0 ? `${remaining.toFixed(1)} remaining` : "Exceeded"}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${remaining < 0 ? "bg-red-500" : remaining < 3 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, (usedDays / entitlement) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {l.status === 'pending' && (
                  <div className="px-4 pb-4 space-y-2 border-t pt-3">
                    <textarea value={notes[l.id] || ""} onChange={e => setNotes(n => ({ ...n, [l.id]: e.target.value }))}
                      placeholder="Admin note (optional)" rows={2}
                      className="w-full px-3 py-2 text-sm border border-black/10 bg-white outline-none focus:border-black resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => reviewMut.mutate({ id: l.id, status: "approved" })}
                        disabled={reviewMut.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-[0.1em] hover:bg-emerald-700 disabled:opacity-50"
                        data-testid={`button-approve-leave-${l.id}`}>
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button onClick={() => reviewMut.mutate({ id: l.id, status: "rejected" })}
                        disabled={reviewMut.isPending}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.1em] hover:bg-red-700 disabled:opacity-50"
                        data-testid={`button-reject-leave-${l.id}`}>
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </div>
                )}
                {l.adminNote && (
                  <p className="px-4 pb-3 text-xs text-muted-foreground italic border-t pt-2">Admin note: {l.adminNote}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Payslips Tab ──────────────────────────────────────────────────────────────

function PayslipsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const today = new Date();

  const { data: staff = [] } = useQuery<any[]>({ queryKey: ["/api/staff"] });
  const [filterUserId, setFilterUserId] = useState<string>("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({
    userId: "",
    periodStart: format(startOfMonth(today), "yyyy-MM-dd"),
    periodEnd: format(endOfMonth(today), "yyyy-MM-dd"),
    notes: "",
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [printingPayslip, setPrintingPayslip] = useState<any | null>(null);

  const { data: payslips = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/payslips", filterUserId],
    queryFn: async () => {
      const params = filterUserId ? `?userId=${filterUserId}` : "";
      const res = await fetch(`${API_BASE}/api/admin/payslips${params}`, { credentials: "include" });
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const generateMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/payslips/generate", {
      userId: parseInt(genForm.userId),
      periodStart: genForm.periodStart,
      periodEnd: genForm.periodEnd,
      notes: genForm.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/payslips"] });
      setShowGenerate(false);
      toast({ title: "Payslip generated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/payslips/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/payslips"] }); toast({ title: "Payslip deleted" }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)}
          className="px-3 py-2 border border-black/10 text-sm bg-white outline-none focus:border-black min-w-[150px]" data-testid="select-payslip-staff">
          <option value="">All Staff</option>
          {staff.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={() => setShowGenerate(!showGenerate)}
          className="flex items-center gap-1.5 px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-[0.1em] hover:bg-neutral-800 transition-colors"
          data-testid="button-generate-payslip">
          <Plus className="w-4 h-4" /> Generate Payslip
        </button>
      </div>

      {showGenerate && (
        <div className="bg-slate-50 border border-black/10 p-4 space-y-3">
          <p className="font-black text-sm uppercase tracking-[0.05em]">Generate Payslip</p>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Staff Member</label>
            <select value={genForm.userId} onChange={e => setGenForm(f => ({ ...f, userId: e.target.value }))}
              className="w-full px-3 py-2 border border-black/10 text-sm bg-white outline-none focus:border-black" data-testid="select-gen-staff">
              <option value="">Select staff member...</option>
              {staff.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} (@{s.username})
                </option>
              ))}
            </select>
          </div>
          {/* Selected staff info card */}
          {genForm.userId && (() => {
            const s = (staff as any[]).find((x: any) => String(x.id) === genForm.userId);
            return s ? (
              <div className="bg-white border border-black/10 px-3 py-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-black/10 text-black font-black text-sm flex items-center justify-center shrink-0">
                    {s.name.split(" ").map((w: string) => w[0]).slice(0,2).join("").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{s.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">@{s.username}</p>
                  </div>
                </div>
                {/* Pay package summary — 3 components */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-50 border border-black/[0.06] px-2 py-1.5 text-center">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Monthly</p>
                    <p className="text-xs font-black text-foreground font-mono mt-0.5">
                      S${parseFloat(s.monthlyRate || "0").toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-black/[0.06] px-2 py-1.5 text-center">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Reg/hr</p>
                    <p className="text-xs font-black text-foreground font-mono mt-0.5">
                      S${parseFloat(s.hourlyRate || "0").toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 px-2 py-1.5 text-center">
                    <p className="text-[10px] text-amber-700 font-bold uppercase tracking-wide">OT/hr</p>
                    <p className="text-xs font-black text-amber-700 font-mono mt-0.5">
                      S${parseFloat(s.overtimeRate || "0").toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          {/* Period quick presets */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-2 block">Pay Period</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {[
                { label: "This Month", fn: () => { const t = new Date(); return [format(startOfMonth(t), "yyyy-MM-dd"), format(endOfMonth(t), "yyyy-MM-dd")]; } },
                { label: "Last Month", fn: () => { const pm = new Date(); pm.setMonth(pm.getMonth() - 1); return [format(startOfMonth(pm), "yyyy-MM-dd"), format(endOfMonth(pm), "yyyy-MM-dd")]; } },
                { label: "2 Months Ago", fn: () => { const pm = new Date(); pm.setMonth(pm.getMonth() - 2); return [format(startOfMonth(pm), "yyyy-MM-dd"), format(endOfMonth(pm), "yyyy-MM-dd")]; } },
              ].map(({ label, fn }) => (
                <button key={label} type="button"
                  onClick={() => { const [s, e] = fn(); setGenForm(f => ({ ...f, periodStart: s, periodEnd: e })); }}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] border border-black/10 hover:bg-white transition-colors">
                  {label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">From</label>
                <input type="date" value={genForm.periodStart} onChange={e => setGenForm(f => ({ ...f, periodStart: e.target.value }))}
                  className="w-full px-3 py-2 border border-black/10 text-sm bg-white outline-none focus:border-black" data-testid="input-period-start" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">To</label>
                <input type="date" value={genForm.periodEnd} onChange={e => setGenForm(f => ({ ...f, periodEnd: e.target.value }))}
                  className="w-full px-3 py-2 border border-black/10 text-sm bg-white outline-none focus:border-black" data-testid="input-period-end" />
              </div>
            </div>
          </div>
          <textarea value={genForm.notes} onChange={e => setGenForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)" rows={2}
            className="w-full px-3 py-2 text-sm border border-black/10 bg-white outline-none focus:border-black resize-none" />
          <div className="flex gap-2">
            <button onClick={() => generateMut.mutate()} disabled={!genForm.userId || generateMut.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-black text-white text-[10px] font-black uppercase tracking-[0.1em] disabled:opacity-50 hover:bg-neutral-800 transition-colors"
              data-testid="button-confirm-generate">
              {generateMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : "Generate"}
            </button>
            <button onClick={() => setShowGenerate(false)}
              className="px-4 py-2 border border-black/10 text-[10px] font-black uppercase tracking-[0.1em] hover:bg-white transition-colors">Cancel</button>
          </div>
          <p className="text-xs text-muted-foreground">Payslip is auto-calculated from clock-in/out records and leave deductions for the period.</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : payslips.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-black/20">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No payslips yet</p>
          <p className="text-sm text-muted-foreground">Generate payslips for your staff above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.map((ps: any) => {
            const isOpen = expandedId === ps.id;
            const isMonthlyBased = parseFloat(ps.user?.monthlyRate || "0") > 0;
            const basicPay = parseFloat(ps.basicPay || "0");
            const mealAllowance = parseFloat(ps.mealAllowance || "0");
            const detailItems = isMonthlyBased
              ? [
                  { label: "Basic Salary", val: `S$${basicPay.toFixed(2)}` },
                  { label: "Regular Hours", val: `${parseFloat(ps.regularHours).toFixed(1)}h` },
                  { label: "Regular Pay", val: `S$${parseFloat(ps.regularPay).toFixed(2)}` },
                  { label: "OT Hours", val: `${parseFloat(ps.overtimeHours).toFixed(1)}h` },
                  { label: "OT Pay", val: `S$${parseFloat(ps.overtimePay).toFixed(2)}` },
                  ...(mealAllowance > 0 ? [{ label: "Meal Allowance", val: `S$${mealAllowance.toFixed(2)}` }] : []),
                  { label: "Leave Deduction", val: `-S$${parseFloat(ps.leaveDeduction).toFixed(2)}` },
                ]
              : [
                  { label: "Regular Hours", val: `${parseFloat(ps.regularHours).toFixed(1)}h` },
                  { label: "OT Hours", val: `${parseFloat(ps.overtimeHours).toFixed(1)}h` },
                  { label: "Regular Pay", val: `S$${parseFloat(ps.regularPay).toFixed(2)}` },
                  { label: "OT Pay", val: `S$${parseFloat(ps.overtimePay).toFixed(2)}` },
                  ...(mealAllowance > 0 ? [{ label: "Meal Allowance", val: `S$${mealAllowance.toFixed(2)}` }] : []),
                  { label: "Leave Deduction", val: `-S$${parseFloat(ps.leaveDeduction).toFixed(2)}` },
                ];
            return (
              <div key={ps.id} className="bg-white border border-black/[0.07] overflow-hidden">
                <button onClick={() => setExpandedId(isOpen ? null : ps.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  data-testid={`payslip-admin-${ps.id}`}>
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-9 h-9 bg-black/10 text-black font-black text-sm flex items-center justify-center shrink-0">
                      {ps.user?.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold">{ps.user?.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">@{ps.user?.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(ps.periodStart), "d MMM")} – {format(parseISO(ps.periodEnd), "d MMM yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xl font-black text-primary">S${parseFloat(ps.grossPay).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Gross Pay</p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setPrintingPayslip(ps); }}
                      className="p-2 hover:bg-black/5 text-black/60 transition-colors"
                      title="View / Print official payslip"
                      data-testid={`button-print-${ps.id}`}>
                      <Printer className="w-4 h-4" />
                    </button>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t p-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      {detailItems.map(({ label, val }) => (
                        <div key={label} className="bg-slate-50 border border-black/[0.06] p-2.5">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">{label}</p>
                          <p className="font-bold">{val}</p>
                        </div>
                      ))}
                      <div className="bg-black text-white p-2.5">
                        <p className="text-[10px] font-bold uppercase mb-0.5 text-white/60">Gross Pay</p>
                        <p className="font-black">S${parseFloat(ps.grossPay).toFixed(2)}</p>
                      </div>
                    </div>
                    {ps.notes && (
                      <div className="bg-slate-50 px-3 py-2">
                        <p className="text-xs text-muted-foreground">{ps.notes}</p>
                      </div>
                    )}
                    <button onClick={() => { if (confirm("Delete this payslip?")) deleteMut.mutate(ps.id); }}
                      className="flex items-center gap-1.5 text-xs text-destructive font-bold hover:underline"
                      data-testid={`button-delete-payslip-${ps.id}`}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete Payslip
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {printingPayslip && (
        <OfficialPayslip
          payslip={printingPayslip}
          onClose={() => setPrintingPayslip(null)}
        />
      )}
    </div>
  );
}

// ─── GPS Tracking Tab ─────────────────────────────────────────────────────────

/** Ticks every second — used for live stop timers */
function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Format a duration in seconds into "Xh Ym Zs" */
function fmtDuration(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

type TrackPoint = { id: number; lat: string; lng: string; accuracy: string | null; speed: string | null; heading: string | null; recordedAt: string };

type StopSegment = { type: "stop"; lat: number; lng: number; startTime: Date; endTime: Date; isOngoing: boolean };
type MoveSegment = { type: "move"; distM: number; startTime: Date; endTime: Date; avgSpeedKmh: number };
type Segment = StopSegment | MoveSegment;

function buildSegments(points: TrackPoint[], isToday: boolean): Segment[] {
  if (points.length < 2) return [];
  const STOP_DIST_M = 50;
  const STOP_MIN_PTS = 2;

  const segs: Segment[] = [];
  let i = 0;

  while (i < points.length - 1) {
    const a = points[i];
    const aLat = parseFloat(a.lat), aLng = parseFloat(a.lng);

    let j = i + 1;
    while (j < points.length) {
      const d = haversineM(aLat, aLng, parseFloat(points[j].lat), parseFloat(points[j].lng));
      if (d <= STOP_DIST_M) j++;
      else break;
    }

    if (j - i >= STOP_MIN_PTS) {
      const start = new Date(a.recordedAt);
      const end   = new Date(points[j - 1].recordedAt);
      segs.push({ type: "stop", lat: aLat, lng: aLng, startTime: start, endTime: end, isOngoing: false });
      i = j;
    } else {
      const b = points[i + 1];
      const distM = haversineM(aLat, aLng, parseFloat(b.lat), parseFloat(b.lng));
      const start = new Date(a.recordedAt);
      const end   = new Date(b.recordedAt);
      const secs  = Math.max(1, (end.getTime() - start.getTime()) / 1000);
      const speedKmh = (distM / secs) * 3.6;
      const prev = segs[segs.length - 1];
      if (prev && prev.type === "move") {
        (prev as MoveSegment).distM += distM;
        (prev as MoveSegment).endTime = end;
        (prev as MoveSegment).avgSpeedKmh = Math.max((prev as MoveSegment).avgSpeedKmh, speedKmh);
      } else {
        segs.push({ type: "move", distM, startTime: start, endTime: end, avgSpeedKmh: speedKmh });
      }
      i++;
    }
  }

  // Mark last stop as ongoing if viewing today and last point was < 5 min ago
  if (isToday && segs.length > 0) {
    const last = segs[segs.length - 1];
    const lastPoint = points[points.length - 1];
    const ageMs = Date.now() - new Date(lastPoint.recordedAt).getTime();
    if (last.type === "stop" && ageMs < 5 * 60 * 1000) {
      (last as StopSegment).isOngoing = true;
    }
  }

  return segs;
}

/** Reverse geocode a lat/lng to a short street address */
function useStopAddress(lat: number, lng: number) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const [addr, setAddr] = useState<string>("");
  useEffect(() => {
    if (geocodeCache[key]) { setAddr(geocodeCache[key]); return; }
    let cancelled = false;
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=17&addressdetails=1`, {
      headers: { "Accept-Language": "en" },
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const a = data?.address;
        const parts = [
          a?.road || a?.pedestrian || a?.footway || a?.path,
          a?.suburb || a?.neighbourhood || a?.quarter || a?.city_district || a?.town || a?.village || a?.city,
        ].filter(Boolean);
        const result = parts.length ? parts.join(", ") : (data?.display_name?.split(",").slice(0, 2).join(", ") || key);
        geocodeCache[key] = result;
        if (!cancelled) setAddr(result);
      })
      .catch(() => { if (!cancelled) setAddr(key); });
    return () => { cancelled = true; };
  }, [key]);
  return addr;
}

/** One stop row — has its own live clock if ongoing */
function StopRow({ seg, idx, now }: { seg: StopSegment; idx: number; now: Date }) {
  const addr = useStopAddress(seg.lat, seg.lng);
  const mapsUrl = `https://www.google.com/maps?q=${seg.lat},${seg.lng}`;
  const endTime = seg.isOngoing ? now : seg.endTime;
  const durationSec = Math.floor((endTime.getTime() - seg.startTime.getTime()) / 1000);

  return (
    <div className="flex items-stretch gap-0" data-testid={`gps-stop-${idx}`}>
      {/* Timeline spine */}
      <div className="flex flex-col items-center w-10 shrink-0">
        <div className="w-px flex-1 bg-amber-200" />
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${seg.isOngoing ? "bg-amber-500" : "bg-amber-100 border-2 border-amber-400"}`}>
          <CircleDot className={`w-4 h-4 ${seg.isOngoing ? "text-white" : "text-amber-600"}`} />
        </div>
        <div className="w-px flex-1 bg-amber-200" />
      </div>

      {/* Content */}
      <div className={`flex-1 my-1 mr-2 rounded-xl px-4 py-3 ${seg.isOngoing ? "bg-amber-50 border border-amber-200" : "bg-white border border-black/[0.07]"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-[0.08em] text-amber-700">Stationary</span>
              {seg.isOngoing && (
                <span className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-base font-black text-slate-900 mt-0.5 leading-tight">
              {fmtDuration(durationSec)}
              {seg.isOngoing && <span className="text-amber-600 text-sm font-bold ml-1">(ongoing)</span>}
            </p>
            <p className="text-[11px] text-black/50 mt-0.5">
              {format(seg.startTime, "HH:mm:ss")} – {seg.isOngoing ? "now" : format(seg.endTime, "HH:mm:ss")}
            </p>
          </div>
        </div>
        <a href={mapsUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 mt-2 text-[12px] text-blue-600 hover:text-blue-800 font-medium hover:underline">
          <MapPin className="w-3 h-3 shrink-0" />
          {addr || `${seg.lat.toFixed(5)}, ${seg.lng.toFixed(5)}`}
          <span className="text-blue-400">↗</span>
        </a>
      </div>
    </div>
  );
}

/** One move row */
function MoveRow({ seg, idx }: { seg: MoveSegment; idx: number }) {
  const durationSec = Math.floor((seg.endTime.getTime() - seg.startTime.getTime()) / 1000);
  const speedLabel = seg.avgSpeedKmh > 0.5 ? `${seg.avgSpeedKmh.toFixed(1)} km/h` : null;

  return (
    <div className="flex items-stretch gap-0" data-testid={`gps-move-${idx}`}>
      <div className="flex flex-col items-center w-10 shrink-0">
        <div className="w-px flex-1 bg-blue-200" />
        <div className="w-6 h-6 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center">
          <MoveRight className="w-3 h-3 text-blue-600" />
        </div>
        <div className="w-px flex-1 bg-blue-200" />
      </div>
      <div className="flex-1 flex items-center gap-3 py-2 pr-2">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.08em] text-blue-600">Moving</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-sm font-bold text-slate-700">{fmtDist(seg.distM)}</span>
            <span className="text-[11px] text-black/40">·</span>
            <span className="text-[11px] text-black/50">{fmtDuration(durationSec)}</span>
            {speedLabel && <>
              <span className="text-[11px] text-black/40">·</span>
              <span className="text-[11px] text-black/50">{speedLabel}</span>
            </>}
          </div>
          <p className="text-[10px] text-black/35 mt-0.5">
            {format(seg.startTime, "HH:mm:ss")} → {format(seg.endTime, "HH:mm:ss")}
          </p>
        </div>
      </div>
    </div>
  );
}

function GpsTrackingTab() {
  const { data: allStaff = [] } = useQuery<any[]>({ queryKey: ["/api/staff"] });
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const now = useLiveClock();

  const staffId = selectedStaffId ?? (allStaff[0]?.id ?? null);
  const isToday = selectedDate === todayStr;

  const { data: rawPoints = [], isLoading } = useQuery<TrackPoint[]>({
    queryKey: ["/api/admin/staff", staffId, "gps-track", selectedDate],
    queryFn: async () => {
      if (!staffId) return [];
      const r = await fetch(`${API_BASE}/api/admin/staff/${staffId}/gps-track?date=${selectedDate}`, { credentials: "include" });
      return r.json();
    },
    enabled: !!staffId,
    refetchInterval: 30000,
  });

  const selectedStaff = allStaff.find((s: any) => s.id === staffId);
  const segments = buildSegments(rawPoints, isToday);

  const totalDistM = rawPoints.length < 2 ? 0 : rawPoints.reduce((sum, pt, i) => {
    if (i === 0) return sum;
    const prev = rawPoints[i - 1];
    const d = haversineM(parseFloat(prev.lat), parseFloat(prev.lng), parseFloat(pt.lat), parseFloat(pt.lng));
    return d < 500 ? sum + d : sum;
  }, 0);

  const totalStops  = segments.filter(s => s.type === "stop").length;
  const firstSeen   = rawPoints.length > 0 ? new Date(rawPoints[0].recordedAt) : null;
  const lastSeen    = rawPoints.length > 0 ? new Date(rawPoints[rawPoints.length - 1].recordedAt) : null;
  const isLive      = isToday && lastSeen && (now.getTime() - lastSeen.getTime()) < 5 * 60 * 1000;
  const onShiftSecs = firstSeen ? Math.floor((isLive ? now.getTime() : (lastSeen?.getTime() ?? now.getTime()) - firstSeen.getTime()) / 1000) : 0;

  return (
    <div className="pb-16 space-y-4">

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-1">Staff Member</label>
          <select value={staffId ?? ""} onChange={e => setSelectedStaffId(Number(e.target.value))}
            className="border border-black/10 bg-white text-sm px-3 py-2 h-9 focus:outline-none focus:border-black"
            data-testid="select-gps-staff">
            {(allStaff as any[]).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-black/40 mb-1">Date</label>
          <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
            className="border border-black/10 bg-white text-sm px-3 py-2 h-9 focus:outline-none focus:border-black"
            data-testid="input-gps-date" />
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 h-9 px-3 bg-red-50 border border-red-200 text-red-600 text-[11px] font-black uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
            Live Tracking
          </div>
        )}
      </div>

      {/* Stats bar */}
      {rawPoints.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "On Shift",       value: firstSeen ? fmtDuration(onShiftSecs) : "—" },
            { label: "Total Distance", value: fmtDist(totalDistM) },
            { label: "Stops",          value: String(totalStops) },
            { label: "GPS Points",     value: String(rawPoints.length) },
          ].map(({ label, value }) => (
            <div key={label} className="border border-black/[0.07] bg-white p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/35 mb-1">{label}</p>
              <p className="text-lg font-black">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Map */}
      {rawPoints.length > 0 && (
        <div className="border border-black/[0.07] bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-black/[0.07] flex items-center justify-between flex-wrap gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
              Route Map — {selectedStaff?.name ?? "—"} · {selectedDate}
            </p>
            <div className="flex items-center gap-3 text-[10px] text-black/40 font-semibold">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Start</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-blue-500 inline-block" />Route</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-400 inline-block" />Stop</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" />Last seen</span>
            </div>
          </div>
          <GpsMap points={rawPoints} height={420} />
        </div>
      )}

      {/* Timeline */}
      <div className="border border-black/[0.07] bg-slate-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-black/[0.07] bg-white flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
            Activity Timeline — {selectedStaff?.name ?? "—"} · {selectedDate}
          </p>
          {isLive && lastSeen && (
            <p className="text-[10px] text-black/30">
              Updated {Math.floor((now.getTime() - lastSeen.getTime()) / 1000)}s ago
            </p>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 px-6 py-10 text-black/40">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        )}

        {!isLoading && rawPoints.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Navigation2 className="w-8 h-8 text-black/15 mx-auto mb-3" />
            <p className="text-sm font-bold text-black/40">No GPS data for this date</p>
            <p className="text-xs text-black/30 mt-1">Data records every 30 s when staff are clocked in.</p>
          </div>
        )}

        {!isLoading && segments.length > 0 && (
          <div className="px-2 py-3">

            {/* Session start */}
            <div className="flex items-stretch gap-0">
              <div className="flex flex-col items-center w-10 shrink-0">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-white" />
                </div>
                <div className="w-px flex-1 bg-emerald-300" />
              </div>
              <div className="flex-1 flex items-center pb-1">
                <div>
                  <p className="text-[11px] font-black text-emerald-700 uppercase tracking-[0.08em]">Shift started</p>
                  <p className="text-base font-black text-slate-900">{firstSeen ? format(firstSeen, "HH:mm:ss") : "—"}</p>
                </div>
              </div>
            </div>

            {/* Segments */}
            {segments.map((seg, idx) =>
              seg.type === "stop"
                ? <StopRow key={idx} seg={seg} idx={idx} now={now} />
                : <MoveRow key={idx} seg={seg} idx={idx} />
            )}

            {/* Last seen / end */}
            <div className="flex items-stretch gap-0">
              <div className="flex flex-col items-center w-10 shrink-0">
                <div className={`w-px flex-1 ${isLive ? "bg-red-300" : "bg-slate-300"}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isLive ? "bg-red-500" : "bg-slate-400"}`}>
                  <div className="w-3 h-3 rounded-full bg-white" />
                </div>
              </div>
              <div className="flex-1 flex items-center pt-1">
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-[0.08em] ${isLive ? "text-red-600" : "text-black/40"}`}>
                    {isLive ? "Currently here" : "Last seen"}
                  </p>
                  <p className="text-base font-black text-slate-900">
                    {lastSeen ? format(lastSeen, "HH:mm:ss") : "—"}
                  </p>
                  {isLive && lastSeen && (
                    <p className="text-[11px] text-red-500 font-bold">
                      {fmtDuration(Math.floor((now.getTime() - lastSeen.getTime()) / 1000))} ago
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
