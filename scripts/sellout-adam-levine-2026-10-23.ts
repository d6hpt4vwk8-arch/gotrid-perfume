// Adam Levine Women For Her 50 ml (code 622): listing showed 5, only 1 unit really existed (and it belongs to order
// GT261021-4372). Mark it sold out. Snapshot first; --revert=<file> restores.
import { PrismaClient } from "@prisma/client";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
const prisma = new PrismaClient();
const CODE = "622";

async function main() {
  const revert = process.argv.find((a) => a.startsWith("--revert="))?.slice(9);
  if (revert) {
    const snap = JSON.parse(readFileSync(revert, "utf8"));
    await prisma.product.update({ where: { code: CODE }, data: { stock: snap.stock, ownStock: snap.ownStock } });
    console.log("reverted", snap);
    return;
  }
  const before = await prisma.product.findUniqueOrThrow({ where: { code: CODE }, select: { stock: true, ownStock: true, name: true } });
  console.log("before", before);
  if (!process.argv.includes("--apply")) return console.log("dry run (use --apply)");
  mkdirSync("ops/snapshots", { recursive: true });
  const file = `ops/snapshots/adam-levine-sellout-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(before));
  await prisma.product.update({ where: { code: CODE }, data: { stock: 0, ownStock: 0 } });
  console.log("sold out; snapshot", file);
}
main().finally(() => prisma.$disconnect());
