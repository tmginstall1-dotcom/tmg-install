import { useState } from "react";

// ─── Module-level singletons so tracking survives component unmounts ─────────

let webWatcherId: number | null = null;
let trackingStaffId: number | null = null;
let lastSentAt = 0;
let lastLat = 0;
let lastLng = 0;

const MIN_INTERVAL_MS = 25_000;  // send at most once per 25 s
const MIN_DISTANCE_M  = 20;      // or if moved ≥ 20 m (whichever comes first)

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

  // Throttle: skip if too recent AND not moved enough
  if (now - lastSentAt < MIN_INTERVAL_MS && moved < MIN_DISTANCE_M) return;

  lastSentAt = now;
  lastLat = lat;
  lastLng = lng;

  try {
    await fetch("/api/staff/gps-track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  const [isTracking, setIsTracking] = useState(webWatcherId !== null);

  async function startTracking(staffId: number) {
    if (webWatcherId !== null) return; // already tracking

    trackingStaffId = staffId;
    lastLat = 0;
    lastLng = 0;
    lastSentAt = 0;

    try {
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
        () => {
          // Silently ignore errors
        },
        {
          enableHighAccuracy: true,
          timeout: 30_000,
          maximumAge: 5_000,
        },
      );

      setIsTracking(true);
    } catch {
      // Ignore errors
    }
  }

  async function stopTracking() {
    if (webWatcherId !== null) {
      navigator.geolocation?.clearWatch(webWatcherId);
      webWatcherId = null;
    }

    trackingStaffId = null;
    setIsTracking(false);
  }

  return { isTracking, startTracking, stopTracking };
}
