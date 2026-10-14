import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankQrPng, getBankPayment } from "@/lib/payments/bank-details";

/**
 * QR payment image for the order-confirmation e-mail (QR Platba in CZK, PAY by
 * square in EUR for Slovak orders). E-mail clients block data: URLs, so the QR
 * the order page renders inline has to be a real image URL here. Guarded by
 * the order's accessToken — the same bearer token the e-mail's "view order"
 * link already carries.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return new NextResponse(null, { status: 404 });

  const order = await prisma.order.findUnique({
    where: { number },
    select: {
      number: true,
      accessToken: true,
      total: true,
      paymentMethod: true,
      chargedCurrency: true,
      chargedAmount: true,
    },
  });
  if (!order || order.accessToken !== token) return new NextResponse(null, { status: 404 });

  const payment = getBankPayment(order);
  if (!payment) return new NextResponse(null, { status: 404 });

  const png = await bankQrPng(payment, 320);
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" },
  });
}
