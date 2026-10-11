import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { buildSpaydPayload } from "@/lib/payments/qr-platba";

/**
 * QR Platba image for the order-confirmation e-mail. E-mail clients block
 * data: URLs, so the QR the order page renders inline has to be a real image
 * URL here. Guarded by the order's accessToken — the same bearer token the
 * e-mail's "Zobrazit stav objednávky" link already carries.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const token = req.nextUrl.searchParams.get("token");
  const iban = process.env.BANK_IBAN;
  if (!token || !iban) return new NextResponse(null, { status: 404 });

  const order = await prisma.order.findUnique({
    where: { number },
    select: { accessToken: true, total: true, paymentMethod: true },
  });
  if (!order || order.accessToken !== token || order.paymentMethod !== "BANK_TRANSFER") {
    return new NextResponse(null, { status: 404 });
  }

  const payload = buildSpaydPayload({
    iban,
    amount: Number(order.total),
    variableSymbol: number,
    message: `Objednavka ${number}`,
  });
  const png = await QRCode.toBuffer(payload, { margin: 1, width: 320 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
