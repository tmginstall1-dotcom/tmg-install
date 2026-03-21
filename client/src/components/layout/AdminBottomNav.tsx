import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calendar, Users, FileDown, Settings } from "lucide-react";
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

  if (!location.startsWith("/admin") || location === "/admin/login") return null;

  const quotes = allQuotes as any[];
  const dashBadge = quotes.filter(q => ["submitted", "under_review", "completed", "final_payment_requested"].includes(q.status)).length;
  const schedBadge = quotes.filter(q => ["deposit_paid", "booked"].includes(q.status)).length;
  const staffBadge = (pendingAmendments as any[]).length + (pendingLeave as any[]).length;

  const tabs = [
    { href: "/admin",            label: "Dash",    icon: LayoutDashboard, badge: dashBadge },
    { href: "/admin/schedule",   label: "Schedule", icon: Calendar,       badge: schedBadge },
    { href: "/admin/staff",      label: "Staff",   icon: Users,           badge: staffBadge },
    { href: "/admin/export",     label: "Export",  icon: FileDown,        badge: 0 },
    { href: "/admin/settings",   label: "Settings", icon: Settings,       badge: 0 },
  ];

  return (
    <nav
      className="fixed bottom-0 inset-x-0 sm:hidden z-50 bg-slate-950 border-t border-white/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 h-16">
        {tabs.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href, location);
          return (
            <Link key={href} href={href}>
              <div
                data-testid={`admin-bottom-nav-${label.toLowerCase()}`}
                className={`relative flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer ${
                  active ? "text-white" : "text-white/35 hover:text-white/60"
                }`}
              >
                {/* Badge dot */}
                {badge > 0 && !active && (
                  <span className="absolute top-2.5 right-[calc(50%-10px)] min-w-[14px] h-3.5 px-1 bg-orange-500 text-white text-[8px] font-black flex items-center justify-center leading-none translate-x-2">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
                <div className={`w-10 h-6 flex items-center justify-center transition-all ${
                  active ? "bg-white" : ""
                }`}>
                  <Icon
                    className="transition-all"
                    style={{ width: 16, height: 16, color: active ? "#000" : "rgba(255,255,255,0.35)" }}
                  />
                </div>
                <span className={`text-[9px] font-black uppercase tracking-[0.12em] leading-none ${
                  active ? "text-white" : "text-white/35"
                }`}>{label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
