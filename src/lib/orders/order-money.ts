import type { Prisma } from "@prisma/client";
import { formatEurAmount, formatPrice } from "@/lib/format";

type MoneyOrder = {
  total: Prisma.Decimal | number;
  chargedCurrency: string | null;
  chargedAmount: Prisma.Decimal | number | null;
};

/**
 * Every Order amount is stored in CZK, but a Slovak order is charged in euros
 * and snapshots the EUR total (chargedAmount) at order time. This returns a
 * formatter that shows any CZK amount of that order in the currency the
 * customer actually pays in — the EUR snapshot ratio keeps the lines
 * consistent with the total they were shown at checkout, and unaffected by a
 * later change of Settings.czkToEurRate.
 */
export function orderMoney(order: MoneyOrder): (czk: Prisma.Decimal | number) => string {
  const total = Number(order.total);
  if (order.chargedCurrency === "EUR" && order.chargedAmount && total > 0) {
    const ratio = Number(order.chargedAmount) / total;
    return (czk) => formatEurAmount(Number(czk) * ratio);
  }
  return (czk) => formatPrice(czk);
}

export function orderIsEur(order: Pick<MoneyOrder, "chargedCurrency" | "chargedAmount">): boolean {
  return order.chargedCurrency === "EUR" && Boolean(order.chargedAmount);
}
