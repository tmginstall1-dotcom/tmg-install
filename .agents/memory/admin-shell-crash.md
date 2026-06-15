---
name: Admin shell crash scope
description: Why a single bad import in an admin shell component crashes the whole admin area after login
---
The admin shell components (AdminSidebar, AdminBottomNav, AdminTopbarTools) render on EVERY admin page and fetch the dashboard's visible data (quotes/leave/attendance/receipts/whatsapp). A render-time throw in any of them (e.g. a lucide icon used in JSX but missing from the import) crashes the entire admin area via the App-root ErrorBoundary ("Something went wrong"), yet the login page renders fine because it does not mount the shell.

**Diagnostic tell:** the shell's data calls succeed (200) but a page's OWN unique queries never fire — the page never mounted because the shell threw first.

**Why:** the dev workflow runs Vite/esbuild only (no `tsc`), so a "Cannot find name 'X'" missing-import becomes a runtime ReferenceError that ships. `npx tsc --noEmit` catches these; the workflows do not.

**How to apply:** when "works on login, crashes after login on every admin page", suspect a shell-component render throw, not the specific page. Run `npx tsx`/`tsc --noEmit` or grep that every JSX-used icon/component is imported. Reproduce with the testing harness pointed at http://localhost:5000 (the default preview port is the mockup-sandbox server, not the main app).
