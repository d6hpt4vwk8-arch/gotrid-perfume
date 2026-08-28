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
const REDO_PILOT_PERFUMES = process.argv.includes("--redo-pilot-perfumes");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const MODEL = "claude-sonnet-5";
const CONCURRENCY = 4;

const client = new Anthropic();

const SYSTEM_PROMPT = `Píšeš popisy produktů pro český e-shop s parfémy a kosmetikou (gotridperfume.cz).

Obecná pravidla:
- Piš vždy česky.
- Výstup: POUZE HTML v jednom tagu <p>...</p>, žádný další text kolem.
- Nepoužívej superlativa ("nejlepší", "jedinečný") bez opodstatnění.
- Nikdy doslovně nekopíruj oficiální marketingový text značky — piš vlastními slovy.
- KRITICKY DŮLEŽITÉ: nepiš šablonovitě. Konkurenční e-shopy (např. fann.cz) mají u každého parfému jinak strukturovaný, specificky napsaný text — ne stejnou kostru s dosazeným jménem. Nepoužívej opakovaně stejné uzavírací věty typu "balení X ml je ideální pro každodenní nošení" nebo "vhodný pro muže/ženy, kteří hledají..." u více produktů za sebou — každý popis musí znít, jako by ho někdo napsal zvlášť právě o tomto parfému, ne že se dosadilo jméno do fráze.

U PARFÉMŮ (délka 4-6 vět, cca 70-130 slov):
- Piš poutavě o charakteru, náladě a příležitosti nošení vůně na základě značky, řady a názvu.
- NIKDY neuváděj konkrétní rok uvedení na trh ani jméno parfuméra — i u známých značek existuje riziko záměny s příbuznou variantou (dámská/pánská verze, flanker), takže konkrétní datum nebo jméno se snadno splete. Piš o dojmu, charakteru a náladě vůně, ne o ověřitelných historických faktech.
- Konkrétní vonné tóny zmiňuj JEN pokud jde o všeobecně známý fakt, který si jsi jistý (např. citrusová svěžest u vůně, která je citrusová v samotném názvu) — jinak piš obecně o dojmu.
- Nota vůně (top/heart/base) se zobrazuje zvlášť jako obrázková pyramida pod popisem — NEOPAKUJ výčet not, soustřeď se na celkový dojem a charakter.
- Zkus u každého produktu zvolit jiný úhel pohledu (nálada, příležitost, kontrast s jinými vůněmi řady, pro koho je vhodná, jak působí) — ne pokaždé stejnou strukturu vět.

U DROGERIE/KOSMETIKY (délka 1-3 věty, jak dosud):
- Popiš JEN to, co je zjevné z názvu/kategorie/objemu produktu (typ produktu, k čemu slouží, velikost balení).
- Nevymýšlej konkrétní účinky, složení nebo přínosy, které nejsou v zadání uvedené.
- Pokud produkt nemá dost informací na smysluplný popis, napiš jen stručnou věcnou větu o typu produktu a značce.`;

interface PilotItem {
  where: Record<string, unknown>;
}

async function pickProducts() {
  if (REDO_PILOT_PERFUMES) {
    // Regenerate the same 15 pilot perfumes (overwriting) to A/B the
    // rewritten prompt against the first pass — see conversation.
    return prisma.product.findMany({
      where: {
        visible: true,
        code: { startsWith: "SPV-" },
        categories: { some: { category: { fullSlug: { startsWith: "parfemy" } } } },
      },
      select: { id: true, name: true, slug: true, brand: { select: { name: true } }, categories: { include: { category: true } } },
      take: 15,
      orderBy: { createdAt: "desc" },
    });
  }

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
}): Promise<{ text: string; usage: Anthropic.Messages.Usage }> {
  const categoryNames = product.categories.map((c) => c.category.name).join(", ");
  const isPerfume = product.categories.some((c) => c.category.fullSlug.startsWith("parfemy"));

  const userPrompt = `Produkt: ${product.name}
Značka: ${product.brand?.name ?? "neznámá"}
Kategorie: ${categoryNames || "neuvedeno"}
Typ: ${isPerfume ? "parfém" : "drogerie/kosmetika"}

Napiš popis podle pravidel výše.`;

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
  if (!text.startsWith("<p>")) {
    throw new Error(`Unexpected output shape (no <p> wrapper): ${text.slice(0, 200)}`);
  }
  return { text, usage: res.usage };
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
  let cacheRead = 0;
  let cacheWrite = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  await processInBatches(products, CONCURRENCY, async (product) => {
    try {
      const { text: description, usage } = await generateDescription(product);
      await prisma.product.update({ where: { id: product.id }, data: { description } });
      console.log(`  [ok] ${product.brand?.name ?? ""} ${product.name}\n        ${description}`);
      done++;
      cacheRead += usage.cache_read_input_tokens ?? 0;
      cacheWrite += usage.cache_creation_input_tokens ?? 0;
      inputTokens += usage.input_tokens;
      outputTokens += usage.output_tokens;
    } catch (err) {
      failed++;
      console.error(`  [error] ${product.name}:`, err instanceof Error ? err.message : err);
    }
  });

  console.log(`\nDone. Generated: ${done}, failed: ${failed}.`);
  console.log(
    `Token usage — input: ${inputTokens}, output: ${outputTokens}, cache write: ${cacheWrite}, cache read: ${cacheRead}.`,
  );

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
