// Manual CLI runner for the SP Venture stock sync (also runs automatically
// via Vercel Cron — see src/app/api/cron/sync-spventure-stock/route.ts).
// Usage:
//   npx tsx scripts/sync-spventure-stock.ts --dry-run
//   npx tsx scripts/sync-spventure-stock.ts
import { syncSpVentureStock } from "../src/lib/sync/spventure-stock";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`Fetching SP Venture feed and comparing against our catalog${DRY_RUN ? " (dry run)" : ""}...`);
  const result = await syncSpVentureStock(DRY_RUN);

  console.log(`\nChecked ${result.checked} SP Venture-sourced products.`);

  if (result.updated.length > 0) {
    const toZero = result.updated.filter((u) => u.to === 0);
    const changed = result.updated.filter((u) => u.to !== 0);
    console.log(`\nStock updated (${result.updated.length} total — ${changed.length} restocked/changed, ${toZero.length} now at 0):`);
    for (const u of result.updated) console.log(`  ${u.code} ${u.name}: ${u.from} -> ${u.to}`);
  } else {
    console.log("\nNo stock changes.");
  }

  if (result.priceRaised.length > 0) {
    console.log(`\nSell price ${DRY_RUN ? "would be raised" : "raised"} to the cost floor (${result.priceRaised.length}):`);
    for (const r of result.priceRaised.sort((a, b) => a.from / a.cost - b.from / b.cost))
      console.log(`  ${r.code} ${r.name.slice(0, 45)}: ${r.from} -> ${r.to} (cost incl. VAT ${r.cost})`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
