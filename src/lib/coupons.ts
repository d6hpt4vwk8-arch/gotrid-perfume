import type { Coupon } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CheckoutError } from "@/lib/orders/checkout-error";

type TxClient = PrismaClient | Prisma.TransactionClient;

function computeDiscount(coupon: Coupon, itemsTotal: number): number {
  // GIFT coupons carry no discount — applying one unlocks the free-gift
  // picker instead (see grantsGift below).
  if (coupon.type === "GIFT") return 0;
  const raw =
    coupon.type === "PERCENT" ? (itemsTotal * Number(coupon.value)) / 100 : Number(coupon.value);
  return Math.min(Math.max(raw, 0), itemsTotal);
}

const SECOND_ORDER_COUNTABLE = ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
const SECOND_ORDER_HELP =
  "Tento kód je určen zákazníkům, kterým jsme ho poslali e-mailem. Pokud vám nefunguje, napište nám na info@gotridperfume.cz a kód vám aktivujeme.";

/**
 * The shared second-order code only works for an e-mail that (a) received the
 * campaign mail within Settings.secondOrderValidDays — or was activated by
 * hand via Coupon.allowedEmails — and (b) hasn't redeemed it yet. A visitor
 * with no order history therefore can't use it, whatever they type.
 */
async function assertSecondOrderEligible(client: TxClient, coupon: Coupon, email: string | undefined) {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) {
    throw new CheckoutError("Pro uplatnění tohoto kódu zadejte e-mail, na který jsme ho poslali.");
  }

  const manuallyAllowed = coupon.allowedEmails.some((e) => e.trim().toLowerCase() === normalized);
  if (!manuallyAllowed) {
    const settings = await client.settings.findUnique({ where: { id: "singleton" } });
    const validDays = settings?.secondOrderValidDays ?? 14;
    const since = new Date(Date.now() - validDays * 24 * 60 * 60 * 1000);
    const campaignOrder = await client.order.findFirst({
      where: {
        email: { equals: normalized, mode: "insensitive" },
        status: { in: [...SECOND_ORDER_COUNTABLE] },
        secondOrderEmailSentAt: { gte: since },
      },
      select: { id: true },
    });
    if (!campaignOrder) throw new CheckoutError(SECOND_ORDER_HELP);
  }

  const alreadyUsed = await client.order.count({
    where: {
      email: { equals: normalized, mode: "insensitive" },
      couponCode: coupon.code,
      status: { not: "CANCELLED" },
    },
  });
  if (alreadyUsed > 0) throw new CheckoutError("Tento kód už jste jednou využili.");
}

async function loadValidCoupon(
  client: TxClient,
  code: string,
  itemsTotal: number,
  email?: string,
): Promise<Coupon> {
  const coupon = await client.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!coupon || !coupon.active) {
    throw new CheckoutError("Slevový kód neexistuje nebo již není platný.");
  }
  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new CheckoutError("Platnost slevového kódu vypršela.");
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new CheckoutError("Slevový kód už byl vyčerpán.");
  }
  if (coupon.minOrderValue && itemsTotal < Number(coupon.minOrderValue)) {
    throw new CheckoutError(
      `Slevový kód platí od objednávky ${Number(coupon.minOrderValue).toLocaleString("cs-CZ")} Kč.`,
    );
  }
  // The cart-side preview has no e-mail yet (see /api/coupons/validate) — the
  // per-e-mail check always runs for real in validateCoupon at order time.
  if (coupon.secondOrderOnly && email !== undefined) {
    await assertSecondOrderEligible(client, coupon, email);
  }
  return coupon;
}

export async function previewCoupon(
  code: string,
  itemsTotal: number,
  email?: string,
): Promise<{ code: string; discountAmount: number; grantsGift: boolean }> {
  const coupon = await loadValidCoupon(prisma, code, itemsTotal, email);
  return {
    code: coupon.code,
    discountAmount: computeDiscount(coupon, itemsTotal),
    grantsGift: coupon.type === "GIFT",
  };
}

export async function validateCoupon(
  tx: TxClient,
  code: string,
  itemsTotal: number,
  email: string,
): Promise<{ code: string; discountAmount: number; grantsGift: boolean }> {
  const coupon = await loadValidCoupon(tx, code, itemsTotal, email);
  const discountAmount = computeDiscount(coupon, itemsTotal);

  const updated = await tx.coupon.updateMany({
    where: {
      id: coupon.id,
      ...(coupon.usageLimit !== null ? { usedCount: { lt: coupon.usageLimit } } : {}),
    },
    data: { usedCount: { increment: 1 } },
  });
  if (updated.count === 0) {
    throw new CheckoutError("Slevový kód už byl vyčerpán.");
  }

  return { code: coupon.code, discountAmount, grantsGift: coupon.type === "GIFT" };
}
