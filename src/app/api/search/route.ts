import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";
import { buildDescriptionSearchWhere, buildExactSearchWhere, findFuzzyProductIds } from "@/lib/product-search";

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

  // Three tiers so a typo ("Latafa" for "Lattafa") or a word that's only in
  // the description doesn't come back empty — see product-search.ts.
  let products = await prisma.product.findMany({
    where: { visible: true, ...buildExactSearchWhere(q) },
    take: RESULT_LIMIT,
    include: PRODUCT_INCLUDE,
  });

  if (products.length === 0) {
    products = await prisma.product.findMany({
      where: { visible: true, ...buildDescriptionSearchWhere(q) },
      take: RESULT_LIMIT,
      include: PRODUCT_INCLUDE,
    });
  }

  if (products.length === 0) {
    const fuzzyIds = await findFuzzyProductIds(q, RESULT_LIMIT);
    if (fuzzyIds.length > 0) {
      const fuzzyProducts = await prisma.product.findMany({
        where: { id: { in: fuzzyIds }, visible: true },
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
      brand: p.brand?.name ?? null,
      price: Number(p.price),
      image: p.images[0]?.url ?? null,
    })),
  });
}
