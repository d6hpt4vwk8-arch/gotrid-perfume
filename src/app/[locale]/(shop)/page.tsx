import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCategoryNavTree } from "@/lib/categories.server";
import { primaryVariantWhere } from "@/lib/product-filters";
import { ProductCard } from "@/components/product-card";
import { HomeHero } from "@/components/home-hero";
import { PerfumeAdviceBlock } from "@/components/perfume-advice-block";
import { getHeurekaShopReviews } from "@/lib/heureka-reviews";
import { getSettings } from "@/lib/settings.server";
import type { Metadata } from "next";
import { jsonLdScript } from "@/lib/json-ld";
import { absoluteUrl } from "@/lib/seo";
import { CONTACT, currentSeller } from "@/lib/business-identity";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Top-level categories that already have an icon in public/categories/.
const CATEGORY_ICON_SLUGS = new Set([
  "nisove-parfemy",
  "parfemy",
  "kosmetika",
  "zuby",
  "aroma-difuzery",
  "vonne-svicky",
  "vune-do-auta",
  "domacnost",
  "pece-o-zdravi",
  "vyprodej",
]);

// K-beauty brands carried in the catalog — used to curate the homepage's
// "Korejská kosmetika" section (no dedicated category exists for this yet).
const KOREAN_COSMETICS_BRANDS = [
  "Cosrx", "Esthetic House", "Dr. Althea", "Missha", "SKIN1004", "Beauty Of Joseon",
  "VT Cosmetics", "VVBETTER", "APLB", "Medicube", "Some By Mi", "Haruharu Wonder",
  "Dr.Jart+", "Round Lab", "Celimax", "Lavon", "Holika Holika", "ITOXX", "Biodance",
  "Pyunkang Yul", "AXIS-Y", "Purito", "Abib", "Medi-Peel", "Mixsoon", "Numbuzin",
  "TIRTIR", "K-SECRET", "Isntree", "Polatam", "Dear, Klairs", "Coxir", "Barulab",
  "DAENG GI MEO RI", "Frudia", "Inkee", "Banila Co", "rom&nd", "TOCOBO", "Laneige",
  "Naturia", "d'Alba", "MEDIPEEL+", "Hyggee", "Torriden", "MEDIBLANC", "Hanskin",
  "Sioris", "I’m From",
];

export default async function HomePage() {
  const seller = currentSeller();
  const [categories, saleProducts, koreanCosmetics, arabicPerfumes, latestReviews, settings] =
    await Promise.all([
      getCategoryNavTree(),
      prisma.product.findMany({
        where: { visible: true, ...primaryVariantWhere, compareAtPrice: { not: null }, stock: { gt: 0 } },
        orderBy: [{ ownStock: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
        take: 12,
        include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      }),
      prisma.product.findMany({
        where: {
          visible: true,
          ...primaryVariantWhere,
          brand: { name: { in: KOREAN_COSMETICS_BRANDS } },
          stock: { gt: 0 },
          // Curated as "featured Korean cosmetics" by brand alone — a
          // damaged-packaging batch belongs only in Výprodej (see
          // isDefective in schema.prisma), not showcased here.
          isDefective: false,
        },
        orderBy: [{ ownStock: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
        take: 12,
        include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      }),
      prisma.product.findMany({
        where: {
          visible: true,
          ...primaryVariantWhere,
          categories: { some: { category: { fullSlug: "parfemy/arabske-parfemy" } } },
          stock: { gt: 0 },
        },
        orderBy: [{ ownStock: "desc" }, { priority: "desc" }, { createdAt: "desc" }],
        take: 12,
        include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
      }),
      getHeurekaShopReviews(6),
      getSettings(),
    ]);

  return (
    // w-full matters here, not decorative: <body> is flex-col, so <main>
    // should stretch to its width automatically — but with the 2-slide
    // hero (a gift coupon active), that stretch wasn't reliable in
    // practice. Something deep in the carousel's percentage-based sizing
    // ends up ambiguous during layout, and without an explicit width here
    // to anchor against, the browser fell back to sizing <main> off its
    // widest content (an unwrapped heading) instead of the viewport —
    // pushing the whole homepage ~120px wider than the screen on a phone
    // and silently clipping the right edge of every section.
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Gotrid Perfume",
              legalName: seller.legalName,
              url: absoluteUrl("/"),
              logo: absoluteUrl("/logo.svg"),
              email: CONTACT.email,
              telephone: CONTACT.phone,
              identifier: { "@type": "PropertyValue", propertyID: "IČO", value: seller.ico },
              address: {
                "@type": "PostalAddress",
                streetAddress: seller.street,
                addressLocality: seller.city,
                addressCountry: "CZ",
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Gotrid Perfume",
              url: absoluteUrl("/"),
              inLanguage: "cs",
              potentialAction: {
                "@type": "SearchAction",
                target: `${absoluteUrl("/hledat")}?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ]),
        }}
      />
      <HomeHero />

      <section>
        <h2 className="mb-4 text-lg font-semibold">Kategorie</h2>
        {/* One 3D icon per top-level category (public/categories/<fullSlug>.jpg); a category without
            an icon yet falls back to a plain text tile. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-5">
          {categories
            .filter((c) => !c.hidden)
            .map((category) => (
              <Link
                key={category.id}
                href={`/kategorie/${category.fullSlug}`}
                className="group flex flex-col items-center gap-2 text-center"
              >
                {CATEGORY_ICON_SLUGS.has(category.fullSlug) ? (
                  <span className="relative block aspect-square w-full overflow-hidden rounded-[18%] bg-ink transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg">
                    <Image
                      src={`/categories/${category.fullSlug}.jpg`}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 18vw, 30vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </span>
                ) : (
                  <span className="flex aspect-square w-full items-center justify-center rounded-[18%] border border-line text-xs text-accent-2">
                    {category.name}
                  </span>
                )}
                <span className="text-xs font-medium text-ink group-hover:underline sm:text-sm">
                  {category.name}
                </span>
              </Link>
            ))}
        </div>
      </section>

      <PerfumeAdviceBlock />

      {koreanCosmetics.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Korejská kosmetika</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {koreanCosmetics.map((product) => (
              <ProductCard key={product.slug} product={product} freeShippingThreshold={settings.freeShippingThreshold} />
            ))}
          </div>
        </section>
      )}

      {arabicPerfumes.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Arabské parfémy</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {arabicPerfumes.map((product) => (
              <ProductCard key={product.slug} product={product} freeShippingThreshold={settings.freeShippingThreshold} />
            ))}
          </div>
        </section>
      )}

      {saleProducts.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Výprodej</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {saleProducts.map((product) => (
              <ProductCard key={product.slug} product={product} freeShippingThreshold={settings.freeShippingThreshold} />
            ))}
          </div>
        </section>
      )}

      {latestReviews.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Poslední recenze</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {latestReviews.map((review) => (
              <div
                key={review.id}
                className="flex flex-col gap-1 rounded-lg border border-neutral-200 p-4 text-sm"
              >
                <span className="font-medium">
                  {"★".repeat(review.rating)}
                  {"☆".repeat(5 - review.rating)}
                </span>
                <p className="text-neutral-600 line-clamp-3">{review.text}</p>
                <span className="text-xs text-neutral-400">Ověřeno zákazníky — Heureka.cz</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
