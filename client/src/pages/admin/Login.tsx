import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
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
    </div>
  );
}
