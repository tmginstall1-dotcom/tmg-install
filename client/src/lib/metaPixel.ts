/**
 * Meta (Facebook) Pixel — initialised only when VITE_META_PIXEL_ID is set.
 * Safe no-op if the env var is missing, so dev and preview builds don't
 * fire spurious tracking events. Set VITE_META_PIXEL_ID in production
 * to enable retargeting + conversion tracking for Facebook + Instagram ads.
 *
 * Usage:
 *   import { initMetaPixel, trackPixelEvent } from "@/lib/metaPixel";
 *   initMetaPixel();                                    // call once at boot
 *   trackPixelEvent("Lead");                            // standard event
 *   trackPixelEvent("Purchase", { value: 109.9, currency: "SGD" });
 */

const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
  }
}

let initialised = false;

export function initMetaPixel(): void {
  if (initialised || typeof window === "undefined") return;
  if (!PIXEL_ID) return;
  initialised = true;

  (function (f: any, b: Document, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = b.createElement(e) as HTMLScriptElement;
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  window.fbq("init", PIXEL_ID);
  window.fbq("track", "PageView");
}

export function trackPixelEvent(name: string, params?: Record<string, any>): void {
  if (typeof window === "undefined" || !window.fbq) return;
  if (params) {
    window.fbq("track", name, params);
  } else {
    window.fbq("track", name);
  }
}
