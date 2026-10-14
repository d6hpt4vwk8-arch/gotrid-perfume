import type { Prisma } from "@prisma/client";

/**
 * The Slovak storefront (/sk) lists only products that have a Slovak name
 * (Product.nameSk, filled by scripts/sk-import.ts) — a Slovak shop must not
 * mix Czech product names into its listings. Untranslated products stay
 * reachable by direct URL (and on the Czech site); the list grows as more
 * products get translated.
 */
export const SK_ONLY_WHERE: Prisma.ProductWhereInput = { nameSk: { not: null } };

/** Adds the Slovak-translation requirement to a product where-clause when browsing /sk. */
export function skScope(where: Prisma.ProductWhereInput, isSk: boolean): Prisma.ProductWhereInput {
  return isSk ? { AND: [where, SK_ONLY_WHERE] } : where;
}
