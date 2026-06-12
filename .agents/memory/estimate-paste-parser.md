---
name: Estimate paste-list parser
description: How the customer estimate wizard's "Paste Item List" box turns pasted text into line items, and the address-filtering rule.
---

The ONLY paste-to-items parser is `applyPaste` in
`client/src/pages/customer/Estimate.tsx`. The admin `CreateJobModal` has no
paste parser (items are added row by row), so there is no second parser to keep
in sync — but if one is ever added, share the logic.

Customers paste whole moving briefs that mix item lines with stop headers
("Pick-up"/"Drop-off"), Singapore addresses (6-digit postal codes, `#xx-xxxx`
unit numbers, Block/street names) and emoji stop markers (1-emoji/2-emoji). The
parser must extract ONLY items + quantities and drop the address/header noise;
otherwise each junk line became a `$0` custom item.

**Rule — run the weak street-name address check on the item name AFTER the
quantity is stripped, not on the raw line.**
**Why:** a genuine item like "Road bike x1" has a digit + a street word ("road")
on the raw line, so a raw-line street check would wrongly skip it. After
quantity stripping the name is "Road bike" (no digit) and survives, while a real
address like "294 Choa Chu Kang Avenue 2" keeps its house number and is dropped.
**How to apply:** strong, unambiguous address signals (postal code, `#unit`,
Block, phone, bare header) are checked on the cleaned full line; the digit+street
heuristic is a backstop applied only to the stripped item name.

Quantity is parsed from a trailing/mid "x N" (last match wins) so
"Toyogo boxes x8 (6big, 2small)" → qty 8; trailing parentheticals are cleaned
from the name.

**Two-stage matcher:** applyPaste first runs the crude substring `.find`
(catalog name ⊂ pasted text, or vice versa, or first-2-words, or alnum-key
includes ≥5); only on a miss does it retry with a brand-strip + singularise
pass and re-run the SAME strict substring matcher.
**Do NOT** use the loose word-overlap scorer (`bestCatalogMatch`, score 40 = a
single shared noun) as the paste fallback — in the customer paste flow a
single-token overlap will auto-price unrelated custom lines (financial-integrity
risk). Substring containment after brand-strip is the safe fallback: it leaves
genuinely-custom lines ("Gaming desk") as custom while still catching
"Decathlon chairs" → a chair, "Tefal pots" → "Pots & Pans", "Bagpack" →
"Backpack".
**Why:** unmatched relocate items hit the generic fallback (~$225 ea = $150 ×
1.5) and massively over-quote real moves; the fix is catalog relocate rows for
the loose items PLUS this strict brand-strip fallback. Keep catalog names for
common loose items short so the crude first stage hits before the fallback.
