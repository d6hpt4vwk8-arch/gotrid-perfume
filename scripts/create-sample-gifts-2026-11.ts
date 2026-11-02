// One-off (2026-11-02): hidden GIFT- products for the owner's box of sample sachets / vials, see
// src/lib/sample-gifts.ts for which carts each is offered to. Quantities = units counted from the photos.
// Re-running updates texts/images and leaves stock alone. Images come from ops/gift-images/2026-11/.
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

interface Gift {
  code: string;
  slug: string;
  brand: string[]; // candidate brand names; none found -> no brand
  qty: number;
  img: string;
  name: string; // Czech; the Slovak name differs only by "vzorek" -> "vzorka", see skName()
  what: [string, string]; // [cs, sk] what the sample is, as an accusative phrase after "Vzorek"/"Vzorka"
  from: [string, string]; // [cs, sk] "od ..." phrase
  size: string;
  extra?: [string, string];
}

const GIFTS: Gift[] = [
  { code: "GIFT-PALACIO-TIGER-GEL", slug: "darek-palacio-cannabis-tiger-gel", brand: ["Palacio"], qty: 1, img: "tiger-gel", name: "Palacio Cannabis Tiger Gel – vzorek 4 ml",
    what: ["masážního gelu s konopím, inspirovaného tradiční asijskou medicínou", "masážneho gélu s konopou, inšpirovaného tradičnou ázijskou medicínou"], from: ["od značky Palacio", "od značky Palacio"], size: "4 ml",
    extra: ["Určen k masáži kůže v oblasti svalů a kloubů.", "Určený na masáž kože v oblasti svalov a kĺbov."] },
  { code: "GIFT-PALACIO-SNAKE-SERUM", slug: "darek-palacio-facial-snake-anti-age-serum", brand: ["Palacio"], qty: 1, img: "snake-serum", name: "Palacio Facial Snake Anti-Age Serum – vzorek 4 ml",
    what: ["pleťového hadího séra proti stárnutí s peptidem SYN®-AKE", "pleťového hadieho séra proti starnutiu s peptidom SYN®-AKE"], from: ["od značky Palacio", "od značky Palacio"], size: "4 ml",
    extra: ["Používá se ráno a/nebo večer na vyčištěnou pleť.", "Používa sa ráno a/alebo večer na vyčistenú pleť."] },
  { code: "GIFT-CANNABELLUM-CANNADREAM", slug: "darek-cannabellum-cannadream-cbd-night-cream", brand: ["Cannabellum"], qty: 1, img: "cannadream", name: "Cannabellum CannaDream CBD Advanced Night Cream – vzorek 4 ml",
    what: ["nočního pleťového krému s CBD", "nočného pleťového krému s CBD"], from: ["od značky Cannabellum", "od značky Cannabellum"], size: "4 ml",
    extra: ["Nanáší se na očištěnou pleť kruhovými pohyby každý večer.", "Nanáša sa na očistenú pleť kruhovými pohybmi každý večer."] },
  { code: "GIFT-PALACIO-CANNAPROTECT", slug: "darek-palacio-cannaprotect-face-cream-spf50", brand: ["Palacio"], qty: 1, img: "cannaprotect", name: "Palacio CannaProtect Face Cream SPF 50 – vzorek 4 ml",
    what: ["celoročního pleťového krému s vysokou ochranou SPF 50 (UVA a UVB), konopným olejem a panthenolem", "celoročného pleťového krému s vysokou ochranou SPF 50 (UVA a UVB), konopným olejom a panthenolom"], from: ["od značky Palacio", "od značky Palacio"], size: "4 ml" },
  { code: "GIFT-MIZON-COLLAGEN", slug: "darek-mizon-collagen-power-lifting-cream", brand: ["Mizon"], qty: 1, img: "mizon-collagen", name: "Mizon Collagen Power Lifting Cream – vzorek 2 ml",
    what: ["výživného pleťového krému s mořským kolagenem, peptidy a kyselinou hyaluronovou", "výživného pleťového krému s morským kolagénom, peptidmi a kyselinou hyalurónovou"], from: ["od korejské značky Mizon", "od kórejskej značky Mizon"], size: "2 ml" },
  { code: "GIFT-MIZON-HYALUGEN", slug: "darek-mizon-hyalugen-le-lift-cream", brand: ["Mizon"], qty: 1, img: "mizon-hyalugen", name: "Mizon Hyalugen Le Lift Cream – vzorek 2 ml",
    what: ["intenzivního gelového krému s Hyalugenem pro zralou pleť", "intenzívneho gélového krému s Hyalugenom pre zrelú pleť"], from: ["od korejské značky Mizon", "od kórejskej značky Mizon"], size: "2 ml" },
  { code: "GIFT-VVBETTER-TECA", slug: "darek-vvbetter-teca-lifting-moisture-cream", brand: ["VVBETTER"], qty: 1, img: "vvbetter-teca", name: "vvbetter Teca Lifting Moisture Cream – vzorek 2 ml",
    what: ["hydratačního krému s peptidovým komplexem, niacinamidem a extrakty z centelly", "hydratačného krému s peptidovým komplexom, niacínamidom a extraktmi z centelly"], from: ["od korejské značky vvbetter", "od kórejskej značky vvbetter"], size: "2 ml" },
  { code: "GIFT-DRALTHEA-AQUA", slug: "darek-dr-althea-aqua-marine-watery-cream", brand: ["Dr. Althea"], qty: 3, img: "dralthea-aqua", name: "Dr. Althea Aqua Marine Watery Cream – vzorek 2 ml",
    what: ["lehkého hydratačního krému pro všechny typy pleti se 70 % bambusové vody a mořskými extrakty", "ľahkého hydratačného krému pre všetky typy pleti so 70 % bambusovej vody a morskými extraktmi"], from: ["od korejské značky Dr. Althea", "od kórejskej značky Dr. Althea"], size: "2 ml" },
  { code: "GIFT-ICONIQUE-MASK", slug: "darek-iconique-deep-hydration-mask", brand: ["Iconique"], qty: 1, img: "iconique-mask", name: "Iconique Deep Hydration Mask – vzorek 10 ml",
    what: ["hydratační vlasové masky s olejem babassu a komplexem aminokyselin", "hydratačnej vlasovej masky s olejom babassu a komplexom aminokyselín"], from: ["od značky Iconique Professional", "od značky Iconique Professional"], size: "10 ml" },
  { code: "GIFT-ICONIQUE-SHAMPOO", slug: "darek-iconique-deep-hydration-shampoo", brand: ["Iconique"], qty: 1, img: "iconique-shampoo", name: "Iconique Deep Hydration Shampoo – vzorek 10 ml",
    what: ["hydratačního šamponu s kyselinou hyaluronovou a komplexem aminokyselin", "hydratačného šampónu s kyselinou hyalurónovou a komplexom aminokyselín"], from: ["od značky Iconique Professional", "od značky Iconique Professional"], size: "10 ml" },
  { code: "GIFT-VILLAGE11-AHA-LOTION", slug: "darek-village-11-factory-relax-day-aha-body-lotion", brand: ["Village 11 Factory"], qty: 1, img: "village11-aha", name: "Village 11 Factory Relax-day AHA 12% Exfoliating Body Lotion – vzorek 5 g",
    what: ["exfoliačního tělového mléka s 12 % kyseliny glykolové, kyselinou hyaluronovou a ceramidy", "exfoliačného telového mlieka s 12 % kyseliny glykolovej, kyselinou hyalurónovou a ceramidmi"], from: ["od korejské značky Village 11 Factory", "od kórejskej značky Village 11 Factory"], size: "5 g",
    extra: ["Před prvním použitím doporučujeme test na předloktí.", "Pred prvým použitím odporúčame test na predlaktí."] },
  { code: "GIFT-SCENT-OF-STARS-LYRA", slug: "darek-scent-of-stars-lyra-blossom-52", brand: ["Scent of Stars"], qty: 1, img: "scent-lyra", name: "Scent of Stars Lyra Blossom N°52 – parfémovaná voda, vzorek 2 ml",
    what: ["parfémované vody Lyra Blossom N°52", "parfumovanej vody Lyra Blossom N°52"], from: ["od značky Scent of Stars", "od značky Scent of Stars"], size: "2 ml" },
  { code: "GIFT-RABANNE-1M-PARFUM", slug: "darek-rabanne-1-million-parfum", brand: ["Paco Rabanne", "Rabanne"], qty: 1, img: "rabanne-parfum", name: "Rabanne 1 Million Parfum – vzorek 1,5 ml",
    what: ["parfému 1 Million Parfum", "parfumu 1 Million Parfum"], from: ["od značky Rabanne", "od značky Rabanne"], size: "1,5 ml" },
  { code: "GIFT-RABANNE-1M-EDT", slug: "darek-rabanne-1-million-edt", brand: ["Paco Rabanne", "Rabanne"], qty: 1, img: "rabanne-edt", name: "Rabanne 1 Million Eau de Toilette – vzorek 1,5 ml",
    what: ["toaletní vody 1 Million", "toaletnej vody 1 Million"], from: ["od značky Rabanne", "od značky Rabanne"], size: "1,5 ml" },
  { code: "GIFT-SKIN1004-CENTELLA-OIL", slug: "darek-skin1004-madagascar-centella-light-cleansing-oil", brand: ["SKIN1004"], qty: 2, img: "skin1004-oil", name: "SKIN1004 Madagascar Centella Light Cleansing Oil – vzorek 2 ml",
    what: ["lehkého čisticího oleje s čistou centellou asijskou z Madagaskaru", "ľahkého čistiaceho oleja s čistou centelou ázijskou z Madagaskaru"], from: ["od korejské značky SKIN1004", "od kórejskej značky SKIN1004"], size: "2 ml" },
  { code: "GIFT-VVBETTER-SUN", slug: "darek-vvbetter-daily-airfit-sunscreen", brand: ["VVBETTER"], qty: 1, img: "vvbetter-sun", name: "vvbetter Daily Airfit Sunscreen SPF 50+ PA++++ – vzorek 1 ml",
    what: ["lehkého opalovacího krému SPF 50+ PA++++ se skvalanem, panthenolem a madekasosidem", "ľahkého opaľovacieho krému SPF 50+ PA++++ so skvalánom, panthenolom a madekasosidom"], from: ["od korejské značky vvbetter", "od kórejskej značky vvbetter"], size: "1 ml" },
  { code: "GIFT-VVBETTER-EYE", slug: "darek-vvbetter-firming-eye-cream", brand: ["VVBETTER"], qty: 1, img: "vvbetter-eye", name: "vvbetter Firming Eye Cream – vzorek 1 ml",
    what: ["zpevňujícího očního krému s vitaminem C, bakuchiolem a skvalanem", "spevňujúceho očného krému s vitamínom C, bakuchiolom a skvalánom"], from: ["od korejské značky vvbetter", "od kórejskej značky vvbetter"], size: "1 ml" },
];

const skName = (n: string) => n.replace("vzorek", "vzorka").replace("parfémovaná voda", "parfumovaná voda");

(async () => {
  for (const g of GIFTS) {
    let brandId: string | null = null;
    for (const b of g.brand) {
      const found = await p.brand.findFirst({ where: { name: { equals: b, mode: "insensitive" } }, select: { id: true } });
      if (found) { brandId = found.id; break; }
    }
    const desc = `<p>Vzorek ${g.what[0]} ${g.from[0]} (${g.size}). ${g.extra ? g.extra[0] + " " : ""}Vzorek není určen k prodeji.</p>`;
    const descSk = `<p>Vzorka ${g.what[1]} ${g.from[1]} (${g.size}). ${g.extra ? g.extra[1] + " " : ""}Vzorka nie je určená na predaj.</p>`;
    const data = {
      name: g.name, nameSk: skName(g.name), slug: g.slug, brandId, price: 0, purchasePrice: 0, vatRate: 21,
      visible: false, giftEligible: true, description: desc, descriptionSk: descSk,
    };
    const existing = await p.product.findFirst({ where: { code: g.code }, select: { id: true } });
    const product = existing
      ? await p.product.update({ where: { id: existing.id }, data })
      : await p.product.create({ data: { ...data, code: g.code, stock: g.qty, ownStock: g.qty } });

    const dir = path.join("public", "uploads", "products", encodeURIComponent(g.code));
    mkdirSync(dir, { recursive: true });
    copyFileSync(path.join("ops", "gift-images", "2026-11", `${g.img}.jpg`), path.join(dir, "sample-0.jpg"));
    await p.productImage.deleteMany({ where: { productId: product.id } });
    await p.productImage.create({ data: { productId: product.id, url: `/uploads/products/${encodeURIComponent(g.code)}/sample-0.jpg`, sortOrder: 0 } });
    console.log(existing ? "updated" : "created", g.code, `qty ${g.qty}`, brandId ? "" : "(no brand)");
  }
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
