import { buildUnsubscribeUrl } from "@/lib/marketing/unsubscribe";
import type { RecommendedProduct, RecommendationTheme } from "@/lib/marketing/recommend-products";
import { getSettings } from "@/lib/settings.server";
import { emailBenefits, emailButton, emailHelpCard, emailProductGrid, renderEmailLayout } from "./layout";
import { getMailContext, type MailLocale } from "./locale";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

const THEME_COPY: Record<RecommendationTheme, { heading: string; cta: string }> = {
  perfume: {
    heading: "Doufáme, že jste s první objednávkou spokojeni. Jako poděkování máte slevu {percent} % na další parfém.",
    cta: "Vybrat si další parfém",
  },
  home_fragrance: {
    heading:
      "Doufáme, že vám vaše difuzér/svíčka od Gotrid Perfume voní. Jako poděkování máte slevu {percent} % na další kousek do interiéru nebo auta.",
    cta: "Prohlédnout vůně do interiéru a auta",
  },
};

export async function renderSecondOrderEmailHtml(params: {
  email: string;
  firstName: string;
  couponCode: string;
  discountPercent: number;
  validUntil: Date;
  theme: RecommendationTheme;
  products: RecommendedProduct[];
  locale?: MailLocale;
}): Promise<string> {
  const ctx = await getMailContext(params.locale ?? "cs");
  const { tr } = ctx;
  const copy = THEME_COPY[params.theme];
  const heading = tr(copy.heading, { percent: params.discountPercent });
  const [unsubscribeUrl, benefits, settings] = await Promise.all([
    buildUnsubscribeUrl(params.email),
    emailBenefits(ctx),
    getSettings(),
  ]);
  const inner = `
      <h1>${tr("Ahoj")}${params.firstName ? ` ${params.firstName}` : ""}!</h1>
      <p>${heading}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="border:1px dashed #8a857e;border-radius:4px;padding:12px 20px;">
            <span style="font-size:13px;font-weight:700;color:#4b6b4f;vertical-align:middle;">−${params.discountPercent} %</span>
            <span style="font-size:18px;font-weight:700;letter-spacing:1px;vertical-align:middle;margin-left:10px;">${params.couponCode}</span>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#8a857e;margin:-12px 0 24px;">${tr("Kód platí do {date}, jednou, při objednávce na tento e-mail ({email}). Pokud vám nefunguje, napište nám na info@gotridperfume.cz.", { date: params.validUntil.toLocaleDateString(ctx.locale === "sk" ? "sk-SK" : "cs-CZ"), email: params.email })}</p>
      ${emailProductGrid(tr("Vyberte si z nabídky"), params.products, ctx, settings.czkToEurRate)}
      ${emailButton(ctx.url("/"), tr(copy.cta))}
      ${benefits}
      ${emailHelpCard(ctx)}
    `;
  return renderEmailLayout(inner, {
    preheader: heading,
    footerNote: `${tr("Tento e-mail vám zasíláme jako zákazníkovi, který si u nás objednal, s nabídkou obdobného zboží (§7 odst. 3 zákona č. 480/2004 Sb.).")} <a href="${unsubscribeUrl}" style="color:#8a857e">${tr("Odhlásit se z těchto e-mailů")}</a>.`,
    ctx,
  });
}

export async function sendSecondOrderEmail(params: {
  email: string;
  firstName: string;
  couponCode: string;
  discountPercent: number;
  validUntil: Date;
  theme: RecommendationTheme;
  products: RecommendedProduct[];
  locale?: MailLocale;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping second-order email for ${params.email}`);
    return;
  }

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.email,
    subject: `${(await getMailContext(params.locale ?? "cs")).tr("Sleva na vaši další objednávku")} — Gotrid Perfume`,
    html: await renderSecondOrderEmailHtml(params),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
