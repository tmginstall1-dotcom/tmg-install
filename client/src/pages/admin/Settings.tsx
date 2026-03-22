import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, MessageSquare, RefreshCw, Smartphone } from "lucide-react";

export default function AdminSettings() {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [newVersion, setNewVersion] = useState("");
  const [apkUrl, setApkUrl] = useState("");

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
