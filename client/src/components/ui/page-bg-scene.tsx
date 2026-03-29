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
  const seeking   = useRef(false);

  /* Capture duration once metadata is ready */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onMeta = () => { durRef.current = vid.duration; };
    vid.addEventListener("loadedmetadata", onMeta);
    if (vid.readyState >= 1) durRef.current = vid.duration;
    return () => vid.removeEventListener("loadedmetadata", onMeta);
  }, []);

  /* Drive currentTime by scroll — skip tiny deltas to avoid stutter */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !durRef.current || seeking.current) return;
    const target = scrollProgress * durRef.current;
    if (Math.abs(vid.currentTime - target) > 0.025) {
      seeking.current = true;
      vid.currentTime = target;
    }
  }, [scrollProgress]);

  /* Release seeking lock after each seek completes */
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onSeeked = () => { seeking.current = false; };
    vid.addEventListener("seeked", onSeeked);
    return () => vid.removeEventListener("seeked", onSeeked);
  }, []);

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
