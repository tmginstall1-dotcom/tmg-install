import { memo } from "react";

/* ─────────────────────── EditorialPaperStack ───────────────────────
   Pure-CSS 3D decoration. Three offset INK-bordered "paper" cards
   inside a perspective container, with a very slow GPU-only float.

   Why this is lag-free:
   - No canvas, no WebGL, no library, no scroll listeners.
   - Animates only `transform` (translate/rotate) — composited on the
     GPU, no layout, no paint.
   - `will-change: transform` + `contain: paint` keep the element on
     its own composited layer.
   - Honors prefers-reduced-motion.

   Visual language matches the homepage editorial system:
   PAPER fill, INK hairline borders, ACCENT square chips, monochrome.
   ─────────────────────────────────────────────────────────────────── */

type Size = "sm" | "md";

interface Props {
  size?: Size;
  className?: string;
}

function EditorialPaperStack({ size = "md", className = "" }: Props) {
  const dims =
    size === "sm"
      ? { box: "w-[120px] h-[150px]", offset: 8 }
      : { box: "w-[180px] h-[220px]", offset: 12 };

  return (
    <div
      aria-hidden="true"
      className={`relative ${dims.box} ${className}`}
      style={{
        perspective: "900px",
        perspectiveOrigin: "50% 40%",
        contain: "paint",
      }}
      data-testid="decoration-paper-stack"
    >
      <div className="tmg-paper-stack-inner absolute inset-0">
        {/* back card */}
        <div
          className="absolute inset-0 border border-black/15 bg-[rgba(250,250,247,0.85)]"
          style={{
            transform: `translate3d(${dims.offset * 1.6}px, ${dims.offset * 1.6}px, -40px) rotateY(-8deg) rotateX(4deg)`,
            boxShadow: "0 18px 36px -22px rgba(10,10,10,0.18)",
          }}
        />
        {/* mid card */}
        <div
          className="absolute inset-0 border border-black/20 bg-[#fafaf7]"
          style={{
            transform: `translate3d(${dims.offset * 0.6}px, ${dims.offset * 0.6}px, -20px) rotateY(-4deg) rotateX(2deg)`,
            boxShadow: "0 14px 28px -18px rgba(10,10,10,0.18)",
          }}
        >
          <div className="absolute top-3 left-3 right-3 flex items-center gap-1.5">
            <span className="w-[8px] h-[8px]" style={{ background: "#2af56a" }} />
            <span className="block h-[1px] flex-1 bg-black/20" />
          </div>
        </div>
        {/* front card */}
        <div
          className="absolute inset-0 border border-black/30 bg-[#fafaf7] flex flex-col"
          style={{
            transform: "translate3d(0, 0, 0) rotateY(0deg) rotateX(0deg)",
            boxShadow: "0 22px 40px -22px rgba(10,10,10,0.22)",
          }}
        >
          <div className="px-3 pt-3 flex items-center gap-1.5">
            <span className="w-[10px] h-[10px]" style={{ background: "#0a0a0a" }} />
            <span className="text-[8px] font-black uppercase tracking-[0.22em] text-black/70">
              TMG / 001
            </span>
          </div>
          <div className="px-3 mt-2 space-y-1">
            <span className="block h-[1px] bg-black/15" />
            <span className="block h-[1px] bg-black/10 w-3/4" />
            <span className="block h-[1px] bg-black/10 w-1/2" />
          </div>
          <div className="mt-auto px-3 pb-3 flex items-end justify-between">
            <span className="text-[8px] font-black uppercase tracking-[0.22em] text-black/45">
              Quote
            </span>
            <span
              className="text-[10px] font-black uppercase tracking-[0.18em] px-1.5 py-[2px]"
              style={{ background: "#0a0a0a", color: "#fafaf7" }}
            >
              SG
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tmg-paper-stack-float {
          0%   { transform: rotateY(-6deg) rotateX(8deg) translateZ(0); }
          50%  { transform: rotateY(-2deg) rotateX(10deg) translateZ(6px); }
          100% { transform: rotateY(-6deg) rotateX(8deg) translateZ(0); }
        }
        .tmg-paper-stack-inner {
          transform-style: preserve-3d;
          transform: rotateY(-6deg) rotateX(8deg);
          animation: tmg-paper-stack-float 9s ease-in-out infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .tmg-paper-stack-inner { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default memo(EditorialPaperStack);
