import { buildUnsubscribeUrl } from "@/lib/marketing/unsubscribe";
import type { DealProduct, WeeklyNewsletterPlan } from "@/lib/marketing/weekly-newsletter";
import { SITE_URL } from "@/lib/site";
import { getSettings } from "@/lib/settings.server";
import { emailBenefits, emailButton, emailProductGrid, renderEmailLayout } from "./layout";
import { getMailContext, type MailContext } from "./locale";

// Customer-typed names go straight into the HTML.
const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const INK = "#131110";
const MUTED = "#8a857e";
const OK = "#4b6b4f";

function emailDealGrid(heading: string, deals: DealProduct[], ctx: MailContext, czkToEurRate: number): string {
  if (deals.length === 0) return "";
  const cells = deals
    .map((p) => {
      const off = Math.round((1 - p.price / p.compareAtPrice) * 100);
      return `
        <td style="padding:8px;text-align:center;vertical-align:top;width:${Math.floor(100 / deals.length)}%;">
          ${p.imageUrl ? `<a href="${ctx.url(`/produkt/${p.slug}`)}"><img src="${SITE_URL}${p.imageUrl}" alt="" width="120" style="display:block;margin:0 auto 8px;border-radius:4px;max-width:100%;"></a>` : ""}
          <a href="${ctx.url(`/produkt/${p.slug}`)}" style="font-size:13px;color:${INK};text-decoration:none;">${p.name}</a>
          <div style="font-size:13px;margin-top:4px;">
            <span style="font-weight:700;">${ctx.price(p.price, czkToEurRate)}</span>
            <span style="color:${MUTED};text-decoration:line-through;margin-left:6px;">${ctx.price(p.compareAtPrice, czkToEurRate)}</span>
            <span style="color:${OK};font-weight:700;margin-left:6px;">−${off} %</span>
          </div>
        </td>`;
    })
    .join("");
  return `
    <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${MUTED};margin:0 0 12px;">${heading}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;"><tr>${cells}</tr></table>`;
}

/**
 * Weekly personalised e-mail (render only — nothing here sends). `unsubscribeEmail` lets the preview script
 * sign the opt-out link for a dummy address instead of a real customer's.
 */
export async function renderWeeklyNewsletterHtml(
  plan: WeeklyNewsletterPlan,
  opts: { unsubscribeEmail?: string; settings?: { freeShippingThreshold: number; czkToEurRate: number } } = {},
): Promise<string> {
  const ctx = await getMailContext("cs");
  const { tr } = ctx;
  const [unsubscribeUrl, benefits, settings] = await Promise.all([
    buildUnsubscribeUrl(opts.unsubscribeEmail ?? plan.email),
    emailBenefits(ctx, opts.settings),
    opts.settings ?? getSettings(),
  ]);
  const rate = settings.czkToEurRate;
  // Generic heading on purpose: naming the last purchased product made long, odd headings and felt like surveillance.
  const complementHeading = tr("K tomu se hodí");
  const ctaLabel =
    plan.theme === "perfume"
      ? tr("Zobrazit všechny parfémy")
      : plan.theme === "home_fragrance"
        ? tr("Zobrazit vůně do domova a auta")
        : tr("Zobrazit celou kategorii");

  const inner = `
      <h1>${tr("Ahoj")}${plan.firstName ? ` ${escapeHtml(plan.firstName)}` : ""}!</h1>
      <p>${tr("Vybrali jsme pro vás pár kousků podle toho, co jste u nás nakupovali.")}</p>
      ${emailProductGrid(tr("Pro vás tento týden"), plan.picks, ctx, rate)}
      ${emailProductGrid(complementHeading, plan.complements, ctx, rate)}
      ${emailDealGrid(tr("Teď zlevněno"), plan.deals, ctx, rate)}
      ${emailButton(ctx.url(plan.ctaPath), ctaLabel, { large: true })}
      ${benefits}
    `;
  return renderEmailLayout(inner, {
    preheader: plan.preheader,
    footerNote: `${tr("Tento e-mail vám zasíláme jako zákazníkovi, který si u nás objednal, s nabídkou obdobného zboží (§7 odst. 3 zákona č. 480/2004 Sb.).")} <a href="${unsubscribeUrl}" style="color:#8a857e">${tr("Odhlásit se z těchto e-mailů")}</a>.`,
    ctx,
  });
}
