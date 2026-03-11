# TMG Install — Replit Project Guide

## Overview

TMG Install is a full-stack furniture installation quoting and operations platform for **The Moving Guy Pte Ltd** (Singapore). It handles the complete workflow from customer quote submission through job completion:

- **Customer side**: 4-step estimate wizard (`/estimate`) → quote submission → deposit payment → booking slot selection
- **Admin side**: Review incoming requests, approve quotes, send deposit/payment links, assign staff
- **Staff side**: View assigned jobs, submit progress updates, mark completion

The app is a monorepo with a React frontend (Vite), an Express backend, and a PostgreSQL database via Drizzle ORM. Email is sent via Resend. Stripe is integrated for payments. AI features (quote estimation, photo analysis) use OpenAI via Replit AI Integrations.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend (React + Vite)
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: `wouter` (lightweight client-side routing)
- **State / data fetching**: TanStack Query (`@tanstack/react-query`) with a centralized `queryClient`
- **UI components**: shadcn/ui (New York style) on top of Radix UI primitives, styled with Tailwind CSS
- **Forms**: React Hook Form + `@hookform/resolvers` with Zod validation
- **Animations**: Framer Motion
- **Font stack**: Plus Jakarta Sans (body), Outfit (display)
- **Key pages**:
  - `/` — Landing page
  - `/estimate` — 4-step quote wizard (service selection → address → item catalog → customer details → result)
  - `/quote-status` — Customer quote status lookup
  - `/admin/login`, `/admin`, `/admin/quote/:id` — Admin dashboard & quote detail
  - `/staff`, `/staff/job/:id` — Staff job list & detail

### Backend (Express + Node.js)
- **Server**: Express 5 running on Node.js with `tsx` for development
- **Entry**: `server/index.ts` → `server/routes.ts` → `server/storage.ts`
- **Build**: Custom `script/build.ts` using esbuild (server) + Vite (client) → `dist/`
- **Session / auth**: Cookie-based sessions (express-session + connect-pg-simple). Route guards check `user.role` (`admin` | `staff`). Currently mock auth — passwords stored in plain text in DB (needs hardening before production).
- **API routes**: Defined with typed contracts in `shared/routes.ts` using Zod schemas. Pattern: `api.<resource>.<action>.path` and `api.<resource>.<action>.method`
- **Storage layer**: `server/storage.ts` — `DatabaseStorage` class implements `IStorage` interface; all DB calls go through here
- **Email**: `server/email.ts` — Resend API via plain HTTP fetch. Templates for deposit request, booking confirmation, final payment
- **AI integration**: OpenAI client configured via Replit AI Integrations env vars (`AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`). Used for quote estimation and photo analysis
- **File uploads**: Multer (listed in build allowlist)
- **Payments**: Stripe (listed in build allowlist)

### Shared Layer
- `shared/schema.ts` — All Drizzle table definitions and Zod insert schemas
- `shared/routes.ts` — Typed API route contracts shared between client and server
- `shared/models/chat.ts` — Conversation/message tables for AI chat feature

### Database (PostgreSQL + Drizzle ORM)
- **Dialect**: PostgreSQL (configured in `drizzle.config.ts`)
- **Connection**: `server/db.ts` uses `pg` Pool + `drizzle-orm/node-postgres`
- **Migrations**: `drizzle-kit push` / migration files in `./migrations/`
- **Schema tables**:
  - `users` — Admin and staff accounts (role: `admin` | `staff`)
  - `customers` — Customer contact records
  - `catalog_items` — Furniture items with SKU, category, service type (`install` | `dismantle` | `relocate`), base price
  - `quotes` — Core job record with status state machine, pricing fields, AI confidence score, payment tracking, scheduling
  - `quote_items` — Line items linking catalog items to a quote
  - `job_updates` — Staff progress notes/photo updates per job
  - `conversations` / `messages` — AI chat history
- **Quote status flow**: `submitted → under_review → approved → deposit_requested → deposit_paid → booking_pending → booked → assigned → in_progress → completed → final_payment_requested → closed` (also `cancelled`)
- **Seeding**: `server/seed.ts` + `server/run-seed.ts` — seeds admin/staff users and full furniture catalog

### Replit AI Integrations
Located in `server/replit_integrations/` and `client/replit_integrations/`:
- **Chat** (`/chat`): Conversation storage + OpenAI chat completions
- **Audio** (`/audio`): Voice recording (client MediaRecorder), SSE streaming playback (AudioWorklet), speech-to-text, TTS
- **Image** (`/image`): Image generation and editing via `gpt-image-1`
- **Batch** (`/batch`): Rate-limited, retrying batch processor for LLM calls

---

## External Dependencies

| Service | Purpose | Env Var(s) |
|---|---|---|
| **PostgreSQL** | Primary database | `DATABASE_URL` |
| **Resend** | Transactional email (deposit requests, booking confirmations, payment links) | `RESEND_API_KEY`, `FROM_EMAIL` |
| **Stripe** | Payment link creation, deposit & final payment processing | `STRIPE_SECRET_KEY` (assumed) |
| **OpenAI (via Replit AI)** | Quote AI estimation, photo analysis, voice chat, image generation | `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` |
| **Google Fonts** | Typography (Plus Jakarta Sans, Outfit, DM Sans, Geist Mono, Architects Daughter, Fira Code) | None — loaded via CDN |
| **OneMap SG (Public API)** | Singapore address autocomplete in estimate wizard Step 2 | None — public API, no key required |

### Key npm packages
- `drizzle-orm` + `drizzle-zod` + `pg` — Database ORM
- `express` v5 — Backend server
- `@tanstack/react-query` — Client data fetching
- `wouter` — Client routing
- `framer-motion` — Animations
- `react-day-picker` — Booking calendar
- `multer` — File/photo uploads
- `stripe` — Payments
- `nodemailer` — (in build allowlist; Resend is the active email provider)
- `zod` — Schema validation throughout (shared between client and server)
- `nanoid` — Reference number generation
- `xlsx` — Report exports (in build allowlist)
- `connect-pg-simple` — PostgreSQL session store