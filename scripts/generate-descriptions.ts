// Bulk product-description generation via the Claude API. Pilot run first
// (small --limit), reviewed by the owner, before scaling to the full
// catalog. Writes short, honest Czech copy — factual for drugstore/cosmetics
// (nothing invented beyond what the product name/category implies), evocative
// but generic for perfumes (character/mood, not invented specific notes,
// never copying official brand text verbatim).
//
// Usage:
//   npx tsx scripts/generate-descriptions.ts --pilot --dry-run
//   npx tsx scripts/generate-descriptions.ts --pilot
//   npx tsx scripts/generate-descriptions.ts --limit=500
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../src/lib/prisma";
import { logAdminActivity } from "../src/lib/admin/activity-log";

const DRY_RUN = process.argv.includes("--dry-run");
const PILOT = process.argv.includes("--pilot");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const MODEL = "claude-sonnet-5";
const CONCURRENCY = 4;

const client = new Anthropic();

const SYSTEM_PROMPT = `Píšeš krátké popisy produktů pro český e-shop s parfémy a kosmetikou (gotridperfume.cz).

Pravidla:
- Piš vždy česky.
- Výstup: POUZE HTML v jednom tagu <p>...</p>, žádný další text kolem.
- Délka: 1-3 věty, věcně a poutavě, bez zbytečné vaty.
- Nepoužívej superlativa ("nejlepší", "jedinečný") bez opodstatnění.
- U PARFÉMŮ: piš obecný, ale poutavý text o charakteru/náladě vůně na základě značky a názvu. Nevymýšlej konkrétní vonné tóny, pokud nejsou všeobecně známé (např. u velmi slavných parfémů). Nikdy nekopíruj oficiální marketingový text značky doslovně — piš vlastními slovy.
- U DROGERIE/KOSMETIKY: popiš JEN to, co je zjevné z názvu/kategorie/objemu produktu (typ produktu, k čemu slouží, velikost balení). Nevymýšlej konkrétní účinky, složení nebo přínosy, které nejsou v zadání uvedené.
- Pokud produkt nemá dost informací na smysluplný popis, napiš jen stručnou věcnou větu o typu produktu a značce — neházej si výplňová klišé.`;

interface PilotItem {
  where: Record<string, unknown>;
}

async function pickProducts() {
  if (PILOT) {
    const perfumes = await prisma.product.findMany({
      where: {
        visible: true,
        description: null,
        code: { startsWith: "SPV-" },
        categories: { some: { category: { fullSlug: { startsWith: "parfemy" } } } },
      },
      select: { id: true, name: true, brand: { select: { name: true } }, categories: { include: { category: true } } },
      take: 15,
      orderBy: { createdAt: "desc" },
    });
    const drugstore = await prisma.product.findMany({
      where: { visible: true, description: null, code: { startsWith: "TDE-" } },
      select: { id: true, name: true, brand: { select: { name: true } }, categories: { include: { category: true } } },
      take: 15,
    });
    return [...perfumes, ...drugstore];
  }

  return prisma.product.findMany({
    where: { visible: true, description: null },
    select: { id: true, name: true, brand: { select: { name: true } }, categories: { include: { category: true } } },
    take: LIMIT > 0 ? LIMIT : 100,
    orderBy: { createdAt: "desc" },
  });
}

async function generateDescription(product: {
  name: string;
  brand: { name: string } | null;
  categories: { category: { name: string; fullSlug: string } }[];
}): Promise<string> {
  const categoryNames = product.categories.map((c) => c.category.name).join(", ");
  const isPerfume = product.categories.some((c) => c.category.fullSlug.startsWith("parfemy"));

  const userPrompt = `Produkt: ${product.name}
Značka: ${product.brand?.name ?? "neznámá"}
Kategorie: ${categoryNames || "neuvedeno"}
Typ: ${isPerfume ? "parfém" : "drogerie/kosmetika"}

Napiš popis podle pravidel výše.`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  if (!text.startsWith("<p>")) {
    throw new Error(`Unexpected output shape (no <p> wrapper): ${text.slice(0, 200)}`);
  }
  return text;
}

async function processInBatches<T>(items: T[], size: number, fn: (item: T, index: number) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    await Promise.all(batch.map((item, j) => fn(item, i + j)));
  }
}

async function main() {
  const products = await pickProducts();
  console.log(`Selected ${products.length} products (${PILOT ? "pilot" : `limit=${LIMIT || 100}`}).`);

  if (DRY_RUN) {
    for (const p of products) console.log(" -", p.brand?.name, "|", p.name);
    console.log("Dry run — no API calls made.");
    return;
  }

  let done = 0;
  let failed = 0;

  await processInBatches(products, CONCURRENCY, async (product) => {
    try {
      const description = await generateDescription(product);
      await prisma.product.update({ where: { id: product.id }, data: { description } });
      console.log(`  [ok] ${product.brand?.name ?? ""} ${product.name}\n        ${description}`);
      done++;
    } catch (err) {
      failed++;
      console.error(`  [error] ${product.name}:`, err instanceof Error ? err.message : err);
    }
  });

  console.log(`\nDone. Generated: ${done}, failed: ${failed}.`);

  if (done > 0) {
    await logAdminActivity({
      action: "product.bulk_description",
      entityType: "product",
      detail: `Hromadné generování popisů přes Claude API (${MODEL})${PILOT ? " — pilotní dávka" : ""}: úspěšně ${done}, chyby ${failed}.`,
    });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
