# Threat Model

## Project Overview

TMG Install is a full-stack React + Express + PostgreSQL application for customer quoting, job scheduling, admin operations, staff workflows, and WhatsApp-assisted customer handling. Production traffic reaches the Express server in `server/index.ts`, with most business logic and API handlers implemented in `server/routes.ts`, AI admin features in `server/ai-routes.ts`, and persistence in `server/storage.ts` / `shared/schema.ts`. The project also ships a Capacitor-based Android staff app whose trust chain depends on the mobile signing key, update signaling, and Firebase push-notification credentials.

This scan assumes production deployments run with `NODE_ENV=production`, TLS is handled by the platform, and the mockup sandbox under `artifacts/mockup-sandbox/` is not deployed to production.

## Assets

- **Admin and staff accounts** — session-backed logins control access to payroll, quote operations, live WhatsApp conversations, GPS history, and AI execution features. Account compromise leads directly to business takeover.
- **Customer job and contact data** — names, phone numbers, email addresses, service addresses, scheduling data, invoices, payment state, and internal job notes. This is sensitive personal and operational data.
- **Staff HR and payroll data** — NRIC/FIN, emergency contacts, leave, payslips, deductions, loans, attendance logs, and GPS points. Exposure would have high privacy and employment impact.
- **Payment and quote integrity** — quote totals, deposits, final payments, promo discounts, booking state, and manual payment override flows. Unauthorized changes can create direct financial loss.
- **WhatsApp / AI operations state** — customer conversations, AI follow-ups, recommendation queues, connector configs, and platform execution approvals. Abuse can send unauthorized messages or alter external ad systems.
- **Application secrets and integrations** — database credentials, session secret, Stripe webhook secret, Meta / Google / Firebase / OpenAI credentials, and push messaging keys.
- **Mobile release integrity** — Android signing keys, APK update signaling, and build webhook credentials determine whether staff devices trust a release as official.

## Trust Boundaries

- **Browser/mobile app to Express API** — all request bodies, query params, cookies, uploaded files, and headers are untrusted until validated server-side.
- **Public customer flows to authenticated admin/staff flows** — the app mixes public quote/track/payment endpoints with privileged operational APIs; server-side authorization must separate them strictly.
- **Admin to staff boundary** — staff should only access their own jobs, attendance, receipts, and limited operational data; payroll and organization-wide controls must remain admin-only.
- **Express server to PostgreSQL** — the server has broad read/write access to customer, payroll, and AI tables; broken authorization at the route layer exposes the full business dataset.
- **Express server to third parties** — Stripe, Meta WhatsApp, Google Ads, Meta Ads, Resend, Firebase, OneMap, OSRM, and OpenAI all sit beyond a boundary where secrets and outbound requests must be tightly controlled.
- **Repository / CI to production mobile trust chain** — committed signing keys, service-account JSON, or hardcoded webhook tokens can be abused outside the running server to impersonate backend or mobile release components.
- **Production vs dev-only artifacts** — `artifacts/mockup-sandbox/`, build helpers, and local-only files should usually be ignored unless production reachability is demonstrated.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/ai-routes.ts`, `server/phone-intake.ts`, `server/static.ts`
- **Highest-risk code areas:** inline authz checks in `server/routes.ts`, quote/payment flows, portal OTP routes, WhatsApp/admin messaging routes, AI execution routes, public webhook handlers, and data-returning helpers in `server/storage.ts`
- **Public surfaces:** quote wizard, tracking, invoice/payment links, promo validation, portal OTP login, WhatsApp and Stripe webhooks, landing pages, build notification webhook
- **Authenticated/admin surfaces:** most `/api/admin/*`, `/api/ai/*`, payroll/attendance/GPS endpoints, WhatsApp admin inbox, AI approvals/execution
- **Secrets / release surfaces worth checking:** Android signing config, CI workflows, committed Firebase or mobile credentials, update-signaling endpoints
- **Usually dev-only / out of scope unless proven reachable:** `artifacts/mockup-sandbox/`, attached design assets, local scripts, Android build helpers that are not part of release or credential handling

## Threat Categories

### Spoofing

The application uses cookie-backed sessions for admin and staff users and a separate portal session keyed off email OTP verification. Every privileged route must verify that a valid session exists and that the caller has the correct role. Webhook routes must verify the claimed sender, especially for Stripe and WhatsApp-related flows. Customer portal OTPs and any public reference-based access must be resistant to guessing and abuse.

### Tampering

Customers, staff, and admins can all send structured data that affects quotes, schedules, deductions, payments, and AI actions. The server must compute or verify sensitive state transitions server-side, reject unauthorized mutations, and ensure that only permitted actors can change job, payroll, promo, or payment records. Build/update signals and mobile release artifacts must also be protected against unauthorized modification.

### Information Disclosure

This application stores large amounts of PII and business-sensitive operational data. API responses must only return the minimum data needed for the authenticated caller, and public endpoints must never expose internal staff, payroll, GPS, quote, or conversation data. Logs and error paths must avoid leaking customer contact details, tokens, or secrets. Committed production credentials count as information disclosure even if they are not served over the web at runtime.

### Denial of Service

Public endpoints include OTP requests, quote creation, tracking, uploads, and webhook handlers; admin flows include LLM-backed analysis and outbound integrations. These paths must have practical input limits, request throttling where abuse is feasible, and bounded external calls so a malicious client cannot exhaust compute, email, AI spend, or disrupt messaging/update pipelines.

### Elevation of Privilege

The biggest project-specific risk is broken access control inside the large inline route file. Admin-only operations must not be reachable by unauthenticated users, ordinary staff, or portal users. Staff-scoped endpoints must enforce ownership checks. Any route that returns broad quote, customer, payroll, GPS, or WhatsApp data must validate role and scope before reading from storage. Separately, leaked signing keys or backend service credentials can let an attacker bypass the application entirely and operate with trusted backend or release privileges.
