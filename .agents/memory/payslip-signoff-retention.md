---
name: Payslip sign-off & retention
description: How staff drawn-signature sign-off works and why signed payslips are delete-locked; the print-HTML injection constraint.
---

## Staff payslip sign-off (drawn signature)
- Staff sign their own payslip with a finger-drawn signature (dependency-free canvas → PNG data URL). Stored on the `payslips` row as `signature` + `acknowledgedAt`.
- Sign-off endpoint enforces ownership by finding the id inside the caller's OWN `getPayslipsByUser` list (not a raw id lookup), and is idempotent — a signed payslip is a locked record and is never overwritten.

## Retention (≥3 years)
- Payslips already persist indefinitely in Postgres (nothing purges them); retention is met by persistence.
- **Signed payslips are delete-locked** (admin DELETE returns 400 when `acknowledgedAt` is set).
- **Why:** unsigned drafts must stay deletable so admins can remove mistaken/duplicate generations — do NOT add a blanket age-gate on all payslips.

## Print-HTML injection constraint (important)
- `OfficialPayslip.tsx` builds the printable payslip as a raw HTML **string template** and does NOT escape interpolated DB fields (notes, loan descriptions, and now the signature `<img src>`).
- Any user-supplied value rendered into that template must be validated/escaped at the source.
- **How to apply:** the signature is validated server-side with a FULLY-ANCHORED base64 PNG data-URL regex (`^data:image/png;base64,[A-Za-z0-9+/]+={0,2}$`). The base64 alphabet has no `"`, `<`, `>`, so strict validation closes the attribute-breakout/stored-XSS path. Keep this anchored — a prefix-only check leaves the tail injectable.
