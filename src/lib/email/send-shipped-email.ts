import type { Order } from "@prisma/client";
import { emailBenefits, emailButton, renderEmailLayout } from "./layout";
import { getMailContext, orderMailLocale } from "./locale";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

// Closes a promise the order-confirmation email already makes ("O odeslání
// zásilky vás budeme informovat samostatným e-mailem." — send-order-emails.ts)
// that was never actually kept: trackingNumber gets set across several
// different code paths (manual admin edit, GLS label creation, ...) with no
// consistent carrier-notification guarantee behind any of them, so this is
// the one thing the shop itself sends regardless of carrier. Triggered from
// updateOrderStatus on the NEW-status-becomes-SHIPPED transition only.
export async function renderShippedEmailHtml(order: Order): Promise<string> {
  const ctx = await getMailContext(orderMailLocale(order));
  const { tr } = ctx;
  const benefits = await emailBenefits(ctx);
  const inner = `
      <h1>${tr("Ahoj")} ${order.firstName}!</h1>
      <p>${tr("Vaše objednávka")} <strong>${order.number}</strong> ${tr("je na cestě k vám.")}</p>
      ${
        order.trackingNumber
          ? `<p style="margin-bottom:24px">${tr("Sledovací číslo zásilky")}: <strong>${order.trackingNumber}</strong></p>`
          : ""
      }
      ${emailButton(ctx.apiUrl(`/api/orders/${order.number}/access?token=${order.accessToken}`), tr("Zobrazit stav objednávky"))}
      ${benefits}
    `;
  return renderEmailLayout(inner, { preheader: tr("Objednávka {number} byla odeslána.", { number: order.number }), ctx });
}

export async function sendShippedEmail(order: Order) {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping shipped notification for ${order.number}`);
    return;
  }

  const ctx = await getMailContext(orderMailLocale(order));
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: order.email,
    subject: `${ctx.tr("Vaše objednávka")} ${order.number} ${ctx.tr("byla odeslána")} — Gotrid Perfume`,
    html: await renderShippedEmailHtml(order),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
