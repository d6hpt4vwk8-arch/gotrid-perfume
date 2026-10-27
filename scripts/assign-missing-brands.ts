// Fills Product.brandId for visible products with no brand when the name starts with / contains a
// clear brand (Tamda drugstore lines, a few perfumes). Anything ambiguous is only listed, never guessed.
// Usage: tsx --env-file=.env scripts/assign-missing-brands.ts [--apply]   (dry run by default; snapshot is written on --apply)
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/slug";

const p = new PrismaClient();
const apply = process.argv.includes("--apply");

// [name regex, brand name]
const RULES: [RegExp, string][] = [
  [/^BU deodorant/i, "BU"],
  [/^Adidias roll on/i, "Adidas"],
  [/^Black & White Roll on/i, "Black & White"],
  [/^Bluebeards Revenge/i, "Bluebeards Revenge"],
  [/^Carin /i, "Carin"],
  [/^Colutti /i, "Colutti"],
  [/^Dental Delight/i, "Dental Delight"],
  [/^Dr Devil/i, "Dr. Devil"],
  [/^Embresh/i, "Embresh"],
  [/^Escenti/i, "Escenti"],
  [/^Est[ée]e Lauder/i, "Estee Lauder"],
  [/^Evita /i, "Evita"],
  [/^Fre-Pro/i, "Fre-Pro"],
  [/^Gel Fresh/i, "Gel Fresh"],
  [/^La Prima/i, "La Prima"],
  [/^Mr&Mrs Jeff/i, "Mr&Mrs Jeff"],
  [/ de Cartier/i, "Cartier"],
  [/^Olea /i, "Olea"],
  [/^Perry Ellis/i, "Perry Ellis"],
  [/^Pierre Cardin/i, "Pierre Cardin"],
  [/^Power Air/i, "Power Air"],
  [/^Pronto /i, "Pronto"],
  [/^Reminiscence/i, "Reminiscence"],
  [/^Simply Venus/i, "Gillette"],
  [/^Soft Zubní kartáček Rebi-dental/i, "Rebi Dental"],
  [/^Spazzolino/i, "Spazzolino"],
  [/^Tesori d Oriente/i, "Tesori d'Oriente"],
  [/^Tri Force/i, "Tri Force"],
  [/^WC Net/i, "WC Net"],
  [/^XOC /i, "XOC"],
  [/^ALKMENE/i, "Alkmene"],
];

(async () => {
  const prods = await p.product.findMany({ where: { brandId: null, visible: true }, select: { id: true, code: true, name: true } });
  const brands = await p.brand.findMany({ select: { id: true, name: true } });
  const byLower = new Map(brands.map((b) => [b.name.toLowerCase(), b]));
  const plan: { id: string; code: string; name: string; brand: string }[] = [];
  const unresolved: typeof prods = [];
  for (const x of prods) {
    const rule = RULES.find(([re]) => re.test(x.name));
    if (rule) plan.push({ ...x, brand: rule[1] }); else unresolved.push(x);
  }
  const brandNames = [...new Set(plan.map((x) => x.brand))];
  const newBrands = brandNames.filter((b) => !byLower.has(b.toLowerCase()));
  console.log(`${prods.length} without brand → ${plan.length} resolvable, ${unresolved.length} left`);
  console.log("existing brands used:", brandNames.filter((b) => byLower.has(b.toLowerCase())).join(", "));
  console.log("NEW brands to create:", newBrands.join(", ") || "-");
  const per = new Map<string, number>(); for (const x of plan) per.set(x.brand, (per.get(x.brand) ?? 0) + 1);
  console.log([...per].map(([b, n]) => `${b} ×${n}`).join("; "));
  console.log("\nLEFT WITHOUT BRAND:\n" + unresolved.map((x) => `${x.code} | ${x.name}`).join("\n"));
  if (!apply) return;
  mkdirSync("ops/snapshots", { recursive: true });
  const stamp = Date.now();
  writeFileSync(`ops/snapshots/missing-brands-${stamp}.json`, JSON.stringify({ products: plan.map((x) => ({ id: x.id, code: x.code, brandId: null })), createdBrands: newBrands }, null, 1));
  const ids = new Map<string, string>();
  for (const name of brandNames) {
    const ex = byLower.get(name.toLowerCase());
    if (ex) { ids.set(name, ex.id); continue; }
    const created = await p.brand.create({ data: { name, slug: slugify(name) } });
    ids.set(name, created.id);
  }
  for (const x of plan) await p.product.update({ where: { id: x.id }, data: { brandId: ids.get(x.brand)! } });
  console.log(`APPLIED ${plan.length} products, snapshot ops/snapshots/missing-brands-${stamp}.json`);
})().finally(() => p.$disconnect());
