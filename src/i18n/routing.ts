import { defineRouting } from "next-intl/routing";

// "cs" is the default (no prefix); "sk" lives under /sk/... and exists for
// Heureka.sk / Slovak customers. Paths stay Czech (/sk/produkt/slug) — only
// the language of the UI and the product copy (nameSk/descriptionSk) change.
export const routing = defineRouting({
  locales: ["cs", "sk"],
  defaultLocale: "cs",
  localePrefix: "as-needed",
  // The language is chosen explicitly via the switcher / the /sk URL; never
  // redirect a Czech visitor to /sk just because of an Accept-Language header.
  localeDetection: false,
});

export type AppLocale = (typeof routing.locales)[number];
