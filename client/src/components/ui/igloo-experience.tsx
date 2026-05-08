import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";

const CHAPTERS = [
  { id: "hero",     label: "Intro" },
  { id: "services", label: "Services" },
  { id: "how",      label: "How it works" },
  { id: "pricing",  label: "Pricing" },
  { id: "trust",    label: "Trust" },
  { id: "cta",      label: "Quote" },
];

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

/* ──────────────────────────────────────────────────────────────────────────
   1) SNOW FIELD — drifting ice particles, GPU-cheap canvas
   ────────────────────────────────────────────────────────────────────────── */
function SnowField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = window.innerWidth;
    let H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mobile = isTouchDevice();
    const COUNT = mobile ? 35 : 90;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = W + "px";
      canvas!.style.height = H + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    type Flake = { x: number; y: number; r: number; vx: number; vy: number; a: number; phase: number };
    const flakes: Flake[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.6 + Math.random() * 2.2,
      vx: -0.15 + Math.random() * 0.3,
      vy: 0.15 + Math.random() * 0.6,
      a: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    function tick() {
      t += 0.012;
      ctx!.clearRect(0, 0, W, H);
      for (const f of flakes) {
        f.x += f.vx + Math.sin(t + f.phase) * 0.18;
        f.y += f.vy;
        if (f.y > H + 4) { f.y = -4; f.x = Math.random() * W; }
        if (f.x < -4) f.x = W + 4;
        if (f.x > W + 4) f.x = -4;
        ctx!.beginPath();
        const grd = ctx!.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3);
        grd.addColorStop(0, `rgba(220, 240, 255, ${f.a})`);
        grd.addColorStop(0.5, `rgba(186, 230, 253, ${f.a * 0.45})`);
        grd.addColorStop(1, "rgba(186, 230, 253, 0)");
        ctx!.fillStyle = grd;
        ctx!.arc(f.x, f.y, f.r * 3, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(255, 255, 255, ${f.a * 0.9})`;
        ctx!.arc(f.x, f.y, f.r * 0.55, 0, Math.PI * 2);
        ctx!.fill();
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="igloo-snow-field"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 30,
        mixBlendMode: "screen",
        opacity: 0.9,
      }}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   2) CUSTOM CURSOR — frosted dot + lerping ring (desktop only)
   ────────────────────────────────────────────────────────────────────────── */
function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || isTouchDevice()) return;
    setEnabled(true);

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my;
    let scale = 1;
    let targetScale = 1;
    let raf = 0;

    function move(e: MouseEvent) {
      mx = e.clientX;
      my = e.clientY;
      const target = e.target as HTMLElement | null;
      if (target && target.closest("a, button, [role='button'], input, textarea, select, [data-cursor-hover]")) {
        targetScale = 2.4;
      } else {
        targetScale = 1;
      }
    }
    function down() { targetScale = Math.max(0.6, targetScale * 0.55); }
    function up()   { /* allow next move() to reset */ }
    function leave() {
      if (dotRef.current) dotRef.current.style.opacity = "0";
      if (ringRef.current) ringRef.current.style.opacity = "0";
    }
    function enter() {
      if (dotRef.current) dotRef.current.style.opacity = "1";
      if (ringRef.current) ringRef.current.style.opacity = "0.85";
    }

    window.addEventListener("mousemove", move, { passive: true });
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    document.documentElement.addEventListener("mouseleave", leave);
    document.documentElement.addEventListener("mouseenter", enter);

    function tick() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      scale += (targetScale - scale) * 0.18;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mx - 3}px, ${my - 3}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${rx - 18}px, ${ry - 18}px, 0) scale(${scale})`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    document.documentElement.classList.add("igloo-cursor-active");

    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      document.documentElement.removeEventListener("mouseleave", leave);
      document.documentElement.removeEventListener("mouseenter", enter);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("igloo-cursor-active");
    };
  }, []);

  if (!enabled) return null;
  return (
    <>
      <div
        ref={ringRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0, top: 0,
          width: 36, height: 36,
          borderRadius: "50%",
          border: "1.5px solid rgba(186, 230, 253, 0.85)",
          boxShadow: "0 0 18px rgba(125, 211, 252, 0.45), inset 0 0 12px rgba(186, 230, 253, 0.15)",
          pointerEvents: "none",
          zIndex: 9998,
          opacity: 0.85,
          transition: "opacity 220ms ease",
          willChange: "transform",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
        }}
      />
      <div
        ref={dotRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          left: 0, top: 0,
          width: 6, height: 6,
          borderRadius: "50%",
          background: "rgba(240, 249, 255, 0.95)",
          boxShadow: "0 0 8px rgba(125, 211, 252, 0.9)",
          pointerEvents: "none",
          zIndex: 9999,
          transition: "opacity 220ms ease",
          willChange: "transform",
        }}
      />
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   3) AMBIENT SOUND — procedural frosty drone via Web Audio (no asset needed)
   ────────────────────────────────────────────────────────────────────────── */
function useAmbientDrone() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const [playing, setPlaying] = useState(false);

  const stop = useCallback(() => {
    const master = masterRef.current;
    const ctx = ctxRef.current;
    if (master && ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      setTimeout(() => {
        try {
          nodesRef.current.forEach((n) => {
            try { (n as OscillatorNode).stop?.(); } catch {}
            try { n.disconnect(); } catch {}
          });
          nodesRef.current = [];
          ctx.close();
        } catch {}
        ctxRef.current = null;
        masterRef.current = null;
      }, 700);
    }
    setPlaying(false);
  }, []);

  const start = useCallback(async () => {
    if (ctxRef.current) return;
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    ctxRef.current = ctx;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    masterRef.current = master;

    // Low drone — sine at 55Hz with slow detune wobble
    const lo = ctx.createOscillator();
    lo.type = "sine";
    lo.frequency.value = 55;
    const loLfo = ctx.createOscillator();
    loLfo.frequency.value = 0.07;
    const loLfoGain = ctx.createGain();
    loLfoGain.gain.value = 1.5;
    loLfo.connect(loLfoGain).connect(lo.detune);
    const loGain = ctx.createGain();
    loGain.gain.value = 0.18;
    lo.connect(loGain).connect(master);

    // Mid pad — sine at 110Hz + 165Hz (perfect 5th)
    const mid1 = ctx.createOscillator();
    mid1.type = "sine"; mid1.frequency.value = 110;
    const mid2 = ctx.createOscillator();
    mid2.type = "sine"; mid2.frequency.value = 164.81;
    const midGain = ctx.createGain();
    midGain.gain.value = 0.06;
    mid1.connect(midGain); mid2.connect(midGain); midGain.connect(master);

    // Wind — filtered white noise
    const bufSize = 2 * ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseLP = ctx.createBiquadFilter();
    noiseLP.type = "lowpass";
    noiseLP.frequency.value = 600;
    noiseLP.Q.value = 0.7;
    const noiseHP = ctx.createBiquadFilter();
    noiseHP.type = "highpass";
    noiseHP.frequency.value = 120;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.04;
    // slow tremolo on wind
    const noiseLfo = ctx.createOscillator();
    noiseLfo.frequency.value = 0.11;
    const noiseLfoGain = ctx.createGain();
    noiseLfoGain.gain.value = 0.025;
    noiseLfo.connect(noiseLfoGain).connect(noiseGain.gain);
    noise.connect(noiseHP).connect(noiseLP).connect(noiseGain).connect(master);

    // Shimmer — high sine with very slow sweep, very quiet
    const shim = ctx.createOscillator();
    shim.type = "sine"; shim.frequency.value = 1320;
    const shimLfo = ctx.createOscillator();
    shimLfo.frequency.value = 0.05;
    const shimLfoGain = ctx.createGain();
    shimLfoGain.gain.value = 60;
    shimLfo.connect(shimLfoGain).connect(shim.frequency);
    const shimGain = ctx.createGain();
    shimGain.gain.value = 0.012;
    shim.connect(shimGain).connect(master);

    [lo, loLfo, mid1, mid2, noise, noiseLfo, shim, shimLfo].forEach((n) => {
      try { (n as OscillatorNode).start?.(); } catch {}
    });
    nodesRef.current = [lo, loLfo, mid1, mid2, noise, noiseLfo, shim, shimLfo, loGain, midGain, noiseGain, noiseHP, noiseLP, shimGain, shimLfoGain, loLfoGain, noiseLfoGain];

    // Fade in
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 2.2);

    if (ctx.state === "suspended") {
      try { await ctx.resume(); } catch {}
    }
    setPlaying(true);
  }, []);

  useEffect(() => () => { stop(); }, [stop]);

  return { playing, start, stop };
}

function SoundToggle() {
  const { playing, start, stop } = useAmbientDrone();
  return (
    <button
      type="button"
      onClick={() => (playing ? stop() : start())}
      aria-label={playing ? "Mute ambient sound" : "Play ambient sound"}
      data-testid="button-ambient-sound"
      data-cursor-hover
      className="igloo-sound-toggle"
      style={{
        position: "fixed",
        right: 22,
        bottom: 168,
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: "rgba(15, 23, 42, 0.55)",
        border: "1px solid rgba(186, 230, 253, 0.35)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        boxShadow: "0 6px 22px rgba(2, 6, 23, 0.45), inset 0 0 0 1px rgba(186, 230, 253, 0.08), 0 0 24px rgba(125, 211, 252, 0.18)",
        color: "rgba(224, 242, 254, 0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        zIndex: 60,
        transition: "transform 220ms ease, box-shadow 220ms ease, background 220ms ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {playing ? <Volume2 size={18} /> : <VolumeX size={18} />}
      {playing && !prefersReducedMotion() && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: "1px solid rgba(125, 211, 252, 0.45)",
            animation: "iglooPulse 2.4s ease-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
    </button>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   4) SCROLL CHAPTERS — right-edge progress dots with hover labels
   ────────────────────────────────────────────────────────────────────────── */
function ScrollChapters() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isTouchDevice()) return; // desktop only
    const sections = CHAPTERS.map((c) => document.getElementById(c.id));
    const present = sections.filter(Boolean) as HTMLElement[];
    if (present.length === 0) return;
    setVisible(true);

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = CHAPTERS.findIndex((c) => c.id === (entry.target as HTMLElement).id);
            if (idx >= 0) setActive(idx);
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    present.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <nav
      aria-label="Page sections"
      data-testid="igloo-scroll-chapters"
      style={{
        position: "fixed",
        right: 18,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "16px 8px",
        borderRadius: 999,
        background: "rgba(15, 23, 42, 0.35)",
        border: "1px solid rgba(186, 230, 253, 0.15)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {CHAPTERS.map((c, i) => {
        const isActive = i === active;
        return (
          <a
            key={c.id}
            href={`#${c.id}`}
            data-cursor-hover
            data-testid={`link-chapter-${c.id}`}
            onClick={(e) => {
              const el = document.getElementById(c.id);
              if (el) {
                e.preventDefault();
                el.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            style={{
              position: "relative",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isActive ? "rgba(186, 230, 253, 0.95)" : "rgba(186, 230, 253, 0.25)",
              boxShadow: isActive ? "0 0 12px rgba(125, 211, 252, 0.85)" : "none",
              transition: "all 280ms ease",
              cursor: "pointer",
              display: "block",
            }}
          >
            <span
              style={{
                position: "absolute",
                right: 18,
                top: "50%",
                transform: "translateY(-50%)",
                whiteSpace: "nowrap",
                fontSize: 10,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(224, 242, 254, 0.85)",
                background: "rgba(2, 6, 23, 0.7)",
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid rgba(186, 230, 253, 0.2)",
                opacity: isActive ? 1 : 0,
                pointerEvents: isActive ? "auto" : "none",
                transition: "opacity 240ms ease",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              {c.label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   ROOT — mounts all overlays
   Note: We intentionally do NOT hijack wheel scrolling. On a conversion page
   for a moving-services business, native browser scrolling is more reliable
   across devices and accessibility tools. Atmosphere is delivered through the
   visual overlays below, not by overriding the user's input.
   ────────────────────────────────────────────────────────────────────────── */
export default function IglooExperience() {
  return (
    <>
      <SnowField />
      <CustomCursor />
      <SoundToggle />
      <ScrollChapters />
    </>
  );
}
