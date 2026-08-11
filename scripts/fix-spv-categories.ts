// One-off follow-up to scripts/import-spventure.ts, fixing two category issues:
//
// 1. SP Venture's explicit "Niche perfumes" branch got flattened into the
//    regular gendered Parfémy subcategories by the first import pass — pulls
//    those back out into a new dedicated top-level "Nišové parfémy" category.
// 2. A handful of "Nové"-branch perfumes (no subcategory in the source feed)
//    were misfiled into bare Kosmetika: the heuristic that guesses "is this
//    actually a perfume?" from the product name only recognized the Czech
//    spelling "parfém", not the international "Parfum" used in these names.
//    Re-files them into the correct gendered Parfémy subcategory (inferred
//    from the " W "/" M "/" U " gender marker SP Venture puts in every name).
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

const XML_PATH = process.argv.find((a) => a.startsWith("--file="))?.split("=")[1]
  ?? "/Users/pavlogrican/Downloads/product (1).xml";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractTag(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(block);
  return match ? decodeEntities(match[1].trim()) : "";
}

function parseCategoryByEan(xml: string): Map<string, string> {
  const blocks = xml.split("<SHOPITEM>").slice(1);
  const map = new Map<string, string>();
  for (const raw of blocks) {
    const block = raw.split("</SHOPITEM>")[0];
    const ean = extractTag(block, "EAN");
    if (ean) map.set(ean, extractTag(block, "CATEGORY"));
  }
  return map;
}

async function moveProductToCategory(productId: string, categoryId: string) {
  await prisma.productCategory.deleteMany({ where: { productId } });
  await prisma.productCategory.create({ data: { productId, categoryId } });
}

function inferGenderSlug(name: string): "damske-parfemy" | "panske-parfemy" | "unisex-parfemy" {
  if (/\bW\b/.test(name)) return "damske-parfemy";
  if (/\bM\b/.test(name)) return "panske-parfemy";
  return "unisex-parfemy";
}

async function main() {
  const xml = readFileSync(XML_PATH, "utf-8");
  const categoryByEan = parseCategoryByEan(xml);

  // 1. Create the niche top-level category, sorted before Parfémy (sortOrder 0).
  const niche = await prisma.category.upsert({
    where: { fullSlug: "nisove-parfemy" },
    update: {},
    create: { name: "Nišové parfémy", slug: "nisove-parfemy", fullSlug: "nisove-parfemy", sortOrder: -1 },
  });
  console.log(`Niche category ready: ${niche.id}`);

  const spvProducts = await prisma.product.findMany({
    where: { code: { startsWith: "SPV-" } },
    select: { id: true, ean: true, name: true, categories: { select: { categoryId: true } } },
  });

  let movedToNiche = 0;
  for (const product of spvProducts) {
    const category = product.ean ? categoryByEan.get(product.ean) : undefined;
    if (category?.includes("Niche perfumes")) {
      await moveProductToCategory(product.id, niche.id);
      movedToNiche++;
    }
  }
  console.log(`Moved to Nišové parfémy: ${movedToNiche}`);

  // 2. Re-file "Nové"-branch perfumes that landed in bare Kosmetika.
  const genderCategories = await prisma.category.findMany({
    where: { fullSlug: { in: ["parfemy/damske-parfemy", "parfemy/panske-parfemy", "parfemy/unisex-parfemy"] } },
    select: { id: true, fullSlug: true },
  });
  const genderCategoryId = new Map(genderCategories.map((c) => [c.fullSlug.split("/")[1], c.id]));

  const misfiled = await prisma.product.findMany({
    where: {
      code: { startsWith: "SPV-" },
      categories: { some: { category: { fullSlug: "kosmetika" } } },
      OR: [
        { name: { contains: "Parfum", mode: "insensitive" } },
        { name: { contains: "EDT", mode: "insensitive" } },
        { name: { contains: "EDP", mode: "insensitive" } },
        { name: { contains: "Elixir", mode: "insensitive" } },
        { name: { contains: "Extrait", mode: "insensitive" } },
        { name: { contains: "Eau de", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, ean: true },
  });

  let refiled = 0;
  for (const product of misfiled) {
    const sourceCategory = product.ean ? categoryByEan.get(product.ean) : undefined;
    const targetId = sourceCategory?.includes("Niche perfumes")
      ? niche.id
      : genderCategoryId.get(inferGenderSlug(product.name));
    if (!targetId) continue;
    await moveProductToCategory(product.id, targetId);
    console.log(`  refiled: ${product.name}`);
    refiled++;
  }
  console.log(`Re-filed from bare Kosmetika into Parfémy: ${refiled}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
