import { prisma } from "@/lib/prisma";

const CANCELLED_LIKE = ["CANCELLED", "REFUNDED"] as const;

export interface CustomerReputation {
  /** 2+ non-cancelled orders — a repeat customer worth extra care. */
  repeat: boolean;
  /** 1+ cancelled/refunded order — worth double-checking before packing. */
  risk: boolean;
}

/** Batched per-email lookup so an order-list page doesn't do it per row. */
export async function getCustomerReputationMap(
  emails: string[],
): Promise<Map<string, CustomerReputation>> {
  const uniqueEmails = [...new Set(emails)];
  if (uniqueEmails.length === 0) return new Map();

  const [goodCounts, riskCounts] = await Promise.all([
    prisma.order.groupBy({
      by: ["email"],
      where: { email: { in: uniqueEmails }, status: { notIn: [...CANCELLED_LIKE] } },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["email"],
      where: { email: { in: uniqueEmails }, status: { in: [...CANCELLED_LIKE] } },
      _count: { _all: true },
    }),
  ]);

  const goodMap = new Map(goodCounts.map((g) => [g.email, g._count._all]));
  const riskMap = new Map(riskCounts.map((r) => [r.email, r._count._all]));

  const result = new Map<string, CustomerReputation>();
  for (const email of uniqueEmails) {
    result.set(email, {
      repeat: (goodMap.get(email) ?? 0) >= 2,
      risk: (riskMap.get(email) ?? 0) >= 1,
    });
  }
  return result;
}
