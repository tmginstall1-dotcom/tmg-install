---
name: Invoice line verb labels
description: How quote/invoice line descriptions get a verb prefix, and the service_type gotcha that double-prefixes typed verb phrases.
---

# Invoice/quote line descriptions and the "Installation of" prefix

`formatItemDescription()` in `client/src/lib/itemLabel.ts` is the single
render-time formatter for every quote/invoice line (used by Invoice.tsx,
invoicePdf.ts, QuoteDetail.tsx, ExportPDF.tsx). It produces BCA-style
verb-noun text ("Installation of Sofa", "Dismantling of Desk").

**Rule:** if the typed name already starts with a recognised verb (the
`MANUAL_VERB_PREFIXES` list, e.g. supply / to supply / provide / site survey /
labour / delivery / fee …), the name is shown verbatim and NO verb is
prepended. Otherwise the line's service verb (or default "Installation of") is
prepended.

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
