// Manual flow for Arabic perfume descriptions (no API): `--dump=N --offset=K` writes N products that still need a
// description (with the supplier's English text) to ops/desc-work/todo.json; descriptions written by hand go to
// ops/desc-work/done-*.json as {code: html}; `--import=file` writes them (snapshot first, `--revert=snapshot`).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
const FEED = "https://www.perfumes-b2b.com/exchange/06560451-31AA-4C08-9B66-C149E1FF95DB/xml/product.xml?cy=czk";
const dec = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
const tag = (b: string, t: string) => { const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(b); return m ? dec(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()) : ""; };
const len = (h: string | null) => (h ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
async function main() {
  mkdirSync("ops/desc-work", { recursive: true });
  const rev = arg("revert");
  if (rev) { for (const s of JSON.parse(readFileSync(rev, "utf8"))) await prisma.product.update({ where: { id: s.id }, data: { description: s.description } }); return console.log("reverted"); }
  const imp = arg("import");
  if (imp) {
    const done: Record<string, string> = JSON.parse(readFileSync(imp, "utf8"));
    const ps = await prisma.product.findMany({ where: { code: { in: Object.keys(done) } }, select: { id: true, code: true, description: true } });
    const snap = ps.map((p) => ({ id: p.id, description: p.description }));
    mkdirSync("ops/snapshots", { recursive: true });
    const f = `ops/snapshots/arabic-descriptions-manual-${Date.now()}.json`; writeFileSync(f, JSON.stringify(snap));
    for (const p of ps) await prisma.product.update({ where: { id: p.id }, data: { description: done[p.code] } });
    return console.log("imported", ps.length, "snapshot", f);
  }
  const N = Number(arg("dump") ?? 0), OFF = Number(arg("offset") ?? 0);
  const xml = await (await fetch(FEED)).text(); const feed = new Map<string, string>();
  for (const raw of xml.split("<SHOPITEM>").slice(1)) { const b = raw.split("</SHOPITEM>")[0]; feed.set(tag(b, "ITEM_CODE"), tag(b, "DESCRIPTION")); }
  const cat = await prisma.category.findUnique({ where: { fullSlug: "parfemy/arabske-parfemy" } });
  const ids = (await prisma.category.findMany({ where: { OR: [{ id: cat!.id }, { fullSlug: { startsWith: "parfemy/arabske-parfemy/" } }] }, select: { id: true } })).map((c) => c.id);
  const all = await prisma.product.findMany({ where: { visible: true, code: { startsWith: "SPV-" }, categories: { some: { categoryId: { in: ids } } } }, select: { code: true, name: true, description: true, brand: { select: { name: true } } }, orderBy: [{ salesCount: "desc" }, { code: "asc" }] });
  const written = new Set<string>(); for (const f of readdirSync("ops/desc-work")) if (/^done-.*\.json$/.test(f)) Object.keys(JSON.parse(readFileSync(`ops/desc-work/${f}`, "utf8"))).forEach((c) => written.add(c));
  const todo = all.filter((p) => !written.has(p.code)).filter((p) => len(p.description) < 350 && (feed.get(p.code.replace(/^SPV-/, ""))?.length ?? 0) > 60);
  const pick = todo.slice(OFF, OFF + N).map((p) => ({ code: p.code, name: p.name, supplier: feed.get(p.code.replace(/^SPV-/, ""))!.slice(0, 900) }));
  writeFileSync("ops/desc-work/todo.json", JSON.stringify(pick, null, 1));
  console.log("todo total", todo.length, "dumped", pick.length);
}
main().finally(() => prisma.$disconnect());
