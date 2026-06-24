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

// In production the main stylesheet is loaded non-blocking (see server/static.ts)
// so the inline-styled splash paints instantly (fast FCP). The challenge:
//   1. If we PAINT the app before that CSS applied, it renders unstyled and then
//      reflows when the stylesheet arrives — the Layout Instability API records
//      that reflow as CLS even though it happens behind the opaque splash.
//   2. If we DELAY the React mount until CSS is ready, all the JS parse/execute
//      work is pushed AFTER the CSS download, serializing the critical path and
//      blowing up LCP (the real hero only paints after CSS + all JS run).
//
// So we do both in parallel: MOUNT React immediately (its JS parses/executes
// while the stylesheet is still downloading) but keep #root visually HIDDEN
// until the stylesheet has applied. Hidden elements don't paint, so the
// unstyled->styled reflow is never recorded as a layout shift. The instant the
// CSS is ready we reveal #root — by then React has usually already rendered, so
// the styled hero paints right away (fast LCP) with zero CLS. In dev — or any
// page with no deferred stylesheet — CSS is already present, so we reveal at once.
(function mountAndRevealWhenStyled() {
  const asyncCss = document.querySelector(
    "link[data-async-css]",
  ) as HTMLLinkElement | null;
  // `window.__cssReady` is flipped to true by the stylesheet's inline onload at
  // the exact moment it is applied to the screen (media print->all swap). That
  // global flag is the authoritative "styles are live" signal — independent of
  // whether we caught the link's `load` event in time.
  const isStyled = () => !asyncCss || (window as any).__cssReady === true;

  // Mount NOW so React's parse/execute overlaps the CSS download.
  if (!isStyled()) rootEl.style.visibility = "hidden";
  createRoot(rootEl).render(<App />);

  if (isStyled()) {
    reveal();
    return;
  }

  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    reveal();
  };

  // Primary, race-proof gate: poll the global flag every frame. This fires the
  // instant CSS is applied even if the link's `load` event was missed (e.g. it
  // resolved between our check above and the listener below), so we never wait
  // on the safety timeout in the common case.
  const poll = () => {
    if (done) return;
    if (isStyled()) {
      go();
      return;
    }
    requestAnimationFrame(poll);
  };
  requestAnimationFrame(poll);

  // Backups: the link's own load event, and an error path so a stylesheet that
  // fails to load can never leave the app permanently hidden (rAF also pauses
  // in background tabs, which don't paint anyway).
  asyncCss!.addEventListener("load", go, { once: true });
  asyncCss!.addEventListener("error", go, { once: true });
  // Absolute last resort only — by this point CSS has effectively always
  // applied; revealing is strictly better than a blank screen.
  setTimeout(go, 6000);
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
