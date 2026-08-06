import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

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
