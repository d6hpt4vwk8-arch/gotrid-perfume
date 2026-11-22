import { isConditionFlagged } from "./condition-flagged";
import { isPaidAdsEligible } from "./paid-ads-eligibility";

// Google/Meta-only exclusions on top of isPaidAdsEligible — these items
// stay eligible for Heureka/Zboží (a semi-clearance/dupe click there is
// still worth paying for, see paid-ads-eligibility.ts), but shouldn't
// represent us in Google's free listings or any future Ads/Merchant
// account: Eyfel's own perfumes are a recognizable dupe line best kept off
// Google specifically, and anything already marked down to Výprodej is, by
// definition, not the normal-price listing Google should be showing.
export function isExcludedFromGoogleAds(product: {
  brandName: string | null;
  isPerfume: boolean;
  isOnClearance: boolean;
}): boolean {
  if (!product.isPerfume) return false;
  if (product.brandName === "Eyfel Perfume") return true;
  if (product.isOnClearance) return true;
  return false;
}

// Cannabis/CBD names are a restricted category for Google Shopping and Meta (and the EU rules differ per
// country), so they stay out of both feeds. Plain hemp-seed cosmetics ("konopné semínko", "konopný balzám")
// are legal everyday products and are not matched — only an explicit CBD or cannabis in the name.
export function isHempRestricted(name: string): boolean {
  return /\bcbd\b|cannab|cannasex/i.test(name);
}


// Belt and braces on top of isPaidAdsEligible's allowlist: a luxury/designer/niche perfume house must never get Product
// markup or a Google feed row, whatever supplier prefix (TDE-, GVS-, PAL-, original catalogue) the product came in under
// — a wrongly tagged import must not be able to put "branded item, no unique content, priced under MSRP" in front of
// Merchant Center again (the fingerprint that got the previous store's account suspended for counterfeit goods).
// Brand names match anywhere; product names only on the few house names that cannot be an everyday word.
const LUXURY_BRAND = new RegExp(
  "\\b(" +
    [
      "creed", "dior", "chanel", "versace", "giorgio armani", "emporio armani", "armani", "yves saint laurent", "saint laurent", "ysl",
      "gucci", "prada", "burberry", "herm[eè]s", "dolce\\s*&?\\s*gabbana", "valentino", "givenchy", "tom ford", "lanc[oô]me",
      "paco rabanne", "rabanne", "carolina herrera", "montblanc", "bvlgari", "bulgari", "cartier", "boucheron", "fendi", "celine",
      "balenciaga", "loewe", "bottega veneta", "jo malone", "penhaligon", "guerlain", "kilian", "byredo", "le labo", "xerjoff",
      "amouage", "parfums de marly", "initio", "maison margiela", "maison francis kurkdjian", "francis kurkdjian", "nishane",
      "roja dove", "roja parfums", "escentric molecules", "mancera", "montale", "tiziana terenzi", "creed aventus", "memo paris",
      "ex nihilo", "frederic malle", "serge lutens", "diptyque", "atelier cologne", "acqua di parma", "etro", "jean paul gaultier",
      "narciso rodriguez", "mugler", "thierry mugler", "issey miyake", "kenzo", "lalique", "chlo[eé]", "marc jacobs", "michael kors",
      "tommy hilfiger", "hugo boss", "calvin klein", "ralph lauren", "lacoste", "davidoff", "azzaro", "moschino", "jil sander",
      "nina ricci", "elie saab", "viktor\\s*&\\s*rolf", "van cleef", "swarovski", "jimmy choo", "salvatore ferragamo", "ferragamo",
    ].join("|") +
    ")\\b",
  "i",
);
// Only names that cannot be an everyday word; "armani", "kenzo" etc. are caught via the brand field above.
const LUXURY_NAME = /\b(creed|dior|chanel|versace|gucci|prada|burberry|tom ford|yves saint laurent|dolce\s*&\s*gabbana|givenchy|lanc[oô]me|xerjoff|amouage|byredo|le labo|jo malone|parfums de marly)\b/i;

export function isLuxuryOrNiche(brandName: string | null, name: string): boolean {
  if (brandName && LUXURY_BRAND.test(brandName)) return true;
  return LUXURY_NAME.test(name);
}

// One verdict for "may Google see this product": the Google feed and the product-page JSON-LD both use it.
// Merchant Center collects products on its own from the Product markup of any crawled page (it did on 2026-11-18,
// 929 products incl. designer perfumes), so a product the feed keeps out of Google must not carry Product markup
// either. The page itself stays visible and buyable for customers.
export function isGoogleListable(p: {
  code: string;
  name: string;
  isDefective: boolean;
  brandName: string | null;
  isPerfume: boolean;
  isOnClearance: boolean;
}): boolean {
  return (
    !isConditionFlagged(p.name, p.isDefective) &&
    isPaidAdsEligible(p.code, p.brandName) &&
    !isExcludedFromGoogleAds(p) &&
    !isHempRestricted(p.name) &&
    !isLuxuryOrNiche(p.brandName, p.name)
  );
}
