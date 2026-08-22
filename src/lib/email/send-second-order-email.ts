import { SITE_URL } from "@/lib/site";
import { formatPrice } from "@/lib/format";
import { buildUnsubscribeUrl } from "@/lib/marketing/unsubscribe";
import type { RecommendedProduct, RecommendationTheme } from "@/lib/marketing/recommend-products";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

const THEME_COPY: Record<RecommendationTheme, { heading: string; cta: string }> = {
  perfume: {
    heading: "Doufáme, že jste s první objednávkou spokojeni. Jako poděkování máte na další parfém slevu.",
    cta: "Vybrat si další parfém",
  },
  home_fragrance: {
    heading:
      "Doufáme, že vám vaše difuzér/svíčka od Gotrid Perfume voní. Jako poděkování máte slevu na další kousek do interiéru nebo auta.",
    cta: "Prohlédnout vůně do interiéru a auta",
  },
};

function productsHtml(products: RecommendedProduct[]): string {
  if (products.length === 0) return "";
  const cells = products
    .map(
      (p) => `
        <td style="padding:8px;text-align:center">
          ${p.imageUrl ? `<img src="${SITE_URL}${p.imageUrl}" alt="" width="120" style="display:block;margin:0 auto 6px">` : ""}
          <a href="${SITE_URL}/produkt/${p.slug}" style="font-size:13px;color:#111">${p.name}</a>
          <div style="font-size:13px;font-weight:bold">${formatPrice(p.price)}</div>
        </td>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0"><tr>${cells}</tr></table>`;
}

export async function sendSecondOrderEmail(params: {
  email: string;
  firstName: string;
  couponCode: string;
  theme: RecommendationTheme;
  products: RecommendedProduct[];
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping second-order email for ${params.email}`);
    return;
  }

  const copy = THEME_COPY[params.theme];
  const unsubscribeUrl = await buildUnsubscribeUrl(params.email);
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.email,
    subject: "Sleva na vaši další objednávku — Gotrid Perfume",
    html: `
      <h1>Ahoj${params.firstName ? ` ${params.firstName}` : ""}!</h1>
      <p>${copy.heading}</p>
      <p style="font-size:20px;font-weight:bold;letter-spacing:1px">${params.couponCode}</p>
      ${productsHtml(params.products)}
      <p><a href="${SITE_URL}">${copy.cta}</a></p>
      <hr>
      <p style="font-size:12px;color:#666">
        Tento e-mail dostáváte, protože jste se při registraci na Gotrid Perfume přihlásili k odběru
        novinek. <a href="${unsubscribeUrl}">Odhlásit se z těchto e-mailů</a>.
      </p>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
