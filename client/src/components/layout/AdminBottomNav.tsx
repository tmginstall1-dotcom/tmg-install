import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Calendar, MessageCircle, Users, MoreHorizontal,
  Receipt, BarChart2, FileDown, Settings, HelpCircle, X,
  Smartphone, Share, Download, Search, Truck,
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
]);

export function AdminBottomNav() {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useAdminManifest();
  const { install, showIOSGuide, canNativeInstall, installed } = useInstallPrompt();

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
    refetchInterval: 30_000,
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

  useEffect(() => { setDrawerOpen(false); }, [location]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setDrawerOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (!location.startsWith("/admin") || location === "/admin/login") return null;

  const quotes = allQuotes as any[];
  const dashBadge = quotes.filter(q => ["submitted", "under_review", "completed", "final_payment_requested"].includes(q.status)).length;
  const schedBadge = quotes.filter(q => ["deposit_paid", "booked"].includes(q.status)).length;
  const staffBadge = (pendingAmendments as any[]).length + (pendingLeave as any[]).length;
  const waBadge = (convos as any[]).reduce((s: number, c: any) => s + (c.unreadCount || 0), 0) +
    (convos as any[]).filter((c: any) => c.botPaused).length;
  const receiptsBadge = (pendingReceipts as any[]).length;
  const moreBadge = receiptsBadge;

  const isInMore = PRIMARY_SECONDARY.has(location);

  const primaryTabs = [
    { href: "/admin",               label: "Home",     icon: LayoutDashboard, badge: dashBadge,  urgent: dashBadge > 0 },
    { href: "/admin/schedule",      label: "Schedule", icon: Calendar,        badge: schedBadge },
    { href: "/admin/conversations", label: "Chat",     icon: MessageCircle,   badge: waBadge,   urgent: waBadge > 0 },
    { href: "/admin/staff",         label: "Staff",    icon: Users,           badge: staffBadge, urgent: staffBadge > 0 },
  ];

  const secondaryItems = [
    { href: "/admin/receipts",  icon: Receipt,   label: "Receipts",    badge: receiptsBadge, urgent: receiptsBadge > 0 },
    { href: "/admin/ggv-jobs",  icon: Truck,     label: "GGV Jobs",    badge: 0 },
    { href: "/admin/analytics", icon: BarChart2, label: "Analytics",   badge: 0 },
    { href: "/admin/export",    icon: FileDown,  label: "Export PDF",  badge: 0 },
    { href: "/admin/seo",       icon: Search,    label: "SEO",         badge: 0 },
    { href: "/admin/faq",       icon: HelpCircle,label: "FAQ Manager", badge: 0 },
    { href: "/admin/settings",  icon: Settings,  label: "Settings",    badge: 0 },
  ];

  return (
    <>
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* More drawer */}
      <div
        ref={drawerRef}
        className={`fixed bottom-[72px] inset-x-0 z-50 sm:hidden transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-3 mb-3 bg-[#0B0F19] rounded-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.3)] border border-white/10 overflow-hidden backdrop-blur-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">More Options</p>
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-slate-300 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Home Screen prompt */}
          {!installed && (canNativeInstall || showIOSGuide) && (
            <div className="px-4 py-3 border-b border-white/5 bg-blue-500/10">
              {canNativeInstall && (
                <button
                  onClick={async () => { await install(); setDrawerOpen(false); }}
                  data-testid="admin-install-app"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50"
                >
                  <Download className="w-4 h-4" />
                  Add TMG Admin to Home Screen
                </button>
              )}
              {showIOSGuide && (
                <div>
                  <button
                    onClick={() => setShowIOSSteps(v => !v)}
                    data-testid="admin-ios-install-guide"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50"
                  >
                    <Smartphone className="w-4 h-4" />
                    Add TMG Admin to Home Screen
                  </button>
                  {showIOSSteps && (
                    <div className="mt-3 rounded-xl bg-black/30 border border-white/5 p-4 space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1">3 quick steps</p>
                      {[
                        { icon: Share, step: "1", text: "Tap the Share icon at the bottom of Safari" },
                        { icon: null, step: "2", text: 'Scroll down and tap "Add to Home Screen"' },
                        { icon: null, step: "3", text: 'Tap "Add" — TMG Admin appears on your home screen' },
                      ].map(({ icon: Icon, step, text }) => (
                        <div key={step} className="flex items-start gap-3">
                          <span className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 text-blue-400 ring-1 ring-blue-500/30">{step}</span>
                          <div className="flex items-start gap-2 flex-1">
                            {Icon && <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />}
                            <p className="text-[13px] text-slate-300 leading-relaxed font-medium">{text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-0 divide-x divide-y divide-white/5 bg-black/20">
            {secondaryItems.map(({ href, icon: Icon, label, badge, urgent }) => {
              const active = isActive(href, location);
              return (
                <Link key={href} href={href}>
                  <div
                    data-testid={`admin-more-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                    className={`flex flex-col items-center gap-2.5 py-6 px-3 cursor-pointer transition-colors ${
                      active ? "bg-blue-500/10" : "hover:bg-white/5"
                    }`}
                  >
                    <div className="relative">
                      <Icon className={`w-[22px] h-[22px] ${active ? "text-blue-400" : "text-slate-400"}`} />
                      {badge > 0 && (
                        <span className={`absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none shadow-sm ${
                          urgent ? "bg-red-500 text-white" : "bg-blue-500 text-white"
                        }`}>
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] tracking-wide ${active ? "font-bold text-blue-300" : "font-semibold text-slate-400"}`}>
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
        className="fixed bottom-0 inset-x-0 sm:hidden z-50 bg-[#0B0F19] border-t border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.2)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-[72px]">
          {primaryTabs.map(({ href, label, icon: Icon, badge, urgent }) => {
            const active = isActive(href, location);
            return (
              <Link key={href} href={href}>
                <div
                  data-testid={`admin-bottom-nav-${label.toLowerCase()}`}
                  className={`relative flex flex-col items-center justify-center h-full gap-1.5 transition-all cursor-pointer ${
                    active ? "text-blue-400" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {badge > 0 && (
                    <span className={`absolute top-2 right-[calc(50%-20px)] translate-x-3 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none shadow-sm z-10 ${
                      urgent ? "bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-blue-500 text-white"
                    }`}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                  <div className={`relative w-12 h-8 flex items-center justify-center rounded-xl transition-all ${
                    active ? "bg-blue-500/15 ring-1 ring-inset ring-blue-500/30" : ""
                  }`}>
                    <Icon className={`w-5 h-5 ${active ? "scale-110" : "scale-100"} transition-transform`} />
                  </div>
                  <span className={`text-[10px] tracking-wide ${active ? "font-bold" : "font-medium"}`}>{label}</span>
                </div>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            data-testid="admin-bottom-nav-more"
            onClick={() => setDrawerOpen(v => !v)}
            className={`relative flex flex-col items-center justify-center h-full gap-1.5 transition-all cursor-pointer w-full ${
              isInMore || drawerOpen ? "text-blue-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {moreBadge > 0 && (
              <span className="absolute top-2 right-[calc(50%-20px)] translate-x-3 min-w-[16px] h-[16px] px-1 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center leading-none shadow-[0_0_8px_rgba(239,68,68,0.5)] z-10">
                {moreBadge > 9 ? "9+" : moreBadge}
              </span>
            )}
            <div className={`relative w-12 h-8 flex items-center justify-center rounded-xl transition-all ${
              isInMore || drawerOpen ? "bg-blue-500/15 ring-1 ring-inset ring-blue-500/30" : ""
            }`}>
              <MoreHorizontal className={`w-6 h-6 ${isInMore || drawerOpen ? "scale-110" : "scale-100"} transition-transform`} />
            </div>
            <span className={`text-[10px] tracking-wide ${isInMore || drawerOpen ? "font-bold" : "font-medium"}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
