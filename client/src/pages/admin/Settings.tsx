import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle, MessageSquare, RefreshCw } from "lucide-react";

export default function AdminSettings() {
  const { toast } = useToast();
  const [token, setToken] = useState("");

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
            The Meta access token expires every 24 hours when using a temporary token. Paste a new
            token here whenever the bot stops sending messages — no redeploy needed.
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
    </div>
  );
}
