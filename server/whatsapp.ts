import { db } from "./db";
import { appSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "./storage";

const PHONE_NUMBER_ID = "1063172463540400";
const WA_API_BASE = `https://graph.facebook.com/v19.0`;

export const WHATSAPP_VERIFY_TOKEN = "tmg_install_verify_2024";

let _cachedToken: string | null = null;
let _cacheExpiry = 0;

// ── Persist token to DB ───────────────────────────────────────────────────────
async function saveTokenToDB(token: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: "whatsapp_access_token", value: token })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: token, updatedAt: new Date() },
    });
}

// ── Exchange any token for a 60-day long-lived token via Meta Graph API ───────
async function exchangeForLongLivedToken(shortToken: string): Promise<string | null> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    console.warn("[WhatsApp] META_APP_ID / META_APP_SECRET not set — cannot exchange token");
    return null;
  }

  try {
    const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(shortToken)}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    if (!res.ok || !data.access_token) {
      console.error("[WhatsApp] Token exchange failed:", JSON.stringify(data));
      return null;
    }
    const expiresIn = data.expires_in ? Math.round(data.expires_in / 86400) : "?";
    console.log(`[WhatsApp] Long-lived token obtained — expires in ~${expiresIn} days`);
    return data.access_token as string;
  } catch (err) {
    console.error("[WhatsApp] Token exchange error:", err);
    return null;
  }
}

// ── Check token expiry via Meta debug_token endpoint ─────────────────────────
async function getTokenExpiryEpoch(token: string): Promise<number> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) return 0;
  try {
    const res = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${appId}|${appSecret}`
    );
    const data = await res.json() as any;
    return data?.data?.expires_at ?? 0; // unix epoch seconds, 0 = never expires
  } catch {
    return 0;
  }
}

// ── Auto-refresh: exchange stored token if it expires within 7 days ───────────
export async function refreshTokenIfNeeded(): Promise<void> {
  const currentToken = await getAccessToken();
  if (!currentToken) {
    console.warn("[WhatsApp] No token to refresh");
    return;
  }

  const expiresAt = await getTokenExpiryEpoch(currentToken);
  const nowSec = Math.floor(Date.now() / 1000);
  const sevenDays = 7 * 24 * 3600;

  // If expires_at is 0 the token is already non-expiring; skip
  if (expiresAt === 0) {
    console.log("[WhatsApp] Token has no expiry (permanent or System User token) — no refresh needed");
    return;
  }

  // Already expired — can't exchange, just warn loudly
  if (expiresAt <= nowSec) {
    console.error("════════════════════════════════════════════════════════");
    console.error("[WhatsApp] ⛔ TOKEN IS EXPIRED — bot CANNOT send messages!");
    console.error("[WhatsApp]    Go to Admin Settings → paste a new System User token.");
    console.error("════════════════════════════════════════════════════════");
    return;
  }

  if (expiresAt - nowSec > sevenDays) {
    const daysLeft = Math.round((expiresAt - nowSec) / 86400);
    console.log(`[WhatsApp] Token still valid — ${daysLeft} days remaining`);
    return;
  }

  console.log("[WhatsApp] Token expiring soon — exchanging for long-lived token…");
  const longLived = await exchangeForLongLivedToken(currentToken);
  if (longLived) {
    await saveTokenToDB(longLived);
    _cachedToken = longLived;
    _cacheExpiry = Date.now() + 5 * 60 * 1000;
    console.log("[WhatsApp] Token refreshed and saved to DB");
  } else {
    console.warn("[WhatsApp] Could not exchange token — update manually in Admin Settings.");
  }
}

// ── Read token from DB (with 5-min in-memory cache) ──────────────────────────
export async function getAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (_cachedToken && now < _cacheExpiry) return _cachedToken;

  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "whatsapp_access_token"));
    if (row?.value) {
      _cachedToken = row.value;
      _cacheExpiry = now + 5 * 60 * 1000;
      return _cachedToken;
    }
  } catch (err) {
    console.warn("[WhatsApp] Could not read token from DB:", err);
  }

  return process.env.WHATSAPP_ACCESS_TOKEN ?? null;
}

// ── Public: update token (called from admin Settings page) ───────────────────
export async function updateAccessToken(token: string): Promise<void> {
  // Try to immediately exchange for long-lived token
  const longLived = await exchangeForLongLivedToken(token);
  const finalToken = longLived ?? token;

  await saveTokenToDB(finalToken);
  _cachedToken = finalToken;
  _cacheExpiry = Date.now() + 5 * 60 * 1000;

  if (longLived) {
    console.log("[WhatsApp] Pasted token exchanged for long-lived token and saved");
  } else {
    console.log("[WhatsApp] Token saved (could not exchange — using as-is)");
  }
}

// ── Send a WhatsApp text message ──────────────────────────────────────────────
// Returns true if the message was delivered, false if credentials are missing.
// THROWS if the Meta API returns an error — callers should handle this.
export async function sendWhatsAppMessage(to: string, text: string, opts?: { logAsSentBy?: string | null }): Promise<boolean> {
  const ACCESS_TOKEN = await getAccessToken();
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    console.warn("[WhatsApp] Credentials not configured — skipping message send");
    return false;
  }

  const url = `${WA_API_BASE}/${PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text, preview_url: false },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json() as any;

  if (!res.ok) {
    const errMsg = data?.error?.message || data?.message || JSON.stringify(data);
    console.error(`[WhatsApp] Send error to ${to}:`, errMsg);
    // Throw so callers can surface the real reason to the admin
    throw new Error(`WhatsApp API error: ${errMsg}`);
  }

  console.log(`[WhatsApp] Message sent to ${to}`);
  // Only log to our DB after confirmed delivery
  const sentBy = opts?.logAsSentBy !== undefined ? opts.logAsSentBy : 'bot';
  storage.logWhatsAppMessage({ phone: to, direction: 'outbound', body: text, sentBy: sentBy ?? 'bot' }).catch(() => {});
  return true;
}

// ── Safe bot sender — swallows errors so the webhook handler never crashes ────
// Use this for all bot-automated responses. Use sendWhatsAppMessage for admin sends.
export async function sendBotMessage(to: string, text: string): Promise<void> {
  try {
    await sendWhatsAppMessage(to, text, { logAsSentBy: 'bot' });
  } catch (err: any) {
    console.error(`[WhatsApp] Bot message to ${to} failed (swallowed):`, err?.message || err);
  }
}

// ── Mark an incoming message as read (shows double blue ticks) ───────────────
export async function markAsRead(messageId: string): Promise<void> {
  const ACCESS_TOKEN = await getAccessToken();
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) return;
  try {
    await fetch(`${WA_API_BASE}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      }),
    });
  } catch { /* non-critical — ignore errors */ }
}

// ── Download a WhatsApp media item as base64 ─────────────────────────────────
export async function downloadWhatsAppMedia(
  mediaId: string
): Promise<{ base64: string; mimeType: string } | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const metaRes = await fetch(`${WA_API_BASE}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!metaRes.ok) {
      console.error("[WhatsApp] Media URL resolve failed:", await metaRes.text());
      return null;
    }
    const { url, mime_type } = (await metaRes.json()) as { url: string; mime_type: string };

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

// ── Send deposit payment link via WhatsApp ────────────────────────────────────
export async function sendWhatsAppPaymentLink(
  to: string,
  referenceNo: string,
  depositAmount: string,
  paymentLink: string,
  opts?: { customerName?: string; preferredDate?: string; preferredTimeWindow?: string }
): Promise<void> {
  const name = opts?.customerName ? `Hi *${opts.customerName}* 👋` : "Hi there 👋";
  const slotLine = opts?.preferredDate
    ? `📅 Your reserved slot: *${opts.preferredDate}${opts.preferredTimeWindow ? ` (${opts.preferredTimeWindow})` : ""}*\n\n`
    : "";

  const msg =
    `${name}\n\n` +
    `This is a friendly reminder from *TMG Install* regarding your quote *${referenceNo}*.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *Deposit Required: S$${depositAmount}*\n` +
    `${slotLine}` +
    `Your slot is held — but only until the deposit is received.\n\n` +
    `👉 *Pay your deposit here:*\n` +
    `${paymentLink}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📧 *Can't find our email?*\n` +
    `Check your *Junk / Spam / Promotions* folder for an email from TMG Install — payment emails sometimes land there.\n\n` +
    `_Need help? Reply to this message or call us. Min. notice 48h for rescheduling._`;

  await sendWhatsAppMessage(to, msg);
}
