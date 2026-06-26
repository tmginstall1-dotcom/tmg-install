---
name: Invoice line verb labels
description: How quote/invoice line descriptions get a verb prefix, and the service_type gotcha that double-prefixes typed verb phrases.
---

# Invoice/quote line descriptions and the "Installation of" prefix

`formatItemDescription()` in `client/src/lib/itemLabel.ts` is the single
render-time formatter for every quote/invoice line (used by Invoice.tsx,
invoicePdf.ts, QuoteDetail.tsx, ExportPDF.tsx). It produces BCA-style
verb-noun text ("Installation of Sofa", "Dismantling of Desk").

**Rule:** the name is shown verbatim (NO verb prepended) when ANY of these
holds: (a) `serviceType` is a non-service type — `fee` / `charge` / `discount`
/ `surcharge` / `other` / `none`; (b) the typed name STARTS with a recognised
verb (`MANUAL_VERB_PREFIXES`: supply / to supply / provide / site survey /
labour / delivery / fee …); or (c) the name CONTAINS a fee noun ANYWHERE
(`FEE_NOUNS`: fee / charge / labour / purchase / handling / mobilisation /
allowance / deposit / rental …) — this last one backfills fee lines that read
like a charge but don't start with a verb (e.g. "Standard Mobilisation Fee",
"Basic LED Light Replacement Labour"). Otherwise the line's service verb (or
default "Installation of") is prepended.

**Fee line type + AI detect:** the admin quote-line editor (QuoteDetail) has a
"Fee / Charge (show as typed)" dropdown option (`serviceType:'fee'`) and a
per-line AI "Detect" button hitting `POST /api/ai/classify-line` (admin-only,
rate-limited, gpt-4o-mini) that sets ONLY the serviceType (never rewrites the
admin's wording). `service_type` is free text (`z.string()` on the edit route,
text column) so new non-service values don't break validation or editQuote
recompute (a `fee` line is just a flat unitPrice×qty line). Regression test:
`tests/itemLabel.test.ts`.

**Why / the gotcha:** the verbatim check must run BEFORE the service_type verb.
A line the admin keys as "To supply labour for …" can be stored with a real
`service_type` like `install` (not only `manual`) — e.g. when the QuoteDetail
service dropdown defaults to Install. If the verb check only runs in the
manual/unknown fallback, those install lines wrongly become "Installation of To
supply labour for …". Fix was to check `startsWithKnownVerb(name)` first,
regardless of service_type.

**How to apply:** when changing line-label wording, edit only itemLabel.ts
(don't add a parallel formatter). Before adding broad prefix words, confirm no
active catalog item name starts with them (checked once: none did) so real
furniture nouns still get "Installation of …".
