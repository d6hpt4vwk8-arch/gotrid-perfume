"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Prisma } from "@prisma/client";
import { formatEur, formatPrice } from "@/lib/format";
import { CURRENCY_COOKIE_NAME, type Currency } from "@/lib/currency-cookie";

export type { Currency };

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  /** Formats a CZK amount in whichever currency the visitor picked. */
  price: (valueCzk: Prisma.Decimal | number) => string;
}

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function writeCurrencyCookie(currency: Currency) {
  document.cookie = `${CURRENCY_COOKIE_NAME}=${currency}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  children,
  initialCurrency,
  czkToEurRate,
}: {
  children: ReactNode;
  /** Parsed server-side from the gotrid-currency cookie — see currency-cookie.ts. */
  initialCurrency: Currency;
  /** Settings.czkToEurRate — every DB price is CZK, this is what converts it for display. */
  czkToEurRate: number;
}) {
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);

  const setCurrency = useCallback((next: Currency) => {
    writeCurrencyCookie(next);
    setCurrencyState(next);
  }, []);

  const price = useCallback(
    (valueCzk: Prisma.Decimal | number) =>
      currency === "EUR" ? formatEur(valueCzk, czkToEurRate) : formatPrice(valueCzk),
    [currency, czkToEurRate],
  );

  const value = useMemo(() => ({ currency, setCurrency, price }), [currency, setCurrency, price]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
