import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderCustomerOrderConfirmationHtml } from "@/lib/email/send-order-emails";
import { renderAbandonedCheckoutEmailHtml } from "@/lib/email/send-abandoned-checkout-email";
import { renderSecondOrderEmailHtml } from "@/lib/email/send-second-order-email";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";
import type { CartItem } from "@/lib/cart-context";

// Renders the real email templates with real (read-only) sample data so an
// admin can check what customers actually receive, without triggering a
// send. Protected by src/middleware.ts's blanket /api/admin/* auth check.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;

  if (type === "order-confirmation") {
    const order = await prisma.order.findFirst({
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Zatím žádná objednávka k náhledu." }, { status: 404 });
    }
    return new NextResponse(renderCustomerOrderConfirmationHtml(order), {
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
      renderAbandonedCheckoutEmailHtml({ firstName: sample?.firstName ?? "Zákazníku", cartSnapshot }),
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
    const html = await renderSecondOrderEmailHtml({
      email: "nahled@example.com",
      firstName: "Zákazníku",
      couponCode: "DRUHY7X3K9M",
      theme: "perfume",
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        imageUrl: p.images[0]?.url ?? null,
      })),
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  return NextResponse.json({ error: "Neznámý typ náhledu." }, { status: 404 });
}
