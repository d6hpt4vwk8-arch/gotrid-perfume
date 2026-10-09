// Brings the Korean-brand products that arrive via SP Venture into the "Korejská kosmetika" category and gives
// them the same look as the GVS Korean range: a Czech descriptor in the name ("Brand Product – pleťové sérum
// s niacinamidem – 30 ml") and a short Czech description (intro + bullets + usage). Only facts that are in the
// product name are used (type, key ingredients, size, SPF); nothing is invented. Supplier descriptions that
// already exist are kept as the intro paragraph.
//   npx tsx scripts/korean-spv-to-kbeauty.ts            dry run → ops/kbeauty-spv-plan.csv
//   npx tsx scripts/korean-spv-to-kbeauty.ts --apply    writes names, descriptions, category (snapshot in ops/snapshots)
//   npx tsx scripts/korean-spv-to-kbeauty.ts --revert=PATH
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.find((a) => a.startsWith("--revert="))?.slice(9);

const KOREAN_BRANDS = [
  "AXIS-Y", "Anua", "APLB", "Beauty Of Joseon", "Beauty of Joseon", "Biodance", "Celimax", "Cosrx", "Dr. Althea",
  "Frudia", "Haruharu Wonder", "K-SECRET", "Medi-Peel", "Medicube", "Missha", "Pyunkang Yul", "SKIN1004", "Some By Mi", "VT Cosmetics",
];

interface Kind { re: RegExp; noun: string; label: string; use: string }
// Order matters: first match wins.
const KINDS: Kind[] = [
  { re: /\b(kit|set)\b/i, noun: "sada", label: "sada pro péči o pleť", use: "Produkty ze sady používejte podle pokynů na obalu." },
  { re: /sachet/i, noun: "sada vzorků", label: "sada vzorků pro péči o pleť", use: "Vzorky používejte postupně v rámci běžné péče o pleť." },
  { re: /pimple master patch|acne.*patch|\bpatch\b/i, noun: "náplasti", label: "náplasti na akné", use: "Přiložte náplast na čistou, suchou pleť přímo na projev a nechte působit podle pokynů na obalu." },
  { re: /bb cream/i, noun: "BB krém", label: "BB krém", use: "Naneste na čistou pleť jako závěrečný krok péče a krytí." },
  { re: /cleansing bar/i, noun: "čisticí mýdlo", label: "čisticí mýdlo", use: "Napěňte ve vlhkých dlaních, jemně vmasírujte do vlhké pleti a důkladně opláchněte." },
  { re: /cleansing oil/i, noun: "čisticí olej", label: "čisticí olej", use: "Naneste suchýma rukama na suchou pleť, jemně vmasírujte, přidejte trochu vody a opláchněte; první krok dvoufázového čištění." },
  { re: /cleansing balm/i, noun: "čisticí balzám", label: "čisticí balzám", use: "Naneste suchýma rukama na suchou pleť, vmasírujte, emulgujte vodou a opláchněte." },
  { re: /cleansing water/i, noun: "čisticí voda", label: "čisticí voda", use: "Navlhčete vatový tampon a jemně otřete pleť; podle potřeby opláchněte." },
  { re: /cleansing gel|gel cleanser|facial cleanser|daily gentle cleanser|cleanser/i, noun: "čisticí gel", label: "čisticí gel", use: "Napěňte ve vlhkých dlaních, jemně vmasírujte do vlhké pleti a důkladně opláchněte." },
  { re: /foam|bubble cleanser|ampoule foam/i, noun: "čisticí pěna", label: "čisticí pěna", use: "Napěňte ve vlhkých dlaních, jemně vmasírujte do vlhké pleti a důkladně opláchněte." },
  { re: /toner pad|zero pore pad|\bpad\b/i, noun: "tonikové polštářky", label: "tonikové polštářky", use: "Otřete čistou pleť polštářkem, vyhněte se okolí očí; používejte podle citlivosti pleti, ne každý den." },
  { re: /peeling gel/i, noun: "peelingový gel", label: "peelingový gel", use: "Naneste na suchou pleť, jemně masírujte do vytvoření drobných váleček a opláchněte." },
  { re: /power liquid/i, noun: "exfoliační tonikum", label: "exfoliační tonikum", use: "Naneste na čistou pleť vatovým tamponem; začněte 1–2× týdně a vždy používejte opalovací krém." },
  { re: /\btoner\b/i, noun: "pleťové tonikum", label: "pleťové tonikum", use: "Po čištění naneste na pleť dlaněmi nebo vatovým tamponem a nechte vstřebat před dalšími kroky." },
  { re: /mist essence|\bmist\b/i, noun: "pleťová mlha", label: "pleťová mlha", use: "Rozprašte z dostatečné vzdálenosti na čistou pleť, popřípadě během dne." },
  { re: /essence water/i, noun: "esenciální voda", label: "esenciální voda", use: "Po čištění naneste na pleť dlaněmi nebo vatovým tamponem." },
  { re: /sun serum|sunscreen|sun cream|sun essence|relief sun|uv shield/i, noun: "opalovací přípravek", label: "opalovací přípravek", use: "Naneste jako poslední krok ranní péče dostatečné množství na obličej a krk, opakujte během dne." },
  { re: /sleeping pack|sleeping mask|night wrapping mask|overnight (spa )?mask|overnight mask/i, noun: "noční maska", label: "noční maska", use: "Naneste na čistou pleť jako poslední krok večerní péče, ráno opláchněte." },
  { re: /sheet mask|deep mask|real deep mask/i, noun: "plátýnková maska", label: "plátýnková maska", use: "Přiložte masku na čistou pleť na 15–20 minut, poté zbytek esence jemně vklepejte do pleti." },
  { re: /pore mask|glaze mask|calming mask|glow mask|\bmask\b/i, noun: "pleťová maska", label: "pleťová maska", use: "Naneste na čistou pleť, nechte působit podle pokynů na obalu a opláchněte." },
  { re: /eye cream/i, noun: "oční krém", label: "oční krém", use: "Malé množství jemně vklepejte kolem očí, ráno i večer." },
  { re: /eye serum/i, noun: "oční sérum", label: "oční sérum", use: "Malé množství jemně vklepejte kolem očí, ráno i večer." },
  { re: /reedle shot|booster/i, noun: "pleťový booster", label: "pleťový booster", use: "Po čištění a tonikum naneste na pleť podle pokynů na obalu, poté pokračujte krémem." },
  { re: /ampoule|ampule|serum/i, noun: "pleťové sérum", label: "pleťové sérum", use: "Po tonikum naneste několik kapek na čistou pleť, jemně vklepejte a pokračujte krémem." },
  { re: /facial oil|\boil\b/i, noun: "pleťový olej", label: "pleťový olej", use: "Několik kapek vmasírujte do čisté pleti jako poslední krok péče." },
  { re: /lotion|emulsion|rice milk|milk/i, noun: "pleťové mléko", label: "pleťové mléko", use: "Po tonikum a séru naneste na obličej a krk, ráno i večer." },
  { re: /water gel|gel cream|jelly cream|moisture gel|booster gel|\bgel\b/i, noun: "gelový krém", label: "gelový krém", use: "Naneste na čistou pleť jako hydratační krok péče, ráno i večer." },
  { re: /cream/i, noun: "pleťový krém", label: "pleťový krém", use: "Po séru naneste na obličej a krk, ráno i večer." },
  { re: /essence/i, noun: "esence", label: "esence", use: "Po čištění naneste na pleť a jemně vklepejte, pak pokračujte séra a krémy." },
];

const ACTIVES: [RegExp, string][] = [
  [/aha.?bha.?pha/i, "AHA, BHA a PHA kyselinami"], [/niacinamide/i, "niacinamidem"], [/salicylic/i, "kyselinou salicylovou"], [/(?<!aha.?)\bbha\b(?!.?pha)/i, "BHA"], [/\baha\b(?!.?bha.?pha)/i, "AHA kyselinami"],
  [/retinol/i, "retinolem"], [/retinal(?!.*retinol)/i, "retinalem"], [/vitamin c/i, "vitaminem C"], [/centella|cica/i, "centellou asijskou"],
  [/propolis/i, "propolisem"], [/snail/i, "hlemýždím mucinem"], [/ginseng/i, "ženšenem"], [/rice|black rice/i, "rýží"],
  [/green tea/i, "zeleným čajem"], [/peptide/i, "peptidy"], [/hyalu|hyaluronic/i, "kyselinou hyaluronovou"], [/collagen/i, "kolagenem"],
  [/pdrn/i, "PDRN"], [/cera|ceramide|ceramid/i, "ceramidy"], [/heart ?leaf|hearleaf/i, "houttuynií (heartleaf)"], [/kojic/i, "kojovou kyselinou"],
  [/glutathione/i, "glutathionem"], [/arbutin/i, "arbutinem"], [/bakuchiol/i, "bakuchiolem"], [/turmeric/i, "kurkumou"],
  [/aloe/i, "aloe"], [/jojoba/i, "jojobou"], [/sea kelp/i, "mořskou řasou"], [/noni/i, "noni"], [/red bean/i, "červenými fazolemi"],
  [/green plum/i, "zelenými švestkami"], [/apricot/i, "meruňkovým extraktem"], [/honey/i, "medem"], [/adenosine/i, "adenosinem"],
];

function sizeOf(name: string): { size: string; rest: string } {
  const patterns: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/\b(\d+)\s?x\s?(\d+(?:[.,]\d+)?)\s?(ml|g)\b/i, (m) => `${m[1]} × ${m[2].replace(",", ".")} ${m[3].toLowerCase()}`],
    [/\b(\d+)\s?\/\s?(\d+)\s?ks\/ml\b/i, (m) => `${m[1]} ks`],
    [/\b(\d+(?:[.,]\d+)?)\s?(ml|g)\b/i, (m) => `${m[1].replace(",", ".")} ${m[2].toLowerCase()}`],
    [/\b(\d+)\s?(pcs|ks)\b/i, (m) => `${m[1]} ks`],
  ];
  for (const [re, f] of patterns) {
    const m = name.match(re);
    if (m) return { size: f(m), rest: name.replace(re, " ").replace(/\s+/g, " ").trim() };
  }
  return { size: "", rest: name };
}

function build(name: string, existing: string | null) {
  const setMatch = name.match(/^(.*?)\s*\((.+)\)\s*$/);
  const isSet = /\b(kit|set)\b/i.test(name) && !!setMatch;
  const { size: size0, rest: rest0 } = isSet ? { size: setMatch![2].replace(/(\d)(ml|g)\b/gi, "$1 $2").replace(/\s+/g, " ").trim(), rest: setMatch![1].trim() } : sizeOf(name);
  const size = size0, rest = rest0;
  // strip an unmatched "(...)" leftover and the "Pa+++" style tokens stay in the title
  const title = rest.replace(/\s+/g, " ").replace(/[\s–-]+$/g, "").trim();
  const kind = KINDS.find((k) => k.re.test(name)) ?? { noun: "korejská péče o pleť", label: "korejská péče o pleť", use: "Používejte podle pokynů na obalu." } as Kind;
  const actives = [...new Set(ACTIVES.filter(([re]) => re.test(name)).map(([, t]) => t))].slice(0, 2);
  const spf = name.match(/SP[F]?\s?(\d+\+?)/i)?.[1];
  const pa = name.match(/PA\+{1,4}/i)?.[0]?.toUpperCase();
  let descriptor = kind.label;
  if (kind.noun === "opalovací přípravek" && spf) descriptor += ` SPF ${spf}${pa ? ` ${pa}` : ""}`;
  else if (actives.length) descriptor += ` s ${actives.join(" a ")}`;
  const newName = [title, descriptor, size].filter(Boolean).join(" – ");
  // description
  const intro = existing && existing.replace(/<[^>]+>/g, "").trim().length > 40 ? existing.replace(/^\s*<p>|<\/p>\s*$/g, "").trim() : `${title} je korejský ${kind.noun}${actives.length ? ` s ${actives.join(" a ")}` : ""}.`;
  const bullets = [`typ: ${kind.label}`, ...(actives.length ? [`klíčové složky podle názvu: ${actives.join(", ")}`] : []), ...(size ? [`balení ${size}`] : []), "korejská kosmetika (K-beauty)"];
  const html = `<p>${intro}</p><ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul><p>Použití: ${kind.use}</p>`;
  return { newName, html, kind: kind.label };
}

async function revert(path: string) {
  const snap = JSON.parse(readFileSync(path, "utf8")) as { id: string; name: string; description: string | null; heurekaName: string | null }[];
  const kc = await prisma.category.findUnique({ where: { fullSlug: "kosmetika/korejska-kosmetika" } });
  for (const r of snap) {
    await prisma.product.update({ where: { id: r.id }, data: { name: r.name, description: r.description, heurekaName: r.heurekaName } });
    if (kc) await prisma.productCategory.deleteMany({ where: { productId: r.id, categoryId: kc.id } });
  }
  console.log("Reverted", snap.length);
}

async function main() {
  if (REVERT) return revert(REVERT);
  const kc = await prisma.category.findUnique({ where: { fullSlug: "kosmetika/korejska-kosmetika" } });
  if (!kc) throw new Error("Korejská kosmetika category missing");
  const ps = await prisma.product.findMany({
    where: { visible: true, isDefective: false, brand: { name: { in: KOREAN_BRANDS } }, categories: { none: { categoryId: kc.id } }, NOT: { code: { startsWith: "GVS-" } } },
    select: { id: true, code: true, name: true, description: true, heurekaName: true, stock: true, brand: { select: { name: true } } },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
  });
  const rows = ps.map((p) => ({ p, ...build(p.name, p.description) }));
  console.log(`Korean-brand products to bring into the category: ${rows.length} (in stock ${rows.filter((r) => r.p.stock > 0).length})`);
  const kinds = new Map<string, number>(); rows.forEach((r) => kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + 1));
  console.log([...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" | "));
  console.log(`with existing supplier description: ${rows.filter((r) => (r.p.description ?? "").replace(/<[^>]+>/g, "").trim().length > 40).length}`);
  const pick = [...rows].sort(() => Math.random() - 0.5).slice(0, 35);
  for (const r of pick) console.log(`  ${r.p.name}\n   → ${r.newName}`);
  mkdirSync("ops", { recursive: true });
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  writeFileSync("ops/kbeauty-spv-plan.csv", "code,brand,before,after\n" + rows.map((r) => [r.p.code, esc(r.p.brand!.name), esc(r.p.name), esc(r.newName)].join(",")).join("\n"));
  if (!APPLY) return console.log("\nDRY RUN → ops/kbeauty-spv-plan.csv");
  mkdirSync("ops/snapshots", { recursive: true });
  const snapPath = `ops/snapshots/kbeauty-spv-${Date.now()}.json`;
  writeFileSync(snapPath, JSON.stringify(rows.map((r) => ({ id: r.p.id, name: r.p.name, description: r.p.description, heurekaName: r.p.heurekaName }))));
  for (const r of rows) {
    await prisma.product.update({ where: { id: r.p.id }, data: { name: r.newName, description: r.html, heurekaName: r.p.heurekaName ?? r.p.name } });
  }
  await prisma.productCategory.createMany({ data: rows.map((r) => ({ productId: r.p.id, categoryId: kc.id })), skipDuplicates: true });
  console.log(`APPLIED ${rows.length}. Snapshot ${snapPath}`);
}
main().finally(() => prisma.$disconnect());
