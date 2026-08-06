import type { PrismaClient } from "@prisma/client";
import { slugify } from "@/lib/slug";

/**
 * Resolves a Shoptet-style `categoryText` ("Parent > Subcategory", TZ §6.2)
 * into a leaf Category id, creating any missing categories along the chain.
 * Splits on ">" so it also tolerates a single segment or deeper chains.
 */
export async function resolveCategoryPath(
  tx: PrismaClient,
  categoryText: string,
): Promise<string | null> {
  const segments = categoryText
    .split(">")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (segments.length === 0) return null;

  let parentId: string | null = null;
  let parentFullSlug: string | null = null;
  let category: { id: string } | null = null;

  for (const name of segments) {
    const slug = slugify(name);
    const fullSlug: string = parentFullSlug ? `${parentFullSlug}/${slug}` : slug;
    category = await tx.category.upsert({
      where: { fullSlug },
      update: {},
      create: { name, slug, fullSlug, parentId: parentId ?? undefined },
    });
    parentId = category.id;
    parentFullSlug = fullSlug;
  }

  return category?.id ?? null;
}
