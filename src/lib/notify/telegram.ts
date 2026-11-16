import { formatPrice } from "@/lib/format";

// Phone push for the owner (2026-11-16): a Telegram bot message when a new order arrives, next to the e-mail.
// Needs TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID; without them it silently does nothing.
export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text()).slice(0, 150)}`);
}

export async function sendOwnerOrderTelegram(order: {
  number: string;
  total: unknown;
  firstName: string;
  lastName: string;
  shippingCountry?: string | null;
  shippingMethod: string;
  paymentMethod: string;
  items: { qty: number; isGift?: boolean | null }[];
}): Promise<void> {
  const units = order.items.filter((i) => !i.isGift).reduce((s, i) => s + i.qty, 0);
  const sk = order.shippingCountry === "SK" ? " 🇸🇰" : "";
  await sendTelegram(
    `🛒 Nová objednávka ${order.number}${sk}\n${formatPrice(Number(order.total))} · ${units} ks\n${order.firstName} ${order.lastName}\n${order.shippingMethod} · ${order.paymentMethod}`,
  );
}
