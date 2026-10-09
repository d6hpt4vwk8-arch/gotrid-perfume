// Editorial content for specific category pages (keyed by fullSlug): a short intro above the products,
// quick-filter tiles, and an FAQ below them. Kept in code (not the DB) so it ships and is reviewed like
// the rest of the storefront; a non-empty Category.description in the DB still wins for the intro.

export interface CategoryFaqItem {
  q: string;
  a: string;
  /** Optional bullet list rendered under the answer text. */
  list?: string[];
  /** Optional closing line after the list. */
  note?: string;
  /** Optional follow-up link rendered after the answer. */
  link?: { href: string; label: string };
}

export interface CategoryContent {
  /** Plain paragraphs shown above the grid when the category has no DB description. */
  intro?: string[];
  /** Category hero: a 3D banner image (under /public) with the title + intro laid over its dark left half. */
  hero?: { image: string; alt: string };
  faqTitle?: string;
  faq?: CategoryFaqItem[];
  whatsappMessage?: string;
}

export const CATEGORY_CONTENT: Record<string, CategoryContent> = {
  "parfemy/arabske-parfemy": {
    intro: [
      "Arabské parfémy jsou vůně z Blízkého východu, které staví na oudu, ambře, pižmu, vanilce a koření. Bývají hřejivější, sladší a výraznější než klasické evropské vůně a mnohé z nich sluší ženám i mužům.",
      "U nás najdete Lattafa, Armaf, Al Haramain, Afnan a další známé domy. Filtrem „Pro koho“ si vyberete dámské, pánské nebo unisex vůně, filtrem „Charakter vůně“ třeba orientální, dřevitou nebo gurmánskou.",
    ],
    hero: {
      image: "/uploads/categories/arabske-parfemy.webp",
      alt: "Arabské parfémy: Armaf, Lattafa, Afnan, French Avenue na podiích s lucernami a oudem",
    },
    faqTitle: "Časté otázky k arabským parfémům",
    whatsappMessage: "Dobrý den, potřeboval/a bych poradit s výběrem arabského parfému.",
    faq: [
      {
        q: "Čím jsou arabské parfémy specifické?",
        a: "Typicky pracují s oudem (vonným dřevem), ambrou, pižmem, vanilkou, růží a kořením. Výsledkem je hřejivá, sladší a výraznější vůně se zřetelnou stopou. Řada vůní je koncipovaná jako unisex, proto u každé najdete označení, pro koho je určená.",
      },
      {
        q: "Jaký je rozdíl mezi parfémovanou vodou (EDP), parfémovým extraktem a parfémovým olejem?",
        a: "Liší se podílem vonných látek. Toaletní voda (EDT) jich obsahuje nejméně, parfémovaná voda (EDP) víc a parfémový extrakt (extrait de parfum) nejvíc ze všech sprejů, takže bývá hutnější a trvanlivější. Parfémový olej je bez alkoholu, nanáší se po kapkách na pulzní body (zápěstí, krk) a na pokožce vydrží dlouho. Čím vyšší koncentrace, tím méně přípravku stačí.",
      },
      {
        q: "Jak dlouho arabský parfém vydrží?",
        a: "Orientačně podle typu (u každého konkrétního parfému se doba liší podle pokožky, počasí a složení):",
        list: [
          "Toaletní voda (EDT): přibližně 3–5 hodin",
          "Parfémovaná voda (EDP): přibližně 5–8 hodin",
          "Parfémový extrakt (extrait): přibližně 8–12 hodin i déle",
          "Parfémový olej: přibližně 8–12 hodin, vůně ale zůstává blíž k pokožce",
        ],
        note: "Vůně se nejlépe drží na čisté, hydratované pokožce a na pulzních bodech (krk, zápěstí, záhyby loktů).",
      },
      {
        q: "Jak parfém aplikovat a uchovávat?",
        a: "Naneste 2–4 vstřiky na čistou pokožku: krk, zápěstí nebo záhyby loktů. Parfém uchovávejte v původní krabičce, mimo přímé slunce a teplo; koupelna na uložení není vhodná.",
      },
      {
        q: "Jak si vybrat, když si nejsem jistý/á?",
        a: "Začněte vůněmi, které už znáte a máte rádi: sladké a gurmánské (vanilka, karamel, ovoce), dřevité a oudové, květinové a růžové, nebo čistě pižmové. V nabídce použijte filtr „Charakter vůně“. Rádi poradíme také na WhatsAppu.",
      },
      {
        q: "Jsou parfémy u vás originální?",
        a: "Ano. Zboží nakupujeme přímo od distributorů a uchováváme doklady k jednotlivým dodávkám.",
        link: { href: "/garance-originality-produktu", label: "Garance originality produktů →" },
      },
    ],
  },

  "kosmetika/korejska-kosmetika": {
    intro: [
      "Korejská kosmetika (K-beauty) stojí na jemné, vícekrokové péči o pleť: čištění, tonikum, esence nebo sérum, krém a ochrana před sluncem. Důraz je na hydrataci, zklidnění a ochranu pleťové bariéry, často se složkami jako centella asijská, propolis, rýže, ženšen nebo niacinamid.",
      "U nás najdete Dr. Althea, Cosrx, Beauty of Joseon, SKIN1004, Some By Mi, Medicube, VT Cosmetics, Anua a další korejské značky. Prohlédněte si novinky a bestsellery, nebo filtrujte podle značky a ceny.",
    ],
    hero: {
      image: "/uploads/categories/korejska-kosmetika.webp",
      alt: "Korejská kosmetika: Beauty of Joseon, Some By Mi, Cosrx, SKIN1004, Dr. Althea na podiích s listy čajovníku a kapkami vody",
    },
    faqTitle: "Časté otázky ke korejské kosmetice",
    whatsappMessage: "Dobrý den, potřeboval/a bych poradit s výběrem korejské kosmetiky.",
    faq: [
      {
        q: "Čím se korejská kosmetika liší od běžné péče o pleť?",
        a: "Staví na vrstvení lehkých textur a na prevenci: důraz je na hydrataci, zklidnění, ochranu pleťové bariéry a každodenní opalovací krém. Častými složkami jsou centella asijská, propolis, rýže, ženšen, hlemýždí mucin, niacinamid nebo kyselina hyaluronová.",
      },
      {
        q: "V jakém pořadí produkty používat?",
        a: "Večer obvykle takto, od nejlehčího po nejbohatší:",
        list: [
          "1. čisticí olej nebo balzám (odstraní make-up a opalovací krém)",
          "2. čisticí pěna nebo gel (dvoufázové čištění)",
          "3. tonikum nebo esence",
          "4. sérum nebo ampule",
          "5. krém, případně maska",
        ],
        note: "Ráno stačí jemné čištění, tonikum, sérum, krém a vždy opalovací krém. Nemusíte používat všechny kroky; základem jsou čištění, hydratace a ochrana před sluncem.",
      },
      {
        q: "Musím mít celou „10krokovou“ rutinu?",
        a: "Ne. Začněte třemi kroky (čištění, hydratační krém, opalovací krém) a další přidávejte postupně podle potřeby pleti, vždy po jednom novém produktu, abyste poznali, jak na něj pleť reaguje.",
      },
      {
        q: "Co znamená SPF a PA u opalovacích krémů?",
        a: "SPF označuje ochranu před UVB zářením (spálení pleti), PA před UVA zářením (stárnutí pleti). Čím více plusek u PA (od + do ++++), tím vyšší UVA ochrana. Naneste dostatečné množství na obličej a krk a během dne opakujte.",
      },
      {
        q: "Jak vybrat péči podle typu pleti?",
        a: "Pro mastnou a problematickou pleť se hodí lehké gely, tonika a produkty s BHA nebo centellou. Suchá pleť ocení bohatší krémy a složky jako kyselina hyaluronová či ceramidy. Citlivá pleť dobře snáší zklidňující složky (centella, panthenol), silné kyseliny je lepší vynechat. Nový produkt vyzkoušejte nejdřív na malé ploše pleti.",
      },
      {
        q: "Mohu kombinovat kyseliny (AHA/BHA) a retinol?",
        a: "Silné aktivní složky nepoužívejte všechny najednou. Začněte 1–2× týdně, střídejte večery (např. kyseliny a retinol zvlášť) a každé ráno používejte opalovací krém. Při citlivé pleti nebo pochybnostech se poraďte s dermatologem.",
      },
      {
        q: "Jak dlouho trvá, než uvidím výsledky?",
        a: "Hydratace a zklidnění bývají znát během několika dní. Pro viditelnější změny (jemné linky, hyperpigmentace, textura pleti) počítejte s několika týdny až měsíci pravidelného používání, protože pleť se obnovuje přibližně v měsíčním cyklu.",
      },
      {
        q: "Co znamenají štítky Vegan a Cruelty-free?",
        a: "Vegan znamená, že produkt neobsahuje složky živočišného původu, Cruelty-free že se nezkouší na zvířatech. Štítky uvádíme jen u produktů, kde to výslovně uvádí výrobce nebo prodejce.",
      },
      {
        q: "Jsou produkty u vás originální?",
        a: "Ano. Zboží nakupujeme přímo od distributorů a uchováváme doklady k jednotlivým dodávkám.",
        link: { href: "/garance-originality-produktu", label: "Garance originality produktů →" },
      },
    ],
  },
};
