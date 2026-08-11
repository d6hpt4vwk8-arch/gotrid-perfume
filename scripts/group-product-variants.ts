// One-off (re-runnable) backfill: groups products that are the same
// fragrance in different bottle sizes so the storefront can show one card
// with a size selector instead of a separate card per ml. Safe to re-run
// after every future import — the group key is fully deterministic from
// brand + name, so recomputing over the whole catalog just lets any newly
// imported size join its existing group rather than needing a "only touch
// ungrouped rows" special case.
import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/lib/slug";
import { parseVolumeMl, stripVolume } from "../src/lib/parse-volume";

const prisma = new PrismaClient();

interface Row {
  id: string;
  brandId: string | null;
  brandSlug: string;
  name: string;
  price: number;
  stock: number;
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      brandId: true,
      name: true,
      price: true,
      stock: true,
      brand: { select: { slug: true } },
    },
  });

  const rows: Row[] = products.map((p) => ({
    id: p.id,
    brandId: p.brandId,
    brandSlug: p.brand?.slug ?? "no-brand",
    name: p.name,
    price: Number(p.price),
    stock: p.stock,
  }));

  const byKey = new Map<string, Row[]>();
  for (const row of rows) {
    const stripped = stripVolume(row.name);
    // No volume in the name at all — nothing to vary by size on, skip.
    if (stripped === row.name) continue;
    const key = slugify(`${row.brandSlug}-${stripped}`);
    const group = byKey.get(key) ?? [];
    group.push(row);
    byKey.set(key, group);
  }

  let groupsFormed = 0;
  let productsGrouped = 0;
  let exactDuplicatesSkipped = 0;
  let groupsCleared = 0;

  for (const [key, members] of byKey) {
    // Dedupe exact-duplicate volumes within the candidate group: keep the
    // better copy (more stock, tie-break cheaper), leave the other as its
    // own standalone product rather than a confusing "two 100 ml options."
    const byVolume = new Map<number | null, Row[]>();
    for (const row of members) {
      const ml = parseVolumeMl(row.name);
      const bucket = byVolume.get(ml) ?? [];
      bucket.push(row);
      byVolume.set(ml, bucket);
    }

    const eligible: Row[] = [];
    for (const bucket of byVolume.values()) {
      if (bucket.length === 1) {
        eligible.push(bucket[0]);
        continue;
      }
      bucket.sort((a, b) => b.stock - a.stock || a.price - b.price);
      eligible.push(bucket[0]);
      exactDuplicatesSkipped += bucket.length - 1;
    }

    if (eligible.length < 2) {
      // Not enough distinct sizes to justify a group — make sure nothing
      // is left pointing at a group that no longer qualifies (e.g. a
      // sibling got deleted since the last run).
      if (members.length > 0) {
        await prisma.product.updateMany({
          where: { id: { in: members.map((m) => m.id) }, variantGroupKey: key },
          data: { variantGroupKey: null, isPrimaryVariant: true },
        });
      }
      continue;
    }

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

    // Any product that WAS in this group last run but got excluded this
    // time (e.g. turned into an exact-duplicate loser) needs clearing.
    const excludedIds = members.filter((m) => !eligible.includes(m)).map((m) => m.id);
    if (excludedIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: excludedIds } },
        data: { variantGroupKey: null, isPrimaryVariant: true },
      });
      groupsCleared += excludedIds.length;
    }

    groupsFormed++;
    productsGrouped += eligible.length;
  }

  console.log(
    `Groups formed: ${groupsFormed}, products grouped: ${productsGrouped}, exact-duplicate volumes skipped: ${exactDuplicatesSkipped}, previously-grouped rows cleared: ${groupsCleared}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
