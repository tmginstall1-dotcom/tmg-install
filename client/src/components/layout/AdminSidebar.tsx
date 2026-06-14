import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Calendar, MessageCircle, Users, Receipt,
  BarChart2, FileDown, Settings, HelpCircle, LogOut,
  Smartphone, X, Share, Search, Truck, Bot, Handshake,
} from "lucide-react";
import { useAdminManifest, useAdminInstallPrompt } from "@/hooks/use-admin-pwa";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

function NavItem({
  href, icon: Icon, label, badge, active, urgent,
}: {
  href: string; icon: any; label: string; badge?: number; active: boolean; urgent?: boolean;
}) {
  return (
    <Link href={href}>
      <div
        data-testid={`sidebar-nav-${label.toLowerCase().replace(/[\s&]+/g, "_")}`}
        className={`relative flex items-center gap-3 px-3 h-10 cursor-pointer transition-colors group select-none ${
          active
            ? "bg-[#0A0A0A] text-white"
            : "text-[#0A0A0A]/65 hover:text-[#0A0A0A] hover:bg-black/5"
        }`}
      >
        <Icon className={`w-[16px] h-[16px] shrink-0 ${active ? "text-white" : "text-[#0A0A0A]/55 group-hover:text-[#0A0A0A]"}`} strokeWidth={1.75} />
        <span className={`flex-1 text-[11px] uppercase tracking-[0.16em] ${active ? "font-black text-white" : "font-bold"}`}>
          {label}
        </span>
        {badge != null && badge > 0 && (
          <span className={`min-w-[18px] h-[18px] px-1.5 text-[10px] font-black tabular-nums flex items-center justify-center leading-none ${
            urgent
              ? "bg-[#C1121F] text-white"
              : active
                ? "bg-white text-[#0A0A0A]"
                : "bg-[#0A0A0A] text-white"
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
    <p className="text-[9px] font-black uppercase tracking-[0.28em] text-black/45 px-3 pt-5 pb-2 first:pt-3">
      {children}
    </p>
  );
}

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  useAdminManifest();
  const { show: showInstall, dismiss: dismissInstall } = useAdminInstallPrompt();

  const { data: allQuotesRaw } = useQuery<any[]>({ queryKey: ["/api/quotes"] });
  const { data: pendingAmendmentsRaw } = useQuery<any[]>({
    queryKey: ["/api/admin/attendance/amendments"],
    select: (d: any) => (Array.isArray(d) ? d.filter((a: any) => a.status === "pending") : []),
  });
  const { data: pendingLeaveRaw } = useQuery<any[]>({
    queryKey: ["/api/admin/leave", "pending"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/leave?status=pending`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: convosRaw } = useQuery<any[]>({
    queryKey: ["/api/admin/whatsapp/conversations"],
    refetchInterval: 8_000,
    refetchIntervalInBackground: true,
  });
  const { data: pendingReceiptsRaw } = useQuery<any[]>({
    queryKey: ["/api/admin/receipts", "", "", ""],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/admin/receipts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    select: (d: any) => (Array.isArray(d) ? d.filter((r: any) => r.status === "pending") : []),
    refetchInterval: 60_000,
  });

  if (!location.startsWith("/admin") || location === "/admin/login") return null;

  const quotes:           any[] = Array.isArray(allQuotesRaw)          ? allQuotesRaw          : [];
  const pendingAmendments:any[] = Array.isArray(pendingAmendmentsRaw)  ? pendingAmendmentsRaw  : [];
  const pendingLeave:     any[] = Array.isArray(pendingLeaveRaw)       ? pendingLeaveRaw       : [];
  const convos:           any[] = Array.isArray(convosRaw)             ? convosRaw             : [];
  const pendingReceipts:  any[] = Array.isArray(pendingReceiptsRaw)    ? pendingReceiptsRaw    : [];

  const newCount       = quotes.filter(q => ["submitted", "under_review"].includes(q.status)).length;
  const scheduleCount  = quotes.filter(q => ["deposit_paid", "booked"].includes(q.status)).length;
  const urgentPayment  = quotes.filter(q => ["completed", "final_payment_requested"].includes(q.status)).length;
  const staffBadge     = pendingAmendments.length + pendingLeave.length;
  const waBadge        = convos.reduce((s: number, c: any) => s + (c.unreadCount || 0), 0);
  const pausedCount    = convos.filter((c: any) => c.botPaused).length;
  const receiptsBadge  = pendingReceipts.length;
  const dashBadge      = newCount + urgentPayment;

  function isActive(href: string) {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  }

  const initials = user?.name?.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  return (
    <aside
      className="hidden lg:flex fixed top-14 left-0 bottom-0 w-56 z-40 flex-col bg-[#F5F4F0] border-r border-black/15"
      data-testid="admin-sidebar"
    >
      <nav className="flex-1 overflow-y-auto py-2">

        <SectionLabel>Operations</SectionLabel>
        <NavItem href="/admin"               icon={LayoutDashboard} label="Dashboard"   active={isActive("/admin")}              badge={dashBadge}             urgent={dashBadge > 0} />
        <NavItem href="/admin/schedule"      icon={Calendar}        label="Schedule"    active={isActive("/admin/schedule")}    badge={scheduleCount} />
        <NavItem href="/admin/conversations" icon={MessageCircle}   label="WhatsApp"    active={isActive("/admin/conversations")} badge={waBadge + pausedCount} urgent={(waBadge + pausedCount) > 0} />

        <SectionLabel>Finance</SectionLabel>
        <NavItem href="/admin/receipts"      icon={Receipt}         label="Receipts"    active={isActive("/admin/receipts")}    badge={receiptsBadge}         urgent={receiptsBadge > 0} />
        <NavItem href="/admin/ggv-jobs"      icon={Truck}           label="GGV Jobs"    active={isActive("/admin/ggv-jobs")} />
        <NavItem href="/admin/subcontractors" icon={Handshake}      label="Subcons"     active={isActive("/admin/subcontractors")} />

        <SectionLabel>People</SectionLabel>
        <NavItem href="/admin/staff"         icon={Users}           label="Staff & HR"  active={isActive("/admin/staff")}       badge={staffBadge}            urgent={staffBadge > 0} />

        <SectionLabel>Insights</SectionLabel>
        <NavItem href="/admin/analytics"     icon={BarChart2}       label="Analytics"   active={isActive("/admin/analytics")} />
        <NavItem href="/admin/export"        icon={FileDown}        label="Export PDF"  active={isActive("/admin/export")} />

        <SectionLabel>Growth</SectionLabel>
        <NavItem href="/admin/seo"           icon={Search}          label="SEO"         active={isActive("/admin/seo")} />
        <NavItem href="/admin/reviews"       icon={Star}            label="Reviews"     active={isActive("/admin/reviews")} />
        <NavItem href="/admin/ai"            icon={Bot}             label="AI Ops"      active={isActive("/admin/ai")} />

        <SectionLabel>System</SectionLabel>
        <NavItem href="/admin/faq"           icon={HelpCircle}      label="FAQ Manager" active={isActive("/admin/faq")} />
        <NavItem href="/admin/settings"      icon={Settings}        label="Settings"    active={isActive("/admin/settings")} />

      </nav>

      {showInstall && (
        <div className="shrink-0 mx-2 mb-2 bg-white border border-black/15 p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-3 h-3 text-[#0A0A0A] shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]">Add to Home</span>
            </div>
            <button onClick={dismissInstall} className="text-black/45 hover:text-[#0A0A0A] transition-colors" data-testid="pwa-dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ol className="space-y-1.5">
            <li className="flex items-center gap-2 text-[10px] text-black/65 font-medium">
              <span className="w-4 h-4 bg-[#0A0A0A] text-white flex items-center justify-center text-[9px] font-black shrink-0">1</span>
              Tap <Share className="w-3 h-3 inline mx-0.5" /> Share in Safari
            </li>
            <li className="flex items-center gap-2 text-[10px] text-black/65 font-medium">
              <span className="w-4 h-4 bg-[#0A0A0A] text-white flex items-center justify-center text-[9px] font-black shrink-0">2</span>
              <span>"Add to Home Screen"</span>
            </li>
            <li className="flex items-center gap-2 text-[10px] text-black/65 font-medium">
              <span className="w-4 h-4 bg-[#0A0A0A] text-white flex items-center justify-center text-[9px] font-black shrink-0">3</span>
              <span>Tap "Add" — done</span>
            </li>
          </ol>
        </div>
      )}

      <div className="shrink-0 border-t border-black/12 p-3 space-y-2 bg-white">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 flex items-center justify-center bg-[#0A0A0A] text-white text-[10px] font-black tracking-wider shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-black text-[#0A0A0A] truncate leading-tight uppercase tracking-wider">{user?.name}</p>
            <p className="text-[9px] text-black/55 font-bold uppercase tracking-[0.2em] mt-0.5">Online</p>
          </div>
        </div>
        <button
          onClick={async () => {
            try { await logout(); } catch {}
            window.location.replace("/admin/login");
          }}
          data-testid="sidebar-signout"
          className="w-full flex items-center justify-center gap-2 h-9 text-[10px] font-black uppercase tracking-[0.18em] text-[#0A0A0A]/70 hover:text-white hover:bg-[#0A0A0A] border border-black/20 hover:border-[#0A0A0A] transition-colors"
        >
          <LogOut className="w-3 h-3" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
