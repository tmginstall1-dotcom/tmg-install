import { useRef, useEffect } from "react";
import videoSrc from "@assets/kling_20260329_VIDEO_i_need_you_6037_0_1774798733578.mp4";

/*
 * Scroll-driven video background — fully self-contained, zero React re-renders.
 *
 * Architecture:
 *  - No props.  Owns its own passive scroll + mousemove listeners.
 *  - Single RAF loop runs at 60 fps:
 *      1. Lerp displayProgress → scrollProgress (spring-smooth scrubbing)
 *      2. Seek video to lerped time (skipped when delta < 1 frame)
 *      3. Update video.style.transform for mouse parallax
 *  - iOS Safari unlock: autoPlay activates decoder; onPlay immediately calls
 *    pause() + seeks to current scroll position.
 */
export default function PageBgScene() {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const durRef       = useRef(0);
  const activatedRef = useRef(false);
  const rafRef       = useRef<number | null>(null);

  /* raw scroll progress (0-1) written by the passive listener */
  const scrollTargetRef  = useRef(0);
  /* smoothed display progress (lerped in RAF) */
  const scrollDisplayRef = useRef(0);
  /* mouse positions written by the passive listener */
  const mouseXRef = useRef(0);
  const mouseYRef = useRef(0);
  /* dirty flags so RAF skips no-op frames */
  const scrollDirtyRef = useRef(true);
  const mouseDirtyRef  = useRef(false);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    /* ── Video activation ─────────────────────────────────────────── */
    const activate = () => {
      if (activatedRef.current) return;
      if (!durRef.current) return;
      activatedRef.current = true;
      vid.pause();
      try { vid.currentTime = scrollTargetRef.current * durRef.current; } catch (_) {}
    };

    const onLoadedMetadata = () => {
      durRef.current = vid.duration;
      activate();
    };
    const onPlay = () => {
      if (vid.duration) durRef.current = vid.duration;
      activate();
    };
    const onCanPlay = () => {
      if (vid.duration) durRef.current = vid.duration;
      activate();
    };

    vid.addEventListener("loadedmetadata", onLoadedMetadata);
    vid.addEventListener("play", onPlay);
    vid.addEventListener("canplay", onCanPlay);

    /* ── Gesture unlock (iOS autoplay-blocked fallback) ───────────── */
    const onFirstGesture = () => {
      if (!durRef.current && vid.readyState >= 1) durRef.current = vid.duration;
      if (!activatedRef.current) vid.play().catch(() => {});
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
      mouseXRef.current  = (e.clientX / window.innerWidth  - 0.5) * 2;
      mouseYRef.current  = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseDirtyRef.current = true;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    /* ── RAF loop ─────────────────────────────────────────────────── */
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);

      const durSecs = durRef.current;
      const v = videoRef.current;
      if (!v) return;

      /* lerp display progress toward scroll target every frame */
      const prev    = scrollDisplayRef.current;
      const target  = scrollTargetRef.current;
      const lerped  = prev + (target - prev) * 0.10;
      const changed = Math.abs(lerped - prev) > 0.0001;
      if (changed) {
        scrollDisplayRef.current = lerped;
        scrollDirtyRef.current   = true;
      }

      if (scrollDirtyRef.current && durSecs > 0) {
        scrollDirtyRef.current = false;
        const seekTo = scrollDisplayRef.current * durSecs;
        /* only seek when delta > half a frame at 24 fps */
        if (Math.abs(v.currentTime - seekTo) > 0.021) {
          try { v.currentTime = seekTo; } catch (_) {}
        }
      }

      if (mouseDirtyRef.current) {
        mouseDirtyRef.current = false;
        const mx = mouseXRef.current;
        const my = mouseYRef.current;
        v.style.transform = `translate(${mx * -10}px,${my * -6}px) scale(1.07)`;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("scroll",    onScroll);
      window.removeEventListener("mousemove", onMouseMove);
      vid.removeEventListener("loadedmetadata", onLoadedMetadata);
      vid.removeEventListener("play",           onPlay);
      vid.removeEventListener("canplay",        onCanPlay);
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

      {/*
       * autoPlay — required on iOS Safari to activate the video decoder.
       * muted + playsInline — required for iOS muted autoplay.
       * pause() is called immediately inside the "play" event handler.
       * will-change: transform — promotes to GPU compositing layer.
       */}
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
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.92,
          willChange: "transform",
          transform: "translate(0px,0px) scale(1.07)",
          transition: "none",
        }}
      />
      {/* Transparent cover — sits above the video in the same container, blocking
          any browser-rendered play-button overlay from receiving touch events.
          pointer-events is still none on the parent so the landing page content
          behind receives all interaction normally. */}
      <div style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none" }} />
    </div>
  );
}
