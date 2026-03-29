import { useRef, useEffect } from "react";
import videoSrc from "@assets/kling_20260329_VIDEO_i_need_you_6037_0_1774798733578.mp4";

/*
 * Scroll-driven video background.
 * scrollProgress (0–1) maps directly to the video's playback position,
 * so scrolling down "plays" the wardrobe dismantle and scrolling back up reverses it.
 * Mouse parallax adds a subtle depth effect.
 *
 * Mobile / iOS fix:
 *  iOS Safari blocks video.play() unless called from a direct user gesture.
 *  We listen for the first touchstart/pointerdown to unlock (prime) the video,
 *  then immediately seek to the current scroll position so mobile users see the
 *  correct frame as soon as they touch the screen.
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
  const videoRef         = useRef<HTMLVideoElement>(null);
  const durRef           = useRef(0);
  const unlockedRef      = useRef(false);
  const scrollProgressRef= useRef(scrollProgress);
  const rafRef           = useRef<number | null>(null);

  // Keep a live ref to scrollProgress so the unlock callback can seek immediately
  useEffect(() => {
    scrollProgressRef.current = scrollProgress;
  }, [scrollProgress]);

  /* ── Prime / unlock ─────────────────────────────────────────────
   * Two paths to unlock the video:
   *  1. loadedmetadata fires (works on desktop + Android)
   *  2. First touchstart/pointerdown (required for iOS Safari)
   * ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const doUnlock = () => {
      if (unlockedRef.current) return;
      if (!durRef.current && vid.duration) durRef.current = vid.duration;
      if (!durRef.current) return;
      unlockedRef.current = true;
      vid.play()
        .then(() => {
          vid.pause();
          // Seek immediately to the current scroll position
          const target = scrollProgressRef.current * durRef.current;
          vid.currentTime = target;
        })
        .catch(() => {
          // Even if play() is blocked, try a direct seek — works on some Android browsers
          try { vid.currentTime = scrollProgressRef.current * durRef.current; } catch (_) {}
        });
    };

    const onMetadata = () => {
      durRef.current = vid.duration;
      doUnlock();
    };

    // Unlock on first touch / pointer (iOS requires a gesture)
    const onFirstInteraction = () => {
      if (!durRef.current && vid.readyState >= 1) durRef.current = vid.duration;
      doUnlock();
      document.removeEventListener("touchstart",  onFirstInteraction);
      document.removeEventListener("pointerdown", onFirstInteraction);
    };

    vid.addEventListener("loadedmetadata", onMetadata);
    if (vid.readyState >= 1) onMetadata();

    document.addEventListener("touchstart",  onFirstInteraction, { passive: true });
    document.addEventListener("pointerdown", onFirstInteraction, { passive: true });

    return () => {
      vid.removeEventListener("loadedmetadata", onMetadata);
      document.removeEventListener("touchstart",  onFirstInteraction);
      document.removeEventListener("pointerdown", onFirstInteraction);
    };
  }, []);

  /* ── Scroll-driven seeking ───────────────────────────────────── */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !durRef.current) return;
    const target = scrollProgress * durRef.current;
    if (Math.abs(vid.currentTime - target) < 0.033) return; // < 1 frame at 30fps
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!videoRef.current) return;
      // On iOS, currentTime assignment fails if video was never played — handled above
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
      {/* Subtle vignette overlay to improve text contrast on edges */}
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

      <video
        ref={videoRef}
        autoPlay={false}
        muted
        playsInline
        preload="auto"
        src={videoSrc}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.92,
          /* Mouse parallax — scale(1.07) hides the small gap at edges */
          transform: `translate(${mouseX * -10}px, ${mouseY * -6}px) scale(1.07)`,
          transition: "transform 0.2s ease-out",
        }}
      />
    </div>
  );
}
