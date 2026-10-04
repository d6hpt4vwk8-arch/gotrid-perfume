import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { sendSecondOrderEmail } from "@/lib/email/send-second-order-email";
import { recommendProductsForBuyer } from "./recommend-products";

const COUNTABLE_STATUSES = ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/**
 * The one shared second-order code ("DRUHY5"): created on first use and kept in
 * sync with the configured percent. It carries no per-customer state — who may
 * use it, and until when, is decided at checkout (secondOrderOnly, see
 * src/lib/coupons.ts), so the coupon list in the admin stays a single row.
 */
async function ensureSecondOrderCoupon(prefix: string, percent: number): Promise<string> {
  const code = `${prefix}${percent}`;
  await prisma.coupon.upsert({
    where: { code },
    update: { type: "PERCENT", value: percent, active: true, secondOrderOnly: true },
    create: { code, type: "PERCENT", value: percent, active: true, secondOrderOnly: true },
  });
  return code;
}

/**
 * Deletes the per-customer one-off coupons from the old scheme (prefix + 6
 * random chars) once they've expired unused — keeps the admin list from
 * piling up. Never touches the shared code or anything created by hand.
 */
export async function cleanupExpiredSecondOrderCoupons(): Promise<number> {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  const prefix = settings?.secondOrderCouponPrefix ?? "DRUHY";
  const pattern = new RegExp(`^${prefix}[2-9A-HJ-NP-Z]{6}$`);
  const stale = await prisma.coupon.findMany({
    where: {
      expiresAt: { lt: new Date() },
      usedCount: 0,
      usageLimit: 1,
      secondOrderOnly: false,
      code: { startsWith: prefix },
    },
    select: { id: true, code: true },
  });
  const ids = stale.filter((c) => pattern.test(c.code)).map((c) => c.id);
  if (ids.length === 0) return 0;
  const { count } = await prisma.coupon.deleteMany({ where: { id: { in: ids } } });
  return count;
}

interface SecondOrderCandidate {
  id: string;
  email: string;
  firstName: string;
}

async function getSecondOrderCandidates(): Promise<{
  candidates: SecondOrderCandidate[];
  settings: { secondOrderDiscountPercent: number; secondOrderCouponPrefix: string; secondOrderValidDays: number };
}> {
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const cutoff = new Date(Date.now() - settings.secondOrderDelayDays * 24 * 60 * 60 * 1000);

  // Every past buyer is a candidate, guests included — an order's email is
  // itself an "existing customer, similar goods" relationship under zákona
  // č. 480/2004 Sb. §7/3 (see NewsletterUnsubscribe's comment in
  // schema.prisma), so no separate opt-in is required, only a working
  // opt-out. customerId/Customer.marketingOptIn used to gate this, which
  // meant guests — 108 of 111 real orders — could never qualify no matter
  // what they bought or how many times (owner's call, 2026-09-18: reach
  // everyone, respect unsubscribes).
  const orders = await prisma.order.findMany({
    where: {
      secondOrderEmailSentAt: null,
      createdAt: { lte: cutoff },
      status: { in: [...COUNTABLE_STATUSES] },
    },
    select: { id: true, email: true, firstName: true },
  });

  const unsubscribed = await prisma.newsletterUnsubscribe.findMany({ select: { email: true } });
  const unsubscribedEmails = new Set(unsubscribed.map((u) => u.email.toLowerCase()));
  const candidates = orders.filter((o) => !unsubscribedEmails.has(o.email.trim().toLowerCase()));

  return { candidates, settings };
}

/** Who the next cron run would actually email, without sending anything — for the admin preview. */
export async function previewSecondOrderCandidates(): Promise<
  { email: string; firstName: string; orderId: string }[]
> {
  const { candidates } = await getSecondOrderCandidates();
  const result: { email: string; firstName: string; orderId: string }[] = [];
  for (const candidate of candidates) {
    const orderCount = await prisma.order.count({
      where: {
        email: { equals: candidate.email, mode: "insensitive" },
        status: { in: [...COUNTABLE_STATUSES] },
      },
    });
    if (orderCount === 1) {
      result.push({ email: candidate.email, firstName: candidate.firstName, orderId: candidate.id });
    }
  }
  return result;
}

export async function runSecondOrderCampaign(): Promise<{ emailed: number; skipped: number }> {
  const { candidates, settings } = await getSecondOrderCandidates();
  if (candidates.length === 0) return { emailed: 0, skipped: 0 };

  let emailed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const orderCount = await prisma.order.count({
      where: {
        email: { equals: candidate.email, mode: "insensitive" },
        status: { in: [...COUNTABLE_STATUSES] },
      },
    });

    if (orderCount > 1) {
      // Already reordered — resolved, stop rechecking.
      await prisma.order.update({
        where: { id: candidate.id },
        data: { secondOrderEmailSentAt: new Date() },
      });
      skipped++;
      continue;
    }

    const couponCode = await ensureSecondOrderCoupon(
      settings.secondOrderCouponPrefix,
      settings.secondOrderDiscountPercent,
    );
    const validUntil = new Date(Date.now() + settings.secondOrderValidDays * 24 * 60 * 60 * 1000);
    const { theme, products } = await recommendProductsForBuyer(candidate.email);
    await sendSecondOrderEmail({
      email: candidate.email,
      firstName: candidate.firstName,
      couponCode,
      discountPercent: settings.secondOrderDiscountPercent,
      validUntil,
      theme,
      products,
    });
    await prisma.order.update({
      where: { id: candidate.id },
      data: { secondOrderEmailSentAt: new Date() },
    });
    await logAdminActivity({
      action: "marketing.second_order_email",
      entityType: "Order",
      entityId: candidate.id,
      detail: `${candidate.email}: odesláno s kódem ${couponCode} (${settings.secondOrderDiscountPercent} %, motiv: ${theme})`,
    });
    emailed++;
  }

  return { emailed, skipped };
}
