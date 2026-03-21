import { db } from "./db";
import { appSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

// Phone number ID from Meta Developer Console (not sensitive, safe to hardcode)
const PHONE_NUMBER_ID = "1034436969754593";
const WA_API_BASE = `https://graph.facebook.com/v19.0`;

export const WHATSAPP_VERIFY_TOKEN = "tmg_install_verify_2024";

// Cache the token in memory to avoid DB round-trip on every message
let _cachedToken: string | null = null;
let _cacheExpiry = 0;

async function getAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (_cachedToken && now < _cacheExpiry) return _cachedToken;

  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "whatsapp_access_token"));
    if (row?.value) {
      _cachedToken = row.value;
      _cacheExpiry = now + 5 * 60 * 1000; // cache 5 min
      return _cachedToken;
    }
  } catch (err) {
    console.warn("[WhatsApp] Could not read token from DB:", err);
  }

  // Fallback to env var
  return process.env.WHATSAPP_ACCESS_TOKEN ?? null;
}

export async function updateAccessToken(token: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "whatsapp_access_token", value: token })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: token, updatedAt: new Date() },
    });
  // Bust cache
  _cachedToken = token;
  _cacheExpiry = Date.now() + 5 * 60 * 1000;
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  const ACCESS_TOKEN = await getAccessToken();
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.warn("[WhatsApp] Credentials not configured — skipping message send");
    return;
  }

  const url = `${WA_API_BASE}/${PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[WhatsApp] Send error:", JSON.stringify(data));
    } else {
      console.log(`[WhatsApp] Message sent to ${to}`);
    }
  } catch (err) {
    console.error("[WhatsApp] Network error:", err);
  }
}

/**
 * Download a WhatsApp media item as a base64 string.
 * Meta requires two steps: 1) resolve the CDN URL, 2) download the file.
 */
export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ base64: string; mimeType: string } | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    // Step 1: resolve URL
    const metaRes = await fetch(`${WA_API_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      console.error("[WhatsApp] Media URL resolve failed:", await metaRes.text());
      return null;
    }
    const { url, mime_type } = (await metaRes.json()) as { url: string; mime_type: string };

    // Step 2: download bytes
    const fileRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!fileRes.ok) {
      console.error("[WhatsApp] Media download failed:", fileRes.status);
      return null;
    }
    const buffer = await fileRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { base64, mimeType: mime_type || "image/jpeg" };
  } catch (err) {
    console.error("[WhatsApp] downloadWhatsAppMedia error:", err);
    return null;
  }
}

export async function sendWhatsAppPaymentLink(
  to: string,
  referenceNo: string,
  depositAmount: string,
  paymentLink: string
): Promise<void> {
  const msg =
    `💳 *TMG Install — Deposit Payment*\n\n` +
    `Quote: *${referenceNo}*\n` +
    `Amount: *S$${depositAmount}*\n\n` +
    `Please pay your deposit via the link below to confirm your booking:\n` +
    `${paymentLink}\n\n` +
    `_This link is valid for 24 hours. Reply to this message if you need help._`;

  await sendWhatsAppMessage(to, msg);
}
