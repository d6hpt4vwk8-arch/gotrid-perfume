// GVS Cosmetics sync from the 2026-10-22 price list (ops/gvs-new-2026-10-22.json, extracted from
// "Pricelist GVS Cosmetics cz .xlsx"). Four parts:
//   1. regular cost/price: purchasePrice = highest in-stock row per EAN (short-dated cheap batches are ignored);
//      sell price follows our 1.21 × 1.2 rule, but only where the current price already followed that rule
//   2. availability: in stock = 10, out of stock = 0 (price list has no numbers) — only touches products that differ
//   3. damaged-packaging (-DEFECT) listings: stock = quantity from the "Defective Items" tab, cost from the tab,
//      new -DEFECT listings are cloned from the regular product (same photos, category "vyprodej")
//   4. the 7 "new" Dr.Althea EANs turned out to exist already as SP Venture listings (SPV is cheaper) — they are NOT
//      duplicated; instead their thin/inaccurate SPV copy is replaced by the texts below (+ better main photo for two with
//      --images, run right before pushing the files)
//
// Usage: npx tsx --env-file=.env scripts/gvs-sync-2026-10-22.ts [--apply] [--images]
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/slug";
import { logAdminActivity } from "../src/lib/admin/activity-log";

const APPLY = process.argv.includes("--apply");
const IMAGES = process.argv.includes("--images");
const MARKUP = 1.21 * 1.2;
const IMG_SRC = "/tmp/gvsx/out";

interface Row { sheet: string; row: number; ean: number | null; art: number | null; name: string; avail: string | number | null; info: string | null; czk: number | null; disc: number | null; rrp: number | null }

const sellFor = (cost: number) => Math.round(cost * MARKUP);
const eanOf = (r: Row) => (r.ean && !Number.isNaN(r.ean) ? String(Math.round(Number(r.ean))) : "");

interface NewProduct {
  code: string; ean: string; name: string; nameSk: string; cost: number; inStock: boolean;
  description: string; descriptionSk: string; ingredients?: string; vegan: boolean; crueltyFree: boolean;
}

const NEW: NewProduct[] = [
  {
    code: "GVS-255286", ean: "8809447255286", cost: 282.5, inStock: true, vegan: false, crueltyFree: false,
    name: "Dr. Althea 0.1% Gentle Retinol Serum – Jemné retinolové sérum proti vráskám – 30 ml",
    nameSk: "Dr. Althea 0.1% Gentle Retinol Serum – Jemné retinolové sérum proti vráskam – 30 ml",
    description: "<p>Jemné sérum Dr.Althea s retinolem a bakuchiolem, navržené tak, aby bylo vhodné i pro citlivou pleť a pleť náchylnou k akné. Lehká, rychle se vstřebávající textura se nemastí, pomáhá vyhlazovat strukturu pleti a zjemňovat stopy po akné. Retinol zlepšuje vzhled vrásek a zmenšuje viditelnost pórů, bakuchiol – rostlinná alternativa retinolu – podporuje pevnost a pružnost pleti.</p><ul><li>objem 30 ml, skleněná lahvička s pumpičkou</li><li>retinol + bakuchiol, receptura s nízkým potenciálem dráždění</li><li>šest bylinných extraktů (chrpa, brutnák, levandule, heřmánek, hyacint, šalvěj muškátová) a panthenol pro zklidnění a hydrataci</li><li>vhodné pro všechny typy pleti, i jako první retinolové sérum</li></ul><p><strong>Jak používat:</strong> v prvních dvou týdnech nanášejte 1–2 stlačení pumpičky obden, od třetího týdne 3–4 stlačení denně. Přes den používejte krém s UV filtrem.</p>",
    descriptionSk: "<p>Jemné sérum Dr.Althea s retinolom a bakuchiolom, navrhnuté tak, aby bolo vhodné aj pre citlivú pleť a pleť náchylnú na akné. Ľahká, rýchlo sa vstrebávajúca textúra sa nemastí, pomáha vyhladzovať štruktúru pleti a zjemňovať stopy po akné. Retinol zlepšuje vzhľad vrások a zmenšuje viditeľnosť pórov, bakuchiol – rastlinná alternatíva retinolu – podporuje pevnosť a pružnosť pleti.</p><ul><li>objem 30 ml, sklenená fľaštička s pumpičkou</li><li>retinol + bakuchiol, receptúra s nízkym potenciálom dráždenia</li><li>šesť bylinných extraktov (nevädza, borák, levanduľa, harmanček, hyacint, šalvia muškátová) a panthenol na zklidnenie a hydratáciu</li><li>vhodné pre všetky typy pleti, aj ako prvé retinolové sérum</li></ul><p><strong>Ako používať:</strong> v prvých dvoch týždňoch nanášajte 1–2 stlačenia pumpičky obden, od tretieho týždňa 3–4 stlačenia denne. Cez deň používajte krém s UV filtrom.</p>",
    ingredients: "Aqua (Water), Glycerin, Butylene Glycol, Dibutyl Adipate, 1,2-Hexanediol, Betula Alba Juice, Chamomilla Recutita (Matricaria) Flower Extract, Centaurea Cyanus Flower Extract, Borago Officinalis Extract, Lavandula Angustifolia (Lavender) Flower Extract, Salvia Sclarea (Clary) Extract, Hyacinthus Orientalis (Hyacinth) Extract, Ethylhexylglycerin, Panthenol, Glycine Soja (Soybean) Oil, Retinol, Glyceryl Acrylate/Acrylic Acid Copolymer, PVM/MA Copolymer, Hydrogenated Lecithin, Caprylic/Capric Triglyceride, Polyglyceryl-3 Methylglucose Distearate, Sodium Polyacrylate, Sodium Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Polyisobutene, Caprylyl/Capryl Glucoside, Sorbitan Oleate, Hydroxyethyl Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Sorbitan Isostearate, Bakuchiol, Allantoin, Tocopherol, Disodium EDTA",
  },
  {
    code: "GVS-256085", ean: "8809447256085", cost: 212.5, inStock: false, vegan: true, crueltyFree: false,
    name: "Dr. Althea Aqua Marine Watery Cream – Lehký hydratační krém s bambusovou vodou – 50 ml",
    nameSk: "Dr. Althea Aqua Marine Watery Cream – Ľahký hydratačný krém s bambusovou vodou – 50 ml",
    description: "<p>Lehký veganský pleťový krém s vodnatou texturou, který se rychle vstřebává a hodí se k dennímu použití. Základem je 70 % bambusové vody (Bambusa Vulgaris) pro hlubokou hydrataci, 10 000 ppm panthenolu pomáhá dlouhodobě udržet vlhkost a posilovat bariéru pleti a guajazulen zklidňuje podrážděnou pleť. Po nanesení zůstává pleť svěží a vlhká, bez lepivého pocitu.</p><ul><li>objem 50 ml, tuba pro hygienické dávkování</li><li>70 % bambusové vody, panthenol, kyselina hyaluronová v několika formách</li><li>vhodný pro všechny typy pleti, zvlášť pro suchou a dehydratovanou</li><li>podle klinického testu výrobce (Korea Institute of Dermatological Sciences, 2025) vzrostla hydratace pleti po jednom použití o 167 %</li></ul><p>Součást hydratační řady Aqua Marine od Dr.Althea.</p>",
    descriptionSk: "<p>Ľahký vegánsky pleťový krém s vodnatou textúrou, ktorý sa rýchlo vstrebáva a hodí sa na denné použitie. Základom je 70 % bambusovej vody (Bambusa Vulgaris) na hlbokú hydratáciu, 10 000 ppm panthenolu pomáha dlhodobo udržať vlhkosť a posilňovať bariéru pleti a guajazulén zklidňuje podráždenú pleť. Po nanesení zostáva pleť sviežia a vlhká, bez lepivého pocitu.</p><ul><li>objem 50 ml, tuba na hygienické dávkovanie</li><li>70 % bambusovej vody, panthenol, kyselina hyalurónová vo viacerých formách</li><li>vhodný pre všetky typy pleti, najmä pre suchú a dehydratovanú</li><li>podľa klinického testu výrobcu (Korea Institute of Dermatological Sciences, 2025) vzrástla hydratácia pleti po jednom použití o 167 %</li></ul><p>Súčasť hydratačnej série Aqua Marine od Dr.Althea.</p>",
    ingredients: "Bambusa Vulgaris Water, 1,2-Hexanediol, Propanediol, Aqua (Water), Glycerin, Hydrogenated Polydecene, C14-22 Alcohols, C12-20 Alkyl Glucoside, Caprylic/Capric Triglyceride, Codium Fragile Extract, Palmaria Palmata Extract, Chondrus Crispus Extract, Sargassum Pallidum Extract, Butylene Glycol, Hyaluronic Acid, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Panthenol, Vinyl Dimethicone, Cetyl Alcohol, Carbomer, Tromethamine, Sodium DNA, Hydrogenated Lecithin, Dextrin, Gardenia Florida Fruit Extract, Polyglutamic Acid, Hydrolyzed Sodium Hyaluronate, Hydroxypropyltrimonium Hyaluronate, Potassium Hyaluronate, Sodium Hyaluronate Crosspolymer, Pentylene Glycol, Sodium Acetylated Hyaluronate, Guaiazulene, Agave Tequilana Leaf Extract, Sodium Retinoyl Hyaluronate, Zinc Hydrolyzed Hyaluronate, Dimethylsilanol Hyaluronate, Sodium Benzoate, Ascorbyl Propyl Hyaluronate, Ascorbylpropyl Hydrolyzed Hyaluronat, Caulerpa Lentillifera Extract, Ethylhexylglycerin, Disodium EDTA",
  },
  {
    code: "GVS-251400", ean: "8809447251400", cost: 172.5, inStock: true, vegan: true, crueltyFree: false,
    name: "Dr. Althea Amino Acid Gentle Bubble Cleanser – Jemná čisticí pěna s aminokyselinami – 140 ml",
    nameSk: "Dr. Althea Amino Acid Gentle Bubble Cleanser – Jemná čistiaca pena s aminokyselinami – 140 ml",
    description: "<p>Jemná čisticí pěna Dr.Althea s komplexem 17 aminokyselin, která odstraňuje nečistoty a zbytky make-upu a pleť přitom nevysušuje. Pumpička vytvoří hustou pěnu s drobnými bublinkami (nanovelikost pěny kolem 200 nm), jež se dostane i do pórů. Po omytí se pleť nestahuje a je vhodná pro citlivou i aknózní pleť nebo pleť s narušenou bariérou.</p><ul><li>objem 140 ml, pumpička s hotovou pěnou</li><li>17 aminokyselin, kyselina hyaluronová, ceramid NP, extrakt ze semínek perilly, bambusová voda a olej z pomerančové kůry</li><li>veganský certifikát, bez parabenů a umělých barviv, hypoalergenní složky, EWG zelená třída</li><li>vhodná jako druhý krok dvojité čištění po čisticím oleji</li></ul><p>Pro denní použití ráno i večer.</p>",
    descriptionSk: "<p>Jemná čistiaca pena Dr.Althea s komplexom 17 aminokyselín, ktorá odstraňuje nečistoty a zvyšky make-upu a pleť pritom nevysušuje. Pumpička vytvorí hustú penu s drobnými bublinkami (nanovekosť peny okolo 200 nm), ktorá sa dostane aj do pórov. Po umytí sa pleť nestiahne a je vhodná pre citlivú aj aknóznu pleť alebo pleť s narušenou bariérou.</p><ul><li>objem 140 ml, pumpička s hotovou penou</li><li>17 aminokyselín, kyselina hyalurónová, ceramid NP, extrakt zo semienok perily, bambusová voda a olej z pomarančovej kôry</li><li>vegánsky certifikát, bez parabénov a umelých farbív, hypoalergénne zložky, EWG zelená trieda</li><li>vhodná ako druhý krok dvojitého čistenia po čistiacom oleji</li></ul><p>Na denné použitie ráno aj večer.</p>",
  },
  {
    code: "GVS-254708", ean: "8809447254708", cost: 222.5, inStock: false, vegan: true, crueltyFree: true,
    name: "Dr. Althea Green Relief Amino Gel Cleanser – Jemný čisticí gel s aminokyselinami – 100 ml",
    nameSk: "Dr. Althea Green Relief Amino Gel Cleanser – Jemný čistiaci gél s aminokyselinami – 100 ml",
    description: "<p>Jemný čisticí gel Dr.Althea s mírně kyselým pH 5,0–6,0, které respektuje přirozenou rovnováhu pleti. Gel se snadno pění na jemnou pěnu s drobnými bublinkami, důkladně, ale šetrně odstraní nečistoty z pórů a po smytí na pleti nezanechává film. Pleť zůstává příjemně hydratovaná, takže je gel vhodný i pro citlivou a suchou pleť nebo pleť s tendencí k akné.</p><ul><li>objem 100 ml, tuba</li><li>mírně kyselé pH 5,0–6,0, minimum zbytků po smytí</li><li>vegan a cruelty-free formule vhodná pro citlivou pleť</li><li>zelená řada Dr.Althea, doplněk k čisticímu oleji nebo balzámu při dvojím čištění</li></ul><p>Používejte ráno i večer na vlhkou pleť, poté důkladně opláchněte.</p>",
    descriptionSk: "<p>Jemný čistiaci gél Dr.Althea s mierne kyslým pH 5,0–6,0, ktoré rešpektuje prirodzenú rovnováhu pleti. Gél sa ľahko peni na jemnú penu s drobnými bublinkami, dôkladne, ale šetrne odstráni nečistoty z pórov a po zmytí na pleti nezanecháva film. Pleť zostáva príjemne hydratovaná, takže je gél vhodný aj pre citlivú a suchú pleť alebo pleť s tendenciou k akné.</p><ul><li>objem 100 ml, tuba</li><li>mierne kyslé pH 5,0–6,0, minimum zvyškov po zmytí</li><li>vegan a cruelty-free formula vhodná pre citlivú pleť</li><li>zelená séria Dr.Althea, doplnok k čistiacemu oleju alebo balzamu pri dvojitom čistení</li></ul><p>Používajte ráno aj večer na vlhkú pleť, potom dôkladne opláchnite.</p>",
  },
  {
    code: "GVS-254203", ean: "8809447254203", cost: 192.5, inStock: true, vegan: true, crueltyFree: false,
    name: "Dr. Althea Multi-Action Infusion Serum – Hydratační sérum s kyselinou hyaluronovou a niacinamidem – 30 ml",
    nameSk: "Dr. Althea Multi-Action Infusion Serum – Hydratačné sérum s kyselinou hyalurónovou a niacínamidom – 30 ml",
    description: "<p>Víceúčelové veganské sérum Dr.Althea, které spojuje hydrataci, péči o jemné vrásky a zklidnění pleti. Obsahuje šest typů kyseliny hyaluronové pro vyplnění vlhkostí, niacinamid a adenosin pro vyrovnanější tón a pružnější vzhled a extrakty z noni a centelly asijské, které zklidňují zarudlou, unavenou a podrážděnou pleť. Jemně zelený odstín dodávají extrakty z lilkovce (Melia azadirachta).</p><ul><li>objem 30 ml, skleněná lahvička s pipetou</li><li>6 typů kyseliny hyaluronové, niacinamid, adenosin, betain, noni a centella</li><li>pomáhá uvolnit pocit staženosti, hydratuje suchou pleť a podporuje vyváženost vlhkosti a mazu</li><li>vegan formule</li></ul><p><strong>Jak používat:</strong> po čištění a toniku naneste vhodné množství séra na obličej a jemně vmasírujte do vstřebání, potom pokračujte krémem.</p>",
    descriptionSk: "<p>Viacúčelové vegánske sérum Dr.Althea, ktoré spája hydratáciu, starostlivosť o jemné vrásky a zklidnenie pleti. Obsahuje šesť typov kyseliny hyalurónovej na doplnenie vlhkosti, niacínamid a adenozín pre vyrovnanejší tón a pružnejší vzhľad a extrakty z noni a centelly asijskej, ktoré zklidňujú začervenanú, unavenú a podráždenú pleť. Jemne zelený odtieň dodávajú extrakty z lilkovca (Melia azadirachta).</p><ul><li>objem 30 ml, sklenená fľaštička s pipetou</li><li>6 typov kyseliny hyalurónovej, niacínamid, adenozín, betaín, noni a centella</li><li>pomáha uvoľniť pocit stiahnutosti, hydratuje suchú pleť a podporuje vyváženosť vlhkosti a mazu</li><li>vegan formula</li></ul><p><strong>Ako používať:</strong> po čistení a toniku naneste vhodné množstvo séra na tvár a jemne vmasírujte do vstrebania, potom pokračujte krémom.</p>",
  },
  {
    code: "GVS-254609", ean: "8809447254609", cost: 287.5, inStock: false, vegan: true, crueltyFree: true,
    name: "Dr. Althea 15% Niacinamide Purity Serum – Sérum s 15 % niacinamidu proti pórům a skvrnám – 30 ml",
    nameSk: "Dr. Althea 15% Niacinamide Purity Serum – Sérum s 15 % niacínamidu proti pórom a škvrnám – 30 ml",
    description: "<p>Lehké veganské sérum Dr.Althea s vysokým obsahem 15 % niacinamidu pro pleť s pigmentovými skvrnami, nerovným tónem a rozšířenými póry. Zinek PCA pomáhá regulovat přebytečný maz a patentovaný komplex MELACUT (šrucha zelná, extrakt z jader hroznů, Saururus chinensis a filtrát z fermentované rýže) zklidňuje pleť a vyrovnává její tón a strukturu. Tekutá textura se rychle vstřebává a nezanechává lepivý film.</p><ul><li>objem 30 ml, skleněná lahvička s pumpičkou</li><li>15 % niacinamid, zinek PCA, komplex MELACUT</li><li>pomáhá zjemnit vzhled pigmentových skvrn, nerovné struktury a rozšířených pórů</li><li>veganské, cruelty-free, pH 6,1, složky EWG zelené třídy, bez umělých barviv</li></ul><p>Při první aplikaci doporučujeme vyzkoušet sérum na malé ploše pleti. Přes den používejte krém s UV filtrem.</p>",
    descriptionSk: "<p>Ľahké vegánske sérum Dr.Althea s vysokým obsahom 15 % niacínamidu pre pleť s pigmentovými škvrnami, nerovným tónom a rozšírenými pórmi. Zinok PCA pomáha regulovať prebytočný maz a patentovaný komplex MELACUT (portulaka, extrakt z jadier hrozna, Saururus chinensis a filtrát z fermentovanej ryže) zklidňuje pleť a vyrovnáva jej tón a štruktúru. Tekutá textúra sa rýchlo vstrebáva a nezanecháva lepivý film.</p><ul><li>objem 30 ml, sklenená fľaštička s pumpičkou</li><li>15 % niacínamid, zinok PCA, komplex MELACUT</li><li>pomáha zjemniť vzhľad pigmentových škvŕn, nerovnej štruktúry a rozšírených pórov</li><li>vegánske, cruelty-free, pH 6,1, zložky EWG zelenej triedy, bez umelých farbív</li></ul><p>Pri prvej aplikácii odporúčame vyskúšať sérum na malej ploche pleti. Cez deň používajte krém s UV filtrom.</p>",
  },
  {
    code: "GVS-253152", ean: "8809447253152", cost: 297.5, inStock: true, vegan: true, crueltyFree: true,
    name: "Dr. Althea Anastatica Skin Conditioning Toner – Hydratační tonikum s růží z Jericha – 250 ml",
    nameSk: "Dr. Althea Anastatica Skin Conditioning Toner – Hydratačné tonikum s ružou z Jericha – 250 ml",
    description: "<p>Lehké přírodní tonikum Dr.Althea, které vzniklo z 85 % extraktu z rostliny Anastatica Hierochuntica, známé také jako růže z Jericha. Hluboce hydratuje pleť, pomáhá ji chránit před vnějšími vlivy a díky kyselině hyaluronové ve více vrstvách rychle doplňuje vlhkost a brání jejímu úniku. Formule je veganská, bez testování na zvířatech a bez umělých barviv, vhodná i pro citlivou pleť.</p><ul><li>objem 250 ml</li><li>85 % extraktu z Anastatica Hierochuntica, kyselina hyaluronová, allantoin</li><li>první krok hydratační péče po čištění</li><li>vegan, cruelty-free, bez umělých barviv</li></ul><p>Nalijte na vatový tampon nebo do dlaní a jemně vklepejte do pleti.</p>",
    descriptionSk: "<p>Ľahké prírodné tonikum Dr.Althea, ktoré vzniklo z 85 % extraktu z rastliny Anastatica Hierochuntica, známej aj ako ruža z Jericha. Hlboko hydratuje pleť, pomáha ju chrániť pred vonkajšími vplyvmi a vďaka kyseline hyalurónovej vo viacerých vrstvách rýchlo dopĺňa vlhkosť a bráni jej úniku. Formula je vegánska, bez testovania na zvieratách a bez umelých farbív, vhodná aj pre citlivú pleť.</p><ul><li>objem 250 ml</li><li>85 % extraktu z Anastatica Hierochuntica, kyselina hyalurónová, alantoín</li><li>prvý krok hydratačnej starostlivosti po čistení</li><li>vegan, cruelty-free, bez umelých farbív</li></ul><p>Naneste na vatový tampón alebo do dlaní a jemne vklepkajte do pleti.</p>",
  },
];

async function main() {
  const rows = JSON.parse(await readFile("ops/gvs-new-2026-10-22.json", "utf-8")) as Row[];
  const stamp = Date.now();
  const all = await prisma.product.findMany({
    where: { code: { startsWith: "GVS-" } },
    select: { id: true, code: true, ean: true, name: true, slug: true, nameSk: true, descriptionSk: true, description: true, stock: true, purchasePrice: true, price: true, visible: true, isDefective: true, brandId: true,
      images: { select: { url: true, sortOrder: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (APPLY) {
    await mkdir("ops/snapshots", { recursive: true });
    await writeFile(`ops/snapshots/gvs-sync-${stamp}.json`, JSON.stringify(all.map((p) => ({ id: p.id, code: p.code, stock: p.stock, purchasePrice: Number(p.purchasePrice), price: Number(p.price), visible: p.visible })), null, 1));
  }

  const regularRows = rows.filter((r) => r.sheet !== "Defective Items");
  const byEan = new Map<string, Row[]>();
  for (const r of regularRows) { const k = eanOf(r); if (!k) continue; byEan.set(k, [...(byEan.get(k) ?? []), r]); }

  // ---- 1 + 2: regular cost/price and availability
  let costChanges = 0, stockChanges = 0;
  const newPriceByCode = new Map<string, number>();
  for (const p of all.filter((x) => !x.isDefective && x.ean)) {
    const rs = byEan.get(p.ean!);
    if (!rs) continue;
    const maxAll = Math.max(...rs.map((r) => r.czk ?? 0));
    const inStock = rs.filter((r) => r.avail === "in stock" && r.czk && r.czk >= maxAll * 0.2);
    const wantStock = rs.some((r) => r.avail === "in stock") ? 10 : 0;
    const data: { stock?: number; purchasePrice?: number; price?: number } = {};
    if ((p.stock > 0) !== (wantStock > 0) && p.visible && Number(p.purchasePrice) >= 20) { data.stock = wantStock; stockChanges++; }
    if (inStock.length) {
      const newCost = Math.max(...inStock.map((r) => r.czk!));
      const oldCost = Number(p.purchasePrice);
      if (Math.abs(newCost - oldCost) / oldCost >= 0.02 && newCost >= 20) {
        const oldPrice = Number(p.price);
        const followsRule = Math.abs(oldPrice - oldCost * MARKUP) / (oldCost * MARKUP) <= 0.04;
        data.purchasePrice = newCost;
        const raise = sellFor(newCost) > oldPrice; // manual price: only ever raised, to keep the margin
        if (followsRule || raise) data.price = sellFor(newCost);
        console.log(`COST  ${p.code.padEnd(11)} ${p.name.slice(0, 42).padEnd(42)} cost ${oldCost} -> ${newCost}  price ${oldPrice}${data.price ? " -> " + data.price : " (manual, unchanged)"}`);
        costChanges++;
      }
    }
    if (data.stock !== undefined) console.log(`STOCK ${p.code} ${p.name.slice(0, 42)} ${p.stock} -> ${data.stock}`);
    newPriceByCode.set(p.code, data.price ?? Number(p.price));
    if (APPLY && Object.keys(data).length) await prisma.product.update({ where: { id: p.id }, data });
  }
  console.log(`regular: ${costChanges} cost changes, ${stockChanges} stock changes`);

  // ---- 3: defect listings (use the last block of the tab: the first 8 rows are a stale duplicate)
  const defRows = new Map<string, Row>();
  for (const r of rows.filter((x) => x.sheet === "Defective Items")) defRows.set(eanOf(r), r); // later rows overwrite earlier
  const vyprodej = await prisma.category.findUnique({ where: { fullSlug: "vyprodej" } });
  let defUpdated = 0, defCreated = 0;
  for (const p of all.filter((x) => x.isDefective && x.ean)) {
    const r = defRows.get(p.ean!);
    const qty = r ? Number(r.avail) || 0 : 0;
    const cost = r?.czk ?? Number(p.purchasePrice);
    const regPrice = newPriceByCode.get(p.code.replace("-DEFECT", ""));
    const dPrice = regPrice ? Math.min(sellFor(cost), Math.round(regPrice * 0.9)) : sellFor(cost);
    console.log(`DEFECT ${p.code.padEnd(18)} stock ${p.stock} -> ${qty}  cost ${Number(p.purchasePrice)} -> ${cost}  price ${Number(p.price)} -> ${dPrice}`);
    if (APPLY) await prisma.product.update({ where: { id: p.id }, data: { stock: qty, purchasePrice: cost, price: dPrice } });
    defUpdated++;
  }
  const defEans = new Set(all.filter((x) => x.isDefective).map((x) => x.ean));
  for (const [ean, r] of defRows) {
    if (defEans.has(ean) || !ean) continue;
    const reg = all.find((x) => !x.isDefective && x.ean === ean);
    if (!reg) { console.log(`DEFECT-NEW skipped (no regular product in catalogue): ${ean} ${r.name}`); continue; }
    const qty = Number(r.avail) || 0; const cost = r.czk!;
    const code = `${reg.code}-DEFECT`;
    const regPrice = newPriceByCode.get(reg.code);
    const dPrice = regPrice ? Math.min(sellFor(cost), Math.round(regPrice * 0.9)) : sellFor(cost);
    console.log(`DEFECT-NEW ${code} ${reg.name.slice(0, 50)} qty ${qty} cost ${cost} -> ${dPrice}`);
    if (APPLY) {
      const notice = "<p><strong>Poškozený obal, produkt neporušený.</strong> Balení této položky je mírně poškozené (promáčknutí/oděrky krabičky), samotný produkt je zcela neporušený a nepoužitý.</p>";
      const noticeSk = "<p><strong>Poškodený obal, produkt neporušený.</strong> Balenie tejto položky je mierne poškodené (pokrčenie/odreniny škatuľky), samotný produkt je úplne neporušený a nepoužitý.</p>";
      const created = await prisma.product.create({
        data: {
          code, ean, name: `${reg.name} (poškozený obal)`, slug: `${reg.slug}-poskozeny-obal`,
          nameSk: reg.nameSk ? `${reg.nameSk} (poškodený obal)` : null,
          description: notice + (reg.description ?? ""), descriptionSk: reg.descriptionSk ? noticeSk + reg.descriptionSk : null,
          brandId: reg.brandId, price: dPrice, purchasePrice: cost, vatRate: 21, stock: qty, visible: reg.visible, isDefective: true,
        },
      });
      if (vyprodej) await prisma.productCategory.create({ data: { productId: created.id, categoryId: vyprodej.id } });
      for (const img of reg.images) await prisma.productImage.create({ data: { productId: created.id, url: img.url, sortOrder: img.sortOrder } });
    }
    defCreated++;
  }
  console.log(`defects: ${defUpdated} updated, ${defCreated} created`);

  // ---- 4: SPV listings of the "new" Dr.Althea EANs get the new copy (and, with --images, a better main photo)
  const SPV_BY_EAN: Record<string, string> = {
    "8809447255286": "SPV-0247763", "8809447256085": "SPV-0243469", "8809447251400": "SPV-0247760", "8809447254708": "SPV-0247761",
    "8809447254203": "SPV-0247764", "8809447254609": "SPV-0247765", "8809447253152": "SPV-0247766",
  };
  const MAIN_SWAP = new Set(["GVS-254708", "GVS-254609"]); // SPV main photos are only 500 / 350 px
  let copyUpdated = 0;
  for (const n of NEW) {
    const code = SPV_BY_EAN[n.ean];
    const p = await prisma.product.findUnique({ where: { code }, select: { id: true, images: { orderBy: { sortOrder: "asc" }, select: { id: true } } } });
    if (!p) { console.log(`COPY missing ${code}`); continue; }
    console.log(`COPY ${code} <- ${n.code} (${n.description.length} chars${n.ingredients ? " + INCI" : ""})${IMAGES && MAIN_SWAP.has(n.code) ? " + main photo" : ""}`);
    if (APPLY) {
      await prisma.product.update({ where: { id: p.id }, data: { description: n.description, descriptionSk: n.descriptionSk, ...(n.ingredients ? { ingredients: n.ingredients } : {}), isVegan: n.vegan || undefined, isCrueltyFree: n.crueltyFree || undefined } });
      if (IMAGES && MAIN_SWAP.has(n.code) && p.images[0]) {
        const dir = path.join("public", "uploads", "products", code);
        await mkdir(dir, { recursive: true });
        const filename = `trim-${createHash("sha1").update(n.code + "main").digest("hex").slice(0, 10)}.jpg`;
        await copyFile(path.join(IMG_SRC, n.code, "main.jpg"), path.join(dir, filename));
        await prisma.productImage.update({ where: { id: p.images[0].id }, data: { url: `/uploads/products/${code}/${filename}` } });
      }
    }
    copyUpdated++;
  }
  const newCreated = 0;
  if (APPLY) await logAdminActivity({ action: "product.gvs_sync", entityType: "Product", detail: `GVS sync 2026-10-22: ${costChanges} cost, ${stockChanges} stock, ${defUpdated}+${defCreated} defect, ${copyUpdated} SPV copies (snapshot gvs-sync-${stamp}.json)` });
  console.log(APPLY ? `APPLIED (snapshot ops/snapshots/gvs-sync-${stamp}.json)` : "DRY RUN — nothing written");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
