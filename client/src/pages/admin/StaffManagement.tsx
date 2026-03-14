import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInMinutes, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO } from "date-fns";
import {
  Plus, Trash2, Pencil, Check, X, Users, Clock, UserPlus, LogIn, LogOut,
  ChevronDown, ChevronUp, Calendar, FileText, Settings2, Loader2, AlertCircle
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
    payType: staff.payType || "hourly",
    hourlyRate: staff.hourlyRate || "0",
    monthlyRate: staff.monthlyRate || "0",
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

  return (
    <div className="mx-1 mb-2 p-3 bg-secondary/30 border border-primary/20 rounded-xl space-y-2 text-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Pay Settings — {staff.name}</p>
      <div className="flex gap-2">
        {["hourly", "monthly"].map(pt => (
          <button key={pt} onClick={() => setForm(f => ({ ...f, payType: pt }))}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 ${form.payType === pt ? "border-primary bg-primary/5 text-primary" : "border-border"}`}>
            {pt === "hourly" ? "Hourly" : "Monthly Salary"}
          </button>
        ))}
      </div>
      {form.payType === "hourly" ? (
        <div>
          <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Hourly Rate (SGD)</label>
          <input type="number" step="0.01" min="0" value={form.hourlyRate}
            onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))}
            className="w-full px-2 py-1.5 text-sm border rounded-lg bg-background" data-testid="input-hourly-rate" />
        </div>
      ) : (
        <div>
          <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Monthly Rate (SGD)</label>
          <input type="number" step="1" min="0" value={form.monthlyRate}
            onChange={e => setForm(f => ({ ...f, monthlyRate: e.target.value }))}
            className="w-full px-2 py-1.5 text-sm border rounded-lg bg-background" data-testid="input-monthly-rate" />
        </div>
      )}
      <div>
        <label className="text-[10px] font-bold text-muted-foreground mb-1 block">Annual Leave Entitlement (days)</label>
        <input type="number" min="0" max="30" value={form.annualLeaveEntitlement}
          onChange={e => setForm(f => ({ ...f, annualLeaveEntitlement: parseInt(e.target.value) || 0 }))}
          className="w-full px-2 py-1.5 text-sm border rounded-lg bg-background" data-testid="input-leave-entitlement" />
      </div>
      <div className="flex gap-2">
        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="flex-1 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg disabled:opacity-50"
          data-testid="button-save-pay">
          {mut.isPending ? "Saving..." : "Save"}
        </button>
        <button onClick={onClose} className="px-3 py-1.5 border text-xs rounded-lg">Cancel</button>
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

function PayrollTab() {
  const today = new Date();
  const [from, setFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(today), "yyyy-MM-dd"));
  const [filterUserId, setFilterUserId] = useState<string>("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: staff = [] } = useQuery<any[]>({ queryKey: ["/api/staff"] });

  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/attendance", from, to, filterUserId],
    queryFn: async () => {
      const params = new URLSearchParams({ from: from + "T00:00:00", to: to + "T23:59:59" });
      if (filterUserId) params.set("userId", filterUserId);
      const res = await fetch(`/api/admin/attendance?${params}`);
      return res.json();
    },
  });

  const staffTotals = (logs as any[]).reduce((acc: any, log: any) => {
    const uid = log.userId;
    if (!acc[uid]) acc[uid] = { user: log.user, totalMins: 0, days: 0, logs: [] };
    if (log.clockOutAt) {
      const mins = differenceInMinutes(new Date(log.clockOutAt), new Date(log.clockInAt));
      acc[uid].totalMins += mins;
      acc[uid].days++;
    }
    acc[uid].logs.push(log);
    return acc;
  }, {});

  const staffRows = Object.values(staffTotals) as any[];
  const grandTotal = staffRows.reduce((sum, r) => sum + r.totalMins, 0);

  const setPreset = (preset: string) => {
    const t = new Date();
    if (preset === "thisWeek") { setFrom(format(startOfWeek(t, { weekStartsOn: 1 }), "yyyy-MM-dd")); setTo(format(endOfWeek(t, { weekStartsOn: 1 }), "yyyy-MM-dd")); }
    else if (preset === "thisMonth") { setFrom(format(startOfMonth(t), "yyyy-MM-dd")); setTo(format(endOfMonth(t), "yyyy-MM-dd")); }
    else if (preset === "today") { setFrom(format(t, "yyyy-MM-dd")); setTo(format(t, "yyyy-MM-dd")); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-background" data-testid="input-from-date" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-background" data-testid="input-to-date" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1 block">Staff</label>
            <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm bg-background min-w-[120px]" data-testid="select-staff-filter">
              <option value="">All Staff</option>
              {staff.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex gap-1 pb-0.5">
            {[["today","Today"],["thisWeek","This Week"],["thisMonth","This Month"]].map(([v,l]) => (
              <button key={v} onClick={() => setPreset(v)}
                className="px-3 py-2 text-xs font-semibold border rounded-lg hover:bg-secondary transition-colors">
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1">Total Hours</p>
          <p className="text-2xl font-black">{fmt(grandTotal)}</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1">Staff Tracked</p>
          <p className="text-2xl font-black">{staffRows.length}</p>
        </div>
        <div className="bg-card border rounded-2xl p-4">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide mb-1">Total Records</p>
          <p className="text-2xl font-black">{(logs as any[]).length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : staffRows.length === 0 ? (
        <div className="text-center py-16 bg-secondary/30 rounded-3xl border-2 border-dashed">
          <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-muted-foreground">No attendance records for this period</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staffRows.map((row: any) => (
            <div key={row.user?.id} className="bg-card border rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === row.user?.id ? null : row.user?.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                data-testid={`payroll-row-${row.user?.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-black text-sm flex items-center justify-center">
                    {row.user?.name?.charAt(0)}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-sm">{row.user?.name}</p>
                    <p className="text-xs text-muted-foreground">{row.days} day{row.days !== 1 ? "s" : ""} worked</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-black text-lg">{fmt(row.totalMins)}</p>
                    <p className="text-xs text-muted-foreground">{row.days > 0 ? fmt(Math.round(row.totalMins / row.days)) + " avg/day" : "—"}</p>
                  </div>
                  {expandedId === row.user?.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {expandedId === row.user?.id && (
                <div className="border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/30">
                        <th className="text-left px-4 py-2 text-xs font-bold text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-muted-foreground">Clock In</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-muted-foreground">Clock Out</th>
                        <th className="text-right px-4 py-2 text-xs font-bold text-muted-foreground">Hours</th>
                        <th className="text-left px-4 py-2 text-xs font-bold text-muted-foreground">GPS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.logs.map((log: any) => {
                        const mins = log.clockOutAt
                          ? differenceInMinutes(new Date(log.clockOutAt), new Date(log.clockInAt))
                          : null;
                        return (
                          <tr key={log.id} className="border-t">
                            <td className="px-4 py-2.5 font-medium">{format(new Date(log.clockInAt), "EEE d MMM")}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <LogIn className="w-3 h-3 text-emerald-500" />
                                {format(new Date(log.clockInAt), "HH:mm")}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              {log.clockOutAt ? (
                                <div className="flex items-center gap-1">
                                  <LogOut className="w-3 h-3 text-red-500" />
                                  {format(new Date(log.clockOutAt), "HH:mm")}
                                </div>
                              ) : (
                                <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">Still in</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold">
                              {mins !== null ? fmt(mins) : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {log.clockInLat && log.clockInLng ? (
                                <a href={`https://maps.google.com/?q=${log.clockInLat},${log.clockInLng}`}
                                  target="_blank" rel="noreferrer"
                                  className="text-primary underline">GPS ↗</a>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
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
              <option value="">Select staff...</option>
              {staff.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.payType === "hourly" ? `S$${s.hourlyRate}/hr` : `S$${s.monthlyRate}/mo`})
                </option>
              ))}
            </select>
          </div>
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
            return (
              <div key={ps.id} className="bg-card border-2 rounded-2xl overflow-hidden">
                <button onClick={() => setExpandedId(isOpen ? null : ps.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                  data-testid={`payslip-admin-${ps.id}`}>
                  <div className="text-left">
                    <p className="font-bold">{ps.user?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(ps.periodStart), "d MMM")} – {format(parseISO(ps.periodEnd), "d MMM yyyy")}
                    </p>
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
                      {[
                        { label: "Regular Hours", val: `${parseFloat(ps.regularHours).toFixed(1)}h` },
                        { label: "OT Hours", val: `${parseFloat(ps.overtimeHours).toFixed(1)}h` },
                        { label: "Regular Pay", val: `S$${parseFloat(ps.regularPay).toFixed(2)}` },
                        { label: "OT Pay (1.5×)", val: `S$${parseFloat(ps.overtimePay).toFixed(2)}` },
                        { label: "Leave Deduction", val: `-S$${parseFloat(ps.leaveDeduction).toFixed(2)}` },
                      ].map(({ label, val }) => (
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
