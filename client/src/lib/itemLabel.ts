// Build a professional, BCA-style customer-facing description for a quote /
// invoice line item. The format is verb-then-noun ("Installation of X",
// "Dismantling of X") so commercial customers can map each line to the
// service rendered. TMG only provides install / dismantle / relocate
// services — we do not sell furniture.
//
// Example outputs:
//   "Installation of Height adjustable desk"
//   "Dismantling of Height adjustable desk"
//   "Reinstallation of Height adjustable desk"  (when same item also has a Dismantling line)
//   "Relocation of Sofa"
//   "Disposal of BROR shelf"
//   "Dismantling & Disposal of Bookshelf"
//
// For manually-keyed lines (serviceType "manual" or unknown) we still
// produce a verb-noun description so commercial / BCA invoices read
// consistently. Default verb is "Installation of …" (TMG's primary service)
// unless the line is a fee / charge / supply / labour line, in which case
// the typed name is shown verbatim (e.g. "Standard Mobilisation Fee", not
// "Installation of Standard Mobilisation Fee").

const SERVICE_VERBS: Record<string, string> = {
  install: "Installation",
  dismantle: "Dismantling",
  relocate: "Relocation",
  dispose: "Disposal",
  dismantle_dispose: "Dismantling & Disposal",
};

// Service types that are NOT a physical install/dismantle/relocate service.
// These are fee / charge / supply / labour / discount lines and must be
// shown exactly as the admin typed them — never prefixed with a verb.
// `fee` is set when the admin picks "Fee / Charge" in the line editor (or
// when AI auto-detection classifies a line as a charge).
const NON_SERVICE_TYPES = new Set(["fee", "charge", "other", "none", "discount", "surcharge"]);

// Words/phrases an admin might already type at the start of a manual
// line, meaning we should NOT prepend "Installation of …" again.
const MANUAL_VERB_PREFIXES = [
  "installation", "install",
  "dismantling", "dismantle",
  "reinstallation", "reinstall",
  "relocation", "relocate", "moving", "move",
  "disposal", "dispose", "removal", "remove",
  "delivery", "deliver",
  "site survey", "survey", "inspection", "consultation",
  "repair", "service", "servicing", "maintenance",
  "transport", "transportation", "travel",
  "additional", "extra", "ad-hoc", "adhoc",
  "labour", "labor", "manpower", "handyman",
  "charge", "charges", "fee", "fees", "allowance", "discount",
  // "Supply"/"Provide" wording (incl. the "To supply …" / "To provide …"
  // phrasing admins use for labour-only lines) — show the typed text as-is
  // instead of forcing "Installation of …" in front.
  "supply", "supplying", "to supply",
  "provide", "providing", "provision", "provision of", "to provide",
];

// Fee / charge / supply / labour wording that, if it appears ANYWHERE in the
// line name (not just at the start), means the line is a charge rather than a
// service — show it verbatim and never prepend "Installation of …".
//
// This covers lines that read like a fee even though they don't start with a
// verb, e.g. "Standard Mobilisation Fee", "Purchase & Handling Fee",
// "Basic LED Light Replacement Labour", "LED Light Purchase". It also lets
// fee lines saved before the explicit "Fee / Charge" line type existed render
// correctly with no re-keying.
const FEE_NOUNS = [
  "fee", "fees", "charge", "charges", "surcharge",
  "allowance", "deposit", "levy", "gst",
  "labour", "labor", "manpower",
  "mobilisation", "mobilization", "handling",
  "purchase", "purchases", "rental",
];

function itemKey(it: any): string {
  return String(it?.detectedName || it?.originalDescription || "").trim().toLowerCase();
}

function startsWithKnownVerb(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return MANUAL_VERB_PREFIXES.some(p => lower === p || lower.startsWith(p + " ") || lower.startsWith(p + ":"));
}

function looksLikeFee(name: string): boolean {
  const lower = name.toLowerCase();
  return FEE_NOUNS.some(w => new RegExp(`\\b${w}\\b`, "i").test(lower));
}

// For each computed verb, the words that — if they already appear in the
// item name — would make prepending the verb redundant (e.g. an item named
// "… bench system installation" should NOT become "Installation of …
// installation"). Keyed by the verb returned from formatItemServiceLabel.
const VERB_INDICATORS: Record<string, string[]> = {
  "Installation": ["installation", "install", "installed", "installing", "fitting", "fit-out", "fitout"],
  "Reinstallation": ["reinstallation", "reinstall", "installation", "install", "installing"],
  "Dismantling": ["dismantling", "dismantle", "dismantled", "disassembly", "disassemble"],
  "Relocation": ["relocation", "relocate", "relocating", "moving", "move", "shifting"],
  "Disposal": ["disposal", "dispose", "disposing", "removal", "remove"],
  "Dismantling & Disposal": ["dismantling", "dismantle", "disposal", "dispose", "removal"],
};

function nameHasVerb(name: string, verb: string): boolean {
  const lower = name.toLowerCase();
  return (VERB_INDICATORS[verb] || []).some(w => new RegExp(`\\b${w}\\b`).test(lower));
}

// Remove a redundant verb word only when it sits at the END of the name, so
// "Linear workstation bench system installation" → "Linear workstation bench
// system" (which we then re-format as "Installation of …"). Returns the
// original name when there is nothing safe to strip from the tail.
function stripTrailingVerb(name: string, verb: string): string {
  const trailers = VERB_INDICATORS[verb] || [];
  if (!trailers.length) return name;
  const re = new RegExp(`[\\s\\-/]*\\b(?:${trailers.join("|")})\\b[\\s.]*$`, "i");
  return name.replace(re, "").trim();
}

export function formatItemServiceLabel(item: any, allItems: any[] = []): string {
  const st = item?.serviceType;
  if (!st) return "";
  if (st === "install") {
    const key = itemKey(item);
    const hasDismantle = !!key && allItems.some(o => o !== item && o?.serviceType === "dismantle" && itemKey(o) === key);
    return hasDismantle ? "Reinstallation" : "Installation";
  }
  return SERVICE_VERBS[st] || "";
}

export function formatItemDescription(item: any, allItems: any[] = []): string {
  const name = String(item?.detectedName || item?.originalDescription || "Service").trim();
  // Explicit non-service line (fee / charge / supply / discount) → the admin
  // (or AI auto-detection) marked it as a charge, so show it exactly as typed.
  const st = String(item?.serviceType || "").toLowerCase();
  if (NON_SERVICE_TYPES.has(st)) return name;
  // If the admin already typed a recognised verb at the start of the line
  // (e.g. "Site survey fee", "To supply labour for ..."), show the name
  // verbatim — never prepend a verb. This applies REGARDLESS of the line's
  // service type, so a labour line keyed as "install" still reads as typed
  // instead of becoming "Installation of To supply labour for ...".
  if (startsWithKnownVerb(name)) return name;
  // The name reads like a fee / charge / supply / labour line even though it
  // doesn't start with a verb (e.g. "Standard Mobilisation Fee", "Purchase &
  // Handling Fee", "Basic LED Light Replacement Labour") → show as typed.
  if (looksLikeFee(name)) return name;
  // Manual or unknown service type defaults to "Installation of …" (TMG's
  // primary service) so the BCA-style verb-noun format stays consistent.
  const verb = formatItemServiceLabel(item, allItems) || "Installation";
  // Avoid repeating the verb when the item name already contains it (e.g.
  // "… bench system installation"). Strip a redundant trailing verb word so
  // the line still reads "Installation of <noun>"; if the duplicate sits in
  // the middle and can't be cleanly removed, show the name as typed.
  if (nameHasVerb(name, verb)) {
    const stripped = stripTrailingVerb(name, verb);
    if (stripped && stripped !== name && stripped.length >= 3) {
      return `${verb} of ${stripped.charAt(0).toUpperCase()}${stripped.slice(1)}`;
    }
    return name;
  }
  return `${verb} of ${name}`;
}
