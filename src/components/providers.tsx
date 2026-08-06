"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart-context";
import { ConsentProvider } from "@/lib/consent-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import { CartToast } from "@/components/cart-toast";

export function Providers({
  children,
  freeShippingThreshold,
}: {
  children: ReactNode;
  freeShippingThreshold: number;
}) {
  return (
    <ConsentProvider>
      <CartProvider freeShippingThreshold={freeShippingThreshold}>
        <WishlistProvider>
          {children}
          <CartToast />
        </WishlistProvider>
      </CartProvider>
    </ConsentProvider>
  );
}
