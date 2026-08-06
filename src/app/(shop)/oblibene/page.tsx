"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWishlist } from "@/lib/wishlist-context";
import { ProductCard, type ProductCardData } from "@/components/product-card";

export default function WishlistPage() {
  const { items } = useWishlist();
  const [products, setProducts] = useState<ProductCardData[] | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      setProducts([]);
      return;
    }
    const ids = items.map((i) => i.productId).join(",");
    fetch(`/api/products/by-ids?ids=${encodeURIComponent(ids)}`)
      .then((res) => res.json())
      .then((data) => setProducts(data.products))
      .catch(() => setProducts([]));
  }, [items]);

  if (products === null) {
    return (
      <main className="mx-auto flex max-w-6xl flex-1 flex-col px-4 py-10">
        <h1 className="mb-6 text-2xl font-bold text-ink">Oblíbené produkty</h1>
        <p className="text-accent-2">Načítání…</p>
      </main>
    );
  }

  if (products.length === 0) {
    return (
      <main className="mx-auto flex max-w-3xl flex-1 flex-col items-center gap-4 px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-ink">Nemáte žádné oblíbené produkty</h1>
        <p className="text-accent-2">
          Klikněte na srdíčko u produktu a uložíte si ho sem na později.
        </p>
        <Link
          href="/"
          className="rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent"
        >
          Zpět na výběr produktů
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-1 flex-col px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold text-ink">Oblíbené produkty</h1>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </main>
  );
}
