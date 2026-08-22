import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPacket, fetchLabelPdf, PacketaError } from "@/lib/packeta";
import { logAdminActivity } from "@/lib/admin/activity-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });
  }
  if (order.shippingMethod !== "ZASILKOVNA") {
    return NextResponse.json(
      { error: "Štítek Zásilkovna lze vytvořit jen pro objednávky se způsobem dopravy Zásilkovna." },
      { status: 400 },
    );
  }
  if (!order.pickupPointId) {
    return NextResponse.json({ error: "Objednávka nemá vybrané výdejní místo." }, { status: 400 });
  }

  try {
    let packetaId = order.packetaId;
    if (!packetaId) {
      packetaId = await createPacket({
        orderNumber: order.number,
        firstName: order.firstName,
        lastName: order.lastName,
        email: order.email,
        phone: order.phone,
        pickupPointId: order.pickupPointId,
        weightKg: Number(order.weight),
        value: Number(order.total),
        codAmount: order.paymentMethod === "CASH_ON_DELIVERY" ? Number(order.total) : null,
      });
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
