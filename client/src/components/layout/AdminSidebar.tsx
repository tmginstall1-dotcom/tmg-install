import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Calendar, Users, BarChart2, FileDown, LogOut, Settings, MessageCircle, Receipt,
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
  const { data: convos = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/whatsapp/conversations"],
    refetchInterval: 15000,
  });
  const { data: pendingReceipts = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/receipts", "", "", ""],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/receipts`, { credentials: "include" });
      return res.json();
    },
    select: (d: any[]) => d.filter((r: any) => r.status === "pending"),
    refetchInterval: 30000,
  });

  if (!location.startsWith("/admin") || location === "/admin/login") return null;

  const quotes = allQuotes as any[];
  const newCount = quotes.filter(q => ["submitted", "under_review"].includes(q.status)).length;
  const scheduleCount = quotes.filter(q => ["deposit_paid", "booked"].includes(q.status)).length;
  const urgentPayment = quotes.filter(q => ["completed", "final_payment_requested"].includes(q.status)).length;
  const staffBadge = (pendingAmendments as any[]).length + (pendingLeave as any[]).length;
  const waBadge = (convos as any[]).reduce((s: number, c: any) => s + (c.unreadCount || 0), 0);
  const receiptsBadge = (pendingReceipts as any[]).length;

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
        { href: "/admin",                icon: LayoutDashboard, label: "Dashboard",  badge: newCount + urgentPayment },
        { href: "/admin/schedule",       icon: Calendar,        label: "Schedule",   badge: scheduleCount },
        { href: "/admin/conversations",  icon: MessageCircle,   label: "WhatsApp",   badge: waBadge },
      ],
    },
    {
      title: "Management",
      items: [
        { href: "/admin/staff",     icon: Users,     label: "Staff & HR", badge: staffBadge },
        { href: "/admin/receipts",  icon: Receipt,   label: "Receipts",   badge: receiptsBadge },
        { href: "/admin/analytics", icon: BarChart2, label: "Analytics",  badge: 0 },
        { href: "/admin/export",    icon: FileDown,  label: "Export",     badge: 0 },
        { href: "/admin/settings",  icon: Settings,  label: "Settings",   badge: 0 },
      ],
    },
  ];

  return (
    <aside
      className="hidden lg:flex fixed top-14 left-0 bottom-0 w-56 z-40 flex-col bg-white border-r border-gray-200"
      data-testid="admin-sidebar"
    >
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {navSections.map(section => (
          <div key={section.title}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.18em] px-3 pb-2">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(({ href, icon: Icon, label, badge }) => {
                const active = isActive(href);
                return (
                  <Link key={href} href={href}>
                    <div
                      data-testid={`sidebar-nav-${label.toLowerCase().replace(/[\s&]+/g, "_")}`}
                      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all group ${
                        active
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-blue-500 rounded-r-full" />
                      )}
                      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-blue-500" : "text-gray-400 group-hover:text-gray-600"}`} />
                      <span className={`flex-1 text-sm font-medium leading-none ${active ? "font-semibold" : ""}`}>
                        {label}
                      </span>
                      {badge > 0 && (
                        <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          active ? "bg-blue-500 text-white" : "bg-red-500 text-white"
                        }`}>
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

      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2.5 px-2 py-2.5 rounded-xl bg-gray-50 mb-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{user?.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
              <span className="text-[10px] text-emerald-600 font-medium">Online</span>
            </div>
          </div>
        </div>
        <button
          onClick={async () => {
            try { await logout(); } catch {}
            window.location.replace("/admin/login");
          }}
          data-testid="sidebar-signout"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
