import type { Order } from "@prisma/client";
import { emailButton, renderEmailLayout } from "./layout";
import { getMailContext, orderMailLocale } from "./locale";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";
import { buildInvoiceAttachment } from "./invoice-attachment";

/** Faktura on request (admin button "Poslat fakturu e-mailem") — for a customer who needs it and never got one. */
export async function sendInvoiceEmail(order: Order) {
  if (!isEmailConfigured()) throw new Error("E-mail (Resend) není nastaven.");
  const invoice = await buildInvoiceAttachment(order.id);
  if (!invoice) throw new Error("Faktura ještě není k dispozici (objednávka je nová nebo zrušená).");

  const ctx = await getMailContext(orderMailLocale(order));
  const { tr } = ctx;
  const inner = `
      <h1>${tr("Ahoj")} ${order.firstName}!</h1>
      <p>${tr("V příloze posíláme fakturu k vaší objednávce")} <strong>${order.number}</strong>.</p>
      ${emailButton(ctx.apiUrl(`/api/orders/${order.number}/access?token=${order.accessToken}`), tr("Zobrazit stav objednávky"))}
    `;
  const { error } = await getResendClient().emails.send({
    from: EMAIL_FROM,
    to: order.email,
    subject: `${tr("Faktura k objednávce")} ${order.number} — Gotrid Perfume`,
    html: renderEmailLayout(inner, { preheader: tr("Faktura k objednávce {number}.", { number: order.number }), ctx }),
    attachments: [invoice],
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
