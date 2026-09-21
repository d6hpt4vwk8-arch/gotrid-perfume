import { SITE_URL } from "@/lib/site";
import { buildUnsubscribeUrl } from "@/lib/marketing/unsubscribe";
import { emailBenefits, emailButton, emailHelpCard, renderEmailLayout } from "./layout";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

export const REVIEW_COUPON_CODE = "RECENZE30";
export const REVIEW_COUPON_DISPLAY = "30 Kč při objednávce od 250 Kč";

export async function renderReviewRequestEmailHtml(params: {
  email: string;
  firstName: string;
  // Product page to send the "Napsat recenzi" button to — the first item
  // of the delivered order, since reviews are per-product (see
  // ReviewForm on the product page), not store-wide.
  reviewProductSlug: string;
}): Promise<string> {
  const [unsubscribeUrl, benefits] = await Promise.all([
    buildUnsubscribeUrl(params.email),
    emailBenefits(),
  ]);
  const reviewUrl = `${SITE_URL}/produkt/${params.reviewProductSlug}#recenze`;
  const inner = `
      <h1>Ahoj${params.firstName ? ` ${params.firstName}` : ""}!</h1>
      <p>Doufáme, že vám vaše objednávka dorazila v pořádku a jste s ní spokojeni. Pár slov od
      vás by nám i dalším zákazníkům moc pomohlo — napíšete nám krátkou recenzi?</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="border:1px dashed #8a857e;border-radius:4px;padding:12px 20px;">
            <span style="font-size:13px;font-weight:700;color:#4b6b4f;vertical-align:middle;">−${REVIEW_COUPON_DISPLAY}</span>
            <div style="font-size:18px;font-weight:700;letter-spacing:1px;margin-top:4px;">${REVIEW_COUPON_CODE}</div>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#8a857e;margin:-12px 0 20px;">Jako poděkování za recenzi máte tento kód na vaši
      příští objednávku — stačí ho zadat v košíku.</p>
      ${emailButton(reviewUrl, "Napsat recenzi")}
      ${benefits}
      ${emailHelpCard()}
    `;
  return renderEmailLayout(inner, {
    preheader: "Napíšete nám pár slov? Máme pro vás slevu na příště.",
    footerNote: `Tento e-mail vám zasíláme jako zákazníkovi, který si u nás objednal, s prosbou o zpětnou vazbu (§7 odst. 3 zákona č. 480/2004 Sb.). <a href="${unsubscribeUrl}" style="color:#8a857e">Odhlásit se z těchto e-mailů</a>.`,
  });
}

export async function sendReviewRequestEmail(params: {
  email: string;
  firstName: string;
  reviewProductSlug: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping review-request email for ${params.email}`);
    return;
  }

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.email,
    subject: "Jak se vám líbí objednávka? Napište recenzi a získejte slevu",
    html: await renderReviewRequestEmailHtml(params),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
