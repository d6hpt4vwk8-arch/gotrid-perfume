import { attachColorSwatches } from "@/lib/color-swatches.server";
import { attachReviewRatings } from "@/lib/review-stats.server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildProductWhere, parseFilterParams, type CategoryFilterParams } from "@/lib/product-filters";
import { filtersToQuery } from "@/lib/product-listing-query";
import { findProductsPage } from "@/lib/product-listing.server";
import { getScentFamilyFacets } from "@/lib/category-scent-facets.server";
import { getCosmeticsFacets } from "@/lib/category-cosmetics-facets.server";
import { getPerfumeStructureFacets, resolvePerfumeFilterCategoryIds } from "@/lib/perfume-structure-facets.server";
import { CategoryFilters } from "@/components/category-filters";
import { Pagination } from "@/components/pagination";
import { ProductGridLoadMore } from "@/components/product-grid-load-more";
import { toCardJson } from "@/lib/product-card-json";
import { getSettings } from "@/lib/settings.server";
import type { Metadata } from "next";
import { jsonLdScript } from "@/lib/json-ld";
import { breadcrumbJsonLd, collectionJsonLd, localeAlternates, localePath, ogMeta } from "@/lib/seo";
import { getListingStats, listingDescription, listingTitle } from "@/lib/listing-seo.server";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { skScope } from "@/lib/sk-visibility";

const PAGE_SIZE = 24;

// Everything except page/sort is a filter combination — kept out of the index and pointed back to the clean brand
// URL (same rule as the category pages). Plain pagination (?page=N) stays indexable.
const NON_FILTER_PARAMS = new Set(["page", "sort"]);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const query = await searchParams;
  const isSk = locale === "sk";
  const tr = await getTr();
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) return {};
  const stats = await getListingStats(skScope({ brandId: brand.id }, isSk));
  const title = await listingTitle({ name: brand.name, stats, isSk });
  const description =
    stats.count > 0
      ? await listingDescription({ name: brand.name, stats, isSk })
      : `${brand.name} – ${tr("značka v nabídce Gotrid Perfume.")}`;
  const isFiltered = Object.keys(query).some((k) => !NON_FILTER_PARAMS.has(k) && query[k] !== undefined);
  const pageNumber = Math.max(1, Number(Array.isArray(query.page) ? query.page[0] : query.page) || 1);
  const basePath = `/znacka/${brand.slug}`;
  const path = localePath(locale, !isFiltered && pageNumber > 1 ? `${basePath}?page=${pageNumber}` : basePath);
  return {
    title,
    description,
    alternates: { ...localeAlternates(locale, basePath), canonical: path },
    ...ogMeta({ title, description, path, locale }),
    // A brand page with nothing in stock is an empty shell, and filtered views are near-duplicates — keep both
    // out of the index.
    ...(stats.count === 0 || isFiltered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CategoryFilterParams>;
}) {
  const { slug } = await params;
  const rawParams = await searchParams;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) notFound();
  const [tr, locale] = await Promise.all([getTr(), getCurrentLocale()]);
  const isSk = locale === "sk";

  const filters = parseFilterParams(rawParams);
  const baseWhere = skScope({ brandId: brand.id }, isSk);
  const perfumeCategoryIds = await resolvePerfumeFilterCategoryIds(filters.genderSlugs);
  const where = buildProductWhere(baseWhere, filters, perfumeCategoryIds);

  const [rawProducts, total, scentFacets, structureFacets, cosmeticsFacets, settings] = await Promise.all([
    findProductsPage({ where, sort: filters.sort, page: filters.page, pageSize: PAGE_SIZE }),
    prisma.product.count({ where }),
    getScentFamilyFacets(baseWhere),
    getPerfumeStructureFacets(baseWhere),
    getCosmeticsFacets(baseWhere),
    getSettings(),
  ]);
  const products = await attachReviewRatings(await attachColorSwatches(rawProducts));
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const paginationQuery = filtersToQuery(filters);

  return (
    <main data-wide className="mx-auto flex max-w-(--page-max) flex-1 flex-col gap-6 px-4 py-10 xl:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbJsonLd(
              [
                { name: tr("Značky"), path: localePath(locale, "/znacky") },
                { name: brand.name, path: localePath(locale, `/znacka/${brand.slug}`) },
              ],
              { home: tr("Domů"), homePath: localePath(locale, "/") },
            ),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            collectionJsonLd({
              name: brand.name,
              path: localePath(locale, `/znacka/${brand.slug}`),
              items: products.map((p) => {
                const sk = isSk && !!p.nameSk;
                return { name: sk ? p.nameSk! : p.name, path: localePath(sk ? "sk" : "cs", `/produkt/${p.slug}`) };
              }),
            }),
          ),
        }}
      />
      <h1 className="text-2xl font-bold text-ink">{brand.name}</h1>

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* No brand facet: the whole page is one brand. */}
        <CategoryFilters
          brands={[]}
          scentFamilies={scentFacets}
          structure={structureFacets}
          cosmetics={cosmeticsFacets}
        />

        <div className="flex flex-1 flex-col gap-6">
          {products.length === 0 ? (
            <p className="text-sm text-accent-2">
              {filters.page === 1 && paginationQuery.toString() === ""
                ? tr("U této značky zatím nejsou žádné produkty.")
                : tr("V této kategorii jsme s vybranými filtry nic nenašli.")}
            </p>
          ) : (
            <ProductGridLoadMore
              // Remount whenever the brand, filters or page number change — see the category page.
              key={`${brand.slug}-${filters.page}-${paginationQuery.toString()}`}
              initialProducts={toCardJson(products)}
              totalPages={totalPages}
              currentPage={filters.page}
              fetchUrl={`/api/brand-products/${brand.slug}?${paginationQuery.toString()}${isSk ? "&lang=sk" : ""}`}
              freeShippingThreshold={settings.freeShippingThreshold}
            />
          )}

          <Pagination
            totalPages={totalPages}
            currentPage={filters.page}
            basePath={`/znacka/${brand.slug}`}
            queryString={paginationQuery.toString()}
          />
        </div>
      </div>
    </main>
  );
}
