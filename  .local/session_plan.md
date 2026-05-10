# Objective
Run an in-depth production-scope security scan across the application and produce only real, exploitable findings.

# Shared context
- Stack: React/Vite frontend, Express backend, PostgreSQL via Drizzle, Android Capacitor client.
- Main production code paths: `server/index.ts`, `server/routes.ts`, `server/ai-routes.ts`, `server/storage.ts`, `shared/schema.ts`.
- Production assumptions: `NODE_ENV=production`, TLS handled by platform, `artifacts/mockup-sandbox/` is not deployed.
- Current leading hypotheses:
  - Broken access control in inline route handlers in `server/routes.ts`
  - Public data exposure through unguarded list/read endpoints
  - Weak customer portal OTP protections
  - Session-cookie risk from missing CSRF protections on state-changing endpoints
- Deterministic scans already ran. Early high-value review is centered on real route-level issues, not scan noise from dev artifacts.

# Tasks

### T001: Route-level access control and data exposure
- **Blocked By**: []
- **Details**:
  - Analyze `server/routes.ts`, `server/storage.ts`, and `shared/schema.ts` for missing auth, missing role checks, IDORs, and public leakage of quote/staff/payroll/customer data.
  - Focus on public `GET` and state-changing `/api/admin/*` and `/api/*` routes that are implemented inline without shared middleware.
  - Acceptance: Confirm which routes are exploitable in production and group related findings for reporting.

### T002: Customer portal and token-based customer access
- **Blocked By**: []
- **Details**:
  - Analyze OTP request/verify flows, quote tracking, invoice/checkout/public quote endpoints, and any reference-number or token-based access controls.
  - Focus on brute force, enumeration, replay, and cross-customer access to quote/payment data.
  - Files: `server/routes.ts`, `shared/schema.ts`, `client/src/pages/customer/*`.
  - Acceptance: Confirm whether customer-facing auth and lookup tokens meaningfully protect customer data.

### T003: CSRF and session-bound privileged actions
- **Blocked By**: []
- **Details**:
  - Evaluate whether cookie-backed admin/staff sessions can be abused cross-site because of `SameSite=None` in production and lack of anti-CSRF defenses.
  - Prioritize endpoints that mutate payroll, staff, quotes, promo codes, WhatsApp actions, and AI/platform execution settings.
  - Files: `server/index.ts`, `server/routes.ts`, `server/ai-routes.ts`.
  - Acceptance: Determine whether there is a practical CSRF issue worth reporting in production.

### T004: Webhooks, AI/external integrations, and secret-handling noise triage
- **Blocked By**: []
- **Details**:
  - Review Stripe/WhatsApp/GitHub webhooks and AI execution routes for missing verification, unsafe outbound fetches, or privilege bypasses.
  - Triage deterministic scan secret findings to exclude dev-only or non-production noise unless reachable from production.
  - Files: `server/routes.ts`, `server/ai-routes.ts`, `server/whatsapp.ts`, `server/ad-executor.ts`, `attached_assets/*` as needed for verification only.
  - Acceptance: Report only production-relevant issues with clear exploit paths.
