// One-off (2026-10-15): the first ~600 products of the old shop were created by hand with the
// EAN as `code`, no purchase price, and stay outside the Tamda stock sync (it only looks at
// `TDE-` codes). This moves the ones Tamda really carries under the sync (code -> TDE-<EAN>,
// the nightly check then fills stock, purchase price and lifts the price to cost × 1.3),
// hides the legacy duplicates of products that already exist as TDE- listings, and takes the
// drugstore items Tamda no longer carries off sale. Goods held in our own stock (ownStock > 0),
// perfumes and everything not carried by Tamda are left alone.
//
// Inputs: EAN lists from a live check of Tamda's "Objednávka z CSV" page (not found / zero stock).
// Usage: tsx scripts/convert-legacy-ean-products-to-tamda.ts <notFound.txt> <zero.txt> [--apply]
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const NOT_CARRIED_DROGERIE = new Set(
  "8717163947739,8717163947708,3607340625534,3616305268129,3600523524761,3600524142056,9000100256087,9000101658835,3014260101473,8718951717084,3574661657462,3574661860503".split(","),
);

async function main() {
  const [nfFile, zeroFile] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const apply = process.argv.includes("--apply");
  const notFound = new Set(readFileSync(nfFile, "utf8").trim().split(","));
  const zero = new Set(readFileSync(zeroFile, "utf8").trim().split(","));

  const legacy = await prisma.product.findMany({
    where: {
      ownStock: 0,
      ean: { not: null },
      NOT: ["SPV-", "TDE-", "GVS-", "PWH-", "ROM-"].map((p) => ({ code: { startsWith: p } })),
    },
    select: { id: true, code: true, ean: true, visible: true, stock: true },
  });
  const tdeEans = new Set((await prisma.product.findMany({ where: { code: { startsWith: "TDE-" } }, select: { ean: true } })).map((p) => p.ean));

  const toConvert = legacy.filter((p) => !notFound.has(p.ean!) && !tdeEans.has(p.ean));
  const toHideDuplicate = legacy.filter((p) => !notFound.has(p.ean!) && tdeEans.has(p.ean) && p.visible);
  const toDelist = legacy.filter((p) => notFound.has(p.ean!) && NOT_CARRIED_DROGERIE.has(p.ean!));
  console.log({ legacy: legacy.length, convert: toConvert.length, convertZeroStock: toConvert.filter((p) => zero.has(p.ean!)).length, hideDuplicates: toHideDuplicate.length, delist: toDelist.length });

  if (!apply) return;
  const snapshot = [...toConvert, ...toHideDuplicate, ...toDelist].map((p) => ({ id: p.id, code: p.code, visible: p.visible, stock: p.stock }));
  const snapPath = `ops/snapshots/legacy-ean-to-tamda-${Date.now()}.json`;
  writeFileSync(snapPath, JSON.stringify(snapshot));
  console.log("snapshot", snapPath);

  for (const p of toConvert) {
    await prisma.product.update({ where: { id: p.id }, data: { code: `TDE-${p.ean}`, ...(zero.has(p.ean!) ? { stock: 0 } : {}) } });
  }
  for (const p of toHideDuplicate) await prisma.product.update({ where: { id: p.id }, data: { visible: false } });
  for (const p of toDelist) await prisma.product.update({ where: { id: p.id }, data: { visible: false, stock: 0 } });
  await prisma.adminActivityLog.create({
    data: {
      action: "product.legacy_ean_to_tamda",
      entityType: "Product",
      detail: `Legacy EAN-coded products: ${toConvert.length} moved to TDE- codes (Tamda sync), ${toHideDuplicate.length} duplicates hidden, ${toDelist.length} delisted (snapshot ${snapPath})`,
    },
  });
  console.log("done");
}
main().finally(() => prisma.$disconnect());
