import { useEffect, useRef, useCallback } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { apiRequest } from "@/lib/queryClient";

// ─── Custom native plugin interface ─────────────────────────────────────────────
// TMGLocationPlugin is compiled directly into the APK (Java 17) — no third-party
// plugin needed. Provides true background tracking via Android foreground service.
interface TMGLocationPlugin {
  startWatching(): Promise<void>;
  stopWatching(): Promise<void>;
  addListener(
    event: "location",
    handler: (data: { lat: number; lng: number; accuracy: number; speed: number; time: number }) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

const TMGLocation = registerPlugin<TMGLocationPlugin>("TMGLocation");

// ─── Constants ──────────────────────────────────────────────────────────────────
const MOVE_THRESHOLD_M = 15;
const HEARTBEAT_MS     = 30_000;
const MIN_GAP_MS       = 5_000;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function postCoords(
  lat: number, lng: number,
  accuracy?: number | null, speed?: number | null, heading?: number | null,
  recordedAt?: string,
) {
  try {
    await apiRequest("POST", "/api/staff/gps-track", {
      lat: String(lat),
      lng: String(lng),
      accuracy: accuracy != null ? String(accuracy) : undefined,
      speed:    speed    != null ? String(speed)    : undefined,
      heading:  heading  != null ? String(heading)  : undefined,
      recordedAt: recordedAt ?? new Date().toISOString(),
    });
  } catch {
    // silent — never surface GPS errors to staff
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────────
export function useGpsTracker(enabled: boolean) {
  const lastSentRef    = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const latestPosRef   = useRef<{ lat: number; lng: number } | null>(null);
  const heartbeatRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const listenerRef    = useRef<PluginListenerHandle | null>(null);
  const browserWatchRef = useRef<number | null>(null);

  const maybeSend = useCallback(async (
    lat: number, lng: number,
    accuracy?: number | null, speed?: number | null, heading?: number | null,
    recordedAt?: string,
  ) => {
    const now = Date.now();
    if (lastSentRef.current) {
      if (now - lastSentRef.current.ts < MIN_GAP_MS) return;
      const dist = haversineM(lastSentRef.current.lat, lastSentRef.current.lng, lat, lng);
      if (dist < MOVE_THRESHOLD_M && now - lastSentRef.current.ts < HEARTBEAT_MS) return;
    }
    await postCoords(lat, lng, accuracy, speed, heading, recordedAt);
    lastSentRef.current = { lat, lng, ts: now };
    latestPosRef.current = { lat, lng };
  }, []);

  // ─── NATIVE: TMGLocationPlugin foreground service ──────────────────────────
  const startNative = useCallback(async () => {
    try {
      // Attach listener before starting so no updates are missed
      listenerRef.current = await TMGLocation.addListener("location", (loc) => {
        latestPosRef.current = { lat: loc.lat, lng: loc.lng };
        maybeSend(loc.lat, loc.lng, loc.accuracy, loc.speed, null, new Date(loc.time).toISOString());
      });

      await TMGLocation.startWatching();

      // Heartbeat — re-sends last known position every 30 s for stationary staff
      heartbeatRef.current = setInterval(() => {
        const p = latestPosRef.current;
        if (p) postCoords(p.lat, p.lng);
      }, HEARTBEAT_MS);
    } catch (err) {
      console.warn("[GPS] Native plugin failed, falling back to browser:", err);
      startBrowser();
    }
  }, [maybeSend]);

  const stopNative = useCallback(async () => {
    try { await TMGLocation.stopWatching(); } catch {}
    if (listenerRef.current) {
      try { await listenerRef.current.remove(); } catch {}
      listenerRef.current = null;
    }
  }, []);

  // ─── BROWSER: navigator.geolocation fallback ────────────────────────────────
  const startBrowser = useCallback(() => {
    if (!navigator.geolocation) return;

    browserWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;
        latestPosRef.current = { lat, lng };
        maybeSend(lat, lng, accuracy, speed, heading, new Date(pos.timestamp).toISOString());
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );

    heartbeatRef.current = setInterval(() => {
      const p = latestPosRef.current;
      if (p) postCoords(p.lat, p.lng);
    }, HEARTBEAT_MS);
  }, [maybeSend]);

  const stopBrowser = useCallback(() => {
    if (browserWatchRef.current !== null) {
      navigator.geolocation.clearWatch(browserWatchRef.current);
      browserWatchRef.current = null;
    }
  }, []);

  // ─── Lifecycle ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    if (Capacitor.isNativePlatform()) {
      startNative();
    } else {
      startBrowser();
    }

    return () => {
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (Capacitor.isNativePlatform()) { stopNative(); } else { stopBrowser(); }
      lastSentRef.current  = null;
      latestPosRef.current = null;
    };
  }, [enabled, startNative, startBrowser, stopNative, stopBrowser]);
}
