import { useEffect } from "react";

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
}

function setMeta(selector: string, attr: string, value: string) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
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
}: SEOOptions) {
  useEffect(() => {
    document.title = title;

    const desc = description || DEFAULT_DESCRIPTION;
    const canon = canonical || DEFAULT_CANONICAL;
    const ogT = ogTitle || title;
    const ogD = ogDescription || desc;
    const ogImg = ogImage || DEFAULT_OG_IMAGE;

    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[name="robots"]', "content", noIndex ? "noindex, nofollow" : "index, follow");
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
      setMeta('meta[name="robots"]', "content", "index, follow");
      setMeta('link[rel="canonical"]', "href", DEFAULT_CANONICAL);
      setMeta('meta[property="og:title"]', "content", DEFAULT_TITLE);
      setMeta('meta[property="og:description"]', "content", DEFAULT_DESCRIPTION);
      setMeta('meta[property="og:url"]', "content", DEFAULT_CANONICAL);
      setMeta('meta[property="og:image"]', "content", DEFAULT_OG_IMAGE);
      const cleanup = document.querySelector('script[data-seo-page]');
      if (cleanup) cleanup.remove();
    };
  }, [title, description, canonical, ogTitle, ogDescription, ogImage, noIndex]);
}
