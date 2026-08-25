import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createParcel, BalikovnaError } from "@/lib/balikovna";
import { logAdminActivity } from "@/lib/admin/activity-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });
  }
  if (order.shippingMethod !== "BALIKOVNA") {
    return NextResponse.json(
      { error: "Štítek Balíkovna lze vytvořit jen pro objednávky se způsobem dopravy Balíkovna." },
      { status: 400 },
    );
  }

  try {
    let parcelCode = order.balikovnaParcelCode;
    let labelPdf: Buffer | null = null;

    if (!parcelCode) {
      if (!order.pickupPointId) {
        throw new BalikovnaError("Objednávka nemá vybrané výdejní místo Balíkovna.");
      }
      const result = await createParcel({
        recordId: order.number,
        weightKg: Number(order.weight),
        insuredValue: Number(order.total),
        codAmount: order.paymentMethod === "CASH_ON_DELIVERY" ? Number(order.total) : null,
        recipient: {
          firstName: order.firstName,
          surname: order.lastName,
          mobilNumber: order.phone,
          emailAddress: order.email,
        },
        pickupPointId: order.pickupPointId,
      });
      parcelCode = result.parcelCode;
      labelPdf = result.labelPdf;
      await prisma.order.update({ where: { id }, data: { balikovnaParcelCode: parcelCode } });
      await logAdminActivity({
        action: "order.balikovna_label_created",
        entityType: "Order",
        entityId: id,
        detail: `${order.number}: vytvořena zásilka Balíkovna, kód ${parcelCode}`,
      });
    } else {
      // Re-printing an already-created parcel isn't wired yet (needs a
      // separate "get label" call) — createParcel always makes a new one.
      return NextResponse.json(
        { error: `Zásilka už byla vytvořena (kód ${parcelCode}) — opětovný tisk štítku zatím není podporován.` },
        { status: 400 },
      );
    }

    return new NextResponse(new Uint8Array(labelPdf!), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="stitek-balikovna-${order.number}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Balíkovna label creation failed for order", order.number, err);
    const message =
      err instanceof BalikovnaError
        ? err.message
        : `Nepodařilo se vytvořit štítek: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
