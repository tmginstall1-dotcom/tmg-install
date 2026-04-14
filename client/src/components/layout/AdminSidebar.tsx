import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard, Calendar, MessageCircle, Users, Receipt,
  BarChart2, FileDown, Settings, HelpCircle, LogOut,
  AlertCircle, Smartphone, X, Share, MoreHorizontal, Search, Truck, Bot,
} from "lucide-react";
import { useAdminManifest, useAdminInstallPrompt } from "@/hooks/use-admin-pwa";

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
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all group select-none mb-0.5 ${
          active
            ? "bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
        }`}
      >
        {active && (
          <span className="absolute left-0 inset-y-2 w-1 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.6)]" />
        )}
        <Icon className={`w-[18px] h-[18px] shrink-0 transition-colors ${active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"}`} />
        <span className={`flex-1 text-[13px] tracking-wide ${active ? "font-semibold text-white" : "font-medium"}`}>
          {label}
        </span>
        {badge != null && badge > 0 && (
          <span className={`min-w-[20px] h-[20px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center leading-none ${
            urgent ? "bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]" : active ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-200"
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
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500/80 px-3 pt-6 pb-2.5 first:pt-3">
      {children}
    </p>
  );
}

export function AdminSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  useAdminManifest();
  const { show: showInstall, dismiss: dismissInstall } = useAdminInstallPrompt();

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
  const waBadge = ((convos as any[]) ?? []).reduce((s: number, c: any) => s + (c.unreadCount || 0), 0);
  const pausedCount = ((convos as any[]) ?? []).filter((c: any) => c.botPaused).length;
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
      className="hidden lg:flex fixed top-14 left-0 bottom-0 w-56 z-40 flex-col bg-[#0B0F19] border-r border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.2)]"
      data-testid="admin-sidebar"
    >
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0">

        <SectionLabel>Operations</SectionLabel>
        <NavItem href="/admin"               icon={LayoutDashboard} label="Dashboard"   active={isActive("/admin")}              badge={dashBadge}             urgent={dashBadge > 0} />
        <NavItem href="/admin/schedule"      icon={Calendar}        label="Schedule"    active={isActive("/admin/schedule")}    badge={scheduleCount} />
        <NavItem href="/admin/conversations" icon={MessageCircle}   label="WhatsApp"    active={isActive("/admin/conversations")} badge={waBadge + pausedCount} urgent={(waBadge + pausedCount) > 0} />

        <SectionLabel>Finance</SectionLabel>
        <NavItem href="/admin/receipts"      icon={Receipt}         label="Receipts"    active={isActive("/admin/receipts")}    badge={receiptsBadge}         urgent={receiptsBadge > 0} />
        <NavItem href="/admin/ggv-jobs"      icon={Truck}           label="GGV Jobs"    active={isActive("/admin/ggv-jobs")} />

        <SectionLabel>People</SectionLabel>
        <NavItem href="/admin/staff"         icon={Users}           label="Staff & HR"  active={isActive("/admin/staff")}       badge={staffBadge}            urgent={staffBadge > 0} />

        <SectionLabel>Insights</SectionLabel>
        <NavItem href="/admin/analytics"     icon={BarChart2}       label="Analytics"   active={isActive("/admin/analytics")} />
        <NavItem href="/admin/export"        icon={FileDown}        label="Export PDF"  active={isActive("/admin/export")} />

        <SectionLabel>Growth</SectionLabel>
        <NavItem href="/admin/seo"           icon={Search}          label="SEO"         active={isActive("/admin/seo")} />
        <NavItem href="/admin/ai"            icon={Bot}             label="AI Ops"      active={isActive("/admin/ai")} />

        <SectionLabel>System</SectionLabel>
        <NavItem href="/admin/faq"           icon={HelpCircle}      label="FAQ Manager" active={isActive("/admin/faq")} />
        <NavItem href="/admin/settings"      icon={Settings}        label="Settings"    active={isActive("/admin/settings")} />

      </nav>

      {showInstall && (
        <div className="shrink-0 mx-2 mb-2 rounded-xl bg-blue-500/10 border border-blue-500/20 p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-xs font-semibold text-blue-300">Add to Home Screen</span>
            </div>
            <button onClick={dismissInstall} className="text-slate-500 hover:text-slate-300 transition-colors" data-testid="pwa-dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed mb-2.5">
            Install TMG Admin as an app on your iPhone for quick access.
          </p>
          <ol className="space-y-1.5">
            <li className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0">1</span>
              Tap <Share className="w-3 h-3 text-blue-400 inline mx-0.5" /> Share in Safari
            </li>
            <li className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0">2</span>
              Tap <span className="text-blue-300 font-medium">"Add to Home Screen"</span>
            </li>
            <li className="flex items-center gap-2 text-[10px] text-slate-400">
              <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[9px] font-bold shrink-0">3</span>
              Tap <span className="text-blue-300 font-medium">"Add"</span> — done!
            </li>
          </ol>
        </div>
      )}

      <div className="shrink-0 border-t border-white/5 p-4 space-y-2 bg-gradient-to-t from-black/20 to-transparent">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 shadow-sm">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ring-white/10"
            style={{ backgroundColor: bgColor }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-slate-100 truncate leading-tight">{user?.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">Online</span>
            </div>
          </div>
        </div>
        <button
          onClick={async () => {
            try { await logout(); } catch {}
            window.location.replace("/admin/login");
          }}
          data-testid="sidebar-signout"
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
