import { PrismaClient } from "@prisma/client";
import { CATEGORY_TREE, SEED_BRANDS, type CategorySeedNode } from "../src/lib/category-tree";
import { slugify } from "../src/lib/slug";

const prisma = new PrismaClient();

async function seedCategoryNode(
  node: CategorySeedNode,
  parentId: string | null,
  parentFullSlug: string | null,
  sortOrder: number,
) {
  const slug = slugify(node.name);
  const fullSlug = parentFullSlug ? `${parentFullSlug}/${slug}` : slug;

  const category = await prisma.category.upsert({
    where: { fullSlug },
    update: {
      name: node.name,
      slug,
      parentId: parentId ?? undefined,
      sortOrder,
      hidden: node.hidden ?? false,
    },
    create: {
      name: node.name,
      slug,
      fullSlug,
      parentId: parentId ?? undefined,
      sortOrder,
      hidden: node.hidden ?? false,
    },
  });

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      await seedCategoryNode(node.children[i], category.id, fullSlug, i);
    }
  }

  return category;
}

async function seedCategories() {
  for (let i = 0; i < CATEGORY_TREE.length; i++) {
    await seedCategoryNode(CATEGORY_TREE[i], null, null, i);
  }
  console.log(`Seeded category tree (${CATEGORY_TREE.length} root categories).`);
}

async function seedBrands() {
  for (const name of SEED_BRANDS) {
    const slug = slugify(name);
    await prisma.brand.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
  }
  console.log(`Seeded ${SEED_BRANDS.length} brands.`);
}

async function main() {
  await seedCategories();
  await seedBrands();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
