import type { Prisma } from "@prisma/client";

const czk = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

export function formatPrice(value: Prisma.Decimal | number): string {
  return czk.format(Number(value));
}
