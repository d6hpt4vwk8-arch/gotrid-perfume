"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart-context";
import { ConsentProvider, type ConsentState } from "@/lib/consent-context";
import { CurrencyProvider } from "@/lib/currency-context";
import type { Currency } from "@/lib/currency-cookie";
import { WishlistProvider } from "@/lib/wishlist-context";
import { CartToast } from "@/components/cart-toast";

export function Providers({
  children,
  freeShippingThreshold,
  initialConsent,
  initialCurrency,
  czkToEurRate,
}: {
  children: ReactNode;
  freeShippingThreshold: number;
  initialConsent: ConsentState | null;
  initialCurrency: Currency;
  czkToEurRate: number;
}) {
  return (
    <ConsentProvider initialConsent={initialConsent}>
      <CurrencyProvider initialCurrency={initialCurrency} czkToEurRate={czkToEurRate}>
        <CartProvider freeShippingThreshold={freeShippingThreshold}>
          <WishlistProvider>
            {children}
            <CartToast />
          </WishlistProvider>
        </CartProvider>
      </CurrencyProvider>
    </ConsentProvider>
  );
}
