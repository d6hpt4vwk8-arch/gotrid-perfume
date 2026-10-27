import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { FakturaDocument } from "@/lib/pdf/faktura";
import { getMailContext, orderMailLocale } from "@/lib/email/locale";
import { localizedItemNames } from "@/lib/orders/item-names";
import { canDownloadInvoice } from "@/lib/orders/status-labels";
import type { EmailAttachment } from "@/lib/email/order-attachments";

/** A company (IČO or a company name on the order) needs the faktura for its books — it can't be left to "download it from the order page". */
export function isCompanyOrder(order: { ico: string | null; companyName: string | null }): boolean {
  return Boolean(order.ico?.trim() || order.companyName?.trim());
}

/**
 * The faktura PDF for an order, as an e-mail attachment — same document the
 * /api/orders/[number]/faktura download renders. Returns null for a sale that
 * hasn't happened yet (NEW/CANCELLED, see canDownloadInvoice).
 */
export async function buildInvoiceAttachment(orderId: string): Promise<EmailAttachment | null> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || !canDownloadInvoice(order.status)) return null;
  const locale = orderMailLocale(order);
  const [ctx, itemNames] = await Promise.all([getMailContext(locale), localizedItemNames(order.items, locale)]);
  const content = await renderToBuffer(<FakturaDocument order={order} tr={ctx.tr} locale={locale} itemNames={itemNames} />);
  return { filename: `Faktura-${order.number}.pdf`, content };
}
