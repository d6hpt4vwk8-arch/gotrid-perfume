import type { Order, OrderItem } from "@prisma/client";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABELS, SHIPPING_LABELS } from "@/lib/shipping";
import { SITE_URL } from "@/lib/site";
import { EMAIL_FROM, OWNER_EMAIL, getResendClient, isEmailConfigured } from "./resend";

type OrderWithItems = Order & { items: OrderItem[] };

function itemsTableHtml(items: OrderItem[]): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td>${item.name}</td><td>${item.qty}×</td><td>${formatPrice(item.unitPrice)}</td></tr>`,
    )
    .join("");
  return `<table cellpadding="6" style="border-collapse:collapse;width:100%">${rows}</table>`;
}

export async function sendCustomerOrderConfirmation(order: OrderWithItems) {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping customer confirmation for ${order.number}`);
    return;
  }

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: order.email,
    subject: `Potvrzení objednávky ${order.number} — Gotrid Perfume`,
    html: `
      <h1>Děkujeme za objednávku!</h1>
      <p>Objednávka <strong>${order.number}</strong> byla přijata.</p>
      ${itemsTableHtml(order.items)}
      <p>Doprava: ${SHIPPING_LABELS[order.shippingMethod]} — ${formatPrice(order.shippingPrice)}</p>
      <p>Platba: ${PAYMENT_LABELS[order.paymentMethod]}${Number(order.codSurcharge) > 0 ? ` (příplatek ${formatPrice(order.codSurcharge)})` : ""}</p>
      <p><strong>Celkem: ${formatPrice(order.total)}</strong></p>
      <p>O odeslání zásilky vás budeme informovat samostatným e-mailem.</p>
      <p><a href="${SITE_URL}/api/orders/${order.number}/access?token=${order.accessToken}">Zobrazit objednávku a stáhnout fakturu</a></p>
    `,
  });
  // The Resend SDK returns { data, error } instead of throwing on API-level
  // failures (e.g. unverified sending domain) — surface it so the caller's
  // .catch() actually logs something instead of silently dropping the email.
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export async function sendOwnerNewOrderNotification(order: OrderWithItems) {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping owner notification for ${order.number}`);
    return;
  }

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: OWNER_EMAIL,
    subject: `Nová objednávka ${order.number} (${formatPrice(order.total)})`,
    html: `
      <h1>Nová objednávka ${order.number}</h1>
      <p>${order.firstName} ${order.lastName} — ${order.email} — ${order.phone}</p>
      ${itemsTableHtml(order.items)}
      <p>Doprava: ${SHIPPING_LABELS[order.shippingMethod]}</p>
      <p>Platba: ${PAYMENT_LABELS[order.paymentMethod]}${Number(order.codSurcharge) > 0 ? ` (příplatek ${formatPrice(order.codSurcharge)})` : ""}</p>
      <p><strong>Celkem: ${formatPrice(order.total)}</strong></p>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
