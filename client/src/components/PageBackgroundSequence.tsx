import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

const PAPER = "#fafaf7";
const INK = "#0a0a0a";
const SEQ_COUNT = 60;
const SEQ_PATH = (i: number) =>
  `/sequences/install/f_${String(i).padStart(3, "0")}.webp`;

/* ─────────────────────── PageBackgroundSequence ───────────────────────
   Fixed-position viewport canvas that scrubs the 60-frame install/dismantle
   sequence based on TOTAL page scroll. Sits behind every section (z-0).

   Performance:
   - Frame preload deferred until window.load + requestIdleCallback so it
     never competes with the LCP element.
   - Two-pass progressive loading: every 4th frame first (fast scrub
     coverage), then the rest.
   - Browser caches frames once loaded — reusing this component on multiple
     pages costs zero extra network.
   - Canvas renders at DPR=1, opaque context, skips redraws when frame
     index hasn't changed, scroll listener coalesces bursts into a single
     rAF, wrapper is GPU-promoted via translateZ(0).

   To keep scrolling smooth on pages that use this background, give every
   major section a `data-testid="section-..."` attribute. The global CSS
   rule in client/src/index.css promotes those sections to their own GPU
   layer so translucent backgrounds composite cheaply over the canvas. */
export default function PageBackgroundSequence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let count = 0;
    const imgs: HTMLImageElement[] = new Array(SEQ_COUNT);
    imagesRef.current = imgs;

    const loadOne = (i: number) => {
      if (cancelled || imgs[i]) return;
      const img = new Image();
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
      for (let i = 0; i < SEQ_COUNT; i += 4) loadOne(i);
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

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    let lastIdx = -1;
    const resize = () => {
      cv.width = Math.round(window.innerWidth);
      cv.height = Math.round(window.innerHeight);
      lastIdx = -1;
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
      if (raf) return;
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
