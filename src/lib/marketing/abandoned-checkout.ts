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

// The checkout form's own capture can fire within a second of the real
// order being created (see the pagehide/sendBeacon fallback in
// checkout-form.tsx — a successful order still navigates away, which still
// fires pagehide) — a real order confirmed 2026-09-11T15:44:19.890Z had its
// abandoned-cart snapshot captured 2026-09-11T15:44:20.505Z, 0.6s *later*,
// so `order.createdAt >= capturedAt` never matched and the customer got a
// "did you forget your order?" email for an order she'd already completed
// and received. This buffer treats any order placed shortly before the
// capture as the same completed checkout, not a coincidence.
const ALREADY_ORDERED_BUFFER_MS = 10 * 60 * 1000;

export async function runAbandonedCheckoutRecovery(): Promise<{
  emailed: number;
  recovered: number;
  skippedOutOfStock: number;
  failed: number;
}> {
  const cutoff = new Date(Date.now() - CUTOFF_HOURS * 60 * 60 * 1000);
  const maxAge = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);

  const candidates = await prisma.abandonedCheckout.findMany({
    where: { emailSentAt: null, capturedAt: { lte: cutoff, gte: maxAge } },
  });

  let emailed = 0;
  let recovered = 0;
  let skippedOutOfStock = 0;
  let failed = 0;

  // One candidate's send failing (bad address, Resend outage, ...) must
  // never block every candidate behind it — this loop ran unattended for two
  // weeks (2026-09-02 to 2026-09-16) because a single stale test row with an
  // undeliverable @example.com address threw here and aborted the whole
  // batch every day, silently blocking real customers' reminders too. Mirrors
  // the try/catch-and-continue pattern in sync-packeta-delivery.ts.
  for (const candidate of candidates) {
    try {
      // Case-insensitive: this table's email is always lowercased at
      // capture (see capture-abandoned/route.ts), but Order.email is stored
      // exactly as the customer typed it — an exact-case match silently
      // misses a real completed order over a casing difference alone.
      const completedOrder = await prisma.order.findFirst({
        where: {
          email: { equals: candidate.email, mode: "insensitive" },
          createdAt: { gte: new Date(candidate.capturedAt.getTime() - ALREADY_ORDERED_BUFFER_MS) },
        },
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

      // Re-checked against current stock right before sending — the
      // snapshot is whatever was true at capture time, which can be hours
      // to 3 days stale by send time. 26% of a recent batch (20 of 77)
      // referenced a product that had since sold out, been hidden, or (one
      // case) been deleted outright, prompting a real "why are you emailing
      // me about something you don't have" complaint.
      const items = candidate.cartSnapshot as unknown as CartItem[];
      const productIds = items.map((i) => i.productId);
      const currentProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stock: true, visible: true },
      });
      const availableIds = new Set(
        currentProducts.filter((p) => p.visible && p.stock > 0).map((p) => p.id),
      );
      const availableItems = items.filter((i) => availableIds.has(i.productId));

      if (availableItems.length === 0) {
        // Nothing left worth reminding them about — resolved without
        // emailing, not retried again (matches the "recovered" no-email
        // path above), but tracked separately so send counts stay honest.
        await prisma.abandonedCheckout.update({
          where: { id: candidate.id },
          data: { emailSentAt: new Date() },
        });
        await logAdminActivity({
          action: "marketing.abandoned_checkout_skipped_out_of_stock",
          entityType: "AbandonedCheckout",
          entityId: candidate.id,
          detail: `${candidate.email}: e-mail neodeslán, všechny položky z košíku už nejsou dostupné`,
        });
        skippedOutOfStock++;
        continue;
      }

      await sendAbandonedCheckoutEmail({
        email: candidate.email,
        firstName: candidate.firstName ?? "",
        cartSnapshot: availableItems,
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

  return { emailed, recovered, skippedOutOfStock, failed };
}
