import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export type AdminPushState = "unsupported" | "denied" | "default" | "subscribed" | "loading";

export function useAdminPush() {
  const [state, setState] = useState<AdminPushState>("loading");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then(async reg => {
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "subscribed" : "default");
      })
      .catch(() => setState("default"));
  }, []);

  async function subscribe(): Promise<boolean> {
    try {
      setState("loading");
      const res = await fetch("/api/admin/push/vapid-key", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to get VAPID key");
      const { publicKey } = await res.json();

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await apiRequest("POST", "/api/admin/push/subscribe", sub.toJSON());
      setState("subscribed");
      return true;
    } catch (err) {
      console.error("[AdminPush] subscribe error:", err);
      setState("default");
      return false;
    }
  }

  async function unsubscribe(): Promise<void> {
    try {
      setState("loading");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiRequest("POST", "/api/admin/push/unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("default");
    } catch (err) {
      console.error("[AdminPush] unsubscribe error:", err);
      setState("subscribed");
    }
  }

  return { state, subscribe, unsubscribe };
}
