import type { Coupon } from "@prisma/client";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CheckoutError } from "@/lib/orders/checkout-error";
import { REVIEW_COUPON_CODE } from "@/lib/email/send-review-request-email";

type TxClient = PrismaClient | Prisma.TransactionClient;

// Brand-scoped personal coupons are recognised by their code prefix (no schema change): NAMA-xxxxxx gives its
// percentage only on Nama Fiji goods (owner, 2026-11-14: 10 % on the whole Nama Fiji range for 14 days, sent to people
// who received the free Discovery Box).
export const BRAND_COUPON_PREFIXES: Record<string, { slug: string; label: string }> = {
  "NAMA-": { slug: "nama-fiji", label: "Nama Fiji" },
};

export function couponBrandScope(code: string): { slug: string; label: string } | null {
  const upper = code.trim().toUpperCase();
  for (const [prefix, scope] of Object.entries(BRAND_COUPON_PREFIXES)) if (upper.startsWith(prefix)) return scope;
  return null;
}

export interface CouponCartItem {
  productId: string;
  qty: number;
}

/** Sum of the cart lines that belong to the brand (prices read from the DB, never trusted from the client). */
async function brandEligibleTotal(client: TxClient, items: CouponCartItem[] | undefined, brandSlug: string): Promise<number> {
  if (!items?.length) return 0;
  const rows = await client.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, brand: { slug: brandSlug } },
    select: { id: true, price: true },
  });
  const price = new Map(rows.map((r) => [r.id, Number(r.price)]));
  return items.reduce((sum, i) => sum + (price.get(i.productId) ?? 0) * i.qty, 0);
}

function computeDiscount(coupon: Coupon, itemsTotal: number, eligibleTotal?: number): number {
  if (eligibleTotal !== undefined) itemsTotal = eligibleTotal;
  // GIFT and FREE_SHIPPING coupons carry no discount — a gift one unlocks the free-gift picker
  // (see grantsGift below), a free-shipping one zeroes the shipping price (freeShipping).
  if (coupon.type === "GIFT" || coupon.type === "FREE_SHIPPING") return 0;
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
    // The review-request code (RECENZE30) follows the same rule, keyed on
    // when the review-request mail went out. The second-order campaign was
    // switched off 2026-10-18 (0 coupon uses in 207 mails), so that mail is
    // now the only one that hands out a personal, time-limited code.
    const campaignOrder = await client.order.findFirst({
      where: {
        email: { equals: normalized, mode: "insensitive" },
        status: { in: [...SECOND_ORDER_COUNTABLE] },
        OR: [{ secondOrderEmailSentAt: { gte: since } }, { reviewRequestSentAt: { gte: since } }],
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

export interface CouponResult {
  code: string;
  discountAmount: number;
  grantsGift: boolean;
  freeShipping: boolean;
  /** Set when the gift coupon is for one specific product rather than the generic gift list. */
  giftProductId: string | null;
}

function toResult(coupon: Coupon, discountAmount: number): CouponResult {
  return {
    code: coupon.code,
    discountAmount,
    grantsGift: coupon.type === "GIFT",
    freeShipping: coupon.type === "FREE_SHIPPING",
    giftProductId: coupon.type === "GIFT" ? coupon.giftProductId : null,
  };
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
  // A personal (loyalty reward) coupon only works for its owner. The cart-side preview has no e-mail, so
  // it is checked for real at order time (validateCoupon) — a stranger typing someone's code is stopped there.
  if (coupon.ownerEmail && email !== undefined && coupon.ownerEmail !== email.trim().toLowerCase()) {
    throw new CheckoutError("Tento kód patří jinému zákazníkovi.");
  }
  // The cart-side preview has no e-mail yet (see /api/coupons/validate) — the
  // per-e-mail check always runs for real in validateCoupon at order time.
  if ((coupon.secondOrderOnly || coupon.code === REVIEW_COUPON_CODE) && email !== undefined) {
    await assertSecondOrderEligible(client, coupon, email);
  }
  return coupon;
}

async function scopedEligibleTotal(client: TxClient, coupon: Coupon, items?: CouponCartItem[]): Promise<number | undefined> {
  const scope = couponBrandScope(coupon.code);
  if (!scope) return undefined;
  const eligible = await brandEligibleTotal(client, items, scope.slug);
  if (eligible <= 0) {
    throw new CheckoutError(`Tento kód platí jen na produkty značky ${scope.label} — přidejte je do košíku.`);
  }
  return eligible;
}

export async function previewCoupon(code: string, itemsTotal: number, email?: string, items?: CouponCartItem[]): Promise<CouponResult> {
  const coupon = await loadValidCoupon(prisma, code, itemsTotal, email);
  const eligible = await scopedEligibleTotal(prisma, coupon, items);
  return toResult(coupon, computeDiscount(coupon, itemsTotal, eligible));
}

export async function validateCoupon(
  tx: TxClient,
  code: string,
  itemsTotal: number,
  email: string,
  items?: CouponCartItem[],
): Promise<CouponResult> {
  const coupon = await loadValidCoupon(tx, code, itemsTotal, email);
  const eligible = await scopedEligibleTotal(tx, coupon, items);
  const discountAmount = computeDiscount(coupon, itemsTotal, eligible);

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

  return toResult(coupon, discountAmount);
}
