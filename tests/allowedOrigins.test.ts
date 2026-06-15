// =============================================================================
// CSRF / CORS allowed-origin builder tests
//
// Run: npx tsx --test tests/allowedOrigins.test.ts
//
// Guards against the regression where the server's cross-site allow-list left
// out the app's own Replit preview/deployment web addresses, which silently
// blocked every login, terms-acceptance, and refund (HTTP 403) in those
// environments. buildAllowedOrigins is the exact set used by both the CORS
// header middleware and the CSRF Origin/Referer gate in server/index.ts, so
// testing it covers the "logins + payments keep working after deploy" guarantee.
//
// Pure logic only — no DB, network, or secrets required. Deterministic.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAllowedOrigins, DEFAULT_ALLOWED_ORIGINS } from "../server/lib/allowed-origins.ts";

test("the Replit deployment domain (REPLIT_DOMAINS) is accepted", () => {
  const origins = buildAllowedOrigins({
    REPLIT_DOMAINS: "tmg-install-project.replit.app",
  });
  assert.ok(
    origins.has("https://tmg-install-project.replit.app"),
    "the app's own deployment domain must be allowed or every POST 403s",
  );
});

test("the Replit dev preview domain (REPLIT_DEV_DOMAIN) is accepted", () => {
  const origins = buildAllowedOrigins({
    REPLIT_DEV_DOMAIN: "abc123-00-xyz.worf.replit.dev",
  });
  assert.ok(
    origins.has("https://abc123-00-xyz.worf.replit.dev"),
    "the dev webview domain must be allowed so logins work in the preview",
  );
});

test("multiple comma-separated Replit domains are all accepted", () => {
  const origins = buildAllowedOrigins({
    REPLIT_DOMAINS: "one.replit.app, two.replit.app",
  });
  assert.ok(origins.has("https://one.replit.app"));
  assert.ok(origins.has("https://two.replit.app"));
});

test("a foreign / attacker origin is rejected", () => {
  const origins = buildAllowedOrigins({
    REPLIT_DOMAINS: "tmg-install-project.replit.app",
  });
  assert.equal(
    origins.has("https://evil.example.com"),
    false,
    "an unrelated origin must never be in the allow-list",
  );
});

test("hard-coded defaults (localhost, Capacitor, .replit.app) are always present", () => {
  const origins = buildAllowedOrigins({});
  for (const expected of DEFAULT_ALLOWED_ORIGINS) {
    assert.ok(origins.has(expected), `default origin ${expected} must be present`);
  }
});

test("APP_URL and ALLOWED_ORIGINS_EXTRA add their origins (production override)", () => {
  const origins = buildAllowedOrigins({
    APP_URL: "https://app.themovingguy.sg/some/path",
    ALLOWED_ORIGINS_EXTRA: "https://extra1.example.com, https://extra2.example.com:8443",
  });
  // URL.origin strips path/query, keeps scheme+host(+port)
  assert.ok(origins.has("https://app.themovingguy.sg"));
  assert.ok(origins.has("https://extra1.example.com"));
  assert.ok(origins.has("https://extra2.example.com:8443"));
});

test("malformed env values are ignored, never throw", () => {
  assert.doesNotThrow(() => {
    const origins = buildAllowedOrigins({
      APP_URL: "not a url",
      ALLOWED_ORIGINS_EXTRA: "::::, also-bad",
      REPLIT_DOMAINS: " , ",
    });
    // Defaults still intact despite the garbage input.
    assert.ok(origins.has("http://localhost:5000"));
  });
});
