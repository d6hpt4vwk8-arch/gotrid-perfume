import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createParcel, GlsError } from "@/lib/gls";
import { logAdminActivity } from "@/lib/admin/activity-log";

// No dynamic API (cookies/headers/searchParams) is used below, so Next.js
// would otherwise be free to treat this GET as static and cache its
// response — including a *failed* one — and keep serving that same result
// on every later hit regardless of what changes in the DB (confirmed live:
// after fixing an order's glsParcelId, this route kept returning the old
// "[18] Parcel label is already generated" error until this was added).
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) {
    return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });
  }
  if (order.shippingMethod !== "GLS" && order.shippingMethod !== "GLS_MISTO") {
    return NextResponse.json(
      { error: "Štítek GLS lze vytvořit jen pro objednávky se způsobem dopravy GLS." },
      { status: 400 },
    );
  }

  try {
    let labelPdf: Buffer;

    if (!order.glsParcelNumber) {
      if (!order.shippingStreet || !order.shippingCity || !order.shippingPostalCode) {
        throw new GlsError("Objednávka nemá vyplněnou doručovací adresu.");
      }
      // GLS_MISTO: shippingStreet/City/PostalCode already hold the pickup
      // point's own address (set at checkout — see create-order.ts), and
      // pickupPointId/pickupPointName route the label via GLS's PSD service.
      if (order.shippingMethod === "GLS_MISTO" && (!order.pickupPointId || !order.pickupPointName)) {
        throw new GlsError("Objednávka nemá vybrané výdejní místo GLS.");
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
        pickupPoint:
          order.shippingMethod === "GLS_MISTO"
            ? { id: order.pickupPointId!, name: order.pickupPointName! }
            : undefined,
      });
      labelPdf = result.labelPdf;
      await prisma.order.update({
        where: { id },
        data: {
          glsParcelId: result.parcelId,
          glsParcelNumber: result.parcelNumber,
          trackingNumber: result.parcelNumber,
          // GLS's GetPrintedLabels rejects re-fetching this same parcel's
          // label later — confirmed live, "[18] Parcel label is already
          // generated" every time — so this is the only copy that will
          // ever exist; save it now and serve straight from that later.
          glsLabelPdf: new Uint8Array(result.labelPdf),
        },
      });
      await logAdminActivity({
        action: "order.gls_label_created",
        entityType: "Order",
        entityId: id,
        detail: `${order.number}: vytvořena zásilka GLS, číslo ${result.parcelNumber}`,
      });
    } else if (order.glsLabelPdf) {
      labelPdf = Buffer.from(order.glsLabelPdf);
    } else {
      // A parcel exists but we never saved its PDF (created before
      // glsLabelPdf existed) — GLS won't hand it back, so this needs
      // fixing by hand (cancel + recreate) rather than failing silently.
      throw new GlsError(
        "Štítek pro tuto zásilku nemáme uložený a GLS ho znovu nevydá — je potřeba zásilku zrušit a vytvořit znovu.",
      );
    }

    return new NextResponse(new Uint8Array(labelPdf), {
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
