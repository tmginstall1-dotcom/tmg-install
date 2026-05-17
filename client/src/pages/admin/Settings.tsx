import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, MessageSquare, RefreshCw, Smartphone, Phone, XCircle, Zap, ExternalLink, ChevronDown, ChevronUp, GitBranch, Tag, ToggleLeft, ToggleRight, RotateCcw, Clock, Bot, Globe, Star, Bell, BadgePercent, BellRing, BellOff } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useAdminPush } from "@/hooks/use-admin-push";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

type DayKey = typeof DAYS[number]["key"];
type DaySchedule = { open: boolean; start: string; end: string };
type BusinessHours = Record<DayKey, DaySchedule>;

const DEFAULT_HOURS: BusinessHours = {
  mon: { open: true, start: "09:00", end: "18:00" },
  tue: { open: true, start: "09:00", end: "18:00" },
  wed: { open: true, start: "09:00", end: "18:00" },
  thu: { open: true, start: "09:00", end: "18:00" },
  fri: { open: true, start: "09:00", end: "18:00" },
  sat: { open: true, start: "09:00", end: "18:00" },
  sun: { open: true, start: "09:00", end: "18:00" },
};

export default function AdminSettings() {
  const { toast } = useToast();
  const { state: pushState, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = useAdminPush();
  const [token, setToken] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [apkUrl, setApkUrl] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);
  const [showManualOverride, setShowManualOverride] = useState(false);

  const { data: currentAppVersion } = useQuery<{ version: string; apkUrl: string }>({
    queryKey: ["/api/app-version"],
  });

  const { data: tokenStatus, refetch: recheckToken } = useQuery<{ status: string; message: string }>({
    queryKey: ["/api/admin/whatsapp/token-status"],
    refetchInterval: 60_000,
  });

  const updateToken = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/settings/whatsapp-token", { token }),
    onSuccess: () => {
      toast({ title: "Token updated", description: "WhatsApp messages will now use the new token." });
      setToken("");
      setTimeout(() => recheckToken(), 1500);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update token", description: err.message, variant: "destructive" });
    },
  });

  const [directPin, setDirectPin] = useState("");

  const registerDirect = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/whatsapp/register-direct", { pin: directPin.trim() }),
    onSuccess: () => {
      toast({ title: "Number registered!", description: "✅ +65 8088 0757 is now active on WhatsApp Business API." });
      setDirectPin("");
    },
    onError: (err: any) => {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    },
  });

  const requestCode = useMutation({
    mutationFn: (method: "SMS" | "VOICE" = "SMS") =>
      apiRequest("POST", "/api/admin/whatsapp/request-code", { method }),
    onSuccess: (_data, method) => {
      setSmsSent(true);
      toast({
        title: method === "VOICE" ? "Voice call initiated" : "SMS sent",
        description: `Enter the 6-digit code ${method === "VOICE" ? "read out in the call" : "sent"} to +65 8088 0757`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Failed to send code", description: err.message, variant: "destructive" });
    },
  });

  const verifyCode = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/whatsapp/verify-code", { code: otpCode.trim() }),
    onSuccess: () => {
      toast({ title: "Number registered!", description: "✅ +65 8088 0757 is now active on WhatsApp Business API." });
      setOtpCode("");
      setSmsSent(false);
    },
    onError: (err: any) => {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    },
  });

  const subscribeWaba = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/whatsapp/subscribe-waba", {}),
    onSuccess: (data: any) => {
      toast({ title: "WABA subscribed!", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Subscription failed", description: err.message, variant: "destructive" });
    },
  });

  const updateAppVersion = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/settings/app-version", { version: newVersion.trim(), apkUrl: apkUrl.trim() }),
    onSuccess: () => {
      toast({ title: "App version updated", description: `Staff will be prompted to update to v${newVersion}.` });
      setNewVersion("");
      setApkUrl("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to update version", description: err.message, variant: "destructive" });
    },
  });

  // Promo campaign
  interface PromoCodeData { id: number; code: string; discountAmount: string; maxUses: number; usesCount: number; active: boolean; minOrderAmount: string; }
  const { data: promoCodes, isLoading: promoLoading } = useQuery<PromoCodeData[]>({
    queryKey: ["/api/admin/promo"],
  });
  const [editingPromo, setEditingPromo] = useState<{ code: string; discount: number; maxUses: number; minOrderAmount: number } | null>(null);

  const togglePromo = useMutation({
    mutationFn: (id: number) => apiRequest("POST", "/api/admin/promo/toggle", { id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/promo"] }); queryClient.invalidateQueries({ queryKey: ["/api/promo-bar"] }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetPromo = useMutation({
    mutationFn: (id: number) => apiRequest("POST", "/api/admin/promo/reset", { id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/promo"] }); toast({ title: "Usage count reset to 0" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const upsertPromo = useMutation({
    mutationFn: (data: { code: string; discountAmount: number; maxUses: number; active: boolean; minOrderAmount: number }) =>
      apiRequest("POST", "/api/admin/promo/upsert", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promo"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promo-bar"] });
      setEditingPromo(null);
      toast({ title: "Promo code saved" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Loyalty discount toggle ────────────────────────────────────────────────
  const { data: loyaltyData } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/admin/settings/loyalty-discount"],
  });
  const loyaltyEnabled = loyaltyData?.enabled ?? false;
  const toggleLoyalty = useMutation({
    mutationFn: (enabled: boolean) => apiRequest("POST", "/api/admin/settings/loyalty-discount", { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/loyalty-discount"] }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── WA day-before reminders toggle ─────────────────────────────────────────
  const { data: waReminderData } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/admin/settings/wa-reminders"],
  });
  const waRemindersEnabled = waReminderData?.enabled ?? false;
  const toggleWaReminders = useMutation({
    mutationFn: (enabled: boolean) => apiRequest("POST", "/api/admin/settings/wa-reminders", { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/settings/wa-reminders"] }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Business Hours / Chatbot Settings ─────────────────────────────────────
  const { data: bizSettingsRaw = [] } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["/api/admin/app-settings"],
  });

  const bizSettings = Object.fromEntries((bizSettingsRaw as { key: string; value: string }[]).map(s => [s.key, s.value]));
  const savedHours: BusinessHours = bizSettings.business_hours
    ? (() => { try { return JSON.parse(bizSettings.business_hours); } catch { return DEFAULT_HOURS; } })()
    : DEFAULT_HOURS;

  const [hours, setHours] = useState<BusinessHours | null>(null);
  const displayHours: BusinessHours = hours ?? savedHours;

  const [serviceAreas, setServiceAreas] = useState<string | null>(null);
  const [depositPct, setDepositPct] = useState<string | null>(null);
  const [responseSla, setResponseSla] = useState<string | null>(null);
  const [urgentPolicy, setUrgentPolicy] = useState<string | null>(null);
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null);

  const displayServiceAreas = serviceAreas ?? (bizSettings.business_service_areas || "");
  const displayDepositPct = depositPct ?? (bizSettings.business_deposit_pct || "50");
  const displayResponseSla = responseSla ?? (bizSettings.business_response_sla || "within 2 hours during business hours");
  const displayUrgentPolicy = urgentPolicy ?? (bizSettings.business_urgent_policy || "");
  const displayGoogleReviewUrl = googleReviewUrl ?? (bizSettings.google_review_url || "");

  const saveBusinessSettings = useMutation({
    mutationFn: (data: Record<string, string>) => apiRequest("POST", "/api/admin/app-settings/bulk", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/app-settings"] });
      toast({ title: "Business settings saved", description: "The bot will use these settings immediately." });
      setHours(null);
      setServiceAreas(null);
      setDepositPct(null);
      setResponseSla(null);
      setUrgentPolicy(null);
      setGoogleReviewUrl(null);
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const handleSaveBusinessSettings = () => {
    saveBusinessSettings.mutate({
      business_hours: JSON.stringify(displayHours),
      business_service_areas: displayServiceAreas,
      business_deposit_pct: displayDepositPct,
      business_response_sla: displayResponseSla,
      business_urgent_policy: displayUrgentPolicy,
      google_review_url: displayGoogleReviewUrl,
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] pt-14 lg:pl-56 pb-24">
      <div className="bg-white border-b border-zinc-200 px-6 py-5 mb-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs text-zinc-400 mb-1">Management → Settings</p>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">Configure integrations and app behavior</p>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-8 space-y-6">

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-600" />
            WhatsApp Access Token
          </h2>
          {tokenStatus && (
            <span
              data-testid="badge-token-status"
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                tokenStatus.status === "ok"
                  ? "bg-emerald-100 text-emerald-700"
                  : tokenStatus.status === "expiring_soon"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {tokenStatus.status === "ok"
                ? <CheckCircle className="w-3 h-3" />
                : tokenStatus.status === "expiring_soon"
                ? <Clock className="w-3 h-3" />
                : <XCircle className="w-3 h-3" />}
              {tokenStatus.status === "ok" ? "Token OK" : tokenStatus.status === "expiring_soon" ? "Expiring Soon" : "Token Invalid"}
            </span>
          )}
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-500 mb-2">
            {tokenStatus && (tokenStatus.status === "expired" || tokenStatus.status === "invalid" || tokenStatus.status === "error") ? (
              <span className="text-red-600 font-medium">{tokenStatus.message}</span>
            ) : tokenStatus?.status === "expiring_soon" ? (
              <span className="text-amber-700 font-medium">{tokenStatus.message}</span>
            ) : tokenStatus ? (
              <span className="text-emerald-700 font-medium">{tokenStatus.message}</span>
            ) : (
              "Checking token status…"
            )}
          </p>

          {tokenStatus?.status === "expiring_soon" && (
            <div data-testid="alert-token-expiring" className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <Bell className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <strong className="font-semibold">Token expiring soon.</strong> Your WhatsApp token will expire in {(tokenStatus as any).daysLeft} day{(tokenStatus as any).daysLeft === 1 ? "" : "s"}. Renew it now to avoid service interruption — the bot will go offline when it expires.
              </div>
            </div>
          )}

          {(tokenStatus?.status === "expired" || tokenStatus?.status === "invalid") && (
            <div data-testid="alert-token-expired" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div>
                <strong className="font-semibold">Bot is offline.</strong> The current token is {tokenStatus.status}. Customers messaging +65 8088 0757 will not get any replies until you paste a new System User token below.
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="wa-token" className="text-xs text-zinc-500">New Access Token</Label>
            <Textarea
              id="wa-token"
              data-testid="input-whatsapp-token"
              placeholder="Paste your System User token from Meta Business Suite…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={4}
              className="font-mono text-xs w-full p-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong className="font-semibold">Use a permanent System User token (never expires):</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-1 text-amber-700">
              <li>Go to <strong>business.facebook.com</strong> → Settings → System Users</li>
              <li>Select <strong>TMG Install Bot</strong></li>
              <li>Click <strong>"Generate new token"</strong> → select the TMG Install WA app</li>
              <li>Grant <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px] font-mono">whatsapp_business_messaging</code> and <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px] font-mono">whatsapp_business_management</code></li>
              <li>Copy the token, paste it above and click Update</li>
            </ol>
          </div>

          <button
            data-testid="button-update-whatsapp-token"
            onClick={() => updateToken.mutate()}
            disabled={updateToken.isPending || token.trim().length < 20}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {updateToken.isPending ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Updating…</>
            ) : (
              <><CheckCircle className="h-4 w-4" /> Update Token</>
            )}
          </button>
        </div>
      </div>

      {/* Activate Webhook — Subscribe WABA */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Activate WhatsApp Chatbot
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            This links your WhatsApp Business Account to the bot so incoming messages are forwarded to the server. Do this once after setting the token.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
            Click this button to subscribe WABA <strong>2118758868886697</strong> to the app webhook. This is required for the bot to reply to customers.
          </div>
          <button
            data-testid="button-subscribe-waba"
            onClick={() => subscribeWaba.mutate()}
            disabled={subscribeWaba.isPending}
            className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors w-full disabled:opacity-50"
          >
            {subscribeWaba.isPending ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Subscribing…</>
            ) : (
              <><CheckCircle className="h-4 w-4" /> Subscribe WABA to Webhook (Activate Bot)</>
            )}
          </button>
        </div>
      </div>

      {/* WhatsApp Number Registration */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Phone className="h-4 w-4 text-blue-600" />
            Register WhatsApp Number
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            +65 8088 0757 shows as "Pending" in Meta. Use this to complete the registration — it sends a verification SMS to the SIM, then you enter the code to activate the number.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            Make sure you have updated the Access Token above first before doing this.
          </div>

          <div className="flex flex-col gap-3">
            <button
              data-testid="button-request-wa-sms"
              onClick={() => requestCode.mutate("SMS")}
              disabled={requestCode.isPending}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors w-full disabled:opacity-50"
            >
              {requestCode.isPending
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Sending…</>
                : <><Phone className="h-4 w-4" /> Send verification SMS to +65 8088 0757</>
              }
            </button>

            <button
              data-testid="button-request-wa-voice"
              onClick={() => requestCode.mutate("VOICE")}
              disabled={requestCode.isPending}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-sm font-medium transition-colors w-full disabled:opacity-50"
            >
              {requestCode.isPending
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Calling…</>
                : <><Phone className="h-4 w-4" /> Try voice call instead</>
              }
            </button>

            {smsSent && (
              <div className="space-y-2 mt-2">
                <Label htmlFor="otp-code" className="text-xs text-zinc-500">Enter the 6-digit code from the SMS / voice call</Label>
                <div className="flex gap-2">
                  <Input
                    id="otp-code"
                    data-testid="input-otp-code"
                    placeholder="123456"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="h-9 font-mono text-lg tracking-widest text-center flex-1"
                  />
                  <button
                    data-testid="button-verify-wa-code"
                    onClick={() => verifyCode.mutate()}
                    disabled={verifyCode.isPending || otpCode.length < 6}
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
                  >
                    {verifyCode.isPending
                      ? <RefreshCw className="h-4 w-4 animate-spin" />
                      : <CheckCircle className="h-4 w-4" />
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Direct Register with PIN */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Direct Register (set PIN)
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            If the SMS/voice method gives "Request code error", use this instead. Set any 6-digit PIN — this registers +65 8088 0757 directly on the WhatsApp Business API.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="direct-pin" className="text-xs text-zinc-500">Choose a 6-digit PIN (you'll need this for 2FA)</Label>
            <div className="flex gap-2">
              <Input
                id="direct-pin"
                data-testid="input-direct-pin"
                placeholder="e.g. 123456"
                value={directPin}
                onChange={e => setDirectPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="h-9 font-mono text-lg tracking-widest text-center flex-1"
              />
              <button
                data-testid="button-register-direct"
                onClick={() => registerDirect.mutate()}
                disabled={registerDirect.isPending || directPin.length !== 6}
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
              >
                {registerDirect.isPending
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : <CheckCircle className="h-4 w-4" />
                }
              </button>
            </div>
            <p className="text-xs text-zinc-500">Write down this PIN — Meta may ask for it later for account verification.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-600" />
              Staff App Version
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              The app version updates automatically every time a new build completes on GitHub Actions.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">
            <Zap className="w-3 h-3" /> Auto-managed
          </span>
        </div>
        <div className="p-5 space-y-4">

          {/* Current version status */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-semibold text-zinc-800">Live on all staff phones</span>
              </div>
              <span className="text-xl font-bold text-zinc-900" data-testid="text-current-version">
                {currentAppVersion?.version
                  ? (currentAppVersion.version.startsWith("v") ? currentAppVersion.version : `v${currentAppVersion.version}`)
                  : "—"}
              </span>
            </div>
            {currentAppVersion?.apkUrl && (
              <a
                href={currentAppVersion.apkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline break-all"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                Download latest APK
              </a>
            )}
          </div>

          {/* How it works */}
          <div className="flex items-start gap-3 bg-white border border-zinc-200 rounded-lg p-3.5">
            <GitBranch className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-600 leading-relaxed">
              <strong className="text-zinc-900 font-semibold">How auto-update works:</strong><br />
              Each GitHub Actions build automatically notifies this server when it completes.
              The version number and APK URL are updated instantly — staff phones show the update
              banner within minutes, no admin action required.
            </div>
          </div>

          {/* Manual override (collapsed by default) */}
          <button
            type="button"
            onClick={() => setShowManualOverride(v => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-zinc-500 hover:text-zinc-700 py-1 transition-colors"
          >
            <span>Emergency manual override</span>
            {showManualOverride ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showManualOverride && (
            <div className="space-y-3 border border-amber-200 rounded-lg p-4 bg-amber-50 mt-2">
              <p className="text-xs text-amber-800 font-medium">
                Only use this if the auto-update webhook failed. Version must match the format baked into the APK (e.g. <code className="font-mono bg-amber-100 px-1 rounded">v1.0.91</code>).
              </p>
              <div className="space-y-1">
                <Label htmlFor="app-version" className="text-xs text-amber-900">Version (e.g. v1.0.92)</Label>
                <Input
                  id="app-version"
                  data-testid="input-app-version"
                  placeholder="v1.0.92"
                  value={newVersion}
                  onChange={(e) => setNewVersion(e.target.value)}
                  className="h-9 text-sm font-mono bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="apk-url" className="text-xs text-amber-900">APK Download URL</Label>
                <Input
                  id="apk-url"
                  data-testid="input-apk-url"
                  placeholder="https://github.com/.../tmg-install.apk"
                  value={apkUrl}
                  onChange={(e) => setApkUrl(e.target.value)}
                  className="h-9 text-sm bg-white"
                />
              </div>
              <button
                data-testid="button-update-app-version"
                onClick={() => updateAppVersion.mutate()}
                disabled={updateAppVersion.isPending || !newVersion.trim() || !apkUrl.trim()}
                className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors w-full disabled:opacity-50"
              >
                {updateAppVersion.isPending ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Updating…</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Force Publish</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Promo Campaign Card */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Tag className="h-4 w-4 text-amber-500" />
            Promo Campaign
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Manage discount codes shown in the announcement bar and estimate wizard.
          </p>
        </div>
        <div className="p-5 space-y-4">
          {promoLoading ? (
            <p className="text-sm text-zinc-500">Loading…</p>
          ) : !promoCodes?.length ? (
            <p className="text-sm text-zinc-500">No promo codes found.</p>
          ) : (
            promoCodes.map(p => (
              <div key={p.id} className="border border-zinc-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm tracking-widest text-zinc-900">{p.code}</span>
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {p.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      ${parseFloat(p.discountAmount).toFixed(0)} OFF · {p.usesCount} / {p.maxUses} used · {Math.max(0, p.maxUses - p.usesCount)} slots remaining
                      {parseFloat(p.minOrderAmount ?? "0") > 0 && (
                        <> · Min spend ${parseFloat(p.minOrderAmount).toFixed(0)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => resetPromo.mutate(p.id)}
                      disabled={resetPromo.isPending}
                      data-testid={`promo-reset-${p.id}`}
                      title="Reset usage count to 0"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => togglePromo.mutate(p.id)}
                      disabled={togglePromo.isPending}
                      data-testid={`promo-toggle-${p.id}`}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                        p.active 
                          ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200" 
                          : "bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {p.active ? (
                        <><ToggleRight className="h-4 w-4" /> Pause</>
                      ) : (
                        <><ToggleLeft className="h-4 w-4" /> Activate</>
                      )}
                    </button>
                    <button
                      onClick={() => setEditingPromo({ code: p.code, discount: parseFloat(p.discountAmount), maxUses: p.maxUses, minOrderAmount: parseFloat(p.minOrderAmount ?? "0") || 0 })}
                      className="inline-flex items-center justify-center h-8 px-3 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs font-medium transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium text-zinc-500">
                    <span>Slots used</span>
                    <span>{p.usesCount} / {p.maxUses}</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (p.usesCount / p.maxUses) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Edit form */}
          {editingPromo && (
            <div className="border border-amber-200 rounded-lg p-4 bg-amber-50 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Edit Promo Code</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-amber-900">Code</Label>
                  <Input
                    value={editingPromo.code}
                    onChange={e => setEditingPromo(p => p ? { ...p, code: e.target.value.toUpperCase() } : p)}
                    className="h-9 font-mono uppercase bg-white border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                    data-testid="promo-edit-code"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-amber-900">Discount (SGD)</Label>
                  <Input
                    type="number"
                    value={editingPromo.discount}
                    onChange={e => setEditingPromo(p => p ? { ...p, discount: parseFloat(e.target.value) || 0 } : p)}
                    className="h-9 bg-white border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                    data-testid="promo-edit-discount"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-amber-900">Max Uses</Label>
                  <Input
                    type="number"
                    value={editingPromo.maxUses}
                    onChange={e => setEditingPromo(p => p ? { ...p, maxUses: parseInt(e.target.value) || 100 } : p)}
                    className="h-9 bg-white border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                    data-testid="promo-edit-max-uses"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-amber-900">Minimum Spend (SGD)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editingPromo.minOrderAmount}
                    onChange={e => setEditingPromo(p => p ? { ...p, minOrderAmount: Math.max(0, parseFloat(e.target.value) || 0) } : p)}
                    className="h-9 bg-white border-amber-300 focus:border-amber-500 focus:ring-amber-500"
                    data-testid="promo-edit-min-spend"
                  />
                  <p className="text-[11px] text-amber-700/80">Job total must reach this amount for the code to apply. Set to 0 for no minimum.</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => upsertPromo.mutate({ code: editingPromo.code, discountAmount: editingPromo.discount, maxUses: editingPromo.maxUses, active: true, minOrderAmount: editingPromo.minOrderAmount })}
                  disabled={upsertPromo.isPending}
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  data-testid="promo-save"
                >
                  {upsertPromo.isPending ? "Saving…" : "Save Changes"}
                </button>
                <button 
                  onClick={() => setEditingPromo(null)}
                  className="inline-flex items-center justify-center h-9 px-4 rounded-lg text-amber-800 hover:bg-amber-100 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add new promo */}
          {!editingPromo && (
            <button
              onClick={() => setEditingPromo({ code: "", discount: 50, maxUses: 100, minOrderAmount: 0 })}
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors"
              data-testid="promo-add-new"
            >
              + Add Promo Code
            </button>
          )}
        </div>
      </div>

      {/* ── Business Hours & Chatbot Settings ──────────────────────────────── */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-600" />
              Business Hours
            </h2>
            <p className="text-xs text-zinc-500 mt-1">The WhatsApp bot answers "What time are you open?" from these settings.</p>
          </div>
        </div>
        <div className="p-5 space-y-2">
          {DAYS.map(({ key, label }) => {
            const day = displayHours[key] || { open: true, start: "09:00", end: "18:00" };
            return (
              <div key={key} className="flex items-center gap-3" data-testid={`hours-row-${key}`}>
                <button
                  type="button"
                  onClick={() => setHours(h => ({ ...(h ?? displayHours), [key]: { ...day, open: !day.open } }))}
                  className="flex items-center gap-1.5 w-28 shrink-0 text-sm"
                >
                  {day.open
                    ? <ToggleRight className="w-4 h-4 text-blue-500" />
                    : <ToggleLeft className="w-4 h-4 text-zinc-400" />}
                  <span className={day.open ? "text-zinc-900 font-medium" : "text-zinc-400"}>{label}</span>
                </button>
                {day.open ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={day.start}
                      onChange={e => setHours(h => ({ ...(h ?? displayHours), [key]: { ...day, start: e.target.value } }))}
                      className="h-8 w-32 text-sm border-zinc-300"
                    />
                    <span className="text-xs text-zinc-400">to</span>
                    <Input
                      type="time"
                      value={day.end}
                      onChange={e => setHours(h => ({ ...(h ?? displayHours), [key]: { ...day, end: e.target.value } }))}
                      className="h-8 w-32 text-sm border-zinc-300"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-zinc-400 italic">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-600" />
            Chatbot Knowledge Settings
          </h2>
          <p className="text-xs text-zinc-500 mt-1">These values are read by the WhatsApp bot to answer customer questions accurately.</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">
              Service Areas
            </Label>
            <Textarea
              data-testid="input-service-areas"
              value={displayServiceAreas}
              onChange={e => setServiceAreas(e.target.value)}
              rows={3}
              placeholder="All areas across Singapore — HDB, condo, landed, commercial..."
              className="text-sm border-zinc-300 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">
                Deposit %
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  data-testid="input-deposit-pct"
                  type="number"
                  min={0}
                  max={100}
                  value={displayDepositPct}
                  onChange={e => setDepositPct(e.target.value)}
                  className="h-9 text-sm border-zinc-300 w-20"
                />
                <span className="text-sm text-zinc-500">%</span>
              </div>
            </div>
            <div>
              <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">
                Response SLA
              </Label>
              <Input
                data-testid="input-response-sla"
                value={displayResponseSla}
                onChange={e => setResponseSla(e.target.value)}
                placeholder="within 2 hours during business hours"
                className="h-9 text-sm border-zinc-300"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 block">
              Urgent / Same-Day Policy
            </Label>
            <Textarea
              data-testid="input-urgent-policy"
              value={displayUrgentPolicy}
              onChange={e => setUrgentPolicy(e.target.value)}
              rows={2}
              placeholder="Same-day and urgent jobs may be available subject to team availability..."
              className="text-sm border-zinc-300 resize-none"
            />
          </div>
          <div>
            <Label className="text-xs text-zinc-500 uppercase tracking-wide font-semibold mb-1.5 flex items-center gap-1.5">
              <Star className="w-3 h-3 text-yellow-500" />
              Google Review Link
            </Label>
            <Input
              data-testid="input-google-review-url"
              value={displayGoogleReviewUrl}
              onChange={e => setGoogleReviewUrl(e.target.value)}
              placeholder="https://g.page/r/YOUR_PLACE_ID/review"
              className="h-9 text-sm border-zinc-300"
            />
            <p className="text-xs text-zinc-400 mt-1.5">
              When a job is marked <strong>Completed</strong>, the bot automatically sends this link to the customer via WhatsApp to request a Google review.
            </p>
          </div>
          <Button
            data-testid="button-save-business-settings"
            onClick={handleSaveBusinessSettings}
            disabled={saveBusinessSettings.isPending}
            className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saveBusinessSettings.isPending ? "Saving..." : "Save Chatbot Settings"}
          </Button>
        </div>
      </div>


      {/* ── Automation: WA Day-Before Reminders ────────────────────────────── */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Bell className="h-4 w-4 text-violet-600" />
            Automated Appointment Reminders
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Send a WhatsApp reminder to customers the day before their scheduled appointment.</p>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-800">Day-before WhatsApp reminder</p>
            <p className="text-xs text-zinc-500 mt-0.5">Sent automatically between 9 AM – 6 PM, once per job.</p>
          </div>
          <button
            data-testid="toggle-wa-reminders"
            onClick={() => toggleWaReminders.mutate(!waRemindersEnabled)}
            disabled={toggleWaReminders.isPending}
            className="flex items-center gap-1.5 text-sm font-semibold"
          >
            {waRemindersEnabled
              ? <ToggleRight className="w-6 h-6 text-violet-600" />
              : <ToggleLeft className="w-6 h-6 text-zinc-400" />}
            <span className={waRemindersEnabled ? "text-violet-700" : "text-zinc-500"}>
              {waRemindersEnabled ? "ON" : "OFF"}
            </span>
          </button>
        </div>
      </div>

      {/* ── Loyalty Discount ───────────────────────────────────────────────── */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <BadgePercent className="h-4 w-4 text-amber-600" />
            Repeat Customer Loyalty Discount
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Automatically apply a 5% discount for customers who have had a previous completed job.</p>
        </div>
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-800">5% loyalty discount for returning customers</p>
            <p className="text-xs text-zinc-500 mt-0.5">Applied at quote submission if the customer's phone number has a prior completed job.</p>
          </div>
          <button
            data-testid="toggle-loyalty-discount"
            onClick={() => toggleLoyalty.mutate(!loyaltyEnabled)}
            disabled={toggleLoyalty.isPending}
            className="flex items-center gap-1.5 text-sm font-semibold"
          >
            {loyaltyEnabled
              ? <ToggleRight className="w-6 h-6 text-amber-500" />
              : <ToggleLeft className="w-6 h-6 text-zinc-400" />}
            <span className={loyaltyEnabled ? "text-amber-700" : "text-zinc-500"}>
              {loyaltyEnabled ? "ON" : "OFF"}
            </span>
          </button>
        </div>
      </div>

      {/* ── WhatsApp Push Notifications (admin PWA) ───────────────────────────── */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <BellRing className="h-4 w-4 text-blue-600" />
            WhatsApp Message Alerts
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Get a push notification on this device whenever a customer sends a WhatsApp message — even when the app is closed.
          </p>
        </div>
        <div className="p-5 space-y-4">
          {pushState === "unsupported" && (
            <div className="flex items-start gap-2 bg-zinc-50 border border-zinc-200 rounded-lg p-3 text-sm text-zinc-600">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
              <span>Push notifications are not supported in this browser. Try opening the admin panel in Chrome on Android or Safari on iOS.</span>
            </div>
          )}

          {pushState === "denied" && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <BellOff className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <span>Notifications are <strong>blocked</strong> for this site. To enable, go to your browser's site settings and allow notifications, then reload this page.</span>
            </div>
          )}

          {(pushState === "default" || pushState === "subscribed") && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-800">
                  {pushState === "subscribed" ? "Notifications enabled on this device" : "Notifications off on this device"}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {pushState === "subscribed"
                    ? "You'll receive an alert here each time a customer messages on WhatsApp."
                    : "Tap Enable to receive alerts when customers message on WhatsApp."}
                </p>
              </div>
              {pushState === "subscribed" ? (
                <button
                  data-testid="button-push-disable"
                  onClick={() => pushUnsubscribe().then(() => toast({ title: "Notifications disabled" }))}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-sm font-medium transition-colors shrink-0"
                >
                  <BellOff className="h-4 w-4" /> Disable
                </button>
              ) : (
                <button
                  data-testid="button-push-enable"
                  onClick={() => pushSubscribe().then(ok => ok
                    ? toast({ title: "Notifications enabled", description: "You'll be alerted for every new WhatsApp message." })
                    : toast({ title: "Permission denied", description: "Allow notifications in your browser settings.", variant: "destructive" })
                  )}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shrink-0"
                >
                  <BellRing className="h-4 w-4" /> Enable
                </button>
              )}
            </div>
          )}

          {pushState === "loading" && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <RefreshCw className="w-4 h-4 animate-spin" /> Checking notification status…
            </div>
          )}

          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
            <Bell className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-500" />
            <span>
              For best results, <strong>add this admin panel to your home screen</strong> (PWA). Notifications then work even when the browser is closed — similar to a native app.
            </span>
          </div>
        </div>
      </div>

    </div>
    </div>
  );
}
