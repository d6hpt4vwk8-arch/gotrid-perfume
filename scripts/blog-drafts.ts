// Creates or updates the first magazine articles as DRAFTS (published=false) —
// they stay invisible on the site and in the sitemap until switched on in the
// admin (Magazín → Publikovat). Content uses the light markers from
// src/lib/blog-markdown.ts. Prices in the text are rounded ("cca") and should
// be re-checked on the day of publishing.
//   npx tsx scripts/blog-drafts.ts
import { prisma } from "../src/lib/prisma";
import { blogTextToHtml } from "../src/lib/blog-markdown";

const P = (slug: string) => `/produkt/${slug}`;

const articles = [
  {
    slug: "arabske-parfemy-pruvodce-vunemi",
    title: "Arabské parfémy: průvodce vůněmi a jak je nosit",
    category: "parfemy" as const,
    excerpt:
      "Sladké, ovocné, oudové nebo pižmové? Přehled hlavních vůňových světů arabských parfémů, konkrétní tipy od Lattafy, Armafu nebo Swiss Arabian a rady, kolik střiků a kdy je nosit.",
    content: `Arabské parfémy mají mezi vůněmi zvláštní místo. Bývají sytější, déle drží na kůži a často stojí kolem pěti set korun za 100 ml, takže si můžete dovolit zkoušet. Zároveň je jejich výběr méně intuitivní než u klasických značek: v nabídce najdete všechno od lízátkově sladkých vůní po temný oud, a podle názvu to poznáte jen zřídka. Tenhle průvodce vás provede čtyřmi hlavními vůňovými světy, ukáže u každého pár tipů z našeho sortimentu a na konci poradí, jak parfém nosit, aby voněl dobře a nepřehlušil místnost.

## Gurmánské vůně: dezert ve flakonu

Sladké, krémové a „k snědku“. Hodí se na podzim a v zimě, na večer nebo když chcete vonět útulně. Pokud nikdy nenosíte sladké vůně, začněte opatrně: tyhle jsou výrazné.

- [Lattafa Eclaire Pistache](${P("lattafa-eclaire-pistache-edp-u-100ml-spv-0239469")}) (cca 510 Kč): pražená pistácie, šlehaná smetana, kokos, kakao a mléčná vanilka. Unisex a hladká.
- [Armaf Odyssey Dubai Chocolat](${P("armaf-odyssey-dubai-chocolat-edp-u-100ml-spv-0230610")}) (cca 500 Kč): krémový, ořechový čokoládový dezert. Hravá a hodně sladká.
- [Paris Corner Khair Pistachio](${P("paris-corner-khair-pistachio-edp-u-100ml-spv-0227922")}) (cca 345 Kč): pistáciový krém zjemněný konvalinkami a pivoňkami, takže je trochu lehčí.

## Ovocné a květinové vůně: lehčí volba na každý den

Svěžejší, méně náročné a na kůži přátelské. Dobře fungují na jaro a léto a pro každého, kdo má raději vůni, která „nekřičí“.

- [Lattafa Yara Candy](${P("lattafa-yara-candy-edp-w-100ml-spv-0229527")}) (cca 450 Kč): zelená mandarinka, černý rybíz, jahody, gardénie a vanilka. Dámská, cukrová a hravá.
- [Armaf Island Breeze](${P("armaf-island-breeze-edp-u-100ml-spv-0245874")}) (cca 580 Kč): broskev a lesní plody, uprostřed růže, dole bílé pižmo. Letní a bezstarostná.
- [Lattafa Victoria](${P("lattafa-victoria-edp-u-100ml-spv-0233243")}) (cca 530 Kč): začíná jako citronový koláč s pěnou, pak jemné květy a vanilka. Příjemná i za chladnějších dnů.

## Oud a dřevité vůně: to „arabské“ v pravém slova smyslu

Oud je pryskyřičné dřevo s hlubokou, trochu kouřovou vůní. Tady začněte s vůní, která oud kombinuje s něčím, co znáte (růže, koření), ne s čistým oudem. Nosí se spíš večer, na podzim a v zimě.

- [Lattafa Safwaan L'Autre Oud](${P("lattafa-safwaan-l-autre-oud-edp-u-100ml-spv-0222910")}) (cca 440 Kč): odvážný oud zjemněný čerstvou růží, s šafránem a ambrou.
- [Lattafa Bade'e Al Oud Oud For Glory](${P("lattafa-bade-e-al-oud-oud-for-glory-eau-de-parfum-100-ml-unisex-pwh-132553")}) (cca 515 Kč): šafrán, levandule, muškátový oříšek a oud s pačuli. Hluboká a kořeněná.
- [Swiss Arabian Shaghaf Oud Aswad](${P("swiss-arabian-shaghaf-oud-aswad-edp-u-75ml-spv-0228857")}) (75 ml, cca 600 Kč): oud s růží, jasmínem a zemitým pačuli.

## Pižmo a koření: čisté a hřejivé

Pižmo působí jemně a „po čistotě“, koření zahřeje a hodí se do chladných měsíců.

- [Paris Corner Musk Collection Tranquil Night](${P("paris-corner-musk-collection-tranquil-night-edp-u-100ml-spv-0231970")}) (cca 465 Kč): citrusy a ovoce na pižmovém základu, vhodné na každý den.
- [Maison Asrar Masterpiece](${P("maison-asrar-masterpiece-edp-u-100ml-spv-0237098")}) (cca 500 Kč): jablko, kardamom, skořice a vanilka. Svěže kořeněná.
- [Gulf Orchid Sweet Heaven Tobacco](${P("gulf-orchid-sweet-heaven-tobacco-edp-u-100ml-spv-0239749")}) (cca 580 Kč): koření, mandarinka a tabák pro ty, kdo chtějí odvážnou klasiku.

## Jak arabský parfém nosit

- **Méně je víc.** Arabské parfémy bývají koncentrované. Začněte dvěma až třemi střiky a podle potřeby přidejte.
- **Na kůži, ne na oblečení.** Na zápěstí, na krk nebo za ucho. Parfém si na kůži „rozvoní“ a pak lépe drží.
- **Neroztírejte.** Tření zápěstí o sebe vůni rychleji zkrátí.
- **Počítejte s ročním obdobím.** Gurmánské a oudové vůně sednou na podzim a v zimě, ovocné a svěží na jaro a léto.
- **Stejná vůně voní na každém jinak.** Proto dávejte vůním pár hodin, než si o nich uděláte názor.

## Jak začít, když nevíte

Nejmenší riziko je vzít si sadu malých flakonků. Například [Lattafa Yara Collection SET](${P("lattafa-yara-collection-set-w-edp-4x5ml-spv-0248775")}) obsahuje čtyři vůně po 5 ml (cca 390 Kč) a ukáže vám, co vám sedí. Pokud nechcete zkoušet, napište nám, co už voníte nebo jaká vůně se vám líbí, a doporučíme konkrétní parfém z nabídky. Celý sortiment najdete v kategorii [Arabské parfémy](/kategorie/parfemy/arabske-parfemy).`,
  },
  {
    slug: "korejska-pece-o-plet-v-5-krocich",
    title: "Korejská péče o pleť v 5 krocích: co opravdu potřebujete",
    category: "kosmetika" as const,
    excerpt:
      "Desetikroková korejská rutina nemusí znamenat deset produktů. Ukážeme vám pět kroků, které dávají smysl, a u každého konkrétní tipy z našeho sortimentu. Celá základní sada vyjde kolem 1 300 Kč.",
    content: `O korejské péči o pleť se často mluví jako o desetikrokové rutině a lidé se leknou, že si musí koupit deset produktů. Není to pravda. Smyslem není nanést co nejvíc věcí, ale vrstvit je od nejlehčích po nejbohatší a jemně pleť čistit. Základ se vejde do pěti kroků a přesně takovou rutinu vám tu sestavíme.

## Čištění: odličte a pak vyčistěte

Korejci čistí pleť dvakrát: nejdřív olejem nebo balzámem rozpustí make-up, SPF a mastnotu, potom jemnou pěnou smyjí zbytky. Večer jsou oba kroky ideální, ráno obvykle stačí pěna.

- [VVBETTER Gentle Deep Cleansing Oil](${P("vvbetter-gentle-deep-cleansing-oil-200-ml-gvs-5904305")}) (cca 330 Kč): jemný odličovací olej s centellou a niacinamidem.
- [Dr. Althea Pore Refresh Grinding Cleansing Balm](${P("dr-althea-pore-refresh-grinding-cleansing-balm-gvs-255620")}) (cca 380 Kč): čisticí balzám s zeleným čajem.
- [VVBETTER Soothing Cleansing Foam](${P("vvbetter-soothing-cleansing-foam-120-ml-gvs-1482509")}) (cca 180 Kč): jemná pěna na druhý krok.

## Tonikum nebo esence: příprava pleti

Tonikum pleť zklidní, nasákne ji vodou a připraví na další krok. Esence je o něco bohatší. Aplikujte ji dlaněmi, nejlépe jemným poklepáním.

- [Dr. Althea Natural Radiance Essence](${P("dr-althea-natural-radiance-essence-gvs-253480")}) (cca 260 Kč): rozjasňující esence.
- [Dr. Althea Anastatica Skin Conditioning Toner](${P("dr-althea-anastatica-skin-conditioning-toner-250ml-spv-0247766")}) (250 ml, cca 300 Kč): tonikum na každý den.

## Sérum: účinná látka na míru

Tady si vyberete, co chcete řešit. Hydratace? Rozjasnění? Retinol je silnější a patří spíš na večer.

- [Dr. Althea Aqua Marine Deep Serum](${P("dr-althea-aqua-marine-deep-serum-gvs-256191")}) (cca 310 Kč): hydratační sérum s kyselinou hyaluronovou.
- [Dr. Althea Vitamin C Boosting Serum](${P("dr-althea-vitamin-c-boosting-serum-gvs-255385")}) (cca 430 Kč): rozjasňující sérum s vitamínem C a niacinamidem.

## Krém: uzamkněte vlhkost

Krém uzavře předchozí vrstvy a pleť ochrání. Na mastnější pleť stačí lehký gelový krém, na suchou bohatší.

- [Dr. Althea Aqua Marine Watery Cream](${P("dr-althea-aqua-marine-watery-cream-50ml-spv-0243469")}) (50 ml, cca 250 Kč): lehký hydratační krém.
- [VVBETTER Teca Lifting Moisture Cream](${P("vvbetter-teca-lifting-moisture-cream-50-ml-gvs-2554853")}) (cca 530 Kč): bohatší zpevňující krém s niacinamidem, hyaluronem a peptidy.

## SPF: krok, který nesmíte vynechat

Opalovací krém se používá každý den, ne jen v létě. Kosmetika v péči o pleť nic nezmůže, pokud pleť ráno nechráníte.

- [Dr. Althea Green Tea Fresh Sunscreen SPF50+](${P("dr-althea-green-tea-fresh-sunscreen-spf50-pa-45ml-spv-0247767")}) (cca 300 Kč): lehký krém se zeleným čajem.
- [VVBETTER Daily Airfit Sunscreen SPF50+](${P("vvbetter-daily-airfit-sunscreen-spf-50-gvs-5903568")}) (cca 440 Kč): denní opalovací krém na obličej.

## Kolik to stojí

Základní sada (pěna, esence, sérum, krém a SPF) vyjde u nás kolem 1 300 Kč. Přidáte-li večer odličovací olej, je to něco přes 1 600 Kč. Hodně levně můžete rutinu doplnit **plátýnkovými maskami** (u nás od cca 70 Kč za kus) nebo jednou týdně **exfoliační tonikum**, například [Cosrx AHA7 Whitehead Power Liquid](${P("cosrx-aha7-whitehead-power-liquid-100ml-spv-0226436")}) (cca 340 Kč).

## Pár pravidel, aby rutina fungovala

- **Nezačínejte všechno najednou.** Nové produkty zavádějte po jednom, s odstupem několika dní.
- **Aplikujte od nejlehčího po nejbohatší.** Tonikum, sérum, krém a nakonec SPF.
- **Ráno ne všechno.** Večer stačí čištění, sérum a krém, ráno je důležité SPF.
- **Zkoušejte na malém místě.** Zejména u kyselin a retinolu.
- **Buďte trpěliví.** Změny pleti trvají týdny, ne dny.

Pokud nevíte, co vybrat podle svého typu pleti, napište nám a poradíme. Celý výběr najdete v kategorii [Korejská kosmetika](/kategorie/kosmetika/korejska-kosmetika).`,
  },
  {
    slug: "podzimni-vune-do-bytu",
    title: "Podzimní vůně do bytu: dýně, skořice, vanilka a cedr",
    category: "obecne" as const,
    excerpt:
      "Jak provonět byt na podzim: osvěžovač do zásuvky, difuzér s tyčinkami, svíčka, nebo sprej? Přehled podzimních vůní (dýně, jablko se skořicí, vanilka, cedr) a konkrétní tipy z našeho sortimentu od 25 Kč.",
    content: `Podzim voní po dýni, skořici, jablkách, vanilce a dřevě. Dobrá zpráva je, že takovou vůni do bytu dostanete už za pár desítek korun. Špatná: formátů je několik a každý se hodí na něco jiného. Tady je přehled, co vybrat podle toho, jak vůni chcete používat.

## Který formát se hodí k čemu

- **Elektrický osvěžovač (náplň do zásuvky):** vůně se uvolňuje rovnoměrně a týdny. Hodí se do obývacího pokoje nebo předsíně. Potřebujete přístroj, náplně pak vyměňujete.
- **Aroma difuzér s tyčinkami:** bez elektřiny a bez plamene, stačí postavit. Vůně je jemnější a stálá.
- **Svíčka:** vytváří atmosféru, vůni dá hlavně při hoření. Nikdy ji nenechávejte hořet bez dozoru.
- **Sprej:** rychlé osvěžení po vaření nebo vyvětrání. Vůně vydrží krátce, ale stojí kolem 30 Kč.

## Dýně a podzimní koření

Nejtypičtější vůně podzimu. Vyhovují těm, kdo mají rádi teplou, mírně sladkou atmosféru.

- [Air Wick náplň dýně a podzimní pepř](${P("air-wick-nahradni-napln-dyne-a-podzimni-pepr-19ml-tde-556418")}) (19 ml, cca 97 Kč): náplň do elektrického přístroje Air Wick. Patří k našim nejprodávanějším podzimním vůním.
- [Bartek Pumpkin Season](${P("bartek-svicky-pumpkin-season-115g-tde-401151")}) (svíčka 115 g, cca 70 Kč): malá dýňová svíčka na drobný dárek nebo na stůl.
- [Yankee Candle Pumpkin Cinnamon Swirl](${P("yankee-candle-pumpkin-cinnamon-swirl-signature-candle-368g-spv-0235866")}) (368 g, cca 505 Kč): vanilka, hnědý cukr, pražené ořechy a hřejivé koření.

## Jablko se skořicí

Vůně pečeného jablka, která v bytě vždy pomůže.

- [Air Breeze náplň jablko a skořice](${P("air-breeze-nahradni-napln-250ml-aapple-cinnamon-tde-379120")}) (250 ml, cca 37 Kč): nejlevnější způsob, jak podzimní vůni vyzkoušet.
- [Bispol difuzér apple cinnamon](${P("bispol-diffuser-apple-cinnamon-45ml-tde-352034")}) (45 ml, cca 62 Kč): difuzér s tyčinkami do menší místnosti.
- [Fresh Air osvěžovač apple & cinnamon](${P("fresh-air-osvezovac-apple-cinnamon-300ml-tde-355616")}) (300 ml, cca 28 Kč): sprej na rychlé osvěžení.
- [Yankee Candle Sparkling Cinnamon](${P("yankee-candle-sparkling-cinnamon-signature-svicka-stredni-368-g-spv-0221049")}) (368 g, cca 505 Kč): svíčka se skořicí a hřebíčkem.

## Vanilka a dřevo

Teplejší a klidnější volby, které se hodí i mimo podzim.

- [Air Wick náplň vanilka a santalové dřevo](${P("air-wick-freshmatic-napln-vanilka-a-santalove-drevo-250ml-tde-405189")}) (250 ml, cca 86 Kč): vanilka s dřevitým základem.
- [Air Wick náplň eukalyptus a cedrové dřevo](${P("air-wick-nahradni-napln-eukalyptus-a-cedrove-drevo-19ml-tde-556419")}) (19 ml, cca 80 Kč): svěžejší, s cedrem, pro ty, komu je sladké málo.
- [WoodWick Vanilla Bean](${P("woodwick-vanilla-bean-scented-candle-with-wooden-wick-453-6-g-spv-ww0478")}) (svíčka s dřevěným knotem, cca 630 Kč): vanilka a praskání dřevěného knotu.

## Tipy, aby vůně dobře fungovala

- **Neumisťujte vůni do průvanu a těsně k oknu.** Rychle by zmizela.
- **Jedna vůně v jedné místnosti.** Míchání několika vůní působí těžce.
- **Větrejte.** I nejlepší vůně potřebuje čerstvý vzduch, jinak se po pár dnech „okouká“.
- **Dárek pro hosty:** malá svíčka nebo difuzér do šedesáti korun je milý dárek k pozvání.

Celý výběr najdete v kategoriích [Osvěžovače vzduchu](/kategorie/domacnost/osvezovace-vzduchu), [Aroma difuzéry](/kategorie/aroma-difuzery) a [Vonné svíčky](/kategorie/vonne-svicky).`,
  },
];

(async () => {
  for (const a of articles) {
    const data = { title: a.title, excerpt: a.excerpt, category: a.category, content: a.content, contentHtml: blogTextToHtml(a.content) };
    const existing = await prisma.blogPost.findUnique({ where: { slug: a.slug } });
    if (existing) {
      await prisma.blogPost.update({ where: { slug: a.slug }, data });
      console.log("updated draft", a.slug, a.content.length, "chars");
    } else {
      await prisma.blogPost.create({ data: { ...data, slug: a.slug, published: false } });
      console.log("created draft", a.slug, a.content.length, "chars");
    }
  }
  await prisma.$disconnect();
})();
