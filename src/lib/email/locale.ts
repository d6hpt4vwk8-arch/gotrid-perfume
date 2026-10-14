import { loadDictionary } from "@/i18n/dictionary";
import { makeTr, type Tr } from "@/i18n/tr";
import { formatEur, formatPrice } from "@/lib/format";
import { SITE_URL } from "@/lib/site";

// E-mails and PDFs follow the same rule as the storefront: Slovak when the
// order ships to Slovensko, Czech otherwise. Strings are Czech sentences
// looked up in messages/sk.json (see src/i18n/tr.ts) — an unknown sentence
// simply stays Czech, never blank.
export type MailLocale = "cs" | "sk";

export interface MailContext {
  locale: MailLocale;
  tr: Tr;
  /** Absolute URL of a storefront path in the customer's language. */
  url: (path: string) => string;
  /** Absolute URL of a language-independent route (/api/...). */
  apiUrl: (path: string) => string;
  /** Formats a CZK shop amount for a customer who is not tied to one order (cross-sell cards, thresholds). */
  price: (czk: number, czkToEurRate: number) => string;
}

export function orderMailLocale(order: { shippingCountry: string }): MailLocale {
  return order.shippingCountry === "SK" ? "sk" : "cs";
}

export async function getMailContext(locale: MailLocale): Promise<MailContext> {
  const tr = makeTr(await loadDictionary(locale));
  return {
    locale,
    tr,
    url: (path) => `${SITE_URL}${locale === "sk" ? "/sk" : ""}${path === "/" ? "" : path}`,
    apiUrl: (path) => `${SITE_URL}${path}`,
    price: (czk, rate) => (locale === "sk" ? formatEur(czk, rate) : formatPrice(czk)),
  };
}

/** Czech context used by call sites that have no order (abandoned checkout, stock alerts, …). */
export const CS_MAIL: MailContext = {
  locale: "cs",
  tr: makeTr({}),
  url: (path) => `${SITE_URL}${path === "/" ? "" : path}`,
  apiUrl: (path) => `${SITE_URL}${path}`,
  price: (czk) => formatPrice(czk),
};
