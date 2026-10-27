import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { primaryVariantWhere } from "@/lib/product-filters";
import { skScope } from "@/lib/sk-visibility";

/**
 * "Podobné produkty" and "Hodí se k tomu" on the product page.
 *
 * Before 2026-10-27 "related" was simply the first 8 in-stock products sharing
 * ANY category with the product, ordered by priority — so every face cream
 * showed the same hand creams, anything also tagged "Výprodej" (a cross-cutting
 * clearance tag) got hair conditioner and eyelashes, and every Arabic perfume
 * got the same 8 perfumes. Now the candidates are scored by real similarity.
 */

/** Cross-cutting or catch-all categories that say nothing about what a product is. */
const GENERIC_CATEGORY_NAMES = new Set(["Výprodej", "Doplňky", "Dárkové sady", "Ostatní"]);

const cardInclude = { brand: true, images: { orderBy: { sortOrder: "asc" as const }, take: 1 } };

type SimilarityBase = {
  id: string;
  name: string;
  price: Prisma.Decimal | number;
  brandId: string | null;
  concentration: string | null;
  productType: string | null;
  occasions: string[];
  keyIngredients: string[];
};

const candidateSelect = {
  id: true,
  name: true,
  price: true,
  brandId: true,
  concentration: true,
  productType: true,
  occasions: true,
  keyIngredients: true,
  priority: true,
  ownStock: true,
  salesCount: true,
  categories: { select: { categoryId: true } },
  scentFamilies: { select: { scentFamilyId: true } },
  concerns: { select: { concernId: true } },
  skinTypes: { select: { skinTypeId: true } },
} satisfies Prisma.ProductSelect;

type Candidate = Prisma.ProductGetPayload<{ select: typeof candidateSelect }>;
type CardProduct = Prisma.ProductGetPayload<{ include: typeof cardInclude }>;

function overlap<T>(a: T[], b: T[]): number {
  const set = new Set(a);
  return b.filter((x) => set.has(x)).length;
}

/** At most `perGroup` products per brand + first two words of the name ("Palette Color Shampoo …" x4 is one suggestion, not four). */
function diversify<T extends { brandId: string | null; name: string }>(ranked: T[], limit: number, perGroup = 2): T[] {
  const taken = new Map<string, number>();
  const out: T[] = [];
  for (const p of ranked) {
    const key = `${p.brandId ?? "-"}|${p.name.toLowerCase().split(/\s+/).slice(0, 2).join(" ")}`;
    const n = taken.get(key) ?? 0;
    if (n >= perGroup) continue;
    taken.set(key, n + 1);
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Category ids of a product, minus the generic ones — and the set of those that are leaves (most specific). */
async function specificCategories(productId: string) {
  const own = await prisma.productCategory.findMany({
    where: { productId },
    select: { categoryId: true, category: { select: { name: true } } },
  });
  const ids = own.filter((c) => !GENERIC_CATEGORY_NAMES.has(c.category.name)).map((c) => c.categoryId);
  if (ids.length === 0) return { ids: [] as string[], leaves: new Set<string>() };
  const parents = await prisma.category.findMany({ where: { parentId: { in: ids } }, select: { parentId: true } });
  const hasChild = new Set(parents.map((p) => p.parentId));
  return { ids, leaves: new Set(ids.filter((id) => !hasChild.has(id))) };
}

export async function getRelatedProducts(
  product: SimilarityBase,
  isSk: boolean,
  limit = 8,
) {
  const { ids: categoryIds, leaves } = await specificCategories(product.id);
  if (categoryIds.length === 0) return [];

  const me = await prisma.product.findUnique({
    where: { id: product.id },
    select: { scentFamilies: { select: { scentFamilyId: true } }, concerns: { select: { concernId: true } }, skinTypes: { select: { skinTypeId: true } } },
  });
  const myScents = me?.scentFamilies.map((s) => s.scentFamilyId) ?? [];
  const myConcerns = me?.concerns.map((c) => c.concernId) ?? [];
  const mySkin = me?.skinTypes.map((s) => s.skinTypeId) ?? [];

  const baseWhere: Prisma.ProductWhereInput = { id: { not: product.id }, visible: true, stock: { gt: 0 }, ...primaryVariantWhere };
  const poolOrder = [{ ownStock: "desc" }, { salesCount: "desc" }, { priority: "desc" }] as const;

  // Candidate pool = best-selling in the same specific categories, plus same-brand and same-scent
  // products (a top-by-priority slice of a 700-perfume category alone would hide the real neighbours).
  const [byCategory, byBrand, byScent, byConcern] = await Promise.all([
    prisma.product.findMany({
      where: skScope({ ...baseWhere, categories: { some: { categoryId: { in: categoryIds } } } }, isSk),
      select: candidateSelect,
      orderBy: [...poolOrder],
      take: 150,
    }),
    product.brandId
      ? prisma.product.findMany({
          where: skScope({ ...baseWhere, brandId: product.brandId, categories: { some: { categoryId: { in: categoryIds } } } }, isSk),
          select: candidateSelect,
          orderBy: [...poolOrder],
          take: 40,
        })
      : Promise.resolve([] as Candidate[]),
    myScents.length > 0
      ? prisma.product.findMany({
          where: skScope({ ...baseWhere, scentFamilies: { some: { scentFamilyId: { in: myScents } } }, categories: { some: { categoryId: { in: categoryIds } } } }, isSk),
          select: candidateSelect,
          orderBy: [...poolOrder],
          take: 60,
        })
      : Promise.resolve([] as Candidate[]),
    myConcerns.length > 0
      ? prisma.product.findMany({
          where: skScope({ ...baseWhere, concerns: { some: { concernId: { in: myConcerns } } } }, isSk),
          select: candidateSelect,
          orderBy: [...poolOrder],
          take: 60,
        })
      : Promise.resolve([] as Candidate[]),
  ]);

  const pool = new Map<string, Candidate>();
  for (const c of [...byCategory, ...byBrand, ...byScent, ...byConcern]) pool.set(c.id, c);

  const myPrice = Number(product.price);
  const scored = [...pool.values()].map((c) => {
    const cats = c.categories.map((x) => x.categoryId);
    let score = 0;
    score += overlap(categoryIds, cats) * 1.5;
    score += [...leaves].filter((l) => cats.includes(l)).length * 3;
    if (product.brandId && c.brandId === product.brandId) score += 2;
    score += Math.min(3, overlap(myScents, c.scentFamilies.map((s) => s.scentFamilyId))) * 2;
    score += Math.min(3, overlap(myConcerns, c.concerns.map((x) => x.concernId))) * 2;
    score += Math.min(2, overlap(mySkin, c.skinTypes.map((s) => s.skinTypeId)));
    if (product.productType && c.productType === product.productType) score += 2;
    if (product.concentration && c.concentration === product.concentration) score += 1;
    score += Math.min(1, overlap(product.occasions, c.occasions));
    score += Math.min(2, overlap(product.keyIngredients, c.keyIngredients));
    const q = Number(c.price);
    if (myPrice > 0 && q > 0) {
      const ratio = Math.max(myPrice, q) / Math.min(myPrice, q);
      score += ratio <= 1.3 ? 2 : ratio <= 2 ? 1 : ratio > 3 ? -2 : 0;
    }
    if (c.ownStock > 0) score += 1.5;
    score += Math.min(1.5, Math.log10(1 + c.salesCount));
    score += c.priority / 100;
    return { c, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const top = diversify(scored.map((s) => s.c), limit);
  if (top.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: top.map((t) => t.id) } }, include: cardInclude });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return top.map((t) => byId.get(t.id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
}

// ---------------------------------------------------------------------------
// "Hodí se k tomu" — rule-based complements (co-purchase history is far too
// thin to fill the "Často kupováno spolu" block: 26 of ~6,000 in-stock products).
// ---------------------------------------------------------------------------

type Target = { path: string; sameBrandOnly?: boolean };

const COMPLEMENT_RULES: Record<string, Target[]> = {
  "Pleť>Pleťové krémy": [{ path: "Pleť>Čištění pleti" }, { path: "Pleť>Pleťová séra" }, { path: "Pleť>Péče o rty" }],
  "Pleť>Pleťová séra": [{ path: "Pleť>Pleťové krémy" }, { path: "Pleť>Čištění pleti" }],
  "Pleť>Čištění pleti": [{ path: "Pleť>Pleťové krémy" }, { path: "Pleť>Pleťové masky" }],
  "Pleť>Pleťové masky": [{ path: "Pleť>Čištění pleti" }, { path: "Pleť>Pleťové krémy" }],
  "Pleť>Pleťové peelingy": [{ path: "Pleť>Pleťové krémy" }, { path: "Pleť>Pleťové masky" }],
  "Vlasy>Šampony": [{ path: "Vlasy>Kondicionéry a balzámy" }, { path: "Vlasy>Vlasové masky" }],
  "Vlasy>Kondicionéry a balzámy": [{ path: "Vlasy>Šampony" }, { path: "Vlasy>Vlasové masky" }],
  "Vlasy>Vlasové masky": [{ path: "Vlasy>Šampony" }, { path: "Vlasy>Kondicionéry a balzámy" }],
  "Zuby>Zubní pasty": [{ path: "Zuby>Ústní vody" }, { path: "Zuby>Zubní kartáčky" }, { path: "Zuby>Zubní nitě" }],
  "Zuby>Zubní kartáčky": [{ path: "Zuby>Zubní pasty" }, { path: "Zuby>Ústní vody" }],
  "Zuby>Ústní vody": [{ path: "Zuby>Zubní pasty" }, { path: "Zuby>Zubní kartáčky" }],
  "Kosmetika>Sprchové gely": [{ path: "Tělo>Tělová mléka" }, { path: "Kosmetika>Tělové oleje" }, { path: "Tělo>Krém na ruce" }],
  "Tělo>Sprcha a koupel": [{ path: "Tělo>Tělová mléka" }, { path: "Péče o zdraví>Masážní gely", sameBrandOnly: true }, { path: "Tělo>Krém na ruce" }],
  "Tělo>Tělová mléka": [{ path: "Kosmetika>Sprchové gely" }, { path: "Tělo>Krém na ruce" }],
  "Tělo>Krém na ruce": [{ path: "Pleť>Péče o rty" }, { path: "Tělo>Tělová mléka" }],
  "Tělo>Deodoranty": [{ path: "Kosmetika>Sprchové gely" }, { path: "Tělo>Mýdla" }],
  "Péče o zdraví>Masážní gely": [{ path: "Tělo>Sprcha a koupel", sameBrandOnly: true }, { path: "Péče o zdraví>Masážní gely", sameBrandOnly: true }],
};

/** Perfumes: the same brand's deodorant / body milk / shower gel (the line's own care products). */
const PERFUME_TARGETS: Target[] = [
  { path: "Tělo>Deodoranty", sameBrandOnly: true },
  { path: "Tělo>Tělová mléka", sameBrandOnly: true },
  { path: "Kosmetika>Sprchové gely", sameBrandOnly: true },
];

/** Korejská kosmetika routine order: cleanser → toner → serum → cream → sun. */
const KBEAUTY_NEXT: Record<string, string[]> = {
  cisteni: ["tonika", "sera", "kremy"],
  tonika: ["sera", "kremy"],
  sera: ["kremy", "slunce"],
  kremy: ["slunce", "cisteni", "sera"],
  masky: ["cisteni", "kremy"],
  slunce: ["kremy", "cisteni"],
  peeling: ["kremy", "masky"],
  oci: ["sera", "kremy"],
};

async function categoryPathMap() {
  const cats = await prisma.category.findMany({ select: { id: true, name: true, parent: { select: { name: true } } } });
  const idsByPath = new Map<string, string[]>();
  const pathById = new Map<string, string>();
  for (const c of cats) {
    const path = c.parent ? `${c.parent.name}>${c.name}` : c.name;
    pathById.set(c.id, path);
    idsByPath.set(path, [...(idsByPath.get(path) ?? []), c.id]);
  }
  return { idsByPath, pathById };
}

/**
 * 1–4 inexpensive complementary products from other categories (cheap on purpose: a complement
 * pricier than the product itself costs conversion — cap is 1.2x its price, between 150 and 400 Kč).
 */
export async function getComplementProducts(
  product: SimilarityBase & { code?: string },
  isSk: boolean,
  limit = 4,
) {
  const own = await prisma.productCategory.findMany({ where: { productId: product.id }, select: { categoryId: true } });
  const { idsByPath, pathById } = await categoryPathMap();
  const ownPaths = own.map((o) => pathById.get(o.categoryId)).filter((p): p is string => Boolean(p));

  const isPerfume = ownPaths.some((p) => p.startsWith("Parfémy>") || /parfémy>/i.test(p));
  const kbeautyIds = idsByPath.get("Kosmetika>Korejská kosmetika") ?? [];
  const isKbeauty = ownPaths.includes("Kosmetika>Korejská kosmetika");

  let targets: Target[] = [];
  if (isPerfume) targets = PERFUME_TARGETS;
  else {
    for (const p of ownPaths) targets.push(...(COMPLEMENT_RULES[p] ?? []));
  }

  const price = Number(product.price);
  const cap = Math.min(400, Math.max(150, price * 1.2));
  const baseWhere: Prisma.ProductWhereInput = {
    id: { not: product.id },
    visible: true,
    stock: { gt: 0 },
    price: { lte: cap },
    isDefective: false,
    ...primaryVariantWhere,
  };
  const order = [{ ownStock: "desc" }, { salesCount: "desc" }, { priority: "desc" }] as const;
  const picked: string[] = [];
  const results: CardProduct[] = [];
  const take = (p: CardProduct) => {
    if (picked.includes(p.id) || results.length >= limit) return;
    picked.push(p.id);
    results.push(p);
  };

  if (isKbeauty && product.productType && KBEAUTY_NEXT[product.productType]) {
    for (const type of KBEAUTY_NEXT[product.productType]) {
      if (results.length >= limit) break;
      const found = await prisma.product.findFirst({
        where: skScope({ ...baseWhere, productType: type, categories: { some: { categoryId: { in: kbeautyIds } } }, id: { notIn: [...picked, product.id] } }, isSk),
        include: cardInclude,
        orderBy: [...order],
      });
      if (found) take(found);
    }
  }

  const seenTargets = new Set<string>();
  for (const t of targets) {
    if (results.length >= limit) break;
    const key = `${t.path}|${t.sameBrandOnly ? 1 : 0}`;
    if (seenTargets.has(key)) continue;
    seenTargets.add(key);
    const ids = idsByPath.get(t.path);
    if (!ids || (t.sameBrandOnly && !product.brandId)) continue;
    const where = (extra: Prisma.ProductWhereInput) =>
      skScope(
        { ...baseWhere, id: { notIn: [...picked, product.id] }, categories: { some: { categoryId: { in: ids } } }, ...extra },
        isSk,
      );
    // Same brand first (a Palacio gel suggests Palacio bath salt), then whatever sells.
    const sameBrand = product.brandId
      ? await prisma.product.findFirst({ where: where({ brandId: product.brandId }), include: cardInclude, orderBy: [...order] })
      : null;
    const found =
      sameBrand ??
      (t.sameBrandOnly ? null : await prisma.product.findFirst({ where: where({}), include: cardInclude, orderBy: [...order] }));
    if (found) take(found);
  }

  return results;
}
