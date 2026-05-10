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

    // ── AI Operations Layer tables ────────────────────────────────────────────
    await withRetry(() => pool.query(`
      CREATE TABLE IF NOT EXISTS ai_feature_flags (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value BOOLEAN NOT NULL DEFAULT FALSE,
        description TEXT,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by TEXT
      );

      CREATE TABLE IF NOT EXISTS ai_attribution_events (
        id SERIAL PRIMARY KEY,
        quote_id INTEGER,
        reference_no TEXT,
        event_type TEXT NOT NULL,
        source TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        utm_content TEXT,
        utm_term TEXT,
        landing_page TEXT,
        quote_value NUMERIC(10,2),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_ads_snapshots (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        snapshot_date TEXT NOT NULL,
        campaign_id TEXT,
        campaign_name TEXT,
        ad_set_id TEXT,
        ad_set_name TEXT,
        ad_id TEXT,
        ad_name TEXT,
        keyword TEXT,
        match_type TEXT,
        spend NUMERIC(10,2),
        impressions INTEGER,
        clicks INTEGER,
        conversions NUMERIC(10,2),
        conversion_value NUMERIC(10,2),
        ctr NUMERIC(10,4),
        cpc NUMERIC(10,4),
        cpl NUMERIC(10,4),
        quality_score INTEGER,
        raw_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_ad_recommendations (
        id SERIAL PRIMARY KEY,
        platform TEXT,
        action TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        target_name TEXT,
        reason TEXT,
        source_data JSONB,
        confidence NUMERIC(5,2),
        expected_effect TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_by TEXT,
        approved_at TIMESTAMP,
        applied_at TIMESTAMP,
        rollback_info TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_site_audits (
        id SERIAL PRIMARY KEY,
        audit_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        score INTEGER,
        summary TEXT,
        findings JSONB,
        triggered_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ai_site_recommendations (
        id SERIAL PRIMARY KEY,
        audit_id INTEGER,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        page TEXT,
        title TEXT NOT NULL,
        description TEXT,
        suggested_change TEXT,
        risk_level TEXT NOT NULL DEFAULT 'low',
        status TEXT NOT NULL DEFAULT 'open',
        approved_by TEXT,
        applied_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_approval_queue (
        id SERIAL PRIMARY KEY,
        queue_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        risk_level TEXT NOT NULL,
        confidence NUMERIC(5,2),
        expected_impact TEXT,
        proposed_action JSONB,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        reviewed_at TIMESTAMP,
        review_note TEXT,
        ref_type TEXT,
        ref_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ai_audit_log (
        id SERIAL PRIMARY KEY,
        action_type TEXT NOT NULL,
        actor TEXT,
        module TEXT,
        summary TEXT,
        detail JSONB,
        outcome TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      INSERT INTO ai_feature_flags (key, value, description) VALUES
        ('ai_master_kill_switch',              FALSE, 'Master kill switch — disables ALL AI automations when TRUE'),
        ('ai_ads_enabled',                     FALSE, 'Enable AI ads analysis and recommendations'),
        ('ai_ads_auto_low_risk_enabled',       FALSE, 'Allow AI to auto-apply low-risk ads actions (negatives, minor pauses)'),
        ('ai_site_audit_enabled',              TRUE,  'Enable AI site audits (CRO, SEO, Speed analysis)'),
        ('ai_site_preview_enabled',            TRUE,  'Enable AI site change previews'),
        ('ai_site_publish_enabled',            FALSE, 'Allow AI to publish approved site changes'),
        ('ai_google_ads_sync_enabled',         FALSE, 'Enable Google Ads API live sync — pulls campaign/adgroup data into ai_ads_snapshots'),
        ('ai_meta_ads_sync_enabled',           FALSE, 'Enable Meta Ads API live sync — pulls campaign/adset data into ai_ads_snapshots'),
        ('ai_search_console_enabled',          FALSE, 'Enable Google Search Console sync — pulls keyword/page performance'),
        ('ai_pagespeed_enabled',               FALSE, 'Enable PageSpeed Insights sync — pulls CWV and Lighthouse scores'),
        ('ai_scheduler_enabled',               FALSE, 'Enable automatic scheduled connector syncs'),
        ('ai_auto_execute_enabled',            FALSE, 'Allow AI to auto-execute approved actions on platforms'),
        ('ai_google_ads_execution_enabled',    FALSE, 'Enable live push of approved actions to Google Ads API'),
        ('ai_meta_ads_execution_enabled',      FALSE, 'Enable live push of approved actions to Meta Ads API'),
        ('ai_platform_execution_test_mode',    TRUE,  'When ON all platform pushes are dry-run only — no live API calls'),
        ('ai_whatsapp_agent_enabled',          FALSE, 'Enable WhatsApp AI sales agent — intercepts inbound messages for lead qualification'),
        ('ai_whatsapp_followups_enabled',      FALSE, 'Enable AI-scheduled follow-up messages (missing info, quote, deposit, booking, stale)'),
        ('ai_whatsapp_auto_qualify_enabled',   TRUE,  'Allow AI to send qualifying replies automatically inside the 24-hr window'),
        ('ai_whatsapp_template_mode_enabled',  TRUE,  'Allow template-style messages outside the 24-hr window when permitted'),
        ('ai_whatsapp_handoff_required_on_low_confidence', TRUE, 'Force human handoff when AI confidence score drops below 0.3'),
        ('ai_hot_lead_alerts_enabled',         FALSE, 'Send real-time push + WhatsApp alert when a HOT lead is detected (lead score ≥ threshold)'),
        ('ai_alert_digest_enabled',            FALSE, 'Group low-severity AI alerts into a single periodic digest push (every 15 min) instead of pushing each one individually'),
        ('ai_high_confidence_autoapprove',     FALSE, 'Allow AI to auto-approve recommendations whose confidence meets the per-action-type threshold'),
        ('ai_autoapprove_allow_high_impact',   FALSE, 'Permit auto-approve to act on budget/spend-changing actions (otherwise those always require human review)'),
        ('ai_customer_feedback_loop_enabled',  FALSE, 'After case closeout, ask the customer for a 1-5 rating via WhatsApp and store internally for AI tuning'),
        ('ai_abandoned_quote_rescue_enabled',  FALSE, 'Auto-nudge customers via WhatsApp 24h/3d/7d after a quote is sent but not booked, AND nudge abandoned web wizard leads with a phone number'),
        ('ai_review_after_rating_only',        FALSE, 'When ON, only send the Google review request to customers who rated 4+ stars first. When OFF (default), the review ask fires immediately at case close so it actually goes out for customers who never reply with a star rating.')
      ON CONFLICT (key) DO NOTHING;

      -- One-shot: flip existing installs that still have the old TRUE default,
      -- so customers who paid without sending a star rating finally receive
      -- the review ask. Marker prevents re-running once admin re-enables it.
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'mig_review_after_rating_default_off_v1') THEN
          UPDATE ai_feature_flags
            SET value = FALSE
            WHERE key = 'ai_review_after_rating_only' AND value = TRUE;
          INSERT INTO app_settings (key, value)
            VALUES ('mig_review_after_rating_default_off_v1', 'done')
            ON CONFLICT (key) DO NOTHING;
        END IF;
      END $$;

      -- One-shot: rename existing customers still labelled "WhatsApp Lead"
      -- (the old auto-name) to the more presentable "Customer". Once admin
      -- edits a customer's name to anything else it stays untouched.
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'mig_rename_whatsapp_lead_default_v1') THEN
          UPDATE customers
            SET name = 'Customer'
            WHERE name = 'WhatsApp Lead';
          INSERT INTO app_settings (key, value)
            VALUES ('mig_rename_whatsapp_lead_default_v1', 'done')
            ON CONFLICT (key) DO NOTHING;
        END IF;
      END $$;

      -- Spend guardrail ledger (Phase 9b)
      CREATE TABLE IF NOT EXISTS ai_spend_ledger (
        id SERIAL PRIMARY KEY,
        channel TEXT NOT NULL,
        sgd_delta NUMERIC(12,2) NOT NULL DEFAULT 0,
        execution_id INTEGER,
        action_type TEXT,
        campaign_name TEXT,
        decision TEXT NOT NULL DEFAULT 'allowed',
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ai_spend_ledger_created_idx ON ai_spend_ledger (created_at);

      -- Customer ratings (Phase 9c — feedback loop)
      CREATE TABLE IF NOT EXISTS customer_ratings (
        id SERIAL PRIMARY KEY,
        quote_id INTEGER,
        phone TEXT NOT NULL,
        rating INTEGER,
        comment TEXT,
        source TEXT NOT NULL DEFAULT 'whatsapp',
        status TEXT NOT NULL DEFAULT 'pending',
        prompted_at TIMESTAMP DEFAULT NOW(),
        answered_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS customer_ratings_phone_status_idx ON customer_ratings (phone, status);

      -- Spend caps in app_settings (idempotent — admin can override later)
      INSERT INTO app_settings (key, value) VALUES
        ('ai_daily_spend_cap_sgd',   '200'),
        ('ai_monthly_spend_cap_sgd', '3000'),
        ('ai_autoapprove_default_threshold', '0.9'),
        ('auto_google_review_min_rating',    '4')
      ON CONFLICT (key) DO NOTHING;
    `));

    // ── Phase 6-8: Connector configs, execution records, search console, pagespeed ──
    await withRetry(() => pool.query(`
      CREATE TABLE IF NOT EXISTS ai_connector_configs (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        last_sync_at TIMESTAMP,
        last_sync_status TEXT NOT NULL DEFAULT 'never',
        sync_error TEXT,
        account_id TEXT,
        extra_config JSONB,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      INSERT INTO ai_connector_configs (name, enabled, last_sync_status) VALUES
        ('google_ads',     FALSE, 'never'),
        ('meta_ads',       FALSE, 'never'),
        ('search_console', FALSE, 'never'),
        ('pagespeed',      FALSE, 'never')
      ON CONFLICT (name) DO NOTHING;

      CREATE TABLE IF NOT EXISTS ai_search_console_data (
        id SERIAL PRIMARY KEY,
        sync_id TEXT,
        date TEXT NOT NULL,
        query TEXT,
        page TEXT,
        country TEXT,
        device TEXT,
        clicks INTEGER NOT NULL DEFAULT 0,
        impressions INTEGER NOT NULL DEFAULT 0,
        ctr NUMERIC(10,4),
        position NUMERIC(10,2),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_pagespeed_data (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        strategy TEXT NOT NULL DEFAULT 'mobile',
        performance_score INTEGER,
        accessibility_score INTEGER,
        seo_score INTEGER,
        best_practices_score INTEGER,
        fcp_ms INTEGER,
        lcp_ms INTEGER,
        cls_score NUMERIC(10,4),
        ttfb_ms INTEGER,
        raw_audits JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ai_platform_executions (
        id SERIAL PRIMARY KEY,
        approval_queue_id INTEGER NOT NULL,
        recommendation_id INTEGER,
        platform TEXT NOT NULL,
        action_type TEXT NOT NULL,
        target_object_ids JSONB,
        proposed_change JSONB,
        executed_change JSONB,
        actor TEXT NOT NULL DEFAULT 'system',
        result_status TEXT NOT NULL DEFAULT 'pending',
        platform_response_summary TEXT,
        platform_response_raw JSONB,
        rollback_path TEXT,
        rollback_payload JSONB,
        error_message TEXT,
        test_mode BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE ai_approval_queue ADD COLUMN IF NOT EXISTS execution_status TEXT DEFAULT 'pending';
      ALTER TABLE ai_approval_queue ADD COLUMN IF NOT EXISTS execution_result JSONB;
      ALTER TABLE ai_approval_queue ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP;
    `));

    // ── Subcontractor Management ───────────────────────────────────────────────
    await withRetry(() => pool.query(`
      CREATE TABLE IF NOT EXISTS subcontractors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        company TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS job_subcontracts (
        id SERIAL PRIMARY KEY,
        quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        subcontractor_id INTEGER NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
        agreed_cost DECIMAL(10,2) NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        paid_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `));

    // ── One-time migration: rotate weak reference numbers to 48-bit random values ─
    // Weak refs: timestamp-based (TMG-digits) or short hex (TMG-XXXX / TMG-XXXXXXXX)
    // Strong refs: exactly 12 uppercase hex chars after TMG- (= randomBytes(6))
    await withRetry(() => pool.query(`
      DO $$
      DECLARE
        q   RECORD;
        new_ref TEXT;
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'mig_rotate_weak_refs_v1') THEN
          FOR q IN
            SELECT id FROM quotes
            WHERE reference_no !~ '^TMG-[0-9A-F]{12}$'
          LOOP
            LOOP
              new_ref := 'TMG-' || upper(left(md5(random()::text || q.id::text || clock_timestamp()::text), 12));
              EXIT WHEN NOT EXISTS (SELECT 1 FROM quotes WHERE reference_no = new_ref);
            END LOOP;
            UPDATE quotes SET reference_no = new_ref WHERE id = q.id;
          END LOOP;
          INSERT INTO app_settings (key, value)
            VALUES ('mig_rotate_weak_refs_v1', 'done')
            ON CONFLICT (key) DO NOTHING;
        END IF;
      END $$;
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

  // ── AI Connector Sync Scheduler ───────────────────────────────────────────
  try {
    const { startScheduler } = await import("./scheduler");
    startScheduler();
  } catch (e: any) {
    console.warn("[startup] Scheduler init warning (non-fatal):", e?.message || e);
  }

  // ── Alert digest flush (every 15 min) ────────────────────────────────────
  // When ai_alert_digest_enabled is on, low-severity alerts are queued
  // instead of being pushed individually. This periodic job groups them
  // and sends a single summary push so the admin doesn't get spammed.
  try {
    const { flushAlertDigest } = await import("./ai-alerts");
    setInterval(() => {
      flushAlertDigest(15).catch(e => console.warn("[ai-alerts] digest flush error:", e?.message));
    }, 15 * 60 * 1000);

    // Daily LLM-telemetry retention prune — keep 90 days of ai_llm_calls so
    // the table doesn't grow unbounded (architect feedback). Runs once at
    // startup then every 24h.
    const { pruneOldLlmCalls } = await import("./ai-llm-client");
    pruneOldLlmCalls(90).then(n => { if (n > 0) console.log(`[llm-client] pruned ${n} old telemetry rows`); });
    setInterval(() => {
      pruneOldLlmCalls(90).then(n => { if (n > 0) console.log(`[llm-client] pruned ${n} old telemetry rows`); })
        .catch(e => console.warn("[llm-client] prune error:", e?.message));
    }, 24 * 60 * 60 * 1000);
  } catch (e: any) {
    console.warn("[startup] alert digest init warning:", e?.message);
  }

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
