import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Calendar, MessageCircle, Users, MoreHorizontal,
  Receipt, BarChart2, FileDown, Settings, HelpCircle, X,
  Smartphone, Share, Download, Search, Truck, Bot,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useAdminManifest } from "@/hooks/use-admin-pwa";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

function isActive(href: string, location: string) {
  if (href === "/admin") return location === "/admin";
  return location.startsWith(href);
}

const PRIMARY_SECONDARY = new Set([
  "/admin/receipts", "/admin/analytics", "/admin/export", "/admin/faq", "/admin/settings", "/admin/seo", "/admin/ggv-jobs",
  "/admin/ai",
]);

export function AdminBottomNav() {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useAdminManifest();
  const { install, showIOSGuide, canNativeInstall, installed } = useInstallPrompt();

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
    refetchInterval: 30_000,
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

  useEffect(() => { setDrawerOpen(false); }, [location]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setDrawerOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (!location.startsWith("/admin") || location === "/admin/login") return null;

  const quotes:           any[] = Array.isArray(allQuotesRaw)         ? allQuotesRaw         : [];
  const pendingAmendments:any[] = Array.isArray(pendingAmendmentsRaw) ? pendingAmendmentsRaw : [];
  const pendingLeave:     any[] = Array.isArray(pendingLeaveRaw)      ? pendingLeaveRaw      : [];
  const convos:           any[] = Array.isArray(convosRaw)            ? convosRaw            : [];
  const pendingReceipts:  any[] = Array.isArray(pendingReceiptsRaw)   ? pendingReceiptsRaw   : [];

  const dashBadge    = quotes.filter(q => ["submitted", "under_review", "completed", "final_payment_requested"].includes(q.status)).length;
  const schedBadge   = quotes.filter(q => ["deposit_paid", "booked"].includes(q.status)).length;
  const staffBadge   = pendingAmendments.length + pendingLeave.length;
  const waBadge      = convos.reduce((s: number, c: any) => s + (c.unreadCount || 0), 0) +
                       convos.filter((c: any) => c.botPaused).length;
  const receiptsBadge = pendingReceipts.length;
  const moreBadge    = receiptsBadge;

  const isInMore = PRIMARY_SECONDARY.has(location);

  const primaryTabs = [
    { href: "/admin",               label: "Home",     icon: LayoutDashboard, badge: dashBadge, urgent: dashBadge > 0 },
    { href: "/admin/schedule",      label: "Schedule", icon: Calendar,        badge: schedBadge },
    { href: "/admin/conversations", label: "Chat",     icon: MessageCircle,   badge: waBadge,   urgent: waBadge > 0 },
    { href: "/admin/staff",         label: "Staff",    icon: Users,           badge: staffBadge, urgent: staffBadge > 0 },
  ];

  const secondaryItems = [
    { href: "/admin/receipts",  icon: Receipt,    label: "Receipts",    badge: receiptsBadge, urgent: receiptsBadge > 0 },
    { href: "/admin/ggv-jobs",  icon: Truck,      label: "GGV Jobs",    badge: 0 },
    { href: "/admin/analytics", icon: BarChart2,  label: "Analytics",   badge: 0 },
    { href: "/admin/export",    icon: FileDown,   label: "Export PDF",  badge: 0 },
    { href: "/admin/seo",       icon: Search,     label: "SEO",         badge: 0 },
    { href: "/admin/ai",        icon: Bot,        label: "AI Ops",      badge: 0 },
    { href: "/admin/faq",       icon: HelpCircle, label: "FAQ Manager", badge: 0 },
    { href: "/admin/settings",  icon: Settings,   label: "Settings",    badge: 0 },
  ];

  return (
    <>
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* More drawer */}
      <div
        ref={drawerRef}
        className={`fixed bottom-[64px] inset-x-0 z-50 sm:hidden transition-transform duration-200 ease-out ${
          drawerOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-3 mb-3 bg-white border border-[#0A0A0A] overflow-hidden">
          <div className="flex items-center justify-between px-5 h-12 border-b border-black/15 bg-[#EBE9E2]">
            <p className="text-[10px] font-black text-[#0A0A0A] uppercase tracking-[0.22em]">More Options</p>
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-7 h-7 flex items-center justify-center text-[#0A0A0A]/65 hover:text-[#0A0A0A] hover:bg-black/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Home Screen prompt */}
          {!installed && (canNativeInstall || showIOSGuide) && (
            <div className="px-4 py-3 border-b border-black/10 bg-[#F5F4F0]">
              {canNativeInstall && (
                <button
                  onClick={async () => { await install(); setDrawerOpen(false); }}
                  data-testid="admin-install-app"
                  className="w-full flex items-center justify-center gap-2 h-11 bg-[#0A0A0A] text-white text-[11px] font-black uppercase tracking-[0.18em] hover:bg-black transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Add TMG Admin to Home Screen
                </button>
              )}
              {showIOSGuide && (
                <div>
                  <button
                    onClick={() => setShowIOSSteps(v => !v)}
                    data-testid="admin-ios-install-guide"
                    className="w-full flex items-center justify-center gap-2 h-11 bg-[#0A0A0A] text-white text-[11px] font-black uppercase tracking-[0.18em] hover:bg-black transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Add TMG Admin to Home Screen
                  </button>
                  {showIOSSteps && (
                    <div className="mt-3 bg-white border border-black/15 p-4 space-y-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#0A0A0A] mb-1">3 quick steps</p>
                      {[
                        { icon: Share, step: "1", text: "Tap the Share icon at the bottom of Safari" },
                        { icon: null,  step: "2", text: 'Scroll down and tap "Add to Home Screen"' },
                        { icon: null,  step: "3", text: 'Tap "Add" — TMG Admin appears on your home screen' },
                      ].map(({ icon: Icon, step, text }) => (
                        <div key={step} className="flex items-start gap-3">
                          <span className="w-5 h-5 bg-[#0A0A0A] text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{step}</span>
                          <div className="flex items-start gap-2 flex-1">
                            {Icon && <Icon className="w-3.5 h-3.5 text-[#0A0A0A]/60 mt-0.5 shrink-0" />}
                            <p className="text-[12px] text-[#0A0A0A]/80 leading-relaxed font-medium">{text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-px bg-black/10">
            {secondaryItems.map(({ href, icon: Icon, label, badge, urgent }) => {
              const active = isActive(href, location);
              return (
                <Link key={href} href={href}>
                  <div
                    data-testid={`admin-more-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                    className={`flex flex-col items-center gap-2 py-5 px-3 cursor-pointer transition-colors ${
                      active ? "bg-[#0A0A0A] text-white" : "bg-white text-[#0A0A0A] hover:bg-[#EBE9E2]"
                    }`}
                  >
                    <div className="relative">
                      <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                      {badge > 0 && (
                        <span className={`absolute -top-2 -right-2 min-w-[16px] h-4 px-1 text-[9px] font-black tabular-nums flex items-center justify-center leading-none ${
                          urgent ? "bg-[#C1121F] text-white" : active ? "bg-white text-[#0A0A0A]" : "bg-[#0A0A0A] text-white"
                        }`}>
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.16em] font-black">
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 inset-x-0 sm:hidden z-50 bg-[#F5F4F0] border-t border-black/15 pb-[env(safe-area-inset-bottom)]"
        style={{ transform: "translateZ(0)", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
      >
        <div className="grid grid-cols-5 h-[64px]">
          {primaryTabs.map(({ href, label, icon: Icon, badge, urgent }) => {
            const active = isActive(href, location);
            return (
              <Link key={href} href={href}>
                <div
                  data-testid={`admin-bottom-nav-${label.toLowerCase()}`}
                  className={`relative flex flex-col items-center justify-center h-full gap-1 transition-colors cursor-pointer ${
                    active ? "text-[#0A0A0A]" : "text-[#0A0A0A]/55"
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-[20px] h-[20px]" strokeWidth={active ? 2 : 1.5} />
                    {badge > 0 && (
                      <span className={`absolute -top-2 -right-2 min-w-[16px] h-[16px] px-1 text-[9px] font-black tabular-nums flex items-center justify-center leading-none ${
                        urgent ? "bg-[#C1121F] text-white" : "bg-[#0A0A0A] text-white"
                      }`}>
                        {badge > 9 ? "9+" : badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[9px] uppercase tracking-[0.18em] ${active ? "font-black" : "font-bold"}`}>{label}</span>
                  {active && <span className="absolute top-0 left-0 right-0 h-[2px] bg-[#0A0A0A]" />}
                </div>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            data-testid="admin-bottom-nav-more"
            onClick={() => setDrawerOpen(v => !v)}
            className={`relative flex flex-col items-center justify-center h-full gap-1 transition-colors cursor-pointer w-full ${
              isInMore || drawerOpen ? "text-[#0A0A0A]" : "text-[#0A0A0A]/55"
            }`}
          >
            <div className="relative">
              <MoreHorizontal className="w-[22px] h-[22px]" strokeWidth={isInMore || drawerOpen ? 2 : 1.5} />
              {moreBadge > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[16px] h-[16px] px-1 bg-[#C1121F] text-white text-[9px] font-black tabular-nums flex items-center justify-center leading-none">
                  {moreBadge > 9 ? "9+" : moreBadge}
                </span>
              )}
            </div>
            <span className={`text-[9px] uppercase tracking-[0.18em] ${isInMore || drawerOpen ? "font-black" : "font-bold"}`}>More</span>
            {(isInMore || drawerOpen) && <span className="absolute top-0 left-0 right-0 h-[2px] bg-[#0A0A0A]" />}
          </button>
        </div>
      </nav>
    </>
  );
}
