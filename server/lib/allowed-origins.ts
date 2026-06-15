// =============================================================================
// CSRF / CORS allowed-origin set builder
//
// The Express server only accepts state-changing /api requests (and sets CORS
// headers) for origins in this allow-list. If the app's own Replit preview /
// deployment domains are missing from it, every login, terms-acceptance, and
// refund silently fails with HTTP 403 in those environments — so this logic is
// extracted here as a small, pure, testable helper.
//
// Sources, in order:
//   - hard-coded defaults (localhost, Capacitor native, the .replit.app host)
//   - APP_URL                 single absolute URL (production override)
//   - ALLOWED_ORIGINS_EXTRA   comma-separated list of absolute URLs
//   - REPLIT_DOMAINS          comma-separated bare hostnames (no scheme)
//   - REPLIT_DEV_DOMAIN       comma-separated bare hostnames (no scheme)
// =============================================================================

export const DEFAULT_ALLOWED_ORIGINS = [
  "capacitor://localhost",
  "http://localhost",
  "https://localhost",
  "http://localhost:5000",
  "https://tmg-install-project--tmginstall.replit.app",
];

type EnvLike = Record<string, string | undefined>;

// Build the allowed-origin set from hard-coded defaults plus any extra origins
// supplied at runtime. Malformed values are ignored rather than throwing so a
// bad env var can never crash startup.
export function buildAllowedOrigins(env: EnvLike = process.env): Set<string> {
  const origins = new Set<string>(DEFAULT_ALLOWED_ORIGINS);

  // APP_URL: a single absolute URL (e.g. https://app.example.com).
  if (env.APP_URL) {
    try { origins.add(new URL(env.APP_URL).origin); } catch { /* ignore malformed */ }
  }

  // ALLOWED_ORIGINS_EXTRA: comma-separated list of absolute URLs.
  if (env.ALLOWED_ORIGINS_EXTRA) {
    for (const raw of env.ALLOWED_ORIGINS_EXTRA.split(",")) {
      const trimmed = raw.trim();
      if (trimmed) {
        try { origins.add(new URL(trimmed).origin); } catch { /* ignore malformed */ }
      }
    }
  }

  // REPLIT_DOMAINS / REPLIT_DEV_DOMAIN: comma-separated bare hostnames (no
  // scheme). These are provided by the Replit runtime so the app works inside
  // the webview (dev) and on the .replit.app deployment without manual config.
  for (const envName of ["REPLIT_DOMAINS", "REPLIT_DEV_DOMAIN"]) {
    const value = env[envName];
    if (!value) continue;
    for (const raw of value.split(",")) {
      const host = raw.trim();
      if (host) {
        try { origins.add(new URL(`https://${host}`).origin); } catch { /* ignore malformed */ }
      }
    }
  }

  return origins;
}
