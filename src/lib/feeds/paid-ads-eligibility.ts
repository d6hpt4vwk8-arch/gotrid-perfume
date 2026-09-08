// Heureka and Sklik (Sklik's Nákupy/Shopping campaigns ingest the same
// Zboží.cz-format feed, i.e. zbozi.xml) are paid-per-click — every listing
// there costs money whether or not it converts. Decided 2026-09-02: only
// advertise what we can actually win on price — Tamda and Korean cosmetics
// (where we're competitive) and Arabic-dupe fragrances (cheap enough to
// undercut), never designer/niche perfumes (Heureka/Zboží price-compare
// against retailers who buy at real distributor volume; we can't win that
// fight on a handful of units, so a click there is a click we pay for and
// lose). Google/Meta feeds are untouched — this restriction is
// Heureka/Sklik-specific.
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

export function isPaidAdsEligible(code: string, brandName: string | null): boolean {
  if (code.startsWith("TDE-")) return true;
  if (code.startsWith("GVS-")) return true;
  if (brandName && ARABIC_PERFUME_BRANDS.has(brandName.toLowerCase())) return true;
  if (ORIGINAL_CATALOG_CODE.test(code)) return true;
  return false;
}
