import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/use-seo";
import { format } from "date-fns";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  Phone, ArrowRight, Loader2, LogOut, RefreshCw, ShieldCheck,
  Package, CalendarDays, ChevronRight, Home, Inbox,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

function formatMoney(v: any) {
  return new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(v || 0));
}

type Step = "phone" | "otp" | "quotes";

export default function CustomerPortal() {
  useSEO({
    title: "My Orders | TMG Install",
    description: "View all your furniture installation quotes and bookings with TMG Install.",
    noIndex: true,
  });
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  // Check if already logged in
  const { data: me, isLoading: meLoading } = useQuery<{ email: string; name?: string } | null>({
    queryKey: ["/api/customer/portal/me"],
    retry: false,
  });

  const { data: myQuotes, isLoading: quotesLoading, refetch: refetchQuotes } = useQuery<any[]>({
    queryKey: ["/api/customer/portal/my-quotes"],
    enabled: !!me,
  });

  const requestOtp = useMutation({
    mutationFn: (ph: string) =>
      apiRequest("POST", "/api/customer/portal/request-otp", { phone: ph }),
    onSuccess: () => {
      setStep("otp");
      toast({ title: "Code sent", description: "Check WhatsApp or SMS for your 6-digit code." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const verifyOtp = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/customer/portal/verify-otp", { phone, otp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/portal/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/portal/my-quotes"] });
      setStep("quotes");
      toast({ title: "Logged in!", description: "Welcome back." });
    },
    onError: (err: any) => {
      toast({ title: "Invalid code", description: err.message, variant: "destructive" });
    },
  });

  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/customer/portal/logout", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/portal/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customer/portal/my-quotes"] });
      setStep("phone");
      setPhone("");
      setOtp("");
      toast({ title: "Logged out" });
    },
  });

  if (meLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    );
  }

  const isLoggedIn = !!me;
  const showQuotes = isLoggedIn && step !== "phone" || (isLoggedIn && step === "phone");

  return (
    <div className="min-h-screen bg-black text-white pt-16 pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-10">

        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs font-semibold mb-6 transition-colors">
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-[3px] bg-amber-400" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">My Orders</h1>
          <p className="text-sm text-white/40">
            {isLoggedIn
              ? `Logged in as ${me?.email || phone}`
              : "Enter your phone number to view all your quotes and bookings."}
          </p>
        </div>

        {/* Logged-in: show quotes */}
        {isLoggedIn ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white/60 uppercase tracking-widest">Your Quotes</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => refetchQuotes()}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
                <button
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  data-testid="button-portal-logout"
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  {logout.isPending ? "…" : "Log out"}
                </button>
              </div>
            </div>

            {quotesLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
              </div>
            ) : !myQuotes || myQuotes.length === 0 ? (
              <div className="text-center py-16 border border-white/10 bg-white/[0.02]">
                <Inbox className="w-8 h-8 text-white/20 mx-auto mb-3" />
                <p className="text-sm text-white/40 font-semibold">No quotes found for your account.</p>
                <p className="text-xs text-white/25 mt-1">Create a new estimate to get started.</p>
                <Link href="/estimate"
                  className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-amber-400 text-black font-bold text-xs uppercase tracking-widest hover:bg-amber-300 transition-colors">
                  Get Estimate <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {(myQuotes as any[]).map((q: any) => (
                  <Link
                    key={q.id}
                    href={`/quotes/${q.id}`}
                    data-testid={`portal-quote-${q.id}`}
                    className="block border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] hover:border-amber-400/30 transition-all group p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-bold text-white/30 tracking-widest font-mono uppercase">
                            {q.referenceNo}
                          </span>
                          <StatusBadge status={q.status} />
                        </div>
                        <p className="font-bold text-sm text-white truncate mb-1">{q.serviceAddress}</p>
                        {q.scheduledAt && (
                          <p className="text-xs text-white/40 flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-white/20" />
                            {format(new Date(q.scheduledAt), "EEE, d MMM yyyy")}
                            {q.timeWindow && ` · ${q.timeWindow}`}
                          </p>
                        )}
                        {q.items && q.items.length > 0 && (
                          <p className="text-xs text-white/30 flex items-center gap-1.5 mt-1">
                            <Package className="w-3.5 h-3.5 text-white/20" />
                            {q.items.length} item{q.items.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-black text-amber-400 tabular-nums">{formatMoney(q.total)}</p>
                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors mt-2 ml-auto" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-white/10">
              <Link href="/estimate"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-black font-bold text-xs uppercase tracking-widest hover:bg-amber-300 transition-colors">
                + New Estimate <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          /* Login Flow */
          <div className="max-w-sm">
            {step === "phone" && (
              <div className="space-y-5">
                <div className="border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Secure Login</p>
                  </div>
                  <p className="text-xs text-white/40 mb-4 leading-relaxed">
                    We'll send a one-time code to your WhatsApp number to verify your identity.
                  </p>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
                      Phone Number (Singapore)
                    </label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 px-3 border border-white/15 bg-white/5 text-sm text-white/50 shrink-0">
                        <SiWhatsapp className="w-3.5 h-3.5 text-[#25D366]" />
                        +65
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        placeholder="8123 4567"
                        data-testid="input-portal-phone"
                        className="flex-1 bg-white/5 border border-white/15 px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 transition-colors font-mono tracking-wider"
                      />
                    </div>
                    <button
                      onClick={() => requestOtp.mutate("+65" + phone)}
                      disabled={phone.length < 8 || requestOtp.isPending}
                      data-testid="button-request-otp"
                      className="w-full py-3 bg-amber-400 text-black font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-amber-300 transition-colors"
                    >
                      {requestOtp.isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                        : <><Phone className="w-3.5 h-3.5" /> Send Code</>}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-white/25 text-center leading-relaxed">
                  Only customers with existing quotes can log in. Use the same number you provided when getting your estimate.
                </p>
              </div>
            )}

            {step === "otp" && (
              <div className="space-y-5">
                <div className="border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <SiWhatsapp className="w-4 h-4 text-[#25D366]" />
                    <p className="text-xs font-bold text-white/60 uppercase tracking-widest">Enter Code</p>
                  </div>
                  <p className="text-xs text-white/40 mb-4 leading-relaxed">
                    A 6-digit code was sent to <span className="font-bold text-white/60">+65 {phone}</span> via WhatsApp.
                  </p>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
                      6-Digit Code
                    </label>
                    <input
                      type="text"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="• • • • • •"
                      data-testid="input-portal-otp"
                      className="w-full bg-white/5 border border-white/15 px-3 py-2.5 text-center text-2xl font-black text-amber-400 placeholder-white/15 outline-none focus:border-amber-400/50 tracking-[0.5em] transition-colors"
                      maxLength={6}
                    />
                    <button
                      onClick={() => verifyOtp.mutate()}
                      disabled={otp.length < 6 || verifyOtp.isPending}
                      data-testid="button-verify-otp"
                      className="w-full py-3 bg-amber-400 text-black font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-amber-300 transition-colors"
                    >
                      {verifyOtp.isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                        : <><ShieldCheck className="w-3.5 h-3.5" /> Verify & Login</>}
                    </button>
                    <button
                      onClick={() => { setStep("phone"); setOtp(""); }}
                      className="w-full py-2 text-xs text-white/30 hover:text-white/50 transition-colors"
                    >
                      ← Use a different number
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
