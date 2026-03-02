import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Briefcase } from "lucide-react";

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = await login({ username, password });
      if (user.role === 'admin') setLocation("/admin");
      else setLocation("/staff");
    } catch (err: any) {
      alert(err.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 blur-[100px] rounded-full"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 blur-[100px] rounded-full"></div>
      </div>

      <div className="w-full max-w-md bg-card border shadow-xl shadow-black/5 rounded-3xl p-8 relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
            <Briefcase className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold">Welcome Back</h2>
          <p className="text-muted-foreground text-sm mt-1">Sign in to staff portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Username</label>
            <input 
              required 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
              placeholder="admin" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Password</label>
            <input 
              required 
              type="password"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none" 
              placeholder="••••••••" 
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoggingIn}
            className="w-full btn-primary-gradient py-3.5 rounded-xl font-bold mt-2"
          >
            {isLoggingIn ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          Demo Accounts: <br/>
          Admin: <code className="bg-secondary px-1 rounded">admin</code> / <code className="bg-secondary px-1 rounded">password</code><br/>
          Staff: <code className="bg-secondary px-1 rounded">staff1</code> / <code className="bg-secondary px-1 rounded">password</code>
        </div>
      </div>
    </div>
  );
}
