import { Link, useLocation } from "wouter";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { ArrowRight, ArrowUpRight, MessageCircle } from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { usePromoBar } from "@/hooks/use-promo-bar";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";

/* ──────────────────────────────────────────────────────────────────
   TMG INSTALL — EDITORIAL HOMEPAGE (Paradiso-style direction)
   Off-white default, structured grid, large typography, sticky 3D
   on the side (never dominates). Black sections used only for
   contrast moments (Process + Final CTA + Footer).
   Scope: redesign of "/" only. No backend, schema, portal changes.
   ────────────────────────────────────────────────────────────────── */

const WHATSAPP =
  "https://wa.me/6580880757?text=Hi%20TMG%20Install%2C%20I%20would%20like%20to%20get%20a%20quote%20for%20furniture%20installation%20or%20relocation.";

const PAPER = "#f4f3ef";
const INK = "#0a0a0a";
const LINE = "rgba(10,10,10,0.12)";
const LINE_LIGHT = "rgba(10,10,10,0.06)";
const EASE = [0.16, 1, 0.3, 1] as const;

const ThreeFurnitureScene = lazy(() => import("@/components/home/ThreeFurnitureScene"));

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

/* ─────────────────────── Reveal helpers ─────────────────────── */

function Label({
  children,
  className = "",
  tone = "ink",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "ink" | "paper";
}) {
  const c = tone === "ink" ? "text-black/55" : "text-white/55";
  return (
    <span className={`text-[10px] md:text-[11px] tracking-[0.4em] uppercase ${c} ${className}`}>
      {children}
    </span>
  );
}

function Reveal({
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
        viewport={{ once: true, margin: "-12%" }}
        transition={{ duration: 1.0, delay, ease: EASE }}
      >
        {children}
      </motion.div>
    </As>
  );
}

/* ─────────────────────── Buttons ─────────────────────── */

function PrimaryButton({
  href,
  children,
  testid,
  external = false,
  onClick,
  variant = "ink",
}: {
  href: string;
  children: React.ReactNode;
  testid?: string;
  external?: boolean;
  onClick?: () => void;
  variant?: "ink" | "paper" | "outline-ink" | "outline-paper";
}) {
  const [, setLocation] = useLocation();
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.();
    if (!external) {
      e.preventDefault();
      setLocation(href);
    }
  }
  const cls =
    variant === "ink"
      ? "bg-black text-white hover:bg-stone-800"
      : variant === "paper"
      ? "bg-white text-black hover:bg-stone-100"
      : variant === "outline-ink"
      ? "border border-black/40 text-black hover:bg-black hover:text-white"
      : "border border-white/40 text-white hover:bg-white hover:text-black";
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={handleClick}
      data-testid={testid}
      className={`group inline-flex items-center justify-center gap-3 px-8 py-[16px] text-[11px] font-medium tracking-[0.22em] uppercase rounded-full transition-colors duration-300 ${cls}`}
    >
      {children}
    </a>
  );
}

/* ─────────────────────── Top nav ─────────────────────── */

function TopNav({ tone = "ink" }: { tone?: "ink" | "paper" }) {
  const text = tone === "ink" ? "text-black" : "text-white";
  const muted = tone === "ink" ? "text-black/60 hover:text-black" : "text-white/60 hover:text-white";
  const border = tone === "ink" ? "border-black/40 hover:border-black" : "border-white/40 hover:border-white";
  return (
    <nav
      className={`absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 md:px-10 lg:px-14 py-5 md:py-6 ${text}`}
      data-testid="nav-top"
    >
      <Link href="/" className="text-[11px] tracking-[0.4em] uppercase" data-testid="link-home">
        TMG / INSTALL
      </Link>
      <div className={`hidden md:flex items-center gap-10 text-[10px] tracking-[0.35em] uppercase`}>
        <a href="#services" className={`transition ${muted}`} data-testid="nav-services">Services</a>
        <a href="#assembly-scroll" className={`transition ${muted}`} data-testid="nav-process">Process</a>
        <a href="#business" className={`transition ${muted}`} data-testid="nav-business">Business</a>
        <Link href="/estimate" className={`transition ${muted}`} data-testid="nav-quote">Quote</Link>
      </div>
      <a
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent("cta_whatsapp_nav", "/")}
        className={`text-[10px] tracking-[0.35em] uppercase border-b pb-1 transition ${border}`}
        data-testid="nav-whatsapp"
      >
        WhatsApp
      </a>
    </nav>
  );
}

/* ─────────────────────── Subtle grid overlay (paper) ─────────────────────── */

function PaperGrid({ opacity = 0.06 }: { opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity,
        backgroundImage:
          "linear-gradient(rgba(10,10,10,1) 1px, transparent 1px), linear-gradient(90deg, rgba(10,10,10,1) 1px, transparent 1px)",
        backgroundSize: "120px 120px",
      }}
    />
  );
}

/* ─────────────────────── HERO (paper, huge type, side 3D) ─────────────────────── */

function Hero() {
  const heroProgress = useRef(0);
  const isMobile = useIsMobile();
  const [showCanvas, setShowCanvas] = useState(false);

  useEffect(() => {
    if (!hasWebGL()) return;
    const ric: any = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 600));
    const id = ric(() => setShowCanvas(true));
    return () => {
      const cic: any = (window as any).cancelIdleCallback;
      if (cic && id) cic(id);
    };
  }, []);

  // Slow gentle progress drift so the parts have a tiny life in the hero
  useEffect(() => {
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 0.002;
      heroProgress.current = 0.55 + Math.sin(t) * 0.18;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      className="relative min-h-screen w-full overflow-hidden"
      style={{ background: PAPER, color: INK }}
      data-testid="section-hero"
    >
      <TopNav tone="ink" />
      <PaperGrid opacity={0.08} />

      {/* Inset frame */}
      <div className="absolute inset-x-6 md:inset-x-10 lg:inset-x-14 top-20 md:top-24 bottom-10 md:bottom-14 border" style={{ borderColor: LINE }} />

      {/* Side 3D — desktop right column at low presence, mobile faint backdrop */}
      <div className={`absolute z-[1] pointer-events-none ${isMobile ? "inset-0 opacity-25" : "right-0 top-0 bottom-0 w-[48%] opacity-90"}`}>
        {showCanvas && hasWebGL() ? (
          <Suspense fallback={null}>
            <ThreeFurnitureScene progressRef={heroProgress} isMobile={isMobile} />
          </Suspense>
        ) : (
          <img src="/images/hero/exploded-wardrobe-1600.webp" alt="" aria-hidden="true" className="w-full h-full object-cover opacity-40" />
        )}
      </div>

      {/* Soft fade from paper into 3D area to prevent harsh edge */}
      {!isMobile && (
        <div
          aria-hidden="true"
          className="absolute z-[2] pointer-events-none top-0 bottom-0 right-[40%] w-[20%]"
          style={{ background: `linear-gradient(90deg, ${PAPER} 0%, ${PAPER}00 100%)` }}
        />
      )}

      {/* Content grid */}
      <div className="relative z-[3] min-h-screen flex flex-col">
        <div className="flex-1 grid grid-cols-12 gap-4 md:gap-8 px-6 md:px-10 lg:px-14 pt-32 md:pt-40 pb-12">
          {/* Left rail label */}
          <div className="col-span-12 md:col-span-2 flex md:flex-col gap-3 md:gap-4 mb-6 md:mb-0">
            <Label>§ 00 / Index</Label>
            <Label className="hidden md:inline-block">SG / Island-wide</Label>
          </div>

          {/* Headline column */}
          <div className="col-span-12 md:col-span-10">
            <Reveal delay={0.05} className="mb-8 md:mb-10">
              <Label>Singapore / Furniture Installation Studio</Label>
            </Reveal>

            <h1
              className="font-serif tracking-[-0.035em] leading-[0.9]"
              style={{ fontSize: "clamp(56px, 12vw, 200px)" }}
              data-testid="hero-headline"
            >
              <Reveal delay={0.1}>Furniture work,</Reveal>
              <Reveal delay={0.22}>
                <span className="italic text-black/70">built properly.</span>
              </Reveal>
            </h1>

            <div className="grid grid-cols-12 gap-4 md:gap-8 mt-10 md:mt-16">
              <div className="col-span-12 md:col-span-6 lg:col-span-5">
                <Reveal delay={0.4}>
                  <p className="text-base md:text-lg text-black/70 leading-relaxed">
                    Installation, dismantling, relocation support and office setup for homes,
                    offices, landlords and businesses across Singapore.
                  </p>
                </Reveal>
              </div>
              <div className="col-span-12 md:col-span-6 lg:col-span-5 lg:col-start-8 flex md:justify-end items-end">
                <Reveal delay={0.55}>
                  <div className="flex flex-wrap gap-3">
                    <PrimaryButton
                      href="/estimate"
                      testid="hero-cta-quote"
                      onClick={() => trackEvent("cta_estimate_hero", "/")}
                    >
                      Get Instant Quote <ArrowRight size={16} />
                    </PrimaryButton>
                    <PrimaryButton
                      href={WHATSAPP}
                      external
                      variant="outline-ink"
                      testid="hero-cta-whatsapp"
                      onClick={() => trackEvent("cta_whatsapp_hero", "/")}
                    >
                      <MessageCircle size={16} /> WhatsApp Us
                    </PrimaryButton>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom meta strip */}
        <div className="px-6 md:px-10 lg:px-14 pb-10 md:pb-14">
          <div className="flex items-center justify-between border-t pt-5" style={{ borderColor: LINE }}>
            <Label>Est. 2019</Label>
            <Label className="hidden md:inline-block">Scroll for the process</Label>
            <Label>The Moving Guy Pte Ltd</Label>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── SCROLL STORY (sticky 3D right, chapters left) ─────────────────────── */

const STORY = [
  {
    no: "01",
    code: "DESCRIBE",
    title: "Send the details.",
    body: "Photos, item list, pickup or install address. Send it via WhatsApp or our web form — whichever is faster for you.",
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
    body: "A trained crew arrives on schedule, completes the work properly, and clears the packaging on the way out.",
  },
];

function AssemblyScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const [showCanvas, setShowCanvas] = useState(false);

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
      // Stretch the assembly across the whole pinned segment
      const mapped = Math.max(0, Math.min(1, (v - 0.05) / (0.95 - 0.05)));
      progressRef.current = mapped;
    });
  }, [scrollYProgress, reduce]);

  useEffect(() => {
    if (!hasWebGL()) return;
    const ric: any = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 600));
    const id = ric(() => setShowCanvas(true));
    return () => {
      const cic: any = (window as any).cancelIdleCallback;
      if (cic && id) cic(id);
    };
  }, []);

  const showStaticFallback = !showCanvas || !hasWebGL();

  return (
    <section
      ref={sectionRef}
      id="assembly-scroll"
      className="relative"
      style={{ height: "420vh", background: PAPER, color: INK }}
      data-testid="section-assembly"
    >
      {/* Section opener */}
      <div className="absolute top-0 inset-x-0 z-[2] px-6 md:px-10 lg:px-14 pt-20 md:pt-28 pb-8 md:pb-12 border-b" style={{ borderColor: LINE }}>
        <div className="grid grid-cols-12 gap-4 md:gap-8">
          <div className="col-span-12 md:col-span-2 flex md:flex-col gap-3 md:gap-4">
            <Label>§ 01</Label>
            <Label>The Process</Label>
          </div>
          <div className="col-span-12 md:col-span-10">
            <Reveal>
              <h2
                className="font-serif tracking-[-0.03em] leading-[0.95]"
                style={{ fontSize: "clamp(36px, 7vw, 120px)" }}
              >
                From parts to <span className="italic text-black/55">finished setup.</span>
              </h2>
            </Reveal>
          </div>
        </div>
      </div>

      {/* Sticky stage */}
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <PaperGrid opacity={0.05} />

        <div className="grid grid-cols-12 h-full">
          {/* Left: chapter texts that crossfade based on scroll */}
          <div className="col-span-12 md:col-span-6 relative flex items-center px-6 md:px-10 lg:px-14 pt-16 md:pt-0">
            {STORY.map((s, i) => {
              const startV = 0.08 + i * 0.28;
              const fadeIn = startV;
              const peak = startV + 0.08;
              const fadeOut = startV + 0.22;
              const end = startV + 0.3;
              const opacity = useTransform(
                scrollYProgress,
                [fadeIn, peak, fadeOut, end],
                [0, 1, 1, 0],
              );
              const y = useTransform(scrollYProgress, [fadeIn, peak, fadeOut, end], [40, 0, 0, -40]);
              return (
                <motion.div
                  key={s.no}
                  style={{ opacity, y }}
                  className="absolute inset-x-6 md:inset-x-10 lg:inset-x-14 max-w-[640px]"
                  data-testid={`chapter-${i}`}
                >
                  <div className="flex items-baseline gap-4 mb-6 md:mb-10">
                    <span className="font-serif text-black/85" style={{ fontSize: "clamp(64px, 9vw, 160px)", lineHeight: 0.85 }}>
                      {s.no}
                    </span>
                    <Label>/ {s.code}</Label>
                  </div>
                  <h3
                    className="font-serif tracking-[-0.025em] leading-[0.98] mb-6 md:mb-8"
                    style={{ fontSize: "clamp(32px, 4.4vw, 72px)" }}
                  >
                    {s.title}
                  </h3>
                  <p className="text-black/65 text-base md:text-lg leading-relaxed max-w-md">
                    {s.body}
                  </p>
                  {/* progress dots */}
                  <div className="mt-10 flex gap-2">
                    {STORY.map((_, j) => (
                      <div
                        key={j}
                        className="h-[2px] w-12"
                        style={{ background: j === i ? INK : "rgba(10,10,10,0.18)" }}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Right: sticky 3D */}
          <div className="hidden md:block md:col-span-6 relative border-l" style={{ borderColor: LINE }}>
            <div className="absolute inset-0">
              {showStaticFallback ? (
                <img src="/images/hero/exploded-wardrobe-1600.webp" alt="" className="w-full h-full object-cover opacity-90" />
              ) : (
                <Suspense fallback={null}>
                  <ThreeFurnitureScene progressRef={progressRef} isMobile={false} />
                </Suspense>
              )}
            </div>
            {/* corner labels */}
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between pointer-events-none">
              <Label>Fig. 01 / Workstation</Label>
              <Label>Exploded → Assembled</Label>
            </div>
            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-4 pointer-events-none">
              <Label>Assembly</Label>
              <div className="flex-1 h-px bg-black/15 origin-left">
                <motion.div
                  style={{ scaleX: useTransform(scrollYProgress, [0.05, 0.95], [0, 1]) }}
                  className="h-px bg-black origin-left"
                />
              </div>
              <Label>Complete</Label>
            </div>
          </div>

          {/* Mobile: 3D as faint backdrop */}
          <div className="md:hidden absolute inset-0 z-0 opacity-15 pointer-events-none">
            {showStaticFallback ? (
              <img src="/images/hero/exploded-wardrobe-800.webp" alt="" className="w-full h-full object-cover" />
            ) : (
              <Suspense fallback={null}>
                <ThreeFurnitureScene progressRef={progressRef} isMobile={true} />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Section header (editorial, ink) ─────────────────────── */

function SectionHeader({
  no,
  eyebrow,
  title,
  tone = "ink",
}: {
  no: string;
  eyebrow: string;
  title: React.ReactNode;
  tone?: "ink" | "paper";
}) {
  return (
    <div className="grid grid-cols-12 gap-4 md:gap-8 mb-16 md:mb-24">
      <div className="col-span-12 md:col-span-2 flex md:flex-col gap-3 md:gap-4 mb-4 md:mb-0">
        <Label tone={tone}>§ {no}</Label>
        <Label tone={tone}>{eyebrow}</Label>
      </div>
      <div className="col-span-12 md:col-span-10">
        <Reveal>
          <h2
            className="font-serif tracking-[-0.03em] leading-[0.95]"
            style={{ fontSize: "clamp(36px, 7vw, 120px)" }}
          >
            {title}
          </h2>
        </Reveal>
      </div>
    </div>
  );
}

/* ─────────────────────── SERVICES (paper, numbered editorial rows) ─────────────────────── */

const SERVICES = [
  { n: "01", title: "Furniture Installation", body: "Beds, wardrobes, tables, cabinets and home furniture assembled with proper coordination." },
  { n: "02", title: "Furniture Dismantling", body: "Careful dismantling for moving, replacement or storage." },
  { n: "03", title: "Office Furniture Setup", body: "Workstations, office chairs, desks, pedestals and meeting room furniture." },
  { n: "04", title: "Relocation Support", body: "Move-related dismantling, assembly and furniture handling support." },
  { n: "05", title: "Wardrobe / Bed / Table Assembly", body: "Common home furniture installed clearly and professionally." },
  { n: "06", title: "Repair & Adjustment", body: "Basic adjustment, tightening and minor repair support." },
];

function Services() {
  return (
    <section
      id="services"
      className="relative py-28 md:py-44 px-6 md:px-10 lg:px-14"
      style={{ background: PAPER, color: INK, borderTop: `1px solid ${LINE}` }}
      data-testid="section-services"
    >
      <div className="mx-auto max-w-[1600px]">
        <SectionHeader
          no="02"
          eyebrow="Services / Index"
          title={
            <>
              Furniture work,<br />
              <span className="italic text-black/55">handled properly.</span>
            </>
          }
        />

        <ol className="border-t" style={{ borderColor: LINE }}>
          {SERVICES.map((s, i) => (
            <motion.li
              key={s.n}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8%" }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: EASE }}
              className="border-b group"
              style={{ borderColor: LINE }}
              data-testid={`service-${i}`}
            >
              <Link
                href="/estimate"
                className="grid grid-cols-12 gap-4 md:gap-8 py-9 md:py-14 hover:bg-black/[0.03] transition-colors duration-500"
                onClick={() => trackEvent("cta_estimate_service", "/", s.title)}
                data-testid={`service-cta-${i}`}
              >
                <div className="col-span-2 md:col-span-1 pt-2">
                  <span className="font-serif text-black/40 text-xl md:text-2xl">{s.n}</span>
                </div>
                <div className="col-span-10 md:col-span-7">
                  <h3
                    className="font-serif tracking-[-0.02em] leading-[1.0] group-hover:translate-x-2 transition-transform duration-500"
                    style={{ fontSize: "clamp(26px, 4.2vw, 64px)" }}
                  >
                    {s.title}
                  </h3>
                </div>
                <div className="hidden md:flex md:col-span-3 items-start pt-3">
                  <p className="text-black/60 text-sm md:text-base leading-relaxed">{s.body}</p>
                </div>
                <div className="hidden md:flex md:col-span-1 items-start justify-end pt-3 gap-2">
                  <span className="text-[10px] tracking-[0.3em] uppercase text-black/55 group-hover:text-black transition">Get Quote</span>
                  <ArrowUpRight size={20} strokeWidth={1.4} className="text-black/45 group-hover:text-black group-hover:rotate-45 transition-all duration-500 mt-[2px]" />
                </div>
                <div className="md:hidden col-span-12 mt-3 flex items-end justify-between gap-4">
                  <p className="text-black/60 text-sm leading-relaxed flex-1">{s.body}</p>
                  <span className="text-[10px] tracking-[0.3em] uppercase text-black/70 whitespace-nowrap inline-flex items-center gap-1">
                    Get Quote <ArrowUpRight size={14} />
                  </span>
                </div>
              </Link>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────── WHY TMG (paper, split editorial) ─────────────────────── */

const PROOF = [
  "Clear quote before work",
  "Photo-based assessment",
  "Suitable for homes and offices",
  "Professional job coordination",
  "WhatsApp support",
  "Deposit-secured booking flow",
  "Completion photos where applicable",
];

function WhyTMG() {
  return (
    <section
      id="why"
      className="relative py-28 md:py-44 px-6 md:px-10 lg:px-14"
      style={{ background: PAPER, color: INK, borderTop: `1px solid ${LINE}` }}
      data-testid="section-why"
    >
      <div className="mx-auto max-w-[1600px]">
        <div className="grid grid-cols-12 gap-4 md:gap-8 mb-12 md:mb-20">
          <div className="col-span-12 md:col-span-2 flex md:flex-col gap-3 md:gap-4 mb-4 md:mb-0">
            <Label>§ 03</Label>
            <Label>Why TMG</Label>
          </div>
          <div className="col-span-12 md:col-span-10">
            <Reveal>
              <h2
                className="font-serif tracking-[-0.03em] leading-[0.95]"
                style={{ fontSize: "clamp(36px, 7vw, 120px)" }}
              >
                Built for clear<br />
                <span className="italic text-black/55">coordination.</span>
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-8 border-t pt-12 md:pt-16" style={{ borderColor: LINE }}>
          <div className="col-span-12 md:col-span-2 hidden md:block" />
          <div className="col-span-12 md:col-span-6">
            <Reveal>
              <p
                className="font-serif tracking-[-0.02em] leading-[1.05] text-black"
                style={{ fontSize: "clamp(24px, 3.4vw, 52px)" }}
              >
                We coordinate furniture work the way it should be done — clear estimates,
                trained crews, and the right tools on site. <span className="italic text-black/55">No surprises on the day.</span>
              </p>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-4">
            <ol className="space-y-0">
              {PROOF.map((p, i) => (
                <motion.li
                  key={p}
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-10%" }}
                  transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
                  className="flex items-baseline gap-4 py-4 border-b"
                  style={{ borderColor: LINE_LIGHT }}
                  data-testid={`why-${i}`}
                >
                  <span className="text-[10px] tracking-[0.3em] uppercase text-black/45 w-8">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-base md:text-lg text-black/85">{p}</span>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── PROCESS (DARK contrast, editorial timeline) ─────────────────────── */

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
      className="relative py-28 md:py-44 px-6 md:px-10 lg:px-14"
      style={{ background: INK, color: PAPER }}
      data-testid="section-process"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(244,243,239,1) 1px, transparent 1px), linear-gradient(90deg, rgba(244,243,239,1) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
        }}
      />
      <div className="relative mx-auto max-w-[1600px]">
        <div className="grid grid-cols-12 gap-4 md:gap-8 mb-16 md:mb-24">
          <div className="col-span-12 md:col-span-2 flex md:flex-col gap-3 md:gap-4 mb-4 md:mb-0">
            <Label tone="paper">§ 04</Label>
            <Label tone="paper">Method</Label>
          </div>
          <div className="col-span-12 md:col-span-10">
            <Reveal>
              <h2
                className="font-serif tracking-[-0.03em] leading-[0.95] text-white"
                style={{ fontSize: "clamp(36px, 7vw, 120px)" }}
              >
                A cleaner way to book<br />
                <span className="italic text-white/55">furniture work.</span>
              </h2>
            </Reveal>
          </div>
        </div>

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
                <div className="w-[14px] h-[14px] rounded-full bg-white border-4" style={{ borderColor: INK }} />
                <div className="mt-8 text-[10px] tracking-[0.35em] uppercase text-white/45 mb-3">{p.step}</div>
                <h3 className="font-serif text-white text-2xl lg:text-[34px] leading-[1.05] tracking-[-0.015em] mb-4">{p.title}</h3>
                <p className="text-stone-400 text-sm leading-relaxed">{p.body}</p>
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
              <div className="absolute -left-8 top-2 w-[14px] h-[14px] rounded-full bg-white border-4" style={{ borderColor: INK }} />
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

/* ─────────────────────── BUSINESS (paper) ─────────────────────── */

function BusinessSection() {
  return (
    <section
      id="business"
      className="relative py-28 md:py-44 px-6 md:px-10 lg:px-14 overflow-hidden"
      style={{ background: PAPER, color: INK }}
      data-testid="section-business"
    >
      <div className="mx-auto max-w-[1600px] grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-7">
          <div className="flex md:flex-col gap-3 md:gap-4 mb-8">
            <Label>§ 05</Label>
            <Label>For Business</Label>
          </div>
          <Reveal>
            <h2
              className="font-serif tracking-[-0.03em] leading-[0.95] mb-10 md:mb-14"
              style={{ fontSize: "clamp(36px, 7vw, 110px)" }}
            >
              For offices, landlords<br />
              <span className="italic text-black/55">and operators.</span>
            </h2>
          </Reveal>
          <p className="text-black/65 text-base md:text-lg leading-relaxed max-w-xl mb-10">
            Need repeated installations, office desk setup, room turnover, bed frames,
            wardrobes or workstation assembly? TMG Install supports recurring furniture
            work with structured coordination.
          </p>
          <PrimaryButton
            href={WHATSAPP}
            external
            testid="business-cta"
            onClick={() => trackEvent("cta_business_quote", "/")}
          >
            Request Business Quote <ArrowRight size={16} />
          </PrimaryButton>
        </div>
        <div className="md:col-span-5">
          <div className="aspect-[4/5] relative bg-stone-300 overflow-hidden border" style={{ borderColor: LINE }}>
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

/* ─────────────────────── FINAL CTA (DARK contrast) ─────────────────────── */

function FinalCTA() {
  return (
    <section
      className="relative py-28 md:py-44 px-6 md:px-10 lg:px-14 overflow-hidden"
      style={{ background: INK, color: PAPER }}
      data-testid="section-closing"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(244,243,239,1) 1px, transparent 1px), linear-gradient(90deg, rgba(244,243,239,1) 1px, transparent 1px)",
          backgroundSize: "120px 120px",
        }}
      />
      <div className="relative z-10 mx-auto max-w-[1600px]">
        <div className="grid grid-cols-12 gap-4 md:gap-8 mb-12 md:mb-16">
          <div className="col-span-12 md:col-span-2 flex md:flex-col gap-3 md:gap-4 mb-4 md:mb-0">
            <Label tone="paper">§ 06</Label>
            <Label tone="paper">Closing</Label>
          </div>
          <div className="col-span-12 md:col-span-10">
            <Reveal>
              <h2
                className="font-serif text-white tracking-[-0.035em] leading-[0.9]"
                style={{ fontSize: "clamp(44px, 9vw, 180px)" }}
              >
                Need furniture<br />
                installed,<br />
                <span className="italic text-white/55">moved or removed?</span>
              </h2>
            </Reveal>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 md:gap-8 mt-16 border-t border-white/15 pt-10">
          <div className="col-span-12 md:col-span-7 lg:col-span-6 md:col-start-3">
            <p className="text-white/75 text-base md:text-lg max-w-xl leading-relaxed mb-10">
              Send us photos, item list and location. We will help estimate the work clearly
              before confirmation.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <PrimaryButton
                href="/estimate"
                variant="paper"
                testid="closing-cta-quote"
                onClick={() => trackEvent("cta_estimate_closing", "/")}
              >
                Get Instant Quote <ArrowRight size={16} />
              </PrimaryButton>
              <PrimaryButton
                href={WHATSAPP}
                external
                variant="outline-paper"
                testid="closing-cta-whatsapp"
                onClick={() => trackEvent("cta_whatsapp_closing", "/")}
              >
                <MessageCircle size={16} /> WhatsApp Us
              </PrimaryButton>
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
      className="border-t border-white/10 py-14 md:py-20 px-6 md:px-10 lg:px-14"
      style={{ background: INK, color: PAPER }}
      data-testid="section-footer"
    >
      <div className="mx-auto max-w-[1600px] grid grid-cols-12 gap-4 md:gap-8 items-end">
        <div className="col-span-12 md:col-span-6">
          <div
            className="font-serif text-white tracking-[-0.03em] leading-[0.9]"
            style={{ fontSize: "clamp(36px, 7vw, 100px)" }}
          >
            TMG <span className="italic text-white/55">/ Install</span>
          </div>
          <p className="text-stone-500 text-sm mt-6 max-w-sm">The Moving Guy Pte Ltd · Singapore · Island-wide</p>
        </div>
        <div className="col-span-12 md:col-span-6 md:text-right text-sm text-stone-300 space-y-2">
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="block hover:text-white transition" data-testid="footer-whatsapp">
            WhatsApp · +65 8088 0757
          </a>
          <Link href="/terms" className="block hover:text-white transition">Terms</Link>
          <Link href="/privacy" className="block hover:text-white transition">Privacy</Link>
        </div>
      </div>
      <div className="mx-auto max-w-[1600px] mt-12 pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs text-stone-500">
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
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.5);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className={`md:hidden fixed bottom-0 inset-x-0 z-50 p-3 transition-transform duration-500 ${show ? "translate-y-0" : "translate-y-full"}`}
      style={{ background: `linear-gradient(to top, ${INK} 0%, ${INK}f0 60%, transparent 100%)` }}
    >
      <div className="flex gap-3">
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
          className="flex-1 bg-black text-white border border-white/30 text-center py-4 rounded-full text-[12px] tracking-[0.2em] uppercase font-medium inline-flex items-center justify-center gap-2"
          data-testid="mobile-sticky-whatsapp"
          onClick={() => trackEvent("cta_whatsapp_sticky", "/")}
        >
          <MessageCircle size={16} /> WhatsApp
        </a>
      </div>
    </div>
  );
}

/* ─────────────────────── Top scroll progress ─────────────────────── */

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { damping: 30, stiffness: 200 });
  return (
    <motion.div
      style={{ scaleX, background: INK }}
      className="fixed top-0 inset-x-0 h-[2px] origin-left z-[60]"
      data-testid="scroll-progress"
    />
  );
}

/* ─────────────────────── Promo bar (slim, hidden on mobile) ─────────────────────── */

function PromoBar() {
  const { promo, visible } = usePromoBar();
  if (!visible || !promo) return null;
  return (
    <div
      className="hidden md:block bg-black text-white text-center py-[6px] text-[10px] tracking-[0.35em] uppercase font-medium relative z-[70]"
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
      className="antialiased selection:bg-black selection:text-white font-sans"
      style={{ background: PAPER, color: INK }}
    >
      <PromoBar />
      <ScrollProgress />
      <Hero />
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
