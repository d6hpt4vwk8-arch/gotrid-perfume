import { prisma } from "@/lib/prisma";
import type { ShippingMethod } from "@prisma/client";

export interface ReturnStatsRow {
  method: ShippingMethod;
  delivered: number;
  returned: number;
  /** returned / (delivered + returned), 0 when there's nothing resolved yet. */
  ratePercent: number;
}

/**
 * How often a resolved order (DELIVERED or REFUNDED — REFUNDED doubles here
 * as "returned by the carrier, nobody picked it up", see
 * sync-packeta-delivery.ts / sync-gls-delivery.ts) ends up returned instead
 * of delivered, broken down by shipping method. All-time rather than a
 * rolling window — order volume is still low enough that a 30/90-day cut
 * would mostly just show small-sample noise.
 */
export async function getReturnStatsByMethod(): Promise<ReturnStatsRow[]> {
  const rows = await prisma.order.groupBy({
    by: ["shippingMethod", "status"],
    where: { status: { in: ["DELIVERED", "REFUNDED"] } },
    _count: { _all: true },
  });

  const byMethod = new Map<ShippingMethod, { delivered: number; returned: number }>();
  for (const row of rows) {
    const entry = byMethod.get(row.shippingMethod) ?? { delivered: 0, returned: 0 };
    if (row.status === "DELIVERED") entry.delivered += row._count._all;
    else entry.returned += row._count._all;
    byMethod.set(row.shippingMethod, entry);
  }

  return [...byMethod.entries()]
    .map(([method, { delivered, returned }]) => ({
      method,
      delivered,
      returned,
      ratePercent: delivered + returned > 0 ? (returned / (delivered + returned)) * 100 : 0,
    }))
    .sort((a, b) => b.returned + b.delivered - (a.returned + a.delivered));
}
