"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { formatEur, formatPrice } from "@/lib/format";
import type { Currency } from "@/lib/currency";

export type { Currency };

interface CurrencyContextValue {
  currency: Currency;
  /** CZK per 1 EUR (Settings.czkToEurRate). */
  czkToEurRate: number;
  /** Formats a CZK amount in the storefront's currency (Kč on Česko, € on Slovensko). */
  price: (valueCzk: Prisma.Decimal | number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  children,
  currency,
  czkToEurRate,
}: {
  children: ReactNode;
  /** Fixed by the country the visitor picked — see currencyForLocale. */
  currency: Currency;
  /** Settings.czkToEurRate — every DB price is CZK, this is what converts it for display. */
  czkToEurRate: number;
}) {
  const price = useCallback(
    (valueCzk: Prisma.Decimal | number) =>
      currency === "EUR" ? formatEur(valueCzk, czkToEurRate) : formatPrice(valueCzk),
    [currency, czkToEurRate],
  );

  const value = useMemo(() => ({ currency, czkToEurRate, price }), [currency, czkToEurRate, price]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
