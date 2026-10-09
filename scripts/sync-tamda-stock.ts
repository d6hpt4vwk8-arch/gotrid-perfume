// Manual runner for the Tamda stock check (see src/lib/sync/tamda-stock.ts).
// Credentials come from the environment — never put them in a file or commit them:
//   TAMDA_EMAIL='...' TAMDA_PASSWORD='...' npx tsx scripts/sync-tamda-stock.ts --dry-run --top 100
//   TAMDA_EMAIL='...' TAMDA_PASSWORD='...' npx tsx scripts/sync-tamda-stock.ts            (writes stock, all products, ~13 min)
// Flags: --dry-run (print only), --top N (best sellers only; 100 EANs ≈ 30 s).
import { loginTamda, syncTamdaStock } from "../src/lib/sync/tamda-stock";

const DRY_RUN = process.argv.includes("--dry-run");
const topIdx = process.argv.indexOf("--top");
const TOP = topIdx >= 0 ? parseInt(process.argv[topIdx + 1], 10) : undefined;

async function main() {
  const email = process.env.TAMDA_EMAIL;
  const password = process.env.TAMDA_PASSWORD;
  if (!email || !password) throw new Error("Set TAMDA_EMAIL and TAMDA_PASSWORD in the environment.");

  console.log("Logging in to Tamda...");
  const session = await loginTamda(email, password);
  console.log("Login OK.");

  console.log(`Checking stock${TOP ? ` for the top ${TOP} sellers` : " for all TDE- products"}${DRY_RUN ? " (dry run)" : ""}...`);
  const result = await syncTamdaStock(session, {
    dryRun: DRY_RUN,
    top: TOP,
    onProgress: (done, total) => console.log(`  ${done}/${total}`),
  });

  console.log(`\nChecked ${result.checked}, unanswered ${result.unanswered}.`);
  if (result.aborted) {
    console.log(`ABORTED: ${result.aborted}`);
    return;
  }

  const toZero = result.updated.filter((u) => u.to === 0);
  console.log(`\nStock ${DRY_RUN ? "would change" : "updated"} for ${result.updated.length} products (${toZero.length} to 0):`);
  for (const u of result.updated) console.log(`  ${u.code} [${u.reason}] ${u.name.slice(0, 50)}: ${u.from} -> ${u.to}`);

  if (result.priceUp.length > 0) {
    console.log(`\nTamda price >5 % above our cost incl. VAT (${result.priceUp.length}, not changed):`);
    for (const p of result.priceUp) console.log(`  ${p.code} ${p.name.slice(0, 50)}: our cost ${p.ourCost} -> Tamda ${p.tamda}`);
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
