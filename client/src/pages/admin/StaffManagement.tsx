import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInMinutes, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import {
  Plus, Trash2, Pencil, Check, X, Users, Clock, UserPlus, LogIn, LogOut,
  ChevronDown, ChevronUp, Download, Calendar
} from "lucide-react";

const TEAM_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#14b8a6"];

function fmt(mins: number) {
  if (mins < 0) mins = 0;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function StaffManagement() {
  const [tab, setTab] = useState<"teams" | "payroll">("teams");

  return (
    <div className="min-h-screen pt-20 pb-16 bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-black">Staff Management</h1>
          <p className="text-muted-foreground">Manage staff accounts, teams, and track attendance</p>
        </div>

        <div className="flex gap-2 mb-6 border-b">
          {(["teams", "payroll"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px ${
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "teams" ? <><Users className="w-4 h-4 inline mr-1.5" />Teams & Staff</> : <><Clock className="w-4 h-4 inline mr-1.5" />Payroll & Attendance</>}
            </button>
          ))}
        </div>

        {tab === "teams" ? <TeamsTab /> : <PayrollTab />}
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
              <StaffRow key={s.id} staff={s} teams={teams}
                onAssign={(teamId) => assignMut.mutate({ teamId, userId: s.id })}
                onUnassign={() => unassignMut.mutate(s.id)}
                onDelete={() => { if (confirm(`Remove ${s.name}? This cannot be undone.`)) deleteStaffMut.mutate(s.id); }} />
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

function StaffRow({ staff, teams, onAssign, onUnassign, onDelete }: any) {
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
          <div className="flex items-center gap-2">
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

// ─── Payroll Tab ──────────────────────────────────────────────────────────────

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
      {/* Filters */}
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

      {/* Summary Cards */}
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

      {/* Per-Staff Breakdown */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
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
                        <th className="text-left px-4 py-2 text-xs font-bold text-muted-foreground">Location</th>
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
