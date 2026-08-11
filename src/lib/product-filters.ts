import type { Prisma } from "@prisma/client";

export type SortOption = "newest" | "price-asc" | "price-desc";

export interface CategoryFilterParams {
  brand?: string | string[];
  scent?: string | string[];
  gender?: string | string[];
  concentration?: string | string[];
  skinType?: string | string[];
  concern?: string | string[];
  priceMin?: string;
  priceMax?: string;
  inStock?: string;
  sale?: string;
  sort?: string;
  page?: string;
}

export interface ParsedFilters {
  brandSlugs: string[];
  scentSlugs: string[];
  genderSlugs: string[];
  concentrationSlugs: string[];
  skinTypeSlugs: string[];
  concernSlugs: string[];
  priceMin: number | null;
  priceMax: number | null;
  inStockOnly: boolean;
  saleOnly: boolean;
  sort: SortOption;
  page: number;
}

const SORT_OPTIONS: SortOption[] = ["newest", "price-asc", "price-desc"];

function toArray(value: string | string[] | undefined): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function parseFilterParams(params: CategoryFilterParams): ParsedFilters {
  const priceMin = params.priceMin ? Number(params.priceMin) : null;
  const priceMax = params.priceMax ? Number(params.priceMax) : null;

  const sort = SORT_OPTIONS.includes(params.sort as SortOption)
    ? (params.sort as SortOption)
    : "newest";

  return {
    brandSlugs: toArray(params.brand),
    scentSlugs: toArray(params.scent),
    genderSlugs: toArray(params.gender),
    concentrationSlugs: toArray(params.concentration),
    skinTypeSlugs: toArray(params.skinType),
    concernSlugs: toArray(params.concern),
    priceMin: priceMin !== null && Number.isFinite(priceMin) ? priceMin : null,
    priceMax: priceMax !== null && Number.isFinite(priceMax) ? priceMax : null,
    inStockOnly: params.inStock === "1",
    saleOnly: params.sale === "1",
    sort,
    page: Math.max(1, Number(params.page) || 1),
  };
}

/**
 * Builds the final product where-clause from a base scope (a category
 * subtree, a search-text match, or anything else) plus the parsed filter
 * selections. Kept generic over the scope so the same filter pipeline works
 * for both `/kategorie/[...slug]` and `/hledat`.
 *
 * `perfumeCategoryIds` is the resolved gender/concentration leaf-category
 * scope from `resolvePerfumeFilterCategoryIds` (null when neither filter is
 * active) — passed in rather than derived here since resolving it requires a
 * DB round trip.
 */
/**
 * Same-fragrance-different-size products (scripts/group-product-variants.ts)
 * only get one grid card — the rest are reachable via its size selector on
 * the product page, not as their own listing entries.
 */
export const primaryVariantWhere: Prisma.ProductWhereInput = {
  OR: [{ variantGroupKey: null }, { isPrimaryVariant: true }],
};

export function buildProductWhere(
  baseWhere: Prisma.ProductWhereInput,
  filters: ParsedFilters,
  perfumeCategoryIds?: string[] | null,
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [baseWhere, primaryVariantWhere];

  if (filters.brandSlugs.length > 0) {
    and.push({ brand: { slug: { in: filters.brandSlugs } } });
  }

  if (filters.priceMin !== null || filters.priceMax !== null) {
    and.push({
      price: {
        ...(filters.priceMin !== null && { gte: filters.priceMin }),
        ...(filters.priceMax !== null && { lte: filters.priceMax }),
      },
    });
  }

  if (filters.inStockOnly) {
    and.push({ stock: { gt: 0 } });
  }

  if (filters.saleOnly) {
    and.push({ compareAtPrice: { not: null } });
  }

  if (filters.scentSlugs.length > 0) {
    and.push({ scentFamilies: { some: { scentFamily: { slug: { in: filters.scentSlugs } } } } });
  }

  if (filters.skinTypeSlugs.length > 0) {
    and.push({ skinTypes: { some: { skinType: { slug: { in: filters.skinTypeSlugs } } } } });
  }

  if (filters.concernSlugs.length > 0) {
    and.push({ concerns: { some: { concern: { slug: { in: filters.concernSlugs } } } } });
  }

  if (perfumeCategoryIds) {
    and.push({ categories: { some: { categoryId: { in: perfumeCategoryIds } } } });
  }

  return { visible: true, AND: and };
}

export function buildOrderBy(sort: SortOption): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price-asc":
      return { price: "asc" };
    case "price-desc":
      return { price: "desc" };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}
