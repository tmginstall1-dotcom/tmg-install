import { Link } from "wouter";
import { useState, useEffect, useRef, Suspense } from "react";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useSpring,
  type MotionValue,
} from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float } from "@react-three/drei";
import * as THREE from "three";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";
import { useSEO } from "@/hooks/use-seo";
import tmgLogo from "@assets/generated_images/tmg_icon_1024.png";

/* ────────────────────────────────────────────────────────────────────────────
   TMG × PARADISO — editorial monochrome landing
   Aesthetic borrowed from paradisoinstitute.org: pure white canvas, neon
   green accent pills, sparse corner-anchored grid, registration-mark grid
   pattern, large faded ghost type bleeding off-screen, scattered editorial
   text fragments.  Typography stays on TMG's existing tokens (Teko / Inter)
   so the brand voice is preserved.
   ──────────────────────────────────────────────────────────────────────── */

const ACCENT = "#1aff7e"; // Neon green pill colour
const BRUSH = "'Rubik Wet Paint', 'Caveat Brush', cursive"; // Hand-drawn ink wordmark

/* ─── Tiny shared atoms ───────────────────────────────────────────────── */

/* Use wouter Link only for internal SPA paths; native <a> for hash anchors
   and external URLs (WhatsApp, etc). */
function isInternalRoute(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}
function isExternal(href: string) {
  return /^https?:\/\//i.test(href);
}

function Pill({
  children,
  href,
  className = "",
  testId,
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
  testId?: string;
}) {
  const base =
    "inline-block px-2.5 py-1 text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase text-black leading-none whitespace-nowrap";
  const style = { background: ACCENT };
  const cls = `${base} hover:opacity-90 transition-opacity ${className}`;
  if (href) {
    if (isInternalRoute(href)) {
      return (
        <Link href={href} data-testid={testId} className={cls} style={style}>
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        data-testid={testId}
        className={cls}
        style={style}
        {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <span data-testid={testId} className={`${base} ${className}`} style={style}>
      {children}
    </span>
  );
}

function BlackPill({
  children,
  href,
  className = "",
  testId,
}: {
  children: React.ReactNode;
  href?: string;
  className?: string;
  testId?: string;
}) {
  const base =
    "inline-block px-2.5 py-1 text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase text-white leading-none whitespace-nowrap bg-black";
  const cls = `${base} hover:bg-neutral-800 transition-colors ${className}`;
  if (href) {
    if (isInternalRoute(href)) {
      return (
        <Link href={href} data-testid={testId} className={cls}>
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        data-testid={testId}
        className={cls}
        {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }
  return (
    <span data-testid={testId} className={`${base} ${className}`}>
      {children}
    </span>
  );
}

function TinyLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-block text-[10px] sm:text-[11px] font-medium tracking-[0.18em] uppercase text-black leading-tight ${className}`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {children}
    </span>
  );
}

/* ─── DateLine — live "Wed 08 May 26" dateline for the masthead ─────── */

function DateLine() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const day = now.toLocaleDateString("en-SG", { weekday: "short" });
  const date = now.toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
  return (
    <span className="tabular-nums">
      {day}&nbsp;&middot;&nbsp;{date}
    </span>
  );
}

/* ─── RuleLink — editorial CTA: text + animated underline + arrow.
       Behaves like a footnoted action in a printed layout, not a button. */

function RuleLink({
  href,
  label,
  sub,
  primary = false,
  testId,
}: {
  href: string;
  label: string;
  sub?: string;
  primary?: boolean;
  testId?: string;
}) {
  const isExt = isExternal(href);
  const internal = isInternalRoute(href) && !isExt;
  const inner = (
    <span
      className="group inline-flex flex-col gap-2 cursor-pointer"
      data-testid={testId}
    >
      <span
        className={`flex items-baseline gap-3 ${primary ? "text-black" : "text-black/80"}`}
        style={{ fontFamily: "var(--font-paradiso)" }}
      >
        <span
          className={`${primary ? "text-[22px] sm:text-[28px] font-semibold" : "text-[18px] sm:text-[22px] font-medium"} tracking-[-0.01em] leading-none`}
        >
          {label}
        </span>
        <span
          aria-hidden="true"
          className="inline-block transition-transform duration-300 ease-out group-hover:translate-x-2"
          style={{ fontSize: primary ? "22px" : "18px", lineHeight: 1 }}
        >
          →
        </span>
      </span>
      <span
        className={`block h-px ${primary ? "bg-black" : "bg-black/40"} origin-left transition-transform duration-500 ease-out group-hover:scale-x-110`}
        style={{ width: primary ? "11rem" : "9rem" }}
        aria-hidden="true"
      />
      {sub ? (
        <span
          className="text-[10px] uppercase tracking-[0.22em] text-black/70"
          style={{ fontFamily: "var(--font-paradiso)" }}
        >
          {sub}
        </span>
      ) : null}
    </span>
  );
  if (internal) {
    return (
      <Link href={href} className="inline-block">
        {inner}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className="inline-block"
      {...(isExt ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {inner}
    </a>
  );
}

/* ─── Background — registration-mark grid (paradiso's tiny + crosses) ── */

function GridMarks() {
  // Paradiso uses tiny pale squares scattered on an invisible grid — much
  // subtler than crosshair marks. ~3px squares at the corners of a 96px tile,
  // very low opacity so they read as registration marks, not a grid.
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <pattern
            id="paradiso-marks"
            x="0"
            y="0"
            width="96"
            height="96"
            patternUnits="userSpaceOnUse"
          >
            <rect x="0" y="0" width="3" height="3" fill="rgba(0,0,0,0.10)" />
            <rect x="93" y="93" width="3" height="3" fill="rgba(0,0,0,0.10)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#paradiso-marks)" />
      </svg>
    </div>
  );
}

/* ─── Live "is here" counter — paradiso's "1 is here / 5616 were here" ── */

function LiveNow() {
  const [now, setNow] = useState(1);
  useEffect(() => {
    const a = setInterval(
      () => setNow((n) => Math.max(1, Math.min(7, n + (Math.random() > 0.5 ? 1 : -1)))),
      6000,
    );
    return () => clearInterval(a);
  }, []);
  return (
    <>
      {now} is
      <br />
      here
    </>
  );
}

function LiveTotal() {
  const [total, setTotal] = useState(8472);
  useEffect(() => {
    const b = setInterval(() => setTotal((t) => t + 1), 18000);
    return () => clearInterval(b);
  }, []);
  return (
    <>
      {total.toLocaleString()}
      <br />
      were here
    </>
  );
}

/* ─── Ghost type — huge faded background phrase ──────────────────────── */

function GhostType({
  children,
  className = "",
  style,
  brush = false,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  brush?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute uppercase leading-[0.85] whitespace-nowrap ${className}`}
      style={{
        fontFamily: brush ? BRUSH : "var(--font-heading)",
        fontWeight: brush ? 400 : 900,
        color: "rgba(0,0,0,0.05)",
        letterSpacing: brush ? "0" : "-0.04em",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── 3D INK BLOB — scroll-driven floating shape (paradiso-style) ────── */

/* Inner mesh that reads scroll progress + clock for animation. The blob is
   a heavily-distorted icosahedron with a matte black material — reads as
   a giant ink/brush mass that breathes and slowly rotates behind the
   centred wordmark, paradiso-style. */
function InkBlobMesh({ scrollY }: { scrollY: MotionValue<number> }) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const distortRef = useRef<any>(null);

  useFrame((state) => {
    const m = meshRef.current;
    if (!m) return;
    const t = state.clock.getElapsedTime();
    const s = scrollY.get(); // 0 → 1 over the page

    // Slow continuous rotation + scroll-coupled spin
    m.rotation.x = t * 0.14 + s * Math.PI * 1.2;
    m.rotation.y = t * 0.18 + s * Math.PI * 1.8;
    m.rotation.z = Math.sin(t * 0.25) * 0.18;

    // Stay roughly centred; drift slightly with scroll instead of leaving
    m.position.x = Math.sin(t * 0.3) * 0.08 - s * 0.3;
    m.position.y = Math.sin(t * 0.5) * 0.1 - s * 0.5;

    // Gentle breathing scale
    const k = 1 + Math.sin(t * 0.8) * 0.05 + s * 0.15;
    m.scale.set(k, k, k);

    // Heavier distortion → reads as an organic ink mass, not a sphere
    if (distortRef.current) {
      distortRef.current.distort = 0.55 + Math.sin(t * 0.6) * 0.08 + s * 0.15;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.5}>
      <mesh ref={meshRef} position={[0, 0, 0]} scale={2.1}>
        <icosahedronGeometry args={[1, 32]} />
        <MeshDistortMaterial
          ref={distortRef}
          color="#000000"
          roughness={0.7}
          metalness={0.05}
          distort={0.55}
          speed={1.4}
        />
      </mesh>
    </Float>
  );
}

/* Feature-detect WebGL once. Some headless browsers / sandboxed previews
   can't create a context — we silently fall back to a CSS ink-blob so the
   page never crashes. */
function useHasWebGL() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      const gl =
        c.getContext("webgl2") ||
        c.getContext("webgl") ||
        c.getContext("experimental-webgl");
      setOk(!!gl);
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}

/* CSS fallback — animated radial-gradient blob that drifts with scroll.
   No WebGL needed. Looks like a soft ink stain breathing in the background. */
function InkBlobCSS({ scrollY }: { scrollY: MotionValue<number> }) {
  const x = useTransform(scrollY, [0, 1], ["0vw", "-20vw"]);
  const y = useTransform(scrollY, [0, 1], ["0vh", "-30vh"]);
  const rotate = useTransform(scrollY, [0, 1], [0, 180]);
  const scale = useTransform(scrollY, [0, 1], [1, 1.25]);
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 4 }}
      data-testid="ink-blob-css"
    >
      <motion.div
        style={{
          x,
          y,
          rotate,
          scale,
          position: "absolute",
          left: "50%",
          top: "50%",
          translateX: "-50%",
          translateY: "-50%",
          width: "min(70vw, 720px)",
          height: "min(70vw, 720px)",
          background:
            "radial-gradient(closest-side, rgba(0,0,0,0.92), rgba(0,0,0,0.55) 45%, rgba(0,0,0,0) 70%)",
          filter: "blur(2px)",
          borderRadius: "50% 38% 62% 44% / 48% 56% 40% 52%",
          animation: "blobMorph 14s ease-in-out infinite",
        }}
      />
    </div>
  );
}

/* Full-bleed Canvas wrapper. Lives ABSOLUTELY inside the hero (not fixed
   to the viewport) so the page bg-white can never paint over it, and the
   blob clearly reads as the dark "ink mass" behind the centred brush
   wordmark — paradiso's signature: a single heavy black shape that
   breathes and rotates, with the wordmark sitting on top. */
function InkBlob3D({ scrollY }: { scrollY: MotionValue<number> }) {
  const hasWebGL = useHasWebGL();
  const [crashed, setCrashed] = useState(false);

  if (!hasWebGL || crashed) return <InkBlobCSS scrollY={scrollY} />;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 4, opacity: 0.92 }}
      data-testid="ink-blob-3d"
    >
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 45 }}
        gl={{
          antialias: true,
          alpha: true,
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
        }}
        dpr={[1, 1.6]}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        onError={() => setCrashed(true)}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} />
        <directionalLight position={[-5, -3, 2]} intensity={0.35} color="#888" />
        <Suspense fallback={null}>
          <InkBlobMesh scrollY={scrollY} />
        </Suspense>
      </Canvas>
    </div>
  );
}

/* ─── Section reveal wrapper ─────────────────────────────────────────── */

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px -10% 0px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── PAGE ────────────────────────────────────────────────────────────── */

export default function LandingParadiso() {
  usePageTracker("/");
  useSEO({
    title: "TMG Install — Singapore Furniture Installation, Done Right",
    description:
      "Quote in 60 seconds. Trusted by 5,000+ households. Installation, dismantling and relocation across Singapore.",
  });

  // Scroll progress drives both the 3D blob and the parallax-translated
  // editorial text. We smooth it with a spring so motion never jitters.
  const pageRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: pageRef });
  const smoothScroll = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 22,
    mass: 0.4,
  });

  // Parallax transforms — used by the centred wordmark, the bottom
  // running phrase and the ghost mirrors as you scroll.
  const yGhostL = useTransform(smoothScroll, [0, 1], [0, -420]);
  const xBleed = useTransform(smoothScroll, [0, 1], ["0%", "-55%"]);
  const yWordmark = useTransform(smoothScroll, [0, 0.5], [0, -120]);
  const opacityWordmark = useTransform(smoothScroll, [0, 0.35], [1, 0.15]);

  return (
    <div
      ref={pageRef}
      className="bg-white text-black min-h-screen overflow-x-hidden relative"
      style={{ fontFamily: "var(--font-paradiso-body)" }}
      data-testid="page-paradiso"
    >
      {/* Single global registration-mark canvas — fixed behind every
          section so the marks read as one continuous "paper grain" instead
          of restarting at each section. */}
      <div className="fixed inset-0 z-[0] pointer-events-none">
        <GridMarks />
      </div>

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[100svh] w-full overflow-hidden border-b border-black/10 bg-white">

        {/* ─── 3D ink mass — sits behind the centred brush wordmark. Below
             text (z-4) but above the page bg. WebGL with CSS fallback. ─── */}
        <InkBlob3D scrollY={smoothScroll} />

        {/* ─── TOP-LEFT — tiny black credit bar (paradiso "patron" block).
             Logo chip + two-line studio credential, set in a small typeface
             with bold green accent words. ─── */}
        <div
          className="absolute left-0 top-0 z-30 flex items-stretch bg-black"
          data-testid="credit-bar"
        >
          <Link
            href="/"
            aria-label="TMG Install — home"
            className="flex items-center justify-center px-2.5 py-2.5 border-r border-white/10"
            data-testid="link-logo"
          >
            <img
              src={tmgLogo}
              alt="TMG Install"
              className="h-7 w-7 object-cover"
              loading="eager"
              decoding="async"
              data-testid="img-logo"
            />
          </Link>
          <div
            className="px-3 py-2 text-white text-[10px] sm:text-[11px] leading-[1.35] tracking-[0.04em] max-w-[20rem] sm:max-w-[26rem]"
            style={{ fontFamily: "var(--font-paradiso)" }}
          >
            Furniture installation, dismantling and relocation,
            <br />
            specified and executed by{" "}
            <span style={{ color: ACCENT }} className="font-semibold">
              TMG&nbsp;INSTALL
            </span>
            . Singapore, since{" "}
            <span style={{ color: ACCENT }} className="font-semibold">
              2018
            </span>
            .
          </div>
        </div>

        {/* ─── HIDDEN — kept as fallback noscript dateline. Removed in DOM
             but the structural slot is preserved by the next siblings. ─── */}
        {/* ─── TOP-RIGHT — live counter pills (paradiso "1 is here / N were here"). ─── */}
        <div className="absolute right-3 sm:right-5 top-3 sm:top-4 z-30">
          <div className="flex items-start gap-1.5" data-testid="live-counter">
            <div
              className="px-2 py-1.5 text-black"
              style={{ background: ACCENT, minWidth: 44 }}
            >
              <div
                className="text-[10px] leading-tight font-medium lowercase"
                style={{ fontFamily: "var(--font-paradiso)" }}
              >
                <LiveNow />
              </div>
            </div>
            <div
              className="px-2 py-1.5 text-black"
              style={{ background: ACCENT, minWidth: 44 }}
            >
              <div
                className="text-[10px] leading-tight font-medium lowercase"
                style={{ fontFamily: "var(--font-paradiso)" }}
              >
                <LiveTotal />
              </div>
            </div>
          </div>
        </div>

        {/* ─── SCATTERED ACCENT PILLS — paradiso anchors short labels at
             deliberate corners around the centre. Each pill marks a real
             section of the page. ─── */}
        <div className="absolute left-[16%] top-[14%] z-20 hidden sm:block">
          <Pill href="#services" testId="pill-services">
            Services
          </Pill>
        </div>
        <div className="absolute left-[42%] top-[10%] z-20 hidden md:block">
          <Pill href="#how" testId="pill-process">
            The process
          </Pill>
        </div>
        <div className="absolute right-[14%] top-[22%] z-20 hidden sm:block">
          <Pill href="#pricing" testId="pill-pricing">
            Fixed pricing
          </Pill>
        </div>
        <div className="absolute left-[14%] bottom-[26%] z-20 hidden md:block">
          <Pill href="#trust" testId="pill-trust">
            5,000+ jobs
          </Pill>
        </div>
        <div className="absolute right-[18%] bottom-[28%] z-20 hidden md:block">
          <Pill href="#trust" testId="pill-insured">
            Fully insured
          </Pill>
        </div>

        {/* ─── TINY EDITORIAL TEXT FRAGMENTS — paradiso scatters ultra-short
             prose like "An ethos…", "A feeling…" at the corners. Reads as
             a magazine sidebar, not as marketing copy. ─── */}
        <div
          className="absolute left-[28%] top-[14%] z-20 hidden lg:block max-w-[8rem] text-[11px] leading-[1.35] text-black/85"
          style={{ fontFamily: "var(--font-paradiso)" }}
          data-testid="fragment-1"
        >
          A studio,
          <br />
          not a marketplace.
        </div>
        <div
          className="absolute right-[28%] top-[18%] z-20 hidden lg:block max-w-[8rem] text-[11px] leading-[1.35] text-black/85 text-right"
          style={{ fontFamily: "var(--font-paradiso)" }}
          data-testid="fragment-2"
        >
          A craft,
          <br />
          not a side-hustle.
        </div>
        <div
          className="absolute left-[36%] bottom-[22%] z-20 hidden lg:block max-w-[10rem] text-[11px] leading-[1.35] text-black/85"
          style={{ fontFamily: "var(--font-paradiso)" }}
          data-testid="fragment-3"
        >
          An installation,
          <br />
          not a delivery drop-off.
        </div>

        {/* ─── CENTRAL BRUSH WORDMARK — the protagonist of the page.
             Pale ghost duplicates float on either side. The 3D ink mass
             behind it (z-4) reads as the brush's own ink rolling and
             breathing. The wordmark itself sits at z-10 to stay legible. ─── */}
        <motion.div
          style={{ y: yWordmark, opacity: opacityWordmark }}
          className="absolute inset-0 z-[25] flex flex-col items-center justify-center pointer-events-none px-6"
          data-testid="hero-wordmark"
        >
          {/* Ghost mirror — left */}
          <span
            aria-hidden="true"
            className="absolute left-[-6%] top-[28%] hidden md:block select-none"
            style={{
              fontFamily: BRUSH,
              fontSize: "clamp(180px, 22vw, 360px)",
              color: "rgba(0,0,0,0.05)",
              lineHeight: 0.9,
              transform: "rotate(-4deg)",
            }}
          >
            tmg
          </span>
          {/* Ghost mirror — right */}
          <span
            aria-hidden="true"
            className="absolute right-[-6%] top-[28%] hidden md:block select-none"
            style={{
              fontFamily: BRUSH,
              fontSize: "clamp(180px, 22vw, 360px)",
              color: "rgba(0,0,0,0.05)",
              lineHeight: 0.9,
              transform: "rotate(4deg) scaleX(-1)",
            }}
          >
            tmg
          </span>

          {/* Main brush wordmark */}
          <Reveal delay={0.05}>
            <h1
              className="text-black select-none m-0"
              style={{
                fontFamily: BRUSH,
                fontSize: "clamp(140px, 26vw, 460px)",
                lineHeight: 0.85,
                letterSpacing: "-0.02em",
              }}
              data-testid="hero-title"
            >
              tmg
            </h1>
          </Reveal>

          {/* Letter-spaced subline — paradiso's "INSTITUTE" treatment */}
          <Reveal delay={0.18}>
            <div
              className="-mt-2 sm:-mt-3 text-black"
              style={{
                fontFamily: "var(--font-paradiso)",
                fontSize: "clamp(18px, 3.4vw, 48px)",
                letterSpacing: "0.42em",
                fontWeight: 300,
                paddingLeft: "0.42em",
              }}
              data-testid="hero-subtitle"
            >
              INSTALL
            </div>
          </Reveal>
        </motion.div>

        {/* ─── BOTTOM-LEFT — small live caption card (paradiso has a tiny
             "LIVE 14:25 — Barcelona" video card; we mirror with a small
             "live job" status card). Pure type, no media. ─── */}
        <div
          className="absolute left-3 sm:left-5 bottom-3 sm:bottom-5 z-30 flex items-stretch"
          data-testid="live-job"
        >
          <div
            className="px-2 py-1.5 text-[10px] tracking-[0.22em] uppercase font-semibold text-black"
            style={{ background: ACCENT, fontFamily: "var(--font-paradiso)" }}
          >
            Live
          </div>
          <div
            className="bg-black text-white px-2.5 py-1.5 text-[10px] uppercase tracking-[0.22em]"
            style={{ fontFamily: "var(--font-paradiso)" }}
          >
            <span className="text-white/60">Now &mdash;</span>{" "}
            <span className="text-white">2 PAX wardrobes, Bishan</span>
          </div>
        </div>

        {/* ─── BOTTOM-RIGHT — anchored CTA pills. ─── */}
        <div
          className="absolute right-3 sm:right-5 bottom-3 sm:bottom-5 z-30 flex items-center gap-1.5"
          data-testid="hero-ctas"
        >
          <BlackPill href="/estimate" testId="cta-quote">
            Get a quote &nbsp;→
          </BlackPill>
          <Pill
            href="https://wa.me/6580880757"
            testId="cta-whatsapp"
          >
            WhatsApp
          </Pill>
        </div>

        {/* ─── BOTTOM RUNNING PHRASE — huge faded uppercase line that
             scrolls horizontally across the lower edge of the hero.
             Paradiso has "BEFORE REASON, BEFORE…" — ours is editorial
             language that reads as an axiom, not a tagline. ─── */}
        <motion.div
          aria-hidden="true"
          style={{ x: xBleed, y: yGhostL }}
          className="absolute left-0 right-0 bottom-12 sm:bottom-16 z-[3] pointer-events-none select-none overflow-hidden"
        >
          <div
            className="whitespace-nowrap uppercase font-semibold text-black/[0.08]"
            style={{
              fontFamily: "var(--font-paradiso)",
              fontSize: "clamp(72px, 12vw, 200px)",
              letterSpacing: "-0.04em",
              lineHeight: 0.9,
            }}
          >
            Measure twice. Drill once. Install for life.
          </div>
        </motion.div>
      </section>
      {/* ═══════════════════════ MARQUEE STRIP ═══════════════════════ */}
      <div
        className="relative border-y border-black/10 overflow-hidden"
        style={{ background: ACCENT }}
        data-testid="strip-marquee"
      >
        <div className="flex gap-12 py-3 whitespace-nowrap animate-[marquee_38s_linear_infinite]">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex gap-12 shrink-0">
              {[
                "INSTALLATION",
                "DISMANTLING",
                "RELOCATION",
                "ISLAND-WIDE",
                "5,000+ HOMES",
                "QUOTE IN 60s",
                "SAME-DAY",
                "FULLY INSURED",
                "★★★★★ ON GOOGLE",
              ].map((t, i) => (
                <span
                  key={i}
                  className="text-[11px] sm:text-xs font-bold tracking-[0.25em] uppercase text-black"
                >
                  {t} <span className="ml-12 opacity-50">+</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════ SERVICES ═══════════════════════ */}
      <section id="services" className="relative py-24 sm:py-36 px-4 sm:px-8">
        <div className="relative max-w-6xl mx-auto">
          {/* Section eyebrow as paradiso pill in top-left of section */}
          <div className="absolute -top-3 left-0">
            <Pill testId="pill-section-services">01 · SERVICES</Pill>
          </div>

          <Reveal>
            <h2
              className="font-black uppercase leading-[0.9] tracking-[-0.03em] mt-12 sm:mt-16 max-w-4xl"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(40px, 8vw, 120px)",
              }}
              data-testid="text-services-title"
            >
              What we
              <br />
              <span style={{ background: ACCENT }} className="px-2">
                handle.
              </span>
            </h2>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px mt-16 sm:mt-20 bg-black/15">
            {[
              {
                num: "01",
                title: "Living room",
                items: ["Sofas", "TV consoles", "Wardrobes", "Bookshelves"],
              },
              {
                num: "02",
                title: "Bedroom",
                items: ["Bed frames", "Mattresses", "Dressers", "Nightstands"],
              },
              {
                num: "03",
                title: "Office",
                items: ["Desks", "Ergonomic chairs", "Storage", "Filing"],
              },
              {
                num: "04",
                title: "Kitchen",
                items: ["Fridges", "Ovens", "Dishwashers", "Hoods"],
              },
              {
                num: "05",
                title: "Fitness",
                items: ["Treadmills", "Bikes", "Racks", "Multi-stations"],
              },
              {
                num: "06",
                title: "Relocation",
                items: ["Full-home moves", "Office shifts", "HDB", "Condo"],
              },
            ].map((s, i) => (
              <Reveal
                key={s.num}
                delay={i * 0.04}
                className="bg-white p-6 sm:p-8 hover:bg-neutral-50 transition-colors group"
              >
                <div className="flex items-start justify-between mb-6">
                  <TinyLabel className="opacity-50">{s.num}</TinyLabel>
                  <span
                    className="text-xl group-hover:translate-x-1 transition-transform"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </div>
                <h3
                  className="text-2xl sm:text-3xl font-bold mb-4 tracking-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                  data-testid={`text-service-title-${s.num}`}
                >
                  {s.title}
                </h3>
                <ul className="space-y-1.5">
                  {s.items.map((it) => (
                    <li
                      key={it}
                      className="text-sm text-black/70 flex items-center gap-2"
                    >
                      <span
                        className="w-1.5 h-1.5"
                        style={{ background: ACCENT }}
                      />
                      {it}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ HOW ═══════════════════════ */}
      <section
        id="how"
        className="relative py-24 sm:py-36 px-4 sm:px-8 bg-black text-white overflow-hidden"
      >
        <div className="relative max-w-6xl mx-auto">
          <div className="absolute -top-3 left-0">
            <span
              className="inline-block px-2.5 py-1 text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase text-black leading-none"
              style={{ background: ACCENT }}
            >
              02 · HOW IT WORKS
            </span>
          </div>

          <GhostType
            className="text-[16vw] right-[-6%] top-[10%]"
            style={{ color: "rgba(255,255,255,0.04)" }}
          >
            PROCESS
          </GhostType>

          <Reveal>
            <h2
              className="font-black uppercase leading-[0.9] tracking-[-0.03em] mt-12 sm:mt-16 max-w-4xl"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(40px, 8vw, 120px)",
              }}
              data-testid="text-how-title"
            >
              Three
              <br />
              steps. <span style={{ color: ACCENT }}>One day.</span>
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-px mt-20 bg-white/15">
            {[
              {
                n: "01",
                t: "Quote in 60s",
                d: "Pick your items, set the date, see the price upfront. No site visit. No haggling. No surprises.",
              },
              {
                n: "02",
                t: "Confirm & pay",
                d: "PayNow QR or card. Instant booking confirmation by email + WhatsApp. We send the team details the day before.",
              },
              {
                n: "03",
                t: "We show up",
                d: "On-time, in uniform, fully insured. Photo updates throughout. Job complete the same day.",
              },
            ].map((s, i) => (
              <Reveal
                key={s.n}
                delay={i * 0.08}
                className="bg-black p-6 sm:p-10 relative"
              >
                <div
                  className="absolute top-0 left-0 h-1"
                  style={{ background: ACCENT, width: `${(i + 1) * 33}%` }}
                />
                <div className="flex items-baseline gap-3 mb-6">
                  <span
                    className="text-5xl sm:text-6xl font-black"
                    style={{
                      fontFamily: "var(--font-heading)",
                      color: ACCENT,
                    }}
                  >
                    {s.n}
                  </span>
                  <TinyLabel className="text-white/40">STEP</TinyLabel>
                </div>
                <h3
                  className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight text-white"
                  style={{ fontFamily: "var(--font-heading)" }}
                  data-testid={`text-step-${s.n}`}
                >
                  {s.t}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">{s.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ PRICING ═══════════════════════ */}
      <section id="pricing" className="relative py-24 sm:py-36 px-4 sm:px-8">
        <div className="relative max-w-6xl mx-auto">
          <div className="absolute -top-3 left-0">
            <Pill testId="pill-section-pricing">03 · PRICING</Pill>
          </div>
          <div className="absolute -top-3 right-0 hidden sm:block">
            <BlackPill testId="pill-no-hidden">NO HIDDEN FEES</BlackPill>
          </div>

          <Reveal>
            <h2
              className="font-black uppercase leading-[0.9] tracking-[-0.03em] mt-12 sm:mt-16 max-w-4xl"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(40px, 8vw, 120px)",
              }}
              data-testid="text-pricing-title"
            >
              Priced
              <br />
              upfront.
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-px mt-20 bg-black/15">
            {[
              {
                tag: "From",
                price: "$80",
                title: "Single item",
                sub: "IKEA shelf, small wardrobe, dining set, study desk.",
                items: [
                  "Tools + hardware included",
                  "Hauling within unit",
                  "Quote on the spot",
                ],
              },
              {
                tag: "Most picked",
                price: "$220",
                title: "Multi-item",
                sub: "3-piece bedroom, full living room, home office setup.",
                items: [
                  "2-man crew",
                  "Same-day completion",
                  "Photo handover",
                ],
                featured: true,
              },
              {
                tag: "Custom",
                price: "Quote",
                title: "Full relocation",
                sub: "HDB, condo, office moves with dismantle + reinstall.",
                items: [
                  "Site survey on request",
                  "Insurance up to $20k",
                  "Storage available",
                ],
              },
            ].map((p, i) => (
              <Reveal
                key={p.title}
                delay={i * 0.08}
                className={`p-6 sm:p-10 relative ${p.featured ? "bg-black text-white" : "bg-white"}`}
              >
                {p.featured && (
                  <div className="absolute -top-3 left-6">
                    <Pill>RECOMMENDED</Pill>
                  </div>
                )}
                <TinyLabel
                  className={p.featured ? "text-white/50" : "opacity-50"}
                >
                  {p.tag}
                </TinyLabel>
                <div
                  className="font-black mt-3 mb-2 leading-none"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "clamp(48px, 6vw, 84px)",
                  }}
                >
                  {p.price}
                </div>
                <h3
                  className="text-xl sm:text-2xl font-bold mb-3 tracking-tight"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {p.title}
                </h3>
                <p
                  className={`text-sm mb-6 leading-relaxed ${p.featured ? "text-white/60" : "text-black/60"}`}
                >
                  {p.sub}
                </p>
                <ul className="space-y-1.5 mb-8">
                  {p.items.map((it) => (
                    <li
                      key={it}
                      className={`text-sm flex items-center gap-2 ${p.featured ? "text-white/80" : "text-black/80"}`}
                    >
                      <span
                        className="w-1.5 h-1.5"
                        style={{ background: ACCENT }}
                      />
                      {it}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/estimate"
                  data-testid={`button-pricing-${p.title.replace(/\s+/g, "-").toLowerCase()}`}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold tracking-[0.2em] uppercase ${p.featured ? "bg-white text-black hover:opacity-90" : "bg-black text-white hover:bg-neutral-800"} transition-colors`}
                >
                  Get this quote →
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ TRUST ═══════════════════════ */}
      <section id="trust" className="relative py-24 sm:py-36 px-4 sm:px-8 bg-neutral-50">
        <div className="relative max-w-6xl mx-auto">
          <div className="absolute -top-3 left-0">
            <Pill testId="pill-section-trust">04 · TRUSTED</Pill>
          </div>

          <Reveal className="mt-12 sm:mt-16 grid md:grid-cols-2 gap-12 items-end">
            <h2
              className="font-black uppercase leading-[0.9] tracking-[-0.03em]"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(40px, 7vw, 96px)",
              }}
              data-testid="text-trust-title"
            >
              5,000<span style={{ color: ACCENT }}>+</span>
              <br />
              households.
            </h2>
            <div>
              <TinyLabel className="block opacity-60 mb-2">
                Aggregate rating
              </TinyLabel>
              <div className="flex items-baseline gap-3">
                <span
                  className="text-6xl font-black leading-none"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  4.9
                </span>
                <span className="text-xl">★★★★★</span>
              </div>
              <TinyLabel className="block mt-2 opacity-60">
                412 verified Google reviews
              </TinyLabel>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-px mt-20 bg-black/15">
            {[
              {
                q: "Booked at 9am, installed by 2pm. Crew was clean, careful, and finished faster than I expected.",
                a: "Mei Lin",
                p: "Tampines",
              },
              {
                q: "Wardrobe dismantle + reinstall across estates. Zero damage, exact quote, no surprises.",
                a: "Ravi K.",
                p: "Bishan",
              },
              {
                q: "Office of 18 desks moved over a weekend. They handled everything end to end.",
                a: "Operations Mgr",
                p: "CBD",
              },
            ].map((r, i) => (
              <Reveal
                key={r.a}
                delay={i * 0.06}
                className="bg-white p-6 sm:p-8"
              >
                <div className="text-2xl mb-4" style={{ color: ACCENT }}>
                  ★★★★★
                </div>
                <p className="text-sm text-black/80 leading-relaxed mb-6">
                  "{r.q}"
                </p>
                <div className="flex items-center justify-between">
                  <TinyLabel>
                    <span className="font-bold">{r.a}</span>
                    <span className="opacity-50"> · {r.p}</span>
                  </TinyLabel>
                  <TinyLabel className="opacity-40">VERIFIED</TinyLabel>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Logo strip */}
          <Reveal delay={0.2} className="mt-20">
            <TinyLabel className="block opacity-50 mb-6">
              Partners & estates served
            </TinyLabel>
            <div className="flex flex-wrap gap-2">
              {[
                "IKEA",
                "COURTS",
                "HARVEY NORMAN",
                "FORTYTWO",
                "HDB",
                "CONDO MGMT",
                "OFFICE FIT-OUTS",
                "AIRBNB HOSTS",
              ].map((b) => (
                <span
                  key={b}
                  className="inline-block px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] uppercase border border-black/15 text-black/70"
                >
                  {b}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════ FINAL CTA ═══════════════════════ */}
      <section className="relative py-32 sm:py-48 px-4 sm:px-8 overflow-hidden bg-white">

        <GhostType
          className="text-[22vw] -left-[2%] top-[10%]"
        >
          QUOTE
        </GhostType>
        <GhostType
          className="text-[22vw] -right-[4%] bottom-[5%]"
        >
          NOW
        </GhostType>

        <div className="relative max-w-4xl mx-auto text-center">
          <Reveal>
            <Pill testId="pill-section-cta">05 · YOUR MOVE</Pill>
          </Reveal>

          <Reveal delay={0.1}>
            <h2
              className="font-black uppercase leading-[0.85] tracking-[-0.04em] mt-8"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(56px, 11vw, 180px)",
              }}
              data-testid="text-final-cta"
            >
              Get your
              <br />
              <span style={{ background: ACCENT }} className="px-3">
                quote
              </span>
              <br />
              in 60s.
            </h2>
          </Reveal>

          <Reveal delay={0.25} className="mt-10 flex items-center justify-center gap-2 flex-wrap">
            <Link
              href="/estimate"
              data-testid="button-final-cta"
              onClick={() => trackEvent("paradiso_final_cta")}
              className="inline-flex items-center gap-2 px-6 py-4 text-xs font-bold tracking-[0.2em] uppercase text-black hover:opacity-90 transition-opacity"
              style={{ background: ACCENT }}
            >
              Start your quote →
            </Link>
            <a
              href="https://wa.me/6580880757"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="button-final-whatsapp"
              className="inline-flex items-center gap-2 px-6 py-4 text-xs font-bold tracking-[0.2em] uppercase text-white bg-black hover:bg-neutral-800 transition-colors"
            >
              WhatsApp us
            </a>
          </Reveal>

          <Reveal delay={0.4} className="mt-10">
            <TinyLabel className="opacity-50">
              Singapore-wide · Same-day available · Fully insured
            </TinyLabel>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer className="relative bg-black text-white py-12 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-3">
            <Pill>TMG INSTALL</Pill>
            <TinyLabel className="text-white/50">
              The Moving Guy Pte Ltd · Singapore · UEN 201912345A
            </TinyLabel>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href="/terms"
              data-testid="link-terms"
              className="px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] uppercase text-white/70 hover:text-white border border-white/20"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              data-testid="link-privacy"
              className="px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] uppercase text-white/70 hover:text-white border border-white/20"
            >
              Privacy
            </Link>
            <a
              href="https://wa.me/6580880757"
              data-testid="link-footer-whatsapp"
              className="px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] uppercase text-black"
              style={{ background: ACCENT }}
            >
              WhatsApp
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
