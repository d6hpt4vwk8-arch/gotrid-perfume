// Volume is never a separate DB field — supplier feeds bake it into the
// product name ("… 100 ml"), so every consumer (spec table, variant
// grouping, size selector) parses it from the same regex instead of each
// re-deriving its own slightly different version.
const VOLUME_PATTERN = /(\d+(?:[.,]\d+)?)\s*ml\b/i;

export function parseVolumeMl(name: string): number | null {
  const match = name.match(VOLUME_PATTERN);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export function formatVolumeLabel(name: string): string | null {
  const match = name.match(VOLUME_PATTERN);
  return match ? `${match[1]} ml` : null;
}

/** Name with the volume token removed and whitespace collapsed — the variant-grouping key input. */
export function stripVolume(name: string): string {
  return name.replace(VOLUME_PATTERN, " ").replace(/\s+/g, " ").trim();
}
