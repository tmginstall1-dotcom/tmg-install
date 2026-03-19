import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Download, Share, X, ShieldCheck, ClipboardList, Users, Calendar, BarChart3, MapPin, Clock, Zap } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

function InstallBanner() {
  const { install, dismiss, showIOSGuide, canNativeInstall, showBanner } = useInstallPrompt();

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl overflow-hidden max-w-sm mx-auto">
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <img src="/icon-192.png" alt="TMG Staff" className="w-10 h-10 rounded-xl shrink-0" />
            <div>
              <p className="font-bold text-sm leading-tight">TMG Install — Staff</p>
              <p className="text-white/50 text-xs mt-0.5">tmginstall.com</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-white/40 hover:text-white transition-colors mt-0.5" data-testid="button-dismiss-install">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="px-5 pb-4 text-xs text-white/60 leading-relaxed">
          Install the staff app for fast access to clock-in, jobs, and HR — works even offline.
        </p>

        {/* Android / Chrome — one tap install */}
        {canNativeInstall && (
          <div className="px-5 pb-5">
            <button onClick={install} data-testid="button-install-pwa"
              className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold text-sm py-3 rounded-xl hover:bg-white/90 transition-colors">
              <Download className="w-4 h-4" />
              Add to Home Screen
            </button>
          </div>
        )}

        {/* iOS Safari — show steps immediately, no extra tap needed */}
        {showIOSGuide && (
          <div className="px-5 pb-5">
            <div className="bg-white/10 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">3 steps to install on iPhone</p>
              {[
                { icon: Share, step: "1", text: "Tap the Share icon at the bottom of Safari" },
                { icon: null,  step: "2", text: 'Scroll and tap "Add to Home Screen"' },
                { icon: null,  step: "3", text: 'Tap "Add" — done! Open from your home screen' },
              ].map(({ icon: Icon, step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{step}</span>
                  <div className="flex items-start gap-1.5 flex-1">
                    {Icon && <Icon className="w-3.5 h-3.5 text-white/60 mt-0.5 shrink-0" />}
                    <p className="text-xs text-white/70 leading-relaxed">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const ADMIN_FEATURES = [
  { icon: BarChart3,   text: "Real-time operations dashboard" },
  { icon: ClipboardList, text: "Quote & job lifecycle management" },
  { icon: Calendar,   text: "Scheduling & booking confirmations" },
  { icon: Users,      text: "Staff HR, payroll & attendance" },
];

const STAFF_FEATURES = [
  { icon: MapPin,  text: "GPS-verified clock-in & clock-out" },
  { icon: Zap,     text: "Live job assignments & updates" },
  { icon: Clock,   text: "Attendance history & payslips" },
  { icon: ShieldCheck, text: "Photo & task check-in per job" },
];

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const [location, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const isStaffLogin = location === "/staff/login";
  const features = isStaffLogin ? STAFF_FEATURES : ADMIN_FEATURES;

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
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ─────────────────────────────── */}
      <div className={`hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col justify-between p-12 relative overflow-hidden ${
        isStaffLogin ? "bg-slate-800" : "bg-slate-950"
      }`}>
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

        {/* Top — brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
            <span className="brand-title text-white text-xl">TMG INSTALL</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest uppercase ${
              isStaffLogin ? "bg-blue-500/20 text-blue-300" : "bg-violet-500/20 text-violet-300"
            }`}>
              {isStaffLogin ? "STAFF" : "ADMIN"}
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            {isStaffLogin ? "Field Staff Portal" : "Operations Center"}
          </p>
        </div>

        {/* Middle — headline + features */}
        <div className="relative z-10">
          <p className="text-white/30 text-xs font-bold uppercase tracking-widest mb-5">
            {isStaffLogin ? "Everything you need on the field" : "Your command center for every job"}
          </p>
          <div className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isStaffLogin ? "bg-blue-500/15 border border-blue-500/20" : "bg-violet-500/15 border border-violet-500/20"
                }`}>
                  <Icon className={`w-4 h-4 ${isStaffLogin ? "text-blue-400" : "text-violet-400"}`} />
                </div>
                <p className="text-slate-300 text-sm leading-snug">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — company */}
        <div className="relative z-10">
          <p className="text-slate-600 text-xs">The Moving Guy Pte Ltd · UEN 202424156H · Singapore</p>
        </div>
      </div>

      {/* ── RIGHT PANEL — FORM ─────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-16 bg-white min-h-screen">
        <div className="w-full max-w-[340px]">

          {/* Mobile brand (hidden on desktop where left panel shows) */}
          <div className="lg:hidden mb-10 text-center">
            <span className="brand-title text-foreground">TMG INSTALL</span>
            <p className="text-muted-foreground text-xs mt-1 tracking-widest uppercase">
              {isStaffLogin ? "Staff Portal" : "Admin Panel"}
            </p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-1.5">
              {isStaffLogin
                ? "Sign in to access your jobs and attendance"
                : "Sign in to the operations dashboard"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Username
              </label>
              <input
                id="username"
                required
                autoComplete="username"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(""); }}
                placeholder="Enter your username"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-900/8 outline-none transition-all"
                data-testid="input-username"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  required
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus:ring-2 focus:ring-slate-900/8 outline-none transition-all"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl px-4 py-3">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3.5 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
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

          {/* Footer */}
          <p className="mt-10 text-center text-[11px] text-slate-400 leading-relaxed">
            Authorised personnel only<br />
            <span className="text-slate-300">TMG Install · tmginstall.com</span>
          </p>
        </div>
      </div>

      {/* PWA install banner — staff login only */}
      {isStaffLogin && <InstallBanner />}
    </div>
  );
}
