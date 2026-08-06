"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useConsent } from "@/lib/consent-context";
import { trackAddToCart } from "@/lib/analytics/client-events";

export interface AddToCartProduct {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
  stock: number;
}

export function AddToCartButton({
  product,
  className,
}: {
  product: AddToCartProduct;
  className?: string;
}) {
  const { addItem } = useCart();
  const { consent } = useConsent();
  const [added, setAdded] = useState(false);

  const outOfStock = product.stock <= 0;

  return (
    <button
      type="button"
      disabled={outOfStock}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        addItem(product);
        if (consent?.marketing) {
          trackAddToCart({
            id: product.productId,
            name: product.name,
            price: product.price,
            qty: 1,
          });
        }
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
      }}
      className={
        className ??
        "w-full rounded-sm bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:bg-line disabled:text-accent-2"
      }
    >
      {outOfStock ? "Vyprodáno" : added ? "Přidáno ✓" : "Přidat do košíku"}
    </button>
  );
}
