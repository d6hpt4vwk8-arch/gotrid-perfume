// One-off (2026-10-16): products that SP Venture really supplies but that sit under a foreign
// code ("SPV<EAN>" without the dash, PWH-…, CRD-…, an old numeric code) — the stock sync only
// walks `SPV-` codes, so their stock, wholesale price and price floor were never refreshed
// (e.g. Lattafa Yara 100 ml: listed with the PWH cost 316.81 while SPV charges 348.79+, sold
// at 460 against a 506 floor). This moves them under `SPV-<ITEM_CODE>` and applies the feed's
// numbers once; the hourly sync keeps them current afterwards.
//
// Matching is by EAN against the live feed. Products held in our own stock are left alone,
// as are EANs the Tamda conversion owns (see convert-legacy-ean-products-to-tamda.ts).
// If an `SPV-<ITEM_CODE>` product already exists, the legacy listing is hidden instead.
// Usage: tsx scripts/convert-legacy-products-to-spv.ts [--apply]
import { writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const FEED = "https://www.perfumes-b2b.com/exchange/06560451-31AA-4C08-9B66-C149E1FF95DB/xml/product.xml?cy=czk";
const VAT = 1.21;
const MARKUP = 1.2;
// Handled by the Tamda conversion (found in Tamda's catalogue).
const TAMDA_OWNED_EANS = new Set(["5060120164063", "5060120164087", "3574660520101"]);

const tag = (b: string, t: string) => new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`).exec(b)?.[1]?.trim() ?? "";

async function main() {
  const apply = process.argv.includes("--apply");
  const xml = await (await fetch(FEED)).text();
  const feed = xml
    .split("<SHOPITEM>")
    .slice(1)
    .map((r) => r.split("</SHOPITEM>")[0])
    .map((b) => ({ code: tag(b, "ITEM_CODE"), ean: tag(b, "EAN"), price: parseFloat(tag(b, "PRICE")), stock: parseInt(tag(b, "STOCK") || "0", 10) }))
    .filter((i) => i.code && i.ean && Number.isFinite(i.price));
  const byEan = new Map<string, (typeof feed)[number]>();
  for (const i of feed) {
    const cur = byEan.get(i.ean);
    if (!cur || i.price < cur.price) byEan.set(i.ean, i);
  }
  if (feed.length < 1000) throw new Error(`feed looks broken (${feed.length} items)`);

  const legacy = await prisma.product.findMany({
    where: {
      visible: true,
      ownStock: 0,
      ean: { not: null },
      NOT: ["SPV-", "TDE-", "GVS-", "ROM-"].map((p) => ({ code: { startsWith: p } })),
    },
    select: { id: true, code: true, ean: true, name: true, price: true, purchasePrice: true, stock: true, compareAtPrice: true },
  });
  const spvCodes = new Set((await prisma.product.findMany({ where: { code: { startsWith: "SPV-" } }, select: { code: true } })).map((p) => p.code));

  const plan = legacy
    .filter((p) => byEan.has(p.ean!) && !TAMDA_OWNED_EANS.has(p.ean!))
    .map((p) => {
      const f = byEan.get(p.ean!)!;
      const newCode = `SPV-${f.code}`;
      const floor = Math.round(f.price * VAT * MARKUP);
      return { p, f, newCode, clash: spvCodes.has(newCode), floor, newPrice: Math.max(Number(p.price), floor) };
    });

  for (const x of plan) {
    console.log(
      `${x.clash ? "HIDE " : "MOVE "}${x.p.code} -> ${x.newCode} | ${x.p.name.slice(0, 38)} | cost ${Number(x.p.purchasePrice)} -> ${x.f.price} | price ${Number(x.p.price)} -> ${x.newPrice} | stock ${x.p.stock} -> ${x.f.stock}`,
    );
  }
  console.log({ total: plan.length, clash: plan.filter((x) => x.clash).length, priceRaised: plan.filter((x) => !x.clash && x.newPrice > Number(x.p.price)).length });
  if (!apply) return;

  const snapPath = `ops/snapshots/legacy-to-spv-${Date.now()}.json`;
  writeFileSync(
    snapPath,
    JSON.stringify(plan.map((x) => ({ id: x.p.id, code: x.p.code, visible: true, stock: x.p.stock, price: Number(x.p.price), purchasePrice: Number(x.p.purchasePrice), compareAtPrice: x.p.compareAtPrice === null ? null : Number(x.p.compareAtPrice) }))),
  );
  console.log("snapshot", snapPath);

  for (const x of plan) {
    if (x.clash) {
      await prisma.product.update({ where: { id: x.p.id }, data: { visible: false } });
      continue;
    }
    await prisma.product.update({
      where: { id: x.p.id },
      data: {
        code: x.newCode,
        purchasePrice: x.f.price,
        stock: x.f.stock,
        price: x.newPrice,
        ...(x.newPrice > Number(x.p.price) && x.p.compareAtPrice !== null && Number(x.p.compareAtPrice) <= x.newPrice ? { compareAtPrice: null } : {}),
      },
    });
  }
  await prisma.adminActivityLog.create({
    data: {
      action: "product.legacy_to_spv",
      entityType: "Product",
      detail: `Legacy-coded products supplied by SP Venture moved to SPV- codes: ${plan.filter((x) => !x.clash).length} moved, ${plan.filter((x) => x.clash).length} duplicates hidden (snapshot ${snapPath})`,
    },
  });
  console.log("done");
}
main().finally(() => prisma.$disconnect());
