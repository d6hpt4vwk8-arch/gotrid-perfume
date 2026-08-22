import { prisma } from "@/lib/prisma";
import { sendSecondOrderEmail } from "@/lib/email/send-second-order-email";
import { recommendProductsForCustomer } from "./recommend-products";

const COUNTABLE_STATUSES = ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

async function ensureCoupon(code: string): Promise<void> {
  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) return;
  // Sane default so the campaign works out of the box — tune value/limits
  // any time from the normal Slevové kódy admin page.
  await prisma.coupon.create({
    data: { code, type: "PERCENT", value: 10, active: true },
  });
}

export async function runSecondOrderCampaign(): Promise<{ emailed: number; skipped: number }> {
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const cutoff = new Date(Date.now() - settings.secondOrderDelayDays * 24 * 60 * 60 * 1000);

  // Registered + opted-in only — guests and non-consenting customers are
  // never candidates in the first place (no post-hoc suppression needed).
  const candidates = await prisma.order.findMany({
    where: {
      secondOrderEmailSentAt: null,
      createdAt: { lte: cutoff },
      status: { in: [...COUNTABLE_STATUSES] },
      customerId: { not: null },
      customer: { marketingOptIn: true },
    },
    select: { id: true, email: true, firstName: true, customerId: true },
  });
  if (candidates.length === 0) return { emailed: 0, skipped: 0 };

  let emailed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const orderCount = await prisma.order.count({
      where: { customerId: candidate.customerId, status: { in: [...COUNTABLE_STATUSES] } },
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

    await ensureCoupon(settings.secondOrderCouponCode);
    const { theme, products } = await recommendProductsForCustomer(candidate.customerId!);
    await sendSecondOrderEmail({
      email: candidate.email,
      firstName: candidate.firstName,
      couponCode: settings.secondOrderCouponCode,
      theme,
      products,
    });
    await prisma.order.update({
      where: { id: candidate.id },
      data: { secondOrderEmailSentAt: new Date() },
    });
    emailed++;
  }

  return { emailed, skipped };
}
