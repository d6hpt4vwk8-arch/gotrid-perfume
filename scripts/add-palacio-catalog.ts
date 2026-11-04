// Adds the Palacio (and Cannabellum) products that are not in the catalog yet — 55 items with a minimum order of
// 1 piece at the manufacturer (cml.palacio.cz B2B portal) — as a demand test: nothing is bought from Palacio up
// front, the first sales are ordered from them together with the next regular order. Data comes from the portal's
// own XML export (ops/palacio-catalog-2026-11-03.xml, distilled into ops/palacio-new-products.json) plus the
// portal's stock figures of 2026-11-04.
//
// Pricing: the owner's rule for these is a 40 % markup on cost INCLUDING VAT (we are not a VAT payer):
// price = round(cost x 1.21 x 1.4). The manufacturer's recommended retail price (DMOC) goes into compareAtPrice
// when we are 8-50 % below it. Stock is capped at 5 per item (3 for the one with 6 left at Palacio) and
// slowerDelivery adds the extra day for ordering from the manufacturer. The PAL- code prefix keeps the items out
// of the paid-ads feeds (see src/lib/feeds/paid-ads-eligibility.ts); CBD names stay out of Google/Meta anyway.
//
// Two phases so the live site never points at files that are not deployed yet:
//   npx tsx --env-file=.env scripts/add-palacio-catalog.ts --plan     print what would be created
//   npx tsx --env-file=.env scripts/add-palacio-catalog.ts --files    download + write image files, no DB change
//   (commit + push the files)
//   npx tsx --env-file=.env scripts/add-palacio-catalog.ts --db       create the products
//   npx tsx --env-file=.env scripts/add-palacio-catalog.ts --revert   delete the products created by --db
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/slug";

const MAX_EDGE = 1400;
const MARKUP = 1.4;
const VAT_FACTOR = 1.21;
const STOCK_CAP = 5;
const DATA_FILE = "ops/palacio-new-products.json";
const MAP_FILE = "ops/snapshots/palacio-new-images-map.json";
const CREATED_FILE = "ops/snapshots/palacio-new-created.json";

interface Item {
  id: string;
  ean: string;
  title: string;
  desc: string;
  ingredients: string;
  pid: number;
  file: number;
  type: string;
  series: string;
  cost: number;
  dmoc: number;
  stock: number;
}

const CATEGORY_BY_TYPE: Record<string, string> = {
  "Dárkové sady": "kosmetika/telo/darkove-sady",
  "Masážní gely, balzámy a oleje": "pece-o-zdravi/masazni-gely",
  "Pleťové krémy": "kosmetika/plet/pletove-kremy",
  "Sůl do koupele": "kosmetika/telo/sprcha-a-koupel",
  "Vlasové masky": "kosmetika/vlasy/vlasove-masky",
  "Pleťové masky": "kosmetika/plet/pletove-masky",
  "Tělová mléka, krémy, balzámy": "kosmetika/telo/telova-mleka",
  "Pleťová séra": "kosmetika/plet/pletova-sera",
  "Sprchové gely": "kosmetika/sprchove-gely",
  "Krémy na ruce": "kosmetika/telo/krem-na-ruce",
  "Čistící pěny": "kosmetika/plet/cisteni-pleti",
  "Pleťové vody": "kosmetika/plet/cisteni-pleti",
  Mýdla: "kosmetika/telo/mydla",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function build(item: Item) {
  const isCannabellum = /^cannabellum/i.test(item.title);
  const name = item.title.replace(/^palacio\b/i, "Palacio").replace(/^cannabellum\b/i, "Cannabellum");
  const code = `PAL-${item.id.replace(/^PAL/, "")}`;
  const price = Math.round(item.cost * VAT_FACTOR * MARKUP);
  const discount = item.dmoc ? 1 - price / item.dmoc : 0;
  const description = item.desc
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("");
  return {
    code,
    name,
    brand: isCannabellum ? "Cannabellum" : "Palacio",
    category: CATEGORY_BY_TYPE[item.type] ?? null,
    purchasePrice: item.cost,
    price,
    compareAtPrice: discount >= 0.08 && discount <= 0.5 ? item.dmoc : null,
    description: description || null,
    ingredients: item.ingredients || null,
    stock: Math.min(item.stock, item.stock < 10 ? 3 : STOCK_CAP),
    ean: item.ean,
  };
}

async function load(): Promise<Item[]> {
  return JSON.parse(await readFile(DATA_FILE, "utf8"));
}

async function plan() {
  const items = await load();
  let cost = 0;
  for (const it of items) {
    const b = build(it);
    cost += b.purchasePrice;
    console.log([b.code, b.brand, b.category ?? "NO CATEGORY", b.purchasePrice, "->", b.price, b.compareAtPrice ?? "-", `stock ${b.stock}`, b.name.slice(0, 60)].join(" | "));
  }
  console.log(`${items.length} items, one of each at cost ${cost.toFixed(0)} Kč ex VAT`);
}

async function render(buf: Buffer): Promise<Buffer> {
  // fill the card with the pack: trim the white margin, then re-centre on a square with ~5 % air
  const flat = sharp(buf).flatten({ background: "#ffffff" });
  const trimmed = await flat.trim({ background: "#ffffff", threshold: 12 }).toBuffer({ resolveWithObject: true });
  const side = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 1.1);
  return sharp(trimmed.data)
    .extend({
      top: Math.floor((side - trimmed.info.height) / 2),
      bottom: Math.ceil((side - trimmed.info.height) / 2),
      left: Math.floor((side - trimmed.info.width) / 2),
      right: Math.ceil((side - trimmed.info.width) / 2),
      background: "#ffffff",
    })
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function files() {
  const items = await load();
  await mkdir("ops/snapshots", { recursive: true });
  const map: Record<string, string[]> = {};
  for (const it of items) {
    const { code } = build(it);
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(code));
    await mkdir(dir, { recursive: true });
    const res = await fetch(`https://cml.palacio.cz/product/${it.pid}/file/${it.file}/w1200`, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image")) {
      console.log(`  [error] ${code}: HTTP ${res.status}`);
      continue;
    }
    const name = `${randomBytes(6).toString("hex")}-p0.jpg`;
    await writeFile(path.join(dir, name), await render(Buffer.from(await res.arrayBuffer())));
    map[code] = [`/uploads/products/${encodeURIComponent(code)}/${name}`];
  }
  await writeFile(MAP_FILE, JSON.stringify(map, null, 1));
  console.log(`${Object.keys(map).length}/${items.length} main photos written`);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 2; await prisma.product.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  return slug;
}

async function db() {
  const items = await load();
  const map: Record<string, string[]> = JSON.parse(await readFile(MAP_FILE, "utf8"));
  const brands = new Map<string, string>();
  for (const name of ["Palacio", "Cannabellum"]) {
    const b = await prisma.brand.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } });
    brands.set(name, b.id);
  }
  const created: string[] = [];
  for (const it of items) {
    const b = build(it);
    if (!b.category) throw new Error(`no category for ${b.code} (${it.type})`);
    if (await prisma.product.findUnique({ where: { code: b.code }, select: { id: true } })) {
      console.log(`  skip ${b.code} (exists)`);
      continue;
    }
    if (await prisma.product.findFirst({ where: { ean: b.ean, visible: true }, select: { code: true } })) {
      console.log(`  skip ${b.code} (EAN already in catalog)`);
      continue;
    }
    const category = await prisma.category.findUnique({ where: { fullSlug: b.category }, select: { id: true } });
    if (!category) throw new Error(`category ${b.category} missing`);
    const images = map[b.code] ?? [];
    await prisma.product.create({
      data: {
        code: b.code,
        name: b.name,
        slug: await uniqueSlug(slugify(b.name)),
        ean: b.ean,
        brandId: brands.get(b.brand)!,
        purchasePrice: b.purchasePrice,
        price: b.price,
        compareAtPrice: b.compareAtPrice,
        vatRate: 21,
        description: b.description,
        ingredients: b.ingredients,
        stock: b.stock,
        slowerDelivery: true,
        visible: images.length > 0,
        images: { create: images.map((url, i) => ({ url, sortOrder: i })) },
        categories: { create: [{ categoryId: category.id }] },
      },
    });
    created.push(b.code);
  }
  await writeFile(CREATED_FILE, JSON.stringify(created, null, 1));
  console.log(`created ${created.length}`);
}

async function revert() {
  const codes: string[] = JSON.parse(await readFile(CREATED_FILE, "utf8"));
  const res = await prisma.product.deleteMany({ where: { code: { in: codes }, orderItems: { none: {} } } });
  console.log(`deleted ${res.count} of ${codes.length} (products with orders are kept)`);
}

const mode = process.argv.includes("--plan")
  ? plan
  : process.argv.includes("--files")
    ? files
    : process.argv.includes("--db")
      ? db
      : process.argv.includes("--revert")
        ? revert
        : null;
if (!mode) {
  console.error("Usage: --plan | --files | --db | --revert");
  process.exit(1);
}
mode()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
