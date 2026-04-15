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

function shell({
  title,
  description,
  canonical,
  schema,
  body,
  breadcrumb,
}: {
  title: string;
  description: string;
  canonical: string;
  schema: object[];
  body: string;
  breadcrumb: string;
}): string {
  const schemaJson = JSON.stringify(schema, null, 0);

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
  <meta property="og:image" content="${DOMAIN}/og-image.png" />
  <meta property="og:locale" content="en_SG" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${DOMAIN}/og-image.png" />
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
    .footer { background: #0f172a; color: #94a3b8; padding: 2rem 1.5rem; text-align: center; font-size: 0.85rem; }
    .footer a { color: #64748b; }
    .footer a:hover { color: #3b82f6; }
    .footer-links { display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; margin-top: 0.75rem; }

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
      <span>Services</span>
      <span>›</span>
      <span>${breadcrumb}</span>
    </div>
  </div>
  ${body}
  <footer class="footer">
    <div>© ${new Date().getFullYear()} The Moving Guy Pte Ltd (UEN 202424156H) · Singapore</div>
    <div class="footer-links">
      <a href="/">Home</a>
      <a href="${CTA_URL}">Get a Quote</a>
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
      <a href="mailto:${EMAIL}">${EMAIL}</a>
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
        { "@type": "Question", "name": "How much does IKEA assembly cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "IKEA assembly in Singapore starts from $60 per item. A PAX wardrobe is typically $80–$150 depending on size and configuration. Get an instant itemised quote at tmginstall.com/estimate." } },
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
        <div class="pricing-row"><span class="pricing-item">PAX Wardrobe (single, no doors)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">PAX Wardrobe (with doors)</span><span class="pricing-price">from $120</span></div>
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
      <div class="faq-item"><div class="faq-q">How much does IKEA assembly cost in Singapore?</div><div class="faq-a">Assembly starts from $40 per small item and $60–$150 for larger pieces like PAX wardrobes. Get an itemised quote instantly at tmginstall.com/estimate — no phone call needed.</div></div>
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
        { "@type": "Question", "name": "How much does wardrobe installation cost in Singapore?", "acceptedAnswer": { "@type": "Answer", "text": "Wardrobe installation in Singapore starts from $80. A standard 2-door wardrobe is typically $80–$120. Larger sliding door wardrobes or wall-mounted units are $150–$300 depending on size and complexity." } },
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
        <div class="pricing-row"><span class="pricing-item">IKEA PAX (single, no doors)</span><span class="pricing-price">from $80</span></div>
        <div class="pricing-row"><span class="pricing-item">IKEA PAX (with sliding doors)</span><span class="pricing-price">from $150</span></div>
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
      <div class="faq-item"><div class="faq-q">How much does wardrobe installation cost in Singapore?</div><div class="faq-a">Standard wardrobe installation starts from $80. IKEA PAX systems with sliding doors start from $150. Walk-in wardrobe systems from $250. All prices are upfront with no hidden charges.</div></div>
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
