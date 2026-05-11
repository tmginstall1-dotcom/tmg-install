// Build a professional, customer-facing description for a quote / invoice
// line item. Includes the service type so customers can tell at a glance
// whether the line is for installation, dismantling, reinstallation, etc.
//
// Example outputs:
//   "Height adjustable desk — Installation"
//   "Height adjustable desk — Dismantle"
//   "Height adjustable desk — Reinstall"        (when same item also has a Dismantle line)
//   "BROR shelf — Removal & Disposal"
//   "Sofa — Relocation"

const SERVICE_TYPE_LABELS: Record<string, string> = {
  install: "Installation",
  dismantle: "Dismantle",
  relocate: "Relocation",
  dispose: "Removal & Disposal",
  dismantle_dispose: "Dismantle & Disposal",
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
    return hasDismantle ? "Reinstall" : "Installation";
  }
  return SERVICE_TYPE_LABELS[st] || st;
}

export function formatItemDescription(item: any, allItems: any[] = []): string {
  const name = item?.detectedName || item?.originalDescription || "Service";
  const label = formatItemServiceLabel(item, allItems);
  return label ? `${name} — ${label}` : name;
}
