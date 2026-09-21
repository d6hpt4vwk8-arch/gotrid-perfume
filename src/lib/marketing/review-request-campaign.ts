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
  items: { productId: string | null }[];
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
      items: { select: { productId: true }, take: 1 },
    },
  });

  // Same §7/3 zákona č. 480/2004 Sb. reasoning as second-order-campaign.ts —
  // no separate opt-in needed for an existing customer, only a working
  // unsubscribe.
  const unsubscribed = await prisma.newsletterUnsubscribe.findMany({ select: { email: true } });
  const unsubscribedEmails = new Set(unsubscribed.map((u) => u.email.toLowerCase()));
  return orders.filter((o) => !unsubscribedEmails.has(o.email.trim().toLowerCase()));
}

export async function runReviewRequestCampaign(): Promise<{
  emailed: number;
  skippedNoProduct: number;
}> {
  const candidates = await getReviewRequestCandidates();
  if (candidates.length === 0) return { emailed: 0, skippedNoProduct: 0 };

  let emailed = 0;
  let skippedNoProduct = 0;

  for (const candidate of candidates) {
    const productId = candidate.items[0]?.productId;
    // ReviewForm lives on a product page (reviews are per-product, not
    // store-wide) — an order with no linked product left (deleted since,
    // or a line item that was never tied to one) has nowhere to send the
    // review link to, so it's resolved without emailing rather than
    // retried forever.
    const product = productId
      ? await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } })
      : null;
    if (!product) {
      await prisma.order.update({
        where: { id: candidate.id },
        data: { reviewRequestSentAt: new Date() },
      });
      skippedNoProduct++;
      continue;
    }

    await sendReviewRequestEmail({
      email: candidate.email,
      firstName: candidate.firstName,
      reviewProductSlug: product.slug,
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

  return { emailed, skippedNoProduct };
}
