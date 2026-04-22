# TMG Install — Replit Project Guide

## Overview

TMG Install is a full-stack platform designed for **The Moving Guy Pte Ltd** (Singapore) to manage furniture installation quoting and operations. It supports the entire workflow from customer quote submission to job completion.

Key capabilities include:
- **Customer Portal**: A 5-step estimate wizard, quote status tracking, deposit and final payment processing, appointment confirmation, and OTP-based customer login portal at `/portal`.
- **Admin Dashboard**: Tools for reviewing and approving quotes, managing bookings, scheduling staff, handling payments, and a live 12-week revenue trend area chart.
- **Staff Mobile App**: Viewing assigned jobs, GPS check-in/check-out with photo evidence, and a 7-item job completion checklist for in-progress jobs.
- **Subcontractor Management**: Full CRUD for subcontractors at `/admin/subcontractors`. Assign subcontractors to any job from the QuoteDetail view with agreed costs. Track payment status (paid/unpaid), view per-subcontractor job history, and see profit/payables summary cards. Net profit (revenue minus sub costs) is surfaced on the Dashboard and QuoteDetail.
- **Automation**: Day-before WhatsApp reminder scheduler (hourly), loyalty discount for returning customers (5%), both toggleable from Admin Settings.
- **PayNow QR**: Customer-facing PayNow QR code shown alongside Stripe button when deposit is due.
- **Language Toggle**: EN/CN switch on the landing page (hero text, CTA labels, persistent to localStorage).
- **PWA**: Service worker at `/sw.js` for offline caching.

The application is built as a monorepo utilizing a React frontend, an Express backend, and a PostgreSQL database managed with Drizzle ORM. Email functionalities are handled via Resend, and AI features are integrated using OpenAI through Replit AI Integrations. A custom-designed email system with 8 templates covers all workflow stages, providing clear communication and status updates to customers.

## User Preferences

Preferred communication style: Simple, everyday language.
Always provide full file contents when editing any code file — never partial snippets or diffs.

## System Architecture

### Frontend (React + Vite)
- **Technology Stack**: React 18 with TypeScript, Vite for bundling, `wouter` for routing, and TanStack Query for state management and data fetching.
- **UI/UX**: Utilizes `shadcn/ui`, Radix UI, and Tailwind CSS for components and styling, with Framer Motion for animations.
- **Performance**: Leverages `React.lazy` and `Suspense` for code splitting and `Vite manualChunks` for optimized vendor dependency loading. Build target is `es2020` (no legacy polyfills). `reportCompressedSize: false` keeps builds fast (~25s). Vendor chunks: `vendor-react`, `vendor-query`, `vendor-motion`, `vendor-charts`, `vendor-maps`, `vendor-radix`.
- **Core Pages**: Includes a comprehensive landing page, a multi-step estimate wizard, customer quote status pages, and distinct admin and staff dashboards with job management and tracking functionalities.
- **Admin Layout**: Features a fixed left sidebar for desktop (`AdminSidebar`) and a tabbed bottom navigation for mobile (`AdminBottomNav`), both providing live badge counts.

### Android Native App (Capacitor)
- **Deployment**: `com.tmginstall.staff` app targeting `https://tmginstall.com/staff/login` via WebView.
- **GPS Tracking**: Employs `@capacitor-community/background-geolocation` with a custom `use-background-location.ts` hook for persistent, throttled GPS tracking (sending data to `POST /api/staff/gps-track`). Includes a Java-based `TMGLocationService` and `BootReceiver` for always-on tracking even after app termination or reboot.
- **Push Notifications**: Integrated with Firebase FCM, allowing the backend to send notifications for job assignments. FCM tokens are stored per user.
- **Deep Linking**: Supports `tmginstall://job/:id` and `https://tmginstall.com/staff/jobs/*` for direct navigation within the app.
- **Offline Capabilities**: `use-offline-cache.ts` hook enables staff to view cached job data when offline, with banners indicating connection status.
- **Branding**: Custom TMG-branded app icons and notification icons across all Android densities.
- **Permissions**: Requires extensive location, notification, camera, and boot permissions.
- **Build Process**: Automated local and CI builds for debug and release APKs/AABs, with signing configured via environment variables.
- **GPS Data**: Tracked points are stored in the `gps_track_points` table.

### Backend (Express + Node.js)
- **Structure**: Entry point `server/index.ts` routes requests through `server/routes.ts` and uses `server/storage.ts`.
- **Authentication**: Simple mock authentication for admin and staff users.
- **Key API Endpoints**: Comprehensive API for managing quotes (submission, status updates, payments, booking, editing), staff job actions (check-in/out), catalog item retrieval (including GPT-4o vision integration for item detection), and slot availability.
- **Email System (`server/email.ts`)**: Manages all transactional emails, including deposit requests, confirmations, booking updates, final payment requests, and case closure notifications, all with detailed breakdowns and contact information.
- **Status State Machine**: Implements a defined workflow for quotes: `submitted` → `deposit_requested` → `deposit_paid` → `booking_requested` → `booked` → `assigned` → `in_progress` → `completed` → `final_payment_requested` → `final_paid` → `closed`, with a `cancelled` state.

### Database (PostgreSQL + Drizzle ORM)
- **Schema**: Defined in `shared/schema.ts`.
- **Tables**: Includes `users`, `customers`, `catalog_items`, `quotes`, `quote_items`, `job_updates`, `promo_codes`, and `attendance_logs`.
- **Key Fields**: `quotes` table tracks status, reschedule count, booking details, amounts, payment statuses, and promo code applied (`promo_code`, `promo_discount`). `job_updates` stores photo URLs as JSON arrays.
- **Seeding**: `server/seed.ts` runs on every startup (idempotent rounds). 11 rounds total: Rounds 1–9 seed catalog items; Round 10 adds dispose/dismantle_dispose coverage; Round 11 (SG-MARKET-R1, April 2026) applies market-calibrated price corrections based on 2025 Singapore competitor research (Airtasker, ITB, LocalHandymanSG, Kaodim).
- **Booking Rules**: Enforces rules for customer booking requests, admin confirmations, and reschedule limitations.

### AI Ops — Phase 7: Ad Platform Execution Layer
- **`server/ad-executor.ts`**: Execution engine for Google Ads (negative keywords, pause/enable ad/adgroup, budget adjust +10% cap) and Meta Ads (pause/enable ad/adset, budget adjust). Test mode generates full payload without live API call. Export-only path for unsupported/missing-ID items.
- **`ai_platform_executions` table**: Full audit trail per execution — platform, action type, target IDs, result status, rollback path, test mode flag, error message, actor.
- **3 execution flags**: `ai_google_ads_execution_enabled`, `ai_meta_ads_execution_enabled`, `ai_platform_execution_test_mode` (defaults: false, false, true).
- **API routes**: `POST /api/ai/approvals/:id/platform-execute`, `GET /api/ai/platform-executions`, `PATCH /api/ai/connectors/:name/execution-config` (toggle execution_enabled/test_mode per connector).
- **AIApprovalQueue.tsx**: Platform badge (Google Ads/Meta Ads) on ad items; "Push to Platform" button in execution-complete footer (violet, with Rocket/Send icons); `PlatformExecutionSection` in expanded detail panel showing result status, summary, rollback path, dry-run payload.
- **AIConnectors.tsx**: "Platform Execution" section per connector card (google_ads, meta_ads only) — execution toggle, test-mode toggle, missing-creds warning, live-mode safety warning, status badge (OFF/Test Mode/Live).
- **AIHub.tsx**: 3 new feature flag entries for the execution flags.
- **Safety**: Kill switch always respected. Per-platform flag + connector execution_enabled must both be ON. Budget cap +10% max. Test mode default=true (no live calls unless deliberately disabled).
- **Phase 8 — Controlled Live Pilot**: `PILOT_LIVE_SAFE_ACTION_TYPES` constant added to `ad-executor.ts`. Live API calls allowed ONLY for: `negative_keyword_add` (Google Ads), `pause_ad`, `enable_ad`, `pause_ad_group`, `enable_ad_group` (Google Ads), `pause_adset`, `enable_adset` (Meta Ads). Budget adjustments are permanently fenced to dry-run mode (even when connector is in live mode). Idempotency check: `ai_platform_executions` is queried before each push — returns 409 if already pushed. Extra live-mode gate: `ai_ads_enabled` + `ai_auto_execute_enabled` must both be ON for live execution. UI: push button is violet (dry-run) or red (live), readiness indicator above button, better status labels (Dry Run Complete / Live Push Succeeded / Live Push Failed / Export Only — apply manually), receipt row showing execution ID and action type, raw response toggle available for all statuses.

### AI Pricing Coach (admin productivity)
- **`POST /api/ai/pricing-coach`** in `server/ai-routes.ts`: takes a draft job (jobType, items, services, floor/lift access, notes), fuzzy-matches items to `catalog_items` via ILIKE keywords, and calls gpt-4o through `callLLM` with curated SG market intelligence (Lalamove/Helpling/movers benchmarks) baked into the prompt.
- **Catalog targeting**: relocation jobs query `service_type='relocate'`; standard jobs query the union `install/dismantle/dispose/dismantle_dispose` so install items are graded against their authoritative catalog rows.
- **Response shape**: `{summary, recommendedTotal, confidence, priceCheck[{name,entered,catalog,catalogMatch,delta,verdict}], reasoning[], competitive[], addOns[], meta}`. JSON parsing + Zod validation handled in-route (not via callLLM's schema repair) so we can log raw output and unwrap accidental wrapper objects.
- **Input bounds**: description ≤200, notes ≤1500, services items ≤60×10, items ≤30 — protects against runaway token cost.
- **UI** in `CreateJobModal.tsx`: violet/blue gradient "AI Pricing Coach" button below pricing summary opens an expandable card with per-item verdict badges, reasoning bullets, SG competitor benchmarks, and clickable add-on chips. "Use this total →" applies recommendation to Override Total. Coach state cleared on resetForm.
- **Curated SG benchmarks** baked into prompt — refresh quarterly. Live web scraping intentionally avoided (latency, blocking, fragility).

### Promo Campaign System
- **`promo_codes` table**: Stores discount codes with `code`, `discount_amount`, `max_uses`, `uses_count`, and `active` fields.
- **Announcement bar**: Scrolling amber ticker bar at the very top of all customer pages (above the navbar). Dismissable per session via `sessionStorage`. Auto-hides when slots are exhausted.
- **Hook**: `client/src/hooks/use-promo-bar.ts` — fetches promo data, manages dismissed state in sessionStorage.
- **Estimate wizard promo field**: Promo code input in Step 5 (Your Details) with live validation and green confirmation. Discount shown in the estimate summary. Code + discount sent to the server on submission.
- **Admin**: Settings page has a "Promo Campaign" card — view usage/remaining slots, toggle active/inactive, reset usage count, edit code/discount/max uses.
- **Routes**: `GET /api/promo-bar` (public), `POST /api/promo/validate` (public), `GET|POST /api/admin/promo/*` (admin-protected).
- **Seeded**: `TMG50` — $50 off for first 100 customers, active by default.

### Admin Design System — "Yeezy" Aesthetic
- **Visual Language**: A mobile-first design inspired by Yeezy.com, characterized by a flat, editorial, and monochrome aesthetic.
- **Styling Principles**: Features `bg-slate-50` page wrapper, `bg-slate-950` dark hero headers with uppercase bold typography, `rounded-none` cards without shadows, and flat, square, uppercase buttons.
- **Consistent Elements**: Section labels are small, bold, and uppercase. Form inputs are border-only with no rounding. Grid layouts prioritize `grid-cols-1` for mobile responsiveness.
- **Specific Components**: Custom styling for stat grids, toggle switchers, the `AdminBottomNav`, and mobile action bars, all adhering to the flat, minimal design.

## External Dependencies

- **PostgreSQL**: Primary database.
- **Resend**: Transactional email service.
- **OpenAI (via Replit AI)**: Used for quote estimation and photo analysis.
- **OneMap SG (Public API)**: Provides Singapore address autocomplete functionality.