# TMG Install — Replit Project Guide

## Overview

TMG Install is a full-stack platform for **The Moving Guy Pte Ltd** (Singapore) to streamline furniture installation quoting and operations. It covers the entire workflow from customer quote submission to job completion. The platform includes a Customer Portal for estimates and payments, an Admin Dashboard for operational management and revenue tracking, and a Staff Mobile App for job execution with GPS tracking and checklists. It also features robust subcontractor management, automation for customer reminders and loyalty discounts, and PayNow QR integration. The project aims to provide a comprehensive, efficient, and user-friendly solution for managing moving and installation services in Singapore, built on a React frontend, Express backend, and PostgreSQL database with Drizzle ORM. Key capabilities include SEO-optimized landing pages, a Progressive Web App (PWA) for offline access, and an integrated email system.

## User Preferences

Preferred communication style: Simple, everyday language.
Always provide full file contents when editing any code file — never partial snippets or diffs.

## System Architecture

### Frontend (React + Vite)
The frontend uses React 18 with TypeScript, Vite, `wouter` for routing, and TanStack Query for state management. UI/UX is built with `shadcn/ui`, Radix UI, and Tailwind CSS, featuring Framer Motion for animations. Performance is optimized with code splitting and optimized vendor dependency loading. It includes a multi-step estimate wizard, customer quote status pages, and distinct admin and staff dashboards. Server-side rendered (SSR) SEO landing pages are implemented for various services, and the admin interface features a mobile-first design inspired by a "Yeezy" aesthetic with monochrome styling, flat elements, and uppercase typography.

### Android Native App (Capacitor)
A Capacitor-wrapped Android app targets the staff login, providing GPS tracking via `@capacitor-community/background-geolocation` and Firebase FCM for push notifications. It supports deep linking and offers offline capabilities through a custom hook for cached job data. Custom branding and extensive permissions for location, notifications, camera, and boot are configured.

### Backend (Express + Node.js)
The Express backend manages API requests, authentication (mock), and core business logic. It provides comprehensive API endpoints for quotes, staff actions, catalog item retrieval, and slot availability. A custom email system handles transactional emails across all workflow stages. Quotes follow a defined state machine for their lifecycle.

### Database (PostgreSQL + Drizzle ORM)
The PostgreSQL database schema is defined with Drizzle ORM, including tables for users, customers, catalog items, quotes, job updates, promo codes, and attendance logs. The `quotes` table tracks status, payment, and promo details. `job_updates` stores photo URLs. The database is seeded idempotently with catalog items and market-calibrated pricing.

### AI Capabilities
- **AI Ops — Ad Platform Execution Layer**: Integrates with Google Ads and Meta Ads for automated campaign management (e.g., negative keywords, budget adjustments). It includes an audit trail, configurable execution flags (test mode, enabled), and safety mechanisms like budget caps and action type whitelists for live execution.
- **AI Pricing Coach**: An admin productivity tool that provides price recommendations for draft jobs. It fuzzy-matches items to the catalog and uses GPT-4o with curated market intelligence to suggest optimal pricing, offering a summary, recommended total, confidence score, and detailed reasoning.
- **WhatsApp AI Agent**: Uses AI to process WhatsApp requests, including generating quotes, with updated logic for pricing calculations.

### Promo Campaign System
A promotional code system allows for discount codes with usage limits, tracked via the `promo_codes` table. A public-facing announcement bar displays active promotions, and customers can apply promo codes in the estimate wizard. Admins can manage promo codes through a dedicated interface.

### Pricing Engine Enhancements
- **Carry Only Mode**: The pricing engine now accurately calculates "Carry Only" relocation costs based on catalog item base prices, correcting previous miscalculations where prices were set to zero.
- **Dismantle & Reinstall (D&R) Helper**: Centralized D&R pricing with a 40% bundle discount for combined dismantle and reinstall services.
- **Carry Only — Weight-Tier Pricing**: Per-item "Carry Only" prices are now strictly weight-based, categorized into tiers with corresponding pricing, including "FREE" for lightweight items.
- **"Won't fit in lift" Special-Handling Badge**: A new badge identifies items requiring special handling due to size, weight, or complexity, prompting for an on-site survey to manage customer expectations.

### Catalog UX
The customer estimator's category tabs have been updated to improve discoverability, specifically ensuring that mattress sizes are visible under the "Beds" tab.

## External Dependencies

- **PostgreSQL**: Primary relational database.
- **Resend**: Transactional email service.
- **OpenAI (via Replit AI)**: Integrated for AI features like quote estimation and photo analysis.
- **OneMap SG (Public API)**: Provides Singapore address autocomplete functionality.
- **Firebase FCM**: Used for push notifications in the Android staff app.
- **Google Ads API**: Integrated for automated ad platform execution.
- **Meta Ads API**: Integrated for automated ad platform execution.