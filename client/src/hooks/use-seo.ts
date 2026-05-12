import { useEffect, useState } from "react";

const DEFAULT_TITLE = "TMG Install | Furniture Installation & Relocation Singapore";
const DEFAULT_DESCRIPTION = "Professional furniture installation, dismantling and relocation services in Singapore. Get an instant upfront quote from TMG Install — The Moving Guy Pte Ltd.";
const DEFAULT_CANONICAL = "https://tmginstall.com/";
const DEFAULT_OG_IMAGE = "https://tmginstall.com/icon-512.png";

interface SEOOptions {
  title: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  noIndex?: boolean;
  jsonLd?: object | object[];
  page?: string; // path key — defaults to window.location.pathname
}

function setMeta(selector: string, attr: string, value: string) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

// Cache the live override map across hook usages so we only fetch once per session
let liveOverrideCache: Record<string, Record<string, string>> | null = null;
let liveOverridePromise: Promise<Record<string, Record<string, string>>> | null = null;

async function loadLiveOverrides(): Promise<Record<string, Record<string, string>>> {
  if (liveOverrideCache) return liveOverrideCache;
  if (liveOverridePromise) return liveOverridePromise;
  liveOverridePromise = fetch("/api/public/site-settings")
    .then(r => r.ok ? r.json() : {})
    .then(data => { liveOverrideCache = data || {}; return liveOverrideCache!; })
    .catch(() => ({}));
  return liveOverridePromise;
}

export function useSEO({
  title,
  description,
  canonical,
  ogTitle,
  ogDescription,
  ogImage,
  noIndex = false,
  jsonLd,
  page,
}: SEOOptions) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    const pageKey = page || (typeof window !== "undefined" ? window.location.pathname : "/");
    loadLiveOverrides().then(map => {
      const o = map[pageKey] || map["/"] || {};
      if (Object.keys(o).length) setOverrides(o);
    });
  }, [page]);

  useEffect(() => {
    // AI-applied overrides take precedence over the page's defaults
    const finalTitle = overrides.meta_title || title;
    const desc = overrides.meta_description || description || DEFAULT_DESCRIPTION;
    const canon = canonical || DEFAULT_CANONICAL;
    const ogT = ogTitle || finalTitle;
    const ogD = ogDescription || desc;
    const ogImg = ogImage || DEFAULT_OG_IMAGE;

    document.title = finalTitle;
    setMeta('meta[name="description"]', "content", desc);
    setMeta(
      'meta[name="robots"]',
      "content",
      noIndex
        ? "noindex, nofollow"
        : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    );
    setMeta('link[rel="canonical"]', "href", canon);

    setMeta('meta[property="og:title"]', "content", ogT);
    setMeta('meta[property="og:description"]', "content", ogD);
    setMeta('meta[property="og:url"]', "content", canon);
    setMeta('meta[property="og:image"]', "content", ogImg);

    setMeta('meta[name="twitter:title"]', "content", ogT);
    setMeta('meta[name="twitter:description"]', "content", ogD);

    let ldEl: HTMLScriptElement | null = document.querySelector('script[data-seo-page]');
    if (jsonLd) {
      if (!ldEl) {
        ldEl = document.createElement("script");
        ldEl.type = "application/ld+json";
        ldEl.setAttribute("data-seo-page", "true");
        document.head.appendChild(ldEl);
      }
      ldEl.textContent = JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd]);
    } else if (ldEl) {
      ldEl.remove();
    }

    return () => {
      document.title = DEFAULT_TITLE;
      setMeta('meta[name="description"]', "content", DEFAULT_DESCRIPTION);
      setMeta(
        'meta[name="robots"]',
        "content",
        "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      );
      setMeta('link[rel="canonical"]', "href", DEFAULT_CANONICAL);
      setMeta('meta[property="og:title"]', "content", DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', "content", DEFAULT_DESCRIPTION);
      setMeta('meta[property="og:url"]', "content", DEFAULT_CANONICAL);
      setMeta('meta[property="og:image"]', "content", DEFAULT_OG_IMAGE);
      const cleanup = document.querySelector('script[data-seo-page]');
      if (cleanup) cleanup.remove();
    };
  }, [title, description, canonical, ogTitle, ogDescription, ogImage, noIndex, overrides]);

  // Return live overrides so consumer pages can also apply h1/cta_text dynamically
  return { liveOverrides: overrides };
}
