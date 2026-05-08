import { Link, useLocation } from "wouter";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { ArrowRight, ArrowUpRight, MessageCircle } from "lucide-react";
import { useSEO } from "@/hooks/use-seo";
import { usePromoBar } from "@/hooks/use-promo-bar";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";

/* ──────────────────────────────────────────────────────────────────
   TMG INSTALL — EDITORIAL HOMEPAGE
   Visual language: rigid grid, dot pattern, scattered black tags with
   white text, single bright accent, dominating central wordmark, faint
   outlined ghost text. Inspired by editorial/institute layouts.
   Scope: redesign of "/" only. No backend, schema, portal changes.
   Existing CTAs preserved: /estimate (quote) + WhatsApp link.
   ────────────────────────────────────────────────────────────────── */

const WHATSAPP =
  "https://wa.me/6580880757?text=Hi%20TMG%20Install%2C%20I%20would%20like%20to%20get%20a%20quote%20for%20furniture%20installation%20or%20relocation.";

const PAPER = "#fafaf7";
const INK = "#0a0a0a";
const ACCENT = "#2af56a"; // signature install-green
const LINE = "rgba(10,10,10,0.10)";
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

/* ─────────────────────── Visual primitives ─────────────────────── */

function DotGrid({ opacity = 0.55, size = 32 }: { opacity?: number; size?: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity,
        backgroundImage: "radial-gradient(circle, rgba(10,10,10,0.22) 1px, transparent 1px)",
        backgroundSize: `${size}px ${size}px`,
      }}
    />
  );
}

function AccentSquare({ className = "" }: { className?: string }) {
  return <span className={`inline-block w-[10px] h-[10px] ${className}`} style={{ background: ACCENT }} />;
}

function Tag({
  children,
  accent = false,
  className = "",
}: {
  children: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-[4px] text-[10px] md:text-[11px] tracking-[0.2em] uppercase font-bold leading-none ${className}`}
      style={accent ? { background: ACCENT, color: INK } : { background: INK, color: PAPER }}
    >
      {children}
    </span>
  );
}

function LinkTag({
  href,
  children,
  accent = false,
  external = false,
  onClick,
  testid,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  accent?: boolean;
  external?: boolean;
  onClick?: () => void;
  testid?: string;
  className?: string;
}) {
  const [, setLocation] = useLocation();
  function handle(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.();
    if (!external) {
      e.preventDefault();
      setLocation(href);
    }
  }
  return (
    <a
      href={href}
      onClick={handle}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      data-testid={testid}
      className={`inline-flex items-center gap-2 px-2.5 py-[5px] text-[10px] md:text-[11px] tracking-[0.2em] uppercase font-bold leading-none transition-transform duration-200 hover:-translate-y-[1px] ${className}`}
      style={accent ? { background: ACCENT, color: INK } : { background: INK, color: PAPER }}
    >
      {children}
    </a>
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

/* ─────────────────────── Ghost outlined headline ─────────────────────── */

function GhostHeadline({
  children,
  size = "clamp(64px, 14vw, 240px)",
  className = "",
  stroke = "rgba(10,10,10,0.18)",
}: {
  children: React.ReactNode;
  size?: string;
  className?: string;
  stroke?: string;
}) {
  return (
    <div
      className={`font-serif italic font-black tracking-[-0.04em] leading-[0.85] whitespace-nowrap select-none pointer-events-none ${className}`}
      style={{
        fontSize: size,
        color: "transparent",
        WebkitTextStroke: `1px ${stroke}`,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────── Marquee ticker ─────────────────────── */

const TICKER_ITEMS = [
  "INSTALL",
  "DISMANTLE",
  "RELOCATE",
  "OFFICE FIT-OUT",
  "WARDROBES",
  "BEDS",
  "TABLES",
  "WORKSTATIONS",
  "REPAIR",
  "MOVE-IN READY",
];

function Marquee() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <section
      aria-label="What we install"
      className="relative overflow-hidden border-y"
      style={{ background: PAPER, borderColor: LINE }}
      data-testid="section-marquee"
    >
      <div className="flex gap-12 py-4 md:py-6 whitespace-nowrap animate-tmg-marquee">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-12 text-[11px] md:text-[14px] tracking-[0.3em] uppercase font-bold">
            <span className="flex items-center gap-3"><AccentSquare /> {it}</span>
            <span className="font-serif italic font-black text-[24px] md:text-[36px] leading-none -mt-[2px]">·</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────── HERO (cover-poster composition) ─────────────────────── */

function Counter() {
  const [n, setN] = useState(0);
  const target = 5642;
  useEffect(() => {
    let f = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1600);
      setN(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) f = requestAnimationFrame(tick);
    };
    f = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(f);
  }, []);
  return (
    <div className="flex gap-5 md:gap-6 text-[10px] md:text-[11px] tracking-[0.18em] uppercase font-bold leading-tight">
      <div className="flex items-center gap-1.5">
        <AccentSquare />
        <div>
          1 is<br />here
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <AccentSquare />
        <div>
          {n.toLocaleString()}<br />before
        </div>
      </div>
    </div>
  );
}

function HeroTile3D() {
  const isMobile = useIsMobile();
  const ref = useRef(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!hasWebGL()) return;
    const ric: any = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 600));
    const id = ric(() => setShow(true));
    return () => {
      const cic: any = (window as any).cancelIdleCallback;
      if (cic && id) cic(id);
    };
  }, []);

  // gentle drift
  useEffect(() => {
    let raf = 0;
    let t = 0;
    const loop = () => {
      t += 0.0025;
      ref.current = 0.55 + Math.sin(t) * 0.2;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative aspect-[4/3] w-full bg-white border" style={{ borderColor: "rgba(10,10,10,0.2)" }}>
      <div className="absolute inset-0">
        {show && hasWebGL() ? (
          <Suspense fallback={null}>
            <ThreeFurnitureScene progressRef={ref} isMobile={isMobile} />
          </Suspense>
        ) : (
          <img src="/images/hero/exploded-wardrobe-800.webp" alt="" className="w-full h-full object-cover" />
        )}
      </div>
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[10px] tracking-[0.18em] uppercase font-bold pointer-events-none">
        <div className="flex items-center gap-1.5">
          <AccentSquare /> Live
        </div>
        <span>Fig. 01</span>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      className="relative min-h-[100svh] w-full overflow-hidden"
      style={{ background: PAPER, color: INK }}
      data-testid="section-hero"
    >
      <DotGrid opacity={0.55} />

      {/* Top-left credit panel (black with white text — Paradiso-style) */}
      <div className="absolute top-3 left-3 md:top-5 md:left-6 z-30 max-w-[260px] md:max-w-[340px]">
        <div className="bg-black text-white text-[9px] md:text-[10px] tracking-[0.18em] leading-snug px-2.5 py-1.5">
          Coordinated by <span className="font-bold">The Moving Guy Pte Ltd.</span><br />
          Singapore — island-wide <span style={{ color: ACCENT }}>·</span> est. 2019.
        </div>
      </div>

      {/* Top-right counter */}
      <div className="absolute top-3 right-3 md:top-5 md:right-6 z-30">
        <Counter />
      </div>

      {/* INSTITUTE-style label (top-left below credit) */}
      <div className="absolute top-[12%] md:top-[18%] left-4 md:left-[10%] z-20">
        <Tag accent>STUDIO</Tag>
      </div>

      {/* Mid-left fragment "An ethos" */}
      <div className="hidden md:block absolute top-[34%] left-[8%] z-20 text-[10px] tracking-[0.18em] uppercase font-bold leading-tight">
        <div>An<br />ethos.</div>
      </div>

      {/* Mid-right fragment "A craft" */}
      <div className="hidden md:block absolute top-[34%] right-[8%] z-20 text-[10px] tracking-[0.18em] uppercase font-bold leading-tight text-right max-w-[110px]">
        <div>A craft<br />of careful<br />assembly.</div>
      </div>

      {/* CENTER WORDMARK */}
      <div className="absolute inset-0 flex items-center justify-center z-10 px-4 pointer-events-none">
        <div className="text-center">
          <Reveal delay={0.05}>
            <h1
              className="font-serif italic tracking-[-0.04em] leading-[0.85] text-black"
              style={{ fontSize: "clamp(96px, 22vw, 360px)", fontWeight: 900 }}
              data-testid="hero-headline"
            >
              TMG
            </h1>
          </Reveal>
          <Reveal delay={0.18} className="mt-3 md:mt-5">
            <div className="text-[12px] md:text-[18px] tracking-[0.55em] uppercase font-bold">
              Install <span style={{ color: ACCENT }}>·</span> Singapore
            </div>
          </Reveal>
        </div>
      </div>

      {/* Bottom outline ghost text */}
      <div className="absolute bottom-[34%] md:bottom-[28%] inset-x-0 z-[5] pointer-events-none flex justify-center px-2">
        <div
          className="font-serif italic tracking-[-0.04em] leading-[0.85] whitespace-nowrap"
          style={{
            fontSize: "clamp(48px, 12vw, 220px)",
            color: "transparent",
            WebkitTextStroke: "1px rgba(10,10,10,0.18)",
            fontWeight: 900,
          }}
        >
          built properly.
        </div>
      </div>

      {/* Mid-left mini nav tag */}
      <div className="absolute top-[55%] left-4 md:left-[8%] z-20 flex flex-col gap-1.5 items-start">
        <a href="#services">
          <Tag>SERVICES →</Tag>
        </a>
        <a href="#assembly-scroll">
          <Tag>PROCESS →</Tag>
        </a>
        <a href="#business">
          <Tag>BUSINESS →</Tag>
        </a>
      </div>

      {/* BOTTOM-LEFT live tile */}
      <div className="absolute bottom-4 left-3 md:bottom-8 md:left-6 z-20 w-[180px] md:w-[280px]">
        <HeroTile3D />
        <div className="mt-2 text-[10px] tracking-[0.18em] uppercase font-bold flex items-center justify-between">
          <span>Workstation Build</span>
          <span className="opacity-60">00:42</span>
        </div>
      </div>

      {/* BOTTOM-RIGHT CTA cluster */}
      <div className="absolute bottom-4 right-3 md:bottom-8 md:right-6 z-20 flex flex-col items-end gap-1.5">
        <div className="text-[10px] tracking-[0.18em] uppercase font-bold mb-1">An install.</div>
        <LinkTag
          href="/estimate"
          accent
          testid="hero-cta-quote"
          onClick={() => trackEvent("cta_estimate_hero", "/")}
        >
          Get Quote →
        </LinkTag>
        <LinkTag
          href={WHATSAPP}
          external
          testid="hero-cta-whatsapp"
          onClick={() => trackEvent("cta_whatsapp_hero", "/")}
        >
          WhatsApp →
        </LinkTag>
        <LinkTag href="#services" onClick={() => {}}>
          Index ↓
        </LinkTag>
      </div>

      {/* Bottom strip */}
      <div className="absolute bottom-0 inset-x-0 z-10 px-4 md:px-6 py-2 md:py-3 border-t flex items-center justify-between text-[10px] tracking-[0.18em] uppercase font-bold" style={{ borderColor: LINE, background: PAPER }}>
        <span className="flex items-center gap-1.5"><AccentSquare /> Open for jobs</span>
        <span className="hidden md:inline">Scroll for the process</span>
        <span>+65 8088 0757</span>
      </div>
    </section>
  );
}

/* ─────────────────────── Scroll story (sticky 3D + chapters) ─────────────────────── */

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

function ChapterCard({
  chapter,
  index,
  scrollYProgress,
}: {
  chapter: typeof STORY[number];
  index: number;
  scrollYProgress: MotionValue<number>;
}) {
  // Chapter 01 is visible immediately on entering the section so there is
  // no blank gap during the early scroll. Each chapter then occupies
  // roughly a third of the section's scroll length.
  const SEGMENTS = [
    { in: -0.05, peak: 0.0,  out: 0.30, end: 0.36 },
    { in: 0.34,  peak: 0.42, out: 0.62, end: 0.68 },
    { in: 0.66,  peak: 0.74, out: 1.0,  end: 1.06 },
  ];
  const seg = SEGMENTS[index];
  const opacity = useTransform(scrollYProgress, [seg.in, seg.peak, seg.out, seg.end], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [seg.in, seg.peak, seg.out, seg.end], [40, 0, 0, -40]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-x-6 md:inset-x-10 lg:inset-x-14 max-w-[640px]"
      data-testid={`chapter-${index}`}
    >
      <div className="flex items-baseline gap-4 mb-6 md:mb-10">
        <span className="font-serif italic font-black text-black/90" style={{ fontSize: "clamp(64px, 9vw, 160px)", lineHeight: 0.85 }}>
          {chapter.no}
        </span>
        <Tag accent>{chapter.code}</Tag>
      </div>
      <h3
        className="font-serif italic tracking-[-0.025em] leading-[0.98] mb-6 md:mb-8 font-black"
        style={{ fontSize: "clamp(32px, 4.4vw, 72px)" }}
      >
        {chapter.title}
      </h3>
      <p className="text-black/65 text-base md:text-lg leading-relaxed max-w-md">{chapter.body}</p>
      <div className="mt-10 flex gap-2">
        {STORY.map((_, j) => (
          <div key={j} className="h-[3px] w-12" style={{ background: j === index ? ACCENT : "rgba(10,10,10,0.18)" }} />
        ))}
      </div>
    </motion.div>
  );
}

function AssemblyScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const [showCanvas, setShowCanvas] = useState(false);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const completeBar = useTransform(scrollYProgress, [0.05, 0.95], [0, 1]);

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      if (reduce) {
        progressRef.current = 1;
        return;
      }
      progressRef.current = Math.max(0, Math.min(1, (v - 0.05) / 0.9));
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
      {/* Section opener strip */}
      <div className="absolute top-0 inset-x-0 z-[2] px-6 md:px-10 lg:px-14 pt-16 md:pt-24 pb-6 md:pb-10 border-b" style={{ borderColor: LINE }}>
        <div className="grid grid-cols-12 gap-4 md:gap-8 items-end">
          <div className="col-span-12 md:col-span-4 flex flex-wrap items-center gap-2">
            <Tag>§ 01</Tag>
            <Tag accent>The Process</Tag>
          </div>
          <div className="col-span-12 md:col-span-8">
            <Reveal>
              <h2
                className="font-serif italic tracking-[-0.03em] leading-[0.95] font-black"
                style={{ fontSize: "clamp(36px, 7vw, 120px)" }}
              >
                From parts<br />to finished setup.
              </h2>
            </Reveal>
          </div>
        </div>
      </div>

      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <DotGrid opacity={0.4} />

        {/* Backdrop ghost-text rotating with chapters */}
        <div className="absolute inset-0 z-[1] pointer-events-none flex items-end justify-center pb-10 md:pb-14 overflow-hidden">
          <GhostHeadline size="clamp(80px, 18vw, 320px)">From parts. Properly built.</GhostHeadline>
        </div>

        {/* Floating editorial fragments */}
        <div className="hidden md:block absolute top-[18%] left-[6%] z-[2] text-[10px] tracking-[0.2em] uppercase font-bold leading-tight max-w-[120px] pointer-events-none">
          <AccentSquare /> <span className="ml-1">A method.</span><br />
          <span className="opacity-60">Step by step.</span>
        </div>
        <div className="hidden md:block absolute top-[18%] right-[6%] z-[2] text-[10px] tracking-[0.2em] uppercase font-bold leading-tight text-right max-w-[140px] pointer-events-none">
          <span>Fig. 02 / Workstation</span><br />
          <span className="opacity-60">Drawing — exploded view</span>
        </div>

        <div className="grid grid-cols-12 h-full">
          <div className="col-span-12 md:col-span-6 relative flex items-center px-6 md:px-10 lg:px-14 pt-16 md:pt-0">
            {STORY.map((s, i) => (
              <ChapterCard key={s.no} chapter={s} index={i} scrollYProgress={scrollYProgress} />
            ))}
          </div>
          <div className="hidden md:block md:col-span-6 relative border-l" style={{ borderColor: LINE }}>
            <div className="absolute inset-0">
              {showStaticFallback ? (
                <img src="/images/hero/exploded-wardrobe-1600.webp" alt="" className="w-full h-full object-cover" />
              ) : (
                <Suspense fallback={null}>
                  <ThreeFurnitureScene progressRef={progressRef} isMobile={false} />
                </Suspense>
              )}
            </div>
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between pointer-events-none text-[10px] tracking-[0.18em] uppercase font-bold">
              <span className="flex items-center gap-1.5"><AccentSquare /> Fig. 02 — Workstation</span>
              <span>Exploded → Assembled</span>
            </div>
            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 pointer-events-none text-[10px] tracking-[0.18em] uppercase font-bold">
              <span>Assembly</span>
              <div className="flex-1 h-[3px] origin-left" style={{ background: "rgba(10,10,10,0.15)" }}>
                <motion.div style={{ scaleX: completeBar, background: ACCENT }} className="h-[3px] origin-left" />
              </div>
              <span>Complete</span>
            </div>
          </div>
          {/* Mobile faint backdrop */}
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

/* ─────────────────────── Section header ─────────────────────── */

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
    <div className="grid grid-cols-12 gap-4 md:gap-8 mb-16 md:mb-24 items-end">
      <div className="col-span-12 md:col-span-4 flex flex-wrap items-center gap-2 mb-4 md:mb-0">
        {tone === "ink" ? (
          <>
            <Tag>§ {no}</Tag>
            <Tag accent>{eyebrow}</Tag>
          </>
        ) : (
          <>
            <span className="inline-flex items-center px-2 py-[4px] text-[10px] tracking-[0.2em] uppercase font-bold leading-none bg-white text-black">§ {no}</span>
            <Tag accent>{eyebrow}</Tag>
          </>
        )}
      </div>
      <div className="col-span-12 md:col-span-8">
        <Reveal>
          <h2
            className={`font-serif italic tracking-[-0.03em] leading-[0.95] font-black ${tone === "paper" ? "text-white" : ""}`}
            style={{ fontSize: "clamp(36px, 7vw, 120px)" }}
          >
            {title}
          </h2>
        </Reveal>
      </div>
    </div>
  );
}

/* ─────────────────────── SERVICES ─────────────────────── */

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
      className="relative py-28 md:py-40 px-6 md:px-10 lg:px-14"
      style={{ background: PAPER, color: INK, borderTop: `1px solid ${LINE}` }}
      data-testid="section-services"
    >
      <DotGrid opacity={0.35} />
      <div className="relative mx-auto max-w-[1600px]">
        <SectionHeader
          no="02"
          eyebrow="Services"
          title={
            <>
              Furniture work,<br />handled properly.
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
                <div className="col-span-2 md:col-span-1 pt-2 flex items-start gap-2">
                  <span className="font-serif italic font-black text-black/45 text-xl md:text-2xl">{s.n}</span>
                </div>
                <div className="col-span-10 md:col-span-7">
                  <h3
                    className="font-serif italic font-black tracking-[-0.02em] leading-[1.0] group-hover:translate-x-2 transition-transform duration-500"
                    style={{ fontSize: "clamp(26px, 4.2vw, 64px)" }}
                  >
                    {s.title}
                  </h3>
                </div>
                <div className="hidden md:flex md:col-span-3 items-start pt-3">
                  <p className="text-black/60 text-sm md:text-base leading-relaxed">{s.body}</p>
                </div>
                <div className="hidden md:flex md:col-span-1 items-start justify-end pt-2 gap-2">
                  <Tag accent>QUOTE →</Tag>
                </div>
                <div className="md:hidden col-span-12 mt-3 flex items-end justify-between gap-4">
                  <p className="text-black/60 text-sm leading-relaxed flex-1">{s.body}</p>
                  <Tag accent>QUOTE →</Tag>
                </div>
              </Link>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────── WHY TMG ─────────────────────── */

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
      className="relative py-28 md:py-40 px-6 md:px-10 lg:px-14"
      style={{ background: PAPER, color: INK, borderTop: `1px solid ${LINE}` }}
      data-testid="section-why"
    >
      <DotGrid opacity={0.35} />
      <div className="relative mx-auto max-w-[1600px]">
        <SectionHeader
          no="03"
          eyebrow="Why TMG"
          title={
            <>
              Built for clear<br />coordination.
            </>
          }
        />
        <div className="grid grid-cols-12 gap-4 md:gap-8 border-t pt-12 md:pt-16" style={{ borderColor: LINE }}>
          <div className="col-span-12 md:col-span-2 hidden md:block" />
          <div className="col-span-12 md:col-span-6">
            <Reveal>
              <p
                className="font-serif italic tracking-[-0.02em] leading-[1.05] text-black font-black"
                style={{ fontSize: "clamp(24px, 3.4vw, 52px)" }}
              >
                We coordinate furniture work the way it should be done — clear estimates,
                trained crews, and the right tools on site. <span className="text-black/55">No surprises on the day.</span>
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
                  <AccentSquare />
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

/* ─────────────────────── INDEX STRIP (editorial filler) ─────────────────────── */

const INDEX_ROWS = [
  { no: "I", label: "Furniture Installation", meta: "Residential / Commercial" },
  { no: "II", label: "Furniture Dismantling", meta: "Disposal-ready" },
  { no: "III", label: "Office Fit-out & Workstations", meta: "Recurring projects" },
  { no: "IV", label: "Relocation Support", meta: "Island-wide" },
  { no: "V", label: "Repair & Adjustment", meta: "On-site" },
];

function IndexStrip() {
  return (
    <section
      className="relative py-20 md:py-32 px-6 md:px-10 lg:px-14 overflow-hidden"
      style={{ background: PAPER, color: INK, borderTop: `1px solid ${LINE}` }}
      data-testid="section-index"
    >
      <DotGrid opacity={0.32} />
      <div className="relative mx-auto max-w-[1600px]">
        <div className="grid grid-cols-12 gap-4 md:gap-8 mb-10 md:mb-16 items-end">
          <div className="col-span-12 md:col-span-4 flex flex-wrap items-center gap-2 mb-4 md:mb-0">
            <Tag>§ 03·5</Tag>
            <Tag accent>Index</Tag>
          </div>
          <div className="col-span-12 md:col-span-8 flex items-end justify-between gap-4">
            <Reveal>
              <h3
                className="font-serif italic font-black tracking-[-0.025em] leading-[0.95]"
                style={{ fontSize: "clamp(28px, 4.4vw, 64px)" }}
              >
                Contents.
              </h3>
            </Reveal>
            <div className="text-[10px] tracking-[0.2em] uppercase font-bold opacity-55 hidden md:block">
              06 ENTRIES
            </div>
          </div>
        </div>

        <ol className="border-t" style={{ borderColor: LINE }}>
          {INDEX_ROWS.map((r, i) => (
            <motion.li
              key={r.no}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: EASE }}
              className="grid grid-cols-12 gap-4 items-baseline border-b py-5 md:py-7 group"
              style={{ borderColor: LINE_LIGHT }}
              data-testid={`index-row-${i}`}
            >
              <div className="col-span-1 font-serif italic font-black text-black/45 text-base md:text-lg">{r.no}</div>
              <div className="col-span-7 md:col-span-6 font-serif italic font-black text-black tracking-[-0.015em]" style={{ fontSize: "clamp(20px, 2.4vw, 36px)" }}>
                {r.label}
              </div>
              <div className="hidden md:block md:col-span-4 text-[11px] tracking-[0.2em] uppercase font-bold opacity-55">
                {r.meta}
              </div>
              <div className="col-span-4 md:col-span-1 flex justify-end">
                <Link
                  href="/estimate"
                  data-testid={`index-cta-${i}`}
                  onClick={() => trackEvent("cta_estimate_index", "/", r.label)}
                >
                  <Tag accent>QUOTE →</Tag>
                </Link>
              </div>
            </motion.li>
          ))}
        </ol>

        {/* Bottom outline ghost text */}
        <div className="mt-12 md:mt-16 overflow-hidden">
          <GhostHeadline size="clamp(56px, 14vw, 220px)">Furniture, properly.</GhostHeadline>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── PROCESS (dark contrast) ─────────────────────── */

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
      className="relative py-28 md:py-40 px-6 md:px-10 lg:px-14"
      style={{ background: INK, color: PAPER }}
      data-testid="section-process"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.5] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(244,243,239,0.18) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative mx-auto max-w-[1600px]">
        <SectionHeader no="04" eyebrow="Method" tone="paper" title={<>A cleaner way to<br />book furniture work.</>} />

        {/* Desktop horizontal */}
        <div className="hidden md:block relative">
          <div className="absolute top-[10px] left-0 right-0 h-px bg-white/20" />
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
                <div className="w-[20px] h-[20px]" style={{ background: ACCENT }} />
                <div className="mt-8 text-[10px] tracking-[0.35em] uppercase text-white/55 mb-3">{p.step}</div>
                <h3 className="font-serif italic font-black text-white text-2xl lg:text-[34px] leading-[1.05] tracking-[-0.015em] mb-4">{p.title}</h3>
                <p className="text-stone-400 text-sm leading-relaxed">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Mobile vertical */}
        <div className="md:hidden relative pl-8">
          <div className="absolute top-2 bottom-2 left-[9px] w-px bg-white/20" />
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
              <div className="absolute -left-8 top-2 w-[20px] h-[20px]" style={{ background: ACCENT }} />
              <div className="text-[10px] tracking-[0.35em] uppercase text-white/55 mb-2">{p.step}</div>
              <h3 className="font-serif italic font-black text-white text-2xl leading-tight mb-3">{p.title}</h3>
              <p className="text-stone-400 text-sm leading-relaxed">{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── BUSINESS ─────────────────────── */

function BusinessSection() {
  return (
    <section
      id="business"
      className="relative py-28 md:py-40 px-6 md:px-10 lg:px-14 overflow-hidden"
      style={{ background: PAPER, color: INK }}
      data-testid="section-business"
    >
      <DotGrid opacity={0.35} />
      <div className="relative mx-auto max-w-[1600px] grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        <div className="md:col-span-7">
          <div className="flex flex-wrap items-center gap-2 mb-8">
            <Tag>§ 05</Tag>
            <Tag accent>For Business</Tag>
          </div>
          <Reveal>
            <h2
              className="font-serif italic font-black tracking-[-0.03em] leading-[0.95] mb-10 md:mb-14"
              style={{ fontSize: "clamp(36px, 7vw, 110px)" }}
            >
              For offices, landlords<br />and operators.
            </h2>
          </Reveal>
          <p className="text-black/65 text-base md:text-lg leading-relaxed max-w-xl mb-10">
            Need repeated installations, office desk setup, room turnover, bed frames,
            wardrobes or workstation assembly? TMG Install supports recurring furniture
            work with structured coordination.
          </p>
          <LinkTag
            href={WHATSAPP}
            external
            accent
            testid="business-cta"
            onClick={() => trackEvent("cta_business_quote", "/")}
            className="text-[12px] px-4 py-3"
          >
            Request Business Quote →
          </LinkTag>
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
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <Tag accent>RECENT</Tag>
            </div>
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <div className="text-[10px] tracking-[0.35em] uppercase text-white/85 mb-1">20-station office</div>
              <div className="font-serif italic text-2xl font-black">CBD fit-out</div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── FINAL CTA ─────────────────────── */

function FinalCTA() {
  return (
    <section
      className="relative py-28 md:py-40 px-6 md:px-10 lg:px-14 overflow-hidden"
      style={{ background: INK, color: PAPER }}
      data-testid="section-closing"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(244,243,239,0.15) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="relative z-10 mx-auto max-w-[1600px]">
        <SectionHeader no="06" eyebrow="Closing" tone="paper" title={<>Need furniture<br />installed, moved<br /><span className="text-white/55">or removed?</span></>} />
        <div className="grid grid-cols-12 gap-4 md:gap-8 mt-12 border-t border-white/15 pt-10">
          <div className="col-span-12 md:col-span-7 lg:col-span-6 md:col-start-3">
            <p className="text-white/75 text-base md:text-lg max-w-xl leading-relaxed mb-10">
              Send us photos, item list and location. We will help estimate the work clearly
              before confirmation.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <LinkTag
                href="/estimate"
                accent
                testid="closing-cta-quote"
                onClick={() => trackEvent("cta_estimate_closing", "/")}
                className="text-[12px] px-4 py-3"
              >
                Get Instant Quote →
              </LinkTag>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("cta_whatsapp_closing", "/")}
                data-testid="closing-cta-whatsapp"
                className="inline-flex items-center gap-2 text-[12px] tracking-[0.2em] uppercase font-bold leading-none px-4 py-3 border border-white/40 text-white hover:bg-white hover:text-black transition"
              >
                <MessageCircle size={14} /> WhatsApp Us
              </a>
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
      className="relative border-t border-white/10 py-14 md:py-20 px-6 md:px-10 lg:px-14"
      style={{ background: INK, color: PAPER }}
      data-testid="section-footer"
    >
      <div className="mx-auto max-w-[1600px] grid grid-cols-12 gap-4 md:gap-8 items-end">
        <div className="col-span-12 md:col-span-6">
          <div
            className="font-serif italic font-black text-white tracking-[-0.03em] leading-[0.9]"
            style={{ fontSize: "clamp(36px, 7vw, 100px)" }}
          >
            TMG <span className="text-white/55">/ Install</span>
          </div>
          <p className="text-stone-400 text-sm mt-6 max-w-sm">The Moving Guy Pte Ltd · Singapore · Island-wide</p>
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
        <span className="flex items-center gap-2"><AccentSquare /> Built properly</span>
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
          className="flex-1 text-center py-3 text-[11px] tracking-[0.22em] uppercase font-bold inline-flex items-center justify-center gap-2"
          style={{ background: ACCENT, color: INK }}
          data-testid="mobile-sticky-quote"
          onClick={() => trackEvent("cta_estimate_sticky", "/")}
        >
          Quote →
        </Link>
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 bg-black text-white border border-white/30 text-center py-3 text-[11px] tracking-[0.22em] uppercase font-bold inline-flex items-center justify-center gap-2"
          data-testid="mobile-sticky-whatsapp"
          onClick={() => trackEvent("cta_whatsapp_sticky", "/")}
        >
          <MessageCircle size={14} /> WhatsApp
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
      style={{ scaleX, background: ACCENT }}
      className="fixed top-0 inset-x-0 h-[3px] origin-left z-[60]"
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
      className="hidden md:flex items-center justify-center gap-3 bg-black text-white text-center py-[6px] text-[10px] tracking-[0.35em] uppercase font-bold relative z-[70]"
      data-testid="promo-bar"
    >
      <AccentSquare /> Use code <span className="font-black" style={{ color: ACCENT }}>{promo.code}</span> · {promo.discount}% off your installation
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
      <Marquee />
      <AssemblyScroll />
      <Services />
      <WhyTMG />
      <IndexStrip />
      <Process />
      <BusinessSection />
      <FinalCTA />
      <Footer />
      <StickyMobileCTA />
    </div>
  );
}
