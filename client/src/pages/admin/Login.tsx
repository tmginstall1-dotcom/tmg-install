import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const user = await login({ username, password });
      if (user.role === "admin") setLocation("/admin");
      else setLocation("/staff");
    } catch (err: any) {
      setError(err.message || "Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-foreground overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)/0.35)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsl(var(--accent)/0.2)_0%,_transparent_60%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="16" />
                <line x1="10" y1="14" x2="14" y2="14" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg tracking-wide">TMG INSTALL</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Singapore's trusted<br />furniture installation<br />team
          </h1>
          <p className="text-white/50 text-sm leading-relaxed max-w-xs">
            Manage quotes, assign jobs and track field operations from one secure portal.
          </p>
          <div className="flex gap-6 pt-2">
            {[
              { label: "Jobs completed", value: "2,400+" },
              { label: "Happy customers", value: "98%" },
              { label: "On-time rate", value: "99%" },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-white font-bold text-xl">{stat.value}</div>
                <div className="text-white/40 text-xs mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/20 text-xs">© {new Date().getFullYear()} TMG Install Pte Ltd · Singapore</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-background" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </div>
            <span className="font-bold text-base tracking-wide">TMG INSTALL</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="username"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(""); }}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                  placeholder="Enter your username"
                  data-testid="input-username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  required
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  className="w-full pl-10 pr-12 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                  placeholder="Enter your password"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive flex-shrink-0" />
                <p className="text-destructive text-xs font-medium">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full btn-primary-gradient py-3.5 rounded-xl font-semibold text-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-70"
              data-testid="button-login"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground/50">
            Authorised personnel only. Unauthorised access is prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}
