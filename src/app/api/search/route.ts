import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";
import { skScope } from "@/lib/sk-visibility";
import {
  buildDescriptionSearchWhere,
  buildExactSearchWhere,
  findFuzzyProductIds,
  findTokenProductIds,
} from "@/lib/product-search";

// Fires on every keystroke from the client — unlike the other public routes
// this had no length cap or rate limit at all (security audit finding),
// which made it the cheapest lever for a DB-load DoS.
const MAX_QUERY_LENGTH = 100;
const MAX_ATTEMPTS = 60;
const WINDOW_MS = 60 * 1000;
const RESULT_LIMIT = 8;

const PRODUCT_INCLUDE = { brand: true, images: { orderBy: { sortOrder: "asc" as const }, take: 1 } };

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`search:${ip}`, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Příliš mnoho požadavků." }, { status: 429 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length < 2) return NextResponse.json({ results: [] });

  await recordRateLimitHit(`search:${ip}`);
  const isSk = req.nextUrl.searchParams.get("lang") === "sk";

  // Three tiers so a typo ("Latafa" for "Lattafa") or a word that's only in
  // the description doesn't come back empty — see product-search.ts.
  let products = await prisma.product.findMany({
    where: skScope({ visible: true, ...buildExactSearchWhere(q) }, isSk),
    take: RESULT_LIMIT,
    include: PRODUCT_INCLUDE,
  });

  // Every word on its own (multi-word queries, Czech word forms, synonyms) —
  // IDs come back unscoped, so over-fetch and re-apply the SK scope here.
  const byIdOrder = async (ids: string[]) => {
    if (ids.length === 0) return [];
    const rows = await prisma.product.findMany({
      where: skScope({ id: { in: ids }, visible: true }, isSk),
      include: PRODUCT_INCLUDE,
    });
    const byId = new Map(rows.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p)).slice(0, RESULT_LIMIT);
  };
  if (products.length === 0) {
    products = await byIdOrder(await findTokenProductIds(q, RESULT_LIMIT * 4, "all"));
  }

  if (products.length === 0) {
    products = await prisma.product.findMany({
      where: skScope({ visible: true, ...buildDescriptionSearchWhere(q) }, isSk),
      take: RESULT_LIMIT,
      include: PRODUCT_INCLUDE,
    });
  }

  if (products.length === 0) {
    products = await byIdOrder(await findTokenProductIds(q, RESULT_LIMIT * 4, "most"));
  }

  if (products.length === 0) {
    const fuzzyIds = await findFuzzyProductIds(q, RESULT_LIMIT);
    if (fuzzyIds.length > 0) {
      const fuzzyProducts = await prisma.product.findMany({
        where: skScope({ id: { in: fuzzyIds }, visible: true }, isSk),
        include: PRODUCT_INCLUDE,
      });
      const byId = new Map(fuzzyProducts.map((p) => [p.id, p]));
      products = fuzzyIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
    }
  }

  return NextResponse.json({
    results: products.map((p) => ({
      slug: p.slug,
      name: p.name,
      nameSk: p.nameSk,
      brand: p.brand?.name ?? null,
      price: Number(p.price),
      image: p.images[0]?.url ?? null,
    })),
  });
}
