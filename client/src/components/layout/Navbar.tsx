import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Home, Briefcase, LayoutDashboard } from "lucide-react";
import { motion } from "framer-motion";

export function Navbar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const isCustomerArea = !location.startsWith("/admin") && !location.startsWith("/staff");

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b-0 border-white/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-foreground">
            TMG <span className="color-gradient-text">Install</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {!user ? (
            isCustomerArea ? (
              <div className="flex items-center gap-4">
                <Link href="/estimate" className="btn-primary-gradient px-5 py-2.5 rounded-xl text-sm font-bold" data-testid="nav-get-estimate">
                  Get Estimate
                </Link>
                <Link href="/admin/login" className="text-sm font-semibold text-muted-foreground hover:text-primary transition-colors hidden sm:block">
                  Staff Login
                </Link>
              </div>
            ) : null
          ) : (
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground hidden sm:flex">
                {user.role === 'admin' && (
                  <Link href="/admin" className={`hover:text-primary transition-colors ${location === '/admin' ? 'text-primary' : ''}`}>
                    Dashboard
                  </Link>
                )}
                {user.role === 'staff' && (
                  <Link href="/staff" className={`hover:text-primary transition-colors ${location === '/staff' ? 'text-primary' : ''}`}>
                    My Jobs
                  </Link>
                )}
              </div>
              <div className="h-8 w-px bg-border hidden sm:block"></div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {user.name.charAt(0)}
                </div>
                <button 
                  onClick={() => logout()}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
