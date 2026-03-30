import { Link } from "wouter";
import { PricingConfig } from "@shared/pricing";
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
  Truck,
  Star,
  Sofa,
  Monitor,
  Dumbbell,
  BedDouble,
  Wind,
  ChefHat,
  Plus,
  Minus,
  CalendarDays,
  CreditCard,
  FileText,
  Mail,
  ScanSearch,
  ListChecks,
  Users,
  Receipt,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePromoBar } from "@/hooks/use-promo-bar";
import { SiFacebook, SiInstagram } from "react-icons/si";
import FurnitureScene from "@/components/ui/furniture-scene";
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
      className={`flex sm:inline-flex ${className}`}
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
    <section className="border-b border-white/8 px-4 sm:px-6 lg:px-8 py-14 relative overflow-hidden">
      {/* Subtle amber shimmer rule at top */}
      <div className="absolute top-0 left-8 right-8 amber-shimmer-line opacity-50" />
      {/* Subtle amber orb centre */}
      <div className="ambient-orb" style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "600px", height: "200px", background: "radial-gradient(ellipse at 50% 50%, rgba(251,191,36,0.06) 0%, transparent 70%)" }} />
      <div className="max-w-6xl mx-auto relative">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-0 sm:divide-x sm:divide-white/10">
          {/* 250+ */}
          <div className="sm:px-8 first:pl-0 flex flex-col gap-1.5">
            <div className="flex items-baseline gap-1">
              <span ref={c250.ref} className="stat-display text-amber-gradient">{c250.count}</span>
              <span className="font-heading font-bold text-2xl leading-none text-amber-400/60">+</span>
            </div>
            <p className="text-xs font-bold text-white tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>Items in Catalog</p>
            <p className="text-[11px] text-white/35 font-body">Fixed price, zero surprises</p>
          </div>
          {/* 60s */}
          <div className="sm:px-8 flex flex-col gap-1.5">
            <div className="flex items-baseline gap-1">
              <span ref={c60.ref} className="stat-display text-amber-gradient">{c60.count}</span>
              <span className="font-heading font-bold text-xl leading-none text-amber-400/60">s</span>
            </div>
            <p className="text-xs font-bold text-white tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>Quote Time</p>
            <p className="text-[11px] text-white/35 font-body">No calls, no waiting</p>
          </div>
          {/* 7× */}
          <div className="sm:px-8 flex flex-col gap-1.5">
            <div className="flex items-baseline gap-1">
              <span ref={c7.ref} className="stat-display text-amber-gradient">{c7.count}</span>
              <span className="font-heading font-bold text-xl leading-none text-amber-400/60">×/wk</span>
            </div>
            <p className="text-xs font-bold text-white tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>Days Available</p>
            <p className="text-[11px] text-white/35 font-body">Weekends &amp; public holidays</p>
          </div>
          {/* 5★ */}
          <div className="sm:px-8 last:pr-0 flex flex-col gap-1.5">
            <div className="flex items-baseline gap-1">
              <span className="stat-display text-amber-gradient">5</span>
              <span className="font-heading font-bold text-2xl leading-none text-amber-400/60">★</span>
            </div>
            <p className="text-xs font-bold text-white tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>Google Rating</p>
            <p className="text-[11px] text-white/35 font-body">ACRA Reg · UEN 202424156H</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border-b transition-colors duration-300 ${open ? "border-amber-400/20" : "border-white/10"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
        data-testid={`faq-toggle-${q.slice(0, 20).toLowerCase().replace(/\s+/g, "-")}`}
      >
        <span className={`text-sm font-semibold pr-6 leading-snug transition-colors duration-200 ${open ? "text-white" : "text-white/75 group-hover:text-white"}`}>
          {q}
        </span>
        <motion.span
          className={`flex-shrink-0 w-7 h-7 flex items-center justify-center border transition-all duration-300 ${open ? "border-amber-400/50 bg-amber-400/12 rotate-0" : "border-white/15 group-hover:border-white/35"}`}
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {open ? <Minus className="w-3 h-3 text-amber-400" /> : <Plus className="w-3 h-3 text-white/55" />}
        </motion.span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        style={{ overflow: "hidden" }}
      >
        <div className="pb-6 pr-10">
          <p className="font-body text-sm text-white/60 leading-relaxed">{a}</p>
        </div>
      </motion.div>
    </div>
  );
}

export default function Landing() {
  usePageTracker("/");
  const { visible: promoVisible } = usePromoBar();
  const [pricingTab, setPricingTab] = useState<"install" | "dismantle" | "relocate">("install");
  const [scrolled, setScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      const sy = window.scrollY;
      setScrolled(sy > 320);
      setScrollY(sy);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? sy / max : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      setMouseX((e.clientX / window.innerWidth - 0.5) * 2);
      setMouseY((e.clientY / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, []);

  /* ── Drive glass-section transparency via CSS custom properties ── */
  useEffect(() => {
    const dp = Math.min(1, scrollProgress / 0.80);
    document.documentElement.style.setProperty("--section-alpha", Math.max(0.74, 0.88 - dp * 0.14).toFixed(3));
    document.documentElement.style.setProperty("--dark-alpha", Math.max(0.70, 0.85 - dp * 0.15).toFixed(3));
    document.documentElement.style.setProperty("--marquee-alpha", Math.max(0.58, 0.75 - dp * 0.17).toFixed(3));
  }, [scrollProgress]);

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

  const dismantlePct = Math.round(Math.min(100, (scrollProgress / 0.75) * 100));
  const dismantleP   = Math.min(1, scrollProgress / 0.80);

  return (
    <div className={`min-h-screen bg-transparent text-white ${promoVisible ? "pt-24" : "pt-14"}`}>

      {/* ═══ SCROLL PROGRESS BAR ═══ */}
      <div
        data-testid="scroll-progress-track"
        className="fixed left-0 right-0 z-[48] pointer-events-none"
        style={{ top: promoVisible ? "80px" : "56px" }}
      >
        <div
          data-testid="scroll-progress-bar"
          className="h-[2px] transition-all duration-100"
          style={{
            width: `${scrollProgress * 100}%`,
            background: "linear-gradient(to right, #f59e0b, #f97316, #fbbf24)",
            boxShadow: "0 0 10px rgba(245, 158, 11, 0.8)",
          }}
        />
      </div>

      {/* ══════ FULL-PAGE 3D BACKGROUND ══════ */}
      <PageBgScene scrollProgress={scrollProgress} mouseX={mouseX} mouseY={mouseY} />

      {/* ── Warm amber dismantle wash — glows in as scroll increases, page reacts to 3D state ── */}
      <div
        data-testid="amber-overlay"
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 130% 90% at 50% 30%, rgba(245, 158, 11, 0.20) 0%, rgba(251, 146, 60, 0.08) 48%, transparent 80%)",
          opacity: Math.max(0, Math.min(1, dismantleP * 1.6 - 0.22)),
          zIndex: 2,
        }}
      />

      {/* ═══════════════════════════ HERO ═══════════════════════════ */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-24 pb-32 lg:pt-36 lg:pb-52">
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

        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* ── LEFT: Copy ── */}
            <motion.div {...fadeUp}>
              {/* Premium badge pill */}
              <div className="hero-badge-pill mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />
                <span className="text-[10px] font-black tracking-[0.16em] text-amber-300 uppercase">
                  Singapore's Furniture Installation Specialists
                </span>
              </div>

              {/* Amber accent line */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-[3px] bg-amber-400" />
                <div className="w-3 h-[3px] bg-amber-400/40" />
              </div>

              <h1 className="hero-title text-gradient-warm mb-7">
                Installation,<br />Dismantling &amp;<br />Relocation.
              </h1>

              <p className="font-body text-base sm:text-lg text-white/55 mb-10 leading-relaxed max-w-md">
                From a single wardrobe to a full office fit-out — TMG Install
                handles every job across Singapore with transparent, upfront pricing.
                Get your quote in under 60 seconds, no calls required.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <MagneticButton>
                  <Link
                    href="/estimate"
                    data-testid="hero-cta-guided"
                    onClick={() => trackEvent("cta_click", "/", "hero_get_estimate")}
                    className="group flex w-full sm:inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-amber-400 text-black font-black text-xs uppercase tracking-[0.14em] hover:bg-amber-300 amber-glow-btn"
                  >
                    GET ESTIMATE <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </MagneticButton>
                <MagneticButton>
                  <a
                    href={WHATSAPP}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="hero-cta-whatsapp"
                    onClick={() => trackEvent("cta_click", "/", "hero_whatsapp")}
                    className="flex w-full sm:inline-flex items-center justify-center gap-2 px-8 py-4 border border-white/20 text-white font-black text-xs uppercase tracking-[0.12em] hover:border-amber-400/50 hover:bg-white/10 transition-all backdrop-blur-sm"
                  >
                    <MessageCircle className="w-4 h-4" /> WHATSAPP US
                  </a>
                </MagneticButton>
              </div>

              {/* ── Micro-trust line ── */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-4 mb-3">
                {[
                  "No calls required",
                  "Instant itemised quote",
                  "Upfront pricing — no hidden fees",
                ].map(t => (
                  <span key={t} className="flex items-center gap-1.5 text-xs text-white/40 font-body">
                    <CheckCircle2 className="w-3 h-3 text-white/30 flex-shrink-0" />
                    {t}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-8">
                <span className="flex items-center gap-1.5 text-xs text-white/35 font-body">
                  <Shield className="w-3 h-3 text-white/25 flex-shrink-0" />
                  ACRA Registered · UEN 202424156H
                </span>
                <span className="flex items-center gap-1.5 text-xs text-white/35 font-body">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
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
                  <div key={label} className="flex items-center gap-2 text-sm text-white/45">
                    <div className="w-1.5 h-1.5 bg-amber-400/70 flex-shrink-0" />
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
                  <div key={label} className="border border-white/15 bg-white/5 p-3 text-center backdrop-blur-sm">
                    <div className="font-heading font-bold text-2xl leading-none text-white mb-1">{val}</div>
                    <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">{label}</div>
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

            {/* ── RIGHT: Glass stats card (desktop only, floats over 3D bg) ── */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              className="hidden lg:flex flex-col gap-4 float-anim"
            >
              {/* Main glass card */}
              <div className="glass-card-premium relative overflow-hidden p-8">
                {/* Amber shimmer sweep across top */}
                <div className="absolute top-0 left-0 right-0 amber-shimmer-line" />
                {/* Amber corner accents */}
                <div className="absolute top-0 left-0 w-24 h-[2px] bg-amber-400/70" />
                <div className="absolute top-0 left-0 w-[2px] h-24 bg-amber-400/70" />
                <div className="absolute bottom-0 right-0 w-24 h-[2px] bg-amber-400/25" />
                <div className="absolute bottom-0 right-0 w-[2px] h-24 bg-amber-400/25" />
                {/* Ambient amber orb inside card */}
                <div className="absolute top-0 right-0 w-48 h-48 pointer-events-none" style={{ background: "radial-gradient(circle at 70% 20%, rgba(251,191,36,0.10) 0%, transparent 65%)" }} />

                <div className="flex items-center gap-2 mb-8">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[9px] font-black text-amber-400/80 tracking-[0.2em] uppercase">Live Pricing Engine</span>
                </div>

                <div className="grid grid-cols-2 gap-px bg-white/8 mb-6">
                  {[
                    { val: "250+", label: "Items in catalog", icon: Package },
                    { val: "60s",  label: "Quote turnaround", icon: Zap },
                    { val: "7×",   label: "Days a week",      icon: Clock },
                    { val: "5★",   label: "Customer rating",  icon: Star },
                  ].map(({ val, label, icon: Icon }) => (
                    <div key={val} className="stat-card-highlight p-5 group hover:bg-amber-400/[0.12] transition-colors">
                      <Icon className="w-3.5 h-3.5 text-amber-400/60 mb-3" />
                      <p className="font-heading font-bold text-3xl text-amber-gradient leading-none mb-1">{val}</p>
                      <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">{label}</p>
                    </div>
                  ))}
                </div>

                <hr className="amber-rule mb-5" />

                <div className="space-y-2.5">
                  {[
                    "IKEA / flat-pack assembly",
                    "Wardrobe & bed frame installation",
                    "Office & commercial fit-outs",
                    "Full relocation D&R service",
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2.5 text-xs text-white/50 font-body">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400/55 flex-shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Sub card — CTA */}
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "hero_glass_cta")}
                className="group glass-card-premium gradient-border-card p-5 flex items-center justify-between hover:bg-white/[0.12] transition-all duration-300"
              >
                <div>
                  <p className="text-[9px] font-black text-white/35 tracking-[0.18em] uppercase mb-0.5">Ready to start?</p>
                  <p className="text-sm font-bold text-white">Build your quote now →</p>
                </div>
                <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-amber-400 group-hover:translate-x-1.5 transition-all duration-300" />
              </Link>
            </motion.div>
          </div>
        </div>

        {/* ── Scroll to dismantle hint ── */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none select-none"
          animate={{ opacity: dismantlePct > 12 ? 0 : 1 }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-[9px] font-black tracking-[0.22em] uppercase text-amber-400/60">scroll to dismantle</span>
          <motion.div
            className="w-px h-8 bg-gradient-to-b from-amber-400/50 to-transparent"
            animate={{ scaleY: [1, 0.4, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* ── Live dismantle status badge ── */}
        {dismantlePct > 2 && (
          <motion.div
            data-testid="dismantle-badge"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-6 right-6 flex items-center gap-2 px-3 py-1.5 border border-amber-400/30 bg-black/50 backdrop-blur-md pointer-events-none select-none"
          >
            <div className="animate-pulse w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] font-black tracking-[0.15em] text-amber-400/80 uppercase">
              {dismantlePct >= 100 ? "dismantled" : `dismantling ${dismantlePct}%`}
            </span>
          </motion.div>
        )}
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
          <div className="relative border-t border-b border-white/10 glass-marquee overflow-hidden py-3.5 select-none">
            {isLive && (
              <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 glass-marquee border-r border-white/10">
                <span className="flex items-center gap-1.5 text-[9px] font-black tracking-[0.18em] uppercase text-amber-400 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                  Live Jobs
                </span>
              </div>
            )}
            <div className={`marquee-track ${isLive ? "pl-24" : ""}`}>
              {repeated.map((item, i) => (
                <span key={i} className="flex items-center gap-3 px-5">
                  <span className={`text-[10px] font-black tracking-[0.18em] ${isLive ? "normal-case" : "uppercase"} text-white/65 whitespace-nowrap`}>
                    {item}
                  </span>
                  {/* Diamond amber separator */}
                  <span className="w-1 h-1 bg-amber-400/35 flex-shrink-0 rotate-45" />
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ═══════════════════════ TRUST STRIP ═══════════════════════ */}
      <TrustStripAnimated />

      {/* ════════════════════ WORK GALLERY ════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 border-b border-white/8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="flex items-end justify-between gap-4 mb-8 flex-wrap">
            <div>
              <p className="section-eyebrow mb-2">
                Our Work
              </p>
              <h2 className="section-title text-gradient-warm">Real jobs. Real results.</h2>
            </div>
            <Link
              href="/estimate"
              onClick={() => trackEvent("cta_click", "/", "gallery_estimate")}
              className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white border-b border-white/25 pb-0.5 hover:border-white transition-colors whitespace-nowrap flex-shrink-0"
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
                  {...(i === 0 ? fadeFromLeft(0) : fadeFromRight(0.06))}
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
            <p className="text-[10px] text-white/25 font-body mt-2 text-center">← scroll to see more →</p>
          </div>
        </div>
      </section>

      {/* ════════════════════ WHAT WE HANDLE ══════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-white/8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-12">
            <p className="section-eyebrow mb-3">
              Our Catalog
            </p>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h2 className="section-title text-gradient-warm">What we handle.</h2>
              <Link
                href="/estimate"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white border-b border-white/25 pb-0.5 hover:border-white transition-colors whitespace-nowrap"
              >
                Browse full catalog <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/8">
            {SERVICES.map(({ icon: Icon, label, count }, i) => (
              <Link
                key={label}
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", `service_card_${label.toLowerCase().replace(/\s+/g, "_")}`)}
              >
                <motion.div {...(i % 2 === 0 ? fadeFromLeft(i * 0.05) : fadeFromRight(i * 0.05))} className="h-full">
                  <TiltCard className="glass-card-light glass-card-amber-hover gradient-border-card p-7 group hover:bg-white/14 transition-all duration-300 cursor-pointer h-full relative overflow-hidden" intensity={13}>
                    {/* Ghost number background */}
                    <span className="service-num">{String(i + 1).padStart(2, "0")}</span>
                    <div className="icon-box-amber mb-5 relative">
                      <Icon className="w-4 h-4 text-amber-400/80 group-hover:text-amber-300 transition-colors" />
                    </div>
                    <p className="text-sm font-semibold text-white leading-snug mb-1.5 relative">
                      {label}
                    </p>
                    <p className="text-[11px] text-white/40 font-mono relative">
                      {count} items
                    </p>
                    <p className="text-[10px] font-semibold text-white/30 group-hover:text-amber-400 mt-4 uppercase tracking-wide transition-colors flex items-center gap-1 relative">
                      Get quote <ArrowRight className="w-2.5 h-2.5 transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </TiltCard>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════════════ BOOKING FLOW ══════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-28 border-t border-white/8">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <motion.div {...fadeUpDelayed(0)} className="mb-16">
            <p className="section-eyebrow mb-3">
              The Full Booking Flow
            </p>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h2 className="section-title text-gradient-warm">From enquiry to job done.</h2>
              <Link
                href="/estimate"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white border-b border-white/25 pb-0.5 hover:border-white transition-colors whitespace-nowrap"
              >
                Start now <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
            <p className="font-body text-sm text-white/50 mt-4 max-w-xl leading-relaxed">
              Four simple phases — from choosing your service to final payment. Every stage is transparent, online, and confirmed in writing.
            </p>
          </motion.div>

          {/* ── 4-Step TL;DR Summary Strip ── */}
          <motion.div {...fadeUpDelayed(0.04)} className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/8 mb-14">
            {[
              { step: "01", label: "Get Quote",     desc: "60-second estimate online", icon: FileText },
              { step: "02", label: "We Review",     desc: "Admin verifies & confirms",  icon: ScanSearch },
              { step: "03", label: "Pay Deposit",   desc: "Secure Stripe · 50% upfront", icon: CreditCard },
              { step: "04", label: "Job Done",      desc: "Crew on-site, balance after",  icon: CheckCircle2 },
            ].map(({ step, label, desc, icon: Icon }) => (
              <div key={step} className="glass-card-light p-5 group hover:bg-white/15 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-black tracking-[0.2em] text-white/30 uppercase" style={{ letterSpacing: "0.2em" }}>Step {step}</span>
                  <div className="flex-1 h-px bg-white/8" />
                  <Icon className="w-3.5 h-3.5 text-white/25" />
                </div>
                <p className="font-heading font-bold text-white text-sm mb-1">{label}</p>
                <p className="text-[11px] text-white/40 font-body leading-relaxed">{desc}</p>
              </div>
            ))}
          </motion.div>

          {/* ══════════ DESKTOP LAYOUT ══════════ */}
          <div className="hidden lg:block space-y-0">

            {/* ── Phase 1: YOU DO ONLINE ── */}
            <motion.div {...fadeUpDelayed(0.04)} className="flex items-center gap-3 mb-4">
              <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40 px-2.5 py-1 border border-white/10 bg-white/[0.04] flex-shrink-0">
                Step 1–4 &nbsp;·&nbsp; You complete online
              </span>
              <div className="flex-1 h-px bg-white/10" />
            </motion.div>

            <div className="grid grid-cols-4 gap-px bg-white/8 mb-6">
              {([
                { n: "01", icon: ListChecks,  title: "Choose Your Service",   body: "Select installation, dismantling, or relocation — or any combination. Covers home, office, and commercial.",   tag: "Service type"    },
                { n: "02", icon: MapPin,       title: "Enter Your Location",   body: "Your Singapore address. All HDB, condo, landed, shophouse, and commercial premises across every district.",     tag: "Island-wide"     },
                { n: "03", icon: Package,      title: "Select Items",          body: "Pick from 250+ items — beds, wardrobes, workstations, gym equipment, blinds, appliances, and more.",            tag: "250+ catalog"    },
                { n: "04", icon: CalendarDays, title: "Choose Date & Time",    body: "Select your preferred appointment window. Same-week slots are usually available — we confirm quickly.",          tag: "Same-week slots" },
              ] as const).map(({ n, icon: Icon, title, body, tag }, i) => (
                <motion.div key={n} {...fadeUpDelayed(0.06 + i * 0.07)} className="glass-card-light p-8 group hover:bg-white/15 transition-colors duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-heading font-bold text-[52px] leading-none text-white/[0.08] select-none group-hover:text-white/15 transition-colors">{n}</span>
                    <div className="w-9 h-9 border border-white/15 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-white/45" />
                    </div>
                  </div>
                  <h3 className="card-title text-white mb-2">{title}</h3>
                  <p className="font-body text-sm text-white/50 leading-relaxed mb-4">{body}</p>
                  <span className="inline-flex text-[10px] font-semibold px-2.5 py-1 border border-white/12 text-white/35 tracking-wide">{tag}</span>
                </motion.div>
              ))}
            </div>

            {/* ── Phase 2: WE PREPARE ── */}
            <motion.div {...fadeUpDelayed(0.34)} className="flex items-center gap-3 mb-4">
              <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/40 px-2.5 py-1 border border-white/10 bg-white/[0.04] flex-shrink-0">
                Step 5–7 &nbsp;·&nbsp; We prepare your booking
              </span>
              <div className="flex-1 h-px bg-white/10" />
            </motion.div>

            <div className="grid grid-cols-3 gap-px bg-white/8 mb-6">
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
              ] as const).map(({ n, icon: Icon, title, body, tag }, i) => (
                <motion.div key={n} {...fadeUpDelayed(0.36 + i * 0.07)} className="glass-card-light p-8 group hover:bg-white/15 transition-colors duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-heading font-bold text-[52px] leading-none text-white/[0.08] select-none group-hover:text-white/15 transition-colors">{n}</span>
                    <div className="w-9 h-9 border border-white/15 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-white/50" />
                    </div>
                  </div>
                  <h3 className="card-title text-white mb-2">{title}</h3>
                  <p className="font-body text-sm text-white/50 leading-relaxed mb-4">{body}</p>
                  <span className="inline-flex text-[10px] font-semibold px-2.5 py-1 border border-white/12 text-white/35 tracking-wide">{tag}</span>
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
                <motion.div key={n} {...fadeUpDelayed(0.62 + i * 0.07)} className="glass-card-dark p-8 group hover:bg-black/55 transition-colors duration-300">
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-heading font-bold text-[52px] leading-none text-amber-400/[0.12] select-none group-hover:text-amber-400/20 transition-colors">{n}</span>
                    <div className="w-9 h-9 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-amber-400/50" />
                    </div>
                  </div>
                  <h3 className="card-title text-white mb-2">{title}</h3>
                  <p className="font-body text-sm text-white/45 leading-relaxed mb-4">{body}</p>
                  <span className="inline-flex text-[10px] font-semibold px-2.5 py-1 border border-amber-400/20 text-amber-400/50 tracking-wide">{tag}</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ══════════ MOBILE LAYOUT ══════════ */}
          <div className="lg:hidden">
            <div className="relative pl-12">
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-white/12" />

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
                  <div className={`absolute -left-12 top-0 w-9 h-9 border flex items-center justify-center flex-shrink-0 z-10 ${dark ? "bg-black/60 border-amber-400/20" : "glass-card-light border-white/15"}`}>
                    <Icon className={`w-3.5 h-3.5 ${dark ? "text-amber-400/60" : "text-white/50"}`} />
                  </div>
                  <div className={`flex-1 p-4 border ${dark ? "glass-card-dark border-amber-400/10" : "glass-card-light border-white/10"}`}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-white/25" style={{ letterSpacing: "0.2em" }}>Step {n}</p>
                    <h3 className="card-title mb-1.5 text-white">{title}</h3>
                    <p className="font-body text-xs leading-relaxed mb-2.5 text-white/50">{body}</p>
                    <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 border tracking-wide ${dark ? "border-amber-400/15 text-amber-400/45" : "border-white/12 text-white/35"}`}>{tag}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── CTA ── */}
          <motion.div {...fadeUpDelayed(0.8)} className="mt-14 pt-10 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold text-white mb-1">Ready to begin?</p>
              <p className="text-xs text-white/40 font-body">Use the online wizard or WhatsApp us — both generate your full estimate in under 60 seconds.</p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "booking_flow_estimate")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 text-black font-black text-xs uppercase tracking-[0.12em] hover:bg-amber-300 amber-glow-btn"
              >
                Get Estimate <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("cta_click", "/", "booking_flow_whatsapp")}
                className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 text-white font-black text-xs uppercase tracking-[0.12em] hover:border-white/50 hover:bg-white/5 transition-all"
              >
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════ WHY TMG INSTALL ═══════════════════ */}
      <section className="glass-dark px-4 sm:px-6 lg:px-8 py-28">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-16">
            <p className="section-eyebrow mb-3">
              Why Choose Us
            </p>
            <h2 className="section-title text-gradient-warm">Built for every job.</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/8">
            {[
              {
                icon: Package,
                title: "Fixed-Price Catalog",
                body: "Every one of our 250+ items has a locked price. No negotiations, no variations — your neighbour pays the same rate you do.",
              },
              {
                icon: Zap,
                title: "No Callbacks Needed",
                body: "Build your estimate online in 60 seconds. No phone tag, no site visit required just to get a number.",
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
              <motion.div key={title} {...fadeUpDelayed(i * 0.08)} className="h-full">
                <TiltCard className="glass-card-light glass-card-amber-hover gradient-border-card p-8 hover:bg-white/14 transition-all duration-300 group h-full relative overflow-hidden" intensity={5}>
                  {/* Ghost index number */}
                  <span
                    className="absolute -bottom-3 -right-1 font-heading font-bold leading-none pointer-events-none select-none transition-colors duration-500 group-hover:text-amber-400/[0.09] text-white/[0.04]"
                    style={{ fontSize: "clamp(76px,9vw,96px)", letterSpacing: "-0.04em" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="icon-box-amber mb-7 relative">
                    <Icon className="w-4 h-4 text-amber-400/70 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <h3 className="card-title text-white mb-3 relative">{title}</h3>
                  <p className="font-body text-sm text-white/50 leading-relaxed relative">{body}</p>
                </TiltCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ SOCIAL PROOF ══════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-white/8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)}>
            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
              <div>
                <p className="section-eyebrow mb-3">
                  Customer Reviews
                </p>
                <h2 className="section-title text-gradient-warm">What our clients say.</h2>
              </div>
              {/* Google rating badge */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <div>
                  <p className="text-sm font-black text-white leading-tight">
                    5.0 · Google Reviews
                  </p>
                  <p className="text-[11px] text-white/40 font-body">Verified on Google</p>
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
                    className="glass-card-premium glass-card-amber-hover gradient-border-card flex flex-col hover:bg-white/[0.13] transition-all duration-300 relative overflow-hidden group"
                    data-testid={`review-card-${i}`}
                  >
                    {/* Amber shimmer top */}
                    <div className="absolute top-0 left-0 right-0 amber-shimmer-line" />
                    {/* Large decorative quotation mark */}
                    <span className="quote-mark-deco">&ldquo;</span>
                    <div className="p-7 pt-8 flex flex-col flex-1 relative z-10">
                      {/* Stars */}
                      <div className="flex gap-0.5 mb-5">
                        {[...Array(r.stars)].map((_, j) => (
                          <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      {/* Text */}
                      <p className="font-body text-sm text-white/70 leading-relaxed flex-1 mb-6">
                        &ldquo;{r.text}&rdquo;
                      </p>
                      {/* Footer */}
                      <div className="flex items-center justify-between pt-4 border-t border-white/12">
                        <div>
                          <p className="text-xs font-bold text-white">{r.name}</p>
                          <p className="text-[11px] text-white/40 font-body">{r.loc} · {r.date}</p>
                        </div>
                        {/* Google G */}
                        <svg width="20" height="20" viewBox="0 0 24 24" aria-label="Google" className="flex-shrink-0 opacity-80">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400 text-black font-black text-xs uppercase tracking-[0.12em] hover:bg-amber-300 amber-glow-btn"
              >
                <Star className="w-3.5 h-3.5" /> Read on Google
              </a>
              <a
                href={reviewConfig?.writeUrl || "https://g.page/r/Cd2v7iBjl_GKEBM/review"}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("cta_click", "/", "google_reviews_write")}
                data-testid="btn-write-review"
                className="group inline-flex items-center gap-2 px-6 py-3 border border-white/20 text-white font-black text-xs uppercase tracking-[0.12em] hover:border-white/50 hover:bg-white/5 transition-all"
              >
                Write a Review <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════ PRICING GUIDE ════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-white/8">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUpDelayed(0)} className="mb-10">
            <p className="section-eyebrow mb-3">
              Transparent Pricing
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <h2 className="section-title text-gradient-warm">
                Install, dismantle<br className="hidden sm:block" /> or relocate — all priced upfront.
              </h2>
              <p className="font-body text-sm text-white/50 max-w-sm leading-relaxed">
                Fixed-price catalog of 250+ furniture items. Every service type priced individually per item — no guesswork, no surprise charges.
              </p>
            </div>
          </motion.div>

          {/* ── Mobile Tab Switcher ── */}
          <div className="lg:hidden mb-5">
            <div className="flex border border-white/12 glass-card-light">
              {(["install", "dismantle", "relocate"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setPricingTab(tab)}
                  className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${pricingTab === tab ? "bg-white/20 text-white" : "text-white/35 hover:text-white/60"}`}
                >
                  {tab === "install" ? "Install" : tab === "dismantle" ? "Dismantle" : "Relocate"}
                </button>
              ))}
            </div>
            {pricingTab === "relocate" && (
              <div className="mt-3 space-y-2">
                <div className="glass-card-light p-3 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white">Carry Only — Transport &amp; Stairs</p>
                  <p className="text-[10px] text-white/50 font-body">No per-item labor. You pay transport fee only.</p>
                  <p className="text-[11px] font-semibold text-white">From <span className="text-amber-400">$68</span> <span className="text-white/40 font-normal">(≤3 km, 1 helper incl.)</span></p>
                  <p className="text-[10px] text-white/40">+$0.50/km · Stairs: +$5/level (lift), +$15/level (no lift)</p>
                </div>
                <div className="glass-card-dark p-3 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.1em] text-white">Dismantle &amp; Reinstall — Full Service</p>
                  <p className="text-[10px] text-white/55 font-body">Transport + dismantle at origin + reassemble at destination.</p>
                  <p className="text-[11px] font-semibold text-white">From <span className="text-amber-400">$68</span> <span className="text-white/50 font-normal">+ D&amp;R labor per item below</span></p>
                  <p className="text-[10px] text-white/45">+$0.50/km · 90 min crew · Overtime $30/30-min block</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Desktop: 3-Column Comparison Table ── */}
          <motion.div {...fadeUpDelayed(0.08)} className="hidden lg:block glass-card-light overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-white/10 bg-white/5">
              <div className="px-6 py-4">
                <span className="text-[10px] font-semibold tracking-widest text-amber-400 uppercase" style={{ letterSpacing: "0.15em" }}>Furniture Item</span>
              </div>
              {[
                { label: "Installation",  sub: "Assemble & fix in place" },
                { label: "Dismantling",   sub: "Take apart & remove" },
                { label: "D&R Labor",     sub: "Dismantle + reinstall only", highlight: true },
              ].map(({ label, sub, highlight }) => (
                <div key={label} className={`px-6 py-4 border-l border-white/8 ${highlight ? "bg-amber-400/10" : ""}`}>
                  <p className={`text-[10px] font-black tracking-[0.12em] uppercase mb-0.5 ${highlight ? "text-amber-400" : "text-white"}`}>{label}</p>
                  <p className={`text-[10px] font-body ${highlight ? "text-amber-400/50" : "text-white/35"}`}>{sub}</p>
                </div>
              ))}
            </div>
            {PRICING_SAMPLES.map(({ item, install, dismantle }, i) => (
              <div
                key={item}
                className={`grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-white/5 last:border-0 hover:bg-white/8 transition-colors ${i % 2 !== 0 ? "bg-white/[0.03]" : ""}`}
              >
                <div className="px-6 py-4 flex items-center">
                  <span className="text-sm text-white font-medium">{item}</span>
                </div>
                <div className="px-6 py-4 border-l border-white/5 flex items-center">
                  <span className="text-sm font-semibold text-white">${install}</span>
                </div>
                <div className="px-6 py-4 border-l border-white/5 flex items-center">
                  <span className="text-sm font-semibold text-white">${dismantle}</span>
                </div>
                <div className="px-6 py-4 border-l border-white/5 flex items-center bg-amber-400/[0.07]">
                  <span className="text-sm font-bold text-amber-400">${Math.round((install + dismantle) * (1 - PricingConfig.fallback.relocateDRDiscount))}</span>
                </div>
              </div>
            ))}
            <div className="px-6 py-4 border-t border-white/8 bg-white/[0.03] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="font-body text-xs text-white/35">
                D&amp;R Labor = 40% bundle discount applied (dismantle + reinstall, bundled with transport). Transport &amp; stair fees quoted separately.
              </p>
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "pricing_table_estimate")}
                className="group flex-shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-400 text-black text-[10px] font-black uppercase tracking-[0.12em] hover:bg-amber-300 amber-glow-btn"
              >
                Get Full Quote <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>

          {/* ── Mobile: Single Column by Tab ── */}
          <motion.div {...fadeUpDelayed(0.08)} className="lg:hidden glass-card-light overflow-hidden">
            {pricingTab === "relocate" ? (
              PRICING_SAMPLES.map(({ item, install, dismantle }, i) => (
                <div
                  key={item}
                  className={`flex items-center justify-between px-4 py-4 border-b border-white/5 last:border-0 ${i % 2 !== 0 ? "bg-white/[0.03]" : ""}`}
                >
                  <span className="text-sm text-white font-medium pr-4">{item}</span>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-bold text-amber-400">${Math.round((install + dismantle) * (1 - PricingConfig.fallback.relocateDRDiscount))}</span>
                    <p className="text-[10px] text-white/35">D&amp;R labor (40% off)</p>
                  </div>
                </div>
              ))
            ) : (
              PRICING_SAMPLES.map(({ item, install, dismantle }, i) => (
                <div
                  key={item}
                  className={`flex items-center justify-between px-4 py-4 border-b border-white/5 last:border-0 ${i % 2 !== 0 ? "bg-white/[0.03]" : ""}`}
                >
                  <span className="text-sm text-white font-medium pr-4">{item}</span>
                  <span className="text-sm font-bold text-white flex-shrink-0">
                    ${pricingTab === "install" ? install : dismantle}
                  </span>
                </div>
              ))
            )}
            <div className="px-4 py-4 border-t border-white/8 bg-white/[0.03]">
              <p className="font-body text-xs text-white/35 mb-3">
                {pricingTab === "relocate"
                  ? "D&R Labor shown. Transport from $68 (≤3km, 1 helper incl.) + $0.50/km. Carry Only = transport fee only."
                  : "Sample prices per item (SGD). Transport & access fees extra."}
              </p>
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "pricing_table_mobile_estimate")}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-400 text-black text-[10px] font-black uppercase tracking-[0.12em] hover:bg-amber-300 amber-glow-btn"
              >
                Get Full Quote <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>

          {/* ── Relocation Pricing Breakdown ── */}
          <motion.div {...fadeUpDelayed(0.16)} className="glass-card-light overflow-hidden">
            <div className="px-6 py-5 border-b border-white/8 bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45 mb-1">Relocation Pricing</p>
              <p className="font-heading text-xl font-black uppercase tracking-[-0.01em] text-white">Two ways to relocate — you choose.</p>
            </div>
            <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/8">
              {/* Carry Only */}
              <div className="p-6 space-y-5">
                <div>
                  <div className="inline-flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] bg-white/10 px-2 py-1 text-white/70">Carry Only</span>
                  </div>
                  <p className="text-sm text-white/55 font-body">We transport your furniture as-is. No assembly or disassembly involved.</p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "2.4m Van (Toyota Hiace)", val: "Included" },
                    { label: "1 helper", val: "Included" },
                    { label: "First 3 km", val: "Included" },
                    { label: "Additional distance", val: "+$0.50/km" },
                    { label: "Stairs (with lift)", val: "+$5/level" },
                    { label: "Stairs (no lift)", val: "+$15/level" },
                    { label: "Per-item labor", val: "None" },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between text-sm border-b border-white/6 pb-2 last:border-0">
                      <span className="text-white/50">{label}</span>
                      <span className="font-semibold text-white">{val}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white/5 px-4 py-3">
                  <p className="text-[10px] text-white/35 font-body mb-1">Example: 10 km, ground floor both ends</p>
                  <p className="text-xl font-black text-amber-400">$71.50 <span className="text-sm font-normal text-white/40">total</span></p>
                  <p className="text-[10px] text-white/30">$68 base + 7km × $0.50</p>
                </div>
              </div>
              {/* Dismantle & Reinstall */}
              <div className="p-6 space-y-5 glass-card-dark text-white">
                <div>
                  <div className="inline-flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] bg-amber-400/15 px-2 py-1 text-amber-400">Dismantle &amp; Reinstall</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.08em] text-white/45">Full Service</span>
                  </div>
                  <p className="text-sm text-white/55 font-body">We dismantle at origin, transport, and reassemble at destination.</p>
                </div>
                <div className="space-y-2">
                  {[
                    { label: "2.4m Van (Toyota Hiace)", val: "Included" },
                    { label: "1 helper", val: "Included" },
                    { label: "First 3 km", val: "Included" },
                    { label: "Additional distance", val: "+$0.50/km" },
                    { label: "Stairs (with lift)", val: "+$5/level" },
                    { label: "Stairs (no lift)", val: "+$15/level" },
                    { label: "Per-item D&R labor", val: "See table above" },
                  ].map(({ label, val }) => (
                    <div key={label} className="flex items-center justify-between text-sm border-b border-white/8 pb-2 last:border-0">
                      <span className="text-white/50">{label}</span>
                      <span className="font-semibold text-white">{val}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-amber-400/8 px-4 py-3">
                  <p className="text-[10px] text-white/35 font-body mb-1">Example: 10 km, 1 × Queen Bed Frame, ground floor</p>
                  <p className="text-xl font-black text-amber-400">$155.50 <span className="text-sm font-normal text-white/40">total</span></p>
                  <p className="text-[10px] text-white/30">$68 base + 7km × $0.50 + $84 D&R labor (40% bundle discount)</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-white/8 bg-white/[0.03] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="font-body text-xs text-white/35">
                Van base $38 (first 3 km) + 1 helper $30 = $68 minimum · 120-min crew time included · Overtime $30/30-min block, capped at $200.
              </p>
              <Link
                href="/estimate"
                onClick={() => trackEvent("cta_click", "/", "pricing_relocation_estimate")}
                className="group flex-shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 bg-amber-400 text-black text-[10px] font-black uppercase tracking-[0.12em] hover:bg-amber-300 amber-glow-btn"
              >
                Get Relocation Quote <ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════ FAQ ═══════════════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-24 border-b border-white/8">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-[1fr_2fr] gap-16">
            <motion.div {...fadeUpDelayed(0)}>
              <p className="section-eyebrow mb-3">
                FAQ
              </p>
              <h2 className="section-title text-gradient-warm mb-4">Common questions.</h2>
              <p className="font-body text-sm text-white/50 leading-relaxed">
                Can't find your answer? WhatsApp us — we reply fast.
              </p>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-white border-b border-white/25 pb-0.5 hover:border-white transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> Ask via WhatsApp
              </a>
            </motion.div>

            <motion.div {...fadeUpDelayed(0.1)} className="border-t border-white/8">
              {FAQS.map((faq) => (
                <FAQItem key={faq.q} {...faq} />
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═════════════════════ BOTTOM CTA BAND ═════════════════════ */}
      <section className="px-4 sm:px-6 lg:px-8 py-36 relative overflow-hidden dot-grid-bg">
        {/* Ambient orbs */}
        <div className="ambient-orb" style={{ left: "-5%", top: "50%", transform: "translateY(-50%)", width: "700px", height: "580px", background: "radial-gradient(ellipse at 40% 50%, rgba(251,191,36,0.16) 0%, transparent 62%)" }} />
        <div className="ambient-orb" style={{ right: "-10%", top: "15%", width: "520px", height: "420px", background: "radial-gradient(ellipse at 60% 40%, rgba(99,102,241,0.07) 0%, transparent 65%)" }} />
        <div className="ambient-orb" style={{ right: "5%", bottom: "-10%", width: "380px", height: "320px", background: "radial-gradient(ellipse at 50% 60%, rgba(251,191,36,0.06) 0%, transparent 65%)" }} />

        {/* Large ghost "60" — decorative type element */}
        <div
          className="absolute right-8 top-1/2 -translate-y-1/2 font-heading font-bold leading-none text-white pointer-events-none select-none hidden lg:block"
          style={{ fontSize: "clamp(180px,22vw,280px)", letterSpacing: "-0.05em", opacity: 0.025 }}
        >
          60<span style={{ color: "rgba(251,191,36,0.9)" }}>s</span>
        </div>

        <div className="max-w-6xl mx-auto relative">
          <motion.div {...fadeUpDelayed(0)} className="max-w-2xl">
            <p className="section-eyebrow mb-5">
              Ready to start?
            </p>
            <h2 className="section-title text-gradient-warm mb-7">
              Get your quote<br />in under 60 seconds.
            </h2>
            <p className="font-body text-base text-white/55 mb-12 max-w-md leading-relaxed">
              No account needed. No phone calls. Select your items, confirm your address, and receive a full itemised quote with transport included.
            </p>

            {/* Amber rule above buttons */}
            <hr className="amber-rule mb-10 max-w-xs" />

            <div className="flex flex-col sm:flex-row gap-4">
              <MagneticButton>
                <Link
                  href="/estimate"
                  data-testid="bottom-cta-estimate"
                  onClick={() => trackEvent("cta_click", "/", "bottom_get_estimate")}
                  className="group flex w-full sm:inline-flex items-center justify-center gap-2.5 px-9 py-4 bg-amber-400 text-black font-black text-xs uppercase tracking-[0.14em] hover:bg-amber-300 amber-glow-btn"
                >
                  GET ESTIMATE <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </MagneticButton>
              <MagneticButton>
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="bottom-cta-whatsapp"
                  onClick={() => trackEvent("cta_click", "/", "bottom_whatsapp")}
                  className="flex w-full sm:inline-flex items-center justify-center gap-2 px-8 py-4 border border-white/20 text-white font-black text-xs uppercase tracking-[0.12em] hover:border-amber-400/40 hover:bg-white/10 transition-all"
                >
                  <MessageCircle className="w-4 h-4" /> WHATSAPP US
                </a>
              </MagneticButton>
            </div>

            {/* Trust micro-row */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8">
              {["No account needed", "Itemised quote", "Same-day reply"].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-xs text-white/35 font-body">
                  <CheckCircle2 className="w-3 h-3 text-white/25" /> {t}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════ FOOTER ═══════════════════════════ */}
      <footer className="glass-footer text-white px-4 sm:px-6 lg:px-8 pt-16 pb-10">
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
                    href="https://www.facebook.com/profile.php?id=61578445941712"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="TMG Install on Facebook"
                    className="w-8 h-8 border border-white/15 flex items-center justify-center text-white/40 hover:text-white hover:border-white/40 transition-all"
                  >
                    <SiFacebook className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href="https://www.instagram.com/tmginstall.sg/"
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
