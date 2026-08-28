import type { Product } from "@prisma/client";
import { SITE_URL } from "@/lib/site";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

export async function sendStockAlertEmail(email: string, product: Product) {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping stock alert for ${product.slug}`);
    return;
  }

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: `${product.name} je opět skladem — Gotrid Perfume`,
    html: `
      <h1>Ahoj!</h1>
      <p><strong>${product.name}</strong> je opět skladem! Produkt, na který jste čekali, je znovu k dispozici.</p>
      <p><a href="${SITE_URL}/produkt/${product.slug}">Zobrazit produkt a objednat</a></p>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
