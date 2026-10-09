// Editorial content for specific category pages (keyed by fullSlug): a short intro above the products,
// quick-filter tiles, and an FAQ below them. Kept in code (not the DB) so it ships and is reviewed like
// the rest of the storefront; a non-empty Category.description in the DB still wins for the intro.

export interface CategoryFaqItem {
  q: string;
  a: string;
  /** Optional follow-up link rendered after the answer. */
  link?: { href: string; label: string };
}

export interface CategoryContent {
  /** Plain paragraphs shown above the grid when the category has no DB description. */
  intro?: string[];
  /** Quick-filter tiles (scent family / brands / gender) built from the page's live facets. */
  quickTiles?: boolean;
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
    quickTiles: true,
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
        a: "Orientačně od několika hodin po celý den. Záleží na koncentraci, typu pokožky, počasí i způsobu aplikace. Extrakty a oleje bývají trvanlivější než toaletní vody. Nejlépe se vůně drží na hydratované pokožce a na pulzních bodech.",
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
};
