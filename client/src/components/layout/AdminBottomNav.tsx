import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Calendar, MessageCircle, Users, MoreHorizontal,
  Receipt, BarChart2, FileDown, Settings, HelpCircle, X,
  Smartphone, Share, Download, Search,
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
  "/admin/receipts", "/admin/analytics", "/admin/export", "/admin/faq", "/admin/settings", "/admin/seo",
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
        className={`fixed bottom-[64px] inset-x-0 z-50 sm:hidden transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-3 mb-2 bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-100">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">More</p>
            <button
              onClick={() => setDrawerOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-500"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add to Home Screen prompt */}
          {!installed && (canNativeInstall || showIOSGuide) && (
            <div className="px-4 py-3 border-b border-zinc-100 bg-slate-950">
              {canNativeInstall && (
                <button
                  onClick={async () => { await install(); setDrawerOpen(false); }}
                  data-testid="admin-install-app"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white text-slate-950 font-bold rounded-xl text-sm hover:bg-zinc-100 transition-colors"
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
                    className="w-full flex items-center justify-center gap-2 py-3 bg-white text-slate-950 font-bold rounded-xl text-sm hover:bg-zinc-100 transition-colors"
                  >
                    <Smartphone className="w-4 h-4" />
                    Add TMG Admin to Home Screen
                  </button>
                  {showIOSSteps && (
                    <div className="mt-2.5 rounded-xl bg-white/10 p-3.5 space-y-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">3 quick steps</p>
                      {[
                        { icon: Share, step: "1", text: "Tap the Share icon at the bottom of Safari" },
                        { icon: null, step: "2", text: 'Scroll down and tap "Add to Home Screen"' },
                        { icon: null, step: "3", text: 'Tap "Add" — TMG Admin appears on your home screen' },
                      ].map(({ icon: Icon, step, text }) => (
                        <div key={step} className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 text-white">{step}</span>
                          <div className="flex items-start gap-1.5 flex-1">
                            {Icon && <Icon className="w-3.5 h-3.5 text-zinc-400 mt-0.5 shrink-0" />}
                            <p className="text-xs text-zinc-300 leading-relaxed">{text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-0 divide-x divide-y divide-zinc-100">
            {secondaryItems.map(({ href, icon: Icon, label, badge, urgent }) => {
              const active = isActive(href, location);
              return (
                <Link key={href} href={href}>
                  <div
                    data-testid={`admin-more-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                    className={`flex flex-col items-center gap-2 py-5 px-3 cursor-pointer transition-colors ${
                      active ? "bg-blue-50" : "hover:bg-zinc-50"
                    }`}
                  >
                    <div className="relative">
                      <Icon className={`w-5 h-5 ${active ? "text-blue-600" : "text-zinc-500"}`} />
                      {badge > 0 && (
                        <span className={`absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center leading-none ${
                          urgent ? "bg-red-500 text-white" : "bg-zinc-400 text-white"
                        }`}>
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] font-semibold ${active ? "text-blue-600" : "text-zinc-600"}`}>
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
        className="fixed bottom-0 inset-x-0 sm:hidden z-50 bg-white border-t border-zinc-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-5 h-16">
          {primaryTabs.map(({ href, label, icon: Icon, badge, urgent }) => {
            const active = isActive(href, location);
            return (
              <Link key={href} href={href}>
                <div
                  data-testid={`admin-bottom-nav-${label.toLowerCase()}`}
                  className={`relative flex flex-col items-center justify-center h-full gap-1 transition-colors cursor-pointer ${
                    active ? "text-blue-600" : "text-zinc-400"
                  }`}
                >
                  {badge > 0 && (
                    <span className={`absolute top-2 right-[calc(50%-16px)] translate-x-3 min-w-[15px] h-[15px] px-0.5 rounded-full text-[8px] font-bold flex items-center justify-center leading-none ${
                      urgent ? "bg-red-500 text-white" : "bg-zinc-400 text-white"
                    }`}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                  <div className={`w-10 h-8 flex items-center justify-center rounded-xl transition-all ${
                    active ? "bg-blue-50" : ""
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-[10px] leading-none ${active ? "font-bold" : "font-medium"}`}>{label}</span>
                </div>
              </Link>
            );
          })}

          {/* More tab */}
          <button
            data-testid="admin-bottom-nav-more"
            onClick={() => setDrawerOpen(v => !v)}
            className={`relative flex flex-col items-center justify-center h-full gap-1 transition-colors cursor-pointer w-full ${
              isInMore || drawerOpen ? "text-blue-600" : "text-zinc-400"
            }`}
          >
            {moreBadge > 0 && (
              <span className="absolute top-2 right-[calc(50%-16px)] translate-x-3 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white rounded-full text-[8px] font-bold flex items-center justify-center leading-none">
                {moreBadge > 9 ? "9+" : moreBadge}
              </span>
            )}
            <div className={`w-10 h-8 flex items-center justify-center rounded-xl transition-all ${
              isInMore || drawerOpen ? "bg-blue-50" : ""
            }`}>
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className={`text-[10px] leading-none ${isInMore || drawerOpen ? "font-bold" : "font-medium"}`}>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
