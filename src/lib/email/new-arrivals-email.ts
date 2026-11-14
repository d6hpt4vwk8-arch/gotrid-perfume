import { buildUnsubscribeUrl } from "@/lib/marketing/unsubscribe";
import type { NewArrivalsPlan } from "@/lib/marketing/new-arrivals";
import { getSettings } from "@/lib/settings.server";
import { emailBenefits, emailButton, emailProductGrid, renderEmailLayout } from "./layout";
import { getMailContext } from "./locale";

// Customer-typed names go straight into the HTML.
const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "Novinky" mail for newsletter subscribers (render only — nothing here sends). */
export async function renderNewArrivalsHtml(
  plan: NewArrivalsPlan,
  opts: { unsubscribeEmail?: string; settings?: { freeShippingThreshold: number; czkToEurRate: number } } = {},
): Promise<string> {
  const ctx = await getMailContext("cs");
  const { tr } = ctx;
  const [unsubscribeUrl, benefits, settings] = await Promise.all([
    buildUnsubscribeUrl(opts.unsubscribeEmail ?? plan.email),
    emailBenefits(ctx, opts.settings),
    opts.settings ?? getSettings(),
  ]);
  const ctaLabel =
    plan.theme === "perfume"
      ? tr("Zobrazit všechny parfémy")
      : plan.theme === "home_fragrance"
        ? tr("Zobrazit vůně do domova a auta")
        : tr("Zobrazit celou kategorii");

  const inner = `
      <h1>${tr("Ahoj")}${plan.firstName ? ` ${escapeHtml(plan.firstName)}` : ""}!</h1>
      <p>${tr("V nabídce přibylo zboží z kategorií, které si u nás kupujete.")}</p>
      ${emailProductGrid(tr("Nově u nás"), plan.products, ctx, settings.czkToEurRate)}
      ${emailButton(ctx.url(plan.ctaPath), ctaLabel, { large: true })}
      ${benefits}
    `;
  return renderEmailLayout(inner, {
    preheader: plan.preheader,
    footerNote: `${tr("Tento e-mail dostáváte, protože jste se přihlásili k odběru novinek. Posíláme ho nejvýše jednou týdně a jen když přibude něco nového.")} <a href="${unsubscribeUrl}" style="color:#8a857e">${tr("Odhlásit se z těchto e-mailů")}</a>.`,
    ctx,
  });
}
