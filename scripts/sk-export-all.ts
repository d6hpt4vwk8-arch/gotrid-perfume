// Next batch of visible products without a Slovak translation, in SEO priority order, written in a compact
// form that is quick to translate by hand (see scripts/sk-compact.py for the reverse step).
//   npx tsx scripts/sk-export-all.ts --n=40 --out=ops/sk-work2/b01.txt
// Priority: own stock → ever sold → Arabic/niche brands (our focus) → in stock by stock level → the rest.
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const N = Number(arg("n", "40"));
const OUT = arg("out", "ops/sk-work2/batch.txt");
const OFFSET = Number(arg("offset", "0"));
const ONLY_FOCUS = process.argv.includes("--focus");
const FOCUS = /armaf|al haramain|afnan|lattafa|rasasi|ajmal|swiss arabian|nabeel|french avenue|fragrance world|maison alhambra|khadlaj|orientica|rayhaan|ard al zaafaran|gulf orchid|zimaya|paris corner|club de nuit|expressions/i;

const LABELS: Record<string, string> = {
  "Pro koho:": "K", "Použití:": "U", "Hlavní přínosy:": "B", "Hlavní tóny:": "T", "Kdy ji nosit:": "W", "Charakter:": "C",
  "Vůně:": "V", "Vlastnosti:": "Q", "Doba hoření:": "H",
};

function compact(desc: string): string {
  const m = desc.match(/^<p>([\s\S]*?)<\/p>(?:<ul>([\s\S]*)<\/ul>)?$/);
  if (!m) return `RAW: ${desc}`;
  const lines = [`P: ${m[1]}`];
  if (m[2]) {
    for (const li of m[2].matchAll(/<li><strong>([^<]+)<\/strong>\s*([\s\S]*?)<\/li>/g)) {
      const code = LABELS[li[1]];
      if (!code) return `RAW: ${desc}`;
      lines.push(`${code}: ${li[2]}`);
    }
    if (!/^(<li>[\s\S]*?<\/li>)+$/.test(m[2])) return `RAW: ${desc}`;
  }
  return lines.join("\n");
}

(async () => {
  const rows = await prisma.product.findMany({
    where: { visible: true, OR: [{ nameSk: null }, { nameSk: "" }] },
    select: { code: true, name: true, description: true, ownStock: true, stock: true, salesCount: true, brand: { select: { name: true } } },
  });
  const score = (r: (typeof rows)[number]) =>
    (r.ownStock > 0 ? 4e9 : 0) + (r.salesCount > 0 ? 2e9 + r.salesCount * 1e4 : 0) + (FOCUS.test(`${r.brand?.name ?? ""} ${r.name}`) ? 1e9 : 0) + (r.stock > 0 ? 5e8 : 0) + Math.min(r.stock, 9999);
  const pool = ONLY_FOCUS ? rows.filter((r) => FOCUS.test(`${r.brand?.name ?? ""} ${r.name}`)) : rows;
  pool.sort((a, b) => score(b) - score(a));
  const batch = pool.slice(OFFSET, OFFSET + N);
  const out = batch
    .map((r) => `#${r.code}\nN: ${r.name}\n${r.description ? compact(r.description) : "P: "}`)
    .join("\n\n");
  writeFileSync(OUT, out + "\n");
  console.log(`remaining ${pool.length}; wrote ${batch.length} (offset ${OFFSET}) → ${OUT}; ${out.length} chars`);
  await prisma.$disconnect();
})();
