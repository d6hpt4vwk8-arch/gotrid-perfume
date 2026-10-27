/**
 * Brands whose `compareAtPrice` is NOT our own previous price but the manufacturer's current retail price
 * (Palacio sells the same products on palacioshop.cz — see scripts/set-palacio-reference-prices.ts).
 * Shown on-site as a crossed-out "Cena u výrobce"; kept out of the Heureka feeds (their PRICE_BEFORE means the
 * seller's own price before a discount) and out of the homepage sale strip (it would fill all 12 slots).
 */
export const MANUFACTURER_REFERENCE_PRICE_BRANDS = ["Palacio"];

export function hasManufacturerReferencePrice(brandName: string | null | undefined): boolean {
  return !!brandName && MANUFACTURER_REFERENCE_PRICE_BRANDS.includes(brandName);
}
