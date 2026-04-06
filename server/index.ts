import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { autoBookPendingQuotes } from "./storage";
import { refreshTokenIfNeeded } from "./whatsapp";

const app = express();
const httpServer = createServer(app);

app.set("trust proxy", 1);

// ── Health check — always respond immediately, before any DB work ─────────────
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Gzip compress text responses — reduces JSON/HTML/CSS/JS size by 70-90%
// Skip tiny responses (<1 KB) and already-compressed formats (images, fonts)
app.use(compression({
  level: 7,           // strong compression; balanced vs CPU cost
  threshold: 1024,    // skip compressing responses under 1 KB (not worth it)
  filter: (req, res) => {
    const ct = res.getHeader("Content-Type") as string | undefined;
    if (!ct) return false;
    // Only compress text-based content types; images/woff/zip are already compressed
    return /text|javascript|json|xml|svg/.test(ct);
  },
}));

// Security + performance headers on every response
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "on");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

const ALLOWED_ORIGINS = new Set([
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
  "http://localhost:5000",
  "https://tmg-install-project--tmginstall.replit.app",
]);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin as string | undefined;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const PgSession = connectPgSimple(session);
app.use(session({
  store: new PgSession({
    conString: process.env.DATABASE_URL,
    tableName: "session",
    createTableIfMissing: true,
    errorLog: (err: Error) => {
      // Suppress repeated Neon "endpoint disabled" noise — it recovers automatically
      if (!err.message?.includes("endpoint has been disabled")) {
        console.warn("[session-store]", err.message);
      }
    },
  }),
  secret: process.env.SESSION_SECRET || "tmg-install-secret-2026",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  },
}));

app.use(
  express.json({
    limit: "15mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const preview = JSON.stringify(capturedJsonResponse);
        logLine += ` :: ${preview.length > 120 ? preview.slice(0, 120) + "…" : preview}`;
      }
      log(logLine);
    }
  });

  next();
});

/** Retry a DB operation up to maxAttempts times, with delay between attempts.
 *  Needed for Neon's auto-suspend: the first connection wakes the endpoint,
 *  but may fail; subsequent attempts succeed once the endpoint is live. */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 4, delayMs = 2000): Promise<T> {
  let last: Error | null = null;
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      last = e;
      const isEndpointDisabled = e?.message?.includes("endpoint has been disabled") ||
                                 e?.code === "XX000";
      if (i < maxAttempts && isEndpointDisabled) {
        console.log(`[startup] DB not ready yet (attempt ${i}/${maxAttempts}), retrying in ${delayMs}ms…`);
        await new Promise(r => setTimeout(r, delayMs));
      } else if (i < maxAttempts) {
        throw e; // non-transient error — don't retry
      }
    }
  }
  throw last;
}

// ── Bind the port FIRST so health checks pass immediately ─────────────────────
const port = parseInt(process.env.PORT || "5000", 10);

httpServer.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    log(`Port ${port} already in use — exiting so runner can restart cleanly.`);
    process.exit(1);
  } else {
    throw err;
  }
});

httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
  log(`serving on port ${port}`);
});

// ── Async startup — runs after port is already bound ─────────────────────────
(async () => {
  // Ensure session + promo tables exist; retry for Neon auto-suspend
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 5,
    });

    await withRetry(() => pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
      ) WITH (OIDS=FALSE);
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `));

    await withRetry(() => pool.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        discount_amount NUMERIC NOT NULL DEFAULT 50,
        max_uses INTEGER NOT NULL DEFAULT 100,
        uses_count INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE quotes ADD COLUMN IF NOT EXISTS promo_code TEXT;
      ALTER TABLE quotes ADD COLUMN IF NOT EXISTS promo_discount NUMERIC DEFAULT 0;
      ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS remark TEXT;
      ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS clock_in_time TEXT;
      INSERT INTO promo_codes (code, discount_amount, max_uses, uses_count, active, min_order_amount)
      VALUES ('TMG50', 50, 100, 0, TRUE, 150)
      ON CONFLICT (code) DO UPDATE SET min_order_amount = 150;
      UPDATE users SET clock_in_time = '07:25' WHERE username = 'tmg_nkb' AND clock_in_time IS NULL;
    `));

    console.log("[startup] DB schema ready, TMG50 seeded.");
    await pool.end();
  } catch (e: any) {
    console.warn("[startup] DB setup warning (non-fatal):", e?.message || e);
  }

  try {
    await seedDatabase();
  } catch (e: any) {
    console.warn("[startup] seedDatabase warning:", e?.message || e);
  }

  try {
    await autoBookPendingQuotes();
  } catch (e: any) {
    console.warn("[startup] autoBookPendingQuotes warning:", e?.message || e);
  }

  // ── Prune old GPS track points (keep last 30 days only) ───────────────────
  async function pruneOldGpsData() {
    try {
      const { db: dbInst } = await import("./db");
      const { gpsTrackPoints } = await import("@shared/schema");
      const { lt } = await import("drizzle-orm");
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await dbInst.delete(gpsTrackPoints).where(lt(gpsTrackPoints.recordedAt, cutoff));
      const rows = (result as any).rowCount ?? 0;
      if (rows > 0) console.log(`[cleanup] Pruned ${rows} GPS track point(s) older than 30 days`);
    } catch (e: any) {
      console.warn("[cleanup] GPS prune warning:", e?.message || e);
    }
  }
  pruneOldGpsData();
  setInterval(pruneOldGpsData, 24 * 60 * 60 * 1000); // daily

  await registerRoutes(httpServer, app);

  // Auto-refresh WhatsApp token on startup, then every 6 days
  refreshTokenIfNeeded().catch(e => console.error("[WhatsApp] Startup token refresh error:", e));
  setInterval(() => {
    refreshTokenIfNeeded().catch(e => console.error("[WhatsApp] Scheduled token refresh error:", e));
  }, 6 * 24 * 60 * 60 * 1000);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  log("startup complete");
})().catch(e => {
  console.error("[startup] Fatal error:", e);
  process.exit(1);
});
