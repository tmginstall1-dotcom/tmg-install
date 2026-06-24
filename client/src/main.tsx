import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initMetaPixel } from "@/lib/metaPixel";

createRoot(document.getElementById("root")!).render(<App />);

// Hide the HTML splash screen once React has mounted
const splash = document.getElementById("splash");
if (splash) {
  splash.style.transition = "opacity 0.25s ease";
  splash.style.opacity = "0";
  setTimeout(() => splash.remove(), 300);
}

// Defer third-party tracking (Meta Pixel) until the browser is idle or the
// user first interacts — whichever happens first. Keeps the Facebook script
// off the critical path so it never competes with first paint / LCP.
(function deferMetaPixel() {
  let started = false;
  const run = () => {
    if (started) return;
    started = true;
    initMetaPixel();
  };
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => void)
    | undefined;
  if (typeof ric === "function") {
    ric(run, { timeout: 4000 });
  } else {
    setTimeout(run, 2500);
  }
  ["pointerdown", "keydown", "touchstart", "scroll"].forEach((evt) =>
    window.addEventListener(evt, run, { once: true, passive: true }),
  );
  // Also fire before the user leaves a quick no-interaction session so the
  // PageView still has a chance to be recorded.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") run();
  });
  window.addEventListener("pagehide", run, { once: true });
})();
