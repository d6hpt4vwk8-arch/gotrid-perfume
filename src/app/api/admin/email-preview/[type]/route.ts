import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  renderCustomerOrderConfirmationHtml,
  renderOwnerNewOrderNotificationHtml,
} from "@/lib/email/send-order-emails";
import { renderAbandonedCheckoutEmailHtml } from "@/lib/email/send-abandoned-checkout-email";
import { renderSecondOrderEmailHtml } from "@/lib/email/send-second-order-email";
import { renderPasswordResetEmailHtml } from "@/lib/email/send-password-reset-email";
import { renderStockAlertEmailHtml } from "@/lib/email/send-stock-alert-email";
import { renderReviewRequestEmailHtml } from "@/lib/email/send-review-request-email";
import { renderShippedEmailHtml } from "@/lib/email/send-shipped-email";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";
import type { CartItem } from "@/lib/cart-context";

// Renders the real email templates with real (read-only) sample data so an
// admin can check what customers actually receive, without triggering a
// send. Protected by src/middleware.ts's blanket /api/admin/* auth check.
export const dynamic = "force-dynamic";

// ?country=sk previews the Slovak version (EUR amounts, Slovak texts); add
// ?payment=bank to force the bank-transfer block (EUR account + PAY by square).
function applyPreviewOptions<T extends { shippingCountry: string; paymentMethod: string; total: unknown; chargedCurrency: string | null; chargedAmount: unknown }>(
  order: T,
  req: NextRequest,
): T {
  const sk = req.nextUrl.searchParams.get("country") === "sk";
  const bank = req.nextUrl.searchParams.get("payment") === "bank";
  return {
    ...order,
    ...(sk
      ? { shippingCountry: "SK", chargedCurrency: "EUR", chargedAmount: Math.round((Number(order.total) / 24.5) * 100) / 100 }
      : {}),
    ...(bank ? { paymentMethod: "BANK_TRANSFER" } : {}),
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;

  if (type === "order-confirmation") {
    const order = await prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Zatím žádná objednávka k náhledu." }, { status: 404 });
    }
    return new NextResponse(await renderCustomerOrderConfirmationHtml(applyPreviewOptions(order, req) as typeof order), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (type === "shipped") {
    const order = await prisma.order.findFirst({ orderBy: { createdAt: "desc" } });
    if (!order) {
      return NextResponse.json({ error: "Zatím žádná objednávka k náhledu." }, { status: 404 });
    }
    return new NextResponse(await renderShippedEmailHtml(applyPreviewOptions(order, req) as typeof order), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (type === "abandoned-checkout") {
    const sample = await prisma.abandonedCheckout.findFirst({
      orderBy: { capturedAt: "desc" },
      where: { email: { not: { contains: "@example.com" } } },
    });
    const cartSnapshot = (sample?.cartSnapshot as unknown as CartItem[]) ?? [
      {
        productId: "sample",
        slug: "#",
        name: "Ukázkový produkt",
        price: 499,
        image: null,
        qty: 1,
        stock: 10,
      },
    ];
    return new NextResponse(
      await renderAbandonedCheckoutEmailHtml({ firstName: sample?.firstName ?? "Zákazníku", cartSnapshot }),
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  if (type === "second-order") {
    const candidates = await prisma.product.findMany({
      where: { visible: true, categories: { some: { category: { fullSlug: { startsWith: "parfemy" } } } } },
      take: 20,
      orderBy: { priority: "desc" },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });
    const products = candidates.filter((p) => !isConditionFlagged(p.name, p.isDefective)).slice(0, 3);
    const settings = await prisma.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
    const html = await renderSecondOrderEmailHtml({
      locale: req.nextUrl.searchParams.get("country") === "sk" ? "sk" : "cs",
      email: "nahled@example.com",
      firstName: "Zákazníku",
      couponCode: `${settings.secondOrderCouponPrefix}${settings.secondOrderDiscountPercent}`,
      discountPercent: settings.secondOrderDiscountPercent,
      validUntil: new Date(Date.now() + settings.secondOrderValidDays * 24 * 60 * 60 * 1000),
      theme: "perfume",
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        nameSk: p.nameSk,
        slug: p.slug,
        price: Number(p.price),
        imageUrl: p.images[0]?.url ?? null,
      })),
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (type === "owner-notification") {
    const order = await prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Zatím žádná objednávka k náhledu." }, { status: 404 });
    }
    return new NextResponse(renderOwnerNewOrderNotificationHtml(order), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (type === "password-reset") {
    return new NextResponse(
      renderPasswordResetEmailHtml("https://gotridperfume.cz/obnovit-heslo?token=nahled-ukazkovy-token"),
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  if (type === "stock-alert") {
    const product = await prisma.product.findFirst({
      where: { visible: true },
      orderBy: { priority: "desc" },
    });
    if (!product) {
      return NextResponse.json({ error: "Zatím žádný produkt k náhledu." }, { status: 404 });
    }
    return new NextResponse(await renderStockAlertEmailHtml(product), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (type === "review-request") {
    const order = await prisma.order.findFirst({
      where: { status: "DELIVERED" },
      orderBy: { createdAt: "desc" },
    });
    const html = await renderReviewRequestEmailHtml({
      locale: req.nextUrl.searchParams.get("country") === "sk" ? "sk" : "cs",
      email: "nahled@example.com",
      firstName: order?.firstName ?? "Zákazníku",
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  return NextResponse.json({ error: "Neznámý typ náhledu." }, { status: 404 });
}
