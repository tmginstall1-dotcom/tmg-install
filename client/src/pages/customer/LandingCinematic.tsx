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
   TMG INSTALL — CINEMATIC HOMEPAGE (paradiso-style scroll storytelling)
   Scope: redesign of "/" only. No backend, schema, or portal changes.
   Existing CTAs preserved: /estimate (quote) and the WhatsApp link.
   ────────────────────────────────────────────────────────────────── */

const WHATSAPP =
  "https://wa.me/6580880757?text=Hi%20TMG%20Install%2C%20I%20would%20like%20to%20get%20a%20quote%20for%20furniture%20installation%20or%20relocation.";

const HERO_FALLBACK_1600 = "/images/hero/exploded-wardrobe-1600.webp";
const HERO_FALLBACK_800 = "/images/hero/exploded-wardrobe-800.webp";

const NEAR_BLACK = "#050505";
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
      ? "bg-white text-black hover:bg-stone-100"
      : variant === "dark"
      ? "bg-black text-white hover:bg-stone-900 border border-white/10"
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

/* ─────────────────────── Top minimal nav ─────────────────────── */

function TopNav() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE }}
      className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 lg:px-12 py-5 text-white"
      data-testid="nav-top"
    >
      <Link
        href="/"
        className="font-serif text-xl tracking-[0.25em] uppercase text-white"
        data-testid="link-home"
      >
        TMG Install
      </Link>
      <div className="hidden md:flex items-center gap-8 text-[11px] tracking-[0.25em] uppercase text-white/70">
        <a href="#assembly-scroll" className="hover:text-white transition" data-testid="nav-process">Process</a>
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
  );
}

/* ─────────────────────── Pinned 3D + Story arc ───────────────────────
   One unified section. The 3D canvas is pinned (sticky) and parts
   assemble across the entire scroll arc:
     0–18%  : hero (parts exploded, idle)
     18–40% : chapter 01 DESCRIBE (parts begin to drift in)
     40–65% : chapter 02 VERIFY  (parts rotate and align)
     65–95% : chapter 03 COMPLETE (parts snap to assembled state)
     95–100%: assembled idle
   ─────────────────────────────────────────────────────────────────── */

const STORY_CHAPTERS = [
  {
    no: "01",
    code: "DESCRIBE",
    title: "Send the details.",
    body: "Photos, item list, pickup or install address. WhatsApp or our web form — whichever is faster.",
  },
  {
    no: "02",
    code: "VERIFY",
    title: "Receive a clear estimate.",
    body: "Our team reviews the work before confirmation. You see what's covered, what isn't, and what it costs.",
  },
  {
    no: "03",
    code: "COMPLETE",
    title: "Install, dismantle or relocate.",
    body: "Trained crew arrives on schedule, completes the work properly, clears the packaging.",
  },
];

function AssemblyScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const [showCanvas, setShowCanvas] = useState(false);
  const [activeChapter, setActiveChapter] = useState(-1);

  // Section is 5 viewports tall: 1 for hero, ~1.3 per chapter
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Drive 3D progress: 0 at hero start, 1 by end of chapter 03 (95%)
  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      if (reduce) {
        progressRef.current = 1;
        return;
      }
      // Map 0.18 → 0.95 to 0 → 1; before/after clamp
      const mapped = Math.max(0, Math.min(1, (v - 0.18) / (0.95 - 0.18)));
      progressRef.current = mapped;

      // Active chapter highlight
      if (v < 0.22) setActiveChapter(-1);
      else if (v < 0.45) setActiveChapter(0);
      else if (v < 0.7) setActiveChapter(1);
      else setActiveChapter(2);
    });
  }, [scrollYProgress, reduce]);

  // Defer canvas mount until interactive
  useEffect(() => {
    if (!hasWebGL()) return;
    const ric: any =
      (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 600));
    const id = ric(() => setShowCanvas(true));
    return () => {
      const cic: any = (window as any).cancelIdleCallback;
      if (cic && id) cic(id);
    };
  }, []);

  const showStaticFallback = !showCanvas || !hasWebGL();

  // Hero copy fade — starts 1, fades to 0 by 12% scroll
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroLift = useTransform(scrollYProgress, [0, 0.18], [0, -80]);

  // Chapter rail X-position: parts shift left when chapters appear (desktop)
  const canvasShift = useTransform(scrollYProgress, [0.15, 0.4], ["0%", isMobile ? "0%" : "-12%"]);

  return (
    <section
      ref={sectionRef}
      id="assembly-scroll"
      className="relative"
      style={{ height: "500vh", background: NEAR_BLACK }}
      data-testid="section-assembly"
    >
      <TopNav />
      {/* Sticky 3D + overlay text frame */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* 3D canvas (or static fallback) */}
        <motion.div
          style={{ x: canvasShift }}
          className="absolute inset-0 z-0 pointer-events-none"
        >
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
        <div className="absolute inset-0 z-[1] pointer-events-none" style={{ background: `radial-gradient(ellipse at center, transparent 0%, ${NEAR_BLACK}cc 80%)` }} />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1] opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />

        {/* HERO copy (fades out as user enters chapter 01) */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroLift }}
          className="absolute inset-0 z-20 flex flex-col justify-end px-6 lg:px-16 pb-24 md:pb-32 pointer-events-none"
        >
          <div className="max-w-6xl pointer-events-auto">
            <p className="text-[11px] tracking-[0.4em] uppercase text-white/55 mb-6">
              The Moving Guy · Singapore
            </p>
            <h1 className="font-serif text-white text-[42px] leading-[1.04] sm:text-6xl md:text-7xl lg:text-[88px] tracking-[-0.02em] max-w-5xl">
              Furniture Installation,<br />
              Dismantling & Relocation
              <br />
              <span className="italic text-white/85">— Built Properly.</span>
            </h1>
            <p className="mt-8 max-w-xl text-base md:text-lg text-stone-300 leading-relaxed">
              TMG Install helps homes, offices, landlords and businesses handle furniture
              assembly, dismantling, relocation support and office setup with clear
              coordination and professional workmanship.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
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
            </div>
          </div>
          {/* Scroll cue */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.8 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-[10px] tracking-[0.4em] uppercase"
            aria-hidden="true"
          >
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              Scroll
            </motion.div>
          </motion.div>
        </motion.div>

        {/* CHAPTER overlay — title strip top-left, chapter content bottom-right */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Story title strip — visible once user is past hero */}
          <motion.div
            style={{
              opacity: useTransform(scrollYProgress, [0.13, 0.2, 0.92, 0.98], [0, 1, 1, 0]),
            }}
            className="absolute top-24 md:top-28 left-6 lg:left-16 max-w-md"
          >
            <p className="text-[11px] tracking-[0.4em] uppercase text-white/55 mb-3">The Process</p>
            <h2 className="font-serif text-white text-3xl md:text-5xl leading-[1.05] tracking-[-0.02em]">
              From flat-pack chaos<br />
              <span className="italic text-white/65">to finished setup.</span>
            </h2>
            <div className="mt-6 flex gap-2" aria-hidden="true">
              {STORY_CHAPTERS.map((_, i) => (
                <div
                  key={i}
                  className={`h-[2px] w-10 transition-colors duration-500 ${i <= activeChapter ? "bg-white" : "bg-white/20"}`}
                />
              ))}
            </div>
          </motion.div>

          {/* Active chapter card — bottom right */}
          <div className="absolute bottom-12 md:bottom-20 right-6 md:right-16 left-6 md:left-auto max-w-sm md:max-w-md pointer-events-auto">
            <AnimatePresence mode="wait">
              {activeChapter >= 0 && (
                <motion.div
                  key={activeChapter}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -30 }}
                  transition={{ duration: 0.55, ease: EASE }}
                  className="border border-white/10 bg-black/60 backdrop-blur-sm p-7 md:p-9"
                  data-testid={`chapter-${activeChapter}`}
                >
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="font-serif text-white/30 text-3xl md:text-4xl">
                      {STORY_CHAPTERS[activeChapter].no}
                    </span>
                    <span className="text-[11px] tracking-[0.35em] uppercase text-white/55">
                      / {STORY_CHAPTERS[activeChapter].code}
                    </span>
                  </div>
                  <h3 className="font-serif text-white text-2xl md:text-3xl leading-[1.1] tracking-[-0.01em]">
                    {STORY_CHAPTERS[activeChapter].title}
                  </h3>
                  <p className="mt-4 text-stone-400 text-sm md:text-base leading-relaxed">
                    {STORY_CHAPTERS[activeChapter].body}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Services grid ─────────────────────── */

const SERVICES = [
  { icon: Hammer, title: "Furniture Installation", body: "Assembly for beds, wardrobes, tables, cabinets and more." },
  { icon: PackageOpen, title: "Furniture Dismantling", body: "Careful dismantling for moving, replacement or storage." },
  { icon: Building2, title: "Office Furniture Setup", body: "Workstations, office chairs, desks, pedestals and meeting room furniture." },
  { icon: Sofa, title: "Relocation Support", body: "Move-related dismantling, assembly and furniture handling support." },
  { icon: Home, title: "Wardrobe / Bed / Table Assembly", body: "Common home furniture installed with proper coordination." },
  { icon: RefreshCw, title: "Repair & Adjustment", body: "Basic furniture adjustment, tightening and minor repair support." },
];

function Services() {
  return (
    <section id="services" className="py-32 px-6 lg:px-16" style={{ background: NEAR_BLACK }} data-testid="section-services">
      <div className="mx-auto max-w-7xl">
        <div className="grid md:grid-cols-12 gap-12 mb-20">
          <div className="md:col-span-7">
            <p className="text-[11px] tracking-[0.35em] uppercase text-white/55 mb-4">What we do</p>
            <h2 className="font-serif text-white text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
              Furniture work, <span className="italic text-white/65">handled properly.</span>
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
                className="group relative p-10 hover:translate-y-[-4px] transition-transform duration-500 min-h-[280px] flex flex-col justify-between"
                style={{ background: NEAR_BLACK }}
                data-testid={`service-${i}`}
              >
                <div className="flex items-start justify-between">
                  <div className="text-[11px] tracking-[0.3em] uppercase text-stone-500">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <Icon size={22} className="text-white/40 group-hover:text-white transition-colors" strokeWidth={1.25} />
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

/* ─────────────────────── Why TMG (large text blocks) ─────────────────────── */

const WHY = [
  "Clear quote before work",
  "Photo-based assessment",
  "Suitable for homes, offices, landlords and operators",
  "Professional job coordination",
  "WhatsApp support",
  "Deposit-secured booking flow",
  "Completion photos where applicable",
];

function WhyTMG() {
  return (
    <section
      id="why"
      className="py-32 px-6 lg:px-16 border-t border-white/10"
      style={{ background: NEAR_BLACK }}
      data-testid="section-why"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-20 max-w-3xl">
          <p className="text-[11px] tracking-[0.35em] uppercase text-white/55 mb-4">Why TMG</p>
          <h2 className="font-serif text-white text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
            Why customers choose <span className="italic text-white/65">TMG Install.</span>
          </h2>
        </div>

        <ol className="border-t border-white/10">
          {WHY.map((label, i) => (
            <motion.li
              key={label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
              className="grid grid-cols-12 items-baseline gap-4 border-b border-white/10 py-7 md:py-9 group"
              data-testid={`why-${i}`}
            >
              <div className="col-span-2 md:col-span-1 text-[11px] tracking-[0.3em] uppercase text-white/40">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="col-span-10 md:col-span-11 font-serif text-white text-2xl md:text-4xl lg:text-5xl leading-[1.1] tracking-[-0.015em] group-hover:text-white transition-colors">
                {label}
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────── Process (horizontal timeline desktop / vertical mobile) ─────────────────────── */

const PROCESS = [
  { step: "01", title: "Send job details", body: "Photos, item list, location. WhatsApp or web form." },
  { step: "02", title: "Receive estimate", body: "Reviewed by our team. Itemised pricing where possible." },
  { step: "03", title: "Confirm booking", body: "Deposit secures your slot. Schedule confirmed by WhatsApp." },
  { step: "04", title: "Team completes the work", body: "Trained crew, the right tools, packaging cleared." },
  { step: "05", title: "Final payment after completion", body: "If applicable. Handover photos sent on request." },
];

function Process() {
  return (
    <section
      className="py-32 px-6 lg:px-16 border-t border-white/10 overflow-hidden"
      style={{ background: NEAR_BLACK }}
      data-testid="section-process"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 md:mb-24 max-w-3xl">
          <p className="text-[11px] tracking-[0.35em] uppercase text-white/55 mb-4">A cleaner way to book</p>
          <h2 className="font-serif text-white text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em]">
            A cleaner way to book <span className="italic text-white/65">furniture work.</span>
          </h2>
        </div>

        {/* Desktop horizontal timeline */}
        <div className="hidden md:block relative">
          <div className="absolute top-[34px] left-0 right-0 h-px bg-white/15" aria-hidden="true" />
          <div className="grid grid-cols-5 gap-6">
            {PROCESS.map((p, i) => (
              <motion.div
                key={p.step}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: EASE }}
                className="relative"
                data-testid={`process-${i}`}
              >
                <div className="relative z-10 flex flex-col items-start">
                  <div className="w-[14px] h-[14px] rounded-full bg-white border-4 border-[#050505] mb-1" />
                  <div className="mt-6 text-[11px] tracking-[0.3em] uppercase text-white/45 mb-2">{p.step}</div>
                  <h3 className="font-serif text-white text-xl lg:text-2xl leading-tight mb-3">{p.title}</h3>
                  <p className="text-stone-400 text-sm leading-relaxed">{p.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mobile vertical stacked timeline */}
        <div className="md:hidden relative pl-8">
          <div className="absolute top-2 bottom-2 left-[7px] w-px bg-white/15" aria-hidden="true" />
          {PROCESS.map((p, i) => (
            <motion.div
              key={p.step}
              initial={{ opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
              className="relative pb-12 last:pb-0"
              data-testid={`process-mobile-${i}`}
            >
              <div className="absolute -left-8 top-2 w-[14px] h-[14px] rounded-full bg-white border-4 border-[#050505]" />
              <div className="text-[11px] tracking-[0.3em] uppercase text-white/45 mb-2">{p.step}</div>
              <h3 className="font-serif text-white text-2xl leading-tight mb-3">{p.title}</h3>
              <p className="text-stone-400 text-sm leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Business customers ─────────────────────── */

function BusinessSection() {
  return (
    <section
      id="business"
      className="relative py-32 px-6 lg:px-16 overflow-hidden border-t border-white/10"
      style={{ background: NEAR_BLACK }}
      data-testid="section-business"
    >
      <div className="mx-auto max-w-7xl grid md:grid-cols-12 gap-16 items-center">
        <div className="md:col-span-7">
          <p className="text-[11px] tracking-[0.35em] uppercase text-white/55 mb-4">For Business</p>
          <h2 className="font-serif text-white text-4xl md:text-5xl lg:text-6xl leading-[1.05] tracking-[-0.02em] mb-8">
            For offices, landlords <span className="italic text-white/65">and co-living operators.</span>
          </h2>
          <p className="text-stone-400 text-base md:text-lg leading-relaxed max-w-xl mb-10">
            Need repeated installations, office desk setup, room turnover, bed frames,
            wardrobes or workstation assembly? TMG Install supports recurring furniture
            work with structured coordination.
          </p>
          <MagneticButton
            href={WHATSAPP}
            external
            variant="primary"
            testid="business-cta"
            onClick={() => trackEvent("cta_business_quote", "/")}
          >
            Request Business Quote <ArrowRight size={16} />
          </MagneticButton>
        </div>
        <div className="md:col-span-5">
          <div className="aspect-[4/5] relative bg-stone-900 overflow-hidden border border-white/10">
            <img
              src="/images/work/office-fitout-1600.webp"
              srcSet="/images/work/office-fitout-800.webp 800w, /images/work/office-fitout-1600.webp 1600w"
              sizes="(min-width: 1024px) 36vw, 90vw"
              alt="A 20-station office fit-out completed by TMG Install"
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover opacity-90"
            />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <div className="text-[10px] tracking-[0.3em] uppercase text-white/80 mb-1">Recent work</div>
              <div className="font-serif text-2xl">20-station office · CBD</div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Final CTA ─────────────────────── */

function FinalCTA() {
  return (
    <section
      className="relative py-32 px-6 lg:px-16 overflow-hidden border-t border-white/10"
      style={{ background: NEAR_BLACK }}
      data-testid="section-closing"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.05]"
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
        <p className="text-stone-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-12">
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

/* ─────────────────────── Footer (minimal) ─────────────────────── */

function Footer() {
  return (
    <footer
      className="border-t border-white/10 py-16 px-6 lg:px-16"
      style={{ background: NEAR_BLACK }}
      data-testid="section-footer"
    >
      <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
        <div>
          <div className="font-serif text-2xl tracking-[0.25em] uppercase text-white mb-3">TMG Install</div>
          <p className="text-stone-500 text-sm">The Moving Guy Pte Ltd · Singapore</p>
        </div>
        <div className="text-sm text-stone-400 space-y-2">
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="block hover:text-white transition" data-testid="footer-whatsapp">
            WhatsApp: +65 8088 0757
          </a>
          <Link href="/terms" className="block hover:text-white transition">Terms</Link>
          <Link href="/privacy" className="block hover:text-white transition">Privacy</Link>
        </div>
      </div>
      <div className="mx-auto max-w-7xl mt-12 pt-8 border-t border-white/5 text-xs text-stone-600">
        © {new Date().getFullYear()} The Moving Guy Pte Ltd. All rights reserved.
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
          className="md:hidden fixed bottom-0 inset-x-0 z-50 p-4 bg-gradient-to-t from-black via-black/95 to-black/0 pointer-events-none"
        >
          <div className="flex gap-3 pointer-events-auto">
            <Link
              href="/estimate"
              className="flex-1 bg-white text-black text-center py-4 rounded-full text-[12px] tracking-[0.2em] uppercase font-medium"
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
      className="bg-white text-black text-center py-2 text-[11px] tracking-[0.2em] uppercase font-medium relative z-[70]"
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
    <div
      className="text-white antialiased selection:bg-white selection:text-black font-sans"
      style={{ background: NEAR_BLACK }}
    >
      <PromoBar />
      <ScrollProgress />
      <AssemblyScroll />
      {/* TopNav is rendered inside AssemblyScroll so it scrolls away with the hero */}
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
