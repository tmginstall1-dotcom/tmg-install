import { useEffect, useRef } from "react";

/* ─────────────────────── FloatingScrollCloud ───────────────────────────────
   A small CSS-3D decoration that floats across the viewport as the user
   scrolls — mimicking a slow cloud drifting left↔right.

   Why CSS 3D (not WebGL):
   - Truly 3D (perspective + transform3d + rotateY/X), but GPU-composited and
     mobile-safe. No WebGL battery drain, no Three.js bundle cost.
   - Matches the existing EditorialPaperStack approach already used on the
     QuoteStatus page, so the editorial system stays consistent.

   How it moves:
   - Pinned to the viewport (position: fixed) so it "follows" the page as the
     user scrolls.
   - X position oscillates between left and right edge using a sine wave
     driven by window.scrollY → soft, cloud-like horizontal drift.
   - Y position bobs gently with a slower sine.
   - Subtle rotateY(scroll) gives the stack a 3D yaw as it floats.
   - rAF-throttled scroll listener so it never blocks the main thread.
   - Respects prefers-reduced-motion (renders a single static, centred frame).

   Tokens (matches the editorial system):
   - INK   #0a0a0a  (card borders)
   - PAPER #fafaf7  (card fills, semi-transparent for depth)
   - ACCENT#2af56a  (single highlight band)
   ─────────────────────────────────────────────────────────────────────── */

const ACCENT = "#2af56a";

type Side = "left" | "right";

interface Props {
  /** Which side of the viewport to anchor the drift cycle to. */
  side?: Side;
  /** Vertical anchor as a viewport-height percentage (0–100). */
  topPct?: number;
  /** Horizontal drift amplitude, in pixels. Default 80. */
  amplitudeX?: number;
  /** Vertical bob amplitude, in pixels. Default 14. */
  amplitudeY?: number;
  /** How much vertical scroll equals one full left↔right cycle. Default 1400. */
  scrollPeriod?: number;
  /** Tailwind class to control which breakpoints render the cloud. */
  visibilityClass?: string;
}

export default function FloatingScrollCloud({
  side = "right",
  topPct = 38,
  amplitudeX = 80,
  amplitudeY = 14,
  scrollPeriod = 1400,
  visibilityClass = "hidden md:block",
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const targetXRef = useRef(0);
  const targetYRef = useRef(0);
  const targetRotRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let last = -1;

    const tick = () => {
      const y = window.scrollY || window.pageYOffset || 0;
      if (y !== last) {
        last = y;
        const phase = (y / scrollPeriod) * Math.PI * 2;
        // sine drift left↔right, cosine bob up↔down (slower)
        targetXRef.current = Math.sin(phase) * amplitudeX;
        targetYRef.current = Math.cos(phase * 0.6) * amplitudeY;
        // gentle yaw — couples X drift with a small rotateY
        targetRotRef.current = Math.sin(phase) * 8; // ±8°

        const inner = innerRef.current;
        if (inner) {
          inner.style.transform =
            `translate3d(${targetXRef.current.toFixed(2)}px, ` +
            `${targetYRef.current.toFixed(2)}px, 0) ` +
            `rotateY(${targetRotRef.current.toFixed(2)}deg)`;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [amplitudeX, amplitudeY, scrollPeriod]);

  const sideStyle: React.CSSProperties =
    side === "left"
      ? { left: "max(16px, 4vw)" }
      : { right: "max(16px, 4vw)" };

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className={`pointer-events-none fixed z-[15] ${visibilityClass}`}
      style={{
        top: `${topPct}vh`,
        ...sideStyle,
        perspective: "900px",
        perspectiveOrigin: "50% 50%",
        width: 200,
        height: 200,
        opacity: 0.92,
      }}
      data-testid="floating-scroll-cloud"
    >
      <div
        ref={innerRef}
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 80ms linear",
          willChange: "transform",
        }}
      >
        {/* Card 1 — back, slight rotateY */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(250,250,247,0.78)",
            border: "1px solid #0a0a0a",
            transform: "translate3d(-22px, 14px, -40px) rotateY(-12deg)",
            boxShadow: "0 12px 28px rgba(10,10,10,0.10)",
          }}
        />
        {/* Card 2 — middle, almost flat */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(250,250,247,0.92)",
            border: "1px solid #0a0a0a",
            transform: "translate3d(-8px, 4px, -16px) rotateY(-4deg)",
            boxShadow: "0 8px 22px rgba(10,10,10,0.12)",
          }}
        />
        {/* Card 3 — front, the "label" face */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#fafaf7",
            border: "1px solid #0a0a0a",
            transform: "translate3d(0, 0, 0) rotateY(0deg)",
            boxShadow: "0 6px 18px rgba(10,10,10,0.14)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 14,
          }}
        >
          {/* eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#0a0a0a",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                background: ACCENT,
              }}
            />
            In Transit
          </div>

          {/* big number */}
          <div
            style={{
              fontFamily: "var(--font-heading), sans-serif",
              fontSize: 56,
              lineHeight: 0.85,
              fontWeight: 900,
              color: "#0a0a0a",
              letterSpacing: "-0.02em",
            }}
          >
            01<span style={{ color: "#0a0a0a", opacity: 0.25 }}>/03</span>
          </div>

          {/* footer band */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#0a0a0a",
              borderTop: "1px solid rgba(10,10,10,0.15)",
              paddingTop: 8,
            }}
          >
            <span>TMG · SG</span>
            <span style={{ background: ACCENT, color: "#0a0a0a", padding: "2px 6px" }}>
              Float
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
