import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Calendar, MessageCircle, Users, Receipt,
  BarChart2, FileDown, Settings, HelpCircle, LogOut,
  AlertCircle,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";
const AVATAR_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#14b8a6"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

function NavItem({
  href, icon: Icon, label, badge, active, urgent,
}: {
  href: string; icon: any; label: string; badge?: number; active: boolean; urgent?: boolean;
}) {
  return (
    <Link href={href}>
      <div
        data-testid={`sidebar-nav-${label.toLowerCase().replace(/[\s&]+/g, "_")}`}
        className={`relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all group select-none ${
          active
            ? "bg-white/10 text-white"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        }`}
      >
        {active && (
          <span className="absolute left-0 inset-y-1.5 w-0.5 bg-blue-400 rounded-r-full" />
        )}
        <Icon className={`w-4 h-4 shrink-0 transition-colors ${active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
        <span className={`flex-1 text-sm leading-none ${active ? "font-semibold text-white" : "font-medium"}`}>
          {label}
        </span>
        {badge != null && badge > 0 && (
          <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center leading-none ${
            urgent ? "bg-red-500 text-white" : active ? "bg-blue-500 text-white" : "bg-slate-600 text-slate-200"
          }`}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
    </Link>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600 px-3 pt-4 pb-1.5 first:pt-2">
      {children}
    </p>
  );
}

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const { data: allQuotes = [] } = useQuery<any[]>({ queryKey: ["/api/quotes"] });
  const { data: pendingAmendments = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/attendance/amendments"],
    select: (d) => (d as any[]).filter((a: any) => a.status === "pending"),
  });
  const { data: pendingLeave = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/leave", "pending"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/leave?status=pending`, { credentials: "include" });
      return res.json();
    },
  });
  const { data: convos = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/whatsapp/conversations"],
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
  });
  const { data: pendingReceipts = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/receipts", "", "", ""],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/receipts`, { credentials: "include" });
      return res.json();
    },
    select: (d: any[]) => d.filter((r: any) => r.status === "pending"),
    refetchInterval: 60_000,
  });

  if (!location.startsWith("/admin") || location === "/admin/login") return null;

  const quotes = allQuotes as any[];
  const newCount = quotes.filter(q => ["submitted", "under_review"].includes(q.status)).length;
  const scheduleCount = quotes.filter(q => ["deposit_paid", "booked"].includes(q.status)).length;
  const urgentPayment = quotes.filter(q => ["completed", "final_payment_requested"].includes(q.status)).length;
  const staffBadge = (pendingAmendments as any[]).length + (pendingLeave as any[]).length;
  const waBadge = (convos as any[]).reduce((s: number, c: any) => s + (c.unreadCount || 0), 0);
  const pausedCount = (convos as any[]).filter((c: any) => c.botPaused).length;
  const receiptsBadge = (pendingReceipts as any[]).length;
  const dashBadge = newCount + urgentPayment;

  function isActive(href: string) {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  }

  const initials = user?.name?.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const bgColor = user?.id ? avatarColor(user.id) : "#6366f1";

  return (
    <aside
      className="hidden lg:flex fixed top-14 left-0 bottom-0 w-56 z-40 flex-col bg-slate-950 border-r border-white/5"
      data-testid="admin-sidebar"
    >
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0">

        <SectionLabel>Operations</SectionLabel>
        <NavItem href="/admin"               icon={LayoutDashboard} label="Dashboard"   active={isActive("/admin")}              badge={dashBadge}             urgent={dashBadge > 0} />
        <NavItem href="/admin/schedule"      icon={Calendar}        label="Schedule"    active={isActive("/admin/schedule")}    badge={scheduleCount} />
        <NavItem href="/admin/conversations" icon={MessageCircle}   label="WhatsApp"    active={isActive("/admin/conversations")} badge={waBadge + pausedCount} urgent={(waBadge + pausedCount) > 0} />

        <SectionLabel>Finance</SectionLabel>
        <NavItem href="/admin/receipts"      icon={Receipt}         label="Receipts"    active={isActive("/admin/receipts")}    badge={receiptsBadge}         urgent={receiptsBadge > 0} />

        <SectionLabel>People</SectionLabel>
        <NavItem href="/admin/staff"         icon={Users}           label="Staff & HR"  active={isActive("/admin/staff")}       badge={staffBadge}            urgent={staffBadge > 0} />

        <SectionLabel>Insights</SectionLabel>
        <NavItem href="/admin/analytics"     icon={BarChart2}       label="Analytics"   active={isActive("/admin/analytics")} />
        <NavItem href="/admin/export"        icon={FileDown}        label="Export PDF"  active={isActive("/admin/export")} />

        <SectionLabel>System</SectionLabel>
        <NavItem href="/admin/faq"           icon={HelpCircle}      label="FAQ Manager" active={isActive("/admin/faq")} />
        <NavItem href="/admin/settings"      icon={Settings}        label="Settings"    active={isActive("/admin/settings")} />

      </nav>

      <div className="shrink-0 border-t border-white/5 p-3 space-y-1">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-200 truncate leading-tight">{user?.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block shrink-0" />
              <span className="text-[9px] text-slate-500 font-medium tracking-wide uppercase">Online</span>
            </div>
          </div>
        </div>
        <button
          onClick={async () => {
            try { await logout(); } catch {}
            window.location.replace("/admin/login");
          }}
          data-testid="sidebar-signout"
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/8 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
