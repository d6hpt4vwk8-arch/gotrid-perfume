import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAddressPacket, createPacket, fetchLabelPdf, PacketaError } from "@/lib/packeta";
import { getSettings } from "@/lib/settings.server";
import { logAdminActivity } from "@/lib/admin/activity-log";

// See the same directive on gls-label/route.ts for why this is needed —
// without it Next.js can cache this GET (including a failed response) and
// keep serving that stale result regardless of later DB changes.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });
  }
  const isHomeDelivery = order.shippingMethod === "ZASILKOVNA_HD";
  if (order.shippingMethod !== "ZASILKOVNA" && !isHomeDelivery) {
    return NextResponse.json(
      { error: "Štítek Zásilkovna lze vytvořit jen pro objednávky se způsobem dopravy Zásilkovna." },
      { status: 400 },
    );
  }
  if (!isHomeDelivery && !order.pickupPointId) {
    return NextResponse.json({ error: "Objednávka nemá vybrané výdejní místo." }, { status: 400 });
  }
  if (isHomeDelivery && (!order.shippingStreet || !order.shippingCity || !order.shippingPostalCode)) {
    return NextResponse.json({ error: "Objednávka nemá vyplněnou doručovací adresu." }, { status: 400 });
  }

  try {
    let packetaId = order.packetaId;
    if (!packetaId) {
      if (isHomeDelivery) {
        // Slovak parcels must be declared (and COD collected) in EUR; the order itself
        // is priced in CZK, so convert at the shop's own rate.
        const country = order.shippingCountry === "SK" ? "SK" : "CZ";
        const settings = await getSettings();
        const inEur = country === "SK";
        const convert = (czk: number) => (inEur ? Math.round((czk / settings.czkToEurRate) * 100) / 100 : czk);
        packetaId = await createAddressPacket({
          orderNumber: order.number,
          firstName: order.firstName,
          lastName: order.lastName,
          email: order.email,
          phone: order.phone,
          street: order.shippingStreet!,
          city: order.shippingCity!,
          postalCode: order.shippingPostalCode!,
          country,
          weightKg: Number(order.weight),
          currency: inEur ? "EUR" : "CZK",
          value: convert(Number(order.total)),
          codAmount: order.paymentMethod === "CASH_ON_DELIVERY" ? convert(Number(order.total)) : null,
        });
      } else {
        packetaId = await createPacket({
          orderNumber: order.number,
          firstName: order.firstName,
          lastName: order.lastName,
          email: order.email,
          phone: order.phone,
          pickupPointId: order.pickupPointId!,
          weightKg: Number(order.weight),
          value: Number(order.total),
          codAmount: order.paymentMethod === "CASH_ON_DELIVERY" ? Number(order.total) : null,
        });
      }
      await prisma.order.update({ where: { id }, data: { packetaId } });
      await logAdminActivity({
        action: "order.packeta_label_created",
        entityType: "Order",
        entityId: id,
        detail: `${order.number}: vytvořena zásilka Zásilkovna, packet ID ${packetaId}`,
      });
    }

    const pdf = await fetchLabelPdf(packetaId);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="stitek-${order.number}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof PacketaError ? err.message : "Nepodařilo se vytvořit štítek.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
