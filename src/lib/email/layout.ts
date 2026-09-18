import { CONTACT, currentSeller, sellerLine } from "@/lib/business-identity";
import { SITE_URL } from "@/lib/site";
import { formatPrice } from "@/lib/format";
import { getSettings } from "@/lib/settings.server";
import type { RecommendedProduct } from "@/lib/marketing/recommend-products";

// Shared visual wrapper for every outgoing email — same ink/ground/line/accent
// tokens as globals.css, kept here as plain hex since email clients don't
// resolve CSS custom properties reliably (Outlook desktop in particular).
const INK = "#131110";
const GROUND = "#ffffff";
const LINE = "#e2e0dc";
const MUTED = "#8a857e";
const OK = "#4b6b4f";
const PAGE_BG = "#f3f2f0";

export function emailButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;border-collapse:collapse;">
      <tr>
        <td style="background:${INK};border-radius:4px;">
          <a href="${href}" style="display:inline-block;padding:12px 26px;color:${GROUND};text-decoration:none;font-size:14px;font-weight:600;">${label}</a>
        </td>
      </tr>
    </table>`;
}

// Same trust claims as TrustBadges/BenefitsBar on the site itself — never
// invent marketing copy that isn't already true and shown on the storefront.
export async function emailBenefits(): Promise<string> {
  const settings = await getSettings();
  const items = [
    `Doprava zdarma od ${formatPrice(settings.freeShippingThreshold)}`,
    "100 % originální produkty",
    "Vrácení zboží do 14 dnů",
    "Zabezpečená platba",
  ];
  const cells = items
    .map(
      (item) => `
        <td style="padding:6px 12px 6px 0;font-size:13px;color:${INK};white-space:nowrap;">
          <span style="color:${OK};font-weight:700;">✓</span> ${item}
        </td>`,
    )
    .join("");
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};">
      <tr><td style="padding:14px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr>
    </table>`;
}

// "You might also like" product cards — reused for order-confirmation,
// abandoned-checkout, stock-alert and second-order cross-sell blocks.
export function emailProductGrid(heading: string, products: RecommendedProduct[]): string {
  if (products.length === 0) return "";
  const cells = products
    .map(
      (p) => `
        <td style="padding:8px;text-align:center;vertical-align:top;width:${Math.floor(100 / products.length)}%;">
          ${p.imageUrl ? `<a href="${SITE_URL}/produkt/${p.slug}"><img src="${SITE_URL}${p.imageUrl}" alt="" width="120" style="display:block;margin:0 auto 8px;border-radius:4px;max-width:100%;"></a>` : ""}
          <a href="${SITE_URL}/produkt/${p.slug}" style="font-size:13px;color:${INK};text-decoration:none;">${p.name}</a>
          <div style="font-size:13px;font-weight:700;margin-top:4px;">${formatPrice(p.price)}</div>
        </td>`,
    )
    .join("");
  return `
    <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${MUTED};margin:0 0 12px;">${heading}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;"><tr>${cells}</tr></table>`;
}

// "Need help?" contact callout — same phone/email as the footer, repeated
// as a standalone card in marketing-adjacent emails (abandoned checkout,
// second order) where a hesitant customer is more likely to reach for it
// mid-email than to scroll all the way down to the footer.
export function emailHelpCard(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;">
      <tr>
        <td style="background:${PAGE_BG};border-radius:6px;padding:20px 24px;">
          <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:${INK};">Můžeme vám s něčím pomoct?</p>
          <p style="margin:0;font-size:13px;color:${MUTED};">
            ${CONTACT.phone} · <a href="mailto:${CONTACT.email}" style="color:${INK};">${CONTACT.email}</a><br>${CONTACT.supportHours}
          </p>
        </td>
      </tr>
    </table>`;
}

export function renderEmailLayout(innerHtml: string, opts?: { preheader?: string; footerNote?: string }): string {
  const seller = currentSeller();
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title></title>
<style>
  body { margin:0; padding:0; background:${PAGE_BG}; }
  body, td, a, p, h1 { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  h1 { font-size:20px; line-height:1.3; margin:0 0 16px; font-weight:600; color:${INK}; }
  p { font-size:15px; line-height:1.6; margin:0 0 16px; color:${INK}; }
  a { color:${INK}; }
  table { border-collapse:collapse; }
</style>
</head>
<body>
${opts?.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:${GROUND};">
        <tr>
          <td style="background:${INK};padding:20px 32px;">
            <span style="color:${GROUND};font-size:16px;font-weight:700;letter-spacing:0.5px;">GOTRID PERFUME</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            ${innerHtml}
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid ${LINE};padding:24px 32px;">
            <p style="font-size:13px;color:${MUTED};margin:0 0 8px;">
              ${CONTACT.phone} · <a href="mailto:${CONTACT.email}" style="color:${MUTED};">${CONTACT.email}</a> · ${CONTACT.supportHours}
            </p>
            <p style="font-size:12px;color:${MUTED};margin:0;">${sellerLine(seller)}</p>
            ${opts?.footerNote ? `<p style="font-size:12px;color:${MUTED};margin:8px 0 0;">${opts.footerNote}</p>` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
