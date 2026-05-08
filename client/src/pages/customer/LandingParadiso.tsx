import { Link } from "wouter";
import { useState, useEffect, useRef, Suspense } from "react";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  type MotionValue,
} from "framer-motion";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Float } from "@react-three/drei";
import * as THREE from "three";
import { usePageTracker, trackEvent } from "@/hooks/use-tracker";
import { useSEO } from "@/hooks/use-seo";
import tmgLogo from "@assets/generated_images/tmg_icon_1024.png";
import workWardrobeWood from "@assets/01a8aed4-9419-48c0-8d66-5586d2d67599_1774688688302.jpeg";
import workWardrobeWhite from "@assets/62426ebb-051a-4898-809d-94840e3259db_1774688688302.jpeg";
import workBedroomMassageChair from "@assets/76026a64-d9a1-4b57-9482-557bbaf4addd_1777034083394.jpeg";
import workOfficeFitout from "@assets/36116e50-6291-442a-86cb-0ddc9540b6bc_1774689529777.jpeg";
import workConferenceTable from "@assets/6219e4af-4150-47a9-8625-09448ff10459_1774689529777.jpeg";

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

/* ─── Smoothed mouse position hook — used for paradiso-style parallax on
       the ghost wordmarks and as the source of truth for the custom
       cursor dot. Returns motion values in [-1, 1] range (centre = 0). ─ */
function useMouseParallax() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 60, damping: 18, mass: 0.5 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onMove(e: MouseEvent) {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      mx.set((e.clientX / w) * 2 - 1); // -1 .. 1
      my.set((e.clientY / h) * 2 - 1);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my]);

  return { mx: sx, my: sy };
}

/* ─── CustomCursor — small green dot that follows the mouse, plus a
       hollow ring that lags slightly behind. Hidden on touch devices.
       Paradiso uses a similar live cursor as part of the brand voice. ─ */
function CustomCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 180, damping: 22, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 180, damping: 22, mass: 0.6 });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip on touch / coarse pointers.
    const mq = window.matchMedia("(pointer: fine)");
    if (!mq.matches) return;
    setEnabled(true);

    function onMove(e: MouseEvent) {
      x.set(e.clientX);
      y.set(e.clientY);
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [x, y]);

  if (!enabled) return null;

  return (
    <>
      {/* Hollow ring lagging slightly */}
      <motion.div
        aria-hidden="true"
        className="fixed top-0 left-0 z-[80] pointer-events-none mix-blend-difference"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
          width: 28,
          height: 28,
          border: "1px solid white",
          borderRadius: 9999,
        }}
      />
      {/* Solid green dot at the exact pointer */}
      <motion.div
        aria-hidden="true"
        className="fixed top-0 left-0 z-[81] pointer-events-none"
        style={{
          x,
          y,
          translateX: "-50%",
          translateY: "-50%",
          width: 8,
          height: 8,
          background: ACCENT,
          borderRadius: 9999,
        }}
      />
    </>
  );
}

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
    "inline-block px-2.5 py-1 text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase text-black leading-none whitespace-nowrap transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.04]";
  const style = { background: ACCENT };
  const cls = `${base} ${className}`;
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
    "inline-block px-2.5 py-1 text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase text-white leading-none whitespace-nowrap bg-black transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.04]";
  const cls = `${base} ${className}`;
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

/* ─── EdgePill — paradiso's signature label: a green chip welded to a
     black extension bar that runs out to the screen edge. The bar gives
     the page its "framing-tape" rhythm and is the single biggest visual
     difference between paradiso and a generic floating-pill landing.
     `side="left"` puts the pill on the left and the black bar on the
     right of it (extending toward centre). `side="right"` mirrors. ─── */
function EdgePill({
  children,
  href,
  side,
  bar = "12vw",
  testId,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  side: "left" | "right";
  bar?: string; // CSS length for the black extension bar
  testId?: string;
  className?: string;
}) {
  const pillBase =
    "inline-flex items-center px-2.5 py-1 text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase text-black leading-none whitespace-nowrap";
  const pillStyle: React.CSSProperties = { background: ACCENT };
  const blackBar = (
    <span
      aria-hidden="true"
      className="block bg-black self-stretch"
      style={{ width: bar, height: "100%" }}
    />
  );
  const inner =
    side === "left" ? (
      <>
        <span className={pillBase} style={pillStyle}>
          {children}
        </span>
        {blackBar}
      </>
    ) : (
      <>
        {blackBar}
        <span className={pillBase} style={pillStyle}>
          {children}
        </span>
      </>
    );
  const wrapCls = `inline-flex items-stretch h-[22px] sm:h-[24px] transition-transform duration-200 ease-out hover:-translate-y-0.5 ${className}`;
  if (href) {
    if (isInternalRoute(href)) {
      return (
        <Link href={href} data-testid={testId} className={wrapCls}>
          {inner}
        </Link>
      );
    }
    return (
      <a
        href={href}
        data-testid={testId}
        className={wrapCls}
        {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {inner}
      </a>
    );
  }
  return (
    <span data-testid={testId} className={wrapCls}>
      {inner}
    </span>
  );
}

/* ─── WorkCard — editorial photo card used in the "Recent work" gallery.
     Image fills the cell at a deliberate aspect-ratio. A small tabular
     caption sits underneath. The whole card is a link to the estimate
     wizard so any photo doubles as a CTA. ─── */

function WorkCard({
  src,
  alt,
  location,
  items,
  date,
  className = "",
  testId,
  tag,
  tagAccent = false,
}: {
  src: string;
  alt: string;
  location: string;
  items: string;
  date: string;
  className?: string;
  testId?: string;
  tag?: string;
  tagAccent?: boolean;
}) {
  return (
    <Link
      href="/estimate"
      data-testid={testId}
      className={`group relative block overflow-hidden bg-neutral-100 ${className}`}
    >
      {/* The photo */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.04]"
      />

      {/* Top-left tag pill */}
      {tag && (
        <span
          className={`absolute left-3 top-3 z-10 inline-block px-2 py-1 text-[10px] font-bold tracking-[0.18em] uppercase leading-none ${
            tagAccent ? "text-black" : "bg-white text-black"
          }`}
          style={tagAccent ? { background: ACCENT } : undefined}
        >
          {tag}
        </span>
      )}

      {/* Bottom caption strip — paradiso editorial caption */}
      <div
        className="absolute left-0 right-0 bottom-0 z-10 px-3 pt-8 pb-2.5 bg-gradient-to-t from-black/95 via-black/75 to-transparent"
        style={{ fontFamily: "var(--font-paradiso)" }}
      >
        <div
          className="flex items-baseline justify-between gap-3 text-white text-[10px] uppercase tracking-[0.2em]"
        >
          <span
            className="font-semibold truncate"
            dangerouslySetInnerHTML={{ __html: location }}
          />
          <span className="tabular-nums opacity-80 shrink-0">{date}</span>
        </div>
        <div
          className="mt-0.5 text-white/85 text-[10px] tracking-[0.14em] uppercase truncate"
          dangerouslySetInnerHTML={{ __html: items }}
        />
      </div>

      {/* Hover-only "Get a quote ->" pill bottom-right */}
      <span
        className="absolute right-3 bottom-3 z-20 inline-block px-2 py-1 text-[10px] font-bold tracking-[0.18em] uppercase leading-none text-black opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
        style={{ background: ACCENT }}
        aria-hidden="true"
      >
        Get a quote &nbsp;&rarr;
      </span>
    </Link>
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

  // Paradiso has nothing in this slot when 3D fails; render nothing rather
  // than show an ugly grey CSS blob fallback.
  if (!hasWebGL || crashed) return null;

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

  // Mouse-parallax — used for the ghost wordmark mirrors and the
  // scattered text fragments. Source values are in [-1, 1].
  const { mx, my } = useMouseParallax();
  // Ghost mirrors drift opposite to the cursor — strong, paradiso-sized.
  const ghostLX = useTransform(mx, [-1, 1], [60, -60]);
  const ghostLY = useTransform(my, [-1, 1], [30, -30]);
  const ghostRX = useTransform(mx, [-1, 1], [-60, 60]);
  const ghostRY = useTransform(my, [-1, 1], [30, -30]);
  // Wordmark drifts with the cursor — much smaller, just "alive".
  const wordX = useTransform(mx, [-1, 1], [-12, 12]);
  const wordY = useTransform(my, [-1, 1], [-8, 8]);
  // Tiny editorial fragments — slowest parallax layer.
  const fragX = useTransform(mx, [-1, 1], [-6, 6]);
  const fragY = useTransform(my, [-1, 1], [-4, 4]);

  return (
    <div
      ref={pageRef}
      className="bg-white text-black min-h-screen overflow-x-hidden relative paradiso-cursor"
      style={{ fontFamily: "var(--font-paradiso-body)" }}
      data-testid="page-paradiso"
    >
      {/* Custom cursor (paradiso-style green dot + lagging ring). Skipped
          on touch / coarse pointers automatically. */}
      <CustomCursor />

      {/* Single global registration-mark canvas — fixed behind every
          section so the marks read as one continuous "paper grain" instead
          of restarting at each section. */}
      <div className="fixed inset-0 z-[0] pointer-events-none">
        <GridMarks />
      </div>

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[100svh] w-full overflow-hidden border-b border-black/10 bg-white">

        {/* ─── Tiny 3D accent anchored bottom-right of hero — paradiso uses
             a small "PLAY!" media chip there. We keep the user's required
             3D motion as a small, breathing wireframe wardrobe-mass that
             never overlaps the wordmark. ─── */}
        <div
          aria-hidden="true"
          className="absolute right-5 sm:right-10 top-[58%] sm:top-[60%] z-10 hidden xl:block pointer-events-none"
          style={{ width: 180, height: 180, opacity: 0.9 }}
          data-testid="hero-3d-accent"
        >
          <InkBlob3D scrollY={smoothScroll} />
        </div>

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

        {/* ─── TOP-RIGHT — paradiso's two tiny stacked counter pills.
             Each is a small green square holding two short lines of text
             ("1 is / here", "8472 were / here"). Much more compact than
             a normal pill — almost like type-set chips. ─── */}
        <div className="absolute right-3 sm:right-5 top-3 sm:top-4 z-30">
          <div className="flex items-start gap-1" data-testid="live-counter">
            <div
              className="px-1.5 py-1 text-black"
              style={{ background: ACCENT, minWidth: 36 }}
            >
              <div
                className="text-[10px] leading-[1.05] font-semibold lowercase"
                style={{ fontFamily: "var(--font-paradiso)" }}
              >
                <LiveNow />
              </div>
            </div>
            <div
              className="px-1.5 py-1 text-black"
              style={{ background: ACCENT, minWidth: 36 }}
            >
              <div
                className="text-[10px] leading-[1.05] font-semibold lowercase"
                style={{ fontFamily: "var(--font-paradiso)" }}
              >
                <LiveTotal />
              </div>
            </div>
          </div>
        </div>

        {/* ─── HUGE PALE GHOST BACKGROUND WORD — paradiso has a giant
             low-contrast "BE CRUDO" type bleeding across the upper half of
             the hero, behind everything. Reads as "atmosphere", not
             "label". We mirror that with "INSTALL" set in the brush face,
             stretched to full viewport width and parked behind the wordmark. ─── */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-[18%] z-[5] pointer-events-none select-none overflow-hidden hidden md:block"
          data-testid="hero-ghost-word"
        >
          <div
            className="text-center"
            style={{
              fontFamily: BRUSH,
              fontSize: "clamp(180px, 21vw, 380px)",
              lineHeight: 0.85,
              letterSpacing: "-0.04em",
              color: "rgba(0,0,0,0.045)",
              whiteSpace: "nowrap",
              transform: "scaleX(1.18)",
              transformOrigin: "center",
            }}
          >
            install
          </div>
        </div>

        {/* ─── EDGE-ANCHORED ACCENT PILLS — paradiso's signature: green
             chips welded to black extension bars that reach toward the
             centre. Anchored to the screen edges at deliberate vertical
             rhythms. Each pill jumps to a real section anchor. ─── */}
        <div className="absolute left-0 top-[13%] z-20 hidden sm:block">
          <EdgePill href="#services" side="left" bar="9vw" testId="pill-services">
            Services
          </EdgePill>
        </div>
        <div className="absolute left-0 top-[24%] z-20 hidden md:block">
          <EdgePill href="#how" side="left" bar="14vw" testId="pill-process">
            The process
          </EdgePill>
        </div>
        <div className="absolute right-0 top-[36%] z-20 hidden sm:block">
          <EdgePill href="#pricing" side="right" bar="11vw" testId="pill-pricing">
            Fixed pricing
          </EdgePill>
        </div>
        <div className="absolute left-0 top-[58%] z-20 hidden md:block">
          <EdgePill href="#trust" side="left" bar="10vw" testId="pill-trust">
            5,000+ jobs
          </EdgePill>
        </div>
        <div className="absolute right-0 top-[72%] z-20 hidden md:block">
          <EdgePill href="#trust" side="right" bar="13vw" testId="pill-insured">
            Fully insured
          </EdgePill>
        </div>

        {/* ─── TINY EDITORIAL TEXT FRAGMENTS — paradiso scatters ultra-short
             prose like "An ethos…", "A feeling…" at the corners. Each
             fragment drifts gently with the cursor (slowest parallax). ─── */}
        <motion.div
          className="absolute left-[28%] top-[14%] z-20 hidden lg:block max-w-[8rem] text-[11px] leading-[1.35] text-black/85"
          style={{ fontFamily: "var(--font-paradiso)", x: fragX, y: fragY }}
          data-testid="fragment-1"
        >
          A studio,
          <br />
          not a marketplace.
        </motion.div>
        <motion.div
          className="absolute right-[28%] top-[18%] z-20 hidden lg:block max-w-[8rem] text-[11px] leading-[1.35] text-black/85 text-right"
          style={{ fontFamily: "var(--font-paradiso)", x: fragX, y: fragY }}
          data-testid="fragment-2"
        >
          A craft,
          <br />
          not a side-hustle.
        </motion.div>
        <motion.div
          className="absolute left-[36%] bottom-[22%] z-20 hidden lg:block max-w-[10rem] text-[11px] leading-[1.35] text-black/85"
          style={{ fontFamily: "var(--font-paradiso)", x: fragX, y: fragY }}
          data-testid="fragment-3"
        >
          An installation,
          <br />
          not a delivery drop-off.
        </motion.div>

        {/* ─── CENTRAL BRUSH WORDMARK — the protagonist of the page.
             Pale ghost duplicates float on either side. The 3D ink mass
             behind it (z-4) reads as the brush's own ink rolling and
             breathing. The wordmark itself sits at z-10 to stay legible. ─── */}
        <motion.div
          style={{ y: yWordmark, opacity: opacityWordmark }}
          className="absolute inset-0 z-[25] flex flex-col items-center justify-center pointer-events-none px-6"
          data-testid="hero-wordmark"
        >
          {/* Ghost mirror — left, mouse-parallaxed */}
          <motion.span
            aria-hidden="true"
            className="absolute left-[-6%] top-[28%] hidden md:block select-none"
            style={{
              fontFamily: BRUSH,
              fontSize: "clamp(180px, 22vw, 360px)",
              color: "rgba(0,0,0,0.05)",
              lineHeight: 0.9,
              rotate: -4,
              x: ghostLX,
              y: ghostLY,
            }}
          >
            tmg
          </motion.span>
          {/* Ghost mirror — right, mouse-parallaxed (opposite axis) */}
          <motion.span
            aria-hidden="true"
            className="absolute right-[-6%] top-[28%] hidden md:block select-none"
            style={{
              fontFamily: BRUSH,
              fontSize: "clamp(180px, 22vw, 360px)",
              color: "rgba(0,0,0,0.05)",
              lineHeight: 0.9,
              rotate: 4,
              scaleX: -1,
              x: ghostRX,
              y: ghostRY,
            }}
          >
            tmg
          </motion.span>

          {/* Main brush wordmark — draws in on load, drifts subtly with cursor */}
          <motion.h1
            className="text-black select-none m-0"
            initial={{ opacity: 0, scale: 0.86, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{
              duration: 1.1,
              delay: 0.15,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              fontFamily: BRUSH,
              fontSize: "clamp(140px, 26vw, 460px)",
              lineHeight: 0.85,
              letterSpacing: "-0.02em",
              x: wordX,
              y: wordY,
            }}
            data-testid="hero-title"
          >
            tmg
          </motion.h1>

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

        {/* ─── BOTTOM-LEFT — small "live job" film-still card. Mirrors
             paradiso's LIVE 14:25 — Barcelona film thumbnail, but uses a
             real TMG install photo + LIVE / duration pills. ─── */}
        <div
          className="absolute left-3 sm:left-5 bottom-3 sm:bottom-5 z-30 w-[180px] sm:w-[230px]"
          data-testid="live-job"
        >
          {/* Tiny pill row sitting on top of the photo */}
          <div className="flex items-stretch mb-1">
            <div
              className="px-2 py-1 text-[10px] tracking-[0.22em] uppercase font-semibold text-black"
              style={{ background: ACCENT, fontFamily: "var(--font-paradiso)" }}
            >
              Live
            </div>
            <div className="flex-1" />
            <div
              className="px-2 py-1 text-[10px] tracking-[0.22em] uppercase text-black bg-white border border-black/15 tabular-nums"
              style={{ fontFamily: "var(--font-paradiso)" }}
            >
              14:25
            </div>
          </div>
          {/* Real install photo */}
          <div className="relative w-full aspect-[4/3] bg-neutral-100 overflow-hidden border border-black/10">
            <img
              src={workConferenceTable}
              alt="TMG technician on a live install"
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          {/* Caption strip below the photo, paradiso style */}
          <div
            className="mt-1 bg-black text-white px-2 py-1 text-[10px] uppercase tracking-[0.22em] truncate"
            style={{ fontFamily: "var(--font-paradiso)" }}
          >
            <span className="text-white/60">Now &mdash;</span>{" "}
            <span className="text-white">Tanjong Pagar</span>
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

      {/* ═══════════════════════ RECENT WORK ═══════════════════════
           Real photos from real jobs — paradiso-style asymmetric grid
           with a small editorial caption under each image. No stock,
           no marketing renders. ─── */}
      <section
        id="work"
        className="relative py-24 sm:py-32 px-4 sm:px-8 bg-white overflow-hidden"
        data-testid="section-work"
      >
        <div className="relative max-w-6xl mx-auto">
          {/* Section eyebrow pill */}
          <div className="absolute -top-3 left-0">
            <span
              className="inline-block px-2.5 py-1 text-[10px] sm:text-[11px] font-bold tracking-[0.18em] uppercase text-black leading-none"
              style={{ background: ACCENT }}
            >
              N&ordm; 02 &middot; Recent work
            </span>
          </div>

          {/* Huge faded ghost type behind the headline */}
          <span
            aria-hidden="true"
            className="absolute right-[-4%] top-[8%] hidden md:block uppercase font-black select-none whitespace-nowrap"
            style={{
              fontFamily: "var(--font-paradiso)",
              fontSize: "16vw",
              color: "rgba(0,0,0,0.04)",
              letterSpacing: "-0.04em",
              lineHeight: 0.85,
            }}
          >
            On site.
          </span>

          {/* Section headline + lede — brush font, lowercase, paradiso */}
          <Reveal>
            <h2
              className="relative font-black leading-[0.85] tracking-[-0.02em] mt-12 sm:mt-16 max-w-3xl text-black lowercase"
              style={{
                fontFamily: BRUSH,
                fontSize: "clamp(56px, 10vw, 150px)",
              }}
              data-testid="text-work-title"
            >
              the job,
              <br />
              <span style={{ background: ACCENT }} className="px-3">
                photographed.
              </span>
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <p
              className="mt-6 max-w-xl text-[14px] sm:text-[15px] leading-[1.55] text-black/70"
              style={{ fontFamily: "var(--font-paradiso-body)" }}
              data-testid="text-work-lede"
            >
              Every install is documented. These are real homes, real offices,
              real teams &mdash; assembled, dismantled and shifted across
              Singapore by our own crew. Tap any frame to start a quote.
            </p>
          </Reveal>

          {/* Asymmetric editorial photo grid.
              Mobile: simple stack. Desktop: 12-col layout where the
              "tall" hero image takes 5 cols and 2 rows; the rest fill
              4-col cells in a magazine rhythm. */}
          <div className="mt-12 sm:mt-16 grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5">
            {/* HERO IMAGE — tall, left, 2 rows on desktop */}
            <WorkCard
              src={workBedroomMassageChair}
              alt="Bedroom installation with massage chair, Singapore HDB"
              location="Bishan, HDB &mdash; bedroom"
              items="King bed &middot; massage chair"
              date="Mar 2026"
              testId="work-1"
              className="md:col-span-5 md:row-span-2 aspect-[3/4]"
              tag="Featured"
              tagAccent
            />

            <WorkCard
              src={workOfficeFitout}
              alt="Office fit-out with cubicle desks and overhead cabinets"
              location="CBD &mdash; office"
              items="14&times; cubicle desks &middot; overhead units"
              date="Feb 2026"
              testId="work-2"
              className="md:col-span-7 aspect-[16/10]"
              tag="Office fit-out"
            />

            <WorkCard
              src={workConferenceTable}
              alt="TMG technician installing a modular conference table"
              location="Tanjong Pagar &mdash; meeting room"
              items="Modular conference table"
              date="Feb 2026"
              testId="work-3"
              className="md:col-span-4 aspect-[4/5]"
              tag="On the tools"
            />

            <WorkCard
              src={workWardrobeWood}
              alt="Two-door oak wardrobe with drawers, installed in HDB bedroom"
              location="Sengkang &mdash; bedroom"
              items="2-door wardrobe &middot; drawer base"
              date="Jan 2026"
              testId="work-4"
              className="md:col-span-3 aspect-[4/5]"
              tag="Wardrobes"
            />

            <WorkCard
              src={workWardrobeWhite}
              alt="Tall white three-door wardrobe with three-drawer base"
              location="Punggol &mdash; kid's room"
              items="3-door wardrobe &middot; 3-drawer base"
              date="Jan 2026"
              testId="work-5"
              className="md:col-span-7 aspect-[16/10]"
              tag="Wardrobes"
            />
          </div>

          {/* Tabular caption strip below the grid — paradiso loves these */}
          <div
            className="mt-10 sm:mt-12 grid grid-cols-2 md:grid-cols-4 border-t border-black/15 text-[10px] uppercase tracking-[0.22em] text-black/70"
            style={{ fontFamily: "var(--font-paradiso)" }}
            data-testid="work-tabular"
          >
            {[
              ["Jobs delivered", "5,000+"],
              ["Damage rate", "&lt; 0.4%"],
              ["On-time rate", "98.6%"],
              ["Photos archived", "37,000+"],
            ].map(([k, v], i) => (
              <div
                key={k}
                className={`flex flex-col gap-1 px-3 py-4 border-b border-black/15 ${i > 0 ? "md:border-l border-black/10" : ""} ${i === 1 ? "border-l border-black/10" : ""} ${i === 3 ? "border-l border-black/10 md:border-l" : ""}`}
              >
                <span className="text-black/45">{k}</span>
                <span
                  className="text-black font-semibold tracking-[0.14em] text-[13px] sm:text-[15px] normal-case"
                  dangerouslySetInnerHTML={{ __html: v }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ SERVICES ═══════════════════════ */}
      <section id="services" className="relative py-24 sm:py-36 px-4 sm:px-8">
        <div className="relative max-w-6xl mx-auto">
          {/* Section eyebrow as paradiso pill in top-left of section */}
          <div className="absolute -top-3 left-0">
            <Pill testId="pill-section-services">01 · SERVICES</Pill>
          </div>

          {/* Huge ghost brush type behind the headline */}
          <GhostType
            brush
            className="left-[-3%] top-[5%] hidden md:block"
            style={{ fontSize: "20vw", color: "rgba(0,0,0,0.05)" }}
          >
            handle
          </GhostType>

          <Reveal>
            <h2
              className="relative font-black leading-[0.85] tracking-[-0.02em] mt-12 sm:mt-16 max-w-4xl text-black lowercase"
              style={{
                fontFamily: BRUSH,
                fontSize: "clamp(56px, 10vw, 160px)",
              }}
              data-testid="text-services-title"
            >
              what we
              <br />
              <span style={{ background: ACCENT }} className="px-3">
                handle.
              </span>
            </h2>
          </Reveal>

          {/* Tiny editorial fragment off to the right */}
          <div
            className="hidden lg:block absolute right-0 top-24 max-w-[12rem] text-[11px] leading-[1.4] text-black/70"
            style={{ fontFamily: "var(--font-paradiso)" }}
          >
            Six categories.
            <br />
            One uniformed crew.
            <br />
            Same-day completion.
          </div>

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
              className="relative font-black leading-[0.85] tracking-[-0.02em] mt-12 sm:mt-16 max-w-4xl lowercase"
              style={{
                fontFamily: BRUSH,
                fontSize: "clamp(56px, 10vw, 160px)",
              }}
              data-testid="text-how-title"
            >
              three
              <br />
              steps. <span style={{ color: ACCENT }}>one day.</span>
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

          {/* Huge ghost brush type behind the headline */}
          <GhostType
            brush
            className="right-[-2%] top-[8%] hidden md:block"
            style={{ fontSize: "20vw", color: "rgba(0,0,0,0.05)" }}
          >
            upfront
          </GhostType>

          <Reveal>
            <h2
              className="relative font-black leading-[0.85] tracking-[-0.02em] mt-12 sm:mt-16 max-w-4xl text-black lowercase"
              style={{
                fontFamily: BRUSH,
                fontSize: "clamp(56px, 10vw, 160px)",
              }}
              data-testid="text-pricing-title"
            >
              priced
              <br />
              <span style={{ background: ACCENT }} className="px-3">
                upfront.
              </span>
            </h2>
          </Reveal>

          {/* Tiny editorial fragment under the headline */}
          <p
            className="mt-6 max-w-md text-[12px] sm:text-[13px] leading-[1.5] text-black/70"
            style={{ fontFamily: "var(--font-paradiso)" }}
          >
            What you see is what you pay. No site visit, no haggling, no
            surprise add-ons after the truck arrives.
          </p>

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

          {/* Huge ghost brush type behind */}
          <GhostType
            brush
            className="left-[-3%] top-[5%] hidden md:block"
            style={{ fontSize: "20vw", color: "rgba(0,0,0,0.05)" }}
          >
            trusted
          </GhostType>

          <Reveal className="relative mt-12 sm:mt-16 grid md:grid-cols-2 gap-12 items-end">
            <h2
              className="font-black leading-[0.85] tracking-[-0.02em] lowercase"
              style={{
                fontFamily: BRUSH,
                fontSize: "clamp(48px, 9vw, 140px)",
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
              className="font-black leading-[0.82] tracking-[-0.02em] mt-8 lowercase"
              style={{
                fontFamily: BRUSH,
                fontSize: "clamp(72px, 14vw, 240px)",
              }}
              data-testid="text-final-cta"
            >
              get your
              <br />
              <span style={{ background: ACCENT }} className="px-4">
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
