// Volume is never a separate DB field — supplier feeds bake it into the
// product name ("… 100 ml"), so every consumer (spec table, variant
// grouping, size selector) parses it from the same regex instead of each
// re-deriving its own slightly different version.
const VOLUME_PATTERN = /(\d+(?:[.,]\d+)?)\s*ml\b/i;

// Weight fallback for the ~10 % of the catalog priced by weight rather than
// volume (candles, bath salts, lip balms, pressed powders) — same
// name-parsing idea, just grams/kg instead of ml. Checked against the full
// live catalog before shipping this: no false positives from shade codes
// ("7.0", "05G") — those lack a bare digit-immediately-before-g/kg — or from
// "mg" (the "m" blocks the g/kg match). Kept separate from VOLUME_PATTERN
// (rather than merged into one alternation) because callers that need an ml
// number (parseVolumeMl, for sorting same-product size variants) must never
// silently receive a gram value under the same unit.
const WEIGHT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i;

export function parseVolumeMl(name: string): number | null {
  const match = name.match(VOLUME_PATTERN);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function formatVolumeLabel(name: string): string | null {
  const mlMatch = name.match(VOLUME_PATTERN);
  if (mlMatch) return `${mlMatch[1]} ml`;
  const weightMatch = name.match(WEIGHT_PATTERN);
  return weightMatch ? `${weightMatch[1]} ${weightMatch[2].toLowerCase()}` : null;
}

/** Name with the volume/weight token removed and whitespace collapsed — the variant-grouping key input. */
export function stripVolume(name: string): string {
  return name
    .replace(VOLUME_PATTERN, " ")
    .replace(WEIGHT_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}
