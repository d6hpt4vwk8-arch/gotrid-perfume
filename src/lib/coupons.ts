import type { Coupon } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CheckoutError } from "@/lib/orders/checkout-error";

type TxClient = PrismaClient | Prisma.TransactionClient;

function computeDiscount(coupon: Coupon, itemsTotal: number): number {
  const raw =
    coupon.type === "PERCENT" ? (itemsTotal * Number(coupon.value)) / 100 : Number(coupon.value);
  return Math.min(Math.max(raw, 0), itemsTotal);
}

async function loadValidCoupon(
  client: TxClient,
  code: string,
  itemsTotal: number,
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
  return coupon;
}

export async function previewCoupon(
  code: string,
  itemsTotal: number,
): Promise<{ code: string; discountAmount: number }> {
  const coupon = await loadValidCoupon(prisma, code, itemsTotal);
  return { code: coupon.code, discountAmount: computeDiscount(coupon, itemsTotal) };
}

export async function validateCoupon(
  tx: TxClient,
  code: string,
  itemsTotal: number,
): Promise<{ code: string; discountAmount: number }> {
  const coupon = await loadValidCoupon(tx, code, itemsTotal);
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

  return { code: coupon.code, discountAmount };
}
