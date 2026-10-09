import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { findCategoryByFullSlug, getCategoryBreadcrumb } from "@/lib/categories.server";
import { sanitizeDescription } from "@/lib/sanitize-description";
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
import { ProductGridLoadMore } from "@/components/product-grid-load-more";
import { attachColorSwatches } from "@/lib/color-swatches.server";
import { CategoryFilters } from "@/components/category-filters";
import { CategoryBanner } from "@/components/category-banner";
import { WhatsappAdviceButton } from "@/components/whatsapp-advice-button";
import { CATEGORY_CONTENT } from "@/lib/category-content";
import { CategoryHero } from "@/components/category-hero";
import { getCategoryBannerTiles } from "@/lib/category-banner.server";
import { Pagination } from "@/components/pagination";
import { getSettings } from "@/lib/settings.server";
import type { Metadata } from "next";
import { jsonLdScript } from "@/lib/json-ld";
import { breadcrumbJsonLd, htmlToPlainText, truncateAtWord } from "@/lib/seo";

const PAGE_SIZE = 24;

// Everything except page/sort is a filter combination — thousands of near-duplicate
// URLs for the same listing, so those are kept out of the index and point back
// to the clean category URL. Plain pagination (?page=N) stays indexable.
const NON_FILTER_PARAMS = new Set(["page", "sort"]);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const fullSlug = slug.join("/");
  const category = await findCategoryByFullSlug(fullSlug);
  if (!category) return {};

  const categoryIds = await getDescendantCategoryIds(category.id);
  const productCount = await prisma.product.count({
    where: { visible: true, stock: { gt: 0 }, categories: { some: { categoryId: { in: categoryIds } } } },
  });

  const intro = htmlToPlainText(category.description);
  const description = truncateAtWord(
    intro ||
      `${category.name} – originální značkové zboží skladem${productCount > 0 ? ` (${productCount} produktů)` : ""}. Doprava od 59 Kč, vrácení do 14 dnů. Gotrid Perfume.`,
  );

  const isFiltered = Object.keys(query).some((k) => !NON_FILTER_PARAMS.has(k) && query[k] !== undefined);
  const pageNumber = Math.max(1, Number(Array.isArray(query.page) ? query.page[0] : query.page) || 1);
  const basePath = `/kategorie/${fullSlug}`;

  return {
    title: `${category.name} – originální a skladem | Gotrid Perfume`,
    description,
    alternates: { canonical: !isFiltered && pageNumber > 1 ? `${basePath}?page=${pageNumber}` : basePath },
    // Filtered views and empty categories (e.g. a hidden branch whose products were
    // all switched off) stay out of the index.
    ...(isFiltered || productCount === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

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
  if (category.hidden) {
    // A hidden category with nothing live in it (e.g. Niche after its products were
    // switched off) is a dead end — 404 it instead of serving an empty listing.
    const liveIds = await getDescendantCategoryIds(category.id);
    const liveCount = await prisma.product.count({
      where: { visible: true, stock: { gt: 0 }, categories: { some: { categoryId: { in: liveIds } } } },
    });
    if (liveCount === 0) notFound();
  }

  const [categoryIds, categoryBreadcrumb] = await Promise.all([
    getDescendantCategoryIds(category.id),
    getCategoryBreadcrumb(fullSlug),
  ]);
  const filters = parseFilterParams(rawParams);
  const baseWhere = { categories: { some: { categoryId: { in: categoryIds } } } };
  const perfumeCategoryIds = await resolvePerfumeFilterCategoryIds(filters.genderSlugs);
  const where = buildProductWhere(baseWhere, filters, perfumeCategoryIds);

  const [rawProducts, total, brands, scentFacets, structureFacets, cosmeticsFacets, rawTopProducts, settings] =
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
      getSettings(),
    ]);

  const bannerTiles = category.children.length > 0 ? await getCategoryBannerTiles(category.children) : [];
  const showBanner = bannerTiles.length >= 2;
  const bannerTotal = showBanner
    ? await prisma.product.count({
        where: { visible: true, stock: { gt: 0 }, AND: [baseWhere, primaryVariantWhere] },
      })
    : 0;

  const [products, topProducts] = await Promise.all([
    attachColorSwatches(rawProducts),
    attachColorSwatches(rawTopProducts),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const content = CATEGORY_CONTENT[fullSlug];
  const showHero = !!content?.hero && !category.description && !!content.intro;

  const paginationQuery = new URLSearchParams();
  filters.brandSlugs.forEach((b) => paginationQuery.append("brand", b));
  filters.scentSlugs.forEach((s) => paginationQuery.append("scent", s));
  filters.genderSlugs.forEach((g) => paginationQuery.append("gender", g));
  filters.concentrationSlugs.forEach((c) => paginationQuery.append("concentration", c));
  filters.occasionSlugs.forEach((o) => paginationQuery.append("occasion", o));
  filters.skinTypeSlugs.forEach((s) => paginationQuery.append("skinType", s));
  filters.concernSlugs.forEach((c) => paginationQuery.append("concern", c));
  if (filters.priceMin !== null) paginationQuery.set("priceMin", String(filters.priceMin));
  if (filters.priceMax !== null) paginationQuery.set("priceMax", String(filters.priceMax));
  if (filters.saleOnly) paginationQuery.set("sale", "1");
  if (filters.sort !== "newest") paginationQuery.set("sort", filters.sort);

  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbJsonLd(categoryBreadcrumb.map((c) => ({ name: c.name, path: `/kategorie/${c.fullSlug}` }))),
          ),
        }}
      />
      <Breadcrumbs
        items={categoryBreadcrumb.map((c, i) => ({
          name: c.name,
          href: i < categoryBreadcrumb.length - 1 ? `/kategorie/${c.fullSlug}` : undefined,
        }))}
      />

      {showHero ? (
        <CategoryHero
          title={category.name}
          paragraphs={content!.intro!}
          image={content!.hero!.image}
          alt={content!.hero!.alt}
        />
      ) : showBanner ? (
        <CategoryBanner name={category.name} total={bannerTotal} tiles={bannerTiles} />
      ) : (
        <h1 className="text-2xl font-bold text-ink">{category.name}</h1>
      )}

      {category.description && (
        <section className="flex flex-col gap-6 border-b border-line pb-6 sm:flex-row sm:items-center">
          {category.bannerImage && (
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-sm bg-line/60 sm:w-72">
              <Image src={category.bannerImage} alt={category.name} fill sizes="288px" className="object-cover" />
            </div>
          )}
          <div
            className="prose prose-neutral max-w-none text-sm leading-relaxed text-ink/80 [&_a]:font-semibold [&_a]:text-ink [&_a]:underline [&_p]:mb-3 [&_p:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: sanitizeDescription(category.description) }}
          />
        </section>
      )}

      {!showHero && !category.description && content?.intro && (
        <section className="flex flex-col gap-3 border-b border-line pb-6 text-sm leading-relaxed text-ink/80">
          {content.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      )}

      {category.children.length > 0 && !showBanner && (
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

      {(fullSlug.startsWith("parfemy") || fullSlug.startsWith("nisove-parfemy")) && (
        <Link
          href="/magazin/jak-vybrat-parfem"
          className="flex w-fit items-center gap-2 rounded-sm border border-line px-3 py-2 text-sm text-ink hover:border-accent hover:text-accent"
        >
          Nevíte, který parfém vybrat? Poradíme →
        </Link>
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
            <ProductGridLoadMore
              // Forces a remount whenever the category, filters, or page
              // number changes — without this, ProductGridLoadMore's
              // useState(initialProducts) only runs on first mount, so
              // clicking a numbered Pagination link (a real navigation, but
              // to the same component instance) left it stuck showing
              // whichever page it happened to load first.
              key={`${fullSlug}-${filters.page}-${paginationQuery.toString()}`}
              initialProducts={products}
              totalPages={totalPages}
              currentPage={filters.page}
              fetchUrl={`/api/category-products/${fullSlug}?${paginationQuery.toString()}`}
              freeShippingThreshold={settings.freeShippingThreshold}
            />
          )}

          <Pagination
            totalPages={totalPages}
            currentPage={filters.page}
            basePath={`/kategorie/${fullSlug}`}
            queryString={paginationQuery.toString()}
          />
        </div>
      </div>

      {content?.faq && content.faq.length > 0 && (
        <section className="mt-6 flex flex-col gap-4 border-t border-line pt-8">
          <h2 className="text-lg font-bold text-ink">{content.faqTitle ?? "Časté otázky"}</h2>
          <div className="flex flex-col divide-y divide-line border-y border-line">
            {content.faq.map((item) => (
              <details key={item.q} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink">
                  {item.q}
                  <span className="text-ink transition group-open:rotate-180">⌄</span>
                </summary>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/80">{item.a}</p>
                {item.list && (
                  <ul className="mt-2 max-w-3xl list-disc pl-5 text-sm leading-relaxed text-ink/80">
                    {item.list.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
                {item.note && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink/80">{item.note}</p>}
                {item.link && (
                  <Link href={item.link.href} className="mt-2 inline-block text-sm font-semibold text-ink underline">
                    {item.link.label}
                  </Link>
                )}
              </details>
            ))}
          </div>
          {content.whatsappMessage && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-ink/80">Nevybrali jste? Poradíme osobně.</p>
              <WhatsappAdviceButton message={content.whatsappMessage} label="Poradit na WhatsAppu" />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
