import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Eye, EyeOff, Loader2, Download, Share, X,
  ShieldCheck, ClipboardList, Users, Calendar, BarChart3,
  MapPin, Clock, Zap, ArrowRight, Lock, User, Smartphone, AlertTriangle,
} from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { Capacitor } from "@capacitor/core";

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
        {canNativeInstall && (
          <div className="px-5 pb-5">
            <button onClick={install} data-testid="button-install-pwa"
              className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold text-sm py-3 rounded-xl hover:bg-white/90 transition-colors">
              <Download className="w-4 h-4" />
              Add to Home Screen
            </button>
          </div>
        )}
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
  { icon: BarChart3,    text: "Real-time operations dashboard" },
  { icon: ClipboardList, text: "Quote & job lifecycle management" },
  { icon: Calendar,    text: "Scheduling & booking confirmations" },
  { icon: Users,       text: "Staff HR, payroll & attendance" },
];

const STAFF_FEATURES = [
  { icon: MapPin,      text: "GPS-verified clock-in & clock-out" },
  { icon: Zap,         text: "Live job assignments & updates" },
  { icon: Clock,       text: "Attendance history & payslips" },
  { icon: ShieldCheck, text: "Photo & task check-in per job" },
];

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const [location, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  const isStaffLogin = location === "/staff/login";
  const features = isStaffLogin ? STAFF_FEATURES : ADMIN_FEATURES;

  // Block staff login from running in a browser — staff must use the native APK
  if (isStaffLogin && !Capacitor.isNativePlatform()) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-xs w-full space-y-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-blue-600/20 border-2 border-blue-500/30 rounded-3xl flex items-center justify-center">
              <Smartphone className="w-9 h-9 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">TMG Install</h1>
              <p className="text-blue-400 font-bold text-sm mt-0.5">Staff App</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-white font-bold text-sm">App required</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  The staff portal is only accessible through the TMG Install Android app. Please open the app on your device.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4 space-y-2">
              {[
                { icon: MapPin,      text: "GPS clock-in & clock-out" },
                { icon: Zap,         text: "Live job assignments" },
                { icon: Clock,       text: "Attendance & payslips" },
                { icon: ShieldCheck, text: "Secure offline access" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-left">
                  <div className="w-6 h-6 bg-blue-600/20 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <span className="text-xs text-slate-300 font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Contact your administrator if you have not received the app installation link.
          </p>
        </div>
      </div>
    );
  }

  const scrollFieldIntoView = (el: HTMLElement) => {
    setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 320);
  };

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
    <>
      <InstallBanner />
      <div className="min-h-screen flex">

        {/* ── LEFT PANEL ─────────────────────────────── */}
        <div className={`hidden lg:flex lg:w-[45%] xl:w-1/2 flex-col justify-between p-12 relative overflow-hidden ${
          isStaffLogin
            ? "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900"
            : "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950"
        }`}>
          <div className="absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-1">
              <span className="brand-title text-white text-xl tracking-wider">TMG INSTALL</span>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full tracking-widest uppercase ${
                isStaffLogin ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" : "bg-violet-500/20 text-violet-300 border border-violet-500/30"
              }`}>
                {isStaffLogin ? "STAFF" : "ADMIN"}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              {isStaffLogin ? "Field Staff Portal" : "Operations Center"}
            </p>
          </div>

          <div className="relative z-10">
            <p className="text-white/30 text-xs font-bold uppercase tracking-widest mb-6">
              {isStaffLogin ? "Everything you need on the field" : "Your command center for every job"}
            </p>
            <div className="space-y-5">
              {features.map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isStaffLogin ? "bg-blue-500/15 border border-blue-500/25" : "bg-violet-500/15 border border-violet-500/25"
                  }`}>
                    <Icon className={`w-4.5 h-4.5 ${isStaffLogin ? "text-blue-400" : "text-violet-400"}`} />
                  </div>
                  <p className="text-slate-300 text-sm leading-snug">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10">
            <p className="text-slate-600 text-xs">The Moving Guy Pte Ltd · UEN 202424156H · Singapore</p>
          </div>
        </div>

        {/* ── RIGHT PANEL — FORM ─────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div ref={formRef} className="min-h-full flex flex-col items-center justify-center px-6 sm:px-10 py-16">
            <div className="w-full max-w-[360px]">

              {/* Mobile brand */}
              <div className="lg:hidden mb-10 text-center">
                <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg ${
                  isStaffLogin
                    ? "bg-gradient-to-br from-blue-600 to-blue-800"
                    : "bg-gradient-to-br from-indigo-600 to-violet-800"
                }`}>
                  {isStaffLogin ? (
                    <Clock className="w-8 h-8 text-white" />
                  ) : (
                    <ShieldCheck className="w-8 h-8 text-white" />
                  )}
                </div>
                <span className="brand-title text-slate-900 text-2xl">TMG INSTALL</span>
                <p className="text-slate-500 text-sm mt-1 tracking-widest uppercase font-medium">
                  {isStaffLogin ? "Staff Portal" : "Admin Panel"}
                </p>
              </div>

              {/* Heading */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
                <p className="text-slate-500 text-[15px] mt-2 leading-relaxed">
                  {isStaffLogin
                    ? "Sign in to access your jobs and attendance"
                    : "Sign in to the operations dashboard"}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">

                {/* Username */}
                <div>
                  <label htmlFor="username" className="block text-[13px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
                    <input
                      id="username"
                      required
                      autoComplete="username"
                      value={username}
                      onChange={e => { setUsername(e.target.value); setError(""); }}
                      onFocus={e => scrollFieldIntoView(e.target)}
                      placeholder="Enter your username"
                      className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 text-base placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                      data-testid="input-username"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-[13px] font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
                    <input
                      id="password"
                      required
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setError(""); }}
                      onFocus={e => scrollFieldIntoView(e.target)}
                      placeholder="Enter your password"
                      className="w-full pl-12 pr-14 py-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-900 text-base placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  data-testid="button-login"
                  className={`w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg ${
                    isStaffLogin
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-blue-500/25"
                      : "bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white shadow-indigo-500/25"
                  }`}
                >
                  {isLoggingIn ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Signing in…</>
                  ) : (
                    <>Sign In <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>

                {/* Footer link */}
                <p className="text-center text-[13px] text-slate-500 mt-2">
                  {isStaffLogin ? (
                    <a href="/admin/login" className="text-slate-400 hover:text-slate-700 transition-colors font-medium">Admin? Sign in here →</a>
                  ) : (
                    <a href="/staff/login" className="text-slate-400 hover:text-slate-700 transition-colors font-medium">Staff portal →</a>
                  )}
                </p>
              </form>

              {/* Company footer */}
              <div className="mt-12 pt-6 border-t border-slate-100">
                <p className="text-[12px] text-slate-400 text-center leading-relaxed">
                  The Moving Guy Pte Ltd<br />
                  UEN 202424156H · Singapore
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
