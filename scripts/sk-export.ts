// Writes the next batch of products still lacking a Slovak translation, in
// priority order, for hand translation (names + descriptions keep their
// structure; the result goes back in via scripts/sk-import.ts).
//   npx tsx scripts/sk-export.ts --n=60 --out=ops/sk-work/batch-01.json
// Priority = what the Heureka.sk feed would list: in stock, feed-eligible; own
// stock first, then products that have ever sold, then the rest by stock.
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { getFeedProducts } from "../src/lib/feeds/get-feed-products";
import { isPaidAdsEligible } from "../src/lib/feeds/paid-ads-eligibility";
import { isConditionFlagged } from "../src/lib/feeds/condition-flagged";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const N = Number(arg("n", "60"));
const OUT = arg("out", "ops/sk-work/batch.json");

(async () => {
  const feed = (await getFeedProducts()).filter(
    (p) => p.stock > 0 && !p.excludeFromHeureka && !isConditionFlagged(p.name, p.isDefective) && isPaidAdsEligible(p.code, p.brandName),
  );
  const meta = await prisma.product.findMany({
    where: { code: { in: feed.map((p) => p.code) } },
    select: { code: true, salesCount: true, ownStock: true, description: true, nameSk: true },
  });
  const m = new Map(meta.map((x) => [x.code, x]));
  const todo = feed
    .filter((p) => !m.get(p.code)?.nameSk)
    .sort((a, b) => {
      const A = m.get(a.code)!, B = m.get(b.code)!;
      return (B.ownStock > 0 ? 1 : 0) - (A.ownStock > 0 ? 1 : 0) || B.salesCount - A.salesCount || b.stock - a.stock;
    });
  const batch = todo.slice(0, N).map((p) => ({ code: p.code, name: p.heurekaName ?? p.name, brand: p.brandName, description: m.get(p.code)!.description ?? "" }));
  writeFileSync(OUT, JSON.stringify(batch, null, 1));
  console.log(`feed-eligible ${feed.length}, translated ${feed.length - todo.length}, remaining ${todo.length}; wrote ${batch.length} → ${OUT}; chars ${batch.reduce((a, b) => a + b.name.length + b.description.length, 0)}`);
  await prisma.$disconnect();
})();
