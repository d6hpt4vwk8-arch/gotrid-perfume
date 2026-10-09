// Czech product descriptions for the SPV Arabic perfumes, written by the Claude API from the REAL supplier
// text in the SPV product feed (English DESCRIPTION: scent notes, mood, target group) instead of guessing from
// the product name. The supplier text is shared by every SPV reseller, so it is rewritten (never copied) and
// reshaped into our own structure. Old descriptions are snapshotted before overwrite.
//   npx tsx scripts/generate-arabic-descriptions.ts --pilot            12 samples printed, nothing written
//   npx tsx scripts/generate-arabic-descriptions.ts --apply --limit=50 write the first N that need a description
//   npx tsx scripts/generate-arabic-descriptions.ts --apply            all that need one
//   npx tsx scripts/generate-arabic-descriptions.ts --revert=ops/snapshots/arabic-descriptions-*.json
// "Needs one": no description, or a short generic one (< 350 chars of text). Longer ones are kept.
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");
const PILOT = process.argv.includes("--pilot");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const REVERT = process.argv.find((a) => a.startsWith("--revert="))?.split("=")[1];
const MODEL = "claude-sonnet-5-5";
const CONCURRENCY = 4;
const FEED_URL = "https://www.perfumes-b2b.com/exchange/06560451-31AA-4C08-9B66-C149E1FF95DB/xml/product.xml?cy=czk";

const client = new Anthropic();

const SYSTEM_PROMPT = `Píšeš popisy parfémů pro český e-shop gotridperfume.cz. Dostaneš český název produktu a anglický popis od dodavatele (obsahuje skutečné informace o vůni: tóny, charakter, pro koho je).

Pravidla:
- Piš česky, vlastními slovy. Anglický text dodavatele NEPŘEKLÁDEJ větu po větě a nekopíruj ho — ten samý text používají další prodejci, my potřebujeme vlastní, přirozeně znějící text.
- Používej POUZE fakta z textu dodavatele (vonné tóny, charakter, nálada, příležitost) a z názvu produktu. Nevymýšlej žádné další tóny, rok uvedení, jméno parfuméra, ani slib konkrétní výdrže v hodinách. Pokud text dodavatele něco neobsahuje, o tom nepiš.
- Marketingová tvrzení dodavatele typu "nejlepší", "vyvolá obdivné pohledy", "plný komplimentů" zmírni nebo vynech; piš věcně a lákavě, ne přehnaně.
- Pokud dodavatel zmiňuje, že vůně připomíná/ je inspirovaná jiným známým parfémem, tuto zmínku VYNECH (nepoužívej jména cizích značek ani produktů).
- Výstup: POUZE HTML, bez dalšího textu, přesně v této struktuře:
  <p>úvodní odstavec 2–3 věty: charakter a nálada vůně, pro koho je (podle názvu: dámská/pánská/unisex)</p>
  <ul><li><strong>Hlavní tóny:</strong> …</li><li><strong>Kdy ji nosit:</strong> …</li><li><strong>Charakter:</strong> …</li></ul>
  (řádek "Hlavní tóny" uveď jen pokud jsou v textu dodavatele tóny; řádek "Kdy ji nosit" jen pokud lze rozumně vyvodit z textu — roční období/denní doba/příležitost; "Charakter" = 1 krátká věta o intenzitě/stopě vůně.)
- Délka celkem 60–110 slov. Každý popis musí znít jinak — střídej úvody a stavbu vět, nepoužívej pořád stejné fráze.
- Název produktu a značku uváděj tak, jak jsou v zadání. Nepiš objem balení, ten je v názvu.`;

interface FeedItem { description: string; supplierName: string }

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}
function tag(block: string, t: string) {
  const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(block);
  return m ? decode(m[1].replace(/^<!\[CDATA\[|\]\]>$/g, "").trim()) : "";
}

async function loadFeed(): Promise<Map<string, FeedItem>> {
  const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`feed ${res.status}`);
  const xml = await res.text();
  const map = new Map<string, FeedItem>();
  for (const raw of xml.split("<SHOPITEM>").slice(1)) {
    const block = raw.split("</SHOPITEM>")[0];
    map.set(tag(block, "ITEM_CODE"), { description: tag(block, "DESCRIPTION"), supplierName: tag(block, "PRODUCTNAME") });
  }
  return map;
}

const textLen = (h: string | null) => (h ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;

async function revert(file: string) {
  const snap: { id: string; description: string | null }[] = JSON.parse(readFileSync(file, "utf8"));
  for (const s of snap) await prisma.product.update({ where: { id: s.id }, data: { description: s.description } });
  console.log("reverted", snap.length);
}

async function generate(name: string, brand: string, supplierText: string) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Produkt: ${name}\nZnačka: ${brand}\n\nText dodavatele (angl.):\n${supplierText}` }],
  });
  const b = res.content.find((x) => x.type === "text");
  const text = b && "text" in b ? b.text.trim() : "";
  if (!text.startsWith("<p>")) throw new Error("bad shape: " + text.slice(0, 120));
  return { text, usage: res.usage };
}

async function main() {
  if (REVERT) return revert(REVERT);
  const feed = await loadFeed();
  const cat = await prisma.category.findUnique({ where: { fullSlug: "parfemy/arabske-parfemy" } });
  const ids = (await prisma.category.findMany({ where: { OR: [{ id: cat!.id }, { fullSlug: { startsWith: "parfemy/arabske-parfemy/" } }] }, select: { id: true } })).map((c) => c.id);
  const all = await prisma.product.findMany({
    where: { code: { startsWith: "SPV-" }, categories: { some: { categoryId: { in: ids } } } },
    select: { id: true, code: true, name: true, description: true, brand: { select: { name: true } } },
    orderBy: { salesCount: "desc" },
  });
  let todo = all.filter((p) => textLen(p.description) < 350);
  const noFeed = todo.filter((p) => !(feed.get(p.code.replace(/^SPV-/, ""))?.description.length! > 60));
  todo = todo.filter((p) => (feed.get(p.code.replace(/^SPV-/, ""))?.description.length ?? 0) > 60);
  console.log(`Arabic SPV: ${all.length}; need description: ${todo.length + noFeed.length}; with usable supplier text: ${todo.length}; no supplier text: ${noFeed.length}`);
  if (PILOT) {
    // spread across brands: every 40th
    todo = todo.filter((_, i) => i % Math.max(1, Math.floor(todo.length / 12)) === 0).slice(0, 12);
  } else if (LIMIT > 0) todo = todo.slice(0, LIMIT);

  const snapshot: { id: string; description: string | null }[] = [];
  let inT = 0, outT = 0, ok = 0, fail = 0;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(todo.slice(i, i + CONCURRENCY).map(async (p) => {
      try {
        const f = feed.get(p.code.replace(/^SPV-/, ""))!;
        const { text, usage } = await generate(p.name, p.brand?.name ?? "", f.description);
        inT += usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0); outT += usage.output_tokens;
        if (PILOT || !APPLY) console.log(`\n### ${p.name}\n[supplier] ${f.description.slice(0, 400)}\n[new] ${text}`);
        if (APPLY) { snapshot.push({ id: p.id, description: p.description }); await prisma.product.update({ where: { id: p.id }, data: { description: text } }); }
        ok++;
      } catch (e) { fail++; console.error("ERR", p.name, e instanceof Error ? e.message : e); }
    }));
  }
  console.log(`\nok ${ok}, failed ${fail}, tokens in ${inT} out ${outT}`);
  if (APPLY && snapshot.length) {
    mkdirSync("ops/snapshots", { recursive: true });
    const f = `ops/snapshots/arabic-descriptions-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(f, JSON.stringify(snapshot));
    console.log("snapshot", f);
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
