import { randomInt } from "node:crypto";
import type { Coupon, LoyaltyReward, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getLoyaltyBalance } from "@/lib/loyalty";
import { CheckoutError } from "@/lib/orders/checkout-error";

/** Prefix of every personal coupon bought with points — also how the admin spots them in the coupon list. */
export const REWARD_COUPON_PREFIX = "BODY-";

// No 0/O/1/I — the code is read off a screen and typed at checkout.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return REWARD_COUPON_PREFIX + out;
}

export async function listActiveRewards(): Promise<LoyaltyReward[]> {
  return prisma.loyaltyReward.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { pointsCost: "asc" }],
  });
}

/** Balance plus the date it lapses (last ledger activity + Settings.loyaltyExpiryMonths) — null with no points. */
export async function getLoyaltySummary(email: string): Promise<{ balance: number; expiresAt: Date | null; expiryMonths: number }> {
  const settings = await prisma.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
  const normalized = email.trim().toLowerCase();
  const balance = await getLoyaltyBalance(prisma, normalized);
  let expiresAt: Date | null = null;
  if (balance > 0) {
    const last = await prisma.loyaltyTransaction.aggregate({ where: { email: normalized }, _max: { createdAt: true } });
    if (last._max.createdAt) {
      expiresAt = new Date(last._max.createdAt);
      expiresAt.setMonth(expiresAt.getMonth() + settings.loyaltyExpiryMonths);
    }
  }
  return { balance, expiresAt, expiryMonths: settings.loyaltyExpiryMonths };
}

/** The customer's personal reward coupons that can still be used. */
export async function listPersonalCoupons(email: string): Promise<Coupon[]> {
  return prisma.coupon.findMany({
    where: {
      ownerEmail: email.trim().toLowerCase(),
      active: true,
      usedCount: 0,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { expiresAt: "asc" },
  });
}

/**
 * Spends points on a reward: one REDEEM ledger row plus a personal single-use Coupon, in one transaction so
 * the points can't be taken without the coupon (or the other way round).
 */
export async function redeemReward(email: string, rewardId: string): Promise<Coupon> {
  const normalized = email.trim().toLowerCase();
  const reward = await prisma.loyaltyReward.findUnique({ where: { id: rewardId } });
  if (!reward || !reward.active) throw new CheckoutError("Tato odměna už není k dispozici.");

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const balance = await getLoyaltyBalance(tx, normalized);
        if (balance < reward.pointsCost) throw new CheckoutError("Na tuto odměnu nemáte dost bodů.");
        const coupon = await tx.coupon.create({
          data: {
            code: randomCode(),
            type: reward.type,
            value: reward.value,
            minOrderValue: reward.minOrderValue,
            usageLimit: 1,
            expiresAt: new Date(Date.now() + reward.validDays * 24 * 60 * 60 * 1000),
            ownerEmail: normalized,
            giftProductId: reward.type === "GIFT" ? reward.giftProductId : null,
          },
        });
        await tx.loyaltyTransaction.create({
          data: { email: normalized, type: "REDEEM", points: -reward.pointsCost, note: `Odměna: ${reward.name} (${coupon.code})` },
        });
        return coupon;
      });
    } catch (err) {
      // Unique clash on the random code — try another one.
      if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") continue;
      throw err;
    }
  }
  throw new CheckoutError("Odměnu se nepodařilo vytvořit, zkuste to prosím znovu.");
}
