import type { ProductCardData } from "@/components/product-card";

interface CardSource {
  id: string;
  code: string;
  slug: string;
  name: string;
  nameSk: string | null;
  price: { toString(): string };
  compareAtPrice: { toString(): string } | null;
  stock: number;
  isDefective: boolean;
  salesCount: number;
  isVegan: boolean;
  isCrueltyFree: boolean;
  brand: { name: string } | null;
  images: { url: string }[];
  colorSwatches?: ProductCardData["colorSwatches"];
  rating?: ProductCardData["rating"];
}

/**
 * Listing products reduced to the card fields, with plain numbers instead of Prisma Decimals. Used both for the JSON
 * the "Zobrazit další produkty" button appends and for the first page handed to ProductGridLoadMore, so a client
 * component never receives the full database row (purchase price, supplier flags, descriptions, …).
 */
export function toCardJson(products: CardSource[]): ProductCardData[] {
  return products.map((p) => ({
    id: p.id,
    code: p.code,
    slug: p.slug,
    name: p.name,
    nameSk: p.nameSk,
    price: Number(p.price),
    compareAtPrice: p.compareAtPrice === null ? null : Number(p.compareAtPrice),
    stock: p.stock,
    isDefective: p.isDefective,
    salesCount: p.salesCount,
    isVegan: p.isVegan,
    isCrueltyFree: p.isCrueltyFree,
    brand: p.brand ? { name: p.brand.name } : null,
    images: p.images.map((img) => ({ url: img.url })),
    colorSwatches: p.colorSwatches,
    rating: p.rating,
  }));
}
