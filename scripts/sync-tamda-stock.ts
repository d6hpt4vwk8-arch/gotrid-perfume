// Manual runner for the Tamda stock + price check (see src/lib/sync/tamda-stock.ts).
// Credentials come from the environment — never put them in a file or commit them:
//   TAMDA_EMAIL='...' TAMDA_PASSWORD='...' npx tsx scripts/sync-tamda-stock.ts --dry-run --top 100
//   TAMDA_EMAIL='...' TAMDA_PASSWORD='...' npx tsx scripts/sync-tamda-stock.ts            (writes, all products, ~13 min)
// Flags:
//   --dry-run              print only, write nothing to the database
//   --top N                best sellers only (100 EANs ≈ 30 s)
//   --save-answers=PATH    keep Tamda's answers in a JSON file ...
//   --use-answers=PATH     ... and reuse them later (no login, no new requests to Tamda),
//                          e.g. dry run first, apply the very same answers afterwards
//   --report=PATH          write the full result (stock changes, price raises) as JSON
import { readFileSync, writeFileSync } from "node:fs";
import { loginTamda, syncTamdaStock, type TamdaStockRow } from "../src/lib/sync/tamda-stock";

const DRY_RUN = process.argv.includes("--dry-run");
const topIdx = process.argv.indexOf("--top");
const TOP = topIdx >= 0 ? parseInt(process.argv[topIdx + 1], 10) : undefined;
const flag = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SAVE_ANSWERS = flag("save-answers");
const USE_ANSWERS = flag("use-answers");
const REPORT = flag("report");

async function main() {
  let answers: Map<string, TamdaStockRow> | undefined;
  let session = null;
  if (USE_ANSWERS) {
    answers = new Map(Object.entries(JSON.parse(readFileSync(USE_ANSWERS, "utf8")) as Record<string, TamdaStockRow>));
    console.log(`Using ${answers.size} saved Tamda answers from ${USE_ANSWERS} (no login).`);
  } else {
    const email = process.env.TAMDA_EMAIL;
    const password = process.env.TAMDA_PASSWORD;
    if (!email || !password) throw new Error("Set TAMDA_EMAIL and TAMDA_PASSWORD in the environment.");
    console.log("Logging in to Tamda...");
    session = await loginTamda(email, password);
    console.log("Login OK.");
  }

  console.log(`Checking stock${TOP ? ` for the top ${TOP} sellers` : " for all TDE- products"}${DRY_RUN ? " (dry run)" : ""}...`);
  const result = await syncTamdaStock(session, {
    dryRun: DRY_RUN,
    top: TOP,
    answers,
    onAnswers: (fresh) => {
      if (SAVE_ANSWERS) {
        writeFileSync(SAVE_ANSWERS, JSON.stringify(Object.fromEntries(fresh)));
        console.log(`Saved ${fresh.size} answers to ${SAVE_ANSWERS}`);
      }
    },
    onProgress: (done, total) => console.log(`  ${done}/${total}`),
  });

  if (REPORT) writeFileSync(REPORT, JSON.stringify(result, null, 1));

  console.log(`\nChecked ${result.checked}, unanswered ${result.unanswered}.`);
  if (result.aborted) {
    console.log(`ABORTED: ${result.aborted}`);
    return;
  }

  const toZero = result.updated.filter((u) => u.to === 0);
  console.log(`\nStock ${DRY_RUN ? "would change" : "updated"} for ${result.updated.length} products (${toZero.length} to 0).`);
  console.log(`Purchase prices ${DRY_RUN ? "would be refreshed" : "refreshed"}: ${result.purchaseUpdated}.`);
  console.log(`Sell prices ${DRY_RUN ? "would be raised" : "raised"} to Tamda price × 1.3: ${result.priceRaised.length} (Tamda price >5 % above recorded cost: ${result.priceUp.length}).`);
  if (REPORT) console.log(`Full details: ${REPORT}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
