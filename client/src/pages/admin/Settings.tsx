import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, MessageSquare, RefreshCw, Smartphone, Phone, XCircle } from "lucide-react";

export default function AdminSettings() {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [apkUrl, setApkUrl] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);

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

  return (
    <div className="min-h-screen bg-[#F5F5F7] pt-14 lg:pl-56 pb-24">
      <div className="bg-white border-b border-gray-200 mb-6">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
          <p className="text-xs font-medium text-gray-400 mb-1">Management</p>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        </div>
      </div>
    <div className="max-w-2xl mx-auto px-4 pb-8 space-y-6">

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            WhatsApp Access Token
            {tokenStatus && (
              <span
                data-testid="badge-token-status"
                className={`ml-auto text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                  tokenStatus.status === "ok"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {tokenStatus.status === "ok"
                  ? <CheckCircle className="w-3.5 h-3.5" />
                  : <XCircle className="w-3.5 h-3.5" />}
                {tokenStatus.status === "ok" ? "Token OK" : "Token Invalid"}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            {tokenStatus && tokenStatus.status !== "ok" ? (
              <span className="text-red-600 font-medium">{tokenStatus.message}</span>
            ) : tokenStatus ? (
              <span className="text-green-700">{tokenStatus.message}</span>
            ) : (
              "Checking token status…"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(tokenStatus?.status === "expired" || tokenStatus?.status === "invalid") && (
            <div data-testid="alert-token-expired" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-3 py-2.5 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div>
                <strong>Bot is offline.</strong> The current token is {tokenStatus.status}. Customers messaging +65 8088 0757 will not get any replies until you paste a new System User token below.
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="wa-token">New Access Token</Label>
            <Textarea
              id="wa-token"
              data-testid="input-whatsapp-token"
              placeholder="Paste your System User token from Meta Business Suite…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm text-amber-800 dark:text-amber-200">
            <strong>Use a permanent System User token (never expires):</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Go to <strong>business.facebook.com</strong> → Settings → System Users</li>
              <li>Select <strong>TMG Install Bot</strong></li>
              <li>Click <strong>"Generate new token"</strong> → select the TMG Install WA app</li>
              <li>Grant <code>whatsapp_business_messaging</code> + <code>whatsapp_business_management</code></li>
              <li>Copy the token, paste it above and click Update</li>
            </ol>
          </div>

          <Button
            data-testid="button-update-whatsapp-token"
            onClick={() => updateToken.mutate()}
            disabled={updateToken.isPending || token.trim().length < 20}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {updateToken.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Updating…</>
            ) : (
              <><CheckCircle className="h-4 w-4 mr-2" /> Update Token</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Activate Webhook — Subscribe WABA */}
      <Card className="border-green-300 dark:border-green-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Activate WhatsApp Chatbot
          </CardTitle>
          <CardDescription>
            This links your WhatsApp Business Account to the bot so incoming messages are forwarded to the server. Do this once after setting the token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md p-3 text-sm text-green-800 dark:text-green-200">
            Click this button to subscribe WABA <strong>2118758868886697</strong> to the app webhook. This is required for the bot to reply to customers.
          </div>
          <Button
            data-testid="button-subscribe-waba"
            onClick={() => subscribeWaba.mutate()}
            disabled={subscribeWaba.isPending}
            className="bg-green-600 hover:bg-green-700 text-white w-full"
          >
            {subscribeWaba.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Subscribing…</>
            ) : (
              <><CheckCircle className="h-4 w-4 mr-2" /> Subscribe WABA to Webhook (Activate Bot)</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* WhatsApp Number Registration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-600" />
            Register WhatsApp Number
          </CardTitle>
          <CardDescription>
            +65 8088 0757 shows as "Pending" in Meta. Use this to complete the registration — it sends
            a verification SMS to the SIM, then you enter the code to activate the number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm text-amber-800 dark:text-amber-200">
            Make sure you have updated the Access Token above first before doing this.
          </div>

          <div className="flex flex-col gap-3">
            <Button
              data-testid="button-request-wa-sms"
              onClick={() => requestCode.mutate("SMS")}
              disabled={requestCode.isPending}
              variant="outline"
              className="w-full border-green-300 text-green-700 hover:bg-green-50"
            >
              {requestCode.isPending
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Sending…</>
                : <><Phone className="h-4 w-4 mr-2" /> Send verification SMS to +65 8088 0757</>
              }
            </Button>

            <Button
              data-testid="button-request-wa-voice"
              onClick={() => requestCode.mutate("VOICE")}
              disabled={requestCode.isPending}
              variant="outline"
              className="w-full border-slate-300 text-slate-600 hover:bg-slate-50 text-sm"
            >
              {requestCode.isPending
                ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Calling…</>
                : <><Phone className="h-4 w-4 mr-2" /> Try voice call instead</>
              }
            </Button>

            {smsSent && (
              <div className="space-y-2">
                <Label htmlFor="otp-code">Enter the 6-digit code from the SMS / voice call</Label>
                <div className="flex gap-2">
                  <Input
                    id="otp-code"
                    data-testid="input-otp-code"
                    placeholder="123456"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="font-mono text-lg tracking-widest text-center"
                  />
                  <Button
                    data-testid="button-verify-wa-code"
                    onClick={() => verifyCode.mutate()}
                    disabled={verifyCode.isPending || otpCode.length < 6}
                    className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                  >
                    {verifyCode.isPending
                      ? <RefreshCw className="h-4 w-4 animate-spin" />
                      : <CheckCircle className="h-4 w-4" />
                    }
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Direct Register with PIN */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            Direct Register (set PIN)
          </CardTitle>
          <CardDescription>
            If the SMS/voice method gives "Request code error", use this instead. Set any 6-digit PIN
            — this registers +65 8088 0757 directly on the WhatsApp Business API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="direct-pin">Choose a 6-digit PIN (you'll need this for 2FA)</Label>
            <div className="flex gap-2">
              <Input
                id="direct-pin"
                data-testid="input-direct-pin"
                placeholder="e.g. 123456"
                value={directPin}
                onChange={e => setDirectPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                className="font-mono text-lg tracking-widest text-center"
              />
              <Button
                data-testid="button-register-direct"
                onClick={() => registerDirect.mutate()}
                disabled={registerDirect.isPending || directPin.length !== 6}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                {registerDirect.isPending
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : <CheckCircle className="h-4 w-4" />
                }
              </Button>
            </div>
            <p className="text-xs text-slate-500">Write down this PIN — Meta may ask for it later for account verification.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            Staff App Version
          </CardTitle>
          <CardDescription>
            When you publish a new APK build, set the version here. Staff will see an update prompt
            inside the app and can install it with one tap.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentAppVersion && (
            <div className="bg-gray-50 dark:bg-gray-900 border rounded-md p-3 text-sm space-y-1">
              <div><span className="text-gray-500">Current latest:</span> <strong>v{currentAppVersion.version}</strong></div>
              <div className="text-xs text-gray-400 break-all">{currentAppVersion.apkUrl}</div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="app-version">New Version Number</Label>
            <Input
              id="app-version"
              data-testid="input-app-version"
              placeholder="e.g. 1.2"
              value={newVersion}
              onChange={(e) => setNewVersion(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="apk-url">APK Download URL</Label>
            <Input
              id="apk-url"
              data-testid="input-apk-url"
              placeholder="https://github.com/.../tmg-install.apk"
              value={apkUrl}
              onChange={(e) => setApkUrl(e.target.value)}
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-sm text-blue-800 dark:text-blue-200">
            <strong>Where to get the APK URL:</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Go to <strong>github.com/tmginstall1-dotcom/tmg-install/releases</strong></li>
              <li>Find the latest release build</li>
              <li>Right-click <strong>tmg-install.apk</strong> → Copy link address</li>
              <li>Paste the URL above</li>
            </ol>
          </div>

          <Button
            data-testid="button-update-app-version"
            onClick={() => updateAppVersion.mutate()}
            disabled={updateAppVersion.isPending || !newVersion.trim() || !apkUrl.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {updateAppVersion.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Updating…</>
            ) : (
              <><CheckCircle className="h-4 w-4 mr-2" /> Publish Update</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
