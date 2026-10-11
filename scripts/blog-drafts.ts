// Creates or updates the first magazine articles as DRAFTS (published=false) —
// they stay invisible on the site and in the sitemap until switched on in the
// admin (Magazín → Publikovat). Content uses the light markers from
// src/lib/blog-markdown.ts; [[produkt: slug | note]] lines render as live
// product cards (price from the DB), so no prices are typed into the text.
//   npx tsx scripts/blog-drafts.ts
import { prisma } from "../src/lib/prisma";
import { blogTextToHtml } from "../src/lib/blog-markdown";

const articles = [
  {
    slug: "arabske-parfemy-pruvodce-vunemi",
    title: "Arabské parfémy: průvodce vůněmi a jak je nosit",
    category: "parfemy" as const,
    excerpt:
      "Sladké, ovocné, oudové nebo pižmové? Přehled hlavních vůňových světů arabských parfémů, konkrétní tipy od Lattafy, Armafu nebo Swiss Arabian a rady, kolik střiků a kdy je nosit.",
    content: `Arabské parfémy jsou sytější, drží dlouho a 100 ml stojí kolem 500 Kč. Stačí vědět, který vůňový svět vám sedí.

> **Rychlý přehled**
>
> - **Gurmánské:** sladké a krémové, na podzim a v zimě
> - **Ovocné a květinové:** lehčí, na každý den a na jaro
> - **Oud:** dřevité a kouřové, na večer
> - **Pižmo a koření:** čisté a hřejivé

## Gurmánské: dezert ve flakonu

Sladké a krémové. Na večer, když chcete vonět útulně.

[[produkt: lattafa-eclaire-pistache-edp-u-100ml-spv-0239469 | Pistácie, smetana, kokos a vanilka]]
[[produkt: armaf-odyssey-dubai-chocolat-edp-u-100ml-spv-0230610 | Krémová čokoláda s ořechy]]
[[produkt: paris-corner-khair-pistachio-edp-u-100ml-spv-0227922 | Pistáciový krém, lehčí díky květům]]

## Ovocné a květinové: lehčí volba na každý den

Svěží a na kůži přátelské. Nekřičí.

[[produkt: lattafa-yara-candy-edp-w-100ml-spv-0229527 | Mandarinka, jahody, vanilka]]
[[produkt: armaf-island-breeze-edp-u-100ml-spv-0245874 | Broskev, růže, bílé pižmo]]
[[produkt: lattafa-victoria-edp-u-100ml-spv-0233243 | Citronový koláč a jemné květy]]

## Oud a dřevité: to pravé arabské

Oud je pryskyřičné dřevo s kouřovou vůní. Začněte vůní, kde je spojený s růží nebo kořením.

[[produkt: lattafa-safwaan-l-autre-oud-edp-u-100ml-spv-0222910 | Oud zjemněný růží a šafránem]]
[[produkt: lattafa-bade-e-al-oud-oud-for-glory-eau-de-parfum-100-ml-unisex-pwh-132553 | Šafrán, levandule a hluboký oud]]
[[produkt: swiss-arabian-shaghaf-oud-aswad-edp-u-75ml-spv-0228857 | Oud s jasmínem a pačuli (75 ml)]]

## Pižmo a koření: čisté a hřejivé

[[produkt: paris-corner-musk-collection-tranquil-night-edp-u-100ml-spv-0231970 | Citrusy na pižmu, na každý den]]
[[produkt: maison-asrar-masterpiece-edp-u-100ml-spv-0237098 | Jablko, kardamom a skořice]]
[[produkt: gulf-orchid-sweet-heaven-tobacco-edp-u-100ml-spv-0239749 | Koření a tabák pro odvážné]]

## Jak arabský parfém nosit

- **2–3 střiky stačí.** Vůně bývají koncentrované.
- **Na kůži, ne na oblečení.** Zápěstí, krk, za ucho.
- **Neroztírejte.** Vůně pak rychleji zmizí.
- **Dejte jí pár hodin.** Na každém voní trochu jinak.

## Nevíte, kde začít?

Vezměte sadu čtyř malých flakonků a uvidíte, co vám sedí.

[[produkt: lattafa-yara-collection-set-w-edp-4x5ml-spv-0248775 | 4 vůně po 5 ml]]

Nebo nám napište, co už voníte, a doporučíme. Celý sortiment najdete v kategorii [Arabské parfémy](/kategorie/parfemy/arabske-parfemy).`,
  },
  {
    slug: "korejska-pece-o-plet-v-5-krocich",
    title: "Korejská péče o pleť v 5 krocích: co opravdu potřebujete",
    category: "kosmetika" as const,
    excerpt:
      "Desetikroková korejská rutina nemusí znamenat deset produktů. Ukážeme vám pět kroků, které dávají smysl, a u každého konkrétní tipy z našeho sortimentu. Celá základní sada vyjde kolem 1 300 Kč.",
    content: `Korejská péče o pleť neznamená deset produktů. Stačí pět kroků od nejlehčího po nejbohatší.

> **Rychlý přehled**
>
> - **Základní sada:** pěna, esence, sérum, krém a SPF
> - **Cena:** kolem 1 300 Kč celkem
> - **Večer:** přidejte odličovací olej
> - **Pravidlo:** nové věci zavádějte po jednom

## Čištění: odličte a pak vyčistěte

Večer olej nebo balzám, potom jemná pěna. Ráno obvykle stačí pěna.

[[produkt: vvbetter-gentle-deep-cleansing-oil-200-ml-gvs-5904305 | Odličovací olej s centellou]]
[[produkt: dr-althea-pore-refresh-grinding-cleansing-balm-gvs-255620 | Čisticí balzám se zeleným čajem]]
[[produkt: vvbetter-soothing-cleansing-foam-120-ml-gvs-1482509 | Jemná pěna na druhý krok]]

## Tonikum nebo esence: příprava pleti

Zklidní pleť a připraví ji na další vrstvy.

[[produkt: dr-althea-natural-radiance-essence-gvs-253480 | Rozjasňující esence]]
[[produkt: dr-althea-anastatica-skin-conditioning-toner-250ml-spv-0247766 | Tonikum na každý den (250 ml)]]

## Sérum: účinná látka na míru

Vyberte, co chcete řešit. Retinol patří spíš na večer.

[[produkt: dr-althea-aqua-marine-deep-serum-gvs-256191 | Hydratace s kyselinou hyaluronovou]]
[[produkt: dr-althea-vitamin-c-boosting-serum-gvs-255385 | Rozjasnění: vitamín C a niacinamid]]

## Krém: uzamkněte vlhkost

Na mastnější pleť lehký gel, na suchou bohatší krém.

[[produkt: dr-althea-aqua-marine-watery-cream-50ml-spv-0243469 | Lehký hydratační krém]]
[[produkt: vvbetter-teca-lifting-moisture-cream-50-ml-gvs-2554853 | Zpevňující krém s peptidy]]

## SPF: krok, který nevynechávejte

Každý den, ne jen v létě. Bez něj ostatní péče nemá smysl.

[[produkt: dr-althea-green-tea-fresh-sunscreen-spf50-pa-45ml-spv-0247767 | Lehký krém se zeleným čajem]]
[[produkt: vvbetter-daily-airfit-sunscreen-spf-50-gvs-5903568 | Denní SPF50+ na obličej]]

## Bonus: exfoliace jednou týdně

[[produkt: cosrx-aha7-whitehead-power-liquid-100ml-spv-0226436 | Exfoliační tonikum s AHA]]

## Pár pravidel, aby rutina fungovala

- **Nové produkty po jednom.** S odstupem pár dní.
- **Od nejlehčího po nejbohatší.** Tonikum, sérum, krém, SPF.
- **Večer méně, ráno SPF.**
- **Buďte trpěliví.** Pleť se mění týdny, ne dny.

Nevíte, co vybrat pro svůj typ pleti? Napište nám. Celý výběr najdete v kategorii [Korejská kosmetika](/kategorie/kosmetika/korejska-kosmetika).`,
  },
  {
    slug: "podzimni-vune-do-bytu",
    title: "Podzimní vůně do bytu: dýně, skořice, vanilka a cedr",
    category: "obecne" as const,
    excerpt:
      "Jak provonět byt na podzim: osvěžovač do zásuvky, difuzér s tyčinkami, svíčka, nebo sprej? Přehled podzimních vůní (dýně, jablko se skořicí, vanilka, cedr) a konkrétní tipy z našeho sortimentu od 25 Kč.",
    content: `Podzim voní po dýni, skořici, jablkách, vanilce a dřevě. Vůni do bytu dostanete už za pár desítek korun, jen vyberte správný formát.

> **Rychlý přehled**
>
> - **Zásuvka:** stálá vůně na týdny
> - **Difuzér s tyčinkami:** bez elektřiny, jemná vůně
> - **Svíčka:** atmosféra, vůně při hoření
> - **Sprej:** rychlé osvěžení za cca 30 Kč

## Dýně a podzimní koření

Nejtypičtější vůně podzimu: teplá a mírně sladká.

[[produkt: air-wick-nahradni-napln-dyne-a-podzimni-pepr-19ml-tde-556418 | Náplň do přístroje Air Wick, bestseller]]
[[produkt: bartek-svicky-pumpkin-season-115g-tde-401151 | Malá dýňová svíčka]]
[[produkt: yankee-candle-pumpkin-cinnamon-swirl-signature-candle-368g-spv-0235866 | Vanilka, hnědý cukr, koření]]

## Jablko se skořicí

Vůně pečeného jablka. Nejlevnější vstup do podzimu.

[[produkt: air-breeze-nahradni-napln-250ml-aapple-cinnamon-tde-379120 | Náplň 250 ml]]
[[produkt: bispol-diffuser-apple-cinnamon-45ml-tde-352034 | Difuzér s tyčinkami]]
[[produkt: fresh-air-osvezovac-apple-cinnamon-300ml-tde-355616 | Sprej na rychlé osvěžení]]
[[produkt: yankee-candle-sparkling-cinnamon-signature-svicka-stredni-368-g-spv-0221049 | Svíčka se skořicí a hřebíčkem]]

## Vanilka a dřevo

Klidnější vůně, které se hodí i mimo podzim.

[[produkt: air-wick-freshmatic-napln-vanilka-a-santalove-drevo-250ml-tde-405189 | Vanilka se santalem]]
[[produkt: air-wick-nahradni-napln-eukalyptus-a-cedrove-drevo-19ml-tde-556419 | Svěžejší, s cedrem]]
[[produkt: woodwick-vanilla-bean-scented-candle-with-wooden-wick-453-6-g-spv-ww0478 | Svíčka s praskajícím knotem]]

## Tipy, aby vůně fungovala

- **Ne do průvanu.** Rychle by zmizela.
- **Jedna vůně v místnosti.** Míchání působí těžce.
- **Větrejte.** Jinak se vůně „okouká“.
- **Dárek:** malá svíčka nebo difuzér do 60 Kč.

Celý výběr: [Osvěžovače vzduchu](/kategorie/domacnost/osvezovace-vzduchu), [Aroma difuzéry](/kategorie/aroma-difuzery) a [Vonné svíčky](/kategorie/vonne-svicky).`,
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
