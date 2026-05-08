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
  MessageCircle,
} from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { usePromoBar } from "@/hooks/use-promo-bar";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";

/* ──────────────────────────────────────────────────────────────────
   TMG INSTALL — EDITORIAL/CINEMATIC HOMEPAGE
   Scope: redesign of "/" only. No backend, schema, or portal changes.
   Existing CTAs preserved: /estimate (quote) and the WhatsApp link.
   ────────────────────────────────────────────────────────────────── */

const WHATSAPP =
  "https://wa.me/6580880757?text=Hi%20TMG%20Install%2C%20I%20would%20like%20to%20get%20a%20quote%20for%20furniture%20installation%20or%20relocation.";

const HERO_FALLBACK_1600 = "/images/hero/exploded-wardrobe-1600.webp";
const HERO_FALLBACK_800 = "/images/hero/exploded-wardrobe-800.webp";

const NEAR_BLACK = "#050505";
const PAPER = "#ededea";
const EASE = [0.16, 1, 0.3, 1] as const;

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

/* ─────────────────────── Reusable: tiny editorial label ─────────────────────── */

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] md:text-[11px] tracking-[0.4em] uppercase text-white/55 ${className}`}>
      {children}
    </span>
  );
}

/* ─────────────────────── Reusable: word-by-word reveal ─────────────────────── */

function RevealLine({
  children,
  delay = 0,
  className = "",
  as: As = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}) {
  const reduce = useReducedMotion();
  return (
    <As className={`overflow-hidden ${className}`}>
      <motion.div
        initial={reduce ? { y: 0, opacity: 1 } : { y: "100%", opacity: 0 }}
        whileInView={{ y: "0%", opacity: 1 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 1.05, delay, ease: EASE }}
      >
        {children}
      </motion.div>
    </As>
  );
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
  variant?: "primary" | "outline" | "dark";
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
      : "bg-transparent text-white border border-white/30 hover:border-white hover:bg-white/5";

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
      className={`group inline-flex items-center justify-center px-9 py-[18px] text-[11px] font-medium tracking-[0.22em] uppercase rounded-full transition-colors duration-300 ${cls}`}
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
      className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 md:px-10 lg:px-16 py-6 text-white"
      data-testid="nav-top"
    >
      <Link
        href="/"
        className="text-[11px] tracking-[0.4em] uppercase text-white"
        data-testid="link-home"
      >
        TMG / INSTALL
      </Link>
      <div className="hidden md:flex items-center gap-10 text-[10px] tracking-[0.35em] uppercase text-white/65">
        <a href="#assembly-scroll" className="hover:text-white transition" data-testid="nav-process">Process</a>
        <a href="#services" className="hover:text-white transition" data-testid="nav-services">Services</a>
        <a href="#why" className="hover:text-white transition" data-testid="nav-why">Index</a>
        <a href="#business" className="hover:text-white transition" data-testid="nav-business">Business</a>
      </div>
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent("cta_whatsapp_nav", "/")}
        className="text-[10px] tracking-[0.35em] uppercase text-white border-b border-white/40 hover:border-white pb-1 transition"
        data-testid="nav-whatsapp"
      >
        WhatsApp
      </a>
    </motion.nav>
  );
}

/* ─────────────────────── Pinned 3D + Story arc ─────────────────────── */

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

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      if (reduce) {
        progressRef.current = 1;
        return;
      }
      // Stretch motion: parts begin moving immediately and finish at 92%.
      const mapped = Math.max(0, Math.min(1, (v - 0.08) / (0.92 - 0.08)));
      progressRef.current = mapped;

      if (v < 0.22) setActiveChapter(-1);
      else if (v < 0.45) setActiveChapter(0);
      else if (v < 0.7) setActiveChapter(1);
      else setActiveChapter(2);
    });
  }, [scrollYProgress, reduce]);

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

  // Hero copy: fade and lift away as user enters the chapter zone
  const heroOpacity = useTransform(scrollYProgress, [0, 0.13], [1, 0]);
  const heroLift = useTransform(scrollYProgress, [0, 0.18], [0, -100]);

  // Parallax: canvas drifts subtly as chapters move through
  const canvasShiftX = useTransform(scrollYProgress, [0.15, 0.95], ["0%", isMobile ? "0%" : "-8%"]);
  const canvasShiftY = useTransform(scrollYProgress, [0.15, 0.95], ["0%", isMobile ? "0%" : "-4%"]);

  // Title strip slow parallax
  const titleParallax = useTransform(scrollYProgress, [0.13, 0.92], [0, -40]);

  // Scroll progress bar inside the section
  const sectionProgressScale = useTransform(scrollYProgress, [0.18, 0.95], [0, 1]);

  return (
    <section
      ref={sectionRef}
      id="assembly-scroll"
      className="relative"
      style={{ height: "560vh", background: NEAR_BLACK }}
      data-testid="section-assembly"
    >
      <TopNav />

      {/* Sticky stage */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* 3D canvas (or static fallback) */}
        <motion.div
          style={{ x: canvasShiftX, y: canvasShiftY }}
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
        <div className="absolute inset-0 z-[1] pointer-events-none" style={{ background: `radial-gradient(ellipse at center, transparent 0%, ${NEAR_BLACK}cc 85%)` }} />
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1] opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
            backgroundSize: "120px 120px",
          }}
        />

        {/* Editorial frame: thin top + bottom + side rails */}
        <div className="absolute inset-x-6 md:inset-x-10 lg:inset-x-16 top-20 md:top-24 bottom-12 md:bottom-16 border border-white/10 z-[2] pointer-events-none" />

        {/* Left rail caption + section number */}
        <div className="hidden md:flex absolute left-10 lg:left-20 top-32 lg:top-40 flex-col gap-3 z-[3] pointer-events-none">
          <Label>§ 00 / Index</Label>
          <Label>SG / Island-wide</Label>
        </div>

        {/* Right rail vertical text */}
        <div className="hidden md:flex absolute right-10 lg:right-20 top-32 lg:top-40 z-[3] pointer-events-none">
          <Label className="[writing-mode:vertical-rl] rotate-180">
            EST. 2019 — TMG INSTALL — SINGAPORE
          </Label>
        </div>

        {/* In-section progress meter (bottom of frame) */}
        <div className="absolute bottom-16 md:bottom-20 left-6 md:left-10 lg:left-16 right-6 md:right-10 lg:right-16 z-[3] pointer-events-none">
          <div className="flex items-center gap-4">
            <Label>Assembly</Label>
            <div className="flex-1 h-px bg-white/10 origin-left">
              <motion.div style={{ scaleX: sectionProgressScale }} className="h-px bg-white origin-left" />
            </div>
            <Label>Complete</Label>
          </div>
        </div>

        {/* HERO copy (fades out as user enters chapter zone) */}
        <motion.div
          style={{ opacity: heroOpacity, y: heroLift }}
          className="absolute inset-0 z-20 flex flex-col justify-center px-6 md:px-16 lg:px-24 pointer-events-none"
        >
          <div className="max-w-[1400px] pointer-events-auto">
            <RevealLine delay={0.1} className="mb-6 md:mb-8">
              <Label>Singapore · Furniture installation studio</Label>
            </RevealLine>
            <h1
              className="font-serif text-white tracking-[-0.035em] leading-[0.92]"
              style={{ fontSize: "clamp(56px, 13vw, 220px)" }}
              data-testid="hero-headline"
            >
              <RevealLine delay={0.15}>Furniture,</RevealLine>
              <RevealLine delay={0.28}>
                <span className="italic text-white/85">built properly.</span>
              </RevealLine>
            </h1>
            <RevealLine delay={0.45} className="mt-10 md:mt-14">
              <p className="max-w-xl text-base md:text-lg text-stone-300 leading-relaxed">
                Installation, dismantling, relocation support and office setup for homes,
                offices, landlords and businesses across Singapore.
              </p>
            </RevealLine>
            <RevealLine delay={0.6} className="mt-10 md:mt-12">
              <div className="flex flex-wrap items-center gap-4">
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
            </RevealLine>
          </div>
        </motion.div>

        {/* CHAPTER overlay */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {/* Story title — top left */}
          <motion.div
            style={{
              y: titleParallax,
              opacity: useTransform(scrollYProgress, [0.13, 0.2, 0.92, 0.98], [0, 1, 1, 0]),
            }}
            className="absolute top-28 md:top-32 left-6 md:left-16 lg:left-24 max-w-[780px]"
          >
            <Label className="block mb-4">§ 01 / The Process</Label>
            <h2
              className="font-serif text-white tracking-[-0.03em] leading-[0.95]"
              style={{ fontSize: "clamp(36px, 6vw, 96px)" }}
            >
              From flat-pack <span className="italic text-white/70">chaos</span><br />
              to finished <span className="italic text-white/70">setup.</span>
            </h2>
            <div className="mt-8 flex gap-2" aria-hidden="true">
              {STORY_CHAPTERS.map((_, i) => (
                <div
                  key={i}
                  className={`h-[2px] w-12 transition-colors duration-500 ${i <= activeChapter ? "bg-white" : "bg-white/15"}`}
                />
              ))}
            </div>
          </motion.div>

          {/* Active chapter — bottom right */}
          <div className="absolute bottom-28 md:bottom-36 right-6 md:right-16 lg:right-24 left-6 md:left-auto max-w-md md:max-w-[440px] pointer-events-auto">
            <AnimatePresence mode="wait">
              {activeChapter >= 0 && (
                <motion.div
                  key={activeChapter}
                  initial={{ opacity: 0, y: 36 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -36 }}
                  transition={{ duration: 0.65, ease: EASE }}
                  className="border-t border-white/30 pt-8 pr-2"
                  data-testid={`chapter-${activeChapter}`}
                >
                  <div className="flex items-baseline gap-3 mb-6">
                    <span className="font-serif text-white text-5xl md:text-6xl">
                      {STORY_CHAPTERS[activeChapter].no}
                    </span>
                    <Label>/ {STORY_CHAPTERS[activeChapter].code}</Label>
                  </div>
                  <h3
                    className="font-serif text-white leading-[0.95] tracking-[-0.02em]"
                    style={{ fontSize: "clamp(28px, 3.6vw, 52px)" }}
                  >
                    {STORY_CHAPTERS[activeChapter].title}
                  </h3>
                  <p className="mt-5 text-stone-400 text-sm md:text-base leading-relaxed max-w-sm">
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

/* ─────────────────────── Section header (editorial) ─────────────────────── */

function SectionHeader({
  no,
  eyebrow,
  title,
}: {
  no: string;
  eyebrow: string;
  title: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-8 mb-20 md:mb-32">
      <div className="col-span-12 md:col-span-3 lg:col-span-2 flex flex-col gap-3">
        <Label>§ {no}</Label>
        <Label>{eyebrow}</Label>
      </div>
      <div className="col-span-12 md:col-span-9 lg:col-span-10">
        <RevealLine>
          <h2
            className="font-serif text-white tracking-[-0.03em] leading-[0.92]"
            style={{ fontSize: "clamp(40px, 8vw, 144px)" }}
          >
            {title}
          </h2>
        </RevealLine>
      </div>
    </div>
  );
}

/* ─────────────────────── Services (editorial rows, not cards) ─────────────────────── */

const SERVICES = [
  { n: "01", title: "Furniture Installation", body: "Assembly for beds, wardrobes, tables, cabinets and more.", tag: "RESIDENTIAL · COMMERCIAL" },
  { n: "02", title: "Furniture Dismantling", body: "Careful dismantling for moving, replacement or storage.", tag: "DISPOSAL READY" },
  { n: "03", title: "Office Furniture Setup", body: "Workstations, office chairs, desks, pedestals and meeting room furniture.", tag: "FIT-OUT" },
  { n: "04", title: "Relocation Support", body: "Move-related dismantling, assembly and furniture handling support.", tag: "ON-SITE" },
  { n: "05", title: "Wardrobe / Bed / Table Assembly", body: "Common home furniture installed with proper coordination.", tag: "FLAT-PACK" },
  { n: "06", title: "Repair & Adjustment", body: "Basic furniture adjustment, tightening and minor repair support.", tag: "MAINTENANCE" },
];

function Services() {
  return (
    <section
      id="services"
      className="py-32 md:py-48 px-6 md:px-10 lg:px-16 border-t border-white/10"
      style={{ background: NEAR_BLACK }}
      data-testid="section-services"
    >
      <div className="mx-auto max-w-[1600px]">
        <SectionHeader
          no="02"
          eyebrow="Services / Index"
          title={
            <>
              Furniture work,<br />
              <span className="italic text-white/65">handled properly.</span>
            </>
          }
        />

        <ol className="border-t border-white/15">
          {SERVICES.map((s, i) => (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: EASE }}
              className="border-b border-white/15"
              data-testid={`service-${i}`}
            >
              <Link
                href="/estimate"
                className="group grid grid-cols-12 gap-4 md:gap-8 py-10 md:py-14 hover:bg-white/[0.025] transition-colors duration-500"
                onClick={() => trackEvent("cta_estimate_service", "/", s.title)}
                data-testid={`service-cta-${i}`}
              >
                <div className="col-span-2 md:col-span-1 pt-2">
                  <span className="font-serif text-white/40 text-xl md:text-2xl">{s.n}</span>
                </div>
                <div className="col-span-10 md:col-span-7 lg:col-span-7">
                  <h3
                    className="font-serif text-white tracking-[-0.02em] leading-[0.98] group-hover:translate-x-2 transition-transform duration-500"
                    style={{ fontSize: "clamp(28px, 4.5vw, 72px)" }}
                  >
                    {s.title}
                  </h3>
                </div>
                <div className="hidden md:flex md:col-span-3 lg:col-span-3 items-start pt-3">
                  <p className="text-stone-400 text-sm md:text-base leading-relaxed">{s.body}</p>
                </div>
                <div className="hidden md:flex md:col-span-1 items-start justify-end pt-3 gap-3">
                  <Label className="hidden lg:inline-block opacity-50 group-hover:opacity-100 transition">{s.tag}</Label>
                  <ArrowUpRight size={22} strokeWidth={1.25} className="text-white/40 group-hover:text-white group-hover:rotate-45 transition-all duration-500 mt-1" />
                </div>
                {/* mobile body */}
                <div className="md:hidden col-span-12 mt-3">
                  <p className="text-stone-400 text-sm leading-relaxed">{s.body}</p>
                </div>
              </Link>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────── Why TMG (huge editorial list) ─────────────────────── */

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
      className="py-32 md:py-48 px-6 md:px-10 lg:px-16 border-t border-white/10"
      style={{ background: NEAR_BLACK }}
      data-testid="section-why"
    >
      <div className="mx-auto max-w-[1600px]">
        <SectionHeader
          no="03"
          eyebrow="Index / Why"
          title={
            <>
              Why customers<br />
              <span className="italic text-white/65">choose TMG.</span>
            </>
          }
        />

        <ol className="border-t border-white/15">
          {WHY.map((label, i) => (
            <motion.li
              key={label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.65, delay: i * 0.05, ease: EASE }}
              className="grid grid-cols-12 gap-4 md:gap-8 items-baseline border-b border-white/15 py-9 md:py-14 group"
              data-testid={`why-${i}`}
            >
              <div className="col-span-2 md:col-span-1">
                <span className="font-serif text-white/40 text-xl md:text-2xl">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="col-span-10 md:col-span-11">
                <p
                  className="font-serif text-white tracking-[-0.02em] leading-[1.0] group-hover:translate-x-2 transition-transform duration-500"
                  style={{ fontSize: "clamp(28px, 5.2vw, 88px)" }}
                >
                  {label}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────── Process (timeline) ─────────────────────── */

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
      className="py-32 md:py-48 px-6 md:px-10 lg:px-16 border-t border-white/10 overflow-hidden"
      style={{ background: NEAR_BLACK }}
      data-testid="section-process"
    >
      <div className="mx-auto max-w-[1600px]">
        <SectionHeader
          no="04"
          eyebrow="Method / Booking"
          title={
            <>
              A cleaner way to book<br />
              <span className="italic text-white/65">furniture work.</span>
            </>
          }
        />

        {/* Desktop horizontal timeline */}
        <div className="hidden md:block relative">
          <div className="absolute top-[34px] left-0 right-0 h-px bg-white/15" aria-hidden="true" />
          <div className="grid grid-cols-5 gap-8 lg:gap-12">
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
                  <div className="mt-8 text-[10px] tracking-[0.35em] uppercase text-white/45 mb-3">{p.step}</div>
                  <h3 className="font-serif text-white text-2xl lg:text-[34px] leading-[1.05] tracking-[-0.015em] mb-4">{p.title}</h3>
                  <p className="text-stone-400 text-sm leading-relaxed">{p.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mobile vertical timeline */}
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
              <div className="text-[10px] tracking-[0.35em] uppercase text-white/45 mb-2">{p.step}</div>
              <h3 className="font-serif text-white text-2xl leading-tight mb-3">{p.title}</h3>
              <p className="text-stone-400 text-sm leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Business (paper-toned panel for contrast) ─────────────────────── */

function BusinessSection() {
  return (
    <section
      id="business"
      className="relative py-32 md:py-48 px-6 md:px-10 lg:px-16 overflow-hidden border-t border-white/10"
      style={{ background: PAPER, color: NEAR_BLACK }}
      data-testid="section-business"
    >
      <div className="mx-auto max-w-[1600px] grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-7">
          <div className="flex flex-col gap-3 mb-8">
            <span className="text-[10px] md:text-[11px] tracking-[0.4em] uppercase text-black/55">§ 05</span>
            <span className="text-[10px] md:text-[11px] tracking-[0.4em] uppercase text-black/55">For Business</span>
          </div>
          <RevealLine>
            <h2
              className="font-serif tracking-[-0.03em] leading-[0.95] mb-10 md:mb-14"
              style={{ fontSize: "clamp(40px, 7vw, 120px)" }}
            >
              For offices, landlords<br />
              <span className="italic text-black/55">and operators.</span>
            </h2>
          </RevealLine>
          <p className="text-black/60 text-base md:text-lg leading-relaxed max-w-xl mb-12">
            Need repeated installations, office desk setup, room turnover, bed frames,
            wardrobes or workstation assembly? TMG Install supports recurring furniture
            work with structured coordination.
          </p>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("cta_business_quote", "/")}
            className="inline-flex items-center justify-center px-9 py-[18px] text-[11px] font-medium tracking-[0.22em] uppercase rounded-full bg-black text-white hover:bg-stone-800 transition gap-3"
            data-testid="business-cta"
          >
            Request Business Quote <ArrowRight size={16} />
          </a>
        </div>
        <div className="md:col-span-5">
          <div className="aspect-[4/5] relative bg-stone-300 overflow-hidden border border-black/10">
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
              <div className="text-[10px] tracking-[0.35em] uppercase text-white/85 mb-1">Recent work</div>
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
      className="relative py-32 md:py-48 px-6 md:px-10 lg:px-16 overflow-hidden border-t border-white/10"
      style={{ background: NEAR_BLACK }}
      data-testid="section-closing"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
        }}
      />
      <div className="relative z-10 mx-auto max-w-[1600px]">
        <div className="grid grid-cols-12 gap-4 md:gap-8 mb-16">
          <div className="col-span-12 md:col-span-3 lg:col-span-2 flex flex-col gap-3">
            <Label>§ 06</Label>
            <Label>Closing</Label>
          </div>
          <div className="col-span-12 md:col-span-9 lg:col-span-10">
            <RevealLine>
              <h2
                className="font-serif text-white tracking-[-0.035em] leading-[0.9]"
                style={{ fontSize: "clamp(48px, 10vw, 200px)" }}
              >
                Need furniture<br />
                installed,<br />
                <span className="italic text-white/65">moved or removed?</span>
              </h2>
            </RevealLine>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-8 items-end mt-20 border-t border-white/15 pt-12">
          <div className="col-span-12 md:col-span-7 lg:col-span-6 md:col-start-4 lg:col-start-3">
            <p className="text-stone-300 text-base md:text-lg max-w-xl leading-relaxed mb-10">
              Send us photos, item list and location. We will help estimate the work clearly
              before confirmation.
            </p>
            <div className="flex flex-wrap items-center gap-4">
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
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Footer ─────────────────────── */

function Footer() {
  return (
    <footer
      className="border-t border-white/10 py-16 md:py-20 px-6 md:px-10 lg:px-16"
      style={{ background: NEAR_BLACK }}
      data-testid="section-footer"
    >
      <div className="mx-auto max-w-[1600px] grid grid-cols-12 gap-4 md:gap-8 items-end">
        <div className="col-span-12 md:col-span-6">
          <div
            className="font-serif text-white tracking-[-0.03em] leading-[0.9]"
            style={{ fontSize: "clamp(40px, 8vw, 120px)" }}
          >
            TMG <span className="italic text-white/55">/ Install</span>
          </div>
          <p className="text-stone-500 text-sm mt-6 max-w-sm">The Moving Guy Pte Ltd · Singapore · Island-wide</p>
        </div>
        <div className="col-span-12 md:col-span-6 md:text-right text-sm text-stone-400 space-y-2">
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="block hover:text-white transition" data-testid="footer-whatsapp">
            WhatsApp · +65 8088 0757
          </a>
          <Link href="/terms" className="block hover:text-white transition">Terms</Link>
          <Link href="/privacy" className="block hover:text-white transition">Privacy</Link>
        </div>
      </div>
      <div className="mx-auto max-w-[1600px] mt-12 pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-600">
        <span>© {new Date().getFullYear()} The Moving Guy Pte Ltd</span>
        <span>SG / Built properly</span>
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
      className="bg-white text-black text-center py-2 text-[10px] tracking-[0.35em] uppercase font-medium relative z-[70]"
      data-testid="promo-bar"
    >
      Use code <span className="font-bold">{promo.code}</span> · {promo.discount}% off your installation
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
