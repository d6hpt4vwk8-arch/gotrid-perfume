import type { Prisma } from "@prisma/client";
import type { Currency } from "@/lib/currency-cookie";

const czk = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

const eur = new Intl.NumberFormat("sk-SK", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(value: Prisma.Decimal | number): string {
  return czk.format(Number(value));
}

/** Every price in the DB is CZK — this converts+formats one for a Slovak (EUR) shopper. */
export function czkToEur(valueCzk: Prisma.Decimal | number, rate: Prisma.Decimal | number): number {
  return Number(valueCzk) / Number(rate);
}

export function formatEur(valueCzk: Prisma.Decimal | number, rate: Prisma.Decimal | number): string {
  return eur.format(czkToEur(valueCzk, rate));
}

/** Formats an amount that's already in EUR (e.g. Order.chargedAmount) — no CZK conversion. */
export function formatEurAmount(value: Prisma.Decimal | number): string {
  return eur.format(Number(value));
}

/** For server components that read the currency cookie directly (see currency-cookie.ts) instead of useCurrency(). */
export function formatPriceIn(
  valueCzk: Prisma.Decimal | number,
  currency: Currency,
  rate: Prisma.Decimal | number,
): string {
  return currency === "EUR" ? formatEur(valueCzk, rate) : formatPrice(valueCzk);
}
