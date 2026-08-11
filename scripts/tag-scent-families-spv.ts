// One-off: tags SP Venture-imported perfumes (scripts/import-spventure.ts)
// with ScentFamily facets. Their DB description was intentionally left
// blank (source text is English, not translated) — but the source XML's
// English DESCRIPTION still has real fragrance-note vocabulary, so this
// matches against that raw text instead of re-deriving from the DB.
// Reuses the same 9 families as scripts/tag-scent-families.ts and the same
// "only touch products with zero existing tags" safety rule.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const XML_PATH = process.argv.find((a) => a.startsWith("--file="))?.split("=")[1]
  ?? "/Users/pavlogrican/Downloads/product (1).xml";

interface ScentFamilySeed {
  slug: string;
  keywords: string[];
}

// English counterparts of the keyword lists in tag-scent-families.ts —
// slugs must match exactly, families are assumed already seeded by that script.
const SCENT_FAMILIES: ScentFamilySeed[] = [
  { slug: "citrusova", keywords: ["citrus", "bergamot", "orange", "grapefruit", "lemon", "lime", "mandarin", "tangerine", "verbena", "petitgrain", "clementine"] },
  { slug: "kvetinova", keywords: ["floral", "rose", "jasmine", "peony", "violet", "ylang", "orchid", "tuberose", "gardenia", "magnolia", "freesia", "geranium", "iris", "lily", "lilac"] },
  { slug: "drevita", keywords: ["woody", "sandalwood", "cedar", "cedarwood", "vetiver", "guaiac", " oud", "cashmere wood", "cashmeran"] },
  { slug: "orientalni-korenita", keywords: ["spicy", "spice", "cinnamon", "pepper", "cardamom", "clove", "amber", "incense", "oriental", "saffron", "nutmeg", "ginger", "benzoin"] },
  { slug: "svezi-vodni", keywords: ["fresh", "aquatic", "marine", "ozone", "sea breeze", "oceanic"] },
  { slug: "sladka-gurmanska", keywords: ["vanilla", "caramel", "chocolate", "honey", "sugar", "almond", "praline", "coconut", "gourmand"] },
  { slug: "pizmova", keywords: ["musk", "musky"] },
  { slug: "zelena-bylinna", keywords: ["green tone", "green note", "herbal", "lavender", "rosemary", "sage", "thyme", "basil"] },
  { slug: "kozena-koureova", keywords: ["leather", "tobacco", "smoky", "smoke"] },
];

function matchFamilies(text: string): string[] {
  const lower = text.toLowerCase();
  return SCENT_FAMILIES.filter((f) => f.keywords.some((kw) => lower.includes(kw))).map((f) => f.slug);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractTag(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(block);
  return match ? decodeEntities(match[1].trim()) : "";
}

function parseDescriptionsByEan(xml: string): Map<string, string> {
  const blocks = xml.split("<SHOPITEM>").slice(1);
  const map = new Map<string, string>();
  for (const raw of blocks) {
    const block = raw.split("</SHOPITEM>")[0];
    const ean = extractTag(block, "EAN");
    if (!ean) continue;
    const name = extractTag(block, "PRODUCTNAME");
    const description = extractTag(block, "DESCRIPTION");
    map.set(ean, `${name} ${description}`);
  }
  return map;
}

async function main() {
  const xml = readFileSync(XML_PATH, "utf-8");
  const textByEan = parseDescriptionsByEan(xml);
  console.log(`Loaded source text for ${textByEan.size} EANs from XML`);

  const families = await prisma.scentFamily.findMany({ select: { id: true, slug: true } });
  const familyIdBySlug = new Map(families.map((f) => [f.slug, f.id]));

  const products = await prisma.product.findMany({
    where: {
      code: { startsWith: "SPV-" },
      categories: { some: { category: { fullSlug: { startsWith: "parfemy" } } } },
      scentFamilies: { none: {} },
    },
    select: { id: true, ean: true, name: true },
  });
  console.log(`Found ${products.length} untagged SPV perfume products`);

  let tagged = 0;
  let skipped = 0;
  for (const product of products) {
    const text = (product.ean && textByEan.get(product.ean)) || product.name;
    const slugs = matchFamilies(text);
    if (slugs.length === 0) {
      skipped++;
      continue;
    }
    await prisma.productScentFamily.createMany({
      data: slugs
        .map((slug) => familyIdBySlug.get(slug))
        .filter((id): id is string => Boolean(id))
        .map((scentFamilyId) => ({ productId: product.id, scentFamilyId })),
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
