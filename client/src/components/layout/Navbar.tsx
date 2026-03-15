import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, MessageCircle, Menu, X, LayoutDashboard, Calendar, FileDown, Briefcase, Users, ClipboardList, ChevronDown } from "lucide-react";

const WHATSAPP = "https://wa.me/6580880757";

const AVATAR_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#14b8a6","#06b6d4","#84cc16"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

export function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [location]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [profileOpen]);

  if (location === "/admin/login" || location === "/staff/login") return null;

  const isAdminArea = location.startsWith("/admin");
  const isStaffArea = location.startsWith("/staff");
  const isCustomerArea = !isAdminArea && !isStaffArea;

  // Customer nav
  if (isCustomerArea) {
    return (
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md border-b border-black/8 shadow-[0_1px_12px_rgba(0,0,0,0.05)]"
          : "bg-white border-b border-black/6"
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="brand-title text-black cursor-pointer">TMG INSTALL</span>
          </Link>
          <div className="flex items-center gap-2">
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" data-testid="nav-whatsapp"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-black/60 border border-black/12 hover:border-black/30 hover:text-black transition-all">
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Us
            </a>
            <Link href="/estimate" data-testid="nav-get-estimate"
              className="px-5 py-2 bg-black text-white text-sm font-semibold hover:bg-black/85 transition-colors"
              style={{ letterSpacing: "0.02em" }}>
              Get Estimate
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  const adminLinks = [
    { href: "/admin",          label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/schedule", label: "Schedule",  icon: Calendar },
    { href: "/admin/staff",    label: "Staff",     icon: Users },
    { href: "/admin/export",   label: "Export",    icon: FileDown },
  ];

  const staffLinks = [
    { href: "/staff",    label: "My Jobs", icon: Briefcase },
    { href: "/staff/hr", label: "My HR",   icon: ClipboardList },
  ];

  const navLinks = isStaffArea ? staffLinks : adminLinks;

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const bgColor = user?.id ? avatarColor(user.id) : "#6366f1";

  // Active check for admin (prefix match for nested pages)
  function isActive(href: string) {
    if (href === "/admin") return location === "/admin";
    if (href === "/admin/staff") return location.startsWith("/admin/staff");
    return location.startsWith(href);
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
      isAdminArea
        ? "bg-slate-950 border-b border-white/[0.06]"
        : "bg-white border-b border-gray-200"
    } ${scrolled ? "shadow-lg" : ""}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">

        {/* Brand */}
        <Link href={isStaffArea ? "/staff" : "/admin"}>
          <div className="flex items-center gap-2.5 cursor-pointer">
            <span className={`brand-title ${isAdminArea ? "text-white" : "text-foreground"}`}>
              TMG INSTALL
            </span>
            {isAdminArea && (
              <span className="hidden sm:inline text-[9px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded bg-white/10 text-white/50">
                OPS
              </span>
            )}
          </div>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {user && (
            <>
              {/* Desktop nav links */}
              <div className={`hidden sm:flex items-center ${isAdminArea ? "gap-1" : "gap-4 text-sm font-medium text-muted-foreground"}`}>
                {navLinks.map(({ href, label, icon: Icon }) => (
                  isAdminArea ? (
                    <Link key={href} href={href} data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}>
                      <div className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                        isActive(href)
                          ? "bg-white/10 text-white"
                          : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </div>
                    </Link>
                  ) : (
                    <Link key={href} href={href} data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}>
                      <span className={`hover:text-primary transition-colors ${location === href ? "text-primary font-semibold" : ""}`}>
                        {label}
                      </span>
                    </Link>
                  )
                ))}
              </div>

              {!isAdminArea && <div className="hidden sm:block h-7 w-px bg-border" />}

              {/* User avatar + dropdown */}
              <div className="relative ml-1" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  data-testid="button-user-avatar"
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${
                    isAdminArea
                      ? "hover:bg-white/10 text-white/80 hover:text-white"
                      : "hover:bg-gray-100"
                  }`}
                  title={user.name}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0"
                    style={{ backgroundColor: bgColor }}
                  >
                    {initials}
                  </div>
                  {isAdminArea && (
                    <>
                      <span className="hidden sm:block text-xs font-semibold max-w-[90px] truncate">
                        {user.name?.split(" ")[0]}
                      </span>
                      <ChevronDown className="w-3 h-3 hidden sm:block opacity-50" />
                    </>
                  )}
                </button>

                {/* Profile dropdown */}
                {profileOpen && (
                  <div className="absolute right-0 top-11 w-60 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 overflow-hidden" data-testid="profile-dropdown">
                    <div className="px-4 py-4 flex items-center gap-3 bg-slate-50 border-b">
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0"
                        style={{ backgroundColor: bgColor }}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground leading-tight truncate">{user.name}</p>
                        <p className="text-xs font-mono text-muted-foreground">@{user.username}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          <span className="text-[11px] font-semibold text-emerald-600">Active</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-2.5 flex items-center justify-between border-b">
                      <span className="text-xs text-muted-foreground">Role</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        user.role === "admin"
                          ? "bg-violet-100 text-violet-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {user.role === "admin" ? "Administrator" : "Staff"}
                      </span>
                    </div>
                    <button
                      onClick={async () => {
                        setProfileOpen(false);
                        const loginUrl = user?.role === "admin" ? "/admin/login" : "/staff/login";
                        try { await logout(); } catch {}
                        window.location.replace(loginUrl);
                      }}
                      data-testid="button-profile-signout"
                      className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile hamburger — admin only (staff has bottom nav) */}
              {!isStaffArea && (
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={`sm:hidden p-2.5 rounded-xl transition-colors ${
                    isAdminArea
                      ? "text-white/60 hover:text-white hover:bg-white/10"
                      : "text-muted-foreground hover:bg-gray-100"
                  }`}
                  aria-label={menuOpen ? "Close menu" : "Open menu"}
                  data-testid="button-mobile-menu"
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile dropdown */}
      {user && menuOpen && (
        <div className={`sm:hidden border-t ${isAdminArea ? "bg-slate-900 border-white/10" : "bg-white border-gray-100"} shadow-lg`}>
          <div className="px-4 py-3 space-y-1">
            <div className={`flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl ${isAdminArea ? "bg-white/8" : "bg-gray-50"}`}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0"
                style={{ backgroundColor: bgColor }}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className={`font-bold text-sm leading-tight truncate ${isAdminArea ? "text-white" : ""}`}>{user.name}</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span className={`text-[11px] font-semibold ${isAdminArea ? "text-emerald-400" : "text-emerald-600"}`}>
                    Active · @{user.username}
                  </span>
                </div>
              </div>
            </div>

            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  isActive(href)
                    ? isAdminArea ? "bg-white/12 text-white font-semibold" : "bg-primary/10 text-primary font-semibold"
                    : isAdminArea ? "text-white/60 hover:bg-white/8 hover:text-white" : "text-foreground hover:bg-gray-50"
                }`} data-testid={`mobile-nav-${label.toLowerCase().replace(/\s/g, "-")}`}>
                  <Icon className="w-4 h-4" />
                  {label}
                </div>
              </Link>
            ))}

            <div className="pt-2 mt-1 border-t border-white/10">
              <button
                onClick={async () => {
                  setMenuOpen(false);
                  const loginUrl = user?.role === "admin" ? "/admin/login" : "/staff/login";
                  try { await logout(); } catch {}
                  window.location.replace(loginUrl);
                }}
                className="w-full flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-500/10 transition-colors"
                data-testid="button-mobile-logout"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
