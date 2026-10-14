// Czech → Slovak labels for the Heureka.sk feed: category breadcrumb parts
// and PARAM names/values. Product names/descriptions live in the database
// (Product.nameSk / descriptionSk); these few dozen shared terms are small and
// stable enough to keep in code. Unknown terms fall back to the Czech original.
const CATEGORIES: Record<string, string> = {
  "Aroma Difuzéry": "Aróma difuzéry",
  "Domácnost": "Domácnosť",
  "Osvěžovače vzduchu": "Osviežovače vzduchu",
  "Náplně": "Náplne",
  "Pro pokoje": "Do izieb",
  "Pro WC": "Na WC",
  "Sprej": "Sprej",
  "Vůně do skříně": "Vône do skrine",
  "Kosmetika": "Kozmetika",
  "Dekorativní kosmetika": "Dekoratívna kozmetika",
  "Doplňky": "Doplnky",
  "Nehty": "Nechty",
  "Oči": "Oči",
  "Rty": "Pery",
  "Tvář": "Tvár",
  "Korejská kosmetika": "Kórejská kozmetika",
  "Pleť": "Pleť",
  "Čištění pleti": "Čistenie pleti",
  "Péče o řasy a obočí": "Starostlivosť o mihalnice a obočie",
  "Péče o rty": "Starostlivosť o pery",
  "Pleťová séra": "Pleťové séra",
  "Pleťové krémy": "Pleťové krémy",
  "Pleťové masky": "Pleťové masky",
  "Pleťové peelingy": "Pleťové peelingy",
  "Sprchové gely": "Sprchové gély",
  "Tělo": "Telo",
  "Dárkové sady": "Darčekové sady",
  "Deodoranty": "Dezodoranty",
  "Depilace": "Depilácia",
  "Intimní hygiena": "Intímna hygiena",
  "Krém na ruce": "Krém na ruky",
  "Mýdla": "Mydlá",
  "Opalovací kosmetika": "Opaľovacia kozmetika",
  "Peelingy a masáže": "Peelingy a masáže",
  "Sprcha a koupel": "Sprcha a kúpeľ",
  "Tělová mléka": "Telové mlieka",
  "Tělové spreje": "Telové spreje",
  "Tělové oleje": "Telové oleje",
  "Vlasy": "Vlasy",
  "Barvy na vlasy": "Farby na vlasy",
  "Kondicionéry a balzámy": "Kondicionéry a balzamy",
  "Šampony": "Šampóny",
  "Styling": "Styling",
  "Vlasová séra": "Vlasové séra",
  "Vlasová tonika": "Vlasové tonikum",
  "Vlasové masky": "Vlasové masky",
  "Parfémy": "Parfumy",
  "Arabské parfémy": "Arabské parfumy",
  "Značkové parfémy": "Značkové parfumy",
  "Dámské parfémy": "Dámske parfumy",
  "Pánské parfémy": "Pánske parfumy",
  "Unisex parfémy": "Unisex parfumy",
  "Parfémované oleje": "Parfumované oleje",
  "Parfémované vody": "Parfumované vody",
  "Toaletní vody": "Toaletné vody",
  "Péče o zdraví": "Starostlivosť o zdravie",
  "Kondomy": "Kondómy",
  "Masážní gely": "Masážne gély",
  "Ostatní": "Ostatné",
  "Těhotenské testy": "Tehotenské testy",
  "Vonné svíčky": "Vonné sviečky",
  "Vůně do auta": "Vône do auta",
  "Výprodej": "Výpredaj",
  "Zuby": "Zuby",
  "Doplňky k čištění zubů": "Doplnky na čistenie zubov",
  "Ústní vody": "Ústne vody",
  "Zubní kartáčky": "Zubné kefky",
  "Zubní nitě": "Zubné nite",
  "Zubní pasty": "Zubné pasty",
};

const PARAM_NAMES: Record<string, string> = {
  "Značka": "Značka",
  "Objem": "Objem",
  "Pro koho": "Pre koho",
  "Charakter vůně": "Charakter vône",
  "Typ pleti": "Typ pleti",
  "Účel": "Účel",
};

const PARAM_VALUES: Record<string, string> = {
  "Dámské": "Dámske",
  "Pánské": "Pánske",
  "Unisex": "Unisex",
  "Citrusová": "Citrusová",
  "Květinová": "Kvetinová",
  "Dřevitá": "Drevitá",
  "Orientální a kořeněná": "Orientálna a korenistá",
  "Svěží a vodní": "Sviežá a vodná",
  "Sladká a gurmánská": "Sladká a gurmánska",
  "Pižmová": "Pižmová",
  "Zelená a bylinná": "Zelená a bylinná",
  "Kožená a kouřová": "Kožená a dymová",
  "Suchá pleť": "Suchá pleť",
  "Mastná pleť": "Mastná pleť",
  "Smíšená pleť": "Zmiešaná pleť",
  "Citlivá pleť": "Citlivá pleť",
  "Normální pleť": "Normálna pleť",
  "Hydratace": "Hydratácia",
  "Akné a nečistoty": "Akné a nečistoty",
  "Vrásky a stárnutí pleti": "Vrásky a starnutie pleti",
  "Pigmentace a tmavé skvrny": "Pigmentácia a tmavé škvrny",
  "Zarudnutí a podráždění": "Začervenanie a podráždenie",
  "Rozjasnění pleti": "Rozjasnenie pleti",
  "Hloubkové čištění": "Hĺbkové čistenie",
};

/** Single category name (e.g. in the nav or a category heading) in Slovak. */
export function categoryNameSk(name: string): string {
  return CATEGORIES[name] ?? name;
}

/** Same tree with every category name in Slovak (storefront nav on /sk). */
export function translateCategoryTree<T extends { name: string; children: T[] }>(nodes: T[]): T[] {
  return nodes.map((n) => ({ ...n, name: categoryNameSk(n.name), children: translateCategoryTree(n.children) }));
}

/** "Kosmetika | Pleť | Pleťové krémy" → Slovak breadcrumb, term by term. */
export function categoryBreadcrumbSk(breadcrumb: string): string {
  return breadcrumb
    .split(" | ")
    .map((part) => CATEGORIES[part] ?? part)
    .join(" | ");
}

export function paramNameSk(name: string): string {
  return PARAM_NAMES[name] ?? name;
}

/** Brand names and volumes (e.g. "150 ml") are language-neutral and pass through. */
export function paramValueSk(value: string): string {
  return PARAM_VALUES[value] ?? value;
}
