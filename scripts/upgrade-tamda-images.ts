// Upgrades TDE (Tamda Express) product photos from the 200x200 thumbnail
// captured at import time to the site's real "detailed" image (500x500,
// confirmed live) — see conversation: the thumbnail's own folder-id in its
// path does NOT reliably match the folder-id the full-size image lives
// under (CS-Cart re-buckets over time), so this re-fetches each product's
// live page fresh and extracts the current detailed-image href rather than
// guessing via string substitution.
//
// Only covers products whose EAN matches one of the two leftover scrape
// files (scripts/tamda-data/tamda-combined-remaining.json, 636 rows) — the
// original full-catalog scrape file was deleted after the initial import,
// so this is a partial (~546 of 2519 TDE products) upgrade, not full
// coverage. Everything not matched is left untouched.
//
// Usage:
//   npx tsx scripts/upgrade-tamda-images.ts --dry-run
//   npx tsx scripts/upgrade-tamda-images.ts
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";

const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 400;

interface ScrapedRow {
  ean: string | null;
  url: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findDetailedImageUrl(productPageUrl: string): Promise<string | null> {
  const res = await fetch(productPageUrl, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(/images\/detailed\/\d+\/\d+\.jpg/);
  return match ? `https://tamdaexpress.eu/${match[0]}` : null;
}

async function main() {
  const scraped: ScrapedRow[] = JSON.parse(
    readFileSync("scripts/tamda-data/tamda-combined-remaining.json", "utf-8"),
  );
  const byEan = new Map(scraped.filter((r) => r.ean).map((r) => [r.ean as string, r]));

  const products = await prisma.product.findMany({
    where: { code: { startsWith: "TDE" }, ean: { not: null } },
    select: { id: true, code: true, ean: true, name: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  const toProcess = products.filter((p) => p.ean && byEan.has(p.ean));
  console.log(`Matched ${toProcess.length} of ${products.length} TDE products by EAN.`);

  if (DRY_RUN) {
    for (const p of toProcess.slice(0, 20)) console.log(" -", p.code, p.name);
    console.log("Dry run — no network calls made.");
    return;
  }

  let upgraded = 0;
  let unchanged = 0;
  let failed = 0;

  for (const product of toProcess) {
    const row = byEan.get(product.ean as string)!;
    try {
      const detailedUrl = await findDetailedImageUrl(row.url);
      if (!detailedUrl) {
        unchanged++;
        console.log(`  [skip] ${product.code}: no detailed image found on page`);
        await sleep(DELAY_MS);
        continue;
      }

      const { urls, errors } = await downloadProductImages(product.code, detailedUrl);
      if (urls.length === 0) {
        failed++;
        console.log(`  [error] ${product.code}: ${errors.join("; ")}`);
        await sleep(DELAY_MS);
        continue;
      }

      const existingImage = product.images[0];
      if (existingImage) {
        await prisma.productImage.update({ where: { id: existingImage.id }, data: { url: urls[0] } });
      } else {
        await prisma.productImage.create({ data: { productId: product.id, url: urls[0], sortOrder: 0 } });
      }
      upgraded++;
      console.log(`  [ok] ${product.code}: ${urls[0]}`);
    } catch (err) {
      failed++;
      console.log(`  [error] ${product.code}: ${err instanceof Error ? err.message : err}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. Upgraded: ${upgraded}, unchanged: ${unchanged}, failed: ${failed}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
