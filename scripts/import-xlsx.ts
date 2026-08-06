import { readFile } from "node:fs/promises";
import { runXlsxImport } from "../src/lib/import/run-import";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Použití: npm run import:xlsx -- <cesta-k-souboru.xlsx>");
    process.exit(1);
  }

  const buffer = await readFile(filePath);
  const report = await runXlsxImport(buffer);

  console.log(`Vytvořeno: ${report.created}`);
  console.log(`Aktualizováno: ${report.updated}`);
  console.log(`Chyby/varování: ${report.errors.length}`);
  for (const err of report.errors) {
    console.log(`  řádek ${err.row} (code=${err.code ?? "-"}): ${err.message}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
