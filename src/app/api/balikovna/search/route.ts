import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const RESULT_LIMIT = 20;

// Distance-ordered (lat/lng given, e.g. from the browser's geolocation) or
// text search (city / part of city / address) against our own BalikovnaPoint
// table — synced from Česká pošta's e-shop data feed by
// scripts/sync-balikovna-points.ts, never a live call to a third-party site
// at request time.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim();
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const lat = latParam !== null ? Number(latParam) : NaN;
  const lng = lngParam !== null ? Number(lngParam) : NaN;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const points = await prisma.$queryRaw<
      { id: string; name: string; address: string; kind: string; city: string; distanceKm: number }[]
    >`
      SELECT "id", "name", "address", "kind", "city",
        (6371 * acos(least(1, greatest(-1,
          cos(radians(${lat})) * cos(radians("lat")) * cos(radians("lng") - radians(${lng}))
          + sin(radians(${lat})) * sin(radians("lat"))
        )))) AS "distanceKm"
      FROM "BalikovnaPoint"
      ORDER BY "distanceKm" ASC
      LIMIT ${RESULT_LIMIT}
    `;
    return NextResponse.json({ points });
  }

  if (q && q.length >= 2) {
    const points = await prisma.balikovnaPoint.findMany({
      where: {
        OR: [
          { city: { contains: q, mode: "insensitive" } },
          { cityPart: { contains: q, mode: "insensitive" } },
          { address: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, address: true, kind: true, city: true },
      // Secondary sort by id: without a stable tiebreaker, Postgres can
      // return same-city rows in a different order across otherwise
      // identical requests, making the list reshuffle while typing.
      orderBy: [{ city: "asc" }, { id: "asc" }],
      take: RESULT_LIMIT,
    });
    return NextResponse.json({ points });
  }

  return NextResponse.json({ points: [] });
}
