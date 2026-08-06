import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_LABELS } from "@/lib/orders/status-labels";
import { SHIPPING_LABELS, PAYMENT_LABELS } from "@/lib/shipping";
import type { OrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const where = status && status in ORDER_STATUS_LABELS ? { status: status as OrderStatus } : {};

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Objednávky");

  sheet.columns = [
    { header: "Číslo", key: "number", width: 18 },
    { header: "Datum", key: "date", width: 20 },
    { header: "Jméno", key: "name", width: 22 },
    { header: "E-mail", key: "email", width: 26 },
    { header: "Telefon", key: "phone", width: 16 },
    { header: "Doprava", key: "shipping", width: 22 },
    { header: "Platba", key: "payment", width: 22 },
    { header: "Stav", key: "status", width: 16 },
    { header: "Položky", key: "items", width: 50 },
    { header: "Zboží (Kč)", key: "itemsTotal", width: 14 },
    { header: "Doprava (Kč)", key: "shippingPrice", width: 14 },
    { header: "Slevový kód", key: "couponCode", width: 14 },
    { header: "Sleva (Kč)", key: "discountAmount", width: 12 },
    { header: "Celkem (Kč)", key: "total", width: 14 },
    { header: "Sledovací číslo", key: "trackingNumber", width: 20 },
  ];

  for (const order of orders) {
    sheet.addRow({
      number: order.number,
      date: new Date(order.createdAt).toLocaleString("cs-CZ"),
      name: `${order.firstName} ${order.lastName}`,
      email: order.email,
      phone: order.phone,
      shipping: SHIPPING_LABELS[order.shippingMethod],
      payment: PAYMENT_LABELS[order.paymentMethod],
      status: ORDER_STATUS_LABELS[order.status],
      items: order.items.map((i) => `${i.name} ×${i.qty}`).join("; "),
      itemsTotal: Number(order.itemsTotal),
      shippingPrice: Number(order.shippingPrice),
      couponCode: order.couponCode ?? "",
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
      trackingNumber: order.trackingNumber ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="objednavky-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
