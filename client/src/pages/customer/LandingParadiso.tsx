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
   a distorted icosahedron with a matte black material — reads as a giant
   ink/brush mass that breathes and rotates as you scroll. */
function InkBlobMesh({ scrollY }: { scrollY: MotionValue<number> }) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const distortRef = useRef<any>(null);

  useFrame((state) => {
    const m = meshRef.current;
    if (!m) return;
    const t = state.clock.getElapsedTime();
    const s = scrollY.get(); // 0 → 1 over the page

    // Rotate continuously + react to scroll
    m.rotation.x = t * 0.18 + s * Math.PI * 1.4;
    m.rotation.y = t * 0.22 + s * Math.PI * 2.2;
    m.rotation.z = Math.sin(t * 0.3) * 0.15;

    // Drift across the viewport as scroll progresses (right → left)
    m.position.x = 0.6 - s * 1.4;
    m.position.y = -0.3 + Math.sin(t * 0.6) * 0.12 - s * 0.6;
    // Gentle scale pulse
    const k = 1 + Math.sin(t * 0.9) * 0.04 + s * 0.25;
    m.scale.set(k, k, k);

    // Distortion modulates with scroll for an organic ink-like feel
    if (distortRef.current) {
      distortRef.current.distort = 0.42 + Math.sin(t * 0.7) * 0.06 + s * 0.18;
    }
  });

  return (
    <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.6}>
      <mesh ref={meshRef} position={[0.6, -0.3, 0]} scale={1.6}>
        <icosahedronGeometry args={[1, 24]} />
        <MeshDistortMaterial
          ref={distortRef}
          color="#000000"
          roughness={0.55}
          metalness={0.1}
          distort={0.42}
          speed={1.6}
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
  const x = useTransform(scrollY, [0, 1], ["10vw", "-30vw"]);
  const y = useTransform(scrollY, [0, 1], ["-5vh", "-40vh"]);
  const rotate = useTransform(scrollY, [0, 1], [0, 220]);
  const scale = useTransform(scrollY, [0, 1], [1, 1.4]);
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 1 }}
      data-testid="ink-blob-css"
    >
      <motion.div
        style={{
          x,
          y,
          rotate,
          scale,
          position: "absolute",
          left: "30%",
          top: "30%",
          width: "60vw",
          height: "60vw",
          background:
            "radial-gradient(closest-side, rgba(0,0,0,0.16), rgba(0,0,0,0.08) 45%, rgba(0,0,0,0) 70%)",
          filter: "blur(8px)",
          borderRadius: "50% 38% 62% 44% / 48% 56% 40% 52%",
          animation: "blobMorph 16s ease-in-out infinite",
        }}
      />
    </div>
  );
}

/* Full-bleed Canvas wrapper — fixed behind the hero, low z-index, low
   opacity so the brush wordmark stays the protagonist. Falls back to CSS
   when WebGL is unavailable. */
function InkBlob3D({ scrollY }: { scrollY: MotionValue<number> }) {
  const hasWebGL = useHasWebGL();

  if (!hasWebGL) return <InkBlobCSS scrollY={scrollY} />;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1, opacity: 0.22 }}
      data-testid="ink-blob-3d"
    >
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 45 }}
        gl={{ antialias: true, alpha: true, failIfMajorPerformanceCaveat: false }}
        dpr={[1, 1.6]}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1.1} />
        <directionalLight position={[-5, -3, 2]} intensity={0.4} color="#888" />
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

  // Parallax transforms — scattered fragments and ghosts move at different
  // speeds as you scroll, so the layout feels alive (paradiso effect).
  const yEthos = useTransform(smoothScroll, [0, 1], [0, -180]);
  const yFeeling = useTransform(smoothScroll, [0, 1], [0, -260]);
  const yCraft = useTransform(smoothScroll, [0, 1], [0, -120]);
  const yPromise = useTransform(smoothScroll, [0, 1], [0, -340]);
  const yGhostL = useTransform(smoothScroll, [0, 1], [0, -420]);
  const yGhostR = useTransform(smoothScroll, [0, 1], [0, -500]);
  const xBleed = useTransform(smoothScroll, [0, 1], ["0%", "-55%"]);
  const yWordmark = useTransform(smoothScroll, [0, 0.5], [0, -120]);
  const opacityWordmark = useTransform(smoothScroll, [0, 0.35], [1, 0.15]);

  return (
    <div
      ref={pageRef}
      className="bg-white text-black min-h-screen overflow-x-hidden relative"
      style={{ fontFamily: "var(--font-body)" }}
      data-testid="page-paradiso"
    >
      {/* Fixed 3D ink blob behind everything — drifts + rotates with scroll */}
      <InkBlob3D scrollY={smoothScroll} />
      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="relative min-h-[100svh] w-full overflow-hidden">
        <GridMarks />

        {/* TOP-LEFT — dark patron/credit badge (paradiso style) */}
        <div className="absolute left-0 top-0 z-20 max-w-[80vw] sm:max-w-[28rem]">
          <div
            className="bg-black text-white px-3 py-2 text-[10px] sm:text-[11px] leading-snug"
            style={{ fontFamily: "var(--font-body)" }}
            data-testid="credit-badge"
          >
            <strong className="font-bold">TMG Install</strong> — Singapore
            furniture installation, dismantling &amp; relocation.
            <br />
            Trusted by{" "}
            <span className="text-[color:var(--accent)] font-bold" style={{ color: ACCENT }}>
              5,000+ households
            </span>{" "}
            since 2018.
          </div>
        </div>

        {/* TOP-RIGHT — live counter (lowercase paradiso style) */}
        <div className="absolute right-3 sm:right-5 top-3 sm:top-5 z-20">
          <div className="flex items-start gap-2" data-testid="live-counter">
            <div
              className="px-2 py-1.5 text-black"
              style={{ background: ACCENT, minWidth: 44 }}
            >
              <div
                className="text-[10px] leading-tight font-medium lowercase"
                style={{ fontFamily: "var(--font-body)" }}
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
                style={{ fontFamily: "var(--font-body)" }}
              >
                <LiveTotal />
              </div>
            </div>
          </div>
        </div>

        {/* SCATTERED ITALIC FRAGMENTS (paradiso "An ethos…") — parallax-scrolled */}
        <motion.div
          style={{ y: yEthos }}
          className="absolute left-[18%] top-[8%] z-10 hidden sm:block"
        >
          <p
            className="text-[11px] leading-snug max-w-[10ch] text-black/70"
            style={{ fontFamily: "var(--font-body)" }}
          >
            An ethos<span className="opacity-50">…</span>
          </p>
        </motion.div>
        <motion.div
          style={{ y: yFeeling }}
          className="absolute right-[14%] top-[16%] z-10 hidden sm:block text-right"
        >
          <p
            className="text-[11px] leading-snug max-w-[12ch] text-black/70"
            style={{ fontFamily: "var(--font-body)" }}
          >
            A feeling<span className="opacity-50">…</span>
          </p>
        </motion.div>
        <motion.div
          style={{ y: yCraft }}
          className="absolute left-[8%] bottom-[24%] z-10 hidden md:block"
        >
          <p
            className="text-[11px] leading-snug max-w-[16ch] text-black/70"
            style={{ fontFamily: "var(--font-body)" }}
          >
            A craft.
          </p>
        </motion.div>
        <motion.div
          style={{ y: yPromise }}
          className="absolute right-[10%] bottom-[20%] z-10 hidden md:block text-right"
        >
          <p
            className="text-[11px] leading-snug max-w-[16ch] text-black/70"
            style={{ fontFamily: "var(--font-body)" }}
          >
            A promise.
          </p>
        </motion.div>

        {/* ASYMMETRIC SCATTERED PILLS (no symmetric corner grid) */}
        <div className="absolute left-[14%] top-[14%] z-10">
          <Pill testId="pill-installers">INSTALLERS</Pill>
        </div>
        <div className="absolute left-[8%] top-[40%] z-10 hidden sm:block">
          <Pill testId="pill-team">FOUNDING TEAM</Pill>
        </div>
        <div className="absolute right-[20%] top-[34%] z-10 hidden sm:block">
          <BlackPill testId="pill-book" href="/estimate">
            BOOK NOW!
          </BlackPill>
        </div>
        <div className="absolute right-[6%] bottom-[6%] z-10 flex flex-col items-end gap-1">
          <Pill testId="pill-membership" href="#trust">
            MEMBERSHIP
          </Pill>
          <Pill testId="pill-governance" href="/terms">
            GOVERNANCE
          </Pill>
        </div>

        {/* GHOST BRUSH WORDMARKS — translate vertically with scroll */}
        <motion.div
          aria-hidden="true"
          style={{ y: yGhostL }}
          className="absolute -left-[4%] top-[18%] z-[2] pointer-events-none select-none"
        >
          <span
            className="block uppercase leading-[0.85] whitespace-nowrap"
            style={{
              fontFamily: BRUSH,
              fontSize: "28vw",
              color: "rgba(0,0,0,0.05)",
            }}
          >
            BUILD
          </span>
        </motion.div>
        <motion.div
          aria-hidden="true"
          style={{ y: yGhostR }}
          className="absolute -right-[6%] top-[22%] z-[2] pointer-events-none select-none"
        >
          <span
            className="block uppercase leading-[0.85] whitespace-nowrap"
            style={{
              fontFamily: BRUSH,
              fontSize: "28vw",
              color: "rgba(0,0,0,0.05)",
            }}
          >
            MOVE
          </span>
        </motion.div>

        {/* CENTER — BIG BRUSH WORDMARK + letterspaced subtitle (scroll fades + lifts) */}
        <motion.div
          style={{ y: yWordmark, opacity: opacityWordmark }}
          className="relative z-[5] flex flex-col items-center justify-center min-h-[100svh] px-6"
        >
          <Reveal delay={0.05}>
            <h1
              className="text-center text-black leading-[0.9]"
              style={{
                fontFamily: BRUSH,
                fontWeight: 400,
                fontSize: "clamp(96px, 22vw, 360px)",
                letterSpacing: "-0.01em",
              }}
              data-testid="hero-title"
            >
              tmg
            </h1>
          </Reveal>

          <Reveal delay={0.18}>
            <div
              className="text-center text-black mt-2 sm:mt-4"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: "clamp(14px, 1.6vw, 22px)",
                letterSpacing: "0.5em",
                paddingLeft: "0.5em",
              }}
              data-testid="hero-subtitle"
            >
              I N S T A L L E R S
            </div>
          </Reveal>
        </motion.div>

        {/* BOTTOM TYPOGRAPHIC BLEED — huge faded line that slides horizontally on scroll */}
        <div
          aria-hidden="true"
          className="absolute left-0 right-0 bottom-0 pointer-events-none select-none overflow-hidden"
        >
          <motion.div
            style={{ x: xBleed }}
            className="whitespace-nowrap"
          >
            <span
              className="inline-block"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "clamp(56px, 12vw, 200px)",
                lineHeight: 0.9,
                letterSpacing: "-0.02em",
                color: "rgba(0,0,0,0.06)",
                textTransform: "uppercase",
                transform: "translateY(28%)",
                paddingLeft: "5vw",
                paddingRight: "5vw",
              }}
            >
              Before the delivery, before the install, before the home —
              precision. Before the delivery, before the install —
            </span>
          </motion.div>
        </div>
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
        <GridMarks />
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
        <GridMarks />
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
        <GridMarks />
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
        <GridMarks />

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
