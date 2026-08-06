import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { FakturaDocument } from "@/lib/pdf/faktura";
import { ADMIN_COOKIE_NAME, verifyOrderAccess } from "@/lib/orders/verify-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const order = await prisma.order.findUnique({
    where: { number },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });
  }

  const token = req.nextUrl.searchParams.get("token");
  const hasAccess = await verifyOrderAccess(
    order,
    token,
    req.cookies.get(ADMIN_COOKIE_NAME)?.value,
  );
  if (!hasAccess) {
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }

  const buffer = await renderToBuffer(<FakturaDocument order={order} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="faktura-${order.number}.pdf"`,
    },
  });
}
