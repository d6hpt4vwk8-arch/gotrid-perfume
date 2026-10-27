// 2026-10-23: the 5 "vintage" Cartier listings (808, 811, 820, 826, 832) each showed 5 units but the shelf really holds
// 4 pieces of other models -> zero them until re-listed from what is physically there. Slava Zaitsev Maroussia (code 43)
// had 0 on the site while ~30 pcs sit in another warehouse (owner's figure) -> 30. Snapshot first; --revert=<file>.
import { PrismaClient } from "@prisma/client";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
const prisma = new PrismaClient();
const ZERO = ["808", "811", "820", "826", "832"];
const SET_30 = "43";

async function main() {
  const revert = process.argv.find((a) => a.startsWith("--revert="))?.slice(9);
  if (revert) {
    const snap = JSON.parse(readFileSync(revert, "utf8")) as { code: string; stock: number; ownStock: number }[];
    for (const s of snap) await prisma.product.update({ where: { code: s.code }, data: { stock: s.stock, ownStock: s.ownStock } });
    return console.log("reverted", snap.length);
  }
  const rows = await prisma.product.findMany({ where: { code: { in: [...ZERO, SET_30] } }, select: { code: true, name: true, stock: true, ownStock: true } });
  console.log(rows);
  if (!process.argv.includes("--apply")) return console.log("dry run (use --apply)");
  mkdirSync("ops/snapshots", { recursive: true });
  const file = `ops/snapshots/vintage-cartier-zaitsev-${Date.now()}.json`;
  writeFileSync(file, JSON.stringify(rows.map(({ code, stock, ownStock }) => ({ code, stock, ownStock }))));
  for (const code of ZERO) await prisma.product.update({ where: { code }, data: { stock: 0, ownStock: 0 } });
  await prisma.product.update({ where: { code: SET_30 }, data: { stock: 30 } });
  console.log("applied; snapshot", file);
}
main().finally(() => prisma.$disconnect());
