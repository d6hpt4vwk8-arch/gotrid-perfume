import { SITE_URL } from "@/lib/site";
import { buildUnsubscribeUrl } from "@/lib/marketing/unsubscribe";
import { getSettings } from "@/lib/settings.server";
import { emailButton, emailHelpCard, renderEmailLayout } from "./layout";
import { getMailContext, type MailLocale } from "./locale";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

export interface WishlistMailItem {
  slug: string;
  name: string;
  nameSk: string | null;
  imageUrl: string | null;
  price: number;
  /** Set when the price fell below what we last told the customer. */
  previousPrice: number | null;
  /** Set when only a few units are left. */
  lowStock: number | null;
}

export async function renderWishlistEmailHtml(params: {
  email: string;
  firstName: string;
  items: WishlistMailItem[];
  locale?: MailLocale;
}): Promise<string> {
  const ctx = await getMailContext(params.locale ?? "cs");
  const { tr } = ctx;
  const sk = ctx.locale === "sk";
  const [unsubscribeUrl, settings] = await Promise.all([buildUnsubscribeUrl(params.email), getSettings()]);
  const rate = settings.czkToEurRate;

  const rows = params.items
    .map((item) => {
      const name = sk && item.nameSk ? item.nameSk : item.name;
      const url = ctx.url(`/produkt/${item.slug}`);
      const notes: string[] = [];
      if (item.previousPrice !== null) {
        notes.push(
          `<span style="font-weight:700;color:#4b6b4f;">${tr("Nová cena")} ${ctx.price(item.price, rate)}</span> <span style="color:#8a857e;text-decoration:line-through;">${ctx.price(item.previousPrice, rate)}</span>`,
        );
      }
      if (item.lowStock !== null) {
        notes.push(`<span style="font-weight:700;color:#a8431a;">${tr("Zbývají poslední {n} ks", { n: item.lowStock })}</span>`);
      }
      return `
        <tr>
          <td style="padding:12px 12px 12px 0;border-bottom:1px solid #e2e0dc;width:84px;">
            ${item.imageUrl ? `<a href="${url}"><img src="${SITE_URL}${item.imageUrl}" alt="" width="72" style="display:block;border-radius:4px;"></a>` : ""}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e2e0dc;font-size:14px;vertical-align:middle;">
            <a href="${url}" style="color:#131110;text-decoration:none;font-weight:600;">${name}</a><br>
            <span style="font-size:13px;">${notes.join(" · ")}</span>
          </td>
        </tr>`;
    })
    .join("");

  const inner = `
      <h1>${tr("Ahoj")}${params.firstName ? ` ${params.firstName}` : ""}!</h1>
      <p>${tr("U produktů, které máte v oblíbených, se něco změnilo:")}</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 24px;">${rows}</table>
      ${emailButton(ctx.url("/oblibene"), tr("Zobrazit oblíbené"))}
      ${emailHelpCard(ctx)}
    `;
  return renderEmailLayout(inner, {
    preheader: tr("Změna u vašich oblíbených produktů."),
    footerNote: `${tr("Tento e-mail vám zasíláme, protože jste při registraci souhlasili se zasíláním novinek a slev.")} <a href="${unsubscribeUrl}" style="color:#8a857e">${tr("Odhlásit se z těchto e-mailů")}</a>.`,
    ctx,
  });
}

export async function sendWishlistEmail(params: {
  email: string;
  firstName: string;
  items: WishlistMailItem[];
  locale?: MailLocale;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping wishlist email for ${params.email}`);
    return false;
  }
  const ctx = await getMailContext(params.locale ?? "cs");
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.email,
    subject: `${ctx.tr("Změna u vašich oblíbených produktů")} — Gotrid Perfume`,
    html: await renderWishlistEmailHtml(params),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return true;
}
