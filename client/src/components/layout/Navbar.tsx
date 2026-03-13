import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, MessageCircle, Menu, X, LayoutDashboard, Calendar, FileDown, Briefcase } from "lucide-react";

const WHATSAPP = "https://wa.me/6580880757";

export function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  if (location === "/admin/login" || location === "/staff/login") return null;

  const isAdminArea = location.startsWith("/admin");
  const isStaffArea = location.startsWith("/staff");
  const isCustomerArea = !isAdminArea && !isStaffArea;

  if (isCustomerArea) {
    return (
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-md border-b border-black/8 shadow-[0_1px_12px_rgba(0,0,0,0.05)]"
            : "bg-white border-b border-black/6"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="brand-title text-black cursor-pointer">TMG INSTALL</span>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="nav-whatsapp"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-black/60 border border-black/12 hover:border-black/30 hover:text-black transition-all"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp Us
            </a>
            <Link
              href="/estimate"
              data-testid="nav-get-estimate"
              className="px-5 py-2 bg-black text-white text-sm font-semibold hover:bg-black/85 transition-colors"
              style={{ letterSpacing: "0.02em" }}
            >
              Get Estimate
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  const adminLinks = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/schedule", label: "Schedule", icon: Calendar },
    { href: "/admin/export", label: "Export", icon: FileDown },
  ];

  const staffLinks = [
    { href: "/staff", label: "My Jobs", icon: Briefcase },
  ];

  const navLinks = user?.role === "admin" ? adminLinks : staffLinks;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link href="/">
          <span className="brand-title text-foreground cursor-pointer">TMG INSTALL</span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <>
              {/* Desktop nav links */}
              <div className="hidden sm:flex items-center gap-4 text-sm font-medium text-muted-foreground">
                {navLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    data-testid={`nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                    className={`hover:text-primary transition-colors ${location === href ? "text-primary font-semibold" : ""}`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
              <div className="hidden sm:block h-7 w-px bg-border" />

              {/* User avatar (always visible) */}
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {user.name.charAt(0)}
              </div>

              {/* Desktop logout */}
              <button
                onClick={() => logout()}
                className="hidden sm:flex p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="sm:hidden p-2 rounded-lg text-muted-foreground hover:bg-gray-100 transition-colors"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                data-testid="button-mobile-menu"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {user && menuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white shadow-lg">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    location === href
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-gray-50"
                  }`}
                  data-testid={`mobile-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </div>
              </Link>
            ))}
            <div className="pt-2 mt-1 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-muted-foreground px-3">{user.name}</span>
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
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
