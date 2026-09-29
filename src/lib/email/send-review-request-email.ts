import { buildUnsubscribeUrl } from "@/lib/marketing/unsubscribe";
import { emailBenefits, emailButton, emailHelpCard, renderEmailLayout } from "./layout";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

export const REVIEW_COUPON_CODE = "RECENZE30";
export const REVIEW_COUPON_DISPLAY = "30 Kč při objednávce od 250 Kč";

// Own-site product reviews don't carry any weight with a stranger yet — a
// new shop has no track record there. Point people at places a review
// actually means something to someone else: Zboží.cz (owner turned off its
// verified-only mode 2026-09 to stop double-emailing customers already
// getting Heureka's own verified-review invite for the same order, so
// anyone can post there now, not just verified buyers) and the shop's
// Facebook page, both freely writable by any visitor. Heureka's own
// "Ověřeno zákazníky" flow is a separate invite Heureka itself emails
// after a verified purchase — this link can only let someone look at
// existing reviews, not start a fresh one, so it's offered as a "you might
// already have that invite in your inbox" nudge, not a primary CTA.
const ZBOZI_REVIEW_URL = "https://www.zbozi.cz/obchod/235023/";
const FACEBOOK_REVIEW_URL = "https://www.facebook.com/Gotrid.perfume/reviews";
const HEUREKA_REVIEW_URL = "https://obchody.heureka.cz/gotridperfume-cz/recenze/";

export async function renderReviewRequestEmailHtml(params: {
  email: string;
  firstName: string;
}): Promise<string> {
  const [unsubscribeUrl, benefits] = await Promise.all([
    buildUnsubscribeUrl(params.email),
    emailBenefits(),
  ]);
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
      ${emailButton(ZBOZI_REVIEW_URL, "Napsat recenzi na Zboží.cz")}
      <p style="font-size:13px;color:#8a857e;margin:-12px 0 24px;">Nebo nám napište pár slov na
      <a href="${FACEBOOK_REVIEW_URL}" style="color:#131110">Facebooku</a> — případně, pokud vám od nedávné
      objednávky přišla pozvánka od Heureky, budeme rádi i za hodnocení
      <a href="${HEUREKA_REVIEW_URL}" style="color:#131110">tam</a>.</p>
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
