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
// For manually-keyed lines (serviceType "manual") or any unknown service
// type we just show the name — admins can type the full description in
// the item name field.

const SERVICE_VERBS: Record<string, string> = {
  install: "Installation",
  dismantle: "Dismantling",
  relocate: "Relocation",
  dispose: "Disposal",
  dismantle_dispose: "Dismantling & Disposal",
};

function itemKey(it: any): string {
  return String(it?.detectedName || it?.originalDescription || "").trim().toLowerCase();
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
  const name = item?.detectedName || item?.originalDescription || "Service";
  const verb = formatItemServiceLabel(item, allItems);
  return verb ? `${verb} of ${name}` : name;
}
