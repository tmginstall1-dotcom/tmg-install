import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { injectHomepageRating } from "./seo-pages";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // ── Hashed JS/CSS bundles → immutable (1 year, never re-download)
  app.use("/assets", express.static(path.join(distPath, "assets"), {
    maxAge: "1y",
    immutable: true,
    etag: true,
  }));

  // ── Work gallery images → 7 days (re-deploy busts cache)
  app.use("/work", express.static(path.join(distPath, "work"), {
    maxAge: "7d",
    etag: true,
    lastModified: true,
  }));

  // ── Local font files → immutable (1 year)
  app.use("/fonts", express.static(path.join(distPath, "fonts"), {
    maxAge: "1y",
    immutable: true,
    etag: true,
  }));

  // ── All other static files (icons, manifest, etc.) with custom per-type rules.
  // index: false  → don't auto-serve index.html for "/" — let the SPA fallback
  // below serve it from the in-memory cache (faster TTFB, and applies the
  // admin/public manifest swap consistently for every HTML response).
  app.use(express.static(distPath, {
    maxAge: "1d",
    etag: true,
    lastModified: true,
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        // HTML must never be cached — keeps SPA routing always fresh
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else if (filePath.endsWith("sw.js") || filePath.endsWith("manifest.json") || filePath.endsWith("manifest-admin.json")) {
        // Service worker + manifest must update promptly
        res.setHeader("Cache-Control", "no-cache");
      } else if (/\.(png|jpg|jpeg|webp|svg|ico)$/.test(filePath)) {
        // Icons and images — 7 days
        res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
      }
    },
  }));

  // ── SPA fallback — always serve fresh HTML for client-side routes
  // Injects admin-specific manifest for /admin routes so iOS uses start_url=/admin.
  // index.html is read ONCE at startup and held in memory (it's tiny and
  // doesn't change between deploys). This removes a ~10-50ms disk-read off
  // every cold-cache page request and improves TTFB.
  const indexHtmlPath = path.resolve(distPath, "index.html");
  const indexHtmlPublic = fs.readFileSync(indexHtmlPath, "utf-8");
  const indexHtmlAdmin = indexHtmlPublic
    .replace(
      `<link rel="manifest" href="/manifest.json" />`,
      `<link rel="manifest" href="/manifest-admin.json" />`,
    )
    .replace(
      `<meta name="apple-mobile-web-app-title" content="TMG Install" />`,
      `<meta name="apple-mobile-web-app-title" content="TMG Admin" />`,
    );

  app.use("/{*path}", (req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const pathname = req.path;
    const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
    res.send(injectHomepageRating(isAdmin ? indexHtmlAdmin : indexHtmlPublic));
  });
}
