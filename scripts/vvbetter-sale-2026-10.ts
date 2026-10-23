// VVBETTER −30 % sale until 31.10.2026, matching GVS's own −30 % wholesale promo (01.10–31.10): the sale price is
// exactly our normal formula applied to the promo cost, so the margin only holds for stock ordered by 31.10.
// Teca Lifting Moisture Cream (GVS-2554853, the only seller) is excluded; samples, defect listings and
// out-of-stock items too. Omnibus: the strike-through price is the old price (constant for 30+ days) — except the two
// products whose price changed on 2026-10-22 (Cleansing Oil raised 327 -> 563, Mud Mask 349 -> 399): the oil gets no
// strike-through at all (its sale price is above the old 327), the mask is compared with 349 (its 30-day low).
//
//   npx tsx --env-file=.env scripts/vvbetter-sale-2026-10.ts            dry run
//   npx tsx --env-file=.env scripts/vvbetter-sale-2026-10.ts --apply    start the sale (snapshot ops/snapshots/vvbetter-sale-2026-10.json)
//   npx tsx --env-file=.env scripts/vvbetter-sale-2026-10.ts --revert   end it (restores prices/compareAtPrice from the snapshot)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { logAdminActivity } from "../src/lib/admin/activity-log";

const SNAP = "ops/snapshots/vvbetter-sale-2026-10.json";
const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.includes("--revert");
const EXCLUDE = new Set(["GVS-2554853"]);

async function main() {
  if (REVERT) {
    const snap = JSON.parse(await readFile(SNAP, "utf-8")) as { id: string; code: string; price: number; compareAtPrice: number | null }[];
    for (const s of snap) {
      console.log(`REVERT ${s.code} -> ${s.price}${s.compareAtPrice ? ` (cmp ${s.compareAtPrice})` : ""}`);
      await prisma.product.update({ where: { id: s.id }, data: { price: s.price, compareAtPrice: s.compareAtPrice } });
    }
    await logAdminActivity({ action: "product.vvbetter_sale_end", entityType: "Product", detail: `VVBETTER sale ended, ${snap.length} products restored` });
    return;
  }
  const ps = await prisma.product.findMany({
    where: { brand: { name: "VVBETTER" }, visible: true, isDefective: false, stock: { gt: 0 } },
    select: { id: true, code: true, name: true, price: true, compareAtPrice: true, purchasePrice: true },
    orderBy: { code: "asc" },
  });
  const targets = ps.filter((p) => !EXCLUDE.has(p.code) && Number(p.price) >= 100);
  const snap = targets.map((p) => ({ id: p.id, code: p.code, price: Number(p.price), compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice) : null }));
  for (const p of targets) {
    const old = Number(p.price);
    let price = Math.round(old * 0.7);
    let cmp: number | null = old;
    if (p.code === "GVS-5904305") { price = 394; cmp = null; } // oil: promo-cost formula, no strike-through (see header)
    if (p.code === "GVS-9177655") cmp = 349;
    console.log(`${p.code.padEnd(12)} ${p.name.slice(0, 45).padEnd(45)} ${old} -> ${price}${cmp ? `  (was ${cmp}, -${Math.round((1 - price / cmp) * 100)} %)` : "  (no strike-through)"}`);
    if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { price, compareAtPrice: cmp } });
  }
  if (APPLY) {
    await mkdir("ops/snapshots", { recursive: true });
    await writeFile(SNAP, JSON.stringify(snap, null, 1));
    await logAdminActivity({ action: "product.vvbetter_sale", entityType: "Product", detail: `VVBETTER -30 % sale until 31.10.2026 on ${targets.length} products` });
  }
  console.log(APPLY ? `APPLIED ${targets.length}` : `DRY RUN ${targets.length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
