import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findCategoryByFullSlug } from "@/lib/categories.server";
import { getDescendantCategoryIds } from "@/lib/category-descendants.server";
import { resolvePerfumeFilterCategoryIds } from "@/lib/perfume-structure-facets.server";
import { buildOrderBy, buildProductWhere, parseFilterParams } from "@/lib/product-filters";

const PAGE_SIZE = 24;

/**
 * Backs the "Zobrazit další produkty" button on the category page
 * (src/components/product-grid-load-more.tsx) — same where/orderBy as the
 * page's own server-rendered query, just re-run for one later page and
 * returned as JSON instead of HTML, so clicking it appends products
 * in-place instead of a full navigation.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const fullSlug = slug.join("/");

  const category = await findCategoryByFullSlug(fullSlug);
  if (!category) {
    return NextResponse.json({ error: "Kategorie nenalezena." }, { status: 404 });
  }

  // Object.fromEntries(URLSearchParams) keeps only the last value per key —
  // silently dropping multi-select filters like ?brand=a&brand=b down to
  // just "b". Pull the array-capable ones with getAll() instead, matching
  // how Next's own searchParams prop (used by the page component this
  // mirrors) already groups repeated keys.
  const sp = req.nextUrl.searchParams;
  const filters = parseFilterParams({
    brand: sp.getAll("brand"),
    scent: sp.getAll("scent"),
    gender: sp.getAll("gender"),
    concentration: sp.getAll("concentration"),
    skinType: sp.getAll("skinType"),
    concern: sp.getAll("concern"),
    priceMin: sp.get("priceMin") ?? undefined,
    priceMax: sp.get("priceMax") ?? undefined,
    sale: sp.get("sale") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    page: sp.get("page") ?? undefined,
  });
  const categoryIds = await getDescendantCategoryIds(category.id);
  const perfumeCategoryIds = await resolvePerfumeFilterCategoryIds(
    filters.genderSlugs,
    filters.concentrationSlugs,
  );
  const baseWhere = { categories: { some: { categoryId: { in: categoryIds } } } };
  const where = buildProductWhere(baseWhere, filters, perfumeCategoryIds);

  const products = await prisma.product.findMany({
    where,
    orderBy: buildOrderBy(filters.sort),
    skip: (filters.page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      price: p.price.toString(),
      compareAtPrice: p.compareAtPrice?.toString() ?? null,
      stock: p.stock,
      brand: p.brand ? { name: p.brand.name } : null,
      images: p.images.map((img) => ({ url: img.url })),
    })),
  });
}
