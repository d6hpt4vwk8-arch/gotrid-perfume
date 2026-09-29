import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { sendReviewRequestEmail, REVIEW_COUPON_CODE } from "@/lib/email/send-review-request-email";

// Owner's call (2026-09-21): long enough to have actually tried the
// product, short enough that the order is still fresh in mind.
const REVIEW_REQUEST_DELAY_DAYS = 3;

interface ReviewCandidate {
  id: string;
  email: string;
  firstName: string;
}

async function getReviewRequestCandidates(): Promise<ReviewCandidate[]> {
  const cutoff = new Date(Date.now() - REVIEW_REQUEST_DELAY_DAYS * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: "DELIVERED",
      deliveredAt: { lte: cutoff },
      reviewRequestSentAt: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
    },
  });

  // Same §7/3 zákona č. 480/2004 Sb. reasoning as second-order-campaign.ts —
  // no separate opt-in needed for an existing customer, only a working
  // unsubscribe.
  const unsubscribed = await prisma.newsletterUnsubscribe.findMany({ select: { email: true } });
  const unsubscribedEmails = new Set(unsubscribed.map((u) => u.email.toLowerCase()));
  return orders.filter((o) => !unsubscribedEmails.has(o.email.trim().toLowerCase()));
}

export async function runReviewRequestCampaign(): Promise<{ emailed: number }> {
  const candidates = await getReviewRequestCandidates();
  if (candidates.length === 0) return { emailed: 0 };

  let emailed = 0;

  for (const candidate of candidates) {
    await sendReviewRequestEmail({
      email: candidate.email,
      firstName: candidate.firstName,
    });
    await prisma.order.update({
      where: { id: candidate.id },
      data: { reviewRequestSentAt: new Date() },
    });
    await logAdminActivity({
      action: "marketing.review_request_email",
      entityType: "Order",
      entityId: candidate.id,
      detail: `${candidate.email}: odesláno s kódem ${REVIEW_COUPON_CODE}`,
    });
    emailed++;
  }

  return { emailed };
}
