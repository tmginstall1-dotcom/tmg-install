import { useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

const TRACK_INTERVAL_MS = 30_000; // send a point every 30 seconds
const MIN_DISTANCE_M = 5;         // ignore tiny GPS jitter

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGpsTracker(enabled: boolean) {
  const lastSentRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const posRef      = useRef<GeolocationPosition | null>(null);

  const sendPoint = useCallback(async (pos: GeolocationPosition) => {
    const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;
    const now = Date.now();

    if (lastSentRef.current) {
      const dist = haversineM(lastSentRef.current.lat, lastSentRef.current.lng, lat, lng);
      const elapsed = now - lastSentRef.current.ts;
      if (dist < MIN_DISTANCE_M && elapsed < TRACK_INTERVAL_MS * 1.5) return;
    }

    try {
      await apiRequest("POST", "/api/staff/gps-track", {
        lat: String(lat),
        lng: String(lng),
        accuracy: accuracy != null ? String(accuracy) : undefined,
        speed: speed != null ? String(speed) : undefined,
        heading: heading != null ? String(heading) : undefined,
        recordedAt: new Date(pos.timestamp).toISOString(),
      });
      lastSentRef.current = { lat, lng, ts: now };
    } catch {
      // silently ignore — we don't want GPS errors to surface to staff
    }
  }, []);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => { posRef.current = pos; },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );

    // Send an initial point immediately
    navigator.geolocation.getCurrentPosition(
      (pos) => sendPoint(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );

    timerRef.current = setInterval(() => {
      if (posRef.current) sendPoint(posRef.current);
    }, TRACK_INTERVAL_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, sendPoint]);
}
