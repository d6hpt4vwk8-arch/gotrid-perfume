// Adds Trade Concept (b2b.tradeconcept.cz) products from three of their categories — Bytové vůně, Kosmetika a parfémy
// and the Drogerie air fresheners — that are NOT in the catalog yet (not at Tamda, not anywhere). Owner's rules
// (2026-11-23): a 50 % markup on cost INCLUDING VAT (we are not a VAT payer): price = round(cost x 1.21 x 1.5); only
// products with a minimum order of 6 pieces or less (or none) and in stock at the supplier; nothing that does not
// belong in the shop (display stands, candle spikes by the 50, urinal screens ...); items already sold from Tamda are
// left out because Tamda is cheaper. The data (ops/tc-fresh.json) was scraped from the owner's logged-in B2B session:
// list pages + product detail pages (description, parameters, all photo links).
//
// Nothing is bought up front: a sale is ordered from Trade Concept together with the next regular order, so every item is
// slowerDelivery and the shown stock is capped. The TCN- code prefix keeps them out of the paid-ads feeds
// (see src/lib/feeds/paid-ads-eligibility.ts) until their margin is known.
//
//   npx tsx --env-file=.env scripts/add-trade-concept-catalog.ts --plan      print what would be created
//   npx tsx --env-file=.env scripts/add-trade-concept-catalog.ts --files     download + render photos, no DB change
//   (commit + push the files)
//   npx tsx --env-file=.env scripts/add-trade-concept-catalog.ts --db        create the products HIDDEN
//   npx tsx --env-file=.env scripts/add-trade-concept-catalog.ts --reveal    make the created products visible
//   npx tsx --env-file=.env scripts/add-trade-concept-catalog.ts --revert    delete the products created by --db
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/slug";

const MAX_EDGE = 1000;
const MARKUP = 1.5;
const VAT_FACTOR = 1.21;
const STOCK_CAP = 5;
const MIN_PRICE = 29;
const MAX_PHOTOS = 4;
const DATA_FILE = "ops/tc-fresh.json";
const PLAN_FILE = "ops/snapshots/tc-plan.json";
const MAP_FILE = "ops/snapshots/tc-images-map.json";
const CREATED_FILE = "ops/snapshots/tc-created.json";
const IMG_BASE = "https://b2b.tradeconcept.cz/";

interface Raw {
  n: string; // title
  c: string; // EAN
  m: number | null; // minimum order quantity
  k: number | null; // carton size
  p: number; // cost ex VAT
  s: string; // stock text
  u: string;
  cats: string[];
  desc: string;
  boxes: Record<string, string>;
  imgs: string[];
  brand: string;
}

// Things that do not belong in a perfume / cosmetics / home-fragrance shop, or that are B2B-only bulk items.
const EXCLUDE = /(stojan|stojánek|sítko do pisoáru|bodce na svíčky|stojan na produkty)/i;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const decode = (s: string) =>
  s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&ocirc;/gi, "ô").replace(/&hellip;/g, "…");

function brandOf(r: Raw): string {
  const b = (r.brand || "").trim();
  if (/^moonshine/i.test(r.n)) return "Moonshine Yoga";
  if (/^home elements/i.test(r.n)) return "Home Elements";
  if (/^ar[ôo]me$/i.test(b)) return "Arôme";
  if (/^home elements$/i.test(b)) return "Home Elements";
  if (/^song of india$/i.test(b)) return "Song of India";
  if (/^moonshine/i.test(b) || /^moonshine/i.test(r.n)) return "Moonshine Yoga";
  return b || "Arôme";
}

function cleanName(r: Raw, brand: string): string {
  let n = r.n.replace(/\s+/g, " ").trim().replace(/,\s*$/, "");
  n = n.replace(/^AR[ÔO]ME\b/i, "Arôme").replace(/^HOME ELEMENTS\b/i, "Home Elements");
  if (!new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(n)) n = `${brand} ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
  else {
    // "Arôme Svíčka 120 g, ..." → "Arôme svíčka 120 g, ..." (keep the brand capital, lowercase the product noun)
    const rest = n.slice(brand.length).trim();
    n = /^(Balanced|Tree of life|Vent Stick|Secret garden|Chakra|Lava)\b/.test(rest) ? `${brand} ${rest}` : `${brand} ${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;
  }
  return n.replace(/(?<!\d)\s*,\s*(?!\d)/g, ", ").replace(/\s{2,}/g, " ").replace(/\s+g\b/g, " g").replace(/(\d)g\b/g, "$1 g").replace(/(\d)ml\b/gi, "$1 ml").replace(/(\d)cm\b/gi, "$1 cm");
}

function category(name: string): string | null {
  const n = name.toLowerCase();
  if (/osvěžovač do auta|vent stick/.test(n)) return "vune-do-auta";
  if (/dárková kosmetická sada/.test(n)) return "kosmetika/telo/darkove-sady";
  if (/gelový osvěžovač|lava gelový|osvěžovač vzduchu/.test(n)) return "domacnost/osvezovace-vzduchu/pro-pokoje";
  if (/difuz|náhradní náplň|aromaterapie|náhradní tyčinky/.test(n)) return "aroma-difuzery";
  if (/aromalampa/.test(n)) return "aroma-difuzery";
  if (/jíl|sáčky|kadidlo|tyčinek|tyčinky|olej/.test(n) && !/františ/.test(n)) return "domacnost/osvezovace-vzduchu/pro-pokoje";
  if (/svíč|svíc|františk|vosk|kostky|loďka/.test(n)) return "vonne-svicky";
  return null;
}

function params(r: Raw): { label: string; value: string }[] {
  const t = (r.boxes.detail_parametry || "").replace(/\s+/g, " ");
  const labels = [
    "Rozměry zboží d x š x v cm", "Rozměry kartonu v x š x h cm", "Váha zboží - čistá bez balení kg", "Váha kartonu (celková) kg",
    "Objem (ml)", "Typ Balení", "Název vůně", "ks/display-vnitřní balení", "Typ Vzoru/Designu", "Obecný název", "Počet kusů v kartonu",
    "Hmotnost", "Objem", "Vůně", "Barva", "Materiál", "Doba hoření",
  ].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  const parts = t.split(re).map((s) => s.trim());
  const map = new Map<string, string>();
  for (let i = 1; i < parts.length; i += 2) if (!map.has(parts[i])) map.set(parts[i], (parts[i + 1] ?? "").trim());
  const out: { label: string; value: string }[] = [];
  const dims = map.get("Rozměry zboží d x š x v cm");
  if (dims) out.push({ label: "Rozměry", value: /cm/i.test(dims) ? dims : `${dims} cm` });
  const vol = map.get("Objem (ml)");
  if (vol) out.push({ label: "Objem", value: /ml/i.test(vol) ? vol : `${vol} ml` });
  const scent = map.get("Název vůně") || map.get("Vůně");
  if (scent && scent.length < 60) out.push({ label: "Vůně", value: scent });
  const burn = /hodin|hod\b/i.test(r.desc) ? "" : (map.get("Doba hoření") ?? "").replace(/\D/g, "");
  if (burn) out.push({ label: "Doba hoření", value: `${burn} hod` });
  const mat = map.get("Materiál");
  if (mat && mat.length < 60) out.push({ label: "Materiál", value: mat.replace(/\+/g, ", ").replace(/\s+/g, " ") });
  return out;
}

function describe(r: Raw, brand: string, name: string): string | null {
  // keep their copy (it is good), strip markup down to p / ul / li / strong, drop empties
  const m = r.desc.match(/<div class="detail_content"[^>]*>([\s\S]*?)<\/div>\s*$/i);
  let html = (m ? m[1] : r.desc) || "";
  html = html
    .replace(/<(?!\/?(p|ul|ol|li|strong|b|em|i|br)\b)[^>]+>/gi, "")
    .replace(/<(\/?)b>/gi, "<$1strong>")
    .replace(/<p[^>]*>/gi, "<p>")
    .replace(/<li[^>]*>/gi, "<li>")
    .replace(/<strong[^>]*>/gi, "<strong>")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/g, "")
    .trim();
  if (!html) html = `<p>${esc(name)}.</p>`;
  // "Tip na použití:" style paragraphs the supplier writes are fine; remove carton / B2B-only lines
  html = html.replace(/<li>[^<]*(karton|display|paleta|distribu)[^<]*<\/li>/gi, "").replace(/<ul>\s*<\/ul>/g, "");
  const ps = params(r);
  const specs = [{ label: "Značka", value: brand }, ...ps].map((p) => `<li><strong>${esc(p.label)}:</strong> ${esc(decode(p.value))}</li>`).join("");
  return `${decode(html)}<p><strong>Parametry</strong></p><ul>${specs}</ul>`;
}

function build(r: Raw) {
  const brand = brandOf(r);
  const name = cleanName(r, brand);
  const price = Math.round(r.p * VAT_FACTOR * MARKUP);
  const stockNum = Number((r.s.match(/(\d+)/) ?? [])[1] ?? 0);
  return {
    code: `TCN-${r.c}`,
    ean: r.c,
    name,
    brand,
    category: category(name),
    cost: r.p,
    price,
    stock: Math.max(1, Math.min(stockNum > 0 ? STOCK_CAP : 0, STOCK_CAP)),
    minQty: r.m,
    description: describe(r, brand, name),
    imgs: r.imgs,
  };
}

async function load(): Promise<Raw[]> {
  return JSON.parse(await readFile(DATA_FILE, "utf8"));
}

function selected(raw: Raw[]) {
  const out: ReturnType<typeof build>[] = [];
  const skipped: { why: string; name: string }[] = [];
  for (const r of raw) {
    if (EXCLUDE.test(r.n)) { skipped.push({ why: "mimo profil", name: r.n }); continue; }
    const b = build(r);
    if (!b.category) { skipped.push({ why: "bez kategorie", name: r.n }); continue; }
    if (b.price < MIN_PRICE) { skipped.push({ why: `cena ${b.price} Kč`, name: r.n }); continue; }
    out.push(b);
  }
  return { out, skipped };
}

async function plan() {
  const { out, skipped } = selected(await load());
  const byCat: Record<string, number> = {};
  for (const b of out) byCat[b.category!] = (byCat[b.category!] ?? 0) + 1;
  await mkdir("ops/snapshots", { recursive: true });
  await writeFile(PLAN_FILE, JSON.stringify(out, null, 1));
  for (const b of out) console.log([b.code, b.brand, b.category, b.cost, "->", b.price, `min ${b.minQty ?? "-"}`, `${b.imgs.length} photos`, b.name.slice(0, 70)].join(" | "));
  console.log("\nSKIPPED");
  for (const s of skipped) console.log(`  ${s.why}: ${s.name}`);
  console.log(`\n${out.length} to create, ${skipped.length} skipped`, byCat);
  const noDesc = out.filter((b) => !b.description).length;
  console.log(`without description: ${noDesc}; total photos ${out.reduce((s, b) => s + Math.min(b.imgs.length, MAX_PHOTOS), 0)}`);
}

async function render(buf: Buffer): Promise<Buffer> {
  // fill the card with the pack: trim the white margin, then re-centre on a square with ~6 % air; lifestyle photos stay as they are
  const flat = sharp(buf).flatten({ background: "#ffffff" });
  const meta = await sharp(buf).metadata();
  const trimmed = await flat.trim({ background: "#ffffff", threshold: 14 }).toBuffer({ resolveWithObject: true });
  const trimmedAreaRatio = (trimmed.info.width * trimmed.info.height) / ((meta.width ?? 1) * (meta.height ?? 1));
  if (trimmedAreaRatio > 0.92) {
    // nothing to trim → a scene photo (full bleed): just fit it
    return sharp(buf).flatten({ background: "#ffffff" }).resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 76 }).toBuffer();
  }
  const side = Math.round(Math.max(trimmed.info.width, trimmed.info.height) * 1.12);
  return sharp(trimmed.data)
    .extend({
      top: Math.floor((side - trimmed.info.height) / 2),
      bottom: Math.ceil((side - trimmed.info.height) / 2),
      left: Math.floor((side - trimmed.info.width) / 2),
      right: Math.ceil((side - trimmed.info.width) / 2),
      background: "#ffffff",
    })
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 76 })
    .toBuffer();
}

async function files() {
  const { out } = selected(await load());
  await mkdir("ops/snapshots", { recursive: true });
  const map: Record<string, string[]> = {};
  let photos = 0;
  for (const b of out) {
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(b.code));
    await mkdir(dir, { recursive: true });
    const seen = new Set<string>();
    const urls: string[] = [];
    let idx = 0;
    for (const rel of b.imgs.slice(0, MAX_PHOTOS + 4)) {
      if (urls.length >= MAX_PHOTOS) break;
      if (/newsletter|difuzer_all|all_cakty|icons|logo/i.test(rel)) continue;
      try {
        const res = await fetch(IMG_BASE + rel.replace(/^\//, ""), { signal: AbortSignal.timeout(60_000) });
        if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image")) continue;
        const raw = Buffer.from(await res.arrayBuffer());
        const hash = createHash("md5").update(raw).digest("hex");
        if (seen.has(hash)) continue;
        seen.add(hash);
        const meta = await sharp(raw).metadata();
        if ((meta.width ?? 0) < 400) continue;
        const name = `${randomBytes(6).toString("hex")}-p${idx}.jpg`;
        await writeFile(path.join(dir, name), await render(raw));
        urls.push(`/uploads/products/${encodeURIComponent(b.code)}/${name}`);
        idx++;
        photos++;
      } catch (err) {
        console.log(`  [error] ${b.code} ${rel}: ${(err as Error).message}`);
      }
    }
    if (urls.length) map[b.code] = urls;
    else console.log(`  [no photo] ${b.code} ${b.name}`);
  }
  await writeFile(MAP_FILE, JSON.stringify(map, null, 1));
  console.log(`${Object.keys(map).length}/${out.length} products with photos, ${photos} files`);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 2; await prisma.product.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  return slug;
}

async function db() {
  const { out } = selected(await load());
  const map: Record<string, string[]> = JSON.parse(await readFile(MAP_FILE, "utf8"));
  const brands = new Map<string, string>();
  for (const name of new Set(out.map((b) => b.brand))) {
    const b = await prisma.brand.upsert({ where: { slug: slugify(name) }, update: {}, create: { name, slug: slugify(name) } });
    brands.set(name, b.id);
  }
  const created: string[] = [];
  for (const b of out) {
    if (await prisma.product.findUnique({ where: { code: b.code }, select: { id: true } })) { console.log(`  skip ${b.code} (exists)`); continue; }
    if (await prisma.product.findFirst({ where: { ean: b.ean }, select: { code: true } })) { console.log(`  skip ${b.code} (EAN already in catalog)`); continue; }
    const images = map[b.code] ?? [];
    if (!images.length) { console.log(`  skip ${b.code} (no photos)`); continue; }
    const category = await prisma.category.findUnique({ where: { fullSlug: b.category! }, select: { id: true } });
    if (!category) throw new Error(`category ${b.category} missing`);
    await prisma.product.create({
      data: {
        code: b.code,
        name: b.name,
        slug: await uniqueSlug(slugify(b.name)),
        ean: b.ean,
        brandId: brands.get(b.brand)!,
        purchasePrice: b.cost,
        price: b.price,
        vatRate: 21,
        description: b.description,
        stock: b.stock,
        slowerDelivery: true,
        visible: false,
        images: { create: images.map((url, i) => ({ url, sortOrder: i })) },
        categories: { create: [{ categoryId: category.id }] },
      },
    });
    created.push(b.code);
  }
  await writeFile(CREATED_FILE, JSON.stringify(created, null, 1));
  console.log(`created ${created.length} (hidden)`);
}

async function reveal() {
  const created: string[] = JSON.parse(await readFile(CREATED_FILE, "utf8"));
  const r = await prisma.product.updateMany({ where: { code: { in: created } }, data: { visible: true } });
  console.log(`visible: ${r.count}`);
}

async function revert() {
  const created: string[] = JSON.parse(await readFile(CREATED_FILE, "utf8"));
  const r = await prisma.product.deleteMany({ where: { code: { in: created } } });
  console.log(`deleted ${r.count}`);
}

async function main() {
  const flag = process.argv[2];
  if (flag === "--plan") await plan();
  else if (flag === "--files") await files();
  else if (flag === "--db") await db();
  else if (flag === "--reveal") await reveal();
  else if (flag === "--revert") await revert();
  else console.log("use --plan | --files | --db | --reveal | --revert");
}

main().then(() => prisma.$disconnect());
