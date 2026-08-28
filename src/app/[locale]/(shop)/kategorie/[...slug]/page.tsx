import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findCategoryByFullSlug, getCategoryBreadcrumb } from "@/lib/categories.server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getDescendantCategoryIds } from "@/lib/category-descendants.server";
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
  primaryVariantWhere,
  type CategoryFilterParams,
} from "@/lib/product-filters";
import { ProductCard } from "@/components/product-card";
import { CategoryFilters } from "@/components/category-filters";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 24;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<CategoryFilterParams>;
}) {
  const { slug } = await params;
  const rawParams = await searchParams;
  const fullSlug = slug.join("/");

  const category = await findCategoryByFullSlug(fullSlug);
  if (!category) notFound();

  const [categoryIds, categoryBreadcrumb] = await Promise.all([
    getDescendantCategoryIds(category.id),
    getCategoryBreadcrumb(fullSlug),
  ]);
  const filters = parseFilterParams(rawParams);
  const baseWhere = { categories: { some: { categoryId: { in: categoryIds } } } };
  const perfumeCategoryIds = await resolvePerfumeFilterCategoryIds(
    filters.genderSlugs,
    filters.concentrationSlugs,
  );
  const where = buildProductWhere(baseWhere, filters, perfumeCategoryIds);

  const [products, total, brands, scentFacets, structureFacets, cosmeticsFacets, topProducts] =
    await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: buildOrderBy(filters.sort),
        skip: (filters.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      }),
      prisma.product.count({ where }),
      getAvailableBrands(baseWhere),
      getScentFamilyFacets(baseWhere),
      getPerfumeStructureFacets(baseWhere),
      getCosmeticsFacets(baseWhere),
      // Independent of the visitor's active filter selections — always
      // reflects the category itself. Ties (e.g. everything at 0 sales for a
      // freshly-added category) fall through to priority, so this doubles as
      // the "nothing sold yet" fallback without extra branching.
      prisma.product.findMany({
        where: { visible: true, AND: [baseWhere, primaryVariantWhere] },
        orderBy: [{ salesCount: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
        take: 4,
        include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      }),
    ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const paginationQuery = new URLSearchParams();
  filters.brandSlugs.forEach((b) => paginationQuery.append("brand", b));
  filters.scentSlugs.forEach((s) => paginationQuery.append("scent", s));
  filters.genderSlugs.forEach((g) => paginationQuery.append("gender", g));
  filters.concentrationSlugs.forEach((c) => paginationQuery.append("concentration", c));
  filters.skinTypeSlugs.forEach((s) => paginationQuery.append("skinType", s));
  filters.concernSlugs.forEach((c) => paginationQuery.append("concern", c));
  if (filters.priceMin !== null) paginationQuery.set("priceMin", String(filters.priceMin));
  if (filters.priceMax !== null) paginationQuery.set("priceMax", String(filters.priceMax));
  if (filters.inStockOnly) paginationQuery.set("inStock", "1");
  if (filters.saleOnly) paginationQuery.set("sale", "1");
  if (filters.sort !== "newest") paginationQuery.set("sort", filters.sort);

  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <Breadcrumbs
        items={categoryBreadcrumb.map((c, i) => ({
          name: c.name,
          href: i < categoryBreadcrumb.length - 1 ? `/kategorie/${c.fullSlug}` : undefined,
        }))}
      />

      <h1 className="text-2xl font-bold text-ink">{category.name}</h1>

      {category.children.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.id}
              href={`/kategorie/${child.fullSlug}`}
              className="rounded-full border border-line px-3 py-1 text-sm text-ink hover:border-accent hover:text-accent"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-6 sm:flex-row">
        <CategoryFilters
          brands={brands}
          scentFamilies={scentFacets}
          structure={structureFacets}
          cosmetics={cosmeticsFacets}
          topProducts={topProducts}
        />

        <div className="flex flex-1 flex-col gap-6">
          {products.length === 0 ? (
            <p className="text-sm text-accent-2">
              V této kategorii jsme s vybranými filtry nic nenašli.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          )}

          <Pagination
            totalPages={totalPages}
            currentPage={filters.page}
            basePath={`/kategorie/${fullSlug}`}
            queryString={paginationQuery.toString()}
          />
        </div>
      </div>
    </main>
  );
}
