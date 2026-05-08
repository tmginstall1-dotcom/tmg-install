import { Link, useLocation } from "wouter";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  AnimatePresence,
} from "framer-motion";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  MessageCircle,
  Camera,
  Building2,
  Home,
  HeadphonesIcon,
  ShieldCheck,
  Wrench,
  Hammer,
  PackageOpen,
  Sofa,
  RefreshCw,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { usePromoBar } from "@/hooks/use-promo-bar";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";

/* ──────────────────────────────────────────────────────────────────
   TMG INSTALL — CINEMATIC HOMEPAGE
   Scope: redesign of "/" only. No backend, schema, or portal changes.
   Existing CTAs preserved: /estimate (quote) and the WhatsApp link.
   ────────────────────────────────────────────────────────────────── */

const WHATSAPP =
  "https://wa.me/6580880757?text=Hi%20TMG%20Install%2C%20I%20would%20like%20to%20get%20a%20quote%20for%20furniture%20installation%20or%20relocation.";

const HERO_FALLBACK_1600 = "/images/hero/exploded-wardrobe-1600.webp";
const HERO_FALLBACK_800 = "/images/hero/exploded-wardrobe-800.webp";

const EASE = [0.16, 1, 0.3, 1] as const;

/* Lazy-loaded 3D scene — kept out of the initial JS payload */
const ThreeFurnitureScene = lazy(() => import("@/components/home/ThreeFurnitureScene"));

/* WebGL availability detection (cached) */
let cachedWebGL: boolean | null = null;
function hasWebGL(): boolean {
  if (cachedWebGL !== null) return cachedWebGL;
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    cachedWebGL = !!(window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch {
    cachedWebGL = false;
  }
  return cachedWebGL;
}

/* Mobile detection (matchMedia, SSR-safe) */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/* ─────────────────────── Magnetic CTA button ─────────────────────── */

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
  variant?: "primary" | "ghost" | "outline" | "dark";
  testid?: string;
  external?: boolean;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduce = useReducedMotion();
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [, setLocation] = useLocation();

  function onMove(e: React.MouseEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      x: (e.clientX - (r.left + r.width / 2)) * 0.22,
      y: (e.clientY - (r.top + r.height / 2)) * 0.22,
    });
  }

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.();
    if (!external) {
      e.preventDefault();
      setLocation(href);
    }
  }

  const cls =
    variant === "primary"
      ? "bg-white text-stone-950 hover:bg-stone-100"
      : variant === "dark"
      ? "bg-stone-950 text-white hover:bg-stone-800"
      : variant === "outline"
      ? "bg-transparent text-white border border-white/30 hover:border-white hover:bg-white/5"
      : "bg-transparent text-white hover:bg-white/5";

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
      className={`group inline-flex items-center justify-center px-8 py-4 text-[12px] font-medium tracking-[0.18em] uppercase rounded-full transition-colors duration-300 ${cls}`}
    >
      <motion.span
        animate={{ x: pos.x, y: pos.y }}
        transition={{ type: "spring", stiffness: 220, damping: 16, mass: 0.4 }}
        className="inline-flex items-center gap-3"
      >
        {children}
      </motion.span>
    </a>
  );
}

/* ─────────────────────── Hero with 3D scene ─────────────────────── */

function Hero3D() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const [showCanvas, setShowCanvas] = useState(false);

  // Scroll-driven hero progress from start of page through 2 viewports
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Drive the 3D scene's progress ref via a one-way subscription
  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      progressRef.current = reduce ? 1 : v;
    });
    return () => unsub();
  }, [scrollYProgress, reduce]);

  // Defer canvas mount until the page is interactive (helps LCP)
  useEffect(() => {
    if (!hasWebGL()) return;
    const ric: any =
      (window as any).requestIdleCallback ||
      ((cb: any) => setTimeout(cb, 600));
    const id = ric(() => setShowCanvas(true));
    return () => {
      const cic: any = (window as any).cancelIdleCallback;
      if (cic && id) cic(id);
    };
  }, []);

  const heroFade = useTransform(scrollYProgress, [0, 0.7], [1, 0.2]);
  const heroLift = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-15%"]);

  const showStaticFallback = !showCanvas || !hasWebGL();

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[100vh] flex flex-col justify-end overflow-hidden bg-stone-950"
      data-testid="section-hero"
    >
      {/* 3D canvas (or static image fallback) */}
      <motion.div style={{ y: heroLift }} className="absolute inset-0 z-0">
        {showStaticFallback ? (
          <picture>
            <source media="(min-width: 768px)" srcSet={HERO_FALLBACK_1600} />
            <img
              src={HERO_FALLBACK_800}
              alt=""
              aria-hidden="true"
              // @ts-expect-error - lowercase variant for React 18
              fetchpriority="high"
              decoding="async"
              className="w-full h-full object-cover opacity-80"
            />
          </picture>
        ) : (
          <Suspense
            fallback={
              <picture>
                <source media="(min-width: 768px)" srcSet={HERO_FALLBACK_1600} />
                <img src={HERO_FALLBACK_800} alt="" aria-hidden="true" className="w-full h-full object-cover opacity-80" />
              </picture>
            }
          >
            <ThreeFurnitureScene progressRef={progressRef} isMobile={isMobile} />
          </Suspense>
        )}
      </motion.div>

      {/* Vignette + grid overlay */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-stone-950/40 via-stone-950/10 to-stone-950" />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[1] opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Top nav */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
        className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 lg:px-12 py-5"
      >
        <Link
          href="/"
          className="font-serif text-xl tracking-[0.25em] uppercase text-white"
          data-testid="link-home"
        >
          TMG Install
        </Link>
        <div className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.25em] uppercase text-white/60">
          <a href="#story" className="hover:text-white transition" data-testid="nav-story">Process</a>
          <a href="#services" className="hover:text-white transition" data-testid="nav-services">Services</a>
          <a href="#why" className="hover:text-white transition" data-testid="nav-why">Why TMG</a>
          <a href="#business" className="hover:text-white transition" data-testid="nav-business">Business</a>
        </div>
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("cta_whatsapp_nav", "/")}
          className="text-[11px] tracking-[0.25em] uppercase text-white border-b border-white/40 hover:border-white pb-1 transition"
          data-testid="nav-whatsapp"
        >
          WhatsApp
        </a>
      </motion.nav>

      {/* Hero copy */}
      <motion.div
        style={{ opacity: heroFade }}
        className="relative z-20 px-6 lg:px-16 pb-24 md:pb-32 max-w-6xl"
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
          className="text-[11px] tracking-[0.4em] uppercase text-white/55 mb-6"
        >
          The Moving Guy · Singapore
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
          className="font-serif text-white text-[42px] leading-[1.04] sm:text-6xl md:text-7xl lg:text-[88px] tracking-[-0.02em] max-w-5xl"
        >
          Furniture Installation,<br />
          Dismantling & Relocation
          <br />
          <span className="italic text-white/85">— Built Properly.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.55, ease: EASE }}
          className="mt-8 max-w-xl text-base md:text-lg text-stone-300 leading-relaxed"
        >
          TMG Install helps homes, offices, landlords and businesses handle furniture
          assembly, dismantling, relocation support and office setup with clear coordination
          and professional workmanship.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.75, ease: EASE }}
          className="mt-10 flex flex-wrap items-center gap-4"
        >
          <MagneticButton
            href="/estimate"
            testid="hero-cta-quote"
            onClick={() => trackEvent("cta_estimate_hero", "/")}
          >
            Get Instant Quote <ArrowRight size={16} className="-mr-1" />
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
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 text-white/40 text-[10px] tracking-[0.4em] uppercase"
        aria-hidden="true"
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

/* ─────────────────────── 3D scroll story ─────────────────────── */

const STORY_STEPS = [
  {
    no: "01",
    title: "Describe the job",
    body: "Send photos, item list and location. Brand-new flat-pack, an old wardrobe to dismantle, or a full office reset — give us the details and we work from there.",
  },
  {
    no: "02",
    title: "Get a clear estimate",
    body: "We review the work before confirmation. You see what's covered, what isn't, and what it costs. No site visits unless the job needs one.",
  },
  {
    no: "03",
    title: "Install, dismantle or relocate",
    body: "Our team arrives on schedule, completes the work properly, and clears the packaging. Photos sent on completion when applicable.",
  },
];

function ScrollStory() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const total = STORY_STEPS.length;
  const [active, setActive] = useState(0);

  useEffect(() => {
    return scrollYProgress.on("change", (p) => {
      const i = Math.min(total - 1, Math.max(0, Math.floor(p * total * 0.9999)));
      setActive((prev) => (prev === i ? prev : i));
    });
  }, [scrollYProgress, total]);

  return (
    <section
      ref={ref}
      id="story"
      className="relative bg-white text-stone-950"
      style={{ height: `${total * 100}vh` }}
      data-testid="section-story"
    >
      <div className="sticky top-0 h-screen flex items-stretch overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 w-full h-full">
          {/* Left — title */}
          <div className="md:col-span-5 lg:col-span-4 px-6 md:px-12 lg:px-16 py-20 md:py-0 flex flex-col justify-center border-b md:border-b-0 md:border-r border-stone-200">
            <p className="text-[11px] tracking-[0.35em] uppercase text-stone-500 mb-6">The Process</p>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
              From flat-pack chaos<br />
              <span className="italic text-stone-500">to finished setup.</span>
            </h2>
            <div className="mt-12 flex gap-2" aria-hidden="true">
              {STORY_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-[2px] w-12 transition-colors duration-500 ${i <= active ? "bg-stone-950" : "bg-stone-200"}`}
                />
              ))}
            </div>
          </div>

          {/* Right — active step */}
          <div className="md:col-span-7 lg:col-span-8 px-6 md:px-12 lg:px-24 flex items-center bg-stone-50">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.6, ease: EASE }}
                className="max-w-xl"
                data-testid={`story-step-${active}`}
              >
                <div className="font-serif text-stone-300 text-[120px] md:text-[200px] leading-none tracking-tight">
                  {STORY_STEPS[active].no}
                </div>
                <h3 className="mt-2 font-serif text-3xl md:text-5xl leading-[1.05] tracking-[-0.02em]">
                  {STORY_STEPS[active].title}
                </h3>
                <p className="mt-6 text-stone-600 text-base md:text-lg leading-relaxed max-w-md">
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

/* ─────────────────────── Services grid ─────────────────────── */

const SERVICES = [
  {
    icon: Hammer,
    title: "Furniture Installation",
    body: "Wardrobes, beds, tables, cabinets, shelving. Flat-pack and pre-assembled.",
  },
  {
    icon: PackageOpen,
    title: "Furniture Dismantling",
    body: "Old units broken down properly for disposal, storage or relocation.",
  },
  {
    icon: Building2,
    title: "Office Furniture Setup",
    body: "Workstations, conference tables, storage, partitions. Coordinated rollouts.",
  },
  {
    icon: Sofa,
    title: "Relocation Support",
    body: "Carry, dismantle and reinstall when moving between units, floors or sites.",
  },
  {
    icon: Home,
    title: "Wardrobe / Bed / Table Assembly",
    body: "IKEA, Castlery, Taobao, Lazada, Shopee — any brand, properly assembled.",
  },
  {
    icon: RefreshCw,
    title: "Repair & Adjustment",
    body: "Fixings tightened, doors realigned, parts replaced where needed.",
  },
];

function Services() {
  return (
    <section id="services" className="bg-stone-950 py-32 px-6 lg:px-16" data-testid="section-services">
      <div className="mx-auto max-w-7xl">
        <div className="grid md:grid-cols-12 gap-12 mb-20">
          <div className="md:col-span-7">
            <p className="text-[11px] tracking-[0.35em] uppercase text-white/55 mb-4">What we do</p>
            <h2 className="font-serif text-white text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
              Six core services. <span className="italic text-white/65">One standard.</span>
            </h2>
          </div>
          <div className="md:col-span-5 md:pt-10 text-stone-400 text-base leading-relaxed">
            Every job — from a single bed frame to a 40-station office — runs through the
            same coordination process. Clear quote, scheduled crew, photo handover.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10">
          {SERVICES.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.7, delay: i * 0.06, ease: EASE }}
                className="group relative bg-stone-950 p-10 hover:bg-stone-900 transition-colors duration-500 min-h-[280px] flex flex-col justify-between"
                data-testid={`service-${i}`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-[11px] tracking-[0.3em] uppercase text-stone-500">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <Icon size={22} className="text-white/50 group-hover:text-white transition-colors" />
                </div>
                <div className="mt-12">
                  <h3 className="font-serif text-2xl md:text-3xl text-white mb-3 leading-tight">
                    {s.title}
                  </h3>
                  <p className="text-stone-400 text-sm leading-relaxed mb-6">{s.body}</p>
                  <Link
                    href="/estimate"
                    className="inline-flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-white border-b border-white/30 pb-1 hover:border-white transition w-fit"
                    data-testid={`service-cta-${i}`}
                    onClick={() => trackEvent("cta_estimate_service", "/", s.title)}
                  >
                    Get Quote <ArrowUpRight size={14} />
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Why TMG ─────────────────────── */

const WHY = [
  { icon: Check, label: "Clear quote before work" },
  { icon: Camera, label: "Photo-based assessment" },
  { icon: Home, label: "Suitable for homes and offices" },
  { icon: ShieldCheck, label: "Professional coordination" },
  { icon: HeadphonesIcon, label: "WhatsApp support" },
  { icon: Wrench, label: "Deposit-secured booking flow" },
  { icon: Camera, label: "Completion photos where applicable" },
];

function WhyTMG() {
  return (
    <section id="why" className="bg-white text-stone-950 py-32 px-6 lg:px-16 border-t border-stone-200" data-testid="section-why">
      <div className="mx-auto max-w-7xl">
        <div className="grid md:grid-cols-12 gap-16 items-end mb-20">
          <div className="md:col-span-7">
            <p className="text-[11px] tracking-[0.35em] uppercase text-stone-500 mb-4">Why TMG Install</p>
            <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
              The standard <span className="italic text-stone-500">we hold ourselves to.</span>
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-stone-200">
          {WHY.map((w, i) => {
            const Icon = w.icon;
            return (
              <motion.div
                key={w.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
                className="bg-white p-8 md:p-10 flex items-start gap-5"
                data-testid={`why-${i}`}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full border border-stone-300 flex items-center justify-center">
                  <Icon size={16} className="text-stone-950" />
                </div>
                <div>
                  <div className="text-[10px] tracking-[0.3em] uppercase text-stone-400 mb-2">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <p className="text-stone-950 text-lg font-serif leading-snug">{w.label}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Process (5 steps) ─────────────────────── */

const PROCESS = [
  { step: "Step 1", title: "Send job details", body: "Photos, item list, location. WhatsApp or web form." },
  { step: "Step 2", title: "Receive estimate", body: "Reviewed by our team. Itemised pricing where possible." },
  { step: "Step 3", title: "Confirm booking", body: "Deposit secures your slot. Schedule confirmed by WhatsApp." },
  { step: "Step 4", title: "Team completes the work", body: "Trained crew, the right tools, packaging cleared." },
  { step: "Step 5", title: "Final payment after completion", body: "If applicable. Handover photos sent on request." },
];

function Process() {
  return (
    <section className="bg-stone-950 text-white py-32 px-6 lg:px-16 border-t border-white/5" data-testid="section-process">
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 max-w-3xl">
          <p className="text-[11px] tracking-[0.35em] uppercase text-white/55 mb-4">A cleaner way to book</p>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
            A cleaner way to book <span className="italic text-white/65">furniture work.</span>
          </h2>
        </div>
        <ol className="border-t border-white/10">
          {PROCESS.map((p, i) => (
            <motion.li
              key={p.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: EASE }}
              className="grid grid-cols-12 items-baseline gap-4 border-b border-white/10 py-8 group hover:bg-white/[0.02] transition-colors px-2"
              data-testid={`process-${i}`}
            >
              <div className="col-span-2 text-[11px] tracking-[0.3em] uppercase text-white/45">{p.step}</div>
              <div className="col-span-7 md:col-span-6 font-serif text-2xl md:text-3xl text-white group-hover:text-white">
                {p.title}
              </div>
              <div className="col-span-3 md:col-span-4 text-stone-400 text-sm md:text-base leading-relaxed">
                {p.body}
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────── Business customers ─────────────────────── */

function BusinessSection() {
  return (
    <section id="business" className="relative bg-white text-stone-950 py-32 px-6 lg:px-16 overflow-hidden border-t border-stone-200" data-testid="section-business">
      <div className="mx-auto max-w-7xl grid md:grid-cols-12 gap-16 items-center">
        <div className="md:col-span-7">
          <p className="text-[11px] tracking-[0.35em] uppercase text-stone-500 mb-4">For Business</p>
          <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] mb-8">
            For offices, landlords <span className="italic text-stone-500">and co-living operators.</span>
          </h2>
          <p className="text-stone-600 text-base md:text-lg leading-relaxed max-w-xl mb-10">
            Need repeated installations, office desk setup, room turnover, bed frames,
            wardrobes or workstation assembly? TMG Install supports recurring furniture
            work with structured coordination.
          </p>
          <MagneticButton
            href={WHATSAPP}
            external
            variant="dark"
            testid="business-cta"
            onClick={() => trackEvent("cta_business_quote", "/")}
          >
            Request Business Quote <ArrowRight size={16} />
          </MagneticButton>
        </div>
        <div className="md:col-span-5">
          <div className="aspect-[4/5] relative bg-stone-100 overflow-hidden border border-stone-200">
            <img
              src="/images/work/office-fitout-1600.webp"
              srcSet="/images/work/office-fitout-800.webp 800w, /images/work/office-fitout-1600.webp 1600w"
              sizes="(min-width: 1024px) 36vw, 90vw"
              alt="A 20-station office fit-out completed by TMG Install"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <div className="text-[10px] tracking-[0.3em] uppercase text-white/80 mb-1">Recent work</div>
              <div className="font-serif text-2xl">20-station office · CBD</div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Final CTA ─────────────────────── */

function FinalCTA() {
  return (
    <section className="relative bg-stone-950 text-white py-32 px-6 lg:px-16 overflow-hidden" data-testid="section-closing">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <p className="text-[11px] tracking-[0.4em] uppercase text-white/50 mb-6">Ready when you are</p>
        <h2 className="font-serif text-white text-4xl md:text-6xl lg:text-[80px] leading-[1.05] tracking-[-0.02em] mb-8">
          Need furniture installed,<br />
          <span className="italic text-white/80">dismantled or moved?</span>
        </h2>
        <p className="text-stone-300 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-12">
          Send us photos, item list and location. We will help estimate the work clearly
          before confirmation.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <MagneticButton
            href="/estimate"
            testid="closing-cta-quote"
            onClick={() => trackEvent("cta_estimate_closing", "/")}
          >
            Get Instant Quote <ArrowRight size={16} />
          </MagneticButton>
          <MagneticButton
            href={WHATSAPP}
            external
            variant="outline"
            testid="closing-cta-whatsapp"
            onClick={() => trackEvent("cta_whatsapp_closing", "/")}
          >
            <MessageCircle size={16} /> WhatsApp Us
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Footer ─────────────────────── */

function Footer() {
  return (
    <footer className="bg-stone-950 text-white border-t border-white/10 py-20 px-6 lg:px-16" data-testid="section-footer">
      <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-12">
        <div className="col-span-2">
          <div className="font-serif text-2xl tracking-[0.25em] uppercase mb-4">TMG Install</div>
          <p className="text-stone-500 text-sm max-w-sm leading-relaxed">
            The Moving Guy Pte Ltd. Furniture installation, dismantling and relocation
            across Singapore. Clear quotes, professional coordination.
          </p>
        </div>
        <div>
          <h4 className="text-white text-[11px] uppercase tracking-[0.25em] mb-5">Services</h4>
          <ul className="space-y-3 text-sm text-stone-400">
            <li><Link href="/estimate" className="hover:text-white transition">Furniture Installation</Link></li>
            <li><Link href="/estimate" className="hover:text-white transition">Dismantling</Link></li>
            <li><Link href="/estimate" className="hover:text-white transition">Office Setup</Link></li>
            <li><Link href="/estimate" className="hover:text-white transition">Relocation Support</Link></li>
            <li><Link href="/estimate" className="hover:text-white transition">Repair & Adjustment</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white text-[11px] uppercase tracking-[0.25em] mb-5">Contact</h4>
          <ul className="space-y-3 text-sm text-stone-400">
            <li><a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">WhatsApp +65 8088 0757</a></li>
            <li>7 Days a Week</li>
            <li><Link href="/terms" className="hover:text-white transition">Terms</Link></li>
            <li><Link href="/privacy" className="hover:text-white transition">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-7xl mt-16 pt-8 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-600">
        <span>© {new Date().getFullYear()} The Moving Guy Pte Ltd. All rights reserved.</span>
        <span>Singapore · Island-wide</span>
      </div>
    </footer>
  );
}

/* ─────────────────────── Sticky mobile CTA ─────────────────────── */

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
              className="flex-1 bg-white text-stone-950 text-center py-4 rounded-full text-[12px] tracking-[0.2em] uppercase font-medium"
              data-testid="mobile-sticky-quote"
              onClick={() => trackEvent("cta_estimate_sticky", "/")}
            >
              Quote
            </Link>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-white/10 text-white border border-white/20 text-center py-4 rounded-full text-[12px] tracking-[0.2em] uppercase font-medium inline-flex items-center justify-center gap-2"
              data-testid="mobile-sticky-whatsapp"
              onClick={() => trackEvent("cta_whatsapp_sticky", "/")}
            >
              <MessageCircle size={16} /> WhatsApp
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────── Top scroll progress ─────────────────────── */

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { damping: 30, stiffness: 200 });
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed top-0 inset-x-0 h-[2px] bg-white origin-left z-[60]"
      data-testid="scroll-progress"
    />
  );
}

/* ─────────────────────── Promo bar ─────────────────────── */

function PromoBar() {
  const { promo, visible } = usePromoBar();
  if (!visible || !promo) return null;
  return (
    <div
      className="bg-white text-stone-950 text-center py-2 text-[11px] tracking-[0.2em] uppercase font-medium"
      data-testid="promo-bar"
    >
      Use code <span className="font-bold">{promo.code}</span> — {promo.discount}% off your installation
    </div>
  );
}

/* ─────────────────────── Page ─────────────────────── */

export default function LandingCinematic() {
  usePageTracker("/");
  useSEO({
    title: "TMG Install | Furniture Installation, Dismantling & Relocation Singapore",
    description:
      "Professional furniture installation, dismantling, relocation support and office setup in Singapore. Get a fast quote from TMG Install today.",
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
    <div className="bg-stone-950 text-white antialiased selection:bg-white selection:text-stone-950 font-sans">
      <PromoBar />
      <ScrollProgress />
      <Hero3D />
      <ScrollStory />
      <Services />
      <WhyTMG />
      <Process />
      <BusinessSection />
      <FinalCTA />
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
