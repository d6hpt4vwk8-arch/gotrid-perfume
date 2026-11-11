import { NextRequest, NextResponse } from "next/server";
import { attachColorSwatches } from "@/lib/color-swatches.server";
import { attachReviewRatings } from "@/lib/review-stats.server";
import { resolvePerfumeFilterCategoryIds } from "@/lib/perfume-structure-facets.server";
import { buildProductWhere, parseFilterParams } from "@/lib/product-filters";
import { filterParamsFromSearchParams } from "@/lib/product-listing-query";
import { findProductsPage } from "@/lib/product-listing.server";
import { toCardJson } from "@/lib/product-card-json";
import { resolveSearchWhere } from "@/lib/search-where.server";
import { skScope } from "@/lib/sk-visibility";

const PAGE_SIZE = 24;

/**
 * Backs the "Zobrazit další produkty" button on the search results page (/hledat) — same query, fallback tiers,
 * filters and ordering as the page's own server-rendered result, re-run for one later page and returned as JSON.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const query = (sp.get("q") ?? "").trim();
  if (query.length < 2) return NextResponse.json({ products: [] });

  const isSk = sp.get("lang") === "sk";
  const filters = parseFilterParams(filterParamsFromSearchParams(sp));
  const perfumeCategoryIds = await resolvePerfumeFilterCategoryIds(filters.genderSlugs);
  const { searchWhere } = await resolveSearchWhere(query, filters, perfumeCategoryIds, isSk);
  const where = buildProductWhere(skScope(searchWhere, isSk), filters, perfumeCategoryIds);

  const rawProducts = await findProductsPage({ where, sort: filters.sort, page: filters.page, pageSize: PAGE_SIZE });
  const products = await attachReviewRatings(await attachColorSwatches(rawProducts));
  return NextResponse.json({ products: toCardJson(products) });
}
