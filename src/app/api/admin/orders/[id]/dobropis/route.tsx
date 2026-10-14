import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { DobropisDocument } from "@/lib/pdf/dobropis";
import { getMailContext, orderMailLocale } from "@/lib/email/locale";
import { localizedItemNames } from "@/lib/orders/item-names";

// Admin-only (protected by src/middleware.ts for every /api/admin/* path,
// same as the GLS/Balíkovna label routes) — a credit note is a bookkeeping
// document, not something a customer needs to self-serve.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) {
    return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });
  }
  if (order.status !== "REFUNDED") {
    return NextResponse.json(
      { error: "Dobropis lze stáhnout jen pro objednávku ve stavu „Vrácená“." },
      { status: 400 },
    );
  }

  const locale = orderMailLocale(order);
  const [ctx, itemNames] = await Promise.all([getMailContext(locale), localizedItemNames(order.items, locale)]);
  const buffer = await renderToBuffer(
    <DobropisDocument order={order} tr={ctx.tr} locale={locale} itemNames={itemNames} />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="dobropis-${order.number}.pdf"`,
    },
  });
}
