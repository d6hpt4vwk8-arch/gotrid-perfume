// One-off: tags perfumes-wholesale.eu-imported perfumes
// (scripts/import-perfumeswholesale.ts) with ScentFamily facets. The import
// never touched this facet at all. Unlike the SP Venture case
// (tag-scent-families-spv.ts), this supplier's feed has structured
// notes_top/notes_middle/notes_base columns (clean note names, not prose) —
// a stronger signal than free text — so those are matched first, with the
// product name as a fallback for rows the feed left blank (~37%).
// Reuses the same 9 families/keywords and "only touch untagged products" rule.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CSV_PATH = process.argv.find((a) => a.startsWith("--file="))?.split("=")[1]
  ?? "scripts/data/perfumeswholesale-catalog.csv";

interface ScentFamilySeed {
  slug: string;
  keywords: string[];
}

// Same list as tag-scent-families-spv.ts — slugs must match exactly,
// families are assumed already seeded by tag-scent-families.ts.
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

function parseNotesTextByEan(csvPath: string): Map<string, string> {
  const cleaned = readFileSync(csvPath, "utf-8").replace(/\x00/g, "").replace(/^﻿/, "");
  const lines = cleaned.split("\r\n").filter((l) => l.length > 0);
  const header = lines[0].split("\t");
  const iEan = header.indexOf("EAN");
  const iProduct = header.indexOf("product");
  const iNotesTop = header.indexOf("notes_top");
  const iNotesMiddle = header.indexOf("notes_middle");
  const iNotesBase = header.indexOf("notes_base");

  const map = new Map<string, string>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const ean = (cols[iEan] ?? "").trim();
    if (!ean || map.has(ean)) continue;
    const text = [cols[iProduct], cols[iNotesTop], cols[iNotesMiddle], cols[iNotesBase]]
      .map((s) => (s ?? "").replace(/,/g, " "))
      .join(" ");
    map.set(ean, text);
  }
  return map;
}

async function main() {
  const textByEan = parseNotesTextByEan(CSV_PATH);
  console.log(`Loaded source text for ${textByEan.size} EANs from CSV`);

  const families = await prisma.scentFamily.findMany({ select: { id: true, slug: true } });
  const familyIdBySlug = new Map(families.map((f) => [f.slug, f.id]));

  const products = await prisma.product.findMany({
    where: {
      code: { startsWith: "PWH-" },
      categories: { some: { category: { fullSlug: { startsWith: "parfemy" } } } },
      scentFamilies: { none: {} },
    },
    select: { id: true, ean: true, name: true },
  });
  console.log(`Found ${products.length} untagged PWH perfume products`);

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
