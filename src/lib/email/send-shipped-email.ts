import type { Order } from "@prisma/client";
import { SITE_URL } from "@/lib/site";
import { emailBenefits, emailButton, renderEmailLayout } from "./layout";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

// Closes a promise the order-confirmation email already makes ("O odeslání
// zásilky vás budeme informovat samostatným e-mailem." — send-order-emails.ts)
// that was never actually kept: trackingNumber gets set across several
// different code paths (manual admin edit, GLS label creation, ...) with no
// consistent carrier-notification guarantee behind any of them, so this is
// the one thing the shop itself sends regardless of carrier. Triggered from
// updateOrderStatus on the NEW-status-becomes-SHIPPED transition only.
export async function renderShippedEmailHtml(order: Order): Promise<string> {
  const benefits = await emailBenefits();
  const inner = `
      <h1>Ahoj ${order.firstName}!</h1>
      <p>Vaše objednávka <strong>${order.number}</strong> je na cestě k vám.</p>
      ${
        order.trackingNumber
          ? `<p style="margin-bottom:24px">Sledovací číslo zásilky: <strong>${order.trackingNumber}</strong></p>`
          : ""
      }
      ${emailButton(`${SITE_URL}/api/orders/${order.number}/access?token=${order.accessToken}`, "Zobrazit stav objednávky")}
      ${benefits}
    `;
  return renderEmailLayout(inner, { preheader: `Objednávka ${order.number} byla odeslána.` });
}

export async function sendShippedEmail(order: Order) {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping shipped notification for ${order.number}`);
    return;
  }

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: order.email,
    subject: `Vaše objednávka ${order.number} byla odeslána — Gotrid Perfume`,
    html: await renderShippedEmailHtml(order),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
