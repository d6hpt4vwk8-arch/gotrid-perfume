"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/lib/cart-context";
import { ConsentProvider, type ConsentState } from "@/lib/consent-context";
import { CurrencyProvider } from "@/lib/currency-context";
import type { Currency } from "@/lib/currency";
import { WishlistProvider } from "@/lib/wishlist-context";
import { CartToast } from "@/components/cart-toast";

export function Providers({
  children,
  freeShippingThreshold,
  initialConsent,
  currency,
  czkToEurRate,
  loggedIn,
}: {
  children: ReactNode;
  freeShippingThreshold: number;
  initialConsent: ConsentState | null;
  currency: Currency;
  czkToEurRate: number;
  /** A customer account is signed in — favourites are then synced to the server. */
  loggedIn: boolean;
}) {
  return (
    <ConsentProvider initialConsent={initialConsent}>
      <CurrencyProvider currency={currency} czkToEurRate={czkToEurRate}>
        <CartProvider freeShippingThreshold={freeShippingThreshold}>
          <WishlistProvider loggedIn={loggedIn}>
            {children}
            <CartToast />
          </WishlistProvider>
        </CartProvider>
      </CurrencyProvider>
    </ConsentProvider>
  );
}
