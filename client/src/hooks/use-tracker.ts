import { useEffect, useRef } from "react";

function getSessionId(): string {
  const key = "tmg_sid";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

function getUtmParams(): { utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  const p = new URLSearchParams(window.location.search);
  const result: { utmSource?: string; utmMedium?: string; utmCampaign?: string } = {};
  if (p.get("utm_source")) result.utmSource = p.get("utm_source")!;
  if (p.get("utm_medium")) result.utmMedium = p.get("utm_medium")!;
  if (p.get("utm_campaign")) result.utmCampaign = p.get("utm_campaign")!;
  return result;
}

export function trackEvent(event: string, page?: string, label?: string) {
  try {
    const payload = JSON.stringify({
      event,
      page: page ?? window.location.pathname,
      label: label ?? undefined,
      referrer: document.referrer || undefined,
      sessionId: getSessionId(),
      ...getUtmParams(),
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {}
}

export function usePageTracker(page: string) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent("page_view", page);
  }, [page]);
}
