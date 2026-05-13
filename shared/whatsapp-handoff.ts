import { z } from "zod";

export const TMG_BUSINESS_PHONE = "6580880757";

export const handoffItemSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(99),
});

export const handoffPayloadSchema = z.object({
  source: z.string().min(1).max(40).default("estimate_step5"),
  services: z.array(z.string().min(1).max(40)).max(8).default([]),
  serviceLabels: z.array(z.string().min(1).max(60)).max(8).default([]),
  pickupAddress: z.string().max(300).optional().default(""),
  dropoffAddress: z.string().max(300).optional().default(""),
  serviceAddress: z.string().max(300).optional().default(""),
  isRelocation: z.boolean().default(false),
  liftAvailable: z.string().max(20).optional().default(""),
  floorLevel: z.string().max(20).optional().default(""),
  stairsAnswer: z.string().max(20).optional().default(""),
  items: z.array(handoffItemSchema).max(50).default([]),
  slotDate: z.string().max(40).optional().default(""),
  slotLabel: z.string().max(60).optional().default(""),
  estimatedTotal: z.number().min(0).max(1_000_000).optional(),
  customerName: z.string().max(120).optional().default(""),
  customerPhone: z.string().max(40).optional().default(""),
  customerEmail: z.string().max(160).optional().default(""),
  promoCode: z.string().max(40).optional().default(""),
  pageContext: z.string().max(120).optional().default(""),
});

export type HandoffPayload = z.infer<typeof handoffPayloadSchema>;
export type HandoffItem = z.infer<typeof handoffItemSchema>;

function joinNonEmpty(parts: Array<string | false | null | undefined>, sep = "\n"): string {
  return parts.filter((p): p is string => Boolean(p && p.length)).join(sep);
}

function formatItems(items: HandoffItem[]): string {
  if (!items.length) return "";
  const max = 8;
  const visible = items.slice(0, max).map(i => `\u2022 ${i.name} \u00d7${i.quantity}`);
  if (items.length > max) visible.push(`\u2022 \u2026 +${items.length - max} more`);
  return visible.join("\n");
}

function formatAccess(p: HandoffPayload): string {
  const bits: string[] = [];
  if (p.liftAvailable) bits.push(`lift: ${p.liftAvailable}`);
  if (p.floorLevel) bits.push(`floor: ${p.floorLevel}`);
  if (p.stairsAnswer) bits.push(`stairs: ${p.stairsAnswer}`);
  return bits.join(", ");
}

/**
 * Canonical formatter for the WhatsApp handoff message. Used both client-side
 * (to build the wa.me URL the customer actually opens) and server-side (to log
 * the same text into the admin inbox/audit trail). Keep formatting identical
 * across callers so the admin sees exactly what the customer sees.
 */
export function buildHandoffMessage(payload: HandoffPayload): string {
  const services = payload.serviceLabels.length
    ? payload.serviceLabels.join(", ")
    : payload.services.join(", ");

  const address = payload.isRelocation
    ? joinNonEmpty([
        payload.pickupAddress ? `Pickup: ${payload.pickupAddress}` : "",
        payload.dropoffAddress ? `Dropoff: ${payload.dropoffAddress}` : "",
      ])
    : (payload.serviceAddress ? `Address: ${payload.serviceAddress}` : "");

  const access = formatAccess(payload);
  const itemsBlock = formatItems(payload.items);
  const slotLine = payload.slotLabel ? `Preferred slot: ${payload.slotLabel}` : "";
  const totalLine = typeof payload.estimatedTotal === "number" && payload.estimatedTotal > 0
    ? `Estimated total: $${payload.estimatedTotal.toFixed(2)}`
    : "";
  const promoLine = payload.promoCode ? `Promo applied: ${payload.promoCode}` : "";
  const nameLine = payload.customerName ? `Name: ${payload.customerName}` : "";
  const phoneLine = payload.customerPhone ? `Phone: ${payload.customerPhone}` : "";
  const emailLine = payload.customerEmail ? `Email: ${payload.customerEmail}` : "";

  return joinNonEmpty([
    "Hi TMG Install \u2014 I started a quote on your site and would like to confirm:",
    "",
    services ? `Service: ${services}` : "",
    address,
    access ? `Access: ${access}` : "",
    slotLine,
    "",
    itemsBlock ? "Items:" : "",
    itemsBlock,
    "",
    totalLine,
    promoLine,
    "",
    nameLine,
    phoneLine,
    emailLine,
    "",
    "I can also send photos of my furniture for a more accurate quote.",
  ]);
}

export function buildHandoffWaUrl(payload: HandoffPayload, businessPhone: string = TMG_BUSINESS_PHONE): string {
  const text = buildHandoffMessage(payload);
  return `https://wa.me/${businessPhone}?text=${encodeURIComponent(text)}`;
}
