import { Link } from "wouter";
import { PricingConfig } from "@shared/pricing";
import { motion, AnimatePresence } from "framer-motion";
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
  Truck,
  Star,
  Sofa,
  Monitor,
  Dumbbell,
  BedDouble,
  Wind,
  ChefHat,
  Plus,
  CalendarDays,
  CreditCard,
  FileText,
  ScanSearch,
  ListChecks,
  Receipt,
  Globe,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePromoBar } from "@/hooks/use-promo-bar";
import { SiFacebook, SiInstagram } from "react-icons/si";
import PageBgScene from "@/components/ui/page-bg-scene";

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

const fadeFromLeft = (delay: number) => ({
  initial: { opacity: 0, x: -60, y: 12 },
  whileInView: { opacity: 1, x: 0, y: 0 },
  viewport: { once: true, margin: "-6% 0px" },
  transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1], delay },
});

const fadeFromRight = (delay: number) => ({
  initial: { opacity: 0, x: 60, y: 12 },
  whileInView: { opacity: 1, x: 0, y: 0 },
  viewport: { once: true, margin: "-6% 0px" },
  transition: { duration: 0.75, ease: [0.16, 1, 0.3, 1], delay },
});

const scaleIn = (delay: number) => ({
  initial: { opacity: 0, scale: 0.86 },
  whileInView: { opacity: 1, scale: 1 },
  viewport: { once: true, margin: "-6% 0px" },
  transition: { duration: 0.7, ease: [0.34, 1.56, 0.64, 1], delay },
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
  { item: "IKEA Hemnes Wardrobe (3-door)",   install: 120, dismantle: 90  },
  { item: "Queen Bed Frame",                 install: 80,  dismantle: 60  },
  { item: "2-Seater Sofa",                   install: 60,  dismantle: 45  },
  { item: "Corner / L-Shaped Study Desk",    install: 80,  dismantle: 60  },
  { item: "Treadmill",                       install: 80,  dismantle: 60  },
  { item: "Kitchen Hutch / Pantry Cabinet",  install: 80,  dismantle: 60  },
  { item: "Roller Blind (per window)",       install: 50,  dismantle: 30  },
  { item: "L-Shaped Executive Desk",         install: 100, dismantle: 80  },
];


const FAQS = [
  {
    q: "How is the price calculated?",
    a: "We use a fixed-price catalog of 250+ furniture items. Installation and dismantling jobs include a one-time $60 mobilisation & coordination fee per appointment (covers crew dispatch, transport & logistics), plus per-item labor from the catalog. Relocation jobs use transport pricing from $58 (first 3 km, 1 helper included) with no mobilisation fee. Relocating furniture with dismantle & reinstall gets a 40% bundle discount — you pay 60% of the combined install + dismantle price. Everything is itemised in your quote — no guesswork, no surprise charges.",
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

function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return { count, ref };
}

function TiltCard({
  children,
  className = "",
  intensity = 13,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.transform = `perspective(700px) rotateX(${-y * intensity}deg) rotateY(${x * intensity}deg) scale3d(1.025,1.025,1.025)`;
    card.style.boxShadow = `${x * -8}px ${y * -8}px 30px rgba(0,0,0,0.15)`;
  }, [intensity]);

  const onMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
    card.style.boxShadow = "";
  }, []);

  return (
    <div
      ref={cardRef}
      className={className}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ transition: "transform 0.18s ease, box-shadow 0.18s ease", transformStyle: "preserve-3d" }}
    >
      {children}
    </div>
  );
}

function MagneticButton({
  children,
  className = "",
  strength = 0.30,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setOffset({
      x: (e.clientX - rect.left - rect.width  / 2) * strength,
      y: (e.clientY - rect.top  - rect.height / 2) * strength,
    });
  }, [strength]);

  const onMouseLeave = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  return (
    <motion.div
      ref={ref}
      /* flex on mobile → fills full width in flex-col; inline-flex on sm+ */
      className={`flex sm:inline-flex w-full sm:w-auto ${className}`}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      animate={{ x: offset.x, y: offset.y }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
    >
      {children}
    </motion.div>
  );
}

function TrustStripAnimated() {
  const c250 = useCountUp(250, 1800);
  const c60 = useCountUp(60, 1400);
  const c7 = useCountUp(7, 900);

  return (
    <section className="border-b border-white/8 px-4 sm:px-6 lg:px-8 py-14 sm:py-20 relative overflow-hidden">
      {/* Subtle amber shimmer rule at top */}
      <div className="absolute top-0 left-8 right-8 amber-shimmer-line opacity-50" />
      {/* Subtle amber orb centre */}
      <div className="ambient-orb" style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "600px", height: "200px", background: "radial-gradient(ellipse at 50% 50%, rgba(251,191,36,0.06) 0%, transparent 70%)" }} />
      <div className="max-w-6xl mx-auto relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-0 md:divide-x md:divide-white/10">
          {/* 250+ */}
          <div className="md:px-8 first:pl-0 flex flex-col gap-1.5 items-center md:items-start text-center md:text-left">
            <div className="flex items-baseline gap-1">
              <span ref={c250.ref} className="stat-display text-amber-gradient">{c250.count}</span>
              <span className="font-heading font-bold text-2xl leading-none text-amber-400/60">+</span>
            </div>
            <p className="text-xs font-bold text-white tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>Items in Catalog</p>
            <p className="text-[11px] text-white/40 font-body">Fixed price, zero surprises</p>
          </div>
          {/* 60s */}
          <div className="md:px-8 flex flex-col gap-1.5 items-center md:items-start text-center md:text-left">
            <div className="flex items-baseline gap-1">
              <span ref={c60.ref} className="stat-display text-amber-gradient">{c60.count}</span>
              <span className="font-heading font-bold text-xl leading-none text-amber-400/60">s</span>
            </div>
            <p className="text-xs font-bold text-white tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>Quote Time</p>
            <p className="text-[11px] text-white/40 font-body">No calls, no waiting</p>
          </div>
          {/* 7× */}
          <div className="md:px-8 flex flex-col gap-1.5 items-center md:items-start text-center md:text-left">
            <div className="flex items-baseline gap-1">
              <span ref={c7.ref} className="stat-display text-amber-gradient">{c7.count}</span>
              <span className="font-heading font-bold text-xl leading-none text-amber-400/60">×/wk</span>
            </div>
            <p className="text-xs font-bold text-white tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>Days Available</p>
            <p className="text-[11px] text-white/40 font-body">Weekends &amp; holidays</p>
          </div>
          {/* 5★ */}
          <div className="md:px-8 last:pr-0 flex flex-col gap-1.5 items-center md:items-start text-center md:text-left">
            <div className="flex items-baseline gap-1">
              <span className="stat-display text-amber-gradient">5</span>
              <span className="font-heading font-bold text-2xl leading-none text-amber-400/60">★</span>
            </div>
            <p className="text-xs font-bold text-white tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>Google Rating</p>
            <p className="text-[11px] text-white/40 font-body">ACRA Reg · UEN 202424156H</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b transition-colors duration-300 ${open ? "border-amber-400/30" : "border-white/10 hover:border-white/20"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between py-6 sm:py-8 text-left group outline-none"
        data-testid={`faq-toggle-${q.slice(0, 20).toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span className={`text-base sm:text-lg font-semibold pr-8 leading-snug transition-colors duration-200 ${open ? "text-amber-400" : "text-white/80 group-hover:text-white"}`}>
          {q}
        </span>
        <motion.span
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 mt-0.5 ${open ? "bg-amber-400/10" : "bg-white/5 group-hover:bg-white/10"}`}
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {open ? <Plus className="w-4 h-4 text-amber-400" /> : <Plus className="w-4 h-4 text-white/60" />}
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            <div className="pb-8 pr-12">
              <p className="font-body text-base sm:text-lg text-white/60 leading-relaxed">{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CN = {
  badge:    "新加坡家具安装专家",
  h1a:      "专业家具",
  h1b:      "安装服务",
  h1c:      "让您的新家更完美",
  sub:      "一站式家具安装 · 拆除 · 搬运服务。超过250种固定报价，即时透明，无隐藏费用。",
  cta1:     "立即获取报价",
  cta2:     "WhatsApp咨询",
};
const EN = {
  badge:    "Singapore's Furniture Installation Specialists",
  h1a:      "Professional",
  h1b:      "Installation",
  h1c:      "For Your Home",
  sub:      "Full-service furniture installation, dismantling & relocation. 250+ fixed catalog prices — instant, transparent, no hidden fees.",
  cta1:     "Get Your Estimate",
  cta2:     "WhatsApp Us",
};

export default function Landing() {
  usePageTracker("/");
  const { visible: promoVisible } = usePromoBar();
  const [pricingTab, setPricingTab] = useState<"install" | "dismantle" | "relocate">("install");
  const [scrolled, setScrolled] = useState(false);
  const [lang, setLang] = useState<"en" | "cn">(() => {
    try { return (localStorage.getItem("tmg_lang") as "en" | "cn") || "en"; } catch { return "en"; }
  });
  const t = lang === "cn" ? CN : EN;
  const switchLang = () => setLang(l => {
    const next = l === "en" ? "cn" : "en";
    try { localStorage.setItem("tmg_lang", next); } catch {}
    return next;
  });

  /* DOM refs for scroll-driven elements — updated via RAF, no React re-renders */
  const scrollBarRef        = useRef<HTMLDivElement>(null);
  const amberOverlayRef     = useRef<HTMLDivElement>(null);
  const scrollHintRef       = useRef<HTMLDivElement>(null);
  const dismantleBadgeRef   = useRef<HTMLDivElement>(null);
  const dismantleBadgeTextRef = useRef<HTMLSpanElement>(null);
  /* threshold ref so setScrolled only fires twice */
  const scrolledRef         = useRef(false);

  useEffect(() => {
    const rafRef = { current: 0 };
    let dirty = true;
    const onScroll = () => { dirty = true; };
    window.addEventListener("scroll", onScroll, { passive: true });

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      if (!dirty) return;
      dirty = false;

      const sy  = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const sp  = max > 0 ? Math.min(1, sy / max) : 0;

      /* scrolled threshold — only triggers a React re-render when crossing 320px */
      const nowScrolled = sy > 320;
      if (nowScrolled !== scrolledRef.current) {
        scrolledRef.current = nowScrolled;
        setScrolled(nowScrolled);
      }

      /* scroll progress bar */
      if (scrollBarRef.current) {
        scrollBarRef.current.style.width = `${sp * 100}%`;
      }

      /* amber overlay */
      const dismantleP = Math.min(1, sp / 0.80);
      const overlayAlpha = Math.max(0, Math.min(1, dismantleP * 1.6 - 0.22));
      if (amberOverlayRef.current) {
        amberOverlayRef.current.style.opacity = String(overlayAlpha);
      }

      /* CSS custom properties for glass section transparency */
      document.documentElement.style.setProperty("--section-alpha",  Math.max(0.74, 0.88 - dismantleP * 0.14).toFixed(3));
      document.documentElement.style.setProperty("--dark-alpha",     Math.max(0.70, 0.85 - dismantleP * 0.15).toFixed(3));
      document.documentElement.style.setProperty("--marquee-alpha",  Math.max(0.58, 0.75 - dismantleP * 0.17).toFixed(3));

      /* dismantle percentage (0-100) */
      const pct = Math.round(Math.min(100, (sp / 0.75) * 100));

      /* scroll hint — fade out once scroll begins */
      if (scrollHintRef.current) {
        scrollHintRef.current.style.opacity = pct > 12 ? "0" : "1";
      }

      /* dismantle badge */
      if (dismantleBadgeRef.current) {
        dismantleBadgeRef.current.style.display = pct > 2 ? "flex" : "none";
        if (dismantleBadgeTextRef.current) {
          dismantleBadgeTextRef.current.textContent =
            pct >= 100 ? "dismantled" : `dismantling ${pct}%`;
        }
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const { data: reviewConfig } = useQuery<{ writeUrl: string; viewUrl: string }>({
    queryKey: ["/api/public/google-review"],
    staleTime: 5 * 60 * 1000,
  });
  const { data: testimonials = [] } = useQuery<{ name: string; loc: string; stars: number; date: string; text: string }[]>({
    queryKey: ["/api/public/testimonials"],
    staleTime: 5 * 60 * 1000,
  });

  const { data: recentJobs = [] } = useQuery<{ label: string }[]>({
    queryKey: ["/api/public/recent-jobs"],
    staleTime: 2 * 60 * 1000,
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
    <div className={`min-h-screen bg-transparent text-white ${promoVisible ? "pt-24" : "pt-14"}`}>

      {/* ═══ SCROLL PROGRESS BAR ═══ */}
      <div
        data-testid="scroll-progress-track"
        className="fixed left-0 right-0 z-[48] pointer-events-none"
        style={{ top: promoVisible ? "80px" : "56px" }}
      >
        <div
          ref={scrollBarRef}
          data-testid="scroll-progress-bar"
          className="h-[2px]"
          style={{
            width: "0%",
            background: "linear-gradient(to right, #f59e0b, #f97316, #fbbf24)",
            boxShadow: "0 0 10px rgba(245, 158, 11, 0.8)",
          }}
        />
      </div>

      {/* ══════ FULL-PAGE 3D BACKGROUND ══════ */}
      <PageBgScene />

      {/* ── Warm amber dismantle wash — fades in as scroll deepens ── */}
      <div
        ref={amberOverlayRef}
        data-testid="amber-overlay"
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 130% 90% at 50% 30%, rgba(245, 158, 11, 0.20) 0%, rgba(251, 146, 60, 0.08) 48%, transparent 80%)",
          opacity: 0,
          zIndex: 2,
        }}
      />

      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-24 sm:pb-32 lg:pt-36 lg:pb-52">
        <div className="absolute inset-0 pointer-events-none select-none">
          {/* subtle vignette top */}
          <div className="absolute top-0 inset-x-0 h-40 opacity-60"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)" }} />
          {/* vignette sides */}
          <div className="absolute inset-y-0 left-0 w-32 opacity-30"
            style={{ background: "linear-gradient(to right, rgba(0,0,0,0.8) 0%, transparent 100%)" }} />
          <div className="absolute inset-y-0 right-0 w-32 opacity-30"
            style={{ background: "linear-gradient(to left, rgba(0,0,0,0.8) 0%, transparent 100%)" }} />
          {/* bottom fade to transparent so marquee (bg-black) connects smoothly */}
          <div className="absolute bottom-0 inset-x-0 h-48"
            style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,4,0.7) 100%)" }} />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── LEFT: Copy ── */}
            <motion.div {...fadeUp} className="max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
              {/* Language toggle + Premium badge pill */}
              <div className="flex items-center justify-center lg:justify-start gap-3 mb-6 sm:mb-8 flex-wrap">
                <div className="hero-badge-pill">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-black tracking-[0.16em] text-amber-300 uppercase">
                    {t.badge}
                  </span>
                </div>
                <button
                  onClick={switchLang}
                  data-testid="button-lang-toggle"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 transition-colors text-xs font-bold text-white/80 hover:text-white backdrop-blur-sm"
                  title={lang === "en" ? "切换到中文" : "Switch to English"}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {lang === "en" ? "中文" : "EN"}
                </button>
              </div>

              {/* Amber accent line */}
              <div className="hidden lg:flex items-center gap-3 mb-6">
                <div className="w-12 h-1 bg-amber-400" />
                <div className="w-4 h-1 bg-amber-400/40" />
              </div>

              <h1 className="hero-title text-gradient-warm mb-6 sm:mb-8 tracking-tighter">
                {lang === "cn"
                  ? <>{t.h1a}<br />{t.h1b}<br />{t.h1c}</>
                  : <>Installation,<br />Dismantling &amp;<br />Relocation.</>}
              </h1>

              <p className="font-body text-base sm:text-xl text-white/70 mb-6 sm:mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
                {t.sub}
              </p>

              {/* ── Urgency CTA strip ── */}
              <div
                data-testid="urgency-slots-banner"
                className="inline-flex items-center gap-2 mb-8 sm:mb-10 px-4 py-2 rounded-none border border-amber-400/40 bg-amber-400/10 backdrop-blur-sm"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-amber-300 tracking-wide">
                  Book This Week — Limited Installation Slots
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <MagneticButton className="w-full sm:w-auto">
                  <Link
                    href="/estimate"
                    data-testid="hero-cta-guided"
                    onClick={() => trackEvent("cta_click", "/", "hero_get_estimate")}
                    className="group flex w-full items-center justify-center gap-3 px-8 sm:px-10 py-5 sm:py-4 bg-amber-400 text-black font-black text-sm sm:text-xs uppercase tracking-[0.15em] hover:bg-amber-300 amber-glow-btn rounded-none"
                  >
                    {t.cta1} <ArrowRight className="w-5 h-5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </MagneticButton>
                <MagneticButton className="w-full sm:w-auto">
                  <a
                    href={WHATSAPP}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="hero-cta-whatsapp"
                    onClick={() => trackEvent("cta_click", "/", "hero_whatsapp")}
                    className="flex w-full items-center justify-center gap-2 px-8 sm:px-10 py-5 sm:py-4 border-2 border-white/20 text-white font-black text-sm sm:text-xs uppercase tracking-[0.15em] hover:border-amber-400 hover:bg-amber-400/10 transition-all backdrop-blur-sm rounded-none"
                  >
                    <MessageCircle className="w-5 h-5 sm:w-4 sm:h-4" /> {t.cta2}
                  </a>
                </MagneticButton>
              </div>

              {/* ── Micro-trust line ── */}
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 mt-8 mb-4">
                {[
                  "Instant itemised quote",
                  "Upfront pricing",
                ].map(t => (
                  <span key={t} className="flex items-center gap-2 text-sm sm:text-xs text-white/50 font-body font-medium">
                    <CheckCircle2 className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400/60 flex-shrink-0" />
                    {t}
                  </span>
                ))}
              </div>
              
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 mb-10">
                <span className="flex items-center gap-2 text-sm sm:text-xs text-white/50 font-body font-medium">
                  <Shield className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400/60 flex-shrink-0" />
                  ACRA Registered
                </span>
                <span className="flex items-center gap-2 text-sm sm:text-xs text-white/50 font-body font-medium">
                  <span className="w-2 h-2 sm:w-1.5 sm:h-1.5 rounded-full bg-green-400 flex-shrink-0 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                  Online now
                </span>
              </div>

              {/* Trust row — desktop */}
              <div className="hidden sm:flex flex-wrap items-center gap-x-8 gap-y-3 pt-6 border-t border-white/10">
                {[
                  { icon: Building2, label: "HDB / Condo / Commercial" },
                  { icon: MapPin, label: "Island-wide" },
                  { icon: Clock, label: "Same-Week Scheduling" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 text-sm font-medium text-white/60">
                    <Icon className="w-4 h-4 text-amber-400/70" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              {/* Mobile stats strip */}
              <div className="sm:hidden grid grid-cols-3 gap-2 mt-2 border-t border-white/10 pt-8">
                {[
                  { val: "250+", label: "Items" },
                  { val: "60s",  label: "Quote" },
                  { val: "SG",   label: "Coverage" },
                ].map(({ val, label }) => (
                  <div key={label} className="bg-white/5 border border-white/10 p-4 text-center rounded-lg backdrop-blur-md">
                    <div className="font-heading font-bold text-2xl text-white mb-1">{val}</div>
                    <div className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest">{label}</div>
                  </div>
                ))}
              </div>

              {/* Mobile hero photo */}
              <div className="sm:hidden mt-8 relative overflow-hidden rounded-xl border border-white/10" style={{ aspectRatio: "16/9" }}>
                <img
                  src="/work/office-fitout.jpg"
                  alt="Office furniture installation by TMG Install"
                  loading="eager"
                  width="560"
                  height="315"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <span className="inline-block px-2 py-1 bg-amber-400 text-black text-[9px] font-black tracking-[0.15em] uppercase mb-2">Recent Work</span>
                  <p className="text-base font-bold text-white leading-tight">Office Fit-Out · CBD Commercial</p>
                </div>
              </div>
            </motion.div>

            {/* ── RIGHT: Glass stats card (desktop only, floats over 3D bg) ── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              className="hidden lg:flex flex-col gap-6 float-anim"
            >
              {/* Main glass card */}
              <div className="glass-card-premium relative overflow-hidden p-10 rounded-2xl">
                {/* Amber shimmer sweep across top */}
                <div className="absolute top-0 left-0 right-0 amber-shimmer-line" />
                {/* Amber corner accents */}
                <div className="absolute top-0 left-0 w-32 h-1 bg-amber-400/80" />
                <div className="absolute top-0 left-0 w-1 h-32 bg-amber-400/80" />
                <div className="absolute bottom-0 right-0 w-32 h-1 bg-amber-400/30" />
                <div className="absolute bottom-0 right-0 w-1 h-32 bg-amber-400/30" />
                {/* Ambient amber orb inside card */}
                <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none" style={{ background: "radial-gradient(circle at 70% 20%, rgba(251,191,36,0.15) 0%, transparent 65%)" }} />

                <div className="flex items-center gap-3 mb-10">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_10px_rgba(251,191,36,0.8)]" />
                  <span className="text-xs font-black text-amber-400 tracking-[0.25em] uppercase">Live Pricing Engine</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {[
                    { val: "250+", label: "Items in catalog", icon: Package },
                    { val: "60s",  label: "Quote turnaround", icon: Zap },
                    { val: "7×",   label: "Days a week",      icon: Clock },
                    { val: "5★",   label: "Customer rating",  icon: Star },
                  ].map(({ val, label, icon: Icon }) => (
                    <div key={val} className="stat-card-highlight p-6 rounded-xl bg-white/5 hover:bg-amber-400/10 transition-all border border-white/10 group">
                      <Icon className="w-5 h-5 text-amber-400/70 mb-4 group-hover:scale-110 transition-transform" />
                      <p className="font-heading font-bold text-4xl text-amber-gradient leading-none mb-2">{val}</p>
                      <p className="text-[11px] text-white/50 font-bold uppercase tracking-widest">{label}</p>
                    </div>
                  ))}
                </div>

                <hr className="border-white/10 mb-8" />

                <div className="space-y-4">
                  {[
                    "IKEA / flat-pack assembly",
                    "Wardrobe & bed frame installation",
                    "Office & commercial fit-outs",
                    "Full relocation D&R service",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-3 text-sm text-white/70 font-medium">
                      <CheckCircle2 className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub card — CTA */}
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "hero_glass_cta")}
                className="group glass-card-premium gradient-border-card p-6 rounded-xl flex items-center justify-between bg-white/5 hover:bg-amber-400/10 transition-all duration-300 cursor-pointer border border-white/10"
              >
                <div>
                  <p className="text-[10px] font-black text-amber-400/80 tracking-[0.2em] uppercase mb-1">Ready to start?</p>
                  <p className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">Build your quote now</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-amber-400 transition-colors">
                  <ArrowRight className="w-6 h-6 text-white group-hover:text-black transition-colors" />
                </div>
              </Link>
            </motion.div>
          </div>
        </div>

        {/* ── Scroll to dismantle hint ── */}
        <div
          ref={scrollHintRef}
          className="absolute bottom-8 sm:bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 pointer-events-none select-none z-20"
          style={{ opacity: 1, transition: "opacity 0.5s ease" }}
        >
          <span className="text-[10px] font-black tracking-[0.25em] uppercase text-amber-400/80">scroll to explore</span>
          <motion.div
            className="w-px h-12 bg-gradient-to-b from-amber-400 to-transparent"
            animate={{ scaleY: [1, 0.4, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* ── Live dismantle status badge (always rendered; shown/hidden via RAF) ── */}
        <div
          ref={dismantleBadgeRef}
          data-testid="dismantle-badge"
          className="fixed top-24 right-4 sm:top-6 sm:right-6 items-center gap-2.5 px-4 py-2 border border-amber-400/40 bg-black/80 backdrop-blur-xl rounded-full shadow-lg shadow-amber-400/10 pointer-events-none select-none z-50"
          style={{ display: "none" }}
        >
          <div className="animate-pulse w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          <span
            ref={dismantleBadgeTextRef}
            className="text-xs font-black tracking-[0.2em] text-amber-400 uppercase"
          >
            dismantling 0%
          </span>
        </div>
      </section>

      {/* ═══════════════════════ MARQUEE TICKER ════════════════════════ */}
      {(() => {
        // Use real job feed when available, otherwise fall back to static labels
        const marqueeItems = recentJobs.length > 0
          ? recentJobs.map(j => j.label)
          : MARQUEE_ITEMS;
        // Duplicate enough times to fill the strip without gaps
        const repeated = marqueeItems.length < 8
          ? [...marqueeItems, ...marqueeItems, ...marqueeItems]
          : [...marqueeItems, ...marqueeItems];
        const isLive = recentJobs.length > 0;
        return (
          <div className="relative border-y border-white/10 glass-marquee overflow-hidden py-4 sm:py-5 select-none">
            {isLive && (
              <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-4 sm:px-6 bg-black/80 backdrop-blur-md border-r border-white/10">
                <span className="flex items-center gap-2 text-[10px] sm:text-xs font-black tracking-[0.2em] uppercase text-amber-400 whitespace-nowrap">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                  Live Jobs
                </span>
              </div>
            )}
            <div className={`marquee-track ${isLive ? "pl-32 sm:pl-40" : ""}`}>
              {repeated.map((item, i) => (
                <span key={i} className="flex items-center gap-4 px-6">
                  <span className={`text-xs sm:text-sm font-bold tracking-[0.15em] ${isLive ? "normal-case text-white/80" : "uppercase text-white/60"} whitespace-nowrap`}>
                    {item}
                  </span>
                  {/* Diamond amber separator */}
                  <span className="w-1.5 h-1.5 bg-amber-400/50 flex-shrink-0 rotate-45" />
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════ TRUST STRIP ═══════════════════════ */}
      <TrustStripAnimated />

      {/* ═══════════════════ HOW IT WORKS ════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 sm:py-32 border-b border-white/10 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(251,191,36,0.05) 0%, transparent 70%)" }} />
        <div className="max-w-6xl mx-auto relative">
          <motion.div {...fadeUpDelayed(0)} className="text-center mb-16 sm:mb-24">
            <p className="section-eyebrow mb-4 text-xs">Simple Process</p>
            <h2 className="section-title text-gradient-warm tracking-tight">How it works</h2>
            <p className="font-body text-base sm:text-lg text-white/60 mt-4 max-w-2xl mx-auto">From quote to completion — straightforward, transparent, and done right.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-12 md:gap-8 relative">
            {/* Connector line desktop */}
            <div className="hidden md:block absolute top-12 left-[calc(16.67%+30px)] right-[calc(16.67%+30px)] h-px bg-gradient-to-r from-amber-400/20 via-amber-400/50 to-amber-400/20" />
            {[
              {
                step: "01",
                icon: FileText,
                title: "Build your quote",
                desc: "Pick items from our 250+ catalog, upload a photo, or paste your list. Get an instant itemised price — no calls needed.",
              },
              {
                step: "02",
                icon: CreditCard,
                title: "Pay a small deposit",
                desc: "Secure your slot with a 50% deposit via Stripe or PayNow. The remaining 50% is only due after the job is done.",
              },
              {
                step: "03",
                icon: CalendarDays,
                title: "We show up & deliver",
                desc: "Our team arrives at your chosen time, fully equipped. Track them live. Balance payment on completion.",
              },
            ].map(({ step, icon: Icon, title, desc }, i) => (
              <motion.div key={step} {...fadeUpDelayed(i * 0.15)} className="flex flex-col items-center text-center relative bg-white/5 md:bg-transparent p-8 md:p-0 rounded-2xl md:rounded-none border border-white/10 md:border-none">
                <div className="relative mb-8">
                  <div className="w-24 h-24 rounded-full border-2 border-amber-400/30 bg-black/50 shadow-[0_0_30px_rgba(251,191,36,0.1)] flex items-center justify-center relative z-10">
                    <Icon className="w-10 h-10 text-amber-400" />
                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-black font-black text-xs shadow-lg shadow-amber-400/30">
                      {step}
                    </div>
                  </div>
                </div>
                <h3 className="font-heading font-bold text-xl sm:text-2xl text-white mb-4">{title}</h3>
                <p className="font-body text-base text-white/60 leading-relaxed max-w-sm">{desc}</p>
              </motion.div>
            ))}
          </div>
          <motion.div {...fadeUpDelayed(0.4)} className="text-center mt-16 sm:mt-24">
            <Link
              href="/estimate"
              onClick={() => trackEvent("cta_click", "/", "how_it_works_cta")}
              className="group inline-flex items-center gap-3 px-10 py-5 bg-amber-400 text-black font-black text-sm uppercase tracking-[0.15em] hover:bg-amber-300 amber-glow-btn shadow-[0_0_40px_rgba(251,191,36,0.3)] w-full sm:w-auto justify-center"
            >
              Get My Instant Quote <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <p className="text-sm font-medium text-white/50 mt-5">No calls required · Takes about 2 minutes</p>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════ WORK GALLERY ════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 sm:py-28 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12 sm:mb-16">
            <div>
              <p className="section-eyebrow mb-3 text-xs">
                Our Work
              </p>
              <h2 className="section-title text-gradient-warm tracking-tight">Real jobs. Real results.</h2>
            </div>
            <Link
              href="/estimate"
              onClick={() => trackEvent("cta_click", "/", "gallery_estimate")}
              className="group inline-flex items-center gap-2 text-base font-bold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
            >
              Get your quote <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.div>

          {/* ── Desktop: editorial 2-tier layout ── */}
          <div className="hidden sm:flex flex-col gap-2">
            {/* Row 1: featured wide + side */}
            <div className="grid gap-2" style={{ gridTemplateColumns: "3fr 2fr" }}>
              {[
                { src: "/work/office-fitout.jpg",          label: "Office Fit-Out",       sub: "Sit-stand workstations & overhead cabinets", tag: "Commercial",  w: 720, h: 405 },
                { src: "/work/phone-booth-completed.jpg",  label: "Duo Phone Booth",      sub: "2-person acoustic pod · CBD office",          tag: "Completed",   w: 480, h: 270 },
              ].map(({ src, label, sub, tag, w, h }, i) => (
                <motion.div
                  key={src}
                  {...(i === 0 ? fadeFromLeft(0) : fadeFromRight(0.06))}
                  className="relative overflow-hidden bg-neutral-900 group rounded-xl border border-white/10"
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
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] opacity-85 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <span className="inline-block px-3 py-1 bg-amber-400/20 text-amber-400 border border-amber-400/30 rounded-full text-[10px] font-black tracking-[0.15em] uppercase mb-3 backdrop-blur-md">{tag}</span>
                    <p className="text-2xl font-bold text-white leading-tight mb-2">{label}</p>
                    <p className="text-sm text-white/70 font-body">{sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            {/* Row 2: four equal thumbnails */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { src: "/work/phone-booth-install.jpg", label: "Phone Booth Setup",    sub: "Framery install in progress · Tech fit-out", tag: "Commercial"  },
                { src: "/work/bed-completed.jpg",       label: "Bed Frame Assembly",   sub: "IKEA bed with storage drawers · HDB condo",  tag: "Completed"   },
                { src: "/work/bed-assembly.jpg",        label: "Bed Frame Assembly",   sub: "King bed frame · Precision craftsmanship",   tag: "Residential" },
                { src: "/work/shelving-assembly.jpg",   label: "IKEA Assembly",        sub: "Kallax shelving · HDB",                      tag: "Residential" },
              ].map(({ src, label, sub, tag }, i) => (
                <motion.div
                  key={src}
                  {...fadeUpDelayed(0.12 + i * 0.06)}
                  className="relative overflow-hidden bg-neutral-900 group aspect-square rounded-xl border border-white/10"
                >
                  <img
                    src={src}
                    alt={label}
                    loading="lazy"
                    decoding="async"
                    width="280"
                    height="280"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05] opacity-80 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <span className="inline-block px-2 py-0.5 bg-black/50 text-white/80 border border-white/20 rounded-full text-[9px] font-bold tracking-[0.15em] uppercase mb-2 backdrop-blur-md">{tag}</span>
                    <p className="text-base font-bold text-white leading-tight mb-1">{label}</p>
                    <p className="text-xs text-white/60 font-body line-clamp-1">{sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── Mobile: horizontal scroll strip ── */}
          <div className="sm:hidden -mx-4 px-4">
            <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x snap-mandatory scrollbar-none">
              {[
                { src: "/work/office-fitout.jpg",          label: "Office Fit-Out",       sub: "Workstations & overhead cabinets",            tag: "Commercial" },
                { src: "/work/phone-booth-completed.jpg",  label: "Duo Phone Booth",      sub: "2-person acoustic pod · CBD office",          tag: "Completed"  },
                { src: "/work/phone-booth-install.jpg",    label: "Phone Booth Setup",    sub: "Framery install in progress · Tech fit-out",  tag: "Commercial" },
                { src: "/work/bed-completed.jpg",          label: "Bed Frame Assembly",   sub: "IKEA bed with storage drawers · HDB condo",  tag: "Completed"  },
                { src: "/work/bed-assembly.jpg",           label: "Bed Frame Assembly",   sub: "King bed frame · Precision craftsmanship",   tag: "Residential"},
                { src: "/work/shelving-assembly.jpg",      label: "IKEA Assembly",        sub: "New HDB home · Two-man crew",                tag: "Residential"},
                { src: "/work/wardrobe-oak.jpg",           label: "Wardrobe Install",     sub: "2-door with drawers · Oak",                  tag: "Completed"  },
                { src: "/work/conference-table.jpg",       label: "Conference Table",     sub: "Boardroom · Cable management",               tag: "Commercial" },
                { src: "/work/wardrobe-white.jpg",         label: "Wardrobe Install",     sub: "2-door with drawers · White",                tag: "Completed"  },
                { src: "/work/delivery-truck.jpg",         label: "On-Site Delivery",     sub: "Tools brought every job",                    tag: "Every Job"  },
              ].map(({ src, label, sub, tag }, i) => (
                <div
                  key={src}
                  className="relative flex-shrink-0 w-[80vw] overflow-hidden bg-neutral-900 snap-center aspect-[4/5] rounded-2xl border border-white/10 shadow-xl"
                >
                  <img
                    src={src}
                    alt={label}
                    loading={i < 2 ? "eager" : "lazy"}
                    decoding={i < 2 ? "sync" : "async"}
                    fetchPriority={i === 0 ? "high" : "auto"}
                    width="400"
                    height="500"
                    className="absolute inset-0 w-full h-full object-cover opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <span className="inline-block px-3 py-1 bg-amber-400/20 text-amber-400 border border-amber-400/30 rounded-full text-[10px] font-black tracking-[0.15em] uppercase mb-3 backdrop-blur-md">{tag}</span>
                    <p className="text-xl font-bold text-white leading-tight mb-2">{label}</p>
                    <p className="text-sm text-white/70 font-body">{sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mx-2">Swipe</p>
              <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ WHAT WE HANDLE ══════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 sm:py-32 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-16">
            <p className="section-eyebrow mb-4 text-xs">
              Our Catalog
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <h2 className="section-title text-gradient-warm tracking-tight">What we handle.</h2>
              <Link
                href="/estimate"
                className="group inline-flex items-center gap-2 text-base font-bold text-amber-400 hover:text-amber-300 transition-colors whitespace-nowrap"
              >
                Browse full catalog <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SERVICES.map(({ icon: Icon, label, count }, i) => (
              <Link
                key={label}
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", `service_card_${label.toLowerCase().replace(/\s+/g, "_")}`)}
                className="block h-full"
              >
                <motion.div {...(i % 2 === 0 ? fadeFromLeft(i * 0.05) : fadeFromRight(i * 0.05))} className="h-full">
                  <TiltCard className="bg-white/5 border border-white/10 hover:border-amber-400/50 rounded-2xl p-8 group hover:bg-white/10 transition-all duration-300 cursor-pointer h-full relative overflow-hidden shadow-lg shadow-black/50" intensity={10}>
                    {/* Ghost number background */}
                    <span className="absolute -bottom-4 right-2 font-heading font-bold text-8xl text-white/5 group-hover:text-amber-400/5 transition-colors duration-500 select-none pointer-events-none">{String(i + 1).padStart(2, "0")}</span>
                    
                    <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center mb-6 group-hover:bg-amber-400 group-hover:border-amber-400 transition-all duration-500 shadow-[0_0_20px_rgba(251,191,36,0.1)] group-hover:shadow-[0_0_30px_rgba(251,191,36,0.4)]">
                      <Icon className="w-8 h-8 text-amber-400 group-hover:text-black transition-colors duration-500" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2 relative z-10 group-hover:text-amber-300 transition-colors">
                      {label}
                    </h3>
                    
                    <div className="flex items-center justify-between mt-auto pt-6 relative z-10 border-t border-white/10">
                      <p className="text-sm text-white/50 font-medium">
                        {count} items
                      </p>
                      <p className="text-xs font-bold text-amber-400/70 group-hover:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        Quote <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
                      </p>
                    </div>
                  </TiltCard>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════ BOOKING FLOW ══════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 sm:py-36 border-t border-white/10">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <motion.div {...fadeUpDelayed(0)} className="mb-16 sm:mb-20">
            <p className="section-eyebrow mb-4 text-xs">
              The Full Booking Flow
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <h2 className="section-title text-gradient-warm tracking-tight">From enquiry<br/>to job done.</h2>
              <Link
                href="/estimate"
                className="group inline-flex items-center gap-3 px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold text-white transition-all w-full sm:w-auto justify-center"
              >
                Start now <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
            <p className="font-body text-base sm:text-lg text-white/60 mt-6 max-w-2xl leading-relaxed">
              Four simple phases — from choosing your service to final payment. Every stage is transparent, online, and confirmed in writing.
            </p>
          </motion.div>

          {/* ── 4-Step TL;DR Summary Strip ── */}
          <motion.div {...fadeUpDelayed(0.04)} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-16 sm:mb-24">
            {[
              { step: "01", label: "Get Quote",     desc: "60-second estimate online", icon: FileText },
              { step: "02", label: "We Review",     desc: "Admin verifies & confirms",  icon: ScanSearch },
              { step: "03", label: "Pay Deposit",   desc: "Secure Stripe · 50% upfront", icon: CreditCard },
              { step: "04", label: "Job Done",      desc: "Crew on-site, balance after",  icon: CheckCircle2 },
            ].map(({ step, label, desc, icon: Icon }) => (
              <div key={step} className="bg-white/5 border border-white/10 rounded-2xl p-6 group hover:bg-white/10 hover:border-amber-400/30 transition-all shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 font-bold text-xs">
                    {step}
                  </div>
                  <div className="flex-1 h-px bg-white/10" />
                  <Icon className="w-5 h-5 text-white/30 group-hover:text-amber-400 transition-colors" />
                </div>
                <p className="font-heading font-bold text-white text-xl mb-2">{label}</p>
                <p className="text-sm text-white/50 font-body leading-relaxed">{desc}</p>
              </div>
            ))}
          </motion.div>

          {/* ══════════ DESKTOP LAYOUT ══════════ */}
          <div className="hidden lg:block space-y-16">

            {/* ── Phase 1: YOU DO ONLINE ── */}
            <div>
              <motion.div {...fadeUpDelayed(0.04)} className="flex items-center gap-4 mb-8">
                <span className="px-4 py-1.5 bg-amber-400 text-black text-xs font-black tracking-widest uppercase rounded-full">Phase 1</span>
                <span className="text-xl font-bold text-white/80">You complete online</span>
                <div className="flex-1 h-px bg-white/10 ml-4" />
              </motion.div>

              <div className="grid grid-cols-4 gap-4">
                {([
                  { n: "01", icon: ListChecks,  title: "Choose Service",   body: "Select installation, dismantling, or relocation.",   tag: "Service type"    },
                  { n: "02", icon: MapPin,       title: "Enter Location",   body: "Your Singapore address. All premises covered.",     tag: "Island-wide"     },
                  { n: "03", icon: Package,      title: "Select Items",          body: "Pick from 250+ items — beds, wardrobes, desks.",            tag: "250+ catalog"    },
                  { n: "04", icon: CalendarDays, title: "Choose Date",    body: "Select preferred window. Same-week usually available.",          tag: "Same-week" },
                ] as const).map(({ n, icon: Icon, title, body, tag }, i) => (
                  <motion.div key={n} {...fadeUpDelayed(0.06 + i * 0.07)} className="bg-white/5 border border-white/10 rounded-2xl p-8 group hover:bg-white/10 transition-all relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 text-[120px] font-heading font-bold text-white/5 group-hover:text-white/10 transition-colors pointer-events-none select-none">{n}</div>
                    <Icon className="w-8 h-8 text-amber-400/80 mb-6 relative z-10" />
                    <h3 className="text-xl font-bold text-white mb-3 relative z-10">{title}</h3>
                    <p className="font-body text-sm text-white/60 leading-relaxed mb-6 relative z-10">{body}</p>
                    <span className="inline-block px-3 py-1 bg-black/50 border border-white/10 rounded-full text-[10px] font-bold text-white/50 tracking-wider uppercase relative z-10">{tag}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ── Phase 2: WE PREPARE ── */}
            <div>
              <motion.div {...fadeUpDelayed(0.34)} className="flex items-center gap-4 mb-8">
                <span className="px-4 py-1.5 bg-white/20 text-white text-xs font-black tracking-widest uppercase rounded-full">Phase 2</span>
                <span className="text-xl font-bold text-white/80">We prepare your booking</span>
                <div className="flex-1 h-px bg-white/10 ml-4" />
              </motion.div>

              <div className="grid grid-cols-3 gap-4">
                {([
                  {
                    n: "05", icon: FileText,
                    title: "Admin Review",
                    body: "Our team reviews your item list and verifies the auto-calculated price.",
                    tag: "Manual check"
                  },
                  {
                    n: "06", icon: Receipt,
                    title: "Quote Approved",
                    body: "You receive an official PDF quotation and a secure Stripe payment link.",
                    tag: "Official quote"
                  },
                  {
                    n: "07", icon: CreditCard,
                    title: "Deposit Paid",
                    body: "Pay 50% online to lock in your date. The job is now fully confirmed.",
                    tag: "Stripe / PayNow"
                  },
                ]).map(({ n, icon: Icon, title, body, tag }, i) => (
                  <motion.div key={n} {...fadeUpDelayed(0.36 + i * 0.07)} className="bg-white/5 border border-white/10 rounded-2xl p-8 group hover:bg-white/10 transition-all relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 text-[120px] font-heading font-bold text-white/5 group-hover:text-white/10 transition-colors pointer-events-none select-none">{n}</div>
                    <Icon className="w-8 h-8 text-amber-400/80 mb-6 relative z-10" />
                    <h3 className="text-xl font-bold text-white mb-3 relative z-10">{title}</h3>
                    <p className="font-body text-sm text-white/60 leading-relaxed mb-6 relative z-10">{body}</p>
                    <span className="inline-block px-3 py-1 bg-black/50 border border-white/10 rounded-full text-[10px] font-bold text-white/50 tracking-wider uppercase relative z-10">{tag}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ── Phase 3: JOB DAY ── */}
            <div>
              <motion.div {...fadeUpDelayed(0.54)} className="flex items-center gap-4 mb-8">
                <span className="px-4 py-1.5 bg-amber-400 text-black text-xs font-black tracking-widest uppercase rounded-full">Phase 3</span>
                <span className="text-xl font-bold text-white/80">Job day & completion</span>
                <div className="flex-1 h-px bg-white/10 ml-4" />
              </motion.div>

              <div className="grid grid-cols-2 gap-4">
                {([
                  {
                    n: "08", icon: Truck,
                    title: "Live Tracking & Arrival",
                    body: "Get an SMS when the crew is en route. Track their live GPS location. The team arrives with tools, floor protection, and gets to work.",
                    tag: "GPS Tracking"
                  },
                  {
                    n: "09", icon: CheckCircle2,
                    title: "Completion & Final 50%",
                    body: "Inspect the work. Once satisfied, the crew generates a digital invoice and you pay the final 50% via card or PayNow.",
                    tag: "Satisfaction guaranteed"
                  },
                ]).map(({ n, icon: Icon, title, body, tag }, i) => (
                  <motion.div key={n} {...fadeUpDelayed(0.56 + i * 0.07)} className="bg-white/5 border border-white/10 rounded-2xl p-8 group hover:bg-white/10 transition-all relative overflow-hidden flex flex-col md:flex-row gap-8 items-start">
                    <div className="absolute right-0 bottom-0 text-[180px] leading-none font-heading font-bold text-white/5 group-hover:text-white/10 transition-colors pointer-events-none select-none translate-x-1/4 translate-y-1/4">{n}</div>
                    <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0 relative z-10 shadow-[0_0_20px_rgba(251,191,36,0.1)]">
                      <Icon className="w-8 h-8 text-amber-400" />
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-2xl font-bold text-white mb-3">{title}</h3>
                      <p className="font-body text-base text-white/60 leading-relaxed mb-6">{body}</p>
                      <span className="inline-block px-3 py-1 bg-black/50 border border-white/10 rounded-full text-xs font-bold text-amber-400/80 tracking-wider uppercase">{tag}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* ══════════ MOBILE LAYOUT ══════════ */}
          <div className="lg:hidden space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-amber-400 text-black text-[10px] font-black tracking-widest uppercase rounded-full">Phase 1</span>
                <span className="text-sm font-bold text-white">You complete online</span>
              </div>
              <div className="space-y-6">
                {([
                  { n: "01", title: "Choose Service", body: "Install, dismantle, relocate." },
                  { n: "02", title: "Enter Location", body: "All SG districts covered." },
                  { n: "03", title: "Select Items",   body: "Pick from 250+ catalog." },
                  { n: "04", title: "Choose Date",    body: "Select preferred window." },
                ]).map(({ n, title, body }) => (
                  <div key={n} className="flex gap-4 relative">
                    <div className="w-px bg-white/10 absolute left-4 top-10 bottom-[-24px] last:hidden" />
                    <div className="w-8 h-8 rounded-full bg-black border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/70 flex-shrink-0 z-10">
                      {n}
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1">{title}</p>
                      <p className="text-sm text-white/50">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-white/20 text-white text-[10px] font-black tracking-widest uppercase rounded-full">Phase 2</span>
                <span className="text-sm font-bold text-white">We prepare booking</span>
              </div>
              <div className="space-y-6">
                {([
                  { n: "05", title: "Admin Review",   body: "Team verifies auto-price." },
                  { n: "06", title: "Quote Approved", body: "Receive official PDF quote." },
                  { n: "07", title: "Deposit Paid",   body: "Pay 50% to lock date." },
                ]).map(({ n, title, body }) => (
                  <div key={n} className="flex gap-4 relative">
                    <div className="w-px bg-white/10 absolute left-4 top-10 bottom-[-24px] last:hidden" />
                    <div className="w-8 h-8 rounded-full bg-black border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/70 flex-shrink-0 z-10">
                      {n}
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1">{title}</p>
                      <p className="text-sm text-white/50">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-amber-400 text-black text-[10px] font-black tracking-widest uppercase rounded-full">Phase 3</span>
                <span className="text-sm font-bold text-white">Job day completion</span>
              </div>
              <div className="space-y-6">
                {([
                  { n: "08", title: "Arrival & Work", body: "Live GPS tracking of crew." },
                  { n: "09", title: "Final 50%",      body: "Inspect & pay balance." },
                ]).map(({ n, title, body }) => (
                  <div key={n} className="flex gap-4 relative">
                    <div className="w-px bg-white/10 absolute left-4 top-10 bottom-[-24px] last:hidden" />
                    <div className="w-8 h-8 rounded-full bg-black border border-amber-400/50 text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 z-10 shadow-[0_0_10px_rgba(251,191,36,0.2)]">
                      {n}
                    </div>
                    <div>
                      <p className="font-bold text-white mb-1">{title}</p>
                      <p className="text-sm text-white/50">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════ PRICING GUIDE ════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 sm:py-36 border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-12 sm:mb-16">
            <p className="section-eyebrow mb-4 text-xs">
              Transparent Pricing
            </p>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <h2 className="section-title text-gradient-warm tracking-tight">
                Install, dismantle<br className="hidden md:block" /> or relocate — priced upfront.
              </h2>
              <p className="font-body text-base text-white/60 max-w-md leading-relaxed">
                Fixed-price catalog of 250+ furniture items. Every service type priced individually per item — no guesswork, no surprise charges.
              </p>
            </div>
          </motion.div>

          {/* ── Mobile Tab Switcher ── */}
          <div className="lg:hidden mb-8">
            <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
              {(["install", "dismantle", "relocate"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPricingTab(tab)}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${pricingTab === tab ? "bg-amber-400 text-black shadow-md" : "text-white/50 hover:text-white/80"}`}
                >
                  {tab === "install" ? "Install" : tab === "dismantle" ? "Dismantle" : "Relocate"}
                </button>
              ))}
            </div>
            
            {pricingTab === "relocate" && (
              <div className="mt-6 space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-white/30" />
                  <p className="text-xs font-black uppercase tracking-widest text-white/80 mb-2">Carry Only — Transport & Stairs</p>
                  <p className="text-sm text-white/60 font-body mb-4">No per-item labor. You pay transport fee only.</p>
                  <p className="text-lg font-bold text-white mb-2">From <span className="text-amber-400">$58</span> <span className="text-xs text-white/50 font-normal ml-1">(≤3 km, 1 helper incl.)</span></p>
                  <p className="text-xs text-white/40 font-medium">+$0.50/km · Stairs: +$5/level (lift), +$15/level (no lift)</p>
                </div>
                <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl p-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Dismantle & Reinstall — Full Service</p>
                  <p className="text-sm text-white/70 font-body mb-4">Transport + dismantle at origin + reassemble at destination.</p>
                  <p className="text-lg font-bold text-white mb-2">From <span className="text-amber-400">$58</span> <span className="text-xs text-amber-400/70 font-normal ml-1">+ D&R labor per item below</span></p>
                  <p className="text-xs text-amber-400/50 font-medium">+$0.50/km · 2-hour crew window · Overtime applies</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Desktop: 3-Column Comparison Table ── */}
          <motion.div {...fadeUpDelayed(0.08)} className="hidden lg:block bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr] bg-black/40 border-b border-white/10">
              <div className="px-8 py-5">
                <span className="text-xs font-black tracking-widest text-white/50 uppercase">Furniture Item</span>
              </div>
              {[
                { label: "Installation",  sub: "Assemble & fix in place" },
                { label: "Dismantling",   sub: "Take apart & remove" },
                { label: "D&R Labor",     sub: "Dismantle + reinstall only", highlight: true },
              ].map(({ label, sub, highlight }) => (
                <div key={label} className={`px-6 py-5 border-l border-white/10 ${highlight ? "bg-amber-400/10" : ""}`}>
                  <p className={`text-xs font-black tracking-widest uppercase mb-1 ${highlight ? "text-amber-400" : "text-white"}`}>{label}</p>
                  <p className={`text-[10px] font-body ${highlight ? "text-amber-400/70" : "text-white/50"}`}>{sub}</p>
                </div>
              ))}
            </div>
            
            <div className="divide-y divide-white/5">
              {PRICING_SAMPLES.map(({ item, install, dismantle }, i) => (
                <div
                  key={item}
                  className={`grid grid-cols-[2.5fr_1fr_1fr_1fr] hover:bg-white/5 transition-colors ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                >
                  <div className="px-8 py-5 flex items-center">
                    <span className="text-base text-white/90 font-medium">{item}</span>
                  </div>
                  <div className="px-6 py-5 border-l border-white/5 flex items-center">
                    <span className="text-lg font-bold text-white">${install}</span>
                  </div>
                  <div className="px-6 py-5 border-l border-white/5 flex items-center">
                    <span className="text-lg font-bold text-white">${dismantle}</span>
                  </div>
                  <div className="px-6 py-5 border-l border-white/5 flex items-center bg-amber-400/5">
                    <span className="text-lg font-bold text-amber-400">${Math.round((install + dismantle) * (1 - PricingConfig.fallback.relocateDRDiscount))}</span>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="px-8 py-6 bg-black/60 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <p className="font-body text-sm text-white/50 max-w-3xl leading-relaxed">
                Install & dismantle prices are per-item labor — a <strong className="text-white/80">$60 mobilisation & coordination fee</strong> applies once per job (crew dispatch, transport & logistics). D&R Labor = (install + dismantle) × 60% — <strong className="text-amber-400/80">40% bundle saving</strong>, no mobilisation fee. Transport from $58 (≤3 km) + $0.50/km.
              </p>
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "pricing_table_estimate")}
                className="group flex-shrink-0 inline-flex items-center gap-3 px-8 py-4 bg-amber-400 text-black text-xs font-black uppercase tracking-widest hover:bg-amber-300 amber-glow-btn rounded-xl"
              >
                Get Full Quote <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>

          {/* ── Mobile: Single Column by Tab ── */}
          <motion.div {...fadeUpDelayed(0.08)} className="lg:hidden bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="divide-y divide-white/10">
              {pricingTab === "relocate" ? (
                PRICING_SAMPLES.map(({ item, install, dismantle }, i) => (
                  <div
                    key={item}
                    className={`flex items-center justify-between px-5 py-4 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                  >
                    <span className="text-sm text-white/90 font-medium pr-4">{item}</span>
                    <div className="text-right flex-shrink-0">
                      <span className="text-lg font-bold text-amber-400">${Math.round((install + dismantle) * (1 - PricingConfig.fallback.relocateDRDiscount))}</span>
                      <p className="text-[10px] text-amber-400/60 uppercase tracking-wider mt-0.5">D&R labor (-40%)</p>
                    </div>
                  </div>
                ))
              ) : (
                PRICING_SAMPLES.map(({ item, install, dismantle }, i) => (
                  <div
                    key={item}
                    className={`flex items-center justify-between px-5 py-4 ${i % 2 === 0 ? "bg-white/[0.02]" : ""}`}
                  >
                    <span className="text-sm text-white/90 font-medium pr-4">{item}</span>
                    <span className="text-lg font-bold text-white flex-shrink-0">
                      ${pricingTab === "install" ? install : dismantle}
                    </span>
                  </div>
                ))
              )}
            </div>
            
            <div className="px-5 py-6 bg-black/40 border-t border-white/10">
              <p className="font-body text-xs text-white/50 leading-relaxed mb-5">
                {pricingTab === "relocate"
                  ? "D&R Labor = (install + dismantle) × 60%. Transport from $58 (≤3 km) + $0.50/km. No mobilisation fee."
                  : "Per-item labor prices (SGD). A $60 mobilisation & coordination fee applies once per job. Transport & stair fees extra."}
              </p>
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "pricing_table_mobile_estimate")}
                className="flex items-center justify-center gap-2 w-full py-4 bg-amber-400 text-black text-xs font-black uppercase tracking-widest hover:bg-amber-300 amber-glow-btn rounded-xl"
              >
                Get Full Quote <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>

          {/* ── Relocation Pricing Breakdown ── */}
          <motion.div {...fadeUpDelayed(0.16)} className="mt-12 sm:mt-16 bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 sm:px-10 py-6 sm:py-8 border-b border-white/10 bg-black/20">
              <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-2">Relocation Options</p>
              <h3 className="font-heading text-2xl sm:text-3xl font-bold text-white">Two ways to move — you choose.</h3>
            </div>
            
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
              {/* Carry Only */}
              <div className="p-6 sm:p-10 flex flex-col h-full bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="mb-8">
                  <span className="inline-block px-3 py-1 bg-white/10 text-white border border-white/20 rounded-full text-xs font-bold tracking-widest uppercase mb-4">Carry Only</span>
                  <p className="text-base text-white/70 font-body leading-relaxed">We transport your furniture as-is. No assembly or disassembly involved.</p>
                </div>
                
                <div className="space-y-4 mb-10 flex-1">
                  {[
                    { label: "2.4m Van (Toyota Hiace)", val: "Included" },
                    { label: "1 helper", val: "Included" },
                    { label: "First 3 km", val: "Included" },
                    { label: "Additional distance", val: "+$0.50/km" },
                    { label: "Stairs (with lift)", val: "+$5/level" },
                    { label: "Stairs (no lift)", val: "+$15/level" },
                    { label: "Per-item labor", val: "None" },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between text-sm border-b border-white/10 pb-3 last:border-0">
                      <span className="text-white/60">{label}</span>
                      <span className="font-bold text-white">{val}</span>
                    </div>
                  ))}
                </div>
                
                <div className="bg-black/40 rounded-xl p-5 border border-white/10">
                  <p className="text-xs text-white/50 font-medium mb-2 uppercase tracking-wider">Example: 10 km, ground floor both ends</p>
                  <div className="flex items-end gap-3 mb-1">
                    <p className="text-3xl font-black text-amber-400 leading-none">$61.50</p>
                    <p className="text-sm font-medium text-white/40 pb-1">total</p>
                  </div>
                  <p className="text-xs text-white/40 font-body">$58 base + 7km × $0.50</p>
                </div>
              </div>
              
              {/* Dismantle & Reinstall */}
              <div className="p-6 sm:p-10 flex flex-col h-full bg-amber-400/[0.02] hover:bg-amber-400/[0.04] transition-colors relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/5 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                
                <div className="mb-8 relative z-10">
                  <span className="inline-block px-3 py-1 bg-amber-400 text-black rounded-full text-xs font-black tracking-widest uppercase mb-4 shadow-[0_0_15px_rgba(251,191,36,0.3)]">Full Service</span>
                  <p className="text-base text-white/80 font-body leading-relaxed">We dismantle at origin, transport, and perfectly reassemble at destination.</p>
                </div>
                
                <div className="space-y-4 mb-10 flex-1 relative z-10">
                  {[
                    { label: "2.4m Van (Toyota Hiace)", val: "Included" },
                    { label: "1 helper", val: "Included" },
                    { label: "First 3 km", val: "Included" },
                    { label: "Additional distance", val: "+$0.50/km" },
                    { label: "Stairs (with lift)", val: "+$5/level" },
                    { label: "Stairs (no lift)", val: "+$15/level" },
                    { label: "Per-item D&R labor", val: "See table above", highlight: true },
                  ].map(({ label, val, highlight }) => (
                    <div key={label} className={`flex items-center justify-between text-sm border-b border-white/10 pb-3 last:border-0 ${highlight ? "text-amber-400" : ""}`}>
                      <span className={highlight ? "text-amber-400/80 font-medium" : "text-white/60"}>{label}</span>
                      <span className={`font-bold ${highlight ? "text-amber-400" : "text-white"}`}>{val}</span>
                    </div>
                  ))}
                </div>
                
                <div className="bg-amber-400/10 rounded-xl p-5 border border-amber-400/20 relative z-10">
                  <p className="text-xs text-amber-400/70 font-medium mb-2 uppercase tracking-wider">Example: 10 km · 1 × Queen Bed · ground floor</p>
                  <div className="flex items-end gap-3 mb-1">
                    <p className="text-3xl font-black text-amber-400 leading-none">$145.50</p>
                    <p className="text-sm font-medium text-amber-400/50 pb-1">total</p>
                  </div>
                  <p className="text-xs text-amber-400/60 font-body">$58 transport + $3.50 (7km extra) + $84 D&R labor ($140×60%)</p>
                </div>
              </div>
            </div>
            
            <div className="px-6 sm:px-10 py-6 sm:py-8 bg-black/60 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <p className="font-body text-sm text-white/50 leading-relaxed max-w-3xl">
                Van $28 (first 3 km) + helper $30 = <strong className="text-white/80">$58 minimum</strong> · 2-hour crew window included · Overtime $30/30-min block (max $200) · No mobilisation fee on relocation jobs.
              </p>
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "pricing_relocation_estimate")}
                className="group flex-shrink-0 inline-flex items-center gap-3 px-8 py-4 bg-amber-400 text-black text-xs font-black uppercase tracking-widest hover:bg-amber-300 amber-glow-btn rounded-xl w-full md:w-auto justify-center"
              >
                Get Relocation Quote <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════ FAQ ═══════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 sm:py-32 border-b border-white/10 bg-gradient-to-b from-black/20 to-black/60">
        <div className="max-w-4xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="text-center mb-16">
            <p className="section-eyebrow mb-4 text-xs">
              FAQ
            </p>
            <h2 className="section-title text-gradient-warm mb-6 tracking-tight">Common questions.</h2>
            <p className="font-body text-lg text-white/60 leading-relaxed mb-8">
              Can't find your answer? WhatsApp us — we reply fast.
            </p>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold text-white transition-all"
            >
              <MessageCircle className="w-5 h-5" /> Ask via WhatsApp
            </a>
          </motion.div>

          <motion.div {...fadeUpDelayed(0.1)} className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-8 backdrop-blur-sm shadow-2xl">
            <div className="divide-y divide-white/10">
              {FAQS.map((faq) => (
                <FAQItem key={faq.q} {...faq} />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═════════════════════ BOTTOM CTA BAND ═════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-32 sm:py-48 relative overflow-hidden dot-grid-bg">
        {/* Ambient orbs */}
        <div className="ambient-orb" style={{ left: "-5%", top: "50%", transform: "translateY(-50%)", width: "700px", height: "580px", background: "radial-gradient(ellipse at 40% 50%, rgba(251,191,36,0.16) 0%, transparent 62%)" }} />
        <div className="ambient-orb" style={{ right: "-10%", top: "15%", width: "520px", height: "420px", background: "radial-gradient(ellipse at 60% 40%, rgba(99,102,241,0.07) 0%, transparent 65%)" }} />
        <div className="ambient-orb" style={{ right: "5%", bottom: "-10%", width: "380px", height: "320px", background: "radial-gradient(ellipse at 50% 60%, rgba(251,191,36,0.06) 0%, transparent 65%)" }} />

        {/* Large ghost "60" — decorative type element */}
        <div
          className="absolute right-8 top-1/2 -translate-y-1/2 font-heading font-bold leading-none text-white pointer-events-none select-none hidden lg:block"
          style={{ fontSize: "clamp(180px,22vw,320px)", letterSpacing: "-0.05em", opacity: 0.03 }}
        >
          60<span style={{ color: "rgba(251,191,36,0.9)" }}>s</span>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div {...fadeUpDelayed(0)} className="max-w-3xl text-center lg:text-left mx-auto lg:mx-0">
            <p className="section-eyebrow mb-6 text-sm">
              Ready to start?
            </p>
            <h2 className="font-heading font-bold text-5xl sm:text-7xl text-gradient-warm mb-8 tracking-tighter leading-[0.95]">
              Get your quote<br />in under 60 seconds.
            </h2>
            <p className="font-body text-lg sm:text-xl text-white/70 mb-12 leading-relaxed max-w-2xl mx-auto lg:mx-0">
              No account needed. No phone calls. Select your items, confirm your address, and receive a full itemised quote with transport included.
            </p>

            {/* Amber rule above buttons */}
            <div className="flex justify-center lg:justify-start mb-12">
              <div className="w-24 h-1 bg-amber-400" />
            </div>

            <div className="flex flex-col sm:flex-row gap-5 justify-center lg:justify-start">
              <MagneticButton className="w-full sm:w-auto">
                <Link
                  href="/estimate"
                  data-testid="bottom-cta-estimate"
                  onClick={() => trackEvent("cta_click", "/", "bottom_get_estimate")}
                  className="group flex w-full items-center justify-center gap-3 px-10 py-5 sm:py-4 bg-amber-400 text-black font-black text-sm sm:text-xs uppercase tracking-[0.15em] hover:bg-amber-300 amber-glow-btn rounded-xl"
                >
                  GET ESTIMATE <ArrowRight className="w-5 h-5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </MagneticButton>
              <MagneticButton className="w-full sm:w-auto">
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="bottom-cta-whatsapp"
                  onClick={() => trackEvent("cta_click", "/", "bottom_whatsapp")}
                  className="flex w-full items-center justify-center gap-3 px-10 py-5 sm:py-4 border-2 border-white/20 text-white font-black text-sm sm:text-xs uppercase tracking-[0.15em] hover:border-amber-400 hover:bg-amber-400/10 transition-all rounded-xl backdrop-blur-sm"
                >
                  <MessageCircle className="w-5 h-5 sm:w-4 sm:h-4" /> WHATSAPP US
                </a>
              </MagneticButton>
            </div>

            {/* Trust micro-row */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4 mt-12">
              {["No account needed", "Itemised quote", "Same-day reply"].map(t => (
                <span key={t} className="flex items-center gap-2 text-sm font-medium text-white/60 font-body">
                  <CheckCircle2 className="w-4 h-4 text-amber-400/70" /> {t}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════ FOOTER ═══════════════════════════ */}
      <footer className="glass-footer border-t border-white/10 text-white px-4 sm:px-6 lg:px-8 pt-20 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 sm:gap-16 mb-16">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <span className="w-3 h-3 bg-amber-400" />
                <h3 className="font-heading font-bold text-2xl tracking-wide text-white">TMG INSTALL</h3>
              </div>
              <p className="font-body text-white/50 text-base leading-relaxed max-w-sm mb-6">
                Professional furniture installation, dismantling, and relocation across all of Singapore —
                HDB, condo, landed, office, and commercial. Transparent pricing, no hidden fees.
              </p>
              <div className="flex gap-4 mb-8">
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 rounded-xl text-white/80 text-sm font-bold hover:border-amber-400 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                <Link
                  href="/estimate"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 rounded-xl text-white text-sm font-bold hover:bg-white/20 transition-colors"
                >
                  Get Estimate
                </Link>
              </div>
              <p className="font-body text-white/30 text-xs font-medium">
                The Moving Guy Pte Ltd · UEN: 202424156H
              </p>
            </div>

            <div>
              <h4 className="font-body font-bold text-white text-xs tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                <span className="w-8 h-px bg-amber-400/50" /> Contact
              </h4>
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">WhatsApp</p>
                  <a href={WHATSAPP} className="font-body text-base font-medium text-white hover:text-amber-400 transition-colors">+65 8088 0757</a>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">Email</p>
                  <a href="mailto:sales@tmginstall.com" className="font-body text-base font-medium text-white hover:text-amber-400 transition-colors">sales@tmginstall.com</a>
                </div>
                <div className="flex gap-4 pt-2">
                  <a
                    href="https://www.facebook.com/profile.php?id=61578445941712"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TMG Install on Facebook"
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-black hover:bg-amber-400 hover:border-amber-400 transition-all"
                  >
                    <SiFacebook className="w-4 h-4" />
                  </a>
                  <a
                    href="https://www.instagram.com/tmginstall.sg/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TMG Install on Instagram"
                    className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-black hover:bg-amber-400 hover:border-amber-400 transition-all"
                  >
                    <SiInstagram className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-body font-bold text-white text-xs tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                <span className="w-8 h-px bg-amber-400/50" /> Legal
              </h4>
              <div className="space-y-4 flex flex-col">
                <Link href="/privacy" className="inline-flex font-body text-base font-medium text-white/60 hover:text-amber-400 transition-colors w-fit">Privacy Policy</Link>
                <Link href="/terms" className="inline-flex font-body text-base font-medium text-white/60 hover:text-amber-400 transition-colors w-fit">Terms of Service</Link>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/30 font-medium text-center md:text-left">
              &copy; {new Date().getFullYear()} The Moving Guy Pte Ltd. All rights reserved.
            </p>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Systems Operational</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Floating WhatsApp button — mobile only ── */}
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="floating-whatsapp-btn"
        onClick={() => trackEvent("cta_click", "/", "floating_whatsapp")}
        className="fixed bottom-6 right-5 z-50 flex md:hidden items-center justify-center w-14 h-14 rounded-full shadow-xl bg-[#25D366] hover:bg-[#20bd5c] active:scale-95 transition-all"
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>
    </div>
  );
}