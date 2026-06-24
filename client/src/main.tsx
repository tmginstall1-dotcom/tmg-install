import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initMetaPixel } from "@/lib/metaPixel";

const rootEl = document.getElementById("root")!;

function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  splash.style.transition = "opacity 0.25s ease";
  splash.style.opacity = "0";
  setTimeout(() => splash.remove(), 300);
}

// Make the (now styled) app visible and fade the splash away, after the styled
// frame is committed (two RAFs).
function reveal() {
  rootEl.style.visibility = "";
  requestAnimationFrame(() => requestAnimationFrame(() => hideSplash()));
}

// Performance strategy (the "/" homepage is a heavy client-rendered SPA):
//
// FCP/LCP come from the inline #splash in index.html — its giant "TMG" wordmark
// uses a SYSTEM font (no web font) so it paints instantly from HTML, and it is
// pixel-identical to the React hero (.hero-h1-responsive). Because the revealed
// hero matches the splash exactly, it never becomes a new/larger LCP candidate,
// so LCP stays locked to that early splash paint regardless of when React or the
// stylesheet finish.
//
// Two things to get right here:
//   1. FCP — do NOT run the heavy synchronous React render before the browser
//      has painted the splash. We yield with a double rAF first so the splash
//      paints, THEN mount.
//   2. CLS — in production the main stylesheet is non-blocking (see
//      server/static.ts). If we revealed #root before that CSS applied, the
//      unstyled->styled reflow would be recorded as a layout shift (even behind
//      the opaque splash). So we keep #root hidden until the stylesheet applies,
//      then reveal. In dev — or any page with no deferred stylesheet — CSS is
//      already present so we reveal immediately.
(function mountAndRevealWhenStyled() {
  const asyncCss = document.querySelector(
    "link[data-async-css]",
  ) as HTMLLinkElement | null;
  // `window.__cssReady` is flipped to true by the stylesheet's inline onload at
  // the exact moment it is applied to the screen (media print->all swap). That
  // global flag is the authoritative "styles are live" signal — independent of
  // whether we caught the link's `load` event in time.
  const isStyled = () => !asyncCss || (window as any).__cssReady === true;

  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    reveal();
  };

  const mount = () => {
    // Keep the app hidden until the deferred stylesheet has applied so the
    // unstyled->styled reflow (behind the splash) is never counted as CLS.
    if (!isStyled()) rootEl.style.visibility = "hidden";
    createRoot(rootEl).render(<App />);

    if (isStyled()) {
      go();
      return;
    }

    // Race-proof gate: poll the global flag every frame so we reveal the instant
    // CSS applies even if the link's `load` event fired before we listened.
    const poll = () => {
      if (done) return;
      if (isStyled()) {
        go();
        return;
      }
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);

    // Backups: the link's own load/error events (error so a failed stylesheet
    // can never leave the app permanently hidden) + an absolute last resort.
    asyncCss!.addEventListener("load", go, { once: true });
    asyncCss!.addEventListener("error", go, { once: true });
    setTimeout(go, 6000);
  };

  // Let the browser paint the inline splash FIRST (fast FCP) before running the
  // heavy synchronous React render. Two rAFs guarantee a committed paint.
  requestAnimationFrame(() => requestAnimationFrame(mount));
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
