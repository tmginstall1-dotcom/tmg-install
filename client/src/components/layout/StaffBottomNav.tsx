import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, ClipboardList, LogOut, ChevronUp, Briefcase, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

const AVATAR_COLORS = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#8b5cf6","#14b8a6","#06b6d4","#84cc16"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

export function StaffBottomNav() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  if (!location.startsWith("/staff") || location === "/staff/login") return null;

  const bgColor = user?.id ? avatarColor(user.id) : "#6366f1";
  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const isHome = location === "/staff" || location.startsWith("/staff/jobs");
  const isHR = location.startsWith("/staff/hr");

  return (
    <>
      {/* Profile sheet */}
      {profileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={() => setProfileOpen(false)}
          />
          <div className="fixed bottom-16 inset-x-0 z-50 bg-card rounded-t-3xl shadow-2xl border-t border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="w-12 h-1 bg-border rounded-full mx-auto mt-3 mb-4" />

            <div className="px-6 pb-3 flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0 shadow-lg"
                style={{ backgroundColor: bgColor }}
              >
                {initials}
              </div>
              <div>
                <p className="font-black text-xl leading-tight">{user?.name}</p>
                <p className="text-sm text-muted-foreground font-medium">@{user?.username}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-600">
                    Active · {format(new Date(), "EEE, d MMM")}
                  </span>
                </div>
              </div>
            </div>

            <div className="mx-6 my-3 grid grid-cols-3 gap-2">
              <div className="bg-secondary/60 rounded-2xl p-3 text-center">
                <Shield className="w-4 h-4 text-primary mx-auto mb-1" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Role</p>
                <p className="text-xs font-black mt-0.5">Field Staff</p>
              </div>
              <div className="bg-secondary/60 rounded-2xl p-3 text-center">
                <Briefcase className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Team</p>
                <p className="text-xs font-black mt-0.5">{user?.teamId ? `Team ${user.teamId}` : "—"}</p>
              </div>
              <div className="bg-secondary/60 rounded-2xl p-3 text-center">
                <ClipboardList className="w-4 h-4 text-violet-500 mx-auto mb-1" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Pay</p>
                <p className="text-xs font-black mt-0.5 capitalize">{user?.payType || "—"}</p>
              </div>
            </div>

            <div className="px-6 py-3 border-t">
              <button
                onClick={async () => {
                  setProfileOpen(false);
                  try { await logout(); } catch {}
                  window.location.replace("/staff/login");
                }}
                data-testid="button-profile-signout"
                className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 font-bold rounded-2xl border border-red-100 dark:border-red-900 hover:bg-red-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
            <div className="h-4" />
          </div>
        </>
      )}

      {/* Tab bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border">
        <div className="flex items-stretch h-16 max-w-2xl mx-auto">

          <Link href="/staff" className="flex-1">
            <div
              className={`flex flex-col items-center justify-center h-full gap-0.5 relative transition-all ${
                isHome ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid="bottom-tab-home"
            >
              {isHome && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <LayoutDashboard className="w-5 h-5" strokeWidth={isHome ? 2.5 : 1.75} />
              <span className="text-[10px] font-bold tracking-tight">Home</span>
            </div>
          </Link>

          <Link href="/staff/hr" className="flex-1">
            <div
              className={`flex flex-col items-center justify-center h-full gap-0.5 relative transition-all ${
                isHR ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid="bottom-tab-hr"
            >
              {isHR && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <ClipboardList className="w-5 h-5" strokeWidth={isHR ? 2.5 : 1.75} />
              <span className="text-[10px] font-bold tracking-tight">My HR</span>
            </div>
          </Link>

          <button className="flex-1" onClick={() => setProfileOpen(v => !v)}>
            <div
              className={`flex flex-col items-center justify-center h-full gap-0.5 relative transition-all ${
                profileOpen ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid="bottom-tab-profile"
            >
              {profileOpen && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-[10px] ring-2 ring-offset-1 transition-all"
                style={{
                  backgroundColor: bgColor,
                  ringColor: profileOpen ? bgColor : "transparent",
                }}
              >
                {initials}
              </div>
              <span className="text-[10px] font-bold tracking-tight">Me</span>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}
