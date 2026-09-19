import { SITE_URL } from "@/lib/site";
import { buildUnsubscribeUrl } from "@/lib/marketing/unsubscribe";
import type { RecommendedProduct, RecommendationTheme } from "@/lib/marketing/recommend-products";
import { emailBenefits, emailButton, emailHelpCard, emailProductGrid, renderEmailLayout } from "./layout";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

const THEME_COPY: Record<RecommendationTheme, { heading: (percent: number) => string; cta: string }> = {
  perfume: {
    heading: (percent) =>
      `Doufáme, že jste s první objednávkou spokojeni. Jako poděkování máte slevu ${percent} % na další parfém.`,
    cta: "Vybrat si další parfém",
  },
  home_fragrance: {
    heading: (percent) =>
      `Doufáme, že vám vaše difuzér/svíčka od Gotrid Perfume voní. Jako poděkování máte slevu ${percent} % na další kousek do interiéru nebo auta.`,
    cta: "Prohlédnout vůně do interiéru a auta",
  },
};

export async function renderSecondOrderEmailHtml(params: {
  email: string;
  firstName: string;
  couponCode: string;
  discountPercent: number;
  theme: RecommendationTheme;
  products: RecommendedProduct[];
}): Promise<string> {
  const copy = THEME_COPY[params.theme];
  const heading = copy.heading(params.discountPercent);
  const [unsubscribeUrl, benefits] = await Promise.all([buildUnsubscribeUrl(params.email), emailBenefits()]);
  const inner = `
      <h1>Ahoj${params.firstName ? ` ${params.firstName}` : ""}!</h1>
      <p>${heading}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="border:1px dashed #8a857e;border-radius:4px;padding:12px 20px;">
            <span style="font-size:13px;font-weight:700;color:#4b6b4f;vertical-align:middle;">−${params.discountPercent} %</span>
            <span style="font-size:18px;font-weight:700;letter-spacing:1px;vertical-align:middle;margin-left:10px;">${params.couponCode}</span>
          </td>
        </tr>
      </table>
      ${emailProductGrid("Vyberte si z nabídky", params.products)}
      ${emailButton(SITE_URL, copy.cta)}
      ${benefits}
      ${emailHelpCard()}
    `;
  return renderEmailLayout(inner, {
    preheader: heading,
    footerNote: `Tento e-mail vám zasíláme jako zákazníkovi, který si u nás objednal, s nabídkou obdobného zboží (§7 odst. 3 zákona č. 480/2004 Sb.). <a href="${unsubscribeUrl}" style="color:#8a857e">Odhlásit se z těchto e-mailů</a>.`,
  });
}

export async function sendSecondOrderEmail(params: {
  email: string;
  firstName: string;
  couponCode: string;
  discountPercent: number;
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
