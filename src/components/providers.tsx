"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart-context";
import { ConsentProvider } from "@/lib/consent-context";
import { WishlistProvider } from "@/lib/wishlist-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConsentProvider>
      <CartProvider>
        <WishlistProvider>{children}</WishlistProvider>
      </CartProvider>
    </ConsentProvider>
  );
}
