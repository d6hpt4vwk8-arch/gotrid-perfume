// Writes the structured product-page blocks (Product.details) from scripts/data/product-details-2026-10.ts and adds
// the verified INCI lists we have for a few Dr.Althea products. Generic "how to use" steps and one general FAQ answer per
// product type are merged in here as defaults; per-product text always wins.
//
//   npx tsx --env-file=.env scripts/apply-product-details.ts            dry run
//   npx tsx --env-file=.env scripts/apply-product-details.ts --apply    write (snapshot in ops/snapshots/product-details-<ts>.json)
//   npx tsx --env-file=.env scripts/apply-product-details.ts --revert=<snapshot.json>
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { logAdminActivity } from "../src/lib/admin/activity-log";
import { ENTRIES, type Entry } from "./data/product-details-2026-10";

const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.find((a) => a.startsWith("--revert="))?.slice("--revert=".length);

type Lang = "cs" | "sk";
type Kind = NonNullable<Entry["kind"]>;
interface Defaults {
  howToUse: string[];
  faq: { q: string; a: string }[];
}

const DEFAULTS: Record<Lang, Record<Kind, Defaults>> = {
  cs: {
    foam: {
      howToUse: ["Navlhčete obličej a ruce vlažnou vodou.", "Vmasírujte malé množství do pleti, vyhněte se očím.", "Důkladně opláchněte vlažnou vodou a jemně osušte."],
      faq: [{ q: "Mohu čisticí přípravek používat ráno i večer?", a: "Ano, jemné čisticí přípravky lze používat dvakrát denně. Večer jej zařaďte jako druhý krok po odličovacím oleji nebo balzámu, pokud používáte make-up nebo opalovací krém." }],
    },
    balm: {
      howToUse: ["Naneste na suchou pleť a jemně vmasírujte suchýma rukama.", "Přidejte trochu vody, balzám se promění v mléčnou emulzi.", "Důkladně opláchněte; pro dvojí čištění navažte jemnou pěnou nebo gelem."],
      faq: [{ q: "Je potřeba po balzámu čistit ještě pěnou?", a: "Doporučujeme dvoufázové čištění: nejdřív balzám (odstraní make-up a opalovací krém), pak jemná čisticí pěna nebo gel." }],
    },
    mist: {
      howToUse: ["Po čištění jemně zamlžte obličej se zavřenýma očima.", "Nechte zaschnout nebo vklepejte dlaněmi.", "Navažte sérem a krémem."],
      faq: [{ q: "Kdy mlhu používat?", a: "Po čištění jako hydratační krok, nebo kdykoli během dne pro osvěžení pleti." }],
    },
    serum: {
      howToUse: ["Po čištění a toniku naneste několik kapek na obličej a krk.", "Jemně vklepejte do vstřebání.", "Pokračujte krémem; ráno vždy ukončete opalovacím krémem."],
      faq: [{ q: "Mohu sérum kombinovat s dalšími aktivními složkami?", a: "Ano, ale zavádějte vždy jen jeden nový produkt a sledujte reakci pleti. Při citlivé pleti nebo pochybnostech se poraďte s dermatologem." }],
    },
    cream: {
      howToUse: ["Naneste na čistou pleť jako poslední krok péče (po séru).", "Jemně vmasírujte na obličej a krk do vstřebání."],
      faq: [{ q: "Jak dlouho trvá, než uvidím výsledky?", a: "Hydratace a zklidnění bývají znát během několika dní. Pro viditelnější změny počítejte s několika týdny pravidelného používání." }],
    },
    sun: {
      howToUse: ["Naneste jako poslední krok ranní péče dostatečné množství na obličej a krk.", "Opakujte během dne, zvlášť při pobytu venku, koupání a pocení."],
      faq: [{ q: "Jak často opalovací krém nanášet?", a: "Nejméně každé dvě hodiny při pobytu venku a po koupání nebo osušení. Dostatečné množství je klíčové pro uváděnou ochranu." }],
    },
    sheet: {
      howToUse: ["Na čistou pleť přiložte masku.", "Nechte působit 15–20 minut.", "Masku sundejte a zbylou esenci jemně vklepejte do pleti."],
      faq: [{ q: "Jak často plátýnkovou masku používat?", a: "Obvykle stačí 1–3× týdně jako doplněk běžné péče; konkrétní doporučení najdete na obalu." }],
    },
    eye: {
      howToUse: ["Malé množství naneste na čistou pleť kolem očí.", "Jemně vklepejte špičkou prstu, nenanášejte přímo do očí."],
      faq: [{ q: "Jak dlouho trvá, než uvidím výsledky?", a: "Hydratace bývá znát po několika dnech, změny na tmavých kruzích a jemných vráskách vyžadují několik týdnů pravidelného používání." }],
    },
    pad: {
      howToUse: ["Po čištění přetřete obličej polštářkem.", "Navažte sérem a krémem."],
      faq: [{ q: "Mohu polštářek použít i na krk?", a: "Pokud je pleť v pohodě, ano, ale určený je především na obličej. Vyhněte se okolí očí." }],
    },
    "toner-acid": {
      howToUse: ["Po čištění naneste tonikum na vatový polštářek a přetřete obličej.", "Začněte 2–3× týdně, večer.", "Ráno vždy použijte opalovací krém."],
      faq: [{ q: "Mohu kyseliny kombinovat s retinolem?", a: "Silné aktivní složky nepoužívejte všechny najednou. Střídejte večery a nezačínejte více novinek zároveň." }],
    },
    essence: {
      howToUse: ["Po čištění naneste dlaněmi nebo vatovým polštářkem.", "Jemně vklepejte do pleti.", "Navažte sérem a krémem."],
      faq: [{ q: "Je tonikum vhodné pro každodenní používání?", a: "Ano, tonikum je jemný hydratační krok vhodný pro dvojí denní používání po čištění." }],
    },
    oil: { howToUse: ["Vmasírujte do suché pleti.", "Přidejte vodu a emulgujte.", "Opláchněte a navažte čisticí pěnou."], faq: [] },
    spot: { howToUse: ["Naneste lokálně na problematické místo.", "Nechte působit podle návodu.", "Opláchněte."], faq: [] },
  },
  sk: {
    foam: {
      howToUse: ["Navlhčite tvár a ruky vlažnou vodou.", "Vmasírujte malé množstvo do pleti, vyhnite sa očiam.", "Dôkladne opláchnite vlažnou vodou a jemne osušte."],
      faq: [{ q: "Môžem čistiaci prípravok používať ráno aj večer?", a: "Áno, jemné čistiace prípravky možno používať dvakrát denne. Večer ho zaraďte ako druhý krok po odličovacom oleji alebo balzame, ak používate make-up alebo opaľovací krém." }],
    },
    balm: {
      howToUse: ["Naneste na suchú pleť a jemne vmasírujte suchými rukami.", "Pridajte trochu vody, balzam sa premení na mliečnu emulziu.", "Dôkladne opláchnite; pre dvojité čistenie nadviažte jemnou penou alebo gélom."],
      faq: [{ q: "Je potrebné po balzame čistiť ešte penou?", a: "Odporúčame dvojfázové čistenie: najprv balzam (odstráni make-up a opaľovací krém), potom jemná čistiaca pena alebo gél." }],
    },
    mist: {
      howToUse: ["Po čistení jemne zahmlite tvár so zatvorenými očami.", "Nechajte zaschnúť alebo vklepkajte dlaňami.", "Nadviažte sérom a krémom."],
      faq: [{ q: "Kedy hmlu používať?", a: "Po čistení ako hydratačný krok alebo kedykoľvek počas dňa na osvieženie pleti." }],
    },
    serum: {
      howToUse: ["Po čistení a toniku naneste niekoľko kvapiek na tvár a krk.", "Jemne vklepkajte do vstrebania.", "Pokračujte krémom; ráno vždy ukončite opaľovacím krémom."],
      faq: [{ q: "Môžem sérum kombinovať s ďalšími aktívnymi zložkami?", a: "Áno, ale zavádzajte vždy len jeden nový produkt a sledujte reakciu pleti. Pri citlivej pleti alebo pochybnostiach sa poraďte s dermatológom." }],
    },
    cream: {
      howToUse: ["Naneste na čistú pleť ako posledný krok starostlivosti (po sére).", "Jemne vmasírujte na tvár a krk do vstrebania."],
      faq: [{ q: "Ako dlho trvá, kým uvidím výsledky?", a: "Hydratácia a zklidnenie bývajú cítiť v priebehu niekoľkých dní. Pre viditeľnejšie zmeny počítajte s niekoľkými týždňami pravidelného používania." }],
    },
    sun: {
      howToUse: ["Naneste ako posledný krok rannej starostlivosti dostatočné množstvo na tvár a krk.", "Opakujte počas dňa, najmä pri pobyte vonku, kúpaní a potení."],
      faq: [{ q: "Ako často opaľovací krém nanášať?", a: "Najmenej každé dve hodiny pri pobyte vonku a po kúpaní alebo osušení. Dostatočné množstvo je kľúčové pre uvádzanú ochranu." }],
    },
    sheet: {
      howToUse: ["Na čistú pleť priložte masku.", "Nechajte pôsobiť 15–20 minút.", "Masku zložte a zvyšnú esenciu jemne vklepkajte do pleti."],
      faq: [{ q: "Ako často plátennú masku používať?", a: "Zvyčajne stačí 1–3× týždenne ako doplnok bežnej starostlivosti; konkrétne odporúčanie nájdete na obale." }],
    },
    eye: {
      howToUse: ["Malé množstvo naneste na čistú pleť okolo očí.", "Jemne vklepkajte špičkou prsta, nenanášajte priamo do očí."],
      faq: [{ q: "Ako dlho trvá, kým uvidím výsledky?", a: "Hydratácia býva cítiť po niekoľkých dňoch, zmeny na tmavých kruhoch a jemných vráskach vyžadujú niekoľko týždňov pravidelného používania." }],
    },
    pad: {
      howToUse: ["Po čistení prejdite tvár vankúšikom.", "Nadviažte sérom a krémom."],
      faq: [{ q: "Môžem vankúšik použiť aj na krk?", a: "Ak je pleť v pohode, áno, ale je určený predovšetkým na tvár. Vyhnite sa okoliu očí." }],
    },
    "toner-acid": {
      howToUse: ["Po čistení naneste tonikum na vatový tampón a prejdite tvár.", "Začnite 2–3× týždenne, večer.", "Ráno vždy použite opaľovací krém."],
      faq: [{ q: "Môžem kyseliny kombinovať s retinolom?", a: "Silné aktívne zložky nepoužívajte všetky naraz. Striedajte večery a nezačínajte viac noviniek zároveň." }],
    },
    essence: {
      howToUse: ["Po čistení naneste dlaňami alebo vatovým tampónom.", "Jemne vklepkajte do pleti.", "Nadviažte sérom a krémom."],
      faq: [{ q: "Je tonikum vhodné na každodenné používanie?", a: "Áno, tonikum je jemný hydratačný krok vhodný na dvojité denné používanie po čistení." }],
    },
    oil: { howToUse: ["Vmasírujte do suchej pleti.", "Pridajte vodu a emulgujte.", "Opláchnite a nadviažte čistiacou penou."], faq: [] },
    spot: { howToUse: ["Naneste lokálne na problematické miesto.", "Nechajte pôsobiť podľa návodu.", "Opláchnite."], faq: [] },
  },
};

// Verified INCI lists copied from the brand's own product pages (doctoraltheaglobal.com, accessed 2026-10-23).
const INCI: Record<string, string> = {
  "GVS-255385":
    "Hippophae Rhamnoides Water, Centella Asiatica Leaf Water, Niacinamide, Butylene Glycol, 1,2-Hexanediol, Dipropylene Glycol, Water, Methyl Gluceth-20, Methylpropanediol, Betaine, Tranexamic Acid, Glycerin, Pentylene Glycol, Propanediol, Hydroxyethyl Urea, Laminaria Japonica Extract, Eclipta Prostrata Leaf Extract, Ficus Carica (Fig) Fruit Extract, Centella Asiatica Extract, Hydrogenated Lecithin, Sodium Hyaluronate, Carbomer, 3-O-Ethyl Ascorbic Acid, C12-14 Pareth-12, Ammonium Acryloyldimethyltaurate/VP Copolymer, Xanthan Gum, Tromethamine, Panthenol, Ethylhexylglycerin, Adenosine, Disodium EDTA, Fructooligosaccharides, Beta-Glucan, Ascorbic Acid, Hydrolyzed Hyaluronic Acid, Ceramide NP, Alpha-Arbutin, Tocopherol, Bifida Ferment Lysate, Bisabolol, Ubiquinone, Hydroxydecyl Ubiquinone, Sodium Acetylated Hyaluronate",
  "GVS-256221":
    "Aqua (Water), Melaleuca Alternifolia (Tea Tree) Leaf Water, Propanediol, Glycerin, 1,2-Hexanediol, Hydrogenated Polydecene, Vinyl Dimethicone, C14-22 Alcohols, Niacinamide, Caprylic/Capric Triglyceride, Panthenol, Dicaprylyl Carbonate, Butylene Glycol, Ammonium Acryloyldimethyltaurate/VP Copolymer, Caprylyl Methicone, Polymethylsilsesquioxane, C12-20 Alkyl Glucoside, Hydroxyacetophenone, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Polyquaternium-51, Ethylhexylglycerin, Tromethamine, Sodium Hyaluronate, Sodium Stearoyl Glutamate, Coptis Japonica Root Extract, Centella Asiatica Leaf Water, Beta-Glucan, Resveratrol, Hydrolyzed Hyaluronic Acid, Camellia Sinensis Leaf Water, Tocopherol, Madecassoside, Sodium DNA, Centella Asiatica Extract, Ceramide NP, Tannic Acid, Disodium EDTA, Sodium Phytate",
  "GVS-256184":
    "Aqua (Water), Sea Water, Butylene Glycol, 1,2-Hexanediol, Tripropylene Glycol, Glycereth-26, Methylpropanediol, Glycerin, Beta-Glucan, Xylitol, Propanediol, Hyaluronic Acid, Hydrolyzed Hyaluronic Acid, Sodium Hyaluronate, Sodium Chloride, Hydroxyacetophenone, Glycereth-25 PCA Isostearate, Gellan Gum, Sodium DNA, Trisodium Ethylenediamine Disuccinate, Malachite Extract, Arginine, Ethylhexylglycerin, Methyl Diisopropyl Propionamide, Disodium EDTA",
  "SPV-0247761":
    "Water, Glycerin, Sodium Cocoyl Alaninate, Disodium Cocoamphodiacetate, Sodium Methyl Cocoyl Taurate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Betula Platyphylla Japonica Juice, Sodium Chloride, Betaine, Lauryl Hydroxysultaine, 1,2-Hexanediol, Caprylyl Glycol, Coco-Glucoside, Potassium Cocoyl Glycinate, Citric Acid, Sodium Cocoyl Isethionate, Sodium Phytate, Caprylic/Capric Triglyceride, Dextrin, Butylene Glycol, Hydrogenated Lecithin, Gardenia Florida Fruit Extract, Hexylene Glycol, Quillaja Saponaria Bark Extract, Ceramide NP, Glyceryl Caprylate, Cynanchum Atratum Extract, Ethylhexylglycerin, Althaea Rosea Flower Extract, Hydrolyzed Hyaluronic Acid, Houttuynia Cordata Extract",
  "SPV-0247765":
    "Water, Pentylene Glycol, Niacinamide, Butylene Glycol, 1,2-Hexanediol, Glycerin, Polyglyceryl-10 Laurate, Trehalose, Xanthan Gum, Ethylhexylglycerin, Disodium EDTA, Rosmarinus Officinalis (Rosemary) Leaf Oil, Zinc PCA, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Portulaca Oleracea Extract, Vitis Vinifera (Grape) Seed Extract, Saururus Chinensis Extract, Rice Ferment Filtrate (Sake), Tocopherol",
};

const KIND_BY_TYPE: Record<string, Kind> = {
  cisteni: "foam",
  tonika: "essence",
  sera: "serum",
  kremy: "cream",
  oci: "eye",
  masky: "sheet",
  slunce: "sun",
  peeling: "toner-acid",
};

function build(entry: Entry, lang: Lang, productType: string | null) {
  const kind: Kind = entry.kind ?? KIND_BY_TYPE[productType ?? ""] ?? "cream";
  const block = entry[lang];
  const defaults = DEFAULTS[lang][kind];
  return {
    forWhom: block.forWhom,
    ingredients: block.ingredients,
    howToUse: block.howToUse ?? defaults.howToUse,
    expect: block.expect,
    faq: [...(block.faq ?? []), ...defaults.faq].slice(0, 3),
  };
}

async function main() {
  if (REVERT) {
    const snap = JSON.parse(await readFile(REVERT, "utf-8")) as { id: string; code: string; details: unknown; ingredients: string | null }[];
    for (const s of snap) {
      await prisma.product.update({
        where: { id: s.id },
        data: { details: (s.details as object | null) ?? Prisma_JsonNull(), ingredients: s.ingredients },
      });
      console.log(`REVERT ${s.code}`);
    }
    return;
  }
  const products = await prisma.product.findMany({
    where: { code: { in: ENTRIES.map((e) => e.code) } },
    select: { id: true, code: true, name: true, productType: true, ingredients: true, details: true },
  });
  const byCode = new Map(products.map((p) => [p.code, p]));
  const snapshot: unknown[] = [];
  let written = 0;
  for (const entry of ENTRIES) {
    const p = byCode.get(entry.code);
    if (!p) {
      console.log(`MISSING ${entry.code}`);
      continue;
    }
    const details = { cs: build(entry, "cs", p.productType), sk: build(entry, "sk", p.productType) };
    const newInci = !p.ingredients && INCI[entry.code] ? INCI[entry.code] : null;
    console.log(
      `${entry.code.padEnd(12)} ${p.name.slice(0, 50).padEnd(50)} ing ${details.cs.ingredients.length} steps ${details.cs.howToUse.length} faq ${details.cs.faq.length}${newInci ? " +INCI" : ""}`,
    );
    snapshot.push({ id: p.id, code: p.code, details: p.details, ingredients: p.ingredients });
    if (APPLY) {
      await prisma.product.update({ where: { id: p.id }, data: { details, ...(newInci ? { ingredients: newInci } : {}) } });
      written++;
    }
  }
  if (APPLY) {
    await mkdir("ops/snapshots", { recursive: true });
    const file = `ops/snapshots/product-details-${Date.now()}.json`;
    await writeFile(file, JSON.stringify(snapshot, null, 1));
    await logAdminActivity({ action: "product.details", entityType: "Product", detail: `Structured product blocks written for ${written} products (${file})` });
    console.log(`APPLIED ${written}, snapshot ${file}`);
  } else console.log(`DRY RUN ${snapshot.length}`);
}

import { Prisma } from "@prisma/client";
function Prisma_JsonNull() {
  return Prisma.JsonNull;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
