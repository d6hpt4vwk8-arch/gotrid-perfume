// Heureka and Sklik (Sklik's Nákupy/Shopping campaigns ingest the same
// Zboží.cz-format feed, i.e. zbozi.xml) are paid-per-click — every listing
// there costs money whether or not it converts. Decided 2026-09-02: only
// advertise what we can actually win on price — Tamda and Korean cosmetics
// (where we're competitive) and Arabic-dupe fragrances (cheap enough to
// undercut), never designer/niche perfumes (Heureka/Zboží price-compare
// against retailers who buy at real distributor volume; we can't win that
// fight on a handful of units, so a click there is a click we pay for and
// lose).
//
// Extended to Google/Meta on 2026-09-17: those feeds have no per-click cost
// (Merchant Center free listings, and Ads once that's rebuilt), so the
// price-competitiveness reasoning above doesn't apply there — but almost
// none of the excluded designer perfumes have a real per-product
// description (feedDescription() falls back to repeating the name), and
// "branded item, no unique content, priced under MSRP" is close to the
// exact fingerprint that got the previous store's Ads account suspended
// for counterfeit goods. Keeping Google/Meta to the same eligible set
// avoids reproducing that on the next account.
const ARABIC_PERFUME_BRANDS = new Set(
  [
    "Fragrance World", "French Avenue", "Gulf Orchid", "Khadlaj", "Emir",
    "Arabiyat Prestige", "Maison Asrar", "Auraa Desire", "Rayhaan",
    "Arabiyat Sugar", "Matin Martin", "Al Haramain", "Ministry Of Oud",
    "Nylaa", "Afnan", "Anfar 1950", "Anfar London", "La Fede", "North Stag",
    "Armaf", "Armaf Beauté", "Lattafa", "Swiss Arabian", "Zimaya", "Hamidi",
    "Grandeur", "Al Wataniah", "Risala", "Paris Corner", "Dark Stag",
    "Maison Alhambra",
  ].map((b) => b.toLowerCase()),
);

// The original, pre-supplier catalog — added by hand before TDE-/SPV-/PWH-/
// GVS- import prefixes existed, so it kept the plain short numeric codes
// from that first manual product-entry scheme ("43", "361", …) instead.
// Distinct stock we already own (not a supplier's shared inventory), and
// mostly what's left of it now sits in Výprodej — unlike the Heureka/Zboží
// price-war designer perfumes are excluded from above, a semi-clearance
// click here is worth paying for since the goal is moving owned stock, not
// margin on a repeat sale. EAN-style codes (8+ digits) are a separate,
// unrelated import and intentionally not matched by this.
const ORIGINAL_CATALOG_CODE = /^\d{1,5}$/;

// 2026-09-19: SPV Venture (500+ brands, one shared supplier code prefix)
// turned out to carry a lot more than Arabic-dupe perfumes under SPV- — real
// pharmacy skincare, dental care, drugstore makeup, professional haircare,
// home fragrance and K-beauty brands were all getting swept into the same
// "designer perfume, exclude" bucket purely for sharing a supplier, with
// none of that category's actual risk (no counterfeit-brand fingerprint,
// no losing price war against volume retailers — these aren't perfume SKUs
// at all). Explicit brand allowlist, not a category/prefix rule, so a
// genuine luxury/niche/designer perfume brand from the same supplier (Dior,
// Chanel, Xerjoff, Byredo, …) stays excluded rather than slipping back in.
const MASS_MARKET_BRANDS = new Set(
  [
    // Pharmacy / dermocosmetic skincare
    "Bioderma", "Vichy", "La Roche-Posay", "Nuxe", "CeraVe", "Uriage",
    "Apivita", "Ziaja", "Dr. Hauschka", "Natura Siberica", "Eucerin",
    "Collistar", "Swiss Image", "Renovality", "Organicals", "Purity Vision",
    "Erborian", "VivaPharm", "Biorepair",
    // Dental / oral hygiene
    "TePe", "Corega", "Sensodyne", "Oral-B", "Listerine", "Parodontax",
    "Elmex", "Swissdent", "Lacalut", "Apagard",
    // Mass drugstore makeup
    "Maybelline", "L'Oréal Paris", "Rimmel London", "Rimmel", "Max Factor",
    "Bourjois", "Garnier", "Essence", "Artdeco", "Astra", "RYOR",
    // Professional / mass haircare
    "Schwarzkopf Professional", "Wella Professionals", "Kérastase",
    "L'Oréal Professionnel", "Moroccanoil", "Alfaparf Milano", "RefectoCil",
    "label.m", "Alcina", "Londa Professional", "Invisibobble", "Tangle Teezer",
    "Hairburst", "Revlon Professional", "PURING", "HS Milano",
    // Home fragrance / candles — not a wearable-perfume fingerprint
    "Yankee Candle", "WoodWick", "Millefiori", "Bolsius", "Chesapeake Bay",
    "California Scents", "Mr&Mrs Fragrance",
    // K-beauty brands that also come in through SPV-, not just GVS-
    "Cosrx", "Beauty Of Joseon", "APLB", "SKIN1004", "Some By Mi",
    "Medi-Peel", "Dr. Althea", "Celimax", "Haruharu Wonder", "Biodance",
    "Medicube", "K-SECRET", "AXIS-Y", "Missha", "Anua", "Pyunkang Yul",
    "Frudia", "Purito Seoul", "ITOXX", "VT Cosmetics",
    // Misc mass personal care
    "Gillette", "Old Spice", "Nivea", "Piz Buin", "Neutrogena", "Batiste",
    "Scholl", "4711", "Biotherm", "Vivaco", "Pleva", "Alpa",
  ].map((b) => b.toLowerCase()),
);

export function isPaidAdsEligible(code: string, brandName: string | null): boolean {
  if (code.startsWith("TDE-")) return true;
  if (code.startsWith("GVS-")) return true;
  if (brandName && ARABIC_PERFUME_BRANDS.has(brandName.toLowerCase())) return true;
  if (brandName && MASS_MARKET_BRANDS.has(brandName.toLowerCase())) return true;
  if (ORIGINAL_CATALOG_CODE.test(code)) return true;
  return false;
}
