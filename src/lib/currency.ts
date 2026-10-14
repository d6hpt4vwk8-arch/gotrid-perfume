/**
 * The shop has one currency per country: Česko (/) shows CZK, Slovensko (/sk)
 * shows EUR. There is no separate currency switcher — picking the country in
 * the header is what picks the currency.
 */
export type Currency = "CZK" | "EUR";

export function currencyForLocale(locale: string): Currency {
  return locale === "sk" ? "EUR" : "CZK";
}
