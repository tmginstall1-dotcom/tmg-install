import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, MessageSquare, RefreshCw, Smartphone, Phone } from "lucide-react";

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

  const updateToken = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/settings/whatsapp-token", { token }),
    onSuccess: () => {
      toast({ title: "Token updated", description: "WhatsApp messages will now use the new token." });
      setToken("");
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
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            WhatsApp Access Token
          </CardTitle>
          <CardDescription>
            Paste a fresh temporary token from Meta here. It will automatically be exchanged for a
            long-lived 60-day token and saved — no manual refresh needed after that. The server also
            checks and renews the token automatically every 6 days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="wa-token">New Access Token</Label>
            <Textarea
              id="wa-token"
              data-testid="input-whatsapp-token"
              placeholder="Paste your Meta access token here…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm text-amber-800 dark:text-amber-200">
            <strong>Where to get a new token:</strong>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Go to <strong>developers.facebook.com</strong></li>
              <li>Open <strong>TMG Install WA</strong> → WhatsApp → API setup</li>
              <li>Click <strong>"Generate access token"</strong> and copy it</li>
              <li>Paste it above and click Update</li>
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
  );
}
