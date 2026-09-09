"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart-context";
import { ConsentProvider, type ConsentState } from "@/lib/consent-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import { CartToast } from "@/components/cart-toast";

export function Providers({
  children,
  freeShippingThreshold,
  initialConsent,
}: {
  children: ReactNode;
  freeShippingThreshold: number;
  initialConsent: ConsentState | null;
}) {
  return (
    <ConsentProvider initialConsent={initialConsent}>
      <CartProvider freeShippingThreshold={freeShippingThreshold}>
        <WishlistProvider>
          {children}
          <CartToast />
        </WishlistProvider>
      </CartProvider>
    </ConsentProvider>
  );
}
