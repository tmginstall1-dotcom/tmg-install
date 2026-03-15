import { useEffect, useRef, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

// Minimum distance to trigger an immediate send on movement
const MOVE_THRESHOLD_M = 15;
// Heartbeat: always send at least once every N seconds even if stationary
const HEARTBEAT_MS = 30_000;
// Minimum gap between any two sends (debounce rapid GPS bursts)
const MIN_GAP_MS = 5_000;

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
  const lastSentRef  = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPosRef = useRef<GeolocationPosition | null>(null);

  const sendPoint = useCallback(async (pos: GeolocationPosition) => {
    const { latitude: lat, longitude: lng, accuracy, speed, heading } = pos.coords;
    const now = Date.now();

    // Debounce: never send more often than MIN_GAP_MS
    if (lastSentRef.current && now - lastSentRef.current.ts < MIN_GAP_MS) return;

    try {
      await apiRequest("POST", "/api/staff/gps-track", {
        lat: String(lat),
        lng: String(lng),
        accuracy: accuracy != null ? String(accuracy) : undefined,
        speed:    speed    != null ? String(speed)    : undefined,
        heading:  heading  != null ? String(heading)  : undefined,
        recordedAt: new Date(pos.timestamp).toISOString(),
      });
      lastSentRef.current = { lat, lng, ts: now };
    } catch {
      // silent — never surface GPS errors to staff
    }
  }, []);

  const onPosition = useCallback((pos: GeolocationPosition) => {
    latestPosRef.current = pos;
    const { latitude: lat, longitude: lng } = pos.coords;

    if (!lastSentRef.current) {
      // Very first fix — send immediately
      sendPoint(pos);
      return;
    }

    const dist = haversineM(lastSentRef.current.lat, lastSentRef.current.lng, lat, lng);
    if (dist >= MOVE_THRESHOLD_M) {
      // Device has moved — send right away (native-style reactive tracking)
      sendPoint(pos);
    }
    // Stationary: heartbeat timer will handle it
  }, [sendPoint]);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      onPosition,
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );

    // Heartbeat — keeps stationary staff visible on the map
    heartbeatRef.current = setInterval(() => {
      if (latestPosRef.current) sendPoint(latestPosRef.current);
    }, HEARTBEAT_MS);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [enabled, onPosition, sendPoint]);
}
