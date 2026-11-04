// Descriptions for the 55 Palacio/Cannabellum products from add-palacio-catalog.ts: Czech copy from the
// manufacturer's own e-shop palacioshop.cz (ops/palacio-new-desc-cs.json, built by converting the product pages
// to our HTML; four items that are not sold there are written from the manufacturer's data and sibling pages),
// Slovak name + description from ops/palacio-new-sk.json. Also sets the on-site stock to 10 per item.
//   npx tsx --env-file=.env scripts/update-palacio-copy.ts --cs    Czech descriptions + stock 10
//   npx tsx --env-file=.env scripts/update-palacio-copy.ts --sk    Slovak name + description
// Before-state of the touched fields goes to ops/snapshots/palacio-copy-before-<timestamp>.json.
import { readFile, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";

const codeOf = (id: string) => `PAL-${id.replace(/^PAL/, "")}`;

async function snapshot(codes: string[]) {
  const rows = await prisma.product.findMany({ where: { code: { in: codes } }, select: { code: true, description: true, nameSk: true, descriptionSk: true, stock: true } });
  await writeFile(`ops/snapshots/palacio-copy-before-${Date.now()}.json`, JSON.stringify(rows));
}

async function cs() {
  const desc: Record<string, string> = JSON.parse(await readFile("ops/palacio-new-desc-cs.json", "utf8"));
  const codes = Object.keys(desc).map(codeOf);
  await snapshot(codes);
  let n = 0;
  for (const [id, html] of Object.entries(desc)) {
    const res = await prisma.product.updateMany({ where: { code: codeOf(id) }, data: { description: html, stock: 10 } });
    n += res.count;
  }
  console.log(`updated ${n}`);
}

async function sk() {
  const data: Record<string, { name: string; description: string }> = JSON.parse(await readFile("ops/palacio-new-sk.json", "utf8"));
  await snapshot(Object.keys(data).map(codeOf));
  let n = 0;
  for (const [id, v] of Object.entries(data)) {
    const res = await prisma.product.updateMany({ where: { code: codeOf(id) }, data: { nameSk: v.name, descriptionSk: v.description } });
    n += res.count;
  }
  console.log(`updated ${n} of ${Object.keys(data).length}`);
}

const mode = process.argv.includes("--cs") ? cs : process.argv.includes("--sk") ? sk : null;
if (!mode) {
  console.error("Usage: --cs | --sk");
  process.exit(1);
}
mode().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
