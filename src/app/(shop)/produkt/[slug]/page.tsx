import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductViewTracker } from "@/components/product-view-tracker";
import { sanitizeDescription } from "@/lib/sanitize-description";
import { jsonLdScript } from "@/lib/json-ld";
import { ProductCard } from "@/components/product-card";
import { WishlistButton } from "@/components/wishlist-button";
import { StockAlertForm } from "@/components/stock-alert-form";

async function getProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug, visible: true },
    include: {
      brand: true,
      images: { orderBy: { sortOrder: "asc" } },
      reviews: { orderBy: { date: "desc" }, take: 10 },
      categories: { include: { category: true } },
    },
  });
}

async function getRelatedProducts(productId: string, categoryIds: string[]) {
  if (categoryIds.length === 0) return [];
  return prisma.product.findMany({
    where: {
      id: { not: productId },
      visible: true,
      categories: { some: { categoryId: { in: categoryIds } } },
    },
    include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  return {
    title: `${product.name} | Gotrid Perfume`,
    description: product.description?.slice(0, 160),
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

  const relatedProducts = await getRelatedProducts(
    product.id,
    product.categories.map((c) => c.categoryId),
  );

  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images.map((i) => i.url),
    description: product.description ?? undefined,
    sku: product.code,
    gtin13: product.ean ?? undefined,
    brand: product.brand ? { "@type": "Brand", name: product.brand.name } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "CZK",
      price: Number(product.price),
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
      <ProductViewTracker
        product={{ id: product.id, name: product.name, price: Number(product.price) }}
      />

      <div className="grid gap-8 md:grid-cols-2">
        <div className="grid grid-cols-4 gap-2">
          <div className="relative col-span-4 aspect-square overflow-hidden bg-line/60">
            {product.images[0] ? (
              <Image
                src={product.images[0].url}
                alt={product.name}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-accent-2">
                Bez obrázku
              </div>
            )}
          </div>
          {product.images.slice(1, 5).map((image) => (
            <div key={image.id} className="relative aspect-square overflow-hidden bg-line/60">
              <Image src={image.url} alt={product.name} fill sizes="12vw" className="object-cover" />
            </div>
          ))}
        </div>

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
            <h1 className="text-2xl font-bold text-ink">{product.name}</h1>
            <WishlistButton
              product={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                price: Number(product.price),
                image: product.images[0]?.url ?? null,
              }}
              className="h-9 w-9 shrink-0 border border-line hover:bg-line/40"
            />
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-accent">{formatPrice(product.price)}</span>
            {product.compareAtPrice && (
              <span className="text-lg text-accent-2 line-through">
                {formatPrice(product.compareAtPrice)}
              </span>
            )}
          </div>

          <span
            className={`flex items-center gap-1.5 text-sm ${product.stock > 0 ? "text-ok" : "text-accent-2"}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${product.stock > 0 ? "bg-ok" : "bg-accent-2"}`}
            />
            {product.stock > 0 ? `Skladem (${product.stock} ks)` : "Vyprodáno"}
          </span>

          <div className="max-w-xs">
            <AddToCartButton
              product={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                price: Number(product.price),
                image: product.images[0]?.url ?? null,
                stock: product.stock,
              }}
            />
          </div>

          {product.stock <= 0 && (
            <div className="max-w-xs">
              <StockAlertForm productId={product.id} />
            </div>
          )}

          {product.ean && (
            <span className="text-xs text-accent-2">EAN: {product.ean}</span>
          )}

          {product.description && (
            <div
              className="prose prose-neutral mt-4 max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: sanitizeDescription(product.description) }}
            />
          )}
        </div>
      </div>

      {product.reviews.length > 0 && (
        <section className="border-t border-line pt-6">
          <h2 className="mb-4 text-lg font-bold text-ink">
            Recenze {avgRating && `— ${avgRating.toFixed(1)} / 5`}
          </h2>
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
        </section>
      )}

      {relatedProducts.length > 0 && (
        <section className="border-t border-line pt-6">
          <h2 className="mb-4 text-lg font-bold text-ink">Podobné produkty</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
            {relatedProducts.map((related) => (
              <ProductCard key={related.slug} product={related} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
