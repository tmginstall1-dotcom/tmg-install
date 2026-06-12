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
