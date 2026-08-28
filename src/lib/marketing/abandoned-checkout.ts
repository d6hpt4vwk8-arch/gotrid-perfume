import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { sendAbandonedCheckoutEmail } from "@/lib/email/send-abandoned-checkout-email";
import type { CartItem } from "@/lib/cart-context";

// Safety margin before we consider a captured checkout "abandoned" rather
// than someone still mid-flow — this cron only runs once a day (see
// src/app/api/cron/daily-tasks/route.ts), so in practice the reminder goes
// out anywhere from a couple of hours to ~1 day after the real abandonment.
const CUTOFF_HOURS = 2;

export async function runAbandonedCheckoutRecovery(): Promise<{ emailed: number; recovered: number }> {
  const cutoff = new Date(Date.now() - CUTOFF_HOURS * 60 * 60 * 1000);

  const candidates = await prisma.abandonedCheckout.findMany({
    where: { emailSentAt: null, capturedAt: { lte: cutoff } },
  });

  let emailed = 0;
  let recovered = 0;

  for (const candidate of candidates) {
    const completedOrder = await prisma.order.findFirst({
      where: { email: candidate.email, createdAt: { gte: candidate.capturedAt } },
      select: { id: true },
    });

    if (completedOrder) {
      await prisma.abandonedCheckout.update({
        where: { id: candidate.id },
        data: { recoveredAt: new Date() },
      });
      recovered++;
      continue;
    }

    await sendAbandonedCheckoutEmail({
      email: candidate.email,
      firstName: candidate.firstName ?? "",
      cartSnapshot: candidate.cartSnapshot as unknown as CartItem[],
    });
    await prisma.abandonedCheckout.update({
      where: { id: candidate.id },
      data: { emailSentAt: new Date() },
    });
    await logAdminActivity({
      action: "marketing.abandoned_checkout_email",
      entityType: "AbandonedCheckout",
      entityId: candidate.id,
      detail: `${candidate.email}: odesláno připomenutí nedokončené objednávky`,
    });
    emailed++;
  }

  return { emailed, recovered };
}
