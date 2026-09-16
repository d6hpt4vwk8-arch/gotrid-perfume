import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { sendAbandonedCheckoutEmail } from "@/lib/email/send-abandoned-checkout-email";
import type { CartItem } from "@/lib/cart-context";

// Safety margin before we consider a captured checkout "abandoned" rather
// than someone still mid-flow — this cron only runs once a day (see
// src/app/api/cron/daily-tasks/route.ts), so in practice the reminder goes
// out anywhere from a couple of hours to ~1 day after the real abandonment.
const CUTOFF_HOURS = 2;

// A reminder about a cart from two weeks ago reads as broken, not helpful
// (owner's explicit call, 2026-09-17, after a stuck test row let a two-week
// backlog of 74 real carts pile up unsent — see the try/catch note below).
// Anything captured before this window is simply never emailed and stays
// "čeká" in /admin/email-marketing — it's not deleted, just not acted on.
const MAX_AGE_HOURS = 72;

export async function runAbandonedCheckoutRecovery(): Promise<{
  emailed: number;
  recovered: number;
  failed: number;
}> {
  const cutoff = new Date(Date.now() - CUTOFF_HOURS * 60 * 60 * 1000);
  const maxAge = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);

  const candidates = await prisma.abandonedCheckout.findMany({
    where: { emailSentAt: null, capturedAt: { lte: cutoff, gte: maxAge } },
  });

  let emailed = 0;
  let recovered = 0;
  let failed = 0;

  // One candidate's send failing (bad address, Resend outage, ...) must
  // never block every candidate behind it — this loop ran unattended for two
  // weeks (2026-09-02 to 2026-09-16) because a single stale test row with an
  // undeliverable @example.com address threw here and aborted the whole
  // batch every day, silently blocking real customers' reminders too. Mirrors
  // the try/catch-and-continue pattern in sync-packeta-delivery.ts.
  for (const candidate of candidates) {
    try {
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
    } catch (err) {
      console.error(`[abandoned-checkout] failed for ${candidate.email}`, err);
      await logAdminActivity({
        action: "marketing.abandoned_checkout_email_failed",
        entityType: "AbandonedCheckout",
        entityId: candidate.id,
        detail: `${candidate.email}: odeslání selhalo — ${err instanceof Error ? err.message : String(err)}`,
      });
      failed++;
    }
  }

  return { emailed, recovered, failed };
}
