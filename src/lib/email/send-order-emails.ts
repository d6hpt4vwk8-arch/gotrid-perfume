import type { Order, OrderItem } from "@prisma/client";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABELS, SHIPPING_LABELS } from "@/lib/shipping";
import { SITE_URL } from "@/lib/site";
import { getPopularProductsExcluding } from "@/lib/marketing/recommend-products";
import { emailBenefits, emailButton, emailProductGrid, renderEmailLayout } from "./layout";
import { EMAIL_FROM, OWNER_EMAIL, getResendClient, isEmailConfigured } from "./resend";

type OrderWithItems = Order & { items: OrderItem[] };

function itemsTableHtml(items: OrderItem[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e0dc;font-size:14px">${item.name}${item.isGift ? " (dárek zdarma)" : ""}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e2e0dc;font-size:14px;color:#8a857e">${item.qty}×</td>
          <td style="padding:10px 0;border-bottom:1px solid #e2e0dc;font-size:14px;font-weight:600;text-align:right">${formatPrice(item.unitPrice)}</td>
        </tr>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 24px">${rows}</table>`;
}

export async function renderCustomerOrderConfirmationHtml(order: OrderWithItems): Promise<string> {
  const orderedProductIds = order.items.map((i) => i.productId).filter((id): id is string => id !== null);
  const [benefits, crossSell] = await Promise.all([
    emailBenefits(),
    getPopularProductsExcluding(orderedProductIds),
  ]);
  const inner = `
      <h1>Ahoj ${order.firstName}!</h1>
      <p>Děkujeme za objednávku! Objednávka <strong>${order.number}</strong> byla přijata.</p>
      ${itemsTableHtml(order.items)}
      <p style="margin-bottom:4px">Doprava: ${SHIPPING_LABELS[order.shippingMethod]} — ${formatPrice(order.shippingPrice)}</p>
      <p style="margin-bottom:4px">Platba: ${PAYMENT_LABELS[order.paymentMethod]}${Number(order.codSurcharge) > 0 ? ` (příplatek ${formatPrice(order.codSurcharge)})` : ""}</p>
      <p style="font-size:17px;font-weight:700;margin-bottom:24px">Celkem: ${formatPrice(order.total)}</p>
      <p>O odeslání zásilky vás budeme informovat samostatným e-mailem.</p>
      ${emailButton(`${SITE_URL}/api/orders/${order.number}/access?token=${order.accessToken}`, "Zobrazit stav objednávky")}
      ${benefits}
      ${emailProductGrid("Mohlo by se vám také líbit", crossSell)}
    `;
  return renderEmailLayout(inner, { preheader: `Objednávka ${order.number} byla přijata.` });
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
    html: await renderCustomerOrderConfirmationHtml(order),
  });
  // The Resend SDK returns { data, error } instead of throwing on API-level
  // failures (e.g. unverified sending domain) — surface it so the caller's
  // .catch() actually logs something instead of silently dropping the email.
  if (error) throw new Error(`Resend error: ${error.message}`);
}

export function renderOwnerNewOrderNotificationHtml(order: OrderWithItems): string {
  const inner = `
      <h1>Nová objednávka ${order.number}</h1>
      <p style="margin-bottom:4px">${order.firstName} ${order.lastName} — ${order.email} — ${order.phone}</p>
      ${itemsTableHtml(order.items)}
      <p style="margin-bottom:4px">Doprava: ${SHIPPING_LABELS[order.shippingMethod]}</p>
      <p style="margin-bottom:4px">Platba: ${PAYMENT_LABELS[order.paymentMethod]}${Number(order.codSurcharge) > 0 ? ` (příplatek ${formatPrice(order.codSurcharge)})` : ""}</p>
      <p style="font-size:17px;font-weight:700">Celkem: ${formatPrice(order.total)}</p>
    `;
  return renderEmailLayout(inner);
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
    html: renderOwnerNewOrderNotificationHtml(order),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
