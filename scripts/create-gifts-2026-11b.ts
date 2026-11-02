// One-off (2026-11-02): the second batch of the owner's gifts — two more sample gifts (GIFT-, account-only,
// see sample-gifts.ts) and two reward-only items bought with loyalty points (REWARD-, hidden, giftEligible).
// Re-running updates texts/images/rewards and leaves stock alone.
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

interface Item {
  code: string; slug: string; brand: string | null; qty: number; img: string; price: number;
  name: string; nameSk: string; desc: string; descSk: string;
  reward?: { name: string; nameSk: string; points: number; sortOrder: number };
}

const ITEMS: Item[] = [
  { code: "GIFT-GARNIER-HYDRA-BOMB", slug: "darek-garnier-hydra-bomb-sheet-mask", brand: "Garnier", qty: 1, img: "garnier-mask", price: 0,
    name: "Garnier Hydra Bomb Sheet Mask – textilní maska", nameSk: "Garnier Hydra Bomb Sheet Mask – textilná maska",
    desc: "<p>Hydratační textilní pleťová maska Garnier Skin Naturals Hydra Bomb s granátovým jablkem a kyselinou hyaluronovou (28 g), pro dehydratovanou pleť. Maska se nechává působit 15 minut. Dárek není určen k prodeji.</p>",
    descSk: "<p>Hydratačná textilná pleťová maska Garnier Skin Naturals Hydra Bomb s granátovým jablkom a kyselinou hyalurónovou (28 g), pre dehydratovanú pleť. Maska sa nechává pôsobiť 15 minút. Darček nie je určený na predaj.</p>" },
  { code: "GIFT-CURAPROX-CPS115", slug: "darek-curaprox-cps-115-handy", brand: null, qty: 1, img: "curaprox-interdental", price: 0,
    name: "Curaprox CPS 115 handy – 4 mezizubní kartáčky", nameSk: "Curaprox CPS 115 handy – 4 medzizubné kefky",
    desc: "<p>Balení čtyř mezizubních kartáčků Curaprox CPS 115 handy (střední velikost) s výměnnými držáky od švýcarské značky Curaprox. Dárek není určen k prodeji.</p>",
    descSk: "<p>Balenie štyroch medzizubných kefiek Curaprox CPS 115 handy (stredná veľkosť) s výmennými držiakmi od švajčiarskej značky Curaprox. Darček nie je určený na predaj.</p>" },
  { code: "REWARD-CURAPROX-5460", slug: "odmena-curaprox-ultra-soft-5460", brand: null, qty: 1, img: "curaprox-brush", price: 125,
    name: "Curaprox Ultra Soft 5460 – zubní kartáček", nameSk: "Curaprox Ultra Soft 5460 – zubná kefka",
    desc: "<p>Zubní kartáček Curaprox CS 5460 Ultra Soft od švýcarské značky Curaprox, s velmi jemnými a hustými štětinami. Odměna za věrnostní body, není určena k prodeji.</p>",
    descSk: "<p>Zubná kefka Curaprox CS 5460 Ultra Soft od švajčiarskej značky Curaprox, s veľmi jemnými a hustými štetinami. Odmena za vernostné body, nie je určená na predaj.</p>",
    reward: { name: "Zubní kartáček Curaprox Ultra Soft", nameSk: "Zubná kefka Curaprox Ultra Soft", points: 500, sortOrder: 10 } },
  { code: "REWARD-ZYMBION-Q10", slug: "odmena-bioaktivni-q10-zubni-pasta-zymbion", brand: null, qty: 1, img: "zymbion", price: 359,
    name: "Bioaktivní Q10 zubní pasta Zymbion 75 ml", nameSk: "Bioaktívna Q10 zubná pasta Zymbion 75 ml",
    desc: "<p>Zubní pasta Zymbion s bioaktivním koenzymem Q10 (75 ml), obohacená fluorem, nepěnivá, se svěží příchutí máty. Odměna za věrnostní body, není určena k prodeji.</p>",
    descSk: "<p>Zubná pasta Zymbion s bioaktívnym koenzýmom Q10 (75 ml), obohatená fluórom, nepeniaca, so sviežou príchuťou mäty. Odmena za vernostné body, nie je určená na predaj.</p>",
    reward: { name: "Zubní pasta Bioaktivní Q10 Zymbion", nameSk: "Zubná pasta Bioaktívne Q10 Zymbion", points: 500, sortOrder: 11 } },
];

(async () => {
  for (const g of ITEMS) {
    const brand = g.brand ? await p.brand.findFirst({ where: { name: { equals: g.brand, mode: "insensitive" } }, select: { id: true } }) : null;
    const data = {
      name: g.name, nameSk: g.nameSk, slug: g.slug, brandId: brand?.id ?? null, price: g.price, purchasePrice: 0, vatRate: 21,
      visible: false, giftEligible: true, description: g.desc, descriptionSk: g.descSk,
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

    if (g.reward) {
      const found = await p.loyaltyReward.findFirst({ where: { giftProductId: product.id } });
      const rdata = { name: g.reward.name, nameSk: g.reward.nameSk, pointsCost: g.reward.points, type: "GIFT" as const, giftProductId: product.id, validDays: 60, sortOrder: g.reward.sortOrder, active: true };
      if (found) await p.loyaltyReward.update({ where: { id: found.id }, data: rdata });
      else await p.loyaltyReward.create({ data: rdata });
    }
    console.log(existing ? "updated" : "created", g.code, g.reward ? `reward ${g.reward.points} pts` : "");
  }
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
