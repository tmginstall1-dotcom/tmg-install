import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
 Eye, EyeOff, Loader2, Download, Lock, User,
 ShieldCheck, ClipboardList, Users, Calendar, BarChart3,
 MapPin, Clock, Zap, AlertTriangle, ExternalLink, Smartphone,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string) || "v1.0.0";

// ─── Logo Mark ────────────────────────────────────────────────────────────────
function LogoMark({ size = 64, className = "" }: { size?: number; className?: string }) {
 return (
 <img
 src="/icon-192.png"
 alt="TMG Install"
 width={size}
 height={size}
 className={`rounded-none object-cover ${className}`}
 />
 );
}

// ─── Brand Block ──────────────────────────────────────────────────────────────
function BrandBlock({ dark = false, portal }: { dark?: boolean; portal: string }) {
 return (
 <div className="flex flex-col items-center gap-3 text-center">
 <div className="relative">
 <div className={`absolute inset-0 rounded-none blur-xl opacity-40 scale-110 ${
 portal === "staff" ? "bg-blue-500" : "bg-[#0A0A0A]"
 }`} />
 <LogoMark size={72} className="relative " />
 </div>
 <div>
 <p className={`text-xl font-black tracking-[0.15em] uppercase ${dark ? "text-white" : "text-[#0A0A0A]"}`}>
 TMG INSTALL
 </p>
 <div className="flex items-center justify-center gap-2 mt-1">
 <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest ${
 portal === "staff"
 ? "bg-blue-500/20 text-blue-300 border border-[#0A0A0A]/30"
 : dark
 ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
 : "bg-violet-100 text-[#0A0A0A] border border-violet-200"
 }`}>
 {portal === "staff" ? "Staff Portal" : "Admin"}
 </span>
 <span className={`text-[11px] ${dark ? "text-white/25" : "text-black/45"}`}>{APP_VERSION}</span>
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
 className="flex items-center justify-center gap-3 w-full py-4 rounded-none bg-[#0A0A0A] hover:bg-blue-500 active:scale-[0.97] text-white font-black text-[15px] shadow-blue-900/60 transition-all"
 data-testid="link-download-apk"
 >
 <Download className="w-5 h-5" />
 Download Android App
 </a>

 <div className="bg-white/5 border border-white/10 rounded-none p-5 text-left space-y-4">
 <div className="flex items-start gap-3">
 <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
 <p className="text-white/50 text-xs leading-relaxed">
 Tap <span className="text-white font-semibold">Download</span> above, then open the file.
 If prompted, enable <span className="text-white font-semibold">Install unknown apps</span> in Android Settings.
 </p>
 </div>
 <div className="border-t border-white/10 pt-4 space-y-3">
 {[
 { icon: MapPin, text: "GPS clock-in & clock-out" },
 { icon: Zap, text: "Live job assignments" },
 { icon: Clock, text: "Attendance & payslips" },
 { icon: ShieldCheck, text: "Secure offline access" },
 ].map(({ icon: Icon, text }) => (
 <div key={text} className="flex items-center gap-3">
 <div className="w-7 h-7 rounded-none bg-blue-500/15 border border-[#0A0A0A]/20 flex items-center justify-center shrink-0">
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

const REMEMBER_KEY = "tmg_staff_remember";

function loadRemembered(): { username: string; password: string } | null {
 try {
 const raw = localStorage.getItem(REMEMBER_KEY);
 return raw ? JSON.parse(raw) : null;
 } catch {
 return null;
 }
}

// ─── Staff Login Form (native APK only) ───────────────────────────────────────
function StaffLoginForm() {
 const { login, isLoggingIn } = useAuth();
 const [, setLocation] = useLocation();
 const remembered = loadRemembered();
 const [username, setUsername] = useState(remembered?.username ?? "");
 const [password, setPassword] = useState(remembered?.password ?? "");
 const [rememberMe, setRememberMe] = useState(!!remembered);
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
 if (rememberMe) {
 localStorage.setItem(REMEMBER_KEY, JSON.stringify({ username, password }));
 } else {
 localStorage.removeItem(REMEMBER_KEY);
 }
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
 <div className="bg-white rounded-t-[32px] px-6 pt-8 pb-10">
 <h2 className="text-2xl font-black text-[#0A0A0A] mb-1 tracking-tight">Welcome back</h2>
 <p className="text-black/45 text-[14px] mb-7">Sign in to access your jobs and shifts</p>

 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="relative">
 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/45 pointer-events-none" />
 <input
 required
 autoComplete="username"
 value={username}
 onChange={e => { setUsername(e.target.value); setError(""); }}
 onFocus={e => scrollIntoView(e.target)}
 placeholder="Username"
 style={{ fontSize: 16 }}
 className="w-full pl-11 pr-4 py-4 rounded-none border-2 border-black/8 bg-white text-[#0A0A0A] placeholder:text-black/45 focus:border-[#0A0A0A] focus:bg-white focus:ring-4 focus:ring-[#0A0A0A]/10 outline-none transition-all font-medium"
 data-testid="input-username"
 />
 </div>

 <div className="relative">
 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/45 pointer-events-none" />
 <input
 required
 type={showPassword ? "text" : "password"}
 autoComplete="current-password"
 value={password}
 onChange={e => { setPassword(e.target.value); setError(""); }}
 onFocus={e => scrollIntoView(e.target)}
 placeholder="Password"
 style={{ fontSize: 16 }}
 className="w-full pl-11 pr-14 py-4 rounded-none border-2 border-black/8 bg-white text-[#0A0A0A] placeholder:text-black/45 focus:border-[#0A0A0A] focus:bg-white focus:ring-4 focus:ring-[#0A0A0A]/10 outline-none transition-all font-medium"
 data-testid="input-password"
 />
 <button
 type="button" tabIndex={-1}
 onClick={() => setShowPassword(v => !v)}
 className="absolute right-4 top-1/2 -translate-y-1/2 text-black/45 hover:text-black/65 transition-colors"
 data-testid="button-toggle-password"
 >
 {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
 </button>
 </div>

 {/* Remember me */}
 <button
 type="button"
 onClick={() => setRememberMe(v => !v)}
 data-testid="button-remember-me"
 className="flex items-center gap-3 w-full group"
 >
 <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
 rememberMe
 ? "bg-[#0A0A0A] border-blue-600"
 : "border-black/12 bg-white group-active:border-blue-300"
 }`}>
 {rememberMe && (
 <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3">
 <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
 </svg>
 )}
 </span>
 <span className="text-[14px] text-black/65 font-medium">Remember me</span>
 </button>

 {error && (
 <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-none">
 <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
 <p className="text-sm text-red-600 font-medium">{error}</p>
 </div>
 )}

 <button
 type="submit"
 disabled={isLoggingIn}
 data-testid="button-login"
 className="w-full flex items-center justify-center gap-2.5 py-4 rounded-none bg-[#0A0A0A] hover:bg-black active:scale-[0.97] disabled:opacity-60 text-white font-black text-[16px] shadow-blue-500/30 transition-all mt-2"
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
 { icon: BarChart3, text: "Real-time operations dashboard" },
 { icon: ClipboardList, text: "Quote & job lifecycle management" },
 { icon: Calendar, text: "Scheduling & booking confirmations" },
 { icon: Users, text: "Staff HR, payroll & attendance" },
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
 <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between p-14 bg-[#070B14] relative overflow-hidden border-r border-white/5">
 {/* Grid texture */}
 <div className="absolute inset-0 opacity-[0.03]"
 style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
 {/* Glow */}
 <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#0A0A0A]/20 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
 <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />

 {/* Brand */}
 <div className="relative z-10 flex items-center gap-4">
 <div className="p-1 bg-white/5 rounded-none border border-white/10 ">
 <LogoMark size={48} className=" rounded-none" />
 </div>
 <div>
 <p className="text-white font-black text-[15px] tracking-[0.15em] uppercase">TMG Install</p>
 <p className="text-blue-400 font-bold text-[10px] tracking-[0.2em] uppercase mt-0.5">Operations</p>
 </div>
 </div>

 {/* Tagline + features */}
 <div className="relative z-10 space-y-10">
 <div>
 <p className="text-5xl font-black text-white leading-[1.05] tracking-tight">
 Your command<br />centre for<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">every job.</span>
 </p>
 <p className="text-white/65 text-[15px] mt-5 leading-relaxed max-w-md font-medium">
 Manage quotes, staff, attendance and payroll from one unified dashboard.
 </p>
 </div>

 <div className="space-y-5">
 {ADMIN_FEATURES.map(({ icon: Icon, text }) => (
 <div key={text} className="flex items-center gap-4 group">
 <div className="w-10 h-10 rounded-none bg-blue-500/10 border border-[#0A0A0A]/20 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 group-hover:scale-105 transition-all">
 <Icon className="w-4 h-4 text-blue-400" />
 </div>
 <span className="text-slate-300 font-medium text-[14px]">{text}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Footer */}
 <div className="relative z-10">
 <p className="text-white/40 font-medium text-[11px] uppercase tracking-wider">The Moving Guy Pte Ltd · UEN 202424156H · Singapore · {APP_VERSION}</p>
 </div>
 </div>

 {/* ── Right panel — form ───────────────────────────────── */}
 <div className="flex-1 overflow-y-auto bg-white">
 <div ref={formRef} className="min-h-full flex flex-col items-center justify-center px-7 sm:px-12 py-16">
 <div className="w-full max-w-[400px]">

 {/* Mobile brand (shown only on small screens) */}
 <div className="lg:hidden mb-12 text-center">
 <BrandBlock portal="admin" />
 </div>

 {/* Heading */}
 <div className="mb-10 text-center lg:text-left">
 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBE9E2] text-[#0A0A0A] mb-4 lg:mx-0 mx-auto">
 <ShieldCheck className="w-3.5 h-3.5" />
 <span className="text-[10px] font-black uppercase tracking-widest">Secure Access</span>
 </div>
 <h1 className="text-[32px] font-black text-[#0A0A0A] tracking-tight leading-tight">Welcome back</h1>
 <p className="text-black/55 font-medium text-[15px] mt-2">Sign in to manage your operations</p>
 </div>

 {/* Form */}
 <form onSubmit={handleSubmit} className="space-y-5">
 <div className="space-y-1.5">
 <label className="block text-[11px] font-bold text-black/65 uppercase tracking-widest ml-1">Username</label>
 <div className="relative group">
 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/45 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
 <input
 required
 autoComplete="username"
 value={username}
 onChange={e => { setUsername(e.target.value); setError(""); }}
 onFocus={e => scrollIntoView(e.target)}
 placeholder="Enter your username"
 className="w-full pl-12 pr-4 py-4 rounded-none border-2 border-black/12 bg-white text-[#0A0A0A] text-[15px] placeholder:text-black/45 focus:border-[#0A0A0A] focus:ring-4 focus:ring-[#0A0A0A]/10 outline-none transition-all font-semibold "
 data-testid="input-username"
 />
 </div>
 </div>

 <div className="space-y-1.5">
 <label className="block text-[11px] font-bold text-black/65 uppercase tracking-widest ml-1">Password</label>
 <div className="relative group">
 <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-black/45 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
 <input
 required
 type={showPassword ? "text" : "password"}
 autoComplete="current-password"
 value={password}
 onChange={e => { setPassword(e.target.value); setError(""); }}
 onFocus={e => scrollIntoView(e.target)}
 placeholder="Enter your password"
 className="w-full pl-12 pr-14 py-4 rounded-none border-2 border-black/12 bg-white text-[#0A0A0A] text-[15px] placeholder:text-black/45 focus:border-[#0A0A0A] focus:ring-4 focus:ring-[#0A0A0A]/10 outline-none transition-all font-semibold "
 data-testid="input-password"
 />
 <button
 type="button" tabIndex={-1}
 onClick={() => setShowPassword(v => !v)}
 className="absolute right-4 top-1/2 -translate-y-1/2 text-black/45 hover:text-black/65 transition-colors p-1"
 data-testid="button-toggle-password"
 >
 {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
 </button>
 </div>
 </div>

 {error && (
 <div className="flex items-center gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-none ">
 <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
 <p className="text-[13px] text-red-700 font-bold">{error}</p>
 </div>
 )}

 <button
 type="submit"
 disabled={isLoggingIn}
 data-testid="button-login"
 className="w-full flex items-center justify-center gap-2.5 py-4 rounded-none bg-slate-900 hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 text-white font-bold text-[16px] shadow-slate-900/20 transition-all mt-2"
 >
 {isLoggingIn
 ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in…</>
 : "Sign In to Dashboard"
 }
 </button>
 </form>

 <div className="mt-12 pt-8 border-t border-black/8 text-center lg:hidden">
 <p className="text-[11px] font-medium text-black/45 uppercase tracking-widest leading-relaxed">
 The Moving Guy Pte Ltd · UEN 202424156H<br />
 <span className="text-slate-300">{APP_VERSION}</span>
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
