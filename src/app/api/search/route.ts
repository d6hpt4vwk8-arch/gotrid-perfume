import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

// Fires on every keystroke from the client — unlike the other public routes
// this had no length cap or rate limit at all (security audit finding),
// which made it the cheapest lever for a DB-load DoS.
const MAX_QUERY_LENGTH = 100;
const MAX_ATTEMPTS = 60;
const WINDOW_MS = 60 * 1000;

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`search:${ip}`, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Příliš mnoho požadavků." }, { status: 429 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length < 2) return NextResponse.json({ results: [] });

  await recordRateLimitHit(`search:${ip}`);

  const products = await prisma.product.findMany({
    where: {
      visible: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { ean: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
      ],
    },
    take: 8,
    include: { brand: true, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

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
