// Imports hand-made Slovak translations: JSON array of {code, nameSk, descriptionSk}.
//   npx tsx scripts/sk-import.ts ops/sk-work/done-01.json
// Sanity checks before writing: Czech-only letters (ě ř ů) mean text was left
// untranslated; empty fields and duplicate Slovak names are reported. Each run
// writes a revertable snapshot of the previous values to ops/snapshots.
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const CZECH_ONLY = /[ěřůĚŘŮ]/;

(async () => {
  const file = process.argv[2];
  if (!file) throw new Error("usage: sk-import.ts <done.json>");
  const rows: { code: string; nameSk: string; descriptionSk: string }[] = JSON.parse(readFileSync(file, "utf8"));
  const problems: string[] = [];
  const names = new Map<string, string>();
  for (const r of rows) {
    if (!r.nameSk?.trim() || !r.descriptionSk?.trim()) problems.push(`${r.code}: empty field`);
    if (CZECH_ONLY.test(r.nameSk ?? "")) problems.push(`${r.code}: Czech letters in name «${r.nameSk}»`);
    if (CZECH_ONLY.test(r.descriptionSk ?? "")) problems.push(`${r.code}: Czech letters in description`);
    const dup = names.get(r.nameSk);
    if (dup) problems.push(`${r.code}: same Slovak name as ${dup}`);
    names.set(r.nameSk, r.code);
  }
  if (problems.length) { console.log(problems.join("\n")); if (!process.argv.includes("--force")) { console.log(`\n${problems.length} problems — fix or rerun with --force`); return; } }
  const prev = await prisma.product.findMany({ where: { code: { in: rows.map((r) => r.code) } }, select: { code: true, nameSk: true, descriptionSk: true } });
  writeFileSync(`ops/snapshots/sk-translations-${Date.now()}.json`, JSON.stringify(prev));
  let n = 0;
  for (const r of rows) {
    const res = await prisma.product.updateMany({ where: { code: r.code }, data: { nameSk: r.nameSk.trim(), descriptionSk: r.descriptionSk.trim() } });
    n += res.count;
  }
  console.log(`imported ${n}/${rows.length}`);
  await prisma.$disconnect();
})();
