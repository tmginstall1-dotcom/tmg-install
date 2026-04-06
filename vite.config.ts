import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    /* Only load Replit dev overlays in the Replit dev environment, never in production builds */
    ...(process.env.NODE_ENV !== "production"
      ? [runtimeErrorOverlay()]
      : []),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    /* Target modern browsers (Chrome 87+, Safari 14+, Firefox 78+) — no legacy polyfills */
    target: "es2020",
    /* Skip gzip size reporting — saves ~15-20s on every production build */
    reportCompressedSize: false,
    /* Suppress chunk size warnings for known-large vendor bundles */
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          /* Core React runtime — always needed, tiny */
          "vendor-react":  ["react", "react-dom"],
          /* Data fetching layer */
          "vendor-query":  ["@tanstack/react-query"],
          /* Animation — customer pages only */
          "vendor-motion": ["framer-motion"],
          /* Charts — admin only, lazy loaded with analytics page */
          "vendor-charts": ["recharts"],
          /* Map — admin analytics only, lazy loaded */
          "vendor-maps":   ["react-simple-maps"],
          /* Radix UI primitives — used throughout shadcn components */
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-label",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-accordion",
            "@radix-ui/react-avatar",
          ],
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
