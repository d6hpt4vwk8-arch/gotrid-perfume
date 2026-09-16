import type { Prisma } from "@prisma/client";

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
