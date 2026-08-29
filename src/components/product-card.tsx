import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { formatPrice } from "@/lib/format";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { WishlistButton } from "@/components/wishlist-button";

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  price: Prisma.Decimal | number;
  compareAtPrice: Prisma.Decimal | number | null;
  stock: number;
  brand: { name: string } | null;
  images: { url: string }[];
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = product.images[0];
  const discountPercent = product.compareAtPrice
    ? Math.round((1 - Number(product.price) / Number(product.compareAtPrice)) * 100)
    : null;

  return (
    <Link href={`/produkt/${product.slug}`} className="group flex flex-col">
      <div className="relative aspect-square w-full overflow-hidden bg-line/60">
        {discountPercent && discountPercent > 0 && (
          <span className="absolute left-2 top-2 z-10 rounded-sm bg-red-600 px-1.5 py-1 text-xs font-bold text-white">
            -{discountPercent}%
          </span>
        )}
        <WishlistButton
          product={{
            productId: product.id,
            slug: product.slug,
            name: product.name,
            price: Number(product.price),
            image: image?.url ?? null,
          }}
          className="absolute right-2 top-2 z-10 h-8 w-8 bg-white/90 shadow-sm hover:bg-white"
        />
        {image ? (
          <Image
            src={image.url}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 25vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-accent-2">
            Bez obrázku
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 pt-3">
        {product.brand && (
          <span className="border-b border-line pb-1.5 text-[10px] font-medium tracking-wide text-accent-2 uppercase">
            {product.brand.name}
          </span>
        )}
        <span className="line-clamp-2 text-sm font-semibold text-ink group-hover:underline">
          {product.name}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="font-bold text-accent">{formatPrice(product.price)}</span>
          {product.compareAtPrice && (
            <span className="text-sm text-accent-2 line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </div>
        <span
          className={`flex items-center gap-1.5 text-xs ${product.stock > 0 ? "text-ok" : "text-accent-2"}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${product.stock > 0 ? "bg-ok" : "bg-accent-2"}`}
          />
          {product.stock > 0 ? "Skladem" : "Vyprodáno"}
        </span>
        <div className="mt-auto pt-2">
          <AddToCartButton
            product={{
              productId: product.id,
              slug: product.slug,
              name: product.name,
              price: Number(product.price),
              image: image?.url ?? null,
              stock: product.stock,
            }}
            className="w-full rounded-sm bg-ink px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-accent-2"
          />
        </div>
      </div>
    </Link>
  );
}
