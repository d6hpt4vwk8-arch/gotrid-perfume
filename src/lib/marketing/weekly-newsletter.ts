import { prisma } from "@/lib/prisma";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";
import { getComplementProducts, getRelatedProducts } from "@/lib/related-products.server";
import { MANUFACTURER_REFERENCE_PRICE_BRANDS } from "@/lib/reference-price";
import {
  getCategoryIdsUnderRoot,
  recommendProductsForBuyer,
  rootsForTheme,
  type RecommendationTheme,
  type RecommendedProduct,
} from "./recommend-products";

const COUNTABLE_STATUSES = ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
const MAX_DEALS = 2;
const MAX_COMPLEMENTS = 2;
// A crossed-out price only counts as a deal when it is clearly above the current one.
const MIN_DEAL_RATIO = 1.1;

export interface DealProduct extends RecommendedProduct {
  compareAtPrice: number;
}

/** What one buyer would get in the weekly e-mail — computed without sending anything. */
export interface WeeklyNewsletterPlan {
  email: string;
  firstName: string;
  theme: RecommendationTheme;
  categoryName: string | null;
  ctaPath: string;
  /** "Pro vás tento týden": bestsellers from the category the buyer bought from most. */
  picks: RecommendedProduct[];
  /** "K tomu se hodí": cheap complements to the last thing they bought. */
  complementOf: string | null;
  complements: RecommendedProduct[];
  /** "Teď zlevněno": real crossed-out prices in the buyer's category (never Palacio's manufacturer reference prices). */
  deals: DealProduct[];
  subject: string;
  preheader: string;
}

function toRecommended(p: {
  id: string;
  name: string;
  nameSk: string | null;
  slug: string;
  price: unknown;
  images: { url: string }[];
}): RecommendedProduct {
  return { id: p.id, name: p.name, nameSk: p.nameSk, slug: p.slug, price: Number(p.price), imageUrl: p.images[0]?.url ?? null };
}

function subjectFor(theme: RecommendationTheme, categoryName: string | null): string {
  if (theme === "perfume") return "Týdenní výběr: parfémy";
  if (theme === "home_fragrance") return "Týdenní výběr: vůně do domova a auta";
  return categoryName ? `Týdenní výběr: ${categoryName.toLowerCase()}` : "Týdenní výběr z našeho e-shopu";
}

/**
 * Picks the three blocks of the weekly e-mail for one buyer from what they have actually ordered:
 * the category they buy from most (bestsellers they don't own yet), complements to the last item,
 * and any real discounts in that category. Stock rule is only "orderable" (visible, stock > 0) —
 * deliberately not limited to the own warehouse (owner, 2026-10-28).
 */
export async function planWeeklyNewsletter(email: string, firstName: string): Promise<WeeklyNewsletterPlan> {
  const rec = await recommendProductsForBuyer(email);

  const orderItems = await prisma.orderItem.findMany({
    where: {
      order: { email: { equals: email, mode: "insensitive" }, status: { in: [...COUNTABLE_STATUSES] } },
      productId: { not: null },
      isGift: false,
    },
    orderBy: { order: { createdAt: "desc" } },
    select: {
      product: {
        select: {
          id: true,
          name: true,
          code: true,
          price: true,
          brandId: true,
          concentration: true,
          productType: true,
          occasions: true,
          keyIngredients: true,
        },
      },
    },
  });
  const purchased = orderItems.flatMap((i) => (i.product ? [i.product] : []));
  const purchasedIds = new Set(purchased.map((p) => p.id));
  const last = purchased[0] ?? null;

  // "Pro vás": products similar to what they bought last (same specific category, scent, skin concern…) first —
  // a buyer of an acne cream should not be pitched shampoo just because both sit under "Kosmetika". The root-category
  // bestsellers only fill the gaps.
  const relatedRows = last ? await getRelatedProducts(last, false, 12) : [];
  const picks = relatedRows.filter((p) => !purchasedIds.has(p.id) && !isConditionFlagged(p.name, p.isDefective)).slice(0, 3).map(toRecommended);
  for (const p of rec.products) {
    if (picks.length >= 3) break;
    if (!picks.some((x) => x.id === p.id)) picks.push(p);
  }

  const taken = new Set<string>([...purchasedIds, ...picks.map((p) => p.id)]);

  const complementRows = last ? await getComplementProducts(last, false, MAX_COMPLEMENTS + 2) : [];
  const complements = complementRows
    .filter((p) => !taken.has(p.id) && !isConditionFlagged(p.name, p.isDefective))
    .slice(0, MAX_COMPLEMENTS)
    .map(toRecommended);
  complements.forEach((p) => taken.add(p.id));

  const rootIds = (await Promise.all(rootsForTheme(rec.theme, rec.categoryName).map(getCategoryIdsUnderRoot))).flat();
  const dealRows = rootIds.length
    ? await prisma.product.findMany({
        where: {
          visible: true,
          stock: { gt: 0 },
          isDefective: false,
          compareAtPrice: { not: null },
          id: { notIn: [...taken] },
          categories: { some: { categoryId: { in: rootIds } } },
          NOT: { brand: { name: { in: MANUFACTURER_REFERENCE_PRICE_BRANDS } } },
        },
        select: {
          id: true,
          name: true,
          nameSk: true,
          slug: true,
          price: true,
          compareAtPrice: true,
          isDefective: true,
          images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
        },
        take: 80,
      })
    : [];
  const deals: DealProduct[] = dealRows
    .filter((p) => !isConditionFlagged(p.name, p.isDefective))
    .map((p) => ({ ...toRecommended(p), compareAtPrice: Number(p.compareAtPrice) }))
    .filter((p) => p.compareAtPrice >= p.price * MIN_DEAL_RATIO)
    .sort((a, b) => b.compareAtPrice / b.price - a.compareAtPrice / a.price)
    .slice(0, MAX_DEALS);

  return {
    email,
    firstName,
    theme: rec.theme,
    categoryName: rec.categoryName,
    ctaPath: rec.ctaPath,
    picks,
    complementOf: last?.name ?? null,
    complements,
    deals,
    subject: subjectFor(rec.theme, rec.categoryName),
    preheader: firstName ? `${firstName}, tady je výběr podle toho, co jste u nás nakupovali.` : "Výběr podle toho, co jste u nás nakupovali.",
  };
}
