// Third Tamda Express batch (2026-11-14): everything the discovery run found that the shop does not carry yet
// (scripts/discover-new-tamda-products.ts), checked live through Tamda's "Objednávka z CSV" tool from the owner's
// logged-in browser (min / max stock / price incl. VAT per EAN → scripts/tamda-data/tamda-check-2026-11-14.json).
//
// Rules (owner, 2026-11-14): only categories that already exist on the site (no new ones); no grave candles; the
// "fake" perfume lines Sofines and Elode are excluded (already filtered out of the candidate file); decorative
// candles are in. Items with a Tamda minimum order above 6, or with less stock than the minimum, are skipped. Price = Tamda price incl. VAT × 1.3 (same as batch 2), cost =
// price / 1.21. Products are created HIDDEN (--visible to override) so the live site never points at image files
// that are not deployed yet; reveal them after the push with --reveal=<created codes json>.
//
//   npx tsx --env-file=.env scripts/import-tamda-batch3.ts --dry-run
//   npx tsx --env-file=.env scripts/import-tamda-batch3.ts --created-out=ops/snapshots/tamda3-created-2026-11-14.json
//   npx tsx --env-file=.env scripts/import-tamda-batch3.ts --reveal=ops/snapshots/tamda3-created-2026-11-14.json
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { downloadProductImages } from "../src/lib/import/download-images";
import { slugify } from "../src/lib/slug";

const CANDIDATES = "scripts/tamda-data/new-candidates-filtered-2026-11-14.json";
const CHECK = process.argv.find((a) => a.startsWith("--check="))?.split("=")[1] ?? "scripts/tamda-data/tamda-check-2026-11-14.json";
const DRY_RUN = process.argv.includes("--dry-run");
const VISIBLE = process.argv.includes("--visible");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0");
const CREATED_OUT = process.argv.find((a) => a.startsWith("--created-out="))?.split("=")[1];
const REVEAL = process.argv.find((a) => a.startsWith("--reveal="))?.split("=")[1];
// Owner (2026-11-14): a Tamda minimum order of up to 6 pieces is fine, and a handful of units in stock is fine too.
const MAX_MIN_ORDER = Number(process.argv.find((a) => a.startsWith("--max-min="))?.split("=")[1] ?? "6");
const CONCURRENCY = 4;
const UA = "Mozilla/5.0 (compatible; GotridPerfumeStockCheck/1.0)";

interface Candidate {
  tamdaId: string;
  name: string;
  ean: string | null;
  breadcrumb: string;
  url: string;
}

// Tamda's default storefront is Vietnamese, so the breadcrumb labels are too.
const GRAVE = "Nến mộ";
function resolveCategory(c: Candidate): string | null {
  const parts = c.breadcrumb.split(" / ");
  const l3 = parts[2] ?? "";
  const l4 = parts[3] ?? "";
  const name = c.name.toLowerCase();
  const key = l4 && l4 !== c.name ? l4 : l3;
  if (parts.includes(GRAVE)) return null;
  switch (key) {
    case "Dầu gội": return "kosmetika/vlasy/sampony";
    case "Dầu xả": return "kosmetika/vlasy/kondicionery-a-balzamy";
    case "Gel vuốt tóc": return "kosmetika/vlasy/styling";
    case "Thuốc nhuộm tóc": return "kosmetika/vlasy/barvy-na-vlasy";
    case "Mặt nạ & Dầu dưỡng tóc":
      return /serum|sérum/.test(name) ? "kosmetika/vlasy/vlasova-sera" : /toner/.test(name) ? "kosmetika/vlasy/vlasova-tonika" : "kosmetika/vlasy/vlasove-masky";
    case "Gel tắm": return "kosmetika/sprchove-gely";
    case "Deo khử mùi":
    case "Lăn khử mùi": return "kosmetika/telo/deodoranty";
    case "Dao cạo râu":
    case "Gel cạo râu":
    case "Nước hoa sau khi cạo râu":
    case "Thuốc tẩy lông": return "kosmetika/telo/depilace";
    case "Băng vệ sinh phụ nữ":
    case "Dung dịch phụ nữ": return "kosmetika/telo/intimni-hygiena";
    case "Nước tẩy rửa": return "kosmetika/plet/cisteni-pleti";
    case "Chăm sóc môi": return "kosmetika/plet/pece-o-rty";
    case "Chăm sóc tay": return "kosmetika/telo/krem-na-ruce";
    case "Kem dưỡng da": return /t[ěe]lov|body|ruce|ruk/.test(name) ? "kosmetika/telo/telova-mleka" : "kosmetika/plet/pletove-kremy";
    case "Chăm sóc da mặt": return /sun|opalov|spf/.test(name) ? "kosmetika/telo/opalovaci-kosmetika" : "kosmetika/plet/pletove-kremy";
    case "Chăm sóc có vấn đề về da": return "kosmetika/plet/cisteni-pleti";
    case "Ngâm tắm": return "kosmetika/telo/sprcha-a-koupel";
    case "Xà phòng": return "kosmetika/telo/mydla";
    case "Bàn chải đánh răng": return "zuby/zubni-kartacky";
    case "Kem đánh răng": return "zuby/zubni-pasty";
    case "Nước súc miệng": return "zuby/ustni-vody";
    case "Gel mát-xa": return "pece-o-zdravi/masazni-gely";
    case "Nến thơm":
    case "Đồ trang trí":
    case "Nến": return "vonne-svicky";
    case "Dùng cho WC": return "domacnost/osvezovace-vzduchu/pro-wc";
    case "Bình xịt": return "domacnost/osvezovace-vzduchu/sprej";
    case "Cho phòng": return /n[áa]pl|n[áa]plň/.test(name) ? "domacnost/osvezovace-vzduchu/naplne" : "domacnost/osvezovace-vzduchu/pro-pokoje";
    case "Mùi hương tủ quần áo": return "domacnost/osvezovace-vzduchu/vune-do-skrine";
    case "Nước hoa": {
      const gender = /p[áa]nsk|\bmen\b|\bm\b|\bman\b|homme/.test(name) ? "panske-parfemy" : /d[áa]msk|woman|women|\bw\b|femme/.test(name) ? "damske-parfemy" : "unisex-parfemy";
      const kind = /\bedt\b|toalet/.test(name) ? "toaletni-vody" : "parfemovane-vody";
      return `parfemy/${gender}/${kind}`;
    }
    default: break;
  }
  if (parts[2] === "Chăm sóc móng tay") return "kosmetika/dekorativni-kosmetika/nehty";
  // Items that sit directly under the "skin care" bucket (no sub-bucket): decide by the name.
  if (parts[2] === "Chăm sóc da" || key === "Chăm sóc da") {
    if (/sun|opalov|spf/.test(name)) return "kosmetika/telo/opalovaci-kosmetika";
    if (/peeling|scrub/.test(name)) return "kosmetika/telo/peelingy-a-masaze";
    if (/balz[áa]m na rty|\blip\b/.test(name)) return "kosmetika/plet/pece-o-rty";
    if (/\bruce\b|\bruk\b|hand/.test(name)) return "kosmetika/telo/krem-na-ruce";
    if (/t[ěe]lov|body/.test(name)) return "kosmetika/telo/telova-mleka";
    if (/sprchov|shower/.test(name)) return "kosmetika/sprchove-gely";
    if (/m[ýy]dl|mydl|soap/.test(name)) return "kosmetika/telo/mydla";
    if (/odli[čc]ov|micel|[čc]ist[íi]c|cleans|plet[ěe]n/.test(name)) return "kosmetika/plet/cisteni-pleti";
    if (/\bmast\b|bylinn/.test(name)) return "pece-o-zdravi/ostatni";
    if (/kr[ée]m|cream|ple[ťt]|s[ée]rum|maska/.test(name)) return "kosmetika/plet/pletove-kremy";
  }
  return nameFallback(name);
}

// Last resort for items Tamda files in odd buckets (cotton buds sit under "condoms & massage gels", foot deodorants
// under "skin care", …): decide by the name; anything that is not drugstore/cosmetics stays unmapped (skipped).
function nameFallback(name: string): string | null {
  if (/zapalova|destilovan|[žz]ehli[čc]|erdal|hasic|herkules|purfix|n[áa]kupn[íi] ta[šs]ka|rozmrazov|ost[řr]ikov|letn[íi] kapalina|zimn[íi] kapalina|pohlcova[čc] vlhkosti|stop vlhkosti|h[řr]bitovn/.test(name)) return null;
  if (/vatov[ée] ty[čc]|bavln[ěe]n[áa] vata|\bvata\b/.test(name)) return "kosmetika/telo/doplnky";
  if (/tampon/.test(name)) return "kosmetika/telo/intimni-hygiena";
  if (/durex/.test(name)) return "pece-o-zdravi/kondomy";
  if (/odlakova[čc]/.test(name)) return "kosmetika/dekorativni-kosmetika/nehty";
  if (/inhal[áa]tor|boronasal/.test(name)) return "pece-o-zdravi/ostatni";
  if (/deodorant|\bdeo\b|\bap\b|antiperspir|na nohy|do bot|z[áa]syp na nohy/.test(name)) return "kosmetika/telo/deodoranty";
  if (/mighty patch|remover|make-up/.test(name)) return "kosmetika/plet/cisteni-pleti";
  if (/discovery set/.test(name)) return "kosmetika/telo/darkove-sady";
  if (/kondicion[ée]r/.test(name)) return "kosmetika/vlasy/kondicionery-a-balzamy";
  if (/tonik|vlasov[áa] voda/.test(name)) return "kosmetika/vlasy/vlasova-tonika";
  if (/vlasov[áa] k[úu]ra/.test(name)) return "kosmetika/vlasy/vlasove-masky";
  if (/s[ée]rum/.test(name)) return "kosmetika/vlasy/vlasova-sera";
  if (/pantene sprej/.test(name)) return "kosmetika/vlasy/kondicionery-a-balzamy";
  if (/corega|dentek|p[áa]r[áa]tk|jazyk|rebi dental/.test(name)) return "zuby/doplnky-k-cisteni-zubu";
  if (/ni[ťt]/.test(name)) return "zuby/zubni-nite";
  if (/hol[íi]c[íi]|hol[íi]tk|b[řr]it/.test(name)) return "kosmetika/telo/depilace";
  if (/v[ůu]n[ěe] do auta|pap[íi]rov[ýy] osv[ěe][žz]ova[čc]|extra scent/.test(name)) return "vune-do-auta";
  if (/n[áa]hradn[íi] n[áa]pl/.test(name)) return "domacnost/osvezovace-vzduchu/naplne";
  if (/air wick komplet|vonn[ée] krystaly|arola/.test(name)) return "domacnost/osvezovace-vzduchu/pro-pokoje";
  if (/diffuser|difuz[ée]r/.test(name)) return "aroma-difuzery";
  if (/vonn[ée] ty[čc]inky/.test(name)) return "vonne-svicky";
  if (/osv[ěe][žz]ova[čc] vzduchu/.test(name)) return "domacnost/osvezovace-vzduchu/sprej";
  return null;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

async function pageImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const html = await res.text();
    return /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function resolveBrandId(cache: Map<string, string>, existing: { name: string }[], name: string): Promise<string | null> {
  const lower = name.toLowerCase();
  let brandName: string | null = null;
  for (const b of existing) {
    const bl = b.name.toLowerCase();
    if (lower === bl || lower.startsWith(bl + " ")) {
      if (!brandName || b.name.length > brandName.length) brandName = b.name;
    }
  }
  if (!brandName) {
    const first = name.split(/\s+/)[0];
    if (/^[A-Za-zÀ-ž][A-Za-zÀ-ž'.-]{2,}$/.test(first)) brandName = first;
  }
  if (!brandName) return null;
  const slug = slugify(brandName);
  if (cache.has(slug)) return cache.get(slug)!;
  const byName = await prisma.brand.findFirst({ where: { name: { equals: brandName, mode: "insensitive" } } });
  if (byName) { cache.set(slug, byName.id); return byName.id; }
  const brand = await prisma.brand.upsert({ where: { slug }, update: {}, create: { name: brandName, slug } });
  cache.set(slug, brand.id);
  return brand.id;
}

async function main() {
  if (REVEAL) {
    const codes = JSON.parse(readFileSync(REVEAL, "utf-8")) as string[];
    const r = await prisma.product.updateMany({ where: { code: { in: codes }, images: { some: {} } }, data: { visible: true } });
    console.log(`Revealed ${r.count} of ${codes.length} products`);
    return;
  }

  const candidates = JSON.parse(readFileSync(CANDIDATES, "utf-8")) as Candidate[];
  const check = JSON.parse(readFileSync(CHECK, "utf-8")) as Record<string, string>;
  const norm = (e: string) => e.replace(/\D/g, "").replace(/^0+/, "");
  const checkByEan = new Map(Object.entries(check).map(([e, v]) => [norm(e), v]));

  const stats = { total: candidates.length, noEan: 0, notFound: 0, minPack: 0, lowStock: 0, noPrice: 0, noCategory: 0, exists: 0 };
  const existingEans = new Set((await prisma.product.findMany({ where: { ean: { not: null } }, select: { ean: true } })).map((p) => norm(p.ean!)));
  const existingCodes = new Set((await prisma.product.findMany({ where: { code: { startsWith: "TDE-" } }, select: { code: true } })).map((p) => p.code));

  const unmapped: string[] = [];
  const ready: { c: Candidate; cat: string; price: number; stock: number }[] = [];
  const byCat: Record<string, number> = {};
  for (const c of candidates) {
    if (!c.ean) { stats.noEan++; continue; }
    const v = checkByEan.get(norm(c.ean));
    if (!v || v === "N") { stats.notFound++; continue; }
    const [min, max, price] = v.split("|").map(Number);
    if (min > MAX_MIN_ORDER) { stats.minPack++; continue; }
    if (max < Math.max(1, min)) { stats.lowStock++; continue; }
    if (!(price > 0)) { stats.noPrice++; continue; }
    if (existingCodes.has(`TDE-${c.tamdaId}`) || existingEans.has(norm(c.ean))) { stats.exists++; continue; }
    const cat = resolveCategory(c);
    if (!cat) { stats.noCategory++; unmapped.push(`${c.breadcrumb.split(" / ").slice(2, 4).join(" > ").slice(0, 24)} | ${c.name.slice(0, 55)} | min ${min}`); continue; }
    ready.push({ c, cat, price, stock: max });
    byCat[cat] = (byCat[cat] ?? 0) + 1;
  }
  console.log("Candidates:", JSON.stringify(stats));
  if (process.argv.includes("--list-unmapped")) console.log(unmapped.join("\n"));
  console.log(`Ready to create: ${ready.length}`);
  console.log(Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${v} ${k}`).join("\n"));
  if (DRY_RUN) return;

  const toCreate = LIMIT > 0 ? ready.slice(0, LIMIT) : ready;
  const catRows = await prisma.category.findMany({ select: { id: true, fullSlug: true } });
  const catId = new Map(catRows.map((c) => [c.fullSlug, c.id]));
  const brands = await prisma.brand.findMany({ select: { name: true } });
  const brandCache = new Map<string, string>();
  const createdCodes: string[] = [];
  let done = 0, failed = 0, noImage = 0;
  const queue = [...toCreate];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      const { c, cat, price, stock } = it;
      try {
        const name = decodeEntities(c.name);
        const code = `TDE-${c.tamdaId}`;
        const img = await pageImage(c.url);
        const { urls } = img ? await downloadProductImages(code, img) : { urls: [] as string[] };
        if (urls.length === 0) noImage++;
        const brandId = await resolveBrandId(brandCache, brands, name);
        const product = await prisma.product.create({
          data: {
            name,
            code,
            slug: `${slugify(name)}-tde-${c.tamdaId}`,
            ean: c.ean,
            brandId: brandId ?? undefined,
            price: Math.round(price * 1.3),
            purchasePrice: Math.round((price / 1.21) * 100) / 100,
            vatRate: 21,
            stock,
            visible: VISIBLE && urls.length > 0,
          },
        });
        const cid = catId.get(cat);
        if (cid) await prisma.productCategory.create({ data: { productId: product.id, categoryId: cid } });
        if (urls.length > 0) await prisma.productImage.create({ data: { productId: product.id, url: urls[0], sortOrder: 0 } });
        createdCodes.push(code);
      } catch (err) {
        failed++;
        console.error(`  [error] ${c.tamdaId} ${c.name}:`, err instanceof Error ? err.message : err);
      }
      if (++done % 50 === 0) console.log(`  progress ${done}/${toCreate.length} (created ${createdCodes.length}, failed ${failed}, no image ${noImage})`);
    }
  }));
  if (CREATED_OUT) writeFileSync(CREATED_OUT, JSON.stringify(createdCodes));
  console.log(`\nDone. Created ${createdCodes.length}, failed ${failed}, without image ${noImage}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
