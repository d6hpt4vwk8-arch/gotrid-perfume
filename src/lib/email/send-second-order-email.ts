import { SITE_URL } from "@/lib/site";
import { formatPrice } from "@/lib/format";
import { buildUnsubscribeUrl } from "@/lib/marketing/unsubscribe";
import type { RecommendedProduct, RecommendationTheme } from "@/lib/marketing/recommend-products";
import { emailButton, renderEmailLayout } from "./layout";
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
        <td style="padding:8px;text-align:center;vertical-align:top">
          ${p.imageUrl ? `<img src="${SITE_URL}${p.imageUrl}" alt="" width="120" style="display:block;margin:0 auto 8px;border-radius:4px">` : ""}
          <a href="${SITE_URL}/produkt/${p.slug}" style="font-size:13px;color:#131110;text-decoration:none">${p.name}</a>
          <div style="font-size:13px;font-weight:700;margin-top:4px">${formatPrice(p.price)}</div>
        </td>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 24px"><tr>${cells}</tr></table>`;
}

export async function renderSecondOrderEmailHtml(params: {
  email: string;
  firstName: string;
  couponCode: string;
  theme: RecommendationTheme;
  products: RecommendedProduct[];
}): Promise<string> {
  const copy = THEME_COPY[params.theme];
  const unsubscribeUrl = await buildUnsubscribeUrl(params.email);
  const inner = `
      <h1>Ahoj${params.firstName ? ` ${params.firstName}` : ""}!</h1>
      <p>${copy.heading}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr><td style="border:1px dashed #8a857e;border-radius:4px;padding:12px 20px;font-size:18px;font-weight:700;letter-spacing:1px;">${params.couponCode}</td></tr>
      </table>
      ${productsHtml(params.products)}
      ${emailButton(SITE_URL, copy.cta)}
    `;
  return renderEmailLayout(inner, {
    preheader: copy.heading,
    footerNote: `Tento e-mail vám zasíláme jako zákazníkovi, který si u nás objednal, s nabídkou obdobného zboží (§7 odst. 3 zákona č. 480/2004 Sb.). <a href="${unsubscribeUrl}" style="color:#8a857e">Odhlásit se z těchto e-mailů</a>.`,
  });
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

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.email,
    subject: "Sleva na vaši další objednávku — Gotrid Perfume",
    html: await renderSecondOrderEmailHtml(params),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
