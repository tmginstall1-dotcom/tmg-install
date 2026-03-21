import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Calendar, Users, BarChart2, FileDown, LogOut, Settings,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";
const AVATAR_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#14b8a6"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

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

  if (!location.startsWith("/admin") || location === "/admin/login") return null;

  const quotes = allQuotes as any[];
  const newCount = quotes.filter(q => ["submitted", "under_review"].includes(q.status)).length;
  const scheduleCount = quotes.filter(q => ["deposit_paid", "booked"].includes(q.status)).length;
  const urgentPayment = quotes.filter(q => ["completed", "final_payment_requested"].includes(q.status)).length;
  const staffBadge = (pendingAmendments as any[]).length + (pendingLeave as any[]).length;

  function isActive(href: string) {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  }

  const initials = user?.name?.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const bgColor = user?.id ? avatarColor(user.id) : "#6366f1";

  const navSections = [
    {
      title: "Operations",
      items: [
        { href: "/admin",           icon: LayoutDashboard, label: "Dashboard",  badge: newCount + urgentPayment },
        { href: "/admin/schedule",  icon: Calendar,        label: "Schedule",   badge: scheduleCount },
      ],
    },
    {
      title: "Management",
      items: [
        { href: "/admin/staff",     icon: Users,           label: "Staff & HR", badge: staffBadge },
        { href: "/admin/analytics", icon: BarChart2,       label: "Analytics",  badge: 0 },
        { href: "/admin/export",    icon: FileDown,        label: "Export",     badge: 0 },
        { href: "/admin/settings",  icon: Settings,        label: "Settings",   badge: 0 },
      ],
    },
  ];

  return (
    <aside
      className="hidden lg:flex fixed top-14 left-0 bottom-0 w-56 z-40 flex-col bg-slate-950 border-r border-white/[0.06]"
      data-testid="admin-sidebar"
    >
      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-2 py-5 space-y-5">
        {navSections.map(section => (
          <div key={section.title}>
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.28em] px-3 pb-2">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, icon: Icon, label, badge }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href}>
                    <div
                      data-testid={`sidebar-nav-${label.toLowerCase().replace(/[\s&]+/g, "_")}`}
                      className={`relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all group ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-white/35 hover:text-white/75 hover:bg-white/[0.05]"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-white rounded-r-full" />
                      )}
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          active ? "text-white" : "text-white/35 group-hover:text-white/75"
                        }`}
                      />
                      <span className="flex-1 text-[11px] font-black uppercase tracking-[0.08em] leading-none">
                        {label}
                      </span>
                      {badge > 0 && (
                        <span className="min-w-[20px] h-[18px] px-1.5 bg-orange-500 text-white text-[9px] font-black flex items-center justify-center leading-none">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom — user info + logout */}
      <div className="border-t border-white/[0.06] p-2.5 space-y-0.5">
        <div className="flex items-center gap-2.5 px-2.5 py-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0"
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-white/80 truncate leading-tight">{user?.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
              <span className="text-[9px] text-emerald-400/70 font-bold uppercase tracking-[0.1em]">Online</span>
            </div>
          </div>
        </div>
        <button
          onClick={async () => {
            try { await logout(); } catch {}
            window.location.replace("/admin/login");
          }}
          data-testid="sidebar-signout"
          className="w-full flex items-center gap-2.5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white/25 hover:text-red-400 hover:bg-red-400/[0.06] transition-colors rounded-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
