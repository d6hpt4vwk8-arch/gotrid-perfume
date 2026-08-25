// One-off: boost display priority for Romscent (ROM-)'s Arabské parfémy
// products — lower purchase price than the same brands via other suppliers,
// so they should surface first in the category and in the homepage's new
// "Arabské parfémy" section.
import { prisma } from "@/lib/prisma";

async function main() {
  const result = await prisma.product.updateMany({
    where: {
      code: { startsWith: "ROM-" },
      categories: { some: { category: { fullSlug: "parfemy/arabske-parfemy" } } },
    },
    data: { priority: 100 },
  });
  console.log(`Bumped priority for ${result.count} Romscent (ROM-) Arabské parfémy products`);
}

main().finally(() => prisma.$disconnect());
