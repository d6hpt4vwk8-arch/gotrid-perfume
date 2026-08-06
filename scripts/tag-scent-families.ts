// One-off (re-runnable) backfill: seeds the ScentFamily taxonomy and tags
// Parfémy products by matching Czech fragrance-note vocabulary against their
// real product descriptions — no invented data, just structuring text that's
// already there. Safe to re-run after a new XLSX import: upserts families,
// and recomputes tags only for products that currently have zero tags (so
// manual admin corrections made via the product editor are never overwritten).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ScentFamilySeed {
  slug: string;
  name: string;
  keywords: string[];
}

const SCENT_FAMILIES: ScentFamilySeed[] = [
  {
    slug: "citrusova",
    name: "Citrusová",
    keywords: ["citrus", "bergamot", "pomeranč", "grapefruit", "grep", "citron", "mandarink", "limet"],
  },
  {
    slug: "kvetinova",
    name: "Květinová",
    keywords: [
      "květinov", "růž", "jasmín", "pivoňk", "konvalink", "fialk", "ylang",
      "orchidej", "tuberóz", "gardéni", "magnóli", "frézi", "pion",
    ],
  },
  {
    slug: "drevita",
    name: "Dřevitá",
    keywords: ["dřevit", "dřevo", "santal", "cedr", "vetiver", "guajak", "oud", "olivovník"],
  },
  {
    slug: "orientalni-korenita",
    name: "Orientální a kořeněná",
    keywords: [
      "kořenit", "koření", "skořice", "pepř", "kardamom", "hřebíček", "ambr",
      "kadidl", "orientální", "šafrán", "muškát", "zázvor", "benzoin",
    ],
  },
  {
    slug: "svezi-vodni",
    name: "Svěží a vodní",
    keywords: ["svěží", "svěžest", "vodní", "mořsk", "oceán", "mátov", "ozon"],
  },
  {
    slug: "sladka-gurmanska",
    name: "Sladká a gurmánská",
    keywords: ["vanilk", "karamel", "čokoládov", "medov", "cukrov", "mandl", "praliniv", "kokos"],
  },
  {
    slug: "pizmova",
    name: "Pižmová",
    keywords: ["pižmo", "pižmov", "mošus", "musk"],
  },
  {
    slug: "zelena-bylinna",
    name: "Zelená a bylinná",
    keywords: ["zelené tóny", "zelených tón", "bylink", "levandul", "rozmarýn", "šalvěj", "tymián", "bazalk"],
  },
  {
    slug: "kozena-koureova",
    name: "Kožená a kouřová",
    keywords: ["kůž", "kožen", "tabák", "kouřov", "leather"],
  },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

function matchFamilies(text: string): string[] {
  const lower = text.toLowerCase();
  return SCENT_FAMILIES.filter((f) => f.keywords.some((kw) => lower.includes(kw))).map((f) => f.slug);
}

async function main() {
  console.log("Seeding scent families…");
  const familyIdBySlug = new Map<string, string>();
  for (const family of SCENT_FAMILIES) {
    const row = await prisma.scentFamily.upsert({
      where: { slug: family.slug },
      update: { name: family.name },
      create: { slug: family.slug, name: family.name },
    });
    familyIdBySlug.set(family.slug, row.id);
  }

  const products = await prisma.product.findMany({
    where: {
      categories: { some: { category: { fullSlug: { startsWith: "parfemy" } } } },
      scentFamilies: { none: {} },
    },
    select: { id: true, name: true, description: true },
  });

  console.log(`Found ${products.length} untagged perfume products.`);

  let tagged = 0;
  let skipped = 0;
  for (const product of products) {
    const text = `${product.name} ${stripHtml(product.description ?? "")}`;
    const slugs = matchFamilies(text);
    if (slugs.length === 0) {
      skipped++;
      continue;
    }
    await prisma.productScentFamily.createMany({
      data: slugs.map((slug) => ({
        productId: product.id,
        scentFamilyId: familyIdBySlug.get(slug)!,
      })),
      skipDuplicates: true,
    });
    tagged++;
  }

  console.log(`Tagged: ${tagged}, no keyword match: ${skipped}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
