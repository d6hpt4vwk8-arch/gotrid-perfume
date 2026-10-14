import type { Order, OrderItem, Prisma } from "@prisma/client";
import { formatPrice } from "@/lib/format";
import { PAYMENT_LABELS, SHIPPING_LABELS } from "@/lib/shipping";
import { getBankPayment } from "@/lib/payments/bank-details";
import { orderMoney } from "@/lib/orders/order-money";
import { localizedItemNames } from "@/lib/orders/item-names";
import { getPopularProductsExcluding } from "@/lib/marketing/recommend-products";
import { getSettings } from "@/lib/settings.server";
import { emailBenefits, emailButton, emailSocialCard, emailProductGrid, renderEmailLayout } from "./layout";
import { buildOrderConfirmationAttachments } from "./order-attachments";
import { CS_MAIL, getMailContext, orderMailLocale, type MailContext } from "./locale";
import { EMAIL_FROM, OWNER_EMAIL, getResendClient, isEmailConfigured } from "./resend";

type OrderWithItems = Order & { items: OrderItem[] };

function itemsTableHtml(
  items: OrderItem[],
  names: Map<string, string>,
  money: (czk: Prisma.Decimal | number) => string,
  ctx: MailContext,
): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e0dc;font-size:14px">${names.get(item.id) ?? item.name}${item.isGift ? ` (${ctx.tr("dárek zdarma")})` : ""}</td>
          <td style="padding:10px 0;border-bottom:1px solid #e2e0dc;font-size:14px;color:#8a857e">${item.qty}×</td>
          <td style="padding:10px 0;border-bottom:1px solid #e2e0dc;font-size:14px;font-weight:600;text-align:right">${money(item.unitPrice)}</td>
        </tr>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 24px">${rows}</table>`;
}

// Bank-transfer orders are only paid once the customer acts, so the e-mail
// must carry everything the order page shows: QR code plus the manual details.
// Czech orders pay in CZK to the Czech account (QR Platba); Slovak orders pay
// in EUR to the EUR account (PAY by square) — see getBankPayment.
function bankTransferBlockHtml(order: Order, ctx: MailContext): string {
  const bank = getBankPayment(order);
  if (!bank) return "";
  const { tr } = ctx;
  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#8a857e;">${label}</td><td style="padding:4px 0;font-size:14px;font-weight:600;">${value}</td></tr>`;
  const qrUrl = ctx.apiUrl(`/api/orders/${order.number}/qr?token=${order.accessToken}`);
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;border:1px solid #e2e0dc;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 12px;font-size:14px;font-weight:700;">${tr("Platba převodem")}</p>
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="padding-right:20px;vertical-align:top;"><img src="${qrUrl}" alt="${tr("QR platba")}" width="140" height="140" style="display:block;"></td>
              <td style="vertical-align:top;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  ${bank.account ? row(tr("Číslo účtu"), bank.account) : ""}
                  ${row("IBAN", bank.iban)}
                  ${bank.bic ? row("BIC", bank.bic) : ""}
                  ${row(tr("Příjemce"), bank.beneficiary)}
                  ${row(tr("Částka"), bank.amountLabel)}
                  ${row(tr("Variabilní symbol"), bank.variableSymbol)}
                </table>
              </td>
            </tr></table>
            <p style="margin:12px 0 0;font-size:13px;color:#8a857e;">${tr("Naskenujte QR kód v bankovní aplikaci, nebo zadejte platbu ručně. Zásilku odešleme po připsání platby.")}</p>
          </td>
        </tr>
      </table>`;
}

export async function renderCustomerOrderConfirmationHtml(order: OrderWithItems): Promise<string> {
  const ctx = await getMailContext(orderMailLocale(order));
  const { tr } = ctx;
  const sk = ctx.locale === "sk";
  const money = orderMoney(order);
  const orderedProductIds = order.items.map((i) => i.productId).filter((id): id is string => id !== null);
  const [benefits, crossSell, names, settings] = await Promise.all([
    emailBenefits(ctx),
    getPopularProductsExcluding(orderedProductIds, 3, sk),
    localizedItemNames(order.items, ctx.locale),
    getSettings(),
  ]);
  const inner = `
      <h1>${tr("Ahoj")} ${order.firstName}!</h1>
      <p>${tr("Děkujeme za objednávku!")} ${tr("Objednávka")} <strong>${order.number}</strong> ${tr("byla přijata.")}</p>
      ${itemsTableHtml(order.items, names, money, ctx)}
      <p style="margin-bottom:4px">${tr("Doprava")}: ${tr(SHIPPING_LABELS[order.shippingMethod])} — ${money(order.shippingPrice)}</p>
      <p style="margin-bottom:4px">${tr("Platba")}: ${tr(PAYMENT_LABELS[order.paymentMethod])}${Number(order.codSurcharge) > 0 ? ` (${tr("příplatek")} ${money(order.codSurcharge)})` : ""}</p>
      <p style="font-size:17px;font-weight:700;margin-bottom:24px">${tr("Celkem")}: ${money(order.total)}</p>
      ${bankTransferBlockHtml(order, ctx)}
      <p>${tr("O odeslání zásilky vás budeme informovat samostatným e-mailem.")}</p>
      ${emailButton(ctx.apiUrl(`/api/orders/${order.number}/access?token=${order.accessToken}`), tr("Zobrazit stav objednávky"))}
      ${benefits}
      ${emailProductGrid(tr("Mohlo by se vám také líbit"), crossSell, ctx, settings.czkToEurRate)}
      ${emailSocialCard(ctx)}
      <p style="font-size:12px;color:#8a857e;">${tr("V příloze najdete")} <a href="${ctx.url("/obchodni-podminky")}" style="color:#8a857e;">${tr("obchodní podmínky")}</a> ${tr("včetně")} <a href="${ctx.url("/podminky-vraceni-zbozi")}" style="color:#8a857e;">${tr("podmínek vrácení zboží")}</a> ${tr("a formulář pro odstoupení od smlouvy")}${order.paymentMethod === "BANK_TRANSFER" ? `, ${tr("u plateb převodem také platební údaje s QR kódem")}` : ""}.</p>
    `;
  return renderEmailLayout(inner, { preheader: tr("Objednávka {number} byla přijata.", { number: order.number }), ctx });
}

export async function sendCustomerOrderConfirmation(order: OrderWithItems) {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping customer confirmation for ${order.number}`);
    return;
  }

  const ctx = await getMailContext(orderMailLocale(order));
  const resend = getResendClient();
  // The PDFs are a nicety: if building them fails (a legal page unreachable,
  // a renderer hiccup) the confirmation must still go out without them.
  let attachments: Awaited<ReturnType<typeof buildOrderConfirmationAttachments>> = [];
  try {
    attachments = await buildOrderConfirmationAttachments(order);
  } catch (err) {
    console.error(`[email] attachments failed for ${order.number}, sending without`, err);
  }
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: order.email,
    subject: `${ctx.tr("Potvrzení objednávky")} ${order.number} — Gotrid Perfume`,
    html: await renderCustomerOrderConfirmationHtml(order),
    ...(attachments.length > 0 ? { attachments } : {}),
  });
  // The Resend SDK returns { data, error } instead of throwing on API-level
  // failures (e.g. unverified sending domain) — surface it so the caller's
  // .catch() actually logs something instead of silently dropping the email.
  if (error) throw new Error(`Resend error: ${error.message}`);
}

// The owner's notification stays Czech (and in CZK, the shop's own books) —
// only the customer-facing e-mails follow the order's country.
export function renderOwnerNewOrderNotificationHtml(order: OrderWithItems): string {
  const names = new Map(order.items.map((i) => [i.id, i.name]));
  const czk = (v: Prisma.Decimal | number) => formatPrice(Number(v));
  const inner = `
      <h1>Nová objednávka ${order.number}${order.shippingCountry === "SK" ? " (Slovensko)" : ""}</h1>
      <p style="margin-bottom:4px">${order.firstName} ${order.lastName} — ${order.email} — ${order.phone}</p>
      ${itemsTableHtml(order.items, names, czk, CS_MAIL)}
      <p style="margin-bottom:4px">Doprava: ${SHIPPING_LABELS[order.shippingMethod]}</p>
      <p style="margin-bottom:4px">Platba: ${PAYMENT_LABELS[order.paymentMethod]}${Number(order.codSurcharge) > 0 ? ` (příplatek ${formatPrice(order.codSurcharge)})` : ""}</p>
      <p style="font-size:17px;font-weight:700">Celkem: ${formatPrice(order.total)}${order.chargedCurrency === "EUR" && order.chargedAmount ? ` (klient platí ${new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(Number(order.chargedAmount))})` : ""}</p>
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
