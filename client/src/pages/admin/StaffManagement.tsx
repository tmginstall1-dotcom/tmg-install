import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInMinutes, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from "date-fns";
import {
  Plus, Trash2, Pencil, Check, X, Users, Clock, UserPlus, LogIn, LogOut,
  ChevronDown, ChevronUp, Calendar, FileText, Settings2, Loader2, AlertCircle, MapPin
} from "lucide-react";

const TEAM_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#14b8a6"];

function fmt(mins: number) {
  if (mins < 0) mins = 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${map[status] || "bg-gray-100 text-gray-600"}`}>
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
  const [tab, setTab] = useState<"teams" | "payroll" | "amendments" | "leave" | "payslips">("teams");

  return (
    <div className="min-h-screen pt-20 pb-16 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-black">Staff Management</h1>
          <p className="text-muted-foreground">Manage staff accounts, teams, attendance and payroll</p>
        </div>

        <div className="flex gap-0 mb-6 border-b overflow-x-auto">
          {([
            { key: "teams", label: "Teams & Staff", icon: Users },
            { key: "payroll", label: "Attendance", icon: Clock },
            { key: "amendments", label: "Amendments", icon: AlertCircle },
            { key: "leave", label: "Leave", icon: Calendar },
            { key: "payslips", label: "Payslips", icon: FileText },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "teams" && <TeamsTab />}
        {tab === "payroll" && <PayrollTab />}
        {tab === "amendments" && <AmendmentsTab />}
        {tab === "leave" && <LeaveTab />}
        {tab === "payslips" && <PayslipsTab />}
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

  const { data: teams = [] } = useQuery<any[]>({ queryKey: ["/api/teams"] });
  const { data: allStaff = [] } = useQuery<any[]>({ queryKey: ["/api/staff"] });

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
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-card border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">All Staff</h2>
            <button onClick={() => setAddingStaff(true)}
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
              <UserPlus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {addingStaff && (
            <div className="mb-3 p-3 bg-secondary/30 rounded-xl space-y-2">
              <input value={newStaff.name} onChange={e => setNewStaff(s => ({ ...s, name: e.target.value }))}
                placeholder="Full name" className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background" data-testid="input-staff-name" />
              <input value={newStaff.username} onChange={e => setNewStaff(s => ({ ...s, username: e.target.value }))}
                placeholder="Username" className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background" data-testid="input-staff-username" />
              <input value={newStaff.password} onChange={e => setNewStaff(s => ({ ...s, password: e.target.value }))}
                type="password" placeholder="Password (min 6)" className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background" data-testid="input-staff-password" />
              <div className="flex gap-2">
                <button onClick={() => createStaffMut.mutate()} disabled={createStaffMut.isPending}
                  className="flex-1 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg" data-testid="button-create-staff">
                  {createStaffMut.isPending ? "Creating..." : "Create"}
                </button>
                <button onClick={() => setAddingStaff(false)} className="px-3 py-1.5 border text-xs rounded-lg">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {allStaff.map((s: any) => (
              <div key={s.id}>
                <StaffRow staff={s} teams={teams}
                  onAssign={(teamId) => assignMut.mutate({ teamId, userId: s.id })}
                  onUnassign={() => unassignMut.mutate(s.id)}
                  onDelete={() => { if (confirm(`Remove ${s.name}? This cannot be undone.`)) deleteStaffMut.mutate(s.id); }}
                  onPaySettings={() => setPaySettingsStaffId(paySettingsStaffId === s.id ? null : s.id)} />
                {paySettingsStaffId === s.id && <PaySettingsForm staff={s} onClose={() => setPaySettingsStaffId(null)} />}
              </div>
            ))}
            {allStaff.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No staff yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Right: Teams */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm uppercase tracking-wide text-muted-foreground">Teams</h2>
          <button onClick={() => setAddingTeam(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors"
            data-testid="button-add-team">
            <Plus className="w-3.5 h-3.5" /> New Team
          </button>
        </div>

        {addingTeam && (
          <div className="bg-card border-2 border-dashed border-primary/40 rounded-2xl p-4 space-y-3">
            <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
              placeholder="Team name (e.g. Team A)" autoFocus
              className="w-full px-3 py-2 border rounded-lg bg-background text-sm" data-testid="input-team-name" />
            <div className="flex gap-2 items-center">
              <span className="text-xs text-muted-foreground">Colour:</span>
              {TEAM_COLORS.map(c => (
                <button key={c} onClick={() => setNewTeamColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${newTeamColor === c ? "border-foreground scale-125" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => createTeamMut.mutate()} disabled={!newTeamName || createTeamMut.isPending}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-50">
                <Check className="w-3.5 h-3.5" /> Create
              </button>
              <button onClick={() => setAddingTeam(false)} className="px-3 py-1.5 border text-xs rounded-lg">Cancel</button>
            </div>
          </div>
        )}

        {teams.map((team: any) => (
          <TeamCard key={team.id} team={team} allStaff={allStaff}
            onDelete={() => { if (confirm(`Delete ${team.name}? Members will become unassigned.`)) deleteTeamMut.mutate(team.id); }}
            onRemoveMember={(uid) => unassignMut.mutate(uid)}
            onAddMember={(uid) => assignMut.mutate({ teamId: team.id, userId: uid })} />
        ))}

        {teams.length === 0 && !addingTeam && (
          <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-muted-foreground">No teams yet</p>
            <p className="text-sm text-muted-foreground">Create a team to group staff together</p>
          </div>
        )}
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
        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{label}</label>
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      </div>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">S$</span>
        <input type="number" step="0.01" min="0" value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg bg-background font-mono"
          data-testid={testId} />
      </div>
    </div>
  );

  return (
    <div className="mx-1 mb-2 p-4 bg-secondary/30 border-2 border-primary/20 rounded-2xl space-y-3 text-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-primary">
        Pay Package — {staff.name}
      </p>

      {/* 3 pay components */}
      <div className="bg-card rounded-xl border divide-y overflow-hidden">
        <div className="px-3 py-2.5">
          {field("Monthly Salary", "SGD / month", "monthlyRate", "input-monthly-rate")}
        </div>
        <div className="px-3 py-2.5">
          {field("Hourly Rate", "first 8 hrs / day", "hourlyRate", "input-hourly-rate")}
        </div>
        <div className="px-3 py-2.5">
          {field("Overtime Rate", "after 8 hrs / day", "overtimeRate", "input-overtime-rate")}
        </div>
      </div>

      {/* Leave entitlement */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Annual Leave</label>
          <span className="text-[10px] text-muted-foreground">days / year</span>
        </div>
        <input type="number" min="0" max="30" value={form.annualLeaveEntitlement}
          onChange={e => setForm(f => ({ ...f, annualLeaveEntitlement: parseInt(e.target.value) || 0 }))}
          className="w-full px-3 py-1.5 text-sm border rounded-lg bg-background"
          data-testid="input-leave-entitlement" />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl disabled:opacity-50"
          data-testid="button-save-pay">
          {mut.isPending ? "Saving…" : "Save Pay Package"}
        </button>
        <button onClick={onClose} className="px-4 py-2 border text-xs rounded-xl font-medium">Cancel</button>
      </div>
    </div>
  );
}

function StaffRow({ staff, teams, onAssign, onUnassign, onDelete, onPaySettings }: any) {
  const team = teams.find((t: any) => t.id === staff.teamId);
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate">{staff.name}</p>
        <p className="text-xs text-muted-foreground">{staff.username}</p>
        {team && (
          <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5"
            style={{ background: team.color + "22", color: team.color }}>
            {team.name}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onPaySettings} title="Pay settings"
          className="p-1 text-muted-foreground hover:text-primary transition-colors">
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        {staff.teamId && (
          <button onClick={onUnassign} title="Remove from team"
            className="p-1 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <select onChange={e => { if (e.target.value) onAssign(parseInt(e.target.value)); e.target.value = ""; }}
          className="text-xs border rounded-lg px-1 py-1 bg-background max-w-[90px]"
          defaultValue="">
          <option value="" disabled>{staff.teamId ? "Move" : "Assign"}</option>
          {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={onDelete} title="Delete staff"
          className="p-1 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
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
    <div className="bg-card border-2 rounded-2xl overflow-hidden" style={{ borderColor: team.color + "44" }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: team.color + "11" }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ background: team.color }} />
          {editingName ? (
            <div className="flex items-center gap-1">
              <input value={name} onChange={e => setName(e.target.value)} autoFocus
                className="px-2 py-0.5 text-sm border rounded-lg bg-background font-bold w-32" />
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
          <p className="text-sm text-muted-foreground text-center py-2">No members — assign staff from the left panel</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-3">
            {team.members.map((m: any) => (
              <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-background text-sm font-semibold">
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black"
                  style={{ background: team.color }}>{m.name.charAt(0)}</span>
                {m.name}
                <button onClick={() => onRemoveMember(m.id)} className="text-muted-foreground hover:text-destructive transition-colors ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {nonMembers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Add:</span>
            {nonMembers.map((s: any) => (
              <button key={s.id} onClick={() => onAddMember(s.id)}
                className="flex items-center gap-1 px-2 py-1 border rounded-lg text-xs font-semibold hover:bg-secondary transition-colors">
                <Plus className="w-3 h-3" /> {s.name}
              </button>
            ))}
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
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
        {([["today","Today's Roster"],["timesheets","Timesheets"]] as const).map(([v,l]) => (
          <button key={v} onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${view === v ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
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
  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/attendance", date, date, ""],
    queryFn: async () => {
      if (!isValidDate) return [];
      const params = new URLSearchParams({ from: date + "T00:00:00", to: date + "T23:59:59" });
      const res = await fetch(`/api/admin/attendance?${params}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: isValidDate,
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

  const isToday = date === todayStr;

  return (
    <div className="space-y-5">
      {/* Date picker */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border-2 rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="text-sm font-bold bg-transparent outline-none" data-testid="input-roster-date" />
        </div>
        {!isToday && (
          <button onClick={() => setDate(todayStr)}
            className="text-xs font-bold text-primary underline">Back to Today</button>
        )}
        <span className="text-xs text-muted-foreground font-medium">
          {(() => { try { const d = new Date(date + "T12:00:00"); if (isNaN(d.getTime())) return ""; return (isToday ? "Today, " : "") + format(d, "EEEE d MMMM yyyy"); } catch { return ""; } })()}
        </span>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
          <p className="text-3xl font-black text-emerald-600">{clockedIn.length}</p>
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">Clocked in now</p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
          <p className="text-3xl font-black text-muted-foreground">{notClockedIn.length}</p>
          <p className="text-xs font-bold text-muted-foreground mt-0.5">Not clocked in</p>
        </div>
        <div className="bg-card border rounded-2xl p-4 col-span-2 sm:col-span-1">
          <p className="text-3xl font-black">{clockedOut.length}</p>
          <p className="text-xs font-bold text-muted-foreground mt-0.5">Clocked out</p>
        </div>
      </div>

      {/* Staff roster list */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>
      ) : (
        <div className="bg-card border-2 rounded-2xl overflow-hidden divide-y">
          {roster.length === 0 && (
            <p className="text-center py-8 text-muted-foreground text-sm">No staff found.</p>
          )}
          {/* Clocked In section */}
          {clockedIn.map(({ staff: s, log }) => (
            <RosterRow key={s.id} staff={s} log={log} status="in" />
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

function RosterRow({ staff, log, status }: { staff: any; log: any; status: "in" | "out" | "absent" }) {
  const [mapOpen, setMapOpen] = useState<"in" | "out" | null>(null);
  const mins = log?.clockOutAt
    ? differenceInMinutes(new Date(log.clockOutAt), new Date(log.clockInAt))
    : null;

  const hasInGps  = !!(log?.clockInLat  && log?.clockInLng);
  const hasOutGps = !!(log?.clockOutLat && log?.clockOutLng);

  const activeGps = mapOpen === "out" && hasOutGps
    ? { lat: log.clockOutLat, lng: log.clockOutLng }
    : hasInGps
    ? { lat: log.clockInLat,  lng: log.clockInLng  }
    : null;

  const osmSrc = activeGps
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${+activeGps.lng - 0.003},${+activeGps.lat - 0.003},${+activeGps.lng + 0.003},${+activeGps.lat + 0.003}&layer=mapnik&marker=${activeGps.lat},${activeGps.lng}`
    : null;

  return (
    <div className="px-4 py-3" data-testid={`roster-row-${staff.id}`}>
      {/* Main row */}
      <div className="flex items-center gap-3">
        <StaffAvatar user={staff} size={10} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-tight">{staff.name}</p>
          <p className="text-xs font-mono text-muted-foreground">@{staff.username}</p>
          {status === "in" && log && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-600">
                Clocked in · {format(new Date(log.clockInAt), "h:mm a")}
              </span>
            </div>
          )}
          {status === "out" && log && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {format(new Date(log.clockInAt), "h:mm a")} – {format(new Date(log.clockOutAt), "h:mm a")}
                {mins !== null && <span className="font-bold text-foreground ml-1">{fmt(mins)}</span>}
              </span>
            </div>
          )}
          {status === "absent" && (
            <span className="text-xs text-muted-foreground">Not clocked in</span>
          )}
        </div>

        {/* GPS map toggle buttons */}
        <div className="shrink-0 flex items-center gap-1.5">
          {hasInGps && (
            <button
              onClick={() => setMapOpen(prev => prev === "in" ? null : "in")}
              data-testid={`button-map-in-${staff.id}`}
              className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                mapOpen === "in"
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
              }`}
              title="View clock-in location"
            >
              <MapPin className="w-3 h-3" />
              In
            </button>
          )}
          {hasOutGps && (
            <button
              onClick={() => setMapOpen(prev => prev === "out" ? null : "out")}
              data-testid={`button-map-out-${staff.id}`}
              className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                mapOpen === "out"
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900"
              }`}
              title="View clock-out location"
            >
              <MapPin className="w-3 h-3" />
              Out
            </button>
          )}
          {!hasInGps && !hasOutGps && log && (
            <span className="text-[10px] text-muted-foreground italic">No GPS</span>
          )}
        </div>
      </div>

      {/* Inline OSM map panel */}
      {mapOpen && osmSrc && (
        <div className="mt-3 rounded-xl overflow-hidden border border-border shadow-sm">
          {/* Header strip */}
          <div className={`flex items-center justify-between px-3 py-2 ${
            mapOpen === "in"
              ? "bg-emerald-500 text-white"
              : "bg-red-500 text-white"
          }`}>
            <div className="flex items-center gap-2 text-xs font-bold">
              <MapPin className="w-3.5 h-3.5" />
              {mapOpen === "in"
                ? `Clock-In · ${log?.clockInAt ? format(new Date(log.clockInAt), "h:mm a") : ""}`
                : `Clock-Out · ${log?.clockOutAt ? format(new Date(log.clockOutAt), "h:mm a") : ""}`}
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`https://maps.google.com/?q=${activeGps!.lat},${activeGps!.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-bold underline opacity-90 hover:opacity-100"
              >
                Open in Maps ↗
              </a>
              <button onClick={() => setMapOpen(null)} className="opacity-80 hover:opacity-100 ml-1">
                ✕
              </button>
            </div>
          </div>
          {/* Map iframe */}
          <iframe
            src={osmSrc}
            title={`${staff.name} ${mapOpen === "in" ? "clock-in" : "clock-out"} location`}
            className="w-full"
            style={{ height: 220, border: "none" }}
            loading="lazy"
          />
          {/* Coords footer */}
          <div className="px-3 py-1.5 bg-muted/60 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
            <span>{parseFloat(activeGps!.lat).toFixed(6)}, {parseFloat(activeGps!.lng).toFixed(6)}</span>
            <span className="font-sans text-[10px]">{staff.name}</span>
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
    <tr className="border-t bg-primary/5">
      <td colSpan={7} className="px-4 py-3">
        <div className="space-y-3">
          <p className="text-xs font-black text-primary uppercase tracking-wider">Editing record #{log.id}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block flex items-center gap-1">
                <LogIn className="w-3 h-3 text-emerald-500" /> Clock In
              </label>
              <input type="datetime-local" value={inVal} onChange={e => setInVal(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background"
                data-testid={`input-edit-clockin-${log.id}`} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block flex items-center gap-1">
                <LogOut className="w-3 h-3 text-red-500" /> Clock Out
                <span className="ml-1 text-[10px] text-muted-foreground font-normal">(leave blank = still in)</span>
              </label>
              <input type="datetime-local" value={outVal} onChange={e => setOutVal(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background"
                data-testid={`input-edit-clockout-${log.id}`} />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Admin Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional note…"
              className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background"
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-60"
              data-testid={`button-save-log-${log.id}`}>
              {saveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
            <button onClick={onClose}
              className="px-3 py-1.5 border rounded-lg text-xs font-bold hover:bg-secondary transition-colors"
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
    <div className="border-2 border-primary/30 bg-primary/5 rounded-2xl p-4 space-y-4"
      data-testid="add-record-form">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
            <Plus className="w-4 h-4 text-white" />
          </div>
          <p className="font-black text-sm">Add Attendance Record</p>
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
            className="w-full px-3 py-2 border rounded-lg text-sm bg-background"
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
            className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background"
            data-testid="input-add-clockin" />
        </div>

        {/* Clock Out */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground mb-1 block flex items-center gap-1">
            <LogOut className="w-3 h-3 text-red-500" /> Clock Out
            <span className="text-[10px] text-muted-foreground font-normal ml-1">(optional)</span>
          </label>
          <input type="datetime-local" value={outVal} onChange={e => setOutVal(e.target.value)}
            className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background"
            data-testid="input-add-clockout" />
        </div>

        {/* Notes */}
        <div className="sm:col-span-2">
          <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Notes / Reason</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Staff forgot to clock in — manually added by admin"
            className="w-full px-3 py-1.5 border rounded-lg text-sm bg-background"
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
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          data-testid="button-save-add-record">
          {addMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Record
        </button>
        <button onClick={onClose}
          className="px-4 py-2 border rounded-xl text-sm font-bold hover:bg-secondary transition-colors">
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
    const params = new URLSearchParams({ from: f + "T00:00:00", to: t + "T23:59:59" });
    if (uid) params.set("userId", uid);
    const res = await fetch(`/api/admin/attendance?${params}`);
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
            {log.clockInLat && log.clockInLng && (
              <a href={`https://maps.google.com/?q=${log.clockInLat},${log.clockInLng}`} target="_blank" rel="noreferrer"
                className="text-primary" title="GPS"><MapPin className="w-3 h-3" /></a>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5">
          {log.clockOutAt ? (
            <div className="flex items-center gap-1 text-sm">
              <LogOut className="w-3 h-3 text-red-500 shrink-0" />
              <span className="font-mono">{format(new Date(log.clockOutAt), "HH:mm")}</span>
              {log.clockOutLat && log.clockOutLng && (
                <a href={`https://maps.google.com/?q=${log.clockOutLat},${log.clockOutLng}`} target="_blank" rel="noreferrer"
                  className="text-primary" title="GPS"><MapPin className="w-3 h-3" /></a>
              )}
            </div>
          ) : (
            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">Still in</span>
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
    <div className="space-y-5">
      {/* ── Controls bar ─────────────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl p-4 space-y-4">
        {/* View toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl border overflow-hidden">
            {(["daily","period"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-2 text-xs font-bold transition-colors capitalize ${view === v ? "bg-primary text-white" : "hover:bg-secondary"}`}
                data-testid={`button-view-${v}`}>
                {v === "daily" ? "Daily" : "Period"}
              </button>
            ))}
          </div>

          {/* Add Record button — always visible */}
          <button
            onClick={() => { setAddPresetUid(undefined); setShowAddForm(f => !f); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${showAddForm ? "bg-primary text-white border-primary" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"}`}
            data-testid="button-open-add-record">
            <Plus className="w-3.5 h-3.5" />
            Add Record
          </button>

          {view === "period" && (
            <>
              <div className="flex gap-1 ml-auto flex-wrap">
                {[["today","Today"],["week","This Week"],["month","This Month"],["prevMonth","Last Month"]].map(([v,l]) => (
                  <button key={v} onClick={() => setPreset(v)}
                    className="px-2.5 py-1.5 text-[11px] font-bold border rounded-lg hover:bg-secondary transition-colors">
                    {l}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-3 items-end">
          {view === "daily" ? (
            <div className="flex items-center gap-2">
              <button onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate()-1); setDailyDate(format(d,"yyyy-MM-dd")); }}
                className="p-2 border rounded-lg hover:bg-secondary transition-colors" title="Previous day">
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Date</label>
                <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-daily-date" />
              </div>
              <button onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate()+1); setDailyDate(format(d,"yyyy-MM-dd")); }}
                className="p-2 border rounded-lg hover:bg-secondary transition-colors mt-4" title="Next day">
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
              <button onClick={() => setDailyDate(format(today, "yyyy-MM-dd"))}
                className="px-2.5 py-1.5 text-[11px] font-bold border rounded-lg hover:bg-secondary transition-colors mt-4">
                Today
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">From</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-from-date" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">To</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm bg-background" data-testid="input-to-date" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Staff</label>
                <select value={filterUid} onChange={e => setFilterUid(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm bg-background min-w-[130px]" data-testid="select-staff-filter">
                  <option value="">All Staff</option>
                  {(staff as any[]).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Sort By</label>
                <div className="flex gap-1">
                  {[["name","Name"],["hours","Hours"]].map(([v,l]) => (
                    <button key={v} onClick={() => { if (sortBy === v) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(v as any); setSortDir("asc"); } }}
                      className={`px-2.5 py-1.5 text-[11px] font-bold border rounded-lg transition-colors flex items-center gap-1 ${sortBy === v ? "bg-primary text-white border-primary" : "hover:bg-secondary"}`}>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Hours", val: fmt(grandTotals.totalMins), color: "" },
            { label: "Regular", val: fmt(grandTotals.regularMins), color: "text-emerald-600" },
            { label: "Overtime", val: fmt(grandTotals.otMins), color: "text-amber-600" },
            { label: "Staff w/ Records", val: `${staffRows.filter((r:any)=>r.days>0).length} / ${staffRows.length}`, color: "" },
          ].map(c => (
            <div key={c.label} className="bg-card border rounded-2xl p-4">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1">{c.label}</p>
              <p className={`text-xl font-black ${c.color}`}>{c.val}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Daily View ───────────────────────────────────────────────── */}
      {view === "daily" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-base">
              {isValid(dailyDate) ? (() => { try { return format(new Date(dailyDate + "T12:00:00"), "EEEE, d MMMM yyyy"); } catch { return dailyDate; } })() : "Select a date"}
            </h3>
            {dailyLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          {(staff as any[]).filter((s:any)=>s.role==="staff").map((s: any) => {
            const sLogs = (dailyLogs as any[]).filter((l:any) => l.userId === s.id);
            const hasRecords = sLogs.length > 0;
            return (
              <div key={s.id} className={`border rounded-2xl overflow-hidden ${hasRecords ? "bg-card" : "bg-secondary/10 opacity-70"}`}
                data-testid={`daily-staff-${s.id}`}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <StaffAvatar user={s} size={10} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{s.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">@{s.username}</p>
                  </div>
                  {hasRecords ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-600">{fmt(calcOT(sLogs).totalMins)}</span>
                      <button
                        onClick={() => { setAddPresetUid(s.id); setShowAddForm(true); }}
                        className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                        title={`Add record for ${s.name}`}
                        data-testid={`button-quick-add-${s.id}`}>
                        <Plus className="w-2.5 h-2.5" /> Add
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddPresetUid(s.id); setShowAddForm(true); }}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg transition-colors"
                      title={`Add record for ${s.name}`}
                      data-testid={`button-add-${s.id}`}>
                      <Plus className="w-3 h-3" /> Add Record
                    </button>
                  )}
                </div>
                {hasRecords && (
                  <div className="border-t overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      {logTableHead(false)}
                      <tbody>
                        {sLogs.map((log: any) => renderLogRow(log, false))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Period View ─────────────────────────────────────────────── */}
      {view === "period" && (
        periodLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {staffRows.map((row: any) => (
              <div key={row.user?.id} className={`border rounded-2xl overflow-hidden ${row.days === 0 ? "bg-secondary/10 opacity-70" : "bg-card"}`}
                data-testid={`period-staff-${row.user?.id}`}>
                {/* Staff header */}
                <button
                  onClick={() => row.logs.length > 0 && setExpandedId(expandedId === row.user?.id ? null : row.user?.id)}
                  className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${row.logs.length > 0 ? "hover:bg-secondary/20 cursor-pointer" : "cursor-default"}`}
                  data-testid={`button-expand-staff-${row.user?.id}`}>
                  <StaffAvatar user={row.user} size={10} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-sm">{row.user?.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">@{row.user?.username}</p>
                    <p className="text-xs mt-0.5">
                      {row.days > 0
                        ? <span className="text-emerald-600 font-bold">{row.days} day{row.days !== 1 ? "s" : ""} clocked</span>
                        : <span className="text-muted-foreground">No records this period</span>}
                    </p>
                  </div>
                  {/* Hour breakdown */}
                  {row.totalMins > 0 && (
                    <div className="text-right shrink-0">
                      <p className="font-black text-base">{fmt(row.totalMins)}</p>
                      <div className="flex gap-2 justify-end mt-0.5">
                        <span className="text-[10px] text-emerald-600 font-bold">{fmt(row.regularMins)} reg</span>
                        {row.otMins > 0 && <span className="text-[10px] text-amber-600 font-bold">{fmt(row.otMins)} OT</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground">{row.days > 0 ? fmt(Math.round(row.totalMins / row.days)) + " avg/day" : ""}</p>
                    </div>
                  )}
                  {row.logs.length > 0 && (
                    expandedId === row.user?.id ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* Expanded log table */}
                {expandedId === row.user?.id && (
                  <div className="border-t overflow-x-auto">
                    <table className="w-full text-sm min-w-[550px]">
                      {logTableHead(true)}
                      <tbody>
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
  const { data: amendments = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/admin/attendance/amendments"] });
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

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (amendments.length === 0) {
    return (
      <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed">
        <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold text-muted-foreground">No amendment requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {amendments.map((a: any) => (
        <div key={a.id} className="bg-card border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-bold text-sm">{a.user?.name}</p>
                <StatusBadge status={a.status} />
              </div>
              <p className="text-xs text-muted-foreground">Submitted {format(new Date(a.createdAt), "d MMM yyyy HH:mm")}</p>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1">ORIGINAL</p>
                <p>In: {a.originalClockIn ? format(new Date(a.originalClockIn), "d MMM HH:mm") : "—"}</p>
                <p>Out: {a.originalClockOut ? format(new Date(a.originalClockOut), "d MMM HH:mm") : "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-primary mb-1">REQUESTED</p>
                <p className="text-primary">In: {a.requestedClockIn ? format(new Date(a.requestedClockIn), "d MMM HH:mm") : "—"}</p>
                <p className="text-primary">Out: {a.requestedClockOut ? format(new Date(a.requestedClockOut), "d MMM HH:mm") : "—"}</p>
              </div>
            </div>
            <div className="bg-secondary/30 rounded-xl px-3 py-2">
              <p className="text-xs font-bold text-muted-foreground mb-0.5">Reason</p>
              <p className="text-sm">{a.reason}</p>
            </div>
            {a.status === 'pending' && (
              <div className="space-y-2">
                <textarea value={notes[a.id] || ""} onChange={e => setNotes(n => ({ ...n, [a.id]: e.target.value }))}
                  placeholder="Admin note (optional)" rows={2}
                  className="w-full px-3 py-2 text-sm border rounded-xl bg-background resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => reviewMut.mutate({ id: a.id, status: "approved" })}
                    disabled={reviewMut.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                    data-testid={`button-approve-amendment-${a.id}`}>
                    <Check className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button onClick={() => reviewMut.mutate({ id: a.id, status: "rejected" })}
                    disabled={reviewMut.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
                    data-testid={`button-reject-amendment-${a.id}`}>
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            )}
            {a.adminNote && (
              <p className="text-xs text-muted-foreground italic">Admin note: {a.adminNote}</p>
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
      const res = await fetch(`/api/admin/leave${params}`);
      return res.json();
    },
  });

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
      <div className="flex gap-2">
        {[["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={`px-4 py-2 text-xs font-bold rounded-xl border-2 transition-all ${statusFilter === v ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>
            {l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : leaves.length === 0 ? (
        <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No {statusFilter !== "all" ? statusFilter : ""} leave requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaves.map((l: any) => (
            <div key={l.id} className="bg-card border rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold">{l.user?.name}</p>
                    <StatusBadge status={l.status} />
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary">
                      {LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}
                    </span>
                    <span className="font-bold">
                      {format(parseISO(l.startDate), "d MMM")} – {format(parseISO(l.endDate), "d MMM yyyy")}
                    </span>
                    <span className="text-muted-foreground">({parseFloat(l.totalDays)}d)</span>
                  </div>
                  {l.reason && <p className="text-xs text-muted-foreground mt-1">{l.reason}</p>}
                </div>
                <p className="text-2xl font-black text-muted-foreground shrink-0 ml-4">{parseFloat(l.totalDays)}d</p>
              </div>

              {l.status === 'pending' && (
                <div className="px-4 pb-4 space-y-2 border-t pt-3">
                  <textarea value={notes[l.id] || ""} onChange={e => setNotes(n => ({ ...n, [l.id]: e.target.value }))}
                    placeholder="Admin note (optional)" rows={2}
                    className="w-full px-3 py-2 text-sm border rounded-xl bg-background resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => reviewMut.mutate({ id: l.id, status: "approved" })}
                      disabled={reviewMut.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                      data-testid={`button-approve-leave-${l.id}`}>
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button onClick={() => reviewMut.mutate({ id: l.id, status: "rejected" })}
                      disabled={reviewMut.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-destructive text-destructive-foreground text-xs font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
                      data-testid={`button-reject-leave-${l.id}`}>
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              )}
              {l.adminNote && (
                <p className="px-4 pb-3 text-xs text-muted-foreground italic">Note: {l.adminNote}</p>
              )}
            </div>
          ))}
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

  const { data: payslips = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/payslips", filterUserId],
    queryFn: async () => {
      const params = filterUserId ? `?userId=${filterUserId}` : "";
      const res = await fetch(`/api/admin/payslips${params}`);
      return res.json();
    },
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
          className="px-3 py-2 border rounded-xl text-sm bg-background min-w-[150px]" data-testid="select-payslip-staff">
          <option value="">All Staff</option>
          {staff.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={() => setShowGenerate(!showGenerate)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors"
          data-testid="button-generate-payslip">
          <Plus className="w-4 h-4" /> Generate Payslip
        </button>
      </div>

      {showGenerate && (
        <div className="bg-card border-2 border-dashed border-primary/30 rounded-2xl p-4 space-y-3">
          <p className="font-bold text-sm">Generate Payslip</p>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Staff Member</label>
            <select value={genForm.userId} onChange={e => setGenForm(f => ({ ...f, userId: e.target.value }))}
              className="w-full px-3 py-2 border rounded-xl text-sm bg-background" data-testid="select-gen-staff">
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
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary font-black text-sm flex items-center justify-center shrink-0">
                    {s.name.split(" ").map((w: string) => w[0]).slice(0,2).join("").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{s.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">@{s.username}</p>
                  </div>
                </div>
                {/* Pay package summary — 3 components */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-card rounded-lg px-2 py-1.5 text-center">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Monthly</p>
                    <p className="text-xs font-black text-foreground font-mono mt-0.5">
                      S${parseFloat(s.monthlyRate || "0").toFixed(0)}
                    </p>
                  </div>
                  <div className="bg-card rounded-lg px-2 py-1.5 text-center">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Reg/hr</p>
                    <p className="text-xs font-black text-foreground font-mono mt-0.5">
                      S${parseFloat(s.hourlyRate || "0").toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg px-2 py-1.5 text-center">
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wide">OT/hr</p>
                    <p className="text-xs font-black text-amber-700 dark:text-amber-400 font-mono mt-0.5">
                      S${parseFloat(s.overtimeRate || "0").toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Period Start</label>
              <input type="date" value={genForm.periodStart} onChange={e => setGenForm(f => ({ ...f, periodStart: e.target.value }))}
                className="w-full px-3 py-2 border rounded-xl text-sm bg-background" data-testid="input-period-start" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Period End</label>
              <input type="date" value={genForm.periodEnd} onChange={e => setGenForm(f => ({ ...f, periodEnd: e.target.value }))}
                className="w-full px-3 py-2 border rounded-xl text-sm bg-background" data-testid="input-period-end" />
            </div>
          </div>
          <textarea value={genForm.notes} onChange={e => setGenForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)" rows={2}
            className="w-full px-3 py-2 text-sm border rounded-xl bg-background resize-none" />
          <div className="flex gap-2">
            <button onClick={() => generateMut.mutate()} disabled={!genForm.userId || generateMut.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl disabled:opacity-50"
              data-testid="button-confirm-generate">
              {generateMut.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : "Generate"}
            </button>
            <button onClick={() => setShowGenerate(false)} className="px-4 py-2 border rounded-xl text-sm">Cancel</button>
          </div>
          <p className="text-xs text-muted-foreground">Payslip is auto-calculated from clock-in/out records and leave deductions for the period.</p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : payslips.length === 0 ? (
        <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed">
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
            const detailItems = isMonthlyBased
              ? [
                  { label: "Basic Salary", val: `S$${basicPay.toFixed(2)}` },
                  { label: "Regular Hours", val: `${parseFloat(ps.regularHours).toFixed(1)}h` },
                  { label: "Regular Pay", val: `S$${parseFloat(ps.regularPay).toFixed(2)}` },
                  { label: "OT Hours", val: `${parseFloat(ps.overtimeHours).toFixed(1)}h` },
                  { label: "OT Pay", val: `S$${parseFloat(ps.overtimePay).toFixed(2)}` },
                  { label: "Leave Deduction", val: `-S$${parseFloat(ps.leaveDeduction).toFixed(2)}` },
                ]
              : [
                  { label: "Regular Hours", val: `${parseFloat(ps.regularHours).toFixed(1)}h` },
                  { label: "OT Hours", val: `${parseFloat(ps.overtimeHours).toFixed(1)}h` },
                  { label: "Regular Pay", val: `S$${parseFloat(ps.regularPay).toFixed(2)}` },
                  { label: "OT Pay", val: `S$${parseFloat(ps.overtimePay).toFixed(2)}` },
                  { label: "Leave Deduction", val: `-S$${parseFloat(ps.leaveDeduction).toFixed(2)}` },
                ];
            return (
              <div key={ps.id} className="bg-card border-2 rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedId(isOpen ? null : ps.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                  data-testid={`payslip-admin-${ps.id}`}>
                  <div className="flex items-center gap-2.5 text-left">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0">
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      {detailItems.map(({ label, val }) => (
                        <div key={label} className="bg-secondary/30 rounded-xl p-2.5">
                          <p className="text-[10px] text-muted-foreground font-bold uppercase mb-0.5">{label}</p>
                          <p className="font-bold">{val}</p>
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
    </div>
  );
}
