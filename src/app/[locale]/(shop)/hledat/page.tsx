import { attachColorSwatches } from "@/lib/color-swatches.server";
import type { Prisma } from "@prisma/client";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAvailableBrands } from "@/lib/category-brands.server";
import { findProductsPage } from "@/lib/product-listing.server";
import { getScentFamilyFacets } from "@/lib/category-scent-facets.server";
import { getCosmeticsFacets } from "@/lib/category-cosmetics-facets.server";
import {
  getPerfumeStructureFacets,
  resolvePerfumeFilterCategoryIds,
} from "@/lib/perfume-structure-facets.server";
import {
  buildProductWhere,
  parseFilterParams,
  type CategoryFilterParams,
} from "@/lib/product-filters";
import { resolveSearchWhere } from "@/lib/search-where.server";
import { filtersToQuery } from "@/lib/product-listing-query";
import { ProductGridLoadMore } from "@/components/product-grid-load-more";
import { toCardJson } from "@/lib/product-card-json";
import { CategoryFilters } from "@/components/category-filters";
import { Pagination } from "@/components/pagination";
import { getSettings } from "@/lib/settings.server";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { skScope } from "@/lib/sk-visibility";
import { attachReviewRatings } from "@/lib/review-stats.server";

const PAGE_SIZE = 24;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<CategoryFilterParams & { q?: string }>;
}) {
  const rawParams = await searchParams;
  const tr = await getTr();
  const isSk = (await getCurrentLocale()) === "sk";
  const withSk = (w: Prisma.ProductWhereInput) => skScope(w, isSk);
  const query = (rawParams.q ?? "").trim();

  if (query.length < 2) {
    return (
      <main data-wide className="mx-auto flex max-w-(--page-max) flex-1 flex-col gap-6 px-4 py-10 xl:px-8">
        <h1 className="text-2xl font-bold text-ink">{tr("Výsledky hledání")}</h1>
        <p className="text-sm text-accent-2">{tr("Zadejte alespoň 2 znaky.")}</p>
      </main>
    );
  }

  const filters = parseFilterParams(rawParams);
  const perfumeCategoryIds = await resolvePerfumeFilterCategoryIds(filters.genderSlugs);

  // Exact phrase first, then the fallback tiers (words, description, fuzzy) — shared with the "Zobrazit další produkty" route.
  const { searchWhere, usedFallback } = await resolveSearchWhere(query, filters, perfumeCategoryIds, isSk);

  const where = buildProductWhere(withSk(searchWhere), filters, perfumeCategoryIds);

  const [rawProducts, total, brands, scentFacets, structureFacets, cosmeticsFacets, settings] =
    await Promise.all([
      findProductsPage({ where, sort: filters.sort, page: filters.page, pageSize: PAGE_SIZE }),
      prisma.product.count({ where }),
      getAvailableBrands(withSk(searchWhere)),
      getScentFamilyFacets(withSk(searchWhere)),
      getPerfumeStructureFacets(withSk(searchWhere)),
      getCosmeticsFacets(withSk(searchWhere)),
      getSettings(),
    ]);
  // Stars on result cards, only for products that already have published reviews.
  const products = await attachReviewRatings(await attachColorSwatches(rawProducts));

  // Logged after the response is sent — a failed write here must never
  // affect what the visitor actually sees. Only page 1 counts a query as
  // "searched"; deeper pages are the same search paginating, not a new one.
  if (filters.page === 1) {
    const normalizedQuery = query.toLowerCase();
    after(async () => {
      try {
        await prisma.searchLog.create({ data: { query: normalizedQuery, resultCount: total } });
      } catch {
        // best-effort analytics — never worth surfacing to the visitor
      }
    });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const paginationQuery = filtersToQuery(filters, new URLSearchParams({ q: query }));

  return (
    <main data-wide className="mx-auto flex max-w-(--page-max) flex-1 flex-col gap-6 px-4 py-10 xl:px-8">
      <h1 className="text-2xl font-bold text-ink">{tr("Výsledky hledání")}: „{query}“</h1>
      {usedFallback === "description" && (
        <p className="-mt-4 text-sm text-accent-2">
          {tr("Přesně tento výraz jsme v názvu nenašli — zobrazujeme produkty, které ho zmiňují v popisu.")}
        </p>
      )}
      {usedFallback === "fuzzy" && (
        <p className="-mt-4 text-sm text-accent-2">
          {tr("Přesnou shodu jsme nenašli — zobrazujeme nejpodobnější produkty (třeba jste se překlepli).")}
        </p>
      )}

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
              {tr("Nic jsme nenašli. Zkuste jiný výraz nebo upravte filtry.")}{" "}
              {tr("Hledáte něco konkrétního? Napište nám na info@gotridperfume.cz a zkusíme to pro vás sehnat.")}
            </p>
          ) : (
            <ProductGridLoadMore
              // Remount whenever the query, filters or page number change — see the category page.
              key={`${filters.page}-${paginationQuery.toString()}`}
              initialProducts={toCardJson(products)}
              totalPages={totalPages}
              currentPage={filters.page}
              fetchUrl={`/api/search-products?${paginationQuery.toString()}${isSk ? "&lang=sk" : ""}`}
              freeShippingThreshold={settings.freeShippingThreshold}
            />
          )}

          <Pagination
            totalPages={totalPages}
            currentPage={filters.page}
            basePath="/hledat"
            queryString={paginationQuery.toString()}
          />
        </div>
      </div>
    </main>
  );
}
