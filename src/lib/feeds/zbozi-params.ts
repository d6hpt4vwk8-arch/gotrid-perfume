import type { FeedParam, FeedProduct } from "./get-feed-products";
import { ARABIC_PERFUME_BRANDS } from "./paid-ads-eligibility";

// Zboží.cz (Centrum prodejce → Diagnostika, 2026-11-08) flagged 4 319 offers "Chybí parametry" and 4 299 "Nerozpoznané
// parametry": each Zboží category has its own parameter dictionary (lower-case names, fixed value lists), e.g. for
// shower gels the critical "určení" (pánské | dámské | unisex) and "typ pokožky", plus yes/no filters such as vegan or
// hydratační. Our generic PARAMs ("Značka", "Objem", "Pro koho", …) keep serving Heureka and Glami; these are added on
// top, only from data we really have, and only ever as "ano" — never guessed. Zboží ignores a name that does not
// belong to the offer's category, so an extra one is harmless.

const SCENT_TO_ZBOZI: Record<string, string[]> = {
  "Citrusová": ["citrusová"],
  "Květinová": ["květinová"],
  "Dřevitá": ["dřevitá"],
  "Orientální a kořeněná": ["orientální", "kořeněná"],
  "Svěží a vodní": ["svěží"],
  "Sladká a gurmánská": ["sladká"],
  "Zelená a bylinná": ["bylinná"],
};

const SKIN_TO_ZBOZI: Record<string, string> = {
  "Suchá pleť": "suchá",
  "Mastná pleť": "mastná",
  "Smíšená pleť": "smíšená",
  "Citlivá pleť": "citlivá",
  "Normální pleť": "normální",
};

// Zboží's perfume dictionary is one yes/no filter per note family ("citrusové vůně", "dřevitá vůně", …), so every scent family of
// ours switches on the matching ones (seen in Centrum prodejce → a Lattafa offer, 2026-11-08).
const SCENT_TO_ZBOZI_FLAGS: Record<string, string[]> = {
  "Citrusová": ["citrusové vůně"],
  "Dřevitá": ["dřevitá vůně"],
  "Orientální a kořeněná": ["orientální vůně", "kořenitá vůně"],
  "Svěží a vodní": ["svěží parfém", "vodní vůně"],
  "Sladká a gurmánská": ["sladký parfém"],
  "Pižmová": ["pižmová vůně"],
  "Kožená a kouřová": ["kožená"],
  "Zelená a bylinná": ["aromatická vůně"],
};

const GENDER_TO_ZBOZI: Record<string, string> = { Dámské: "dámské", Pánské: "pánské", Unisex: "unisex" };

// \b only knows ASCII word characters, so Czech letters (ž, á …) get explicit Unicode-letter boundaries.
const MALE = /(?<!\p{L})(pro muže|pánsk\p{L}*|pro pány|for men|homme|muži)(?!\p{L})/iu;
const FEMALE = /(?<!\p{L})(pro ženy|dámsk\p{L}*|for women|femme|ženy)(?!\p{L})/iu;

/** Gender from the generated "Pro koho:" line of the description, then from the name; null when unclear or both. */
function gender(p: FeedProduct): string | null {
  const fromCategory = p.params.find((x) => x.name === "Pro koho")?.value;
  if (fromCategory && GENDER_TO_ZBOZI[fromCategory]) return GENDER_TO_ZBOZI[fromCategory];
  const forWhom = /Pro koho:\s*([^.]*)/i.exec(p.description)?.[1] ?? "";
  for (const text of [forWhom, p.name]) {
    const male = MALE.test(text);
    const female = FEMALE.test(text);
    if (male !== female) return male ? "pánské" : "dámské";
  }
  if (CHILD.test(p.name)) return "dětské";
  return null;
}

const CHILD = /(?<!\p{L})(dětsk\p{L}*|baby|kids)(?!\p{L})/iu;

// "pro suchou pokožku/pleť" style claims in the name → the typ pokožky value Zboží expects.
const SKIN_IN_TEXT: [RegExp, string][] = [
  [/(?<!\p{L})(sucho\p{L}*|suchá|suché)\s+(pokožk|pleť|pleti|pokožce)/iu, "suchá"],
  [/(?<!\p{L})(mastn\p{L}*)\s+(pokožk|pleť|pleti|pokožce)/iu, "mastná"],
  [/(?<!\p{L})(citliv\p{L}*)\s+(pokožk|pleť|pleti|pokožce)/iu, "citlivá"],
  [/(?<!\p{L})(smíšen\p{L}*)\s+(pokožk|pleť|pleti|pokožce)/iu, "smíšená"],
  [/(?<!\p{L})(normální)\s+(pokožk|pleť|pleti|pokožce)/iu, "normální"],
  [/všechny typy (pokožky|pleti)/iu, "pro všechny typy pokožky"],
];

export function zboziExtraParams(p: FeedProduct): FeedParam[] {
  const out: FeedParam[] = [];
  const add = (name: string, value: string) => {
    if (!out.some((x) => x.name === name && x.value === value)) out.push({ name, value });
  };

  const g = gender(p);
  if (g) add("určení", g);

  for (const x of p.params) {
    if (x.name === "Charakter vůně") for (const v of SCENT_TO_ZBOZI[x.value] ?? []) add("typ vůně", v);
    if (x.name === "Typ pleti" && SKIN_TO_ZBOZI[x.value]) add("typ pokožky", SKIN_TO_ZBOZI[x.value]);
    if (x.name === "Účel") {
      if (x.value === "Hydratace") add("hydratační", "ano");
      if (x.value === "Zarudnutí a podráždění" || x.value === "Suchá, citlivá nebo podrážděná pokožka") add("zklidňující", "ano");
    }
  }

  for (const x of p.params) {
    if (x.name === "Charakter vůně") for (const flag of SCENT_TO_ZBOZI_FLAGS[x.value] ?? []) add(flag, "ano");
  }
  if (p.isPerfume) {
    if (p.brandName && ARABIC_PERFUME_BRANDS.has(p.brandName.toLowerCase())) add("původ parfému", "arabské");
    if (/(?<!\p{L})(dárková sada|sada|set|coffret|gift set)(?!\p{L})/iu.test(p.name)) add("dárková sada", "ano");
  }

  for (const [re, value] of SKIN_IN_TEXT) if (re.test(p.name)) add("typ pokožky", value);

  // Deodorants: type from an explicit word in the name; anti-perspirant only when it says so.
  if (/deodorant|antiperspirant/i.test(p.name)) {
    if (/roll-?on|kuličk/i.test(p.name)) add("typ deodorantu", "kuličkový");
    else if (/sprej|spray/i.test(p.name)) add("typ deodorantu", "sprej");
    else if (/stick|tyčink/i.test(p.name)) add("typ deodorantu", "stick");
    else if (/krémov/i.test(p.name)) add("typ deodorantu", "krémový");
    if (/antiperspirant/i.test(p.name)) add("antiperspirant", "ano");
  }
  if (/bez hliníku/i.test(`${p.name} ${p.description}`)) add("bez hliníku", "ano");
  if (/náhradní náplň|\brefill\b/i.test(p.name)) add("náhradní náplň", "ano");
  if (/přírodní|\bnatural\b|\borganic\b/i.test(p.name)) add("přírodní", "ano");
  if (/hydrat/i.test(p.name)) add("hydratační", "ano");
  if (/zklidň/i.test(p.name)) add("zklidňující", "ano");

  if (p.isVegan || /(?<!\p{L})vegan\p{L}*/iu.test(p.name)) add("vegan", "ano");

  // Claims that are literally in our own name/description.
  const text = `${p.name} ${p.description}`;
  if (/\baloe\b/i.test(text)) add("s aloe vera", "ano");
  if (/\bargan\w*/i.test(text)) add("s arganovým olejem", "ano");
  if (/\bbio\b/i.test(p.name)) add("BIO", "ano");
  if (/bez parfemace|bez parfém/i.test(text)) add("bez parfemace", "ano");
  if (/bez parabenů/i.test(text)) add("bez parabenů", "ano");
  if (/bez silikonů/i.test(text)) add("bez silikonů", "ano");
  if (/antibakteri/i.test(text)) add("antibakteriální", "ano");
  if (/hypoalergen/i.test(text)) add("hypoalergenní", "ano");
  if (/vyživ/i.test(text)) add("vyživující", "ano");

  return out;
}
