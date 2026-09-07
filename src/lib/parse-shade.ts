// Color-cosmetics shade grouping (scripts/group-shade-variants.ts) — same
// idea as parse-volume.ts's size grouping, but there's no universal regex
// for a shade the way "NNml" works for volume: brands write shade codes as
// "1N Ivory", "06 Ventana", "4W Golden Natural", etc. Scoped to a known
// word list + numeric-code pattern, validated only against Dekorativní
// kosmetika (see that script's header) — do not assume this generalizes to
// scent/type variation elsewhere in the catalog (soaps, shower gels, ...),
// which this was NOT built or checked against and reads as noise there.
const COLOR_WORDS = new Set([
  "ivory", "beige", "rose", "golden", "natural", "nude", "fair", "medium", "dark", "tan", "sand",
  "honey", "caramel", "vanilla", "porcelain", "warm", "cool", "neutral", "light", "cream", "cocoa",
  "chestnut", "almond", "biscuit", "peach", "coral", "red", "pink", "bronze", "gold", "silver",
  "black", "brown", "blonde", "blond", "auburn", "chocolate", "mocha", "toffee", "hazelnut",
  "cinnamon", "sable", "sepia", "charcoal", "taupe", "mauve", "plum", "berry", "wine", "shell",
  "linen", "cameo",
]);

// "1N", "06", "4W", "4.1" — a short numeric code, optionally with a trailing
// letter or decimal sub-shade.
function looksLikeShadeCode(word: string): boolean {
  const w = word.replace(",", ".");
  return /^\d{1,3}(\.\d{1,2})?[a-z]{0,2}$/i.test(w) && w.length <= 6;
}

/**
 * Finds where the trailing shade descriptor starts in a product name's word
 * list — e.g. ["True", "Match", ..., "4W", "Golden", "Natural"] -> index of
 * "4W". Scans backward, extending through consecutive matching words; if
 * the last word isn't a match at all, looks up to 4 words back for one to
 * start from (handles a trailing unit/model word after the real shade).
 * Returns `words.length` (nothing to strip) when no shade tail is found.
 */
function findShadeCut(words: string[]): number {
  let cut = words.length;
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i].toLowerCase().replace(/[()]/g, "");
    if (COLOR_WORDS.has(w) || looksLikeShadeCode(words[i])) {
      cut = i;
    } else if (cut !== words.length) {
      break;
    } else if (words.length - i > 4) {
      break;
    }
  }
  return cut;
}

/** The trailing shade portion of a name ("06 Ventana"), or null if none was found. */
export function parseShadeLabel(name: string): string | null {
  const words = name.trim().split(/\s+/);
  const cut = findShadeCut(words);
  if (cut === words.length) return null;
  const label = words.slice(cut).join(" ").trim();
  return label || null;
}

/** Name with the trailing shade portion removed — the variant-grouping key input. */
export function stripShade(name: string): string {
  const words = name.trim().split(/\s+/);
  const cut = findShadeCut(words);
  return words.slice(0, cut).join(" ").trim();
}
