/**
 * Collapses Order.trafficSource (free text set by the AttributionTracker, see
 * prisma/schema.prisma) into the handful of channels the owner reasons about.
 * Heureka alone shows up as dozens of values (`pletove-kremy.heureka.cz`, …),
 * one per category page the click came from.
 */
export const NO_SOURCE = "Bez zdroje";

export function trafficChannel(source: string | null | undefined): string {
  const s = source?.trim();
  if (!s) return NO_SOURCE;
  const l = s.toLowerCase();
  if (l.includes("heureka")) return "Heureka";
  if (l.includes("zbo")) return "Zboží.cz";
  if (l.includes("glami")) return "Glami";
  if (l.includes("google") && l.includes("organ")) return "Google (organické)";
  if (l.includes("google")) return "Google (placené/ostatní)";
  if (l.includes("seznam")) return "Seznam (vyhledávání)";
  if (l.includes("přím") || l.includes("prim")) return "Přímá návštěva";
  if (l.includes("chatgpt") || l.includes("gemini") || l.includes("perplexity") || l.includes("claude")) return "AI asistenti";
  return s;
}
