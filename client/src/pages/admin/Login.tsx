import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Download, Smartphone, Share, X } from "lucide-react";

function useInstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("pwa-dismissed") === "1");

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }
    const handler = (e: any) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  };

  const dismiss = () => {
    sessionStorage.setItem("pwa-dismissed", "1");
    setDismissed(true);
  };

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const showIOSGuide = isIOS && isSafari && !installed;

  return { prompt, installed, dismissed, install, dismiss, showIOSGuide };
}

function InstallBanner() {
  const { prompt, installed, dismissed, install, dismiss, showIOSGuide } = useInstallPrompt();
  const [showIOSSteps, setShowIOSSteps] = useState(false);

  if (installed || dismissed) return null;
  if (!prompt && !showIOSGuide) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2">
      <div className="bg-black text-white rounded-2xl shadow-2xl overflow-hidden max-w-sm mx-auto">
        {/* Header */}
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

        {/* Android / Desktop */}
        {prompt && (
          <div className="px-5 pb-5">
            <button
              onClick={install}
              data-testid="button-install-pwa"
              className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold text-sm py-3 rounded-xl hover:bg-white/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Add to Home Screen
            </button>
          </div>
        )}

        {/* iOS */}
        {showIOSGuide && (
          <div className="px-5 pb-5 space-y-3">
            {!showIOSSteps ? (
              <button
                onClick={() => setShowIOSSteps(true)}
                data-testid="button-show-ios-steps"
                className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold text-sm py-3 rounded-xl hover:bg-white/90 transition-colors"
              >
                <Smartphone className="w-4 h-4" />
                How to Install on iPhone
              </button>
            ) : (
              <div className="bg-white/10 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-white/80 uppercase tracking-wider mb-2">3 steps to install</p>
                {[
                  { icon: Share, step: "1", text: 'Tap the Share button at the bottom of Safari' },
                  { icon: null,   step: "2", text: 'Scroll down and tap "Add to Home Screen"' },
                  { icon: null,   step: "3", text: 'Tap "Add" — done! Launch from your home screen' },
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const [location, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const isStaffLogin = location === "/staff/login";

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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">

      {/* Brand */}
      <div className="mb-14 text-center">
        <p
          className="text-[11px] tracking-[0.35em] uppercase text-black font-medium"
          style={{ letterSpacing: "0.35em" }}
        >
          TMG INSTALL
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-[320px] space-y-0">

        {/* Username */}
        <div className="mb-4">
          <input
            id="username"
            required
            autoComplete="username"
            autoFocus
            value={username}
            onChange={e => { setUsername(e.target.value); setError(""); }}
            placeholder="USERNAME"
            className="w-full bg-transparent border-b border-black/20 focus:border-black py-3 text-[13px] tracking-widest placeholder:uppercase placeholder:text-black/30 outline-none transition-colors"
            style={{ letterSpacing: "0.15em" }}
            data-testid="input-username"
          />
        </div>

        {/* Password */}
        <div className="mb-8 relative">
          <input
            id="password"
            required
            autoComplete="current-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            placeholder="PASSWORD"
            className="w-full bg-transparent border-b border-black/20 focus:border-black py-3 text-[13px] tracking-widest placeholder:uppercase placeholder:text-black/30 pr-8 outline-none transition-colors"
            style={{ letterSpacing: "0.15em" }}
            data-testid="input-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            tabIndex={-1}
            className="absolute right-0 top-1/2 -translate-y-1/2 text-black/30 hover:text-black transition-colors"
            data-testid="button-toggle-password"
          >
            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-[11px] tracking-widest uppercase text-red-500 mb-5 text-center">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoggingIn}
          className="w-full bg-black text-white text-[11px] tracking-[0.3em] uppercase py-4 hover:bg-black/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ letterSpacing: "0.3em" }}
          data-testid="button-login"
        >
          {isLoggingIn ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            "SIGN IN"
          )}
        </button>
      </form>

      {/* Footer */}
      <p
        className="mt-16 text-[10px] tracking-widest uppercase text-black/20"
        style={{ letterSpacing: "0.2em" }}
      >
        Authorised Personnel Only
      </p>

      {/* PWA install banner — staff login only */}
      {isStaffLogin && <InstallBanner />}
    </div>
  );
}
