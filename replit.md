# TMG Install — Replit Project Guide

## Overview

TMG Install is a full-stack platform designed for **The Moving Guy Pte Ltd** (Singapore) to manage furniture installation quoting and operations. It supports the entire workflow from customer quote submission to job completion.

Key capabilities include:
- **Customer Portal**: A 5-step estimate wizard, quote status tracking, deposit and final payment processing, and appointment confirmation.
- **Admin Dashboard**: Tools for reviewing and approving quotes, managing bookings, scheduling staff, and handling payments.
- **Staff Mobile App**: Features for viewing assigned jobs, GPS-based check-in/check-out with photo evidence for job progress tracking.

The application is built as a monorepo utilizing a React frontend, an Express backend, and a PostgreSQL database managed with Drizzle ORM. Email functionalities are handled via Resend, and AI features are integrated using OpenAI through Replit AI Integrations. A custom-designed email system with 8 templates covers all workflow stages, providing clear communication and status updates to customers.

## User Preferences

Preferred communication style: Simple, everyday language.
Always provide full file contents when editing any code file — never partial snippets or diffs.

## System Architecture

### Frontend (React + Vite)
- **Technology Stack**: React 18 with TypeScript, Vite for bundling, `wouter` for routing, and TanStack Query for state management and data fetching.
- **UI/UX**: Utilizes `shadcn/ui`, Radix UI, and Tailwind CSS for components and styling, with Framer Motion for animations.
- **Performance**: Leverages `React.lazy` and `Suspense` for code splitting and `Vite manualChunks` for optimized vendor dependency loading.
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
- **Tables**: Includes `users`, `customers`, `catalog_items`, `quotes`, `quote_items`, and `job_updates`.
- **Key Fields**: `quotes` table tracks status, reschedule count, booking details, amounts, and payment statuses. `job_updates` stores photo URLs as JSON arrays.
- **Seeding**: Includes a `server/run-seed.ts` script for populating the database with initial data, including 217 catalog items across 19 categories.
- **Booking Rules**: Enforces rules for customer booking requests, admin confirmations, and reschedule limitations.

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