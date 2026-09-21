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

// More than this many real cancellations and cash-on-delivery stops being
// offered to that e-mail at checkout (see create-order.ts) — the icon-only
// 😠 flag above is admin-facing only and blocks nothing on its own.
const COD_CANCELLED_ORDER_LIMIT = 2;

/**
 * Whether `email` has cancelled more than COD_CANCELLED_ORDER_LIMIT orders
 * and should no longer be offered cash-on-delivery. A CARD order that
 * auto-cancelled because the customer simply never finished paying (see the
 * 2-hour auto-cancel note on the admin order page) says nothing about
 * whether they show up for a courier — same exclusion reasoning as
 * findAlreadyOrderedFlags in abandoned-checkout.ts — so only cancellations
 * on payment methods the customer had actually committed to count here.
 */
export async function hasTooManyCancelledOrders(email: string): Promise<boolean> {
  const count = await prisma.order.count({
    where: {
      email: { equals: email, mode: "insensitive" },
      status: "CANCELLED",
      NOT: { paymentMethod: "CARD" },
    },
  });
  return count > COD_CANCELLED_ORDER_LIMIT;
}
