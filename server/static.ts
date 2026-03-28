import express, { type Express } from "express";
import fs from "fs";
import path from "path";

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

  // ── All other static files (icons, manifest, etc.) with custom per-type rules
  app.use(express.static(distPath, {
    maxAge: "1d",
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        // HTML must never be cached — keeps SPA routing always fresh
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else if (filePath.endsWith("sw.js") || filePath.endsWith("manifest.json")) {
        // Service worker + manifest must update promptly
        res.setHeader("Cache-Control", "no-cache");
      } else if (/\.(png|jpg|jpeg|webp|svg|ico)$/.test(filePath)) {
        // Icons and images — 7 days
        res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
      }
    },
  }));

  // ── SPA fallback — always serve fresh HTML for client-side routes
  app.use("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
