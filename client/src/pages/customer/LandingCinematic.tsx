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
import { SiFacebook, SiInstagram } from "react-icons/si";
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
      style={{ background: "rgba(250,250,247,0.88)", borderColor: LINE }}
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
  // Rotates between three real TMG job photos every 4s
  const SHOTS = [
    { src: "/images/work/wardrobe-install-team-800.webp", label: "Wardrobe install · Tampines" },
    { src: "/images/work/office-fitout-800.webp", label: "Office fit-out · CBD" },
    { src: "/images/work/bed-completed-800.webp", label: "Bed assembly · HDB" },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % SHOTS.length), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden border"
      style={{ borderColor: "rgba(10,10,10,0.2)", background: "#111" }}
    >
      {SHOTS.map((s, idx) => (
        <img
          key={s.src}
          src={s.src}
          alt={s.label}
          loading="lazy" decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: idx === i ? 1 : 0 }}
        />
      ))}
      {/* dark gradient for label legibility */}
      <div className="absolute inset-x-0 bottom-0 h-[55%] pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }} />

      {/* Top-row meta */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between text-[10px] tracking-[0.18em] uppercase font-bold pointer-events-none">
        <span className="flex items-center gap-1.5 px-1.5 py-0.5" style={{ background: ACCENT, color: INK }}>
          <span className="inline-block w-[6px] h-[6px] rounded-full bg-black animate-pulse" /> Recent job
        </span>
        <span className="px-1.5 py-0.5 bg-black/65 text-white backdrop-blur-sm">
          {String(i + 1).padStart(2, "0")} / 0{SHOTS.length}
        </span>
      </div>

      {/* Bottom caption */}
      <div className="absolute left-2 right-2 bottom-2 text-[10px] tracking-[0.18em] uppercase font-bold text-white pointer-events-none">
        {SHOTS[i].label}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      className="relative min-h-[100svh] w-full overflow-hidden"
      style={{ background: "rgba(250,250,247,0.88)", color: INK }}
      data-testid="section-hero"
    >
      <DotGrid opacity={0.55} />

      {/* Top-left credit panel (black with white text — Paradiso-style) */}
      <div className="absolute top-3 left-3 md:top-5 md:left-6 z-30 max-w-[210px] md:max-w-[340px]">
        <div className="bg-black text-white text-[9px] md:text-[10px] tracking-[0.16em] leading-snug px-2.5 py-1.5">
          <span className="font-bold">The Moving Guy Pte Ltd.</span><br />
          Singapore <span style={{ color: ACCENT }}>·</span> est. 2019
        </div>
      </div>

      {/* Top-right counter */}
      <div className="absolute top-3 right-3 md:top-5 md:right-6 z-30">
        <Counter />
      </div>

      {/* Service label (top-left below credit) */}
      <div className="absolute top-[12%] md:top-[18%] left-4 md:left-[10%] z-20">
        <Tag accent>INSTALLATIONS</Tag>
      </div>

      {/* Mid-left fragment — TMG service line */}
      <div className="hidden md:block absolute top-[34%] left-[8%] z-20 text-[10px] tracking-[0.18em] uppercase font-bold leading-tight max-w-[140px]">
        <div>Furniture<br />installation<br />& dismantling.</div>
      </div>

      {/* Mid-right fragment — coverage */}
      <div className="hidden md:block absolute top-[34%] right-[8%] z-20 text-[10px] tracking-[0.18em] uppercase font-bold leading-tight text-right max-w-[140px]">
        <div>Homes. Offices.<br />Move-outs.<br />Island-wide.</div>
      </div>

      {/* CENTER WORDMARK — mobile pushed up so it doesn't fight the CTA */}
      <div className="absolute inset-x-0 top-[26%] md:top-auto md:inset-0 md:flex md:items-center md:justify-center z-10 px-4 pointer-events-none">
        <div className="text-center">
          <Reveal delay={0.05}>
            <h1
              className="font-serif italic tracking-[-0.04em] leading-[0.82] text-black"
              style={{ fontSize: "clamp(110px, 28vw, 360px)", fontWeight: 900 }}
              data-testid="hero-headline"
            >
              TMG
            </h1>
          </Reveal>
          <Reveal delay={0.18} className="mt-2 md:mt-5">
            <div className="text-[11px] md:text-[18px] tracking-[0.42em] md:tracking-[0.55em] uppercase font-bold">
              Install <span style={{ color: ACCENT }}>·</span> Dismantle <span style={{ color: ACCENT }}>·</span> Relocate
            </div>
            <div className="mt-1 text-[10px] md:text-[12px] tracking-[0.3em] uppercase font-bold opacity-60">
              Singapore — island-wide
            </div>
          </Reveal>
        </div>
      </div>

      {/* Ghost outline headline — sits between wordmark and CTA */}
      <div className="absolute top-[58%] md:top-auto md:bottom-[28%] inset-x-0 z-[5] pointer-events-none flex justify-center px-2">
        <div
          className="font-serif italic tracking-[-0.04em] leading-[0.85] whitespace-nowrap"
          style={{
            fontSize: "clamp(54px, 14vw, 220px)",
            color: "transparent",
            WebkitTextStroke: "1px rgba(10,10,10,0.22)",
            fontWeight: 900,
          }}
        >
          built properly.
        </div>
      </div>

      {/* Mid-left mini nav tag — DESKTOP ONLY (was overlapping ghost text on mobile) */}
      <div className="hidden md:flex absolute top-[55%] left-[8%] z-20 flex-col gap-1.5 items-start">
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

      {/* BOTTOM-LEFT live tile — desktop only (would crowd mobile CTAs) */}
      <div className="hidden md:block absolute bottom-8 left-6 z-20 w-[280px]">
        <HeroTile3D />
        <div className="mt-2 text-[10px] tracking-[0.18em] uppercase font-bold flex items-center justify-between">
          <span className="flex items-center gap-1.5"><AccentSquare /> Real TMG jobs · Singapore</span>
          <span className="opacity-60">2024 / 25</span>
        </div>
      </div>

      {/* BOTTOM-RIGHT CTA cluster — high-conversion stack */}
      <div className="absolute bottom-3 left-3 right-3 md:bottom-8 md:left-auto md:right-6 md:w-[340px] z-20">
        {/* Microcopy line — value + reassurance */}
        <div className="flex items-center justify-between mb-2 text-[10px] tracking-[0.2em] uppercase font-bold">
          <span className="flex items-center gap-1.5"><AccentSquare /> Free quote · 60-second form</span>
          <span className="opacity-60 hidden sm:inline">No payment up front</span>
        </div>

        {/* Primary CTA — big, bold, full-width green block */}
        <a
          href="/estimate"
          onClick={(e) => {
            e.preventDefault();
            trackEvent("cta_estimate_hero", "/");
            window.location.assign("/estimate");
          }}
          data-testid="hero-cta-quote"
          className="group relative block w-full text-left transition-transform duration-200 hover:-translate-y-[2px] active:translate-y-0"
          style={{ background: ACCENT, color: INK }}
        >
          <div className="flex items-stretch">
            <div className="flex-1 px-4 py-4 md:py-5">
              <div className="text-[10px] tracking-[0.22em] uppercase font-bold opacity-70">Step 1 · Tell us what you need</div>
              <div className="font-serif italic font-black text-[26px] md:text-[32px] leading-none mt-1 tracking-[-0.02em]">
                Get my free quote
              </div>
            </div>
            <div className="flex items-center justify-center px-4 md:px-5 border-l-2 border-black/15 text-[22px] md:text-[26px] font-black transition-transform duration-200 group-hover:translate-x-1">
              →
            </div>
          </div>
        </a>

        {/* Secondary row — WhatsApp (high intent) + phone */}
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("cta_whatsapp_hero", "/")}
            data-testid="hero-cta-whatsapp"
            className="flex items-center justify-center gap-2 px-3 py-3 text-[11px] tracking-[0.2em] uppercase font-bold transition-transform duration-200 hover:-translate-y-[1px]"
            style={{ background: INK, color: PAPER }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M20.52 3.48A11.86 11.86 0 0012.05 0C5.5 0 .15 5.34.13 11.9c0 2.1.55 4.16 1.6 5.97L0 24l6.3-1.65a11.9 11.9 0 005.74 1.46h.01c6.55 0 11.9-5.34 11.92-11.9a11.84 11.84 0 00-3.46-8.43zM12.05 21.8h-.01a9.9 9.9 0 01-5.04-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 01-1.52-5.27c0-5.45 4.45-9.88 9.92-9.88a9.86 9.86 0 017.02 2.9 9.82 9.82 0 012.9 7 9.9 9.9 0 01-9.93 9.88zm5.44-7.4c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17c-.17.2-.34.22-.64.07a8.18 8.18 0 01-2.4-1.48 9.04 9.04 0 01-1.66-2.07c-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01a1.1 1.1 0 00-.8.37c-.27.3-1.04 1.02-1.04 2.49s1.07 2.88 1.22 3.08c.15.2 2.1 3.21 5.09 4.5.71.31 1.27.5 1.7.64.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.18-1.41-.07-.13-.27-.2-.57-.35z"/>
            </svg>
            WhatsApp
          </a>
          <a
            href="tel:+6580880757"
            onClick={() => trackEvent("cta_call_hero", "/")}
            data-testid="hero-cta-call"
            className="flex items-center justify-center gap-2 px-3 py-3 text-[11px] tracking-[0.2em] uppercase font-bold transition-transform duration-200 hover:-translate-y-[1px] border-2"
            style={{ background: "rgba(250,250,247,0.88)", color: INK, borderColor: INK }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z"/>
            </svg>
            Call now
          </a>
        </div>

        {/* Trust strip */}
        <div className="mt-2 flex items-center justify-between text-[9px] md:text-[10px] tracking-[0.18em] uppercase font-bold opacity-80">
          <span>★★★★★ 5,600+ jobs</span>
          <span>Same-week slots</span>
        </div>
      </div>

      {/* Bottom strip — DESKTOP ONLY (mobile shows phone in CTA cluster) */}
      <div className="hidden md:flex absolute bottom-0 inset-x-0 z-10 px-4 md:px-6 py-2 md:py-3 border-t items-center justify-between text-[10px] tracking-[0.18em] uppercase font-bold" style={{ borderColor: LINE, background: PAPER }}>
        <span className="flex items-center gap-1.5"><AccentSquare /> Open for jobs</span>
        <span>Scroll for the process</span>
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
    image: "/images/work/ikea-boxes-800.webp",
    image2x: "/images/work/ikea-boxes-800.webp",
    caption: "Fig. 01 — Parts received",
  },
  {
    no: "02",
    code: "VERIFY",
    title: "Receive a clear estimate.",
    body: "Our team reviews the work before confirmation. You see what's covered, what isn't, and what it costs.",
    image: "/images/work/wardrobe-install-team-800.webp",
    image2x: "/images/work/wardrobe-install-team-800.webp",
    caption: "Fig. 02 — Crew on site",
  },
  {
    no: "03",
    code: "COMPLETE",
    title: "Install, dismantle or relocate.",
    body: "A trained crew arrives on schedule, completes the work properly, and clears the packaging on the way out.",
    image: "/images/work/office-fitout-1600.webp",
    image2x: "/images/work/office-fitout-1600.webp",
    caption: "Fig. 03 — Office handover",
  },
];

// True crossfade — next chapter's in/peak overlap previous chapter's
// out/end so the stage is never blank during a transition.
const SEGMENTS = [
  { in: -0.05, peak: 0.0,  out: 0.32, end: 0.36 },
  { in: 0.32,  peak: 0.36, out: 0.64, end: 0.68 },
  { in: 0.64,  peak: 0.68, out: 1.0,  end: 1.05 },
];

function ChapterMedia({
  index,
  scrollYProgress,
  src,
  caption,
}: {
  index: number;
  scrollYProgress: MotionValue<number>;
  src: string;
  caption: string;
}) {
  const seg = SEGMENTS[index];
  const opacity = useTransform(scrollYProgress, [seg.in, seg.peak, seg.out, seg.end], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [seg.in, seg.peak, seg.out, seg.end], [1.06, 1, 1, 1.04]);
  return (
    <motion.div style={{ opacity }} className="absolute inset-0">
      <motion.img
        src={src}
        alt={caption}
        loading="lazy" decoding="async"
        style={{ scale }}
        className="w-full h-full object-cover"
      />
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-[10px] tracking-[0.2em] uppercase font-bold text-white">
        <span className="flex items-center gap-1.5 bg-black/65 backdrop-blur-sm px-2 py-1">
          <AccentSquare /> {caption}
        </span>
        <span className="bg-black/65 backdrop-blur-sm px-2 py-1">0{index + 1} / 03</span>
      </div>
    </motion.div>
  );
}

function ChapterCard({
  chapter,
  index,
  scrollYProgress,
  compact = false,
}: {
  chapter: typeof STORY[number];
  index: number;
  scrollYProgress: MotionValue<number>;
  compact?: boolean;
}) {
  const seg = SEGMENTS[index];
  const opacity = useTransform(scrollYProgress, [seg.in, seg.peak, seg.out, seg.end], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [seg.in, seg.peak, seg.out, seg.end], [40, 0, 0, -40]);
  if (compact) {
    return (
      <motion.div
        style={{ opacity, y }}
        className="absolute inset-x-0"
        data-testid={`chapter-mobile-${index}`}
      >
        <div className="flex items-baseline gap-3 mb-3">
          <span className="font-serif italic font-black text-black/90" style={{ fontSize: "56px", lineHeight: 0.85 }}>
            {chapter.no}
          </span>
          <Tag accent>{chapter.code}</Tag>
        </div>
        <h3 className="font-serif italic font-black tracking-[-0.02em] leading-[1.0] mb-3" style={{ fontSize: "26px" }}>
          {chapter.title}
        </h3>
        <p className="text-black/65 text-sm leading-relaxed">{chapter.body}</p>
        <div className="mt-4 flex gap-2">
          {STORY.map((_, j) => (
            <div key={j} className="h-[3px] w-8" style={{ background: j === index ? ACCENT : "rgba(10,10,10,0.18)" }} />
          ))}
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-x-0 max-w-[560px]"
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

/* ─────────────────────── Floating 3D companion (page-wide) ───────────────────────
   A fixed-position 3D widget that persists across the entire page.
   Drives its assembly progress from total document scroll: at the top of
   the page parts are scattered, at the bottom they have clicked together.
   Desktop only — mobile already has a busy CTA stack and would be crowded. */

function FloatingScene3D() {
  const progressRef = useRef(0);
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const [show, setShow] = useState(false);
  const [pct, setPct] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Drive progress from whole-page scroll
  useEffect(() => {
    if (reduce) {
      progressRef.current = 1;
      setPct(100);
      return;
    }
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
        progressRef.current = p;
        setPct(Math.round(p * 100));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduce]);

  // Defer canvas until idle so it doesn't block first paint
  useEffect(() => {
    if (!hasWebGL()) return;
    const ric: any = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 800));
    const id = ric(() => setShow(true));
    return () => {
      const cic: any = (window as any).cancelIdleCallback;
      if (cic && id) cic(id);
    };
  }, []);

  // Hide on mobile and when not WebGL-capable (avoids fighting CTA stack on phones)
  if (isMobile || dismissed || !hasWebGL()) return null;

  return (
    <aside
      className="fixed z-[55] pointer-events-auto"
      style={{
        right: 16,
        bottom: 16,
        width: collapsed ? 220 : 320,
        transition: "width 220ms ease",
      }}
      aria-label="Live workstation assembly companion"
      data-testid="floating-scene-3d"
    >
      <div
        className="relative border shadow-[0_8px_28px_rgba(0,0,0,0.18)] overflow-hidden"
        style={{ borderColor: "rgba(10,10,10,0.25)", background: PAPER }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b text-[10px] tracking-[0.2em] uppercase font-bold" style={{ borderColor: LINE, background: INK, color: PAPER }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-[8px] h-[8px] rounded-full animate-pulse" style={{ background: ACCENT }} />
            Live assembly
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="px-1.5 py-0.5 hover:bg-white/10 transition"
              aria-label={collapsed ? "Expand 3D" : "Collapse 3D"}
              data-testid="button-floating-toggle"
            >
              {collapsed ? "▢" : "—"}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="px-1.5 py-0.5 hover:bg-white/10 transition"
              aria-label="Close 3D"
              data-testid="button-floating-close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Canvas stage */}
        {!collapsed && (
          <div className="relative aspect-[4/3] w-full" style={{ background: "#f1efe7" }}>
            {show ? (
              <Suspense fallback={null}>
                <ThreeFurnitureScene progressRef={progressRef} isMobile={false} />
              </Suspense>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] tracking-[0.2em] uppercase font-bold opacity-50">
                loading scene…
              </div>
            )}
            <div className="absolute top-1.5 left-1.5 text-[9px] tracking-[0.2em] uppercase font-bold px-1.5 py-0.5" style={{ background: ACCENT, color: INK }}>
              Workstation · 14 parts
            </div>
          </div>
        )}

        {/* Footer — % built + bar + CTA */}
        <div className="px-2.5 py-2 border-t flex items-center gap-2" style={{ borderColor: LINE }}>
          <span
            className="font-serif italic font-black tabular-nums leading-none flex-shrink-0"
            style={{ fontSize: 22 }}
            data-testid="text-floating-pct"
          >
            {String(pct).padStart(2, "0")}
          </span>
          <span className="text-[9px] tracking-[0.2em] uppercase font-bold opacity-60 flex-shrink-0">% built</span>
          <div className="flex-1 h-[3px] bg-black/15 min-w-0">
            <div className="h-[3px]" style={{ width: `${pct}%`, background: ACCENT, transition: "width 120ms linear" }} />
          </div>
          <a
            href="/estimate"
            onClick={() => trackEvent("cta_floating_quote", "/")}
            className="text-[10px] tracking-[0.2em] uppercase font-bold px-2 py-1 flex-shrink-0 transition-transform hover:-translate-y-[1px]"
            style={{ background: INK, color: PAPER }}
            data-testid="cta-floating-quote"
          >
            Quote →
          </a>
        </div>
      </div>
    </aside>
  );
}

/* ─────────────────────── Scene3D — Inline scroll-to-assemble ───────────────────────
   The 3D workstation is a NORMAL block in the page flow. It scrolls along
   with surrounding content (no sticky pin, no fixed overlay). Assembly
   progress is driven by where the canvas sits in the viewport: scattered
   when it first enters from the bottom, fully built when it exits at the top. */

function Scene3D() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const [show, setShow] = useState(false);
  const [pct, setPct] = useState(0);

  // Drive assembly from section's position in viewport — moves WITH content
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const barScale = useTransform(scrollYProgress, [0.15, 0.85], [0, 1]);

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      const p = reduce ? 1 : Math.max(0, Math.min(1, (v - 0.15) / 0.7));
      progressRef.current = p;
      setPct(Math.round(p * 100));
    });
  }, [scrollYProgress, reduce]);

  // Defer canvas mount until idle so it doesn't block first paint
  useEffect(() => {
    if (!hasWebGL()) return;
    const ric: any = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 600));
    const id = ric(() => setShow(true));
    return () => {
      const cic: any = (window as any).cancelIdleCallback;
      if (cic && id) cic(id);
    };
  }, []);

  const canRender3D = show && hasWebGL();

  return (
    <section
      ref={sectionRef}
      id="scene-3d"
      className="relative py-16 md:py-28"
      style={{ background: "rgba(250,250,247,0.88)", color: INK }}
      data-testid="section-scene-3d"
    >
      <DotGrid opacity={0.4} />

      {/* Section opener — scrolls with content like every other section */}
      <div className="relative z-[2] px-5 md:px-10 lg:px-14 pb-6 md:pb-10 border-b" style={{ borderColor: LINE }}>
        <div className="grid grid-cols-12 gap-3 md:gap-8 items-end">
          <div className="col-span-12 md:col-span-4 flex flex-wrap items-center gap-2 mb-3 md:mb-0">
            <Tag>§ 00</Tag>
            <Tag accent>Scroll to assemble</Tag>
          </div>
          <div className="col-span-12 md:col-span-8">
            <h2
              className="font-serif italic tracking-[-0.03em] leading-[0.95] font-black"
              style={{ fontSize: "clamp(28px, 5.5vw, 88px)" }}
            >
              Watch one come together.
            </h2>
          </div>
        </div>
      </div>

      {/* Inline 3D stage — flows with the page, not pinned */}
      <div className="relative z-[2] mt-8 md:mt-12 px-5 md:px-10 lg:px-14">
        <div
          className="relative w-full overflow-hidden border"
          style={{
            borderColor: "rgba(10,10,10,0.18)",
            background: "#f1efe7",
            height: "clamp(380px, 70vh, 720px)",
          }}
        >
          {/* Ghost echo behind the canvas */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-[1] text-center pointer-events-none select-none"
          >
            <span
              className="font-serif italic font-black tracking-[-0.04em]"
              style={{
                fontSize: "clamp(120px, 22vw, 360px)",
                color: "transparent",
                WebkitTextStroke: "1px rgba(10,10,10,0.08)",
                lineHeight: 0.85,
                display: "block",
              }}
            >
              assemble
            </span>
          </div>

          {/* Canvas */}
          <div className="absolute inset-0 z-[2] pointer-events-none">
            {canRender3D ? (
              <Suspense fallback={null}>
                <ThreeFurnitureScene progressRef={progressRef} isMobile={isMobile} />
              </Suspense>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <img
                  src="/images/work/wardrobe-install-team-800.webp"
                  alt="TMG install team assembling a workstation"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}
          </div>

          {/* Editorial chip labels at the corners of the stage */}
          <div className="absolute top-3 left-3 z-[3] text-[10px] tracking-[0.2em] uppercase font-bold leading-tight max-w-[160px] pointer-events-none">
            <span style={{ background: ACCENT, color: INK, padding: "2px 6px" }}>Workstation</span>
            <span className="ml-1 block opacity-60 mt-1">14 parts · 1 crew · 42 min</span>
          </div>
          <div className="hidden md:block absolute top-3 right-3 z-[3] text-[10px] tracking-[0.2em] uppercase font-bold leading-tight text-right max-w-[180px] pointer-events-none">
            <span style={{ background: INK, color: PAPER, padding: "2px 6px" }}>Live</span>
            <span className="block opacity-60 mt-1">Tools · brackets · bolts</span>
          </div>

          {/* Bottom HUD — % complete + progress bar + CTA */}
          <div className="absolute bottom-0 inset-x-0 z-[3] px-3 md:px-5 py-3 border-t" style={{ borderColor: LINE, background: "rgba(250,250,247,0.9)", backdropFilter: "blur(6px)" }}>
            <div className="flex items-center gap-3 md:gap-5">
              <div className="flex items-baseline gap-2 flex-shrink-0">
                <span
                  className="font-serif italic font-black tabular-nums leading-none"
                  style={{ fontSize: "clamp(28px, 5vw, 56px)" }}
                  data-testid="text-scene-pct"
                >
                  {String(pct).padStart(2, "0")}
                </span>
                <span className="text-[10px] md:text-[12px] tracking-[0.2em] uppercase font-bold opacity-60">% built</span>
              </div>
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <span className="hidden md:inline text-[10px] tracking-[0.2em] uppercase font-bold whitespace-nowrap">Parts → Place</span>
                <div className="flex-1 h-[3px] bg-black/15 origin-left">
                  <motion.div style={{ scaleX: barScale, background: ACCENT }} className="h-[3px] origin-left" />
                </div>
                <span className="hidden md:inline text-[10px] tracking-[0.2em] uppercase font-bold whitespace-nowrap">Done</span>
              </div>
              <a
                href="/estimate"
                onClick={() => trackEvent("cta_scene_quote", "/")}
                data-testid="cta-scene-quote"
                className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.2em] uppercase font-bold flex-shrink-0 transition-transform hover:-translate-y-[1px]"
                style={{ background: ACCENT, color: INK }}
              >
                Book your job →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── PageBackgroundSequence — fixed canvas behind everything ───────────────────────
   The 121-frame install sequence painted into a viewport-sized <canvas> that
   is `position: fixed` BEHIND every section. Frame index is driven by the
   user's TOTAL page scroll. Top of page → frame 1 (boxed). Bottom of page →
   frame 121 (assembled). All section backgrounds above are semi-transparent
   so the desk is faintly visible no matter where the user scrolls. */

function _PageBackgroundSequenceLegacy_unused() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(0);

  // Preload frames AFTER first paint so the hero LCP isn't held back.
  // Strategy: wait for window load + idle, then load progressively in two
  // passes — every 4th frame first (for fast scrub coverage), then the rest.
  useEffect(() => {
    let cancelled = false;
    let count = 0;
    const imgs: HTMLImageElement[] = new Array(SEQ_COUNT);
    imagesRef.current = imgs;

    const loadOne = (i: number) => {
      if (cancelled || imgs[i]) return;
      const img = new Image();
      // Hint to the browser this is non-critical
      try { (img as any).fetchPriority = "low"; } catch {}
      (img as any).decoding = "async";
      img.src = SEQ_PATH(i + 1);
      const onDone = () => {
        if (cancelled) return;
        count += 1;
        setLoaded(count);
        if (count === SEQ_COUNT) setReady(true);
      };
      img.onload = onDone;
      img.onerror = onDone;
      imgs[i] = img;
    };

    const start = () => {
      if (cancelled) return;
      // Pass 1: every 4th frame for fast scrub coverage
      for (let i = 0; i < SEQ_COUNT; i += 4) loadOne(i);
      // Pass 2: fill in the rest after a tick
      setTimeout(() => {
        if (cancelled) return;
        for (let i = 0; i < SEQ_COUNT; i++) loadOne(i);
      }, 250);
    };

    const ric: any = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 1200));
    let rid: any;
    if (document.readyState === "complete") {
      rid = ric(start);
    } else {
      window.addEventListener("load", () => { rid = ric(start); }, { once: true });
    }

    return () => {
      cancelled = true;
      const cic: any = (window as any).cancelIdleCallback;
      if (cic && rid) cic(rid);
    };
  }, []);

  // Size the canvas to viewport. Render at DPR=1 (huge perf win on retina —
  // cuts pixels-to-paint by 4× with no visible quality loss for a soft
  // background image).
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    let lastIdx = -1;
    const resize = () => {
      cv.width = Math.round(window.innerWidth);
      cv.height = Math.round(window.innerHeight);
      lastIdx = -1; // force redraw after resize
      drawAt(currentP());
    };
    const currentP = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      return max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
    };
    const drawAt = (p: number) => {
      const ctx = cv.getContext("2d", { alpha: false });
      if (!ctx) return;
      const idx = reduce
        ? SEQ_COUNT - 1
        : Math.max(0, Math.min(SEQ_COUNT - 1, Math.round(p * (SEQ_COUNT - 1))));
      // Skip redraw when frame index hasn't actually changed — most scroll
      // ticks land on the same frame; this avoids needless drawImage calls.
      if (idx === lastIdx) return;
      const img = imagesRef.current[idx];
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const cw = cv.width;
      const ch = cv.height;
      const ir = img.naturalWidth / img.naturalHeight;
      const cr = cw / ch;
      let dw, dh, dx, dy;
      if (ir > cr) {
        dw = cw;
        dh = cw / ir;
      } else {
        dh = ch;
        dw = ch * ir;
      }
      dx = (cw - dw) / 2;
      dy = (ch - dh) / 2;
      ctx.fillStyle = "#f1efe7";
      ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
      lastIdx = idx;
    };

    resize();
    let raf = 0;
    const onScroll = () => {
      if (raf) return; // coalesce scroll bursts into one rAF
      raf = requestAnimationFrame(() => {
        raf = 0;
        drawAt(currentP());
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ready, reduce]);

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: "#f1efe7", willChange: "transform", transform: "translateZ(0)" }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
      {!ready && (
        <div
          className="fixed bottom-3 left-3 z-[60] text-[10px] tracking-[0.2em] uppercase font-bold px-2 py-1"
          style={{ background: INK, color: PAPER }}
          data-testid="text-bg-loading"
        >
          loading sequence… {Math.round((loaded / SEQ_COUNT) * 100)}%
        </div>
      )}
    </>
  );
}

/* ─────────────────────── InstallSequence — frame-scrub scroll animation ───────────────────────
   Real-footage scroll scrubber. 121 JPG frames extracted from the install GIF
   are preloaded into <Image> objects, then the current frame is drawn onto a
   <canvas> based on scroll position. Scroll DOWN → plays forward (dismantle).
   Scroll UP → plays backward (install back). useSpring adds a tiny lag so it
   feels like film, not a stepped slideshow (Apple product-page pattern). */

const SEQ_COUNT = 60;
const SEQ_PATH = (i: number) => `/sequences/install/f_${String(i).padStart(3, "0")}.webp`;

function InstallSequence() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(0);
  const [frameLabel, setFrameLabel] = useState(1);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  // Smooth the raw scroll value so the playback feels like film
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });

  // Preload every frame
  useEffect(() => {
    let cancelled = false;
    let count = 0;
    const imgs: HTMLImageElement[] = [];
    for (let i = 1; i <= SEQ_COUNT; i++) {
      const img = new Image();
      img.src = SEQ_PATH(i);
      img.onload = () => {
        if (cancelled) return;
        count += 1;
        setLoaded(count);
        if (count === SEQ_COUNT) setReady(true);
      };
      img.onerror = () => {
        if (cancelled) return;
        count += 1;
        setLoaded(count);
        if (count === SEQ_COUNT) setReady(true);
      };
      imgs.push(img);
    }
    imagesRef.current = imgs;
    return () => {
      cancelled = true;
    };
  }, []);

  // Size the canvas to its container (DPR-aware for crispness)
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const resize = () => {
      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(rect.width * dpr);
      cv.height = Math.round(rect.height * dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [ready]);

  // Draw current frame onto the canvas as smoothed scroll changes
  useEffect(() => {
    const draw = (p: number) => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const idx = Math.max(0, Math.min(SEQ_COUNT - 1, Math.round(p * (SEQ_COUNT - 1))));
      const img = imagesRef.current[idx];
      if (!img || !img.complete || img.naturalWidth === 0) return;
      // contain-fit
      const cw = cv.width;
      const ch = cv.height;
      const ir = img.naturalWidth / img.naturalHeight;
      const cr = cw / ch;
      let dw, dh, dx, dy;
      if (ir > cr) {
        dw = cw;
        dh = cw / ir;
      } else {
        dh = ch;
        dw = ch * ir;
      }
      dx = (cw - dw) / 2;
      dy = (ch - dh) / 2;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, dw, dh);
      setFrameLabel(idx + 1);
    };

    if (reduce) {
      draw(1);
      return;
    }
    // Initial draw
    draw(smooth.get());
    const unsub = smooth.on("change", draw);
    return () => unsub();
  }, [ready, reduce, smooth]);

  const pctLoaded = Math.round((loaded / SEQ_COUNT) * 100);

  return (
    <section
      ref={sectionRef}
      id="install-sequence"
      className="relative h-[220vh] md:h-[280vh]"
      style={{ background: "rgba(250,250,247,0.88)", color: INK }}
      data-testid="section-install-sequence"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        <DotGrid opacity={0.4} />

        {/* Top opener strip */}
        <div className="absolute top-0 inset-x-0 z-[5] px-5 md:px-10 lg:px-14 pt-16 md:pt-20 pb-4 border-b" style={{ borderColor: LINE }}>
          <div className="grid grid-cols-12 gap-3 md:gap-8 items-end">
            <div className="col-span-12 md:col-span-4 flex flex-wrap items-center gap-2 mb-3 md:mb-0">
              <Tag>§ 01</Tag>
              <Tag accent>Scroll to install</Tag>
            </div>
            <div className="col-span-12 md:col-span-8">
              <h2
                className="font-serif italic tracking-[-0.03em] leading-[0.95] font-black"
                style={{ fontSize: "clamp(28px, 5.5vw, 88px)" }}
              >
                Scroll down to install. Scroll up to dismantle.
              </h2>
            </div>
          </div>
        </div>

        {/* The scrubbed canvas */}
        <div className="absolute inset-0 pt-[150px] md:pt-[180px] pb-[110px] md:pb-[90px] z-[3]">
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            style={{ background: "#f1efe7" }}
            data-testid="canvas-install-sequence"
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] tracking-[0.2em] uppercase font-bold opacity-70">
              loading sequence… {pctLoaded}%
            </div>
          )}
        </div>

        {/* Editorial chip labels */}
        <div className="hidden md:block absolute top-[24%] left-[6%] z-[6] text-[10px] tracking-[0.2em] uppercase font-bold leading-tight max-w-[160px] pointer-events-none">
          <AccentSquare /> <span className="ml-1">Real install footage</span><br />
          <span className="ml-[14px] block opacity-60">TMG crew · Singapore</span>
        </div>
        <div className="hidden md:block absolute top-[24%] right-[6%] z-[6] text-[10px] tracking-[0.2em] uppercase font-bold leading-tight text-right max-w-[180px] pointer-events-none">
          <span style={{ background: INK, color: PAPER, padding: "2px 6px" }}>Scrubbing</span>
          <span className="block opacity-60 mt-1">{SEQ_COUNT} frames · 24 fps</span>
        </div>

        {/* Bottom HUD — frame counter + progress + CTA */}
        <div className="absolute bottom-0 inset-x-0 z-[6] px-5 md:px-10 lg:px-14 pb-4 md:pb-6 pt-3 border-t" style={{ borderColor: LINE, background: "rgba(250,250,247,0.85)", backdropFilter: "blur(6px)" }}>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-baseline gap-2 flex-shrink-0">
              <span
                className="font-serif italic font-black tabular-nums leading-none"
                style={{ fontSize: "clamp(28px, 5vw, 56px)" }}
                data-testid="text-seq-frame"
              >
                {String(frameLabel).padStart(3, "0")}
              </span>
              <span className="text-[10px] md:text-[12px] tracking-[0.2em] uppercase font-bold opacity-60">
                / {SEQ_COUNT} frame
              </span>
            </div>
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <span className="hidden md:inline text-[10px] tracking-[0.2em] uppercase font-bold whitespace-nowrap">Box</span>
              <div className="flex-1 h-[3px] bg-black/15 origin-left">
                <div
                  className="h-[3px]"
                  style={{
                    width: `${(frameLabel / SEQ_COUNT) * 100}%`,
                    background: ACCENT,
                    transition: "width 80ms linear",
                  }}
                />
              </div>
              <span className="hidden md:inline text-[10px] tracking-[0.2em] uppercase font-bold whitespace-nowrap">Done</span>
            </div>
            <a
              href="/estimate"
              onClick={() => trackEvent("cta_seq_quote", "/")}
              data-testid="cta-seq-quote"
              className="hidden md:inline-flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.2em] uppercase font-bold flex-shrink-0 transition-transform hover:-translate-y-[1px]"
              style={{ background: ACCENT, color: INK }}
            >
              Book your install →
            </a>
          </div>
        </div>
      </div>
    </section>
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
      className="relative md:h-[320vh]"
      style={{ background: "rgba(250,250,247,0.88)", color: INK }}
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

      {/* MOBILE — plain stacked cards, NO sticky, NO scroll choreography.
           This guarantees there are zero blank zones on phones. */}
      <div className="md:hidden relative pt-[160px]">
        <DotGrid opacity={0.4} />
        <div className="relative">
          {STORY.map((s, i) => (
            <article
              key={`m-${s.no}`}
              className="border-b"
              style={{ borderColor: LINE }}
              data-testid={`mobile-chapter-${i}`}
            >
              <div className="relative w-full aspect-[4/3] overflow-hidden bg-stone-200">
                <img
                  src={s.image}
                  alt={s.caption}
                  loading="lazy" decoding="async"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px] tracking-[0.2em] uppercase font-bold text-white">
                  <span className="flex items-center gap-1.5 bg-black/65 backdrop-blur-sm px-2 py-1">
                    <AccentSquare /> {s.caption}
                  </span>
                  <span className="bg-black/65 backdrop-blur-sm px-2 py-1">0{i + 1} / 03</span>
                </div>
              </div>
              <div className="px-6 py-10">
                <div className="flex items-baseline gap-3 mb-4">
                  <span
                    className="font-serif italic font-black text-black/90"
                    style={{ fontSize: "64px", lineHeight: 0.85 }}
                  >
                    {s.no}
                  </span>
                  <Tag accent>{s.code}</Tag>
                </div>
                <h3
                  className="font-serif italic font-black tracking-[-0.02em] leading-[1.0] mb-4"
                  style={{ fontSize: "30px" }}
                >
                  {s.title}
                </h3>
                <p className="text-black/65 text-base leading-relaxed">{s.body}</p>
                <div className="mt-6 flex gap-2">
                  {STORY.map((_, j) => (
                    <div
                      key={j}
                      className="h-[3px] w-8"
                      style={{ background: j === i ? ACCENT : "rgba(10,10,10,0.18)" }}
                    />
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* DESKTOP — sticky scroll choreography */}
      <div className="hidden md:block sticky top-0 h-screen w-full overflow-hidden">
        <DotGrid opacity={0.4} />

        {/* Floating editorial fragments — TMG service references */}
        <div className="absolute top-[14%] left-[6%] z-[6] text-[10px] tracking-[0.2em] uppercase font-bold leading-tight max-w-[140px] pointer-events-none">
          <AccentSquare /> <span className="ml-1">Wardrobes.</span><br />
          <span className="ml-[14px] block">Beds. Tables.</span>
          <span className="ml-[14px] block opacity-60">Office workstations.</span>
        </div>
        <div className="absolute top-[14%] right-[6%] z-[6] text-[10px] tracking-[0.2em] uppercase font-bold leading-tight text-right max-w-[160px] pointer-events-none">
          <span>Install · Dismantle</span><br />
          <span>Relocate · Repair</span><br />
          <span className="opacity-60">Singapore — island-wide</span>
        </div>

        <div className="grid grid-cols-12 h-full">
          <div className="col-span-6 relative flex items-center px-10 lg:px-14 z-[3]">
            <div className="w-full relative">
              {STORY.map((s, i) => (
                <ChapterCard key={s.no} chapter={s} index={i} scrollYProgress={scrollYProgress} />
              ))}
            </div>
          </div>
          <div className="col-span-6 relative border-l" style={{ borderColor: LINE }}>
            {STORY.map((s, i) => (
              <ChapterMedia
                key={`d-${s.no}`}
                index={i}
                scrollYProgress={scrollYProgress}
                src={s.image2x}
                caption={s.caption}
              />
            ))}
            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-3 pointer-events-none text-[10px] tracking-[0.18em] uppercase font-bold text-white z-[4]">
              <span className="bg-black/65 backdrop-blur-sm px-2 py-1">From parts</span>
              <div className="flex-1 h-[3px] origin-left bg-white/30">
                <motion.div style={{ scaleX: completeBar, background: ACCENT }} className="h-[3px] origin-left" />
              </div>
              <span className="bg-black/65 backdrop-blur-sm px-2 py-1">Complete</span>
            </div>
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
      style={{ background: "rgba(250,250,247,0.88)", color: INK, borderTop: `1px solid ${LINE}` }}
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
      style={{ background: "rgba(250,250,247,0.88)", color: INK, borderTop: `1px solid ${LINE}` }}
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
      style={{ background: "rgba(250,250,247,0.88)", color: INK, borderTop: `1px solid ${LINE}` }}
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
      style={{ background: "rgba(250,250,247,0.88)", color: INK }}
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
          <div className="grid grid-cols-2 gap-2">
            {[
              { src: "/images/work/office-fitout-800.webp", tag: "OFFICE", label: "20-station fit-out", aspect: "aspect-[4/5]" },
              { src: "/images/work/wardrobe-install-team-800.webp", tag: "WARDROBE", label: "4-door oak install", aspect: "aspect-[4/5]" },
              { src: "/images/work/phone-booth-completed-800.webp", tag: "PHONE BOOTH", label: "Acoustic pod", aspect: "aspect-[4/5]" },
              { src: "/images/work/bed-completed-800.webp", tag: "BED", label: "Bed frame · master room", aspect: "aspect-[4/5]" },
            ].map((it, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.6, delay: i * 0.08, ease: EASE }}
                className={`relative ${it.aspect} bg-stone-300 overflow-hidden border`}
                style={{ borderColor: LINE }}
                data-testid={`gallery-${i}`}
              >
                <img
                  src={it.src}
                  alt={it.label}
                  loading="lazy" decoding="async"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2">
                  <Tag accent>{it.tag}</Tag>
                </div>
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="text-[10px] tracking-[0.25em] uppercase text-white/85 font-bold">{it.label}</div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
              </motion.div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] tracking-[0.2em] uppercase font-bold opacity-65">
            <span className="flex items-center gap-1.5"><AccentSquare /> Recent installs</span>
            <span>Selected · 2024 / 25</span>
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

/* Carousell mark — inline SVG (react-icons/si has no Carousell glyph).
   Stylised shopping-bag with a "C" handle, evoking the brand mark.
   Uses currentColor so it can be tinted via Tailwind text-* classes. */
function CarousellMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Bag body */}
      <path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 8z" />
      {/* "C" handle that doubles as Carousell letterform */}
      <path d="M9 8a3 3 0 0 1 6 0" />
      <path d="M14.5 13.5a2.5 2.5 0 1 1 0-3" />
    </svg>
  );
}

function Footer() {
  const FACEBOOK_URL = "https://www.facebook.com/share/18XRT74vTT/?mibextid=wwXIfr";
  const INSTAGRAM_URL = "https://www.instagram.com/tmginstall.sg?igsh=MTN3NjN0MHR3YmMwMw%3D%3D&utm_source=qr";
  const CAROUSELL_URL = "https://carousell.app.link/DcX5hMEHZ2b";

  return (
    <footer
      className="relative border-t border-white/10 py-14 md:py-20 px-6 md:px-10 lg:px-14"
      style={{ background: INK, color: PAPER }}
      data-testid="section-footer"
    >
      <div className="mx-auto max-w-[1600px] grid grid-cols-12 gap-10 md:gap-8 items-start">
        {/* Left column — wordmark + tagline + social */}
        <div className="col-span-12 md:col-span-7">
          <div
            className="font-serif italic font-black text-white tracking-[-0.03em] leading-[0.9]"
            style={{ fontSize: "clamp(44px, 8vw, 100px)" }}
          >
            TMG <span className="text-white/55">/ Install</span>
          </div>
          <p className="text-stone-400 text-sm mt-5 max-w-sm leading-relaxed">
            The Moving Guy Pte Ltd · Singapore · Island-wide
          </p>

          {/* Social row — borderless icon links arranged on a clean baseline */}
          <div className="mt-9">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-stone-400 mb-5">
              <AccentSquare /> Follow Us
            </div>
            <div className="flex items-center gap-7 sm:gap-8">
              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TMG Install on Facebook"
                title="Facebook"
                data-testid="social-facebook"
                onClick={() => trackEvent("social_facebook", "/")}
                className="text-stone-300 hover:text-white transition-colors"
              >
                <SiFacebook className="w-[22px] h-[22px]" />
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TMG Install on Instagram"
                title="Instagram"
                data-testid="social-instagram"
                onClick={() => trackEvent("social_instagram", "/")}
                className="text-stone-300 hover:text-white transition-colors"
              >
                <SiInstagram className="w-[22px] h-[22px]" />
              </a>
              <a
                href={CAROUSELL_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="TMG Install on Carousell"
                title="Carousell"
                data-testid="social-carousell"
                onClick={() => trackEvent("social_carousell", "/")}
                className="text-stone-300 hover:text-white transition-colors"
              >
                <CarousellMark className="w-[22px] h-[22px]" />
              </a>
            </div>
            <p className="text-stone-500 text-[11px] sm:text-xs mt-5 leading-relaxed tracking-wide">
              <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">@tmginstall</a>
              <span className="mx-2 text-stone-700">·</span>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">@tmginstall.sg</a>
              <span className="mx-2 text-stone-700">·</span>
              <a href={CAROUSELL_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">@tmg_01f647</a>
            </p>
          </div>
        </div>

        {/* Right column — contact + legal */}
        <div className="col-span-12 md:col-span-5 md:text-right">
          <div className="text-[10px] font-black uppercase tracking-[0.28em] text-stone-400 mb-4 flex md:justify-end items-center gap-2">
            <AccentSquare /> Contact
          </div>
          <div className="space-y-2.5 text-sm text-stone-300">
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:text-white transition"
              data-testid="footer-whatsapp"
            >
              WhatsApp · +65 8088 0757
            </a>
            <a
              href="mailto:sales@tmginstall.com"
              className="block hover:text-white transition break-all md:break-normal"
              data-testid="footer-email"
            >
              sales@tmginstall.com
            </a>
          </div>
          <div className="h-px bg-white/10 my-5 md:ml-auto md:w-32" />
          <div className="space-y-2.5 text-sm text-stone-400">
            <Link href="/terms" className="block hover:text-white transition" data-testid="footer-terms">Terms</Link>
            <Link href="/privacy" className="block hover:text-white transition" data-testid="footer-privacy">Privacy</Link>
          </div>
        </div>
      </div>

      {/* Bottom bar — copyright + signature */}
      <div className="mx-auto max-w-[1600px] mt-14 md:mt-16 pt-7 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-stone-500 uppercase tracking-[0.18em]">
        <span data-testid="footer-copyright">© {new Date().getFullYear()} The Moving Guy Pte Ltd · UEN 202424156H</span>
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
      className="antialiased selection:bg-black selection:text-white font-sans relative"
      style={{ background: "#f1efe7", color: INK }}
    >
      <div className="relative z-10">
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
      </div>
      <StickyMobileCTA />
    </div>
  );
}
