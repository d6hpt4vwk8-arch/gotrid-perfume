// K-beauty descriptions follow one pattern: an intro paragraph, then a list with the labelled facts
//   <li><strong>Pro koho:</strong> …</li><li><strong>Použití:</strong> …</li><li><strong>Hlavní přínosy:</strong> a, b, c</li>
// (Slovak copy: Pre koho / Použitie / Hlavné prínosy). Pulling them out lets the product page show them as icon
// cards instead of a plain bullet list — no per-product data, so every product with the pattern gets it.

export type SkinKey = "all" | "dry" | "oily" | "combo" | "sensitive" | "blemish" | "normal" | "mature";
export type DayTime = "am" | "pm";

export interface DescriptionFacts {
  /** Description HTML before the facts list (intro paragraphs). */
  introHtml: string;
  forWhom: string;
  usage: string;
  benefits: string[];
  skin: SkinKey[];
  dayTimes: DayTime[];
}

const LABELS = {
  forWhom: /^(pro koho|pre koho)$/i,
  usage: /^(použití|použitie)$/i,
  benefits: /^(hlavní přínosy|hlavné prínosy)$/i,
};

const SKIN_PATTERNS: [SkinKey, RegExp][] = [
  ["all", /všechny typy|všetky typy|každý typ|každého typu/i],
  ["dry", /such[áéouý]|dehydrat/i],
  ["oily", /mastn/i],
  ["combo", /smíšen|zmiešan/i],
  ["sensitive", /citliv/i],
  ["blemish", /akn[ée]|problematick|nečist/i],
  ["normal", /normáln/i],
  ["mature", /zral|vrásk|vrások/i],
];

function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits a benefits string on commas that are not inside brackets. */
function splitBenefits(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim().replace(/\.$/, "")).filter(Boolean);
}

/** The labelled facts of a K-beauty description, or null when the description doesn't follow the pattern. */
export function parseDescriptionFacts(html: string | null | undefined): DescriptionFacts | null {
  if (!html) return null;
  const listStart = html.indexOf("<ul");
  if (listStart === -1) return null;
  const items = [...html.slice(listStart).matchAll(/<li>\s*<strong>([^<]+?)\s*:?\s*<\/strong>\s*:?\s*([\s\S]*?)<\/li>/gi)];
  let forWhom = "";
  let usage = "";
  let benefitsText = "";
  for (const [, label, value] of items) {
    const l = label!.trim().replace(/:$/, "");
    if (LABELS.forWhom.test(l)) forWhom = plain(value!);
    else if (LABELS.usage.test(l)) usage = plain(value!);
    else if (LABELS.benefits.test(l)) benefitsText = plain(value!);
  }
  if (!forWhom || !usage || !benefitsText) return null;

  const skin = SKIN_PATTERNS.filter(([, re]) => re.test(forWhom)).map(([key]) => key);
  // "všechny typy pleti" already says it all — don't add a second chip next to it.
  const skinKeys = skin.includes("all") ? (["all"] as SkinKey[]) : skin;
  const dayTimes: DayTime[] = [];
  if (/ráno|ranní|rána/i.test(usage)) dayTimes.push("am");
  if (/večer|večerní|na noc|noční|nočn/i.test(usage)) dayTimes.push("pm");

  return {
    introHtml: html.slice(0, listStart),
    forWhom,
    usage,
    // A bare quantity ("50 ml", "2 ks") is the pack size, not a benefit — the import put it in the list.
    benefits: splitBenefits(benefitsText).filter((b) => !/^\d+(?:[.,]\d+)?\s?(?:ml|g|kg|l|ks|ks\.)$/i.test(b)),
    skin: skinKeys,
    dayTimes,
  };
}

// Scent descriptions (perfumes, candles, car fresheners, diffusers) use a second label set:
//   perfumes: Hlavní tóny / Kdy ji nosit / Charakter      home scents: Vůně / Doba hoření / Pro koho / Použití
// (Slovak: Hlavné tóny / Kedy ju nosiť / Vôňa / Doba horenia / Pre koho / Použitie). Shown as note tiles,
// season chips and character tags — see ProductScentCards.

export type Season = "spring" | "summer" | "autumn" | "winter";
export type ScentTime = "day" | "evening";

export interface ScentFacts {
  introHtml: string;
  /** "Hlavní tóny" (perfume notes) or "Vůně" (home scent) — decides the heading. */
  notesKind: "tones" | "scent";
  notes: string[];
  when: string;
  seasons: Season[];
  times: ScentTime[];
  character: string[];
  /** Free text when the character doesn't split into short tags. */
  characterText: string;
  /** Burn time; empty when the import only said "dle výrobce". */
  burn: string;
  forWhom: string[];
  forWhomText: string;
  usage: string;
}

const SCENT_LABELS = {
  tones: /^(hlavní tóny|hlavné tóny)$/i,
  scent: /^(vůně|vôňa)$/i,
  when: /^(kdy ji nosit|kedy ju nosiť)$/i,
  character: /^(charakter)$/i,
  burn: /^(doba hoření|doba horenia)$/i,
  forWhom: /^(pro koho|pre koho)$/i,
  usage: /^(použití|použitie)$/i,
};

const SEASON_PATTERNS: [Season, RegExp][] = [
  ["spring", /\bjar[eouy]?\b|jaře|jarn/i],
  ["summer", /léto|létě|letn|\blet[eo]\b|\blete\b/i],
  ["autumn", /podzim|podzimn|jeseň|jesen/i],
  ["winter", /\bzim[aěuy]?\b|zimě|zimn/i],
];

/** Tags only when every piece is a short phrase; otherwise the caller falls back to the plain sentence. */
function shortTags(text: string): string[] {
  const parts = text
    .split(/,|\s+a\s+|\s+i\s+/)
    .map((p) => p.trim().replace(/\.$/, ""))
    .filter(Boolean);
  return parts.length > 0 && parts.every((p) => p.split(/\s+/).length <= 2 && p.length <= 22) ? parts : [];
}

export function parseScentFacts(html: string | null | undefined): ScentFacts | null {
  if (!html) return null;
  const listStart = html.indexOf("<ul");
  if (listStart === -1) return null;
  const items = [...html.slice(listStart).matchAll(/<li>\s*<strong>([^<]+?)\s*:?\s*<\/strong>\s*:?\s*([\s\S]*?)<\/li>/gi)];
  const v: Record<string, string> = {};
  let notesKind: ScentFacts["notesKind"] = "tones";
  for (const [, label, value] of items) {
    const l = label!.trim().replace(/:$/, "");
    for (const key of Object.keys(SCENT_LABELS) as (keyof typeof SCENT_LABELS)[]) {
      if (SCENT_LABELS[key].test(l)) {
        v[key] = plain(value!);
        if (key === "scent") notesKind = "scent";
      }
    }
  }
  const notesText = v.tones || v.scent || "";
  const notes = notesText ? splitBenefits(notesText) : [];
  const when = v.when ?? "";
  const characterText = v.character ?? "";
  // Needs something a card can show beyond the plain list: notes, or when/character.
  if (notes.length === 0 && !when && !characterText) return null;

  const allYear = /celý rok|celoročn|každé období|po celý rok/i.test(when);
  const seasons = allYear ? (["spring", "summer", "autumn", "winter"] as Season[]) : SEASON_PATTERNS.filter(([, re]) => re.test(when)).map(([k]) => k);
  const times: ScentTime[] = [];
  if (/\bden\b|denní|dne\b|odpoledn|dopoledn|popoludn|ráno|deň|dňa|přes den/i.test(when)) times.push("day");
  if (/večer|večern|noc\b|noční|nočn/i.test(when)) times.push("evening");

  const burn = v.burn && !/dle výrobce|podľa výrobcu/i.test(v.burn) ? v.burn : "";
  const character = shortTags(characterText);
  const forWhom = v.forWhom ? shortTags(v.forWhom) : [];

  return {
    introHtml: html.slice(0, listStart),
    notesKind,
    notes: notes.filter((n) => !/^\d+(?:[.,]\d+)?\s?(?:ml|g|kg|l|ks|ks\.)$/i.test(n)),
    when,
    seasons,
    times,
    character,
    characterText: character.length ? "" : characterText,
    burn,
    forWhom,
    forWhomText: forWhom.length ? "" : (v.forWhom ?? ""),
    usage: v.usage ?? "",
  };
}
