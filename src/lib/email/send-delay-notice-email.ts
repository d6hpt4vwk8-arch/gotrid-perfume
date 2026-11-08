import type { Order } from "@prisma/client";
import { emailButton, renderEmailLayout } from "./layout";
import { getMailContext, orderMailLocale } from "./locale";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";
import { estimateDeliveryDate, formatDeliveryEstimate } from "@/lib/delivery-estimate";
import { CONTACT } from "@/lib/business-identity";

// No new shipping date is promised on purpose (owner's call, 2026-11-08): the mail only owns up to the missed date and
// tells the customer to write to info@ (no phone on purpose). Replies to our automatic mails reach info@ through the Reply-To header (resend.ts),
// but the body also names the address and phone so nobody has to rely on pressing "Reply".

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The date shown on the site when this order was placed (same rule as the cart / product page estimate). */
export function promisedDeliveryDate(order: Pick<Order, "createdAt">): Date {
  return estimateDeliveryDate(3, order.createdAt);
}

export async function renderDelayNoticeHtml(order: Order): Promise<string> {
  const ctx = await getMailContext(orderMailLocale(order));
  const { tr } = ctx;
  const promised = formatDeliveryEstimate(promisedDeliveryDate(order), ctx.locale);
  const row = (label: string, value: string) => `
        <tr>
          <td style="padding:10px 12px 10px 0;font-size:13px;color:#8a857e;">${label}</td>
          <td style="padding:10px 0;font-size:15px;text-align:right;white-space:nowrap;color:#131110;">${value}</td>
        </tr>`;
  const inner = `
      <h1>${tr("Ahoj")} ${escapeHtml(order.firstName)},</h1>
      <p>${tr("chceme, abyste to věděli hned od nás: vaše objednávka {number} nedorazí v termínu, který jsme uváděli. Opravdu se omlouváme.", { number: `<strong>${order.number}</strong>` })}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 24px;border-top:1px solid #e2e0dc;border-bottom:1px solid #e2e0dc;">
        ${row(tr("Původně uváděný termín doručení"), promised)}
      </table>
      <p>${tr("Na vaší objednávce pracujeme. Jakmile ji předáme dopravci, hned vám pošleme e-mail s číslem zásilky, kterou si budete moct sledovat.")}</p>
      <p>${tr("Pokud máte jakýkoli dotaz, napište nám na {email}, rádi pomůžeme.", { email: `<a href="mailto:${CONTACT.email}" style="color:#131110;">${CONTACT.email}</a>` })}</p>
      ${emailButton(ctx.apiUrl(`/api/orders/${order.number}/access?token=${order.accessToken}`), tr("Zobrazit stav objednávky"))}
      <p style="margin-bottom:0">${tr("Děkujeme za trpělivost.")}<br>Gotrid Perfume</p>
    `;
  return renderEmailLayout(inner, {
    preheader: tr("Objednávka {number}: dáváme vám vědět, že odeslání potrvá o něco déle.", { number: order.number }),
    ctx,
    // Customers are pointed to e-mail only (owner's call, 2026-11-08): no phone number in this mail, footer included.
    hidePhone: true,
  });
}

export function delayNoticeSubject(order: Order, tr: (k: string, v?: Record<string, string | number>) => string): string {
  return `${tr("Vaše objednávka {number}: omlouváme se za zdržení", { number: order.number })} — Gotrid Perfume`;
}

export async function sendDelayNoticeEmail(order: Order) {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping delay notice for ${order.number}`);
    return;
  }
  const ctx = await getMailContext(orderMailLocale(order));
  const { error } = await getResendClient().emails.send({
    from: EMAIL_FROM,
    to: order.email,
    subject: delayNoticeSubject(order, ctx.tr),
    html: await renderDelayNoticeHtml(order),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
