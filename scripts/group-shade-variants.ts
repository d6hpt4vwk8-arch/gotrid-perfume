// One-off (re-runnable) backfill: groups color-cosmetics products that are
// the same item in different shades so the storefront can show one card
// with a shade selector, mirroring scripts/group-product-variants.ts (same
// variantGroupKey/isPrimaryVariant fields — a product can only be in one
// group at a time, size OR shade, never both, so this and that script must
// never both claim the same product; see the guard below).
//
// Deliberately scoped to the "Dekorativní kosmetika" subtree only — this is
// where the shade heuristic (src/lib/parse-shade.ts) was validated against
// real data. Running it catalog-wide produces false groupings elsewhere
// (soaps/shower gels/creams vary by scent or type, not shade, and the word
// list matches things like "Natural" or "Light" in those names too).
import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/slug";
import { stripVolume } from "../src/lib/parse-volume";
import { parseShadeLabel, stripShade } from "../src/lib/parse-shade";

const prisma = new PrismaClient();

const SCOPE_FULL_SLUG = "kosmetika/dekorativni-kosmetika";

interface Row {
  id: string;
  brandSlug: string;
  name: string;
  price: number;
  stock: number;
}

async function main() {
  const scope = await prisma.category.findFirst({ where: { fullSlug: SCOPE_FULL_SLUG } });
  if (!scope) throw new Error(`Category "${SCOPE_FULL_SLUG}" not found.`);
  const descendants = await prisma.category.findMany({
    where: { OR: [{ id: scope.id }, { parentId: scope.id }] },
    select: { id: true },
  });
  const categoryIds = descendants.map((d) => d.id);

  const products = await prisma.product.findMany({
    where: { categories: { some: { categoryId: { in: categoryIds } } }, visible: true },
    select: {
      id: true,
      name: true,
      price: true,
      stock: true,
      variantGroupKey: true,
      brand: { select: { slug: true } },
    },
  });

  const rows: (Row & { existingKey: string | null })[] = products.map((p) => ({
    id: p.id,
    brandSlug: p.brand?.slug ?? "no-brand",
    name: p.name,
    price: Number(p.price),
    stock: p.stock,
    existingKey: p.variantGroupKey,
  }));

  const byKey = new Map<string, typeof rows>();
  for (const row of rows) {
    // A product already grouped by size (group-product-variants.ts) keeps
    // that grouping — shade and size groups are mutually exclusive here,
    // and every case actually found in this category varies by shade only.
    if (row.existingKey) continue;
    const stripped = stripShade(stripVolume(row.name));
    if (stripped === row.name) continue; // no shade tail detected, nothing to vary on
    const key = slugify(`shade-${row.brandSlug}-${stripped}`);
    const group = byKey.get(key) ?? [];
    group.push(row);
    byKey.set(key, group);
  }

  let groupsFormed = 0;
  let productsGrouped = 0;
  let exactDuplicatesSkipped = 0;

  for (const [key, members] of byKey) {
    // Dedupe exact-duplicate shades within a candidate group (e.g. the same
    // shade listed twice from two suppliers) — keep the better copy.
    const byShadeLabel = new Map<string, typeof members>();
    for (const row of members) {
      const label = (parseShadeLabel(stripVolume(row.name)) ?? "").toLowerCase();
      const bucket = byShadeLabel.get(label) ?? [];
      bucket.push(row);
      byShadeLabel.set(label, bucket);
    }

    const eligible: typeof members = [];
    for (const bucket of byShadeLabel.values()) {
      if (bucket.length === 1) {
        eligible.push(bucket[0]);
        continue;
      }
      bucket.sort((a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) || a.price - b.price);
      eligible.push(bucket[0]);
      exactDuplicatesSkipped += bucket.length - 1;
    }

    if (eligible.length < 2) continue;

    const sortedByPreference = [...eligible].sort(
      (a, b) => (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) || a.price - b.price,
    );
    const primaryId = sortedByPreference[0].id;

    await prisma.$transaction(
      eligible.map((row) =>
        prisma.product.update({
          where: { id: row.id },
          data: { variantGroupKey: key, isPrimaryVariant: row.id === primaryId },
        }),
      ),
    );

    groupsFormed++;
    productsGrouped += eligible.length;
    console.log(`[${eligible.length}] ${key}`);
  }

  console.log(
    `\nGroups formed: ${groupsFormed}, products grouped: ${productsGrouped}, exact-duplicate shades skipped: ${exactDuplicatesSkipped}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
