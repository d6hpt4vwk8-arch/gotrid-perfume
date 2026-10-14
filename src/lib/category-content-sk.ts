// Slovak counterpart of category-content.ts (editorial intro + FAQ) and of the
// handful of Category.description blurbs stored in the database. Keyed by
// category fullSlug. On /sk a category shows only the Slovak text registered
// here — never the Czech paragraphs.
import type { CategoryContent } from "@/lib/category-content";

export const CATEGORY_CONTENT_SK: Record<string, CategoryContent> = {
  "parfemy/arabske-parfemy": {
    intro: [
      "Arabské parfumy sú vône z Blízkeho východu, ktoré stoja na oude, ambre, pižme, vanilke a korení. Bývajú hrejivejšie, sladšie a výraznejšie ako klasické európske vône a mnohé z nich pristanú ženám aj mužom.",
      "U nás nájdete Lattafa, Armaf, Al Haramain, Afnan a ďalšie známe domy. Filtrom „Pre koho“ si vyberiete dámske, pánske alebo unisex vône, filtrom „Charakter vône“ napríklad orientálne, drevité alebo gurmánske.",
    ],
    hero: {
      image: "/uploads/categories/arabske-parfemy.webp",
      alt: "Arabské parfumy: Armaf, Lattafa, Afnan, French Avenue na podiách s lampášmi a oudom",
    },
    faqTitle: "Časté otázky k arabským parfumom",
    whatsappMessage: "Dobrý deň, potreboval/a by som poradiť s výberom arabského parfumu.",
    faq: [
      {
        q: "Čím sú arabské parfumy špecifické?",
        a: "Typicky pracujú s oudom (voňavým drevom), ambrou, pižmom, vanilkou, ružou a korením. Výsledkom je hrejivá, sladšia a výraznejšia vôňa so zreteľnou stopou. Veľa vôní je koncipovaných ako unisex, preto pri každej nájdete označenie, pre koho je určená.",
      },
      {
        q: "Aký je rozdiel medzi parfumovanou vodou (EDP), parfumovým extraktom a parfumovým olejom?",
        a: "Líšia sa podielom voňavých látok. Toaletná voda (EDT) ich obsahuje najmenej, parfumovaná voda (EDP) viac a parfumový extrakt (extrait de parfum) najviac zo všetkých sprejov, takže býva hutnejší a trvanlivejší. Parfumový olej je bez alkoholu, nanáša sa po kvapkách na pulzné body (zápästie, krk) a na pokožke vydrží dlho. Čím vyššia koncentrácia, tým menej prípravku stačí.",
      },
      {
        q: "Ako dlho arabský parfum vydrží?",
        a: "Orientačne podľa typu (pri každom konkrétnom parfume sa čas líši podľa pokožky, počasia a zloženia):",
        list: [
          "Toaletná voda (EDT): približne 3–5 hodín",
          "Parfumovaná voda (EDP): približne 5–8 hodín",
          "Parfumový extrakt (extrait): približne 8–12 hodín aj dlhšie",
          "Parfumový olej: približne 8–12 hodín, vôňa ale zostáva bližšie k pokožke",
        ],
        note: "Vône sa najlepšie držia na čistej, hydratovanej pokožke a na pulzných bodoch (krk, zápästie, záhyby lakťov).",
      },
      {
        q: "Ako parfum aplikovať a uchovávať?",
        a: "Naneste 2–4 vstreky na čistú pokožku: krk, zápästie alebo záhyby lakťov. Parfum uchovávajte v pôvodnej škatuľke, mimo priameho slnka a tepla; kúpeľňa na uloženie nie je vhodná.",
      },
      {
        q: "Ako si vybrať, keď si nie som istý/á?",
        a: "Začnite vôňami, ktoré už poznáte a máte radi: sladké a gurmánske (vanilka, karamel, ovocie), drevité a oudové, kvetinové a ružové, alebo čisto pižmové. V ponuke použite filter „Charakter vône“. Radi poradíme aj na WhatsAppe.",
      },
      {
        q: "Sú parfumy u vás originálne?",
        a: "Áno. Tovar nakupujeme priamo od distribútorov a uchovávame doklady k jednotlivým dodávkam.",
        link: { href: "/garance-originality-produktu", label: "Záruka originality produktov →" },
      },
    ],
  },

  "kosmetika/korejska-kosmetika": {
    intro: [
      "Kórejská kozmetika (K-beauty) stojí na jemnej, viackrokovej starostlivosti o pleť: čistenie, tonikum, esencia alebo sérum, krém a ochrana pred slnkom. Dôraz je na hydratácii, upokojení a ochrane pleťovej bariéry, často so zložkami ako centella ázijská, propolis, ryža, ženšen alebo niacínamid.",
      "U nás nájdete Dr. Althea, Cosrx, Beauty of Joseon, SKIN1004, Some By Mi, Medicube, VT Cosmetics, Anua a ďalšie kórejské značky. Pozrite si novinky a bestsellery, alebo filtrujte podľa značky a ceny.",
    ],
    hero: {
      image: "/uploads/categories/korejska-kosmetika.webp",
      alt: "Kórejská kozmetika: Dr. Althea, Esthetic House a VVBETTER na travertínových a celadónových podstavcoch pri mesačnej váze",
    },
    faqTitle: "Časté otázky ku kórejskej kozmetike",
    whatsappMessage: "Dobrý deň, potreboval/a by som poradiť s výberom kórejskej kozmetiky.",
    faq: [
      {
        q: "Čím sa kórejská kozmetika líši od bežnej starostlivosti o pleť?",
        a: "Stavia na vrstvení ľahkých textúr a na prevencii: dôraz je na hydratácii, upokojení, ochrane pleťovej bariéry a každodennom opaľovacom kréme. Častými zložkami sú centella ázijská, propolis, ryža, ženšen, slimačí mucín, niacínamid alebo kyselina hyalurónová.",
      },
      {
        q: "V akom poradí produkty používať?",
        a: "Večer zvyčajne takto, od najľahšieho po najbohatší:",
        list: [
          "1. čistiaci olej alebo balzam (odstráni make-up a opaľovací krém)",
          "2. čistiaca pena alebo gél (dvojfázové čistenie)",
          "3. tonikum alebo esencia",
          "4. sérum alebo ampulka",
          "5. krém, prípadne maska",
        ],
        note: "Ráno stačí jemné čistenie, tonikum, sérum, krém a vždy opaľovací krém. Nemusíte používať všetky kroky; základom sú čistenie, hydratácia a ochrana pred slnkom.",
      },
      {
        q: "Musím mať celú „10-krokovú“ rutinu?",
        a: "Nie. Začnite tromi krokmi (čistenie, hydratačný krém, opaľovací krém) a ďalšie pridávajte postupne podľa potreby pleti, vždy po jednom novom produkte, aby ste spoznali, ako naň pleť reaguje.",
      },
      {
        q: "Čo znamená SPF a PA pri opaľovacích krémoch?",
        a: "SPF označuje ochranu pred UVB žiarením (spálenie pleti), PA pred UVA žiarením (starnutie pleti). Čím viac plusiek pri PA (od + do ++++), tým vyššia UVA ochrana. Naneste dostatočné množstvo na tvár a krk a počas dňa opakujte.",
      },
      {
        q: "Ako vybrať starostlivosť podľa typu pleti?",
        a: "Pre mastnú a problematickú pleť sa hodia ľahké gély, tonika a produkty s BHA alebo centellou. Suchá pleť ocení bohatšie krémy a zložky ako kyselina hyalurónová či ceramidy. Citlivá pleť dobre znáša upokojujúce zložky (centella, panthenol), silné kyseliny je lepšie vynechať. Nový produkt vyskúšajte najprv na malej ploche pleti.",
      },
      {
        q: "Môžem kombinovať kyseliny (AHA/BHA) a retinol?",
        a: "Silné aktívne zložky nepoužívajte všetky naraz. Začnite 1–2× týždenne, striedajte večery (napr. kyseliny a retinol zvlášť) a každé ráno používajte opaľovací krém. Pri citlivej pleti alebo pochybnostiach sa poraďte s dermatológom.",
      },
      {
        q: "Ako dlho trvá, kým uvidím výsledky?",
        a: "Hydratácia a upokojenie bývajú znať počas niekoľkých dní. Pre viditeľnejšie zmeny (jemné línie, hyperpigmentácia, textúra pleti) počítajte s niekoľkými týždňami až mesiacmi pravidelného používania, pretože pleť sa obnovuje približne v mesačnom cykle.",
      },
      {
        q: "Čo znamenajú štítky Vegan a Cruelty-free?",
        a: "Vegan znamená, že produkt neobsahuje zložky živočíšneho pôvodu, Cruelty-free že sa neskúša na zvieratách. Štítky uvádzame len pri produktoch, kde to výslovne uvádza výrobca alebo predajca.",
      },
      {
        q: "Sú produkty u vás originálne?",
        a: "Áno. Tovar nakupujeme priamo od distribútorov a uchovávame doklady k jednotlivým dodávkam.",
        link: { href: "/garance-originality-produktu", label: "Záruka originality produktov →" },
      },
    ],
  },
};

// Hrefs are written without the locale prefix; the category page prefixes
// them with /sk when it renders this HTML.
export const CATEGORY_DESCRIPTION_SK: Record<string, string> = {
  domacnost:
    '<p>Navoňajte svoj domov s našou ponukou <a href="/kategorie/domacnost/osvezovace-vzduchu"><b><u>osviežovačov vzduchu</u></b></a> — sprejov, vôní do skrine aj osviežovačov na WC.</p>',
  "domacnost/osvezovace-vzduchu":
    '<p>Vyberte si podľa toho, kam vôňu potrebujete — praktický <a href="/kategorie/domacnost/osvezovace-vzduchu/sprej"><b><u>sprej</u></b></a>, osviežovač <a href="/kategorie/domacnost/osvezovace-vzduchu/pro-wc"><b><u>na WC</u></b></a>, do <a href="/kategorie/domacnost/osvezovace-vzduchu/vune-do-skrine"><b><u>skrine</u></b></a>, <a href="/kategorie/domacnost/osvezovace-vzduchu/pro-pokoje"><b><u>do izieb</u></b></a> alebo <a href="/kategorie/domacnost/osvezovace-vzduchu/naplne"><b><u>náhradné náplne</u></b></a>.</p>',
  kosmetika:
    '<p>Vyberte si zo širokej ponuky drogérie a starostlivosti o telo. Nájdete u nás obľúbené <a href="/kategorie/kosmetika/sprchove-gely"><b><u>sprchové gély</u></b></a> a vyživujúce <a href="/kategorie/kosmetika/telove-oleje"><b><u>telové oleje</u></b></a> na každodennú starostlivosť, doplnené o starostlivosť o <a href="/kategorie/kosmetika/vlasy"><b><u>vlasy</u></b></a>, <a href="/kategorie/kosmetika/plet"><b><u>pleť</u></b></a> a <a href="/kategorie/kosmetika/telo"><b><u>telo</u></b></a>.</p><p>Nenechajte si ujsť našu obľúbenú <a href="/kategorie/kosmetika/korejska-kosmetika"><b><u>kórejskú kozmetiku</u></b></a> ani širokú ponuku <a href="/kategorie/kosmetika/dekorativni-kosmetika"><b><u>dekoratívnej kozmetiky</u></b></a> — od očných tieňov cez rúže až po všetko na nechty.</p>',
  "kosmetika/dekorativni-kosmetika":
    '<p>Zdôraznite svoju krásu s našou ponukou líčenia na <a href="/kategorie/kosmetika/dekorativni-kosmetika/oci"><b><u>oči</u></b></a>, <a href="/kategorie/kosmetika/dekorativni-kosmetika/rty"><b><u>pery</u></b></a> aj <a href="/kategorie/kosmetika/dekorativni-kosmetika/tvar"><b><u>tvár</u></b></a>. Nezabudnite ani na starostlivosť o <a href="/kategorie/kosmetika/dekorativni-kosmetika/nehty"><b><u>nechty</u></b></a>.</p>',
  "kosmetika/plet":
    '<p>Postarajte sa o svoju pleť od základov — <a href="/kategorie/kosmetika/plet/cisteni-pleti"><b><u>čistenie pleti</u></b></a>, <a href="/kategorie/kosmetika/plet/pletove-kremy"><b><u>pleťové krémy</u></b></a> a účinné <a href="/kategorie/kosmetika/plet/pletova-sera"><b><u>pleťové séra</u></b></a>. Pre hlbšie ošetrenie vyskúšajte <a href="/kategorie/kosmetika/plet/pletove-peelingy"><b><u>pleťové peelingy</u></b></a> alebo <a href="/kategorie/kosmetika/plet/pletove-masky"><b><u>pleťové masky</u></b></a>.</p>',
  "kosmetika/telo":
    '<p>Rozmaznajte svoje telo — od <a href="/kategorie/kosmetika/telo/sprcha-a-koupel"><b><u>sprchových gélov a kúpeľov</u></b></a> cez <a href="/kategorie/kosmetika/telo/telova-mleka"><b><u>telové mlieka</u></b></a> až po obľúbené <a href="/kategorie/kosmetika/telo/deodoranty"><b><u>dezodoranty</u></b></a>. Nechýba ani <a href="/kategorie/kosmetika/telo/opalovaci-kosmetika"><b><u>opaľovacia kozmetika</u></b></a> a doplnky na <a href="/kategorie/kosmetika/telo/depilace"><b><u>depiláciu</u></b></a>.</p>',
  "kosmetika/vlasy":
    '<p>Kompletná starostlivosť o vlasy na jednom mieste — <a href="/kategorie/kosmetika/vlasy/sampony"><b><u>šampóny</u></b></a>, <a href="/kategorie/kosmetika/vlasy/kondicionery-a-balzamy"><b><u>kondicionéry a balzamy</u></b></a>, výživné <a href="/kategorie/kosmetika/vlasy/vlasove-masky"><b><u>vlasové masky</u></b></a> a <a href="/kategorie/kosmetika/vlasy/vlasova-sera"><b><u>vlasové séra</u></b></a>.</p><p>Chcete zmenu? Pozrite sa na <a href="/kategorie/kosmetika/vlasy/barvy-na-vlasy"><b><u>farby na vlasy</u></b></a> alebo produkty na <a href="/kategorie/kosmetika/vlasy/styling"><b><u>styling</u></b></a>.</p>',
  parfemy:
    '<p>Či hľadáte parfum pre seba alebo ako darček, začnite pri <a href="/kategorie/parfemy/arabske-parfemy"><b><u>arabských parfumoch</u></b></a> — výrazné, dlhotrvajúce vône s oudom, ambrou a vanilkou — alebo pri <a href="/kategorie/parfemy/znackove-parfemy"><b><u>značkových parfumoch</u></b></a> známych domov. V každej kategórii si filtrom „Pre koho“ vyberiete dámske, pánske alebo unisex vône.</p><p>Hľadáte darček? Pozrite sa na naše <a href="/kategorie/parfemy/darkove-sady"><b><u>darčekové sady</u></b></a> alebo praktické <a href="/kategorie/parfemy/doplnky"><b><u>doplnky</u></b></a> k parfumom.</p>',
  "parfemy/damske-parfemy":
    '<p>Vyberajte z intenzívnych <a href="/kategorie/parfemy/damske-parfemy/parfemovane-vody"><b><u>parfumovaných vôd</u></b></a> aj ľahších <a href="/kategorie/parfemy/damske-parfemy/toaletni-vody"><b><u>toaletných vôd</u></b></a>. Pre milovníčky jemných, olejových vôní máme aj ponuku <a href="/kategorie/parfemy/damske-parfemy/parfemovane-oleje"><b><u>parfumovaných olejov</u></b></a>.</p>',
  "parfemy/panske-parfemy":
    '<p>Od sviežich <a href="/kategorie/parfemy/panske-parfemy/toaletni-vody"><b><u>toaletných vôd</u></b></a> na denné nosenie až po intenzívnejšie <a href="/kategorie/parfemy/panske-parfemy/parfemovane-vody"><b><u>parfumované vody</u></b></a> na večer — vyberajte podľa príležitosti.</p>',
  "parfemy/unisex-parfemy":
    '<p>Vône, ktoré nerozlišujú pohlavie — veľký výber <a href="/kategorie/parfemy/unisex-parfemy/parfemovane-vody"><b><u>parfumovaných vôd</u></b></a>, obľúbené <a href="/kategorie/parfemy/unisex-parfemy/toaletni-vody"><b><u>toaletné vody</u></b></a> aj jemné <a href="/kategorie/parfemy/unisex-parfemy/parfemovane-oleje"><b><u>parfumované oleje</u></b></a>.</p>',
  "pece-o-zdravi":
    '<p>Praktické produkty pre zdravie a intímne chvíle — <a href="/kategorie/pece-o-zdravi/kondomy"><b><u>kondómy</u></b></a>, uvoľňujúce <a href="/kategorie/pece-o-zdravi/masazni-gely"><b><u>masážne gély</u></b></a> a ďalšie nevyhnutnosti.</p>',
  zuby:
    '<p>Kompletná starostlivosť o ústnu hygienu — <a href="/kategorie/zuby/zubni-pasty"><b><u>zubné pasty</u></b></a>, <a href="/kategorie/zuby/zubni-kartacky"><b><u>zubné kefky</u></b></a> a osviežujúce <a href="/kategorie/zuby/ustni-vody"><b><u>ústne vody</u></b></a>. Nezabúdajte ani na <a href="/kategorie/zuby/zubni-nite"><b><u>zubné nite</u></b></a>.</p>',
};
