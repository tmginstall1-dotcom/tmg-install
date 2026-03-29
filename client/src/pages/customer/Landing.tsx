import { Link } from "wouter";
import { motion } from "framer-motion";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";
import { useSEO } from "@/hooks/use-seo";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Package,
  Zap,
  MessageCircle,
  Shield,
  Clock,
  Building2,
  Home,
  Truck,
  Star,
  ChevronDown,
  Sofa,
  Monitor,
  Dumbbell,
  BedDouble,
  Wind,
  ChefHat,
  Plus,
  Minus,
  CalendarDays,
  Wrench,
  CreditCard,
  FileText,
  Mail,
  ScanSearch,
  ListChecks,
  Users,
  Receipt,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePromoBar } from "@/hooks/use-promo-bar";
import { SiFacebook, SiInstagram } from "react-icons/si";

const WHATSAPP = "https://wa.me/6580880757?text=Hi%2C+I%27d+like+a+furniture+installation+quote";

const fadeUp = {
  initial: { opacity: 0, y: 52 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

const fadeUpDelayed = (delay: number) => ({
  initial: { opacity: 0, y: 52 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-8% 0px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1], delay },
});

const MARQUEE_ITEMS = [
  "Wardrobe Installation",
  "Bed Frame Assembly",
  "Office Fit-Out",
  "Furniture Dismantling",
  "IKEA Assembly",
  "Gym Equipment",
  "Kitchen Cabinets",
  "Sofa Relocation",
  "HDB · Condo · Landed",
  "Blind & Curtain Fitting",
  "Commercial Spaces",
  "Same-Week Scheduling",
];

const SERVICES = [
  { icon: BedDouble,  label: "Beds & Frames",      count: "40+" },
  { icon: Package,    label: "Wardrobes",           count: "60+" },
  { icon: Monitor,    label: "Office Furniture",    count: "80+" },
  { icon: Sofa,       label: "Sofas & Lounges",     count: "30+" },
  { icon: Dumbbell,   label: "Gym Equipment",       count: "50+" },
  { icon: ChefHat,    label: "Kitchen Furniture",   count: "45+" },
  { icon: Wind,       label: "Blinds & Curtains",   count: "35+" },
  { icon: Truck,      label: "Appliance Relocation", count: "20+" },
];

const PRICING_SAMPLES = [
  { item: "IKEA Hemnes Wardrobe (3-door)",   install: 120, dismantle: 90,  relocate: 180 },
  { item: "Queen Bed Frame",                 install: 80,  dismantle: 60,  relocate: 120 },
  { item: "2-Seater Sofa",                   install: 60,  dismantle: 45,  relocate: 110 },
  { item: "Corner / L-Shaped Study Desk",    install: 80,  dismantle: 60,  relocate: 130 },
  { item: "Treadmill",                       install: 80,  dismantle: 60,  relocate: 140 },
  { item: "Kitchen Hutch / Pantry Cabinet",  install: 80,  dismantle: 60,  relocate: 120 },
  { item: "Roller Blind (per window)",       install: 50,  dismantle: 30,  relocate: 70  },
  { item: "L-Shaped Executive Desk",         install: 100, dismantle: 80,  relocate: 160 },
];


const FAQS = [
  {
    q: "How is the price calculated?",
    a: "We use a fixed-price catalog of 250+ furniture items. Select exactly what needs to be installed, dismantled, or relocated and the total is generated instantly — no guesswork, no surprise charges.",
  },
  {
    q: "Do you cover all of Singapore?",
    a: "Yes. We serve all 28 districts including HDB towns, condominiums, landed properties, shophouses, offices, and commercial or industrial premises.",
  },
  {
    q: "How quickly can you schedule a job?",
    a: "Same-week appointments are often available. After you receive your estimate, you'll choose a preferred date and we'll confirm via WhatsApp.",
  },
  {
    q: "Do I need to provide any tools or materials?",
    a: "No. Our team arrives with all necessary tools and equipment. Just let us know what needs to be done and we'll handle everything.",
  },
  {
    q: "What if I need to cancel or reschedule?",
    a: "Just message us on WhatsApp as early as possible. We're flexible for reasonable reschedules with adequate notice.",
  },
  {
    q: "Can you handle large commercial or office jobs?",
    a: "Absolutely. We regularly handle full office fit-outs, workstation installations, partition setups, and large-scale strip-outs. Just describe your requirements in the estimate wizard or WhatsApp us directly.",
  },
  {
    q: "Do you install IKEA furniture?",
    a: "Yes — IKEA assembly is one of our most common requests. Wardrobes, beds, PAX systems, KALLAX shelving, kitchen units, and more. Our team works from the instruction manual or from experience, whichever is faster.",
  },
  {
    q: "Do you work on weekends and public holidays?",
    a: "Yes. We operate 7 days a week including weekends and most public holidays. Availability depends on current bookings — just let us know your preferred date and we'll confirm.",
  },
  {
    q: "Can you dismantle and dispose of my old furniture?",
    a: "Yes. We offer dismantling combined with disposal — bulky furniture is brought down and removed from your premises. Just select 'Dismantle + Dispose' when building your estimate, or mention it when you WhatsApp us.",
  },
];

const STATIC_TESTIMONIALS = [
  {
    name: "Darren L.",
    loc: "Tampines",
    stars: 5,
    date: "Feb 2026",
    text: "Booked for wardrobe installation and they were done in under two hours. Very professional, no mess left behind. Price was exactly as quoted — will use again for my second unit.",
  },
  {
    name: "Mei Ling T.",
    loc: "Bishan",
    stars: 5,
    date: "Jan 2026",
    text: "Got a quote via WhatsApp in minutes. Team arrived on time and assembled our IKEA PAX wardrobe perfectly. No hidden charges — completely transparent from start to finish.",
  },
  {
    name: "Ravi K.",
    loc: "Raffles Place",
    stars: 5,
    date: "Mar 2026",
    text: "Used TMG for a full office fit-out — 20 workstations, overhead cabinets, boardroom table. Efficient team, competitive pricing, and they cleaned up thoroughly afterwards.",
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-black/8">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-sm font-semibold text-black pr-6 leading-snug group-hover:text-black/70 transition-colors">
          {q}
        </span>
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {open ? <Minus className="w-4 h-4 text-black/40" /> : <Plus className="w-4 h-4 text-black/40" />}
        </span>
      </button>
      {open && (
        <div className="pb-5 pr-8">
          <p className="font-body text-sm text-gray-500 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function Landing() {
  usePageTracker("/");
  const { visible: promoVisible } = usePromoBar();
  const [pricingTab, setPricingTab] = useState<"install" | "dismantle" | "relocate">("install");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 320);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { data: reviewConfig } = useQuery<{ writeUrl: string; viewUrl: string }>({
    queryKey: ["/api/public/google-review"],
    staleTime: 5 * 60 * 1000,
  });
  const { data: testimonials = [] } = useQuery<{ name: string; loc: string; stars: number; date: string; text: string }[]>({
    queryKey: ["/api/public/testimonials"],
    staleTime: 5 * 60 * 1000,
  });

  useSEO({
    title: "TMG Install | Furniture Installation, Dismantling & Relocation Singapore",
    description: "Singapore's furniture installation specialists. Wardrobe assembly, bed frame installation, office fit-outs, gym equipment & more. Instant itemised quote in 60 seconds. Island-wide coverage — HDB, condo, landed, commercial.",
    canonical: "https://tmginstall.com/",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": FAQS.map(({ q, a }) => ({
          "@type": "Question",
          "name": q,
          "acceptedAnswer": { "@type": "Answer", "text": a },
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": "Furniture Installation & Relocation Singapore",
        "provider": {
          "@type": "LocalBusiness",
          "name": "TMG Install",
          "telephone": "+6580880757",
          "url": "https://tmginstall.com",
        },
        "areaServed": { "@type": "Country", "name": "Singapore" },
        "serviceType": [
          "Furniture Installation",
          "Furniture Dismantling",
          "Furniture Relocation",
          "Office Fit-Out",
          "IKEA Assembly",
          "Wardrobe Installation",
          "Bed Frame Assembly",
          "Gym Equipment Installation",
        ],
        "offers": {
          "@type": "Offer",
          "priceCurrency": "SGD",
          "description": "Fixed-price catalog of 250+ furniture items. Instant upfront quote.",
        },
      },
    ],
  });

  return (
    <div className={`min-h-screen bg-white text-black ${promoVisible ? "pt-24" : "pt-14"}`}>

      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-24 pb-32 lg:pt-36 lg:pb-52">
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] opacity-[0.03]"
            style={{ background: "radial-gradient(circle at top right, #000 0%, transparent 70%)" }} />
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── LEFT: Copy ── */}
            <motion.div {...fadeUp}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-black/15 bg-black/[0.03] mb-8">
                <Zap className="w-3.5 h-3.5 text-black" />
                <span className="text-[10px] font-black tracking-[0.18em] text-black uppercase">
                  Singapore's Furniture Installation Specialists
                </span>
              </div>

              <h1 className="hero-title text-black mb-6">
                Installation,<br />Dismantling &amp;<br />Relocation.
              </h1>

              <p className="font-body text-base sm:text-lg text-gray-500 mb-10 leading-relaxed max-w-md">
                From a single wardrobe to a full office fit-out — TMG Install
                handles every job across Singapore with transparent, upfront pricing.
                Get your quote in under 60 seconds, no calls required.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/estimate"
                  data-testid="hero-cta-guided"
                  onClick={() => trackEvent("cta_click", "/", "hero_get_estimate")}
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white font-black text-xs uppercase tracking-[0.12em] hover:bg-neutral-800 transition-colors"
                >
                  GET ESTIMATE <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="hero-cta-whatsapp"
                  onClick={() => trackEvent("cta_click", "/", "hero_whatsapp")}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border border-black/20 text-black font-black text-xs uppercase tracking-[0.12em] hover:border-black/60 hover:bg-gray-50 transition-all"
                >
                  <MessageCircle className="w-4 h-4" /> WHATSAPP US
                </a>
              </div>

              {/* ── Micro-trust line ── */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-4 mb-3">
                {[
                  "No calls required",
                  "Instant itemised quote",
                  "Upfront pricing — no hidden fees",
                ].map(t => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-black/40 font-body">
                    <CheckCircle2 className="w-3 h-3 text-black/30 flex-shrink-0" />
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-8">
                <span className="flex items-center gap-1.5 text-xs text-black/35 font-body">
                  <Shield className="w-3 h-3 text-black/25 flex-shrink-0" />
                  ACRA Registered · UEN 202424156H
                </span>
                <span className="flex items-center gap-1.5 text-xs text-black/35 font-body">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  Online now · Typically replies in ~5 min
                </span>
              </div>

              {/* Trust row — desktop */}
              <div className="hidden sm:flex flex-wrap gap-x-8 gap-y-3">
                {[
                  { icon: Building2, label: "HDB / Condo / Office / Commercial" },
                  { icon: MapPin, label: "All Singapore Districts" },
                  { icon: Clock, label: "Flexible Same-Week Scheduling" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-black/40 flex-shrink-0" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {/* Mobile stats strip */}
              <div className="sm:hidden grid grid-cols-3 gap-3 pt-2">
                {[
                  { val: "250+", label: "Items" },
                  { val: "60s",  label: "Quote" },
                  { val: "SG",   label: "Island-wide" },
                ].map(({ val, label }) => (
                  <div key={label} className="border border-black/10 p-3 text-center">
                    <div className="font-heading font-bold text-2xl leading-none text-black mb-1">{val}</div>
                    <div className="text-[10px] font-semibold text-black/40 uppercase tracking-wider">{label}</div>
                  </div>
                ))}
              </div>

              {/* Mobile hero photo */}
              <div className="sm:hidden mt-6 relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
                <img
                  src="/work/office-fitout.jpg"
                  alt="Office furniture installation by TMG Install"
                  loading="eager"
                  width="560"
                  height="315"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <span className="text-[9px] font-black tracking-[0.18em] uppercase text-white/45">Recent Work</span>
                  <p className="text-sm font-bold text-white leading-tight">Office Fit-Out · CBD Commercial</p>
                </div>
              </div>
            </motion.div>

            {/* ── RIGHT: Visual Quote Card (desktop only) ── */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              className="hidden lg:block"
            >
              <div className="relative">
                <div className="absolute inset-0 translate-x-3 translate-y-3 border border-black/8 bg-black/[0.02]" />
                <div className="relative bg-white border border-black/12 shadow-[0_8px_48px_rgba(0,0,0,0.08)]">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-black/8">
                    <div>
                      <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase" style={{ letterSpacing: "0.15em" }}>
                        Estimate
                      </p>
                      <p className="font-heading font-bold text-black text-lg leading-tight">TMG-INSTANT</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 border border-black/12 bg-black/[0.02]">
                      <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                      <span className="text-[10px] font-semibold text-black tracking-widest uppercase" style={{ letterSpacing: "0.1em" }}>AI Generated</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-black/35 font-semibold uppercase mb-1" style={{ letterSpacing: "0.12em" }}>Service Type</p>
                        <div className="flex flex-wrap gap-1.5">
                          {["Installation", "Dismantling", "Relocation"].map(s => (
                            <span key={s} className={`text-[10px] px-2 py-0.5 border font-semibold tracking-wide ${s === "Installation" ? "border-black/20 bg-black text-white" : "border-black/12 text-black/45"}`}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-black/[0.025] border border-black/6">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-black/40 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] text-black/35 font-semibold uppercase mb-0.5" style={{ letterSpacing: "0.1em" }}>Location</p>
                          <p className="text-xs text-black font-medium">22 Tampines Industrial Ave 4, #04-01</p>
                          <p className="text-xs text-black/40">Singapore 528763</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-black/35 font-semibold uppercase" style={{ letterSpacing: "0.12em" }}>Items <span className="text-black/25">— 3 selected</span></p>
                        <Package className="w-3.5 h-3.5 text-black/20" />
                      </div>
                      <div className="space-y-1.5">
                        {[
                          { name: "3-Door Wardrobe", qty: 2, price: "$110" },
                          { name: "Queen Bed Frame", qty: 1, price: "$80" },
                          { name: "L-Shaped Desk",   qty: 1, price: "$65" },
                        ].map(item => (
                          <div key={item.name} className="flex items-center justify-between py-2 border-b border-black/5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-black/25 font-mono w-4">×{item.qty}</span>
                              <span className="text-xs text-black font-medium">{item.name}</span>
                            </div>
                            <span className="text-xs font-semibold text-black">{item.price}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border border-black/8 p-4 space-y-2">
                      {[
                        { label: "Subtotal",  val: "$255.00" },
                        { label: "Transport", val: "$120.00" },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between text-xs text-black/50">
                          <span>{r.label}</span><span>{r.val}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-black/8 flex justify-between">
                        <span className="text-xs font-bold text-black uppercase tracking-wide">Total Estimate</span>
                        <span className="text-sm font-bold text-black">$375.00</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1 py-3 bg-black text-center text-xs font-semibold text-white tracking-widest uppercase cursor-default select-none" style={{ letterSpacing: "0.12em" }}>
                        Pay Deposit
                      </div>
                      <div className="px-4 py-3 border border-black/15 text-center flex items-center justify-center cursor-default select-none">
                        <MessageCircle className="w-3.5 h-3.5 text-black/40" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════ MARQUEE TICKER ════════════════════════ */}
      <div className="border-t border-b border-black/8 bg-black overflow-hidden py-3.5 select-none">
        <div className="marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center gap-4 px-6">
              <span className="text-[10px] font-black tracking-[0.18em] uppercase text-white/60 whitespace-nowrap">
                {item}
              </span>
              <span className="w-1 h-1 bg-white/20 flex-shrink-0" />
            </span>
          ))}
        </div>
      </div>

      {/* ═══════════════════════ TRUST STRIP ═══════════════════════ */}
      <section className="border-b border-black/8 bg-black/[0.018] px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x sm:divide-black/8">
            {[
              { icon: Shield,    label: "Experienced Installers",   sub: "Skilled & professional team" },
              { icon: Zap,       label: "Upfront Pricing",          sub: "No hidden costs, ever" },
              { icon: Clock,     label: "Fast Scheduling",          sub: "Same-week availability" },
              { icon: Building2, label: "Residential & Commercial", sub: "HDB, condo, office & more" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="sm:px-8 first:pl-0 last:pr-0 flex items-start sm:items-center gap-3">
                <Icon className="w-4 h-4 text-black/40 mt-0.5 sm:mt-0 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-black">{label}</p>
                  <p className="text-xs text-black/40 font-body mt-0.5">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ WORK GALLERY ════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="flex items-end justify-between gap-4 mb-8 flex-wrap">
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-2" style={{ letterSpacing: "0.2em" }}>
                Our Work
              </p>
              <h2 className="section-title text-black">Real jobs. Real results.</h2>
            </div>
            <Link
              href="/estimate"
              onClick={() => trackEvent("cta_click", "/", "gallery_estimate")}
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-black border-b border-black/30 pb-0.5 hover:border-black transition-colors whitespace-nowrap flex-shrink-0"
            >
              Get your quote <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.div>

          {/* ── Desktop: editorial 2-tier layout ── */}
          <div className="hidden sm:flex flex-col gap-px">
            {/* Row 1: featured wide + side */}
            <div className="grid gap-px" style={{ gridTemplateColumns: "3fr 2fr" }}>
              {[
                { src: "/work/office-fitout.jpg",         label: "Office Fit-Out",        sub: "Sit-stand workstations & overhead cabinets", tag: "Commercial",   w: 720, h: 405 },
                { src: "/work/wardrobe-install-team.jpg", label: "Wardrobe Installation", sub: "Two-man crew · Large sliding wardrobe",       tag: "Residential",  w: 480, h: 270 },
              ].map(({ src, label, sub, tag, w, h }, i) => (
                <motion.div
                  key={src}
                  {...fadeUpDelayed(i * 0.06)}
                  className="relative overflow-hidden bg-neutral-900 group"
                  style={{ aspectRatio: "16/9" }}
                >
                  <img
                    src={src}
                    alt={label}
                    loading="eager"
                    decoding="sync"
                    fetchPriority="high"
                    width={w}
                    height={h}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] opacity-85 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <span className="inline-block text-[9px] font-black tracking-[0.2em] uppercase text-white/40 mb-1.5">{tag}</span>
                    <p className="text-base font-bold text-white leading-tight mb-1">{label}</p>
                    <p className="text-xs text-white/50 font-body">{sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            {/* Row 2: four equal thumbnails */}
            <div className="grid grid-cols-4 gap-px">
              {[
                { src: "/work/shelving-assembly.jpg", label: "IKEA Assembly",       sub: "Kallax shelving · HDB",          tag: "Residential" },
                { src: "/work/office-pod.jpg",         label: "Office Phone Booth",  sub: "CBD commercial fit-out",         tag: "Commercial"  },
                { src: "/work/wardrobe-oak.jpg",       label: "Wardrobe Install",    sub: "2-door with drawers · Oak",     tag: "Completed"   },
                { src: "/work/conference-table.jpg",   label: "Conference Table",    sub: "Boardroom · Cable management",   tag: "Commercial"  },
              ].map(({ src, label, sub, tag }, i) => (
                <motion.div
                  key={src}
                  {...fadeUpDelayed(0.12 + i * 0.06)}
                  className="relative overflow-hidden bg-neutral-900 group aspect-square"
                >
                  <img
                    src={src}
                    alt={label}
                    loading="lazy"
                    decoding="async"
                    width="280"
                    height="280"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06] opacity-80 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <span className="inline-block text-[9px] font-black tracking-[0.18em] uppercase text-white/40 mb-1">{tag}</span>
                    <p className="text-xs font-bold text-white leading-tight">{label}</p>
                    <p className="text-[10px] text-white/45 font-body">{sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Mobile: horizontal scroll strip ── */}
          <div className="sm:hidden -mx-4 px-4">
            <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-none">
              {[
                { src: "/work/office-fitout.jpg",         label: "Office Fit-Out",        sub: "Workstations & overhead cabinets", tag: "Commercial" },
                { src: "/work/shelving-assembly.jpg",     label: "IKEA Assembly",         sub: "New HDB home · Two-man crew",     tag: "Residential" },
                { src: "/work/office-pod.jpg",            label: "Office Phone Booth",    sub: "CBD commercial fit-out",           tag: "Commercial" },
                { src: "/work/wardrobe-install-team.jpg", label: "Wardrobe Installation", sub: "Large sliding wardrobe",           tag: "Residential" },
                { src: "/work/wardrobe-oak.jpg",          label: "Wardrobe Installation", sub: "2-door with drawers · Oak",       tag: "Completed" },
                { src: "/work/conference-table.jpg",      label: "Conference Table",      sub: "Cable management included",        tag: "Commercial" },
                { src: "/work/wardrobe-white.jpg",        label: "Wardrobe Installation", sub: "2-door with drawers · White",     tag: "Completed" },
                { src: "/work/delivery-truck.jpg",        label: "On-Site Delivery",      sub: "Tools brought every job",          tag: "Every Job" },
              ].map(({ src, label, sub, tag }, i) => (
                <div
                  key={src}
                  className="relative flex-shrink-0 w-56 overflow-hidden bg-neutral-900 snap-start aspect-[3/4] rounded-none"
                >
                  <img
                    src={src}
                    alt={label}
                    loading={i < 2 ? "eager" : "lazy"}
                    decoding={i < 2 ? "sync" : "async"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    width="224"
                    height="298"
                    className="absolute inset-0 w-full h-full object-cover opacity-85"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <span className="inline-block text-[9px] font-black tracking-[0.16em] uppercase text-white/45 mb-1">{tag}</span>
                    <p className="text-xs font-bold text-white leading-tight mb-0.5">{label}</p>
                    <p className="text-[10px] text-white/50 font-body">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-black/30 font-body mt-2 text-center">← scroll to see more →</p>
          </div>
        </div>
      </section>

      {/* ════════════════════ WHAT WE HANDLE ══════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-12">
            <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
              Our Catalog
            </p>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h2 className="section-title text-black">What we handle.</h2>
              <Link
                href="/estimate"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-black border-b border-black/30 pb-0.5 hover:border-black transition-colors whitespace-nowrap"
              >
                Browse full catalog <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-black/8">
            {SERVICES.map(({ icon: Icon, label, count }, i) => (
              <Link
                key={label}
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", `service_card_${label.toLowerCase().replace(/\s+/g, "_")}`)}
              >
                <motion.div
                  {...fadeUpDelayed(i * 0.06)}
                  className="bg-white p-7 group hover:bg-black hover:text-white transition-colors duration-300 cursor-pointer"
                >
                  <Icon className="w-5 h-5 text-black/30 group-hover:text-white/40 mb-5 transition-colors" />
                  <p className="text-sm font-semibold text-black group-hover:text-white transition-colors leading-snug mb-1">
                    {label}
                  </p>
                  <p className="text-[11px] text-black/30 group-hover:text-white/30 transition-colors font-mono">
                    {count} items
                  </p>
                  <p className="text-[10px] font-semibold text-black/25 group-hover:text-white/25 mt-3 uppercase tracking-wide transition-colors flex items-center gap-1">
                    Get quote <ArrowRight className="w-2.5 h-2.5" />
                  </p>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════ BOOKING FLOW ══════════════════════ */}
      <section className="bg-white px-4 sm:px-6 lg:px-8 py-28 border-t border-black/8">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <motion.div {...fadeUpDelayed(0)} className="mb-16">
            <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
              The Full Booking Flow
            </p>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h2 className="section-title text-black">From enquiry to job done.</h2>
              <Link
                href="/estimate"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-black border-b border-black/30 pb-0.5 hover:border-black transition-colors whitespace-nowrap"
              >
                Start now <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
            <p className="font-body text-sm text-gray-500 mt-4 max-w-xl leading-relaxed">
              Four simple phases — from choosing your service to final payment. Every stage is transparent, online, and confirmed in writing.
            </p>
          </motion.div>

          {/* ── 4-Step TL;DR Summary Strip ── */}
          <motion.div {...fadeUpDelayed(0.04)} className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-black/8 mb-14">
            {[
              { step: "01", label: "Get Quote",     desc: "60-second estimate online", icon: FileText },
              { step: "02", label: "We Review",     desc: "Admin verifies & confirms",  icon: ScanSearch },
              { step: "03", label: "Pay Deposit",   desc: "Secure Stripe · 50% upfront", icon: CreditCard },
              { step: "04", label: "Job Done",      desc: "Crew on-site, balance after",  icon: CheckCircle2 },
            ].map(({ step, label, desc, icon: Icon }) => (
              <div key={step} className="bg-white p-5 group hover:bg-black/[0.03] transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-black tracking-[0.2em] text-black/25 uppercase" style={{ letterSpacing: "0.2em" }}>Step {step}</span>
                  <div className="flex-1 h-px bg-black/6" />
                  <Icon className="w-3.5 h-3.5 text-black/20" />
                </div>
                <p className="font-heading font-bold text-black text-sm mb-1">{label}</p>
                <p className="text-[11px] text-gray-400 font-body leading-relaxed">{desc}</p>
              </div>
            ))}
          </motion.div>

          {/* ══════════ DESKTOP LAYOUT ══════════ */}
          <div className="hidden lg:block space-y-0">

            {/* ── Phase 1: YOU DO ONLINE ── */}
            <motion.div {...fadeUpDelayed(0.04)} className="flex items-center gap-3 mb-4">
              <span className="text-[9px] font-black tracking-[0.2em] uppercase text-black/40 px-2.5 py-1 border border-black/10 bg-black/[0.025] flex-shrink-0">
                Step 1–4 &nbsp;·&nbsp; You complete online
              </span>
              <div className="flex-1 h-px bg-black/8" />
            </motion.div>

            <div className="grid grid-cols-4 gap-px bg-black/8 mb-6">
              {([
                { n: "01", icon: ListChecks,  title: "Choose Your Service",   body: "Select installation, dismantling, or relocation — or any combination. Covers home, office, and commercial.",   tag: "Service type"    },
                { n: "02", icon: MapPin,       title: "Enter Your Location",   body: "Your Singapore address. All HDB, condo, landed, shophouse, and commercial premises across every district.",     tag: "Island-wide"     },
                { n: "03", icon: Package,      title: "Select Items",          body: "Pick from 250+ items — beds, wardrobes, workstations, gym equipment, blinds, appliances, and more.",            tag: "250+ catalog"    },
                { n: "04", icon: CalendarDays, title: "Choose Date & Time",    body: "Select your preferred appointment window. Same-week slots are usually available — we confirm quickly.",          tag: "Same-week slots" },
              ] as const).map(({ n, icon: Icon, title, body, tag }, i) => (
                <motion.div key={n} {...fadeUpDelayed(0.06 + i * 0.07)} className="bg-white p-8 group hover:bg-black/[0.018] transition-colors duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-heading font-bold text-[52px] leading-none text-black/[0.05] select-none group-hover:text-black/10 transition-colors">{n}</span>
                    <div className="w-9 h-9 border border-black/12 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-black/40" />
                    </div>
                  </div>
                  <h3 className="card-title text-black mb-2">{title}</h3>
                  <p className="font-body text-sm text-gray-500 leading-relaxed mb-4">{body}</p>
                  <span className="inline-flex text-[10px] font-semibold px-2.5 py-1 border border-black/10 text-black/40 tracking-wide">{tag}</span>
                </motion.div>
              ))}
            </div>

            {/* ── Phase 2: WE PREPARE ── */}
            <motion.div {...fadeUpDelayed(0.34)} className="flex items-center gap-3 mb-4">
              <span className="text-[9px] font-black tracking-[0.2em] uppercase text-black/40 px-2.5 py-1 border border-black/10 bg-black/[0.025] flex-shrink-0">
                Step 5–7 &nbsp;·&nbsp; We prepare your booking
              </span>
              <div className="flex-1 h-px bg-black/8" />
            </motion.div>

            <div className="grid grid-cols-3 gap-px bg-black/8 mb-6">
              {([
                {
                  n: "05", icon: FileText,
                  title: "Estimate Generated",
                  body: "An itemised quote is produced instantly — every item priced individually. Transport, floor, and access surcharges are listed separately so there are no surprises.",
                  tag: "Instant & itemised",
                  dark: false,
                },
                {
                  n: "06", icon: ScanSearch,
                  title: "Admin Review & Approval",
                  body: "Our team reviews your submission, verifies the scope of work, resolves any questions, and greenlights the job before sending payment details.",
                  tag: "Team verified",
                  dark: false,
                },
                {
                  n: "07", icon: Mail,
                  title: "Deposit Invoice — Pay via Stripe",
                  body: "A deposit invoice is emailed to you with a secure Stripe payment link. Click to pay 50% online by card. Your time slot is held for 48 hours.",
                  tag: "Secure · Stripe · 50% deposit",
                  dark: false,
                },
              ] as const).map(({ n, icon: Icon, title, body, tag, dark }, i) => (
                <motion.div key={n} {...fadeUpDelayed(0.36 + i * 0.07)} className={`p-8 group transition-colors duration-300 ${dark ? "bg-black hover:bg-neutral-900" : "bg-white hover:bg-black/[0.018]"}`}>
                  <div className="flex items-start justify-between mb-6">
                    <span className={`font-heading font-bold text-[52px] leading-none select-none transition-colors ${dark ? "text-white/[0.06] group-hover:text-white/10" : "text-black/[0.05] group-hover:text-black/10"}`}>{n}</span>
                    <div className={`w-9 h-9 border flex items-center justify-center flex-shrink-0 ${dark ? "border-white/15" : "border-black/12"}`}>
                      <Icon className={`w-4 h-4 ${dark ? "text-white/50" : "text-black/40"}`} />
                    </div>
                  </div>
                  <h3 className={`card-title mb-2 ${dark ? "text-white" : "text-black"}`}>{title}</h3>
                  <p className={`font-body text-sm leading-relaxed mb-4 ${dark ? "text-white/45" : "text-gray-500"}`}>{body}</p>
                  <span className={`inline-flex text-[10px] font-semibold px-2.5 py-1 border tracking-wide ${dark ? "border-white/15 text-white/40" : "border-black/10 text-black/40"}`}>{tag}</span>
                </motion.div>
              ))}
            </div>

            {/* ── Phase 3: JOB DAY & COMPLETION ── */}
            <motion.div {...fadeUpDelayed(0.6)} className="flex items-center gap-3 mb-4">
              <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/50 px-2.5 py-1 border border-white/10 bg-white/[0.06] flex-shrink-0">
                Step 8–10 &nbsp;·&nbsp; Job day & completion
              </span>
              <div className="flex-1 h-px bg-white/10" />
            </motion.div>

            <div className="grid grid-cols-3 gap-px bg-white/8">
              {([
                {
                  n: "08", icon: CheckCircle2,
                  title: "Booking Confirmed",
                  body: "Once deposit clears, your booking is locked. You receive a confirmation email with your appointment date, time window, and job reference number.",
                  tag: "Confirmed by email",
                },
                {
                  n: "09", icon: Users,
                  title: "Crew Arrives & Completes",
                  body: "Our experienced team shows up at your door on time with all tools and equipment. Just direct us — we handle everything from start to finish.",
                  tag: "Tools included",
                },
                {
                  n: "10", icon: Receipt,
                  title: "Final Payment — Pay via Stripe",
                  body: "After the job is complete, a final invoice is emailed with a secure Stripe payment link. Pay the remaining 50% online by card. Receipt issued instantly.",
                  tag: "Secure · Stripe · Balance due",
                },
              ] as const).map(({ n, icon: Icon, title, body, tag }, i) => (
                <motion.div key={n} {...fadeUpDelayed(0.62 + i * 0.07)} className="bg-black p-8 group hover:bg-neutral-900 transition-colors duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-heading font-bold text-[52px] leading-none text-white/[0.06] select-none group-hover:text-white/10 transition-colors">{n}</span>
                    <div className="w-9 h-9 border border-white/15 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-white/50" />
                    </div>
                  </div>
                  <h3 className="card-title text-white mb-2">{title}</h3>
                  <p className="font-body text-sm text-white/45 leading-relaxed mb-4">{body}</p>
                  <span className="inline-flex text-[10px] font-semibold px-2.5 py-1 border border-white/15 text-white/40 tracking-wide">{tag}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ══════════ MOBILE LAYOUT ══════════ */}
          <div className="lg:hidden">
            <div className="relative pl-12">
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-black/10" />

              {([
                { n: "01", icon: ListChecks,   title: "Choose Your Service",          body: "Installation, dismantling, or relocation — home, office, commercial.",                                                                    tag: "Service type",                    dark: false },
                { n: "02", icon: MapPin,        title: "Enter Your Location",          body: "All Singapore districts — HDB, condo, landed, office, commercial.",                                                                         tag: "Island-wide",                     dark: false },
                { n: "03", icon: Package,       title: "Select Items",                 body: "250+ item catalog — beds, wardrobes, workstations, gym equipment, and more.",                                                               tag: "250+ catalog",                    dark: false },
                { n: "04", icon: CalendarDays,  title: "Choose Date & Time",           body: "Pick your preferred slot. Same-week availability most weeks.",                                                                              tag: "Same-week",                       dark: false },
                { n: "05", icon: FileText,      title: "Estimate Generated",           body: "Instant itemised quote — every item and fee listed clearly.",                                                                               tag: "Instant & itemised",              dark: false },
                { n: "06", icon: ScanSearch,    title: "Admin Review & Approval",      body: "Our team checks the scope and verifies everything before sending payment.",                                                                 tag: "Team verified",                   dark: false },
                { n: "07", icon: Mail,          title: "Deposit Invoice via Email",    body: "Email with a secure Stripe payment link. Pay 50% online by card — slot held 48 hrs.",                                                      tag: "Stripe · 50% deposit",            dark: true  },
                { n: "08", icon: CheckCircle2,  title: "Booking Confirmed",            body: "Deposit cleared — booking locked. Confirmation email with date, time, and job reference.",                                                  tag: "Confirmed by email",              dark: true  },
                { n: "09", icon: Users,         title: "Crew Arrives & Completes",     body: "Team arrives on time with all tools. We handle everything — you just direct us.",                                                           tag: "Tools included",                  dark: true  },
                { n: "10", icon: Receipt,       title: "Final Payment via Email",      body: "Job done — final invoice emailed with a Stripe link. Pay the remaining 50% online. Receipt issued instantly.",                              tag: "Stripe · Balance due",            dark: true  },
              ] as const).map(({ n, icon: Icon, title, body, tag, dark }, i) => (
                <motion.div key={n} {...fadeUpDelayed(i * 0.05)} className="relative flex gap-0 mb-5 last:mb-0">
                  <div className={`absolute -left-12 top-0 w-9 h-9 border flex items-center justify-center flex-shrink-0 z-10 ${dark ? "bg-black border-black/25" : "bg-white border-black/12"}`}>
                    <Icon className={`w-3.5 h-3.5 ${dark ? "text-white/55" : "text-black/40"}`} />
                  </div>
                  <div className={`flex-1 p-4 border ${dark ? "bg-black border-black/20" : "bg-white border-black/8"}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${dark ? "text-white/20" : "text-black/20"}`} style={{ letterSpacing: "0.2em" }}>Step {n}</p>
                    <h3 className={`card-title mb-1.5 ${dark ? "text-white" : "text-black"}`}>{title}</h3>
                    <p className={`font-body text-xs leading-relaxed mb-2.5 ${dark ? "text-white/40" : "text-gray-500"}`}>{body}</p>
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 border tracking-wide ${dark ? "border-white/12 text-white/35" : "border-black/10 text-black/35"}`}>{tag}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── CTA ── */}
          <motion.div {...fadeUpDelayed(0.8)} className="mt-14 pt-10 border-t border-black/8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-black mb-1">Ready to begin?</p>
              <p className="text-xs text-gray-400 font-body">Use the online wizard or WhatsApp us — both generate your full estimate in under 60 seconds.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "booking_flow_estimate")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-black text-xs uppercase tracking-[0.12em] hover:bg-neutral-800 transition-colors"
              >
                Get Estimate <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("cta_click", "/", "booking_flow_whatsapp")}
                className="inline-flex items-center gap-2 px-6 py-3 border border-black/20 text-black font-black text-xs uppercase tracking-[0.12em] hover:border-black/50 hover:bg-gray-50 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════ WHY TMG INSTALL ═══════════════════ */}
      <section className="bg-black px-4 sm:px-6 lg:px-8 py-28">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-16">
            <p className="text-[10px] font-semibold tracking-widest text-white/30 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
              Why Choose Us
            </p>
            <h2 className="section-title text-white">Built for every job.</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/8">
            {[
              {
                icon: Building2,
                title: "Office & Commercial",
                body: "Workstations, sit-stand desks, partitions, ergonomic chairs, reception counters — full office fits and strip-outs.",
              },
              {
                icon: Home,
                title: "Home & Residential",
                body: "Beds, wardrobes, gym equipment, kitchen furniture, blinds, appliance relocation — all property types across Singapore.",
              },
              {
                icon: Truck,
                title: "End-to-End Relocation",
                body: "We dismantle, wrap, shift, and reinstall your furniture within the same unit, building, or across town.",
              },
              {
                icon: MessageCircle,
                title: "Direct Team Updates",
                body: "WhatsApp updates straight from your assigned crew. No call centres, no chasing — just real communication.",
              },
            ].map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                {...fadeUpDelayed(i * 0.08)}
                className="bg-black p-8 border border-white/8 hover:border-white/18 transition-colors duration-300 group"
              >
                <div className="w-8 h-8 border border-white/15 flex items-center justify-center mb-7 group-hover:border-white/30 transition-colors">
                  <Icon className="w-3.5 h-3.5 text-white/50" />
                </div>
                <h3 className="card-title text-white mb-3">{title}</h3>
                <p className="font-body text-sm text-white/40 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ SOCIAL PROOF ══════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)}>
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
                  Customer Reviews
                </p>
                <h2 className="section-title text-black">What our clients say.</h2>
              </div>
              {/* Google rating badge */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-black text-black" />
                  ))}
                </div>
                <div>
                  <p className="text-sm font-black text-black leading-tight">
                    5.0 · Google Reviews
                  </p>
                  <p className="text-[11px] text-black/40 font-body">Verified on Google</p>
                </div>
              </div>
            </div>

            {/* Review cards — use API testimonials if available, else static fallback */}
            {(() => {
              const displayReviews = testimonials.length > 0 ? testimonials : STATIC_TESTIMONIALS;
              return (
              <div
                className={`grid gap-5 mb-10 ${
                  displayReviews.length === 1
                    ? "grid-cols-1 max-w-xl"
                    : displayReviews.length === 2
                    ? "grid-cols-1 sm:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-3"
                }`}
              >
                {displayReviews.map((r, i) => (
                  <motion.div
                    key={i}
                    {...fadeUpDelayed(i * 0.08)}
                    className="border border-black/8 bg-white p-6 flex flex-col"
                    data-testid={`review-card-${i}`}
                  >
                    {/* Stars */}
                    <div className="flex gap-0.5 mb-4">
                      {[...Array(r.stars)].map((_, j) => (
                        <Star key={j} className="w-3.5 h-3.5 fill-black text-black" />
                      ))}
                    </div>
                    {/* Text */}
                    <p className="font-body text-sm text-gray-600 leading-relaxed flex-1 mb-5">
                      &ldquo;{r.text}&rdquo;
                    </p>
                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-black/6">
                      <div>
                        <p className="text-xs font-semibold text-black">{r.name}</p>
                        <p className="text-[11px] text-black/40 font-body">{r.loc} · {r.date}</p>
                      </div>
                      {/* Google G colour mark */}
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-label="Google" className="flex-shrink-0">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                    </div>
                  </motion.div>
                ))}
              </div>
              );
            })()}

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={reviewConfig?.viewUrl || "https://g.page/r/Cd2v7iBjl_GKEBM"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("cta_click", "/", "google_reviews_view")}
                data-testid="btn-read-reviews"
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white font-black text-xs uppercase tracking-[0.12em] hover:bg-black/80 transition-colors"
              >
                <Star className="w-3.5 h-3.5" /> Read on Google
              </a>
              <a
                href={reviewConfig?.writeUrl || "https://g.page/r/Cd2v7iBjl_GKEBM/review"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("cta_click", "/", "google_reviews_write")}
                data-testid="btn-write-review"
                className="group inline-flex items-center gap-2 px-6 py-3 border border-black/20 text-black font-black text-xs uppercase tracking-[0.12em] hover:border-black/60 hover:bg-gray-50 transition-all"
              >
                Write a Review <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════ CONFIDENCE STATS ═════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-px bg-black/8">
            {[
              {
                stat: "250+",
                label: "Item Catalog",
                body: "Beds, wardrobes, sofas, office furniture, gym equipment, kitchen pieces, blinds, appliances — all priced upfront.",
              },
              {
                stat: "SG",
                label: "Island-Wide",
                body: "All 28 districts — HDB, condo, landed, shophouse, commercial, and industrial premises.",
              },
              {
                stat: "60s",
                label: "Instant Quote",
                body: "Select your items and get a full, itemised quote with transport in under a minute — no calls, no waiting.",
              },
            ].map(({ stat, label, body }, i) => (
              <motion.div
                key={label}
                {...fadeUpDelayed(i * 0.1)}
                className="bg-white p-10 group hover:bg-neutral-50 transition-colors"
                data-testid={`stat-card-${i}`}
              >
                <div className="stat-display text-black mb-3" data-testid={`stat-number-${i}`}>{stat}</div>
                <div className="w-8 h-px bg-black/20 mb-4" />
                <h3 className="card-title text-black mb-2">{label}</h3>
                <p className="font-body text-sm text-gray-500 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════ PRICING GUIDE ════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-10">
            <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
              Transparent Pricing
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h2 className="section-title text-black">
                Install, dismantle<br className="hidden sm:block" /> or relocate — all priced upfront.
              </h2>
              <p className="font-body text-sm text-gray-500 max-w-sm leading-relaxed">
                Fixed-price catalog of 250+ furniture items. Every service type priced individually per item — no guesswork, no surprise charges.
              </p>
            </div>
          </motion.div>

          {/* ── Mobile Tab Switcher ── */}
          <div className="lg:hidden mb-5">
            <div className="flex border border-black/12 bg-white">
              {(["install", "dismantle", "relocate"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPricingTab(tab)}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${pricingTab === tab ? "bg-black text-white" : "text-black/40 hover:text-black/70"}`}
                >
                  {tab === "install" ? "Install" : tab === "dismantle" ? "Dismantle" : "Relocate"}
                </button>
              ))}
            </div>
            {pricingTab === "relocate" && (
              <p className="text-[10px] text-black/40 font-body mt-2 px-1">
                Relocation includes dismantling at origin + reinstallation at destination.
              </p>
            )}
          </div>

          {/* ── Desktop: 3-Column Comparison Table ── */}
          <motion.div {...fadeUpDelayed(0.08)} className="hidden lg:block border border-black/10 bg-white overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-black/10 bg-black/[0.025]">
              <div className="px-6 py-4">
                <span className="text-[10px] font-semibold tracking-widest text-black/35 uppercase" style={{ letterSpacing: "0.15em" }}>Furniture Item</span>
              </div>
              {[
                { label: "Installation",  sub: "Assemble & fix in place" },
                { label: "Dismantling",   sub: "Take apart & remove" },
                { label: "Relocation",    sub: "Dismantle + move + reinstall", highlight: true },
              ].map(({ label, sub, highlight }) => (
                <div key={label} className={`px-6 py-4 border-l border-black/8 ${highlight ? "bg-black text-white" : ""}`}>
                  <p className={`text-[10px] font-black tracking-[0.12em] uppercase mb-0.5 ${highlight ? "text-white" : "text-black"}`}>{label}</p>
                  <p className={`text-[10px] font-body ${highlight ? "text-white/45" : "text-black/35"}`}>{sub}</p>
                </div>
              ))}
            </div>
            {PRICING_SAMPLES.map(({ item, install, dismantle, relocate }, i) => (
              <div
                key={item}
                className={`grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-black/5 last:border-0 hover:bg-black/[0.018] transition-colors ${i % 2 !== 0 ? "bg-black/[0.012]" : "bg-white"}`}
              >
                <div className="px-6 py-4 flex items-center">
                  <span className="text-sm text-black font-medium">{item}</span>
                </div>
                <div className="px-6 py-4 border-l border-black/5 flex items-center">
                  <span className="text-sm font-semibold text-black">${install}</span>
                </div>
                <div className="px-6 py-4 border-l border-black/5 flex items-center">
                  <span className="text-sm font-semibold text-black">${dismantle}</span>
                </div>
                <div className="px-6 py-4 border-l border-black/5 flex items-center bg-black/[0.04]">
                  <span className="text-sm font-bold text-black">${relocate}</span>
                </div>
              </div>
            ))}
            <div className="px-6 py-4 border-t border-black/8 bg-black/[0.02] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="font-body text-xs text-black/40">
                Sample prices per item (SGD). Transport surcharge, floor level, and access fees quoted separately. 250+ items in the full catalog — get an exact quote below.
              </p>
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "pricing_table_estimate")}
                className="group flex-shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 bg-black text-white text-[10px] font-black uppercase tracking-[0.12em] hover:bg-neutral-800 transition-colors"
              >
                Get Full Quote <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>

          {/* ── Mobile: Single Column by Tab ── */}
          <motion.div {...fadeUpDelayed(0.08)} className="lg:hidden border border-black/10 bg-white overflow-hidden">
            {PRICING_SAMPLES.map(({ item, install, dismantle, relocate }, i) => (
              <div
                key={item}
                className={`flex items-center justify-between px-4 py-4 border-b border-black/5 last:border-0 ${i % 2 !== 0 ? "bg-black/[0.012]" : ""}`}
              >
                <span className="text-sm text-black font-medium pr-4">{item}</span>
                <span className="text-sm font-bold text-black flex-shrink-0">
                  ${pricingTab === "install" ? install : pricingTab === "dismantle" ? dismantle : relocate}
                </span>
              </div>
            ))}
            <div className="px-4 py-4 border-t border-black/8 bg-black/[0.02]">
              <p className="font-body text-xs text-black/40 mb-3">
                Sample prices per item (SGD). Transport surcharge added separately.
              </p>
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "pricing_table_mobile_estimate")}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-black text-white text-[10px] font-black uppercase tracking-[0.12em] hover:bg-neutral-800 transition-colors"
              >
                Get Full Quote <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════ FAQ ═══════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-black/8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-[1fr_2fr] gap-16">
            <motion.div {...fadeUpDelayed(0)}>
              <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-3" style={{ letterSpacing: "0.2em" }}>
                FAQ
              </p>
              <h2 className="section-title text-black mb-4">Common questions.</h2>
              <p className="font-body text-sm text-gray-500 leading-relaxed">
                Can't find your answer? WhatsApp us — we reply fast.
              </p>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-black border-b border-black/30 pb-0.5 hover:border-black transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> Ask via WhatsApp
              </a>
            </motion.div>

            <motion.div {...fadeUpDelayed(0.1)} className="border-t border-black/8">
              {FAQS.map((faq) => (
                <FAQItem key={faq.q} {...faq} />
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═════════════════════ BOTTOM CTA BAND ═════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-28">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="max-w-2xl">
            <p className="text-[10px] font-semibold tracking-widest text-black/35 uppercase mb-4" style={{ letterSpacing: "0.2em" }}>
              Ready to start?
            </p>
            <h2 className="section-title text-black mb-6">
              Get your quote<br />in under 60 seconds.
            </h2>
            <p className="font-body text-base text-gray-500 mb-10 max-w-md leading-relaxed">
              No account needed. No phone calls. Select your items, confirm your address, and receive a full itemised quote with transport included.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href="/estimate"
                data-testid="bottom-cta-estimate"
                onClick={() => trackEvent("cta_click", "/", "bottom_get_estimate")}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-black text-white font-black text-xs uppercase tracking-[0.12em] hover:bg-neutral-800 transition-colors"
              >
                GET ESTIMATE <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="bottom-cta-whatsapp"
                onClick={() => trackEvent("cta_click", "/", "bottom_whatsapp")}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white border border-black/20 text-black font-black text-xs uppercase tracking-[0.12em] hover:border-black/60 hover:bg-gray-50 transition-all"
              >
                <MessageCircle className="w-4 h-4" /> WHATSAPP US
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════ FOOTER ═══════════════════════════ */}
      <footer className="bg-black text-white px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-14">
            <div className="md:col-span-2">
              <h3 className="brand-title text-white mb-4">TMG INSTALL</h3>
              <p className="font-body text-white/35 text-sm leading-relaxed max-w-xs">
                Professional furniture installation, dismantling, and relocation across all of Singapore —
                HDB, condo, landed, office, and commercial. Transparent pricing, no hidden fees.
              </p>
              <p className="font-body text-white/20 text-xs mt-3">
                The Moving Guy Pte Ltd · UEN: 202424156H
              </p>
              <div className="flex gap-3 mt-6">
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-white/15 text-white/60 text-xs font-medium hover:border-white/35 hover:text-white transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <Link
                  href="/estimate"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors"
                >
                  Get Estimate
                </Link>
              </div>
            </div>

            <div>
              <h4 className="font-body font-semibold text-white/60 text-[10px] tracking-widest uppercase mb-5" style={{ letterSpacing: "0.18em" }}>
                Contact
              </h4>
              <div className="space-y-3">
                <p className="font-body text-sm">
                  <span className="text-white/35">WhatsApp</span><br />
                  <a href={WHATSAPP} className="text-white hover:text-white/70 transition-colors">+65 8088 0757</a>
                </p>
                <p className="font-body text-sm">
                  <span className="text-white/35">Email</span><br />
                  <a href="mailto:sales@tmginstall.com" className="text-white hover:text-white/70 transition-colors">sales@tmginstall.com</a>
                </p>
                <div className="flex gap-3 pt-1">
                  <a
                    href="https://www.facebook.com/tmginstall"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TMG Install on Facebook"
                    className="w-8 h-8 border border-white/15 flex items-center justify-center text-white/40 hover:text-white hover:border-white/40 transition-all"
                  >
                    <SiFacebook className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="https://www.instagram.com/tmginstall"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TMG Install on Instagram"
                    className="w-8 h-8 border border-white/15 flex items-center justify-center text-white/40 hover:text-white hover:border-white/40 transition-all"
                  >
                    <SiInstagram className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-body font-semibold text-white/60 text-[10px] tracking-widest uppercase mb-5" style={{ letterSpacing: "0.18em" }}>
                Legal
              </h4>
              <div className="space-y-3">
                <p><Link href="/privacy" className="font-body text-sm text-white/50 hover:text-white transition-colors">Privacy Policy</Link></p>
                <p><Link href="/terms" className="font-body text-sm text-white/50 hover:text-white transition-colors">Terms of Service</Link></p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/8 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="font-body text-white/20 text-xs">
              © {new Date().getFullYear()} The Moving Guy Pte Ltd · UEN: 202424156H · Singapore
            </p>
            <a
              href="https://www.google.com/search?q=TMG+Install+Singapore+reviews"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/25 text-xs font-body hover:text-white/50 transition-colors"
            >
              Google Reviews →
            </a>
          </div>
        </div>
      </footer>

      {/* ══════════════ STICKY MOBILE BOTTOM BAR ══════════════════ */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 sm:hidden transition-transform duration-300 ${
          scrolled ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-black border-t border-white/10 px-4 py-3 flex items-center gap-3">
          <Link
            href="/estimate"
            data-testid="sticky-cta-estimate"
            onClick={() => trackEvent("cta_click", "/", "sticky_bar_estimate")}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white text-black font-black text-xs uppercase tracking-[0.12em]"
          >
            GET ESTIMATE <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="sticky-cta-whatsapp"
            onClick={() => trackEvent("cta_click", "/", "sticky_bar_whatsapp")}
            className="flex items-center justify-center gap-2 px-5 py-3.5 border border-white/20 text-white flex-shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* ══════════════ FLOATING WHATSAPP BUTTON (desktop) ═════════ */}
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="floating-whatsapp"
        onClick={() => trackEvent("cta_click", "/", "floating_whatsapp")}
        className={`fixed bottom-6 right-6 z-40 hidden sm:flex items-center gap-2.5 px-5 py-3 bg-[#25D366] text-white font-black text-xs uppercase tracking-wide shadow-[0_4px_24px_rgba(37,211,102,0.35)] hover:bg-[#1fb854] hover:shadow-[0_4px_28px_rgba(37,211,102,0.5)] transition-all duration-300 ${
          scrolled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3 pointer-events-none"
        }`}
      >
        <MessageCircle className="w-4 h-4" />
        WhatsApp Us
      </a>
    </div>
  );
}
