import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calendar, Users, MessageCircle, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

function isActive(href: string, location: string) {
  if (href === "/admin") return location === "/admin";
  return location.startsWith(href);
}

export function AdminBottomNav() {
  const [location] = useLocation();

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
    refetchInterval: 60_000,
  });

  if (!location.startsWith("/admin") || location === "/admin/login") return null;

  const quotes = allQuotes as any[];
  const dashBadge = quotes.filter(q => ["submitted", "under_review", "completed", "final_payment_requested"].includes(q.status)).length;
  const schedBadge = quotes.filter(q => ["deposit_paid", "booked"].includes(q.status)).length;
  const staffBadge = (pendingAmendments as any[]).length + (pendingLeave as any[]).length;
  const waBadge = (convos as any[]).reduce((s: number, c: any) => s + (c.unreadCount || 0), 0);

  const tabs = [
    { href: "/admin",               label: "Dash",    icon: LayoutDashboard, badge: dashBadge,  activeColor: "text-blue-600" },
    { href: "/admin/schedule",      label: "Schedule", icon: Calendar,       badge: schedBadge, activeColor: "text-indigo-600" },
    { href: "/admin/staff",         label: "Staff",   icon: Users,           badge: staffBadge, activeColor: "text-purple-600" },
    { href: "/admin/conversations", label: "Chat",    icon: MessageCircle,   badge: waBadge,    activeColor: "text-green-600" },
    { href: "/admin/settings",      label: "Settings", icon: Settings,       badge: 0,          activeColor: "text-gray-700" },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 sm:hidden z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 h-16">
        {tabs.map(({ href, label, icon: Icon, badge, activeColor }) => {
          const active = isActive(href, location);
          return (
            <Link key={href} href={href}>
              <div
                data-testid={`admin-bottom-nav-${label.toLowerCase()}`}
                className={`relative flex flex-col items-center justify-center h-full gap-1 transition-all cursor-pointer ${
                  active ? activeColor : "text-gray-400"
                }`}
              >
                {badge > 0 && !active && (
                  <span className="absolute top-2.5 right-[calc(50%-9px)] min-w-[14px] h-3.5 px-1 bg-red-500 text-white text-[8px] font-bold flex items-center justify-center rounded-full translate-x-2 leading-none">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
                <div className={`w-9 h-8 flex items-center justify-center rounded-xl transition-all ${
                  active ? "bg-blue-50" : ""
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-semibold leading-none ${
                  active ? "font-bold" : ""
                }`}>{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
