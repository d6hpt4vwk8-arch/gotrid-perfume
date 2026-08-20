// One-off (re-runnable) backfill: tags Kosmetika products with SkinType/Concern
// by matching Czech+English drugstore-label vocabulary against their real
// name/description text — same approach as scripts/tag-scent-families.ts.
// Deliberately conservative: only tags a product when the text *states* the
// claim (e.g. "for sensitive skin", "hydratační", "acne") rather than
// guessing from generic product type, so nothing dishonest gets attached.
// Coverage will be partial (most drugstore names don't state skin type/
// concern at all) — that's expected and fine, same as scent families never
// reaching 100% of perfumes. Safe to re-run: only touches products that
// currently have zero tags in the relevant table, so manual admin corrections
// are never overwritten.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface KeywordSeed {
  slug: string;
  keywords: string[];
}

// Matches scripts/seed-cosmetics-facets.ts's SkinType slugs exactly.
const SKIN_TYPES: KeywordSeed[] = [
  { slug: "sucha", keywords: ["suchou pleť", "suché pleti", "suchá pleť", "pro suchou", "dry skin", "dry, sensitive skin"] },
  // Mattifying/matte-control products are marketed specifically at oily/
  // combination skin control — a fair, standard association, not a guess.
  { slug: "mastna", keywords: ["mastnou pleť", "mastné pleti", "mastná pleť", "pro mastnou", "oily skin", "matuj", "matting", "mattifying"] },
  { slug: "smisena", keywords: ["smíšenou pleť", "smíšené pleti", "smíšená pleť", "pro smíšenou", "combination skin", "mixed skin"] },
  { slug: "citliva", keywords: ["citlivou pleť", "citlivé pleti", "citlivá pleť", "pro citlivou", "sensitive skin"] },
  { slug: "normalni", keywords: ["normální pleť", "pro normální", "normal skin"] },
];

// Matches scripts/seed-cosmetics-facets.ts's Concern slugs exactly. Kept
// tight and specific where a word could mean something unrelated (e.g. no
// bare "nečist" for Akné, since "odstraňuje nečistoty" is generic cleansing
// marketing language) but broadened for terms that are honest and unambiguous
// within this kosmetika/plet-only scope — e.g. "čisticí"/"cleanser" always
// really does mean facial cleansing here, and named actives (hyaluron,
// retinol, niacinamide, collagen) reliably signal their standard purpose.
const CONCERNS: KeywordSeed[] = [
  { slug: "hydratace", keywords: ["hydrata", "moistur", "hyaluron"] },
  { slug: "akne", keywords: ["akné", "acne", "problematickou pleť", "problematic skin", "blemish", "acne-prone", "acne prone"] },
  { slug: "vrasky-starnuti", keywords: ["vrásk", "stárnutí", "proti stárnutí", "anti-aging", "antiaging", "wrinkle", "retinol", "kolagen", "collagen", "firming", "zpevňující"] },
  { slug: "pigmentace", keywords: ["pigmentac", "tmavé skvrny", "dark spot", "age spot", "niacinamide"] },
  { slug: "zarudnuti-citlivost", keywords: ["zarudnut", "podrážd", "redness", "soothing", "zklidňuj", "zklidňující"] },
  { slug: "rozjasneni", keywords: ["rozjasň", "brightening", "niacinamide", "vitamin c"] },
  {
    slug: "cisteni-detox",
    keywords: [
      "čisticí", "čistící", "čištění", "cleans", "cleanser", "hloubkové čištění",
      "micel", "micellar", "peeling", "exfoliat", "odličova", "makeup remover",
      "toner", "tonikum", "detox", "purif",
    ],
  },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

function matchSlugs<T extends KeywordSeed>(text: string, seeds: T[]): string[] {
  const lower = text.toLowerCase();
  return seeds.filter((s) => s.keywords.some((kw) => lower.includes(kw))).map((s) => s.slug);
}

async function main() {
  const skinTypeRows = await prisma.skinType.findMany();
  const concernRows = await prisma.concern.findMany();
  const skinTypeIdBySlug = new Map(skinTypeRows.map((r) => [r.slug, r.id]));
  const concernIdBySlug = new Map(concernRows.map((r) => [r.slug, r.id]));

  const missingSkinTypes = SKIN_TYPES.filter((s) => !skinTypeIdBySlug.has(s.slug));
  const missingConcerns = CONCERNS.filter((c) => !concernIdBySlug.has(c.slug));
  if (missingSkinTypes.length || missingConcerns.length) {
    throw new Error(
      `Missing seeded taxonomy rows — run scripts/seed-cosmetics-facets.ts first. ` +
        `Missing skin types: ${missingSkinTypes.map((s) => s.slug).join(", ")}; ` +
        `missing concerns: ${missingConcerns.map((c) => c.slug).join(", ")}`,
    );
  }

  // Scoped to kosmetika/plet (facial skincare) only — "Typ pleti" and "Účel"
  // are face-skin concepts (Suchá/Mastná/Citlivá pleť, Akné, Pigmentace…),
  // and applying them to shampoo/shower gel/body lotion via generic shared
  // marketing phrases ("hydratační", "čistí") produced nonsense tags on a
  // first pass (e.g. hair conditioners tagged "Akné a nečistoty") — caught
  // and reverted before this scoped version.
  const products = await prisma.product.findMany({
    where: {
      categories: { some: { category: { fullSlug: { startsWith: "kosmetika/plet" } } } },
      OR: [{ skinTypes: { none: {} } }, { concerns: { none: {} } }],
    },
    select: {
      id: true,
      name: true,
      description: true,
      skinTypes: { select: { skinTypeId: true } },
      concerns: { select: { concernId: true } },
    },
  });

  console.log(`Found ${products.length} Kosmetika products missing at least one facet.`);

  let skinTagged = 0;
  let concernTagged = 0;
  let touched = 0;

  for (const product of products) {
    const text = `${product.name} ${stripHtml(product.description ?? "")}`;
    let didSomething = false;

    if (product.skinTypes.length === 0) {
      const slugs = matchSlugs(text, SKIN_TYPES);
      if (slugs.length > 0) {
        await prisma.productSkinType.createMany({
          data: slugs.map((slug) => ({ productId: product.id, skinTypeId: skinTypeIdBySlug.get(slug)! })),
          skipDuplicates: true,
        });
        skinTagged++;
        didSomething = true;
      }
    }

    if (product.concerns.length === 0) {
      const slugs = matchSlugs(text, CONCERNS);
      if (slugs.length > 0) {
        await prisma.productConcern.createMany({
          data: slugs.map((slug) => ({ productId: product.id, concernId: concernIdBySlug.get(slug)! })),
          skipDuplicates: true,
        });
        concernTagged++;
        didSomething = true;
      }
    }

    if (didSomething) touched++;
  }

  console.log(
    `Products with a new skin-type tag: ${skinTagged}\n` +
      `Products with a new concern tag: ${concernTagged}\n` +
      `Total products touched: ${touched}`,
  );

  await prisma.adminActivityLog.create({
    data: {
      action: "product.bulk_tag",
      entityType: "product",
      detail: `Zpětné tagování Typ pleti/Účel podle klíčových slov v názvu a popisu (kosmetika): nový tag typu pleti u ${skinTagged} produktů, nový tag účelu u ${concernTagged} produktů.`,
    },
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
