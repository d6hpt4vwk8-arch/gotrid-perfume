import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { sendWishlistEmail, type WishlistMailItem } from "@/lib/email/send-wishlist-email";
import type { MailLocale } from "@/lib/email/locale";

// A price must fall by at least this much (and at least MIN_DROP_CZK) below the
// last price we told the customer about before it is worth an e-mail.
const MIN_DROP_RATIO = 0.05;
const MIN_DROP_CZK = 5;
const LOW_STOCK_AT = 3;
// One e-mail per customer per week at most, however many favourites change.
const MIN_DAYS_BETWEEN_EMAILS = 7;
const MAX_ITEMS_PER_EMAIL = 6;

export const WISHLIST_EMAIL_ACTION = "marketing.wishlist_email";

/**
 * Daily job: mails customers who opted in to marketing about their favourites
 * — a price drop (≥5 %) since they hearted it / since we last mailed, or only a
 * few units left. Each price level and each low-stock state is announced once.
 */
export async function runWishlistCampaign(): Promise<{ emailed: number; items: number }> {
  const weekAgo = new Date(Date.now() - MIN_DAYS_BETWEEN_EMAILS * 24 * 60 * 60 * 1000);

  const rows = await prisma.wishlistItem.findMany({
    where: {
      customer: { marketingOptIn: true },
      product: { visible: true, stock: { gt: 0 } },
    },
    select: {
      id: true,
      priceAtAdd: true,
      lastNotifiedPrice: true,
      lowStockNotifiedAt: true,
      customer: { select: { id: true, email: true, firstName: true, addressCountry: true } },
      product: {
        select: {
          name: true,
          nameSk: true,
          slug: true,
          price: true,
          stock: true,
          images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
        },
      },
    },
  });

  const unsubscribed = new Set(
    (await prisma.newsletterUnsubscribe.findMany({ select: { email: true } })).map((u) => u.email.toLowerCase()),
  );

  type Pending = { itemId: string; mail: WishlistMailItem; price: number; setLowStock: boolean; setPrice: boolean };
  const byCustomer = new Map<string, { customer: (typeof rows)[number]["customer"]; pending: Pending[] }>();

  for (const row of rows) {
    if (unsubscribed.has(row.customer.email.toLowerCase())) continue;
    const price = Number(row.product.price);
    const baseline = Number(row.lastNotifiedPrice ?? row.priceAtAdd);
    const dropped = baseline - price >= Math.max(MIN_DROP_CZK, baseline * MIN_DROP_RATIO);
    const low = row.product.stock <= LOW_STOCK_AT && !row.lowStockNotifiedAt;
    if (!dropped && !low) continue;

    const entry = byCustomer.get(row.customer.id) ?? { customer: row.customer, pending: [] };
    entry.pending.push({
      itemId: row.id,
      price,
      setPrice: dropped,
      setLowStock: low,
      mail: {
        slug: row.product.slug,
        name: row.product.name,
        nameSk: row.product.nameSk,
        imageUrl: row.product.images[0]?.url ?? null,
        price,
        previousPrice: dropped ? baseline : null,
        lowStock: low ? row.product.stock : null,
      },
    });
    byCustomer.set(row.customer.id, entry);
  }

  let emailed = 0;
  let items = 0;
  for (const { customer, pending } of byCustomer.values()) {
    const recent = await prisma.adminActivityLog.findFirst({
      where: { action: WISHLIST_EMAIL_ACTION, entityId: customer.id, createdAt: { gte: weekAgo } },
      select: { id: true },
    });
    if (recent) continue;

    const batch = pending.slice(0, MAX_ITEMS_PER_EMAIL);
    const locale: MailLocale = customer.addressCountry === "SK" ? "sk" : "cs";
    const sent = await sendWishlistEmail({
      email: customer.email,
      firstName: customer.firstName ?? "",
      items: batch.map((p) => p.mail),
      locale,
    });
    if (!sent) continue;
    const now = new Date();
    await Promise.all(
      batch.map((p) =>
        prisma.wishlistItem.update({
          where: { id: p.itemId },
          data: {
            ...(p.setPrice ? { lastNotifiedPrice: p.price } : {}),
            ...(p.setLowStock ? { lowStockNotifiedAt: now } : {}),
          },
        }),
      ),
    );
    await logAdminActivity({
      action: WISHLIST_EMAIL_ACTION,
      entityType: "Customer",
      entityId: customer.id,
      detail: `${customer.email}: ${batch.length} oblíbených (cena/sklad)`,
    });
    emailed++;
    items += batch.length;
  }
  return { emailed, items };
}
