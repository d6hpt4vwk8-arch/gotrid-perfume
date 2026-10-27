/**
 * Sets Product.compareAtPrice of visible Palacio products to the manufacturer's current retail price (palacioshop.cz,
 * incl. VAT) so the site can show "Cena u výrobce" crossed out next to our lower price. Matching is by EAN; only
 * prices that make a believable comparison are written (our price 8–50 % below theirs). Prices come from
 * ops/palacio-prices-2026-10-27.json (scraped from the product pages' JSON-LD, ex-VAT x 1.21). Re-scrape and re-run
 * when Palacio changes its prices. A before-snapshot goes to ops/snapshots/.
 *   npx tsx --env-file=.env scripts/set-palacio-reference-prices.ts [--apply]
 */
import { readFileSync, writeFileSync } from "fs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");
  const data: { need: Record<string, string>; prices: Record<string, { jsonld: string[] }> } = JSON.parse(readFileSync("ops/palacio-prices-2026-10-27.json", "utf8"));
  const ids = Object.keys(data.need);
  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, price: true, compareAtPrice: true } });
  const plan: { id: string; name: string; price: number; reference: number; before: number | null }[] = [];
  const skipped: string[] = [];
  for (const p of products) {
    const net = Number(data.prices[data.need[p.id]]?.jsonld?.[0]);
    if (!net) continue;
    const reference = Math.round(net * 1.21);
    const ours = Number(p.price);
    const discount = 1 - ours / reference;
    if (discount < 0.08 || discount > 0.5) { skipped.push(`${p.name} (ours ${ours}, theirs ${reference}, ${Math.round(discount * 100)} %)`); continue; }
    plan.push({ id: p.id, name: p.name, price: ours, reference, before: p.compareAtPrice ? Number(p.compareAtPrice) : null });
  }
  console.log(`to set: ${plan.length}; skipped: ${skipped.length}`);
  skipped.forEach((s) => console.log("  skipped:", s));
  console.log("already had a compareAtPrice:", plan.filter((p) => p.before !== null).map((p) => p.name).join(" | ") || "none");
  if (!apply) return;
  writeFileSync(`ops/snapshots/palacio-compare-before-${Date.now()}.json`, JSON.stringify(plan.map((p) => ({ id: p.id, compareAtPrice: p.before }))));
  for (const p of plan) await prisma.product.update({ where: { id: p.id }, data: { compareAtPrice: p.reference } });
  console.log("applied", plan.length);
}
main().then(() => process.exit(0));
