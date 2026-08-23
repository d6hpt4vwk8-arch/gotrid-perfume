// Manual CLI runner for the perfumes-wholesale.eu stock sync (also runs
// automatically via Vercel Cron — bundled into
// src/app/api/cron/daily-tasks/route.ts).
// Usage:
//   npx tsx scripts/sync-perfumeswholesale-stock.ts --dry-run
//   npx tsx scripts/sync-perfumeswholesale-stock.ts
import { syncPerfumesWholesaleStock } from "../src/lib/sync/perfumeswholesale-stock";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`Fetching perfumes-wholesale.eu feed and comparing against our catalog${DRY_RUN ? " (dry run)" : ""}...`);
  const result = await syncPerfumesWholesaleStock(DRY_RUN);

  console.log(`\nChecked ${result.checked} perfumes-wholesale.eu-sourced products.`);

  if (result.updated.length > 0) {
    const toZero = result.updated.filter((u) => u.to === 0);
    const changed = result.updated.filter((u) => u.to !== 0);
    console.log(`\nStock updated (${result.updated.length} total — ${changed.length} restocked/changed, ${toZero.length} now at 0):`);
    for (const u of result.updated) console.log(`  ${u.code} ${u.name}: ${u.from} -> ${u.to}`);
  } else {
    console.log("\nNo stock changes.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
