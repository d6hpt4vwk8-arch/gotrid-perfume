import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPriceIn } from "@/lib/format";
import { currencyForLocale } from "@/lib/currency";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { categoryNameSk } from "@/lib/sk-terms";
import { skScope } from "@/lib/sk-visibility";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { SampleGiftNote } from "@/components/sample-gift-note";
import { ProductViewTracker } from "@/components/product-view-tracker";
import { HeurekaProductView } from "@/components/heureka-product-view";
import { sanitizeDescription } from "@/lib/sanitize-description";
import { jsonLdScript } from "@/lib/json-ld";
import { breadcrumbJsonLd, htmlToPlainText, localeAlternates, localePath, truncateAtWord } from "@/lib/seo";
import { ProductCard } from "@/components/product-card";
import { WishlistButton } from "@/components/wishlist-button";
import { StockAlertForm } from "@/components/stock-alert-form";
import { getProductSpecs } from "@/lib/product-specs";
import { getCategoryBreadcrumb } from "@/lib/categories.server";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getFrequentlyBoughtTogether } from "@/lib/frequently-bought-together.server";
import { getSameLineProducts } from "@/lib/product-line.server";
import { parseVolumeMl, formatVolumeLabel } from "@/lib/parse-volume";
import { parseShadeLabel, SHADE_SWATCH_COLORS } from "@/lib/parse-shade";
import { estimateDeliveryDate, formatDeliveryEstimate } from "@/lib/delivery-estimate";
import { getSettings } from "@/lib/settings.server";
import { ReviewForm } from "@/components/review-form";
import { ProductGallery } from "@/components/product-gallery";
import { primaryVariantWhere } from "@/lib/product-filters";
import { ScentNotesPyramid } from "@/components/scent-notes-pyramid";
import { ProductTrustStrip } from "@/components/product-trust-strip";
import { ProductDetailsBlocks } from "@/components/product-details-blocks";
import { pickProductDetails } from "@/lib/product-details";
import { BestsellerPill, EthicsPills, isBestseller } from "@/components/product-badges";

async function getProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug, visible: true },
    include: {
      brand: true,
      images: { orderBy: { sortOrder: "asc" } },
      reviews: { where: { published: true }, orderBy: { date: "desc" }, take: 10 },
      categories: { include: { category: true } },
      scentNotes: true,
    },
  });
}

/**
 * Sibling variants sharing this product's variantGroupKey — either other
 * bottle sizes of the same fragrance (scripts/group-product-variants.ts) or
 * other shades of the same color-cosmetics item
 * (scripts/group-shade-variants.ts); a product is only ever in one kind of
 * group. Includes the current product itself, sorted smallest-to-largest
 * for sizes or alphabetically by shade label for shades.
 */
async function getSizeVariants(variantGroupKey: string | null) {
  if (!variantGroupKey) return [];
  const products = await prisma.product.findMany({
    where: { variantGroupKey },
    select: { id: true, slug: true, name: true, stock: true },
  });
  // Same "does this attribute actually vary" check as the selector UI below
  // — a shade group can still have a parseable (identical) volume in every
  // member's name, which isn't a meaningful thing to sort by.
  const isSizeGroup = new Set(products.map((p) => formatVolumeLabel(p.name))).size > 1;
  if (isSizeGroup) {
    return products.sort((a, b) => (parseVolumeMl(a.name) ?? 0) - (parseVolumeMl(b.name) ?? 0));
  }
  return products.sort((a, b) =>
    (parseShadeLabel(a.name) ?? "").localeCompare(parseShadeLabel(b.name) ?? ""),
  );
}

async function getRelatedProducts(productId: string, categoryIds: string[], isSk: boolean) {
  if (categoryIds.length === 0) return [];
  return prisma.product.findMany({
    where: skScope({
      id: { not: productId },
      visible: true,
      categories: { some: { categoryId: { in: categoryIds } } },
      ...primaryVariantWhere,
      stock: { gt: 0 },
    }, isSk),
    include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: [{ ownStock: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
    take: 8,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const isSk = locale === "sk";
  const tr = await getTr();
  const product = await getProduct(slug);
  if (!product) return {};
  const displayName = isSk && product.nameSk ? product.nameSk : product.name;
  const displayDescription = isSk && product.descriptionSk ? product.descriptionSk : product.description;
  // Descriptions are stored as HTML (and ~70 % of products have none): strip the
  // markup, and fall back to plain facts so the snippet is never empty or "<p>…".
  const text = htmlToPlainText(displayDescription);
  const brandName = product.brand?.name;
  const price = Math.round(Number(product.price));
  const settings = await getSettings();
  const nameWithBrand = `${displayName}${brandName && !displayName.toLowerCase().includes(brandName.toLowerCase()) ? ` (${brandName})` : ""}`;
  const facts = isSk
    ? `${nameWithBrand} ${tr("za")} ${formatPriceIn(product.price, "EUR", settings.czkToEurRate)}. ${product.stock > 0 ? `${tr("Skladem")}, ` : ""}${tr("vrácení do 14 dní.")} ${tr("Originálny tovar")}, Gotrid Perfume.`
    : `${nameWithBrand} za ${price} Kč. ${product.stock > 0 ? "Skladem, " : ""}doprava od 59 Kč, vrácení do 14 dnů. Originální zboží, Gotrid Perfume.`;
  return {
    title: `${displayName} | Gotrid Perfume`,
    description: truncateAtWord(text.length >= 60 ? text : `${facts}${text ? ` ${text}` : ""}`),
    // A product without Slovak copy keeps the Czech page as its only canonical version.
    alternates:
      isSk && !product.nameSk
        ? { canonical: `/produkt/${product.slug}` }
        : localeAlternates(locale, `/produkt/${product.slug}`),
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [tr, locale] = await Promise.all([getTr(), getCurrentLocale()]);
  const isSk = locale === "sk";
  // Slovak copy (Product.nameSk / descriptionSk) when it exists; the many
  // products not translated yet fall back to their Czech text.
  const displayName = isSk && product.nameSk ? product.nameSk : product.name;
  const displayDescription = isSk && product.descriptionSk ? product.descriptionSk : product.description;
  const structuredDetails = pickProductDetails(product.details, isSk ? "sk" : "cs");
  const catName = (name: string) => (isSk ? categoryNameSk(name) : name);

  const primaryCategory = product.categories[0]?.category;

  const [relatedProducts, sizeVariants, categoryBreadcrumb, frequentlyBoughtTogether, sameLineProducts, settings] =
    await Promise.all([
      getRelatedProducts(
        product.id,
        product.categories.map((c) => c.categoryId),
        isSk,
      ),
      getSizeVariants(product.variantGroupKey),
      primaryCategory ? getCategoryBreadcrumb(primaryCategory.fullSlug) : Promise.resolve([]),
      getFrequentlyBoughtTogether(product.id, 4, isSk),
      getSameLineProducts(product, 4, isSk),
      getSettings(),
    ]);
  const currency = currencyForLocale(locale);
  const price = (czk: Prisma.Decimal | number) => formatPriceIn(czk, currency, settings.czkToEurRate);

  // Shown next to Add to cart so price-comparison traffic (Zbozi/Heureka)
  // sees the real shipping cost before checkout, not just at the very end —
  // Clarity session recordings showed visitors landing straight on
  // checkout from these sites and removing the item once they saw the
  // total including delivery, which the product page never mentioned.
  const cheapestShippingPrice = isSk
    ? Math.min(
        ...[settings.shippingPriceZasilkovnaSk ?? settings.shippingPrices.ZASILKOVNA, settings.shippingPriceGlsSk ?? settings.shippingPrices.GLS].filter(
          (p) => p > 0,
        ),
      )
    : Math.min(...Object.values(settings.shippingPrices).filter((p) => p > 0));

  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : null;

  const specs = getProductSpecs(product, tr, isSk);
  // Perfumes get one extra business day on top of the site default — some
  // perfume SKUs depend on a slower supplier (SP Venture) whose own
  // handoff-to-courier time is less predictable than for drugstore/cosmetic
  // items sourced faster elsewhere (2026-09-23, owner request).
  const isPerfume = product.categories.some((c) => c.category.fullSlug.startsWith("parfemy"));
  // SP Venture items that only exist in their other warehouse (slowerDelivery,
  // kept by the SP Venture sync) get one extra business day — a plain promise
  // instead of the old "may take a week" warning that scared customers off
  // (owner's call, 2026-10-16).
  const deliveryEstimate =
    product.stock > 0 ? estimateDeliveryDate((isPerfume ? 4 : 3) + (product.slowerDelivery ? 1 : 0)) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: displayName,
    image: product.images.map((i) => i.url),
    description: htmlToPlainText(displayDescription) || undefined,
    sku: product.code,
    gtin13: product.ean ?? undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: currency,
      price: currency === "EUR" ? Math.round((Number(product.price) / settings.czkToEurRate) * 100) / 100 : Number(product.price),
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
    ...(avgRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: avgRating.toFixed(1),
        reviewCount: product.reviews.length,
      },
    }),
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col gap-8 px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbJsonLd(
              [
                ...categoryBreadcrumb.map((c) => ({ name: catName(c.name), path: localePath(locale, `/kategorie/${c.fullSlug}`) })),
                { name: displayName, path: localePath(locale, `/produkt/${product.slug}`) },
              ],
              { home: tr("Domů"), homePath: localePath(locale, "/") },
            ),
          ),
        }}
      />
      <ProductViewTracker
        product={{ id: product.id, code: product.code, name: displayName, price: Number(product.price) }}
      />
      <HeurekaProductView />

      <Breadcrumbs
        items={[
          ...categoryBreadcrumb.map((c) => ({ name: catName(c.name), href: `/kategorie/${c.fullSlug}` })),
          { name: displayName },
        ]}
      />

      <div className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={product.images} alt={displayName} />

        <div className="flex flex-col gap-4">
          {product.brand && (
            <Link
              href={`/znacka/${product.brand.slug}`}
              className="w-fit border-b border-line pb-1.5 text-[11px] font-medium tracking-wide text-accent-2 uppercase hover:text-accent"
            >
              {product.brand.name}
            </Link>
          )}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-ink">{displayName}</h1>
            <WishlistButton
              product={{
                productId: product.id,
                slug: product.slug,
                name: displayName,
                price: Number(product.price),
                image: product.images[0]?.url ?? null,
              }}
              className="h-9 w-9 shrink-0 border border-line hover:bg-line/40"
            />
          </div>

          {product.reviews.length > 0 && (
            <a href="#recenze" className="flex w-fit items-center gap-1.5 text-sm">
              <span className="text-accent" aria-hidden="true">
                {"★".repeat(Math.round(avgRating ?? 0))}
                {"☆".repeat(5 - Math.round(avgRating ?? 0))}
              </span>
              <span className="text-accent-2 underline-offset-2 hover:underline">
                ({product.reviews.length})
              </span>
            </a>
          )}

          {product.isDefective && (
            <span className="w-fit rounded-sm bg-amber-600 px-1.5 py-1 text-xs font-bold text-white">
              {tr("Poškozený obal")}
            </span>
          )}

          {(isBestseller(product.salesCount) || product.isVegan || product.isCrueltyFree) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {isBestseller(product.salesCount) && <BestsellerPill />}
              <EthicsPills
                isVegan={product.isVegan}
                isCrueltyFree={product.isCrueltyFree}
                crueltyFreeTitle={tr("Cruelty-free: produkt ani jeho složky nebyly testovány na zvířatech")}
              />
            </div>
          )}

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-accent">{price(product.price)}</span>
            {product.compareAtPrice && (
              <>
                <span className="text-lg text-accent-2 line-through">
                  {price(product.compareAtPrice)}
                </span>
                <span className="rounded-sm bg-red-600 px-1.5 py-1 text-xs font-bold text-white">
                  -{Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)}%
                </span>
              </>
            )}
          </div>

          {sizeVariants.length > 1 && (() => {
            // group-shade-variants.ts only groups products whose *shade*
            // differs — a group-product-variants.ts (size) group can still
            // happen to share the same volume across every member (every
            // True Match shade here is 30 ml) and that must not be shown as
            // a "Velikost" selector listing "30 ml" five times. Pick
            // whichever attribute actually varies across the group, not
            // just whichever happens to be parseable from the name.
            const volumeLabels = sizeVariants.map((v) => formatVolumeLabel(v.name));
            const isSizeGroup = new Set(volumeLabels).size > 1;
            const labelFor = (name: string) =>
              (isSizeGroup ? formatVolumeLabel(name) : parseShadeLabel(name)) ?? name;

            const swatchFor = (name: string) => SHADE_SWATCH_COLORS[(labelFor(name) ?? "").toLowerCase()];
            const useSwatches = !isSizeGroup && sizeVariants.every((v) => swatchFor(v.name));

            if (useSwatches) {
              const currentLabel = labelFor(product.name);
              return (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-semibold tracking-wide text-accent-2 uppercase">
                    {tr("Barva")}: <span className="text-ink normal-case">{currentLabel}</span>
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {sizeVariants.map((variant) => {
                      const label = labelFor(variant.name);
                      const isCurrent = variant.id === product.id;
                      const circle = (
                        <span
                          className={`block h-8 w-8 rounded-full border border-line ${
                            isCurrent ? "ring-2 ring-ink ring-offset-2" : ""
                          } ${variant.stock <= 0 ? "opacity-40" : ""}`}
                          style={{ backgroundColor: swatchFor(variant.name) }}
                        />
                      );
                      return isCurrent ? (
                        <span key={variant.id} title={label} aria-label={label} aria-current="true">
                          {circle}
                        </span>
                      ) : (
                        <Link
                          key={variant.id}
                          href={`/produkt/${variant.slug}`}
                          title={variant.stock <= 0 ? `${label} (${tr("vyprodáno")})` : label}
                          aria-label={label}
                        >
                          {circle}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-accent-2 uppercase">
                  {isSizeGroup ? tr("Velikost") : tr("Odstín")}
                </span>
                <div className="flex flex-wrap gap-2">
                  {sizeVariants.map((variant) => {
                    const label = labelFor(variant.name);
                    if (variant.id === product.id) {
                      return (
                        <span
                          key={variant.id}
                          className="rounded-sm border border-ink bg-ink px-3 py-1.5 text-sm font-medium text-white"
                        >
                          {label}
                        </span>
                      );
                    }
                    return (
                      <Link
                        key={variant.id}
                        href={`/produkt/${variant.slug}`}
                        className="rounded-sm border border-line px-3 py-1.5 text-sm font-medium text-ink hover:border-accent"
                      >
                        {label}
                        {variant.stock <= 0 && (
                          <span className="text-accent-2"> ({tr("vyprodáno")})</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="flex flex-col gap-1">
            <span
              className={`flex items-center gap-1.5 text-sm font-semibold ${product.stock > 0 ? "text-ok" : "text-accent-2"}`}
            >
              {product.stock > 0 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <path
                    d="M7.5 12.5l3 3 6-6.5"
                    fill="none"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />
              )}
              {product.stock > 0 ? tr("Skladem ({n} ks)", { n: product.stock }) : tr("Vyprodáno")}
            </span>

            {/* The old "máme na jiném skladu, doručení trvá déle" warning was removed
                (owner's call, 2026-10-08): it cost conversions and real supplier
                orders have not shown slower delivery. Product.slowerDelivery is
                still maintained by the SP Venture sync, just no longer shown. */}
            {product.stock > 0 && (
              <p className="pl-6 text-sm text-accent-2">
                {tr("Ihned k odeslání od")}{" "}
                <span className="font-medium text-ink">{price(cheapestShippingPrice)}</span>
                {deliveryEstimate && (
                  <>
                    , {tr("u vás doma již")}{" "}
                    <span className="font-medium text-ink">{formatDeliveryEstimate(deliveryEstimate, locale)}</span>
                  </>
                )}
                . <Link href="/doprava-a-platba" className="text-ink underline hover:text-accent">
                  {tr("Možnosti dopravy")}
                </Link>
              </p>
            )}
          </div>

          <div className="max-w-xs">
            <AddToCartButton
              product={{
                productId: product.id,
                code: product.code,
                slug: product.slug,
                name: displayName,
                price: Number(product.price),
                image: product.images[0]?.url ?? null,
                stock: product.stock,
                isDefective: product.isDefective,
              }}
            />
          </div>

          {product.stock > 0 && <SampleGiftNote productId={product.id} />}

          {product.stock <= 0 && (
            <div className="max-w-xs">
              <StockAlertForm productId={product.id} />
            </div>
          )}

          <ProductTrustStrip productName={displayName} />

          {displayDescription && (
            <div
              className="prose prose-neutral mt-4 max-w-none text-sm leading-relaxed [&_li]:mb-1 [&_p]:mb-3 [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitizeDescription(displayDescription) }}
            />
          )}

          {specs.length > 0 && (
            <div className="mt-2">
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-accent-2 uppercase">
                {tr("Parametry")}
              </h2>
              <dl className="divide-y divide-line border-y border-line text-sm">
                {specs.map((spec) => (
                  <div key={spec.label} className="flex justify-between gap-4 py-2">
                    <dt className="text-accent-2">{spec.label}</dt>
                    <dd className="text-right font-medium text-ink">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {product.ingredients && (
            <div className="mt-2">
              <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-accent-2 uppercase">
                {tr("Složení (INCI)")}
              </h2>
              <p className="text-sm whitespace-pre-line text-ink/70">{product.ingredients}</p>
            </div>
          )}
        </div>
      </div>

      {structuredDetails && <ProductDetailsBlocks details={structuredDetails} />}

      {frequentlyBoughtTogether.length > 0 && (
        <section className="border-t border-line pt-6">
          <h2 className="mb-4 text-lg font-bold text-ink">{tr("Často kupováno spolu")}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
            {frequentlyBoughtTogether.map((item) => (
              <ProductCard
                key={item.slug}
                product={item}
                freeShippingThreshold={settings.freeShippingThreshold}
              />
            ))}
          </div>
        </section>
      )}

      {sameLineProducts.length > 0 && (
        <section className="border-t border-line pt-6">
          <h2 className="mb-4 text-lg font-bold text-ink">{tr("Další produkty ze stejné vůně")}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
            {sameLineProducts.map((item) => (
              <ProductCard
                key={item.slug}
                product={item}
                freeShippingThreshold={settings.freeShippingThreshold}
              />
            ))}
          </div>
        </section>
      )}

      {product.scentNotes && (
        <ScentNotesPyramid
          topNotes={product.scentNotes.topNotes}
          middleNotes={product.scentNotes.middleNotes}
          baseNotes={product.scentNotes.baseNotes}
          mainAccords={product.scentNotes.mainAccords}
        />
      )}

      <section id="recenze" className="flex flex-col gap-4 border-t border-line pt-6">
        <h2 className="text-lg font-bold text-ink">
          {tr("Recenze")} {avgRating && `— ${avgRating.toFixed(1)} / 5`}
        </h2>
        {product.reviews.length > 0 && (
          <ul className="flex flex-col gap-4">
            {product.reviews.map((review) => (
              <li key={review.id} className="border border-line p-4 text-sm">
                <div className="flex items-center gap-2 font-medium text-accent">
                  <span>{"★".repeat(review.rating)}</span>
                  {review.authorName && <span className="text-ink">{review.authorName}</span>}
                </div>
                {review.text && <p className="mt-1 text-ink/70">{review.text}</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="max-w-sm">
          <ReviewForm productId={product.id} />
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section className="border-t border-line pt-6">
          <h2 className="mb-4 text-lg font-bold text-ink">{tr("Podobné produkty")}</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
            {relatedProducts.map((related) => (
              <ProductCard
                key={related.slug}
                product={related}
                freeShippingThreshold={settings.freeShippingThreshold}
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
