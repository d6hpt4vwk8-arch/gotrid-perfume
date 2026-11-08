import type { FeedParam, FeedProduct } from "./get-feed-products";

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
  return null;
}

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

  if (p.isVegan) add("vegan", "ano");

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
