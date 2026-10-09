// Unified perfume names (owner request 2026-10-09): supplier names like "Lattafa Yara Candy EDP W 100ml" or
// "Hamidi Qamar Al Lail Eau de Parfum for Men 100 ml" become
//   "<brand + name> – <Czech concentration> <dámská|pánská|unisex> – <size>"
// e.g. "Lattafa Yara Candy – parfémovaná voda dámská – 100 ml". The product card already splits on " – " into a
// title and a grey subtitle (same scheme as the GVS cosmetics). Slugs are NOT touched (indexed URLs stay).
// Heureka matches offers by PRODUCTNAME, so the old supplier name is kept in Product.heurekaName when that is empty.
//
//   npx tsx scripts/rename-perfumes.ts            dry run → ops/perfume-names-plan.csv
//   npx tsx scripts/rename-perfumes.ts --apply    writes names (+ snapshot ops/snapshots/perfume-names-*.json)
//   npx tsx scripts/rename-perfumes.ts --revert=PATH
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.find((a) => a.startsWith("--revert="))?.slice(9);

type Gender = "dámská" | "pánská" | "unisex";
const CONC: [RegExp, string][] = [
  [/\b(?:concentrated perfum(?:e|ed) oil|perfum(?:e|ed) oil|CPO|attar|parfémový olej|parfémovaný olej)\b/i, "parfémový olej"],
  [/\b(?:extrait de parfum|parfum extrait|perfume extract|ExDP|extrait|parfémový extrakt|parfémový extrakt)\b/i, "parfémový extrakt"],
  [/\b(?:eau de parfum|aqua parfum|perfumed water|EDP|parfémovaná voda|parfémová voda)\b/i, "parfémovaná voda"],
  [/\b(?:eau de toilette|EDT|toaletní voda)\b/i, "toaletní voda"],
  [/\b(?:eau de cologne|EDC|kolínská voda)\b/i, "kolínská voda"],
];
const SKIP_RE = /\b(set|gift ?set|giftset|coffret|air freshener|osvěžovač|hair mist|body mist|mist|bakhoor|deodorant|deo|shower gel|candle|diffuser|tester)\b|\d\s?ml\s*\+/i;

function genderFromName(s: string): Gender | null {
  if (/(?:^|\s)W(?:\s|$)|\bfor (?:women|her)\b|\bdámská\b/i.test(s) && !/(?:^|\s)[MU](?:\s|$)/.test(s)) return "dámská";
  if (/(?:^|\s)M(?:\s|$)|\bfor (?:men|him)\b|\bpánská\b/i.test(s) && !/(?:^|\s)[WU](?:\s|$)/.test(s)) return "pánská";
  if (/(?:^|\s)U(?:\s|$)|\bunisex\b/i.test(s)) return "unisex";
  return null;
}

export function convert(name: string, catGender: Gender | null): { out: string; why: string } | null {
  if (SKIP_RE.test(name)) return null;
  let s = name.replace(/\s+/g, " ").trim();
  // size = last "<n> ml"
  const sizes = [...s.matchAll(/(\d+(?:[.,]\d+)?)\s?ml\b/gi)];
  if (!sizes.length) return null;
  const last = sizes[sizes.length - 1];
  const size = `${last[1].replace(",", ".")} ml`;
  s = (s.slice(0, last.index!) + " " + s.slice((last.index ?? 0) + last[0].length)).trim();
  let conc: string | null = null;
  for (const [re, label] of CONC) {
    if (re.test(s)) { conc = label; s = s.replace(re, " "); break; }
  }
  if (!conc && /\b(?:perfume for (?:men|women)|parfém pro (?:muže|ženy))\b/i.test(s)) { conc = "parfém"; s = s.replace(/\b(?:perfume|parfém)(?= (?:for|pro) )/i, " "); }
  if (!conc) {
    // plain "Parfum" at the end of the name (pure perfume), only when it follows the actual name
    if (/\bParfum\b(?=\s*(?:[WMU])?\s*$)/.test(s)) { conc = "parfém"; s = s.replace(/\bParfum\b/, " "); }
  }
  if (!conc) return null;
  const g = genderFromName(s) ?? (/\bpro ženy\b/i.test(s) ? "dámská" : /\bpro muže\b/i.test(s) ? "pánská" : /\((?:woman|women)\)/i.test(s) ? "dámská" : /\((?:man|men)\)/i.test(s) ? "pánská" : null) ?? catGender;
  s = s
    .replace(/\bfor (?:women|men|her|him)\b/gi, " ")
    .replace(/\bpro (?:ženy|muže|dámy|pány)\b/gi, " ")
    .replace(/\((?:woman|women|man|men|unisex)\)/gi, " ")
    .replace(/\bunisex\b/gi, " ")
    .replace(/(?:^|\s)[WMUF](?=\s|$)/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[\s,–-]+$/g, "")
    .trim();
  if (s.length < 4) return null;
  const masculine = !conc.endsWith("voda");
  const adj = g === "dámská" ? (masculine ? "dámský" : "dámská") : g === "pánská" ? (masculine ? "pánský" : "pánská") : g;
  const sub = [conc, adj].filter(Boolean).join(" ");
  return { out: `${s} – ${sub} – ${size}`, why: `${conc}|${g ?? "?"}` };
}

async function revert(path: string) {
  const snap = JSON.parse(readFileSync(path, "utf8")) as { id: string; name: string; heurekaName: string | null }[];
  for (const r of snap) await prisma.product.update({ where: { id: r.id }, data: { name: r.name, heurekaName: r.heurekaName } });
  console.log("Reverted", snap.length, "names");
}

async function main() {
  if (REVERT) return revert(REVERT);
  const ps = await prisma.product.findMany({
    where: { visible: true, categories: { some: { category: { fullSlug: { startsWith: "parfemy" } } } } },
    select: { id: true, code: true, name: true, heurekaName: true, brand: { select: { name: true } }, categories: { select: { category: { select: { fullSlug: true } } } } },
  });
  const rows: { id: string; code: string; before: string; after: string; why: string; heurekaName: string | null }[] = [];
  const skipped: string[] = [], unparsed: string[] = [];
  for (const p of ps) {
    const slugs = p.categories.map((c) => c.category.fullSlug);
    if (slugs.some((s) => s.startsWith("parfemy/doplnky") || s.startsWith("parfemy/darkove-sady"))) { skipped.push(p.name); continue; }
    if (p.name.includes(" – ")) { skipped.push(p.name); continue; } // already in the new scheme
    const catGender: Gender | null = slugs.some((s) => s.includes("damske-parfemy")) ? "dámská" : slugs.some((s) => s.includes("panske-parfemy")) ? "pánská" : slugs.some((s) => s.includes("unisex-parfemy")) ? "unisex" : null;
    const r = convert(p.name, catGender);
    if (!r) { unparsed.push(p.name); continue; }
    rows.push({ id: p.id, code: p.code, before: p.name, after: r.out, why: r.why, heurekaName: p.heurekaName });
  }
  console.log(`perfume products ${ps.length}: renamed ${rows.length}, left as is ${unparsed.length}, skipped (sets/accessories/already new) ${skipped.length}`);
  const dist = new Map<string, number>(); for (const r of rows) dist.set(r.why, (dist.get(r.why) ?? 0) + 1);
  console.log([...dist.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  "));
  const pick = (a: unknown[], n: number) => a.sort(() => Math.random() - 0.5).slice(0, n);
  console.log("\nSAMPLES:"); for (const r of pick([...rows], 40) as typeof rows) console.log(`  ${r.before}\n   → ${r.after}`);
  console.log("\nLEFT AS IS (sample):"); for (const n of pick([...unparsed], 40) as string[]) console.log("  ", n);
  mkdirSync("ops", { recursive: true });
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  writeFileSync("ops/perfume-names-plan.csv", "code,before,after\n" + rows.map((r) => [r.code, esc(r.before), esc(r.after)].join(",")).join("\n"));
  if (!APPLY) return console.log("\nDRY RUN — plan in ops/perfume-names-plan.csv");
  mkdirSync("ops/snapshots", { recursive: true });
  const snapPath = `ops/snapshots/perfume-names-${Date.now()}.json`;
  writeFileSync(snapPath, JSON.stringify(rows.map((r) => ({ id: r.id, name: r.before, heurekaName: r.heurekaName }))));
  for (const r of rows) await prisma.product.update({ where: { id: r.id }, data: { name: r.after, heurekaName: r.heurekaName ?? r.before } });
  console.log(`\nAPPLIED ${rows.length} renames. Snapshot ${snapPath}`);
}
if (require.main === module || process.argv[1]?.endsWith("rename-perfumes.ts")) main().finally(() => prisma.$disconnect());
