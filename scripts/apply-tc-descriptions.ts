// Applies the regenerated CZ/SK descriptions (ops/sk-tc/desc-new.json, built by ops/sk-tc/run.js) to the Trade Concept
// (TCN-) products and the older Tamda Arôme products. Writes a revertable snapshot of the previous texts first.
//   npx tsx --env-file=.env scripts/apply-tc-descriptions.ts            apply
//   npx tsx --env-file=.env scripts/apply-tc-descriptions.ts --revert <snapshot.json>
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

(async () => {
  if (process.argv[2] === "--revert") {
    const prev: { code: string; description: string | null; descriptionSk: string | null }[] = JSON.parse(readFileSync(process.argv[3], "utf8"));
    for (const p of prev) await prisma.product.updateMany({ where: { code: p.code }, data: { description: p.description, descriptionSk: p.descriptionSk } });
    console.log(`reverted ${prev.length}`);
  } else {
    const rows: { code: string; description: string; descriptionSk: string | null }[] = JSON.parse(readFileSync("ops/sk-tc/desc-new.json", "utf8"));
    const prev = await prisma.product.findMany({ where: { code: { in: rows.map((r) => r.code) } }, select: { code: true, description: true, descriptionSk: true } });
    const snap = `ops/snapshots/tc-descriptions-before-${Date.now()}.json`;
    writeFileSync(snap, JSON.stringify(prev));
    let n = 0;
    for (const r of rows) {
      const res = await prisma.product.updateMany({ where: { code: r.code }, data: { description: r.description, ...(r.descriptionSk ? { descriptionSk: r.descriptionSk } : {}) } });
      n += res.count;
    }
    console.log(`updated ${n}/${rows.length}; snapshot ${snap}`);
  }
  await prisma.$disconnect();
})();
