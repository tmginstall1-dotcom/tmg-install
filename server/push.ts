import webpush from "web-push";
import { db } from "./db";
import { appSettings } from "../shared/schema";
import { eq } from "drizzle-orm";

// ── VAPID key management ────────────────────────────────────────────────────
// Keys are generated once and persisted in app_settings.
// The public key is exposed to browsers; the private key stays server-side.

let _vapidInitialised = false;

async function upsertSetting(key: string, value: string) {
  await db.insert(appSettings).values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return row?.value ?? null;
}

export async function initVapid(): Promise<void> {
  if (_vapidInitialised) return;

  let publicKey  = await getSetting("vapid_public_key");
  let privateKey = await getSetting("vapid_private_key");

  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey  = keys.publicKey;
    privateKey = keys.privateKey;
    await upsertSetting("vapid_public_key",  publicKey);
    await upsertSetting("vapid_private_key", privateKey);
    console.log("[Push] Generated new VAPID keys.");
  }

  webpush.setVapidDetails(
    "mailto:sales@tmginstall.com",
    publicKey,
    privateKey,
  );

  _vapidInitialised = true;
}

export async function getVapidPublicKey(): Promise<string> {
  await initVapid();
  const key = await getSetting("vapid_public_key");
  return key!;
}

// ── Subscription storage ────────────────────────────────────────────────────
// Subscriptions are stored as a JSON array in app_settings under the key
// "push_subscriptions_admin". Each entry is a PushSubscription JSON object.

async function getSubscriptions(): Promise<webpush.PushSubscription[]> {
  const raw = await getSetting("push_subscriptions_admin");
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function saveSubscriptions(subs: webpush.PushSubscription[]): Promise<void> {
  await upsertSetting("push_subscriptions_admin", JSON.stringify(subs));
}

export async function addSubscription(sub: webpush.PushSubscription): Promise<void> {
  const subs = await getSubscriptions();
  // Deduplicate by endpoint
  const filtered = subs.filter(s => s.endpoint !== sub.endpoint);
  filtered.push(sub);
  await saveSubscriptions(filtered);
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const subs = await getSubscriptions();
  await saveSubscriptions(subs.filter(s => s.endpoint !== endpoint));
}

// ── Send push notifications to all admin subscribers ───────────────────────
export async function sendPushToAdmins(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> {
  try {
    await initVapid();
    const subs = await getSubscriptions();
    if (subs.length === 0) return;

    const data = JSON.stringify(payload);
    const stale: string[] = [];

    await Promise.allSettled(
      subs.map(async sub => {
        try {
          await webpush.sendNotification(sub, data);
        } catch (err: any) {
          // 410 Gone / 404 Not Found = subscription is no longer valid; remove it
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            stale.push(sub.endpoint);
          } else {
            console.warn("[Push] Failed to notify:", err?.message);
          }
        }
      })
    );

    if (stale.length > 0) {
      const current = await getSubscriptions();
      await saveSubscriptions(current.filter(s => !stale.includes(s.endpoint)));
    }
  } catch (err) {
    console.error("[Push] sendPushToAdmins error:", err);
  }
}
