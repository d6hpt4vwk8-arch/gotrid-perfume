import { NextRequest, NextResponse } from "next/server";
import { getFrequentlyBoughtTogetherForCart } from "@/lib/frequently-bought-together.server";

// Backs the "Doplňte objednávku" cross-sell on the cart page — the cart
// itself is client-state (localStorage via useCart), so there's no server
// component to fetch this from directly; the client fetches it here instead.
export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  const cartProductIds = ids ? ids.split(",").filter(Boolean) : [];

  const products = await getFrequentlyBoughtTogetherForCart(cartProductIds);

  return NextResponse.json({
    products: products.map((p) => ({
      id: p.id,
      code: p.code,
      slug: p.slug,
      name: p.name,
      price: p.price.toString(),
      compareAtPrice: p.compareAtPrice?.toString() ?? null,
      stock: p.stock,
      isDefective: p.isDefective,
      brand: p.brand ? { name: p.brand.name } : null,
      images: p.images.map((img) => ({ url: img.url })),
    })),
  });
}
