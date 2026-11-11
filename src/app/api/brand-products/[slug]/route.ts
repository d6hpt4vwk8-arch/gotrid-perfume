import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachColorSwatches } from "@/lib/color-swatches.server";
import { attachReviewRatings } from "@/lib/review-stats.server";
import { resolvePerfumeFilterCategoryIds } from "@/lib/perfume-structure-facets.server";
import { buildProductWhere, parseFilterParams } from "@/lib/product-filters";
import { filterParamsFromSearchParams } from "@/lib/product-listing-query";
import { findProductsPage } from "@/lib/product-listing.server";
import { toCardJson } from "@/lib/product-card-json";
import { skScope } from "@/lib/sk-visibility";

const PAGE_SIZE = 24;

/**
 * Backs the "Zobrazit další produkty" button on a brand page (/znacka/<slug>) — same where/orderBy as the page's own
 * server-rendered query, re-run for one later page and returned as JSON.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) return NextResponse.json({ error: "Značka nenalezena." }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const filters = parseFilterParams(filterParamsFromSearchParams(sp));
  const perfumeCategoryIds = await resolvePerfumeFilterCategoryIds(filters.genderSlugs);
  const where = buildProductWhere(skScope({ brandId: brand.id }, sp.get("lang") === "sk"), filters, perfumeCategoryIds);

  const rawProducts = await findProductsPage({ where, sort: filters.sort, page: filters.page, pageSize: PAGE_SIZE });
  const products = await attachReviewRatings(await attachColorSwatches(rawProducts));
  return NextResponse.json({ products: toCardJson(products) });
}
