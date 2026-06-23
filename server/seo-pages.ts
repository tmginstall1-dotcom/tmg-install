/**
 * SEO Service Landing Pages — Server-Side Rendered
 * These pages are served by Express BEFORE the React SPA catches the route.
 * Googlebot sees full HTML content, headings, and structured data.
 */

const BRAND = "TMG Install";
const DOMAIN = "https://tmginstall.com";
const PHONE = "+6580880757";
const WHATSAPP = "https://wa.me/6580880757";
const EMAIL = "sales@tmginstall.com";
const CTA_URL = "/estimate";

/* ── Per-service Open Graph imagery ───────────────────────────────────────────
   Each landing page gets its own preview image when shared on WhatsApp,
   Facebook, LinkedIn, Telegram, etc. Falls back to the brand OG image
   for any slug that isn't mapped. */
const OG_IMAGES: Record<string, string> = {
  "ikea-assembly-singapore":                  "/work/ikea-boxes-800.webp",
  "wardrobe-installation-singapore":          "/work/wardrobe-install-team-800.webp",
  "bed-assembly-singapore":                   "/work/bed-completed-800.webp",
  "tv-mounting-singapore":                    "/work/phone-booth-completed-800.webp",
  "sofa-assembly-singapore":                  "/work/conference-table-800.webp",
  "mattress-installation-singapore":          "/work/bed-assembly-800.webp",
  "furniture-dismantling-singapore":          "/work/wardrobe-oak-800.webp",
  "office-furniture-installation-singapore":  "/work/office-fitout-800.webp",
  "furniture-relocation-singapore":           "/work/delivery-truck-800.webp",
  "taobao-furniture-installation-singapore":  "/work/ikea-boxes-800.webp",
  "castlery-furniture-assembly-singapore":    "/work/wardrobe-white-800.webp",
  "hdb-moving-services-singapore":            "/work/delivery-truck-800.webp",
  "condo-moving-services-singapore":          "/work/delivery-truck-800.webp",
  "lazada-furniture-installation-singapore":  "/work/shelving-assembly-800.webp",
  "shopee-furniture-installation-singapore":  "/work/shelving-assembly-800.webp",
  "gym-equipment-installation-singapore":     "/work/office-pod-800.webp",
  "furniture-repair-adjustment-singapore":    "/work/wardrobe-oak-800.webp",
};

/* ── Single source of truth for sitemap + internal nav ─────────────────────── */
export const SERVICE_PAGES: Array<{ slug: string; label: string; priority: number }> = [
  { slug: "ikea-assembly-singapore",                 label: "IKEA Assembly Singapore",        priority: 0.9  },
  { slug: "wardrobe-installation-singapore",         label: "Wardrobe Installation",          priority: 0.9  },
  { slug: "bed-assembly-singapore",                  label: "Bed Assembly Singapore",         priority: 0.9  },
  { slug: "tv-mounting-singapore",                   label: "TV Mounting Singapore",          priority: 0.9  },
  { slug: "sofa-assembly-singapore",                 label: "Sofa Assembly Singapore",        priority: 0.9  },
  { slug: "mattress-installation-singapore",         label: "Mattress Setup & Disposal",      priority: 0.85 },
  { slug: "furniture-dismantling-singapore",         label: "Furniture Dismantling",          priority: 0.85 },
  { slug: "office-furniture-installation-singapore", label: "Office Furniture Installation",  priority: 0.85 },
  { slug: "furniture-relocation-singapore",          label: "Furniture Relocation",           priority: 0.85 },
  { slug: "taobao-furniture-installation-singapore", label: "Taobao Furniture Installation",  priority: 0.9  },
  { slug: "castlery-furniture-assembly-singapore",   label: "Castlery Furniture Assembly",    priority: 0.9  },
  { slug: "hdb-moving-services-singapore",           label: "HDB Moving Services",            priority: 0.9  },
  { slug: "condo-moving-services-singapore",         label: "Condo Moving Services",          priority: 0.9  },
  { slug: "lazada-furniture-installation-singapore", label: "Lazada Furniture Installation",  priority: 0.85 },
  { slug: "shopee-furniture-installation-singapore", label: "Shopee Furniture Installation",  priority: 0.85 },
  { slug: "gym-equipment-installation-singapore",    label: "Gym Equipment Installation",     priority: 0.85 },
  { slug: "furniture-repair-adjustment-singapore",   label: "Furniture Repair & Adjustment",  priority: 0.8  },
];

/* ── Guide / cost / comparison pages (answer-style content for Google + AI) ─── */
export const GUIDE_PAGES: Array<{ slug: string; label: string; priority: number }> = [
  { slug: "furniture-installation-cost-singapore", label: "Furniture Installation Cost Guide", priority: 0.85 },
  { slug: "ikea-assembly-cost-singapore",          label: "IKEA Assembly Cost Guide",          priority: 0.85 },
  { slug: "tmg-install-vs-traditional-movers",     label: "TMG Install vs Traditional Movers", priority: 0.75 },
  { slug: "hdb-vs-condo-moving-singapore",         label: "HDB vs Condo Moving Guide",         priority: 0.75 },
];

/* ── Reviews used both visually and in JSON-LD ──────────────────────────────── */
const REVIEWS = [
  { name: "Prapat S.",  loc: "Toa Payoh HDB",    stars: 5, date: "2026-03-15", text: "Fast, professional and reliable. The team assembled our entire IKEA PAX wardrobe in under 2 hours. Very neat job — no damage at all. Will definitely use again." },
  { name: "Michelle T.", loc: "Tampines EC",      stars: 5, date: "2026-02-22", text: "Booked through the website and got a quote in 60 seconds — exactly as advertised. The installer arrived on time, worked efficiently and cleaned up everything. Highly recommend!" },
  { name: "David K.",   loc: "Jurong West HDB",  stars: 5, date: "2026-03-28", text: "Got my TV wall-mounted on a concrete wall. The team brought all the right drill bits and secured it perfectly. Cable management looks super clean. Great service!" },
  { name: "Rachel L.",  loc: "Bishan Condo",     stars: 5, date: "2026-01-18", text: "Needed same-day assembly for a new bed frame delivery. TMG Install accommodated us at short notice. The price was fair and the workmanship was excellent." },
];

/* ── Live review cache ───────────────────────────────────────────────────────
   Populated by the server at startup and refreshed whenever an admin edits
   reviews or the aggregate rating. Keeping it in a module-level variable lets
   the (synchronous) SSR page builders read real, admin-managed data without
   becoming async. Falls back to the static REVIEWS above when empty. */
export type ReviewItem = { name: string; loc: string; stars: number; date: string; text: string };
let REVIEW_CACHE: { reviews: ReviewItem[]; ratingValue: string; ratingCount: string } | null = null;
export function setReviewData(data: { reviews: ReviewItem[]; ratingValue: string; ratingCount: string }): void {
  REVIEW_CACHE = data;
}
function activeReviews(): ReviewItem[] {
  return REVIEW_CACHE && REVIEW_CACHE.reviews.length ? REVIEW_CACHE.reviews : REVIEWS;
}
function ratingValue(): string { return REVIEW_CACHE?.ratingValue || "4.9"; }
function ratingCount(): string { return REVIEW_CACHE?.ratingCount || "127"; }
/* Sync the homepage (client/index.html) JSON-LD aggregate rating numbers with
   the admin-set values so the homepage never diverges from the SSR pages.
   Only the aggregate numbers are synced — the homepage review list is React-rendered. */
export function injectHomepageRating(html: string): string {
  return html
    .replace(/("aggregateRating"\s*:\s*\{[^}]*?"ratingValue"\s*:\s*)"[^"]*"/, `$1"${ratingValue()}"`)
    .replace(/("reviewCount"\s*:\s*)"[^"]*"/, `$1"${ratingCount()}"`);
}

/* ── Homepage crawler content ────────────────────────────────────────────────
   The homepage "/" serves the React SPA, whose root element is empty in the
   delivered HTML — so search-engine crawlers that do not execute JavaScript saw
   a page with no <h1>, no headings, almost no text and no links. We pre-render a
   real, keyword-rich content block INTO #root. React mounts with createRoot(),
   which clears #root and replaces this with the live app for real visitors (and
   it sits behind the full-screen splash overlay until then), so there is no
   cloaking and no hydration mismatch — crawlers index the content, users get the
   app. Keep the copy aligned with the homepage meta title/description. */
function homepageSeoBlock(): string {
  const serviceLinks = SERVICE_PAGES
    .map(p => `<li><a href="/services/${p.slug}">${esc(p.label)} Singapore</a></li>`)
    .join("");
  const guideLinks = GUIDE_PAGES
    .map(p => `<li><a href="/guides/${p.slug}">${esc(p.label)}</a></li>`)
    .join("");
  return `<div id="seo-home" style="max-width:980px;margin:0 auto;padding:2rem 1.25rem;font-family:Inter,system-ui,-apple-system,sans-serif;color:#1a1a2e;line-height:1.6">
  <p style="font-weight:800"><a href="/">TMG Install — The Moving Guy Pte Ltd</a></p>
  <h1>Furniture Installation &amp; Relocation Singapore</h1>
  <p><strong>TMG Install</strong> (The Moving Guy Pte Ltd) is Singapore's trusted specialist for professional furniture installation, assembly, dismantling and relocation. Get an instant, upfront quote online in about 60 seconds — no site visit needed for most jobs and no hidden fees.</p>
  <p>Whether you need IKEA, Taobao, Castlery, Lazada or Shopee furniture assembled, a full HDB or condominium move, or careful dismantle-and-reinstall of your wardrobe and bed frame, our experienced, MCST-compliant team handles every job across Singapore with care and transparent, fixed pricing.</p>

  <h2>Our Furniture Services in Singapore</h2>
  <p>We cover the full range of home and office furniture work island-wide:</p>
  <ul>${serviceLinks}</ul>

  <h2>Helpful Guides &amp; Pricing</h2>
  <p>Not sure what your job should cost? These guides explain typical pricing and how we compare:</p>
  <ul>${guideLinks}</ul>

  <h2>Why Choose TMG Install</h2>
  <p>We make furniture installation and moving in Singapore simple, predictable and stress-free. Rated ${ratingValue()} from ${ratingCount()}+ customer reviews, our installers arrive on time, work cleanly and treat your home with respect.</p>
  <ul>
    <li>Instant, transparent quotes — know your price before you book</li>
    <li>Experienced, careful installers for HDB flats, condos and landed homes</li>
    <li>Full relocation service: dismantle, transport and reinstall</li>
    <li>Disposal and old-mattress removal available on request</li>
  </ul>

  <h2>Book Your Installation or Move</h2>
  <p>Ready to get started? <a href="/services">Browse all our services</a> or request an instant quote online. Based in Singapore, we serve every HDB estate, condominium and commercial office island-wide. You can also <a href="https://www.google.com/maps/search/?api=1&amp;query=The+Moving+Guy+Pte+Ltd+Singapore" rel="noopener" target="_blank">find us on Google Maps</a>.</p>
</div>`;
}

/* Serve the homepage shell with the crawler content block injected into #root
   (plus the synced aggregate-rating numbers). Used only for the "/" route. */
export function injectHomepageContent(html: string): string {
  return injectHomepageRating(html).replace(
    '<div id="root"></div>',
    `<div id="root">${homepageSeoBlock()}</div>`,
  );
}
/* Escape user-managed strings before interpolating into HTML. */
function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function formatReviewDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(d);
  if (!m) return d;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

function shell({
  title,
  description,
  canonical,
  schema,
  body,
  breadcrumb,
  section = "Services",
  sectionHref,
}: {
  title: string;
  description: string;
  canonical: string;
  schema: object[];
  body: string;
  breadcrumb: string;
  section?: string;
  sectionHref?: string;
}): string {
  const slugMatch = canonical.match(/\/services\/([^/?#]+)/);
  const slug = slugMatch ? slugMatch[1] : "";
  const ogImagePath = OG_IMAGES[slug] || "/og-image.png";
  const ogImageUrl = `${DOMAIN}${ogImagePath}`;

  const sectionCrumb = (sectionHref || section === "Services")
    ? `<a href="${sectionHref || "/services"}">${section}</a>`
    : `<span>${section}</span>`;
  const quickAnswerHtml = quickAnswerBox(extractQuickAnswer(schema));

  const enrichedSchema = schema.map(item => {
    if ((item as any)["@type"] === "Service") {
      const enriched: any = { ...item };
      if (!enriched.aggregateRating) {
        enriched.aggregateRating = {
          "@type": "AggregateRating",
          "ratingValue": ratingValue(),
          "reviewCount": ratingCount(),
          "bestRating": "5",
          "worstRating": "1",
        };
      }
      if (!enriched.review) {
        enriched.review = activeReviews().map(r => ({
          "@type": "Review",
          "author": { "@type": "Person", "name": r.name },
          "reviewRating": { "@type": "Rating", "ratingValue": String(r.stars), "bestRating": "5" },
          "reviewBody": r.text,
          "datePublished": r.date,
        }));
      }
      if (!enriched.image) {
        enriched.image = ogImageUrl;
      }
      return enriched;
    }
    return item;
  });
  const schemaJson = JSON.stringify(enrichedSchema, null, 0).replace(/</g, "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:site_name" content="${BRAND}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:alt" content="${title}" />
  <meta property="og:locale" content="en_SG" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImageUrl}" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" media="print" onload="this.media='all'" />
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" /></noscript>
  <script type="application/ld+json">${schemaJson}</script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1a1a2e; background: #fff; line-height: 1.6; }
    a { color: inherit; text-decoration: none; }
    img { max-width: 100%; height: auto; }

    /* Nav */
    .nav { background: #0f172a; padding: 0 1.5rem; display: flex; align-items: center; justify-content: space-between; height: 60px; position: sticky; top: 0; z-index: 50; }
    .nav-logo { color: #fff; font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; }
    .nav-logo span { color: #3b82f6; }
    .nav-cta { background: #3b82f6; color: #fff; padding: 0.5rem 1.2rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600; transition: background 0.2s; }
    .nav-cta:hover { background: #2563eb; }

    /* Hero */
    .hero { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; padding: 4rem 1.5rem 3.5rem; text-align: center; }
    .hero-badge { display: inline-block; background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); padding: 0.35rem 1rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 1.25rem; }
    .hero h1 { font-size: clamp(1.8rem, 5vw, 3rem); font-weight: 800; line-height: 1.2; margin-bottom: 1rem; }
    .hero h1 em { color: #60a5fa; font-style: normal; }
    .hero-desc { font-size: 1.1rem; color: #cbd5e1; max-width: 600px; margin: 0 auto 2rem; }
    .hero-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .btn-primary { background: #3b82f6; color: #fff; padding: 0.85rem 2rem; border-radius: 10px; font-weight: 700; font-size: 1rem; transition: background 0.2s, transform 0.15s; display: inline-block; }
    .btn-primary:hover { background: #2563eb; transform: translateY(-1px); }
    .btn-ghost { background: rgba(255,255,255,0.1); color: #fff; padding: 0.85rem 2rem; border-radius: 10px; font-weight: 600; font-size: 1rem; border: 1px solid rgba(255,255,255,0.2); transition: background 0.2s; display: inline-block; }
    .btn-ghost:hover { background: rgba(255,255,255,0.18); }

    /* Trust bar */
    .trust-bar { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 1rem 1.5rem; }
    .trust-inner { max-width: 900px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; align-items: center; }
    .trust-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 500; color: #475569; }
    .trust-icon { font-size: 1.1rem; }

    /* Breadcrumb */
    .breadcrumb { background: #fff; border-bottom: 1px solid #f1f5f9; padding: 0.6rem 1.5rem; }
    .breadcrumb-inner { max-width: 900px; margin: 0 auto; font-size: 0.8rem; color: #94a3b8; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .breadcrumb-inner a { color: #64748b; }
    .breadcrumb-inner a:hover { color: #3b82f6; }

    /* Quick answer (GEO direct-answer box) */
    .quick-answer { background: #eff6ff; border-bottom: 1px solid #dbeafe; padding: 1.25rem 1.5rem; }
    .quick-answer-inner { max-width: 900px; margin: 0 auto; border-left: 4px solid #3b82f6; padding-left: 1rem; }
    .qa-eyebrow { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #2563eb; margin-bottom: 0.35rem; }
    .qa-q { font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem; }
    .qa-a { font-size: 0.92rem; color: #334155; margin: 0; line-height: 1.6; }

    /* Comparison table */
    .compare-table { width: 100%; border-collapse: collapse; margin-top: 1.25rem; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; font-size: 0.9rem; }
    .compare-table th, .compare-table td { padding: 0.8rem 1rem; text-align: left; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .compare-table th { background: #0f172a; color: #fff; font-weight: 600; }
    .compare-table td:first-child { font-weight: 600; color: #334155; }
    .compare-table tr:last-child td { border-bottom: none; }
    .compare-table tr:nth-child(even) td { background: #f8fafc; }
    .compare-yes { color: #16a34a; font-weight: 700; }
    .compare-no { color: #dc2626; font-weight: 700; }

    /* Stat strip */
    .stat-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-top: 1.25rem; }
    .stat-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; text-align: center; }
    .stat-num { font-size: 1.6rem; font-weight: 800; color: #3b82f6; line-height: 1.1; }
    .stat-label { font-size: 0.8rem; color: #64748b; margin-top: 0.35rem; }

    /* Content */
    .content { max-width: 900px; margin: 0 auto; padding: 3rem 1.5rem; }
    .section { margin-bottom: 3rem; }
    .section h2 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #3b82f6; display: inline-block; }
    .section h3 { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 1.5rem 0 0.5rem; }
    .section p { color: #475569; margin-bottom: 1rem; }
    .section ul, .section ol { color: #475569; padding-left: 1.5rem; margin-bottom: 1rem; }
    .section li { margin-bottom: 0.5rem; }

    /* Service grid */
    .service-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; margin-top: 1.25rem; }
    .service-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; transition: border-color 0.2s, box-shadow 0.2s; }
    .service-card:hover { border-color: #3b82f6; box-shadow: 0 4px 16px rgba(59,130,246,0.1); }
    .service-card-icon { font-size: 2rem; margin-bottom: 0.75rem; }
    .service-card h3 { font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.4rem; }
    .service-card p { font-size: 0.875rem; color: #64748b; margin: 0; }

    /* Pricing */
    .pricing-table { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-top: 1.25rem; }
    .pricing-row { display: grid; grid-template-columns: 1fr auto; padding: 0.9rem 1.25rem; align-items: center; gap: 1rem; }
    .pricing-row:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
    .pricing-row:nth-child(even) { background: #f8fafc; }
    .pricing-item { font-size: 0.9rem; color: #334155; font-weight: 500; }
    .pricing-price { font-size: 0.9rem; font-weight: 700; color: #3b82f6; white-space: nowrap; }

    /* FAQ */
    .faq-item { border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 1rem; overflow: hidden; }
    .faq-q { padding: 1.1rem 1.25rem; font-weight: 600; font-size: 0.95rem; color: #0f172a; background: #f8fafc; }
    .faq-a { padding: 1rem 1.25rem; font-size: 0.9rem; color: #475569; border-top: 1px solid #f1f5f9; }

    /* CTA box */
    .cta-box { background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #fff; border-radius: 16px; padding: 2.5rem; text-align: center; }
    .cta-box h2 { font-size: 1.6rem; font-weight: 800; margin-bottom: 0.75rem; }
    .cta-box p { color: #cbd5e1; margin-bottom: 1.75rem; }
    .cta-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .cta-phone { color: #60a5fa; font-weight: 700; font-size: 1.1rem; }
    .cta-phone:hover { color: #93c5fd; }

    /* Footer */
    .footer { background: #0f172a; color: #94a3b8; padding: 0 1.5rem 2rem; font-size: 0.85rem; }
    .footer a { color: #64748b; }
    .footer a:hover { color: #3b82f6; }
    .footer-links { display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; margin-top: 0.75rem; text-align: center; }
    .footer-services { max-width: 900px; margin: 0 auto; padding: 2rem 0 1.5rem; border-bottom: 1px solid #1e293b; }
    .footer-services h3 { color: #cbd5e1; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 1rem; text-align: center; }
    .footer-services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.4rem 1.5rem; }
    .footer-services-grid a { color: #64748b; font-size: 0.82rem; display: flex; align-items: center; gap: 0.4rem; padding: 0.2rem 0; }
    .footer-services-grid a:hover { color: #3b82f6; }
    .footer-bottom { text-align: center; padding-top: 1.5rem; }

    /* Reviews */
    .reviews-section { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 3rem 1.5rem; }
    .reviews-inner { max-width: 900px; margin: 0 auto; }
    .reviews-inner h2 { font-size: 1.4rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; }
    .reviews-subtitle { font-size: 0.9rem; color: #64748b; margin-bottom: 2rem; }
    .reviews-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
    .review-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; }
    .review-stars { color: #f59e0b; font-size: 1rem; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
    .review-text { font-size: 0.9rem; color: #475569; line-height: 1.6; margin-bottom: 1rem; font-style: italic; }
    .review-author { font-size: 0.82rem; font-weight: 600; color: #0f172a; }
    .review-loc { font-size: 0.78rem; color: #94a3b8; }

    /* Responsive */
    @media (max-width: 640px) {
      .hero { padding: 2.5rem 1rem 2rem; }
      .content { padding: 2rem 1rem; }
      .hero-btns { flex-direction: column; align-items: center; }
      .cta-btns { flex-direction: column; align-items: center; }
      .pricing-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <a href="/" class="nav-logo">TMG<span>Install</span></a>
    <a href="${CTA_URL}" class="nav-cta">Get Free Quote</a>
  </nav>
  <div class="breadcrumb">
    <div class="breadcrumb-inner">
      <a href="/">Home</a>
      <span>›</span>
      ${sectionCrumb}
      <span>›</span>
      <span>${breadcrumb}</span>
    </div>
  </div>
  ${quickAnswerHtml}
  ${body}
  ${reviewsSection()}
  <footer class="footer">
    <div class="footer-services">
      <h3>Our Services</h3>
      <div class="footer-services-grid">
        ${SERVICE_PAGES.map(p => `<a href="/services/${p.slug}">→ ${p.label}</a>`).join("\n        ")}
      </div>
      <h3 style="margin-top:1.75rem;">Guides &amp; Pricing</h3>
      <div class="footer-services-grid">
        ${GUIDE_PAGES.map(p => `<a href="/guides/${p.slug}">→ ${p.label}</a>`).join("\n        ")}
      </div>
    </div>
    <div class="footer-bottom">
      <div>© ${new Date().getFullYear()} The Moving Guy Pte Ltd (UEN 202424156H) · Singapore</div>
      <div class="footer-links">
        <a href="/">Home</a>
        <a href="${CTA_URL}">Get a Quote</a>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="mailto:${EMAIL}">${EMAIL}</a>
      </div>
    </div>
  </footer>
</body>
</html>`;
}

function trustBar(): string {
  return `
  <div class="trust-bar">
    <div class="trust-inner">
      <div class="trust-item"><span class="trust-icon">⭐</span> 5-Star Rated Service</div>
      <div class="trust-item"><span class="trust-icon">🏙️</span> Island-Wide Coverage</div>
      <div class="trust-item"><span class="trust-icon">⚡</span> Same-Day Available</div>
      <div class="trust-item"><span class="trust-icon">💬</span> Instant Upfront Quote</div>
      <div class="trust-item"><span class="trust-icon">🛡️</span> Fully Insured</div>
    </div>
  </div>`;
}

/* ── GEO: auto direct-answer box pulled from the first FAQ in a page's schema ──
   AI engines (ChatGPT, Perplexity, Google AI Overviews) heavily favour pages
   that answer the question directly and high in the document. Every page that
   ships a FAQPage automatically gets a concise "Quick Answer" block at the top
   — no per-page edits required. */
function extractQuickAnswer(schema: object[]): { q: string; a: string } | null {
  const faq = schema.find(s => (s as any)["@type"] === "FAQPage") as any;
  if (!faq || !Array.isArray(faq.mainEntity) || faq.mainEntity.length === 0) return null;
  const first = faq.mainEntity[0];
  const q = first?.name;
  const a = first?.acceptedAnswer?.text;
  if (!q || !a) return null;
  return { q: String(q), a: String(a) };
}

function quickAnswerBox(qa: { q: string; a: string } | null): string {
  if (!qa) return "";
  return `
  <div class="quick-answer">
    <div class="quick-answer-inner">
      <div class="qa-eyebrow">Quick Answer</div>
      <div class="qa-q">${qa.q}</div>
      <p class="qa-a">${qa.a}</p>
    </div>
  </div>`;
}

function reviewsSection(): string {
  const reviews = activeReviews();

  const cards = reviews.map(r => `
    <div class="review-card" itemscope itemtype="https://schema.org/Review">
      <div class="review-stars">${"★".repeat(r.stars)}</div>
      <p class="review-text" itemprop="reviewBody">"${esc(r.text)}"</p>
      <div itemprop="author" itemscope itemtype="https://schema.org/Person">
        <div class="review-author" itemprop="name">${esc(r.name)}</div>
      </div>
      <div class="review-loc">${esc(r.loc)}${r.loc && r.date ? " · " : ""}${esc(formatReviewDate(r.date))}</div>
      <meta itemprop="ratingValue" content="${r.stars}" />
      <meta itemprop="bestRating" content="5" />
    </div>`).join("");

  return `
  <section class="reviews-section">
    <div class="reviews-inner">
      <h2>What Our Customers Say</h2>
      <p class="reviews-subtitle">${ratingValue()} ★ average rating · ${ratingCount()}+ verified reviews from Singapore customers</p>
      <div class="reviews-grid" itemprop="review">
        ${cards}
      </div>
    </div>
  </section>`;
}

/* ── IKEA Assembly ──────────────────────────────────────────────────────────── */
export function ikeaAssemblyPage(): string {
  const title = "IKEA Assembly Singapore | TMG Install — From $60";
  const description = "Professional IKEA furniture assembly in Singapore. PAX wardrobes, KALLAX shelves, MALM beds, BILLY bookcases and all IKEA flat-pack. Island-wide, same-day available. Get an instant quote.";
  const canonical = `${DOMAIN}/services/ikea-assembly-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "IKEA Assembly Singapore",
      "serviceType": "Furniture Assembly",
      "provider": {
        "@type": "LocalBusiness",
        "@id": `${DOMAIN}/#business`,
        "name": BRAND,
      },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": {
        "@type": "Offer",
        "priceCurrency": "SGD",
        "price": "60",
        "priceSpecification": { "@type": "UnitPriceSpecification", "priceCurrency": "SGD", "price": "60", "unitText": "per item from" },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much does IKEA assembly cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "IKEA assembly in Singapore starts from $60 per item for small pieces. A PAX wardrobe is typically $150–$200 depending on size and configuration. Get an instant itemised quote at tmginstall.com/estimate." } },
        { "@type": "Question", "name": "Do you assemble all IKEA furniture?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we assemble all IKEA flat-pack furniture including PAX, KALLAX, BILLY, MALM, HEMNES, BRIMNES, LACK, ALEX, TROFAST, and more." } },
        { "@type": "Question", "name": "How long does IKEA assembly take?", "acceptedAnswer": { "@type": "Answer", "text": "A single IKEA item typically takes 30–60 minutes. A full PAX wardrobe with doors and drawers takes 1.5–3 hours depending on configuration." } },
        { "@type": "Question", "name": "Do you provide same-day IKEA assembly?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, subject to availability. Book early and select your preferred time slot when you get a quote." } },
        { "@type": "Question", "name": "Do I need to provide any tools?", "acceptedAnswer": { "@type": "Answer", "text": "No — our team brings all the tools needed. You just need to have the IKEA boxes ready at the installation location." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "IKEA Assembly Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">IKEA Assembly Singapore</div>
    <h1>Professional <em>IKEA Assembly</em><br/>in Singapore</h1>
    <p class="hero-desc">Every IKEA flat-pack assembled correctly — PAX wardrobes, BILLY bookcases, MALM beds, KALLAX and more. Instant upfront pricing, no hidden fees.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>What We Assemble</h2>
      <p>We assemble the complete IKEA range — from simple side tables to full PAX wardrobe systems with sliding doors. Our team has experience with every IKEA product line.</p>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🚪</div><h3>PAX Wardrobes</h3><p>Full PAX systems with hinged or sliding doors, interior organisers and mirror panels.</p></div>
        <div class="service-card"><div class="service-card-icon">📚</div><h3>BILLY & KALLAX</h3><p>Bookshelves, cube shelving, media units and storage combinations.</p></div>
        <div class="service-card"><div class="service-card-icon">🛏️</h3><h3>MALM & HEMNES Beds</h3><p>All IKEA bed frames including storage drawers and headboard attachments.</p></div>
        <div class="service-card"><div class="service-card-icon">🪑</div><h3>Dining & Living</h3><p>LACK tables, EKEDALEN dining sets, KIVIK sofas, TV stands and more.</p></div>
        <div class="service-card"><div class="service-card-icon">🗄️</div><h3>ALEX & BRIMNES</h3><p>Desks, drawer units, dressing tables and bedroom storage.</p></div>
        <div class="service-card"><div class="service-card-icon">👶</div><h3>TROFAST & Kids</h3><p>Children's storage, beds, changing tables and play equipment.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Pricing Guide</h2>
      <p>All prices are per item. Get an <a href="${CTA_URL}" style="color:#3b82f6;font-weight:600;">instant itemised quote</a> for your full order.</p>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">PAX Wardrobe (single, no doors)</span><span class="pricing-price">from $150</span></div>
        <div class="pricing-row"><span class="pricing-item">PAX Wardrobe (with doors)</span><span class="pricing-price">from $180</span></div>
        <div class="pricing-row"><span class="pricing-item">BILLY / KALLAX Shelving Unit</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">Bed Frame (MALM, HEMNES, etc.)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Dining Table & Chairs (set)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">TV Console / Media Unit</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">Desk & Drawer Unit</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">Small items (LACK table, etc.)</span><span class="pricing-price">from $40</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Why Choose TMG Install?</h2>
      <h3>Experienced & Reliable</h3>
      <p>Our team has assembled thousands of IKEA pieces across Singapore. We know the exact sequence, the tricky parts, and the hidden steps that IKEA's instructions sometimes skip. Every join is tight, every drawer glides properly.</p>
      <h3>Transparent Upfront Pricing</h3>
      <p>No hourly surprises. You see the full price before booking — itemised per piece, including all labour. The quote you see is the price you pay.</p>
      <h3>Island-Wide Service</h3>
      <p>We cover all of Singapore — Jurong, Tampines, Woodlands, Punggol, Bukit Timah, CBD, Sentosa, and everywhere in between.</p>
      <h3>Tidying Up Included</h3>
      <p>We break down and bag all cardboard packaging and clean up the workspace before we leave.</p>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">How much does IKEA assembly cost in Singapore?</div><div class="faq-a">Assembly starts from $60 per small item, with PAX wardrobes from $150 depending on size. Get an itemised quote instantly at tmginstall.com/estimate — no phone call needed.</div></div>
      <div class="faq-item"><div class="faq-q">Do you assemble all IKEA furniture?</div><div class="faq-a">Yes — we handle the entire IKEA catalogue including PAX, BILLY, KALLAX, MALM, HEMNES, BRIMNES, LACK, ALEX, TROFAST, KIVIK and all current ranges.</div></div>
      <div class="faq-item"><div class="faq-q">How long does IKEA assembly take?</div><div class="faq-a">A single item typically takes 30–60 minutes. A full PAX wardrobe system with doors, drawers and top cabinets can take 2–3 hours. We give you an estimated duration at booking.</div></div>
      <div class="faq-item"><div class="faq-q">Is same-day IKEA assembly available?</div><div class="faq-a">Yes, subject to availability. Select your preferred date and time when you get your quote. We cover morning, afternoon and evening slots.</div></div>
      <div class="faq-item"><div class="faq-q">Do I need to provide tools?</div><div class="faq-a">No — we bring everything. Just have your IKEA boxes at the installation spot and we'll handle the rest.</div></div>
      <div class="faq-item"><div class="faq-q">Can you collect my IKEA order and assemble it?</div><div class="faq-a">Yes — we offer a collect-and-assemble service. WhatsApp us to discuss your IKEA order details and we'll arrange collection.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Ready to Get Started?</h2>
        <p>Get an instant itemised quote — no phone calls, no waiting.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "IKEA Assembly Singapore" });
}

/* ── Wardrobe Installation ──────────────────────────────────────────────────── */
export function wardrobeInstallationPage(): string {
  const title = "Wardrobe Installation Singapore | TMG Install — From $80";
  const description = "Expert wardrobe installation in Singapore. Sliding door wardrobes, built-in wardrobes, IKEA PAX, and custom carpentry. Secure wall mounting included. Island-wide, same-day available.";
  const canonical = `${DOMAIN}/services/wardrobe-installation-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Wardrobe Installation Singapore",
      "serviceType": "Furniture Installation",
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "price": "80" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much does wardrobe installation cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Wardrobe installation in Singapore starts from $80 for a standard 2-door cabinet. IKEA PAX systems are typically $150–$200. Larger sliding-door or walk-in wardrobes are $200–$400 depending on size and complexity." } },
        { "@type": "Question", "name": "Do you install sliding door wardrobes?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we install all types of sliding door wardrobes including IKEA PAX with Hasvik/Hokksund/Auli doors, and third-party sliding door kits." } },
        { "@type": "Question", "name": "Can you wall-mount a wardrobe?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. We secure wardrobes to the wall for safety and stability. This is especially important for tall wardrobe systems in Singapore's high-rise homes." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Wardrobe Installation Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Wardrobe Installation Singapore</div>
    <h1><em>Wardrobe Installation</em><br/>Singapore Specialists</h1>
    <p class="hero-desc">Sliding door wardrobes, built-ins, PAX systems and free-standing units — all professionally installed and wall-secured. Upfront pricing, island-wide.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>Wardrobe Types We Install</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🚪</div><h3>Sliding Door Wardrobes</h3><p>All sliding door systems — IKEA, Harvey Norman, Courts, and custom carpentry builds.</p></div>
        <div class="service-card"><div class="service-card-icon">📦</div><h3>IKEA PAX Systems</h3><p>PAX frames with hinged or sliding doors, interior organisers, mirror panels and top cabinets.</p></div>
        <div class="service-card"><div class="service-card-icon">🏠</div><h3>Free-Standing Wardrobes</h3><p>All brands and configurations — hinged doors, open-face, and combination wardrobe sets.</p></div>
        <div class="service-card"><div class="service-card-icon">🔩</div><h3>Wall-Mounted & Built-In</h3><p>Safe and secure wall anchoring for all wardrobe types. Required by HDB and condo fire safety guidelines.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Pricing Guide</h2>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">Standard 2-door wardrobe (hinged)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">IKEA PAX (single, no doors)</span><span class="pricing-price">from $150</span></div>
        <div class="pricing-row"><span class="pricing-item">IKEA PAX (with sliding doors)</span><span class="pricing-price">from $200</span></div>
        <div class="pricing-row"><span class="pricing-item">3-door wardrobe with mirrors</span><span class="pricing-price">from $120</span></div>
        <div class="pricing-row"><span class="pricing-item">4-door / L-shape wardrobe</span><span class="pricing-price">from $180</span></div>
        <div class="pricing-row"><span class="pricing-item">Walk-in wardrobe system</span><span class="pricing-price">from $250</span></div>
        <div class="pricing-row"><span class="pricing-item">Wall anchoring / securing</span><span class="pricing-price">included</span></div>
      </div>
    </div>

    <div class="section">
      <h2>What's Included</h2>
      <h3>Full Assembly & Alignment</h3>
      <p>We assemble every component — base, frame, shelves, rails, drawers and doors — ensuring everything is level, aligned and smooth-operating before we leave.</p>
      <h3>Wall Securing (Standard)</h3>
      <p>All wardrobes are wall-anchored for safety. This is included in our standard service — no extra charge. We use appropriate wall plugs for concrete, brick, and drywall surfaces.</p>
      <h3>Door Adjustment</h3>
      <p>Doors are aligned and adjusted so they close flush with even gaps. Soft-close hinges and drawer runners are tested before sign-off.</p>
      <h3>Packaging Removal</h3>
      <p>We break down all cardboard boxes and packaging for you to dispose of, and clean up the workspace before leaving.</p>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">How much does wardrobe installation cost in Singapore?</div><div class="faq-a">Standard 2-door wardrobe installation starts from $80. IKEA PAX systems start from $150 (sliding doors from $200). Walk-in wardrobe systems from $250. All prices are upfront with no hidden charges.</div></div>
      <div class="faq-item"><div class="faq-q">Do you install sliding door wardrobes?</div><div class="faq-a">Yes — sliding door systems from IKEA (PAX + Hasvik, Hokksund, Auli doors), Harvey Norman, Courts, and custom-made carpentry wardrobes.</div></div>
      <div class="faq-item"><div class="faq-q">Can you wall-mount a wardrobe safely in a HDB flat?</div><div class="faq-a">Yes. We use appropriate wall anchors for HDB concrete walls and can also anchor into drywall partitions. All wall work follows Singapore safety guidelines.</div></div>
      <div class="faq-item"><div class="faq-q">Can you dismantle my old wardrobe before installing the new one?</div><div class="faq-a">Yes — we offer dismantling as an add-on. Get a quote that includes both dismantling and installation for the most competitive rate.</div></div>
      <div class="faq-item"><div class="faq-q">How long does wardrobe installation take?</div><div class="faq-a">A standard 2-door wardrobe takes 1–2 hours. A large PAX system with sliding doors and interior fittings can take 3–4 hours.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Ready to Get Started?</h2>
        <p>Instant itemised quote — see your exact price before booking.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Wardrobe Installation" });
}

/* ── Bed Assembly ────────────────────────────────────────────────────────────── */
export function bedAssemblyPage(): string {
  const title = "Bed Assembly Singapore | TMG Install — From $80";
  const description = "Professional bed frame assembly in Singapore. IKEA MALM, HEMNES, Castlery, King Living, storage beds and all brands. Safe, fast, island-wide. Get an instant quote.";
  const canonical = `${DOMAIN}/services/bed-assembly-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Bed Assembly Singapore",
      "serviceType": "Furniture Assembly",
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "price": "80" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much does bed assembly cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Bed frame assembly in Singapore starts from $80 for a single/super-single frame, $100 for queen, and $120 for king-size or storage beds with drawers." } },
        { "@type": "Question", "name": "Do you assemble all bed brands?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we assemble all brands including IKEA (MALM, HEMNES, BRIMNES, NEIDEN), Castlery, King Living, Comfort Design, HipVan, Taobao, Lazada and all custom beds." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Bed Assembly Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Bed Assembly Singapore</div>
    <h1><em>Bed Frame Assembly</em><br/>Singapore Experts</h1>
    <p class="hero-desc">All bed types, all brands — IKEA, Castlery, King Living, HipVan, and more. Storage beds, upholstered frames, divan bases. Upfront pricing, island-wide.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>Bed Types We Assemble</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🛏️</div><h3>IKEA Bed Frames</h3><p>MALM, HEMNES, BRIMNES, NEIDEN, TARVA, SONGESAND, IDANÄS — all sizes.</p></div>
        <div class="service-card"><div class="service-card-icon">🗄️</div><h3>Storage Beds</h3><p>Hydraulic lift storage, drawer storage and Ottoman beds from all brands.</p></div>
        <div class="service-card"><div class="service-card-icon">🛋️</div><h3>Upholstered & Divan</h3><p>Fabric and leather upholstered frames, divan bases with headboards.</p></div>
        <div class="service-card"><div class="service-card-icon">👶</div><h3>Bunk & Kids Beds</h3><p>All bunk beds, loft beds and children's bed frames including guard rails.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Pricing Guide</h2>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">Single / Super-Single bed frame</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Queen bed frame</span><span class="pricing-price">from $100</span></div>
        <div class="pricing-row"><span class="pricing-item">King bed frame</span><span class="pricing-price">from $120</span></div>
        <div class="pricing-row"><span class="pricing-item">Storage bed (with drawers/lift)</span><span class="pricing-price">from $150</span></div>
        <div class="pricing-row"><span class="pricing-item">Bunk bed / loft bed</span><span class="pricing-price">from $120</span></div>
        <div class="pricing-row"><span class="pricing-item">Divan base + headboard</span><span class="pricing-price">from $80</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">How much does bed assembly cost in Singapore?</div><div class="faq-a">Bed frame assembly starts from $80 for single frames up to $150+ for large storage beds. Get an exact itemised quote at tmginstall.com/estimate.</div></div>
      <div class="faq-item"><div class="faq-q">Do you assemble beds from all brands?</div><div class="faq-a">Yes — IKEA, Castlery, King Living, HipVan, Comfort Design, Taobao, Lazada and all other brands including custom-made and carpentry beds.</div></div>
      <div class="faq-item"><div class="faq-q">Can you install the mattress too?</div><div class="faq-a">We focus on the bed frame. You or your mattress provider typically place the mattress after the frame is fully assembled and secured.</div></div>
      <div class="faq-item"><div class="faq-q">How long does bed assembly take?</div><div class="faq-a">A standard queen bed frame takes 45–90 minutes. A king storage bed with hydraulic lift can take 2–3 hours.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Book Your Bed Assembly</h2>
        <p>Instant quote — see your exact price before confirming.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Bed Assembly" });
}

/* ── Furniture Dismantling ───────────────────────────────────────────────────── */
export function furnitureDismantlingPage(): string {
  const title = "Furniture Dismantling Singapore | TMG Install — From $50";
  const description = "Professional furniture dismantling in Singapore. Wardrobes, beds, tables, shelves — all brands. Safe disassembly before moving or disposal. Island-wide, same-day available.";
  const canonical = `${DOMAIN}/services/furniture-dismantling-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Furniture Dismantling Singapore",
      "serviceType": "Furniture Dismantling",
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "price": "50" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much does furniture dismantling cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Furniture dismantling in Singapore starts from $50 per item. A wardrobe is typically $60–$120, a bed frame $60–$100, and a dining set $60–$80." } },
        { "@type": "Question", "name": "Can you dismantle and reassemble furniture?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we offer a dismantle-move-reassemble service. Book dismantling and reassembly together for a combined rate." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Furniture Dismantling Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Furniture Dismantling Singapore</div>
    <h1><em>Furniture Dismantling</em><br/>Done Right in Singapore</h1>
    <p class="hero-desc">Moving, renovating, or clearing out? We dismantle wardrobes, beds, shelves and all furniture carefully for transport or disposal. Safe, fast, island-wide.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>What We Dismantle</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🚪</div><h3>Wardrobes</h3><p>All wardrobe types — sliding door, hinged, PAX systems, built-ins and carpentry.</p></div>
        <div class="service-card"><div class="service-card-icon">🛏️</div><h3>Bed Frames</h3><p>All bed types including storage beds, bunk beds, and upholstered frames.</p></div>
        <div class="service-card"><div class="service-card-icon">📚</div><h3>Shelving & Cabinets</h3><p>BILLY, KALLAX, TV consoles, display cabinets and all shelving systems.</p></div>
        <div class="service-card"><div class="service-card-icon">🪑</div><h3>Dining & Desk Sets</h3><p>Dining tables, desks, study tables and workstations — all brands.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Pricing Guide</h2>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">Standard wardrobe (dismantling)</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">Large wardrobe / PAX system</span><span class="pricing-price">from $100</span></div>
        <div class="pricing-row"><span class="pricing-item">Bed frame (queen/king)</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">Storage bed with drawers</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Shelving unit (BILLY, KALLAX)</span><span class="pricing-price">from $50</span></div>
        <div class="pricing-row"><span class="pricing-item">Dining table & chairs (set)</span><span class="pricing-price">from $60</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">How much does furniture dismantling cost in Singapore?</div><div class="faq-a">Furniture dismantling starts from $50 per item. A wardrobe is typically $60–$120. Get an exact quote at tmginstall.com/estimate.</div></div>
      <div class="faq-item"><div class="faq-q">Can you dismantle and then reassemble at a new location?</div><div class="faq-a">Yes — this is one of our most popular services. We dismantle at your current location and reassemble at the new address. Book both together for a bundled rate.</div></div>
      <div class="faq-item"><div class="faq-q">Do you dispose of the furniture after dismantling?</div><div class="faq-a">We focus on dismantling — disposal and bulky waste arrangements are separate. However, we can refer you to reputable disposal partners.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Book Your Dismantling Job</h2>
        <p>Instant quote — no phone calls needed.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Furniture Dismantling" });
}

/* ── Office Furniture Installation ─────────────────────────────────────────── */
export function officeFurniturePage(): string {
  const title = "Office Furniture Installation Singapore | TMG Install";
  const description = "Professional office furniture installation in Singapore. Workstations, ergonomic chairs, standing desks, storage systems and full office fit-outs. CBD and island-wide coverage.";
  const canonical = `${DOMAIN}/services/office-furniture-installation-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Office Furniture Installation Singapore",
      "serviceType": "Office Furniture Installation",
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Do you do office furniture installation in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — TMG Install handles all office furniture including workstations, ergonomic chairs, standing desks, cabinets and full office fit-outs. We cover CBD and all Singapore locations." } },
        { "@type": "Question", "name": "Can you handle large office fit-outs?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we can deploy multiple teams to complete large office fit-outs efficiently. Contact us via WhatsApp to discuss your project scope and timeline." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Office Furniture Installation Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Office Furniture Installation</div>
    <h1><em>Office Furniture</em><br/>Installation Singapore</h1>
    <p class="hero-desc">Workstations, ergonomic chairs, standing desks, storage systems, and full office fit-outs. Fast, professional, CBD and island-wide.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp for Office Projects</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>Office Services We Provide</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">💼</div><h3>Workstation Installation</h3><p>L-shape desks, benching systems, hot-desking setups and call centre configurations.</p></div>
        <div class="service-card"><div class="service-card-icon">🪑</div><h3>Ergonomic Chairs</h3><p>Herman Miller, Secretlab, Ergotune, Haworth, and all ergonomic chair brands assembled and adjusted.</p></div>
        <div class="service-card"><div class="service-card-icon">📐</div><h3>Standing Desks</h3><p>Electric height-adjustable desks from Flexispot, Omnidesk, IKEA and all brands.</p></div>
        <div class="service-card"><div class="service-card-icon">🗄️</div><h3>Filing & Storage</h3><p>Cabinets, lateral files, lockers, server room furniture and open shelving.</p></div>
        <div class="service-card"><div class="service-card-icon">🏢</div><h3>Full Office Fit-Outs</h3><p>End-to-end installation for new office spaces — we handle all furniture categories in one visit.</p></div>
        <div class="service-card"><div class="service-card-icon">🔧</div><h3>Dismantle & Relocate</h3><p>Office decommissioning and relocation — we dismantle at your old office and reinstall at the new one.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Why Choose TMG Install for Office Work?</h2>
      <h3>Multi-Team Deployments</h3>
      <p>Large office projects can be completed quickly with multiple teams working simultaneously. We've completed full floor fit-outs in a single working day.</p>
      <h3>After-Hours Availability</h3>
      <p>We can work evenings and weekends to minimise disruption to your business operations. Discuss your schedule requirements when booking.</p>
      <h3>CBD Specialists</h3>
      <p>We regularly install in Raffles Place, Marina Bay, Tanjong Pagar, One-North, Orchard and all Singapore business districts.</p>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">Do you handle large office fit-outs?</div><div class="faq-a">Yes — we can deploy multiple teams simultaneously for large projects. WhatsApp us with your headcount and timeline to discuss.</div></div>
      <div class="faq-item"><div class="faq-q">Can you install ergonomic chairs?</div><div class="faq-a">Yes — all brands including Herman Miller Aeron/Embody, Secretlab Titan, Ergotune Supreme, Haworth, Steelcase and more.</div></div>
      <div class="faq-item"><div class="faq-q">Do you work in CBD office buildings?</div><div class="faq-a">Yes — we regularly work in Raffles Place, Marina Bay Financial Centre, Tanjong Pagar Plaza, One Raffles Quay and all Singapore business districts.</div></div>
      <div class="faq-item"><div class="faq-q">Can you work outside office hours?</div><div class="faq-a">Yes — we offer evening and weekend slots for office fit-outs to minimise disruption to your team.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Plan Your Office Installation</h2>
        <p>Get a quote or WhatsApp us to discuss your office project.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Office Furniture Installation" });
}

/* ── Furniture Relocation ───────────────────────────────────────────────────── */
export function furnitureRelocationPage(): string {
  const title = "Furniture Relocation Singapore | TMG Install — Dismantle & Reinstall";
  const description = "Professional furniture relocation in Singapore. We dismantle, transport-ready, and reinstall your furniture at your new address. All furniture types, island-wide coverage.";
  const canonical = `${DOMAIN}/services/furniture-relocation-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Furniture Relocation Singapore",
      "serviceType": "Furniture Relocation",
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Furniture Relocation Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Furniture Relocation Singapore</div>
    <h1><em>Furniture Relocation</em><br/>Dismantle & Reinstall</h1>
    <p class="hero-desc">Moving home or office? We dismantle your furniture at the old location and reinstall it properly at the new one. Island-wide, all furniture types.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>How It Works</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">📋</div><h3>1. Get a Quote</h3><p>Tell us what furniture needs to be relocated. Get an itemised price instantly — no phone calls needed.</p></div>
        <div class="service-card"><div class="service-card-icon">🔧</div><h3>2. We Dismantle</h3><p>Our team disassembles your furniture carefully at the current location, protecting all parts and hardware.</p></div>
        <div class="service-card"><div class="service-card-icon">🚛</div><h3>3. You Transport</h3><p>Your mover or logistics partner transports the dismantled pieces to the new location.</p></div>
        <div class="service-card"><div class="service-card-icon">✅</div><h3>4. We Reinstall</h3><p>We reassemble and install everything properly at the new address — wall-secured where needed.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Furniture We Relocate</h2>
      <ul>
        <li>Wardrobes and PAX systems — dismantled, reassembled and wall-secured at new location</li>
        <li>Bed frames — all types including storage and upholstered beds</li>
        <li>Shelving and cabinets — BILLY, KALLAX, display units</li>
        <li>Office workstations and ergonomic chairs</li>
        <li>Dining sets and desks</li>
        <li>Children's beds and bunk beds</li>
      </ul>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">Do you provide transport for furniture relocation?</div><div class="faq-a">We specialise in the dismantling and reinstallation — we work alongside your moving company or can recommend transport partners. WhatsApp us for combined packages.</div></div>
      <div class="faq-item"><div class="faq-q">Will my furniture survive dismantling and reassembly?</div><div class="faq-a">For most flat-pack furniture (IKEA, etc.), yes — these are designed to be dismantled and reassembled. Solid wood and carpentry furniture may need case-by-case assessment.</div></div>
      <div class="faq-item"><div class="faq-q">Can you do same-day dismantle and reinstall?</div><div class="faq-a">Yes — if both addresses are in Singapore and the transport timing allows, we can complete the full service in a single day.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Plan Your Furniture Move</h2>
        <p>Get an instant quote for dismantling and reinstallation.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Furniture Relocation" });
}

/* ── TV Mounting ─────────────────────────────────────────────────────────────── */
export function tvMountingPage(): string {
  const title = "TV Mounting Singapore | Wall Mount Installation — From $80 | TMG Install";
  const description = "Professional TV wall mounting in Singapore. All wall types including HDB concrete, timber stud, plasterboard. Cable concealment, gallery brackets, 65\"-85\" TVs. Instant quote.";
  const canonical = `${DOMAIN}/services/tv-mounting-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "TV Mounting Singapore",
      "serviceType": "TV Wall Mounting",
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "price": "80" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much does TV mounting cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "TV wall mounting in Singapore starts from $80 for a standard fixed bracket. Tilting brackets start from $100, full-motion/articulating arms from $130. Cable concealment (in-wall or cable duct) is an add-on from $40. Get an instant itemised quote at tmginstall.com/estimate." } },
        { "@type": "Question", "name": "Can you mount a TV on HDB concrete walls?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we mount TVs on all wall types including HDB reinforced concrete, brick, timber stud, and plasterboard/drywall. We use the correct anchors and fixings for each wall type to ensure maximum safety." } },
        { "@type": "Question", "name": "Do you hide the cables after mounting?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. We offer cable management solutions including surface cable ducts (raceways) and in-wall cable concealment. In-wall concealment gives a completely clean look with no visible cables." } },
        { "@type": "Question", "name": "What size TVs do you mount?", "acceptedAnswer": { "@type": "Answer", "text": "We mount all TV sizes from 32\" to 85\"+. For very large TVs (75\"+) we always recommend a full-motion or heavy-duty fixed bracket for maximum stability." } },
        { "@type": "Question", "name": "Is the bracket included in the price?", "acceptedAnswer": { "@type": "Answer", "text": "Our pricing is for labour only. You can supply your own bracket or we can supply one — just let us know when you request a quote and we'll add the bracket cost." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "TV Mounting Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">TV Mounting Singapore</div>
    <h1>Professional <em>TV Wall Mounting</em><br/>in Singapore</h1>
    <p class="hero-desc">All wall types, all TV sizes, cable management included. Fixed, tilting, and full-motion mounts — safely installed by experienced professionals.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>TV Mounting Services</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">📺</div><h3>Fixed Bracket Mount</h3><p>Flat against the wall — ideal for TVs viewed straight-on. Clean, low-profile look. Most popular for living rooms and bedrooms.</p></div>
        <div class="service-card"><div class="service-card-icon">📐</div><h3>Tilting Bracket</h3><p>Angle the TV downward — great for high wall mounts in bedrooms or above fireplaces. Reduces neck strain.</p></div>
        <div class="service-card"><div class="service-card-icon">🔄</div><h3>Full-Motion / Articulating Arm</h3><p>Extend, swivel and tilt freely. Perfect for corner installations or rooms where the viewing angle changes.</p></div>
        <div class="service-card"><div class="service-card-icon">🧱</div><h3>All Wall Types</h3><p>HDB concrete, brick, timber stud, plasterboard / drywall — we use the correct fixings for every wall type.</p></div>
        <div class="service-card"><div class="service-card-icon">🔌</div><h3>Cable Management</h3><p>Surface cable ducts or in-wall cable concealment for a completely clean, wire-free finish.</p></div>
        <div class="service-card"><div class="service-card-icon">🖥️</div><h3>Large Format TVs</h3><p>65", 75", 85"+ TVs mounted safely with heavy-duty brackets and concrete anchors where required.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Pricing Guide</h2>
      <p>Labour pricing per TV. Brackets can be supplied or you can provide your own. <a href="${CTA_URL}" style="color:#3b82f6;font-weight:600;">Get an instant quote</a> for your exact setup.</p>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">Fixed Bracket — up to 55"</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Fixed Bracket — 56" to 75"</span><span class="pricing-price">from $100</span></div>
        <div class="pricing-row"><span class="pricing-item">Fixed Bracket — 76"+ / Heavy Duty</span><span class="pricing-price">from $130</span></div>
        <div class="pricing-row"><span class="pricing-item">Tilting Bracket (any size)</span><span class="pricing-price">from $100</span></div>
        <div class="pricing-row"><span class="pricing-item">Full-Motion / Articulating Arm</span><span class="pricing-price">from $130</span></div>
        <div class="pricing-row"><span class="pricing-item">Cable Duct / Raceway Management</span><span class="pricing-price">from $40</span></div>
        <div class="pricing-row"><span class="pricing-item">In-Wall Cable Concealment</span><span class="pricing-price">from $120</span></div>
        <div class="pricing-row"><span class="pricing-item">Soundbar Mounting (below TV)</span><span class="pricing-price">from $50</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Why TMG Install for TV Mounting?</h2>
      <h3>Wall Type Expertise</h3>
      <p>Singapore homes include HDB concrete walls, timber stud partitions, and plasterboard feature walls. We correctly identify your wall type and use the appropriate anchors — chemical anchors for concrete, stud-mounted hardware for timber, and toggle bolts for plasterboard. This is critical for safety, especially for large heavy TVs.</p>
      <h3>Weight-Rated Every Time</h3>
      <p>Every bracket and anchor we use is rated well above your TV's weight. We do not improvise. If a wall is unsuitable for a heavy TV, we'll tell you and suggest the correct solution before starting work.</p>
      <h3>No Mess, No Dust Left Behind</h3>
      <p>We vacuum all drilling dust and clean the area before leaving. Your TV is up, your wall is clean, your cables are managed.</p>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">How much does TV mounting cost in Singapore?</div><div class="faq-a">TV wall mounting starts from $80 for a standard fixed bracket. Tilting mounts from $100, full-motion articulating arms from $130. Cable concealment is an add-on. Get an itemised quote at tmginstall.com/estimate.</div></div>
      <div class="faq-item"><div class="faq-q">Can you mount a TV on HDB concrete walls?</div><div class="faq-a">Yes — we drill and anchor into HDB reinforced concrete using the correct chemical or mechanical anchors. We cover all wall types: concrete, brick, timber stud, and plasterboard.</div></div>
      <div class="faq-item"><div class="faq-q">Do you hide the cables after mounting?</div><div class="faq-a">Yes. We offer surface cable ducts (raceways) that neatly conceal cables along the wall, or in-wall cable management for a completely clean look with no visible wiring.</div></div>
      <div class="faq-item"><div class="faq-q">Is the TV bracket included in the price?</div><div class="faq-a">Our quoted price is for labour. You can supply your own bracket or we can supply one — just mention it when you request a quote and we'll add it to your itemised price.</div></div>
      <div class="faq-item"><div class="faq-q">How long does TV mounting take?</div><div class="faq-a">A standard fixed bracket installation takes 30–45 minutes. Add 20–30 minutes for cable management. We're done and cleaning up within an hour in most cases.</div></div>
      <div class="faq-item"><div class="faq-q">Is same-day TV mounting available in Singapore?</div><div class="faq-a">Yes, subject to availability. Book early and select your preferred time slot — we offer morning, afternoon and evening appointments island-wide.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Get Your TV Mounted Today</h2>
        <p>Instant quote, no phone call needed. Choose your date and we'll be there.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "TV Mounting Singapore" });
}

/* ── Sofa Assembly ───────────────────────────────────────────────────────────── */
export function sofaAssemblyPage(): string {
  const title = "Sofa Assembly Singapore | Sectional & Modular Sofa Installation — TMG Install";
  const description = "Professional sofa assembly in Singapore. Sectional sofas, modular seating, sofa beds, L-shaped and U-shaped lounges. All brands — IKEA, Castlery, HipVan, courts, and more. Instant quote.";
  const canonical = `${DOMAIN}/services/sofa-assembly-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Sofa Assembly Singapore",
      "serviceType": "Furniture Assembly",
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "price": "60" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much does sofa assembly cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Sofa assembly in Singapore starts from $60 for a simple 2-seater. Sectional and modular sofas with multiple modules typically cost $100–$200 depending on configuration. Get an instant itemised quote at tmginstall.com/estimate." } },
        { "@type": "Question", "name": "Do you assemble sectional and modular sofas?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — sectional sofas are our most common sofa job. We assemble all configurations including L-shape, U-shape, chaise, and modular systems. We connect all sections, attach legs, and ensure the seating is level and stable." } },
        { "@type": "Question", "name": "Which sofa brands do you assemble?", "acceptedAnswer": { "@type": "Answer", "text": "We assemble all brands including IKEA (KIVIK, SÖDERHAMN, GRONLID), Castlery, HipVan, Comfort Design, Harvey Norman, Courts, Cellini, Commune, and more." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Sofa Assembly Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Sofa Assembly Singapore</div>
    <h1>Professional <em>Sofa Assembly</em><br/>in Singapore</h1>
    <p class="hero-desc">Sectional sofas, modular seating, sofa beds and all living room furniture assembled correctly. All brands, island-wide, same-day available.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>What We Assemble</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🛋️</div><h3>Sectional Sofas</h3><p>L-shape, U-shape, chaise configurations — all sections connected, legs attached, fully level and stable.</p></div>
        <div class="service-card"><div class="service-card-icon">🔲</div><h3>Modular Seating</h3><p>IKEA SÖDERHAMN, Castlery modular ranges, and all multi-module configurations assembled and arranged to your layout.</p></div>
        <div class="service-card"><div class="service-card-icon">🛏️</div><h3>Sofa Beds</h3><p>All sofa-bed mechanisms — pull-out, click-clack, and sleeper configurations. We test the mechanism and ensure smooth operation.</p></div>
        <div class="service-card"><div class="service-card-icon">🪑</div><h3>Accent Chairs & Recliners</h3><p>Armchairs, accent chairs, recliner sofas and swivel chairs assembled correctly.</p></div>
        <div class="service-card"><div class="service-card-icon">📦</div><h3>All Brands</h3><p>IKEA, Castlery, HipVan, Harvey Norman, Courts, Comfort Design, Cellini, Commune, and any other brand.</p></div>
        <div class="service-card"><div class="service-card-icon">📍</div><h3>Placement & Arrangement</h3><p>We place the sofa exactly where you want it, arrange all sections, and remove all packaging.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Pricing Guide</h2>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">2-Seater / 3-Seater Sofa</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">L-Shape Sectional Sofa</span><span class="pricing-price">from $100</span></div>
        <div class="pricing-row"><span class="pricing-item">U-Shape Sectional Sofa</span><span class="pricing-price">from $150</span></div>
        <div class="pricing-row"><span class="pricing-item">Modular Sofa (4+ modules)</span><span class="pricing-price">from $120</span></div>
        <div class="pricing-row"><span class="pricing-item">Sofa Bed</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Accent Chair / Recliner</span><span class="pricing-price">from $50</span></div>
        <div class="pricing-row"><span class="pricing-item">IKEA KIVIK / SÖDERHAMN</span><span class="pricing-price">from $80</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Why Choose TMG Install?</h2>
      <h3>Sectional Sofa Specialists</h3>
      <p>Sectional sofas are deceptively complex — modules need to align perfectly, connectors must engage correctly, and legs need to be evenly balanced. Our team knows exactly how to handle multi-module systems for every major brand.</p>
      <h3>Packaging Removal Included</h3>
      <p>We break down and remove all cardboard and plastic packaging. Your living room is clean and ready to enjoy when we leave.</p>
      <h3>Upfront Pricing, No Surprises</h3>
      <p>The price you see when you get a quote is the price you pay. No hourly rates, no "it took longer than expected" charges.</p>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">How much does sofa assembly cost in Singapore?</div><div class="faq-a">Sofa assembly starts from $60 for a standard sofa. Sectional and L-shaped sofas are $100–$150. Large U-shaped configurations or modular systems with many modules start from $150. Get an instant quote at tmginstall.com/estimate.</div></div>
      <div class="faq-item"><div class="faq-q">Do you assemble IKEA sofas?</div><div class="faq-a">Yes — we assemble all IKEA sofa ranges including KIVIK, SÖDERHAMN, GRONLID, EKTORP, KLIPPAN, FRIHETEN sofa-bed, and the full VALLENTUNA modular system.</div></div>
      <div class="faq-item"><div class="faq-q">Can you assemble a Castlery sectional sofa?</div><div class="faq-a">Yes — Castlery sofas are one of the brands we assemble most often. All Castlery sectional, modular, and standard sofas.</div></div>
      <div class="faq-item"><div class="faq-q">How long does sofa assembly take?</div><div class="faq-a">A standard 3-seater takes 30–45 minutes. An L-shaped sectional takes 45–75 minutes. Large U-shaped or highly modular systems can take up to 2 hours.</div></div>
      <div class="faq-item"><div class="faq-q">Do you remove the packaging?</div><div class="faq-a">Yes — we break down all cardboard boxes, remove plastic wrapping, and leave your home clean. Packaging disposal is included.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Get Your Sofa Assembled Today</h2>
        <p>Island-wide same-day available. Instant itemised quote — no phone call needed.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Sofa Assembly Singapore" });
}

/* ── Mattress Installation ────────────────────────────────────────────────────── */
export function mattressInstallationPage(): string {
  const title = "Mattress Delivery & Setup Singapore | Disposal & Installation — TMG Install";
  const description = "Professional mattress delivery setup and old mattress disposal in Singapore. Unboxing, bed-in-a-box expansion, placement, and licensed disposal of old mattresses. Island-wide service.";
  const canonical = `${DOMAIN}/services/mattress-installation-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Mattress Delivery Setup Singapore",
      "serviceType": "Mattress Installation & Disposal",
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "price": "50" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much does mattress disposal cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Old mattress disposal in Singapore starts from $60 per mattress. This includes collection from your home and licensed disposal. Combined with new mattress setup from $50. Get an instant quote at tmginstall.com/estimate." } },
        { "@type": "Question", "name": "Do you set up bed-in-a-box mattresses?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we unbox, unroll, and position bed-in-a-box mattresses (Emma, Noa, King Koil, Sealy, Simmons and others) on your bed frame. We allow expansion time and remove all packaging." } },
        { "@type": "Question", "name": "Can you dispose of my old mattress?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we collect your old mattress and dispose of it through licensed waste management channels. We handle single, queen, and king size mattresses." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Mattress Installation Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Mattress Setup & Disposal Singapore</div>
    <h1><em>Mattress Setup</em> &amp;<br/>Old Mattress Disposal</h1>
    <p class="hero-desc">New mattress unboxing and setup, bed-in-a-box placement, old mattress collection and licensed disposal. Island-wide, same-day available.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>What We Do</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">📦</div><h3>New Mattress Setup</h3><p>Unbox, remove packaging, position on your bed frame. Single, Queen, King — all sizes handled.</p></div>
        <div class="service-card"><div class="service-card-icon">🌀</div><h3>Bed-in-a-Box Setup</h3><p>Unroll and expand compressed roll-up mattresses (Emma, Noa, King Koil, Sealy, Simmons and more). We allow full expansion time on-site.</p></div>
        <div class="service-card"><div class="service-card-icon">🗑️</div><h3>Old Mattress Disposal</h3><p>We collect and dispose of your old mattress through licensed waste management. No need to carry it downstairs yourself.</p></div>
        <div class="service-card"><div class="service-card-icon">🛏️</div><h3>Bed Frame + Mattress Combo</h3><p>Assemble the bed frame and set up the new mattress in one visit. Most efficient and cost-effective option.</p></div>
        <div class="service-card"><div class="service-card-icon">🏠</div><h3>HDB & Condo Access</h3><p>We handle lift access, narrow corridors, and all standard Singapore residential environments including older HDB flats with narrow stairwells.</p></div>
        <div class="service-card"><div class="service-card-icon">♻️</div><h3>Responsible Disposal</h3><p>Old mattresses are disposed of through licensed channels in compliance with Singapore NEA regulations.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Pricing Guide</h2>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">New Mattress Setup (Single / Super Single)</span><span class="pricing-price">from $50</span></div>
        <div class="pricing-row"><span class="pricing-item">New Mattress Setup (Queen)</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">New Mattress Setup (King)</span><span class="pricing-price">from $70</span></div>
        <div class="pricing-row"><span class="pricing-item">Old Mattress Disposal (Single)</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">Old Mattress Disposal (Queen / King)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Bed Frame Assembly + Mattress Setup</span><span class="pricing-price">from $130</span></div>
        <div class="pricing-row"><span class="pricing-item">Full Package (New Setup + Old Disposal)</span><span class="pricing-price">from $120</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">How much does mattress disposal cost in Singapore?</div><div class="faq-a">Old mattress disposal starts from $60 for a single and $80 for a queen or king. This includes collection from your home and licensed disposal. Bundle with new mattress setup for the best price.</div></div>
      <div class="faq-item"><div class="faq-q">Do you set up bed-in-a-box / roll-up mattresses?</div><div class="faq-a">Yes — we unbox, cut the packaging, unroll, and position compressed mattresses. Brands we regularly handle include Emma, Noa, King Koil, Sealy, Simmons, and all other roll-up formats.</div></div>
      <div class="faq-item"><div class="faq-q">Can you collect and dispose of my old mattress?</div><div class="faq-a">Yes — we collect and remove old mattresses as part of a full swap-out service. Old mattresses are disposed of through licensed waste management channels.</div></div>
      <div class="faq-item"><div class="faq-q">Can you do the bed frame assembly and mattress setup together?</div><div class="faq-a">Yes — this is the most efficient approach. We assemble the bed frame first and then set up the new mattress in a single visit. You get a discounted combined rate.</div></div>
      <div class="faq-item"><div class="faq-q">Is same-day mattress setup available?</div><div class="faq-a">Yes, subject to availability. Select your preferred date when requesting a quote — we have morning, afternoon, and evening slots island-wide.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>New Mattress Arriving? We'll Handle It</h2>
        <p>Setup, old mattress removal, bed frame assembly — all in one visit. Get an instant quote now.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Mattress Setup & Disposal" });
}

/* ── Services Hub ────────────────────────────────────────────────────────────── */
export function servicesHubPage(): string {
  const title = "Furniture Installation Services Singapore | TMG Install";
  const description = "Singapore's furniture installation specialists. IKEA assembly, wardrobe installation, bed assembly, office fit-outs, dismantling and relocation. Island-wide, instant upfront quotes.";
  const canonical = `${DOMAIN}/services`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "TMG Install Services",
      "url": canonical,
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "IKEA Assembly Singapore", "url": `${DOMAIN}/services/ikea-assembly-singapore` },
        { "@type": "ListItem", "position": 2, "name": "Wardrobe Installation Singapore", "url": `${DOMAIN}/services/wardrobe-installation-singapore` },
        { "@type": "ListItem", "position": 3, "name": "Bed Assembly Singapore", "url": `${DOMAIN}/services/bed-assembly-singapore` },
        { "@type": "ListItem", "position": 4, "name": "Furniture Dismantling Singapore", "url": `${DOMAIN}/services/furniture-dismantling-singapore` },
        { "@type": "ListItem", "position": 5, "name": "Office Furniture Installation Singapore", "url": `${DOMAIN}/services/office-furniture-installation-singapore` },
        { "@type": "ListItem", "position": 6, "name": "Furniture Relocation Singapore", "url": `${DOMAIN}/services/furniture-relocation-singapore` },
        { "@type": "ListItem", "position": 7, "name": "TV Mounting Singapore", "url": `${DOMAIN}/services/tv-mounting-singapore` },
        { "@type": "ListItem", "position": 8, "name": "Sofa Assembly Singapore", "url": `${DOMAIN}/services/sofa-assembly-singapore` },
        { "@type": "ListItem", "position": 9, "name": "Mattress Setup & Disposal Singapore", "url": `${DOMAIN}/services/mattress-installation-singapore` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Singapore Furniture Installation</div>
    <h1><em>Professional Furniture</em><br/>Installation Services</h1>
    <p class="hero-desc">Everything from a single IKEA shelf to a full office fit-out. Transparent upfront pricing, experienced team, island-wide coverage.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>Our Services</h2>
      <div class="service-grid">
        <a href="/services/ikea-assembly-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🛍️</div>
          <h3>IKEA Assembly</h3>
          <p>All IKEA flat-pack furniture — PAX wardrobes, BILLY shelves, MALM beds and more. From $60.</p>
        </a>
        <a href="/services/wardrobe-installation-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🚪</div>
          <h3>Wardrobe Installation</h3>
          <p>Sliding door wardrobes, built-ins, PAX systems. Fully secured. From $80.</p>
        </a>
        <a href="/services/bed-assembly-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🛏️</div>
          <h3>Bed Assembly</h3>
          <p>All bed types — IKEA, Castlery, storage beds, bunk beds. From $80.</p>
        </a>
        <a href="/services/furniture-dismantling-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🔧</div>
          <h3>Furniture Dismantling</h3>
          <p>Safe disassembly before moving or disposal. All brands. From $50.</p>
        </a>
        <a href="/services/office-furniture-installation-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">💼</div>
          <h3>Office Furniture</h3>
          <p>Workstations, ergonomic chairs, standing desks, full office fit-outs.</p>
        </a>
        <a href="/services/furniture-relocation-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🚛</div>
          <h3>Furniture Relocation</h3>
          <p>Dismantle at old address, reinstall at new address. Island-wide.</p>
        </a>
        <a href="/services/tv-mounting-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">📺</div>
          <h3>TV Wall Mounting</h3>
          <p>Fixed, tilting, full-motion brackets. All wall types. Cable management. From $80.</p>
        </a>
        <a href="/services/sofa-assembly-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🛋️</div>
          <h3>Sofa Assembly</h3>
          <p>Sectional, modular, sofa-beds. IKEA, Castlery, HipVan and all brands. From $60.</p>
        </a>
        <a href="/services/mattress-installation-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🛏️</div>
          <h3>Mattress Setup & Disposal</h3>
          <p>New mattress unboxing, bed-in-a-box setup, old mattress disposal. From $50.</p>
        </a>
        <a href="/services/taobao-furniture-installation-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">📦</div>
          <h3>Taobao Furniture Installation</h3>
          <p>Assembly, dismantle and relocation for Taobao-shipped furniture. Chinese manuals welcome.</p>
        </a>
        <a href="/services/castlery-furniture-assembly-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🛋️</div>
          <h3>Castlery Furniture Assembly</h3>
          <p>Adams, Madison, Auburn — modular sofas, bed frames, dining tables assembled and wall-fixed.</p>
        </a>
        <a href="/services/lazada-furniture-installation-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🛒</div>
          <h3>Lazada Furniture Installation</h3>
          <p>Wardrobes, beds, desks, sofas from Lazada — assembled with parts inventory check.</p>
        </a>
        <a href="/services/shopee-furniture-installation-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🛍️</div>
          <h3>Shopee Furniture Installation</h3>
          <p>Shopee furniture assembled even when instructions are missing. Same fixed-price catalog.</p>
        </a>
        <a href="/services/hdb-moving-services-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🏠</div>
          <h3>HDB Moving Services</h3>
          <p>Whole-house HDB moves — dismantle, transport, reassemble in one day. From $600.</p>
        </a>
        <a href="/services/condo-moving-services-singapore" class="service-card" style="display:block;">
          <div class="service-card-icon">🏢</div>
          <h3>Condo Moving Services</h3>
          <p>MCST-compliant condo moves — COI supplied, lift padding, security check-in handled.</p>
        </a>
      </div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Get an Instant Quote</h2>
        <p>Select your items, get an itemised price, and book in under 2 minutes.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Start Your Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Services" });
}

/* ── Taobao Furniture Installation ───────────────────────────────────────────── */
export function taobaoFurnitureInstallationPage(): string {
  const title = "Taobao Furniture Installation Singapore | Assembly · Dismantle · Relocation | TMG Install";
  const description = "Got Taobao furniture delivered to Singapore? We assemble, install, dismantle and relocate Taobao furniture island-wide. Wardrobes, bed frames, desks, sofas, cabinets — instant fixed-price quote. Book online in 60 seconds.";
  const canonical = `${DOMAIN}/services/taobao-furniture-installation-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Taobao Furniture Installation Singapore",
      "serviceType": [
        "Taobao Furniture Installation",
        "Taobao Furniture Assembly",
        "Taobao Furniture Dismantling",
        "Taobao Furniture Relocation",
      ],
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": {
        "@type": "Offer",
        "priceCurrency": "SGD",
        "description": "Fixed-price catalog of 250+ furniture items — instant upfront quote with no hidden fees.",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Taobao Furniture Installation Singapore", "item": canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Do you install Taobao furniture in Singapore?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes — TMG Install is Singapore's go-to team for Taobao (淘宝) furniture installation. We handle wardrobes, bed frames, desks, sofas, cabinets, dining sets and more, regardless of brand or seller. Bring the parts and any instructions you have, and we'll assemble it correctly the first time." },
        },
        {
          "@type": "Question",
          "name": "Can you assemble Taobao furniture without instructions?",
          "acceptedAnswer": { "@type": "Answer", "text": "In most cases yes. Our installers are experienced with Chinese-language and pictogram-only manuals. If a manual is missing entirely we work from the parts and any photos you have. Send us photos via WhatsApp before booking so we can confirm." },
        },
        {
          "@type": "Question",
          "name": "How much does Taobao furniture installation cost in Singapore?",
          "acceptedAnswer": { "@type": "Answer", "text": "Pricing follows our standard fixed-price catalog — wardrobes from S$120, bed frames from S$80, desks and tables from S$50. Add your items in our quote tool to get an itemised, all-in price upfront with no hidden fees." },
        },
        {
          "@type": "Question",
          "name": "Do you also dismantle Taobao furniture for relocation or disposal?",
          "acceptedAnswer": { "@type": "Answer", "text": "Yes. We dismantle Taobao furniture for moves (and reinstall at the new address) or for disposal. We can also arrange disposal of unwanted parts after assembly." },
        },
        {
          "@type": "Question",
          "name": "Can you handle delivery from the warehouse to my home?",
          "acceptedAnswer": { "@type": "Answer", "text": "We focus on the assembly and installation. For Taobao shipments arriving at consolidator warehouses, we work with trusted last-mile delivery partners and can recommend one if needed — WhatsApp us for combined packages." },
        },
        {
          "@type": "Question",
          "name": "What areas in Singapore do you cover?",
          "acceptedAnswer": { "@type": "Answer", "text": "Island-wide — HDB, condo, landed and commercial properties across all estates." },
        },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Taobao Furniture Installation Singapore</div>
    <h1><em>Taobao Furniture</em><br/>Installation, Dismantle &amp; Relocation</h1>
    <p class="hero-desc">Bought your wardrobe, bed frame or desk from Taobao? We assemble, install, dismantle and relocate Taobao furniture across Singapore — fixed prices, no hidden fees, instant online quote.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>Singapore's Taobao Furniture Specialists</h2>
      <p>Taobao (淘宝) is one of the most popular ways for Singapore buyers to source affordable furniture — wardrobes, bed frames, sofas, dining sets, desks, shelving and TV consoles. The catch: most Taobao furniture arrives flat-packed with Chinese-language instructions and proprietary fittings, which makes self-assembly slow and risky.</p>
      <p>TMG Install is the team Singapore homeowners and property agents call when their Taobao shipment lands. We assemble, install, dismantle and relocate Taobao furniture island-wide, with the same fixed-price catalog and instant upfront quote we use for everything else. No phone calls, no surprise add-ons.</p>
    </div>

    <div class="section">
      <h2>What We Do With Your Taobao Furniture</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🪛</div><h3>Assembly &amp; Installation</h3><p>Wardrobes, bed frames, desks, dining sets, sofas, shelving — assembled correctly the first time, with wall-fixings where needed.</p></div>
        <div class="service-card"><div class="service-card-icon">🔧</div><h3>Dismantling</h3><p>Moving out or replacing? We dismantle Taobao furniture cleanly for transport, reinstallation, or disposal.</p></div>
        <div class="service-card"><div class="service-card-icon">🚛</div><h3>Relocation</h3><p>Dismantle at the old address and reinstall at the new — coordinated with your mover, island-wide.</p></div>
        <div class="service-card"><div class="service-card-icon">♻️</div><h3>Disposal</h3><p>Old Taobao furniture you're replacing? We can dismantle and arrange proper disposal in one visit.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Common Taobao Furniture We Install</h2>
      <ul>
        <li>Wardrobes — sliding-door, swing-door, walk-in modular, kid's wardrobes</li>
        <li>Bed frames — storage beds, upholstered beds, tatami beds, bunk and loft beds</li>
        <li>Sofas — modular, L-shape, recliner, fabric and PU leather</li>
        <li>Dining sets — extendable tables, marble-top tables, dining chairs</li>
        <li>Desks &amp; office chairs — standing desks, ergonomic chairs, gaming setups</li>
        <li>Cabinets &amp; shelving — TV consoles, shoe cabinets, display cabinets, bookcases</li>
        <li>Children's furniture — bunk beds, study desks, toy storage</li>
        <li>Outdoor &amp; balcony furniture — rattan sets, outdoor sofas</li>
      </ul>
    </div>

    <div class="section">
      <h2>Why Singapore Customers Use TMG Install for Taobao Furniture</h2>
      <ul>
        <li><strong>Fixed-price quote upfront</strong> — we don't surcharge "Taobao" or "imported" furniture. Same 250+ item catalog, same prices.</li>
        <li><strong>Comfortable with Chinese-language manuals</strong> — pictogram-only or 中文 instructions are no problem for our team.</li>
        <li><strong>We bring the right tools</strong> — Allen keys, drills, spirit levels and HDB-friendly drill bits, every job.</li>
        <li><strong>Wall-fixed for safety</strong> — tall wardrobes and shelving are anchored to the wall to meet HDB safety norms.</li>
        <li><strong>Island-wide same-day availability</strong> — book before noon for same-day where slots allow.</li>
        <li><strong>Fully insured</strong> — we cover any damage during assembly or transport.</li>
      </ul>
    </div>

    <div class="section">
      <h2>How It Works</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">📋</div><h3>1. Get a Quote</h3><p>Add your Taobao items in our quote tool — pick the closest match (e.g. "wardrobe 4-door"). Itemised price in 60 seconds.</p></div>
        <div class="service-card"><div class="service-card-icon">📅</div><h3>2. Book a Slot</h3><p>Choose a 3-hour window. Same-day and weekend slots available island-wide.</p></div>
        <div class="service-card"><div class="service-card-icon">🪛</div><h3>3. We Install</h3><p>Our team arrives with full tools, assembles, wall-fixes, cleans up and disposes of all packaging.</p></div>
        <div class="service-card"><div class="service-card-icon">✅</div><h3>4. You Inspect</h3><p>Walk-through and sign-off — payment only after you're happy.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">Do you install Taobao furniture in Singapore?</div><div class="faq-a">Yes — TMG Install is Singapore's go-to team for Taobao (淘宝) furniture installation. We handle wardrobes, bed frames, desks, sofas, cabinets, dining sets and more, regardless of brand or seller.</div></div>
      <div class="faq-item"><div class="faq-q">Can you assemble Taobao furniture without instructions?</div><div class="faq-a">In most cases yes. Our installers are experienced with Chinese-language and pictogram-only manuals. If the manual is missing entirely we work from the parts and any photos you have. Send us photos via WhatsApp before booking so we can confirm.</div></div>
      <div class="faq-item"><div class="faq-q">How much does Taobao furniture installation cost?</div><div class="faq-a">Same fixed catalog as everything else — wardrobes from S$120, bed frames from S$80, desks and tables from S$50. Get an itemised price upfront in our quote tool.</div></div>
      <div class="faq-item"><div class="faq-q">Do you also dismantle Taobao furniture?</div><div class="faq-a">Yes — for moves (and reinstall at the new address) or for disposal. We can also arrange removal of unwanted parts after assembly.</div></div>
      <div class="faq-item"><div class="faq-q">Can you handle delivery from the warehouse?</div><div class="faq-a">We focus on assembly and installation. For shipments arriving at consolidator warehouses we work with trusted last-mile delivery partners and can recommend one — WhatsApp us for combined packages.</div></div>
      <div class="faq-item"><div class="faq-q">What areas do you cover?</div><div class="faq-a">Island-wide — HDB, condo, landed and commercial across all estates.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Get Your Taobao Furniture Installed</h2>
        <p>Instant fixed-price quote — no phone calls, no surprises. Book in 60 seconds.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Taobao Furniture Installation" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Castlery furniture assembly Singapore
// ─────────────────────────────────────────────────────────────────────────────
export function castleryFurnitureAssemblyPage(): string {
  const title = "Castlery Furniture Assembly Singapore | Sofa · Bed · Dining | TMG Install";
  const description = "Castlery sofa, bed frame or dining table delivered without assembly? TMG Install assembles, installs, dismantles and relocates Castlery furniture across Singapore — fixed price, instant quote, fully insured.";
  const canonical = `${DOMAIN}/services/castlery-furniture-assembly-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Castlery Furniture Assembly Singapore",
      "serviceType": [
        "Castlery Furniture Assembly",
        "Castlery Sofa Installation",
        "Castlery Bed Frame Assembly",
        "Castlery Dining Table Installation",
        "Castlery Furniture Dismantling",
        "Castlery Furniture Relocation",
      ],
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "description": "Fixed-price catalog covering Castlery sofas, beds, dining sets and storage." },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Castlery Furniture Assembly Singapore", "item": canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Do you assemble Castlery furniture in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we regularly assemble Castlery sofas, bed frames, dining tables, sideboards and TV consoles for customers across Singapore. Our team is familiar with Castlery's modular construction and proprietary fittings." } },
        { "@type": "Question", "name": "Castlery already includes delivery — why use TMG?", "acceptedAnswer": { "@type": "Answer", "text": "Castlery's standard delivery brings the boxes to your doorstep but doesn't always include in-room assembly, especially for flat-pack items, weekend slots or older orders. We assemble, place and wall-fix wherever needed, and dismantle / relocate when you move." } },
        { "@type": "Question", "name": "Can you dismantle a Castlery sofa for relocation?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — Castlery modular sofas (Adams, Madison, Auburn etc.) are designed to disconnect at the seams. We dismantle, transport and reinstall them at your new address, often within a single visit." } },
        { "@type": "Question", "name": "Do you install Castlery wall-mounted shelves and TV consoles?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we bring HDB-friendly drill bits, a stud finder and proper anchors for concrete and dry-wall partitions. Wall-mounted shelving and TV consoles are anchored safely with weight-rated fixings." } },
        { "@type": "Question", "name": "How much does Castlery furniture assembly cost?", "acceptedAnswer": { "@type": "Answer", "text": "Standard catalog pricing applies — sofas from S$120, bed frames from S$80, dining tables from S$60. Add your items in our quote tool for an itemised price upfront." } },
        { "@type": "Question", "name": "Do you cover all Singapore estates?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — island-wide HDB, condo and landed. Same-day slots available subject to availability." } },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Castlery Furniture Assembly Singapore</div>
    <h1><em>Castlery Furniture</em><br/>Assembly, Installation &amp; Relocation</h1>
    <p class="hero-desc">Castlery sofa, bed frame or dining table arrived flat-packed? We assemble, install, dismantle and relocate Castlery furniture across Singapore — fixed price, fully insured, instant quote.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">
    <div class="section">
      <h2>Singapore's Trusted Castlery Assembly Team</h2>
      <p>Castlery is one of Singapore's most popular contemporary furniture brands — known for the Adams sofa, Madison sectional, Auburn dining range, and modular bed frames. Most Castlery items arrive flat-packed for easy delivery into HDB lifts and condo passenger lifts, which means the customer is left to assemble.</p>
      <p>TMG Install is the team Singapore homeowners call when their Castlery delivery lands. We assemble, install, wall-fix, dismantle and relocate Castlery furniture island-wide, with the same fixed-price catalog and instant upfront quote we use for every brand. No phone calls, no surprise charges.</p>
    </div>

    <div class="section">
      <h2>What We Do With Your Castlery Furniture</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🛋️</div><h3>Sofa Assembly</h3><p>Adams, Madison, Auburn, Hudson — modular sectionals connected, levelled and placed exactly where you want them.</p></div>
        <div class="service-card"><div class="service-card-icon">🛏️</div><h3>Bed Frame Installation</h3><p>Storage beds, upholstered headboards, slat assemblies — properly fitted with corner reinforcement.</p></div>
        <div class="service-card"><div class="service-card-icon">🍽️</div><h3>Dining &amp; Storage</h3><p>Extending dining tables, sideboards, TV consoles, shelving — assembled level, safely wall-fixed where needed.</p></div>
        <div class="service-card"><div class="service-card-icon">🚛</div><h3>Relocation &amp; Dismantle</h3><p>Moving home? We dismantle Castlery modular pieces cleanly and reassemble them at the new address.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Common Castlery Items We Install</h2>
      <ul>
        <li><strong>Sofas</strong> — Adams, Madison, Auburn, Hudson, Anton, Selene (modular &amp; sectional)</li>
        <li><strong>Bed frames</strong> — storage beds, upholstered platform beds, slat-base frames</li>
        <li><strong>Dining tables</strong> — Auburn, Anton, Werner, extending and fixed-length</li>
        <li><strong>Storage</strong> — TV consoles, sideboards, shelving, display cabinets</li>
        <li><strong>Office</strong> — desks, ergonomic chairs, bookcases</li>
        <li><strong>Outdoor</strong> — Lana, Vista, Calvin (rattan and aluminium-frame)</li>
      </ul>
    </div>

    <div class="section">
      <h2>Why Singapore Customers Choose TMG for Castlery</h2>
      <ul>
        <li><strong>Familiar with Castlery's fittings</strong> — modular cam-locks, hidden brackets, slat clips. We've assembled hundreds.</li>
        <li><strong>Wall-fixed for safety</strong> — tall storage and TV consoles anchored to wall studs with weight-rated brackets.</li>
        <li><strong>Fixed-price upfront</strong> — no premium for "designer" furniture. Same catalog, same prices.</li>
        <li><strong>Same-day &amp; weekend slots</strong> — book before noon for same-day availability island-wide.</li>
        <li><strong>Insured &amp; clean</strong> — we cover any damage and remove all packaging waste.</li>
      </ul>
    </div>

    <div class="section">
      <h2>How It Works</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">📋</div><h3>1. Get a Quote</h3><p>Add your Castlery items in our quote tool. Itemised price in 60 seconds.</p></div>
        <div class="service-card"><div class="service-card-icon">📅</div><h3>2. Book a Slot</h3><p>Pick a 3-hour window — same-day, weekend or weekday.</p></div>
        <div class="service-card"><div class="service-card-icon">🪛</div><h3>3. We Install</h3><p>Team arrives with full tools, assembles, wall-fixes, places and cleans up packaging.</p></div>
        <div class="service-card"><div class="service-card-icon">✅</div><h3>4. You Inspect</h3><p>Walk-through and sign-off — payment only after you're happy.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">Do you assemble Castlery furniture in Singapore?</div><div class="faq-a">Yes — we regularly assemble Castlery sofas, bed frames, dining tables, sideboards and TV consoles for customers across Singapore. Our team knows Castlery's modular construction and proprietary fittings inside out.</div></div>
      <div class="faq-item"><div class="faq-q">Castlery already includes delivery — why use TMG?</div><div class="faq-a">Castlery's standard delivery brings the boxes to your doorstep but doesn't always include in-room assembly. We assemble, place and wall-fix wherever needed, plus we handle relocations later when you move.</div></div>
      <div class="faq-item"><div class="faq-q">Can you dismantle a Castlery modular sofa for relocation?</div><div class="faq-a">Yes — Castlery modular sofas are designed to disconnect at the seams. We dismantle, transport and reinstall them at the new address.</div></div>
      <div class="faq-item"><div class="faq-q">Do you wall-mount Castlery shelves and TV consoles?</div><div class="faq-a">Yes — with HDB-friendly drill bits, stud finder and weight-rated anchors for concrete or partition walls.</div></div>
      <div class="faq-item"><div class="faq-q">How much does it cost?</div><div class="faq-a">Standard catalog pricing — sofas from S$120, bed frames from S$80, dining from S$60. Get an itemised quote in our tool.</div></div>
      <div class="faq-item"><div class="faq-q">What areas do you cover?</div><div class="faq-a">Island-wide — HDB, condo, landed and commercial across all estates.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Get Your Castlery Furniture Assembled</h2>
        <p>Instant fixed-price quote — no phone calls, no surprises. Book in 60 seconds.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>
  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Castlery Furniture Assembly" });
}

// ─────────────────────────────────────────────────────────────────────────────
// HDB moving services Singapore
// ─────────────────────────────────────────────────────────────────────────────
export function hdbMovingServicesPage(): string {
  const title = "HDB Moving Services Singapore | Furniture Move + Reassembly | TMG Install";
  const description = "Moving HDB to HDB or HDB to condo? TMG Install dismantles, moves, and reassembles your furniture across Singapore — lift booking handled, fixed price, fully insured. Instant online quote.";
  const canonical = `${DOMAIN}/services/hdb-moving-services-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "HDB Moving Services Singapore",
      "serviceType": [
        "HDB Moving Services",
        "HDB Furniture Relocation",
        "HDB to HDB Move",
        "HDB to Condo Move",
        "HDB Furniture Dismantling",
        "HDB Furniture Reassembly",
      ],
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "description": "Fixed-price HDB moving — dismantle + transport + reassembly bundled per item." },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "HDB Moving Services Singapore", "item": canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much does an HDB move cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "HDB moves are priced per item using our fixed catalog — typical 3-room HDB moves run S$600–S$1,200 all-in (dismantle + transport + reassembly). Add your items to our quote tool for an exact upfront price." } },
        { "@type": "Question", "name": "Do you handle the lift booking with HDB town councils?", "acceptedAnswer": { "@type": "Answer", "text": "Most HDB blocks no longer require lift booking for residential moves, but if your town council does, we'll guide you through the form (typically S$30–S$50 deposit, refunded after the move). We coordinate timing so the lift is reserved when our truck arrives." } },
        { "@type": "Question", "name": "Will all my furniture fit in the HDB lift?", "acceptedAnswer": { "@type": "Answer", "text": "Most HDB lifts measure 2.0–2.4m wide × 1.4m deep × 2.4m tall. Bed frames, wardrobes and L-shape sofas are dismantled to fit. For oversized items in older blocks without service lifts, we use the staircase — included in the price for floors up to 4." } },
        { "@type": "Question", "name": "How long does an HDB move take?", "acceptedAnswer": { "@type": "Answer", "text": "A typical 3-room HDB move (whole-house) takes 5–7 hours start to finish. 4-room moves take 6–8 hours. We start at 9am or 1pm and complete the same day." } },
        { "@type": "Question", "name": "Do you reassemble at the new address?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — every item we dismantle is reassembled at your new address as part of the bundled price. Wardrobes are wall-fixed, bed slats reseated, sofa modules reconnected." } },
        { "@type": "Question", "name": "Do you supply boxes for clothes and kitchenware?", "acceptedAnswer": { "@type": "Answer", "text": "We focus on furniture dismantle + transport + reassembly. For boxes, we partner with trusted box suppliers — WhatsApp us and we'll bundle a recommendation." } },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">HDB Moving Services Singapore</div>
    <h1><em>HDB Moving Made Simple</em><br/>Dismantle · Move · Reassemble</h1>
    <p class="hero-desc">Moving HDB to HDB, HDB to condo, or HDB to landed? We dismantle, transport and reassemble all your furniture in one visit — fixed price upfront, lift coordination handled, fully insured.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">
    <div class="section">
      <h2>Singapore's HDB Moving Specialists</h2>
      <p>HDB moves come with their own quirks — narrow lifts, lift-booking forms, common-area protection rules, and the ever-present risk of scratching freshly painted corridors. Most "general movers" turn up with a lorry but leave you to dismantle wardrobes and reassemble bed frames yourself.</p>
      <p>TMG Install is different. We're a furniture installation company first, so dismantle, transport and reassembly are bundled together — one team, one fixed price, one day. We've moved hundreds of HDB households across every estate from Sembawang to Sentosa Cove.</p>
    </div>

    <div class="section">
      <h2>What's Included In Every HDB Move</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🔧</div><h3>Dismantle at Old Place</h3><p>Wardrobes, bed frames, sofas, dining tables, TV consoles — taken apart cleanly and labelled.</p></div>
        <div class="service-card"><div class="service-card-icon">🚛</div><h3>Transport</h3><p>14ft or 24ft lorry, padded blankets, lift-mat protection. Coordinated with your lift booking.</p></div>
        <div class="service-card"><div class="service-card-icon">🪛</div><h3>Reassemble at New Place</h3><p>Every dismantled item reassembled, levelled, and wall-fixed where needed — same day.</p></div>
        <div class="service-card"><div class="service-card-icon">🧹</div><h3>Clean Up</h3><p>Packaging removed, debris swept. Hand the keys back to your old place clean.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>HDB Move Pricing — Honest, Upfront</h2>
      <p>We quote per item using our standard fixed catalog. Typical whole-house HDB moves work out around:</p>
      <ul>
        <li><strong>3-room HDB (whole-house)</strong> — S$600–S$1,000 all-in</li>
        <li><strong>4-room HDB (whole-house)</strong> — S$800–S$1,400 all-in</li>
        <li><strong>5-room / executive HDB</strong> — S$1,000–S$1,800 all-in</li>
        <li><strong>Single-item moves</strong> (e.g. just a wardrobe + bed frame) — from S$220</li>
      </ul>
      <p>No surprise add-ons for lift coordination, basic disassembly tools, or packaging removal — all included.</p>
    </div>

    <div class="section">
      <h2>Why HDB Customers Pick TMG</h2>
      <ul>
        <li><strong>One team, one bill</strong> — no separate "movers" and "assemblers" with finger-pointing if anything goes wrong.</li>
        <li><strong>Lift-booking guidance</strong> — we know which town councils still require it and walk you through the form.</li>
        <li><strong>Common-area-friendly</strong> — corner protectors, lift mats and trolleys to avoid wall scratches.</li>
        <li><strong>HDB drill licence</strong> — for wardrobe wall-fixing, our team knows HDB drill rules (no drilling on Sundays / public holidays).</li>
        <li><strong>Same-day completion</strong> — start at 9am, sleep in your new bed that night.</li>
        <li><strong>Fully insured</strong> — covered for damage to furniture, walls and lifts.</li>
      </ul>
    </div>

    <div class="section">
      <h2>How It Works</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">📋</div><h3>1. List Your Items</h3><p>Use our quote tool — pick everything that's moving with you. Get an itemised fixed price in 60 seconds.</p></div>
        <div class="service-card"><div class="service-card-icon">📅</div><h3>2. Pick Your Move Date</h3><p>9am or 1pm start. Weekday and weekend slots available.</p></div>
        <div class="service-card"><div class="service-card-icon">🚛</div><h3>3. We Move &amp; Reassemble</h3><p>One team, one day — dismantle, transport, reassemble, clean up.</p></div>
        <div class="service-card"><div class="service-card-icon">✅</div><h3>4. You Inspect</h3><p>Walk-through at the new place. Pay only after sign-off.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">How much does an HDB move cost?</div><div class="faq-a">3-room moves run S$600–S$1,000 all-in; 4-room S$800–S$1,400; 5-room / executive S$1,000–S$1,800. Single-item from S$220. Add your items to our quote tool for an exact price.</div></div>
      <div class="faq-item"><div class="faq-q">Do you handle the HDB lift booking?</div><div class="faq-a">Most blocks no longer require it, but where they do (typical S$30–S$50 deposit, refunded after) we'll guide you through the town council form and coordinate timing.</div></div>
      <div class="faq-item"><div class="faq-q">Will my wardrobe fit in the HDB lift?</div><div class="faq-a">Most won't fit assembled — that's why we dismantle them. We've moved out of every HDB layout from 2-room flexi to executive maisonettes.</div></div>
      <div class="faq-item"><div class="faq-q">How long does the move take?</div><div class="faq-a">Typically 5–8 hours start-to-finish for a whole-house move. We start at 9am or 1pm and complete same day.</div></div>
      <div class="faq-item"><div class="faq-q">Do you reassemble at the new place?</div><div class="faq-a">Yes — included in the bundled price. Wardrobes wall-fixed, bed slats reseated, sofa modules reconnected.</div></div>
      <div class="faq-item"><div class="faq-q">Do you supply moving boxes?</div><div class="faq-a">We focus on furniture. For boxes, WhatsApp us — we'll bundle a recommendation from a trusted box partner.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Plan Your HDB Move Today</h2>
        <p>Instant fixed-price quote — no surveyor visit, no surprises. Book in 60 seconds.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>
  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "HDB Moving Services" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Condo moving services Singapore
// ─────────────────────────────────────────────────────────────────────────────
export function condoMovingServicesPage(): string {
  const title = "Condo Moving Services Singapore | MCST-Compliant Moves | TMG Install";
  const description = "Moving in or out of a Singapore condo? TMG Install handles MCST clearance, lift padding, security check-in, dismantle, transport and reassembly — fixed price, fully insured. Instant online quote.";
  const canonical = `${DOMAIN}/services/condo-moving-services-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Condo Moving Services Singapore",
      "serviceType": [
        "Condo Moving Services",
        "MCST-Compliant Moving",
        "Condo Furniture Relocation",
        "Condo Move-In Service",
        "Condo Move-Out Service",
      ],
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "description": "Fixed-price condo moves with MCST coordination, lift padding and security check-in handled." },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Condo Moving Services Singapore", "item": canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Do you handle the MCST move-in / move-out form?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we'll provide our company details, COI (certificate of insurance), and worker NRICs/work permits for your MCST submission. Most condos require 3–7 days notice. We coordinate the timing once your slot is approved." } },
        { "@type": "Question", "name": "Do you bring lift padding?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — heavy-duty lift pads, corner protectors and floor mats are standard for every condo move. Many MCSTs require them — we bring them whether or not it's mandatory." } },
        { "@type": "Question", "name": "What's the typical condo moving deposit?", "acceptedAnswer": { "@type": "Answer", "text": "Most Singapore condos collect a S$200–S$1,000 refundable damage deposit from you (the resident), not from the mover. We can supply our COI in advance to reduce or waive it where the MCST allows." } },
        { "@type": "Question", "name": "Can you do an after-hours / weekend condo move?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — most Singapore condos allow moves on Saturdays and selected weekday evenings. We work within whatever window your MCST approves." } },
        { "@type": "Question", "name": "Do you dismantle and reassemble furniture as part of the move?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — that's our specialty. Wardrobes, bed frames, sofas, dining tables and TV consoles are dismantled, transported and reassembled in one visit, included in the price." } },
        { "@type": "Question", "name": "How much does a condo move cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Per item using our fixed catalog. Typical 2-bedroom condo moves run S$800–S$1,400; 3-bedroom S$1,200–S$2,000. Add your items to our quote tool for an exact upfront price." } },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Condo Moving Services Singapore</div>
    <h1><em>Condo Moves Done Right</em><br/>MCST-Compliant · Fully Insured · Fixed Price</h1>
    <p class="hero-desc">Moving into or out of a Singapore condo? We handle the MCST clearance, lift padding, security check-in, dismantle, transport and reassembly — one team, one fixed price, fully insured.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">
    <div class="section">
      <h2>Singapore's Condo Moving Specialists</h2>
      <p>Condo moves are stricter than HDB moves — MCST forms, insurance certificates, lift padding, security check-in, time-window restrictions and refundable damage deposits. Pick the wrong mover and your move can be turned away at the gate.</p>
      <p>TMG Install handles condo moves end-to-end across Singapore — from One-North to Marina One, Sentosa Cove to D'Leedon. We supply our COI in advance, bring our own lift pads and corner protectors, and coordinate timing with your MCST so the move runs on schedule.</p>
    </div>

    <div class="section">
      <h2>What's Included In Every Condo Move</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">📄</div><h3>MCST Paperwork</h3><p>COI, company UEN, worker NRICs / work permits supplied for your MCST move-in/out form.</p></div>
        <div class="service-card"><div class="service-card-icon">🛡️</div><h3>Lift &amp; Floor Protection</h3><p>Heavy-duty lift pads, corner guards and runner mats — every move, no extra charge.</p></div>
        <div class="service-card"><div class="service-card-icon">🔧</div><h3>Dismantle + Reassemble</h3><p>Wardrobes, bed frames, sofas, dining tables — taken apart, moved, put back together, one team.</p></div>
        <div class="service-card"><div class="service-card-icon">🚛</div><h3>Transport &amp; Security</h3><p>Padded transport, gate check-in handled, MCST timing coordinated.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Condo Move Pricing</h2>
      <p>Per item using our standard fixed catalog. Typical condo moves work out around:</p>
      <ul>
        <li><strong>1-bedroom condo</strong> — S$500–S$900 all-in</li>
        <li><strong>2-bedroom condo</strong> — S$800–S$1,400 all-in</li>
        <li><strong>3-bedroom condo</strong> — S$1,200–S$2,000 all-in</li>
        <li><strong>Penthouse / 4+ bedroom</strong> — quoted per item, typically S$1,800–S$3,500</li>
      </ul>
      <p>No surprise charges for lift padding, MCST liaison, or basic disassembly — all included.</p>
    </div>

    <div class="section">
      <h2>Why Condo Owners Choose TMG</h2>
      <ul>
        <li><strong>COI supplied upfront</strong> — most MCSTs accept our certificate of insurance, often reducing or waiving your damage deposit.</li>
        <li><strong>Single-team accountability</strong> — same crew dismantles, moves and reassembles. If anything goes wrong, one number to call.</li>
        <li><strong>Time-window respected</strong> — we know condos enforce strict move windows; we plan to finish inside yours.</li>
        <li><strong>Lift-pad ready</strong> — no scrambling at security check-in for "where are your protective pads?"</li>
        <li><strong>Discreet</strong> — uniformed crew, low-noise tools, lift-mat trolleys. No banging through your neighbours' corridors.</li>
        <li><strong>Fully insured</strong> — for furniture, walls, lift interiors and condo common-area damage.</li>
      </ul>
    </div>

    <div class="section">
      <h2>How It Works</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">📋</div><h3>1. Get a Quote</h3><p>List the items moving with you. Itemised fixed price in 60 seconds.</p></div>
        <div class="service-card"><div class="service-card-icon">📄</div><h3>2. We Send MCST Docs</h3><p>COI, UEN and worker IDs — straight to your email for the MCST form.</p></div>
        <div class="service-card"><div class="service-card-icon">🚛</div><h3>3. Move Day</h3><p>Crew arrives within your approved window. Dismantle, transport, reassemble — done.</p></div>
        <div class="service-card"><div class="service-card-icon">✅</div><h3>4. You Inspect</h3><p>Walk-through at the new place. Pay only after sign-off.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">Do you handle the MCST move-in / move-out form?</div><div class="faq-a">Yes — we provide COI, UEN, worker IDs and timing details. Most condos require 3–7 days notice; we coordinate once your slot is approved.</div></div>
      <div class="faq-item"><div class="faq-q">Do you bring lift padding?</div><div class="faq-a">Always. Heavy-duty lift pads, corner protectors and floor mats are standard for every condo move.</div></div>
      <div class="faq-item"><div class="faq-q">Can you do an after-hours or weekend move?</div><div class="faq-a">Yes — within whatever window your MCST approves (typically Saturdays and selected weekday evenings).</div></div>
      <div class="faq-item"><div class="faq-q">Do you reassemble at the new place?</div><div class="faq-a">Yes — included in the bundled price. Wardrobes, beds, sofas, dining tables — all reassembled and levelled.</div></div>
      <div class="faq-item"><div class="faq-q">How much does it cost?</div><div class="faq-a">2-bedroom condos S$800–S$1,400; 3-bedroom S$1,200–S$2,000. Get an exact quote in our tool.</div></div>
      <div class="faq-item"><div class="faq-q">Do you cover all Singapore condos?</div><div class="faq-a">Yes — every condo, executive condo and penthouse across Singapore. Sentosa Cove included.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Book Your Condo Move</h2>
        <p>Instant fixed-price quote — MCST docs supplied, no surveyor visit, no surprises.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>
  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Condo Moving Services" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazada furniture installation Singapore
// ─────────────────────────────────────────────────────────────────────────────
export function lazadaFurnitureInstallationPage(): string {
  const title = "Lazada Furniture Installation Singapore | Assembly · Wall-Fix · Relocation | TMG Install";
  const description = "Furniture from Lazada arriving flat-packed? TMG Install assembles, installs, dismantles and relocates Lazada furniture across Singapore — fixed price, fully insured, instant online quote.";
  const canonical = `${DOMAIN}/services/lazada-furniture-installation-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Lazada Furniture Installation Singapore",
      "serviceType": [
        "Lazada Furniture Installation",
        "Lazada Furniture Assembly",
        "Lazada Furniture Dismantling",
        "Lazada Furniture Relocation",
      ],
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "description": "Fixed-price catalog covering 250+ furniture types — instant quote." },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Lazada Furniture Installation Singapore", "item": canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Do you install furniture bought from Lazada?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — TMG Install assembles Lazada furniture from any seller, including LazMall and overseas-shipped items. Wardrobes, bed frames, desks, sofas, dining sets, shelving — we handle them all." } },
        { "@type": "Question", "name": "Lazada furniture often has poor instructions — can you still install it?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Our installers are experienced with low-quality manuals, missing instructions and pictogram-only guides. WhatsApp us photos of the parts before booking and we'll confirm we can handle it." } },
        { "@type": "Question", "name": "Can you check that all parts are included before assembly?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — first thing we do on arrival is a parts inventory against the manual. If anything is missing we flag it before drilling so you can raise a Lazada return without compromising the box." } },
        { "@type": "Question", "name": "How much does Lazada furniture installation cost?", "acceptedAnswer": { "@type": "Answer", "text": "Standard catalog pricing — wardrobes from S$120, bed frames from S$80, desks from S$50, sofas from S$120. Add your items in our quote tool for an itemised price upfront." } },
        { "@type": "Question", "name": "Can you wall-fix tall wardrobes and shelving?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — included where the furniture's design needs it for safety. We bring HDB-friendly drill bits, stud finder and weight-rated wall anchors for both concrete and partition walls." } },
        { "@type": "Question", "name": "What if my Lazada furniture is defective?", "acceptedAnswer": { "@type": "Answer", "text": "We'll document the defect with photos for your Lazada warranty claim and stop assembly to preserve the return condition. You can rebook us for a future date once the seller ships replacement parts." } },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Lazada Furniture Installation Singapore</div>
    <h1><em>Lazada Furniture</em><br/>Assembly, Installation &amp; Relocation</h1>
    <p class="hero-desc">Bought a wardrobe, bed frame or desk from Lazada? We assemble, install, dismantle and relocate Lazada furniture across Singapore — fixed prices, instant quote, fully insured.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">
    <div class="section">
      <h2>Singapore's Lazada Furniture Specialists</h2>
      <p>Lazada is one of Singapore's biggest furniture marketplaces — wardrobes, bed frames, study desks, sofas, dining sets and shelving from hundreds of sellers. The catch: instructions vary wildly, parts can be mis-labelled, and proprietary fittings are common. Many buyers spend a Saturday wrestling with the assembly only to call us in on Sunday to finish.</p>
      <p>TMG Install is the team Singapore homes call when their Lazada delivery lands. We assemble, install, wall-fix, dismantle and relocate Lazada furniture island-wide, with the same fixed-price catalog and instant upfront quote we use for every brand.</p>
    </div>

    <div class="section">
      <h2>What We Do With Your Lazada Furniture</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🪛</div><h3>Assembly &amp; Installation</h3><p>Wardrobes, bed frames, desks, dining sets, sofas — assembled correctly the first time, wall-fixed where needed.</p></div>
        <div class="service-card"><div class="service-card-icon">🔍</div><h3>Parts Inventory</h3><p>We check parts against the manual before drilling so any missing items can still be claimed via Lazada warranty.</p></div>
        <div class="service-card"><div class="service-card-icon">🔧</div><h3>Dismantling</h3><p>Moving out or replacing? We dismantle Lazada furniture cleanly for transport, reinstallation or disposal.</p></div>
        <div class="service-card"><div class="service-card-icon">🚛</div><h3>Relocation</h3><p>Dismantle + transport + reassemble at the new address — coordinated with your move.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Common Lazada Furniture We Install</h2>
      <ul>
        <li>Wardrobes — sliding-door, swing-door, modular, fabric portable wardrobes</li>
        <li>Bed frames — divan, storage beds, slat-base, upholstered, bunk and loft</li>
        <li>Sofas &amp; recliners — modular, L-shape, fabric, PU leather</li>
        <li>Dining sets — extending tables, marble-top tables, dining chairs</li>
        <li>Study desks &amp; office chairs — standing desks, gaming chairs, ergonomic setups</li>
        <li>Cabinets &amp; shelving — TV consoles, shoe cabinets, bookcases, kitchen organisers</li>
        <li>Children's furniture — bunk beds, study desks, toy storage</li>
      </ul>
    </div>

    <div class="section">
      <h2>Why Singapore Customers Use TMG for Lazada</h2>
      <ul>
        <li><strong>Fixed-price quote upfront</strong> — no premium for "Lazada" or unbranded furniture. Same catalog, same prices.</li>
        <li><strong>Comfortable with poor manuals</strong> — pictogram-only, mis-translated, or missing instructions are no problem.</li>
        <li><strong>Parts inventory before drilling</strong> — protect your Lazada return rights if anything's missing.</li>
        <li><strong>We bring the right tools</strong> — Allen keys, drills, spirit levels, HDB-friendly drill bits — every job.</li>
        <li><strong>Wall-fixed for safety</strong> — tall wardrobes and shelving anchored to wall studs.</li>
        <li><strong>Same-day available</strong> — book before noon for same-day where slots allow.</li>
      </ul>
    </div>

    <div class="section">
      <h2>How It Works</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">📋</div><h3>1. Get a Quote</h3><p>Add your Lazada items in our quote tool. Itemised price in 60 seconds.</p></div>
        <div class="service-card"><div class="service-card-icon">📅</div><h3>2. Book a Slot</h3><p>3-hour window. Same-day, weekend or weekday.</p></div>
        <div class="service-card"><div class="service-card-icon">🪛</div><h3>3. We Install</h3><p>Parts inventory, assembly, wall-fixing, packaging removal — one visit.</p></div>
        <div class="service-card"><div class="service-card-icon">✅</div><h3>4. You Inspect</h3><p>Walk-through and sign-off. Payment only after you're happy.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">Do you install furniture from Lazada?</div><div class="faq-a">Yes — from any Lazada seller including LazMall and overseas-shipped items. Wardrobes, beds, sofas, dining, desks, shelving — all handled.</div></div>
      <div class="faq-item"><div class="faq-q">Lazada manuals are bad — can you still assemble?</div><div class="faq-a">Yes. We're experienced with poor or missing instructions. WhatsApp us photos before booking and we'll confirm.</div></div>
      <div class="faq-item"><div class="faq-q">Can you check that all parts are included?</div><div class="faq-a">Yes — parts inventory against the manual is the first step. If anything's missing we flag it before drilling so you can claim via Lazada.</div></div>
      <div class="faq-item"><div class="faq-q">How much does it cost?</div><div class="faq-a">Standard catalog — wardrobes from S$120, beds from S$80, desks from S$50, sofas from S$120. Itemised in our quote tool.</div></div>
      <div class="faq-item"><div class="faq-q">Can you wall-fix tall wardrobes?</div><div class="faq-a">Yes — included. We bring HDB-friendly drill bits, stud finder and weight-rated anchors.</div></div>
      <div class="faq-item"><div class="faq-q">What if my Lazada furniture is defective?</div><div class="faq-a">We document the defect with photos and pause assembly to preserve your warranty claim — rebook us once Lazada ships replacement parts.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Get Your Lazada Furniture Installed</h2>
        <p>Instant fixed-price quote — no phone calls, no surprises. Book in 60 seconds.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>
  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Lazada Furniture Installation" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Shopee furniture installation Singapore
// ─────────────────────────────────────────────────────────────────────────────
export function shopeeFurnitureInstallationPage(): string {
  const title = "Shopee Furniture Installation Singapore | Assembly · Wall-Fix · Relocation | TMG Install";
  const description = "Furniture from Shopee arriving flat-packed? TMG Install assembles, installs, dismantles and relocates Shopee furniture across Singapore — fixed price, instant quote, fully insured.";
  const canonical = `${DOMAIN}/services/shopee-furniture-installation-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Shopee Furniture Installation Singapore",
      "serviceType": [
        "Shopee Furniture Installation",
        "Shopee Furniture Assembly",
        "Shopee Furniture Dismantling",
        "Shopee Furniture Relocation",
      ],
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": { "@type": "Offer", "priceCurrency": "SGD", "description": "Fixed-price catalog covering 250+ furniture types — instant quote." },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Shopee Furniture Installation Singapore", "item": canonical },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Do you install furniture bought from Shopee?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — TMG Install assembles Shopee furniture from any seller, including Shopee Mall and preferred sellers. Wardrobes, bed frames, study desks, sofas and shelving are all in our catalog." } },
        { "@type": "Question", "name": "Shopee furniture often comes without instructions — is that a problem?", "acceptedAnswer": { "@type": "Answer", "text": "No. Our installers handle no-instruction assemblies daily by working from the parts and component shapes. WhatsApp us photos of the box and the parts before booking and we'll confirm." } },
        { "@type": "Question", "name": "Will you check parts before starting?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — first step on arrival is a parts inventory. If anything is missing or damaged we'll flag it before drilling so you can raise a Shopee return without compromising the box." } },
        { "@type": "Question", "name": "How much does Shopee furniture installation cost?", "acceptedAnswer": { "@type": "Answer", "text": "Same catalog as everything else — wardrobes from S$120, bed frames from S$80, desks from S$50, sofas from S$120. Itemised quote in our online tool." } },
        { "@type": "Question", "name": "Can you wall-fix shelving and tall wardrobes?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — included. HDB-friendly drill bits, stud finder, weight-rated anchors. Tall wardrobes and bookcases are wall-fixed for safety." } },
        { "@type": "Question", "name": "Do you also dismantle Shopee furniture for moves or disposal?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — for relocations (we dismantle, transport and reassemble at the new address) or for disposal. We can arrange disposal of unwanted items in one visit." } },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Shopee Furniture Installation Singapore</div>
    <h1><em>Shopee Furniture</em><br/>Assembly, Installation &amp; Relocation</h1>
    <p class="hero-desc">Bought a wardrobe, bed frame or desk from Shopee? We assemble, install, dismantle and relocate Shopee furniture across Singapore — fixed prices, instant quote, fully insured.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">
    <div class="section">
      <h2>Singapore's Shopee Furniture Specialists</h2>
      <p>Shopee is the marketplace many Singapore renters and young homeowners turn to first — affordable wardrobes, bed frames, study desks, kitchen organisers and modular shelving. The trade-off: instructions are often missing, mis-translated or pictogram-only, and parts quality is variable.</p>
      <p>TMG Install handles Shopee furniture installations across Singapore. Same fixed-price catalog, same instant upfront quote, same insured team. We've assembled thousands of pieces from no-name Shopee sellers and we know what to watch for.</p>
    </div>

    <div class="section">
      <h2>What We Do With Your Shopee Furniture</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🪛</div><h3>Assembly &amp; Installation</h3><p>Wardrobes, beds, desks, dining sets, sofas, shelving — assembled correctly first time.</p></div>
        <div class="service-card"><div class="service-card-icon">🔍</div><h3>Parts Inventory</h3><p>Counted against the manual (or against the parts list you screenshot from Shopee) before any drilling starts.</p></div>
        <div class="service-card"><div class="service-card-icon">🔧</div><h3>Dismantling</h3><p>Moving out or replacing? Cleanly dismantled for transport, reinstall or disposal.</p></div>
        <div class="service-card"><div class="service-card-icon">🚛</div><h3>Relocation</h3><p>Dismantle + transport + reassemble at the new address — same day where possible.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Common Shopee Furniture We Install</h2>
      <ul>
        <li>Wardrobes — sliding-door, swing-door, modular DIY, fabric portable</li>
        <li>Bed frames — storage beds, divan, slat-base, upholstered, bunk, loft</li>
        <li>Sofas — modular, L-shape, fabric, PU leather, recliners</li>
        <li>Dining sets — extending tables, marble-top, glass-top, dining chairs</li>
        <li>Study desks &amp; office chairs — standing desks, gaming chairs, ergonomic setups</li>
        <li>Cabinets &amp; shelving — TV consoles, shoe cabinets, bookcases, kitchen storage</li>
        <li>Children's furniture — bunk beds, study desks, toy storage</li>
      </ul>
    </div>

    <div class="section">
      <h2>Why Singapore Customers Use TMG for Shopee</h2>
      <ul>
        <li><strong>Fixed-price quote upfront</strong> — no premium for unbranded furniture.</li>
        <li><strong>Comfortable without instructions</strong> — pictogram-only, mis-translated, or no manual at all are no problem.</li>
        <li><strong>Parts inventory protects your return rights</strong> — anything missing is flagged before drilling.</li>
        <li><strong>HDB-friendly tools</strong> — proper drill bits, stud finder, weight-rated wall anchors.</li>
        <li><strong>Wall-fixed for safety</strong> — tall wardrobes and shelving anchored properly.</li>
        <li><strong>Same-day available</strong> — book before noon for same-day where slots allow.</li>
      </ul>
    </div>

    <div class="section">
      <h2>How It Works</h2>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">📋</div><h3>1. Get a Quote</h3><p>Add your Shopee items in our quote tool. Itemised price in 60 seconds.</p></div>
        <div class="service-card"><div class="service-card-icon">📅</div><h3>2. Book a Slot</h3><p>3-hour window. Same-day, weekend or weekday.</p></div>
        <div class="service-card"><div class="service-card-icon">🪛</div><h3>3. We Install</h3><p>Parts inventory, assembly, wall-fixing, packaging removal — one visit.</p></div>
        <div class="service-card"><div class="service-card-icon">✅</div><h3>4. You Inspect</h3><p>Walk-through and sign-off. Pay only after you're happy.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">Do you install furniture from Shopee?</div><div class="faq-a">Yes — from any Shopee seller including Shopee Mall. Wardrobes, beds, sofas, dining, desks and shelving all in our catalog.</div></div>
      <div class="faq-item"><div class="faq-q">No instructions in the box — can you still assemble?</div><div class="faq-a">Yes. Our installers handle no-instruction assemblies daily. WhatsApp us photos of the parts before booking and we'll confirm.</div></div>
      <div class="faq-item"><div class="faq-q">Will you check parts before starting?</div><div class="faq-a">Yes — first step is a parts inventory against the manual or your Shopee parts-list screenshot.</div></div>
      <div class="faq-item"><div class="faq-q">How much does it cost?</div><div class="faq-a">Standard catalog — wardrobes from S$120, beds from S$80, desks from S$50. Itemised in our tool.</div></div>
      <div class="faq-item"><div class="faq-q">Can you wall-fix shelving?</div><div class="faq-a">Yes — included. HDB-friendly drill bits, stud finder, weight-rated anchors.</div></div>
      <div class="faq-item"><div class="faq-q">Do you dismantle Shopee furniture for moves?</div><div class="faq-a">Yes — for moves (dismantle, transport, reassemble at new address) or disposal.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Get Your Shopee Furniture Installed</h2>
        <p>Instant fixed-price quote — no phone calls, no surprises. Book in 60 seconds.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>
  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Shopee Furniture Installation" });
}

/* ── Gym Equipment Installation ─────────────────────────────────────────────── */
export function gymEquipmentInstallationPage(): string {
  const title = "Gym Equipment Installation Singapore | TMG Install — From $90";
  const description = "Professional home & commercial gym equipment installation in Singapore. Treadmills, multi-station gyms, power racks, smart mirrors, rowing machines and free-weight assemblies. Floor-protection, level-checking and safety bolts included. Same-day available island-wide.";
  const canonical = `${DOMAIN}/services/gym-equipment-installation-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Gym Equipment Installation Singapore",
      "serviceType": "Gym Equipment Assembly & Installation",
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": {
        "@type": "Offer",
        "priceCurrency": "SGD",
        "price": "90",
        "priceSpecification": { "@type": "UnitPriceSpecification", "priceCurrency": "SGD", "price": "90", "unitText": "per item from" },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much does gym equipment installation cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Gym equipment installation starts from $90. A treadmill is typically $90–$120. A multi-station home gym or power rack is $250–$500 depending on configuration. Smart mirrors (Mirror, Tonal, Tempo) are $180–$280 with secure wall-anchoring." } },
        { "@type": "Question", "name": "Do you install equipment from Decathlon, Lifespan or BodyTone?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we install all major Singapore gym brands including Decathlon, Lifespan, BodyTone, Johnson, Sole Fitness, NordicTrack, Bowflex, Rogue, Eleiko and PRX." } },
        { "@type": "Question", "name": "Can you wall-mount a smart mirror or pull-up bar?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. We use weight-rated anchors and stud-finders for HDB and condo walls. For doorway pull-up bars and TRX mounts we check the door frame load rating before installation." } },
        { "@type": "Question", "name": "Do you provide floor protection?", "acceptedAnswer": { "@type": "Answer", "text": "We bring rubber matting to protect HDB tile and condo flooring during installation. We can also advise on permanent gym flooring tile placement." } },
        { "@type": "Question", "name": "Do you level treadmills and rowers?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — every treadmill and rower is levelled before handover. Uneven setups cause belt-drift and accelerated wear, so we always test-run before leaving." } },
        { "@type": "Question", "name": "Can you dismantle and move my home gym?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — full dismantle, transport, and reassembly at the new address. We label every bolt and bracket so reassembly is exact. See our furniture relocation page for details." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Gym Equipment Installation Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Gym Equipment Installation Singapore</div>
    <h1>Professional <em>Gym Equipment Installation</em><br/>in Singapore</h1>
    <p class="hero-desc">From a single treadmill to a full home-gym build-out — every bolt torqued, every machine levelled, every wall-mount safety-rated. HDB and condo specialists.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>What We Install</h2>
      <p>Every brand, every category — from cardio to strength to recovery. Our team has installed gym equipment in HDB flats, condos, landed homes, commercial gyms and corporate wellness rooms across Singapore.</p>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🏃</div><h3>Treadmills & Cardio</h3><p>Treadmills, ellipticals, stationary bikes, rowing machines, stair climbers — all major brands.</p></div>
        <div class="service-card"><div class="service-card-icon">🏋️</div><h3>Multi-Station Gyms</h3><p>Smith machines, cable crossovers, functional trainers, all-in-one home gym systems.</p></div>
        <div class="service-card"><div class="service-card-icon">🔩</div><h3>Power Racks & Squat Cages</h3><p>Rogue, PRX, Eleiko, Bells Of Steel — anchored, levelled and load-tested.</p></div>
        <div class="service-card"><div class="service-card-icon">🪞</div><h3>Smart Mirrors</h3><p>Mirror, Tonal, Tempo, Lululemon Studio Mirror — secure wall-anchoring with stud detection.</p></div>
        <div class="service-card"><div class="service-card-icon">🥊</div><h3>Punching Bags & Mounts</h3><p>Ceiling and wall-mounted heavy bags, speed bags, TRX anchors, gymnastic rings.</p></div>
        <div class="service-card"><div class="service-card-icon">🛡️</div><h3>Flooring & Mats</h3><p>Rubber tile installation, interlocking gym mats, treadmill noise-isolation pads.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Pricing Guide</h2>
      <p>All prices are per item and include levelling, safety check and tidying-up. Get an <a href="${CTA_URL}" style="color:#3b82f6;font-weight:600;">instant itemised quote</a> for your full setup.</p>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">Treadmill (folding or full-size)</span><span class="pricing-price">from $90</span></div>
        <div class="pricing-row"><span class="pricing-item">Stationary Bike / Spin Bike</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Rowing Machine (Concept2, WaterRower)</span><span class="pricing-price">from $90</span></div>
        <div class="pricing-row"><span class="pricing-item">Multi-Station Home Gym</span><span class="pricing-price">from $250</span></div>
        <div class="pricing-row"><span class="pricing-item">Power Rack / Squat Cage (anchored)</span><span class="pricing-price">from $300</span></div>
        <div class="pricing-row"><span class="pricing-item">Smart Mirror (Mirror / Tonal / Tempo)</span><span class="pricing-price">from $180</span></div>
        <div class="pricing-row"><span class="pricing-item">Pull-Up Bar (wall or doorway)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Adjustable Bench / Free-Weight Rack</span><span class="pricing-price">from $90</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Why Choose TMG Install for Gym Equipment?</h2>
      <h3>Safety-First Anchoring</h3>
      <p>Heavy gym equipment that isn't anchored properly can topple — especially smart mirrors, power racks and cable machines. We use weight-rated anchors, stud detection and torque-spec'd bolts on every install. For HDB and condo concrete walls we use SDS-Plus drills and the right diameter sleeve anchors for the load.</p>
      <h3>Levelled & Test-Run</h3>
      <p>Every treadmill, rower and bike is levelled with a digital level and test-run for at least 3 minutes before handover. Uneven setups cause belt-drift and accelerated wear — and noise complaints from neighbours below in HDB blocks.</p>
      <h3>Floor & Wall Protection</h3>
      <p>We bring rubber matting and felt sliders so your tile, parquet or vinyl flooring is never scratched during installation. For mirrors and wall mounts we patch any pilot holes that aren't used.</p>
      <h3>HDB & Condo Compliant</h3>
      <p>We know which walls in standard HDB layouts are load-bearing vs partition, and we follow MCST requirements for condo installations including drilling time-windows. No noise complaints, no warning letters.</p>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">Do you install equipment from Decathlon, Lifespan or BodyTone?</div><div class="faq-a">Yes — we install all major Singapore gym brands including Decathlon, Lifespan, BodyTone, Johnson, Sole Fitness, NordicTrack, Bowflex, Rogue, Eleiko and PRX.</div></div>
      <div class="faq-item"><div class="faq-q">Can you wall-mount a smart mirror?</div><div class="faq-a">Yes. We use weight-rated anchors and stud-finders. Mirror, Tonal, Tempo and Lululemon Studio Mirror are all installed with the manufacturer's recommended hardware on HDB and condo walls.</div></div>
      <div class="faq-item"><div class="faq-q">Will my power rack damage HDB flooring?</div><div class="faq-a">Not with proper protection. We install rubber base mats under every rack contact point. For permanent setups we can also lay 25mm rubber gym tile.</div></div>
      <div class="faq-item"><div class="faq-q">Can you dismantle and move my home gym?</div><div class="faq-a">Yes — full dismantle, transport and reassembly at the new address. Every bolt and bracket is bagged and labelled. See our <a href="/services/furniture-relocation-singapore" style="color:#3b82f6;font-weight:600;">furniture relocation</a> page.</div></div>
      <div class="faq-item"><div class="faq-q">How long does a home gym installation take?</div><div class="faq-a">A treadmill is 45–60 minutes. A multi-station home gym is 3–5 hours. A full home-gym room build (rack + flooring + mirror + accessories) is typically a half-day with two installers.</div></div>
      <div class="faq-item"><div class="faq-q">Do you do commercial gym fit-outs?</div><div class="faq-a">Yes — we install for hotel gyms, condo facility gyms, corporate wellness rooms and personal training studios. WhatsApp us for site survey and bulk pricing.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Ready to Build Your Home Gym?</h2>
        <p>Instant fixed-price quote — no phone calls, no waiting. Book in 60 seconds.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>
  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Gym Equipment Installation Singapore" });
}

export function furnitureRepairAdjustmentPage(): string {
  const title = "Furniture Repair & Adjustment Singapore | TMG Install — From $60";
  const description = "Wobbly chairs, sagging wardrobe doors, drawers that won't close, hinges that creak, table legs that won't level — TMG Install fixes the small stuff that ruins the look of your home. Same-day available island-wide. Fixed prices, no call-out fee.";
  const canonical = `${DOMAIN}/services/furniture-repair-adjustment-singapore`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${canonical}#service`,
      "name": "Furniture Repair & Adjustment Singapore",
      "serviceType": "Furniture Repair, Adjustment & Tune-Up",
      "provider": { "@type": "LocalBusiness", "@id": `${DOMAIN}/#business`, "name": BRAND },
      "areaServed": { "@type": "City", "name": "Singapore" },
      "description": description,
      "url": canonical,
      "offers": {
        "@type": "Offer",
        "priceCurrency": "SGD",
        "price": "60",
        "priceSpecification": { "@type": "UnitPriceSpecification", "priceCurrency": "SGD", "price": "60", "unitText": "per visit from" },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "How much does furniture repair cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Most small repairs and adjustments start from $60 per visit. Hinge replacement, drawer-runner adjustment, levelling and tightening loose joints are typically $60–$120. Larger jobs like rebuilding a bed frame or re-fitting a wardrobe door panel are quoted by item — send us a photo on WhatsApp for a fixed price." } },
        { "@type": "Question", "name": "Do you charge a call-out fee?", "acceptedAnswer": { "@type": "Answer", "text": "No call-out or inspection fee. Our quoted price covers the visit and the repair. If on-site we find the job needs more than what was quoted, we tell you the price before we start the extra work." } },
        { "@type": "Question", "name": "Can you fix IKEA, Castlery, Taobao or Scanteak furniture?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — we work on every major brand sold in Singapore including IKEA, Castlery, Scanteak, Taobao, Cellini, Lorenzo, Commune and Star Living. We carry common spares like cam-locks, dowels, IKEA hex keys and Blum hinge clips." } },
        { "@type": "Question", "name": "Can you fix a sagging wardrobe door or one that won't close?", "acceptedAnswer": { "@type": "Answer", "text": "Yes. Most wardrobe-door issues are hinge alignment, screw-holes that have stripped, or a frame that has settled out of square. We re-set the hinges, fill stripped screw-holes with hardwood plugs and re-drill, and shim the frame back to true." } },
        { "@type": "Question", "name": "Do you do same-day repairs?", "acceptedAnswer": { "@type": "Answer", "text": "Yes — same-day slots are usually available island-wide. Book through the instant quote tool or send us a WhatsApp photo and we'll confirm a slot within the hour." } },
        { "@type": "Question", "name": "Will you replace parts I can't find?", "acceptedAnswer": { "@type": "Answer", "text": "We carry generic cam-locks, dowels, hinges, drawer runners and bed-frame brackets. For brand-specific parts (e.g. IKEA-numbered fittings) we can usually source them within 2–3 working days." } },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Services", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": "Furniture Repair & Adjustment Singapore", "item": canonical },
      ],
    },
  ];

  const body = `
  <section class="hero">
    <div class="hero-badge">Furniture Repair & Adjustment Singapore</div>
    <h1>Honest <em>Furniture Repair &amp; Adjustment</em><br/>in Singapore</h1>
    <p class="hero-desc">Wobbly chairs, sagging doors, sticky drawers, missing screws, levelling that's gone off — we put it right. Fixed prices, no call-out fee, same-day slots island-wide.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">Send a Photo on WhatsApp</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>What We Repair &amp; Adjust</h2>
      <p>The small stuff that ruins how a home looks. We carry common spares (hinges, cam-locks, dowels, drawer runners) on every visit so most jobs are fixed the same day, in one trip.</p>
      <div class="service-grid">
        <div class="service-card"><div class="service-card-icon">🚪</div><h3>Wardrobe Doors</h3><p>Re-aligning hinges, fixing stripped screw-holes, replacing soft-close dampers, shimming sagging frames back to square.</p></div>
        <div class="service-card"><div class="service-card-icon">🗄️</div><h3>Drawers &amp; Runners</h3><p>Drawers that stick, won't close flush, fall off their runners, or rub on the frame — runner replacement, alignment, and frame adjustment.</p></div>
        <div class="service-card"><div class="service-card-icon">🛏️</div><h3>Beds &amp; Bed Frames</h3><p>Squeaky joints, broken slats, loose headboards, frame tightening, replacing missing brackets and bolts.</p></div>
        <div class="service-card"><div class="service-card-icon">🪑</div><h3>Chairs &amp; Stools</h3><p>Wobbly legs, loose joints, gas-lift replacement on office chairs, re-glueing wooden joints, swivel-base repair.</p></div>
        <div class="service-card"><div class="service-card-icon">🪵</div><h3>Tables &amp; Desks</h3><p>Levelling on uneven floors, tightening cross-braces, replacing missing feet, repairing wobble at the joint between leg and top.</p></div>
        <div class="service-card"><div class="service-card-icon">🔩</div><h3>Missing Hardware</h3><p>Lost an IKEA cam-lock, a Castlery bracket, or a hex bolt? We carry generic spares and source brand-specific parts in 2–3 working days.</p></div>
      </div>
    </div>

    <div class="section">
      <h2>Pricing Guide</h2>
      <p>Fixed per-visit pricing — no hidden call-out fee. <a href="${CTA_URL}" style="color:#3b82f6;font-weight:600;">Send a photo</a> for an exact quote on bigger jobs.</p>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">Single small adjustment (1 hinge, 1 drawer, 1 leg)</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">Wardrobe door re-alignment (per door)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Drawer runner replacement (per drawer)</span><span class="pricing-price">from $90</span></div>
        <div class="pricing-row"><span class="pricing-item">Bed frame tightening &amp; squeak fix</span><span class="pricing-price">from $90</span></div>
        <div class="pricing-row"><span class="pricing-item">Office chair gas-lift replacement</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Table levelling &amp; brace tightening</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Multi-item visit (3+ small jobs in one trip)</span><span class="pricing-price">from $150</span></div>
      </div>
    </div>

    <div class="section">
      <h2>Why Choose TMG Install for Repairs?</h2>
      <h3>Spares On The Truck</h3>
      <p>We carry generic cam-locks, dowels, Blum hinge clips, common drawer runners, IKEA hex keys, soft-close dampers and a full bracket set on every visit. Most repairs are completed in one trip without a return call.</p>
      <h3>Honest Diagnosis</h3>
      <p>If your wardrobe door is sagging because the frame has settled, we tell you that — not just adjust the hinge for it to droop again next month. If a job isn't worth repairing (e.g. flat-pack particle board that's failed at the joints), we say so up-front.</p>
      <h3>No Call-Out Fee</h3>
      <p>The quoted price is the price you pay. No hidden visit charge, no extra for bringing the right tools, no surprise mark-ups for parts.</p>
      <h3>Brand Familiarity</h3>
      <p>We assemble and dismantle thousands of IKEA, Castlery, Scanteak, Taobao, Cellini and Lorenzo pieces a year — so we already know which screw stripped on which model and what the correct replacement is.</p>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      <div class="faq-item"><div class="faq-q">Do you charge a call-out or inspection fee?</div><div class="faq-a">No. Our quoted price covers the visit and the repair. If on-site we find the job needs more than what was quoted, we tell you the price before starting the extra work.</div></div>
      <div class="faq-item"><div class="faq-q">Can you fix IKEA, Castlery, Taobao or Scanteak furniture?</div><div class="faq-a">Yes — every major brand sold in Singapore. We carry common spares like cam-locks, dowels, IKEA hex keys and Blum hinge clips.</div></div>
      <div class="faq-item"><div class="faq-q">My wardrobe door won't stay closed. Can you fix it?</div><div class="faq-a">Almost always yes. The usual cause is hinge alignment or stripped screw-holes — we re-set the hinges, fill stripped holes with hardwood plugs and re-drill so the door sits true again.</div></div>
      <div class="faq-item"><div class="faq-q">Can you replace a missing IKEA part I can't find?</div><div class="faq-a">We carry generic cam-locks, dowels, hinges and brackets. For IKEA-numbered fittings we can usually source the exact part within 2–3 working days.</div></div>
      <div class="faq-item"><div class="faq-q">Do you do same-day repair visits?</div><div class="faq-a">Yes — same-day slots are usually available island-wide. Send us a WhatsApp photo and we'll confirm a slot within the hour.</div></div>
      <div class="faq-item"><div class="faq-q">Should I just throw the furniture out and buy new?</div><div class="faq-a">If we think a piece isn't worth repairing we'll tell you up-front. We also offer <a href="/services/furniture-dismantling-singapore" style="color:#3b82f6;font-weight:600;">dismantling and disposal</a> if you decide to replace it.</div></div>
    </div>

    <div class="section">
      <div class="cta-box">
        <h2>Got Something That Needs Fixing?</h2>
        <p>Send a photo on WhatsApp and we'll come back with a fixed price. Most jobs done same day, in one visit.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>
  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Furniture Repair & Adjustment Singapore" });
}

/* ── Dynamic sitemap.xml — auto-generated from SERVICE_PAGES registry ───────── */
/* ════════════════════════════════════════════════════════════════════════════
   GUIDE / COST / COMPARISON PAGES
   Answer-style content built to win Google featured snippets and AI-engine
   citations (ChatGPT, Perplexity, Google AI Overviews). Each leads with a
   direct answer, hard numbers, a table, and real-question FAQs.
   ════════════════════════════════════════════════════════════════════════════ */

const GUIDE_UPDATED = "June 2026";

function guideSchema(canonical: string, title: string, description: string, faq: Array<{ q: string; a: string }>) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": description,
      "datePublished": "2026-01-12",
      "dateModified": "2026-06-14",
      "author": { "@type": "Organization", "name": BRAND, "url": DOMAIN },
      "publisher": { "@type": "Organization", "name": BRAND, "logo": { "@type": "ImageObject", "url": `${DOMAIN}/og-image.png` } },
      "mainEntityOfPage": canonical,
      "url": canonical,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faq.map(f => ({ "@type": "Question", "name": f.q, "acceptedAnswer": { "@type": "Answer", "text": f.a } })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": DOMAIN },
        { "@type": "ListItem", "position": 2, "name": "Guides", "item": `${DOMAIN}/services` },
        { "@type": "ListItem", "position": 3, "name": title, "item": canonical },
      ],
    },
  ];
}

function guideCta(): string {
  return `
    <div class="section">
      <div class="cta-box">
        <h2>Get Your Exact Price in 60 Seconds</h2>
        <p>Skip the phone tag. See an itemised, upfront quote online — then book your slot.</p>
        <div class="cta-btns">
          <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
          <a href="${WHATSAPP}" class="btn-ghost">WhatsApp: <span class="cta-phone">${PHONE}</span></a>
        </div>
      </div>
    </div>`;
}

/* ── Guide 1: Furniture Installation Cost Singapore ─────────────────────────── */
export function furnitureInstallationCostPage(): string {
  const title = "How Much Does Furniture Installation Cost in Singapore? (2026 Guide)";
  const description = "A clear 2026 price guide to furniture installation and assembly in Singapore. Real per-item rates for IKEA, wardrobes, beds, TVs, sofas and office furniture, plus what affects the price.";
  const canonical = `${DOMAIN}/guides/furniture-installation-cost-singapore`;

  const faq = [
    { q: "How much does furniture installation cost in Singapore?", a: "Most furniture installation in Singapore costs between $40 and $200 per item in 2026. Small items like a LACK table start from $40, a standard bed frame or shelving unit is around $60–$80, and a full PAX wardrobe system is $150–$200. You get the exact itemised price upfront before booking." },
    { q: "Do installers charge by the hour or per item?", a: "TMG Install charges a fixed price per item, not by the hour. This means no surprise charges if a job takes longer than expected — the quote you see online is the price you pay." },
    { q: "Is there a minimum charge for furniture assembly?", a: "Yes. Because every job involves travel and setup, there is a small minimum order. The fastest way to see whether your order meets it is to add your items to the instant quote tool — it shows the total immediately." },
    { q: "Does the price include wall-mounting and securing?", a: "Yes. Securing tall furniture like wardrobes and bookshelves to the wall for safety is included in the install price. TV wall-mounting is priced separately because it depends on the wall type and bracket." },
    { q: "Is same-day furniture installation more expensive?", a: "No. Same-day and next-day slots are offered at the same per-item price, subject to availability. You simply pick the earliest slot when you book." },
  ];

  const schema = guideSchema(canonical, title, description, faq);

  const body = `
  <section class="hero">
    <div class="hero-badge">Updated ${GUIDE_UPDATED}</div>
    <h1>How Much Does <em>Furniture Installation</em><br/>Cost in Singapore?</h1>
    <p class="hero-desc">A straight-talking 2026 price guide — real per-item rates, what changes the price, and how to get your exact total in under a minute.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>The Short Answer</h2>
      <p>In 2026, most furniture installation in Singapore costs <strong>$40–$200 per item</strong>. Small flat-pack pieces start from $40, beds and shelving land around $60–$80, and a full wardrobe system runs $150–$200. TMG Install prices every job <strong>per item, upfront</strong> — so you know the total before you book, with no hourly surprises.</p>
      <div class="stat-strip">
        <div class="stat-box"><div class="stat-num">$40+</div><div class="stat-label">Per small item</div></div>
        <div class="stat-box"><div class="stat-num">60 sec</div><div class="stat-label">To get your quote</div></div>
        <div class="stat-box"><div class="stat-num">8am–8pm</div><div class="stat-label">7 days a week</div></div>
        <div class="stat-box"><div class="stat-num">4.9 ★</div><div class="stat-label">Customer rating</div></div>
      </div>
    </div>

    <div class="section">
      <h2>2026 Price Guide by Item</h2>
      <p>These are typical starting prices. Your exact total depends on size, quantity and any wall-mounting — see the <a href="${CTA_URL}" style="color:#3b82f6;font-weight:600;">instant quote tool</a> for your itemised price.</p>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">Small items (side table, LACK, stool)</span><span class="pricing-price">from $40</span></div>
        <div class="pricing-row"><span class="pricing-item">Shelving unit (BILLY, KALLAX)</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">TV console / media unit</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">Bed frame (standard)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Dining table & chairs (set)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Wardrobe (2-door)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Office desk & drawer unit</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">TV wall-mounting</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">PAX wardrobe system (with doors)</span><span class="pricing-price">from $180</span></div>
      </div>
    </div>

    <div class="section">
      <h2>What Affects the Price?</h2>
      <h3>Item size and complexity</h3>
      <p>A single shelf takes minutes; a PAX wardrobe with sliding doors, drawers and top cabinets takes hours. Bigger and more complex pieces cost more because they take more skill and time.</p>
      <h3>Quantity</h3>
      <p>Installing several pieces in one visit is more cost-effective than separate trips, because the travel and setup are shared across the order.</p>
      <h3>Wall-mounting and securing</h3>
      <p>Securing wardrobes and bookshelves to the wall is included. TV wall-mounting is priced separately because concrete, brick and partition walls need different brackets and fixings.</p>
      <h3>Access and location</h3>
      <p>Island-wide service is standard. Very tight access, no-lift walk-ups or special handling for oversized items may need an on-site survey, which we flag before booking.</p>
    </div>

    <div class="section">
      <h2>How to Get Your Exact Price</h2>
      <ol>
        <li>Open the <a href="${CTA_URL}" style="color:#3b82f6;font-weight:600;">instant quote tool</a>.</li>
        <li>Add your items (or paste your IKEA/Taobao order list).</li>
        <li>See an itemised, upfront total in about 60 seconds.</li>
        <li>Pick your slot — same-day available — and book.</li>
      </ol>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      ${faq.map(f => `<div class="faq-item"><div class="faq-q">${f.q}</div><div class="faq-a">${f.a}</div></div>`).join("\n      ")}
    </div>

    ${guideCta()}

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "Furniture Installation Cost", section: "Guides" });
}

/* ── Guide 2: IKEA Assembly Cost Singapore ──────────────────────────────────── */
export function ikeaAssemblyCostPage(): string {
  const title = "IKEA Assembly Cost in Singapore — 2026 Price Guide";
  const description = "What does IKEA assembly cost in Singapore in 2026? Real per-item prices for PAX, BILLY, KALLAX, MALM and more, how long it takes, and how to book a same-day installer.";
  const canonical = `${DOMAIN}/guides/ikea-assembly-cost-singapore`;

  const faq = [
    { q: "How much does IKEA assembly cost in Singapore?", a: "IKEA assembly in Singapore starts from $40 for small items like a LACK table and $60 for a BILLY or KALLAX shelf. A MALM or HEMNES bed is around $80, and a full PAX wardrobe with doors is $150–$200. Prices are fixed per item and shown upfront." },
    { q: "How much does it cost to assemble a PAX wardrobe?", a: "A single PAX frame without doors starts from $150. With hinged or sliding doors, drawers and interior organisers, expect $180–$200+ depending on the configuration. Securing it to the wall is included." },
    { q: "How long does IKEA assembly take?", a: "A small item takes 30–60 minutes. A bed frame is about an hour. A full PAX wardrobe system with doors and drawers can take 2–3 hours. You get an estimated duration when you book." },
    { q: "Can you collect my IKEA order and assemble it?", a: "Yes — we offer a collect-and-assemble service. WhatsApp us your IKEA order details and we'll arrange collection and assembly in one visit." },
    { q: "Do I need to provide any tools?", a: "No. The team brings every tool needed. Just have your IKEA boxes at the spot where the furniture will go." },
  ];

  const schema = guideSchema(canonical, title, description, faq);

  const body = `
  <section class="hero">
    <div class="hero-badge">Updated ${GUIDE_UPDATED}</div>
    <h1><em>IKEA Assembly</em> Cost<br/>in Singapore (2026)</h1>
    <p class="hero-desc">Exact per-item IKEA assembly prices, how long each piece takes, and how to book a same-day installer — no phone calls.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>The Short Answer</h2>
      <p>IKEA assembly in Singapore costs from <strong>$40 for small items</strong>, around <strong>$60 for BILLY/KALLAX shelving</strong>, <strong>$80 for a MALM bed</strong>, and <strong>$150–$200 for a full PAX wardrobe</strong> with doors. Every price is fixed per item and shown upfront — no hourly charges, no surprises.</p>
      <div class="stat-strip">
        <div class="stat-box"><div class="stat-num">$40+</div><div class="stat-label">Small IKEA item</div></div>
        <div class="stat-box"><div class="stat-num">$150+</div><div class="stat-label">PAX wardrobe</div></div>
        <div class="stat-box"><div class="stat-num">2–3 hrs</div><div class="stat-label">Full PAX build</div></div>
        <div class="stat-box"><div class="stat-num">Same-day</div><div class="stat-label">Slots available</div></div>
      </div>
    </div>

    <div class="section">
      <h2>IKEA Assembly Prices by Item (2026)</h2>
      <div class="pricing-table">
        <div class="pricing-row"><span class="pricing-item">Small items (LACK table, stool)</span><span class="pricing-price">from $40</span></div>
        <div class="pricing-row"><span class="pricing-item">BILLY / KALLAX shelving</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">TV console / media unit</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">Desk & ALEX drawer unit</span><span class="pricing-price">from $60</span></div>
        <div class="pricing-row"><span class="pricing-item">MALM / HEMNES bed frame</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">Dining table & chairs (set)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">PAX wardrobe (single, no doors)</span><span class="pricing-price">from $150</span></div>
        <div class="pricing-row"><span class="pricing-item">PAX wardrobe (with doors)</span><span class="pricing-price">from $180</span></div>
      </div>
      <p style="margin-top:1rem;">Need the total for a mixed order? The <a href="${CTA_URL}" style="color:#3b82f6;font-weight:600;">instant quote tool</a> lets you paste your full IKEA list and prices it line by line.</p>
    </div>

    <div class="section">
      <h2>How Long Does Each Piece Take?</h2>
      <ul>
        <li><strong>Small items</strong> (LACK, side tables): 30–60 minutes</li>
        <li><strong>Shelving</strong> (BILLY, KALLAX): about 1 hour</li>
        <li><strong>Bed frames</strong> (MALM, HEMNES): about 1 hour</li>
        <li><strong>PAX wardrobe</strong> with doors and drawers: 2–3 hours</li>
      </ul>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      ${faq.map(f => `<div class="faq-item"><div class="faq-q">${f.q}</div><div class="faq-a">${f.a}</div></div>`).join("\n      ")}
    </div>

    ${guideCta()}

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "IKEA Assembly Cost", section: "Guides" });
}

/* ── Guide 3: TMG Install vs Traditional Movers ─────────────────────────────── */
export function tmgVsTraditionalMoversPage(): string {
  const title = "TMG Install vs Traditional Movers vs DIY — Which Is Best? (Singapore)";
  const description = "Comparing TMG Install's per-item installation against traditional movers and DIY assembly in Singapore: pricing transparency, booking, expertise, damage risk and speed.";
  const canonical = `${DOMAIN}/guides/tmg-install-vs-traditional-movers`;

  const faq = [
    { q: "Is TMG Install cheaper than traditional movers?", a: "For assembly and installation, usually yes — because you pay a fixed price per item with no hourly meter. Traditional movers often quote by the hour or as a bundled day rate, which makes the final cost harder to predict for an installation-focused job." },
    { q: "Should I assemble furniture myself or hire an installer?", a: "DIY saves money but costs time and risks damage to expensive pieces, especially PAX wardrobes and beds. A professional installer guarantees the job is built correctly, secured to the wall, and cleaned up — usually in a fraction of the time." },
    { q: "What is the difference between a mover and an installer?", a: "Movers transport boxes and furniture between addresses. An installer assembles, mounts and secures furniture. TMG Install specialises in installation and also offers relocation (dismantle at the old home, reinstall at the new one)." },
    { q: "Do I get a fixed price before booking?", a: "With TMG Install, yes — you see an itemised, upfront total online before you commit. Many traditional movers only confirm the final price after an on-site survey or once the job is done." },
  ];

  const schema = guideSchema(canonical, title, description, faq);

  const body = `
  <section class="hero">
    <div class="hero-badge">Updated ${GUIDE_UPDATED}</div>
    <h1><em>TMG Install</em> vs Traditional<br/>Movers vs DIY</h1>
    <p class="hero-desc">A side-by-side look at cost, transparency, expertise and risk — so you can pick the right option for your furniture in Singapore.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>The Short Answer</h2>
      <p>For assembling and installing furniture in Singapore, <strong>TMG Install</strong> gives you a fixed, itemised price upfront, specialist installers and wall-securing included. <strong>Traditional movers</strong> are best when you mainly need transport. <strong>DIY</strong> is cheapest but slowest and carries the highest risk of damage to costly pieces.</p>
    </div>

    <div class="section">
      <h2>Side-by-Side Comparison</h2>
      <table class="compare-table">
        <thead>
          <tr><th>What matters</th><th>TMG Install</th><th>Traditional Movers</th><th>DIY</th></tr>
        </thead>
        <tbody>
          <tr><td>Upfront fixed price</td><td><span class="compare-yes">Yes — itemised online</span></td><td>Often hourly / after survey</td><td>Free, but your time</td></tr>
          <tr><td>Booking</td><td>Online in ~60 seconds</td><td>Calls, quotes, surveys</td><td>—</td></tr>
          <tr><td>Assembly expertise</td><td><span class="compare-yes">Specialist installers</span></td><td>Varies by crew</td><td>Depends on you</td></tr>
          <tr><td>Wall-securing included</td><td><span class="compare-yes">Yes</span></td><td>Sometimes extra</td><td><span class="compare-no">DIY risk</span></td></tr>
          <tr><td>Damage risk</td><td>Low — insured</td><td>Low–medium</td><td><span class="compare-no">Higher</span></td></tr>
          <tr><td>Speed</td><td>Fast, same-day available</td><td>Scheduled days ahead</td><td>Slowest</td></tr>
          <tr><td>Best for</td><td>Assembly & installation</td><td>Whole-home transport</td><td>Simple, cheap items</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>When to Choose Each</h2>
      <h3>Choose TMG Install when…</h3>
      <p>You've bought furniture (IKEA, Taobao, Castlery, retail) and need it assembled, mounted and secured properly, with a price you can see before booking.</p>
      <h3>Choose traditional movers when…</h3>
      <p>Your main need is moving boxes and existing furniture between homes. For the assembly side of a move, TMG Install also offers a dismantle-and-reinstall relocation service.</p>
      <h3>Choose DIY when…</h3>
      <p>The item is small and simple, you have the time and tools, and it doesn't need wall-securing.</p>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      ${faq.map(f => `<div class="faq-item"><div class="faq-q">${f.q}</div><div class="faq-a">${f.a}</div></div>`).join("\n      ")}
    </div>

    ${guideCta()}

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "TMG Install vs Movers", section: "Guides" });
}

/* ── Guide 4: HDB vs Condo Moving in Singapore ──────────────────────────────── */
export function hdbVsCondoMovingPage(): string {
  const title = "HDB vs Condo Moving in Singapore — Rules, Permits & Costs (2026)";
  const description = "Moving into an HDB flat or a condo in Singapore? Compare lift booking, permits, timing rules, access and typical costs, plus how furniture installation fits in.";
  const canonical = `${DOMAIN}/guides/hdb-vs-condo-moving-singapore`;

  const faq = [
    { q: "What's the difference between moving into an HDB and a condo in Singapore?", a: "The biggest differences are access rules. Condos usually require you to book the service lift in advance, may charge a refundable deposit, and restrict moving to certain hours. HDB flats are generally more flexible but you still need to manage lift size, corridor access and timing with neighbours." },
    { q: "Do I need to book the lift to move into a condo?", a: "Almost always, yes. Most condo management offices require advance booking of the service (cargo) lift, sometimes with a deposit and padding installed. Check with your management office before your move date." },
    { q: "Are there time restrictions for moving in Singapore?", a: "Condos commonly restrict moving and renovation deliveries to weekday and Saturday daytime hours, with no Sundays or public holidays. HDB is more flexible, but being considerate of neighbours and avoiding late hours is expected." },
    { q: "How does furniture installation fit into a move?", a: "After your furniture arrives, TMG Install can assemble and secure everything the same day. For a full move, our relocation service dismantles at the old address and reinstalls at the new one, working around your lift booking window." },
  ];

  const schema = guideSchema(canonical, title, description, faq);

  const body = `
  <section class="hero">
    <div class="hero-badge">Updated ${GUIDE_UPDATED}</div>
    <h1>Moving Into an <em>HDB vs Condo</em><br/>in Singapore</h1>
    <p class="hero-desc">Lift booking, permits, timing rules, access and typical costs — plus how to get your furniture assembled the same day.</p>
    <div class="hero-btns">
      <a href="${CTA_URL}" class="btn-primary">Get an Instant Quote</a>
      <a href="${WHATSAPP}" class="btn-ghost">WhatsApp Us</a>
    </div>
  </section>
  ${trustBar()}
  <main class="content">

    <div class="section">
      <h2>The Short Answer</h2>
      <p>Moving into a <strong>condo</strong> usually means booking the service lift in advance, a possible refundable deposit, and restricted move-in hours. Moving into an <strong>HDB</strong> flat is generally more flexible, but you still plan around lift size and neighbours. In both, professional assembly gets your home set up the same day your furniture arrives.</p>
    </div>

    <div class="section">
      <h2>HDB vs Condo — Key Differences</h2>
      <table class="compare-table">
        <thead>
          <tr><th>Factor</th><th>HDB Flat</th><th>Condo / Private</th></tr>
        </thead>
        <tbody>
          <tr><td>Service lift booking</td><td>Usually not required</td><td><span class="compare-yes">Usually required in advance</span></td></tr>
          <tr><td>Deposit for move-in</td><td>Rare</td><td>Common (refundable)</td></tr>
          <tr><td>Move-in time limits</td><td>Flexible</td><td>Set hours, often no Sun/PH</td></tr>
          <tr><td>Lift padding</td><td>Not required</td><td>Often required</td></tr>
          <tr><td>Access</td><td>Corridors, common lift</td><td>Cargo lift, loading bay</td></tr>
          <tr><td>Management approval</td><td>Minimal</td><td>Management office sign-off</td></tr>
        </tbody>
      </table>
      <p style="margin-top:1rem;">Always confirm the exact rules with your HDB town council or condo management office before your move date.</p>
    </div>

    <div class="section">
      <h2>Planning Your Move</h2>
      <h3>1. Confirm access early</h3>
      <p>For a condo, book the service lift and ask about deposits, padding and allowed hours. For HDB, check lift dimensions for large items.</p>
      <h3>2. Schedule delivery and assembly together</h3>
      <p>Line up your furniture delivery and installation so everything is built and secured on the same day — no living around flat-pack boxes.</p>
      <h3>3. Use a relocation service for existing furniture</h3>
      <p>TMG Install can dismantle at your old home and reinstall at the new one, working within your lift-booking window.</p>
    </div>

    <div class="section">
      <h2>Frequently Asked Questions</h2>
      ${faq.map(f => `<div class="faq-item"><div class="faq-q">${f.q}</div><div class="faq-a">${f.a}</div></div>`).join("\n      ")}
    </div>

    ${guideCta()}

  </main>`;

  return shell({ title, description, canonical, schema, body, breadcrumb: "HDB vs Condo Moving", section: "Guides" });
}

export function sitemapXml(): string {
  const today = new Date().toISOString().slice(0, 10);
  const staticPages = [
    { loc: `${DOMAIN}/`,         priority: "1.0",  changefreq: "weekly"  },
    { loc: `${DOMAIN}/estimate`, priority: "0.95", changefreq: "monthly" },
    { loc: `${DOMAIN}/services`, priority: "0.95", changefreq: "monthly" },
  ];
  const legalPages = [
    { loc: `${DOMAIN}/terms`,    priority: "0.3",  changefreq: "yearly"  },
    { loc: `${DOMAIN}/privacy`,  priority: "0.3",  changefreq: "yearly"  },
  ];
  const servicePages = SERVICE_PAGES.map(p => ({
    loc: `${DOMAIN}/services/${p.slug}`,
    priority: p.priority.toString(),
    changefreq: "monthly",
  }));
  const guidePages = GUIDE_PAGES.map(p => ({
    loc: `${DOMAIN}/guides/${p.slug}`,
    priority: p.priority.toString(),
    changefreq: "monthly",
  }));
  const all = [...staticPages, ...servicePages, ...guidePages, ...legalPages];
  const urls = all.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
