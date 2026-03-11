# TMG Install — Replit Project Guide

## Overview

TMG Install is a full-stack furniture installation quoting and operations platform for **The Moving Guy Pte Ltd** (Singapore). It handles the complete workflow from customer quote submission through job completion:

- **Customer side**: 4-step estimate wizard (`/estimate`) → quote status → deposit payment → booking slot request → confirmed appointment → final payment
- **Admin side**: Review quotes, approve & request deposit, edit quotes before deposit, confirm booking slots, manage schedule, assign staff, request final payment
- **Staff side**: View active jobs (deposit paid+), GPS check-in with photos (Arrived), GPS check-out with photos (Completed)

The app is a monorepo with a React frontend (Vite), Express backend, and PostgreSQL database via Drizzle ORM. Email via Resend. AI features use OpenAI via Replit AI Integrations.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend (React + Vite)
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: `wouter`
- **State / data fetching**: TanStack Query (`@tanstack/react-query`)
- **UI components**: shadcn/ui + Radix UI + Tailwind CSS
- **Animations**: Framer Motion
- **Key pages**:
  - `/` — Landing page with AI quote widget
  - `/estimate` — 4-step quote wizard
  - `/quotes/:id` — Customer quote status, booking, payment, reschedule
  - `/admin/login` — Login for admin/staff
  - `/admin` — Admin dashboard (6-section: New/Awaiting Deposit/Pending Booking/Upcoming/Active/Final Payment)
  - `/admin/schedule` — Schedule Management (pending + confirmed bookings)
  - `/admin/quotes/:id` — Quote detail with full editing, actions, timeline
  - `/staff` — Staff job list (deposit_paid+ status only)
  - `/staff/jobs/:id` — Staff job detail with GPS + photo check-in/checkout

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
  - `GET /api/catalog` — Catalog items (optional ?search=)
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
