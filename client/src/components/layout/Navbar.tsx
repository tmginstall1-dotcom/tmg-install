import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, MessageCircle } from "lucide-react";

const WHATSAPP = "https://wa.me/6580880757";

export function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // No header on login pages
  if (location === "/admin/login" || location === "/staff/login") return null;

  const isAdminArea = location.startsWith("/admin");
  const isStaffArea = location.startsWith("/staff");
  const isCustomerArea = !isAdminArea && !isStaffArea;

  // ── Public customer-facing navbar ──────────────────────────────
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

  // ── Admin / Staff navbar ────────────────────────────────────────
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <Link href="/">
          <span className="brand-title text-foreground cursor-pointer">TMG INSTALL</span>
        </Link>

        {user && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground hidden sm:flex">
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className={`hover:text-primary transition-colors ${location === "/admin" ? "text-primary" : ""}`}
                >
                  Dashboard
                </Link>
              )}
              {user.role === "admin" && (
                <Link
                  href="/admin/schedule"
                  className={`hover:text-primary transition-colors ${location === "/admin/schedule" ? "text-primary" : ""}`}
                >
                  Schedule
                </Link>
              )}
              {user.role === "admin" && (
                <Link
                  href="/admin/export"
                  className={`hover:text-primary transition-colors ${location === "/admin/export" ? "text-primary" : ""}`}
                  data-testid="nav-export-pdf"
                >
                  Export
                </Link>
              )}
              {user.role === "staff" && (
                <Link
                  href="/staff"
                  className={`hover:text-primary transition-colors ${location === "/staff" ? "text-primary" : ""}`}
                >
                  My Jobs
                </Link>
              )}
            </div>
            <div className="h-7 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {user.name.charAt(0)}
              </div>
              <button
                onClick={() => logout()}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
