# TMG Install — Replit Project Guide

## Overview

TMG Install is a full-stack furniture installation quoting and operations platform for **The Moving Guy Pte Ltd** (Singapore). It handles the complete workflow from customer quote submission through job completion:

- **Customer side**: 5-step estimate wizard (`/estimate`) → quote status → deposit payment → confirmed appointment → final payment
- **Admin side**: Review quotes, approve & request deposit, edit quotes before deposit, confirm booking slots, manage schedule, assign staff, request final payment
- **Staff side**: View active jobs (deposit paid+), GPS check-in with photos (Arrived), GPS check-out with photos (Completed)

The app is a monorepo with a React frontend (Vite), Express backend, and PostgreSQL database via Drizzle ORM. Email via Resend. AI features use OpenAI via Replit AI Integrations.

**Email system**: Fully redesigned in `server/email.ts` using a monochrome black/white design that matches the TMG Install brand. 8 email templates cover all workflow steps with step indicators (1–5), T&C links, cancellation policy, phase-appropriate content, and a receipt/case-closed email. A new "estimate submitted" confirmation email is sent to customers on wizard completion.

---

## User Preferences

Preferred communication style: Simple, everyday language.
Always provide full file contents when editing any code file — never partial snippets or diffs.

---

## System Architecture

### Frontend (React + Vite)
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: `wouter`
- **State / data fetching**: TanStack Query (`@tanstack/react-query`)
- **UI components**: shadcn/ui + Radix UI + Tailwind CSS
- **Animations**: Framer Motion
- **Code splitting**: All pages except Landing use `React.lazy` + `Suspense` for chunk-based loading. Vite `manualChunks` splits vendor deps (react, query, framer-motion, recharts, maps) into separate cacheable bundles.
- **Key pages**:
  - `/` — Landing page (marquee ticker, catalog grid, 3-panel reviews, FAQ accordion, mobile stats strip)
  - `/estimate` — 5-step quote wizard (Services → Address → Items → Schedule → Review)
  - `/quotes/:id` — Customer quote status, booking, payment, reschedule
  - `/admin/login` — Login for admin/staff
  - `/admin` — Admin dashboard (6-section: New/Awaiting Deposit/Pending Booking/Upcoming/Active/Final Payment, pipeline value metric, real-time quote search bar)
  - `/admin/schedule` — Schedule Management (pending + confirmed bookings)
  - `/admin/quotes/:id` — Quote detail with full editing, actions, timeline
  - `/staff` — Staff job list (deposit_paid+ status only)
  - `/staff/jobs/:id` — Staff job detail with GPS + photo check-in/checkout
- **Admin layout**: `AdminSidebar` (`client/src/components/layout/AdminSidebar.tsx`) — fixed left sidebar (w-56, bg-slate-950) with live badge counts for pending items. Visible at `lg+` only; all admin pages have `lg:pl-56` offset. ExportPDF uses `lg:left-56` (fixed-position). Mobile: `AdminBottomNav` (5-tab, badge counts). Navbar admin links hidden at lg+ (sidebar takes over).

### Android Native App (Capacitor)
- **App ID**: `com.tmginstall.staff` · **appName**: TMG Staff · **versionCode**: 2, **versionName**: 1.1
- **WebView target**: `https://tmginstall.com/staff/login` (live URL — no APK reinstall needed for code updates)
- **Background geolocation**: `@capacitor-community/background-geolocation@1.2.26` — foreground service keeps tracking alive when app is minimised or screen is off
- **Hook**: `client/src/hooks/use-background-location.ts`
  - On Android native: uses `BackgroundGeolocation.addWatcher` with a persistent foreground-service notification
  - On web: falls back to `navigator.geolocation.watchPosition` (foreground only)
  - Module-level singletons so tracking survives React re-renders/unmounts
  - Throttle: sends at most once per 25 s OR if moved ≥ 20 m (whichever comes first)
  - Pings `POST /api/staff/gps-track` with `{staffId, lat, lng, accuracy, speed, heading}`
- **Always-on GPS (post-boot)**: `TMGLocationService.java` — `START_STICKY` foreground service that persists after app is killed. Posts GPS directly to `https://tmginstall.com/api/staff/gps-track`. `BootReceiver.java` restarts the service on `BOOT_COMPLETED` if tracking was active (detected via SharedPreferences). Exposed to React via `TMGLocationPlugin.java`.
- **Integration points**:
  - `JobDetail.tsx` — calls `startTracking(userId)` on "Arrived" check-in, `stopTracking()` on "Completed"
  - `Dashboard.tsx` (staff) — auto-resumes tracking on mount if there's an `in_progress` job; shows "GPS On" pill
- **Push notifications**:
  - Backend: `sendPushNotification(token, title, body, data)` in `server/email.ts` sends via Firebase FCM API
  - `POST /api/staff/fcm-token` — stores FCM token per user (fcm_token column on users table)
  - Push sent on job assignment (admin assigning a quote to staff)
  - Frontend hook: `client/src/hooks/use-push-notifications.ts` — registers device, stores token, handles deep-link taps
  - **Firebase setup required by user**: add `google-services.json` to `android/app/` and set `FIREBASE_SERVER_KEY` env var
- **Deep links**: `tmginstall://job/:id` (custom scheme) + `https://tmginstall.com/staff/jobs/*` (App Link). `useDeepLinks()` hook in `App.tsx` handles navigation.
- **Splash screen**: `@capacitor/splash-screen` with `launchAutoHide: false`; `SplashHider` component in `App.tsx` hides after 1.5 s + auth check.
- **Offline mode**:
  - `client/src/hooks/use-offline-cache.ts` — `useOnlineStatus()`, `useWithOfflineCache(key, data, loading)`, `useOfflineBanner()`
  - Staff Dashboard uses `useWithOfflineCache` to serve cached jobs when offline; shows "Offline — showing cached data" / "Back online" banner
- **App icons**: TMG-branded (black background, white shield/mountain logo, TMG text). All 6 Android mipmap densities (mdpi → xxxhdpi) + adaptive icon XML. Play Store icon (512×512) + feature graphic (1024×500) in `attached_assets/`.
- **Notification icon**: `android/app/src/main/res/drawable/ic_stat_tmg.png` (white-on-transparent, small icon spec)
- **AndroidManifest.xml permissions**: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` (Android 10+), `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION` (Android 14+), `POST_NOTIFICATIONS`, `CAMERA`, `RECEIVE_BOOT_COMPLETED`, `INTERNET`, `VIBRATE`
- **Signing (release builds)**:
  - Keystore: `android/app/tmg-staff-release.keystore` (alias: `tmg-staff`, 2048-bit RSA, 10 000-day validity)
  - Credentials: `KEYSTORE_PASSWORD=TMGInstall2024!`, `KEY_ALIAS=tmg-staff`
  - Base64 for GitHub Actions: `android/app/tmg-staff-release.keystore.b64` (set as `KEYSTORE_BASE64` secret)
  - `build.gradle` reads signing config from env vars `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`
- **Build**:
  - Local debug: `bash build-android.sh` (requires JDK 17+, `ANDROID_HOME` set)
  - Local release: `RELEASE=1 bash build-android.sh` (also produces `.aab` for Play Store)
  - CI: `.github/workflows/build-android.yml` — always builds debug APK; builds signed release APK + AAB when `KEYSTORE_BASE64` / `KEYSTORE_PASSWORD` / `KEY_ALIAS` GitHub secrets are set
  - CI artifacts: `tmg-staff-debug-apk` (30-day), `tmg-staff-release-aab` (90-day), `tmg-staff-release-apk` (90-day)
  - Downloadable project: `tmg-android-project.tar.gz`
- **GPS track data**: stored in `gps_track_points` table, viewable in Admin → Staff & HR → GPS Track tab

### Backend (Express + Node.js)
- **Entry**: `server/index.ts` → `server/routes.ts` → `server/storage.ts`
- **Auth**: Mock auth — simple password check. Credentials: admin/password123, staff1/password123. Login caches user client-side.
- **Key API endpoints**:
  - `POST /api/auth/login` — Login
  - `GET /api/quotes` — List all quotes (optional ?status= filter)
  - `GET /api/quotes/schedule` — Returns `{pending, confirmed}` for schedule management
  - `GET /api/quotes/:id` — Quote detail with customer, items, updates
  - `POST /api/quotes/wizard` — Submit wizard quote
  - `PATCH /api/quotes/:id/status` — Generic status update (admin)
  - `PATCH /api/quotes/:id/payment` — Record deposit or final payment
  - `POST /api/quotes/:id/booking-request` — Customer requests booking slot
  - `POST /api/quotes/:id/booking-confirm` — Admin confirms booking (sends email)
  - `POST /api/quotes/:id/booking-reschedule` — Customer reschedules (max 1 free, 24hr cutoff)
  - `PATCH /api/quotes/:id/edit` — Admin edit quote (customer, address, items — before deposit only)
  - `POST /api/quotes/:id/arrived` — Staff check-in (GPS + photos required)
  - `POST /api/quotes/:id/completed-checkout` — Staff check-out (GPS + photos required)
  - `POST /api/quotes/:id/request-final-payment` — Admin sends final payment email
  - `POST /api/quotes/:id/close` — Admin manual close
  - `GET /api/slots/availability` — Returns blocked dates + held slots from active quotes (used by wizard Step 4)
  - `GET /api/catalog` — Catalog items (optional ?search=). Items now include `volumeM3` field for Toyota Hiace trip calculation.
  - `POST /api/catalog/detect-items` — GPT-4o vision photo item detection

### Email System (`server/email.ts`)
All emails include full itemized breakdown + totals + addresses + WhatsApp contact:
- `depositRequestEmail` — Deposit requested, full quote breakdown + payment link
- `depositReceivedEmail` — Deposit paid, booking link + rules (1 reschedule, admin confirms)
- `bookingRequestAdminEmail` — Admin notification of new booking request
- `bookingConfirmationEmail` — Customer confirmation email (after admin confirms)
- `rescheduleConfirmationEmail` — Reschedule request received
- `finalPaymentEmail` — Final balance due + payment link
- `caseClosedEmail` — Payment received, case closed

### Status State Machine
```
submitted → deposit_requested → deposit_paid → booking_requested → booked → assigned → in_progress → completed → final_payment_requested → final_paid → closed
                                                                                                                                      ↑ auto-close on final payment
```
Also: `cancelled` (any time via admin)

### Database (PostgreSQL + Drizzle ORM)
- **Schema**: `shared/schema.ts`
- **Tables**: users, customers, catalog_items, quotes, quote_items, job_updates
- **Key quote fields**: `status`, `rescheduledCount`, `bookingRequestedAt`, `scheduledAt`, `timeWindow`, `depositAmount`, `depositPaidAt`, `finalAmount`, `finalPaidAt`, `paymentStatus`, `notes`
- **job_updates**: `photoUrl` stores JSON array of photo URLs for multiple proof photos
- **Seeding**: `server/run-seed.ts` — run manually with `npx tsx server/run-seed.ts`
- **217 catalog items** across 19 categories (IKEA, Beds, Wardrobes, Sofas, Office, Kids, etc.)

### Booking Rules
- Customer can only request booking after deposit is paid
- A second request is blocked if one is already pending
- Admin must confirm all bookings (sends confirmation email)
- 1 free reschedule, blocked if <24 hours before appointment
- `rescheduledCount` tracked on quote; incremented on reschedule

---

## External Dependencies

| Service | Purpose | Env Var(s) |
|---|---|---|
| **PostgreSQL** | Primary database | `DATABASE_URL` |
| **Resend** | Transactional email | `RESEND_API_KEY`, `FROM_EMAIL` |
| **OpenAI (via Replit AI)** | Quote estimation, photo analysis | Auto-configured via Replit AI Integrations |
| **OneMap SG (Public API)** | Singapore address autocomplete | No key required |

### Company Info
- Sales email: sales@tmginstall.com
- WhatsApp: +65 8088 0757 (link: https://wa.me/6580880757)
- Admin notifications to: sales@tmginstall.com

---

## Admin Design System — "Yeezy" Aesthetic (Mobile-First)

All admin pages follow a consistent flat, editorial visual language inspired by Yeezy.com:

- **Page wrapper**: `bg-slate-50 overflow-x-hidden` with `pt-14 pb-32 lg:pb-20`
- **Dark hero header**: `bg-slate-950 text-white` with h1 using `font-heading font-black uppercase tracking-[-0.02em]`
- **Cards**: `bg-white border border-black/[0.07]` — NO rounding (`rounded-none`), NO shadows
- **Buttons (primary)**: `bg-black text-white font-black uppercase tracking-[0.1em] hover:bg-neutral-800` — flat, square
- **Buttons (on dark bg)**: `bg-white text-black font-black uppercase tracking-[0.1em] hover:bg-white/90` — flat, square
- **Buttons (secondary)**: `border border-black/10 font-black uppercase tracking-[0.1em] hover:bg-slate-50` — flat, square
- **Section labels**: `text-[10px] font-black text-black/35 uppercase tracking-[0.2em]`
- **Section header accent**: `w-1.5 h-4` flat colored bar + uppercase tracking label (no rounded dots)
- **Form inputs**: `border border-black/10 outline-none focus:border-black bg-white` — no rounding
- **Grids**: Always use `grid-cols-1` prefix — e.g. `grid grid-cols-1 lg:grid-cols-2` (prevents mobile overflow)
- **Toggle/sub-tab switchers**: `border border-black/10` container, active = `bg-black text-white`, inactive = `hover:bg-slate-50`
- **Stat grids**: `grid gap-px bg-black/[0.06]` cells each `bg-white p-4` — creates ruled grid effect
- **AdminBottomNav**: `fixed bottom-0 sm:hidden z-50 h-16`; active tab = flat `bg-white` square with black icon; labels `text-[9px] font-black uppercase tracking-[0.12em]`
- **Mobile action bars**: `fixed bottom-16 sm:bottom-0 inset-x-0 lg:hidden z-40 bg-white border-t border-black/10`
- **Empty states**: `border border-dashed border-black/20` (no rounded corners)
- **Overflow fix rule**: Never use responsive-only `grid X:grid-cols-N` — always add explicit `grid-cols-1`

### QuoteDetail specifics
- Hero: reference no + customer name (left), total amount (right) on dark bg
- Pipeline card: no `overflow-hidden`, uses inner `overflow-x-auto -mx-4 px-4`
- Contact buttons: `grid grid-cols-3 gap-2`, each `flex flex-col items-center`
- Payment Status: "Total Contract Value" header + numbered deposit/balance rows with color states
