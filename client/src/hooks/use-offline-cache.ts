import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";

// Only import Preferences on native to avoid web bundle bloat
let Preferences: any = null;

async function getPreferences() {
  if (!Preferences) {
    try {
      const mod = await import("@capacitor/preferences");
      Preferences = mod.Preferences;
    } catch {
      return null;
    }
  }
  return Preferences;
}

// ── Offline state detection ───────────────────────────────────────────────────

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

// ── Generic cache helpers ────────────────────────────────────────────────────

export async function cacheSet(key: string, value: unknown) {
  const prefs = await getPreferences();
  if (!prefs) {
    // Web fallback: sessionStorage
    try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
    return;
  }
  try {
    await prefs.set({ key, value: JSON.stringify(value) });
  } catch {}
}

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const prefs = await getPreferences();
  if (!prefs) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  try {
    const { value } = await prefs.get({ key });
    return value ? JSON.parse(value) : null;
  } catch { return null; }
}

export async function cacheClear(key: string) {
  const prefs = await getPreferences();
  if (!prefs) {
    try { sessionStorage.removeItem(key); } catch {}
    return;
  }
  try { await prefs.remove({ key }); } catch {}
}

// ── Hook: cached query result with offline fallback ──────────────────────────

/**
 * Wraps a data value with:
 * - Auto-persist to cache whenever data changes
 * - Auto-restore from cache when offline
 * Returns { data, isFromCache, isOnline }
 */
export function useWithOfflineCache<T>(
  cacheKey: string,
  liveData: T | undefined,
  isLoading: boolean
) {
  const isOnline = useOnlineStatus();
  const [cachedData, setCachedData] = useState<T | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // Restore from cache on mount (before first fetch completes)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    cacheGet<T>(cacheKey).then(cached => {
      if (cached) {
        setCachedData(cached);
        setIsFromCache(true);
      }
    });
  }, [cacheKey]);

  // Persist live data to cache whenever it arrives
  useEffect(() => {
    if (liveData !== undefined && !isLoading) {
      cacheSet(cacheKey, liveData);
      setCachedData(liveData);
      setIsFromCache(false);
    }
  }, [liveData, isLoading, cacheKey]);

  // Return live data if available, else cached
  const data = liveData ?? cachedData ?? undefined;

  return { data: data as T | undefined, isFromCache, isOnline };
}

// ── Offline banner component logic ───────────────────────────────────────────

export function useOfflineBanner() {
  const isOnline = useOnlineStatus();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
      setWasOffline(true);
    } else if (wasOffline) {
      // Back online — show brief "reconnected" state then hide
      const t = setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  return { showBanner, isOnline };
}
