import { Link, useLocation } from "wouter";
import { LayoutDashboard, Calendar, Users, FileDown, BarChart2 } from "lucide-react";

const tabs = [
  { href: "/admin",            label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/schedule",   label: "Schedule",  icon: Calendar },
  { href: "/admin/staff",      label: "Staff",     icon: Users },
  { href: "/admin/analytics",  label: "Analytics", icon: BarChart2 },
  { href: "/admin/export",     label: "Export",    icon: FileDown },
];

function isActive(href: string, location: string) {
  if (href === "/admin") return location === "/admin";
  return location.startsWith(href);
}

export function AdminBottomNav() {
  const [location] = useLocation();

  if (!location.startsWith("/admin") || location === "/admin/login") return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 sm:hidden z-50 bg-slate-950 border-t border-white/10"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="grid grid-cols-5 h-16">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, location);
          return (
            <Link key={href} href={href}>
              <div
                data-testid={`admin-bottom-nav-${label.toLowerCase()}`}
                className={`flex flex-col items-center justify-center h-full gap-0.5 transition-colors cursor-pointer ${
                  active ? "text-white" : "text-white/35 hover:text-white/60"
                }`}
              >
                <div className={`w-10 h-6 flex items-center justify-center transition-all ${
                  active ? "bg-white" : ""
                }`}>
                  <Icon className="transition-all" style={{ width: 16, height: 16, color: active ? "#000" : "rgba(255,255,255,0.35)" }} />
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
