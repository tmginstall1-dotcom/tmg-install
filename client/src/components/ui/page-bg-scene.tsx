import { useRef, useEffect } from "react";
import videoSrc from "@assets/kling_20260329_VIDEO_i_need_you_6037_0_1774798733578.mp4";

/*
 * Scroll-driven video background — rendered onto a <canvas> element.
 *
 * Why canvas instead of <video>?
 * iOS Safari renders a native "tap to play" overlay on any paused <video>,
 * regardless of CSS pseudo-element rules or pointer-events settings.
 * Drawing to a <canvas> produces zero browser-native media UI — no play button,
 * no controls, no overlays — ever.
 *
 * Architecture:
 *  - Hidden <video> handles loading/decoding; never displayed.
 *  - Visible <canvas> receives drawImage() calls from the RAF loop.
 *  - RAF loop: lerp scrollProgress, seek video, draw frame to canvas.
 *  - Mouse parallax applied as CSS transform on the canvas (GPU composited).
 *  - Cover-fit scaling computed manually (canvas has no object-fit).
 */
export default function PageBgScene() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const durRef     = useRef(0);
  const rafRef     = useRef<number | null>(null);

  const scrollTargetRef  = useRef(0);
  const scrollDisplayRef = useRef(0);
  const mouseXRef = useRef(0);
  const mouseYRef = useRef(0);
  const scrollDirtyRef = useRef(true);
  const mouseDirtyRef  = useRef(false);

  useEffect(() => {
    const vid    = videoRef.current;
    const canvas = canvasRef.current;
    if (!vid || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    /* ── Canvas size + cover-fit helper ───────────────────────────── */
    const resizeCanvas = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      scrollDirtyRef.current = true;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });

    const drawFrame = () => {
      if (!vid.videoWidth || !vid.videoHeight) return;
      const cw = canvas.width;
      const ch = canvas.height;
      /* object-fit: cover */
      const scale = Math.max(cw / vid.videoWidth, ch / vid.videoHeight);
      const dw = vid.videoWidth  * scale;
      const dh = vid.videoHeight * scale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      ctx.drawImage(vid, dx, dy, dw, dh);
    };

    /* ── Video activation (seek-to-scroll position, then paused) ─── */
    let activated = false;
    const activate = () => {
      if (activated) return;
      if (!durRef.current) return;
      activated = true;
      vid.pause();
      try { vid.currentTime = scrollTargetRef.current * durRef.current; } catch (_) {}
      scrollDirtyRef.current = true;
    };

    const onMeta     = () => { durRef.current = vid.duration; activate(); };
    const onPlay     = () => { if (vid.duration) durRef.current = vid.duration; activate(); };
    const onCanPlay  = () => { if (vid.duration) durRef.current = vid.duration; activate(); };
    const onSeeked   = () => { scrollDirtyRef.current = true; };

    vid.addEventListener("loadedmetadata", onMeta);
    vid.addEventListener("play",           onPlay);
    vid.addEventListener("canplay",        onCanPlay);
    vid.addEventListener("seeked",         onSeeked);

    /* ── Gesture unlock for iOS autoplay policy ───────────────────── */
    const onFirstGesture = () => {
      if (!durRef.current && vid.readyState >= 1) durRef.current = vid.duration;
      if (!activated) vid.play().catch(() => {});
    };
    document.addEventListener("touchstart",  onFirstGesture, { once: true, passive: true });
    document.addEventListener("pointerdown", onFirstGesture, { once: true, passive: true });

    /* ── Passive scroll listener ──────────────────────────────────── */
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollTargetRef.current = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      scrollDirtyRef.current  = true;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    /* ── Mouse parallax listener ──────────────────────────────────── */
    const onMouseMove = (e: MouseEvent) => {
      mouseXRef.current = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseYRef.current = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseDirtyRef.current = true;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    /* ── RAF loop ─────────────────────────────────────────────────── */
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);

      /* lerp scroll display toward target */
      const prev   = scrollDisplayRef.current;
      const target = scrollTargetRef.current;
      const lerped = prev + (target - prev) * 0.10;
      if (Math.abs(lerped - prev) > 0.0001) {
        scrollDisplayRef.current = lerped;
        scrollDirtyRef.current   = true;
      }

      /* seek video and draw frame */
      if (scrollDirtyRef.current && durRef.current > 0) {
        scrollDirtyRef.current = false;
        const seekTo = scrollDisplayRef.current * durRef.current;
        if (Math.abs(vid.currentTime - seekTo) > 0.021) {
          try { vid.currentTime = seekTo; } catch (_) {}
        }
        drawFrame();
      }

      /* mouse parallax via CSS transform on canvas */
      if (mouseDirtyRef.current) {
        mouseDirtyRef.current = false;
        const mx = mouseXRef.current;
        const my = mouseYRef.current;
        canvas.style.transform = `translate(${mx * -10}px,${my * -6}px) scale(1.07)`;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize",    resizeCanvas);
      window.removeEventListener("scroll",    onScroll);
      window.removeEventListener("mousemove", onMouseMove);
      vid.removeEventListener("loadedmetadata", onMeta);
      vid.removeEventListener("play",           onPlay);
      vid.removeEventListener("canplay",        onCanPlay);
      vid.removeEventListener("seeked",         onSeeked);
      document.removeEventListener("touchstart",  onFirstGesture);
      document.removeEventListener("pointerdown", onFirstGesture);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        overflow: "hidden",
        background: "radial-gradient(ellipse at 50% 0%, #12122a 0%, #030308 55%, #000000 100%)",
      }}
    >
      {/* Edge vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 90% 100% at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Off-screen video — handles decode/seeking only. Positioned outside the
          viewport so iOS never renders a play-button overlay (which only appears
          on visible, in-viewport video elements). display:none prevents iOS from
          loading and autoplaying, so we use position+clip instead. */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        loop={false}
        preload="auto"
        src={videoSrc}
        disablePictureInPicture
        style={{
          position: "absolute",
          top: "-9999px",
          left: "-9999px",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      {/* Canvas — displays video frames. No browser media UI ever appears on canvas. */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.92,
          willChange: "transform",
          transform: "translate(0px,0px) scale(1.07)",
          transition: "none",
          zIndex: 0,
        }}
      />
    </div>
  );
}
