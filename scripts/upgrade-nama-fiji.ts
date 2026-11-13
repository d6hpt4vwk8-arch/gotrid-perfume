// Nama Fiji product cards: manufacturer's own photos (nama-fiji.com, 3 per product: pack shot, second pack shot,
// lifestyle scene — 1080x1080 PNG), new Czech + Slovak copy written in our own words from the brand site and the
// pack label (no medical claims), structured blocks (Product.details), vegan / cruelty-free flags (the brand states
// both on every product page) and one NEW product: the Cleansing Milk 120 ml the owner holds physically (EAN
// 9354836000071, 14 pcs own stock, full INCI copied from the pack photo of 2026-11-13).
//
// Photos live in ops/nama-fiji-photos/ (originals from the brand CDN). Two phases so the live site never points at
// files that are not deployed yet:
//   npx tsx --env-file=.env scripts/upgrade-nama-fiji.ts --files    write the JPEGs to public/uploads/products/<code>/
//   (commit + push the files)
//   npx tsx --env-file=.env scripts/upgrade-nama-fiji.ts --db       images + texts + the new product (snapshot saved first)
//   npx tsx --env-file=.env scripts/upgrade-nama-fiji.ts --revert   restore the snapshot, hide/delete the new product
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/slug";
import { logAdminActivity } from "../src/lib/admin/activity-log";

const MAX_EDGE = 1400;
const PHOTO_DIR = path.join(process.cwd(), "ops", "nama-fiji-photos");
const OUT_DIR = path.join(process.cwd(), "ops", "snapshots");
const MAP_FILE = path.join(OUT_DIR, "nama-images-map.json");
const BEFORE_FILE = path.join(OUT_DIR, "nama-before.json");

type Pair = { name: string; text: string };
type Lang = {
  name: string;
  intro: string;
  second: string;
  bullets: string[];
  forWhom: string;
  actives: Pair[];
  howToUse: string[];
  expect: string;
  faq: { q: string; a: string }[];
};
type Item = {
  code: string;
  isNew?: boolean;
  photos: string[]; // file stems in PHOTO_DIR, main first
  ean?: string;
  price?: number;
  ingredients?: string;
  cs: Lang;
  sk: Lang;
};

const CS_BRAND =
  "Nama Fiji je kosmetická značka z Fidži. Její péče stojí na mořských hroznech nama (Caulerpa racemosa), divoce rostoucí řase z tyrkysových lagun fidžijských ostrovů, která obsahuje velké množství iontových minerálních solí. Právě ty pomáhají udržet pleť hydratovanou déle.";
const SK_BRAND =
  "Nama Fiji je kozmetická značka z Fidži. Jej starostlivosť stojí na morských hroznách nama (Caulerpa racemosa), voľne rastúcej riase z tyrkysových lagún fidžijských ostrovov, ktorá obsahuje veľké množstvo iónových minerálnych solí. Práve tie pomáhajú udržať pleť dlhšie hydratovanú.";

const ITEMS: Item[] = [
  {
    code: "1366",
    photos: ["gel_serum_web2v1", "gel_serum_webv1", "gel_serum_web3"],
    cs: {
      name: "Gelové sérum Nama Fiji",
      intro:
        "Gelové sérum Nama Fiji je hydratační základ celé řady. Obsahuje mořské hrozny nama v kombinaci s aloe, měsíčkem a palmarosovým olejem a vsakuje se rychle, bez lepivého filmu. Minerály a antioxidanty z řasy pomáhají hydratovat pleť do hloubky a podporují její přirozenou bariéru.",
      second:
        CS_BRAND + " Sérum je určené pro všechny typy pleti, včetně citlivé, zralé nebo zatížené městským prostředím.",
      bullets: [
        "objem 30 ml",
        "hydratace uvnitř buněk i mezi nimi díky minerálům z mořských hroznů nama",
        "aktivní složky: extrakt nama, aloe, měsíček lékařský, palmarosový olej",
        "vegan, přírodní složení, bez syntetické vůně a parabenů",
        "netestováno na zvířatech, schváleno pro EU a Spojené království",
      ],
      forWhom:
        "Pro všechny typy pleti. Zvlášť oceníte sérum, pokud je vaše pleť citlivá, snadno se zarudne nebo ji zatěžuje znečištěné prostředí.",
      actives: [
        { name: "Extrakt nama (mořské hrozny)", text: "divoká fidžijská řasa s vysokým obsahem minerálních solí, které podporují dlouhodobou hydrataci." },
        { name: "Aloe", text: "osvěžuje a zklidňuje pleť, dodává lehkou hydrataci." },
        { name: "Měsíček lékařský", text: "tradiční zklidňující složka pro podrážděnou a unavenou pleť." },
        { name: "Palmarosový olej", text: "jemná rostlinná složka, která pomáhá vyvážit vzhled pleti." },
      ],
      howToUse: [
        "Naneste ráno a večer po očištění pleti na celý obličej a krk.",
        "Jemně vmasírujte do úplného vstřebání.",
        "Pokračujte krémem a ráno ochranným krémem s SPF.",
      ],
      expect: "Pleť je po aplikaci svěže hydratovaná, měkká a pohodlná. Při pravidelném používání působí vyrovnaněji a zdravěji.",
      faq: [
        { q: "Mohu sérum používat ráno i večer?", a: "Ano, výrobce doporučuje používání dvakrát denně po očištění pleti." },
        { q: "Hodí se i pro citlivou pleť?", a: "Ano, sérum je určené pro všechny typy pleti včetně citlivé. Při první aplikaci doporučujeme vyzkoušet malé množství." },
      ],
    },
    sk: {
      name: "Gélové sérum Nama Fiji",
      intro:
        "Gélové sérum Nama Fiji je hydratačný základ celej rady. Obsahuje morské hrozny nama v kombinácii s aloe, nechtíkom a palmarosovým olejom a vsiakne rýchlo, bez lepkavého filmu. Minerály a antioxidanty z riasy pomáhajú pleť hydratovať do hĺbky a podporujú jej prirodzenú bariéru.",
      second:
        SK_BRAND + " Sérum je určené pre všetky typy pleti, vrátane citlivej, zrelej alebo zaťaženej mestským prostredím.",
      bullets: [
        "objem 30 ml",
        "hydratácia vo vnútri buniek aj medzi nimi vďaka minerálom z morských hrozien nama",
        "aktívne zložky: extrakt nama, aloe, nechtík lekársky, palmarosový olej",
        "vegan, prírodné zloženie, bez syntetickej vône a parabénov",
        "netestované na zvieratách, schválené pre EÚ a Spojené kráľovstvo",
      ],
      forWhom:
        "Pre všetky typy pleti. Obzvlášť ocenite sérum, ak je vaša pleť citlivá, ľahko sa začervená alebo ju zaťažuje znečistené prostredie.",
      actives: [
        { name: "Extrakt nama (morské hrozny)", text: "divoká fidžijská riasa s vysokým obsahom minerálnych solí, ktoré podporujú dlhodobú hydratáciu." },
        { name: "Aloe", text: "osviežuje a upokojuje pleť, dodáva ľahkú hydratáciu." },
        { name: "Nechtík lekársky", text: "tradičná upokojujúca zložka pre podráždenú a unavenú pleť." },
        { name: "Palmarosový olej", text: "jemná rastlinná zložka, ktorá pomáha vyvážiť vzhľad pleti." },
      ],
      howToUse: [
        "Naneste ráno a večer po očistení pleti na celú tvár a krk.",
        "Jemne vmasírujte do úplného vstrebania.",
        "Pokračujte krémom a ráno ochranným krémom s SPF.",
      ],
      expect: "Pleť je po aplikácii sviežo hydratovaná, mäkká a pohodlná. Pri pravidelnom používaní pôsobí vyrovnanejšie a zdravšie.",
      faq: [
        { q: "Môžem sérum používať ráno aj večer?", a: "Áno, výrobca odporúča používanie dvakrát denne po očistení pleti." },
        { q: "Hodí sa aj pre citlivú pleť?", a: "Áno, sérum je určené pre všetky typy pleti vrátane citlivej. Pri prvej aplikácii odporúčame vyskúšať malé množstvo." },
      ],
    },
  },
  {
    code: "1372",
    photos: ["cleansing_gel_120_web2_2", "cleansing_gel_120_web_2", "cleansing_gel_web3_120"],
    cs: {
      name: "Čisticí gel Nama Fiji",
      intro:
        "Čisticí gel Nama Fiji se na vlhké pleti rozpěňuje do husté, jemné pěny, která důkladně čistí póry a nechává pleť svěží. Mořské hrozny nama zajišťují, že pleť po čištění nepůsobí staženě.",
      second:
        CS_BRAND + " Gel je určený pro každodenní čištění a hodí se zejména pro pleť mastnou, smíšenou, nečistou nebo podrážděnou.",
      bullets: [
        "objem 120 ml",
        "bohatá, jemná pěna pro důkladné čištění pórů",
        "aktivní složky: extrakt nama, glycerin, levandulový olej, kyselina citronová",
        "vegan, přírodní složení, bez syntetické vůně a parabenů",
        "netestováno na zvířatech, schváleno pro EU a Spojené království",
      ],
      forWhom: "Pro pleť mastnou, smíšenou, náchylnou k nedokonalostem nebo podrážděnou. Lze ho používat i na normální pleť.",
      actives: [
        { name: "Extrakt nama (mořské hrozny)", text: "minerály z fidžijské řasy podporují hydrataci, aby pleť po čištění nebyla vysušená." },
        { name: "Glycerin", text: "osvědčená hydratační složka, která pomáhá udržet vláhu v pleti." },
        { name: "Levandulový olej", text: "rostlinná složka s příjemnou, jemnou vůní." },
        { name: "Kyselina citronová", text: "pomáhá nastavit šetrné pH přípravku." },
      ],
      howToUse: [
        "Naneste na vlhkou pleť a jemně vmasírujte lehkými krouživými pohyby směrem vzhůru.",
        "Důkladně opláchněte vlažnou vodou.",
        "Pokračujte sérem a krémem.",
      ],
      expect: "Čistá, svěží pleť bez pocitu stažení. Gel se dobře smývá a nezanechává film.",
      faq: [
        { q: "Mohu gel používat ráno i večer?", a: "Ano, je určen ke každodennímu čištění. Večer jej můžete použít po odlíčení pleti." },
        { q: "Odstraní i make-up?", a: "Na běžný make-up doporučujeme nejdřív odličovací mléko, gel pak slouží jako druhý krok čištění." },
      ],
    },
    sk: {
      name: "Čistiaci gél Nama Fiji",
      intro:
        "Čistiaci gél Nama Fiji sa na vlhkej pleti rozpení do hustej, jemnej peny, ktorá dôkladne čistí póry a necháva pleť sviežu. Morské hrozny nama zaisťujú, že pleť po čistení nepôsobí stiahnuto.",
      second:
        SK_BRAND + " Gél je určený na každodenné čistenie a hodí sa najmä pre pleť mastnú, zmiešanú, nečistú alebo podráždenú.",
      bullets: [
        "objem 120 ml",
        "bohatá, jemná pena na dôkladné čistenie pórov",
        "aktívne zložky: extrakt nama, glycerín, levanduľový olej, kyselina citrónová",
        "vegan, prírodné zloženie, bez syntetickej vône a parabénov",
        "netestované na zvieratách, schválené pre EÚ a Spojené kráľovstvo",
      ],
      forWhom: "Pre pleť mastnú, zmiešanú, náchylnú na nedokonalosti alebo podráždenú. Možno ho používať aj na normálnu pleť.",
      actives: [
        { name: "Extrakt nama (morské hrozny)", text: "minerály z fidžijskej riasy podporujú hydratáciu, aby pleť po čistení nebola vysušená." },
        { name: "Glycerín", text: "osvedčená hydratačná zložka, ktorá pomáha udržať vlahu v pleti." },
        { name: "Levanduľový olej", text: "rastlinná zložka s príjemnou, jemnou vôňou." },
        { name: "Kyselina citrónová", text: "pomáha nastaviť šetrné pH prípravku." },
      ],
      howToUse: [
        "Naneste na vlhkú pleť a jemne vmasírujte ľahkými krúživými pohybmi smerom nahor.",
        "Dôkladne opláchnite vlažnou vodou.",
        "Pokračujte sérom a krémom.",
      ],
      expect: "Čistá, svieža pleť bez pocitu stiahnutia. Gél sa dobre zmýva a nezanecháva film.",
      faq: [
        { q: "Môžem gél používať ráno aj večer?", a: "Áno, je určený na každodenné čistenie. Večer ho môžete použiť po odličení pleti." },
        { q: "Odstráni aj make-up?", a: "Na bežný make-up odporúčame najprv odličovacie mlieko, gél potom slúži ako druhý krok čistenia." },
      ],
    },
  },
  {
    code: "1357",
    photos: ["eye_cream_web2v1", "eye_cream_webv1_bba6f1d7-7b78-4ce1-939c-19fe9504f054", "eye_cream_web3"],
    cs: {
      name: "Oční krém Nama Fiji",
      intro:
        "Oční krém Nama Fiji je bohatý, vyživný krém na jemnou pleť kolem očí. Mořské hrozny nama doplňuje extrakt z guavy, vitamin E a palmarosový olej, které pleť hydratují a pomáhají jí vypadat odpočatěji.",
      second:
        CS_BRAND + " Krém se hodí jak k prevenci, tak k cílené péči o unavenou nebo suchou oční partii.",
      bullets: [
        "objem 30 g",
        "bohatá textura pro suchou a náročnou pleť kolem očí",
        "aktivní složky: extrakt nama, extrakt z guavy, glycerin, vitamin E, palmarosový olej",
        "vegan, přírodní složení, bez syntetické vůně a parabenů",
        "netestováno na zvířatech, schváleno pro EU a Spojené království",
      ],
      forWhom: "Pro všechny, kdo chtějí o oční partii pečovat preventivně, i pro suchou a unavenou pleť kolem očí.",
      actives: [
        { name: "Extrakt nama (mořské hrozny)", text: "minerály z fidžijské řasy podporují dlouhodobou hydrataci." },
        { name: "Extrakt z guavy", text: "rostlinná složka s antioxidačním účinkem." },
        { name: "Glycerin", text: "hydratuje a zjemňuje jemnou pleť." },
        { name: "Vitamin E", text: "antioxidant, který pomáhá chránit pleť před vnějšími vlivy." },
        { name: "Palmarosový olej", text: "rostlinný olej, který přispívá k příjemné textuře a péči." },
      ],
      howToUse: [
        "Jemně naneste na čistou oční partii večer, při suché nebo náročné pleti dvakrát denně.",
        "Vklepávejte prsteníčkem směrem od vnitřního koutku k vnějšímu.",
        "Vyhněte se přímému kontaktu s očima.",
      ],
      expect: "Pleť kolem očí je hydratovaná, měkká a působí odpočatěji. Efekt je nejlepší při pravidelné večerní péči.",
      faq: [
        { q: "Od kolika let je vhodné oční krém používat?", a: "Oční krém lze používat preventivně už od ranější dospělosti. Rozhoduje spíš potřeba pleti než věk." },
        { q: "Mohu ho použít i na horní víčko?", a: "Naneste jej na kost kolem očí a vyhněte se přímému kontaktu s okem a řasami." },
      ],
    },
    sk: {
      name: "Očný krém Nama Fiji",
      intro:
        "Očný krém Nama Fiji je bohatý, výživný krém na jemnú pleť okolo očí. Morské hrozny nama dopĺňa extrakt z guavy, vitamín E a palmarosový olej, ktoré pleť hydratujú a pomáhajú jej vyzerať oddýchnutejšie.",
      second:
        SK_BRAND + " Krém sa hodí ako na prevenciu, tak na cielenú starostlivosť o unavenú alebo suchú očnú partiu.",
      bullets: [
        "objem 30 g",
        "bohatá textúra pre suchú a náročnú pleť okolo očí",
        "aktívne zložky: extrakt nama, extrakt z guavy, glycerín, vitamín E, palmarosový olej",
        "vegan, prírodné zloženie, bez syntetickej vône a parabénov",
        "netestované na zvieratách, schválené pre EÚ a Spojené kráľovstvo",
      ],
      forWhom: "Pre všetkých, ktorí chcú o očnú partiu pečovať preventívne, aj pre suchú a unavenú pleť okolo očí.",
      actives: [
        { name: "Extrakt nama (morské hrozny)", text: "minerály z fidžijskej riasy podporujú dlhodobú hydratáciu." },
        { name: "Extrakt z guavy", text: "rastlinná zložka s antioxidačným účinkom." },
        { name: "Glycerín", text: "hydratuje a zjemňuje jemnú pleť." },
        { name: "Vitamín E", text: "antioxidant, ktorý pomáha chrániť pleť pred vonkajšími vplyvmi." },
        { name: "Palmarosový olej", text: "rastlinný olej, ktorý prispieva k príjemnej textúre a starostlivosti." },
      ],
      howToUse: [
        "Jemne naneste na čistú očnú partiu večer, pri suchej alebo náročnej pleti dvakrát denne.",
        "Vklepávajte prstom smerom od vnútorného kútika k vonkajšiemu.",
        "Vyhnite sa priamemu kontaktu s očami.",
      ],
      expect: "Pleť okolo očí je hydratovaná, mäkká a pôsobí oddýchnutejšie. Efekt je najlepší pri pravidelnej večernej starostlivosti.",
      faq: [
        { q: "Od koľkých rokov je vhodné očný krém používať?", a: "Očný krém možno používať preventívne už od skoršej dospelosti. Rozhoduje skôr potreba pleti než vek." },
        { q: "Môžem ho použiť aj na horné viečko?", a: "Naneste ho na kosť okolo očí a vyhnite sa priamemu kontaktu s okom a riasami." },
      ],
    },
  },
  {
    code: "1369",
    photos: ["face_cream_web2v1", "face_cream_webv1", "face_cream_web3"],
    cs: {
      name: "Pleťový krém Nama Fiji",
      intro:
        "Pleťový krém Nama Fiji je lehký celodenní krém, který pleť hydratuje a jemně zklidňuje. Pupalkový olej, bambucké máslo a slunečnicový olej vytvářejí příjemnou, rychle se vstřebávající texturu, takže se hodí i pod make-up.",
      second:
        CS_BRAND + " Krém je určený jako každodenní hydratace pro normální až smíšenou pleť.",
      bullets: [
        "objem 50 g",
        "celodenní hydratace, vhodné jako báze pod make-up",
        "aktivní složky: extrakt nama, pupalkový olej, glycerin, vitamin E, slunečnicový olej, bambucké máslo, levandulový olej",
        "vegan, přírodní složení, bez syntetické vůně a parabenů",
        "netestováno na zvířatech, schváleno pro EU a Spojené království",
      ],
      forWhom: "Pro normální až smíšenou pleť a pro každého, kdo hledá jednoduchý krém na každý den.",
      actives: [
        { name: "Extrakt nama (mořské hrozny)", text: "minerály z fidžijské řasy podporují dlouhodobou hydrataci." },
        { name: "Pupalkový olej", text: "zdroj esenciálních mastných kyselin, které pomáhají pleť zjemnit a vyživit." },
        { name: "Bambucké máslo a slunečnicový olej", text: "měkčí pleť a vytvářejí lehký ochranný film." },
        { name: "Vitamin E", text: "antioxidant, který pomáhá chránit pleť před vnějšími vlivy." },
        { name: "Glycerin a levandulový olej", text: "hydratují a dodávají jemnou vůni." },
      ],
      howToUse: [
        "Ráno naneste na čistou pleť před ochranným krémem s SPF.",
        "Večer naneste před očním krémem.",
        "Jemně vmasírujte do vstřebání.",
      ],
      expect: "Pleť je hydratovaná, měkká a pohodlná po celý den, bez lepkavého pocitu.",
      faq: [
        { q: "Hodí se krém pod make-up?", a: "Ano, krém se rychle vstřebává a hodí se jako báze pod make-up." },
        { q: "Je vhodný i na večer?", a: "Ano, můžete jej používat ráno i večer před očním krémem." },
      ],
    },
    sk: {
      name: "Pleťový krém Nama Fiji",
      intro:
        "Pleťový krém Nama Fiji je ľahký celodenný krém, ktorý pleť hydratuje a jemne upokojuje. Pupalkový olej, bambucké maslo a slnečnicový olej vytvárajú príjemnú, rýchlo sa vstrebávajúcu textúru, takže sa hodí aj pod make-up.",
      second:
        SK_BRAND + " Krém je určený ako každodenná hydratácia pre normálnu až zmiešanú pleť.",
      bullets: [
        "objem 50 g",
        "celodenná hydratácia, vhodné ako báza pod make-up",
        "aktívne zložky: extrakt nama, pupalkový olej, glycerín, vitamín E, slnečnicový olej, bambucké maslo, levanduľový olej",
        "vegan, prírodné zloženie, bez syntetickej vône a parabénov",
        "netestované na zvieratách, schválené pre EÚ a Spojené kráľovstvo",
      ],
      forWhom: "Pre normálnu až zmiešanú pleť a pre každého, kto hľadá jednoduchý krém na každý deň.",
      actives: [
        { name: "Extrakt nama (morské hrozny)", text: "minerály z fidžijskej riasy podporujú dlhodobú hydratáciu." },
        { name: "Pupalkový olej", text: "zdroj esenciálnych mastných kyselín, ktoré pomáhajú pleť zjemniť a vyživiť." },
        { name: "Bambucké maslo a slnečnicový olej", text: "zjemňujú pleť a vytvárajú ľahký ochranný film." },
        { name: "Vitamín E", text: "antioxidant, ktorý pomáha chrániť pleť pred vonkajšími vplyvmi." },
        { name: "Glycerín a levanduľový olej", text: "hydratujú a dodávajú jemnú vôňu." },
      ],
      howToUse: [
        "Ráno naneste na čistú pleť pred ochranným krémom s SPF.",
        "Večer naneste pred očným krémom.",
        "Jemne vmasírujte do vstrebania.",
      ],
      expect: "Pleť je hydratovaná, mäkká a pohodlná po celý deň, bez lepkavého pocitu.",
      faq: [
        { q: "Hodí sa krém pod make-up?", a: "Áno, krém sa rýchlo vstrebáva a hodí sa ako báza pod make-up." },
        { q: "Je vhodný aj na večer?", a: "Áno, môžete ho používať ráno aj večer pred očným krémom." },
      ],
    },
  },
  {
    code: "1363",
    photos: ["face_cream_rich_web2v1", "face_cream_rich_webv1", "face_cream_rich_web3"],
    cs: {
      name: "Výživný pleťový krém Nama Fiji",
      intro:
        "Výživný pleťový krém Nama Fiji je bohatý hydratační krém pro suchou, citlivou a zralou pleť. Jojobový, šípkový a avokádový olej spolu s kakaovým máslem doplňují lipidy, které suché pleti chybí, a nechávají ji hebkou a pružnou.",
      second:
        CS_BRAND + " Krém funguje jako večerní péče i jako báze před make-upem nebo ochranným krémem.",
      bullets: [
        "objem 50 g",
        "bohatá textura pro suchou, citlivou a zralou pleť",
        "aktivní složky: extrakt nama, jojobový olej, šípkový olej, avokádový olej, kakaové máslo",
        "vegan, přírodní složení, bez syntetické vůně a parabenů",
        "netestováno na zvířatech, schváleno pro EU a Spojené království",
      ],
      forWhom: "Pro suchou, citlivou a zralou pleť nebo pleť, které chybí lipidy. Hodí se i na zimu.",
      actives: [
        { name: "Extrakt nama (mořské hrozny)", text: "minerály z fidžijské řasy podporují dlouhodobou hydrataci." },
        { name: "Jojobový olej", text: "jemný rostlinný olej, který se podobá pleťovému mazu." },
        { name: "Šípkový olej", text: "zdroj mastných kyselin a vitaminů pro vyživení pleti." },
        { name: "Avokádový olej", text: "výživný olej, který zjemňuje a změkčuje." },
        { name: "Kakaové máslo", text: "bohaté máslo, které pomáhá zadržet vláhu v pleti." },
      ],
      howToUse: [
        "Jemně vmasírujte do čistého obličeje a dekoltu.",
        "Použijte jako večerní péči nebo ráno před podkladovou bází či ochranným krémem.",
        "Při suché pleti naneste i na krk.",
      ],
      expect: "Pleť je vyživená, hebká a pružná. Krém nechává příjemný, bohatý pocit bez zbytečné lepivosti.",
      faq: [
        { q: "Hodí se krém i na mastnou pleť?", a: "Krém je bohatý, proto je určen hlavně pro suchou a citlivou pleť. Pro lehčí variantu zvolte pleťový krém Nama Fiji." },
        { q: "Mohu jej používat pod make-up?", a: "Ano, doporučujeme jej nechat chvíli vstřebat před nanášením make-upu." },
      ],
    },
    sk: {
      name: "Výživný pleťový krém Nama Fiji",
      intro:
        "Výživný pleťový krém Nama Fiji je bohatý hydratačný krém pre suchú, citlivú a zrelú pleť. Jojobový, šípkový a avokádový olej spolu s kakaovým maslom dopĺňajú lipidy, ktoré suchej pleti chýbajú, a nechávajú ju hebkú a pružnú.",
      second:
        SK_BRAND + " Krém funguje ako večerná starostlivosť aj ako báza pred make-upom alebo ochranným krémom.",
      bullets: [
        "objem 50 g",
        "bohatá textúra pre suchú, citlivú a zrelú pleť",
        "aktívne zložky: extrakt nama, jojobový olej, šípkový olej, avokádový olej, kakaové maslo",
        "vegan, prírodné zloženie, bez syntetickej vône a parabénov",
        "netestované na zvieratách, schválené pre EÚ a Spojené kráľovstvo",
      ],
      forWhom: "Pre suchú, citlivú a zrelú pleť alebo pleť, ktorej chýbajú lipidy. Hodí sa aj na zimu.",
      actives: [
        { name: "Extrakt nama (morské hrozny)", text: "minerály z fidžijskej riasy podporujú dlhodobú hydratáciu." },
        { name: "Jojobový olej", text: "jemný rastlinný olej, ktorý sa podobá pleťovému mazu." },
        { name: "Šípkový olej", text: "zdroj mastných kyselín a vitamínov na vyživenie pleti." },
        { name: "Avokádový olej", text: "výživný olej, ktorý zjemňuje a zmäkčuje." },
        { name: "Kakaové maslo", text: "bohaté maslo, ktoré pomáha zadržať vlahu v pleti." },
      ],
      howToUse: [
        "Jemne vmasírujte do čistej tváre a dekoltu.",
        "Použite ako večernú starostlivosť alebo ráno pred podkladovou bázou či ochranným krémom.",
        "Pri suchej pleti naneste aj na krk.",
      ],
      expect: "Pleť je vyživená, hebká a pružná. Krém necháva príjemný, bohatý pocit bez zbytočnej lepkavosti.",
      faq: [
        { q: "Hodí sa krém aj na mastnú pleť?", a: "Krém je bohatý, preto je určený hlavne pre suchú a citlivú pleť. Pre ľahšiu variantu zvoľte pleťový krém Nama Fiji." },
        { q: "Môžem ho používať pod make-up?", a: "Áno, odporúčame ho nechať chvíľu vstrebať pred nanášaním make-upu." },
      ],
    },
  },
  {
    code: "1360",
    photos: ["face_mask_web2v1", "face_mask_webv1", "face_mask_web3"],
    cs: {
      name: "Pleťová maska Nama Fiji",
      intro:
        "Pleťová maska Nama Fiji je polotuhá maska s kaolinovým jílem, mandlovým olejem a bambuckým máslem. Kaolin šetrně čistí, zatímco mořské hrozny nama, růžová voda a vitamin E pleť hydratují a zjemňují.",
      second:
        CS_BRAND + " Maska patří do pravidelného rituálu péče, například dvakrát až třikrát týdně.",
      bullets: [
        "objem 50 g",
        "polotuhá textura s kaolinem, po zaschnutí se snadno smývá",
        "aktivní složky: extrakt nama, sladký mandlový olej, kaolin, bambucké máslo, růžová voda, vitamin E, glycerin",
        "vegan, přírodní složení, bez syntetické vůně a parabenů",
        "netestováno na zvířatech, schváleno pro EU a Spojené království",
      ],
      forWhom: "Pro všechny typy pleti, které potřebují jemné vyčištění a hydrataci zároveň.",
      actives: [
        { name: "Extrakt nama (mořské hrozny)", text: "minerály z fidžijské řasy podporují dlouhodobou hydrataci." },
        { name: "Kaolin", text: "jemný bílý jíl, který čistí pleť a pomáhá vstřebat přebytečný maz." },
        { name: "Sladký mandlový olej a bambucké máslo", text: "změkčují pleť a vyživují ji." },
        { name: "Růžová voda", text: "jemně zklidňuje a osvěžuje." },
        { name: "Vitamin E a glycerin", text: "antioxidant a hydratace pro pohodlnou pleť." },
      ],
      howToUse: [
        "Po očištění naneste štědrou vrstvu na pleť jednou za dva dny.",
        "Nechte působit 10–15 minut.",
        "Odstraňte čistou vlhkou žínkou nebo opláchněte vlažnou vodou.",
      ],
      expect: "Pleť je očištěná, jemná a hydratovaná, bez pocitu stažení.",
      faq: [
        { q: "Jak často masku používat?", a: "Výrobce doporučuje aplikaci každý druhý den po očištění pleti. Při citlivé pleti můžete začít méně často." },
        { q: "Maska vyschne úplně?", a: "Je polotuhá, proto nemusí zcela ztvrdnout. Před smytím ji nechte působit 10–15 minut." },
      ],
    },
    sk: {
      name: "Pleťová maska Nama Fiji",
      intro:
        "Pleťová maska Nama Fiji je poloquhá maska s kaolínovým ílom, mandľovým olejom a bambuckým maslom. Kaolín šetrne čistí, kým morské hrozny nama, ružová voda a vitamín E pleť hydratujú a zjemňujú.",
      second:
        SK_BRAND + " Maska patrí do pravidelného rituálu starostlivosti, napríklad dvakrát až trikrát týždenne.",
      bullets: [
        "objem 50 g",
        "polotuhá textúra s kaolínom, po zaschnutí sa ľahko zmýva",
        "aktívne zložky: extrakt nama, sladký mandľový olej, kaolín, bambucké maslo, ružová voda, vitamín E, glycerín",
        "vegan, prírodné zloženie, bez syntetickej vône a parabénov",
        "netestované na zvieratách, schválené pre EÚ a Spojené kráľovstvo",
      ],
      forWhom: "Pre všetky typy pleti, ktoré potrebujú jemné vyčistenie a hydratáciu zároveň.",
      actives: [
        { name: "Extrakt nama (morské hrozny)", text: "minerály z fidžijskej riasy podporujú dlhodobú hydratáciu." },
        { name: "Kaolín", text: "jemný biely íl, ktorý čistí pleť a pomáha vstrebať prebytočný maz." },
        { name: "Sladký mandľový olej a bambucké maslo", text: "zmäkčujú pleť a vyživujú ju." },
        { name: "Ružová voda", text: "jemne upokojuje a osviežuje." },
        { name: "Vitamín E a glycerín", text: "antioxidant a hydratácia pre pohodlnú pleť." },
      ],
      howToUse: [
        "Po očistení naneste štedrú vrstvu na pleť raz za dva dni.",
        "Nechajte pôsobiť 10–15 minút.",
        "Odstráňte čistou vlhkou žinkou alebo opláchnite vlažnou vodou.",
      ],
      expect: "Pleť je očistená, jemná a hydratovaná, bez pocitu stiahnutia.",
      faq: [
        { q: "Ako často masku používať?", a: "Výrobca odporúča aplikáciu každý druhý deň po očistení pleti. Pri citlivej pleti môžete začať menej často." },
        { q: "Maska vyschne úplne?", a: "Je polotuhá, preto nemusí celkom stvrdnúť. Pred zmytím ju nechajte pôsobiť 10–15 minút." },
      ],
    },
  },
  {
    code: "1354",
    photos: ["facial_scrub_web2v1", "facial_scrub_webv1", "facial_scrub_web3"],
    cs: {
      name: "Pleťový peeling Nama Fiji",
      intro:
        "Pleťový peeling Nama Fiji kombinuje kaolinový jíl, mořské hrozny nama a jemný prášek z kokosové skořápky. Odstraňuje odumřelé buňky z povrchu pleti a hydratující oleje ji při tom zjemňují.",
      second:
        CS_BRAND + " Peeling je určen pro pravidelnou exfoliaci celého obličeje, několikrát týdně.",
      bullets: [
        "objem 50 g",
        "jemná mechanická exfoliace s práškem z kokosové skořápky a kaolinem",
        "aktivní složky: extrakt nama, slunečnicový olej, vitamin E, sladký mandlový olej, makadamiový olej, prášek z kokosové skořápky, kaolin",
        "vegan, přírodní složení, bez syntetické vůně a parabenů",
        "netestováno na zvířatech, schváleno pro EU a Spojené království",
      ],
      forWhom: "Pro všechny typy pleti, které potřebují hladší povrch a rozjasnění. Při citlivé pleti používejte méně často.",
      actives: [
        { name: "Extrakt nama (mořské hrozny)", text: "minerály z fidžijské řasy podporují hydrataci i po peelingu." },
        { name: "Prášek z kokosové skořápky", text: "jemná zrnka, která odstraňují odumřelé buňky z povrchu pleti." },
        { name: "Kaolin", text: "jíl, který čistí a pomáhá vstřebat přebytečný maz." },
        { name: "Mandlový, makadamiový a slunečnicový olej", text: "změkčují a vyživují pleť během exfoliace." },
        { name: "Vitamin E", text: "antioxidant pro pohodlnou pleť." },
      ],
      howToUse: [
        "Naneste štědrou vrstvu na suchou pleť po očištění.",
        "Jemně masírujte lehkými krouživými pohyby směrem vzhůru.",
        "Důkladně opláchněte vlažnou vodou, aplikujte několikrát týdně.",
      ],
      expect: "Pleť je hladší, měkčí a svěží. Po peelingu navažte sérem a krémem.",
      faq: [
        { q: "Jak často peeling používat?", a: "Výrobce doporučuje několikrát týdně. Při citlivé pleti začněte jednou týdně." },
        { q: "Hodí se na citlivou pleť?", a: "Peeling obsahuje jemné částice, proto jej doporučujeme zkusit na malé ploše a používat opatrně." },
      ],
    },
    sk: {
      name: "Pleťový peeling Nama Fiji",
      intro:
        "Pleťový peeling Nama Fiji kombinuje kaolínový íl, morské hrozny nama a jemný prášok z kokosovej škrupiny. Odstraňuje odumreté bunky z povrchu pleti a hydratačné oleje ju pritom zjemňujú.",
      second:
        SK_BRAND + " Peeling je určený na pravidelnú exfoliáciu celej tváre, niekoľkokrát týždenne.",
      bullets: [
        "objem 50 g",
        "jemná mechanická exfoliácia s práškom z kokosovej škrupiny a kaolínom",
        "aktívne zložky: extrakt nama, slnečnicový olej, vitamín E, sladký mandľový olej, makadamiový olej, prášok z kokosovej škrupiny, kaolín",
        "vegan, prírodné zloženie, bez syntetickej vône a parabénov",
        "netestované na zvieratách, schválené pre EÚ a Spojené kráľovstvo",
      ],
      forWhom: "Pre všetky typy pleti, ktoré potrebujú hladší povrch a rozjasnenie. Pri citlivej pleti používajte menej často.",
      actives: [
        { name: "Extrakt nama (morské hrozny)", text: "minerály z fidžijskej riasy podporujú hydratáciu aj po peelingu." },
        { name: "Prášok z kokosovej škrupiny", text: "jemné zrnká, ktoré odstraňujú odumreté bunky z povrchu pleti." },
        { name: "Kaolín", text: "íl, ktorý čistí a pomáha vstrebať prebytočný maz." },
        { name: "Mandľový, makadamiový a slnečnicový olej", text: "zmäkčujú a vyživujú pleť počas exfoliácie." },
        { name: "Vitamín E", text: "antioxidant pre pohodlnú pleť." },
      ],
      howToUse: [
        "Naneste štedrú vrstvu na suchú pleť po očistení.",
        "Jemne masírujte ľahkými krúživými pohybmi smerom nahor.",
        "Dôkladne opláchnite vlažnou vodou, aplikujte niekoľkokrát týždenne.",
      ],
      expect: "Pleť je hladšia, mäkšia a svieža. Po peelingu nadviažte sérom a krémom.",
      faq: [
        { q: "Ako často peeling používať?", a: "Výrobca odporúča niekoľkokrát týždenne. Pri citlivej pleti začnite raz týždenne." },
        { q: "Hodí sa na citlivú pleť?", a: "Peeling obsahuje jemné častice, preto ho odporúčame vyskúšať na malej ploche a používať opatrne." },
      ],
    },
  },
  {
    code: "9354836000071",
    isNew: true,
    ean: "9354836000071",
    price: 650,
    photos: ["cleansing_milk_120_web2v2", "cleansing_milk_120_webv1", "cleansing_milk_web3_120"],
    ingredients:
      "AQUA, CITRUS SPECIES PEEL OIL EXPRESSED, HYDROGENATED VEGETABLE GLYCERIDES, CETEARYL ALCOHOL, GLYCERIN, CAPRYLIC/CAPRIC TRIGLYCERIDE, DECYL GLUCOSIDE, STEARIC ACID, CAULERPA RACEMOSA EXTRACT, COCAMIDOPROPYL BETAINE, SODIUM LAUROAMPHOACETATE, CAPRYLYL GLYCOL, CAPRYLYL/CAPRYL GLUCOSIDE, SODIUM CHLORIDE, CETEARETH-20, CARBOMER, PHENOXYETHANOL, LACTIC ACID, SODIUM HYDROXIDE, CITRAL",
    cs: {
      name: "Čisticí mléko Nama Fiji",
      intro:
        "Čisticí mléko Nama Fiji je jemné odličovací a čisticí mléko pro suchou, citlivou a snadno podrážděnou pleť. Přírodní emulze rozpouští make-up, opalovací krém i přebytečný maz a neničí přitom pleťovou bariéru.",
      second:
        CS_BRAND + " Mléko se hodí jako samostatné odličování, jako první krok dvoufázového čištění nebo jako šetrné čištění před péčí.",
      bullets: [
        "objem 120 ml",
        "jemná mléčná textura pro suchou a citlivou pleť",
        "aktivní složky: extrakt nama, glycerin, olej z citronové kůry",
        "vegan, přírodní složení, bez syntetické vůně a parabenů",
        "netestováno na zvířatech, schváleno pro EU a Spojené království",
      ],
      forWhom: "Pro suchou, citlivou a snadno podrážděnou pleť, ale i pro zralou nebo náročnou pleť, která potřebuje šetrné čištění.",
      actives: [
        { name: "Extrakt nama (mořské hrozny)", text: "minerály z fidžijské řasy podporují hydrataci, aby pleť po čištění nebyla vysušená." },
        { name: "Glycerin", text: "hydratační složka, která pomáhá udržet vláhu v pleti." },
        { name: "Olej z citronové kůry", text: "dodává přípravku svěží vůni." },
      ],
      howToUse: [
        "Namočte měkký bavlněný tampon do mléka.",
        "Jemně přetřete obličej a dekolt, abyste odstranili nečistoty a make-up.",
        "Při potřebě opláchněte vlažnou vodou a pokračujte sérem a krémem.",
      ],
      expect: "Pleť je čistá, měkká a pohodlná, bez pocitu stažení nebo mastného filmu.",
      faq: [
        { q: "Odstraní mléko i voděodolný make-up?", a: "Mléko rozpouští běžný make-up a opalovací krém. Voděodolné řasenky může být lepší odstranit speciálním odličovačem očí." },
        { q: "Musím po mléku ještě čistit pleť?", a: "Není to nutné, večer ale doporučujeme dvoufázové čištění, například čisticím gelem Nama Fiji." },
      ],
    },
    sk: {
      name: "Čistiace mlieko Nama Fiji",
      intro:
        "Čistiace mlieko Nama Fiji je jemné odličovacie a čistiace mlieko pre suchú, citlivú a ľahko podráždenú pleť. Prírodná emulzia rozpúšťa make-up, opaľovací krém aj prebytočný maz a nenarúša pritom pleťovú bariéru.",
      second:
        SK_BRAND + " Mlieko sa hodí ako samostatné odličovanie, ako prvý krok dvojfázového čistenia alebo ako šetrné čistenie pred starostlivosťou.",
      bullets: [
        "objem 120 ml",
        "jemná mliečna textúra pre suchú a citlivú pleť",
        "aktívne zložky: extrakt nama, glycerín, olej z citrónovej kôry",
        "vegan, prírodné zloženie, bez syntetickej vône a parabénov",
        "netestované na zvieratách, schválené pre EÚ a Spojené kráľovstvo",
      ],
      forWhom: "Pre suchú, citlivú a ľahko podráždenú pleť, ale aj pre zrelú alebo náročnú pleť, ktorá potrebuje šetrné čistenie.",
      actives: [
        { name: "Extrakt nama (morské hrozny)", text: "minerály z fidžijskej riasy podporujú hydratáciu, aby pleť po čistení nebola vysušená." },
        { name: "Glycerín", text: "hydratačná zložka, ktorá pomáha udržať vlahu v pleti." },
        { name: "Olej z citrónovej kôry", text: "dodáva prípravku sviežu vôňu." },
      ],
      howToUse: [
        "Namočte mäkký bavlnený tampón do mlieka.",
        "Jemne pretrite tvár a dekolt, aby ste odstránili nečistoty a make-up.",
        "Pri potrebe opláchnite vlažnou vodou a pokračujte sérom a krémom.",
      ],
      expect: "Pleť je čistá, mäkká a pohodlná, bez pocitu stiahnutia alebo mastného filmu.",
      faq: [
        { q: "Odstráni mlieko aj vodeodolný make-up?", a: "Mlieko rozpúšťa bežný make-up a opaľovací krém. Vodeodolné riasenky môže byť lepšie odstrániť špeciálnym odličovačom očí." },
        { q: "Musím po mlieku ešte čistiť pleť?", a: "Nie je to nutné, večer však odporúčame dvojfázové čistenie, napríklad čistiacim gélom Nama Fiji." },
      ],
    },
  },
];

const html = (l: Lang) =>
  `<p>${l.intro}</p><p>${l.second}</p><ul>${l.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`;
const detailsOf = (l: Lang) => ({
  forWhom: l.forWhom,
  ingredients: l.actives,
  howToUse: l.howToUse,
  expect: l.expect,
  faq: l.faq,
});

async function render(buf: Buffer): Promise<Buffer> {
  return sharp(buf)
    .flatten({ background: "#ffffff" })
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function files() {
  await mkdir(OUT_DIR, { recursive: true });
  const map: Record<string, string[]> = {};
  for (const it of ITEMS) {
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(it.code));
    await mkdir(dir, { recursive: true });
    map[it.code] = [];
    for (let i = 0; i < it.photos.length; i++) {
      const src = await readFile(path.join(PHOTO_DIR, `${it.photos[i]}.png`));
      const name = `${randomBytes(6).toString("hex")}-nf${i}.jpg`;
      await writeFile(path.join(dir, name), await render(src));
      map[it.code].push(`/uploads/products/${encodeURIComponent(it.code)}/${name}`);
    }
    console.log(`  ${it.code}: ${map[it.code].length} files`);
  }
  await writeFile(MAP_FILE, JSON.stringify(map, null, 1));
}

async function db() {
  const map: Record<string, string[]> = JSON.parse(await readFile(MAP_FILE, "utf8"));
  const before: Record<string, unknown> = {};
  for (const it of ITEMS) {
    if (it.isNew) continue;
    const p = await prisma.product.findUnique({ where: { code: it.code }, include: { images: { orderBy: { sortOrder: "asc" } } } });
    if (!p) throw new Error(`missing product ${it.code}`);
    before[it.code] = {
      description: p.description,
      descriptionSk: p.descriptionSk,
      details: p.details,
      ingredients: p.ingredients,
      isVegan: p.isVegan,
      isCrueltyFree: p.isCrueltyFree,
      images: p.images.map((i) => ({ id: i.id, url: i.url, sortOrder: i.sortOrder })),
    };
  }
  await writeFile(BEFORE_FILE, JSON.stringify(before, null, 1));

  for (const it of ITEMS) {
    const urls = map[it.code];
    if (!urls?.length) throw new Error(`no files for ${it.code} — run --files first`);
    const data = {
      description: html(it.cs),
      descriptionSk: html(it.sk),
      nameSk: it.sk.name,
      details: { cs: detailsOf(it.cs), sk: detailsOf(it.sk) },
      isVegan: true,
      isCrueltyFree: true,
      ...(it.ingredients ? { ingredients: it.ingredients } : {}),
    };
    let productId: string;
    if (it.isNew) {
      const brand = await prisma.brand.findFirst({ where: { name: "Nama Fiji" } });
      const cat = await prisma.category.findFirst({ where: { fullSlug: "kosmetika/plet/cisteni-pleti" } });
      if (!brand || !cat) throw new Error("brand/category not found");
      const exists = await prisma.product.findUnique({ where: { code: it.code } });
      if (exists) throw new Error("new product already exists — use --revert first");
      const created = await prisma.product.create({
        data: {
          code: it.code,
          name: it.cs.name,
          slug: slugify(`${it.cs.name} 120 ml`),
          ean: it.ean,
          brandId: brand.id,
          price: it.price!,
          purchasePrice: 0,
          vatRate: 21,
          stock: 14,
          ownStock: 14,
          visible: true,
          productType: "cisteni",
          ...data,
          categories: { create: [{ categoryId: cat.id }] },
        },
      });
      productId = created.id;
      for (let i = 0; i < urls.length; i++) await prisma.productImage.create({ data: { productId, url: urls[i], sortOrder: i } });
    } else {
      const p = await prisma.product.findUnique({ where: { code: it.code }, include: { images: { orderBy: { sortOrder: "asc" } } } });
      productId = p!.id;
      await prisma.product.update({ where: { id: productId }, data });
      // replace the old low-quality photos with the brand's set (same rows are reused for the first ones)
      const keep = p!.images.slice(0, urls.length);
      for (let i = 0; i < urls.length; i++) {
        if (keep[i]) await prisma.productImage.update({ where: { id: keep[i].id }, data: { url: urls[i], sortOrder: i } });
        else await prisma.productImage.create({ data: { productId, url: urls[i], sortOrder: i } });
      }
      const extra = p!.images.slice(urls.length).map((i) => i.id);
      if (extra.length) await prisma.productImage.deleteMany({ where: { id: { in: extra } } });
    }
    console.log(`  ${it.code} ${it.cs.name}: ${urls.length} photos, texts written`);
  }
  await logAdminActivity({
    action: "product.nama_fiji_upgrade",
    entityType: "Product",
    detail: "Nama Fiji: brand photos (3 each), CS+SK descriptions and details, vegan/cruelty-free flags, new Čisticí mléko (EAN 9354836000071, ownStock 14)",
  });
}

async function revert() {
  const before: Record<string, any> = JSON.parse(await readFile(BEFORE_FILE, "utf8"));
  for (const [code, b] of Object.entries(before)) {
    const p = await prisma.product.findUnique({ where: { code }, select: { id: true } });
    if (!p) continue;
    await prisma.product.update({
      where: { id: p.id },
      data: { description: b.description, descriptionSk: b.descriptionSk, details: b.details ?? undefined, ingredients: b.ingredients, isVegan: b.isVegan, isCrueltyFree: b.isCrueltyFree },
    });
    await prisma.productImage.deleteMany({ where: { productId: p.id, id: { notIn: b.images.map((i: { id: string }) => i.id) } } });
    for (const i of b.images) await prisma.productImage.upsert({ where: { id: i.id }, update: { url: i.url, sortOrder: i.sortOrder }, create: { id: i.id, productId: p.id, url: i.url, sortOrder: i.sortOrder } });
  }
  const created = await prisma.product.findUnique({ where: { code: "9354836000071" }, select: { id: true } });
  if (created) {
    await prisma.productImage.deleteMany({ where: { productId: created.id } });
    await prisma.productCategory.deleteMany({ where: { productId: created.id } });
    await prisma.product.delete({ where: { id: created.id } });
  }
  console.log("Reverted.");
}

const mode = process.argv.includes("--files") ? files : process.argv.includes("--db") ? db : process.argv.includes("--revert") ? revert : null;
if (!mode) {
  console.error("Usage: --files | --db | --revert");
  process.exit(1);
}
mode()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
