import { attachColorSwatches } from "@/lib/color-swatches.server";
import { attachReviewRatings } from "@/lib/review-stats.server";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { primaryVariantWhere } from "@/lib/product-filters";
import { ProductCard } from "@/components/product-card";
import { getSettings } from "@/lib/settings.server";
import type { Metadata } from "next";
import { jsonLdScript } from "@/lib/json-ld";
import { breadcrumbJsonLd, collectionJsonLd, localeAlternates, localePath, ogMeta } from "@/lib/seo";
import { getListingStats, listingDescription, listingTitle } from "@/lib/listing-seo.server";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { skScope } from "@/lib/sk-visibility";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
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
  const path = localePath(locale, `/znacka/${brand.slug}`);
  return {
    title,
    description,
    alternates: localeAlternates(locale, `/znacka/${brand.slug}`),
    ...ogMeta({ title, description, path, locale }),
    // A brand page with nothing in stock is an empty shell — don't ask Google to index it.
    ...(stats.count === 0 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await prisma.brand.findUnique({ where: { slug } });
  if (!brand) notFound();
  const [tr, locale] = await Promise.all([getTr(), getCurrentLocale()]);

  const [rawProducts, settings] = await Promise.all([
    prisma.product.findMany({
      where: skScope({ visible: true, brandId: brand.id, ...primaryVariantWhere, stock: { gt: 0 } }, locale === "sk"),
      orderBy: { createdAt: "desc" },
      include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
    getSettings(),
  ]);
  const products = await attachReviewRatings(await attachColorSwatches(rawProducts));

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
              items: products.slice(0, 24).map((p) => {
                const sk = locale === "sk" && !!p.nameSk;
                return { name: sk ? p.nameSk! : p.name, path: localePath(sk ? "sk" : "cs", `/produkt/${p.slug}`) };
              }),
            }),
          ),
        }}
      />
      <h1 className="text-2xl font-bold text-ink">{brand.name}</h1>

      {products.length === 0 ? (
        <p className="text-sm text-accent-2">{tr("U této značky zatím nejsou žádné produkty.")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              freeShippingThreshold={settings.freeShippingThreshold}
            />
          ))}
        </div>
      )}
    </main>
  );
}
