import { prisma } from "@/lib/prisma";
import { parseShadeLabel, SHADE_SWATCH_COLORS } from "@/lib/parse-shade";

export interface ColorSwatch {
  label: string;
  color: string;
}

/**
 * For listing cards: the in-stock colours of each colour-variant group
 * (same groups the product-page circles use), so a card can show at a
 * glance that the item comes in several colours. Groups that aren't purely
 * known colours, or have fewer than two colours in stock, get nothing.
 */
export async function attachColorSwatches<T extends { variantGroupKey: string | null }>(
  products: T[],
): Promise<(T & { colorSwatches?: ColorSwatch[] })[]> {
  const keys = [...new Set(products.map((p) => p.variantGroupKey).filter((k): k is string => !!k))];
  if (keys.length === 0) return products;

  const members = await prisma.product.findMany({
    where: { variantGroupKey: { in: keys }, visible: true },
    select: { variantGroupKey: true, name: true, stock: true },
  });

  const byKey = new Map<string, typeof members>();
  for (const m of members) {
    const list = byKey.get(m.variantGroupKey!) ?? [];
    list.push(m);
    byKey.set(m.variantGroupKey!, list);
  }

  const swatchesByKey = new Map<string, ColorSwatch[]>();
  for (const [key, group] of byKey) {
    const labelled = group.map((m) => ({ label: parseShadeLabel(m.name)?.toLowerCase() ?? "", stock: m.stock }));
    if (!labelled.every((m) => SHADE_SWATCH_COLORS[m.label])) continue;
    const swatches = labelled
      .filter((m) => m.stock > 0)
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((m) => ({ label: m.label, color: SHADE_SWATCH_COLORS[m.label] }));
    if (swatches.length > 1) swatchesByKey.set(key, swatches);
  }

  return products.map((p) => {
    const swatches = p.variantGroupKey ? swatchesByKey.get(p.variantGroupKey) : undefined;
    return swatches ? { ...p, colorSwatches: swatches } : p;
  });
}
