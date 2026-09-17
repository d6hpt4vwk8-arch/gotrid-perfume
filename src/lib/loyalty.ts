import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CheckoutError } from "@/lib/orders/checkout-error";
import type { ShopSettings } from "@/lib/settings.server";

type TxClient = PrismaClient | Prisma.TransactionClient;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Always SUM(points) over the ledger — never a cached counter, so it can't drift out of sync with its own history. */
export async function getLoyaltyBalance(client: TxClient, email: string): Promise<number> {
  const result = await client.loyaltyTransaction.aggregate({
    where: { email: normalizeEmail(email) },
    _sum: { points: true },
  });
  return result._sum.points ?? 0;
}

/** How many points this order could redeem, given the current balance and Settings' guardrails. */
export function computeMaxRedeemable(
  balance: number,
  itemsTotal: number,
  settings: Pick<ShopSettings, "loyaltyRedeemCapPercent" | "loyaltyMinOrderValue">,
): number {
  if (itemsTotal < settings.loyaltyMinOrderValue) return 0;
  const capAmount = Math.floor((itemsTotal * settings.loyaltyRedeemCapPercent) / 100);
  return Math.max(0, Math.min(balance, capAmount));
}

/** For the checkout UI — read-only, no redemption. */
export async function previewLoyalty(
  email: string,
  itemsTotal: number,
  settings: Pick<ShopSettings, "loyaltyRedeemCapPercent" | "loyaltyMinOrderValue">,
): Promise<{ balance: number; maxRedeemable: number }> {
  const balance = await getLoyaltyBalance(prisma, email);
  return { balance, maxRedeemable: computeMaxRedeemable(balance, itemsTotal, settings) };
}

/**
 * Re-validates and spends points inside the order-creation transaction —
 * never trusts the client-submitted amount, mirrors validateCoupon's
 * pattern in coupons.ts. Returns the discount (1 point = 1 Kč) to fold into
 * the order total.
 */
export async function redeemPoints(
  tx: TxClient,
  email: string,
  pointsToRedeem: number,
  itemsTotal: number,
  settings: Pick<ShopSettings, "loyaltyRedeemCapPercent" | "loyaltyMinOrderValue">,
): Promise<number> {
  if (pointsToRedeem <= 0) return 0;
  const balance = await getLoyaltyBalance(tx, email);
  const maxRedeemable = computeMaxRedeemable(balance, itemsTotal, settings);
  if (pointsToRedeem > maxRedeemable) {
    throw new CheckoutError("Počet bodů k uplatnění už neodpovídá vašemu zůstatku nebo limitu.");
  }
  return pointsToRedeem;
}

/**
 * Called once an order becomes a real sale — same two trigger points as
 * sendHeurekaOrderLog (updateOrderStatus leaving NEW for COD/bank transfer,
 * the Stripe webhook's checkout.session.completed for CARD). Idempotent
 * (checked by orderId) so a retried webhook delivery can't double-award.
 * Earns only on cash actually collected for goods — never on
 * shipping/COD surcharge, and never on the points-funded or coupon-funded
 * portion of the order, so points can't compound on themselves.
 */
export async function awardPointsForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  const existing = await prisma.loyaltyTransaction.findFirst({
    where: { orderId, type: "EARN" },
  });
  if (existing) return;

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const cashForGoods = Math.max(
    0,
    Number(order.itemsTotal) - Number(order.discountAmount) - order.pointsRedeemed,
  );
  const points = Math.floor((cashForGoods * settings.loyaltyEarnPercent) / 100);
  if (points <= 0) return;

  await prisma.$transaction([
    prisma.loyaltyTransaction.create({
      data: {
        email: normalizeEmail(order.email),
        orderId,
        type: "EARN",
        points,
        note: `Objednávka ${order.number}`,
      },
    }),
    prisma.order.update({ where: { id: orderId }, data: { pointsEarned: points } }),
  ]);
}

/**
 * Daily sweep (see src/app/api/cron/daily-tasks/route.ts) — zeroes out the
 * balance for any email whose most recent ledger activity is older than
 * Settings.loyaltyExpiryMonths, so an unbounded balance doesn't accumulate
 * from customers who never come back. Writes one EXPIRE entry per email
 * rather than silently deleting history.
 */
export async function expireInactiveLoyaltyPoints(): Promise<{ expired: number }> {
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - settings.loyaltyExpiryMonths);

  const emails = await prisma.loyaltyTransaction.groupBy({
    by: ["email"],
    _max: { createdAt: true },
  });

  let expired = 0;
  for (const { email } of emails) {
    const lastActivity = emails.find((e) => e.email === email)?._max.createdAt;
    if (!lastActivity || lastActivity > cutoff) continue;

    const balance = await getLoyaltyBalance(prisma, email);
    if (balance <= 0) continue;

    await prisma.loyaltyTransaction.create({
      data: {
        email,
        type: "EXPIRE",
        points: -balance,
        note: `Bodů vypršelo po ${settings.loyaltyExpiryMonths} měsících neaktivity`,
      },
    });
    expired++;
  }

  return { expired };
}
