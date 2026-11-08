import type { Order } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { promisedDeliveryDate, sendDelayNoticeEmail } from "@/lib/email/send-delay-notice-email";

// First delay mail (2026-11-08): when the delivery date promised on the site has arrived and the order still has not
// been handed to a carrier, tell the customer ourselves instead of waiting for them to write. Deliberately narrow:
//  - not personal pickup (those run on their own, manual schedule);
//  - only orders that are really "in the queue": paid / processing, or cash-on-delivery (it stays NEW until shipped).
//    Card orders still NEW are unconfirmed and bank transfers still NEW are unpaid — neither is "late" yet;
//  - nothing that already has a label / tracking number (it is about to go, or gone);
//  - nothing with a customer note (could be "send later") — those stay for a human;
//  - nothing older than 30 days — that is a stuck order needing a personal answer, not a template;
//  - only orders placed on/after the go-live moment (see ordersFrom) — older ones are handled by hand;
//  - once per order (deduplicated through the activity log), no compensation wording: that stays individual.
// Sends only when DELAY_NOTICE_ENABLED=true; otherwise the daily cron just reports who would get it.
const MAX_AGE_DAYS = 30;
// Owner's call (2026-11-08): the mail is for NEW orders only. Orders placed before this moment are handled by hand and
// never get the automatic notice, even if the switch is turned on later. DELAY_NOTICE_FROM (ISO date/time) overrides it.
const DEFAULT_ORDERS_FROM = "2026-11-09T00:00:00+01:00";
function ordersFrom(): Date {
  const d = new Date(process.env.DELAY_NOTICE_FROM || DEFAULT_ORDERS_FROM);
  return Number.isNaN(d.getTime()) ? new Date(DEFAULT_ORDERS_FROM) : d;
}
export const DELAY_NOTICE_ACTION = "order.delay_notice_email";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" });
const ymd = (d: Date) => dayFmt.format(d);

export interface DelayCandidate {
  order: Order;
  promised: Date;
}

export async function getDelayNoticeCandidates(now: Date = new Date()): Promise<DelayCandidate[]> {
  const since = new Date(Math.max(now.getTime() - MAX_AGE_DAYS * 86_400_000, ordersFrom().getTime()));
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      shippingMethod: { not: "OSOBNI_ODBER" },
      trackingNumber: null,
      packetaId: null,
      balikovnaParcelCode: null,
      glsParcelId: null,
      glsParcelNumber: null,
      OR: [{ customerNote: null }, { customerNote: "" }],
      AND: [
        {
          OR: [
            { status: { in: ["PAID", "PROCESSING"] } },
            { status: "NEW", paymentMethod: "CASH_ON_DELIVERY" },
          ],
        },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  const today = ymd(now);
  const late = orders
    .map((order) => ({ order, promised: promisedDeliveryDate(order) }))
    .filter((c) => ymd(c.promised) <= today);
  if (late.length === 0) return [];

  const done = await prisma.adminActivityLog.findMany({
    where: { action: DELAY_NOTICE_ACTION, entityId: { in: late.map((c) => c.order.id) } },
    select: { entityId: true },
  });
  const doneIds = new Set(done.map((d) => d.entityId));
  return late.filter((c) => !doneIds.has(c.order.id));
}

export async function runDelayedOrderNotices(): Promise<{ enabled: boolean; candidates: number; emailed: number; failed: number }> {
  const enabled = process.env.DELAY_NOTICE_ENABLED === "true";
  let candidates: DelayCandidate[] = [];
  try {
    candidates = await getDelayNoticeCandidates();
  } catch (err) {
    console.error("[delay-notice] could not load candidates", err);
    return { enabled, candidates: 0, emailed: 0, failed: 1 };
  }
  if (!enabled) return { enabled, candidates: candidates.length, emailed: 0, failed: 0 };

  let emailed = 0;
  let failed = 0;
  for (const { order } of candidates) {
    try {
      await sendDelayNoticeEmail(order);
      await logAdminActivity({
        action: DELAY_NOTICE_ACTION,
        entityType: "Order",
        entityId: order.id,
        detail: `${order.number}: ${order.email}`,
      });
      emailed++;
    } catch (err) {
      failed++;
      await logAdminActivity({
        action: `${DELAY_NOTICE_ACTION}_failed`,
        entityType: "Order",
        entityId: order.id,
        detail: `${order.number}: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return { enabled, candidates: candidates.length, emailed, failed };
}
