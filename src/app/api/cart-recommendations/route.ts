import { NextRequest, NextResponse } from "next/server";
import { getFrequentlyBoughtTogetherForCart } from "@/lib/frequently-bought-together.server";
import { getComplementProducts } from "@/lib/related-products.server";
import { prisma } from "@/lib/prisma";

// Backs the "Doplňte objednávku" cross-sell on the cart page — the cart
// itself is client-state (localStorage via useCart), so there's no server
// component to fetch this from directly; the client fetches it here instead.
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  const cartProductIds = ids ? ids.split(",").filter(Boolean) : [];

  const isSk = req.nextUrl.searchParams.get("lang") === "sk";
  const LIMIT = 3;

  // 1) real co-purchases, 2) rule-based complements of what is in the cart (cheap, same brand first),
  // 3) the generic same-category / bestseller fallback only to fill what is still empty.
  const products = await getFrequentlyBoughtTogetherForCart(cartProductIds, LIMIT, isSk, false);
  if (products.length < LIMIT && cartProductIds.length > 0) {
    const cartProducts = await prisma.product.findMany({
      where: { id: { in: cartProductIds.slice(0, 4) } },
      select: { id: true, name: true, price: true, brandId: true, concentration: true, productType: true, occasions: true, keyIngredients: true },
    });
    const taken = new Set([...cartProductIds, ...products.map((p) => p.id)]);
    for (const base of cartProducts) {
      if (products.length >= LIMIT) break;
      for (const c of await getComplementProducts(base, isSk, 2)) {
        if (products.length >= LIMIT) break;
        if (!taken.has(c.id)) {
          taken.add(c.id);
          products.push(c);
        }
      }
    }
  }
  if (products.length < LIMIT) {
    for (const p of await getFrequentlyBoughtTogetherForCart(cartProductIds, LIMIT, isSk, true)) {
      if (products.length >= LIMIT) break;
      if (!products.some((x) => x.id === p.id)) products.push(p);
    }
  }

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      code: p.code,
      slug: p.slug,
      name: p.name,
      nameSk: p.nameSk,
      price: p.price.toString(),
      compareAtPrice: p.compareAtPrice?.toString() ?? null,
      stock: p.stock,
      isDefective: p.isDefective,
      salesCount: p.salesCount,
      isVegan: p.isVegan,
      isCrueltyFree: p.isCrueltyFree,
      brand: p.brand ? { name: p.brand.name } : null,
      images: p.images.map((img) => ({ url: img.url })),
    })),
  });
}
