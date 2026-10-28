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
    benefits: splitBenefits(benefitsText),
    skin: skinKeys,
    dayTimes,
  };
}
