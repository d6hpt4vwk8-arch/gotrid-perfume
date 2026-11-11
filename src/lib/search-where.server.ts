import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildProductWhere, type ParsedFilters } from "@/lib/product-filters";
import {
  buildDescriptionSearchWhere,
  buildExactSearchWhere,
  findFuzzyProductIds,
  findTokenProductIds,
} from "@/lib/product-search";
import { skScope } from "@/lib/sk-visibility";

export type SearchFallback = "description" | "fuzzy" | "words" | null;

/**
 * Which products a search query matches — shared by the /hledat page and the route behind its "Zobrazit další
 * produkty" button, so both list exactly the same results.
 *
 * Fallback tiers, same order as /api/search: exact name/EAN/brand phrase, then every word on its own (multi-word
 * queries, Czech word forms, synonyms like "mastičky"), then the description, then most of the words, then fuzzy name
 * matching (pg_trgm) for a typo like "Latafa" for "Lattafa" — each tier only runs if the previous one, combined with
 * the visitor's own filters, found literally nothing. Whichever tier finally has results is what facets/pagination are
 * built from, so a fallback result page still has working filters.
 */
export async function resolveSearchWhere(
  query: string,
  filters: ParsedFilters,
  perfumeCategoryIds: string[] | null | undefined,
  isSk: boolean,
): Promise<{ searchWhere: Prisma.ProductWhereInput; usedFallback: SearchFallback }> {
  const withSk = (w: Prisma.ProductWhereInput) => skScope(w, isSk);
  let searchWhere: Prisma.ProductWhereInput = buildExactSearchWhere(query);
  let usedFallback: SearchFallback = null;
  const hasResults = async (candidate: Prisma.ProductWhereInput) =>
    (await prisma.product.count({ where: buildProductWhere(withSk(candidate), filters, perfumeCategoryIds) })) > 0;

  if (!(await hasResults(searchWhere))) {
    const allWordIds = await findTokenProductIds(query, 200, "all");
    if (allWordIds.length > 0 && (await hasResults({ id: { in: allWordIds } }))) {
      searchWhere = { id: { in: allWordIds } };
      usedFallback = "words";
    } else if (await hasResults(buildDescriptionSearchWhere(query))) {
      searchWhere = buildDescriptionSearchWhere(query);
      usedFallback = "description";
    } else {
      const mostWordIds = await findTokenProductIds(query, 200, "most");
      if (mostWordIds.length > 0 && (await hasResults({ id: { in: mostWordIds } }))) {
        searchWhere = { id: { in: mostWordIds } };
        usedFallback = "words";
      } else {
        const fuzzyIds = await findFuzzyProductIds(query, 100);
        if (fuzzyIds.length > 0) {
          searchWhere = { id: { in: fuzzyIds } };
          usedFallback = "fuzzy";
        }
      }
    }
  }
  return { searchWhere, usedFallback };
}
