import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initMetaPixel } from "@/lib/metaPixel";

function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.style.transition = "opacity 0.25s ease";
  splash.style.opacity = "0";
  setTimeout(() => splash.remove(), 300);
}

// Mount React, then fade out the splash once the first styled frame is painted.
function mountApp() {
  createRoot(document.getElementById("root")!).render(<App />);
  // Two RAFs so the styled paint is committed before the splash is revealed.
  requestAnimationFrame(() => requestAnimationFrame(() => hideSplash()));
}

// In production the main stylesheet is loaded non-blocking (see
// server/static.ts) so the inline-styled splash can paint instantly (fast
// FCP/LCP). But if we mounted React BEFORE that CSS applied, the app — and the
// crawler SEO block in #root — would render unstyled and then reflow into place
// when the stylesheet arrived. The Layout Instability API records that reflow as
// a large layout shift (CLS) even though it happens behind the opaque splash.
// So we DELAY the mount until the stylesheet is applied: React then lays out
// exactly once, already styled, and no shift is recorded. The inline splash
// keeps the screen filled (and stays the FCP/LCP element) throughout. In dev —
// or any page with no deferred stylesheet — CSS is already present, so we mount
// immediately.
(function mountWhenStyled() {
  const asyncCss = document.querySelector(
    "link[data-async-css]",
  ) as HTMLLinkElement | null;
  const cssReady = !asyncCss || (window as any).__cssReady === true;

  if (cssReady) {
    mountApp();
    return;
  }

  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    mountApp();
  };
  asyncCss!.addEventListener("load", go, { once: true });
  // Safety net: never block the app if the load event is missed.
  setTimeout(go, 3000);
})();

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
