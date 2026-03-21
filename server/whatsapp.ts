const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WA_API_BASE = `https://graph.facebook.com/v19.0`;

export const WHATSAPP_VERIFY_TOKEN = "tmg_install_verify_2024";

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
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
