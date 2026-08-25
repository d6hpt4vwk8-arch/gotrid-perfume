import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createParcel, BalikovnaError } from "@/lib/balikovna";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { parseBalikovnaPointAddress } from "@/lib/balikovna-point-address";

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
      // Balíkovna orders are always pickup-point orders in this shop (see
      // checkout-schema.ts) — shippingStreet/City/PostalCode are never set
      // for them. The nAPI has no "route to výdejní místo" field, so the
      // parcel is addressed directly to the point's own physical address
      // instead (that's how it actually reaches an AlzaBox/partner point —
      // confirmed against the live API: leaving the address empty returns
      // responseCode 11 "INVALID_LOCATION").
      const point = order.pickupPointId
        ? await prisma.balikovnaPoint.findUnique({ where: { id: order.pickupPointId } })
        : null;
      if (!point) {
        throw new BalikovnaError(
          `Výdejní místo ${order.pickupPointId ?? "(chybí)"} nebylo nalezeno v databázi Balíkovna míst.`,
        );
      }
      const pointAddress = parseBalikovnaPointAddress(point.address);

      const result = await createParcel({
        recordId: order.number,
        weightKg: Number(order.weight),
        codAmount: order.paymentMethod === "CASH_ON_DELIVERY" ? Number(order.total) : null,
        recipient: {
          firstName: order.firstName,
          surname: order.lastName,
          address: {
            street: pointAddress.street || undefined,
            houseNumber: pointAddress.houseNumber,
            sequenceNumber: pointAddress.sequenceNumber,
            city: point.city,
            zipCode: pointAddress.zipCode,
          },
          mobilNumber: order.phone,
          emailAddress: order.email,
        },
        pickupPointId: order.pickupPointId ?? undefined,
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
