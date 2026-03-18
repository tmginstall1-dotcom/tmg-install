import { useState } from "react";
import { Capacitor } from "@capacitor/core";

// ─── Module-level singletons so tracking survives component unmounts ─────────

let nativeWatcherId: string | null = null;
let webWatcherId: number | null = null;
let trackingStaffId: number | null = null;
let lastSentAt = 0;
let lastLat = 0;
let lastLng = 0;

const MIN_INTERVAL_MS = 25_000;
const MIN_DISTANCE_M  = 20;

// Production API base — set as VITE_API_BASE env var at build time for native.
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "";

// ─── Haversine distance ───────────────────────────────────────────────────────

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

// ─── Send a ping to the server ────────────────────────────────────────────────

async function sendPoint(
  staffId: number,
  lat: number,
  lng: number,
  accuracy?: number,
  speed?: number | null,
  heading?: number | null,
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
        heading: heading ?? null,
      }),
    });
  } catch {
    // Silently ignore network errors — next ping will retry
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBackgroundLocation() {
  const [isTracking, setIsTracking] = useState(
    nativeWatcherId !== null || webWatcherId !== null,
  );

  async function startTracking(staffId: number) {
    if (nativeWatcherId !== null || webWatcherId !== null) return;

    trackingStaffId = staffId;
    lastLat = 0;
    lastLng = 0;
    lastSentAt = 0;

    try {
      if (Capacitor.isNativePlatform()) {
        // ── Native Android: background geolocation with foreground service ──
        // @vite-ignore: native-only module, no web build entry point
        const { BackgroundGeolocation } = await import(
          /* @vite-ignore */ "@capacitor-community/background-geolocation"
        );

        nativeWatcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage:
              "TMG Install is recording your location for the active job.",
            backgroundTitle: "TMG Install — Location Active",
            requestPermissions: true,
            stale: false,
            distanceFilter: MIN_DISTANCE_M,
          },
          (position: any, error: any) => {
            if (error) {
              if (error.code === "NOT_AUTHORIZED") {
                stopTracking();
              }
              return;
            }
            if (!trackingStaffId) return;
            sendPoint(
              trackingStaffId,
              position.latitude,
              position.longitude,
              position.accuracy,
              position.speed,
              position.bearing,
            );
          },
        );
      } else {
        // ── Web fallback: standard watchPosition (foreground only) ───────────
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
              pos.coords.heading,
            );
          },
          () => {},
          {
            enableHighAccuracy: true,
            timeout: 30_000,
            maximumAge: 5_000,
          },
        );
      }

      setIsTracking(true);
    } catch {
      // Plugin unavailable — silently ignore
    }
  }

  async function stopTracking() {
    try {
      if (Capacitor.isNativePlatform() && nativeWatcherId !== null) {
        const { BackgroundGeolocation } = await import(
          /* @vite-ignore */ "@capacitor-community/background-geolocation"
        );
        await BackgroundGeolocation.removeWatcher({ id: nativeWatcherId });
        nativeWatcherId = null;
      } else if (webWatcherId !== null) {
        navigator.geolocation?.clearWatch(webWatcherId);
        webWatcherId = null;
      }
    } catch {
      nativeWatcherId = null;
      webWatcherId = null;
    }

    trackingStaffId = null;
    setIsTracking(false);
  }

  return { isTracking, startTracking, stopTracking };
}
