import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Eye, EyeOff, Loader2, Download, Lock, User,
  ShieldCheck, ClipboardList, Users, Calendar, BarChart3,
  MapPin, Clock, Zap, AlertTriangle, ExternalLink, Smartphone,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";

const APP_VERSION = "v1.0.25";

// ─── Logo Mark ────────────────────────────────────────────────────────────────
function LogoMark({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/icon-192.png"
      alt="TMG Install"
      width={size}
      height={size}
      className={`rounded-2xl object-cover ${className}`}
    />
  );
}

// ─── Brand Block ──────────────────────────────────────────────────────────────
function BrandBlock({ dark = false, portal }: { dark?: boolean; portal: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="relative">
        <div className={`absolute inset-0 rounded-3xl blur-xl opacity-40 scale-110 ${
          portal === "staff" ? "bg-blue-500" : "bg-violet-600"
        }`} />
        <LogoMark size={72} className="relative shadow-2xl" />
      </div>
      <div>
        <p className={`text-xl font-black tracking-[0.15em] uppercase ${dark ? "text-white" : "text-slate-900"}`}>
          TMG INSTALL
        </p>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest ${
            portal === "staff"
              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              : dark
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "bg-violet-100 text-violet-700 border border-violet-200"
          }`}>
            {portal === "staff" ? "Staff Portal" : "Admin"}
          </span>
          <span className={`text-[11px] ${dark ? "text-white/25" : "text-slate-400"}`}>{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Staff Block Screen (browser redirect) ────────────────────────────────────
function StaffBlockScreen() {
  return (
    <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center px-6">
      <div className="max-w-xs w-full space-y-8 text-center">
        <BrandBlock dark portal="staff" />

        <a
          href="https://github.com/tmginstall1-dotcom/tmg-install/releases/download/latest-build/tmg-install.apk"
          className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.97] text-white font-black text-[15px] shadow-xl shadow-blue-900/60 transition-all"
          data-testid="link-download-apk"
        >
          <Download className="w-5 h-5" />
          Download Android App
        </a>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-white/50 text-xs leading-relaxed">
              Tap <span className="text-white font-semibold">Download</span> above, then open the file.
              If prompted, enable <span className="text-white font-semibold">Install unknown apps</span> in Android Settings.
            </p>
          </div>
          <div className="border-t border-white/10 pt-4 space-y-3">
            {[
              { icon: MapPin,      text: "GPS clock-in & clock-out" },
              { icon: Zap,         text: "Live job assignments" },
              { icon: Clock,       text: "Attendance & payslips" },
              { icon: ShieldCheck, text: "Secure offline access" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-white/60 text-[13px]">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <a
          href="https://github.com/tmginstall1-dotcom/tmg-install/releases/latest"
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-xs text-white/20 hover:text-white/40 transition-colors"
        >
          <ExternalLink className="w-3 h-3" /> View all releases
        </a>

        <p className="text-white/15 text-[11px]">The Moving Guy Pte Ltd · {APP_VERSION}</p>
      </div>
    </div>
  );
}

// ─── Staff Login Form (native APK only) ───────────────────────────────────────
function StaffLoginForm() {
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const scrollIntoView = (el: HTMLElement) => {
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 320);
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
    <div className="min-h-screen bg-[#070B14] flex flex-col">
      {/* Top brand section */}
      <div className="flex-1 flex flex-col items-center justify-center pt-16 pb-8 px-6">
        <BrandBlock dark portal="staff" />
      </div>

      {/* Bottom form card */}
      <div className="bg-white rounded-t-[32px] shadow-2xl px-6 pt-8 pb-10">
        <h2 className="text-2xl font-black text-slate-900 mb-1 tracking-tight">Welcome back</h2>
        <p className="text-slate-400 text-[14px] mb-7">Sign in to access your jobs and shifts</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              required
              autoComplete="username"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(""); }}
              onFocus={e => scrollIntoView(e.target)}
              placeholder="Username"
              style={{ fontSize: 16 }}
              className="w-full pl-11 pr-4 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
              data-testid="input-username"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              required
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(""); }}
              onFocus={e => scrollIntoView(e.target)}
              placeholder="Password"
              style={{ fontSize: 16 }}
              className="w-full pl-11 pr-14 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium"
              data-testid="input-password"
            />
            <button
              type="button" tabIndex={-1}
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              data-testid="button-toggle-password"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            data-testid="button-login"
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.97] disabled:opacity-60 text-white font-black text-[16px] shadow-lg shadow-blue-500/30 transition-all mt-2"
          >
            {isLoggingIn
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in…</>
              : "Sign In"
            }
          </button>
        </form>

        <p className="text-center text-[12px] text-slate-300 mt-8">
          The Moving Guy Pte Ltd · Singapore · {APP_VERSION}
        </p>
      </div>
    </div>
  );
}

// ─── Admin Login Form ─────────────────────────────────────────────────────────
const ADMIN_FEATURES = [
  { icon: BarChart3,     text: "Real-time operations dashboard" },
  { icon: ClipboardList, text: "Quote & job lifecycle management" },
  { icon: Calendar,      text: "Scheduling & booking confirmations" },
  { icon: Users,         text: "Staff HR, payroll & attendance" },
];

function AdminLoginForm() {
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  const scrollIntoView = (el: HTMLElement) => {
    setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 320);
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
    <div className="min-h-screen flex">

      {/* ── Left panel — brand ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between p-12 bg-[#0D1117] relative overflow-hidden">
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        {/* Glow */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-3">
          <LogoMark size={40} className="shadow-lg" />
          <div>
            <p className="text-white font-black text-sm tracking-[0.12em] uppercase">TMG Install</p>
            <p className="text-white/30 text-[11px] tracking-widest uppercase">Operations</p>
          </div>
        </div>

        {/* Tagline + features */}
        <div className="relative z-10 space-y-8">
          <div>
            <p className="text-4xl font-black text-white leading-tight tracking-tight">
              Your command<br />centre for<br />every job.
            </p>
            <p className="text-white/40 text-sm mt-4 leading-relaxed">
              Manage quotes, staff, attendance and payroll from one dashboard.
            </p>
          </div>

          <div className="space-y-4">
            {ADMIN_FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-white/55 text-[13px]">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/20 text-[11px]">The Moving Guy Pte Ltd · UEN 202424156H · Singapore · {APP_VERSION}</p>
        </div>
      </div>

      {/* ── Right panel — form ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div ref={formRef} className="min-h-full flex flex-col items-center justify-center px-7 sm:px-12 py-16">
          <div className="w-full max-w-[380px]">

            {/* Mobile brand (shown only on small screens) */}
            <div className="lg:hidden mb-10 text-center">
              <BrandBlock portal="admin" />
            </div>

            {/* Heading */}
            <div className="mb-8">
              <p className="text-[12px] font-bold text-violet-600 uppercase tracking-widest mb-2">Operations Dashboard</p>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h1>
              <p className="text-slate-400 text-[14px] mt-2">Sign in to manage your operations</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    required
                    autoComplete="username"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(""); }}
                    onFocus={e => scrollIntoView(e.target)}
                    placeholder="Enter your username"
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-900 text-[15px] placeholder:text-slate-300 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 outline-none transition-all font-medium"
                    data-testid="input-username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    required
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    onFocus={e => scrollIntoView(e.target)}
                    placeholder="Enter your password"
                    className="w-full pl-11 pr-14 py-3.5 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-900 text-[15px] placeholder:text-slate-300 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-500/10 outline-none transition-all font-medium"
                    data-testid="input-password"
                  />
                  <button
                    type="button" tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <p className="text-[13px] text-red-600 font-medium">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                data-testid="button-login"
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-60 text-white font-black text-[15px] shadow-lg shadow-violet-500/25 transition-all mt-2"
              >
                {isLoggingIn
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in…</>
                  : "Sign In to Dashboard"
                }
              </button>
            </form>

            <div className="mt-10 pt-6 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-300 leading-relaxed">
                The Moving Guy Pte Ltd · UEN 202424156H · Singapore<br />
                <span className="text-slate-200">{APP_VERSION}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function Login() {
  const [location] = useLocation();
  const isStaffLogin = location === "/staff/login";

  if (isStaffLogin) {
    if (!Capacitor.isNativePlatform()) return <StaffBlockScreen />;
    return <StaffLoginForm />;
  }

  return <AdminLoginForm />;
}
