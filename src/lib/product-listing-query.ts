import type { CategoryFilterParams, ParsedFilters } from "@/lib/product-filters";

/**
 * The visitor's active filters/sort as a query string (no page number) — used for the numbered Pagination links and
 * for the URL the "Zobrazit další produkty" button fetches, so both keep the same filtered listing.
 */
export function filtersToQuery(filters: ParsedFilters, base?: URLSearchParams): URLSearchParams {
  const q = base ?? new URLSearchParams();
  filters.brandSlugs.forEach((b) => q.append("brand", b));
  filters.scentSlugs.forEach((s) => q.append("scent", s));
  filters.genderSlugs.forEach((g) => q.append("gender", g));
  filters.concentrationSlugs.forEach((c) => q.append("concentration", c));
  filters.occasionSlugs.forEach((o) => q.append("occasion", o));
  filters.kindSlugs.forEach((k) => q.append("kind", k));
  filters.ingredientSlugs.forEach((i) => q.append("ingredient", i));
  if (filters.veganOnly) q.set("vegan", "1");
  if (filters.crueltyFreeOnly) q.set("cf", "1");
  filters.skinTypeSlugs.forEach((s) => q.append("skinType", s));
  filters.concernSlugs.forEach((c) => q.append("concern", c));
  if (filters.priceMin !== null) q.set("priceMin", String(filters.priceMin));
  if (filters.priceMax !== null) q.set("priceMax", String(filters.priceMax));
  if (filters.saleOnly) q.set("sale", "1");
  if (filters.sort !== "newest") q.set("sort", filters.sort);
  return q;
}

/**
 * Filter params out of a request's query string. Object.fromEntries(URLSearchParams) keeps only the last value per key
 * and would silently drop multi-select filters like ?brand=a&brand=b down to "b", so the array-capable ones are read
 * with getAll() — matching how Next's own searchParams prop groups repeated keys on the pages these routes mirror.
 */
export function filterParamsFromSearchParams(sp: URLSearchParams): CategoryFilterParams {
  return {
    brand: sp.getAll("brand"),
    scent: sp.getAll("scent"),
    gender: sp.getAll("gender"),
    concentration: sp.getAll("concentration"),
    occasion: sp.getAll("occasion"),
    kind: sp.getAll("kind"),
    ingredient: sp.getAll("ingredient"),
    vegan: sp.get("vegan") ?? undefined,
    cf: sp.get("cf") ?? undefined,
    skinType: sp.getAll("skinType"),
    concern: sp.getAll("concern"),
    priceMin: sp.get("priceMin") ?? undefined,
    priceMax: sp.get("priceMax") ?? undefined,
    sale: sp.get("sale") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    page: sp.get("page") ?? undefined,
  };
}
