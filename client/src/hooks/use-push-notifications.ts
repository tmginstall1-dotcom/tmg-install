import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocation } from "wouter";

// Lazily import Capacitor plugins to avoid crashing on web
let PushNotifications: any = null;
let App: any = null;

async function loadPlugins() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pushMod = await import("@capacitor/push-notifications");
    PushNotifications = pushMod.PushNotifications;
  } catch {
    // Firebase not configured — push notifications disabled
  }
  try {
    const appMod = await import("@capacitor/app");
    App = appMod.App;
  } catch {}
}

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

async function registerToken(token: string) {
  try {
    await fetch(`${API_BASE}/api/staff/fcm-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    });
  } catch {
    // Silent — will retry on next app open
  }
}

/**
 * Hook that:
 * 1. Requests push notification permission on native Android
 * 2. Registers the FCM token with the backend
 * 3. Handles notification taps → navigates to the correct job page
 */
export function usePushNotifications() {
  const [, setLocation] = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        await loadPlugins();
        if (!PushNotifications) return;

        // Request permission
        const result = await PushNotifications.requestPermissions();
        if (result.receive !== "granted") return;

        await PushNotifications.register();

        // Token received — send to backend
        await PushNotifications.addListener("registration", (token: { value: string }) => {
          registerToken(token.value);
        });

        // Notification tapped while app was in background/closed
        await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action: { notification: { data?: { jobId?: string; path?: string } } }) => {
            const data = action.notification?.data;
            if (data?.path) {
              setLocation(data.path);
            } else if (data?.jobId) {
              setLocation(`/staff/jobs/${data.jobId}`);
            }
          }
        );

        // Notification received while app is in foreground — show as in-app toast
        await PushNotifications.addListener(
          "pushNotificationReceived",
          (_notification: any) => {
            // The app is already open — we rely on query refetch to show updates
          }
        );
      } catch (e) {
        // Push notifications failed to initialise — app continues without them
        console.warn("[Push] Init failed:", e);
      }
    })();

    return () => {
      if (PushNotifications) {
        PushNotifications.removeAllListeners?.();
      }
    };
  }, [setLocation]);
}

/**
 * Hook that listens for deep links (tmginstall://job/123 or https://tmginstall.com/staff/jobs/123)
 * and navigates accordingly. Works even when the app was launched from a URL.
 */
export function useDeepLinks() {
  const [, setLocation] = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        await loadPlugins();
        if (!App) return;

        // Handle URL that launched the app
        const launchUrl = await App.getLaunchUrl();
        if (launchUrl?.url) handleUrl(launchUrl.url, setLocation);

        // Handle URLs while the app is already running
        App.addListener("appUrlOpen", (data: { url: string }) => {
          handleUrl(data.url, setLocation);
        });
      } catch (e) {
        console.warn("[DeepLinks] Init failed:", e);
      }
    })();

    return () => {
      App?.removeAllListeners?.();
    };
  }, [setLocation]);
}

function handleUrl(url: string, setLocation: (path: string) => void) {
  try {
    const parsed = new URL(url);

    // tmginstall://job/123
    if (parsed.protocol === "tmginstall:") {
      const parts = parsed.pathname.replace(/^\//, "").split("/");
      if (parts[0] === "job" && parts[1]) {
        setLocation(`/staff/jobs/${parts[1]}`);
      }
      return;
    }

    // https://tmginstall.com/staff/jobs/123
    if (parsed.hostname === "tmginstall.com") {
      const path = parsed.pathname;
      if (path.startsWith("/staff/")) {
        setLocation(path);
      }
    }
  } catch {
    // Invalid URL — ignore
  }
}
