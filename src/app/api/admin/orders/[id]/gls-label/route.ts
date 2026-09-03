import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createParcel, reprintLabel, GlsError } from "@/lib/gls";
import { logAdminActivity } from "@/lib/admin/activity-log";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });
  }
  if (order.shippingMethod !== "GLS") {
    return NextResponse.json(
      { error: "Štítek GLS lze vytvořit jen pro objednávky se způsobem dopravy GLS." },
      { status: 400 },
    );
  }

  try {
    let parcelId = order.glsParcelId;
    let labelPdf: Buffer | null = null;

    if (!parcelId) {
      if (!order.shippingStreet || !order.shippingCity || !order.shippingPostalCode) {
        throw new GlsError("Objednávka nemá vyplněnou doručovací adresu.");
      }
      const result = await createParcel({
        recordId: order.number,
        weightKg: Number(order.weight),
        codAmount: order.paymentMethod === "CASH_ON_DELIVERY" ? Number(order.total) : null,
        recipient: {
          firstName: order.firstName,
          surname: order.lastName,
          phone: order.phone,
          email: order.email,
        },
        address: {
          street: order.shippingStreet,
          city: order.shippingCity,
          postalCode: order.shippingPostalCode,
          country: order.shippingCountry,
        },
      });
      parcelId = result.parcelId;
      labelPdf = result.labelPdf;
      await prisma.order.update({
        where: { id },
        data: {
          glsParcelId: result.parcelId,
          glsParcelNumber: result.parcelNumber,
          trackingNumber: result.parcelNumber,
        },
      });
      await logAdminActivity({
        action: "order.gls_label_created",
        entityType: "Order",
        entityId: id,
        detail: `${order.number}: vytvořena zásilka GLS, číslo ${result.parcelNumber}`,
      });
    } else {
      labelPdf = await reprintLabel(parcelId);
    }

    return new NextResponse(new Uint8Array(labelPdf!), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="stitek-gls-${order.number}.pdf"`,
      },
    });
  } catch (err) {
    console.error("GLS label creation failed for order", order.number, err);
    const message =
      err instanceof GlsError
        ? err.message
        : `Nepodařilo se vytvořit štítek: ${err instanceof Error ? err.message : String(err)}`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
