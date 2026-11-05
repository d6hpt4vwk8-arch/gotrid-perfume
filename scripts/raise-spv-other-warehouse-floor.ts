// One-off: lifts the sell price of SP Venture products that ship from another warehouse
// (slowerDelivery = not in the feed) to wholesale × 1.21 × 1.3 — the same floor the stock sync
// now uses (MARKUP_OTHER_WAREHOUSE in src/lib/sync/spventure-stock.ts). Without this the new
// floor only reaches a product when the daily sync resolves it on the supplier's site.
//
//   npx tsx --env-file=.env scripts/raise-spv-other-warehouse-floor.ts           dry run
//   npx tsx --env-file=.env scripts/raise-spv-other-warehouse-floor.ts --apply   write (snapshot saved first)
//   npx tsx --env-file=.env scripts/raise-spv-other-warehouse-floor.ts --revert <snapshot.json>
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { logAdminActivity } from "../src/lib/admin/activity-log";
import { prisma } from "../src/lib/prisma";

const VAT_FACTOR = 1.21;
const MARKUP = 1.3;
const FLOOR_TOLERANCE = 0.97;

async function plan() {
  const products = await prisma.product.findMany({
    where: { code: { startsWith: "SPV-" }, slowerDelivery: true, ownStock: 0 },
    select: { id: true, code: true, name: true, price: true, compareAtPrice: true, purchasePrice: true, visible: true, stock: true },
  });
  return products
    .map((p) => {
      const cost = Number(p.purchasePrice);
      const floor = cost > 0 ? Math.round(cost * VAT_FACTOR * MARKUP) : 0;
      return { ...p, price: Number(p.price), compareAtPrice: p.compareAtPrice === null ? null : Number(p.compareAtPrice), cost, floor };
    })
    .filter((p) => p.floor > 0 && p.price < p.floor * FLOOR_TOLERANCE);
}

async function main() {
  const revertIdx = process.argv.indexOf("--revert");
  if (revertIdx !== -1) {
    const rows: { id: string; price: number; compareAtPrice: number | null }[] = JSON.parse(await readFile(process.argv[revertIdx + 1], "utf8"));
    for (const r of rows) await prisma.product.update({ where: { id: r.id }, data: { price: r.price, compareAtPrice: r.compareAtPrice } });
    console.log(`reverted ${rows.length}`);
    return;
  }

  const todo = await plan();
  const shown = todo.filter((p) => p.visible && p.stock > 0);
  const avgRise = todo.reduce((s, p) => s + (p.floor / p.price - 1), 0) / (todo.length || 1);
  console.log(`${todo.length} products below the new floor (${shown.length} visible and in stock), average rise ${(avgRise * 100).toFixed(1)} %`);
  for (const p of shown.slice(0, 8)) console.log(`  ${p.code} ${p.name.slice(0, 50)}: ${p.price} -> ${p.floor} (cost incl. VAT ${(p.cost * VAT_FACTOR).toFixed(0)})`);

  if (!process.argv.includes("--apply")) {
    console.log("dry run — pass --apply to write");
    return;
  }
  await mkdir("ops/snapshots", { recursive: true });
  const file = `ops/snapshots/spv-otherwh-floor-${Date.now()}.json`;
  await writeFile(file, JSON.stringify(todo.map((p) => ({ id: p.id, price: p.price, compareAtPrice: p.compareAtPrice }))));
  for (const p of todo) {
    await prisma.product.update({
      where: { id: p.id },
      data: { price: p.floor, ...(p.compareAtPrice !== null && p.compareAtPrice <= p.floor ? { compareAtPrice: null } : {}) },
    });
  }
  await logAdminActivity({
    action: "product.spventure_price_floor",
    entityType: "Product",
    detail: `SP Venture other-warehouse floor (wholesale × 1.21 × 1.3): ${todo.length} sell prices raised, snapshot ${file}`,
  });
  console.log(`updated ${todo.length}; snapshot ${file}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
