import { useRef, useEffect } from "react";
import videoSrc from "@assets/kling_20260329_VIDEO_i_need_you_6037_0_1774798733578.mp4";

/*
 * Scroll-driven video background.
 *
 * iOS Safari requires autoPlay (muted + playsInline) to activate the video
 * decoder and render any frame at all. Without it, iOS simply shows nothing.
 * We set autoPlay and immediately call pause() + seek in the "play" event.
 *
 * Flow:
 *  1. autoPlay fires → "play" event → pause() + seek to current scroll pos
 *  2. Subsequent scroll events drive currentTime directly
 *  3. On browsers where autoPlay is blocked, first touchstart/pointerdown
 *     manually calls play() (now inside a user gesture) to unlock.
 */
export default function PageBgScene({
  scrollProgress,
  mouseX,
  mouseY,
}: {
  scrollProgress: number;
  mouseX: number;
  mouseY: number;
}) {
  const videoRef          = useRef<HTMLVideoElement>(null);
  const durRef            = useRef(0);
  const activatedRef      = useRef(false);
  const rafRef            = useRef<number | null>(null);
  const scrollProgressRef = useRef(scrollProgress);

  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  /* ── Activation logic ────────────────────────────────────────────
   * Once we have a duration and the browser lets us play, pause the
   * video and jump to the correct scroll position immediately.
   * ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const activate = () => {
      if (activatedRef.current) return;
      if (!durRef.current) return;
      activatedRef.current = true;
      vid.pause();
      try {
        vid.currentTime = scrollProgressRef.current * durRef.current;
      } catch (_) {}
    };

    const onLoadedMetadata = () => {
      durRef.current = vid.duration;
    };

    // "play" fires right after autoPlay kicks in (or manual play() call)
    const onPlay = () => {
      if (vid.duration) durRef.current = vid.duration;
      activate();
    };

    const onCanPlay = () => {
      if (vid.duration) durRef.current = vid.duration;
    };

    vid.addEventListener("loadedmetadata", onLoadedMetadata);
    vid.addEventListener("play", onPlay);
    vid.addEventListener("canplay", onCanPlay);

    // Fallback: if autoPlay is blocked, unlock on first user gesture
    const onFirstGesture = () => {
      if (!durRef.current && vid.readyState >= 1) durRef.current = vid.duration;
      if (!activatedRef.current) {
        vid.play().catch(() => {});
      }
      document.removeEventListener("touchstart",  onFirstGesture);
      document.removeEventListener("pointerdown", onFirstGesture);
    };
    document.addEventListener("touchstart",  onFirstGesture, { once: true, passive: true });
    document.addEventListener("pointerdown", onFirstGesture, { once: true, passive: true });

    return () => {
      vid.removeEventListener("loadedmetadata", onLoadedMetadata);
      vid.removeEventListener("play", onPlay);
      vid.removeEventListener("canplay", onCanPlay);
      document.removeEventListener("touchstart",  onFirstGesture);
      document.removeEventListener("pointerdown", onFirstGesture);
    };
  }, []);

  /* ── Scroll-driven seeking ───────────────────────────────────── */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !durRef.current) return;
    const target = scrollProgress * durRef.current;
    if (Math.abs(vid.currentTime - target) < 0.033) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!videoRef.current) return;
      try { videoRef.current.currentTime = target; } catch (_) {}
    });
  }, [scrollProgress]);

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
       * autoPlay — required on iOS to activate the video decoder.
       * muted + playsInline — required for iOS muted autoplay.
       * We pause() it immediately inside the "play" event handler above.
       */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        loop={false}
        preload="auto"
        src={videoSrc}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.92,
          transform: `translate(${mouseX * -10}px, ${mouseY * -6}px) scale(1.07)`,
          transition: "transform 0.2s ease-out",
        }}
      />
    </div>
  );
}
