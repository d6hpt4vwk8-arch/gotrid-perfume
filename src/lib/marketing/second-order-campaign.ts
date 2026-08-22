import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { sendSecondOrderEmail } from "@/lib/email/send-second-order-email";
import { recommendProductsForCustomer } from "./recommend-products";

const COUNTABLE_STATUSES = ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

function randomSuffix(): string {
  // Excludes visually ambiguous chars (0/O, 1/I) since this gets typed at checkout.
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Creates a single-use coupon just for this email — can't be reused or shared for repeat discounts. */
async function createOneTimeCoupon(prefix: string, percent: number): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${prefix}${randomSuffix()}`;
    try {
      await prisma.coupon.create({
        data: { code, type: "PERCENT", value: percent, active: true, usageLimit: 1 },
      });
      return code;
    } catch {
      // Unique constraint collision (astronomically unlikely) — retry with a new suffix.
    }
  }
  throw new Error("Nepodařilo se vygenerovat unikátní slevový kód.");
}

interface SecondOrderCandidate {
  id: string;
  email: string;
  firstName: string;
  customerId: string | null;
}

async function getSecondOrderCandidates(): Promise<{
  candidates: SecondOrderCandidate[];
  settings: { secondOrderDiscountPercent: number; secondOrderCouponPrefix: string };
}> {
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const cutoff = new Date(Date.now() - settings.secondOrderDelayDays * 24 * 60 * 60 * 1000);

  // Registered + opted-in only — guests and non-consenting customers are
  // never candidates in the first place.
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
      where: { customerId: candidate.customerId, status: { in: [...COUNTABLE_STATUSES] } },
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

    const couponCode = await createOneTimeCoupon(
      settings.secondOrderCouponPrefix,
      settings.secondOrderDiscountPercent,
    );
    const { theme, products } = await recommendProductsForCustomer(candidate.customerId!);
    await sendSecondOrderEmail({
      email: candidate.email,
      firstName: candidate.firstName,
      couponCode,
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
