import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAvailableBrands } from "@/lib/category-brands.server";
import { getScentFamilyFacets } from "@/lib/category-scent-facets.server";
import { getCosmeticsFacets } from "@/lib/category-cosmetics-facets.server";
import {
  getPerfumeStructureFacets,
  resolvePerfumeFilterCategoryIds,
} from "@/lib/perfume-structure-facets.server";
import {
  buildOrderBy,
  buildProductWhere,
  parseFilterParams,
  type CategoryFilterParams,
} from "@/lib/product-filters";
import { ProductCard } from "@/components/product-card";
import { CategoryFilters } from "@/components/category-filters";

const PAGE_SIZE = 24;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<CategoryFilterParams & { q?: string }>;
}) {
  const rawParams = await searchParams;
  const query = (rawParams.q ?? "").trim();

  if (query.length < 2) {
    return (
      <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
        <h1 className="text-2xl font-bold text-ink">Výsledky hledání</h1>
        <p className="text-sm text-accent-2">Zadejte alespoň 2 znaky.</p>
      </main>
    );
  }

  const searchWhere: Prisma.ProductWhereInput = {
    OR: [
      { name: { contains: query, mode: "insensitive" } },
      { ean: { contains: query, mode: "insensitive" } },
      { brand: { name: { contains: query, mode: "insensitive" } } },
    ],
  };

  const filters = parseFilterParams(rawParams);
  const perfumeCategoryIds = await resolvePerfumeFilterCategoryIds(
    filters.genderSlugs,
    filters.concentrationSlugs,
  );
  const where = buildProductWhere(searchWhere, filters, perfumeCategoryIds);

  const [products, total, brands, scentFacets, structureFacets, cosmeticsFacets] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: buildOrderBy(filters.sort),
      skip: (filters.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
    prisma.product.count({ where }),
    getAvailableBrands(searchWhere),
    getScentFamilyFacets(searchWhere),
    getPerfumeStructureFacets(searchWhere),
    getCosmeticsFacets(searchWhere),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    params.set("q", query);
    filters.brandSlugs.forEach((b) => params.append("brand", b));
    filters.scentSlugs.forEach((s) => params.append("scent", s));
    filters.genderSlugs.forEach((g) => params.append("gender", g));
    filters.concentrationSlugs.forEach((c) => params.append("concentration", c));
    filters.skinTypeSlugs.forEach((s) => params.append("skinType", s));
    filters.concernSlugs.forEach((c) => params.append("concern", c));
    if (filters.priceMin !== null) params.set("priceMin", String(filters.priceMin));
    if (filters.priceMax !== null) params.set("priceMax", String(filters.priceMax));
    if (filters.inStockOnly) params.set("inStock", "1");
    if (filters.saleOnly) params.set("sale", "1");
    if (filters.sort !== "newest") params.set("sort", filters.sort);
    if (page > 1) params.set("page", String(page));
    return `/hledat?${params.toString()}`;
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-bold text-ink">Výsledky hledání: „{query}“</h1>

      <div className="flex flex-col gap-6 sm:flex-row">
        <CategoryFilters
          brands={brands}
          scentFamilies={scentFacets}
          structure={structureFacets}
          cosmetics={cosmeticsFacets}
        />

        <div className="flex flex-1 flex-col gap-6">
          {products.length === 0 ? (
            <p className="text-sm text-accent-2">
              Nic jsme nenašli. Zkuste jiný výraz nebo upravte filtry.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={pageHref(p)}
                  className={`rounded-sm px-3 py-1 text-sm ${
                    p === filters.page ? "bg-ink text-white" : "border border-line text-ink"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
