import { useRef, useEffect } from "react";
import videoSrc from "@assets/kling_20260329_VIDEO_i_need_you_6037_0_1774798733578.mp4";

/*
 * Scroll-driven video background.
 * scrollProgress (0–1) maps directly to the video's playback position,
 * so scrolling down "plays" the wardrobe dismantle and scrolling back up reverses it.
 * Mouse parallax adds a subtle depth effect.
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
  const videoRef  = useRef<HTMLVideoElement>(null);
  const durRef    = useRef(0);

  /* Capture duration and prime seeking once metadata is ready.
   * Without play()+pause() some browsers refuse to seek a never-played video. */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const prime = () => {
      durRef.current = vid.duration;
      // Prime the decoder so currentTime seeks work immediately
      vid.play().then(() => vid.pause()).catch(() => {});
    };
    vid.addEventListener("loadedmetadata", prime);
    if (vid.readyState >= 1) prime();
    return () => vid.removeEventListener("loadedmetadata", prime);
  }, []);

  /* Drive currentTime by scroll.
   * Uses a short debounce so rapid scroll events coalesce into one seek. */
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !durRef.current) return;
    const target = scrollProgress * durRef.current;
    // Skip seeks smaller than ~1 frame (30 fps ≈ 0.033s)
    if (Math.abs(vid.currentTime - target) < 0.033) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (videoRef.current) videoRef.current.currentTime = target;
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
        /* Fallback shown while video loads */
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
