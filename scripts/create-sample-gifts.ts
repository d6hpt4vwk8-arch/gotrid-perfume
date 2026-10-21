import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

type Gift = { code: string; slug: string; brand: string; name: string; nameSk: string; stock: number; desc: string; descSk: string; image?: { copyFrom?: string; convertFrom?: string } };

const GIFTS: Gift[] = [
  {
    code: "GIFT-NAMA-FIJI", slug: "darek-nama-fiji-sada-6-vzorku", brand: "Nama Fiji", stock: 20,
    name: "Nama Fiji – sada 6 vzorků pleťové péče",
    nameSk: "Nama Fiji – sada 6 vzoriek pleťovej starostlivosti",
    image: { convertFrom: "ops/gift-images/nama-fiji.jpg" },
    desc: "<p>Dárková sada šesti vzorků pleťové péče Nama Fiji s mořskými hrozny z fidžijských ostrovů Yasawa: peeling, čisticí mléko, čisticí gel, pleťová maska, gelové sérum a pleťový krém. Součástí je karta s doporučeným postupem péče. Vzorek není určen k dalšímu prodeji.</p>",
    descSk: "<p>Darčeková sada šiestich vzoriek pleťovej starostlivosti Nama Fiji s morskými hroznami z fidžijských ostrovov Yasawa: peeling, čistiace mlieko, čistiaci gél, pleťová maska, gélové sérum a pleťový krém. Súčasťou je karta s odporúčaným postupom starostlivosti. Vzorka nie je určená na ďalší predaj.</p>",
  },
  {
    code: "GIFT-SKIN1004-PROBIO-AMPOULE", slug: "darek-skin1004-probio-cica-intensive-ampoule", brand: "SKIN1004", stock: 1,
    name: "SKIN1004 Probio-Cica Intensive Ampoule – vzorek",
    nameSk: "SKIN1004 Probio-Cica Intensive Ampoule – vzorka",
    desc: "<p>Vzorek intenzivního pleťového séra s centellou asijskou a probiotiky od korejské značky SKIN1004. Vzorek není určen k prodeji.</p>",
    descSk: "<p>Vzorka intenzívneho pleťového séra s centellou ázijskou a probiotikami od kórejskej značky SKIN1004. Vzorka nie je určená na predaj.</p>",
    image: { copyFrom: "SPV-0228817" },
  },
  {
    code: "GIFT-SKIN1004-PROBIO-CREAM", slug: "darek-skin1004-probio-cica-enrich-cream", brand: "SKIN1004", stock: 1,
    name: "SKIN1004 Probio-Cica Enrich Cream – vzorek",
    nameSk: "SKIN1004 Probio-Cica Enrich Cream – vzorka",
    desc: "<p>Vzorek výživného pleťového krému s centellou asijskou a probiotiky od korejské značky SKIN1004. Vzorek není určen k prodeji.</p>",
    descSk: "<p>Vzorka výživného pleťového krému s centellou ázijskou a probiotikami od kórejskej značky SKIN1004. Vzorka nie je určená na predaj.</p>",
    image: { copyFrom: "SPV-0228819" },
  },
  {
    code: "GIFT-SKIN1004-SUN-SERUM", slug: "darek-skin1004-hyalu-cica-water-fit-sun-serum", brand: "SKIN1004", stock: 1,
    name: "SKIN1004 Hyalu-Cica Water-Fit Sun Serum SPF50+ – vzorek",
    nameSk: "SKIN1004 Hyalu-Cica Water-Fit Sun Serum SPF50+ – vzorka",
    desc: "<p>Vzorek lehkého opalovacího séra SPF 50+ PA++++ s centellou asijskou a kyselinou hyaluronovou od korejské značky SKIN1004. Vzorek není určen k prodeji.</p>",
    descSk: "<p>Vzorka ľahkého opaľovacieho séra SPF 50+ PA++++ s centellou ázijskou a kyselinou hyalurónovou od kórejskej značky SKIN1004. Vzorka nie je určená na predaj.</p>",
    image: { convertFrom: "/tmp/gift_dl/sun.png" },
  },
  {
    code: "GIFT-SKIN1004-CENTELLA-AMPOULE", slug: "darek-skin1004-centella-ampoule", brand: "SKIN1004", stock: 1,
    name: "SKIN1004 Centella Ampoule – vzorek",
    nameSk: "SKIN1004 Centella Ampoule – vzorka",
    desc: "<p>Vzorek kultovního zklidňujícího pleťového séra s čistou centellou asijskou od korejské značky SKIN1004. Vzorek není určen k prodeji.</p>",
    descSk: "<p>Vzorka kultového upokojujúceho pleťového séra s čistou centellou ázijskou od kórejskej značky SKIN1004. Vzorka nie je určená na predaj.</p>",
    image: { copyFrom: "SPV-0229121" },
  },
];

(async () => {
  for (const g of GIFTS) {
    const brand = await p.brand.findFirstOrThrow({ where: { name: g.brand }, select: { id: true } });
    const existing = await p.product.findFirst({ where: { code: g.code }, select: { id: true } });
    const data = {
      name: g.name, nameSk: g.nameSk, slug: g.slug, brandId: brand.id, price: 0, purchasePrice: 0, vatRate: 21,
      stock: g.stock, ownStock: g.stock, visible: false, giftEligible: true, description: g.desc, descriptionSk: g.descSk,
    };
    const product = existing
      ? await p.product.update({ where: { id: existing.id }, data: { ...data, stock: undefined, ownStock: undefined } })
      : await p.product.create({ data: { ...data, code: g.code } });
    if (g.image) {
      const dir = path.join("public", "uploads", "products", encodeURIComponent(g.code));
      mkdirSync(dir, { recursive: true });
      let file = "";
      if (g.image.copyFrom) {
        const src = await p.productImage.findFirstOrThrow({ where: { product: { code: g.image.copyFrom } }, orderBy: { sortOrder: "asc" } });
        const srcPath = path.join("public", src.url);
        file = `sample-0${path.extname(srcPath)}`;
        copyFileSync(srcPath, path.join(dir, file));
      } else if (g.image.convertFrom) {
        file = "sample-0.jpg";
        await sharp(g.image.convertFrom).resize({ width: 1200, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toFile(path.join(dir, file));
      }
      const url = `/uploads/products/${encodeURIComponent(g.code)}/${file}`;
      await p.productImage.deleteMany({ where: { productId: product.id } });
      await p.productImage.create({ data: { productId: product.id, url, sortOrder: 0 } });
    }
    console.log(existing ? "updated" : "created", g.code, product.id);
  }
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
