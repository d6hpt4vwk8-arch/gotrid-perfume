// Creates an ADDITIONAL Zásilkovna packet for an order that is shipped in two boxes, next to the existing one
// (order.packetaId stays the first packet). The packet "number" gets a -2 suffix. Saves the label PDFs to ops/labels/.
//
//   npx tsx --env-file=.env scripts/create-extra-zasilkovna-packet.ts <orderNumber> --weight 1.0 --value 759 [--suffix 2] [--no-cod]
// COD orders are refused unless --no-cod is given: the extra packet is then sent without cash on delivery
// (the first packet keeps the whole COD amount).
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { createPacket, fetchLabelPdf } from "../src/lib/packeta";
import { logAdminActivity } from "../src/lib/admin/activity-log";

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const number = process.argv[2];
  const weightKg = Number(arg("weight") ?? "1");
  const suffix = arg("suffix") ?? "2";
  if (!number) throw new Error("order number required");
  const order = await prisma.order.findFirst({ where: { number } });
  if (!order) throw new Error(`order ${number} not found`);
  if (order.shippingMethod !== "ZASILKOVNA" || !order.pickupPointId) throw new Error("only pickup-point Zásilkovna orders are supported");
  if (order.paymentMethod === "CASH_ON_DELIVERY" && !process.argv.includes("--no-cod")) throw new Error("COD orders need a manual split of the COD amount");
  const value = Number(arg("value") ?? Number(order.total) / 2);

  const packetId = await createPacket({
    orderNumber: `${order.number}-${suffix}`,
    firstName: order.firstName,
    lastName: order.lastName,
    email: order.email,
    phone: order.phone,
    pickupPointId: order.pickupPointId,
    weightKg,
    value,
    codAmount: null,
  });
  await mkdir("ops/labels", { recursive: true });
  const a4 = await fetchLabelPdf(packetId, "A6 on A4");
  const a6 = await fetchLabelPdf(packetId, "A6 on A6");
  await writeFile(`ops/labels/stitek-zasilkovna-${order.number}-${suffix}-A6-on-A4.pdf`, a4);
  await writeFile(`ops/labels/stitek-zasilkovna-${order.number}-${suffix}-A6-on-A6.pdf`, a6);
  await writeFile(`ops/labels/${order.number}-${suffix}.txt`, `Packeta packet ${packetId} — ${order.number}-${suffix}, ${order.pickupPointName}, weight ${weightKg} kg, value ${value} CZK, created ${new Date().toISOString()}\n`);
  await logAdminActivity({
    action: "order.packeta_extra_packet_created",
    entityType: "Order",
    entityId: order.id,
    detail: `${order.number}: další zásilka Zásilkovna ${order.number}-${suffix}, packet ID ${packetId} (první: ${order.packetaId})`,
  });
  console.log(`Created packet ${packetId} for ${order.number}-${suffix}; first packet stays ${order.packetaId}`);
}

main().finally(() => prisma.$disconnect());
