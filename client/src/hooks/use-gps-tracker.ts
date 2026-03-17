import { useEffect, useRef, useCallback } from "react";
import { registerPlugin } from "@capacitor/core";
import { apiRequest } from "@/lib/queryClient";

// ─── Native plugin interface (matches @capacitor-community/background-geolocation) ─
interface BgLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  bearing: number | null;
  altitude: number | null;
  time: number;
  simulated: boolean;
}
interface BgGeoPlugin {
  addWatcher(
    options: {
      backgroundMessage?: string;
      backgroundTitle?: string;
      requestPermissions?: boolean;
      stale?: boolean;
      distanceFilter?: number;
    },
    callback: (location?: BgLocation, error?: { code: string }) => void,
  ): Promise<string>;
  removeWatcher(options: { id: string }): Promise<void>;
}

// registerPlugin creates a proxy — in native it routes to the compiled plugin;
// in browser it returns a stub (calls will reject, caught below).
const BackgroundGeolocation = registerPlugin<BgGeoPlugin>("BackgroundGeolocation");

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

function isCapacitorNative(): boolean {
  return (
    typeof (window as any).Capacitor !== "undefined" &&
    (window as any).Capacitor.isNativePlatform?.() === true
  );
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
  const lastSentRef  = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const latestPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watcherIdRef = useRef<string | null>(null);
  const browserWatchRef = useRef<number | null>(null);

  const maybeSend = useCallback(async (
    lat: number, lng: number,
    accuracy?: number | null, speed?: number | null, heading?: number | null,
    recordedAt?: string,
  ) => {
    const now = Date.now();
    if (lastSentRef.current && now - lastSentRef.current.ts < MIN_GAP_MS) return;
    await postCoords(lat, lng, accuracy, speed, heading, recordedAt);
    lastSentRef.current = { lat, lng, ts: now };
    latestPosRef.current = { lat, lng };
  }, []);

  // ─── NATIVE tracking (Android background-capable) ──────────────────────────
  const startNative = useCallback(async () => {
    try {
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: "TMG Install is tracking your location for the active job.",
          backgroundTitle:   "TMG Install — Location Active",
          requestPermissions: true,
          stale: false,
          distanceFilter: MOVE_THRESHOLD_M,
        },
        (loc?: BgLocation, err?: { code: string }) => {
          if (err || !loc) return;
          maybeSend(
            loc.latitude, loc.longitude,
            loc.accuracy, loc.speed, loc.bearing,
            new Date(loc.time).toISOString(),
          );
        },
      );
      watcherIdRef.current = id;

      // Heartbeat for stationary staff
      heartbeatRef.current = setInterval(() => {
        const p = latestPosRef.current;
        if (p) postCoords(p.lat, p.lng);
      }, HEARTBEAT_MS);
    } catch (err) {
      console.warn("[GPS] Native plugin unavailable, falling back to browser:", err);
      startBrowser();
    }
  }, [maybeSend]);

  const stopNative = useCallback(async () => {
    if (watcherIdRef.current) {
      try { await BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current }); } catch {}
      watcherIdRef.current = null;
    }
  }, []);

  // ─── BROWSER tracking (foreground-only) ────────────────────────────────────
  const startBrowser = useCallback(() => {
    if (!navigator.geolocation) return;

    browserWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;
        latestPosRef.current = { lat, lng };
        if (!lastSentRef.current) {
          maybeSend(lat, lng, accuracy, speed, heading, new Date(pos.timestamp).toISOString());
          return;
        }
        const dist = haversineM(lastSentRef.current.lat, lastSentRef.current.lng, lat, lng);
        if (dist >= MOVE_THRESHOLD_M) {
          maybeSend(lat, lng, accuracy, speed, heading, new Date(pos.timestamp).toISOString());
        }
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

    if (isCapacitorNative()) {
      startNative();
    } else {
      startBrowser();
    }

    return () => {
      if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      if (isCapacitorNative()) { stopNative(); } else { stopBrowser(); }
      lastSentRef.current  = null;
      latestPosRef.current = null;
    };
  }, [enabled, startNative, startBrowser, stopNative, stopBrowser]);
}
