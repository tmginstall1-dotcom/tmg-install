import { Link, useLocation } from "wouter";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  useMotionValueEvent,
  useVelocity,
  AnimatePresence,
} from "framer-motion";
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Star, MessageCircle, MapPin } from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { usePromoBar } from "@/hooks/use-promo-bar";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";

const WHATSAPP =
  "https://wa.me/6580880757?text=Hi%2C+I%27d+like+a+furniture+installation+quote";

const HERO_IMG_1600 = "/images/hero/exploded-wardrobe-1600.webp";
const HERO_IMG_800 = "/images/hero/exploded-wardrobe-800.webp";

const EASE = [0.16, 1, 0.3, 1] as const;

const SERVICES = [
  { label: "Wardrobe Installation", price: "from $120", slug: "/services/wardrobe-installation-singapore" },
  { label: "Bed Frame Assembly", price: "from $80", slug: "/services/bed-frame-installation-singapore" },
  { label: "IKEA Flatpack", price: "from $60", slug: "/services/ikea-assembly-singapore" },
  { label: "Office Fit-Out", price: "from $45/station", slug: "/services/office-fit-out-singapore" },
  { label: "Sofa & Lounge Relocation", price: "from $60", slug: "/services/furniture-relocation-singapore" },
  { label: "Gym Equipment", price: "from $80", slug: "/services/gym-equipment-assembly-singapore" },
];

const PRICING = [
  { item: "IKEA Hemnes Wardrobe (3-door)", install: 120, dismantle: 90 },
  { item: "Queen Bed Frame", install: 80, dismantle: 60 },
  { item: "2-Seater Sofa", install: 60, dismantle: 45 },
  { item: "Treadmill", install: 80, dismantle: 60 },
  { item: "Roller Blind (per window)", install: 50, dismantle: 30 },
  { item: "L-Shaped Executive Desk", install: 100, dismantle: 80 },
];

const STORY_STEPS = [
  {
    kicker: "01 — Quote",
    title: "An itemised price in under 60 seconds.",
    body: "Pick from a 250+ item catalog. Every line shows install, dismantle, and bundle pricing. No callbacks, no surprise add-ons at the door.",
  },
  {
    kicker: "02 — Schedule",
    title: "Same-week. Seven days a week.",
    body: "Including public holidays. Pick a two-hour window. We confirm by WhatsApp the night before and arrive on time.",
  },
  {
    kicker: "03 — Execution",
    title: "Trained installers. The right tool, every time.",
    body: "Every crew arrives with the standard kit — torque drivers, levels, hex sets, dust sheets, and the experience to use them properly.",
  },
  {
    kicker: "04 — Handover",
    title: "Boxes cleared. Floors swept. Photos sent.",
    body: "We inspect every fitting, take handover photos, clear the packaging, and leave the room ready to live in.",
  },
];

const FALLBACK_TESTIMONIALS = [
  {
    name: "Darren L.",
    loc: "Tampines",
    job: "Wardrobe Installation",
    text: "Booked for wardrobe installation and they were done in under two hours. Very professional, no mess left behind. Price was exactly as quoted — will use again for my second unit.",
  },
  {
    name: "Mei Ling T.",
    loc: "Bishan",
    job: "IKEA PAX Assembly",
    text: "Got a quote on WhatsApp in minutes. Team arrived on time and assembled our IKEA PAX wardrobe perfectly. No hidden charges — completely transparent from start to finish.",
  },
  {
    name: "Ravi K.",
    loc: "Raffles Place",
    job: "20-Station Office Fit-Out",
    text: "Used TMG for a full office fit-out — 20 workstations, overhead cabinets, boardroom table. Efficient team, competitive pricing, and they cleaned up thoroughly afterwards.",
  },
];

const WORK = [
  { src: "/images/work/wardrobe-oak-800.webp", label: "Oak wardrobe — Bukit Timah" },
  { src: "/images/work/bed-completed-800.webp", label: "Master bedroom — Bishan" },
  { src: "/images/work/office-fitout-800.webp", label: "20-station office — CBD" },
  { src: "/images/work/phone-booth-completed-800.webp", label: "Phone booth — Raffles Place" },
  { src: "/images/work/wardrobe-white-800.webp", label: "Built-in wardrobe — Tampines" },
  { src: "/images/work/conference-table-800.webp", label: "Boardroom table — One-North" },
  { src: "/images/work/office-pod-800.webp", label: "Office privacy pod — Tanjong Pagar" },
  { src: "/images/work/bed-assembly-800.webp", label: "Queen frame assembly — Bedok" },
];

/* ------------------------------ Helpers ------------------------------ */

function useCountUp(target: number, trigger: boolean, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start: number | null = null;
    let raf = 0;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, trigger, duration]);
  return val;
}

function MagneticButton({
  href,
  children,
  variant = "primary",
  testid,
  external = false,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "outline";
  testid?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function onMove(e: React.MouseEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: (e.clientX - (r.left + r.width / 2)) * 0.25,
      y: (e.clientY - (r.top + r.height / 2)) * 0.25,
    });
  }

  const cls =
    variant === "primary"
      ? "bg-amber-500 text-stone-950 hover:bg-amber-400"
      : variant === "outline"
      ? "bg-transparent text-white border border-white/30 hover:border-white hover:bg-white/5"
      : "bg-transparent text-white hover:bg-white/5";

  const content = (
    <motion.span
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: "spring", stiffness: 220, damping: 16, mass: 0.4 }}
      className="inline-flex items-center gap-3"
    >
      {children}
    </motion.span>
  );

  const [, setLocation] = useLocation();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.();
    if (!external) {
      e.preventDefault();
      setLocation(href);
    }
  }

  return (
    <a
      ref={ref}
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={handleClick}
      onMouseMove={onMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      data-testid={testid}
      className={`group inline-flex items-center justify-center px-8 py-4 text-[13px] font-medium tracking-[0.18em] uppercase rounded-full transition-colors duration-300 ${cls}`}
    >
      {content}
    </a>
  );
}

/* ------------------------------ Sections ------------------------------ */

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "30%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.08]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0.2]);

  return (
    <section
      ref={ref}
      className="relative min-h-[100vh] flex flex-col justify-end overflow-hidden bg-stone-950"
      data-testid="section-hero"
    >
      {/* Backdrop image with parallax */}
      <motion.div style={{ y, scale }} className="absolute inset-0 z-0">
        <picture>
          <source media="(min-width: 768px)" srcSet={HERO_IMG_1600} />
          <img
            src={HERO_IMG_800}
            alt=""
            aria-hidden="true"
            // @ts-expect-error - lowercase variant for React 18
            fetchpriority="high"
            decoding="async"
            className="w-full h-full object-cover opacity-90"
          />
        </picture>
      </motion.div>

      {/* Vignettes & glow */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-stone-950/60 via-stone-950/30 to-stone-950" />
      <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_60%_70%_at_50%_55%,transparent,rgba(0,0,0,0.7))]" />

      {/* Top nav bar */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 lg:px-12 py-5"
      >
        <Link href="/" className="font-serif text-xl tracking-[0.25em] uppercase text-white" data-testid="link-home">
          TMG Install
        </Link>
        <div className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.25em] uppercase text-white/70">
          <a href="#services" className="hover:text-white transition" data-testid="nav-services">Services</a>
          <a href="#pricing" className="hover:text-white transition" data-testid="nav-pricing">Pricing</a>
          <a href="#work" className="hover:text-white transition" data-testid="nav-work">Work</a>
          <a href="#process" className="hover:text-white transition" data-testid="nav-process">Process</a>
        </div>
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("cta_whatsapp_nav", "/")}
          className="text-[11px] tracking-[0.25em] uppercase text-amber-400 border-b border-amber-400/60 hover:text-white hover:border-white pb-1 transition"
          data-testid="nav-whatsapp"
        >
          WhatsApp
        </a>
      </motion.nav>

      {/* Hero copy */}
      <motion.div
        style={{ opacity: fade }}
        className="relative z-20 px-6 lg:px-16 pb-24 md:pb-32 max-w-6xl"
      >
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
          className="text-[11px] tracking-[0.4em] uppercase text-amber-400 mb-6"
        >
          The Moving Guy · Singapore
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
          className="font-serif text-white text-[44px] leading-[1.05] sm:text-6xl md:text-7xl lg:text-[88px] tracking-[-0.02em] max-w-5xl"
        >
          Furniture installed
          <br />
          with the precision <span className="italic text-white/85">of a watchmaker.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55, ease: EASE }}
          className="mt-8 max-w-xl text-base md:text-lg text-stone-300 leading-relaxed"
        >
          Wardrobes, beds, IKEA flatpack, office fit-outs and relocation across Singapore.
          Transparent fixed prices from a 250+ item catalog. Quote in 60 seconds.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.75, ease: EASE }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <MagneticButton
            href="/estimate"
            testid="hero-cta-quote"
            onClick={() => trackEvent("cta_estimate_hero", "/")}
          >
            Get a Quote <ArrowRight size={16} className="-mr-1" />
          </MagneticButton>
          <MagneticButton
            href={WHATSAPP}
            external
            variant="outline"
            testid="hero-cta-whatsapp"
            onClick={() => trackEvent("cta_whatsapp_hero", "/")}
          >
            <MessageCircle size={16} /> WhatsApp Us
          </MagneticButton>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.1 }}
          className="mt-14 flex flex-wrap items-center gap-x-10 gap-y-4 text-[11px] tracking-[0.2em] uppercase text-white/55"
          data-testid="hero-trust-strip"
        >
          <span>250+ Catalog Items</span>
          <span className="hidden sm:inline text-white/20">·</span>
          <span>28 Districts</span>
          <span className="hidden sm:inline text-white/20">·</span>
          <span>7 Days · Inc. PH</span>
          <span className="hidden md:inline text-white/20">·</span>
          <span className="hidden md:inline">Same-Week Scheduling</span>
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 text-white/40 text-[10px] tracking-[0.4em] uppercase"
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          Scroll
        </motion.div>
      </motion.div>
    </section>
  );
}

function ServicesMarquee() {
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smooth, [-2000, 0, 2000], [-2, 1, 4]);
  const x = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const setWidth = useRef(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    function measure() {
      if (measureRef.current) setWidth.current = measureRef.current.scrollWidth;
    }
    measure();
    const t = window.setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    return () => { window.clearTimeout(t); window.removeEventListener("resize", measure); };
  }, []);

  useMotionValueEvent(factor, "change", (f) => {
    if (reduce || !trackRef.current) return;
    x.current -= f * 0.6;
    if (setWidth.current > 0) {
      // Wrap so the marquee never runs out of content
      while (x.current <= -setWidth.current) x.current += setWidth.current;
      while (x.current > 0) x.current -= setWidth.current;
    }
    trackRef.current.style.transform = `translateX(${x.current}px)`;
  });

  const items = [
    "Wardrobe Installation", "Bed Frame Assembly", "IKEA Flatpack",
    "Office Fit-Out", "Furniture Dismantling", "Sofa Relocation",
    "Gym Equipment", "Kitchen Cabinets", "Roller Blinds", "Mattress Carry-Up",
    "MCST Compliant", "Same-Week Scheduling",
  ];

  return (
    <section className="bg-stone-950 border-y border-white/5 py-8 overflow-hidden" aria-hidden="true">
      <div ref={trackRef} className="flex gap-12 whitespace-nowrap will-change-transform">
        <div ref={measureRef} className="flex gap-12 flex-shrink-0">
          {items.map((it, i) => (
            <span key={`a-${i}`} className="font-serif text-3xl md:text-4xl text-white/40 italic">
              {it} <span className="not-italic text-amber-400/40 mx-3">·</span>
            </span>
          ))}
        </div>
        <div className="flex gap-12 flex-shrink-0" aria-hidden="true">
          {items.map((it, i) => (
            <span key={`b-${i}`} className="font-serif text-3xl md:text-4xl text-white/40 italic">
              {it} <span className="not-italic text-amber-400/40 mx-3">·</span>
            </span>
          ))}
        </div>
        <div className="flex gap-12 flex-shrink-0" aria-hidden="true">
          {items.map((it, i) => (
            <span key={`c-${i}`} className="font-serif text-3xl md:text-4xl text-white/40 italic">
              {it} <span className="not-italic text-amber-400/40 mx-3">·</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatItem({ v, suffix, label, inView, delay, idx }: { v: number; suffix: string; label: string; inView: boolean; delay: number; idx: number }) {
  const value = useCountUp(v, inView, delay);
  return (
    <div data-testid={`stat-${idx}`}>
      <div className="font-serif text-5xl md:text-6xl lg:text-7xl text-white tabular-nums">
        {value}
        <span className="text-amber-400">{suffix}</span>
      </div>
      <div className="mt-3 text-[11px] tracking-[0.2em] uppercase text-stone-400 max-w-[180px]">
        {label}
      </div>
    </div>
  );
}

function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setInView(true), { threshold: 0.4 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  const items = [
    { v: 250, suffix: "+", label: "Catalog items, fixed prices" },
    { v: 28, suffix: "", label: "Singapore districts covered" },
    { v: 7, suffix: " days", label: "A week, including PH" },
    { v: 60, suffix: "s", label: "From quote to confirmation" },
  ];

  return (
    <section ref={ref} className="bg-stone-950 py-24 md:py-32 px-6 lg:px-16 border-b border-white/5" data-testid="section-stats">
      <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-y-12 gap-x-8">
        {items.map((it, i) => (
          <StatItem key={i} idx={i} v={it.v} suffix={it.suffix} label={it.label} inView={inView} delay={1400 + i * 200} />
        ))}
      </div>
    </section>
  );
}

function StickyStory() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const stepCount = STORY_STEPS.length;
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const i = Math.min(stepCount - 1, Math.max(0, Math.floor(p * stepCount)));
    if (i !== active) setActive(i);
  });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);

  return (
    <section
      ref={ref}
      id="process"
      className="relative bg-stone-950 text-white"
      style={{ height: `${stepCount * 100}vh` }}
      data-testid="section-process"
    >
      <div className="sticky top-0 h-screen flex items-stretch overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 w-full h-full">
          {/* Image side */}
          <div className="relative overflow-hidden bg-stone-900 hidden md:block">
            <motion.img
              style={{ y: imgY }}
              src="/images/hero/install-moment-1600.webp"
              srcSet="/images/hero/install-moment-800.webp 800w, /images/hero/install-moment-1600.webp 1600w"
              sizes="50vw"
              alt="Installer mounting an oak wardrobe panel"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-stone-950/40 via-transparent to-stone-950/30" />
            <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
              <div className="flex gap-2">
                {STORY_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-[2px] w-12 transition-colors duration-500 ${i <= active ? "bg-amber-400" : "bg-white/15"}`}
                  />
                ))}
              </div>
              <div className="text-[11px] tracking-[0.3em] uppercase text-white/50 tabular-nums">
                {String(active + 1).padStart(2, "0")} / {String(stepCount).padStart(2, "0")}
              </div>
            </div>
          </div>

          {/* Copy side */}
          <div className="relative flex items-center px-6 md:px-16 lg:px-24 bg-stone-950">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.7, ease: EASE }}
                className="max-w-xl"
              >
                <p className="text-[11px] tracking-[0.35em] uppercase text-amber-400 mb-6">
                  {STORY_STEPS[active].kicker}
                </p>
                <h3 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] mb-8">
                  {STORY_STEPS[active].title}
                </h3>
                <p className="text-stone-300 text-base md:text-lg leading-relaxed max-w-md">
                  {STORY_STEPS[active].body}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

function PricingTable() {
  return (
    <section id="pricing" className="bg-stone-950 py-32 px-6 lg:px-16 border-t border-white/5" data-testid="section-pricing">
      <div className="mx-auto max-w-6xl">
        <div className="grid md:grid-cols-12 gap-12 items-end mb-16">
          <div className="md:col-span-7">
            <p className="text-[11px] tracking-[0.35em] uppercase text-amber-400 mb-4">No surprises</p>
            <h2 className="font-serif text-white text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
              The price you see is the price you pay.
            </h2>
          </div>
          <div className="md:col-span-5 md:text-right">
            <p className="text-stone-400 leading-relaxed">
              Every item in our 250+ catalog has a published install and dismantle price.
              Bundle dismantle + reinstall — get 40% off automatically.
            </p>
          </div>
        </div>

        <div className="border-t border-white/10">
          {PRICING.map((row, i) => (
            <motion.div
              key={row.item}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
              className="grid grid-cols-12 items-baseline border-b border-white/10 py-6 group"
              data-testid={`pricing-row-${i}`}
            >
              <div className="col-span-7 md:col-span-7 text-white text-base md:text-lg group-hover:text-amber-400 transition-colors">
                {row.item}
              </div>
              <div className="col-span-2 md:col-span-2 text-stone-400 text-sm tracking-wide">
                <span className="hidden md:inline text-[10px] uppercase tracking-[0.25em] text-stone-500 mr-2">Dism.</span>
                ${row.dismantle}
              </div>
              <div className="col-span-3 md:col-span-3 text-right">
                <span className="font-serif text-2xl md:text-3xl text-white tabular-nums">${row.install}</span>
                <span className="block text-[10px] uppercase tracking-[0.25em] text-stone-500 mt-1">Install</span>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-stone-400">
          <span className="flex items-center gap-2"><Check size={14} className="text-amber-400" /> $60 mobilisation per appointment</span>
          <span className="flex items-center gap-2"><Check size={14} className="text-amber-400" /> Relocation transport from $58</span>
          <span className="flex items-center gap-2"><Check size={14} className="text-amber-400" /> 40% off dismantle + reinstall bundle</span>
        </div>

        <div className="mt-12">
          <MagneticButton href="/estimate" testid="pricing-cta" onClick={() => trackEvent("cta_estimate_pricing", "/")}>
            See Your Itemised Quote <ArrowRight size={16} />
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}

function ServicesGrid() {
  return (
    <section id="services" className="bg-stone-950 py-32 px-6 lg:px-16" data-testid="section-services">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 max-w-3xl">
          <p className="text-[11px] tracking-[0.35em] uppercase text-amber-400 mb-4">What we do</p>
          <h2 className="font-serif text-white text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
            Six core services. <span className="italic text-white/70">One standard.</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10">
          {SERVICES.map((s, i) => (
            <motion.a
              key={s.label}
              href={s.slug}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: EASE }}
              className="group relative bg-stone-950 p-10 hover:bg-stone-900 transition-colors duration-500 min-h-[260px] flex flex-col justify-between"
              data-testid={`service-${i}`}
            >
              <div className="text-[11px] tracking-[0.3em] uppercase text-stone-500">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mt-12">
                <h3 className="font-serif text-2xl md:text-3xl text-white mb-2 leading-tight">{s.label}</h3>
                <div className="flex items-baseline justify-between mt-4">
                  <p className="text-amber-400 text-sm tracking-[0.15em] uppercase">{s.price}</p>
                  <ArrowRight size={18} className="text-stone-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkReel() {
  const ref = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const reduce = useReducedMotion();
  const [maxShift, setMaxShift] = useState(0);
  useEffect(() => {
    function measure() {
      if (!trackRef.current) return;
      const trackWidth = trackRef.current.scrollWidth;
      const viewportWidth = window.innerWidth;
      setMaxShift(-Math.max(0, trackWidth - viewportWidth + 32));
    }
    measure();
    window.addEventListener("resize", measure);
    const t = window.setTimeout(measure, 400);
    return () => { window.removeEventListener("resize", measure); window.clearTimeout(t); };
  }, []);
  const x = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : maxShift]);

  return (
    <section
      ref={ref}
      id="work"
      className="relative bg-stone-950 border-t border-white/5"
      style={{ height: "300vh" }}
      data-testid="section-work"
    >
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        <div className="px-6 lg:px-16 mb-10">
          <p className="text-[11px] tracking-[0.35em] uppercase text-amber-400 mb-4">Recent work</p>
          <h2 className="font-serif text-white text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] max-w-2xl">
            Real jobs. Real homes. <span className="italic text-white/70">Real results.</span>
          </h2>
        </div>
        <motion.div ref={trackRef} style={{ x }} className="flex gap-8 px-6 lg:px-16 will-change-transform">
          {WORK.map((w, i) => (
            <figure key={w.src} className="flex-shrink-0 w-[300px] md:w-[420px]" data-testid={`work-${i}`}>
              <div className="relative aspect-[4/5] overflow-hidden bg-stone-900">
                <img
                  src={w.src}
                  alt={w.label}
                  loading="lazy"
                  decoding="async"
                  width={840}
                  height={1050}
                  className="w-full h-full object-cover transition-transform duration-1000 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-transparent opacity-70" />
              </div>
              <figcaption className="mt-4 flex items-center gap-2 text-sm text-stone-400">
                <MapPin size={12} className="text-amber-400" /> {w.label}
              </figcaption>
            </figure>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Testimonials() {
  const { data: apiTestimonials = [] } = useQuery<{ name: string; loc: string; stars: number; date: string; text: string }[]>({
    queryKey: ["/api/public/testimonials"],
    staleTime: 5 * 60 * 1000,
  });

  const list = (apiTestimonials.length >= 3 ? apiTestimonials.slice(0, 3) : FALLBACK_TESTIMONIALS).map((t: any) => ({
    name: t.name,
    loc: t.loc || "Singapore",
    job: t.job || (t.stars ? `${t.stars}-star review` : "Verified customer"),
    text: t.text,
  }));

  return (
    <section className="bg-stone-950 py-32 px-6 lg:px-16 border-t border-white/5" data-testid="section-testimonials">
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
        <motion.div
          initial={{ opacity: 0, clipPath: "inset(0 0 100% 0)" }}
          whileInView={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
          viewport={{ once: true, margin: "-15%" }}
          transition={{ duration: 1.4, ease: EASE }}
          className="lg:col-span-5 relative"
        >
          <div className="relative aspect-[3/4] overflow-hidden bg-stone-900 border border-white/5">
            <motion.img
              src="/images/hero/toolkit-flatlay-1600.webp"
              srcSet="/images/hero/toolkit-flatlay-800.webp 800w, /images/hero/toolkit-flatlay-1600.webp 1600w"
              sizes="(min-width: 1024px) 40vw, 90vw"
              alt="The TMG installer toolkit"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              initial={{ scale: 1.15 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true, margin: "-15%" }}
              transition={{ duration: 2, ease: EASE }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-transparent to-transparent opacity-60" />
            <div className="absolute bottom-6 left-6 right-6">
              <p className="text-[10px] tracking-[0.3em] uppercase text-amber-400 mb-2">The Standard Kit</p>
              <p className="font-serif text-white text-2xl italic leading-tight">Every job. Every time.</p>
            </div>
          </div>
        </motion.div>

        <div className="lg:col-span-7 lg:pl-8">
          <p className="text-[11px] tracking-[0.35em] uppercase text-amber-400 mb-6">From the customers</p>
          <h2 className="font-serif text-white text-4xl md:text-5xl leading-[1.05] tracking-[-0.02em] mb-16 max-w-xl">
            What it sounds like <span className="italic text-white/70">when the job is done right.</span>
          </h2>
          <div className="space-y-12">
            {list.map((t, i) => (
              <motion.figure
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.9, delay: i * 0.12, ease: EASE }}
                className="border-t border-white/10 pt-8"
                data-testid={`testimonial-${i}`}
              >
                <div className="flex gap-1 mb-4">
                  {[0,1,2,3,4].map(s => (
                    <Star key={s} size={12} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="font-serif text-white text-xl md:text-2xl leading-relaxed mb-6">
                  &ldquo;{t.text}&rdquo;
                </blockquote>
                <figcaption className="flex items-baseline justify-between gap-4 flex-wrap">
                  <div>
                    <div className="text-white text-sm">{t.name}</div>
                    <div className="text-stone-500 text-[11px] uppercase tracking-[0.25em] mt-1">{t.loc}</div>
                  </div>
                  <div className="text-amber-400 text-[10px] uppercase tracking-[0.3em]">{t.job}</div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Coverage() {
  return (
    <section className="relative bg-stone-950 py-32 px-6 lg:px-16 overflow-hidden border-t border-white/5">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-10%" }}
        transition={{ duration: 1.5, ease: EASE }}
        className="absolute inset-0 z-0"
      >
        <img
          src="/images/hero/hdb-isometric-1600.webp"
          srcSet="/images/hero/hdb-isometric-800.webp 800w, /images/hero/hdb-isometric-1600.webp 1600w"
          sizes="100vw"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/70 to-stone-950/40" />
      </motion.div>
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <p className="text-[11px] tracking-[0.35em] uppercase text-amber-400 mb-4">Island-wide</p>
        <h2 className="font-serif text-white text-4xl md:text-6xl leading-[1.05] tracking-[-0.02em] mb-6">
          Every district. <span className="italic text-white/70">Every property type.</span>
        </h2>
        <p className="text-stone-300 text-base md:text-lg max-w-xl mx-auto leading-relaxed mb-10">
          HDBs, condominiums, landed properties, commercial spaces. Same-week scheduling.
          MCST-compliant teams.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <MagneticButton
            href="/estimate"
            testid="coverage-cta"
            onClick={() => trackEvent("cta_estimate_coverage", "/")}
          >
            Check Availability <ArrowRight size={16} />
          </MagneticButton>
          <MagneticButton
            href={WHATSAPP}
            external
            variant="outline"
            testid="coverage-whatsapp"
            onClick={() => trackEvent("cta_whatsapp_coverage", "/")}
          >
            <MessageCircle size={16} /> Ask on WhatsApp
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="relative bg-amber-500 text-stone-950 py-32 px-6 lg:px-16 overflow-hidden" data-testid="section-closing">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(0,0,0,0.15),transparent_60%)]" />
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <p className="text-[11px] tracking-[0.4em] uppercase text-stone-950/60 mb-6">Ready when you are</p>
        <h2 className="font-serif text-stone-950 text-5xl md:text-7xl lg:text-[88px] leading-[1] tracking-[-0.02em] mb-10">
          Get an itemised quote <br className="hidden md:block" />
          <span className="italic">in 60 seconds.</span>
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/estimate"
            className="inline-flex items-center gap-3 bg-stone-950 text-white px-10 py-5 rounded-full text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-stone-900 transition-colors"
            data-testid="closing-cta-quote"
            onClick={() => trackEvent("cta_estimate_closing", "/")}
          >
            Get a Quote <ArrowRight size={16} />
          </Link>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("cta_whatsapp_closing", "/")}
            className="inline-flex items-center gap-3 bg-stone-950/10 text-stone-950 border border-stone-950/30 px-10 py-5 rounded-full text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-stone-950/15 transition-colors"
            data-testid="closing-cta-whatsapp"
          >
            <MessageCircle size={16} /> WhatsApp +65 8088 0757
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-stone-950 border-t border-white/10 py-20 px-6 lg:px-16" data-testid="section-footer">
      <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-12">
        <div className="col-span-2">
          <div className="font-serif text-2xl tracking-[0.25em] uppercase text-white mb-4">TMG Install</div>
          <p className="text-stone-500 text-sm max-w-sm leading-relaxed">
            The Moving Guy Pte Ltd. Furniture installation, dismantling and relocation across
            Singapore. Fixed prices, zero surprises.
          </p>
        </div>
        <div>
          <h4 className="text-white text-[11px] uppercase tracking-[0.25em] mb-5">Services</h4>
          <ul className="space-y-3 text-sm text-stone-400">
            <li><a href="/services/wardrobe-installation-singapore" className="hover:text-amber-400 transition">Wardrobe Installation</a></li>
            <li><a href="/services/ikea-assembly-singapore" className="hover:text-amber-400 transition">IKEA Assembly</a></li>
            <li><a href="/services/office-fit-out-singapore" className="hover:text-amber-400 transition">Office Fit-Out</a></li>
            <li><a href="/services/furniture-relocation-singapore" className="hover:text-amber-400 transition">Furniture Relocation</a></li>
            <li><a href="/services/gym-equipment-assembly-singapore" className="hover:text-amber-400 transition">Gym Equipment</a></li>
            <li><a href="/services/bed-frame-installation-singapore" className="hover:text-amber-400 transition">Bed Frame Assembly</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white text-[11px] uppercase tracking-[0.25em] mb-5">Contact</h4>
          <ul className="space-y-3 text-sm text-stone-400">
            <li><a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition">WhatsApp +65 8088 0757</a></li>
            <li>7 Days a Week</li>
            <li>Including Public Holidays</li>
            <li><Link href="/terms" className="hover:text-amber-400 transition">Terms</Link></li>
            <li><Link href="/privacy" className="hover:text-amber-400 transition">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-7xl mt-16 pt-8 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-600">
        <span>© {new Date().getFullYear()} The Moving Guy Pte Ltd. All rights reserved.</span>
        <span>Singapore · 28 districts · Same-week service</span>
      </div>
    </footer>
  );
}

function StickyMobileCTA() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80 }}
          animate={{ y: 0 }}
          exit={{ y: 80 }}
          transition={{ duration: 0.4, ease: EASE }}
          className="md:hidden fixed bottom-0 inset-x-0 z-50 p-4 bg-gradient-to-t from-stone-950 via-stone-950/95 to-stone-950/0 pointer-events-none"
        >
          <div className="flex gap-3 pointer-events-auto">
            <Link
              href="/estimate"
              className="flex-1 bg-amber-500 text-stone-950 text-center py-4 rounded-full text-[12px] tracking-[0.2em] uppercase font-medium"
              data-testid="mobile-sticky-quote"
              onClick={() => trackEvent("cta_estimate_sticky", "/")}
            >
              Get a Quote
            </Link>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 text-white border border-white/20 px-5 py-4 rounded-full"
              data-testid="mobile-sticky-whatsapp"
              onClick={() => trackEvent("cta_whatsapp_sticky", "/")}
            >
              <MessageCircle size={18} />
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { damping: 30, stiffness: 200 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed top-0 inset-x-0 h-[2px] bg-amber-400 origin-left z-[60]"
      data-testid="scroll-progress"
    />
  );
}

function PromoBar() {
  const { promo, visible } = usePromoBar();
  if (!visible || !promo) return null;
  return (
    <div className="bg-amber-500 text-stone-950 text-center py-2 text-[11px] tracking-[0.2em] uppercase font-medium" data-testid="promo-bar">
      Use code <span className="font-bold">{promo.code}</span> — {promo.discount}% off your installation
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function LandingCinematic() {
  usePageTracker("/");
  useSEO({
    title: "TMG Install | Furniture Installation, Dismantling & Relocation Singapore",
    description:
      "Singapore's furniture installation specialists. Wardrobe assembly, bed frames, IKEA flatpack, office fit-outs, gym equipment & relocation. Itemised quote in 60 seconds. Island-wide, 7 days.",
    canonical: "https://tmginstall.com/",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "TMG Install — The Moving Guy Pte Ltd",
        telephone: "+6580880757",
        url: "https://tmginstall.com",
        areaServed: { "@type": "Country", name: "Singapore" },
        priceRange: "$$",
      },
    ],
  });

  return (
    <div className="bg-stone-950 text-white antialiased selection:bg-amber-400 selection:text-stone-950 font-sans">
      <PromoBar />
      <ScrollProgress />
      <Hero />
      <ServicesMarquee />
      <Stats />
      <ServicesGrid />
      <StickyStory />
      <PricingTable />
      <WorkReel />
      <Testimonials />
      <Coverage />
      <ClosingCTA />
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
