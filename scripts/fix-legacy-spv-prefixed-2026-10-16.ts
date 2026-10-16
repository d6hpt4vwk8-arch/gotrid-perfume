// One-off (2026-10-16): the last visible products with an "SPV<EAN>" code (no dash), outside the
// SPV stock sync. Checked against the owner's logged-in SP Venture catalogue by EAN:
//  - 4 are in his catalogue but "Momentálně nedostupné" -> move to SPV-<code>, stock 0 (the hourly
//    sync restocks them when they return), price lifted to wholesale × 1.21 × 1.2.
//  - the other visible ones are not in his catalogue at all (some show stock on the public search —
//    the other warehouse he cannot order from) -> taken off sale (hidden, stock 0).
// Usage: tsx scripts/fix-legacy-spv-prefixed-2026-10-16.ts [--apply]
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const IN_CATALOGUE_OUT_OF_STOCK: Record<string, { code: string; costExVat: number }> = {
  "8435415005531": { code: "0127552", costExVat: 1706.25 },
  "3605471700090": { code: "203295", costExVat: 243.79 },
  "3616304990458": { code: "203369", costExVat: 588.18 },
  "3349666007914": { code: "203067", costExVat: 979.7 },
};

async function main() {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.product.findMany({
    where: { visible: true, ownStock: 0, code: { startsWith: "SPV" }, NOT: { code: { startsWith: "SPV-" } } },
    select: { id: true, code: true, ean: true, name: true, price: true, purchasePrice: true, stock: true, visible: true, compareAtPrice: true },
  });
  const taken = new Set((await prisma.product.findMany({ where: { code: { startsWith: "SPV-" } }, select: { code: true } })).map((p) => p.code));
  const move = rows.filter((r) => IN_CATALOGUE_OUT_OF_STOCK[r.ean ?? ""]);
  const hide = rows.filter((r) => !IN_CATALOGUE_OUT_OF_STOCK[r.ean ?? ""]);
  for (const r of move) {
    const m = IN_CATALOGUE_OUT_OF_STOCK[r.ean!];
    console.log("MOVE", r.code, "->", `SPV-${m.code}`, taken.has(`SPV-${m.code}`) ? "CLASH!" : "", "|", r.name.slice(0, 40), "| cost", Number(r.purchasePrice), "->", m.costExVat, "| price", Number(r.price), "->", Math.max(Number(r.price), Math.round(m.costExVat * 1.21 * 1.2)));
  }
  for (const r of hide) console.log("HIDE", r.code, "|", r.name.slice(0, 40), "| stock", r.stock);
  console.log({ move: move.length, hide: hide.length });
  if (!apply) return;
  if (move.some((r) => taken.has(`SPV-${IN_CATALOGUE_OUT_OF_STOCK[r.ean!].code}`))) throw new Error("code clash — aborting");

  const snapPath = `ops/snapshots/legacy-spv-prefixed-${Date.now()}.json`;
  writeFileSync(snapPath, JSON.stringify([...move, ...hide].map((r) => ({ id: r.id, code: r.code, visible: r.visible, stock: r.stock, price: Number(r.price), purchasePrice: Number(r.purchasePrice) }))));
  for (const r of move) {
    const m = IN_CATALOGUE_OUT_OF_STOCK[r.ean!];
    const floor = Math.round(m.costExVat * 1.21 * 1.2);
    await prisma.product.update({
      where: { id: r.id },
      data: { code: `SPV-${m.code}`, purchasePrice: m.costExVat, stock: 0, price: Math.max(Number(r.price), floor), ...(r.compareAtPrice !== null && Number(r.compareAtPrice) <= floor ? { compareAtPrice: null } : {}) },
    });
  }
  for (const r of hide) await prisma.product.update({ where: { id: r.id }, data: { visible: false, stock: 0 } });
  await prisma.adminActivityLog.create({
    data: { action: "product.legacy_spv_prefixed", entityType: "Product", detail: `Legacy SPV<EAN> products: ${move.length} moved to SPV- codes (unavailable now), ${hide.length} not in the SPV B2B catalogue taken off sale (snapshot ${snapPath})` },
  });
  console.log("done", snapPath);
}
main().finally(() => prisma.$disconnect());
