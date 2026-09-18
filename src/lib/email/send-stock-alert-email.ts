import type { Product } from "@prisma/client";
import { SITE_URL } from "@/lib/site";
import { getSimilarProducts } from "@/lib/marketing/recommend-products";
import { emailBenefits, emailButton, emailProductGrid, renderEmailLayout } from "./layout";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

export async function renderStockAlertEmailHtml(product: Product): Promise<string> {
  const [benefits, similar] = await Promise.all([emailBenefits(), getSimilarProducts(product.id)]);
  const inner = `
      <h1>Ahoj!</h1>
      <p><strong>${product.name}</strong> je opět skladem! Produkt, na který jste čekali, je znovu k dispozici.</p>
      ${emailButton(`${SITE_URL}/produkt/${product.slug}`, "Zobrazit produkt a objednat")}
      ${benefits}
      ${emailProductGrid("Mohlo by se vám také líbit", similar)}
    `;
  return renderEmailLayout(inner, { preheader: `${product.name} je opět skladem.` });
}

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
    html: await renderStockAlertEmailHtml(product),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
