"use client";

import { useState } from "react";
import { ProductCard, type ProductCardData } from "@/components/product-card";

/**
 * Renders the initial server-fetched page of products, then appends
 * subsequent pages in place on "Zobrazit další produkty" instead of a full
 * page navigation — the numbered Pagination component (rendered alongside
 * this) still works normally for jumping straight to a specific page.
 */
export function ProductGridLoadMore({
  initialProducts,
  totalPages,
  currentPage,
  fetchUrl,
  freeShippingThreshold,
}: {
  initialProducts: ProductCardData[];
  totalPages: number;
  currentPage: number;
  /** e.g. "/api/kategorie/kosmetika/products?brand=chanel" — page param is appended per request. */
  fetchUrl: string;
  freeShippingThreshold?: number;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [nextPage, setNextPage] = useState(currentPage + 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMore = nextPage <= totalPages;

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const separator = fetchUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${fetchUrl}${separator}page=${nextPage}`);
      if (!res.ok) throw new Error();
      const data: { products: ProductCardData[] } = await res.json();
      setProducts((prev) => [...prev, ...data.products]);
      setNextPage((p) => p + 1);
    } catch {
      setError("Načtení dalších produktů se nezdařilo, zkuste to prosím znovu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} freeShippingThreshold={freeShippingThreshold} />
        ))}
      </div>

      {hasMore && (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="w-fit rounded-sm border border-line px-6 py-2.5 text-sm font-medium text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Načítám…" : "Zobrazit další produkty"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
