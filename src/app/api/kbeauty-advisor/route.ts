import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findCategoryByFullSlug } from "@/lib/categories.server";
import { getDescendantCategoryIds } from "@/lib/category-descendants.server";
import { buildOrderBy, buildProductWhere, parseFilterParams } from "@/lib/product-filters";
import { skScope } from "@/lib/sk-visibility";

const CATEGORY = "kosmetika/korejska-kosmetika";

/**
 * Backs the K-beauty "Poradce výběru" quiz (src/components/kbeauty-advisor.tsx): turns the answers (skin type,
 * main concern, product kind) into a filtered shortlist. The strict combination often matches nothing, so it
 * relaxes step by step — drop the product kind, then the skin type — and tells the UI what it had to drop.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const answers = { skinType: sp.get("skinType") ?? "", concern: sp.get("concern") ?? "", kind: sp.get("kind") ?? "" };
  const isSk = sp.get("lang") === "sk";

  const category = await findCategoryByFullSlug(CATEGORY);
  if (!category) return NextResponse.json({ error: "Kategorie nenalezena." }, { status: 404 });
  const categoryIds = await getDescendantCategoryIds(category.id);
  const baseWhere = skScope({ categories: { some: { categoryId: { in: categoryIds } } } }, isSk);

  const attempts: { params: typeof answers; dropped: string[] }[] = [
    { params: answers, dropped: [] },
    { params: { ...answers, kind: "" }, dropped: ["kind"] },
    { params: { ...answers, kind: "", skinType: "" }, dropped: ["kind", "skinType"] },
    { params: { skinType: "", concern: "", kind: "" }, dropped: ["kind", "skinType", "concern"] },
  ];
  // Several attempts can be identical (an unanswered question) — skip repeats so we don't query twice.
  const seen = new Set<string>();
  const unique = attempts.filter((a) => {
    const key = `${a.params.skinType}|${a.params.concern}|${a.params.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let chosen = unique[unique.length - 1]!;
  let chosenTotal = 0;
  for (const attempt of unique) {
    const filters = parseFilterParams({
      skinType: attempt.params.skinType || undefined,
      concern: attempt.params.concern || undefined,
      kind: attempt.params.kind || undefined,
    });
    const total = await prisma.product.count({ where: buildProductWhere(baseWhere, filters) });
    if (total >= 3) {
      chosen = attempt;
      chosenTotal = total;
      break;
    }
    if (total > 0 && chosenTotal === 0) {
      chosen = attempt;
      chosenTotal = total;
    }
  }

  const filters = parseFilterParams({
    skinType: chosen.params.skinType || undefined,
    concern: chosen.params.concern || undefined,
    kind: chosen.params.kind || undefined,
  });
  const where = buildProductWhere(baseWhere, filters);
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: buildOrderBy("newest"),
      take: 4,
      include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
  ]);

  const query = new URLSearchParams();
  if (chosen.params.skinType) query.set("skinType", chosen.params.skinType);
  if (chosen.params.concern) query.set("concern", chosen.params.concern);
  if (chosen.params.kind) query.set("kind", chosen.params.kind);

  return NextResponse.json({
    total,
    dropped: chosen.dropped,
    path: `/kategorie/${CATEGORY}${query.toString() ? `?${query.toString()}` : ""}`,
    products: products.map((p) => ({
      id: p.id,
      code: p.code,
      slug: p.slug,
      name: p.name,
      nameSk: p.nameSk,
      price: p.price.toString(),
      compareAtPrice: p.compareAtPrice?.toString() ?? null,
      stock: p.stock,
      isDefective: p.isDefective,
      salesCount: p.salesCount,
      isVegan: p.isVegan,
      isCrueltyFree: p.isCrueltyFree,
      brand: p.brand ? { name: p.brand.name } : null,
      images: p.images.map((img) => ({ url: img.url })),
    })),
  });
}
