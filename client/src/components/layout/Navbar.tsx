import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Briefcase } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isAdminArea = location.startsWith("/admin");
  const isStaffArea = location.startsWith("/staff");
  const isCustomerArea = !isAdminArea && !isStaffArea;

  // Public customer-facing navbar — always clean, no user state exposed
  if (isCustomerArea) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="brand-title text-foreground">TMG INSTALL</span>
          </Link>
          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/6500000000"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="nav-whatsapp"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              WhatsApp Us
            </a>
            <Link
              href="/estimate"
              data-testid="nav-get-estimate"
              className="px-5 py-2 rounded-lg text-sm font-bold bg-black text-white hover:bg-gray-900 transition-colors"
            >
              Get Estimate
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  // Admin / Staff navbar (logged-in users only)
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <Briefcase className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-foreground">
            TMG <span className="color-gradient-text">Install</span>
          </span>
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
