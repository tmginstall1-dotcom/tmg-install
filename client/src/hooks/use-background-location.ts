import { useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

// ─── Custom native plugin interface ─────────────────────────────────────────────
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

// ─── Module-level singletons so tracking survives component unmounts ─────────

let nativeListener: PluginListenerHandle | null = null;
let webWatcherId: number | null = null;
let trackingStaffId: number | null = null;
let lastSentAt = 0;
let lastLat = 0;
let lastLng = 0;

const MIN_INTERVAL_MS = 25_000;
const MIN_DISTANCE_M  = 20;

const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function sendPoint(
  staffId: number,
  lat: number,
  lng: number,
  accuracy?: number | null,
  speed?: number | null,
) {
  const now = Date.now();
  const moved = distanceMetres(lastLat, lastLng, lat, lng);
  if (now - lastSentAt < MIN_INTERVAL_MS && moved < MIN_DISTANCE_M) return;

  lastSentAt = now;
  lastLat = lat;
  lastLng = lng;

  try {
    await fetch(`${API_BASE}/api/staff/gps-track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        staffId,
        lat: String(lat),
        lng: String(lng),
        accuracy: accuracy ?? null,
        speed: speed ?? null,
        heading: null,
      }),
    });
  } catch {
    // Silently ignore network errors — next ping will retry
  }
}

// ─── Standalone stop (callable outside the hook, e.g. on logout) ─────────────

export async function stopAllTracking() {
  try {
    if (Capacitor.isNativePlatform()) {
      await TMGLocation.stopWatching();
      if (nativeListener) {
        await nativeListener.remove();
        nativeListener = null;
      }
    } else if (webWatcherId !== null) {
      navigator.geolocation?.clearWatch(webWatcherId);
      webWatcherId = null;
    }
  } catch {
    nativeListener = null;
    webWatcherId = null;
  }
  trackingStaffId = null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBackgroundLocation() {
  const [isTracking, setIsTracking] = useState(
    nativeListener !== null || webWatcherId !== null,
  );

  async function startTracking(staffId: number) {
    if (nativeListener !== null || webWatcherId !== null) return;

    trackingStaffId = staffId;
    lastLat = 0;
    lastLng = 0;
    lastSentAt = 0;

    try {
      if (Capacitor.isNativePlatform()) {
        // ── Native Android: TMGLocationPlugin (Java 17 foreground service) ──
        nativeListener = await TMGLocation.addListener("location", (loc) => {
          if (!trackingStaffId) return;
          sendPoint(trackingStaffId, loc.lat, loc.lng, loc.accuracy, loc.speed);
        });
        // Pass staffId so the service can persist it in SharedPreferences and
        // submit GPS points directly when the app is backgrounded/killed.
        await TMGLocation.startWatching({ staffId });
      } else {
        // ── Web fallback: standard watchPosition ─────────────────────────────
        if (!("geolocation" in navigator)) return;

        webWatcherId = navigator.geolocation.watchPosition(
          (pos) => {
            if (!trackingStaffId) return;
            sendPoint(
              trackingStaffId,
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy,
              pos.coords.speed,
            );
          },
          () => {},
          { enableHighAccuracy: true, timeout: 30_000, maximumAge: 5_000 },
        );
      }

      setIsTracking(true);
    } catch {
      // Location unavailable — silently ignore
    }
  }

  async function stopTracking() {
    try {
      if (Capacitor.isNativePlatform()) {
        await TMGLocation.stopWatching();
        if (nativeListener) {
          await nativeListener.remove();
          nativeListener = null;
        }
      } else if (webWatcherId !== null) {
        navigator.geolocation?.clearWatch(webWatcherId);
        webWatcherId = null;
      }
    } catch {
      nativeListener = null;
      webWatcherId = null;
    }

    trackingStaffId = null;
    setIsTracking(false);
  }

  return { isTracking, startTracking, stopTracking };
}
